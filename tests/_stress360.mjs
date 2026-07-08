// _stress360.mjs — 1,000+ pruebas locales de la integración 360 SDV↔WWP (Fase 1)
// Servidor LOCAL AISLADO (DATA_DIR temporal). No toca data-local ni producción.
// Uso: node _stress360.mjs
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

const PORT = 3199;
const BASE = `http://127.0.0.1:${PORT}`;
const ROOT = process.cwd();
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'stress360-'));
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const PHOTO = { data: PNG, ext: 'png' };

// ── Fixtures (Ron) o fallback sintético ──────────────────────────────────────
let FX;
try {
  FX = JSON.parse(fs.readFileSync(path.join(ROOT, '_odoo_fixtures.json'), 'utf8'));
  console.log(`[fix] _odoo_fixtures.json: ${ (FX.despachos_cliente||[]).length } despachos, ${ (FX.devoluciones||[]).length } devoluciones`);
} catch {
  console.log('[fix] _odoo_fixtures.json no encontrado → fallback sintético');
  const names = ['Müller & Cía', "O'Brien Hogar", 'Ñañez Decoración', 'José Martí #12', 'Comercial "El Sol"', 'Pérez-Gómez SRL'];
  const prods = ['Sofá 3 plazas','Mesa comedor roble','Lámpara LED','Silla ergonómica','Alfombra 2x3','Espejo decorativo','Cómoda 4 gavetas','Juego de copas'];
  FX = { despachos_cliente: [], traslados_internos: [{origen:'ALVEN/Stock/AA1',destino:'ALVEN/Stock/NAVE2'}], devoluciones: [] };
  for (let i=0;i<60;i++){
    const n = 1 + (i%12);
    FX.despachos_cliente.push({
      orderRef:`S${(9000+i)}`, clientName:names[i%names.length], city:'Santo Domingo', address:`Calle ${i} #${i*3}`, phone:`809-555-${1000+i}`,
      lines: Array.from({length:n}, (_,k)=>({product_name:prods[(i+k)%prods.length], sku:`SKU${i}${k}`, quantity:(k%3===0?1:(k*7)%250+1)}))
    });
  }
}
const DESP = (FX.despachos_cliente && FX.despachos_cliente.length) ? FX.despachos_cliente : [{orderRef:'S0001',clientName:'Fallback',city:'SD',address:'X',phone:'1',lines:[{product_name:'P',sku:'S',quantity:1}]}];
const rnd = a => a[Math.floor(Math.random()*a.length)];

// ── JWT forjado (server aislado) ─────────────────────────────────────────────
const b64u = b => Buffer.from(b).toString('base64url');
let SECRET = null;
function mint(userId, role, name) {
  const h = b64u(JSON.stringify({alg:'HS256',typ:'JWT'}));
  const now = Math.floor(Date.now()/1000);
  const p = b64u(JSON.stringify({ userId, role, name, iat:now, exp:now+86400 }));
  const s = crypto.createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url');
  return `${h}.${p}.${s}`;
}
let TOK = {};

// ── HTTP helper ──────────────────────────────────────────────────────────────
const DIAG = [];
// Cada request simula venir de una IP distinta (como en prod: muchos dispositivos),
// para no chocar con el rate-limiter por-IP y medir la LÓGICA, no el throttling.
let _ipc = 0;
function nextIp(){ const n = ++_ipc; return `10.${(n>>16)&255}.${(n>>8)&255}.${n&255}`; }
async function api(method, p, token, body) {
  const r = await fetch(BASE + p, {
    method,
    headers: { 'Content-Type':'application/json', 'X-Forwarded-For':nextIp(), ...(token?{Authorization:'Bearer '+token}:{}) },
    body: body!==undefined ? JSON.stringify(body) : undefined
  });
  let raw=''; try { raw = await r.text(); } catch {}
  let j=null; try { j = JSON.parse(raw); } catch {}
  return { status:r.status, j, raw };
}
function sdvPayload(fx){
  return {
    tipoSolicitud:'despacho_cliente', odooOrderRef: fx.orderRef||'',
    clienteNombre: fx.clientName, ciudadEntrega: fx.city||'', direccionEntrega: fx.address||'',
    receptorNombre: fx.clientName, receptorContacto: fx.phone||'',
    articulosOdoo: (fx.lines||[]).map(l=>({product_name:l.product_name, sku:l.sku||'', quantity:l.quantity||1})),
    observaciones:'stress360'
  };
}

