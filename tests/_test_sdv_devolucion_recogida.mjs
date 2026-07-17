// _test_sdv_devolucion_recogida.mjs — SDV `devolucion` → tarea de RECOGIDA (item_pickup +
//   customer_return) con items sembrados desde articulosOdoo. Server real, DATA_DIR temporal,
//   SIN Odoo. Cubre los DOS caminos que crean la tarea:
//     · POST /api/sdv/:id/crear-tarea        (sitio 1, proxy.js ~15329)
//     · PATCH /api/sdv/:id {estado:en_proceso} (sitio 2, aprobación 1-clic, proxy.js ~16334)
//   Regresión: solicitud_especial sigue creando su tarea `general` con items; despacho_cliente
//   y traslado_interno siguen yendo por la cadena (NO item_pickup / NO customer_return).
// Uso (desde la raíz): node tests/_test_sdv_devolucion_recogida.mjs
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

const PORT = 3311;
const BASE = `http://127.0.0.1:${PORT}`;
const ROOT = process.cwd();
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'testdevret-'));

const now = new Date().toISOString();
const articulos = [
  { sku:'BC-001', barcode:'BC-001', odoo_product_id:501, product_name:'Silla Tau', quantity:2, image:'' },
  { sku:'BC-002', barcode:'BC-002', odoo_product_id:502, product_name:'Mesa Liora', quantity:1, image:'' },
];
const baseSdv = (id, extra) => ({
  id, folio:'SD-T-'+id, clienteNombre:'AXEL HACHE', odooOrderRef:'S00214',
  direccionEntrega:'Calle Duarte 45, Santiago', ciudadEntrega:'Santiago',
  receptorNombre:'Axel Hache', receptorContacto:'809-555-0142', transporteIncluido:true,
  gpsCoords:{ lat:19.45, lng:-70.69 }, observaciones:'Recoger silla defectuosa',
  articulosOdoo:articulos, fechaSolicitudDeseada:'2026-07-22',
  estado:'pendiente_revision', wwpTaskId:null, wwpTareas:[],
  creadoPor:'au_seller', creadoNombre:'Vendedora QA',
  statusHistory:[{estado:'pendiente_revision',por:'au_seller',nombre:'Vendedora QA',at:now}],
  ...extra });

