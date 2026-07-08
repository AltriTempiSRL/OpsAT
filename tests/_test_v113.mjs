// _test_v113.mjs — Valida el fix v113 (caso S09644) con un Odoo FALSO local. Cero datos live.
//  A  · pick-diff: primera carga usa SOLO picks 'assigned' (no hereda picks done de otra SDV)
//  A  · pick-diff: acota el merge a sdvArticulos (SKUs/cantidades solicitados) y reporta omitidos
//  A2 · guard H2-1: tolera "echoes" del formulario (dueDate YYYY-MM-DD vs YYYY-MM-DDTHH:MM:SS)
//       sin aplicar el echo (preserva la hora de la SDV) y sigue bloqueando cambios reales
// Uso: node _test_v113.mjs
import { spawn } from 'child_process';
import https from 'https';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

const FAKE_PORT = 3291;
const PORT = 3298;
const BASE = `http://127.0.0.1:${PORT}`;
const ROOT = process.cwd();
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'testv113-'));

// ── Odoo FALSO (JSON-RPC): orden con 2 picks — uno done (ayer, otra SDV) y uno assigned ──
// PICK/1001 done:     Prod A (101) + Prod B (102)   ← lo que ya se despachó
// PICK/1002 assigned: Candle (103, sku 882664010003) ← lo de la SDV nueva
const pickHits = []; // {origin, states} por consulta a stock.picking
const PICKS = [
  { id:11, name:'ALVEN/PICK/1001', state:'done',     picking_type_id:[5,'Pick'] },
  { id:12, name:'ALVEN/PICK/1002', state:'assigned', picking_type_id:[5,'Pick'] }
];
const MLS = [
  { product_id:[101,'Prod A'],            location_id:[7,'ALVEN/Stock/A-CDP/BB1'], product_uom_qty:1, qty_done:0, picking_id:[11,'ALVEN/PICK/1001'] },
  { product_id:[102,'Prod B'],            location_id:[7,'ALVEN/Stock/A-CDP/BB2'], product_uom_qty:1, qty_done:0, picking_id:[11,'ALVEN/PICK/1001'] },
  { product_id:[103,'St. Tropez Candle'], location_id:[8,'ALVEN/Stock/D-PTN/SHOWROOM'], product_uom_qty:1, qty_done:0, picking_id:[12,'ALVEN/PICK/1002'] }
];
const PRODS = [
  { id:101, barcode:'111', default_code:'PRODA', image_128:false, categ_id:[9,'Misc'] },
  { id:102, barcode:'222', default_code:'PRODB', image_128:false, categ_id:[9,'Misc'] },
  { id:103, barcode:'882664010003', default_code:'ASLN.ST.TROPEZ.SCENT.CANDLE.P', image_128:false, categ_id:[9,'Velas'] }
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
        return reply([{ id:1, name: c ? String(c[2]) : '' }]);
      }
      if (model==='stock.picking') {
        const o = domain.find(x=>Array.isArray(x)&&x[0]==='origin');
        const s = domain.find(x=>Array.isArray(x)&&x[0]==='state');
        const states = s ? s[2] : null;
        pickHits.push({ origin: o?String(o[2]):'', states });
        return reply(PICKS.filter(pk => !states || states.includes(pk.state)));
      }
      if (model==='stock.move.line') {
        const c = domain.find(x=>Array.isArray(x)&&x[0]==='picking_id');
        const ids = c ? c[2] : [];
        return reply(MLS.filter(ml => ids.includes(ml.picking_id[0])));
      }
      if (model==='product.product' && method==='read') {
        const ids = callArgs[0]||[];
        return reply(PRODS.filter(pr => ids.includes(pr.id)));
      }
      return reply([]);
    }
    reply(null);
  });
});

