// _test_v212.mjs — Cambiar el OUT confirmado (out-unconfirm): el encargado eligió el
// OUT equivocado en el drawer y necesita deshacer la confirmación para re-elegir.
//   POST /api/wwp/tasks/:id/out-unconfirm
//   - 200: limpia confirmedOutRef/confirmedAt/By/reconOk/warningB, candidatos intactos.
//   - 422 outDone: si el OUT ya está done (guardado O en vivo en Odoo) el ciclo cerró
//     y no se cambia; el live-done además se persiste (self-heal como /out-badge).
//   - 422 sin confirmación previa / tipo no despacho; 403 no participante sin edit_task.
//   - Ciclo completo: unconfirm → out-confirm de OTRO OUT vuelve a sellar.
// Con Odoo FALSO local. Cero datos live.
// Uso (desde la raíz): node tests/_test_v212.mjs
import { spawn } from 'child_process';
import https from 'https';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

const FAKE_PORT = 3392;
const PORT = 3398;
const BASE = `http://127.0.0.1:${PORT}`;
const ROOT = process.cwd();
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'testv212-'));

// ── Odoo FALSO: estado por nombre de OUT ─────────────────────────────────────
const OUTSTATES = {
  'ALVEN/OUT/07573': 'assigned',   // el equivocado (aún no done) → se puede cambiar
  'ALVEN/OUT/07574': 'assigned',   // el correcto → re-confirmable
  'ALVEN/OUT/07575': 'done',       // done en vivo (guard + self-heal)
  'ALVEN/OUT/07576': 'done'        // done guardado
};
const TLS = { key: fs.readFileSync(path.join(ROOT,'_fakekey.pem')), cert: fs.readFileSync(path.join(ROOT,'_fakecert.pem')) };
const fake = https.createServer(TLS, (req, res) => {
  let body=''; req.on('data',c=>body+=c); req.on('end',()=>{
    let p={}; try{p=JSON.parse(body);}catch{}
    const params = p.params || p;
    const reply = result => { res.writeHead(200,{'Content-Type':'application/json'}); res.end(JSON.stringify({jsonrpc:'2.0',id:p.id,result})); };
    if (params.service==='common' && (params.method==='authenticate'||params.method==='login')) return reply(98);
    if (params.service==='object' && params.method==='execute_kw') {
      const a = params.args||[]; const model=a[3]; const domain=(a[5]||[])[0]||[];
      if (model==='stock.picking') {
        const c = domain.find(x=>Array.isArray(x)&&x[0]==='name');
        const name = c ? String(c[2]) : '';
        return reply(OUTSTATES[name] ? [{ id:1, name, state:OUTSTATES[name] }] : []);
      }
      if (model==='stock.move.line' || model==='stock.move') return reply([]);
      return reply([]);
    }
    reply(null);
  });
});

// ── Fixtures: despachos completados con obligación outPendiente ─────────────
const now = new Date().toISOString();
const CANDS = [ { name:'ALVEN/OUT/07573', state:'assigned' }, { name:'ALVEN/OUT/07574', state:'assigned' } ];
const dispatch = (id, op, extra) => ({
  id, seq:null, parentId:null, title:'Despacho '+id, type:'dispatch_order', description:'',
  priority:'medium', status:'completed', assignedTo:null, managerId:'au_gsanchez', managerName:'Admin QA',
  executors:[], assignees:[], location:'', dueDate:null, actionNote:'', items:[],
  evidence:[], fotos_guia:[], statusHistory:[{status:'completed',date:now,by:'test'}],
  createdBy:'test', createdAt:now, updatedAt:now, outPendiente: op, ...extra
});
const opConfirmed = (ref, outState) => ({
  since: now, sugerido:'ALVEN/OUT/07573', candidatos: CANDS,
  confirmedOutRef: ref, confirmedAt: now, confirmedBy:'au_gsanchez',
  reconOk: true, outState: outState, warningB: [ { product_name:'Aya Low Armchair' } ]
});
const FIX = [
  // T1/T2/T6: confirmado por error, OUT aún assigned → cambiable; luego re-confirmar otro
  dispatch('wt_wrong',  opConfirmed('ALVEN/OUT/07573','assigned')),
  // T3: done GUARDADO → 422
  dispatch('wt_donest', opConfirmed('ALVEN/OUT/07576','done')),
  // T4: guardado desactualizado (assigned) pero Odoo dice done EN VIVO → 422 + self-heal
  dispatch('wt_donelv', opConfirmed('ALVEN/OUT/07575','assigned')),
  // T5a: RBAC — asistente NO participante → 403
  dispatch('wt_rbac',   opConfirmed('ALVEN/OUT/07573','assigned')),
  // T5b: manager (edit_task) sin ser participante → permitido
  dispatch('wt_mgr',    opConfirmed('ALVEN/OUT/07573','assigned')),
  // T2b: sin confirmación previa → 422
  dispatch('wt_nocnf',  { since: now, sugerido:'ALVEN/OUT/07573', candidatos: CANDS, confirmedOutRef:null, confirmedAt:null, reconOk:null }),
  // T6b: tipo no despacho → 422
  { ...dispatch('wt_pack', opConfirmed('ALVEN/OUT/07573','assigned')), type:'packaging' }
];
fs.writeFileSync(path.join(DATA_DIR,'wwp-tasks.json'), JSON.stringify(FIX,null,2));

