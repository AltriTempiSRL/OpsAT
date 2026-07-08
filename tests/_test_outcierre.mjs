// _test_outcierre.mjs — Valida la LÓGICA del "refuerzo de cierre del ciclo OUT en
// Odoo" (Decisión 17) extrayendo las funciones REALES de proxy.js por regex (patrón
// de los _test_*.mjs de este repo). No levanta el server; odooCall/loadWwpTasks se
// inyectan como stubs para ejercitar sobre fixtures controlados.
//
// Cubre:
//  - sdvComputePickStatus: fix badge 'parcial' (excluir backorders de saldo) con el
//    caso REAL S07639 (7 done + 1 waiting-backorder → debe leer 'despachado').
//  - sdvReconcileOutVsTask: matching por odoo_product_id (kits .Cn 1:1), dirección A
//    (gate duro), dirección B (warning), fail-open ante Odoo caído.
//  - deriveOutBadge: none/pending/closed.
//  - eoBuildOutCierreMetrics: backlog por edad (fecha LOCAL) + lag de cierre p50/p90.
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const SRC = fs.readFileSync(path.join(ROOT, 'proxy.js'), 'utf8');

function extractFn(name) {
  const re = new RegExp('(?:async\\s+)?function\\s+' + name + '\\s*\\(', 'g');
  const m = re.exec(SRC);
  if (!m) throw new Error('No se encontró la función ' + name + ' en proxy.js');
  let i = SRC.indexOf('{', m.index);
  let depth = 0, end = -1;
  for (let j = i; j < SRC.length; j++) {
    const c = SRC[j];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { end = j + 1; break; } }
  }
  if (end < 0) throw new Error('Llaves desbalanceadas en ' + name);
  return SRC.slice(m.index, end);
}

const FN_NAMES = [
  'eoLocalDaySerial', 'eoDayDiff',
  'sdvComputePickStatus', 'sdvReconcileOutVsTask', 'deriveOutBadge',
  'eoBuildOutCierreMetrics',
];

// Stubs inyectables. __odoo(model,method,args,kwargs) enruta por model+method.
let ODOO = async () => [];
let TASKS = [];
const bodySrc = FN_NAMES.map(extractFn).join('\n\n');
const factory = new Function('__odoo', '__getTasks',
  `
  async function odooCall(model, method, args, kwargs) { return __odoo(model, method, args, kwargs); }
  function loadWwpTasks() { return __getTasks(); }
  function silentCatch(){}
  function safeError(e){ return (e && e.message) || String(e); }
  ${bodySrc}
  return { ${FN_NAMES.join(', ')} };
  `
);
const F = factory((...a) => ODOO(...a), () => TASKS);

const R = [];
const ok = (name, cond, detail) => { R.push({ pass: !!cond }); console.log(`${cond ? '✓' : '✗'} ${name}${cond ? '' : '  → ' + JSON.stringify(detail)}`); };

// ── 1) sdvComputePickStatus: fix badge 'parcial' (caso real S07639) ───────────
{
  // 7 done + 1 waiting que es backorder del último done (dentro del set) → 'despachado'.
  ODOO = async (model, method, args) => {
    if (model === 'sale.order') return [{ id: 7639, name: 'S07639' }];
    if (model === 'stock.picking') return [
      { name:'ALVEN/OUT/07382', state:'done', date_done:'2026-06-17 12:41:18', backorder_id:false },
      { name:'ALVEN/OUT/07408', state:'done', date_done:'2026-06-22 13:33:54', backorder_id:[1,'ALVEN/OUT/07382'] },
      { name:'ALVEN/OUT/07465', state:'done', date_done:'2026-06-29 16:50:44', backorder_id:[2,'ALVEN/OUT/07408'] },
      { name:'ALVEN/OUT/07470', state:'waiting', date_done:false, backorder_id:[3,'ALVEN/OUT/07465'] },
      { name:'ALVEN/OUT/05944', state:'cancel', date_done:false, backorder_id:false },
    ];
    return [];
  };
  const ps = await F.sdvComputePickStatus('S07639');
  ok("S07639: waiting-backorder de saldo NO hace 'parcial' → 'despachado'", ps.code === 'despachado', ps);
  // `outs` conserva TODOS los /OUT/ (incl. cancel) para trazabilidad — el filtro de
  // cancel/backorder solo aplica al CÓMPUTO del badge, no al listado expuesto.
  ok('S07639: outs conserva TODOS los OUT para trazabilidad (5, incl. cancel)', ps.outs.length === 5, ps.outs.map(o=>o.name));
}
{
  // Parcial REAL: un OUT done + un OUT assigned que NO es backorder de otro OUT.
  ODOO = async (model) => {
    if (model === 'sale.order') return [{ id: 1, name: 'S00001' }];
    if (model === 'stock.picking') return [
      { name:'X/OUT/001', state:'done', date_done:'2026-06-01 10:00:00', backorder_id:false },
      { name:'X/OUT/002', state:'assigned', date_done:false, backorder_id:false },
    ];
    return [];
  };
  const ps = await F.sdvComputePickStatus('S00001');
  ok("Parcial real (done + assigned no-backorder) → 'parcial'", ps.code === 'parcial', ps);
}