// ── Fixtures: tareas pre-escritas en el DATA_DIR temporal ───────────────────
const now = new Date().toISOString();
const baseTask = (id, extra) => ({
  id, seq:null, parentId:null, title:'Tarea '+id, type:'dispatch_order', description:'',
  priority:'medium', status:'pending', assignedTo:null, managerId:null, managerName:null,
  executors:[], assignees:[], location:'', dueDate:null, actionNote:'', items:[],
  evidence:[], fotos_guia:[], statusHistory:[{status:'pending',date:now,by:'test'}],
  createdBy:'test', createdAt:now, updatedAt:now, ...extra
});
const CANDLE_ITEM = { item_id:'oi_103_ALVEN_PICK_1002', odoo_product_id:103, sku:'882664010003', barcode:'882664010003',
  product_name:'St. Tropez Candle', quantity:1, units:1, unit_index:1, unit_total:1, group_ref:'oi_103',
  pickName:'ALVEN/PICK/1002', fromPick:true, selected:true, selected_location_name:'D-PTN/SHOWROOM',
  evidence_images:[], confirmado:false, status:'pending', locations:[], selected_location:null };
const FIX = [
  baseTask('wt_echo',   { odooRef:'S_ECHO', sdvId:'sdv_e', sdvFolio:'SD-T-ECHO', dueDate:'2026-07-02T00:00:00',
                          actionNote:'cuidado con el cristal', client:'CRISTINA AMELIA', deliveryAddress:'AV. ENRIQUILLO, TORRE VALENTINA IV' }),
  baseTask('wt_new',    { odooRef:'S_NEW', sdvId:'sdv_n', sdvFolio:'SD-T-NEW',
                          sdvArticulos:[{sku:'882664010003',quantity:1,name:'St. Tropez Candle'}] }),
  baseTask('wt_nosdv',  { odooRef:'S_NOSDV' }),
  baseTask('wt_loaded', { odooRef:'S_LOADED', sdvId:'sdv_l', sdvFolio:'SD-T-LOAD',
                          sdvArticulos:[{sku:'882664010003',quantity:1,name:'St. Tropez Candle'}], items:[{...CANDLE_ITEM}] }),
  baseTask('wt_legacy', { odooRef:'S_LEGACY', items:[{ item_id:'oi_101_ALVEN_PICK_1001', odoo_product_id:101, sku:'111', barcode:'111',
                          product_name:'Prod A', quantity:1, units:1, unit_index:1, unit_total:1, group_ref:'oi_101',
                          pickName:'ALVEN/PICK/1001', fromPick:true, selected:true, selected_location_name:'A-CDP/BB1',
                          evidence_images:[], confirmado:false, status:'pending', locations:[], selected_location:null }] })
];
fs.writeFileSync(path.join(DATA_DIR,'wwp-tasks.json'), JSON.stringify(FIX,null,2));