// ── JWT + helpers ────────────────────────────────────────────────────────────
const b64u = b => Buffer.from(b).toString('base64url');
let SECRET=null, ADMIN=null, MGR=null, AUX=null;
function mint(userId, role, name){
  const h=b64u(JSON.stringify({alg:'HS256',typ:'JWT'})); const t=Math.floor(Date.now()/1000);
  const pl=b64u(JSON.stringify({userId,role,name,iat:t,exp:t+86400}));
  const s=crypto.createHmac('sha256',SECRET).update(`${h}.${pl}`).digest('base64url');
  return `${h}.${pl}.${s}`;
}
let _ipc=0; const nextIp=()=>{ const n=++_ipc; return `10.${(n>>16)&255}.${(n>>8)&255}.${n&255}`; };
async function api(method,p,token,body){
  const r=await fetch(BASE+p,{method,headers:{'Content-Type':'application/json','X-Forwarded-For':nextIp(),...(token?{Authorization:'Bearer '+token}:{})},body:body!==undefined?JSON.stringify(body):undefined});
  let j=null; try{j=await r.json();}catch{}
  return { status:r.status, j };
}
async function getTask(id){
  const r=await api('GET','/api/wwp/tasks',ADMIN);
  const list=(r.j&&(r.j.tasks||r.j.list))||(Array.isArray(r.j)?r.j:[]);
  return list.find(t=>t.id===id);
}
const R=[]; const ok=(name,cond,detail)=>{ R.push({name,pass:!!cond}); console.log(`${cond?'✓':'✗'} ${name}${cond?'':'  → '+JSON.stringify(detail)}`); };
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
    ADMIN=mint('au_gsanchez','admin','Admin QA');
    MGR=mint('au_fcandelario','manager','Manager QA');
    AUX=mint('au_albert','assistant','Aux QA');

    console.log('\n── T1 · unconfirm feliz: OUT confirmado por error, aún no done ──');
    const u1=await api('POST','/api/wwp/tasks/wt_wrong/out-unconfirm',ADMIN);
    ok('200 ok', u1.status===200 && u1.j && u1.j.ok===true, u1);
    const t1=await getTask('wt_wrong');
    const op1=t1&&t1.outPendiente||{};
    ok('confirmedOutRef quedó null', op1.confirmedOutRef===null, {op:op1});
    ok('confirmedAt/By limpios', op1.confirmedAt===null && op1.confirmedBy===null, {op:op1});
    ok('warningB limpio', Array.isArray(op1.warningB) && op1.warningB.length===0, {warnB:op1.warningB});
    ok('candidatos intactos (el selector re-abre con 2)', (op1.candidatos||[]).length===2, {cands:op1.candidatos});
    ok('sugerido se conserva', op1.sugerido==='ALVEN/OUT/07573', {sug:op1.sugerido});

    console.log('\n── T2 · sin confirmación que deshacer → 422 ──');
    const u2=await api('POST','/api/wwp/tasks/wt_wrong/out-unconfirm',ADMIN);
    ok('re-unconfirm → 422', u2.status===422, u2);
    const u2b=await api('POST','/api/wwp/tasks/wt_nocnf/out-unconfirm',ADMIN);
    ok('nunca confirmado → 422', u2b.status===422, u2b);

    console.log('\n── T3 · OUT done GUARDADO → 422 outDone (ciclo cerrado) ──');
    const u3=await api('POST','/api/wwp/tasks/wt_donest/out-unconfirm',ADMIN);
    ok('422 + outDone:true', u3.status===422 && u3.j && u3.j.outDone===true, u3);
    const t3=await getTask('wt_donest');
    ok('la confirmación NO se tocó', t3&&t3.outPendiente&&t3.outPendiente.confirmedOutRef==='ALVEN/OUT/07576', {op:t3&&t3.outPendiente});

    console.log('\n── T4 · OUT done EN VIVO (guardado desactualizado) → 422 + self-heal ──');
    const u4=await api('POST','/api/wwp/tasks/wt_donelv/out-unconfirm',ADMIN);
    ok('422 + outDone:true', u4.status===422 && u4.j && u4.j.outDone===true, u4);
    const t4=await getTask('wt_donelv');
    ok('self-heal: outState persistido como done', t4&&t4.outPendiente&&t4.outPendiente.outState==='done', {op:t4&&t4.outPendiente});
    ok('la confirmación NO se tocó', t4&&t4.outPendiente&&t4.outPendiente.confirmedOutRef==='ALVEN/OUT/07575', {op:t4&&t4.outPendiente});

    console.log('\n── T5 · RBAC: asistente no participante 403; manager (edit_task) sí ──');
    const u5=await api('POST','/api/wwp/tasks/wt_rbac/out-unconfirm',AUX);
    ok('asistente no participante → 403', u5.status===403, u5);
    const t5=await getTask('wt_rbac');
    ok('la confirmación sigue intacta tras el 403', t5&&t5.outPendiente&&t5.outPendiente.confirmedOutRef==='ALVEN/OUT/07573', {op:t5&&t5.outPendiente});
    const u5b=await api('POST','/api/wwp/tasks/wt_mgr/out-unconfirm',MGR);
    ok('manager (edit_task) → 200', u5b.status===200 && u5b.j && u5b.j.ok===true, u5b);

    console.log('\n── T6 · ciclo completo: unconfirm → out-confirm del OUT correcto ──');
    const c6=await api('POST','/api/wwp/tasks/wt_wrong/out-confirm',ADMIN,{ outRef:'ALVEN/OUT/07574' });
    ok('re-confirmación del OUT correcto → 200', c6.status===200 && c6.j && c6.j.ok===true, c6);
    const t6=await getTask('wt_wrong');
    ok('confirmedOutRef ahora es el correcto', t6&&t6.outPendiente&&t6.outPendiente.confirmedOutRef==='ALVEN/OUT/07574', {op:t6&&t6.outPendiente});
    const u6=await api('POST','/api/wwp/tasks/wt_pack/out-unconfirm',ADMIN);
    ok('tipo no despacho → 422', u6.status===422, u6);

    console.log('\n── Auditoría ──');
    let audit=[]; try{ audit=JSON.parse(fs.readFileSync(path.join(DATA_DIR,'wwp-audit.json'),'utf8')); }catch{}
    const evs=(Array.isArray(audit)?audit:audit.entries||[]).filter(e=>e.event==='out_unconfirm');
    ok('appendAuditLog registró out_unconfirm (≥2: admin + manager)', evs.length>=2, {n:evs.length, sample:evs[0]});

    const fails=R.filter(x=>!x.pass).length;
    console.log(`\n${fails===0?'✅':'❌'} ${R.length-fails}/${R.length} pasaron`);
    if (fails && serr) console.log('\n[stderr del server]\n'+serr.slice(-3000));
    cleanup(); process.exit(fails?1:0);
  }catch(e){
    console.error('ERROR harness:', e);
    if (serr) console.log('\n[stderr del server]\n'+serr.slice(-3000));
    cleanup(); process.exit(1);
  }
})();
