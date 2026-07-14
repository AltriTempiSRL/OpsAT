// _test_capa1_picks.mjs — Verifica la "Capa 1" (selector de pick + re-sincronizacion explicita).
// Odoo FALSO local (HTTPS JSON-RPC), cero datos live. Plantilla: _test_v113.mjs
//   Endpoints bajo prueba:
//     GET  /api/wwp/tasks/:id/picks       (proxy.js ~16401, RBAC edit_task)
//     POST /api/wwp/tasks/:id/sync-pick   (proxy.js ~16429, RBAC admin-only)
//     GET  /api/wwp/tasks/:id/pick-diff   (regresion del motor v113)
// Uso: node tests/_test_capa1_picks.mjs   (SIEMPRE desde la raiz del proyecto)
import { spawn } from 'child_process';
import https from 'https';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

const FAKE_PORT = 3393;
const PORT = 3396;
const BASE = `http://127.0.0.1:${PORT}`;
const ROOT = process.cwd();
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'testcapa1-'));

// ── Modelo Odoo FALSO ──────────────────────────────────────────────────────
// Orden S99001 (sale_id 1) con 3 pickings vinculados por sale_id:
//   PICK/2001 cancel   (0 move lines)
//   PICK/2002 done      (prod 202)                 <- ya despachado (otra tanda)
//   PICK/2003 assigned  (prod 201 + prod 205)       <- VIGENTE, fuente activa
// Orden S_REG (sale_id 2) para la regresion del motor v113:
//   PICK/3001 done      (prod 301, 302)             <- historia de otra SDV
//   PICK/3002 assigned  (prod 303)                  <- lo nuevo
const ORDERS = [ { id:1, name:'S99001' }, { id:2, name:'S_REG' } ];
const PICKS = [
  { id:21, name:'ALVEN/PICK/2001', state:'cancel',   sale_id:[1,'S99001'], origin:'S99001', picking_type_id:[5,'ALVEN: Pick'], backorder_id:false,                  date_done:false,        scheduled_date:'2026-07-10' },
  { id:22, name:'ALVEN/PICK/2002', state:'done',      sale_id:[1,'S99001'], origin:'S99001', picking_type_id:[5,'ALVEN: Pick'], backorder_id:false,                  date_done:'2026-07-11', scheduled_date:'2026-07-10' },
  { id:23, name:'ALVEN/PICK/2003', state:'assigned',  sale_id:[1,'S99001'], origin:'S99001', picking_type_id:[5,'ALVEN: Pick'], backorder_id:[22,'ALVEN/PICK/2002'], date_done:false,        scheduled_date:'2026-07-12' },
  { id:31, name:'ALVEN/PICK/3001', state:'done',      sale_id:[2,'S_REG'],  origin:'S_REG',  picking_type_id:[5,'ALVEN: Pick'], backorder_id:false,                  date_done:'2026-07-09', scheduled_date:'2026-07-08' },
  { id:32, name:'ALVEN/PICK/3002', state:'assigned',  sale_id:[2,'S_REG'],  origin:'S_REG',  picking_type_id:[5,'ALVEN: Pick'], backorder_id:false,                  date_done:false,        scheduled_date:'2026-07-09' }
];
const MLS = [
  { product_id:[201,'Producto Uno'],   location_id:[7,'ALVEN/Stock/A-CDP/BB1'], product_uom_qty:1, qty_done:0, picking_id:[23,'ALVEN/PICK/2003'] },
  { product_id:[205,'Producto Nuevo'], location_id:[7,'ALVEN/Stock/A-CDP/BB3'], product_uom_qty:1, qty_done:0, picking_id:[23,'ALVEN/PICK/2003'] },
  { product_id:[202,'Producto Dos'],   location_id:[7,'ALVEN/Stock/A-CDP/BB2'], product_uom_qty:1, qty_done:0, picking_id:[22,'ALVEN/PICK/2002'] },
  { product_id:[301,'Reg A'],          location_id:[7,'ALVEN/Stock/A-CDP/CC1'], product_uom_qty:1, qty_done:0, picking_id:[31,'ALVEN/PICK/3001'] },
  { product_id:[302,'Reg B'],          location_id:[7,'ALVEN/Stock/A-CDP/CC2'], product_uom_qty:1, qty_done:0, picking_id:[31,'ALVEN/PICK/3001'] },
  { product_id:[303,'Reg C'],          location_id:[8,'ALVEN/Stock/D-PTN/SHOW'], product_uom_qty:1, qty_done:0, picking_id:[32,'ALVEN/PICK/3002'] }
];
const PRODS = [
  { id:201, barcode:'BC201', default_code:'P201', image_128:false, categ_id:[9,'Misc'] },
  { id:202, barcode:'BC202', default_code:'P202', image_128:false, categ_id:[9,'Misc'] },
  { id:205, barcode:'BC205', default_code:'P205', image_128:false, categ_id:[9,'Misc'] },
  { id:301, barcode:'BC301', default_code:'P301', image_128:false, categ_id:[9,'Misc'] },
  { id:302, barcode:'BC302', default_code:'P302', image_128:false, categ_id:[9,'Misc'] },
  { id:303, barcode:'BC303', default_code:'P303', image_128:false, categ_id:[9,'Misc'] }
];
const TLS = { key: fs.readFileSync(path.join(ROOT,'_fakekey.pem')), cert: fs.readFileSync(path.join(ROOT,'_fakecert.pem')) };

