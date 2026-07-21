'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// storage-pg.js — Capa de almacenamiento PostgreSQL para WWP (backend dual)
//
// Con DATABASE_URL definida, proxy.js enruta loadJson/saveJson/saveCriticalArray
// de los archivos del DATA_DIR hacia este módulo. Sin DATABASE_URL, este módulo
// queda inerte y proxy.js sigue con archivos JSON como siempre.
//
// Modelo: store en memoria con write-through diferencial a Postgres.
//  - init() (async, ANTES de cargar proxy.js — ver boot.js): conecta, DDL,
//    precarga todas las colecciones a memoria e importa (una sola vez) los
//    archivos JSON existentes del DATA_DIR cuya colección no exista aún en la DB.
//  - loadCollection(base) es SÍNCRONO y devuelve la referencia viva en memoria
//    (misma semántica que el caché por mtime de loadJson: el código la muta
//    in-place y llama al saver).
//  - saveCollection(base, data) actualiza memoria y encola una escritura
//    DIFERENCIAL: solo las filas que cambiaron (INSERT/UPDATE/DELETE) en una
//    transacción, serializada por colección, con reintentos y auto-resync si
//    la cola se acumula.
//  - El orden del array se preserva con la columna `ord` (indexación
//    fraccional; renumeración completa solo si se agota la precisión).
//  - Filas sin id natural (id/seq/folio) reciben un `_rid` inyectado — clave
//    estable para diffs baratos en colecciones append-only (GPS, audit).
//  - exportAllToFiles() vuelca memoria → los MISMOS archivos JSON de siempre
//    en DATA_DIR (respaldo legible + botón de rollback: quitar DATABASE_URL).
// ═══════════════════════════════════════════════════════════════════════════

const path = require('path');
const fs = require('fs');

const ORD_STEP = 1024;          // separación inicial entre filas
const MIN_GAP = 1e-6;           // por debajo de esto, renumerar la colección
const UPSERT_CHUNK = 400;       // filas por statement (400×4 params < límite 65535)
const QUEUE_COALESCE_AT = 6;    // lotes en cola → colapsar a un resync completo
const CONNECT_RETRIES = 10;     // intentos de conexión al boot (3 s entre sí)

const state = {
  active: false,
  pool: null,
  dataDir: null,
  mem: new Map(),        // base → array | objeto (LA referencia viva)
  kind: new Map(),       // base → 'rows' | 'kv'
  rowSnap: new Map(),    // base → Map(id → {ser, ord}) — estado que la DB tendrá
  kvSnap: new Map(),     // base → string serializado
  opQueues: new Map(),   // base → [ops]
  flushing: new Map(),   // base → bool
  lastError: null,
  lastFlushAt: null,
  ridCounter: 0,
  closing: false,  // shutdown en curso: los reintentos se rinden en vez de sobrevivir a pool.end()
};

function isActive() { return state.active; }
function isEnabled() { return !!process.env.DATABASE_URL; }

// ── Claves de fila ───────────────────────────────────────────────────────────
function _newRid() {
  return 'r' + Date.now().toString(36) + '_' + (state.ridCounter++).toString(36) +
    Math.random().toString(36).slice(2, 6);
}
function _naturalId(item) {
  if (!item || typeof item !== 'object') return null;
  const raw = item.id ?? item.seq ?? item.folio;
  if (raw === null || raw === undefined || raw === '') return null;
  return String(raw);
}
// Clave única por fila dentro de un guardado; inyecta _rid si falta id natural
// o si el id natural está duplicado (bug de datos: no debe romper el guardado).
function _keyFor(item, seen) {
  let k = _naturalId(item);
  if (k === null || seen.has(k)) {
    if (item && typeof item === 'object') {
      if (item._rid == null || seen.has(String(item._rid))) item._rid = _newRid();
      k = String(item._rid);
    } else {
      k = _newRid(); // primitivo suelto en un array (no debería existir)
    }
  }
  seen.add(k);
  return k;
}

