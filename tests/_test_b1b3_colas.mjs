// ═══════════════════════════════════════════════════════════════════════════
// _test_b1b3_colas.mjs — Contratos B1 (queueWrite) y B3 (dirty-flags touched)
// de la auditoría 07 (docs/auditoria-arquitectura/07-auditoria-escalabilidad).
//
// Correr desde la raíz del proyecto:  node tests/_test_b1b3_colas.mjs
//
// Sin dependencias externas: storage-pg se ejercita con un pool FALSO que
// captura las queries (no hace falta Postgres), y queueWrite se extrae del
// fuente de proxy.js (requerir proxy.js entero levantaría el servidor).
// ═══════════════════════════════════════════════════════════════════════════
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const require = createRequire(import.meta.url);
const ROOT = process.cwd();

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

// Pool falso: acepta todo, registra cada query con sus params.
function fakePool(log) {
  return {
    connect: async () => ({
      query: async (sql, params) => { log.push({ sql: String(sql), params: params || [] }); return { rows: [] }; },
      release: () => {},
    }),
    query: async (sql, params) => { log.push({ sql: String(sql), params: params || [] }); return { rows: [] }; },
    on: () => {},
    end: async () => {},
  };
}

// Ids upserteados en collection_rows a partir del log (params van de a 4: base,id,ord,ser)
function upsertedIds(log, base) {
  const ids = [];
  for (const q of log) {
    if (!q.sql.startsWith('INSERT INTO collection_rows')) continue;
    for (let i = 0; i < q.params.length; i += 4) {
      if (q.params[i] === base) ids.push({ id: q.params[i + 1], ser: q.params[i + 3] });
    }
  }
  return ids;
}

console.log('── B3: saveCollection(base, data, {touched}) ──────────────────────');
{
  const st = freshStorage();
  const S = st._internals;
  const log = [];
  S.active = true;
  S.pool = fakePool(log);

  const N = 500;
  const rows = Array.from({ length: N }, (_, i) => ({ id: 'r' + i, v: i, blob: 'x'.repeat(50) }));

  // contar llamadas reales a JSON.stringify durante cada save
  const origStringify = JSON.stringify.bind(JSON);
  let strCount = 0;
  JSON.stringify = function (...a) { strCount++; return origStringify(...a); };

  try {
    // 1. Save inicial (sin touched): stringifica todo
    strCount = 0;
    st.saveCollection('t1', rows);
    check('save inicial stringifica ~N filas (' + strCount + ')', strCount >= N && strCount <= N + 10, strCount);

    // 2. Mutar UNA fila y declararla: solo esa se re-stringifica
    await st.flushAll(); log.length = 0;
    rows[7].v = 999;
    strCount = 0;
    st.saveCollection('t1', rows, { touched: [rows[7]] });
    check('save con touched stringifica ~1 fila (' + strCount + ')', strCount <= 5, strCount);
    await st.flushAll();
    const up2 = upsertedIds(log, 't1');
    check('upsertea exactamente la fila tocada', up2.length === 1 && up2[0].id === 'r7', up2.map(u => u.id));
    check('la serialización refleja la mutación', up2.length === 1 && up2[0].ser.includes('999'));

    // 3. Peligro documentado: mutar SIN declarar → no viaja… pero un save
    //    completo posterior (sin touched) lo detecta y lo sana.
    log.length = 0;
    rows[9].v = 111;
    st.saveCollection('t1', rows, { touched: [rows[7]] });
    await st.flushAll();
    check('mutación no declarada NO viaja (peligro documentado)', upsertedIds(log, 't1').length === 0, upsertedIds(log, 't1'));
    log.length = 0;
    st.saveCollection('t1', rows); // diff completo
    await st.flushAll();
    const heal = upsertedIds(log, 't1');
    check('el save completo posterior sana la deriva', heal.length === 1 && heal[0].id === 'r9' && heal[0].ser.includes('111'), heal.map(u => u.id));

    // 4. Alta nueva con touched: se detecta aunque solo se declare la nueva; baja con touched=[]
    log.length = 0;
    const nueva = { id: 'nuevo1', v: -1 };
    rows.push(nueva);
    strCount = 0;
    st.saveCollection('t1', rows, { touched: [nueva] });
    await st.flushAll();
    const up4 = upsertedIds(log, 't1');
    check('fila nueva se upsertea', up4.length === 1 && up4[0].id === 'nuevo1', up4.map(u => u.id));
    check('alta con touched no re-stringifica el resto (' + strCount + ')', strCount <= 5, strCount);
    log.length = 0;
    rows.splice(3, 1); // borrar r3
    st.saveCollection('t1', rows, { touched: [] });
    await st.flushAll();
    const dels = log.filter(q => q.sql.startsWith('DELETE FROM collection_rows'));
    check('baja se detecta con touched=[]', dels.length === 1 && dels[0].params[1] && dels[0].params[1].includes('r3'), dels.map(d => d.params));

    // 5. Id natural duplicado: la clave remapeada NUNCA reusa serialización
    //    (si no, una mutación real podría perderse en silencio).
    const dupA = { id: 'dup', v: 'A' };
    const dupB = { id: 'dup', v: 'B' };
    st.saveCollection('t2', [dupA, dupB]);
    await st.flushAll(); log.length = 0;
    dupB.v = 'B2';
    st.saveCollection('t2', [dupA, dupB], { touched: [dupB] }); // normaliza a 'dup' — clave real es _rid
    await st.flushAll();
    const up5 = upsertedIds(log, 't2');
    check('fila con id duplicado no pierde la mutación', up5.some(u => u.ser.includes('B2')), up5);

    // 6. Rama kv intacta
    log.length = 0;
    st.saveCollection('cfg-test', { a: 1 });
    await st.flushAll();
    check('rama kv sigue funcionando', log.some(q => q.sql.startsWith('INSERT INTO kv_store')));
  } finally {
    JSON.stringify = origStringify;
  }
}

