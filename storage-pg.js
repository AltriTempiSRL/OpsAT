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
//  - saveCollection(base, data, { touched: [filas|ids] }) — dirty-flags (B3):
//    el caller declara qué filas mutó y las demás reusan su serialización
//    previa (el costo CPU del diff deja de crecer con el tamaño total).
//    Sin `touched` el diff completo sigue igual que siempre.
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

// ── Cutover relacional (Fase 3B): tablas tipadas por entidad ─────────────────
// Cada colección de typed-schemas.js tiene su tabla real t_<coleccion>
// (columnas tipadas + _key PK + _ord + _extra JSONB). WWP_TYPED gobierna:
//   off  → solo collection_rows (kill-switch / rollback total)
//   dual → collection_rows + tabla tipada en la MISMA transacción (default)
//   read → como dual, pero la memoria del boot se reconstruye desde las tipadas
// collection_rows y el export a JSON siguen vivos en TODOS los modos: el
// rollback es cambiar la env var y reiniciar (sin migración de vuelta).
const TYPED_SCHEMAS = require('./typed-schemas.js');
// Default 'read' desde el 22-jul-2026 (cutover completado: paridad 24/24
// verificada en prod tras el backfill del deploy dual). Para rollback operativo
// setear WWP_TYPED=dual (o off) en el entorno — la env var siempre gana.
const TYPED_MODE = ['off', 'dual', 'read'].includes(process.env.WWP_TYPED) ? process.env.WWP_TYPED : 'read';

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

// B3 (dirty-flags): normaliza opts.touched → Set de claves de fila, o null si
// no se declaró nada (diff completo). Acepta objetos (usa su id natural o el
// _rid ya inyectado) o claves directas. Un objeto aún sin clave (fila nueva)
// se ignora: las filas sin snapshot previo se stringifican siempre.
function _touchedKeySet(touched) {
  if (!touched) return null;
  const list = Array.isArray(touched) ? touched : (touched instanceof Set ? [...touched] : [touched]);
  const keys = new Set();
  for (const t of list) {
    if (t && typeof t === 'object') {
      const k = _naturalId(t) ?? (t._rid != null ? String(t._rid) : null);
      if (k !== null) keys.add(k);
    } else if (t !== null && t !== undefined && t !== '') {
      keys.add(String(t));
    }
  }
  return keys;
}

// Una fila puede reusar su serialización previa solo si: hay touchedKeys, la
// fila ya existía en el snapshot, no fue declarada tocada, y su clave NO fue
// remapeada por id natural duplicado (ahí la clave del caller y la del diff
// divergen y reusar podría perder una mutación real).
function _canReuseSer(touchedKeys, known, id, item) {
  if (!touchedKeys || !known || touchedKeys.has(id)) return false;
  const nat = _naturalId(item);
  return nat === null || nat === id;
}

