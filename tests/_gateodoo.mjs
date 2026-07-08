// _gateodoo.mjs — Valida el GATE de picking de Odoo (proxy.js:7435) con un Odoo FALSO local.
// Cero datos live, cero alertas a usuarios reales. Prueba las ramas que el stress harness rodeó.
import { spawn } from 'child_process';
import https from 'https';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

const FAKE_PORT = 3290;
const PORT = 3299;
const BASE = `http://127.0.0.1:${PORT}`;
const ROOT = process.cwd();
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'gateodoo-'));
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const PHOTO = { data: PNG, ext: 'png' };

// ── Odoo FALSO: responde JSON-RPC con picks controlados según el "origin" ────
let fakeHits = [];
const TLS = { key: fs.readFileSync(path.join(ROOT,'_fakekey.pem')), cert: fs.readFileSync(path.join(ROOT,'_fakecert.pem')) };
const fake = https.createServer(TLS, (req, res) => {
  let body=''; req.on('data',c=>body+=c); req.on('end',()=>{
    let p={}; try{p=JSON.parse(body);}catch{}
    const params = p.params || p;
    const reply = result => { res.writeHead(200,{'Content-Type':'application/json'}); res.end(JSON.stringify({jsonrpc:'2.0',id:p.id,result})); };
    const replyErr = () => { res.writeHead(200,{'Content-Type':'application/json'}); res.end(JSON.stringify({jsonrpc:'2.0',id:p.id,error:{data:{message:'fake odoo caído'}}})); };
    if (params.service==='common' && params.method==='authenticate') return reply(98);
    if (params.service==='object' && params.method==='execute_kw') {
      const a = params.args||[]; const model=a[3]; const callArgs=a[5]||[]; const domain=callArgs[0]||[];
      if (model==='sale.order') {
        const c = domain.find(x=>x[0]==='name'); return reply([{ name: c ? String(c[2]) : '' }]);
      }
      if (model==='stock.picking') {
        const c = domain.find(x=>x[0]==='origin'); const origin = c ? String(c[2]) : '';
        fakeHits.push(origin);
        if (origin.includes('ODOODOWN'))  return replyErr();
        if (origin.includes('ALLCANCEL')) return reply([{id:2,name:'ALVEN/PICK/9001',state:'cancel',date_done:false},{id:3,name:'ALVEN/PICK/9002',state:'cancel',date_done:false}]);
        if (origin.includes('REPICK'))    return reply([{id:4,name:'ALVEN/PICK/9003',state:'cancel',date_done:false},{id:5,name:'ALVEN/PICK/9004',state:'done',date_done:'2026-06-23 10:00:00'}]);
        if (origin.includes('NOTDONE'))   return reply([{id:1,name:'ALVEN/PICK/0002',state:'assigned',date_done:false}]);
        if (origin.includes('NOPICK'))    return reply([{id:9,name:'ALVEN/OUT/0009', state:'assigned',date_done:false}]); // sin /PICK/
        return reply([{id:1,name:'ALVEN/PICK/0001',state:'done',date_done:'2026-06-23 10:00:00'}]); // ALLDONE
      }
      return reply([]);
    }
    reply(null);
  });
});

const b64u = b => Buffer.from(b).toString('base64url');
let SECRET=null, ADMIN=null;
function mint(userId, role, name){
  const h=b64u(JSON.stringify({alg:'HS256',typ:'JWT'})); const now=Math.floor(Date.now()/1000);
  const pl=b64u(JSON.stringify({userId,role,name,iat:now,exp:now+86400}));
  const s=crypto.createHmac('sha256',SECRET).update(`${h}.${pl}`).digest('base64url');
  return `${h}.${pl}.${s}`;
}
let _ipc=0; const nextIp=()=>{ const n=++_ipc; return `10.${(n>>16)&255}.${(n>>8)&255}.${n&255}`; };
async function api(method,p,token,body){
  const r=await fetch(BASE+p,{method,headers:{'Content-Type':'application/json','X-Forwarded-For':nextIp(),...(token?{Authorization:'Bearer '+token}:{})},body:body!==undefined?JSON.stringify(body):undefined});
  let raw=''; try{raw=await r.text();}catch{} let j=null; try{j=JSON.parse(raw);}catch{}
  return {status:r.status,j,raw};
}
const R=[]; const ok=(name,cond,detail)=>{ R.push({name,pass:!!cond,detail}); console.log(`${cond?'✓':'✗'} ${name}${cond?'':'  → '+JSON.stringify(detail)}`); };

