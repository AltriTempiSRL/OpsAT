// _test_v188.mjs — Valida los 2 arreglos v188 (tarea #0187). Cero datos live, sin Odoo.
//  B · Siembra de fecha por Ops: gate H2-1 permite dueDate null→valor en tareas SDV,
//      pero sigue bloqueando pisar una fecha ya existente (promesa de Ventas) y demás campos.
//  A · Foto de guía: POST /fotos-guia funciona sobre una tarea existente (antes el modal
//      de edición nunca subía; esto valida el endpoint destino que ahora sí se invoca).
// Uso (desde la raíz): node tests/_test_v188.mjs
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

const PORT = 3299;
const BASE = `http://127.0.0.1:${PORT}`;
const ROOT = process.cwd();
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'testv188-'));

// PNG 1x1 válido (data URL) para el endpoint de fotos
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

// ── Fixtures: tareas pre-escritas en el DATA_DIR temporal ───────────────────
const now = new Date().toISOString();
const baseTask = (id, extra) => ({
  id, seq:null, parentId:null, title:'Tarea '+id, type:'general', description:'',
  priority:'medium', status:'pending', assignedTo:null, managerId:null, managerName:null,
  executors:[], assignees:[], location:'', dueDate:null, actionNote:'', items:[],
  evidence:[], fotos_guia:[], statusHistory:[{status:'pending',date:now,by:'test'}],
  createdBy:'test', createdAt:now, updatedAt:now, ...extra
});
const FIX = [
  // Solicitud especial: SDV vinculada, SIN fecha (campo opcional en blanco) → dueDate null
  baseTask('wt_seed',   { odooRef:'S_SEED',  sdvId:'sdv_s', sdvFolio:'SD-T-SEED', dueDate:null,
                          client:'CLIENTE UNO', deliveryAddress:'DIR UNO' }),
  // SDV con fecha ya puesta por Ventas → NO se debe poder pisar
  baseTask('wt_hasdue', { odooRef:'S_HAS',   sdvId:'sdv_h', sdvFolio:'SD-T-HAS',  dueDate:'2026-07-10T00:00:00' }),
  // Tarea sin SDV (control): fecha libremente editable
  baseTask('wt_nosdv',  { odooRef:'S_NOSDV' })
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
  const srv = spawn('node',['proxy.js'],{ cwd:ROOT, env:{...process.env, DATA_DIR, PORT:String(PORT) } });
  let serr=''; srv.stderr.on('data',d=>serr+=d.toString());
  const cleanup=()=>{ try{srv.kill('SIGKILL');}catch{} try{fs.rmSync(DATA_DIR,{recursive:true,force:true});}catch{} };
  try{
    await waitReady();
    SECRET=fs.readFileSync(path.join(DATA_DIR,'.jwt-secret'),'utf8').trim();
    ADMIN=mint('au_gsanchez','admin','Admin QA');

    console.log('\n── B · Siembra de fecha por Ops (dueDate null→valor en tarea SDV) ──');
    const s1=await api('PATCH','/api/wwp/tasks/wt_seed',ADMIN,{ dueDate:'2026-07-20', by:'Admin QA' });
    ok('sembrar fecha en SDV sin fecha → 200 (antes: 422 bloqueado)', s1.status===200, {status:s1.status,err:s1.j&&s1.j.error});
    const ts1=await getTask('wt_seed');
    ok('la fecha sembrada persiste en la tarea', ts1 && (ts1.dueDate||'').slice(0,10)==='2026-07-20', {got:ts1&&ts1.dueDate});

    const s2=await api('PATCH','/api/wwp/tasks/wt_seed',ADMIN,{ dueDate:'2026-07-25', by:'Admin QA' });
    ok('pisar la fecha ya sembrada → 422 (no se puede sobreescribir)', s2.status===422 && (s2.j&&s2.j.campos||[]).includes('dueDate'), {status:s2.status,campos:s2.j&&s2.j.campos});

    const s3=await api('PATCH','/api/wwp/tasks/wt_seed',ADMIN,{ dueDate:'2026-07-20', by:'Admin QA' });
    ok('reenviar la MISMA fecha (echo) → 200, sin cambio', s3.status===200, {status:s3.status});

    const s4=await api('PATCH','/api/wwp/tasks/wt_seed',ADMIN,{ client:'OTRO CLIENTE', by:'Admin QA' });
    ok('otros campos de la SDV siguen bloqueados (client) → 422', s4.status===422 && (s4.j&&s4.j.campos||[]).includes('client'), {status:s4.status,campos:s4.j&&s4.j.campos});

    console.log('\n── B · Fecha ya puesta por Ventas: intocable ──');
    const h1=await api('PATCH','/api/wwp/tasks/wt_hasdue',ADMIN,{ dueDate:'2026-07-15', by:'Admin QA' });
    ok('cambiar fecha existente (promesa de Ventas) → 422', h1.status===422 && (h1.j&&h1.j.campos||[]).includes('dueDate'), {status:h1.status,campos:h1.j&&h1.j.campos});
    const h2=await api('PATCH','/api/wwp/tasks/wt_hasdue',ADMIN,{ dueDate:'2026-07-10', by:'Admin QA' });
    ok('echo de la MISMA fecha existente → 200', h2.status===200, {status:h2.status});

    console.log('\n── Control · tarea sin SDV: fecha libremente editable ──');
    const c1=await api('PATCH','/api/wwp/tasks/wt_nosdv',ADMIN,{ dueDate:'2026-08-01', by:'Admin QA' });
    const tc1=await getTask('wt_nosdv');
    ok('tarea sin sdvId acepta fecha (sin gate)', c1.status===200 && tc1 && (tc1.dueDate||'').slice(0,10)==='2026-08-01', {status:c1.status,got:tc1&&tc1.dueDate});

    console.log('\n── A · Foto de guía sobre tarea existente (endpoint que el modal ahora sí invoca) ──');
    const f1=await api('POST','/api/wwp/tasks/wt_seed/fotos-guia',ADMIN,{ fotos:[{data:PNG,ext:'png',instruccion:'Recoger butaca dañada'}], by:'Admin QA' });
    ok('POST /fotos-guia en tarea SDV → 200 ok', f1.status===200 && f1.j&&f1.j.ok, {status:f1.status,err:f1.j&&f1.j.error});
    const tf1=await getTask('wt_seed');
    ok('la foto guía queda en la tarea (fotos_guia=1, con instrucción)', tf1 && (tf1.fotos_guia||[]).length===1 && tf1.fotos_guia[0].instruccion==='Recoger butaca dañada', {n:tf1&&(tf1.fotos_guia||[]).length, instr:tf1&&tf1.fotos_guia&&tf1.fotos_guia[0]&&tf1.fotos_guia[0].instruccion});

    console.log('\n── Front ──');
    const fh=await fetch(BASE+'/historial.html'); const ft=await fh.text();
    ok('historial.html 200 + build v188', fh.status===200 && ft.includes("APP_BUILD = 'v188'"), {status:fh.status});
    ok('el hint de fecha sembrable está presente (mf-due-hint)', ft.includes('id="mf-due-hint"'), {});
    ok('el uploader de fotos ya NO gatea con !_editingTask', !ft.includes('!_editingTask && _newTaskFotos.length'), {});

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