// ── Diff de arrays con orden fraccional ──────────────────────────────────────
function _diffArray(base, arr, touchedKeys) {
  const prev = state.rowSnap.get(base) || new Map();
  const next = new Map();
  const seen = new Set();
  const upserts = [];
  let lastOrd = null;
  for (let i = 0; i < arr.length; i++) {
    const item = arr[i];
    const id = _keyFor(item, seen);
    const known = prev.get(id);
    const ser = _canReuseSer(touchedKeys, known, id, item) ? known.ser : JSON.stringify(item);
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
function _renumberArray(base, arr, touchedKeys) {
  const prev = state.rowSnap.get(base) || new Map();
  const next = new Map();
  const seen = new Set();
  const upserts = [];
  for (let i = 0; i < arr.length; i++) {
    const item = arr[i];
    const id = _keyFor(item, seen);
    const known = prev.get(id);
    const ser = _canReuseSer(touchedKeys, known, id, item) ? known.ser : JSON.stringify(item);
    const ord = (i + 1) * ORD_STEP;
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
    const touchedKeys = _touchedKeySet(opts.touched);
    let d = _diffArray(base, data, touchedKeys);
    if (d.renumber) d = _renumberArray(base, data, touchedKeys);
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
    await _typedApplyOps(client, base, op); // Fase 3B: dual-write tipado en la MISMA transacción
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

// ═══════════════════════════════════════════════════════════════════════════
// Fase 3B — Tablas tipadas por entidad (cutover relacional, patrón estrangulador)
// ═══════════════════════════════════════════════════════════════════════════
const _PG_TYPE = { text: 'TEXT', boolean: 'BOOLEAN', float8: 'DOUBLE PRECISION', jsonb: 'JSONB' };

function _typedTable(base) { return 't_' + String(base).replace(/[^a-z0-9]+/gi, '_'); }

// Descompone un objeto en columnas tipadas + _extra, SIN pérdida:
//  - null explícito, clave fuera de esquema, o valor cuyo tipo no coincide con
//    la columna → viaja en _extra (JSONB) tal cual.
//  - Contrato de reconstrucción: NULL en columna = clave AUSENTE del objeto
//    (los null reales viven en _extra) — así {} y {campo:null} sobreviven distintos.
function _typedDecompose(obj, schema) {
  const cols = {};
  const extra = {};
  let hasExtra = false;
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    const t = schema[k];
    if (v === null || t === undefined) { extra[k] = v; hasExtra = true; continue; }
    if (t === 'text' && typeof v === 'string') { cols[k] = v.indexOf('\u0000') === -1 ? v : v.split('\u0000').join(''); continue; }
    if (t === 'boolean' && typeof v === 'boolean') { cols[k] = v; continue; }
    if (t === 'float8' && typeof v === 'number' && Number.isFinite(v)) { cols[k] = v; continue; }
    if (t === 'jsonb' && typeof v === 'object') { cols[k] = _pgSafe(JSON.stringify(v)); continue; }
    extra[k] = v; hasExtra = true; // drift de tipo → sin pérdida
  }
  return { cols, extra: hasExtra ? _pgSafe(JSON.stringify(extra)) : null };
}

// Inversa exacta de _typedDecompose (los nombres de columna conservan mayúsculas
// porque el DDL las crea SIEMPRE entre comillas).
function _typedReconstruct(row, schema) {
  const obj = Object.assign({}, row._extra || {});
  for (const k of Object.keys(schema)) {
    const v = row[k];
    if (v !== null && v !== undefined) obj[k] = v;
  }
  return obj;
}

async function _createTypedTables() {
  if (TYPED_MODE === 'off') return;
  for (const [base, schema] of Object.entries(TYPED_SCHEMAS)) {
    const t = _typedTable(base);
    const defs = Object.entries(schema).map(([k, ty]) => '"' + k + '" ' + _PG_TYPE[ty]);
    await state.pool.query(
      'CREATE TABLE IF NOT EXISTS ' + t + ' ("_key" TEXT PRIMARY KEY, "_ord" DOUBLE PRECISION NOT NULL, "_extra" JSONB' +
      (defs.length ? ', ' + defs.join(', ') : '') + ')');
    // Evolución del esquema entre deploys: agregar columnas nuevas es idempotente.
    const adds = Object.entries(schema).map(([k, ty]) => 'ADD COLUMN IF NOT EXISTS "' + k + '" ' + _PG_TYPE[ty]);
    if (adds.length) await state.pool.query('ALTER TABLE ' + t + ' ' + adds.join(', '));
    await state.pool.query('CREATE INDEX IF NOT EXISTS idx_' + t + '_ord ON ' + t + '("_ord")');
  }
  console.log('[typed] ' + Object.keys(TYPED_SCHEMAS).length + ' tablas tipadas listas (modo ' + TYPED_MODE + ')');
}

// Upsert de filas {id, ord, ser} a la tabla tipada (dentro de la transacción del caller).
async function _typedUpsertRows(client, base, rows) {
  const schema = TYPED_SCHEMAS[base];
  const t = _typedTable(base);
  const colNames = Object.keys(schema);
  const all = ['_key', '_ord', '_extra'].concat(colNames);
  const colList = all.map(c => '"' + c + '"').join(',');
  const casts = all.map((c, i) => '$' + (i + 1) + ((c === '_extra' || schema[c] === 'jsonb') ? '::jsonb' : ''));
  const sets = all.slice(1).map(c => '"' + c + '" = EXCLUDED."' + c + '"').join(', ');
  const sql = 'INSERT INTO ' + t + ' (' + colList + ') VALUES (' + casts.join(',') + ') ' +
    'ON CONFLICT ("_key") DO UPDATE SET ' + sets;
  for (const r of rows) {
    let obj = null;
    try { obj = JSON.parse(r.ser); } catch (_e) { /* corrupto: visible en typedParity */ }
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      console.warn('[typed] fila no-objeto en ' + base + ' (' + r.id + ') — queda solo en collection_rows');
      continue;
    }
    const { cols, extra } = _typedDecompose(obj, schema);
    const params = [r.id, r.ord, extra].concat(colNames.map(k => (cols[k] === undefined ? null : cols[k])));
    await client.query(sql, params);
  }
}

// Se llama dentro de la transacción de _flushOp: espeja la op en la tabla tipada.
async function _typedApplyOps(client, base, op) {
  if (TYPED_MODE === 'off') return;
  const schema = TYPED_SCHEMAS[base];
  if (!schema) return; // colección sin tabla tipada (o clave kv) — solo collection_rows
  const t = _typedTable(base);
  if (op.resyncRows) {
    await client.query('DELETE FROM ' + t);
    await _typedUpsertRows(client, base, op.resyncRows);
    return;
  }
  if (op.deletes && op.deletes.length) {
    await client.query('DELETE FROM ' + t + ' WHERE "_key" = ANY($1::text[])', [op.deletes]);
  }
  if (op.upserts && op.upserts.length) await _typedUpsertRows(client, base, op.upserts);
}

// Backfill idempotente al boot: si el conteo de la tabla difiere del snapshot en
// memoria, se reconstruye entera (transaccional). Con dual-write activo esto solo
// trabaja la primera vez (o tras un fallo); después los conteos coinciden.
async function _typedBackfill() {
  if (TYPED_MODE === 'off') return;
  for (const base of Object.keys(TYPED_SCHEMAS)) {
    const snap = state.rowSnap.get(base);
    const memRows = snap ? snap.size : 0;
    const t = _typedTable(base);
    let n = -1;
    try { n = (await state.pool.query('SELECT count(*)::int AS n FROM ' + t)).rows[0].n; }
    catch (e) { console.error('[typed] conteo de ' + t + ' falló: ' + e.message); continue; }
    if (n === memRows) continue;
    const client = await state.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM ' + t);
      if (memRows) {
        const rows = [];
        for (const [id, v] of snap) rows.push({ id, ord: v.ord, ser: v.ser });
        await _typedUpsertRows(client, base, rows);
      }
      await client.query('COMMIT');
      console.log('[typed] backfill ' + base + ' → ' + t + ': ' + memRows + ' filas (tenía ' + n + ')');
    } catch (e) {
      try { await client.query('ROLLBACK'); } catch (_) { /* conexión rota */ }
      console.error('[typed] backfill ' + base + ' falló: ' + e.message);
    } finally {
      client.release();
    }
  }
}

// Modo read: la memoria del boot se reconstruye DESDE las tablas tipadas.
// Guardia dura: si el conteo no coincide con collection_rows, esa colección se
// queda con collection_rows como fuente (jamás arrancar con datos de menos).
async function _typedRebuildMem() {
  for (const base of Object.keys(TYPED_SCHEMAS)) {
    const t = _typedTable(base);
    const schema = TYPED_SCHEMAS[base];
    let res;
    try { res = await state.pool.query('SELECT * FROM ' + t + ' ORDER BY "_ord"'); }
    catch (e) { console.error('[typed] READ: lectura de ' + t + ' falló (' + e.message + ') — ' + base + ' sigue en collection_rows'); continue; }
    const prevSnap = state.rowSnap.get(base);
    const prevN = prevSnap ? prevSnap.size : 0;
    if (res.rows.length !== prevN) {
      console.error('[typed] READ: ' + t + ' tiene ' + res.rows.length + ' filas vs ' + prevN +
        ' en collection_rows — ' + base + ' sigue en collection_rows');
      continue;
    }
    const arr = [];
    const snapMap = new Map();
    for (const row of res.rows) {
      const obj = _typedReconstruct(row, schema);
      arr.push(obj);
      snapMap.set(row._key, { ser: JSON.stringify(obj), ord: Number(row._ord) });
    }
    state.mem.set(base, arr);
    state.kind.set(base, 'rows');
    state.rowSnap.set(base, snapMap);
  }
  console.log('[typed] modo read: memoria reconstruida desde las tablas tipadas');
}

// Serialización canónica (claves ordenadas, recursiva) para comparar objetos
// sin depender del orden de inserción de claves.
function _canonical(v) {
  if (Array.isArray(v)) return '[' + v.map(_canonical).join(',') + ']';
  if (v && typeof v === 'object') {
    return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + _canonical(v[k])).join(',') + '}';
  }
  return JSON.stringify(v);
}