const fake = https.createServer(TLS, (req, res) => {
  let body=''; req.on('data',c=>body+=c); req.on('end',()=>{
    let p={}; try{p=JSON.parse(body);}catch{}
    const params = p.params || p;
    const reply = result => { res.writeHead(200,{'Content-Type':'application/json'}); res.end(JSON.stringify({jsonrpc:'2.0',id:p.id,result})); };
    if (params.service==='common' && params.method==='authenticate') return reply(98);
    if (params.service==='object' && params.method==='execute_kw') {
      const a = params.args||[]; const model=a[3]; const method=a[4]; const callArgs=a[5]||[]; const domain=callArgs[0]||[];
      if (model==='sale.order') {
        const c = domain.find(x=>Array.isArray(x)&&x[0]==='name');
        const val = c ? String(c[2]).toUpperCase() : '';
        const found = ORDERS.filter(o => o.name.toUpperCase()===val || (c&&c[1]==='ilike'&&o.name.toUpperCase().includes(val)));
        return reply(found.map(o=>({id:o.id,name:o.name})));
      }
      if (model==='stock.warehouse') return reply([]); // sin outlet -> getOutletOutTypeIds() = Set vacio
      if (model==='stock.picking') {
        let saleId=null, origin=null, states=null, nameEq=null;
        domain.forEach(x=>{ if(Array.isArray(x)){
          if(x[0]==='sale_id') saleId=x[2];
          else if(x[0]==='origin') origin=x[2];
          else if(x[0]==='state'&&x[1]==='in') states=x[2];
          else if(x[0]==='name'&&x[1]==='=') nameEq=x[2];
        }});
        const out = PICKS.filter(pk=>{
          let linkOk;
          if (saleId!==null || origin!==null) linkOk = (saleId!==null && pk.sale_id && pk.sale_id[0]===saleId) || (origin!==null && pk.origin===origin);
          else if (nameEq!==null) linkOk = pk.name===nameEq;
          else linkOk = true;
          const stateOk = states ? states.includes(pk.state) : true;
          return linkOk && stateOk;
        });
        return reply(out);
      }
      if (model==='stock.move.line') {
        const c = domain.find(x=>Array.isArray(x)&&x[0]==='picking_id');
        const ids = c ? c[2] : [];
        return reply(MLS.filter(ml => ids.includes(ml.picking_id[0])));
      }
      if (model==='product.product') {
        let wantIds = Array.isArray(callArgs[0]) && typeof callArgs[0][0]==='number' ? callArgs[0] : null;
        if (!wantIds) { const c = domain.find(x=>Array.isArray(x)&&x[0]==='id'); wantIds = c ? c[2] : []; }
        return reply(PRODS.filter(pr => wantIds.includes(pr.id)));
      }
      if (model==='stock.move') return reply([]); // sin description_picking -> fallback a product_id[1]
      return reply([]);
    }
    reply(null);
  });
});

