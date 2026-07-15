// _test_multiorden.mjs — SDV multi-orden (opción b): POST /api/sdv odooOrderRefs,
// aprobación → raíz empaque + 1 despacho POR ORDEN, by-order, pickstatus fail-open,
// unit: getOrderClaims multi + buildPickMergeForTask multi (stubs). Sin Odoo.
// Uso (desde la raíz del proyecto): node <scratchpad>/_test_multiorden.mjs
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

const PORT = 3297;
const BASE = `http://127.0.0.1:${PORT}`;
const ROOT = process.cwd();
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'testmulti-'));

const b64u = b => Buffer.from(b).toString('base64url');
let SECRET=null, ADMIN=null, VENTAS=null;
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
async function allTasks(){ const r=await api('GET','/api/wwp/tasks',ADMIN); return (r.j&&(r.j.tasks||r.j.list))||(Array.isArray(r.j)?r.j:[]); }
const R=[]; const ok=(name,cond,detail)=>{ R.push({name,pass:!!cond}); console.log(`${cond?'✓':'✗'} ${name}${cond?'':'  → '+JSON.stringify(detail)}`); };
function waitReady(ms=20000){ const t0=Date.now(); return new Promise((res,rej)=>{ (async function poll(){ try{const r=await fetch(BASE+'/api/app-version'); if(r.ok)return res(true);}catch{} if(Date.now()-t0>ms)return rej(new Error('server no levantó')); setTimeout(poll,300); })(); }); }

const SDV_BODY = (extra)=>({ tipoSolicitud:'despacho_cliente', clienteNombre:'PAMELA YUNEN',
  direccionEntrega:'Av. Test 1', receptorNombre:'Pamela', receptorContacto:'809', fechaSolicitudDeseada:'2026-07-20', ...extra });

