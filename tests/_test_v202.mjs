// _test_v202.mjs — Kits armados ya no pierden sus componentes (caso #0177 S07286).
// El kit-toggle deja los componentes en selected:false → eran invisibles para:
//   (1) el merge v113 (pool/huérfanos solo miraba selected) → un sync que no los
//       re-aportara del pick (presupuesto SDV, claims, selección) los borraba;
//   (2) getOrderClaims → otra cadena de la misma orden podía reclamar sus unidades;
//   (3) PUT /items (el carrito del modal Editar precarga solo selected) → CUALQUIER
//       edición de la tarea dejaba la tarjeta-kit huérfana ("0 unidades").
// Con Odoo FALSO local (incl. mrp phantom BOM). Cero datos live.
// Uso (desde la raíz): node tests/_test_v202.mjs
import { spawn } from 'child_process';
import https from 'https';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

const FAKE_PORT = 3391;
const PORT = 3399;
const BASE = `http://127.0.0.1:${PORT}`;
const ROOT = process.cwd();
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'testv202-'));

// ── Odoo FALSO: orden con 1 pick assigned — 2 componentes de kit (.C1/.C2, BOM phantom 77)
//    + 1 producto normal ──────────────────────────────────────────────────────
const PICKS = [
  { id:21, name:'ALVEN/PICK/3001', state:'assigned', picking_type_id:[5,'Pick'] }
];
const MLS = [
  { product_id:[201,'Nale Struct'], location_id:[7,'ALVEN/Stock/A-CDP/ED1'], product_uom_qty:1, qty_done:0, picking_id:[21,'ALVEN/PICK/3001'] },
  { product_id:[202,'Nale Base'],   location_id:[7,'ALVEN/Stock/A-CDP/ED1'], product_uom_qty:1, qty_done:0, picking_id:[21,'ALVEN/PICK/3001'] },
  { product_id:[203,'Prod A'],      location_id:[8,'ALVEN/Stock/A-CDP/BB1'], product_uom_qty:1, qty_done:0, picking_id:[21,'ALVEN/PICK/3001'] }
];
const PRODS = [
  { id:201, barcode:'212', default_code:'NALE.STRUCT.C1', image_128:false, categ_id:[9,'Misc'], name:'Nale Struct', product_tmpl_id:[401,'t'] },
  { id:202, barcode:'222', default_code:'NALE.BASE.C2',   image_128:false, categ_id:[9,'Misc'], name:'Nale Base',   product_tmpl_id:[402,'t'] },
  { id:203, barcode:'111', default_code:'PRODA',          image_128:false, categ_id:[9,'Misc'], name:'Prod A',      product_tmpl_id:[403,'t'] }
];
const KITPARENT = { id:900, default_code:'NALE.K2', barcode:'202.KIT', name:'Nale Sideboard *K*',
  image_512:false, image_128:false, product_tmpl_id:[500,'kit tmpl'] };
const ALLPRODS = [...PRODS, KITPARENT];
const BOMLINES = [
  { id:1, bom_id:[77,'Nale K2'], product_id:[201,'Nale Struct'] },
  { id:2, bom_id:[77,'Nale K2'], product_id:[202,'Nale Base'] }
];
const BOMS = [ { id:77, product_id:false, product_tmpl_id:[500,'kit tmpl'], type:'phantom' } ];

