// ═══════════════════════════════════════════════════════════════════════════
// test-typed-cutover.mjs — Contrato de las tablas tipadas por entidad (Fase 3B)
//
// Correr desde la raíz del proyecto con un PG de PRUEBAS:
//   WWP_PG_TEST_URL="postgresql://postgres@localhost:5544/wwp_dev" node tests/test-typed-cutover.mjs
//
// Sin WWP_PG_TEST_URL sale con SKIP (código 0). ⚠️ La DB apuntada se LIMPIA.
// Cubre: dual-write transaccional, roundtrip sin pérdida (null explícito vs
// ausente, drift de tipo, claves nuevas, espacios, jsonb anidado, ids dupli-
// cados), backfill idempotente/heal, modo read con su guardia de conteos, y
// paridad. Usa los esquemas REALES de typed-schemas.js (artefacto del deploy).
// ═══════════════════════════════════════════════════════════════════════════
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';

const require = createRequire(import.meta.url);
const ROOT = process.cwd();

const PG_URL = process.env.WWP_PG_TEST_URL || '';
if (!PG_URL) {
  console.log('SKIP: WWP_PG_TEST_URL no definida — test de cutover tipado omitido.');
  process.exit(0);
}
if (/prod|railway\.internal|rlwy\.net/.test(PG_URL) && !/wwp_dev/.test(PG_URL)) {
  console.error('ABORT: WWP_PG_TEST_URL no parece una DB de pruebas (se esperaba wwp_dev).');
  process.exit(1);
}
process.env.DATABASE_URL = PG_URL;

let passed = 0, failed = 0;
function check(name, cond, extra) {
  if (cond) { passed++; console.log('  ✓ ' + name); }
  else { failed++; console.error('  ✗ ' + name + (extra !== undefined ? ' — ' + JSON.stringify(extra) : '')); }
}

function freshStorage(mode) {
  process.env.WWP_TYPED = mode;
  const p = require.resolve(path.join(ROOT, 'storage-pg.js'));
  delete require.cache[p];
  delete require.cache[require.resolve(path.join(ROOT, 'typed-schemas.js'))];
  return require(p);
}

const { Client } = require('pg');
async function q(sql, params) {
  const c = new Client({ connectionString: PG_URL, connectionTimeoutMillis: 10000, query_timeout: 20000 });
  await c.connect();
  try { return await c.query(sql, params); } finally { await c.end(); }
}

// Canónico local (claves ordenadas) para comparar objetos sin depender del orden
function canon(v) {
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
  return JSON.stringify(v);
}

const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'typed-cutover-'));

// ── Limpieza total de la DB de pruebas ──────────────────────────────────────
{
  const t = await q("SELECT tablename FROM pg_tables WHERE schemaname='public'");
  for (const r of t.rows) await q('DROP TABLE IF EXISTS "' + r.tablename + '" CASCADE');
}

const USERS = 'wwp-users-auth';
const TASKS = 'wwp-tasks';

// Fila con TODOS los casos borde del contrato de roundtrip:
const gabriel = {
  id: 'au_gabriel',
  name: 'Gabriel Joaquín Sánchez Ramírez',   // espacios y tildes intactos
  email: 'g@altritempi.com.do',
  role: 'admin',
  odooId: 95,                                 // number → float8
  active: true,                               // boolean
  lastLogin: null,                            // null EXPLÍCITO → _extra
  // resetToken AUSENTE a propósito (debe seguir ausente tras roundtrip)
  campoNuevo2027: 'no está en el esquema',    // clave fuera de esquema → _extra
};
const ana = {
  id: 'au_ana', name: 'Ana', email: 'a@x.do', role: 'manager',
  odooId: '48',                               // DRIFT: string en columna float8 → _extra
  active: false,
};
const dup1 = { id: 'dup', name: 'Primero' };
const dup2 = { id: 'dup', name: 'Segundo' };  // id duplicado → _rid inyectado