// ── Diff de arrays con orden fraccional ──────────────────────────────────────
function _diffArray(base, arr) {
  const prev = state.rowSnap.get(base) || new Map();
  const next = new Map();
  const seen = new Set();
  const upserts = [];
  let lastOrd = null;
  for (let i = 0; i < arr.length; i++) {
    const item = arr[i];
    const id = _keyFor(item, seen);
    const ser = JSON.stringify(item);
    const known = prev.get(id);
    const floor = lastOrd === null ? -Infinity : lastOrd;
    let ord;
    if (known && known.ord > floor) {
      ord = known.ord; // conserva su posición relativa
    } else {
      // ancla: la próxima fila existente cuyo ord siga siendo válido
      let anchor = null;
      for (let j = i + 1; j < arr.length; j++) {
        const aid = _naturalId(arr[j]) ?? (arr[j] && arr[j]._rid != null ? String(arr[j]._rid) : null);
        if (aid === null || seen.has(aid)) continue;
        const kj = prev.get(aid);
        if (kj && kj.ord > floor) { anchor = kj.ord; break; }
      }
      if (anchor !== null) {
        const lo = lastOrd === null ? anchor - 2 * ORD_STEP : lastOrd;
        if (anchor - lo < MIN_GAP) return { renumber: true };
        ord = (lo + anchor) / 2;
      } else {
        ord = (lastOrd === null ? 0 : lastOrd) + ORD_STEP;
      }
    }
    if (!known || known.ser !== ser || known.ord !== ord) upserts.push({ id, ord, ser });
    next.set(id, { ser, ord });
    lastOrd = ord;
  }
  const deletes = [];
  for (const id of prev.keys()) if (!next.has(id)) deletes.push(id);
  return { upserts, deletes, next };
}

// Renumeración completa (ord = (i+1)*ORD_STEP); se usa cuando el gap se agota.
function _renumberArray(base, arr) {
  const prev = state.rowSnap.get(base) || new Map();
  const next = new Map();
  const seen = new Set();
  const upserts = [];
  for (let i = 0; i < arr.length; i++) {
    const id = _keyFor(arr[i], seen);
    const ser = JSON.stringify(arr[i]);
    const ord = (i + 1) * ORD_STEP;
    const known = prev.get(id);
    if (!known || known.ser !== ser || known.ord !== ord) upserts.push({ id, ord, ser });
    next.set(id, { ser, ord });
  }
  const deletes = [];
  for (const id of prev.keys()) if (!next.has(id)) deletes.push(id);
  return { upserts, deletes, next };
}

// ── API pública: load / save ─────────────────────────────────────────────────
function loadCollection(base, fallback) {
  if (state.mem.has(base)) return state.mem.get(base);
  return fallback !== undefined ? fallback : [];
}

// Devuelve false SOLO si el blindaje anti-vacío bloqueó el guardado (paridad
// con saveCriticalArray). Nunca lanza por fallas de red: la memoria es la
// fuente de verdad inmediata y la cola reintenta hasta converger.
function saveCollection(base, data, opts = {}) {
  if (!state.active) throw new Error('storage-pg no inicializado (arranca con boot.js)');
  if (Array.isArray(data)) {
    const prev = state.rowSnap.get(base);
    const prevLen = prev ? prev.size : 0;
    if (opts.critical && data.length === 0 && prevLen >= 5) {
      console.error('[BLINDAJE-PG] Guardado de ' + base + ' BLOQUEADO: intento de vaciar ' +
        prevLen + ' filas -> 0. Estado en DB preservado.');
      _enqueue(base, { rejected: { attemptedLen: 0, prevLen } });
      return false;
    }
    let d = _diffArray(base, data);
    if (d.renumber) d = _renumberArray(base, data);
    state.mem.set(base, data);
    state.kind.set(base, 'rows');
    state.rowSnap.set(base, d.next);
    if (d.upserts.length || d.deletes.length) _enqueue(base, { upserts: d.upserts, deletes: d.deletes });
  } else {
    const ser = JSON.stringify(data === undefined ? null : data);
    state.mem.set(base, data);
    state.kind.set(base, 'kv');
    if (state.kvSnap.get(base) !== ser) {
      state.kvSnap.set(base, ser);
      _enqueue(base, { kv: ser });
    }
  }
  return true;
}

