// ═══════════════════════════════════════════════════════════════════════════
// test-storage-pg.mjs — Contrato de la capa de almacenamiento PostgreSQL
//
// Correr desde la raíz del proyecto:
//   WWP_PG_TEST_URL="postgresql://..." node tests/test-storage-pg.mjs
//
// Sin WWP_PG_TEST_URL sale con SKIP (código 0) — la suite JSON no depende de PG.
// ⚠️ La DB apuntada se LIMPIA (DROP de las tablas de storage). Usar wwp_dev,
// nunca la DB de producción.
// ═══════════════════════════════════════════════════════════════════════════
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';

const require = createRequire(import.meta.url);
const ROOT = process.cwd();

const PG_URL = process.env.WWP_PG_TEST_URL || '';
if (!PG_URL) {
  console.log('SKIP: WWP_PG_TEST_URL no definida — test de storage PG omitido.');
  process.exit(0);
}
if (/prod|railway\.internal/.test(PG_URL) && !/wwp_dev/.test(PG_URL)) {
  console.error('ABORT: WWP_PG_TEST_URL no parece una DB de pruebas (se esperaba wwp_dev).');
  process.exit(1);
}
process.env.DATABASE_URL = PG_URL;

let passed = 0, failed = 0;
function check(name, cond, extra) {
  if (cond) { passed++; console.log('  ✓ ' + name); }
  else { failed++; console.error('  ✗ ' + name + (extra !== undefined ? ' — ' + JSON.stringify(extra) : '')); }
}

// Módulo fresco de storage-pg (estado en scope de módulo → borrar caché = "reinicio")
function freshStorage() {
  const p = require.resolve(path.join(ROOT, 'storage-pg.js'));
  delete require.cache[p];
  return require(p);
}

const { Client } = require('pg');
// Mismo modo TLS que la capa bajo prueba (PGSSL_CA_FILE/PGSSL_CA/PGSSL): si el
// wwp_dev remoto va por el proxy público, sin esto `q` mandaría la contraseña
// EN CLARO — el proxy de Railway acepta conexiones sin TLS (verificado jul-2026).
const { _pgSsl } = require(path.join(ROOT, 'storage-pg.js'));
const Q_SSL = _pgSsl();
async function q(sql, params) {
  // Timeouts explícitos + reintentos: el proxy público de Railway (usado solo
  // para pruebas locales) sufre flaps; sin esto el test cuelga o muere por red
  // ajena a la capa bajo prueba (que tiene sus propios reintentos).
  let lastErr;
  for (let i = 0; i < 4; i++) {
    const c = new Client({ connectionString: PG_URL, connectionTimeoutMillis: 15000, query_timeout: 30000, ssl: Q_SSL });
    try {
      await c.connect();
      try { return await c.query(sql, params); } finally { await c.end(); }
    } catch (e) {
      lastErr = e;
      try { await c.end(); } catch {}
      console.warn('  (q reintento ' + (i + 1) + ': ' + e.message + ')');
      await new Promise(r => setTimeout(r, 2500));
    }
  }
  throw lastErr;
}

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wwp-pg-test-'));