// ── 2) sdvReconcileOutVsTask: matching por pid, dirección A / B, kits .Cn ──────
function stubOutReconcile(moves, prods) {
  return async (model, method, args) => {
    if (model === 'stock.picking' && method === 'search_read') return [{ id: 99, name:'X/OUT/700', state:'done', date_done:'2026-06-30 12:00:00' }];
    if (model === 'stock.move' && method === 'search_read') return moves;
    if (model === 'product.product' && method === 'read') return prods;
    return [];
  };
}
{
  // OUT con 2 kits .Cn (componentes) + 1 producto simple. Task: uno averiado (en OUT)
  // → dirección A (gate duro); uno entregado ausente del OUT → dirección B (warning).
  ODOO = stubOutReconcile(
    [
      { product_id:[53027,'[GVF.C1] Ebone (Copia)'], product_uom_qty:1, quantity_done:1, state:'done' },
      { product_id:[53028,'[GVF.C2] Ebone (Copia)'], product_uom_qty:1, quantity_done:1, state:'done' },
      { product_id:[50888,'[DB.MIRROR] Mirror'],     product_uom_qty:1, quantity_done:1, state:'done' },
      { product_id:[99999,'[CANCELADO]'],            product_uom_qty:0, quantity_done:0, state:'cancel' }, // ignorado
    ],
    [
      { id:53027, default_code:'GVF.C1' }, { id:53028, default_code:'GVF.C2' }, { id:50888, default_code:'DB.MIRROR' },
    ]
  );
  const task = { items: [
    { item_id:'a', odoo_product_id:53027, product_name:'Kit C1', deliveryStatus:'ok', delivered:true },        // ok, en OUT → matched
    { item_id:'b', odoo_product_id:53028, product_name:'Kit C2', deliveryStatus:'damaged', delivered:false },   // A: averiado en OUT
    { item_id:'c', odoo_product_id:70000, product_name:'Sofá ausente', deliveryStatus:'ok', delivered:true },   // B: entregado, NO en OUT
  ]};
  const rec = await F.sdvReconcileOutVsTask('X/OUT/700', task);
  ok('recon ok + gate duro por averiado en OUT', rec.ok && rec.gateDuro === true, rec);
  ok('dirección A captura el averiado (pid 53028)', rec.mismatchA.length === 1 && rec.mismatchA[0].odoo_product_id === 53028, rec.mismatchA);
  ok('dirección A reporta default_code limpio (no "(Copia)")', rec.mismatchA[0].default_code === 'GVF.C2', rec.mismatchA[0]);
  ok('dirección B captura el entregado ausente del OUT (pid 70000)', rec.warningB.length === 1 && rec.warningB[0].odoo_product_id === 70000, rec.warningB);
  ok('kit .Cn matchea 1:1 por pid (C1 quedó en matched, no en A/B)', rec.matched.some(m => m.odoo_product_id === 53027), rec.matched);
  ok('move cancel (pid 99999) NO entra al match', !rec.matched.some(m => m.odoo_product_id === 99999) && !rec.mismatchA.some(m=>m.odoo_product_id===99999), rec);
}
{
  // Sin averías → sin gate duro (cierre limpio).
  ODOO = stubOutReconcile(
    [{ product_id:[1,'[A] prod'], product_uom_qty:2, quantity_done:2, state:'done' }],
    [{ id:1, default_code:'A' }]
  );
  const task = { items: [{ item_id:'x', odoo_product_id:1, deliveryStatus:'ok', delivered:true }] };
  const rec = await F.sdvReconcileOutVsTask('X/OUT/700', task);
  ok('sin averías → gateDuro false', rec.ok && rec.gateDuro === false, rec);
}
{
  // Fail-open: Odoo lanza → ok:false, odooError, gateDuro undefined (no bloquea).
  ODOO = async () => { throw new Error('ECONNREFUSED odoo'); };
  const rec = await F.sdvReconcileOutVsTask('X/OUT/700', { items: [{ odoo_product_id:1, deliveryStatus:'damaged' }] });
  ok('Odoo caído → ok:false + odooError, sin gate', rec.ok === false && rec.odooError === true && !rec.gateDuro, rec);
}
{
  // qty_done=0 pero demanda>0 (proceso admin) → SÍ cuenta como "presente en el OUT".
  ODOO = stubOutReconcile(
    [{ product_id:[5,'[Z] prod'], product_uom_qty:1, quantity_done:0, state:'done' }],
    [{ id:5, default_code:'Z' }]
  );
  const task = { items: [{ item_id:'z', odoo_product_id:5, deliveryStatus:'not_delivered', delivered:false }] };
  const rec = await F.sdvReconcileOutVsTask('X/OUT/700', task);
  ok('qty_done=0 con demanda>0 cuenta como presente → gate duro por no-entregado', rec.gateDuro === true, rec);
}

