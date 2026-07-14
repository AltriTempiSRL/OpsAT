// _test_v193.mjs — Fix evidencias para Ventas: TODO el rol ventas ve TODAS las fotos de
// cualquier SDV (GET /api/sdv/:id/fotos). Antes: solo entrega+vehículo y solo la dueña
// (403 para otras vendedoras) → "dice 12 fotos y solo veo 2". Sin Odoo.
// Uso (desde la raíz): node tests/_test_v193.mjs
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

const PORT = 3294;
const BASE = `http://127.0.0.1:${PORT}`;
const ROOT = process.cwd();
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'testv193-'));
const FOTOS_DIR = path.join(DATA_DIR, 'wwp-fotos');

const now = new Date().toISOString();
const SDV = [{ id:'sdv_f', folio:'SD-T-F', creadoPor:'au_owner', creadoNombre:'Vendedora Dueña',
  estado:'despachada', tipoSolicitud:'despacho', odooOrderRef:'S_TEST', articulosOdoo:[] }];
fs.writeFileSync(path.join(DATA_DIR,'sdv-solicitudes.json'), JSON.stringify(SDV,null,2));
const TASK = [{ id:'wt_ev', seq:1, parentId:null, title:'Despacho Test', type:'dispatch_order',
  priority:'medium', status:'validated', sdvId:'sdv_f', managerId:'au_gsanchez', executors:[], assignees:[],
  items:[{ item_id:'oi_101_P_1', odoo_product_id:101, product_name:'Butaca Test', selected:true }],
  evidence:[], fotos_guia:[], statusHistory:[{status:'validated',date:now,by:'test'}],
  createdBy:'test', createdAt:now, updatedAt:now, odooRef:'S_TEST', dueDate:null }];
fs.writeFileSync(path.join(DATA_DIR,'wwp-tasks.json'), JSON.stringify(TASK,null,2));
// 5 fotos de tipos distintos: artículo, entrega, recepción, vehículo, guía
fs.mkdirSync(FOTOS_DIR, { recursive:true });
const FOTOS = ['wt_ev_oi_101_1700000000000_0.jpg','wt_ev_ent_1700000000001_0.jpg',
  'wt_ev_rec_1700000000002_0.jpg','wt_ev_veh_1700000000003_0.jpg','wt_ev_fg_1700000000004.jpg'];
FOTOS.forEach(f => fs.writeFileSync(path.join(FOTOS_DIR,f),'x'));

const b64u = b => Buffer.from(b).toString('base64url');
let SECRET=null;
function mint(userId, role, name){
  const h=b64u(JSON.stringify({alg:'HS256',typ:'JWT'})); const t=Math.floor(Date.now()/1000);
  const pl=b64u(JSON.stringify({userId,role,name,iat:t,exp:t+86400}));
  const s=crypto.createHmac('sha256',SECRET).update(`${h}.${pl}`).digest('base64url');
  return `${h}.${pl}.${s}`;
}
let _ipc=0; const nextIp=()=>{ const n=++_ipc; return `10.${(n>>16)&255}.${(n>>8)&255}.${n&255}`; };
async function api(p,token){
  const r=await fetch(BASE+p,{headers:{'X-Forwarded-For':nextIp(),...(token?{Authorization:'Bearer '+token}:{})}});
  let j=null; try{j=await r.json();}catch{}
  return {status:r.status,j};
}
const R=[]; const ok=(name,cond,detail)=>{ R.push({name,pass:!!cond}); console.log(`${cond?'✓':'✗'} ${name}${cond?'':'  → '+JSON.stringify(detail)}`); };
const countFotos = d => (d&&d.grupos||[]).reduce((s,g)=>s+(g.fotos||[]).length,0);
const tipos = d => [...new Set((d&&d.grupos||[]).flatMap(g=>(g.fotos||[]).map(f=>f.tipo)))].sort();
function waitReady(ms=20000){ const t0=Date.now(); return new Promise((res,rej)=>{ (async function poll(){ try{const r=await fetch(BASE+'/api/app-version'); if(r.ok)return res(true);}catch{} if(Date.now()-t0>ms)return rej(new Error('server no levantó')); setTimeout(poll,300); })(); }); }

(async ()=>{
  const srv = spawn('node',['proxy.js'],{ cwd:ROOT, env:{...process.env, DATA_DIR, PORT:String(PORT) } });
  let serr=''; srv.stderr.on('data',d=>serr+=d.toString());
  const cleanup=()=>{ try{srv.kill('SIGKILL');}catch{} try{fs.rmSync(DATA_DIR,{recursive:true,force:true});}catch{} };
  try{
    await waitReady();
    SECRET=fs.readFileSync(path.join(DATA_DIR,'.jwt-secret'),'utf8').trim();
    const OWNER = mint('au_owner','ventas','Vendedora Dueña');
    const OTRA  = mint('au_otra','ventas','Otra Vendedora');
    const ADMIN = mint('au_gsanchez','admin','Admin QA');
    const ASSIST= mint('au_assist','assistant','Auxiliar');

    console.log('\n── Ventas ve TODAS las fotos (antes: solo entrega+vehículo) ──');
    const o=await api('/api/sdv/sdv_f/fotos',OWNER);
    ok('vendedora dueña → 200 con las 5 fotos (antes 2)', o.status===200 && countFotos(o.j)===5, {status:o.status,n:countFotos(o.j),tipos:tipos(o.j)});
    ok('incluye artículo/recepción/guía (antes ocultos)', ['articulo','entrega','guia','recepcion','vehiculo'].every(t=>tipos(o.j).includes(t)), {tipos:tipos(o.j)});
    ok('soloEntregaVehiculo=false para ventas (sin nota "de tu pedido")', o.j && o.j.soloEntregaVehiculo===false, {flag:o.j&&o.j.soloEntregaVehiculo});

    console.log('\n── Ventas NO-dueña también ve (antes: 403) ──');
    const x=await api('/api/sdv/sdv_f/fotos',OTRA);
    ok('otra vendedora → 200 (antes 403 Sin acceso)', x.status===200, {status:x.status,err:x.j&&x.j.error});
    ok('otra vendedora ve las 5 fotos', countFotos(x.j)===5, {n:countFotos(x.j)});

    console.log('\n── Controles ──');
    const a=await api('/api/sdv/sdv_f/fotos',ADMIN);
    ok('admin sigue viendo todo (5)', a.status===200 && countFotos(a.j)===5, {status:a.status,n:countFotos(a.j)});
    const s=await api('/api/sdv/sdv_f/fotos',ASSIST);
    ok('rol sin acceso (assistant no dueño) → sigue 403', s.status===403, {status:s.status});

    console.log('\n── Front ──');
    const fh=await fetch(BASE+'/historial.html'); const ft=await fh.text();
    ok('historial.html 200 + build v193', fh.status===200 && ft.includes("APP_BUILD = 'v193'"), {status:fh.status});

    const fails=R.filter(r=>!r.pass).length;
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