// ── Cola de escritura serializada por colección ──────────────────────────────
function _enqueue(base, op) {
  let q = state.opQueues.get(base);
  if (!q) { q = []; state.opQueues.set(base, q); }
  q.push(op);
  // Si la DB está caída y la cola crece, colapsar a un solo resync completo:
  // la memoria es la verdad, así que reescribir la colección entera converge.
  if (q.length > QUEUE_COALESCE_AT) {
    q.length = 0;
    q.push(_buildResyncOp(base));
  }
  _kick(base);
}

function _buildResyncOp(base) {
  if (state.kind.get(base) === 'kv') return { kv: state.kvSnap.get(base) || 'null' };
  const rows = [];
  const snap = state.rowSnap.get(base) || new Map();
  for (const [id, v] of snap) rows.push({ id, ord: v.ord, ser: v.ser });
  return { resyncRows: rows };
}

async function _kick(base) {
  if (state.flushing.get(base)) return;
  state.flushing.set(base, true);
  try {
    const q = state.opQueues.get(base);
    while (q && q.length) {
      try {
        await _flushWithRetry(base, q[0]);
      } catch (e) {
        // Solo llega aquí en shutdown: se abandona lo pendiente (la memoria ya
        // quedó exportada a JSON) sin dejar timers vivos que impidan salir.
        console.warn('[storage-pg] cola de ' + base + ' abandonada en shutdown (' + q.length + ' op(s)): ' + e.message);
        break;
      }
      q.shift();
    }
  } finally {
    state.flushing.set(base, false);
  }
}

async function _flushWithRetry(base, op) {
  let attempt = 0;
  for (;;) {
    try {
      await _flushOp(base, op);
      state.lastFlushAt = new Date().toISOString();
      if (state.lastError && state.lastError.startsWith('[' + base + ']')) state.lastError = null;
      return;
    } catch (e) {
      attempt++;
      state.lastError = '[' + base + '] ' + e.message;
      if (state.closing) throw new Error('shutdown en curso — ' + e.message);
      const delay = Math.min(30000, 500 * Math.pow(2, Math.min(attempt, 6)));
      console.error('[storage-pg] escritura de ' + base + ' falló (intento ' + attempt + '): ' +
        e.message + ' — reintento en ' + delay + ' ms');
      // dormir en tramos cortos para poder rendirse si llega el shutdown
      for (let slept = 0; slept < delay; slept += 250) {
        if (state.closing) throw new Error('shutdown en curso — ' + e.message);
        await new Promise(r => setTimeout(r, Math.min(250, delay - slept)));
      }
    }
  }
}

async function _flushOp(base, op) {
  const client = await state.pool.connect();
  try {
    await client.query('BEGIN');
    if (op.rejected) {
      await client.query(
        'INSERT INTO rejected_writes(collection, attempted_len, prev_len) VALUES ($1,$2,$3)',
        [base, op.rejected.attemptedLen, op.rejected.prevLen]);
    } else if (op.kv !== undefined) {
      await client.query(
        'INSERT INTO kv_store(key, data, updated_at) VALUES ($1, $2::jsonb, now()) ' +
        'ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, updated_at = now()',
        [base, _pgSafe(op.kv)]);
    } else if (op.resyncRows) {
      await client.query('DELETE FROM collection_rows WHERE collection = $1', [base]);
      await _insertRows(client, base, op.resyncRows);
    } else {
      if (op.deletes && op.deletes.length) {
        await client.query(
          'DELETE FROM collection_rows WHERE collection = $1 AND id = ANY($2::text[])',
          [base, op.deletes]);
      }
      if (op.upserts && op.upserts.length) await _insertRows(client, base, op.upserts);
    }
    await client.query('COMMIT');
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) { /* conexión rota */ }
    throw e;
  } finally {
    client.release();
  }
}