console.log('── dual-write: descomposición y _extra ────────────────────────────');
{
  const st = freshStorage('dual');
  await st.init({ dataDir: DATA_DIR });
  st.saveCollection(USERS, [gabriel, ana, dup1, dup2]);
  st.saveCollection(TASKS, [{
    id: 'wt_1', title: 'Tarea con items', status: 'pending', seq: 1,
    items: [{ item_id: 'i1', product_name: 'Sofá Roma 3 plazas', qty: 2 }],  // jsonb
    createdAt: '2026-07-22T10:00:00.000Z',
  }]);
  st.saveCollection('col-sin-esquema', [{ id: 'x1', v: 1 }]); // sin tabla tipada
  await st.flushAll();

  const r = await q('SELECT * FROM t_wwp_users_auth ORDER BY "_ord"');
  check('4 filas en la tabla tipada (dup incluido)', r.rows.length === 4, r.rows.length);
  const g = r.rows.find(x => x._key === 'au_gabriel');
  check('texto con espacios/tildes intacto en columna', g && g.name === gabriel.name, g && g.name);
  check('number → float8 y vuelve como number', g && g.odooId === 95, g && g.odooId);
  check('boolean en columna', g && g.active === true);
  check('null explícito viaja en _extra (columna NULL)', g && g.lastLogin === null && g._extra && g.lastLogin === null && 'lastLogin' in g._extra && g._extra.lastLogin === null, g && g._extra);
  check('clave fuera de esquema en _extra', g && g._extra && g._extra.campoNuevo2027 === gabriel.campoNuevo2027);
  check('clave AUSENTE no aparece por ningún lado', g && g.resetToken === null && !(g._extra && 'resetToken' in g._extra));
  const a = r.rows.find(x => x._key === 'au_ana');
  check('drift de tipo (string en float8) va a _extra', a && a.odooId === null && a._extra && a._extra.odooId === '48', a && a._extra);
  const t1 = (await q('SELECT * FROM t_wwp_tasks')).rows[0];
  check('jsonb anidado (items) roundtrip', t1 && canon(t1.items) === canon([{ item_id: 'i1', product_name: 'Sofá Roma 3 plazas', qty: 2 }]), t1 && t1.items);
  const noTable = await q("SELECT 1 FROM pg_tables WHERE tablename='t_col_sin_esquema'");
  check('colección sin esquema NO crea tabla tipada', noTable.rows.length === 0);

  const par = await st.typedParity();
  check('paridad total tras el primer flush', par.ok === true, JSON.stringify(par.collections[USERS]));

  console.log('── update + delete con touched ────────────────────────────────────');
  const list = st.loadCollection(USERS);
  const gg = list.find(u => u.id === 'au_gabriel');
  gg.role = 'superadmin';
  st.saveCollection(USERS, list, { touched: [gg] });
  list.splice(list.findIndex(u => u.id === 'au_ana'), 1);
  st.saveCollection(USERS, list, { touched: [] });
  await st.flushAll();
  const r2 = await q('SELECT * FROM t_wwp_users_auth');
  check('update tipado aplicado', r2.rows.find(x => x._key === 'au_gabriel').role === 'superadmin');
  check('delete tipado aplicado (3 filas)', r2.rows.length === 3, r2.rows.length);
  check('paridad tras update+delete', (await st.typedParity()).ok === true);
  await st.shutdown();
}

console.log('── reinicio en dual: backfill no-op y paridad ──────────────────────');
{
  const st = freshStorage('dual');
  await st.init({ dataDir: DATA_DIR });
  check('memoria desde collection_rows (3 usuarios)', st.loadCollection(USERS).length === 3);
  check('paridad tras reinicio', (await st.typedParity()).ok === true);
  await st.shutdown();
}

console.log('── backfill heal: tabla truncada se reconstruye sola ──────────────');
{
  await q('TRUNCATE t_wwp_users_auth');
  const st = freshStorage('dual');
  await st.init({ dataDir: DATA_DIR });
  const n = (await q('SELECT count(*)::int AS n FROM t_wwp_users_auth')).rows[0].n;
  check('backfill repobló la tabla', n === 3, n);
  check('paridad tras heal', (await st.typedParity()).ok === true);
  await st.shutdown();
}