// ── Resultados ───────────────────────────────────────────────────────────────
const R = {};
function bk(b){ if(!R[b]) R[b]={pass:0,fail:0,samples:[]}; return R[b]; }
function check(b, cond, detail){ const x=bk(b); if(cond) x.pass++; else { x.fail++; if(x.samples.length<4) x.samples.push(detail); } return cond; }

// ── Helpers de flujo ─────────────────────────────────────────────────────────
async function createSdv(token, fx){
  const r=await api('POST','/api/sdv',token,sdvPayload(fx));
  if(!(r.j&&r.j.solicitud) && DIAG.length<10) DIAG.push({op:'createSdv', status:r.status, err:r.j&&r.j.error, raw:(r.raw||'').slice(0,160)});
  return r.j&&r.j.solicitud?r.j.solicitud:null;
}
async function createDispatchTask(sdvId){
  const r=await api('POST','/api/wwp/tasks',TOK.admin,{ title:'Despacho stress', type:'dispatch_order', sdvId, odooRef:'', managerId:'au_gsanchez', createdBy:'au_gsanchez', by:'Admin QA' });
  if(!(r.j&&r.j.task) && DIAG.length<10) DIAG.push({op:'createTask', status:r.status, err:r.j&&r.j.error, raw:(r.raw||'').slice(0,160)});
  return r.j&&r.j.task?r.j.task:null;
}
async function driveToValidated(taskId){
  await api('PATCH','/api/wwp/tasks/'+taskId,TOK.admin,{status:'in_progress',by:'Admin QA'});
  for (const cat of ['recepcion','vehiculo','entrega']) await api('POST',`/api/wwp/tasks/${taskId}/fotos-${cat}`,TOK.admin,{fotos:[PHOTO],by:'Admin QA'});
  const c=await api('PATCH','/api/wwp/tasks/'+taskId,TOK.admin,{status:'completed',by:'Admin QA'});
  const v=await api('PATCH','/api/wwp/tasks/'+taskId,TOK.admin,{status:'validated',by:'Admin QA'});
  return {c,v};
}
async function getSdv(token,id){ const r=await api('GET','/api/sdv/'+id,token); return r.j&&r.j.solicitud?r.j.solicitud:null; }
async function notifCount(token, type){ const r=await api('GET','/api/wwp/notifications',token); const list=(r.j&&(r.j.notifications||r.j.list||r.j))||[]; const arr=Array.isArray(list)?list:[]; return type?arr.filter(n=>n.type===type).length:arr.length; }