// JSONB rechaza el caracter NUL (escape unicode cero) dentro de strings (error 22P05).
// En el JSON serializado, un NUL real aparece como la secuencia backslash-u0000 precedida
// de un numero PAR de backslashes (impar = backslash literal escapado, eso si es valido).
// Se elimina para que un dato sucio heredado no envenene la cola de escritura.
function _pgSafe(ser) {
  if (ser.indexOf('\\u0000') === -1) return ser;
  return ser.replace(/(?<!\\)((?:\\\\)*)\\u0000/g, '$1');
}

async function _insertRows(client, base, rows) {
  for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
    const chunk = rows.slice(i, i + UPSERT_CHUNK);
    const values = [];
    const params = [];
    chunk.forEach((r, j) => {
      const o = j * 4;
      values.push('($' + (o + 1) + ',$' + (o + 2) + ',$' + (o + 3) + ',$' + (o + 4) + '::jsonb)');
      params.push(base, r.id, r.ord, _pgSafe(r.ser));
    });
    await client.query(
      'INSERT INTO collection_rows(collection, id, ord, data) VALUES ' + values.join(',') +
      ' ON CONFLICT (collection, id) DO UPDATE SET ord = EXCLUDED.ord, data = EXCLUDED.data, updated_at = now()',
      params);
  }
}

// Espera a que todas las colas terminen (para shutdown y tests).
async function flushAll(timeoutMs = 15000) {
  const t0 = Date.now();
  for (;;) {
    let pending = 0;
    for (const q of state.opQueues.values()) pending += q.length;
    for (const f of state.flushing.values()) if (f) pending++;
    if (!pending) return true;
    if (Date.now() - t0 > timeoutMs) return false;
    await new Promise(r => setTimeout(r, 50));
  }
}

// ── Inicialización: conexión, DDL, precarga e importación ────────────────────
async function init(opts = {}) {
  if (state.active) return;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL no definida');
  state.dataDir = opts.dataDir || process.env.DATA_DIR || __dirname;

  const { Pool } = require('pg');
  state.pool = new Pool({
    connectionString: url,
    max: 5,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    // Sin timeout de query, una conexión TCP medio-muerta (red inestable) deja
    // la operación colgada PARA SIEMPRE y el reintento nunca despierta.
    query_timeout: 30000,
    keepAlive: true,
    ssl: process.env.PGSSL === '1' ? { rejectUnauthorized: false } : undefined,
  });
  state.pool.on('error', (e) => { state.lastError = '[pool] ' + e.message; console.error('[storage-pg] pool:', e.message); });

  // Conexión con reintentos; si no hay DB, NO arrancar sirviendo vacío.
  let lastErr = null;
  for (let i = 0; i < CONNECT_RETRIES; i++) {
    try { await state.pool.query('SELECT 1'); lastErr = null; break; }
    catch (e) { lastErr = e; console.error('[storage-pg] conexión fallida (' + (i + 1) + '/' + CONNECT_RETRIES + '): ' + e.message); await new Promise(r => setTimeout(r, 3000)); }
  }
  if (lastErr) throw new Error('PostgreSQL inaccesible tras ' + CONNECT_RETRIES + ' intentos: ' + lastErr.message);

  await state.pool.query(
    'CREATE TABLE IF NOT EXISTS collection_rows(' +
    ' collection TEXT NOT NULL, id TEXT NOT NULL, ord DOUBLE PRECISION NOT NULL,' +
    ' data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),' +
    ' PRIMARY KEY (collection, id))');
  await state.pool.query(
    'CREATE INDEX IF NOT EXISTS idx_collection_ord ON collection_rows(collection, ord)');
  await state.pool.query(
    'CREATE TABLE IF NOT EXISTS kv_store(key TEXT PRIMARY KEY, data JSONB NOT NULL,' +
    ' updated_at TIMESTAMPTZ NOT NULL DEFAULT now())');
  await state.pool.query(
    'CREATE TABLE IF NOT EXISTS rejected_writes(id BIGSERIAL PRIMARY KEY, collection TEXT,' +
    ' attempted_len INT, prev_len INT, at TIMESTAMPTZ NOT NULL DEFAULT now())');

  await _preload();
  await _importFromFiles();
  state.active = true;
  const cols = [...state.mem.keys()];
  console.log('[storage-pg] activo — ' + cols.length + ' colecciones en memoria: ' +
    cols.map(b => b + '(' + (Array.isArray(state.mem.get(b)) ? state.mem.get(b).length : 'kv') + ')').join(', '));
}

