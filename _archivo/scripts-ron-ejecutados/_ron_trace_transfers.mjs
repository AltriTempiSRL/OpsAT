// Ron — Traza qué transferencias movieron los 4 productos negativos a AA1
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

// Los 4 productos con negativo en OBSOLETO
const PROD_IDS = [27637, 29486, 29500, 29492];
const PROD_NAMES = {
  27637: 'AN-52-03300-01-03 Rd Fiberstone Grey 112',
  29486: 'AN-52-13800-01-14 Terrazo Sq Cream',
  29500: 'AN-52-11000-03-14 Terrazzo Sq Cream 9',
  29492: 'AN-52-11000-02-14 Terrazzo Sq Cream 1'
};

// AA1 location id = 55
const AA1_ID = 55;

// Buscar TODOS los move.lines donde el destino es AA1 y el producto es uno de los 4
// Sin restricción de fecha ni tipo
const moves = await odoo('stock.move.line','search_read',
  [[['product_id','in',PROD_IDS],
    ['location_dest_id','=',AA1_ID],
    ['state','=','done']]],
  {fields:['id','picking_id','product_id','qty_done','location_id','location_dest_id','date'],
   order:'date desc', limit:100});

console.log(`Move lines DONE hacia AA1 para esos 4 productos: ${moves.length}\n`);

if (!moves.length) {
  // Intentar sin filtro de estado — puede que estén en un estado distinto
  const movesAll = await odoo('stock.move.line','search_read',
    [[['product_id','in',PROD_IDS],
      ['location_dest_id','=',AA1_ID]]],
    {fields:['id','picking_id','product_id','qty_done','location_id','location_dest_id','date','state'],
     order:'date desc', limit:100});
  console.log(`Move lines (cualquier estado) hacia AA1: ${movesAll.length}`);
  movesAll.forEach(m=>{
    console.log(`  [${m.state}] ${m.picking_id[1]} | ${m.product_id[1].slice(0,50)} | qty:${m.qty_done} | ${m.date}`);
  });
} else {
  // Agrupar por picking
  const byPick = {};
  moves.forEach(m=>{
    const k = m.picking_id[0];
    if(!byPick[k]) byPick[k]={name:m.picking_id[1], date:m.date, lines:[]};
    byPick[k].lines.push(m);
  });

  for(const [pickId, pick] of Object.entries(byPick)){
    // Obtener el picking para ver origin y partner
    const [p] = await odoo('stock.picking','read',[parseInt(pickId)],
      {fields:['name','origin','partner_id','date_done','state']});
    console.log(`\nTransferencia: ${pick.name}`);
    console.log(`  Fecha done: ${p?.date_done || pick.date}`);
    console.log(`  Origin: ${p?.origin || '(vacío)'}`);
    console.log(`  Partner: ${p?.partner_id?.[1] || '(ninguno)'}`);
    console.log(`  Estado: ${p?.state}`);
    pick.lines.forEach(m=>{
      console.log(`  → ${PROD_NAMES[m.product_id[0]]} | qty:${m.qty_done} | desde: ${m.location_id[1]}`);
    });
  }
}

// También buscar si hay outbound desde OBSOLETO para esos productos (para ver si hubo despacho)
console.log('\n── SALIDAS DE OBSOLETO (outbound) ──');
const obsolLocs = await odoo('stock.location','search_read',
  [[['complete_name','ilike','OBSOLETO'],['usage','=','internal']]],
  {fields:['id'],limit:5000});
const obsolIds = obsolLocs.map(l=>l.id);

const outMoves = await odoo('stock.move.line','search_read',
  [[['product_id','in',PROD_IDS],
    ['location_id','in',obsolIds],
    ['state','=','done']]],
  {fields:['id','picking_id','product_id','qty_done','location_id','location_dest_id','date'],
   order:'date desc', limit:100});

console.log(`Salidas DONE de OBSOLETO para esos 4 productos: ${outMoves.length}`);
outMoves.forEach(m=>{
  console.log(`  ${m.picking_id[1]} | ${m.product_id[1].slice(0,50)} | qty:${m.qty_done} | hacia: ${m.location_dest_id[1]} | ${m.date}`);
});
