// _test_v192.mjs — Integración Fase A: reprogramar despacho SDV con motivo. Sin Odoo.
//  · POST /api/wwp/tasks/:id/reprogramar escribe la fecha en la SDV + reprogramaciones[]
//  · propaga dueDate + nota en statusHistory a tareas ACTIVAS del vínculo (no a las finales)
//  · GET /api/sdv/:id devuelve reprogramaciones; audit task_duedate_changed; 400s de validación
//  · front: botón/modal/submit + build v192 + espejo de notificación
// Uso (desde la raíz): node tests/_test_v192.mjs
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

const PORT = 3295;
const BASE = `http://127.0.0.1:${PORT}`;
const ROOT = process.cwd();
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'testv192-'));

const now = new Date().toISOString();
// SDV dueña de la fecha
const SDV = [{ id:'sdv_x', folio:'SD-T-X', fechaSolicitudDeseada:'2026-07-20',
  creadoPor:'au_seller', creadoNombre:'Vendedora QA', estado:'en_proceso', tipoSolicitud:'despacho', articulosOdoo:[] }];
fs.writeFileSync(path.join(DATA_DIR,'sdv-solicitudes.json'), JSON.stringify(SDV,null,2));
const baseTask = (id, extra) => ({
  id, seq:null, parentId:null, title:'Tarea '+id, type:'general', description:'', priority:'medium',
  status:'in_progress', assignedTo:null, managerId:'au_gsanchez', executors:[], assignees:[],
  dueDate:'2026-07-20', items:[], evidence:[], fotos_guia:[],
  statusHistory:[{status:'in_progress',date:now,by:'test'}], createdBy:'test', createdAt:now, updatedAt:now, ...extra });
const TASKS = [
  baseTask('wt_m', { type:'packaging', sdvId:'sdv_x', sdvFolio:'SD-T-X' }),
  baseTask('wt_d', { type:'dispatch_order', sdvId:'sdv_x', parentId:'wt_m', subIndex:2, status:'assigned' }),
  baseTask('wt_done', { type:'dispatch_order', sdvId:'sdv_x', parentId:'wt_m', subIndex:3, status:'completed' }),
  baseTask('wt_nosdv', {}),
];
fs.writeFileSync(path.join(DATA_DIR,'wwp-tasks.json'), JSON.stringify(TASKS,null,2));

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
function waitReady(ms=20000){ const t0=Date.now(); return new Promise((res,rej)=>{ (async function poll(){ try{const r=await fetch(BASE+'/api/app-version'); if(r.ok)return res(true);}catch{} if(Date.now()-t0>ms)return rej(new Error('server no levantó')); setTimeout(poll,300); })(); }); }