// ── JWT forjado + helpers HTTP ───────────────────────────────────────────────
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

    console.log('\n── A2 · Guard H2-1 tolera echoes del formulario ──');
    const e1=await api('PATCH','/api/wwp/tasks/wt_echo',ADMIN,{ title:'Título editado', dueDate:'2026-07-02',
      actionNote:'cuidado con el cristal', client:'CRISTINA AMELIA', by:'Admin QA' });
    ok('echo dueDate/actionNote/client → 200 (antes: 422 "Error al guardar")', e1.status===200, {status:e1.status,err:e1.j&&e1.j.error});
    const te=await getTask('wt_echo');
    ok('echo NO aplicado: dueDate conserva la hora de la SDV', te && te.dueDate==='2026-07-02T00:00:00', {got:te&&te.dueDate});
    ok('campo NO-owned sí se aplicó (title)', te && te.title==='Título editado', {got:te&&te.title});

    const e2=await api('PATCH','/api/wwp/tasks/wt_echo',ADMIN,{ dueDate:'2026-07-05', by:'Admin QA' });
    ok('cambio REAL de fecha → sigue bloqueado 422', e2.status===422 && (e2.j&&e2.j.campos||[]).includes('dueDate'), {status:e2.status,campos:e2.j&&e2.j.campos});
    const e3=await api('PATCH','/api/wwp/tasks/wt_echo',ADMIN,{ client:'OTRO CLIENTE', by:'Admin QA' });
    ok('cambio REAL de cliente → sigue bloqueado 422', e3.status===422 && (e3.j&&e3.j.campos||[]).includes('client'), {status:e3.status,campos:e3.j&&e3.j.campos});
    const e4=await api('PATCH','/api/wwp/tasks/wt_echo',ADMIN,{ dueDate:null, by:'Admin QA' });
    ok('borrar la fecha (null) → es cambio real, 422', e4.status===422, {status:e4.status});

    console.log('\n── A · pick-diff primera carga: solo picks assigned + acotado a la SDV ──');
    const d1=await api('GET','/api/wwp/tasks/wt_new/pick-diff',ADMIN);
    const m1=(d1.j&&d1.j.merged)||[];
    ok('tarea SDV nueva: merged trae SOLO la vela (1 unidad, no 3)', m1.length===1 && m1[0].sku==='882664010003', {len:m1.length,skus:m1.map(x=>x.sku)});
    ok('summary.added=1, sin ejecutados heredados', d1.j&&d1.j.summary&&d1.j.summary.added===1&&d1.j.summary.executed===0, {summary:d1.j&&d1.j.summary});
    const h1=pickHits.filter(h=>h.origin==='S_NEW').pop();
    ok('consulta a Odoo pidió SOLO state=assigned (primera carga)', h1 && Array.isArray(h1.states) && h1.states.length===1 && h1.states[0]==='assigned', {hit:h1});

    const d2=await api('GET','/api/wwp/tasks/wt_nosdv/pick-diff',ADMIN);
    const m2=(d2.j&&d2.j.merged)||[];
    ok('tarea sin SDV (wizard) primera carga: tampoco hereda el pick done', m2.length===1 && m2[0].sku==='882664010003', {len:m2.length,skus:m2.map(x=>x.sku)});

    console.log('\n── A · pick-diff con items cargados: cap por sdvArticulos + omitidos ──');
    const d3=await api('GET','/api/wwp/tasks/wt_loaded/pick-diff',ADMIN);
    const m3=(d3.j&&d3.j.merged)||[];
    const s3=(d3.j&&d3.j.summary)||{};
    ok('sync posterior: la vela se conserva, Prod A/B (otra SDV) NO entran', m3.length===1 && m3[0].sku==='882664010003', {len:m3.length,skus:m3.map(x=>x.sku)});
    ok('omitidos=2 reportados (unidades de otra SDV)', s3.omitidos===2, {summary:s3});
    ok('sin cambios que aplicar (hasChanges=false)', d3.j && d3.j.hasChanges===false, {hasChanges:d3.j&&d3.j.hasChanges});
    const h3=pickHits.filter(h=>h.origin==='S_LOADED').pop();
    ok('con items cargados sí consulta assigned+done (clasificación executed intacta)', h3 && Array.isArray(h3.states) && h3.states.includes('done'), {hit:h3});

    console.log('\n── Legacy · tarea vieja sin sdvArticulos: comportamiento anterior intacto ──');
    const d4=await api('GET','/api/wwp/tasks/wt_legacy/pick-diff',ADMIN);
    const m4=(d4.j&&d4.j.merged)||[];
    const s4=(d4.j&&d4.j.summary)||{};
    ok('sin snapshot SDV: el diff completo de la orden sigue disponible', m4.length===3, {len:m4.length,skus:m4.map(x=>x.sku)});
    ok('clasificación executed/new intacta (2 ejecutados, 1 nuevo)', s4.executed===2 && s4.added===1, {summary:s4});

    console.log('\n── Front ──');
    const fh=await fetch(BASE+'/historial.html'); const ft=await fh.text();
    ok('historial.html 200 + build v113', fh.status===200 && ft.includes("APP_BUILD = 'v113'"), {status:fh.status});

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