async function _preload() {
  const res = await state.pool.query(
    'SELECT collection, id, ord, data FROM collection_rows ORDER BY collection, ord');
  for (const row of res.rows) {
    let arr = state.mem.get(row.collection);
    if (!arr) {
      arr = [];
      state.mem.set(row.collection, arr);
      state.kind.set(row.collection, 'rows');
      state.rowSnap.set(row.collection, new Map());
    }
    arr.push(row.data);
    state.rowSnap.get(row.collection).set(row.id, { ser: JSON.stringify(row.data), ord: Number(row.ord) });
  }
  const kv = await state.pool.query('SELECT key, data FROM kv_store');
  for (const row of kv.rows) {
    state.mem.set(row.key, row.data);
    state.kind.set(row.key, 'kv');
    state.kvSnap.set(row.key, JSON.stringify(row.data));
  }
}

// Importa (una vez) los .json del DATA_DIR cuya colección no exista en la DB.
// Corrupto sin .bak recuperable → LANZA (misma filosofía fail-visible de loadJson).
async function _importFromFiles() {
  let files = [];
  try { files = fs.readdirSync(state.dataDir); } catch { return; }
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    const base = f.slice(0, -5);
    // Basura de respaldos manuales, NO colecciones: nombres con ".json." adentro
    // (p.ej. wwp-tasks.json.charis-relink-<ts>.json) o sufijo de timestamp en ms
    // (p.ej. wwp-tasks.relink-1782401507882.json). En el primer corte a PG se
    // importaron 5 de estos como colecciones inertes — nunca más.
    if (/\.json\./.test(f) || /-\d{13}$/.test(base)) {
      console.log('[storage-pg] import: ' + f + ' ignorado (respaldo manual, no colección)');
      continue;
    }
    if (state.mem.has(base)) continue; // la DB ya la tiene
    const full = path.join(state.dataDir, f);
    let st;
    try { st = fs.statSync(full); } catch { continue; }
    if (!st.isFile()) continue;
    let data;
    try {
      data = JSON.parse(fs.readFileSync(full, 'utf-8'));
    } catch (e) {
      try {
        data = JSON.parse(fs.readFileSync(full + '.bak', 'utf-8'));
        console.warn('[storage-pg] import: ' + f + ' corrupto, recuperado desde .bak');
      } catch {
        throw new Error('Import bloqueado: JSON corrupto sin respaldo utilizable en ' + f + ' — ' + e.message);
      }
    }
    if (Array.isArray(data)) {
      const seen = new Set();
      const rows = data.map((item, i) => ({
        id: _keyFor(item, seen),
        ord: (i + 1) * ORD_STEP,
        ser: JSON.stringify(item),
      }));
      // Reintentos: la transacción se revierte completa en fallo, así que
      // reintentar es seguro (idempotente). Agotar reintentos sí LANZA: un
      // import incompleto al boot debe tumbar el arranque, no pasar callado.
      let imported = false, lastImportErr = null;
      for (let attempt = 1; attempt <= 5 && !imported; attempt++) {
        const client = await state.pool.connect();
        try {
          await client.query('BEGIN');
          await _insertRows(client, base, rows);
          await client.query('COMMIT');
          imported = true;
        } catch (e) {
          lastImportErr = e;
          try { await client.query('ROLLBACK'); } catch (_) {}
          console.warn('[storage-pg] import de ' + base + ' falló (intento ' + attempt + '/5): ' + e.message);
          await new Promise(r => setTimeout(r, attempt * 2000));
        } finally { client.release(); }
      }
      if (!imported) throw lastImportErr;
      state.mem.set(base, data);
      state.kind.set(base, 'rows');
      state.rowSnap.set(base, new Map(rows.map(r => [r.id, { ser: r.ser, ord: r.ord }])));
      console.log('[storage-pg] importado ' + base + ': ' + rows.length + ' filas desde ' + f +
        ' (' + Math.round(st.size / 1024) + ' KB)');
    } else {
      const ser = JSON.stringify(data === undefined ? null : data);
      let imported = false, lastImportErr = null;
      for (let attempt = 1; attempt <= 5 && !imported; attempt++) {
        try {
          await state.pool.query(
            'INSERT INTO kv_store(key, data) VALUES ($1, $2::jsonb) ON CONFLICT (key) DO NOTHING',
            [base, _pgSafe(ser)]);
          imported = true;
        } catch (e) {
          lastImportErr = e;
          console.warn('[storage-pg] import kv de ' + base + ' falló (intento ' + attempt + '/5): ' + e.message);
          await new Promise(r => setTimeout(r, attempt * 2000));
        }
      }
      if (!imported) throw lastImportErr;
      state.mem.set(base, data);
      state.kind.set(base, 'kv');
      state.kvSnap.set(base, ser);
      console.log('[storage-pg] importado ' + base + ' (objeto) desde ' + f);
    }
  }
}

