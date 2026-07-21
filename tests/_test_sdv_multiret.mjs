// _test_sdv_multiret.mjs — SDV devolución multi-RET (v206): la vendedora marca 1..N RET
//   de la orden y la selección viaja SDV → tarea de recogida. Server real, DATA_DIR
//   temporal, SIN Odoo. Cubre:
//     · POST /api/sdv devolución con retRefs → persistencia saneada (whitelist, ids
//       numéricos, basura filtrada, corte a 20)
//     · aprobar → task.retRefs (N), items con retId/retRef, type item_pickup +
//       taskConcept customer_return (sin regresión del molde v198)
//     · SDV vieja sin retRefs → task.retRefs === [] (fallback legacy)
//     · retRefs malformado (string / basura) → no crashea, guarda []
// Uso (desde la raíz): node tests/_test_sdv_multiret.mjs
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

const PORT = 3313;
const BASE = `http://127.0.0.1:${PORT}`;
const ROOT = process.cwd();
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'testmultiret-'));

const now = new Date().toISOString();
const RET_A = { id: 9101, name: 'ALVEN/IN/00881', state: 'done',     origin: 'RET/00035 - S09474', retRef: 'RET/00035 · ALVEN/IN/00881' };
const RET_B = { id: 9102, name: 'ALVEN/IN/00902', state: 'assigned', origin: 'RET/00041 - S09474', retRef: 'RET/00041 · ALVEN/IN/00902' };

const articulosMulti = [
  { item_id:'ret_501_0', sku:'BC-001', odoo_product_id:501, product_name:'Silla Tau',  quantity:2, orderRef:'S09474', retId:RET_A.id, retRef:RET_A.retRef },
  { item_id:'ret_502_1', sku:'BC-002', odoo_product_id:502, product_name:'Mesa Liora', quantity:1, orderRef:'S09474', retId:RET_B.id, retRef:RET_B.retRef },
];
const baseBody = extra => ({
  tipoSolicitud:'devolucion', odooOrderRef:'S09474',
  clienteNombre:'AXEL HACHE', ciudadEntrega:'Santo Domingo',
  direccionEntrega:'C/ Caonabo 12, Gazcue', receptorNombre:'Rocio Gonzalez',
  receptorContacto:'809-757-3896', transporteIncluido:true,
  observaciones:'QA multi-RET', fechaSolicitudDeseada:'2026-07-25',
  articulosOdoo:articulosMulti, ...extra });

// SDV vieja pre-selector (sin retRefs) sembrada directo en disco — fallback legacy
const SDV_LEGACY = [{
  id:'legacydev', folio:'SD-T-legacy', tipoSolicitud:'devolucion',
  clienteNombre:'CLIENTE VIEJO', odooOrderRef:'S00300',
  direccionEntrega:'Av. Duarte 100', ciudadEntrega:'Santiago',
  receptorNombre:'Juan Perez', receptorContacto:'809-555-0100', transporteIncluido:false,
  observaciones:'', articulosOdoo:[{ sku:'BC-009', odoo_product_id:509, product_name:'Lampara Sol', quantity:1 }],
  fechaSolicitudDeseada:'2026-07-23', retRef:'ALVEN/RET/00123', retState:'assigned',
  estado:'pendiente_revision', wwpTaskId:null, wwpTareas:[],
  creadoPor:'au_seller', creadoNombre:'Vendedora QA',
  statusHistory:[{estado:'pendiente_revision',por:'au_seller',nombre:'Vendedora QA',at:now}],
}];
fs.writeFileSync(path.join(DATA_DIR,'sdv-solicitudes.json'), JSON.stringify(SDV_LEGACY,null,2));
fs.writeFileSync(path.join(DATA_DIR,'wwp-tasks.json'), JSON.stringify([],null,2));

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
async function getTask(id){ const r=await api('GET','/api/wwp/tasks',ADMIN); const list=(r.j&&(r.j.tasks||r.j.list))||(Array.isArray(r.j)?r.j:[]); return list.find(t=>t.id===id); }
const R=[]; const ok=(name,cond,detail)=>{ R.push({name,pass:!!cond}); console.log(`${cond?'✓':'✗'} ${name}${cond?'':'  → '+JSON.stringify(detail)}`); };
function waitReady(ms=25000){ const t0=Date.now(); return new Promise((res,rej)=>{ (async function poll(){ try{const r=await fetch(BASE+'/api/app-version'); if(r.ok)return res(true);}catch{} if(Date.now()-t0>ms)return rej(new Error('server no levantó')); setTimeout(poll,300); })(); }); }