async function newDispatchTask(odooRef, sdvId){
  const r=await api('POST','/api/wwp/tasks',ADMIN,{title:'Despacho gate '+odooRef,type:'dispatch_order',odooRef,sdvId,managerId:'au_gsanchez',createdBy:'au_gsanchez',by:'Admin'});
  return r.j&&r.j.task?r.j.task:null;
}
async function fotos(taskId){ for(const cat of ['recepcion','vehiculo','entrega']) await api('POST',`/api/wwp/tasks/${taskId}/fotos-${cat}`,ADMIN,{fotos:[PHOTO],by:'Admin'}); }

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
    ADMIN=mint('au_gsanchez','admin','Admin');
    const VENT=mint('au_qa_v1','ventas','Vendedora');

    // Crear una SDV real para vincular (vía ventas)
    const sdvRes=await api('POST','/api/sdv',VENT,{tipoSolicitud:'despacho_cliente',odooOrderRef:'S_ALLDONE',clienteNombre:'Cliente Gate',ciudadEntrega:'SD',articulosOdoo:[]});
    const sdvId=sdvRes.j&&sdvRes.j.solicitud?sdvRes.j.solicitud.id:null;
    ok('SDV creada para el caso real', !!sdvId, {status:sdvRes.status});

    console.log('\n── Rama A: pick DONE → debe PERMITIR in_progress y cerrar el 360 ──');
    const tA=await newDispatchTask('S_ALLDONE', sdvId);
    const ipA=await api('PATCH','/api/wwp/tasks/'+tA.id,ADMIN,{status:'in_progress',by:'Admin'});
    ok('A: in_progress permitido (pick done)', ipA.status===200, {status:ipA.status,err:ipA.j&&ipA.j.error});
    await fotos(tA.id);
    const cA=await api('PATCH','/api/wwp/tasks/'+tA.id,ADMIN,{status:'completed',by:'Admin'});
    const vA=await api('PATCH','/api/wwp/tasks/'+tA.id,ADMIN,{status:'validated',by:'Admin'});
    ok('A: completed', cA.status===200, {status:cA.status,err:cA.j&&cA.j.error});
    ok('A: validated', vA.status===200, {status:vA.status,err:vA.j&&vA.j.error});
    const sA=await api('GET','/api/sdv/'+sdvId,ADMIN);
    ok('A: SDV → despachada (360 cerrado CON gate Odoo real)', sA.j&&sA.j.solicitud&&sA.j.solicitud.estado==='despachada', {estado:sA.j&&sA.j.solicitud&&sA.j.solicitud.estado});

    console.log('\n── Rama B: pick NO terminado → debe BLOQUEAR (422) ──');
    const tB=await newDispatchTask('S_NOTDONE', null);
    const ipB=await api('PATCH','/api/wwp/tasks/'+tB.id,ADMIN,{status:'in_progress',by:'Admin'});
    ok('B: in_progress BLOQUEADO con 422', ipB.status===422, {status:ipB.status,err:ipB.j&&ipB.j.error});
    ok('B: mensaje correcto', /[Pp]icking/.test((ipB.j&&ipB.j.error)||''), {err:ipB.j&&ipB.j.error});
    const allTB=(await api('GET','/api/wwp/tasks',ADMIN)).j; const tB2=(Array.isArray(allTB)?allTB:[]).find(t=>t.id===tB.id);
    // status sigue pending/assigned, NO in_progress
    ok('B: la tarea NO avanzó a in_progress', tB2 && tB2.status!=='in_progress', {status:tB2&&tB2.status});

    console.log('\n── Rama C: sin pick /PICK/ → debe PERMITIR (no hay pick que esperar) ──');
    const tC=await newDispatchTask('S_NOPICK', null);
    const ipC=await api('PATCH','/api/wwp/tasks/'+tC.id,ADMIN,{status:'in_progress',by:'Admin'});
    ok('C: in_progress permitido (sin PICK)', ipC.status===200, {status:ipC.status,err:ipC.j&&ipC.j.error});

    console.log('\n── Rama D: Odoo CAÍDO → fail-open (permite, no congela ops) ──');
    const tD=await newDispatchTask('S_ODOODOWN', null);
    const ipD=await api('PATCH','/api/wwp/tasks/'+tD.id,ADMIN,{status:'in_progress',by:'Admin'});
    ok('D: in_progress permitido pese a Odoo caído (fail-open)', ipD.status===200, {status:ipD.status,err:ipD.j&&ipD.j.error});

    console.log('\n── Rama E: TODOS los picks cancel (anulado) → debe BLOQUEAR 422 ──');
    const tE=await newDispatchTask('S_ALLCANCEL', null);
    const ipE=await api('PATCH','/api/wwp/tasks/'+tE.id,ADMIN,{status:'in_progress',by:'Admin'});
    ok('E: in_progress BLOQUEADO 422 (todos cancel)', ipE.status===422, {status:ipE.status,err:ipE.j&&ipE.j.error});
    ok('E: mensaje indica "anulado"', /anulad/i.test((ipE.j&&ipE.j.error)||''), {err:ipE.j&&ipE.j.error});

    console.log('\n── Rama F: re-pick (1 cancel anulado + 1 done) → debe PERMITIR ──');
    const tF=await newDispatchTask('S_REPICK', null);
    const ipF=await api('PATCH','/api/wwp/tasks/'+tF.id,ADMIN,{status:'in_progress',by:'Admin'});
    ok('F: in_progress permitido (el done vale, el cancel se ignora)', ipF.status===200, {status:ipF.status,err:ipF.j&&ipF.j.error});

    const hitDone = fakeHits.some(o=>o.includes('ALLDONE'));
    const hitNot  = fakeHits.some(o=>o.includes('NOTDONE'));
    ok('El gate SÍ consultó a Odoo (read-only) en A y B', hitDone && hitNot, {fakeHits});

    const passed=R.filter(x=>x.pass).length, failed=R.filter(x=>!x.pass).length;
    console.log(`\n================ GATE ODOO ================`);
    console.log(`PASS: ${passed}  ·  FAIL: ${failed}`);
    console.log(failed===0 ? 'VEREDICTO: VERDE — gate validado con Odoo falso, sin tocar datos live' : 'VEREDICTO: HAY FALLOS');
    console.log(`Llamadas al Odoo falso (solo lectura search_read): ${JSON.stringify(fakeHits)}`);
    console.log('==========================================');
  }catch(e){ console.error('ERROR:',e.message); if(serr) console.error('STDERR tail:',serr.slice(-800)); }
  finally{ cleanup(); }
})();
