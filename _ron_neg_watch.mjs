// Ron — Watchdog de negativos: estado actual vs auditoría 30-jun + negativos nuevos
// Uso: node _ron_neg_watch.mjs
const ODOO_URL = 'https://altritempi.odoo.com';
const ODOO_DB  = 'marjorie82-altritempi-altritempi-5787837';
const ODOO_USER = 'gsanchez@altritempi.com.do';
const ODOO_KEY  = 'e3f2d0ca3b14858debbe2c336f09e9bb864ff717';

async function jsonrpc(service, method, args) {
  const r = await fetch(`${ODOO_URL}/jsonrpc`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({jsonrpc:'2.0',method:'call',id:1,params:{service,method,args}})
  });
  const d = await r.json();
  if (d.error) throw new Error(JSON.stringify(d.error));
  return d.result;
}
let uid;
async function odoo(model, method, args, kwargs={}) {
  return jsonrpc('object','execute_kw',[ODOO_DB,uid,ODOO_KEY,model,method,args,kwargs]);
}

uid = await jsonrpc('common','authenticate',[ODOO_DB,ODOO_USER,ODOO_KEY,{}]);

// Los 46 SKUs de la auditoría 30-jun (CORRECCION-INVENTARIO-2026-06-30.md), con su grupo
const AUDIT = {
  'GE.KAYLE.SOFA.CX.BG.C2':'A','GE.KAYLE.SOFA.RX.BG.C3':'A','GE.KAYLE.SOFA.LX.BG.C1':'A',
  'GZF.KAES.COFFTBL.130.PART3.BLK.C3':'A','GZF.WEAVER.SOFA.RX.PARIS90-D.C7':'A',
  'GZF.WEAVER.SDTBL.WH.MARB.TOP.C2':'A','GZF.WEAVER.SOFA.RX.HENNES-60A.C7':'A',
  'GVF.IRVA.SDTBL45.BASE.BLK.C2':'A','GVF.IRVA.SDTBL45.DKEMPER.TOP.C1':'A',
  'GVF.MERA.COFFTBL.BIG.LAUREN.BLK.BASE.C2':'A','GDF.CLOVE.DTBL160.OAK.BASE.BRW.C2':'A',
  'HGI.TERRAZO.COFFTBL50.GRY.TOP.C1':'A','NAT.MELPOT.CABINET.BRW.DRAWER.C5':'A',
  'CF-BR-BG003/GL':'A','MA-MD80160-1-800':'A','HN-C6Z51-C-1/2':'A','HN-C6Z51-C-2/2':'A',
  'TD-MES01CO':'A','BH-H8242':'A','FSV.JOWIL.SOFA.BG.RAWRX.C1':'A',
  'AN-05100S201/M':'B','LD-359817':'B','TW-AC1065/W':'B','SEL-18.457':'B','FSV-S6760/C':'B',
  'BH-Z8208':'B','SMI-CM-315':'B','SJ-FK-0731/P':'B','NI-XL3120/B':'B','NZ-DC1193/BR':'B',
  'WF-P103':'B','SD-081D':'B','CC-P-235-T':'B',
  'SJ-FK-0731B':'C','MA-MD80160-1-380':'C','FG.TABITHA.OTT.WH.P':'C','WF-SE130C/G':'C',
  'ARD-RB9046-1':'C','SI-TRAN105/W':'C','BH-08002':'C','TEMPO-107':'C','SU-676T':'C',
  'TEMPO-150':'C','TEMPO-126':'C','HGI.ELLEN.SDTBL50.GRY.P':'C','RG-LD4622':'C'
};

// 1. Negativos actuales bajo A-CDP y D-PTN (incluye sub-ubicaciones)
const locs = await odoo('stock.location','search_read',
  [[['complete_name','in',['ALVEN/Stock/A-CDP','ALVEN/Stock/D-PTN']],['usage','=','internal']]],
  {fields:['id','complete_name']});
const rootIds = locs.map(l=>l.id);

const negs = await odoo('stock.quant','search_read',
  [[['location_id','child_of',rootIds],['quantity','<',0]]],
  {fields:['id','product_id','location_id','quantity'],limit:1000});
console.log(`Quants negativos hoy bajo A-CDP + D-PTN: ${negs.length}`);

const prodIds = [...new Set(negs.map(q=>q.product_id[0]))];
const prods = prodIds.length ? await odoo('product.product','search_read',
  [[['id','in',prodIds]]],{fields:['id','default_code','name'],limit:1000}) : [];
const pMap = {}; prods.forEach(p=>pMap[p.id]=p);

const stillNeg = {};
negs.forEach(q=>{
  const ref = pMap[q.product_id[0]]?.default_code || `id:${q.product_id[0]}`;
  (stillNeg[ref] ||= []).push({loc:q.location_id[1], qty:q.quantity, name:pMap[q.product_id[0]]?.name||''});
});

const auditRefs = Object.keys(AUDIT);
const pendientes = auditRefs.filter(r=>stillNeg[r]);
const corregidos = auditRefs.filter(r=>!stillNeg[r]);
const nuevos = Object.keys(stillNeg).filter(r=>!AUDIT[r]);

console.log(`\n══ PENDIENTES de la auditoría 30-jun: ${pendientes.length}/46 ══`);
['A','B','C'].forEach(g=>{
  const grp = pendientes.filter(r=>AUDIT[r]===g);
  if(!grp.length) return;
  console.log(`\n─ Grupo ${g}: ${grp.length}`);
  grp.forEach(r=>stillNeg[r].forEach(e=>console.log(`  [${r}] ${e.name.slice(0,40)} @ ${e.loc} = ${e.qty}`)));
});

console.log(`\n══ CORREGIDOS: ${corregidos.length}/46 ══`);
['A','B','C'].forEach(g=>{
  const grp = corregidos.filter(r=>AUDIT[r]===g);
  if(grp.length) console.log(`  Grupo ${g} (${grp.length}): ${grp.join(', ')}`);
});

console.log(`\n══ NEGATIVOS NUEVOS (post-auditoría): ${nuevos.length} ══`);
nuevos.forEach(r=>stillNeg[r].forEach(e=>console.log(`  [${r}] ${e.name.slice(0,40)} @ ${e.loc} = ${e.qty}`)));

// 2. Recepciones pendientes desde el tránsito CDP (la causa activa de negativos nuevos)
const transit = await odoo('stock.location','search_read',
  [[['complete_name','like','%CDP Transferencias Internas%']]],{fields:['id']});
const pend = await odoo('stock.picking','search_read',
  [[['location_id','in',transit.map(l=>l.id)],['state','not in',['done','cancel']]]],
  {fields:['name','state','create_date','location_dest_id'],order:'create_date asc',limit:50});
console.log(`\n══ Recepciones PENDIENTES tránsito→CDP: ${pend.length} ══`);
pend.forEach(p=>console.log(`  ${p.name} | ${p.state} | creada:${(p.create_date||'').slice(0,10)} | destino:${p.location_dest_id[1]}`));
if(pend.length) console.log('  ⚠️ Validar recepciones ANTES de mover la mercancía dentro de A-CDP.');