// ── Fixtures de tareas ──────────────────────────────────────────────────────
const now = new Date().toISOString();
const baseTask = (id, extra) => ({
  id, seq:null, parentId:null, title:'Tarea '+id, type:'dispatch_order', description:'',
  priority:'medium', status:'pending', assignedTo:null, managerId:null, managerName:null,
  executors:[], assignees:[], location:'', dueDate:null, actionNote:'', items:[],
  evidence:[], fotos_guia:[], statusHistory:[{status:'pending',date:now,by:'test'}],
  createdBy:'test', createdAt:now, updatedAt:now, ...extra
});
const SEED_ITEM = { item_id:'oi_201_seed', odoo_product_id:201, sku:'BC201', barcode:'BC201',
  product_name:'Producto Uno', quantity:1, units:1, unit_index:1, unit_total:1, group_ref:'oi_201',
  pickName:'ALVEN/PICK/2003', fromPick:true, selected:true, selected_location_name:'A-CDP/BB1',
  evidence_images:['data:image/jpeg;base64,SEEDEVID=='], confirmado:true, condition:'good', damageType:'',
  status:'pending', locations:[], selected_location:null };
const REG_ITEM = { item_id:'oi_301_seed', odoo_product_id:301, sku:'BC301', barcode:'BC301',
  product_name:'Reg A', quantity:1, units:1, unit_index:1, unit_total:1, group_ref:'oi_301',
  pickName:'ALVEN/PICK/3001', fromPick:true, selected:true, selected_location_name:'A-CDP/CC1',
  evidence_images:[], confirmado:false, status:'pending', locations:[], selected_location:null };
const FIX = [
  baseTask('wt_main',      { odooRef:'S99001', items:[{...SEED_ITEM}] }),
  baseTask('wt_validated', { odooRef:'S99001', status:'validated', items:[{...SEED_ITEM, item_id:'oi_201_v'}] }),
  baseTask('wt_reg',       { odooRef:'S_REG', items:[{...REG_ITEM}] })
];
fs.writeFileSync(path.join(DATA_DIR,'wwp-tasks.json'), JSON.stringify(FIX,null,2));