async function main() {
  // ── Limpieza inicial de la DB de pruebas ──
  await q('DROP TABLE IF EXISTS collection_rows, kv_store, rejected_writes');

  // ── 1. Importación desde archivos al primer boot ──
  console.log('\n[1] Importación inicial desde DATA_DIR');
  const seedTasks = [
    { id: 'wt_a', title: 'Tarea A', status: 'pending' },
    { id: 'wt_b', title: 'Tarea B', status: 'in_progress' },
    { id: 'wt_c', title: 'Tarea C', status: 'pending' },
  ];
  fs.writeFileSync(path.join(dataDir, 'wwp-tasks.json'), JSON.stringify(seedTasks));
  fs.writeFileSync(path.join(dataDir, 'wwp-task-seq.json'), JSON.stringify({ seq: 5 }));

  let st = freshStorage();
  await st.init({ dataDir });
  let tasks = st.loadCollection('wwp-tasks', []);
  check('import: 3 tareas en memoria', tasks.length === 3, tasks.length);
  check('import: orden preservado', tasks.map(t => t.id).join(',') === 'wt_a,wt_b,wt_c');
  let dbRows = await q("SELECT id FROM collection_rows WHERE collection='wwp-tasks' ORDER BY ord");
  check('import: 3 filas en DB en orden', dbRows.rows.map(r => r.id).join(',') === 'wt_a,wt_b,wt_c');
  const seq = st.loadCollection('wwp-task-seq', { seq: 0 });
  check('import: objeto kv', seq && seq.seq === 5, seq);

  // ── 2. Mutación in-place + diff (update, push, unshift, delete) ──
  console.log('\n[2] Diff de escritura (update/push/unshift/delete)');
  tasks[1].status = 'completed';                    // update wt_b
  tasks.push({ id: 'wt_d', title: 'Tarea D' });     // append
  tasks.unshift({ id: 'wt_z', title: 'Tarea Z' });  // prepend
  const removed = tasks.splice(tasks.indexOf(tasks.find(t => t.id === 'wt_c')), 1); // delete wt_c
  check('setup: wt_c removida localmente', removed.length === 1);
  check('save devuelve true', st.saveCollection('wwp-tasks', tasks) === true);
  check('flush drena la cola', await st.flushAll(60000));
  dbRows = await q("SELECT id, data FROM collection_rows WHERE collection='wwp-tasks' ORDER BY ord");
  check('DB refleja orden nuevo (z,a,b,d)', dbRows.rows.map(r => r.id).join(',') === 'wt_z,wt_a,wt_b,wt_d', dbRows.rows.map(r => r.id));
  check('DB refleja el update de wt_b', dbRows.rows.find(r => r.id === 'wt_b').data.status === 'completed');

  // ── 3. Reinicio: la DB es la verdad, el archivo viejo NO se re-importa ──
  console.log('\n[3] Reinicio (precarga desde DB, import idempotente)');
  await st.shutdown(); // drena + exporta a JSON + cierra pool
  st = freshStorage();
  await st.init({ dataDir });
  tasks = st.loadCollection('wwp-tasks', []);
  check('reinicio: 4 tareas', tasks.length === 4, tasks.length);
  check('reinicio: orden z,a,b,d', tasks.map(t => t.id).join(',') === 'wt_z,wt_a,wt_b,wt_d', tasks.map(t => t.id));
  check('reinicio: update persistió', tasks.find(t => t.id === 'wt_b').status === 'completed');

  // ── 4. Export a JSON (rollback) ──
  console.log('\n[4] Export memoria → archivos JSON');
  const n = st.exportAllToFiles();
  check('export escribió >= 2 archivos', n >= 2, n);
  const onDisk = JSON.parse(fs.readFileSync(path.join(dataDir, 'wwp-tasks.json'), 'utf-8'));
  check('archivo JSON = estado vivo (rollback listo)', onDisk.length === 4 && onDisk[0].id === 'wt_z');

  // ── 5. Blindaje anti-vacío ──
  console.log('\n[5] Blindaje anti-vacío (paridad saveCriticalArray)');
  tasks.push({ id: 'wt_e' }); // llegar a 5 filas
  st.saveCollection('wwp-tasks', tasks, { critical: true });
  await st.flushAll(60000);
  const blocked = st.saveCollection('wwp-tasks', [], { critical: true });
  check('vaciar 5→0 con critical devuelve false', blocked === false);
  await st.flushAll(60000);
  dbRows = await q("SELECT count(*)::int AS n FROM collection_rows WHERE collection='wwp-tasks'");
  check('DB intacta tras bloqueo (5 filas)', dbRows.rows[0].n === 5, dbRows.rows[0].n);
  const rej = await q("SELECT count(*)::int AS n FROM rejected_writes WHERE collection='wwp-tasks'");
  check('intento registrado en rejected_writes', rej.rows[0].n === 1, rej.rows[0].n);
  check('vaciar SIN critical sí procede (paridad saveJson)', st.saveCollection('wwp-tasks', []) === true);
  await st.flushAll(60000);
  dbRows = await q("SELECT count(*)::int AS n FROM collection_rows WHERE collection='wwp-tasks'");
  check('DB vacía tras save no-critical', dbRows.rows[0].n === 0, dbRows.rows[0].n);

  // ── 6. kv: mutación y persistencia (patrón nextTaskSeq) ──
  console.log('\n[6] Objetos kv y secuencias');
  for (let i = 0; i < 20; i++) {
    const m = st.loadCollection('wwp-task-seq', { seq: 0 });
    m.seq += 1;
    st.saveCollection('wwp-task-seq', m);
  }
  await st.flushAll(60000);
  let kv = await q("SELECT data FROM kv_store WHERE key='wwp-task-seq'");
  check('20 incrementos → seq=25 en DB', kv.rows[0].data.seq === 25, kv.rows[0].data);

  // ── 7. Filas sin id natural (GPS/audit) → _rid estable, appends baratos ──
  console.log('\n[7] Colecciones sin id natural (_rid)');
  const pings = [{ lat: 18.5, lng: -69.9, at: 't1' }, { lat: 18.6, lng: -69.8, at: 't2' }];
  st.saveCollection('wwp-locations', pings);
  await st.flushAll(60000);
  const rid1 = pings[0]._rid;
  check('_rid inyectado', typeof rid1 === 'string' && rid1.length > 4, rid1);
  pings.push({ lat: 18.7, lng: -69.7, at: 't3' });
  st.saveCollection('wwp-locations', pings);
  await st.flushAll(60000);
  check('_rid estable entre saves', pings[0]._rid === rid1);
  dbRows = await q("SELECT count(*)::int AS n FROM collection_rows WHERE collection='wwp-locations'");
  check('3 pings en DB', dbRows.rows[0].n === 3, dbRows.rows[0].n);

  // ── 8. Reordenamiento agresivo (reverse → posible renumeración) ──
  console.log('\n[8] Reordenamiento (reverse)');
  const notas = Array.from({ length: 30 }, (_, i) => ({ id: 'n' + i, v: i }));
  st.saveCollection('wwp-notifications', notas);
  await st.flushAll(60000);
  notas.reverse();
  st.saveCollection('wwp-notifications', notas);
  await st.flushAll(60000);
  dbRows = await q("SELECT id FROM collection_rows WHERE collection='wwp-notifications' ORDER BY ord");
  check('DB refleja el reverse', dbRows.rows.map(r => r.id).join(',') === notas.map(x => x.id).join(','));
  // truncado tipo slice(0,2000)
  st.saveCollection('wwp-notifications', notas.slice(0, 10));
  await st.flushAll(60000);
  dbRows = await q("SELECT count(*)::int AS n FROM collection_rows WHERE collection='wwp-notifications'");
  check('truncado 30→10 borra filas', dbRows.rows[0].n === 10, dbRows.rows[0].n);

  await st.shutdown();

  // ── 9. Matriz TLS (_pgSsl) — sin red, solo la forma del config ──
  console.log('\n[9] TLS a Postgres (PGSSL / PGSSL_CA / PGSSL_CA_FILE)');
  {
    const ssl = st._pgSsl;
    const PEM = '-----BEGIN CERTIFICATE-----\nMIIfake\n-----END CERTIFICATE-----\n';
    check('sin PGSSL → sin TLS (red interna Railway)', ssl({}) === undefined);
    check('PGSSL=insecure → cifra sin verificar (escape explícito)',
      ssl({ PGSSL: 'insecure' }).rejectUnauthorized === false);
    let threw = null;
    try { ssl({ PGSSL: '1' }); } catch (e) { threw = e.message; }
    check('PGSSL=1 sin CA → error con instrucciones (antes degradaba en silencio)',
      !!threw && /PGSSL_CA_FILE/.test(threw), threw);
    const ca = ssl({ PGSSL_CA: PEM });
    check('PGSSL_CA inline → verify-ca (rejectUnauthorized:true + ca)',
      ca.rejectUnauthorized === true && ca.ca === PEM && typeof ca.checkServerIdentity === 'function');
    check('verify-ca ignora hostname (cert Railway dice localhost)',
      ca.checkServerIdentity('sakura.proxy.rlwy.net', {}) === undefined);
    const caPath = path.join(dataDir, 'root-test.crt');
    fs.writeFileSync(caPath, PEM);
    check('PGSSL_CA_FILE → lee el PEM del disco',
      ssl({ PGSSL_CA_FILE: caPath }).ca === PEM);
    threw = null;
    try { ssl({ PGSSL_CA_FILE: path.join(dataDir, 'no-existe.crt') }); } catch (e) { threw = e.message; }
    check('PGSSL_CA_FILE ilegible → error claro', !!threw && /ilegible/.test(threw), threw);
    threw = null;
    try { ssl({ PGSSL_CA: 'esto no es un PEM' }); } catch (e) { threw = e.message; }
    check('PGSSL_CA sin PEM → error claro', !!threw && /PEM/.test(threw), threw);
  }

  // ── Limpieza ──
  await q('DROP TABLE IF EXISTS collection_rows, kv_store, rejected_writes');
  try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch {}

  console.log('\n══════════════════════════════════');
  console.log('storage-pg: ' + passed + ' OK, ' + failed + ' FALLARON');
  process.exit(failed ? 1 : 0);
}

main().catch(e => { console.error('ERROR FATAL:', e); process.exit(1); });