console.log('── B1: queueWrite (write-queue.js) ────────────────────────────────');
{
  const { queueWrite } = require(path.join(ROOT, 'write-queue.js'));
  // proxy.js debe usar ESTE módulo (no una copia local): el contrato de abajo
  // es el que asumen los handlers cableados.
  const proxySrc = fs.readFileSync(path.join(ROOT, 'proxy.js'), 'utf8');
  check('proxy.js requiere write-queue.js', proxySrc.includes("require('./write-queue")); // con o sin extensión .js
  {
    // 1. Serializa por clave: B espera a A aunque A sea lento
    const order = [];
    const a = queueWrite('k1', async () => { await new Promise(r => setTimeout(r, 60)); order.push('A'); });
    const b = queueWrite('k1', async () => { order.push('B'); });
    // 2. Claves distintas NO se bloquean entre sí
    const c = queueWrite('k2', async () => { order.push('C'); });
    await Promise.all([a, b, c]);
    check('misma clave serializa (A antes que B)', order.indexOf('A') < order.indexOf('B'), order);
    check('claves distintas no se bloquean (C primero)', order[0] === 'C', order);

    // 3. El error LLEGA al caller (para poder responder 500)…
    let caught = null;
    try { await queueWrite('k1', async () => { throw new Error('boom'); }); }
    catch (e) { caught = e.message; }
    check('el error se propaga al caller', caught === 'boom', caught);

    // 4. …pero la cadena sobrevive: el siguiente write de la clave corre igual
    let ranAfterError = false;
    await queueWrite('k1', async () => { ranAfterError = true; });
    check('la cadena sobrevive a un error', ranAfterError);

    // 5. El valor de retorno del writeFn llega al caller
    const val = await queueWrite('k3', async () => 42);
    check('el valor de retorno se propaga', val === 42, val);
  }
}

console.log('');
console.log(passed + ' ✓ / ' + failed + ' ✗');
process.exit(failed ? 1 : 0);