// ── JWT forjado + helpers HTTP ───────────────────────────────────────────────
const b64u = b => Buffer.from(b).toString('base64url');
let SECRET=null, ADMIN=null, MANAGER=null;
function mint(userId, role, name){
  const h=b64u(JSON.stringify({alg:'HS256',typ:'JWT'})); const t=Math.floor(Date.now()/1000);
  const pl=b64u(JSON.stringify({userId,role,name,odooId:'99',iat:t,exp:t+86400})); // SIN impersonatedBy -> login propio
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
const R=[]; const ok=(name,cond,detail)=>{ R.push({name,pass:!!cond}); console.log(`${cond?'OK ':'XX '} ${name}${cond?'':'  -> '+JSON.stringify(detail)}`); };
function waitReady(ms=20000){ const t0=Date.now(); return new Promise((res,rej)=>{ (async function poll(){ try{const r=await fetch(BASE+'/api/app-version'); if(r.ok)return res(true);}catch{} if(Date.now()-t0>ms)return rej(new Error('server no levanto')); setTimeout(poll,300); })(); }); }

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
    MANAGER=mint('au_mgr','manager','Mgr QA');

    console.log('\n-- Caso 1 . GET /picks (clasificacion + activo) --');
    const g1=await api('GET','/api/wwp/tasks/wt_main/picks',ADMIN);
    const picks=(g1.j&&g1.j.picks)||[];
    ok('GET /picks -> 200', g1.status===200, {status:g1.status,err:g1.j&&g1.j.error});
    ok('lista los 3 picks de la orden (vinculo sale_id)', picks.length===3, {len:picks.length,names:picks.map(p=>p.name)});
    const pk = id => picks.find(p=>p.id===id) || {};
    ok('pick 2001 clasificado cancel', pk(21).class==='cancel' && pk(21).cancelado===true && pk(21).esVigente===false, {p:pk(21)});
    ok('pick 2002 clasificado done', pk(22).class==='done' && pk(22).yaDespachado===true, {p:pk(22)});
    ok('pick 2003 clasificado vigente', pk(23).class==='vigente' && pk(23).esVigente===true, {p:pk(23)});
    ok('marca el pick ACTIVO (2003, el que alimenta items hoy)', pk(23).active===true && pk(21).active!==true && pk(22).active!==true, {a23:pk(23).active,a22:pk(22).active,a21:pk(21).active});
    ok('syncable/tipo (PICK vigente syncable)', pk(23).syncable===true && pk(23).tipo==='PICK', {p23:pk(23)});

    console.log('\n-- Caso 2 . sync-pick PREVIEW (no persiste) --');
    const pv=await api('POST','/api/wwp/tasks/wt_main/sync-pick',ADMIN,{pickIds:[23],apply:false});
    ok('preview -> 200', pv.status===200, {status:pv.status,err:pv.j&&pv.j.error});
    ok('applied:false', pv.j&&pv.j.applied===false, {applied:pv.j&&pv.j.applied});
    ok('trae resumen {executed,moved,new,current,omitidos}', pv.j&&pv.j.resumen && ['executed','moved','new','current','omitidos'].every(k=>k in pv.j.resumen), {resumen:pv.j&&pv.j.resumen});
    const afterPv=await getTask('wt_main');
    ok('NO persistio: t.items intacto (1 item sembrado)', afterPv && (afterPv.items||[]).length===1 && afterPv.items[0].item_id==='oi_201_seed', {len:afterPv&&afterPv.items.length,ids:afterPv&&afterPv.items.map(i=>i.item_id)});
    ok('NO persistio: evidencia del item sembrado intacta', afterPv && afterPv.items[0].evidence_images.length===1, {ev:afterPv&&afterPv.items[0].evidence_images});

    console.log('\n-- Caso 4 . RBAC --');
    const rbGet=await api('GET','/api/wwp/tasks/wt_main/picks',MANAGER);
    ok('GET /picks con MANAGER -> 200 (edit_task)', rbGet.status===200, {status:rbGet.status,err:rbGet.j&&rbGet.j.error});
    const rbSync=await api('POST','/api/wwp/tasks/wt_main/sync-pick',MANAGER,{pickIds:[23],apply:true});
    ok('sync-pick con MANAGER -> 403 (admin-only)', rbSync.status===403, {status:rbSync.status,err:rbSync.j&&rbSync.j.error});
    const afterRb=await getTask('wt_main');
    ok('el 403 de manager NO muto la tarea (sigue 1 item)', afterRb && (afterRb.items||[]).length===1, {len:afterRb&&afterRb.items.length});

    console.log('\n-- Caso 5 . Gates de error --');
    const eCancel=await api('POST','/api/wwp/tasks/wt_main/sync-pick',ADMIN,{pickIds:[21],apply:true});
    ok('sync-pick con pick CANCEL (2001) -> 422', eCancel.status===422, {status:eCancel.status,err:eCancel.j&&eCancel.j.error});
    const eValidated=await api('POST','/api/wwp/tasks/wt_validated/sync-pick',ADMIN,{pickIds:[23],apply:true});
    ok('sync-pick sobre tarea VALIDATED -> 409', eValidated.status===409, {status:eValidated.status,err:eValidated.j&&eValidated.j.error});
    const eNoIds=await api('POST','/api/wwp/tasks/wt_main/sync-pick',ADMIN,{pickIds:[],apply:true});
    ok('sync-pick sin pickIds -> 400', eNoIds.status===400, {status:eNoIds.status,err:eNoIds.j&&eNoIds.j.error});
    const eForeign=await api('POST','/api/wwp/tasks/wt_main/sync-pick',ADMIN,{pickIds:[9999],apply:true});
    ok('sync-pick con pickId ajeno a la orden -> 422 (bonus)', eForeign.status===422, {status:eForeign.status,err:eForeign.j&&eForeign.j.error});

    console.log('\n-- Caso 3 . sync-pick APPLY (persiste + preserva evidencia) --');
    const ap=await api('POST','/api/wwp/tasks/wt_main/sync-pick',ADMIN,{pickIds:[23],apply:true,by:'Admin QA'});
    ok('apply -> 200', ap.status===200, {status:ap.status,err:ap.j&&ap.j.error});
    ok('applied:true', ap.j&&ap.j.applied===true, {applied:ap.j&&ap.j.applied});
    const afterAp=await getTask('wt_main');
    const it201=afterAp && (afterAp.items||[]).find(i=>i.odoo_product_id===201);
    const it205=afterAp && (afterAp.items||[]).find(i=>i.odoo_product_id===205);
    ok('t.items ACTUALIZADO (pick 2003 aporta prod 205 nuevo -> 2 items)', afterAp && (afterAp.items||[]).length===2 && !!it205, {len:afterAp&&afterAp.items.length,ids:afterAp&&afterAp.items.map(i=>i.odoo_product_id)});
    ok('EVIDENCIA preservada en el item que sobrevive (prod 201)', !!it201 && (it201.evidence_images||[]).length===1 && it201.evidence_images[0]==='data:image/jpeg;base64,SEEDEVID==', {it201});
    ok('CONFIRMACION preservada (confirmado:true en prod 201)', !!it201 && it201.confirmado===true, {conf:it201&&it201.confirmado});
    ok('el item NUEVO (205) nace sin evidencia ni confirmacion', !!it205 && (it205.evidence_images||[]).length===0 && it205.confirmado===false, {it205});

    console.log('\n-- Caso 6 . REGRESION pick-diff (motor v113 sin selectedPickIds) --');
    const rd=await api('GET','/api/wwp/tasks/wt_reg/pick-diff',ADMIN);
    const merged=(rd.j&&rd.j.merged)||[]; const summ=(rd.j&&rd.j.summary)||{};
    ok('pick-diff -> 200', rd.status===200, {status:rd.status});
    ok('merged = 3 (orden completa: 301,302 done + 303 assigned)', merged.length===3, {len:merged.length,skus:merged.map(x=>x.sku)});
    ok('summary.executed=2 (los del pick done) - comportamiento viejo intacto', summ.executed===2, {summary:summ});
    ok('summary.added=1 (el del pick assigned) - comportamiento viejo intacto', summ.added===1, {summary:summ});
    ok('hasChanges=true', rd.j&&rd.j.hasChanges===true, {hasChanges:rd.j&&rd.j.hasChanges});

    const fails=R.filter(x=>!x.pass).length;
    console.log(`\n=== ${R.length-fails}/${R.length} pasaron ===${fails?` . ${fails} FALLARON`:''}`);
    if (serr.trim()) console.log('\n[stderr del server]\n'+serr.slice(0,3000));
    cleanup();
    process.exit(fails?1:0);
  } catch(e){
    console.error('ERROR:', e.message);
    if (serr.trim()) console.error('[stderr]\n'+serr.slice(0,3000));
    cleanup();
    process.exit(1);
  }
})();
