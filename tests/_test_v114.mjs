// _test_v114.mjs — Valida visibilidad de equipo en SDV (v114). Servidor aislado, sin Odoo.
//  - Ventas ve TODAS las solicitudes (GET lista + detalle + pickstatus)
//  - Escritura sigue siendo del dueño u Ops: PATCH/cancel de otra vendedora → 403
//  - Otros roles (assistant) siguen viendo solo las suyas
// Uso: node _test_v114.mjs
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

const PORT = 3297;
const BASE = `http://127.0.0.1:${PORT}`;
const ROOT = process.cwd();
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'testv114-'));

const b64u = b => Buffer.from(b).toString('base64url');
let SECRET=null;
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
const R=[]; const ok=(name,cond,detail)=>{ R.push({name,pass:!!cond}); console.log(`${cond?'✓':'✗'} ${name}${cond?'':'  → '+JSON.stringify(detail)}`); };
function waitReady(ms=20000){ const t0=Date.now(); return new Promise((res,rej)=>{ (async function poll(){ try{const r=await fetch(BASE+'/api/app-version'); if(r.ok)return res(true);}catch{} if(Date.now()-t0>ms)return rej(new Error('server no levantó')); setTimeout(poll,300); })(); }); }

(async ()=>{
  const srv = spawn('node',['proxy.js'],{ cwd:ROOT, env:{...process.env, DATA_DIR, PORT:String(PORT)} });
  let serr=''; srv.stderr.on('data',d=>serr+=d.toString());
  const cleanup=()=>{ try{srv.kill('SIGKILL');}catch{} try{fs.rmSync(DATA_DIR,{recursive:true,force:true});}catch{} };
  try{
    await waitReady();
    SECRET=fs.readFileSync(path.join(DATA_DIR,'.jwt-secret'),'utf8').trim();
    const V1=mint('au_vend1','ventas','Daniela');
    const V2=mint('au_vend2','ventas','Carolina');
    const AST=mint('au_aux1','assistant','Auxiliar');
    const ADM=mint('au_gsanchez','admin','Admin');

    // Daniela (V1) crea una solicitud
    const cr=await api('POST','/api/sdv',V1,{ tipoSolicitud:'despacho_cliente', odooOrderRef:'',
      clienteNombre:'CRISTINA AMELIA', ciudadEntrega:'Santo Domingo', direccionEntrega:'Torre Valentina IV',
      receptorNombre:'Claudia', receptorContacto:'809-555-0001',
      articulosOdoo:[{product_name:'St. Tropez Candle', sku:'882664010003', quantity:1}], observaciones:'test v114' });
    const sdv = cr.j && cr.j.solicitud;
    ok('V1 (ventas) crea SDV', !!sdv, {status:cr.status, err:cr.j&&cr.j.error});
    if (!sdv) throw new Error('sin SDV base');

    console.log('\n── Lectura: visibilidad de equipo (ventas) ──');
    const l2=await api('GET','/api/sdv',V2);
    ok('V2 (otra vendedora) VE la solicitud de V1 en la lista', (l2.j&&l2.j.solicitudes||[]).some(s=>s.id===sdv.id), {total:(l2.j&&l2.j.solicitudes||[]).length});
    const d2=await api('GET','/api/sdv/'+sdv.id,V2);
    ok('V2 abre el DETALLE de la solicitud de V1 (antes 403)', d2.status===200 && d2.j && d2.j.ok, {status:d2.status, err:d2.j&&d2.j.error});
    const p2=await api('GET','/api/sdv/'+sdv.id+'/pickstatus',V2);
    ok('V2 consulta pickstatus (antes 403)', p2.status===200 && p2.j && p2.j.ok, {status:p2.status, err:p2.j&&p2.j.error});
    const la=await api('GET','/api/sdv',ADM);
    ok('Admin sigue viendo todo', (la.j&&la.j.solicitudes||[]).some(s=>s.id===sdv.id), {});

    console.log('\n── Escritura: sigue siendo del dueño u Ops ──');
    const w2=await api('PATCH','/api/sdv/'+sdv.id,V2,{ receptorNombre:'Intrusa' });
    ok('V2 NO puede editar la solicitud de V1 (403)', w2.status===403, {status:w2.status, err:w2.j&&w2.j.error});
    const c2=await api('PATCH','/api/sdv/'+sdv.id+'?action=cancel',V2,{ motivo:'no debería poder', categoria:'otro' });
    ok('V2 NO puede cancelar la solicitud de V1 (403)', c2.status===403, {status:c2.status, err:c2.j&&c2.j.error});
    const w1=await api('PATCH','/api/sdv/'+sdv.id,V1,{ receptorNombre:'Claudia Fernandez' });
    ok('V1 (dueña) SÍ puede editar la suya', w1.status===200, {status:w1.status, err:w1.j&&w1.j.error});

    console.log('\n── Otros roles: sin cambio ──');
    const l3=await api('GET','/api/sdv',AST);
    ok('assistant NO ve solicitudes ajenas', !((l3.j&&l3.j.solicitudes||[]).some(s=>s.id===sdv.id)), {total:(l3.j&&l3.j.solicitudes||[]).length});
    const d3=await api('GET','/api/sdv/'+sdv.id,AST);
    ok('assistant detalle ajeno → 403', d3.status===403, {status:d3.status});

    const fh=await fetch(BASE+'/historial.html'); const ft=await fh.text();
    ok('historial.html 200 + build v114', fh.status===200 && ft.includes("APP_BUILD = 'v114'"), {status:fh.status});

    const fails=R.filter(x=>!x.pass).length;
    console.log(`\n═══ ${R.length-fails}/${R.length} pasaron ═══${fails?` · ${fails} FALLARON`:''}`);
    if (serr.trim() && fails) console.log('\n[stderr]\n'+serr.slice(0,2000));
    cleanup();
    process.exit(fails?1:0);
  } catch(e){
    console.error('ERROR:', e.message);
    if (serr.trim()) console.error('[stderr]\n'+serr.slice(0,2000));
    cleanup();
    process.exit(1);
  }
})();
