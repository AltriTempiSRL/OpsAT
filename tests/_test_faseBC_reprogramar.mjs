// _test_faseBC_reprogramar.mjs — Fase B+C de Reprogramar (Decisión 26). Sin Odoo.
//  FASE B: sellado de fechaSolicitudDeseadaOriginal (POST /reprogramar + PATCH SDV genérico,
//          1ª vez sella / 2ª NO pisa / siembra y borrador NO sellan), OTIF de eo-metrics contra
//          la promesa ORIGINAL (el falseo "muevo la fecha y quedo a tiempo" se elimina),
//          resumen aditivo: reprogramadas / slippagePromedioDias / reprogPorMotivo.
//  FASE C: prioridad recalculada al mover fecha (ambos paths), dueDate propagado DATE-ONLY por
//          el PATCH genérico (H2-1 sigue tolerando echoes), checkDueTodayAlert matchea con hora.
// Uso (desde la raíz): node tests/_test_faseBC_reprogramar.mjs
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

const PORT = 3298;
const BASE = `http://127.0.0.1:${PORT}`;
const ROOT = process.cwd();
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'testfasebc-'));

// ── Fechas dinámicas (componentes LOCALES, patrón Aprendizaje 17) ──
const pad = n => String(n).padStart(2, '0');
const dOnly = dt => dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate());
const D = k => { const d = new Date(); d.setDate(d.getDate() + k); return dOnly(d); };
// Timestamp ISO al MEDIODÍA local del día k (evita el corrimiento UTC de bordes de día).
const noonISO = k => { const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate() + k, 12, 0, 0).toISOString(); };

const now = new Date().toISOString();
const SDV = [
  // POST /reprogramar: sella la 1ª, no pisa la 2ª, prioridad viva
  { id:'sdv_rep', folio:'SD-T-REP', fechaSolicitudDeseada:D(2), creadoPor:'au_seller', creadoNombre:'Vendedora QA',
    estado:'en_proceso', tipoSolicitud:'despacho', articulosOdoo:[], statusHistory:[] },
  // PATCH genérico: sella + normaliza dueDate a date-only + prioridad. Fecha almacenada CON hora (legacy).
  { id:'sdv_pat', folio:'SD-T-PAT', fechaSolicitudDeseada:D(3)+'T00:00:00', creadoPor:'au_seller', creadoNombre:'Vendedora QA',
    estado:'en_proceso', tipoSolicitud:'despacho', articulosOdoo:[], statusHistory:[] },
  // Siembra por PATCH (null→valor): NO sella
  { id:'sdv_seed', folio:'SD-T-SEED', fechaSolicitudDeseada:null, creadoPor:'au_seller', creadoNombre:'Vendedora QA',
    estado:'en_proceso', tipoSolicitud:'despacho', articulosOdoo:[], statusHistory:[] },
  // Siembra por /reprogramar (sin fecha previa): NO sella
  { id:'sdv_seed2', folio:'SD-T-SEED2', fechaSolicitudDeseada:null, creadoPor:'au_seller', creadoNombre:'Vendedora QA',
    estado:'en_proceso', tipoSolicitud:'despacho', articulosOdoo:[], statusHistory:[] },
  // Borrador de la vendedora (pendiente_revision): cambiar fecha NO sella
  { id:'sdv_draft', folio:'SD-T-DRAFT', fechaSolicitudDeseada:D(5), creadoPor:'au_seller', creadoNombre:'Vendedora QA',
    estado:'pendiente_revision', tipoSolicitud:'despacho', articulosOdoo:[], statusHistory:[] },
  // ── eo-metrics ──
  // A: control SIN reprogramación, despachada al día → mide idéntico que antes (alDia, aTiempo)
  { id:'sdv_a', folio:'SD-T-A', fechaSolicitudDeseada:D(-5), despachadaEn:noonISO(-5), creadoPor:'au_seller',
    estado:'despachada', tipoSolicitud:'despacho', articulosOdoo:[], statusHistory:[] },
  // B: EL FALSEO — original D-10, movida a D-3, despachada D-7: tarde vs original (+3), "temprano" vs movida (−4).
  //    Con el fix NO cuenta a-tiempo (antes del fix contaba).
  { id:'sdv_b', folio:'SD-T-B', fechaSolicitudDeseadaOriginal:D(-10), fechaSolicitudDeseada:D(-3), despachadaEn:noonISO(-7),
    creadoPor:'au_seller', estado:'despachada', tipoSolicitud:'despacho', articulosOdoo:[], statusHistory:[],
    reprogramaciones:[{ fechaAnterior:D(-10), fechaNueva:D(-3), motivo:'transporte', motivoLabel:'Transporte / ruta llena', motivoTexto:'', por:'au_gsanchez', porNombre:'Admin QA', at:noonISO(-8) }] },
  // C: reprogramada en la era v192 (SIN original sellado) y sin despachar: slippage por fallback
  //    retro-derivado de reprogramaciones[0].fechaAnterior (D-8 → D-2 = +6)
  { id:'sdv_c', folio:'SD-T-C', fechaSolicitudDeseada:D(-2), creadoPor:'au_seller',
    estado:'en_proceso', tipoSolicitud:'despacho', articulosOdoo:[], statusHistory:[],
    reprogramaciones:[{ fechaAnterior:D(-8), fechaNueva:D(-2), motivo:'cliente', motivoLabel:'Cliente reprograma', motivoTexto:'', por:'au_gsanchez', porNombre:'Admin QA', at:noonISO(-4) }] },
  // Dv: reprogramada en el período ANTERIOR (at −70d con ventana 60): cuenta en anterior, NO en reprogPorMotivo
  { id:'sdv_dprev', folio:'SD-T-DPREV', fechaSolicitudDeseadaOriginal:D(-75), fechaSolicitudDeseada:D(-65), creadoPor:'au_seller',
    estado:'en_proceso', tipoSolicitud:'despacho', articulosOdoo:[], statusHistory:[],
    reprogramaciones:[{ fechaAnterior:D(-75), fechaNueva:D(-65), motivo:'cuadrilla', motivoLabel:'Falta cuadrilla', motivoTexto:'', por:'au_gsanchez', porNombre:'Admin QA', at:noonISO(-70) }] },
];
fs.writeFileSync(path.join(DATA_DIR, 'sdv-solicitudes.json'), JSON.stringify(SDV, null, 2));