(async ()=>{
  const srv = spawn('node',['proxy.js'],{ cwd:ROOT, env:{...process.env, DATA_DIR, PORT:String(PORT) } });
  let serr=''; srv.stderr.on('data',d=>serr+=d.toString());
  const cleanup=()=>{ try{srv.kill('SIGKILL');}catch{} try{fs.rmSync(DATA_DIR,{recursive:true,force:true});}catch{} };
  try{
    await waitReady();
    SECRET=fs.readFileSync(path.join(DATA_DIR,'.jwt-secret'),'utf8').trim();
    ADMIN=mint('au_gsanchez','admin','Admin QA');

    console.log('\n── Reprogramar (happy path) ──');
    const rp=await api('POST','/api/wwp/tasks/wt_m/reprogramar',ADMIN,{ nuevaFecha:'2026-07-25', motivo:'transporte', by:'Admin QA', byUserId:'au_gsanchez' });
    ok('POST reprogramar → 200 + reprogramaciones=1', rp.status===200 && rp.j&&rp.j.reprogramaciones===1, {status:rp.status,j:rp.j});
    ok('respuesta trae la tarea madre con la nueva fecha', rp.j&&rp.j.task && (rp.j.task.dueDate||'').slice(0,10)==='2026-07-25', {due:rp.j&&rp.j.task&&rp.j.task.dueDate});

    console.log('\n── Propagación (madre + hija activa sí; final no) ──');
    const tm=await getTask('wt_m'), td=await getTask('wt_d'), tdone=await getTask('wt_done');
    ok('madre wt_m dueDate=2026-07-25', tm && (tm.dueDate||'').slice(0,10)==='2026-07-25', {due:tm&&tm.dueDate});
    ok('hija activa wt_d dueDate=2026-07-25', td && (td.dueDate||'').slice(0,10)==='2026-07-25', {due:td&&td.dueDate});
    ok('tarea completed NO se toca (sigue 2026-07-20)', tdone && (tdone.dueDate||'').slice(0,10)==='2026-07-20', {due:tdone&&tdone.dueDate});
    ok('nota "Reprogramada" en el timeline de la madre', tm && (tm.statusHistory||[]).some(h=>/Reprogramada: 2026-07-20 → 2026-07-25 · Transporte/.test(h.note||'')), {last:tm&&tm.statusHistory&&tm.statusHistory.slice(-1)});

    console.log('\n── SDV dueña de la fecha + reprogramaciones ──');
    const gs=await api('GET','/api/sdv/sdv_x',ADMIN);
    const sol=(gs.j&&(gs.j.solicitud||gs.j))||{};
    ok('SDV fechaSolicitudDeseada=2026-07-25', (sol.fechaSolicitudDeseada||'').slice(0,10)==='2026-07-25', {f:sol.fechaSolicitudDeseada});
    ok('SDV reprogramaciones[0] con motivo/quién/de-a', Array.isArray(sol.reprogramaciones) && sol.reprogramaciones[0] && sol.reprogramaciones[0].motivoLabel==='Transporte / ruta llena' && sol.reprogramaciones[0].fechaAnterior==='2026-07-20', {rep:sol.reprogramaciones});

    console.log('\n── Auditoría ──');
    let audit=[]; try{ audit=JSON.parse(fs.readFileSync(path.join(DATA_DIR,'wwp-audit.json'),'utf8')); }catch{}
    ok('audit task_duedate_changed con motivo', audit.some(a=>a.event==='task_duedate_changed' && a.motivo==='transporte' && a.fechaNueva==='2026-07-25'), {n:audit.filter(a=>a.event==='task_duedate_changed').length});

    console.log('\n── Validaciones 400 ──');
    const v1=await api('POST','/api/wwp/tasks/wt_m/reprogramar',ADMIN,{ nuevaFecha:'2026-07-28' });
    ok('sin motivo → 400', v1.status===400, {status:v1.status});
    const v2=await api('POST','/api/wwp/tasks/wt_m/reprogramar',ADMIN,{ nuevaFecha:'28-07-2026', motivo:'transporte' });
    ok('fecha mal formada → 400', v2.status===400, {status:v2.status});
    const v3=await api('POST','/api/wwp/tasks/wt_m/reprogramar',ADMIN,{ nuevaFecha:'2026-07-28', motivo:'otro' });
    ok("motivo 'otro' sin texto → 400", v3.status===400, {status:v3.status});
    const v4=await api('POST','/api/wwp/tasks/wt_m/reprogramar',ADMIN,{ nuevaFecha:'2026-07-25', motivo:'transporte' });
    ok('misma fecha → 400 (no cambió)', v4.status===400, {status:v4.status});
    const v5=await api('POST','/api/wwp/tasks/wt_nosdv/reprogramar',ADMIN,{ nuevaFecha:'2026-07-28', motivo:'transporte' });
    ok('tarea sin sdvId → 400', v5.status===400, {status:v5.status});

    console.log('\n── 2ª reprogramación con "otro" + texto ──');
    const rp2=await api('POST','/api/wwp/tasks/wt_m/reprogramar',ADMIN,{ nuevaFecha:'2026-07-30', motivo:'otro', motivoTexto:'Cliente pidió esperar contenedor', by:'Admin QA', byUserId:'au_gsanchez' });
    ok('2ª reprogramación otro+texto → 200 + reprogramaciones=2', rp2.status===200 && rp2.j&&rp2.j.reprogramaciones===2, {status:rp2.status,j:rp2.j});

    console.log('\n── Front ──');
    const fh=await fetch(BASE+'/historial.html'); const ft=await fh.text();
    ok('historial.html 200 + build v192', fh.status===200 && ft.includes("APP_BUILD = 'v192'"), {status:fh.status});
    ok('submitReprogramar + modal presentes', ft.includes('function submitReprogramar') && ft.includes('reprogramar-modal'), {});
    ok('espejo _NOTIF_META sdv_seller_reprogramada', ft.includes('sdv_seller_reprogramada:{cat:\'sdv\',urg:\'alert\'}'), {});
    const sw=await fetch(BASE+'/sw.js'); const swt=await sw.text();
    ok('sw.js NOTIF_URGENCY sdv_seller_reprogramada', sw.status===200 && swt.includes('sdv_seller_reprogramada'), {status:sw.status});

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
