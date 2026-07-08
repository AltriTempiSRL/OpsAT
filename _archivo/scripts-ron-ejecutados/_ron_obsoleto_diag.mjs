// Ron — Diagnóstico negativos OBSOLETO → AA1 (conduces CO-0003..0008)
// Uso: node _ron_obsoleto_diag.mjs
const ODOO_URL = 'https://altritempi.odoo.com';
const ODOO_DB  = 'marjorie82-altritempi-altritempi-5787837';
const ODOO_USER = 'gsanchez@altritempi.com.do';
const ODOO_KEY  = 'e3f2d0ca3b14858debbe2c336f09e9bb864ff717';

async function jsonrpc(service, method, args) {
  const r = await fetch(`${ODOO_URL}/jsonrpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc:'2.0', method:'call', id:1,
      params: { service, method, args } })
  });
  const d = await r.json();
  if (d.error) throw new Error(JSON.stringify(d.error));
  return d.result;
}

async function odoo(model, method, args, kwargs={}) {
  return jsonrpc('object', 'execute_kw', [ODOO_DB, uid, ODOO_KEY, model, method, args, kwargs]);
}

// 1. Auth
const uid = await jsonrpc('common', 'authenticate', [ODOO_DB, ODOO_USER, ODOO_KEY, {}]);
console.log(`✓ Auth uid=${uid}  ${new Date().toISOString()}`);

// 2. Resolver ubicaciones
const locs = await odoo('stock.location', 'search_read',
  [[['complete_name', 'ilike', 'OBSOLETO'], ['usage','=','internal']]],
  { fields:['id','complete_name'], limit:5000 });
const aa1Locs = await odoo('stock.location', 'search_read',
  [[['complete_name', 'ilike', 'AA1'], ['usage','=','internal']]],
  { fields:['id','complete_name'], limit:100 });

console.log(`\nUbicaciones OBSOLETO (${locs.length}): IDs = [${locs.slice(0,5).map(l=>l.id).join(',')}...]`);
console.log(`Ubicaciones AA1 (${aa1Locs.length}):`, aa1Locs.map(l=>`${l.id}=${l.complete_name}`).join(' | '));

const obsolIds = locs.map(l=>l.id);
const aa1Ids   = aa1Locs.map(l=>l.id);

// 3. Transferencias internas OBSOLETO→AA1 recientes (30 días)
const since = new Date(Date.now() - 30*24*3600*1000).toISOString().slice(0,10)+' 00:00:00';
const picks = await odoo('stock.picking', 'search_read',
  [[['state','=','done'],
    ['date_done','>=', since],
    ['picking_type_code','=','internal']]],
  { fields:['id','name','date_done','origin','move_line_ids'], limit:500 });

console.log(`\nTransferencias internas done últimos 30d: ${picks.length}`);

// 4. Filtrar move.lines de OBSOLETO→AA1
const pickIds = picks.map(p=>p.id);
let moves = [];
if (pickIds.length) {
  moves = await odoo('stock.move.line', 'search_read',
    [[['picking_id','in', pickIds],
      ['location_id','in', obsolIds],
      ['location_dest_id','in', aa1Ids],
      ['state','=','done']]],
    { fields:['id','picking_id','product_id','lot_id','qty_done',
               'location_id','location_dest_id'], limit:5000 });
}
console.log(`Move lines OBSOLETO→AA1: ${moves.length}`);

if (!moves.length) {
  console.log('\n⚠️  No se encontraron transferencias DONE de OBSOLETO→AA1 en 30d.');
  console.log('Posibilidad: los movimientos son de otro tipo o las ubicaciones tienen otro nombre.');
  console.log('AA1 IDs encontrados:', aa1Ids);
  console.log('OBSOLETO IDs (primeros 5):', obsolIds.slice(0,5));
}

// 5. Productos involucrados
const prodIds = [...new Set(moves.map(m=>m.product_id[0]))];
console.log(`\nProductos únicos involucrados: ${prodIds.length}`);

// 6. Quants actuales en OBSOLETO para esos productos
let negatives = [];
if (prodIds.length) {
  const quants = await odoo('stock.quant', 'search_read',
    [[['product_id','in', prodIds],
      ['location_id','in', obsolIds]]],
    { fields:['id','product_id','location_id','quantity','reserved_quantity'], limit:5000 });

  negatives = quants.filter(q => q.quantity < 0);
  console.log(`Quants en OBSOLETO para esos productos: ${quants.length}`);
  console.log(`Con cantidad NEGATIVA: ${negatives.length}`);

  if (negatives.length) {
    console.log('\n── NEGATIVOS ──────────────────────────────────────────');
    negatives.forEach(q => {
      console.log(`  Producto: [${q.product_id[0]}] ${q.product_id[1]}`);
      console.log(`  Ubicación: ${q.location_id[1]}  |  qty: ${q.quantity}  |  reservado: ${q.reserved_quantity}`);
    });
  }
}

// 7. También quants negativos en AA1 para esos productos (si los hay)
if (prodIds.length && aa1Ids.length) {
  const aa1Quants = await odoo('stock.quant', 'search_read',
    [[['product_id','in', prodIds],
      ['location_id','in', aa1Ids],
      ['quantity','<', 0]]],
    { fields:['id','product_id','location_id','quantity'], limit:500 });
  if (aa1Quants.length) {
    console.log(`\nNEGATIVOS en AA1: ${aa1Quants.length}`);
    aa1Quants.forEach(q => console.log(`  [${q.product_id[0]}] ${q.product_id[1]} qty=${q.quantity} @ ${q.location_id[1]}`));
  } else {
    console.log('\n✓ Sin negativos en AA1 para esos productos.');
  }
}

// 8. Detalle de movimientos por producto
if (moves.length) {
  console.log('\n── DETALLE MOVIMIENTOS ─────────────────────────────────');
  const byProd = {};
  moves.forEach(m => {
    const pid = m.product_id[0];
    if (!byProd[pid]) byProd[pid] = { name: m.product_id[1], moves: [] };
    byProd[pid].moves.push({ picking: m.picking_id[1], qty: m.qty_done });
  });
  Object.values(byProd).forEach(p => {
    const total = p.moves.reduce((s,m)=>s+m.qty, 0);
    console.log(`  ${p.name} → total movido: ${total}`);
    p.moves.forEach(m => console.log(`    ${m.picking}: ${m.qty} und`));
  });
}

console.log('\n── FIN DIAGNÓSTICO ─────────────────────────────────────');