const TLS = { key: fs.readFileSync(path.join(ROOT,'_fakekey.pem')), cert: fs.readFileSync(path.join(ROOT,'_fakecert.pem')) };
const fake = https.createServer(TLS, (req, res) => {
  let body=''; req.on('data',c=>body+=c); req.on('end',()=>{
    let p={}; try{p=JSON.parse(body);}catch{}
    const params = p.params || p;
    const reply = result => { res.writeHead(200,{'Content-Type':'application/json'}); res.end(JSON.stringify({jsonrpc:'2.0',id:p.id,result})); };
    if (params.service==='common' && (params.method==='authenticate'||params.method==='login')) return reply(98);
    if (params.service==='object' && params.method==='execute_kw') {
      const a = params.args||[]; const model=a[3]; const method=a[4]; const callArgs=a[5]||[]; const domain=callArgs[0]||[];
      if (model==='sale.order') {
        const c = domain.find(x=>Array.isArray(x)&&x[0]==='name');
        return reply([{ id:1, name: c ? String(c[2]) : '' }]);
      }
      if (model==='stock.picking') {
        const s = domain.find(x=>Array.isArray(x)&&x[0]==='state');
        const states = s ? s[2] : null;
        return reply(PICKS.filter(pk => !states || states.includes(pk.state)));
      }
      if (model==='stock.move.line') {
        const c = domain.find(x=>Array.isArray(x)&&x[0]==='picking_id');
        const ids = c ? c[2] : [];
        return reply(MLS.filter(ml => ids.includes(ml.picking_id[0])));
      }
      if (model==='stock.move' && method==='read') return reply([]);
      if (model==='product.product' && method==='read') {
        const ids = callArgs[0]||[];
        return reply(ALLPRODS.filter(pr => ids.includes(pr.id)));
      }
      if (model==='product.product' && method==='search_read') {
        const cid = domain.find(x=>Array.isArray(x)&&x[0]==='id');
        const ctm = domain.find(x=>Array.isArray(x)&&x[0]==='product_tmpl_id');
        if (cid) return reply(ALLPRODS.filter(pr => (cid[2]||[]).includes(pr.id)));
        if (ctm) return reply(ALLPRODS.filter(pr => (ctm[2]||[]).includes(pr.product_tmpl_id && pr.product_tmpl_id[0])));
        return reply([]);
      }
      if (model==='mrp.bom.line') {
        const c = domain.find(x=>Array.isArray(x)&&x[0]==='product_id');
        const ids = c ? c[2] : [];
        return reply(BOMLINES.filter(l => ids.includes(l.product_id[0])));
      }
      if (model==='mrp.bom' && method==='read') return reply(BOMS);
      if (model==='product.template' && method==='read') return reply([{ id:500, image_512:false, image_128:false }]);
      return reply([]);
    }
    reply(null);
  });
});

// ── Fixtures ─────────────────────────────────────────────────────────────────
const now = new Date().toISOString();
const baseTask = (id, extra) => ({
  id, seq:null, parentId:null, title:'Tarea '+id, type:'packaging', description:'',
  priority:'medium', status:'in_progress', assignedTo:null, managerId:'au_gsanchez', managerName:'Admin QA',
  executors:[], assignees:[], location:'', dueDate:null, actionNote:'', items:[],
  evidence:[], fotos_guia:[], statusHistory:[{status:'pending',date:now,by:'test'}],
  createdBy:'test', createdAt:now, updatedAt:now, ...extra
});
const COMP = (pid, sku, sel) => ({ item_id:'oi_'+pid+'_ALVEN_PICK_3001', odoo_product_id:pid, odoo_line_id:null,
  sku, barcode:sku, product_name:'Comp '+pid, quantity:1, units:1, unit_index:1, unit_total:1, group_ref:'oi_'+pid,
  pickName:'ALVEN/PICK/3001', fromPick:true, selected:sel, selected_location_name:'A-CDP/ED1',
  kitId:'bom_77', kitRef:'NALE.K2', kitName:'Nale Sideboard *K*', kitImage:'',
  evidence_images:[], confirmado:false, status:'pending', locations:[], selected_location:null });
const CARD = () => ({ item_id:'kit_bom_77_1', isKit:true, armado:true, kitId:'bom_77', kitInstance:1,
  kitRef:'NALE.K2', kitName:'Nale Sideboard *K*', kitImage:'',
  product_name:'Nale Sideboard *K* (armado)', sku:'NALE.K2', barcode:'', image:'', quantity:1, units:1,
  unit_index:1, unit_total:1, group_ref:'kit_bom_77_1', selected:true,
  evidence_images:[], condition:'good', damageType:'', confirmado:false, status:'pending', locations:[] });