// Paridad memoria ↔ tabla tipada, por colección (para verificación admin/tests).
async function typedParity() {
  if (!state.active) throw new Error('storage-pg no activo');
  const out = { mode: TYPED_MODE, ok: true, collections: {} };
  for (const base of Object.keys(TYPED_SCHEMAS)) {
    const schema = TYPED_SCHEMAS[base];
    const snap = state.rowSnap.get(base) || new Map();
    let res;
    try { res = await state.pool.query('SELECT * FROM ' + _typedTable(base)); }
    catch (e) { out.collections[base] = { error: e.message }; out.ok = false; continue; }
    const difs = [];
    const seen = new Set();
    for (const row of res.rows) {
      seen.add(row._key);
      const s = snap.get(row._key);
      if (!s) { if (difs.length < 10) difs.push(row._key + ' (solo en tabla)'); continue; }
      let a = null;
      try { a = JSON.parse(s.ser); } catch (_e) { /* corrupto en snap */ }
      if (_canonical(_typedReconstruct(row, schema)) !== _canonical(a)) {
        if (difs.length < 10) difs.push(row._key);
      }
    }
    for (const k of snap.keys()) { if (!seen.has(k) && difs.length < 10) difs.push(k + ' (solo en memoria)'); }
    const okC = res.rows.length === snap.size && difs.length === 0;
    if (!okC) out.ok = false;
    out.collections[base] = { memoria: snap.size, tabla: res.rows.length, ok: okC, difs };
  }
  return out;
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

  await _createViews();
  // Fase 3B: las tablas tipadas se crean ANTES del preload/import — así los flush
  // de la cola pueden dual-escribir desde el primer save sin carrera con el DDL.
  await _createTypedTables();
  await _preload();
  await _importFromFiles();
  await _typedBackfill();
  if (TYPED_MODE === 'read') await _typedRebuildMem();
  state.active = true;
  const cols = [...state.mem.keys()];
  console.log('[storage-pg] activo (typed=' + TYPED_MODE + ') — ' + cols.length + ' colecciones en memoria: ' +
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
    typed: { mode: TYPED_MODE, tablas: Object.keys(TYPED_SCHEMAS).length },
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

// ── Vistas SQL tipadas (Fase 3, incremento 1) ────────────────────────────────
// Proyectan collection_rows (JSONB) como TABLAS legibles/consultables, SIN cambiar
// cómo la app lee o escribe (fuente de verdad sigue siendo la colección en memoria).
// Best-effort: un fallo aquí NO debe tumbar el arranque (las vistas son accesorias).
const READABLE_VIEWS = new Set(['v_usuarios', 'v_roles', 'v_tareas', 'v_averias', 'v_inventario', 'v_sdv', 'v_inspecciones', 'v_vehiculos',
  'v_solicitudes_showroom', 'v_materiales', 'v_reglas_empaque', 'v_despachos_obsoleto', 'v_cursos']);
async function _createViews() {
  const ddls = [
    // Usuarios — EXCLUYE campos sensibles (passwordHash, resetToken*). Todo TEXT
    // (data->>'x') para que ningún cast falle en runtime.
    "CREATE OR REPLACE VIEW v_usuarios AS SELECT " +
    "data->>'id' AS id, data->>'name' AS nombre, data->>'email' AS email, " +
    "data->>'role' AS rol, data->>'odooId' AS odoo_id, data->>'active' AS activo, " +
    "data->>'lastLogin' AS ultimo_login, data->>'mustChangePassword' AS debe_cambiar_pw, " +
    "data->>'createdAt' AS creado " +
    "FROM collection_rows WHERE collection = 'wwp-users-auth' ORDER BY ord",
    // Roles (wwp-role-defs) — id, nombre y si es rol integrado del sistema.
    "CREATE OR REPLACE VIEW v_roles AS SELECT " +
    "data->>'id' AS id, data->>'name' AS nombre, data->>'isBuiltin' AS es_builtin " +
    "FROM collection_rows WHERE collection = 'wwp-role-defs' ORDER BY ord",
    // Tareas (wwp-tasks) — SOLO la cabecera (sin items/fotos/historial, que son
    // arrays anidados). Campos verificados contra datos reales de producción.
    "CREATE OR REPLACE VIEW v_tareas AS SELECT " +
    "data->>'id' AS id, data->>'seq' AS seq, data->>'type' AS tipo, " +
    "data->>'title' AS titulo, data->>'client' AS cliente, data->>'status' AS estado, " +
    "data->>'dueDate' AS vence, data->>'odooRef' AS odoo_ref, " +
    "data->>'managerId' AS encargado_id, data->>'sdvId' AS sdv_id, " +
    "data->>'createdAt' AS creado " +
    "FROM collection_rows WHERE collection = 'wwp-tasks' ORDER BY ord",
    // Averías (averias) — cabecera; sin statusHistory (array) ni image (base64/url).
    "CREATE OR REPLACE VIEW v_averias AS SELECT " +
    "data->>'id' AS id, data->>'ref' AS ref, data->>'name' AS producto, " +
    "data->>'barcode' AS barcode, data->>'location' AS ubicacion, " +
    "data->>'qty' AS cantidad, data->>'status' AS estado, " +
    "data->>'comentario' AS comentario, data->>'createdAt' AS creado " +
    "FROM collection_rows WHERE collection = 'averias' ORDER BY ord",
    // Casos de inventario (wwp-inventario-casos) — seguimiento de negativos Odoo.
    "CREATE OR REPLACE VIEW v_inventario AS SELECT " +
    "data->>'id' AS id, data->>'sku' AS sku, data->>'estado' AS estado, " +
    "data->>'tipo' AS tipo, data->>'causa' AS causa, data->>'qty' AS cantidad, " +
    "data->>'responsable' AS responsable, data->>'nota' AS nota " +
    "FROM collection_rows WHERE collection = 'wwp-inventario-casos' ORDER BY ord",
    // SDV (sdv-solicitudes) — cabecera de la solicitud de despacho/devolución.
    // Campos VERIFICADOS contra prod 22-jul-2026 (jsonb_object_keys): tipoSolicitud/
    // clienteNombre/creadoNombre/odooOrderRef (no tipo/cliente/vendedora/odooRef).
    "CREATE OR REPLACE VIEW v_sdv AS SELECT " +
    "data->>'id' AS id, data->>'folio' AS folio, data->>'estado' AS estado, " +
    "data->>'tipoSolicitud' AS tipo, data->>'clienteNombre' AS cliente, " +
    "data->>'creadoNombre' AS creado_por, data->>'ciudadEntrega' AS ciudad, " +
    "data->>'fechaSolicitud' AS fecha_solicitud, data->>'fechaEntrega' AS fecha_entrega, " +
    "data->>'odooOrderRef' AS odoo_ref, data->>'retRef' AS ret_ref, " +
    "data->>'wwpTaskId' AS tarea_wwp, data->>'creadoAt' AS creado " +
    "FROM collection_rows WHERE collection = 'sdv-solicitudes' ORDER BY ord",
    // Inspecciones de vehículos (wwp-inspecciones). Campos verificados contra prod.
    // EXCLUYE fotos_condicion (17 MB de base64 — el 99% del peso de la colección),
    // items (array anidado) y firmaConductor: una vista con esos campos colgaría
    // el visor y cualquier SELECT *.
    "CREATE OR REPLACE VIEW v_inspecciones AS SELECT " +
    "data->>'id' AS id, data->>'placa' AS placa, data->>'vehiculo' AS vehiculo, " +
    "data->>'conductor' AS conductor, data->>'fecha' AS fecha, data->>'hora' AS hora, " +
    "data->>'km' AS km, data->>'combustible' AS combustible, data->>'apto' AS apto, " +
    "data->>'createdByName' AS registrado_por, data->>'createdAt' AS creado " +
    "FROM collection_rows WHERE collection = 'wwp-inspecciones' ORDER BY ord",
    // Vehículos / flota (wwp-vehicles). Campos reales: name/fuelType/isBuiltin
    // (no existen nombre/tipo/modelo/activo).
    "CREATE OR REPLACE VIEW v_vehiculos AS SELECT " +
    "data->>'id' AS id, data->>'name' AS nombre, data->>'placa' AS placa, " +
    "data->>'fuelType' AS combustible, data->>'isBuiltin' AS es_builtin " +
    "FROM collection_rows WHERE collection = 'wwp-vehicles' ORDER BY ord",
    // Solicitudes showroom (wwp-solicitudes-showroom). EXCLUYE imageBase64 (123 KB).
    "CREATE OR REPLACE VIEW v_solicitudes_showroom AS SELECT " +
    "data->>'id' AS id, data->>'ref' AS ref, data->>'name' AS producto, " +
    "data->>'barcode' AS barcode, data->>'ubicacion' AS ubicacion, data->>'almacen' AS almacen, " +
    "data->>'status' AS estado, " +
    "COALESCE(data->'solicitadoPor'->>'name', data->>'solicitadoPor') AS solicitado_por, " +
    "data->>'source' AS origen, data->>'fechaSolicitud' AS fecha_solicitud, data->>'nota' AS nota " +
    "FROM collection_rows WHERE collection = 'wwp-solicitudes-showroom' ORDER BY ord",
    // Materiales de empaque (emp-materiales).
    "CREATE OR REPLACE VIEW v_materiales AS SELECT " +
    "data->>'id' AS id, data->>'nombre' AS nombre, data->>'descripcion' AS descripcion, " +
    "data->>'foto_url' AS foto_url " +
    "FROM collection_rows WHERE collection = 'emp-materiales' ORDER BY ord",
    // Reglas de empaque por categoría (emp-reglas). materiales es un array → solo conteo.
    "CREATE OR REPLACE VIEW v_reglas_empaque AS SELECT " +
    "data->>'id' AS id, data->>'categ_id' AS categ_id, data->>'categ_nombre' AS categoria, " +
    "CASE WHEN jsonb_typeof(data->'materiales')='array' THEN jsonb_array_length(data->'materiales') END AS num_materiales " +
    "FROM collection_rows WHERE collection = 'emp-reglas' ORDER BY ord",
    // Despachos módulo obsoleto (despachos-obsoleto) — histórico consultable.
    "CREATE OR REPLACE VIEW v_despachos_obsoleto AS SELECT " +
    "data->>'id' AS id, data->>'folio' AS folio, data->>'seq' AS seq, data->>'estado' AS estado, " +
    "data->>'transportista' AS transportista, data->>'vehiculo' AS vehiculo, " +
    "data->>'receptor' AS receptor, data->>'creadoPor' AS creado_por, " +
    "CASE WHEN jsonb_typeof(data->'lineas')='array' THEN jsonb_array_length(data->'lineas') END AS num_lineas, " +
    "data->>'createdAt' AS creado, data->>'entregadoAt' AS entregado " +
    "FROM collection_rows WHERE collection = 'despachos-obsoleto' ORDER BY ord",
    // Cursos de formación (wwp-training-courses). EXCLUYE lessons/exam (anidados).
    "CREATE OR REPLACE VIEW v_cursos AS SELECT " +
    "data->>'id' AS id, data->>'title' AS titulo, data->>'category' AS categoria, " +
    "data->>'competency' AS competencia, data->>'active' AS activo, " +
    "data->>'passingScore' AS puntaje_minimo, data->>'validityDays' AS vigencia_dias, " +
    "CASE WHEN jsonb_typeof(data->'lessons')='array' THEN jsonb_array_length(data->'lessons') END AS num_lecciones, " +
    "data->>'version' AS version, data->>'createdAt' AS creado " +
    "FROM collection_rows WHERE collection = 'wwp-training-courses' ORDER BY ord",
  ];
  for (const ddl of ddls) {
    try { await state.pool.query(ddl); }
    catch (e) { console.warn('[storage-pg] creación de vista falló (no crítico): ' + e.message); }
  }
  console.log('[storage-pg] vistas SQL listas: ' + [...READABLE_VIEWS].join(', '));
}
// Lectura de una vista whitelisteada (para el visor admin). Solo lectura.
async function readView(name) {
  if (!state.active) throw new Error('storage-pg no activo');
  if (!READABLE_VIEWS.has(name)) throw new Error('vista no permitida: ' + name);
  const res = await state.pool.query('SELECT * FROM ' + name);  // name whitelisteado arriba
  return res.rows;
}

module.exports = {
  init, isActive, isEnabled,
  loadCollection, saveCollection,
  exportAllToFiles, flushAll, health, shutdown, snapshotAll,
  readView,
  typedParity, // Fase 3B: paridad memoria ↔ tablas tipadas (endpoint admin + tests)
  _internals: state, // solo para tests
};