// ── Buckets ──────────────────────────────────────────────────────────────────
async function bucketA(n){ // Link integrity + idempotencia
  for(let i=0;i<n;i++){
    const sdv=await createSdv(TOK.v1, rnd(DESP));
    if(!check('A-link', !!sdv, {step:'createSdv null'})) continue;
    const t1=await createDispatchTask(sdv.id);
    if(!check('A-link', t1&&t1.sdvId===sdv.id, {step:'task.sdvId', got:t1&&t1.sdvId})) continue;
    const s1=await getSdv(TOK.admin,sdv.id);
    check('A-link', s1 && s1.wwpTaskId===t1.id, {step:'reverse-link wwpTaskId', got:s1&&s1.wwpTaskId, exp:t1.id});
    check('A-link', s1 && (s1.wwpTareas||[]).some(w=>w.taskId===t1.id), {step:'wwpTareas push'});
    // idempotencia: 2da tarea mismo sdvId
    const t2=await createDispatchTask(sdv.id);
    const s2=await getSdv(TOK.admin,sdv.id);
    check('A-idem', s2 && s2.wwpTaskId===t1.id, {step:'wwpTaskId no se sobreescribe', got:s2&&s2.wwpTaskId, exp:t1.id});
    check('A-idem', s2 && (s2.wwpTareas||[]).length>=2, {step:'wwpTareas crece', got:s2&&(s2.wwpTareas||[]).length});
  }
}
async function bucketB(n){ // Despachada trigger + negativos
  for(let i=0;i<n;i++){ try {
    const sdv=await createSdv(TOK.v1, rnd(DESP));
    if(!sdv) { check('B-desp', false, {step:'createSdv'}); continue; }
    const t=await createDispatchTask(sdv.id);
    if(!t) { check('B-desp', false, {step:'createDispatchTask null'}); continue; }
    const {c,v}=await driveToValidated(t.id);
    check('B-desp', c.status===200, {step:'completed', status:c.status, err:c.j&&c.j.error});
    check('B-desp', v.status===200, {step:'validated', status:v.status, err:v.j&&v.j.error});
    const s=await getSdv(TOK.admin,sdv.id);
    check('B-desp', s && s.estado==='despachada', {step:'SDV despachada', got:s&&s.estado});
    check('B-desp', s && !!s.fechaDespacho, {step:'fechaDespacho'});
    check('B-notif', (await notifCount(TOK.v1,'task_completed'))>0, {step:'seller task_completed'});
  } catch(e){ check('B-desp',false,{step:'throw',err:e.message}); } }
  // negativo: tarea SIN sdvId validada no toca ninguna SDV
  try {
    const before=((await api('GET','/api/sdv',TOK.admin)).j.solicitudes||[]).length;
    const rt=await api('POST','/api/wwp/tasks',TOK.admin,{title:'noSdv',type:'dispatch_order',odooRef:'',managerId:'au_gsanchez',createdBy:'au_gsanchez'});
    if(rt.j&&rt.j.task) await driveToValidated(rt.j.task.id);
    const after=((await api('GET','/api/sdv',TOK.admin)).j.solicitudes||[]).length;
    check('B-noreg', !!(rt.j&&rt.j.task) && before===after, {step:'tarea sin sdvId no crea/toca SDV', before, after, taskOk:!!(rt.j&&rt.j.task)});
  } catch(e){ check('B-noreg', false, {step:'throw', err:e.message}); }
}
async function bucketD(n){ // Rechazo + loop corrección
  for(let i=0;i<n;i++){
    const sdv=await createSdv(TOK.v1, rnd(DESP));
    if(!sdv){ check('D-rech',false,{step:'createSdv'}); continue; }
    const rj=await api('PATCH','/api/sdv/'+sdv.id,TOK.admin,{estado:'rechazada',razon:'faltan datos'});
    check('D-rech', rj.status===200 && rj.j.solicitud.estado==='rechazada', {step:'rechazada', status:rj.status, got:rj.j&&rj.j.solicitud&&rj.j.solicitud.estado});
    check('D-rech', (await notifCount(TOK.v1,'task_rejected'))>0, {step:'seller task_rejected'});
    // vendedora corrige (edita) → vuelve a pendiente
    const ed=await api('PATCH','/api/sdv/'+sdv.id,TOK.v1,{observaciones:'corregido '+i});
    check('D-loop', ed.status===200 && ed.j.solicitud.estado==='pendiente_revision', {step:'reenvío→pendiente', status:ed.status, got:ed.j&&ed.j.solicitud&&ed.j.solicitud.estado});
    // vendedora NO puede editar en_proceso
    await api('PATCH','/api/sdv/'+sdv.id,TOK.admin,{estado:'en_proceso'});
    const blocked=await api('PATCH','/api/sdv/'+sdv.id,TOK.v1,{observaciones:'no debería'});
    check('D-block', blocked.status===400, {step:'ventas no edita en_proceso', status:blocked.status});
    check('D-notif', (await notifCount(TOK.v1,'status_changed'))>0, {step:'seller status_changed (aprobada)'});
  }
}
async function bucketE(n){ // RBAC
  for(let i=0;i<n;i++){
    const sdv=await createSdv(TOK.v1, rnd(DESP));
    if(!sdv){ check('E-rbac',false,{step:'createSdv'}); continue; }
    const otra=await api('GET','/api/sdv/'+sdv.id,TOK.v2);   // v2 no es dueña
    check('E-rbac', otra.status===403, {step:'ventas ajena → 403', status:otra.status});
    const lst=await api('GET','/api/sdv',TOK.v2);
    check('E-rbac', lst.j.solicitudes.every(s=>s.creadoPor!=='au_qa_v1'), {step:'ventas solo ve suyas'});
    const noTask=await api('POST','/api/wwp/tasks',TOK.v1,{title:'x',type:'general'});
    check('E-rbac', noTask.status===403, {step:'ventas no crea tarea → 403', status:noTask.status});
    const adminSees=await api('GET','/api/sdv/'+sdv.id,TOK.admin);
    check('E-rbac', adminSees.status===200, {step:'admin ve todas', status:adminSees.status});
  }
}
async function bucketF(batches, conc){ // Concurrencia / race
  // F1: N concurrentes con sdvId DISTINTO → ninguna SDV pierde su wwpTaskId, ninguna tarea se pierde
  for(let b=0;b<batches;b++){
    const sdvs=[]; for(let k=0;k<conc;k++){ const s=await createSdv(TOK.v1, rnd(DESP)); if(s) sdvs.push(s); }
    const res=await Promise.all(sdvs.map(s=>createDispatchTask(s.id)));
    check('F-race', res.every(t=>t&&t.id), {step:'F1 todas las tareas creadas', got:res.filter(Boolean).length, exp:sdvs.length});
    let linked=0; for(const s of sdvs){ const ss=await getSdv(TOK.admin,s.id); if(ss&&ss.wwpTaskId) linked++; }
    check('F-race', linked===sdvs.length, {step:'F1 todas las SDV enlazadas (no lost write)', got:linked, exp:sdvs.length});
    // verificar que todas las tareas persisten en el store
    const all=(await api('GET','/api/wwp/tasks',TOK.admin)).j;
    const ids=new Set((Array.isArray(all)?all:[]).map(t=>t.id));
    check('F-race', res.every(t=>t&&ids.has(t.id)), {step:'F1 todas las tareas persistidas en store'});
  }
  // F2: N concurrentes MISMO sdvId → wwpTaskId único, wwpTareas con todas
  for(let b=0;b<batches;b++){
    const s=await createSdv(TOK.v1, rnd(DESP)); if(!s){ check('F-race2',false,{step:'createSdv'}); continue; }
    const res=await Promise.all(Array.from({length:conc},()=>createDispatchTask(s.id)));
    const ss=await getSdv(TOK.admin,s.id);
    check('F-race2', res.every(t=>t&&t.id), {step:'F2 todas creadas'});
    check('F-race2', ss && res.some(t=>t&&t.id===ss.wwpTaskId), {step:'F2 wwpTaskId apunta a una de ellas'});
    check('F-race2', ss && (ss.wwpTareas||[]).length===res.filter(Boolean).length, {step:'F2 wwpTareas registra todas (no lost)', got:ss&&(ss.wwpTareas||[]).length, exp:res.filter(Boolean).length});
  }
}
async function bucketG(n){ // No-regresión ciclo WWP normal sin SDV
  for(let i=0;i<n;i++){
    const before=(await api('GET','/api/sdv',TOK.admin)).j.solicitudes.length;
    const t=await api('POST','/api/wwp/tasks',TOK.admin,{title:'normal',type:'general',managerId:'au_gsanchez',createdBy:'au_gsanchez'});
    check('G-noreg', t.j.task && t.j.task.sdvId===null, {step:'tarea normal sdvId null', got:t.j.task&&t.j.task.sdvId});
    const after=(await api('GET','/api/sdv',TOK.admin)).j.solicitudes.length;
    check('G-noreg', before===after, {step:'tarea normal no toca SDV', before, after});
  }
}
async function bucketH(){ // Sonda: estado basura (deuda conocida Fase 3)
  const sdv=await createSdv(TOK.v1, rnd(DESP));
  const r=await api('PATCH','/api/sdv/'+sdv.id,TOK.admin,{estado:'estado_basura_xyz'});
  bk('H-probe').note = `PATCH estado='estado_basura_xyz' (ops) → HTTP ${r.status}, estado guardado='${r.j&&r.j.solicitud&&r.j.solicitud.estado}'`;
}