const NORMAL = () => ({ item_id:'oi_203_ALVEN_PICK_3001', odoo_product_id:203, odoo_line_id:null,
  sku:'111', barcode:'111', product_name:'Prod A', quantity:1, units:1, unit_index:1, unit_total:1, group_ref:'oi_203',
  pickName:'ALVEN/PICK/3001', fromPick:true, selected:true, selected_location_name:'A-CDP/BB1',
  evidence_images:[{url:'/api/wwp/foto/x.jpg', by:'test'}], confirmado:true, status:'pending', locations:[], selected_location:null });

const FIX = [
  // T1: presupuesto SDV solo cubre kit padre + normal → el pick "no re-aporta" los comps
  baseTask('wt_orphan', { odooRef:'S_9101', sdvId:'sdv_o', sdvFolio:'SD-T-ORPH',
    sdvArticulos:[{sku:'202.KIT',quantity:1,name:'Nale Sideboard *K*'},{sku:'111',quantity:1,name:'Prod A'}],
    items:[COMP(201,'212',false), COMP(202,'222',false), CARD(), NORMAL()] }),
  // T2: cadena con kit armado (comps ocultos) + otra cadena de la MISMA orden
  baseTask('wt_armado', { odooRef:'S_9201', items:[COMP(201,'212',false), COMP(202,'222',false), CARD()] }),
  baseTask('wt_other',  { odooRef:'S_9201', status:'pending', items:[] }),
  // T3: estado actual de #0177 — tarjeta-kit huérfana, componentes YA perdidos
  baseTask('wt_lost',   { odooRef:'S_9301', items:[CARD(), NORMAL()] }),
  // T4: kit desarmado (comps selected:true) para probar kit-toggle
  baseTask('wt_toggle', { odooRef:'S_9401', items:[COMP(201,'212',true), COMP(202,'222',true)] }),
  // T5/T6: PUT /items simulando el carrito del modal Editar
  baseTask('wt_put',    { odooRef:'S_9501', items:[COMP(201,'212',false), COMP(202,'222',false), CARD(), NORMAL()] })
];
fs.writeFileSync(path.join(DATA_DIR,'wwp-tasks.json'), JSON.stringify(FIX,null,2));

// ── JWT + helpers ────────────────────────────────────────────────────────────
const b64u = b => Buffer.from(b).toString('base64url');
let SECRET=null, ADMIN=null;
function mint(userId, role, name){
  const h=b64u(JSON.stringify({alg:'HS256',typ:'JWT'})); const t=Math.floor(Date.now()/1000);
  const pl=b64u(JSON.stringify({userId,role,name,iat:t,exp:t+86400}));
  const s=crypto.createHmac('sha256',SECRET).update(`${h}.${pl}`).digest('base64url');
  return `${h}.${pl}.${s}`;
}
let _ipc=0; const nextIp=()=>{ const n=++_ipc; return `10.${(n>>16)&255}.${(n>>8)&255}.${n&255}`; };
async function api(method,p,token,body){
  const r=await fetch(BASE+p,{method,headers:{'Content-Type':'application/json','X-Forwarded-For':nextIp(),...(token?{Authorization:'Bearer '+token}:{})},body:body!==undefined?JSON.stringify(body):undefined});
  let raw=''; try{raw=await r.text();}catch{} let j=null; try{j=JSON.parse(raw);}catch{}
  return {status:r.status,j,raw};
}
async function getTask(id){
  const r=await api('GET','/api/wwp/tasks',ADMIN);
  const list=(r.j&&(r.j.tasks||r.j.list))||(Array.isArray(r.j)?r.j:[]);
  return list.find(t=>t.id===id);
}
const R=[]; const ok=(name,cond,detail)=>{ R.push({name,pass:!!cond}); console.log(`${cond?'✓':'✗'} ${name}${cond?'':'  → '+JSON.stringify(detail)}`); };
function waitReady(ms=20000){ const t0=Date.now(); return new Promise((res,rej)=>{ (async function poll(){ try{const r=await fetch(BASE+'/api/app-version'); if(r.ok)return res(true);}catch{} if(Date.now()-t0>ms)return rej(new Error('server no levantó')); setTimeout(poll,300); })(); }); }