// ── Export memoria → archivos JSON (respaldo legible + rollback) ─────────────
// Escritura atómica propia (tmp → .bak → rename), sin depender de proxy.js.
function _atomicWriteJson(file, data) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data), 'utf-8');
  try { if (fs.existsSync(file)) fs.copyFileSync(file, file + '.bak'); } catch { /* best-effort */ }
  fs.renameSync(tmp, file);
}
function exportAllToFiles() {
  if (!state.active) return 0;
  let n = 0;
  for (const [base, data] of state.mem) {
    try { _atomicWriteJson(path.join(state.dataDir, base + '.json'), data); n++; }
    catch (e) { console.warn('[storage-pg] export de ' + base + ' falló: ' + e.message); }
  }
  return n;
}

// Vista de solo lectura de todas las colecciones vivas (para el endpoint de
// respaldo externo). Devuelve las referencias reales — el llamador NO debe mutar.
function snapshotAll() {
  const out = {};
  for (const [base, data] of state.mem) out[base] = data;
  return out;
}

// ── Salud y apagado ──────────────────────────────────────────────────────────
function health() {
  const collections = {};
  for (const [base, data] of state.mem) {
    collections[base] = Array.isArray(data) ? data.length : 'kv';
  }
  let queuePending = 0;
  for (const q of state.opQueues.values()) queuePending += q.length;
  return {
    mode: 'pg', active: state.active, collections, queuePending,
    lastError: state.lastError, lastFlushAt: state.lastFlushAt,
  };
}

async function shutdown() {
  if (!state.active) return;
  const drained = await flushAll(15000);
  if (!drained) console.warn('[storage-pg] shutdown con cola pendiente (DB inaccesible?) — la memoria se exporta a JSON igualmente');
  try { exportAllToFiles(); } catch (e) { console.warn('[storage-pg] export final falló:', e.message); }
  state.closing = true; // a partir de aquí los reintentos se rinden (no sobrevivir a pool.end)
  try { await state.pool.end(); } catch { /* ya cerrado */ }
  state.active = false;
}

module.exports = {
  init, isActive, isEnabled,
  loadCollection, saveCollection,
  exportAllToFiles, flushAll, health, shutdown, snapshotAll,
  _internals: state, // solo para tests
};
