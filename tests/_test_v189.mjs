// _test_v189.mjs — Valida el arreglo v189 (ciclo de cadena empaque→despacho). Sin Odoo.
//  · Gates anti-deadlock INTACTOS: completar madre-empaque con despacho abierto = 200 (exención),
//    validar la madre con despacho abierto = 409, iniciar despacho tras empaque completo = 200.
//  · El path de notificaciones (const→let + override handoff) no crashea (PATCH 200, stderr limpio).
//  · Front sirve v189 con el helper chainDisplayStatus y la etiqueta de handoff.
// Uso (desde la raíz): node tests/_test_v189.mjs
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

const PORT = 3297;
const BASE = `http://127.0.0.1:${PORT}`;
const ROOT = process.cwd();
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'testv189-'));

const now = new Date().toISOString();
const baseTask = (id, extra) => ({
  id, seq:null, parentId:null, title:'Tarea '+id, type:'general', description:'',
  priority:'medium', status:'pending', assignedTo:null, managerId:null, managerName:null,
  executors:[], assignees:[], location:'', dueDate:null, actionNote:'', items:[],
  evidence:[], fotos_guia:[], statusHistory:[{status:'pending',date:now,by:'test'}],
  createdBy:'test', createdAt:now, updatedAt:now, ...extra
});
const CONF_ITEM = { item_id:'oi_1', odoo_product_id:1, sku:'X', barcode:'X', product_name:'P',
  quantity:1, units:1, selected:true, confirmado:true, condition:'good', evidence_images:['x'], isKit:false };

const FIX = [
  // Escenario A — handoff: madre packaging COMPLETED con despacho hijo ABIERTO
  baseTask('wt_pack',  { type:'packaging', status:'completed', seq:10,
                         statusHistory:[{status:'completed',date:now,by:'test'}] }),
  baseTask('wt_disp',  { type:'dispatch_order', status:'assigned', parentId:'wt_pack', subIndex:2, dependsOnPrev:true }),
  // Escenario B — completar la madre-empaque con despacho abierto (exención + notif handoff)
  baseTask('wt_pack2', { type:'packaging', status:'in_progress', seq:11, managerId:'au_target',
                         items:[{...CONF_ITEM}], statusHistory:[{status:'in_progress',date:now,by:'test'}] }),
  baseTask('wt_disp2', { type:'dispatch_order', status:'assigned', parentId:'wt_pack2', subIndex:2, dependsOnPrev:true }),
];
fs.writeFileSync(path.join(DATA_DIR,'wwp-tasks.json'), JSON.stringify(FIX,null,2));

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

    console.log('\n── Gates anti-deadlock INTACTOS (no deben cambiar con el fix) ──');
    const v=await api('PATCH','/api/wwp/tasks/wt_pack',ADMIN,{ status:'validated', by:'Admin QA' });
    ok('validar madre-empaque con despacho abierto → 409 (gate estricto)', v.status===409, {status:v.status,err:v.j&&v.j.error});

    const s=await api('PATCH','/api/wwp/tasks/wt_disp',ADMIN,{ status:'in_progress', by:'Admin QA' });
    ok('iniciar despacho tras empaque completo → 200 (madre-predecesora deja pasar)', s.status===200, {status:s.status,err:s.j&&s.j.error});

    console.log('\n── Exención handoff + path de notificaciones (const→let + override) ──');
    const c=await api('PATCH','/api/wwp/tasks/wt_pack2',ADMIN,{ status:'completed', by:'Admin QA' });
    ok('completar madre-empaque con despacho abierto → 200 (exención handoff)', c.status===200, {status:c.status,err:c.j&&c.j.error});
    const tp2=await getTask('wt_pack2');
    ok('la madre quedó completed (status real intacto)', tp2 && tp2.status==='completed', {got:tp2&&tp2.status});
    ok('no hubo error de servidor en el path de notificaciones (stderr sin TypeError)', !/TypeError|is not a function|Assignment to constant/.test(serr), {stderr:serr.slice(-300)});

    console.log('\n── Front ──');
    const fh=await fetch(BASE+'/historial.html'); const ft=await fh.text();
    ok('historial.html 200 + build v189', fh.status===200 && ft.includes("APP_BUILD = 'v189'"), {status:fh.status});
    ok('helper chainDisplayStatus presente', ft.includes('function chainDisplayStatus('), {});
    ok('etiqueta de handoff presente', ft.includes('Empaque listo · despacho pendiente'), {});
    ok('el # (seqLabel) se antepone al título en la lista', ft.includes('${seqLabel(t)?`<span style="color:var(--text-3);font-weight:800;margin-right:5px">${seqLabel(t)}</span>`:\'\'}${esc(t.title)}'), {});

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