console.log('── modo read: memoria desde las tablas tipadas ────────────────────');
{
  const st = freshStorage('read');
  await st.init({ dataDir: DATA_DIR });
  const users = st.loadCollection(USERS);
  check('read: 3 usuarios desde la tabla tipada', users.length === 3, users.length);
  const g = users.find(u => u.id === 'au_gabriel');
  const esperado = { ...gabriel, role: 'superadmin' };
  check('read: roundtrip EXACTO (null explícito, ausente, extra, espacios)', canon(g) === canon(esperado), g);
  const dups = users.filter(u => u.id === 'dup');
  check('read: los 2 duplicados sobreviven', dups.length === 2, dups.length);
  const t1 = st.loadCollection(TASKS)[0];
  check('read: tarea con items jsonb intacta', t1 && t1.items[0].product_name === 'Sofá Roma 3 plazas');
  // y se puede seguir escribiendo (dual sigue activo en read)
  g.resetToken = 'tok_prueba_123';   // columna del esquema
  g.phone = '809-555-0000';          // clave fuera de esquema → _extra
  st.saveCollection(USERS, users, { touched: [g] });
  await st.flushAll();
  const row = (await q("SELECT * FROM t_wwp_users_auth WHERE \"_key\"='au_gabriel'")).rows[0];
  check('read: el save dual-escribe (columna del esquema)', row.resetToken === 'tok_prueba_123', row.resetToken);
  check('read: clave fuera de esquema del save va a _extra', row._extra && row._extra.phone === '809-555-0000', row._extra);
  const cr = (await q("SELECT data->>'phone' AS p FROM collection_rows WHERE collection=$1 AND id='au_gabriel'", [USERS])).rows[0];
  check('read: collection_rows también recibió el write (rollback vivo)', cr && cr.p === '809-555-0000', cr);
  await st.shutdown();
}

console.log('── guardia de read: divergencia de conteo NO adopta la tabla ──────');
{
  await q("DELETE FROM t_wwp_users_auth WHERE \"_key\"='au_gabriel'"); // divergencia artificial
  const st = freshStorage('read');
  await st.init({ dataDir: DATA_DIR });
  // 2 filas en tabla vs 3 en collection_rows → la colección se queda en collection_rows
  check('guardia: memoria completa pese a tabla divergente', st.loadCollection(USERS).length === 3, st.loadCollection(USERS).length);
  // …y el backfill del init ya la re-sanó (conteo volvió a coincidir)
  const n = (await q('SELECT count(*)::int AS n FROM t_wwp_users_auth')).rows[0].n;
  check('backfill re-sanó la divergencia en el mismo boot', n === 3, n);
  await st.shutdown();
}

console.log('── modo off: kill-switch no toca tablas tipadas ───────────────────');
{
  const st = freshStorage('off');
  await st.init({ dataDir: DATA_DIR });
  const users = st.loadCollection(USERS);
  users.find(u => u.id === 'au_gabriel').role = 'off-test';
  st.saveCollection(USERS, users, { touched: [users.find(u => u.id === 'au_gabriel')] });
  await st.flushAll();
  const row = (await q("SELECT role FROM t_wwp_users_auth WHERE \"_key\"='au_gabriel'")).rows[0];
  check('off: la tabla tipada NO se tocó', row.role === 'superadmin', row.role);
  const cr = (await q("SELECT data->>'role' AS r FROM collection_rows WHERE collection=$1 AND id='au_gabriel'", [USERS])).rows[0];
  check('off: collection_rows SÍ se actualizó', cr.r === 'off-test', cr);
  await st.shutdown();
}

fs.rmSync(DATA_DIR, { recursive: true, force: true });
console.log('');
console.log(passed + ' ✓ / ' + failed + ' ✗');
process.exit(failed ? 1 : 0);