// ── 3) deriveOutBadge ─────────────────────────────────────────────────────────
{
  ok('badge none: tarea sin outPendiente', F.deriveOutBadge({ type:'dispatch_order' }).code === 'none');
  ok('badge none: no dispatch_order', F.deriveOutBadge({ type:'packaging', outPendiente:{} }).code === 'none');
  const t = { type:'dispatch_order', outPendiente:{ since:'2026-07-01T00:00:00Z', confirmedOutRef:'X/OUT/9', outState:'waiting' } };
  ok('badge pending: OUT confirmado no done', F.deriveOutBadge(t).code === 'pending');
  ok('badge closed: outStateLive done flippea a closed', F.deriveOutBadge(t, 'done').code === 'closed');
  ok('badge pending expone outRef', F.deriveOutBadge(t).outRef === 'X/OUT/9');
}

// ── 4) eoBuildOutCierreMetrics: backlog por edad + lag ────────────────────────
{
  const now = Date.now();
  const daysAgo = n => new Date(now - n * 864e5).toISOString();
  TASKS = [
    // Cerrada: OUT done, date_done 5h después del dispatchCompletedAt → lag 5h.
    { id:'t1', type:'dispatch_order', sdvId:'s1', dispatchCompletedAt: daysAgo(2),
      outPendiente:{ confirmedOutRef:'O/OUT/1' } },
    // Backlog reciente (1 día): OUT waiting.
    { id:'t2', type:'dispatch_order', sdvId:'s2', dispatchCompletedAt: daysAgo(1),
      outPendiente:{ confirmedOutRef:'O/OUT/2' } },
    // Backlog viejo (40 días): sin confirmar → bucket 31+.
    { id:'t3', type:'dispatch_order', sdvId:'s3', dispatchCompletedAt: daysAgo(40),
      outPendiente:{ candidatos:[] } },
    // Excluida: sin sdvId (era-implementación).
    { id:'t4', type:'dispatch_order', dispatchCompletedAt: daysAgo(1), outPendiente:{ confirmedOutRef:'O/OUT/4' } },
    // Excluida: no dispatch.
    { id:'t5', type:'packaging', sdvId:'s5', dispatchCompletedAt: daysAgo(1) },
  ];
  // date_done de O/OUT/1 = dispatchCompletedAt de t1 + 5h.
  const t1DoneMs = new Date(TASKS[0].dispatchCompletedAt).getTime() + 5*36e5;
  const d = new Date(t1DoneMs);
  const pad = n => String(n).padStart(2,'0');
  const doneStr = d.getUTCFullYear()+'-'+pad(d.getUTCMonth()+1)+'-'+pad(d.getUTCDate())+' '+pad(d.getUTCHours())+':'+pad(d.getUTCMinutes())+':'+pad(d.getUTCSeconds());
  ODOO = async (model, method, args) => {
    if (model === 'stock.picking') return [
      { name:'O/OUT/1', state:'done', date_done: doneStr },
      { name:'O/OUT/2', state:'waiting', date_done:false },
    ];
    return [];
  };
  const m = await F.eoBuildOutCierreMetrics(90);
  ok('universo excluye no-sdv y no-dispatch (3 tareas)', m.universo === 3, m);
  ok('cerrados = 1 (t1)', m.cerrados === 1, m);
  ok('backlog = 2 (t2 + t3)', m.backlog === 2, m);
  const b0 = m.backlogPorEdad.find(x=>x.rango==='0-2').tareas;
  const b31 = m.backlogPorEdad.find(x=>x.rango==='31+').tareas;
  ok('backlog t2 (1 día) → bucket 0-2', b0 === 1, m.backlogPorEdad);
  ok('backlog t3 (40 días) → bucket 31+', b31 === 1, m.backlogPorEdad);
  ok('lag n=1', m.lag.n === 1, m.lag);
  ok('lag p50 ≈ 5h', Math.abs(m.lag.p50 - 5) < 0.2, m.lag);
  ok('backlogTop ordenado por edad desc (t3 primero)', m.backlogTop[0].taskId === 't3', m.backlogTop);
}
{
  // Odoo vacío / sin refs no lanza.
  TASKS = [{ id:'x', type:'dispatch_order', sdvId:'s', dispatchCompletedAt: new Date().toISOString(), outPendiente:{ candidatos:[] } }];
  ODOO = async () => [];
  const m = await F.eoBuildOutCierreMetrics(90);
  ok('sin OUT confirmado → todo backlog, no lanza', m.ok && m.backlog === 1 && m.cerrados === 0, m);
}

// ── Resumen ───────────────────────────────────────────────────────────────────
const passed = R.filter(r => r.pass).length;
console.log(`\n${passed}/${R.length} aserciones`);
if (passed !== R.length) process.exit(1);
