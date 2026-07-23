// Ron — Diagnóstico ampliado: negativos en OBSOLETO y AA1 + transfers pendientes
const ODOO_URL = 'https://altritempi.odoo.com';
const ODOO_DB  = 'marjorie82-altritempi-altritempi-5787837';
const ODOO_USER = 'gsanchez@altritempi.com.do';
const ODOO_KEY  = 'KEY-ROTADA-2026-07-23-usar-env-ODOO_API_KEY';

async function jsonrpc(service, method, args) {
  const r = await fetch(`${ODOO_URL}/jsonrpc`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({jsonrpc:'2.0',method:'call',id:1,params:{service,method,args}})
  });
  const d = await r.json();
  if (d.error) throw new Error(JSON.stringify(d.error));
  return d.result;
}
async function odoo(model, method, args, kwargs={}) {
  return jsonrpc('object','execute_kw',[ODOO_DB,uid,ODOO_KEY,model,method,args,kwargs]);
}

const uid = await jsonrpc('common','authenticate',[ODOO_DB,ODOO_USER,ODOO_KEY,{}]);
console.log(`Auth uid=${uid}  ${new Date().toISOString()}\n`);

// Resolver ubicaciones
const obsolLocs = await odoo('stock.location','search_read',
  [[['complete_name','ilike','OBSOLETO'],['usage','=','internal']]],
  {fields:['id','complete_name'],limit:5000});
const aa1Locs = await odoo('stock.location','search_read',
  [[['complete_name','ilike','AA1'],['usage','=','internal']]],
  {fields:['id','complete_name'],limit:100});
const obsolIds = obsolLocs.map(l=>l.id);
const aa1Ids   = aa1Locs.map(l=>l.id);
console.log(`OBSOLETO: ${obsolIds.length} bins | AA1: ${aa1Ids.length} locs`);

// 1. Quants negativos en OBSOLETO
const negObsol = await odoo('stock.quant','search_read',
  [[['location_id','in',obsolIds],['quantity','<',0]]],
  {fields:['id','product_id','location_id','quantity','reserved_quantity'],limit:500});
console.log(`\nNEGATIVOS EN OBSOLETO: ${negObsol.length}`);
negObsol.forEach(q=>{
  const avail = q.quantity - q.reserved_quantity;
  console.log(`  [${q.product_id[0]}] ${q.product_id[1].slice(0,60)}`);
  console.log(`    bin: ${q.location_id[1]} | qty: ${q.quantity} | reservado: ${q.reserved_quantity} | disponible: ${avail}`);
});

// 2. Quants negativos en AA1
const negAA1 = await odoo('stock.quant','search_read',
  [[['location_id','in',aa1Ids],['quantity','<',0]]],
  {fields:['id','product_id','location_id','quantity','reserved_quantity'],limit:500});
console.log(`\nNEGATIVOS EN AA1: ${negAA1.length}`);
negAA1.forEach(q=>{
  console.log(`  [${q.product_id[0]}] ${q.product_id[1].slice(0,60)}`);
  console.log(`    qty: ${q.quantity} | reservado: ${q.reserved_quantity}`);
});

// 3. Transfers internos ASSIGNED o WAITING con origen OBSOLETO destino AA1
const picksPend = await odoo('stock.picking','search_read',
  [[['state','in',['assigned','waiting','confirmed']],
    ['picking_type_code','=','internal']]],
  {fields:['id','name','state','origin','scheduled_date'],limit:500});
console.log(`\nTransfers internos pendientes (assigned/waiting/confirmed): ${picksPend.length}`);

// Filtrar move lines de OBSOLETO→AA1 en esos picks
if (picksPend.length) {
  const pIds = picksPend.map(p=>p.id);
  const mlines = await odoo('stock.move.line','search_read',
    [[['picking_id','in',pIds],
      ['location_id','in',obsolIds],
      ['location_dest_id','in',aa1Ids]]],
    {fields:['id','picking_id','product_id','reserved_uom_qty','qty_done','location_id','location_dest_id'],limit:500});
  console.log(`  → con líneas OBSOLETO→AA1: ${mlines.length}`);
  mlines.forEach(m=>{
    const pk = picksPend.find(p=>p.id===m.picking_id[0]);
    console.log(`  ${m.picking_id[1]} [${pk?pk.state:'?'}] | [${m.product_id[0]}] ${m.product_id[1].slice(0,50)} | reservado: ${m.reserved_uom_qty} | done: ${m.qty_done}`);
  });
}

// 4. Todos los quants de AA1 (para ver qué entró)
const aa1All = await odoo('stock.quant','search_read',
  [[['location_id','in',aa1Ids],['quantity','!=',0]]],
  {fields:['id','product_id','quantity','reserved_quantity'],limit:500});
console.log(`\nQUANTS EN AA1 (con qty!=0): ${aa1All.length}`);
aa1All.forEach(q=>{
  const flag = q.quantity < 0 ? '🔴' : '✓';
  console.log(`  ${flag} [${q.product_id[0]}] ${q.product_id[1].slice(0,55)} qty:${q.quantity} res:${q.reserved_quantity}`);
});

console.log('\n── FIN ─────────────────────────────────────────────────');