const baseTask = (id, extra) => ({
  id, seq:null, parentId:null, title:'Tarea '+id, type:'general', description:'', priority:'urgent',
  status:'in_progress', assignedTo:null, managerId:'au_gsanchez', executors:[], assignees:[],
  dueDate:D(2), items:[], evidence:[], fotos_guia:[],
  statusHistory:[{status:'in_progress',date:now,by:'test'}], createdBy:'test', createdAt:now, updatedAt:now, ...extra });
const TASKS = [
  baseTask('wt_m',    { type:'packaging', sdvId:'sdv_rep', sdvFolio:'SD-T-REP' }),
  baseTask('wt_d',    { type:'dispatch_order', sdvId:'sdv_rep', sdvFolio:'SD-T-REP', parentId:'wt_m', subIndex:2, status:'assigned' }),
  baseTask('wt_done', { type:'dispatch_order', sdvId:'sdv_rep', sdvFolio:'SD-T-REP', parentId:'wt_m', subIndex:3, status:'completed' }),
  baseTask('wt_p',    { type:'dispatch_order', sdvId:'sdv_pat', sdvFolio:'SD-T-PAT', dueDate:D(3)+'T00:00:00' }),
  baseTask('wt_seed', { type:'dispatch_order', sdvId:'sdv_seed', sdvFolio:'SD-T-SEED', dueDate:null }),
  baseTask('wt_seed2',{ type:'dispatch_order', sdvId:'sdv_seed2', sdvFolio:'SD-T-SEED2', dueDate:null }),
  baseTask('wt_nosdv',{}),
];
fs.writeFileSync(path.join(DATA_DIR, 'wwp-tasks.json'), JSON.stringify(TASKS, null, 2));

