// _test_v117.mjs — Valida que los artículos VIAJAN SOLOS del pick a la cadena SDV al crearla.
//  · crear-tarea (empaque+despacho): raíz e hija nacen con los items del pick 'assigned',
//    acotados a sdvArticulos (presupuesto v113 — sin heredar el pick done de otra SDV)
//  · aprobación 1-clic: idem
//  · SDV sin odooOrderRef: nace sin items, sin error (fail-open) y responde rápido
// Odoo FALSO local (mismo dataset del _test_v113). Uso: node _test_v117.mjs
import { spawn } from 'child_process';
import https from 'https';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

const FAKE_PORT = 3293;
const PORT = 3299;
const BASE = `http://127.0.0.1:${PORT}`;
const ROOT = process.cwd();
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'testv117-'));

// ── Odoo FALSO: orden con 2 picks — uno done (otra SDV) y uno assigned (esta SDV) ──
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
      const a = params.args||[]; const model=a[3]; const callArgs=a[5]||[]; const domain=callArgs[0]||[];
      if (model==='sale.order') { const c = domain.find(x=>Array.isArray(x)&&x[0]==='name'); return reply([{ id:1, name: c ? String(c[2]) : '' }]); }
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
      if (model==='product.product') { const ids = callArgs[0]||[]; return reply(PRODS.filter(pr => ids.includes(pr.id))); }
      return reply([]);
    }
    reply(null);
  });
});

// ── Fixtures: SDVs pre-escritas ──────────────────────────────────────────────
const now = new Date().toISOString();
const mkSdv = (id, estado, extra) => ({
  id, folio: id.toUpperCase(), estado, tipoSolicitud:'despacho_cliente',
  clienteNombre:'Cliente '+id, odooOrderRef:'', articulosOdoo:[],
  direccionEntrega:'Calle 1', receptorNombre:'R', receptorContacto:'809',
  observaciones:'', creadoPor:'au_test', creadoNombre:'Test', vendedorNombre:'V',
  fechaSolicitud:now, statusHistory:[{estado,por:'seed',nombre:'Seed',at:now,nota:''}],
  wwpTareas:[], wwpTaskId:null, ...extra
});
const CANDLE = [{ sku:'882664010003', quantity:1, product_name:'St. Tropez Candle' }];
fs.writeFileSync(path.join(DATA_DIR,'sdv-solicitudes.json'), JSON.stringify([
  mkSdv('sdv_pick',   'en_proceso',         { odooOrderRef:'S_NEW',  articulosOdoo:CANDLE }),
  mkSdv('sdv_sinref', 'en_proceso',         { }),
  mkSdv('sdv_aprob',  'pendiente_revision', { odooOrderRef:'S_NEW2', articulosOdoo:CANDLE })
], null, 2));
fs.writeFileSync(path.join(DATA_DIR,'wwp-tasks.json'), '[]');

// ── JWT forjado + helpers ────────────────────────────────────────────────────
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
  let j=null; try{j=JSON.parse(await r.text());}catch{}
  return {status:r.status,j};
}
async function tasksOf(sdvId){
  const r=await api('GET','/api/wwp/tasks',ADMIN);
  const list=Array.isArray(r.j)?r.j:((r.j&&(r.j.tasks||r.j.list))||[]);
  return list.filter(t=>t.sdvId===sdvId);
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

    console.log('\n── T1 · crear-tarea: los items del pick viajan solos a la cadena ──');
    const c1=await api('POST','/api/sdv/sdv_pick/crear-tarea',ADMIN,{conEmpaque:true});
    ok('crear-tarea 200', c1.status===200 && c1.j && c1.j.ok, {status:c1.status,err:c1.j&&c1.j.error});
    const t1=await tasksOf('sdv_pick');
    const root1=t1.find(t=>t.type==='packaging'), child1=t1.find(t=>t.type==='dispatch_order');
    ok('cadena: raíz packaging + hija dispatch con parentId', root1 && child1 && child1.parentId===root1.id, {n:t1.length});
    const rIt=(root1&&root1.items)||[], cIt=(child1&&child1.items)||[];
    ok('raíz nace CON items: la vela del pick assigned (1, no 3)', rIt.length===1 && rIt[0].sku==='882664010003', {len:rIt.length,skus:rIt.map(x=>x.sku)});
    ok('raíz NO hereda el pick done de otra SDV (sin Prod A/B)', !rIt.some(i=>['111','222'].includes(i.sku)), {skus:rIt.map(x=>x.sku)});
    ok('hija despacho también nace con la vela', cIt.length===1 && cIt[0].sku==='882664010003', {len:cIt.length,skus:cIt.map(x=>x.sku)});
    ok('items marcados selected + sin evidencia previa', rIt[0] && rIt[0].selected===true && (rIt[0].evidence_images||[]).length===0, {it:rIt[0]});

    console.log('\n── T2 · SDV sin orden Odoo: fail-open (nace sin items, sin error) ──');
    const c2=await api('POST','/api/sdv/sdv_sinref/crear-tarea',ADMIN,{conEmpaque:true});
    ok('crear-tarea 200 (sin odooRef)', c2.status===200 && c2.j && c2.j.ok, {status:c2.status,err:c2.j&&c2.j.error});
    const t2=await tasksOf('sdv_sinref');
    ok('cadena creada, tareas sin items (Sincronizar como respaldo)', t2.length===2 && t2.every(t=>!(t.items||[]).length), {n:t2.length});

    console.log('\n── T3 · aprobación 1-clic: items también viajan ──');
    const c3=await api('PATCH','/api/sdv/sdv_aprob',ADMIN,{estado:'en_proceso',conEmpaque:true});
    ok('aprobación 200 + devuelve solicitud con wwpTaskId', c3.status===200 && c3.j && c3.j.ok && c3.j.solicitud && !!c3.j.solicitud.wwpTaskId, {status:c3.status});
    const t3=await tasksOf('sdv_aprob');
    const root3=t3.find(t=>t.type==='packaging');
    ok('raíz del 1-clic nace con la vela del pick', root3 && (root3.items||[]).length===1 && root3.items[0].sku==='882664010003', {items:root3&&(root3.items||[]).map(x=>x.sku)});
    ok('wwpTaskId apunta a la raíz', c3.j.solicitud.wwpTaskId===(root3&&root3.id), {ptr:c3.j.solicitud.wwpTaskId});

    const passed=R.filter(x=>x.pass).length;
    console.log(`\n═══ ${passed}/${R.length} pasaron ═══${passed===R.length?'':' · '+(R.length-passed)+' FALLARON'}`);
    cleanup(); process.exit(passed===R.length?0:1);
  } catch(e){ console.error('ERROR:', e.message); console.error(serr.slice(-800)); cleanup(); process.exit(1); }
})();