(async ()=>{
  const srv = spawn('node',['proxy.js'],{ cwd:ROOT, env:{...process.env, DATA_DIR, PORT:String(PORT) } });
  let serr=''; srv.stderr.on('data',d=>serr+=d.toString());
  const cleanup=()=>{ try{srv.kill('SIGKILL');}catch{} try{fs.rmSync(DATA_DIR,{recursive:true,force:true});}catch{} };
  try{
    await waitReady();
    SECRET=fs.readFileSync(path.join(DATA_DIR,'.jwt-secret'),'utf8').trim();
    ADMIN=mint('au_gsanchez','admin','Admin QA');

    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n── POST devolución con 2 RETs marcadas + basura → saneado ──');
    const dirty = [
      RET_A,
      'basura-string',                                   // no-objeto → fuera
      null,                                              // null → fuera
      { ...RET_B, id:String(RET_B.id), extraCampo:'x' }, // id string numérico → Number; extra → fuera
    ];
    const p1 = await api('POST','/api/sdv',ADMIN, baseBody({
      retRefs: dirty,
      retRef: RET_A.retRef+' + '+RET_B.retRef,
      retState: 'done/assigned',
    }));
    ok('POST → 200/201 ok', (p1.status===200||p1.status===201) && p1.j && p1.j.ok, {status:p1.status,err:p1.j&&p1.j.error});
    const sol1 = p1.j && p1.j.solicitud;
    ok('retRefs saneado: 2 entradas (basura filtrada)', sol1 && Array.isArray(sol1.retRefs) && sol1.retRefs.length===2, {rr:sol1&&sol1.retRefs});
    ok('ids numéricos', sol1 && sol1.retRefs.every(r=>typeof r.id==='number'), {ids:sol1&&sol1.retRefs.map(r=>r.id)});
    ok('whitelist: sin campos extra', sol1 && sol1.retRefs.every(r=>Object.keys(r).sort().join(',')==='id,name,origin,retRef,state'), {keys:sol1&&sol1.retRefs.map(r=>Object.keys(r))});
    ok('retRef agregado persistido', sol1 && sol1.retRef===RET_A.retRef+' + '+RET_B.retRef, {rr:sol1&&sol1.retRef});
    ok('retState agregado persistido', sol1 && sol1.retState==='done/assigned', {rs:sol1&&sol1.retState});
    ok('articulosOdoo conservan retId/retRef por artículo', sol1 && (sol1.articulosOdoo||[]).every(a=>a.retId && a.retRef), {arts:sol1&&sol1.articulosOdoo});

    console.log('\n── Aprobar (PATCH en_proceso) → tarea de recogida con retRefs ──');
    const pa = await api('PATCH','/api/sdv/'+sol1.id,ADMIN,{ estado:'en_proceso' });
    ok('PATCH aprobar → 200', pa.status===200 && pa.j && pa.j.ok, {status:pa.status,err:pa.j&&pa.j.error});
    const tid = pa.j && pa.j.solicitud && pa.j.solicitud.wwpTaskId;
    const t1 = tid ? await getTask(tid) : null;
    ok('tarea existe', !!t1, {tid});
    ok('type === item_pickup (regresión v198)', t1 && t1.type==='item_pickup', {type:t1&&t1.type});
    ok('taskConcept === customer_return (regresión v198)', t1 && t1.taskConcept==='customer_return', {tc:t1&&t1.taskConcept});
    ok('task.retRefs = 2 RETs', t1 && Array.isArray(t1.retRefs) && t1.retRefs.length===2 && t1.retRefs[0].id===RET_A.id, {rr:t1&&t1.retRefs});
    ok('task.retRef agregado', t1 && t1.retRef===RET_A.retRef+' + '+RET_B.retRef, {rr:t1&&t1.retRef});
    ok('items sembrados (2) con retId/retRef', t1 && (t1.items||[]).length===2 && t1.items.every(it=>it.retId && it.retRef), {items:t1&&(t1.items||[]).map(it=>({id:it.retId,ref:it.retRef}))});
    ok('items siguen selected + pending (checklist intacto)', t1 && (t1.items||[]).every(it=>it.selected===true && it.status==='pending'), {items:t1&&t1.items});

    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n── SDV vieja sin retRefs (pre-selector) → fallback legacy ──');
    const pl = await api('PATCH','/api/sdv/legacydev',ADMIN,{ estado:'en_proceso' });
    ok('PATCH aprobar legacy → 200', pl.status===200 && pl.j && pl.j.ok, {status:pl.status,err:pl.j&&pl.j.error});
    const tid2 = pl.j && pl.j.solicitud && pl.j.solicitud.wwpTaskId;
    const t2 = tid2 ? await getTask(tid2) : null;
    ok('task.retRefs === [] (sin selección guardada)', t2 && Array.isArray(t2.retRefs) && t2.retRefs.length===0, {rr:t2&&t2.retRefs});
    ok('retRef/retState viejos siguen viajando', t2 && t2.retRef==='ALVEN/RET/00123' && t2.retState==='assigned', {rr:t2&&t2.retRef,rs:t2&&t2.retState});
    ok('type item_pickup (sin regresión)', t2 && t2.type==='item_pickup', {type:t2&&t2.type});

    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n── retRefs malformado (string en vez de array) → no crashea, guarda [] ──');
    const p3 = await api('POST','/api/sdv',ADMIN, baseBody({ retRefs:'RET/00035' }));
    ok('POST → ok (no 500)', (p3.status===200||p3.status===201) && p3.j && p3.j.ok, {status:p3.status,err:p3.j&&p3.j.error});
    ok('retRefs === []', p3.j && p3.j.solicitud && Array.isArray(p3.j.solicitud.retRefs) && p3.j.solicitud.retRefs.length===0, {rr:p3.j&&p3.j.solicitud&&p3.j.solicitud.retRefs});

    console.log('\n── retRefs con 25 entradas → corte a 20 ──');
    const many = Array.from({length:25},(_,i)=>({ id:9200+i, name:'ALVEN/IN/0'+i, state:'done', origin:'RET/0'+i+' - S09474', retRef:'RET/0'+i }));
    const p4 = await api('POST','/api/sdv',ADMIN, baseBody({ retRefs:many }));
    ok('POST → ok', (p4.status===200||p4.status===201) && p4.j && p4.j.ok, {status:p4.status,err:p4.j&&p4.j.error});
    ok('corte a 20', p4.j && p4.j.solicitud && p4.j.solicitud.retRefs.length===20, {n:p4.j&&p4.j.solicitud&&p4.j.solicitud.retRefs.length});

    // ─────────────────────────────────────────────────────────────────────────
    const pass = R.filter(x=>x.pass).length;
    console.log(`\n══ ${pass}/${R.length} asserts OK ══`);
    if (pass !== R.length) { console.error('FALLOS:', R.filter(x=>!x.pass).map(x=>x.name)); cleanup(); process.exit(1); }
    cleanup(); process.exit(0);
  } catch(e) {
    console.error('ERROR HARNESS:', e.message);
    if (serr) console.error('STDERR server:', serr.slice(-2000));
    cleanup(); process.exit(1);
  }
})();