const b64u = b => Buffer.from(b).toString('base64url');
let SECRET=null, ADMIN=null, SELLER=null;
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
async function getSol(id){ const r=await api('GET','/api/sdv/'+id,ADMIN); return (r.j&&(r.j.solicitud||r.j))||{}; }
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
    SELLER=mint('au_seller','ventas','Vendedora QA');

    // ══ eo-metrics PRIMERO (antes de mutar reprogramaciones con los tests de endpoints) ══
    console.log('── FASE B: eo-metrics OTIF vs promesa ORIGINAL + slippage ──');
    const eo=await api('GET','/api/eo-metrics?days=60',ADMIN);
    const res_=eo.j&&eo.j.resumen||{};
    ok('eo-metrics 200', eo.status===200 && eo.j&&eo.j.ok===true, {status:eo.status});
    ok('despachadas.actual=2 (A y B)', res_.despachadas&&res_.despachadas.actual===2, {d:res_.despachadas});
    // EL FALSEO ELIMINADO: B se despachó DESPUÉS de la original (+3) aunque "antes" de la movida (−4)
    // → NO cuenta a-tiempo. A (sin reprogramar) sí. aTiempoPct = 1/2 = 50%.
    ok('aTiempoPct.actual=50 (B tarde vs ORIGINAL, no vs la movida)', res_.aTiempoPct&&res_.aTiempoPct.actual===50, {a:res_.aTiempoPct});
    const cs=eo.j&&eo.j.cumplimientoSemanal||[];
    const sum=k=>cs.reduce((a,w)=>a+(w[k]||0),0);
    ok('cumplimientoSemanal: 1 alDia (A, sin reprog mide idéntico)', sum('alDia')===1, {alDia:sum('alDia')});
    ok('cumplimientoSemanal: 1 tarde3mas (B: +3 vs original)', sum('tarde3mas')===1, {t3:sum('tarde3mas'),t12:sum('tarde1a2')});
    const cd=eo.j&&eo.j.cumplimientoPorDia||[];
    const sumd=k=>cd.reduce((a,w)=>a+(w[k]||0),0);
    ok('cumplimientoPorDia consistente (1 alDia + 1 tarde3mas)', sumd('alDia')===1 && sumd('tarde3mas')===1, {alDia:sumd('alDia'),t3:sumd('tarde3mas')});
    ok('resumen.reprogramadas={actual:2,anterior:1} (B+C / DPREV)', res_.reprogramadas&&res_.reprogramadas.actual===2&&res_.reprogramadas.anterior===1, {r:res_.reprogramadas});
    // slippage actual: B = D(-3)−D(-10) = 7; C (fallback retro reprogramaciones[0].fechaAnterior) = D(-2)−D(-8) = 6 → 6.5
    ok('slippagePromedioDias.actual=6.5 (B=7, C=6 vía fallback v192)', res_.slippagePromedioDias&&res_.slippagePromedioDias.actual===6.5, {s:res_.slippagePromedioDias});
    ok('slippagePromedioDias.anterior=10 (DPREV)', res_.slippagePromedioDias&&res_.slippagePromedioDias.anterior===10, {s:res_.slippagePromedioDias});
    ok('reprogPorMotivo={transporte:1,cliente:1} (ventana actual, sin cuadrilla)', JSON.stringify(res_.reprogPorMotivo)===JSON.stringify({transporte:1,cliente:1})||JSON.stringify(res_.reprogPorMotivo)===JSON.stringify({cliente:1,transporte:1}), {m:res_.reprogPorMotivo});

    console.log('\n── FASE B: /reprogramar sella la 1ª vez y NO pisa la 2ª ──');
    const r1=await api('POST','/api/wwp/tasks/wt_m/reprogramar',ADMIN,{ nuevaFecha:D(30), motivo:'transporte', by:'Admin QA', byUserId:'au_gsanchez' });
    ok('1ª reprogramación → 200', r1.status===200 && r1.j&&r1.j.ok, {status:r1.status,j:r1.j});
    let sRep=await getSol('sdv_rep');
    ok('sella fechaSolicitudDeseadaOriginal='+D(2), sRep.fechaSolicitudDeseadaOriginal===D(2), {o:sRep.fechaSolicitudDeseadaOriginal});
    const r2=await api('POST','/api/wwp/tasks/wt_m/reprogramar',ADMIN,{ nuevaFecha:D(1), motivo:'cliente', by:'Admin QA', byUserId:'au_gsanchez' });
    sRep=await getSol('sdv_rep');
    ok('2ª reprogramación → 200 y NO pisa el original', r2.status===200 && sRep.fechaSolicitudDeseadaOriginal===D(2), {status:r2.status,o:sRep.fechaSolicitudDeseadaOriginal});
    ok('fecha viva = '+D(1)+' (la operación mide contra la nueva)', (sRep.fechaSolicitudDeseada||'').slice(0,10)===D(1), {f:sRep.fechaSolicitudDeseada});

    console.log('\n── FASE C: prioridad viva + dueDate date-only en /reprogramar ──');
    // Tras r1 (D+30, lejana) la prioridad bajó de urgent→medium; tras r2 (D+1, mañana) subió a urgent.
    let tm=await getTask('wt_m'), td=await getTask('wt_d'), tdone=await getTask('wt_done');
    ok('madre y hija activa: dueDate='+D(1)+' date-only', tm&&tm.dueDate===D(1) && td&&td.dueDate===D(1), {m:tm&&tm.dueDate,d:td&&td.dueDate});
    ok('prioridad recalculada a urgent (fecha cercana)', tm&&tm.priority==='urgent' && td&&td.priority==='urgent', {m:tm&&tm.priority,d:td&&td.priority});
    ok('tarea completed intacta (fecha y prioridad)', tdone&&tdone.dueDate===D(2)&&tdone.priority==='urgent', {due:tdone&&tdone.dueDate,p:tdone&&tdone.priority});
    // El paso intermedio (lejana→baja) se verifica aparte con el PATCH genérico abajo (D+20 → medium).

    console.log('\n── FASE B: el PATCH SDV genérico también sella (y solo la 1ª vez) ──');
    const p1=await api('PATCH','/api/sdv/sdv_pat',ADMIN,{ fechaSolicitudDeseada:D(4)+'T15:30:00' });
    let sPat=await getSol('sdv_pat');
    ok('PATCH cambia fecha → 200 y sella original='+D(3), p1.status===200 && sPat.fechaSolicitudDeseadaOriginal===D(3), {status:p1.status,o:sPat.fechaSolicitudDeseadaOriginal});
    let tp=await getTask('wt_p');
    ok('dueDate propagado DATE-ONLY ('+D(4)+', sin hora)', tp&&tp.dueDate===D(4), {due:tp&&tp.dueDate});
    ok('prioridad recalculada a high (≤5 días)', tp&&tp.priority==='high', {p:tp&&tp.priority});
    // Echo del form (misma fecha por día) NO re-sella ni cuenta como cambio
    const p2=await api('PATCH','/api/sdv/sdv_pat',ADMIN,{ fechaSolicitudDeseada:D(4), observaciones:'echo del form' });
    sPat=await getSol('sdv_pat');
    ok('echo de la misma fecha → 200, original intacto', p2.status===200 && sPat.fechaSolicitudDeseadaOriginal===D(3), {status:p2.status,o:sPat.fechaSolicitudDeseadaOriginal});
    // 2º cambio real: el original NO se pisa; prioridad baja a medium (D+20 lejana)
    const p3=await api('PATCH','/api/sdv/sdv_pat',ADMIN,{ fechaSolicitudDeseada:D(20) });
    sPat=await getSol('sdv_pat'); tp=await getTask('wt_p');
    ok('2º cambio real: original sigue '+D(3), p3.status===200 && sPat.fechaSolicitudDeseadaOriginal===D(3), {o:sPat.fechaSolicitudDeseadaOriginal});
    ok('prioridad baja a medium (fecha lejana)', tp&&tp.priority==='medium'&&tp.dueDate===D(20), {p:tp&&tp.priority,due:tp&&tp.dueDate});

    console.log('\n── FASE B: siembras y borrador NO sellan ──');
    const p4=await api('PATCH','/api/sdv/sdv_seed',ADMIN,{ fechaSolicitudDeseada:D(7) });
    const sSeed=await getSol('sdv_seed'); const tSeed=await getTask('wt_seed');
    ok('siembra null→valor por PATCH: NO sella', p4.status===200 && !sSeed.fechaSolicitudDeseadaOriginal, {o:sSeed.fechaSolicitudDeseadaOriginal});
    ok('siembra propaga dueDate date-only + prioridad', tSeed&&tSeed.dueDate===D(7)&&['medium','high','urgent'].includes(tSeed.priority)&&tSeed.priority!=='urgent', {due:tSeed&&tSeed.dueDate,p:tSeed&&tSeed.priority});
    const r3=await api('POST','/api/wwp/tasks/wt_seed2/reprogramar',ADMIN,{ nuevaFecha:D(9), motivo:'mercancia' });
    const sSeed2=await getSol('sdv_seed2');
    ok('siembra sin fecha previa por /reprogramar: NO sella', r3.status===200 && !sSeed2.fechaSolicitudDeseadaOriginal, {status:r3.status,o:sSeed2.fechaSolicitudDeseadaOriginal});
    const p5=await api('PATCH','/api/sdv/sdv_draft',SELLER,{ fechaSolicitudDeseada:D(6) });
    const sDraft=await getSol('sdv_draft');
    ok('vendedora corrige fecha en pendiente_revision: NO sella (borrador)', p5.status===200 && !sDraft.fechaSolicitudDeseadaOriginal && (sDraft.fechaSolicitudDeseada||'').slice(0,10)===D(6), {status:p5.status,o:sDraft.fechaSolicitudDeseadaOriginal});

    console.log('\n── FASE C: guard H2-1 sigue tolerando echoes tras normalizar ──');
    const e1=await api('PATCH','/api/wwp/tasks/wt_p',ADMIN,{ dueDate:D(20), title:'Tarea wt_p editada' });
    ok('echo de dueDate en PATCH de tarea → 200 (tolerado)', e1.status===200, {status:e1.status,j:e1.j});
    const e2=await api('PATCH','/api/wwp/tasks/wt_p',ADMIN,{ dueDate:D(25) });
    ok('dueDate DISTINTO en PATCH de tarea → 422 (frontera intacta)', e2.status===422 && (e2.j&&e2.j.campos||[]).includes('dueDate'), {status:e2.status,j:e2.j});

    console.log('\n── FASE C: checkDueTodayAlert matchea dueDate con hora (unidad, código real) ──');
    const src=fs.readFileSync(path.join(ROOT,'proxy.js'),'utf8').replace(/\r\n/g,'\n');
    const st=src.indexOf('function checkDueTodayAlert()');
    const en=src.indexOf('\n}', st);
    ok('función extraída del fuente', st>0 && en>st, {st,en});
    const fnSrc=src.slice(st, en+2);
    const calls=[];
    const mk=new Function('nowRD','loadWwpTasks','loadAuthUsers','taskResponsibleIds','notifyMany','console',
      'let _dueTodayAlertFiredDate=null;\n'+fnSrc+'\nreturn checkDueTodayAlert;');
    const today='2026-07-17';
    const fn=mk(
      ()=>new Date(Date.UTC(2026,6,17,20,0,0)),                       // 20:00 RD exactas
      ()=>[
        { id:'a', title:'con hora', parentId:null, dueDate:today+'T00:00:00', status:'in_progress', priority:'high' },
        { id:'b', title:'exacta',   parentId:null, dueDate:today,             status:'assigned',    priority:'medium' },
        { id:'c', title:'hija',     parentId:'a',  dueDate:today,             status:'in_progress', priority:'high' },
        { id:'d', title:'mañana',   parentId:null, dueDate:'2026-07-18T00:00:00', status:'in_progress', priority:'high' },
        { id:'e', title:'cerrada',  parentId:null, dueDate:today,             status:'completed',   priority:'high' },
      ],
      ()=>[{ id:'m1', role:'manager', active:true }],
      ()=>[],
      (rec,n)=>calls.push(n),
      { log:()=>{} }
    );
    fn();
    ok('notifica 2 tareas: la exacta Y la que guarda hora', calls.length===2, {n:calls.length,ids:calls.map(c=>c.relatedTaskId)});
    ok('la tarea con dueDate+hora (bug pre-fix) SÍ dispara', calls.some(c=>c.relatedTaskId==='a'), {ids:calls.map(c=>c.relatedTaskId)});
    ok('hija (parentId) sigue excluida — filtro NO tocado', !calls.some(c=>c.relatedTaskId==='c'), {ids:calls.map(c=>c.relatedTaskId)});

    console.log('\n── Persistencia + auditoría (disco = ground truth) ──');
    const sdvDisk=JSON.parse(fs.readFileSync(path.join(DATA_DIR,'sdv-solicitudes.json'),'utf8'));
    const dRep=sdvDisk.find(s=>s.id==='sdv_rep');
    ok('disco: sdv_rep original='+D(2)+' + 2 reprogramaciones', dRep&&dRep.fechaSolicitudDeseadaOriginal===D(2)&&(dRep.reprogramaciones||[]).length===2, {o:dRep&&dRep.fechaSolicitudDeseadaOriginal,n:dRep&&(dRep.reprogramaciones||[]).length});
    const dA=sdvDisk.find(s=>s.id==='sdv_a');
    ok('disco: sdv_a (sin reprogramar) NO ganó campos nuevos', dA&&dA.fechaSolicitudDeseadaOriginal===undefined&&dA.reprogramaciones===undefined, {keys:dA&&Object.keys(dA).filter(k=>/reprog|Original/.test(k))});
    let audit=[]; try{ audit=JSON.parse(fs.readFileSync(path.join(DATA_DIR,'wwp-audit.json'),'utf8')); }catch{}
    ok('audit task_duedate_changed ×3 (2 reprogramar + 1 siembra wt_seed2)', audit.filter(a=>a.event==='task_duedate_changed').length===3, {n:audit.filter(a=>a.event==='task_duedate_changed').length});

    const fails=R.filter(x=>!x.pass).length;
    console.log(`\n═══ ${R.length-fails}/${R.length} pasaron ═══${fails?` · ${fails} FALLARON`:''}`);
    if (serr.trim() && fails) console.log('\n[stderr del server]\n'+serr.slice(0,3000));
    cleanup();
    process.exit(fails?1:0);
  } catch(e){
    console.error('ERROR:', e.message);
    if (serr.trim()) console.error('[stderr]\n'+serr.slice(0,3000));
    cleanup();
    process.exit(1);
  }
})();