// ── Arranque del server aislado ──────────────────────────────────────────────
function waitReady(ms=20000){
  const t0=Date.now();
  return new Promise((resolve,reject)=>{
    (async function poll(){
      try { const r=await fetch(BASE+'/api/app-version'); if(r.ok){ return resolve(true); } } catch {}
      if(Date.now()-t0>ms) return reject(new Error('server no levantó'));
      setTimeout(poll,300);
    })();
  });
}

(async ()=>{
  const srv = spawn('node',['proxy.js'],{ cwd:ROOT, env:{...process.env, DATA_DIR, PORT:String(PORT), NODE_ENV:'test'} });
  let serr=''; srv.stderr.on('data',d=>{ serr+=d.toString(); });
  let exitInfo=null; srv.on('exit',(code,sig)=>{ exitInfo={code,sig,at:new Date().toISOString()}; });
  async function alive(){ try{ const r=await fetch(BASE+'/api/app-version'); return r.ok; }catch{ return false; } }
  const cleanup=()=>{ try{ srv.kill('SIGKILL'); }catch{} try{ fs.rmSync(DATA_DIR,{recursive:true,force:true}); }catch{} };
  try {
    await waitReady();
    SECRET = fs.readFileSync(path.join(DATA_DIR,'.jwt-secret'),'utf8').trim();
    TOK = {
      admin: mint('au_gsanchez','admin','Admin QA'),
      mgr:   mint('au_fcandelario','manager','Mgr QA'),
      v1:    mint('au_qa_v1','ventas','Vendedora 1'),
      v2:    mint('au_qa_v2','ventas','Vendedora 2'),
    };
    const T0=Date.now();
    const run=async(label,fn)=>{ console.log('[run] '+label); try{ await fn(); }catch(e){ console.log('   bucket throw ('+label+'):', e.message); } if(!(await alive())) console.log('   ⚠️ server NO responde tras '+label); };
    // Concurrencia PRIMERO: estado limpio, race real en la capa de archivos, sin contaminar con O(n²)
    await run('F-concurrencia (40×8) [estado limpio]', ()=>bucketF(40,8));
    await run('A-link/idem (150)', ()=>bucketA(150));
    await run('B-despachada (70)', ()=>bucketB(70));
    await run('D-rechazo/loop (60)', ()=>bucketD(60));
    await run('E-RBAC (60)', ()=>bucketE(60));
    await run('G-no-regresión (60)', ()=>bucketG(60));
    await run('H-sonda estado', ()=>bucketH());
    const secs=((Date.now()-T0)/1000).toFixed(0);

    // ── Reporte ──
    let totP=0, totF=0;
    console.log('\n================ RESULTADOS STRESS 360 ================');
    for(const [b,x] of Object.entries(R)){
      if(x.pass===undefined) continue;
      totP+=x.pass||0; totF+=x.fail||0;
      const flag = x.fail>0 ? ' ❌' : ' ✓';
      console.log(`${b.padEnd(10)} pass=${x.pass||0}  fail=${x.fail||0}${flag}`);
      (x.samples||[]).forEach(s=>console.log('   ↳ FALLO:', JSON.stringify(s)));
    }
    if(R['H-probe'] && R['H-probe'].note) console.log('SONDA  ', R['H-probe'].note);
    if(DIAG.length){ console.log('--- DIAG (primeros fallos de creación) ---'); DIAG.forEach(d=>console.log('  ', JSON.stringify(d))); }
    console.log('-------------------------------------------------------');
    console.log(`TOTAL aserciones: ${totP+totF}  ·  PASS: ${totP}  ·  FAIL: ${totF}  ·  ${secs}s`);
    console.log(totF===0 ? 'VEREDICTO HARNESS: VERDE' : 'VEREDICTO HARNESS: HAY FALLOS — revisar arriba');
    if(exitInfo){ console.log(`⚠️ EL SERVER SALIÓ durante la corrida: code=${exitInfo.code} sig=${exitInfo.sig} @ ${exitInfo.at}`); console.log('STDERR tail (1200):', serr.slice(-1200)); }
    else console.log('Server siguió vivo toda la corrida ✓');
    console.log('=======================================================');
  } catch(e) {
    console.error('ERROR HARNESS:', e.message);
    if(serr) console.error('STDERR server (últimos 800):', serr.slice(-800));
  } finally {
    cleanup();
  }
})();
