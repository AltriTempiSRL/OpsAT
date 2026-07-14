// _test_v190.mjs — Valida el borrado dirigido de artículos/kits (DELETE /items). Sin Odoo.
//  · kit    → quita todos los item_id con kitId===key (tarjeta + componentes)
//  · group  → quita todas las unidades del artículo (group_ref||item_id)
//  · unlink de fotos de evidencia en disco
//  · protección SDV (sku en sdvArticulos → 409), extras de Ops sí se quitan
//  · cascada a hijas de despacho ABIERTAS; bloquea si una hija ya cerró
//  · tarea cerrada (validated) → 409
// Uso (desde la raíz): node tests/_test_v190.mjs
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

const PORT = 3296;
const BASE = `http://127.0.0.1:${PORT}`;
const ROOT = process.cwd();
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'testv190-'));
const FOTOS_DIR = path.join(DATA_DIR, 'wwp-fotos');

const now = new Date().toISOString();
const baseTask = (id, extra) => ({
  id, seq:null, parentId:null, title:'Tarea '+id, type:'general', description:'',
  priority:'medium', status:'in_progress', assignedTo:null, managerId:'au_gsanchez', managerName:'Admin QA',
  executors:[], assignees:[], location:'', dueDate:null, actionNote:'', items:[],
  evidence:[], fotos_guia:[], statusHistory:[{status:'in_progress',date:now,by:'test'}],
  createdBy:'test', createdAt:now, updatedAt:now, ...extra
});
const ev = (fname) => ({ id:'e_'+fname, url:'/wwp-fotos/'+fname });
const FIX = [
  // Kit: tarjeta sintética + componente, mismo kitId, con foto en la tarjeta
  baseTask('wt_kit', { items:[
    { item_id:'k_card', isKit:true, kitId:'KIT1', kitInstance:1, kitName:'Nale Sideboard', selected:true, evidence_images:[ev('p_kit.jpg')], confirmado:true, condition:'good' },
    { item_id:'k_c1', kitId:'KIT1', unit_index:1, sku:'COMP1', product_name:'Componente', selected:false, evidence_images:[] },
  ]}),
  // Grupo no-kit con foto
  baseTask('wt_group', { items:[
    { item_id:'g1', group_ref:'g1', sku:'AAA', product_name:'Silla', selected:true, evidence_images:[ev('p_grp.jpg')] },
  ]}),
  // SDV: sku prometido (bloquea) vs extra de Ops (permite)
  baseTask('wt_sdv', { sdvId:'s1', sdvFolio:'SD-T-1', sdvArticulos:[{sku:'PROM1'}], items:[
    { item_id:'p1', group_ref:'p1', sku:'PROM1', product_name:'Prometido', selected:true },
    { item_id:'x1', group_ref:'x1', sku:'EXTRA1', product_name:'Extra Ops', selected:true },
  ]}),
  // Tarea cerrada
  baseTask('wt_closed', { status:'validated', items:[{ item_id:'c1', group_ref:'c1', sku:'Z', product_name:'Cerrado', selected:true }] }),
  // Cascada: madre + hija despacho CERRADA con el kit → bloquea
  baseTask('wt_pdone', { items:[{ item_id:'kd_card', isKit:true, kitId:'KIT2', kitInstance:1, kitName:'Set B', selected:true }] }),
  baseTask('wt_cdone', { parentId:'wt_pdone', type:'dispatch_order', status:'completed', subIndex:2,
    items:[{ item_id:'kd_c1', kitId:'KIT2', unit_index:1, sku:'COMP2', selected:true }] }),
  // Cascada: madre + hija despacho ABIERTA con el grupo → se quita también de la hija
  baseTask('wt_popen', { items:[{ item_id:'go1', group_ref:'go1', sku:'BBB', product_name:'Mesa', selected:true }] }),
  baseTask('wt_copen', { parentId:'wt_popen', type:'dispatch_order', status:'assigned', subIndex:2,
    items:[{ item_id:'go1', group_ref:'go1', sku:'BBB', product_name:'Mesa', selected:true, evidence_images:[ev('p_child.jpg')] }] }),
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
const touch = (fname) => { fs.mkdirSync(FOTOS_DIR,{recursive:true}); fs.writeFileSync(path.join(FOTOS_DIR,fname),'x'); };
const exists = (fname) => fs.existsSync(path.join(FOTOS_DIR,fname));

(async ()=>{
  const srv = spawn('node',['proxy.js'],{ cwd:ROOT, env:{...process.env, DATA_DIR, PORT:String(PORT) } });
  let serr=''; srv.stderr.on('data',d=>serr+=d.toString());
  const cleanup=()=>{ try{srv.kill('SIGKILL');}catch{} try{fs.rmSync(DATA_DIR,{recursive:true,force:true});}catch{} };
  try{
    await waitReady();
    SECRET=fs.readFileSync(path.join(DATA_DIR,'.jwt-secret'),'utf8').trim();
    ADMIN=mint('au_gsanchez','admin','Admin QA');
    ['p_kit.jpg','p_grp.jpg','p_child.jpg'].forEach(touch);

    console.log('\n── Kit completo (tarjeta + componentes, mismo kitId) + unlink de foto ──');
    const k=await api('DELETE','/api/wwp/tasks/wt_kit/items',ADMIN,{ kind:'kit', key:'KIT1', by:'Admin QA' });
    ok('DELETE kit → 200 y removed=2 (tarjeta + componente)', k.status===200 && k.j&&k.j.removed===2, {status:k.status,removed:k.j&&k.j.removed});
    const tk=await getTask('wt_kit');
    ok('la tarea quedó sin items del kit', tk && (tk.items||[]).filter(i=>i.kitId==='KIT1').length===0, {items:tk&&tk.items});
    ok('la foto del kit se borró del disco (unlink)', !exists('p_kit.jpg'), {stillThere:exists('p_kit.jpg')});

    console.log('\n── Artículo no-kit (grupo) + unlink ──');
    const g=await api('DELETE','/api/wwp/tasks/wt_group/items',ADMIN,{ kind:'group', key:'g1', by:'Admin QA' });
    ok('DELETE group → 200', g.status===200 && g.j&&g.j.ok, {status:g.status});
    const tg=await getTask('wt_group');
    ok('la tarea quedó sin el artículo', tg && (tg.items||[]).length===0, {items:tg&&tg.items});
    ok('la foto del artículo se borró del disco', !exists('p_grp.jpg'), {});

    console.log('\n── Protección SDV: prometido bloquea, extra de Ops permite ──');
    const sp=await api('DELETE','/api/wwp/tasks/wt_sdv/items',ADMIN,{ kind:'group', key:'p1', by:'Admin QA' });
    ok('quitar artículo PROMETIDO (en sdvArticulos) → 409 sdvBlocked', sp.status===409 && sp.j&&sp.j.sdvBlocked, {status:sp.status,j:sp.j});
    const sx=await api('DELETE','/api/wwp/tasks/wt_sdv/items',ADMIN,{ kind:'group', key:'x1', by:'Admin QA' });
    ok('quitar EXTRA de Ops (no en sdvArticulos) → 200', sx.status===200, {status:sx.status,err:sx.j&&sx.j.error});
    const tsdv=await getTask('wt_sdv');
    ok('el prometido sigue, el extra se fue', tsdv && (tsdv.items||[]).some(i=>i.sku==='PROM1') && !(tsdv.items||[]).some(i=>i.sku==='EXTRA1'), {items:tsdv&&tsdv.items.map(i=>i.sku)});

    console.log('\n── Tarea cerrada → 409 ──');
    const cl=await api('DELETE','/api/wwp/tasks/wt_closed/items',ADMIN,{ kind:'group', key:'c1', by:'Admin QA' });
    ok('tarea validated → 409 (no se muta lo cerrado)', cl.status===409, {status:cl.status});

    console.log('\n── Cascada: hija cerrada bloquea; hija abierta se limpia ──');
    const cb=await api('DELETE','/api/wwp/tasks/wt_pdone/items',ADMIN,{ kind:'kit', key:'KIT2', by:'Admin QA' });
    ok('hija despacho ya cerrada con el artículo → 409 (ya salió)', cb.status===409, {status:cb.status,err:cb.j&&cb.j.error});
    const co=await api('DELETE','/api/wwp/tasks/wt_popen/items',ADMIN,{ kind:'group', key:'go1', by:'Admin QA' });
    ok('madre con hija ABIERTA → 200 y cascadedTo incluye la hija', co.status===200 && (co.j.cascadedTo||[]).includes('wt_copen'), {status:co.status,cascadedTo:co.j&&co.j.cascadedTo});
    const tco=await getTask('wt_copen');
    ok('el artículo también se quitó de la hija abierta', tco && (tco.items||[]).length===0, {items:tco&&tco.items});
    ok('la foto de la hija se borró del disco', !exists('p_child.jpg'), {});

    console.log('\n── Auditoría ──');
    let audit=[]; try{ audit=JSON.parse(fs.readFileSync(path.join(DATA_DIR,'wwp-audit.json'),'utf8')); }catch{}
    ok('quedó registro task_item_removed en el audit', audit.some(a=>a.event==='task_item_removed'), {n:audit.filter(a=>a.event==='task_item_removed').length});

    console.log('\n── Front ──');
    const fh=await fetch(BASE+'/historial.html'); const ft=await fh.text();
    ok('historial.html 200 + build v191', fh.status===200 && ft.includes("APP_BUILD = 'v191'"), {status:fh.status});
    ok('funciones removeTaskItem/removeTaskKit presentes', ft.includes('function removeTaskItem(') && ft.includes('function removeTaskKit('), {});
    ok('CSS .item-del presente', ft.includes('.item-del{'), {});
    ok('fix del carrito vacío en saveTask', ft.includes('(_editingTask && (_editingTask.items||[]).some(it=>it.selected))'), {});

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