(async ()=>{
  await new Promise(r=>fake.listen(FAKE_PORT,r));
  const srv = spawn('node',['proxy.js'],{ cwd:ROOT, env:{...process.env, DATA_DIR, PORT:String(PORT),
    ODOO_URL:`https://127.0.0.1:${FAKE_PORT}`, ODOO_DB:'fakedb', ODOO_USER:'fake', ODOO_API_KEY:'fakekey',
    NODE_TLS_REJECT_UNAUTHORIZED:'0' } });
  let serr=''; srv.stderr.on('data',d=>serr+=d.toString());
  const cleanup=()=>{ try{srv.kill('SIGKILL');}catch{} try{fake.close();}catch{} try{fs.rmSync(DATA_DIR,{recursive:true,force:true});}catch{} };
  try{
    await waitReady();
    SECRET=fs.readFileSync(path.join(DATA_DIR,'.jwt-secret'),'utf8').trim();
    ADMIN=mint('au_gsanchez','admin','Admin QA');

    console.log('\n── T1 · merge: los comps ocultos de un kit armado SOBREVIVEN aunque el pick no los re-aporte ──');
    const d1=await api('GET','/api/wwp/tasks/wt_orphan/pick-diff',ADMIN);
    const m1=(d1.j&&d1.j.merged)||[];
    const c1=m1.filter(x=>x.kitId==='bom_77'&&!x.isKit);
    ok('merged conserva los 2 componentes ocultos (antes: se perdían)', c1.length===2, {len:m1.length,ids:m1.map(x=>x.item_id)});
    ok('los comps siguen ocultos (selected:false, bajo la tarjeta armada)', c1.every(x=>x.selected===false), {sel:c1.map(x=>x.selected)});
    ok('la tarjeta-kit armada se preserva', m1.some(x=>x.isKit&&x.selected), {});
    ok('presupuesto SDV sigue reportando omitidos=2 (los comps del pick no entran de nuevo)', d1.j&&d1.j.summary&&d1.j.summary.omitidos===2, {summary:d1.j&&d1.j.summary});
    const n1=m1.find(x=>x.odoo_product_id===203);
    ok('artículo normal reusado con su evidencia intacta', n1 && (n1.evidence_images||[]).length===1 && n1.confirmado===true, {n1});
    ok('sin cambios que aplicar (hasChanges=false)', d1.j&&d1.j.hasChanges===false, {hasChanges:d1.j&&d1.j.hasChanges});

    console.log('\n── T2 · claims: otra cadena de la misma orden NO puede llevarse los comps ocultos ──');
    const d2=await api('GET','/api/wwp/tasks/wt_other/pick-diff',ADMIN);
    const m2=(d2.j&&d2.j.merged)||[];
    ok('la otra cadena solo recibe el producto libre (203), no los comps del kit armado', m2.length===1 && m2[0].odoo_product_id===203, {len:m2.length,pids:m2.map(x=>x.odoo_product_id)});
    ok('summary.added=1 (antes: 3 — doble reclamo de las unidades del kit)', d2.j&&d2.j.summary&&d2.j.summary.added===1, {summary:d2.j&&d2.j.summary});

    console.log('\n── T3 · re-sync (Capa 1) RESTAURA componentes ya perdidos (estado actual de #0177) ──');
    const pv=await api('POST','/api/wwp/tasks/wt_lost/sync-pick',ADMIN,{ pickIds:[21], apply:false });
    ok('preview 200 con resumen.new=2 (los comps vuelven del pick)', pv.status===200 && pv.j&&pv.j.resumen&&pv.j.resumen.new===2, {status:pv.status,resumen:pv.j&&pv.j.resumen});
    const ap=await api('POST','/api/wwp/tasks/wt_lost/sync-pick',ADMIN,{ pickIds:[21], apply:true });
    ok('apply 200', ap.status===200 && ap.j&&ap.j.applied===true, {status:ap.status,j:ap.j});
    const t3=await getTask('wt_lost');
    const c3=(t3&&t3.items||[]).filter(x=>x.kitId==='bom_77'&&!x.isKit);
    ok('la tarea recupera los 2 componentes con su kitId', c3.length===2, {items:(t3&&t3.items||[]).map(x=>x.item_id)});
    ok('vuelven OCULTOS bajo la tarjeta armada (selected:false)', c3.every(x=>x.selected===false), {sel:c3.map(x=>x.selected)});
    ok('la tarjeta-kit sigue activa', (t3&&t3.items||[]).some(x=>x.isKit&&x.selected), {});
    const n3=(t3&&t3.items||[]).find(x=>x.odoo_product_id===203);
    ok('evidencia del artículo normal preservada tras el apply', n3 && (n3.evidence_images||[]).length===1, {n3:n3&&n3.evidence_images});

    console.log('\n── T4 · kit-toggle: la tarjeta nace con su identidad de kit (kitName/kitRef) ──');
    const tg=await api('PATCH','/api/wwp/tasks/wt_toggle/kit-toggle',ADMIN,{ kitId:'bom_77', instance:1, armado:true });
    ok('kit-toggle armado → 200', tg.status===200 && tg.j&&tg.j.ok, {status:tg.status,j:tg.j});
    const t4=await getTask('wt_toggle');
    const card4=(t4&&t4.items||[]).find(x=>x.isKit);
    ok('la tarjeta lleva kitName y kitRef propios', card4 && card4.kitName==='Nale Sideboard *K*' && card4.kitRef==='NALE.K2', {card4});

    console.log('\n── T5 · PUT /items (carrito del modal Editar) re-adjunta los comps ocultos ──');
    const t5pre=await getTask('wt_put');
    const payload5=(t5pre.items||[]).filter(it=>it.selected); // exactamente lo que precarga el carrito
    const p5=await api('PUT','/api/wwp/tasks/wt_put/items',ADMIN,{ items:payload5 });
    ok('PUT 200', p5.status===200, {status:p5.status,err:p5.j&&p5.j.error});
    const t5=await getTask('wt_put');
    const c5=(t5&&t5.items||[]).filter(x=>x.kitId==='bom_77'&&!x.isKit);
    ok('los 2 comps ocultos siguen en la tarea (antes: cualquier edición los borraba)', c5.length===2, {items:(t5&&t5.items||[]).map(x=>x.item_id)});
    ok('siguen ocultos (selected:false)', c5.every(x=>x.selected===false), {sel:c5.map(x=>x.selected)});

    console.log('\n── T6 · quitar el kit A PROPÓSITO (payload sin tarjeta) NO resucita nada ──');
    const payload6=(t5.items||[]).filter(it=>it.selected && !it.isKit && !it.kitId); // solo el normal
    const p6=await api('PUT','/api/wwp/tasks/wt_put/items',ADMIN,{ items:payload6 });
    ok('PUT 200', p6.status===200, {status:p6.status,err:p6.j&&p6.j.error});
    const t6=await getTask('wt_put');
    ok('el kit completo desapareció (sin resurrección de comps)', (t6&&t6.items||[]).every(x=>x.kitId!=='bom_77'&&!x.isKit), {items:(t6&&t6.items||[]).map(x=>x.item_id)});

    console.log('\n── Front ──');
    const fh=await fetch(BASE+'/historial.html'); const ft=await fh.text();
    ok('historial.html 200 + build v202', fh.status===200 && ft.includes("APP_BUILD = 'v202'"), {status:fh.status});
    ok('fallback de tarjeta-kit huérfana presente en el drawer (_kitSinComps)', ft.includes('_kitSinComps'), {});

    const fails=R.filter(x=>!x.pass).length;
    console.log(`\n═══ ${R.length-fails}/${R.length} pasaron ═══${fails?` · ${fails} FALLARON`:''}`);
    if (serr.trim() && fails) console.log('\n[stderr del server]\n'+serr.slice(0,2000));
    cleanup();
    process.exit(fails?1:0);
  } catch(e){
    console.error('ERROR:', e.message);
    if (serr.trim()) console.error('[stderr]\n'+serr.slice(0,2000));
    cleanup();
    process.exit(1);
  }
})();