(async ()=>{
  const srv = spawn('node',['proxy.js'],{ cwd:ROOT, env:{...process.env, DATA_DIR, PORT:String(PORT) } });
  let serr=''; srv.stderr.on('data',d=>serr+=d.toString());
  const cleanup=()=>{ try{srv.kill('SIGKILL');}catch{} try{fs.rmSync(DATA_DIR,{recursive:true,force:true});}catch{} };
  try{
    await waitReady();
    SECRET=fs.readFileSync(path.join(DATA_DIR,'.jwt-secret'),'utf8').trim();
    ADMIN=mint('au_gsanchez','admin','Admin QA');
    VENTAS=mint('au_vera','ventas','Vera QA');

    console.log('\n── 1. POST /api/sdv multi-orden (validación + persistencia) ──');
    const pMulti = await api('POST','/api/sdv',VENTAS, SDV_BODY({
      odooOrderRefs:['S09516','S09517','s09516'],   // dup case-insensitive
      articulosOdoo:[
        {sku:'111',quantity:2,product_name:'Mesa Dread',orderRef:'S09516'},
        {sku:'222',quantity:1,product_name:'Silla Tau',orderRef:'s09517'}   // case → normaliza
      ]}));
    const sol = pMulti.j && pMulti.j.solicitud;
    ok('201 + odooOrderRefs dedup [S09516,S09517]', pMulti.status===201 && sol && JSON.stringify(sol.odooOrderRefs)==='["S09516","S09517"]', {status:pMulti.status, refs:sol&&sol.odooOrderRefs});
    ok('odooOrderRef = joined "S09516, S09517"', sol && sol.odooOrderRef==='S09516, S09517', {ref:sol&&sol.odooOrderRef});
    ok('item orderRef normalizado a S09517', sol && sol.articulosOdoo[1].orderRef==='S09517', {it:sol&&sol.articulosOdoo[1]});
    const SID = sol && sol.id;

    const v1 = await api('POST','/api/sdv',VENTAS, SDV_BODY({ odooOrderRefs:'S09516' }));
    ok('odooOrderRefs no-array → 422', v1.status===422, {status:v1.status,e:v1.j&&v1.j.error});
    const v2 = await api('POST','/api/sdv',VENTAS, SDV_BODY({ odooOrderRefs:['S09516','  '] }));
    ok('ref vacía en el array → 422', v2.status===422, {status:v2.status});
    const v3 = await api('POST','/api/sdv',VENTAS, SDV_BODY({ odooOrderRefs:['S09516','S09517'],
      articulosOdoo:[{sku:'111',quantity:1,product_name:'X'}] }));
    ok('multi + item SIN orderRef → 422', v3.status===422, {status:v3.status,e:v3.j&&v3.j.error});
    const v4 = await api('POST','/api/sdv',VENTAS, SDV_BODY({ odooOrderRefs:['S09516','S09517'],
      articulosOdoo:[{sku:'111',quantity:1,product_name:'X',orderRef:'S09999'}] }));
    ok('multi + orderRef fuera de refs → 422', v4.status===422, {status:v4.status});

    console.log('\n── 2. Compat mono (string) + GET devuelve odooOrderRefs ──');
    const pMono = await api('POST','/api/sdv',VENTAS, SDV_BODY({ odooOrderRef:'S09999',
      articulosOdoo:[{sku:'333',quantity:1,product_name:'Lámpara'}] }));
    const solM = pMono.j && pMono.j.solicitud;
    ok('mono: odooOrderRefs derivado [S09999] + odooOrderRef intacto', pMono.status===201 && solM && JSON.stringify(solM.odooOrderRefs)==='["S09999"]' && solM.odooOrderRef==='S09999', {solM:solM&&{r:solM.odooOrderRef,rs:solM.odooOrderRefs}});
    const MID = solM && solM.id;
    const g1 = await api('GET','/api/sdv/'+SID,ADMIN);
    const gSol = g1.j && (g1.j.solicitud||g1.j);
    ok('GET /api/sdv/:id → odooOrderRefs presente', g1.status===200 && gSol && Array.isArray(gSol.odooOrderRefs) && gSol.odooOrderRefs.length===2, {refs:gSol&&gSol.odooOrderRefs});
    const gl = await api('GET','/api/sdv',ADMIN);
    const gRow = gl.j && (gl.j.solicitudes||[]).find(s=>s.id===SID);
    ok('GET /api/sdv (lista) → odooOrderRefs presente', !!gRow && Array.isArray(gRow.odooOrderRefs), {row:gRow&&gRow.odooOrderRefs});

    console.log('\n── 3. Aprobación 1-clic multi → raíz empaque + 1 despacho POR ORDEN ──');
    const ap = await api('PATCH','/api/sdv/'+SID,ADMIN,{ estado:'en_proceso',
      estructura:{ concepto:'empaque_despacho', empaque:{ encargados:[{id:'au_pack',name:'Empacador QA'}] },
        despachos:[ {encargados:[{id:'au_e1',name:'Enc Uno'}]}, {encargados:[{id:'au_e2',name:'Enc Dos'}]} ] } });
    ok('PATCH aprobar → 200', ap.status===200, {status:ap.status, e:ap.j&&ap.j.error});
    const tasks = await allTasks();
    const chain = tasks.filter(t=>t.sdvId===SID);
    const root = chain.find(t=>!t.parentId);
    const kids = chain.filter(t=>t.parentId===(root&&root.id)).sort((a,b)=>(a.odooRef>b.odooRef?1:-1));
    ok('cadena = 3 tareas (1 raíz + 2 hijas)', chain.length===3 && !!root && kids.length===2, {n:chain.length, types:chain.map(t=>t.type)});
    ok('raíz = packaging, odooRef joined, odooRefs array', root && root.type==='packaging' && root.odooRef==='S09516, S09517' && JSON.stringify(root.odooRefs)==='["S09516","S09517"]', {root:root&&{t:root.type,r:root.odooRef,rs:root.odooRefs}});
    ok('raíz sdvArticulos = 2 items con orderRef', root && (root.sdvArticulos||[]).length===2 && root.sdvArticulos.every(a=>a.orderRef), {a:root&&root.sdvArticulos});
    ok('raíz con seq; hijas sin seq', root && root.seq && kids.every(k=>!k.seq), {seq:root&&root.seq, kseq:kids.map(k=>k.seq)});
    const k1 = kids[0], k2 = kids[1];
    ok('hija 1: dispatch_order mono S09516 + subset [111] + título con orden',
      k1 && k1.type==='dispatch_order' && k1.odooRef==='S09516' && k1.odooRefs===undefined
      && (k1.sdvArticulos||[]).length===1 && k1.sdvArticulos[0].sku==='111' && k1.sdvArticulos[0].orderRef==='S09516'
      && /Despacho PAMELA YUNEN · S09516$/.test(k1.title), {k1:k1&&{r:k1.odooRef,a:k1.sdvArticulos,ti:k1.title}});
    ok('hija 2: mono S09517 + subset [222]',
      k2 && k2.odooRef==='S09517' && (k2.sdvArticulos||[]).length===1 && k2.sdvArticulos[0].sku==='222', {k2:k2&&{r:k2.odooRef,a:k2.sdvArticulos}});
    ok('hijas EN PARALELO: mismo subIndex=2 + dependsOnPrev=true (esperan el empaque)',
      kids.every(k=>k.subIndex===2 && k.dependsOnPrev===true && k.parentId===root.id), {k:kids.map(k=>({s:k.subIndex,d:k.dependsOnPrev}))});
    ok('encargados emparejados por índice (grupo i ↔ orden i)',
      k1 && k1.managerId==='au_e1' && k2 && k2.managerId==='au_e2' && k1.status==='assigned', {m:[k1&&k1.managerId,k2&&k2.managerId]});

    console.log('\n── 4. crear-tarea: validación estructura + solo_despacho forzado a empaque ──');
    const ct1 = await api('POST','/api/sdv/'+SID+'/crear-tarea',ADMIN,{ estructura:{ concepto:'empaque_despacho',
      despachos:[{},{},{}] } });
    ok('despachos(3) > órdenes(2) → 422', ct1.status===422, {status:ct1.status, e:ct1.j&&ct1.j.error});
    const ct2 = await api('POST','/api/sdv/'+SID+'/crear-tarea',ADMIN,{ estructura:{ concepto:'solo_despacho' } });
    ok('crear-tarea solo_despacho sobre multi → 200', ct2.status===200, {status:ct2.status, e:ct2.j&&ct2.j.error});
    const t2 = (await allTasks()).filter(t=>t.sdvId===SID && !chain.some(c=>c.id===t.id));
    const root2 = t2.find(t=>!t.parentId);
    ok('2ª cadena: raíz FORZADA a packaging + 2 hijas mono', root2 && root2.type==='packaging' && t2.filter(t=>t.parentId===root2.id).length===2, {types:t2.map(t=>({t:t.type,r:t.odooRef}))});

    console.log('\n── 5. by-order matchea cada orden del multi ──');
    const bo1 = await api('GET','/api/sdv/by-order?ref=S09517',ADMIN);
    ok('ref=S09517 → encuentra la SDV multi', bo1.status===200 && bo1.j && bo1.j.activa && bo1.j.activa.id===SID, {j:bo1.j});
    const bo2 = await api('GET','/api/sdv/by-order?ref=s09516',ADMIN);
    ok('ref=s09516 (case) → encuentra la SDV multi', bo2.status===200 && bo2.j && bo2.j.activa && bo2.j.activa.id===SID, {j:bo2.j});
    const bo3 = await api('GET','/api/sdv/by-order?ref=S09999',ADMIN);
    ok('ref=S09999 → encuentra la mono (regresión)', bo3.status===200 && bo3.j && bo3.j.activa && bo3.j.activa.id===MID, {j:bo3.j});

    console.log('\n── 6. Regresión mono: aprobación default = 1 tarea dispatch, sin odooRefs ──');
    const apM = await api('PATCH','/api/sdv/'+MID,ADMIN,{ estado:'en_proceso' });
    const tasksM = (await allTasks()).filter(t=>t.sdvId===MID);
    ok('mono default → 1 tarea dispatch_order, odooRef simple, SIN odooRefs',
      apM.status===200 && tasksM.length===1 && tasksM[0].type==='dispatch_order' && tasksM[0].odooRef==='S09999' && tasksM[0].odooRefs===undefined,
      {n:tasksM.length, t:tasksM[0]&&{ty:tasksM[0].type,r:tasksM[0].odooRef,rs:tasksM[0].odooRefs}});
    ok('mono sdvArticulos SIN campo orderRef (shape intacto)', tasksM[0] && (tasksM[0].sdvArticulos||[]).every(a=>!('orderRef' in a)), {a:tasksM[0]&&tasksM[0].sdvArticulos});

    console.log('\n── 7. pickstatus multi (con Odoo vivo si hay credenciales) ──');
    const ps = await api('GET','/api/sdv/'+SID+'/pickstatus',ADMIN);
    if (ps.j && ps.j.pickStatus===null && ps.j.odooError) {
      ok('pickstatus → 200 fail-open (Odoo caído, no crash)', ps.status===200, {j:ps.j});
    } else {
      const pj = ps.j||{};
      ok('pickstatus VIVO: multi:true + ordenes:2 + shape viejo (label/severity/code/outs)',
        ps.status===200 && pj.pickStatus && pj.pickStatus.multi===true && pj.pickStatus.ordenes===2
        && pj.pickStatus.label && pj.pickStatus.code && Array.isArray(pj.pickStatus.outs), {ps:pj.pickStatus});
      ok('pickstatus VIVO: porOrden[2] con ref por orden',
        Array.isArray(pj.porOrden) && pj.porOrden.length===2
        && pj.porOrden.map(o=>o.ref).sort().join(',')==='S09516,S09517'
        && pj.porOrden.every(o=>o.code && Array.isArray(o.outs)), {po:pj.porOrden&&pj.porOrden.map(o=>({ref:o.ref,code:o.code,outs:(o.outs||[]).map(x=>x.name)}))});
      console.log('   [vivo] porOrden:', JSON.stringify((pj.porOrden||[]).map(o=>({ref:o.ref,code:o.code,outs:(o.outs||[]).map(x=>x.name+':'+x.state)}))));
    }

    console.log('\n── 7b. Capa 1 sobre la raíz multi (GET /picks + sync-pick preview, read-only) ──');
    const rootId = (tasks.find(t=>t.sdvId===SID && !t.parentId)||{}).id;
    const gp = await api('GET','/api/wwp/tasks/'+rootId+'/picks',ADMIN);
    if (gp.status===503) {
      ok('GET /picks raíz multi → 503 honesto (Odoo caído)', true, {});
    } else {
      const pk = (gp.j&&gp.j.picks)||[];
      ok('GET /picks raíz multi → 200 + orderRefs[2] + picks de AMBAS órdenes',
        gp.status===200 && Array.isArray(gp.j.orderRefs) && gp.j.orderRefs.length===2
        && new Set(pk.map(p=>p.orderRef)).size===2, {n:pk.length, refs:gp.j&&gp.j.orderRefs, ords:[...new Set(pk.map(p=>p.orderRef))]});
      console.log('   [vivo] picks:', JSON.stringify(pk.map(p=>({n:p.name,st:p.state,cl:p.class,or:p.orderRef}))));
      const elegibles = pk.filter(p=>p.syncable && p.class!=='cancel' && /\/PICK\//i.test(p.name));
      if (elegibles.length>=2) {
        const sp = await api('POST','/api/wwp/tasks/'+rootId+'/sync-pick',ADMIN,{ pickIds: elegibles.map(p=>p.id), apply:false });
        const its = (sp.j&&sp.j.items)||[];
        const orSet = [...new Set(its.map(i=>i.orderRef).filter(Boolean))].sort();
        // OJO: la SDV del harness declara skus FICTICIOS ('111','222') contra órdenes REALES →
        // el presupuesto v113 (sdvArticulos) omite lo no-solicitado. La prueba de la CONCAT
        // multi-orden es que lo leído/omitido provenga de los picks de AMBAS órdenes.
        const omitPicks = [...new Set(((sp.j&&sp.j.omitted)||[]).map(o=>o.pickName))].sort();
        const tocoAmbas = orSet.length===2 || omitPicks.length>=2;
        ok('sync-pick preview raíz multi → 200 + el merge leyó los picks de AMBAS órdenes',
          sp.status===200 && sp.j && sp.j.applied===false && sp.j.resumen && tocoAmbas,
          {status:sp.status, n:its.length, orSet, omitPicks, e:sp.j&&sp.j.error});
        console.log('   [vivo] preview items:', its.length, '· resumen:', JSON.stringify(sp.j&&sp.j.resumen), '· omitidos de:', JSON.stringify(omitPicks));
      } else {
        console.log('   [vivo] <2 PICKs elegibles — preview no ejercitado (estado Odoo del momento)');
      }
    }

    // ── 8. UNIT (extracción del fuente real): getOrderClaims + buildPickMergeForTask multi ──
    console.log('\n── 8. Unit: getOrderClaims multi (extracción) ──');
    const src = fs.readFileSync(path.join(ROOT,'proxy.js'),'utf8').replace(/\r\n/g,'\n');
    const cut = (start)=>{ const i=src.indexOf(start); if(i<0) throw new Error('no encontré '+start.slice(0,40)); const j=src.indexOf('\n}\n', i); if(j<0) throw new Error('sin cierre para '+start.slice(0,40)); return src.slice(i, j+2); };
    const normRefSrc = 'function normRef(ref){ const m=(ref||\'\').match(/\\d+/); return m?String(parseInt(m[0],10)):\'\'; }';
    const claimsSrc = cut('function getOrderClaims(orderRef, excludeRootId)');
    const mkClaims = (tasksStub) => new Function('loadWwpTasks', normRefSrc + '\n' + claimsSrc + '\nreturn getOrderClaims;')(()=>tasksStub);
    const stubTasks = [
      { id:'wt_root', status:'in_progress', odooRef:'S09516, S09517', odooRefs:['S09516','S09517'], items:[
        { item_id:'a', selected:true, odoo_product_id:10, unit_index:1, orderRef:'S09516', product_name:'Mesa' },
        { item_id:'b', selected:true, odoo_product_id:20, unit_index:1, orderRef:'S09517', product_name:'Silla' },
        { item_id:'c', selected:true, odoo_product_id:30, unit_index:1, product_name:'SinRef' } ] },
      { id:'wt_mono', status:'assigned', odooRef:'S09516', items:[
        { item_id:'d', selected:true, odoo_product_id:40, unit_index:1, product_name:'Mono' } ] },
    ];
    const gc = mkClaims(stubTasks);
    const c16 = gc('S09516', null);
    ok('claims S09516: incluye pid10 (su orden) + pid30 (sin orderRef, conservador) + pid40 (mono); EXCLUYE pid20 (S09517)',
      !!c16[10] && !!c16[30] && !!c16[40] && !c16[20], {pids:Object.keys(c16)});
    const c17 = gc('S09517', null);
    ok('claims S09517: incluye pid20 + pid30; excluye pid10 y pid40', !!c17[20] && !!c17[30] && !c17[10] && !c17[40], {pids:Object.keys(c17)});
    const cEx = gc('S09516', 'wt_root');
    ok('excludeRootId=wt_root → solo queda el claim del mono (pid40)', !!cEx[40] && !cEx[10] && !cEx[30], {pids:Object.keys(cEx)});

    console.log('\n── 9. Unit: buildPickMergeForTask multi (stubs, concat + orderRef) ──');
    const mergeSrc = cut('async function buildPickMergeForTask(t, opts = {})');
    const partByRef = {
      'S09516': { noPick:false, pickNames:['ALVEN/PICK/15048'], picks:[{name:'ALVEN/PICK/15048',type:'pick',state:'assigned'}],
        items:[{ item_id:'oi_10_PICK15048', odoo_product_id:10, sku:'111', barcode:'111', product_name:'Mesa Dread',
          image:null, quantity:2, units:2, unitBins:['ALVEN/Stock/A1','ALVEN/Stock/A2'], pickName:'ALVEN/PICK/15048', fromPick:true }] },
      'S09517': { noPick:false, pickNames:['ALVEN/PICK/15045'], picks:[{name:'ALVEN/PICK/15045',type:'pick',state:'assigned'}],
        items:[{ item_id:'oi_20_PICK15045', odoo_product_id:20, sku:'222', barcode:'222', product_name:'Silla Tau',
          image:null, quantity:1, units:1, unitBins:['ALVEN/Stock/B1'], pickName:'ALVEN/PICK/15045', fromPick:true }] },
      'S09518': { noPick:true, items:[], picks:[], pickNames:[] },
    };
    const bifStub = async (ref)=>JSON.parse(JSON.stringify(partByRef[ref]||{noPick:true,items:[],picks:[],pickNames:[]}));
    const mkMerge = () => new Function('buildItemsFromPicks','getOrderClaims', mergeSrc + '\nreturn buildPickMergeForTask;')(bifStub, ()=>({}));
    const bpm = mkMerge();
    const rootT = { id:'wt_root', odooRef:'S09516, S09517', odooRefs:['S09516','S09517'], sdvId:'sdv_1', items:[],
      sdvArticulos:[ {sku:'111',quantity:2,orderRef:'S09516'}, {sku:'222',quantity:1,orderRef:'S09517'} ] };
    const m = await bpm(rootT);
    const mSkus = (m.merged||[]).map(i=>i.sku).sort().join(',');
    ok('multi root: merge concatena las 2 órdenes (3 unidades: 111×2 + 222×1)', m.ok && (m.merged||[]).length===3 && mSkus==='111,111,222', {n:m.merged&&m.merged.length, skus:mSkus, reason:m.reason});
    ok('cada unidad lleva SU orderRef', (m.merged||[]).every(i=>(i.sku==='111'?i.orderRef==='S09516':i.orderRef==='S09517')), {rows:(m.merged||[]).map(i=>({sku:i.sku,or:i.orderRef}))});
    ok('pickNames concatenados (los 2 picks)', JSON.stringify((m.pickNames||[]).sort())===JSON.stringify(['ALVEN/PICK/15045','ALVEN/PICK/15048']), {p:m.pickNames});
    const mPartial = await bpm({ ...rootT, odooRefs:['S09516','S09518'] });   // una orden sin pick
    ok('una orden sin pick → sigue con la otra (no noPick global)', mPartial.ok && !mPartial.noPick && (mPartial.merged||[]).length===2, {n:mPartial.merged&&mPartial.merged.length, noPick:mPartial.noPick});
    const mNone = await bpm({ ...rootT, odooRefs:['S09518'] });
    ok('todas sin pick → noPick:true', mNone.ok && mNone.noPick===true, {m:mNone});
    const monoT = { id:'wt_mono', odooRef:'S09516', sdvId:'sdv_2', items:[], sdvArticulos:[{sku:'111',quantity:2}] };
    const mMono = await bpm(monoT);
    ok('mono: 2 unidades SIN campo orderRef (ruta default intacta)', mMono.ok && (mMono.merged||[]).length===2 && mMono.merged.every(i=>!('orderRef' in i)), {rows:(mMono.merged||[]).map(i=>({sku:i.sku,or:i.orderRef}))});

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