const SDV = [
  // Devolución vía aprobación 1-clic (PATCH) — pendiente_revision → en_proceso
  baseSdv('devapprove', { tipoSolicitud:'devolucion', retRef:'ALVEN/RET/00123', retState:'assigned' }),
  // Devolución vía crear-tarea (POST) — ya en_proceso, sin retRef (no debe bloquear)
  baseSdv('devcrear', { tipoSolicitud:'devolucion', estado:'en_proceso' }),
  // Regresión: solicitud especial (PATCH) sigue siendo tarea general con items
  baseSdv('espapprove', { tipoSolicitud:'solicitud_especial', asunto:'Retiro para revisión',
    descripcion:'Recoger para validar en PTN', subtipoEspecial:'retiro_revision' }),
  // Regresión: despacho a cliente (crear-tarea) sigue yendo por la cadena
  baseSdv('despcrear', { tipoSolicitud:'despacho_cliente', estado:'en_proceso' }),
  // Regresión: traslado interno (crear-tarea) NO es item_pickup
  baseSdv('trascrear', { tipoSolicitud:'traslado_interno', estado:'en_proceso',
    ubicacionOrigen:'A-CDP', ubicacionDestino:'D-PTN' }),
];
fs.writeFileSync(path.join(DATA_DIR,'sdv-solicitudes.json'), JSON.stringify(SDV,null,2));
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
    console.log('\n── Devolución vía aprobación 1-clic (PATCH) ──');
    const pa = await api('PATCH','/api/sdv/devapprove',ADMIN,{ estado:'en_proceso' });
    ok('PATCH aprobar → 200', pa.status===200 && pa.j && pa.j.ok, {status:pa.status,j:pa.j&&pa.j.error});
    const devTaskId = pa.j && pa.j.solicitud && pa.j.solicitud.wwpTaskId;
    ok('la SDV quedó ligada a una tarea (wwpTaskId)', !!devTaskId, {wwpTaskId:devTaskId});
    const dt = devTaskId ? await getTask(devTaskId) : null;
    ok('tarea existe en WWP', !!dt, {devTaskId});
    ok('type === item_pickup', dt && dt.type==='item_pickup', {type:dt&&dt.type});
    ok('taskConcept === customer_return', dt && dt.taskConcept==='customer_return', {tc:dt&&dt.taskConcept});
    ok('title empieza con "Devolución " (NO "Despacho")', dt && /^Devolución /.test(dt.title||'') && !/^Despacho/.test(dt.title||''), {title:dt&&dt.title});
    ok('description dice recoger + id SDV', dt && /Recoger en el cliente/.test(dt.description||'') && /devapprove/.test(dt.description||''), {desc:dt&&dt.description});
    ok('items sembrados desde articulosOdoo (2, checklist)', dt && Array.isArray(dt.items) && dt.items.length===2, {n:dt&&(dt.items||[]).length});
    ok('items traen product_name/sku/quantity + selected + status pending', dt && (dt.items||[]).every(it=>it.product_name && it.sku && it.quantity && it.selected===true && it.status==='pending' && Array.isArray(it.evidence_images) && it.confirmado===false), {items:dt&&dt.items});
    ok('itemsUpdatedAt seteado (hay items)', dt && !!dt.itemsUpdatedAt, {iua:dt&&dt.itemsUpdatedAt});
    ok('deliveryAddress copiada (punto de recogida)', dt && dt.deliveryAddress==='Calle Duarte 45, Santiago', {da:dt&&dt.deliveryAddress});
    ok('phone (receptorContacto) copiado', dt && dt.phone==='809-555-0142', {ph:dt&&dt.phone});
    ok('receptorNombre copiado', dt && dt.receptorNombre==='Axel Hache', {rn:dt&&dt.receptorNombre});
    ok('gpsCoords copiadas', dt && dt.gpsCoords && dt.gpsCoords.lat===19.45 && dt.gpsCoords.lng===-70.69, {gps:dt&&dt.gpsCoords});
    ok('transporteIncluido copiado', dt && dt.transporteIncluido===true, {t:dt&&dt.transporteIncluido});
    ok('dueDate copiado', dt && (dt.dueDate||'').slice(0,10)==='2026-07-22', {due:dt&&dt.dueDate});
    ok('retRef persistido en la tarea', dt && dt.retRef==='ALVEN/RET/00123', {rr:dt&&dt.retRef});
    ok('retState persistido en la tarea', dt && dt.retState==='assigned', {rs:dt&&dt.retState});
    ok('seq asignado (raíz sin parentId)', dt && typeof dt.seq==='number' && dt.parentId===null, {seq:dt&&dt.seq,parent:dt&&dt.parentId});

    console.log('\n── Gate de cierre: item_pickup con items EXIGE evidencia por artículo ──');
    const done = await api('PATCH','/api/wwp/tasks/'+devTaskId,ADMIN,{ status:'completed', by:'Admin QA' });
    ok('completar sin evidencia → 422 (mismo flujo que hoy)', done.status===422 && /evidencia/i.test((done.j&&done.j.error)||''), {status:done.status,err:done.j&&done.j.error});

    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n── Devolución vía crear-tarea (POST) — sin retRef ──');
    const ct = await api('POST','/api/sdv/devcrear/crear-tarea',ADMIN,{ by:'Admin QA', byUserId:'au_gsanchez' });
    ok('crear-tarea → 200', ct.status===200 && ct.j && ct.j.ok, {status:ct.status,j:ct.j&&ct.j.error});
    const dt2 = ct.j && ct.j.taskId ? await getTask(ct.j.taskId) : null;
    ok('type === item_pickup', dt2 && dt2.type==='item_pickup', {type:dt2&&dt2.type});
    ok('taskConcept === customer_return', dt2 && dt2.taskConcept==='customer_return', {tc:dt2&&dt2.taskConcept});
    ok('title empieza con "Devolución "', dt2 && /^Devolución /.test(dt2.title||''), {title:dt2&&dt2.title});
    ok('items sembrados (2)', dt2 && (dt2.items||[]).length===2, {n:dt2&&(dt2.items||[]).length});
    ok('retRef/retState = "" (no bloquea sin dato)', dt2 && dt2.retRef==='' && dt2.retState==='', {rr:dt2&&dt2.retRef,rs:dt2&&dt2.retState});

    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n── REGRESIÓN: solicitud_especial sigue siendo tarea general con items ──');
    const ea = await api('PATCH','/api/sdv/espapprove',ADMIN,{ estado:'en_proceso' });
    ok('PATCH aprobar especial → 200', ea.status===200 && ea.j && ea.j.ok, {status:ea.status});
    const et = ea.j && ea.j.solicitud && ea.j.solicitud.wwpTaskId ? await getTask(ea.j.solicitud.wwpTaskId) : null;
    ok('type === general (sin cambio)', et && et.type==='general', {type:et&&et.type});
    ok('NO es customer_return', et && et.taskConcept!=='customer_return', {tc:et&&et.taskConcept});
    ok('items sembrados desde articulosOdoo (2)', et && (et.items||[]).length===2, {n:et&&(et.items||[]).length});
    ok('title = asunto de la vendedora (no Despacho/Devolución)', et && et.title==='Retiro para revisión', {title:et&&et.title});

    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n── REGRESIÓN: despacho_cliente sigue yendo por la cadena (NO recogida) ──');
    const dc = await api('POST','/api/sdv/despcrear/crear-tarea',ADMIN,{ by:'Admin QA', byUserId:'au_gsanchez' });
    ok('crear-tarea despacho → 200', dc.status===200 && dc.j && dc.j.ok, {status:dc.status});
    const dct = dc.j && dc.j.taskId ? await getTask(dc.j.taskId) : null;
    ok('type === dispatch_order (solo_despacho)', dct && dct.type==='dispatch_order', {type:dct&&dct.type});
    ok('NO item_pickup / NO customer_return', dct && dct.type!=='item_pickup' && dct.taskConcept!=='customer_return', {type:dct&&dct.type,tc:dct&&dct.taskConcept});
    ok('title empieza con "Despacho "', dct && /^Despacho /.test(dct.title||''), {title:dct&&dct.title});

    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n── REGRESIÓN: traslado_interno NO es item_pickup ──');
    const tc = await api('POST','/api/sdv/trascrear/crear-tarea',ADMIN,{ by:'Admin QA', byUserId:'au_gsanchez' });
    ok('crear-tarea traslado → 200', tc.status===200 && tc.j && tc.j.ok, {status:tc.status});
    const tct = tc.j && tc.j.taskId ? await getTask(tc.j.taskId) : null;
    ok('NO item_pickup / NO customer_return', tct && tct.type!=='item_pickup' && tct.taskConcept!=='customer_return', {type:tct&&tct.type,tc:tct&&tct.taskConcept});

    console.log('\n── stderr del server (debe estar limpio de errores no esperados) ──');
    const serrLines = serr.split('\n').filter(l=>/error|throw|ReferenceError|TypeError|undefined is not/i.test(l) && !/console\.error/i.test(l));
    ok('sin errores inesperados en stderr', serrLines.length===0, serrLines.slice(0,6));

  } catch(e){
    ok('excepción no controlada', false, e.message);
    if (serr) console.log('STDERR:\n'+serr.split('\n').slice(-20).join('\n'));
  } finally {
    const pass=R.filter(x=>x.pass).length, tot=R.length;
    console.log(`\n${pass===tot?'✅':'❌'} ${pass}/${tot} asserciones`);
    cleanup();
    process.exit(pass===tot?0:1);
  }
})();
