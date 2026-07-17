import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';

const root=path.resolve(import.meta.dirname,'..');
const chrome='C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const testDir=path.resolve(root,'tests');
const keepShots=process.env.MAP_KEEP_SHOTS==='1';
const shotDir=keepShots?testDir:fs.mkdtempSync(path.join(os.tmpdir(),'codex-map-shots-'));
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'codex-map-browser-'));
const freePort=()=>new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
let fixtureChild=null,child=null,ws=null,baseUrl=process.env.MAP_URL;
const stopTree=processHandle=>{
  if(!processHandle?.pid)return;
  try{
    if(process.platform==='win32')spawnSync('taskkill',['/PID',String(processHandle.pid),'/T','/F'],{stdio:'ignore',windowsHide:true});
    else processHandle.kill('SIGKILL');
  }catch{}
};
const removeTempTree=(target,prefix)=>{
  const full=path.resolve(target),tmp=path.resolve(os.tmpdir())+path.sep;
  if(!full.startsWith(tmp)||!path.basename(full).startsWith(prefix))throw new Error(`Ruta temporal no segura: ${full}`);
  for(let attempt=0;attempt<12&&fs.existsSync(full);attempt++){
    try{fs.rmSync(full,{recursive:true,force:true});}catch{}
    if(fs.existsSync(full))Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,75);
  }
};
let cleaned=false;
const cleanup=()=>{
  if(cleaned)return;
  cleaned=true;
  try{ws?.close();}catch{}
  stopTree(child);
  stopTree(fixtureChild);
  removeTempTree(profile,'codex-map-browser-');
  if(!keepShots)removeTempTree(shotDir,'codex-map-shots-');
};
process.on('exit',cleanup);
if(!baseUrl){
  const fixturePort=await freePort();baseUrl=`http://127.0.0.1:${fixturePort}/almacen-mapa.html`;
  fixtureChild=spawn(process.execPath,[path.join(testDir,'_mapa_visual_server.mjs')],{env:{...process.env,PORT:String(fixturePort)},stdio:'ignore',windowsHide:true});
  for(let i=0;i<80;i++){try{if((await fetch(baseUrl)).ok)break;}catch{}if(i===79)throw new Error('El servidor visual de prueba no inició.');await new Promise(r=>setTimeout(r,100));}
}
const port=await freePort();
child=spawn(chrome,[
  '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-extensions','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl','--ignore-gpu-blocklist',
  `--remote-debugging-port=${port}`,`--user-data-dir=${profile}`,'--window-size=1600,1000','about:blank'
],{stdio:'ignore',windowsHide:true});

const sleep=ms=>new Promise(r=>setTimeout(r,ms));

try{
  let target;
  for(let i=0;i<100;i++){
    try{const list=await fetch(`http://127.0.0.1:${port}/json/list`).then(r=>r.json());target=list.find(x=>x.type==='page');if(target)break;}catch{}
    await sleep(100);
  }
  if(!target)throw new Error('Chrome DevTools no abrió una página.');
  ws=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
  let nextId=0;const pending=new Map(),exceptions=[];
  const exceptionText=detail=>{
    const where=[detail?.url,detail?.lineNumber!=null?detail.lineNumber+1:null,detail?.columnNumber!=null?detail.columnNumber+1:null].filter(v=>v!=null&&v!=='').join(':');
    return detail?.exception?.description||`${detail?.text||'Runtime exception'}${where?` @ ${where}`:''}`;
  };
  ws.addEventListener('message',event=>{
    const msg=JSON.parse(event.data);
    if(msg.id&&pending.has(msg.id)){const {resolve,reject,timer}=pending.get(msg.id);clearTimeout(timer);pending.delete(msg.id);msg.error?reject(new Error(msg.error.message)):resolve(msg.result);}
    if(msg.method==='Runtime.exceptionThrown')exceptions.push(exceptionText(msg.params.exceptionDetails));
  });
  ws.addEventListener('close',()=>{for(const {reject,timer} of pending.values()){clearTimeout(timer);reject(new Error('Chrome cerró la conexión CDP.'));}pending.clear();});
  const send=(method,params={})=>new Promise((resolve,reject)=>{
    const id=++nextId,timer=setTimeout(()=>{pending.delete(id);reject(new Error(`Timeout CDP: ${method}`));},15000);
    pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));
  });
  const evaluate=async expression=>{
    const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
    if(result.exceptionDetails)throw new Error(exceptionText(result.exceptionDetails));
    return result.result.value;
  };
  await send('Runtime.enable');await send('Page.enable');await send('Network.enable');
  await send('Page.navigate',{url:baseUrl});
  let mapReady=false;
  for(let i=0;i<160;i++){
    const ready=await evaluate(`document.readyState==='complete' && document.getElementById('loading-overlay')?.style.display==='none'`);
    if(ready){mapReady=true;break;}await sleep(100);
  }
  if(!mapReady){const state=await evaluate(`({url:location.href,ready:document.readyState,display:document.getElementById('loading-overlay')?.style.display,classes:document.getElementById('loading-overlay')?.className,msg:document.getElementById('loading-msg')?.textContent,sub:document.getElementById('loading-sub')?.textContent,init:typeof initMap,scripts:[...document.scripts].map(x=>x.src||'inline'),resources:performance.getEntriesByType('resource').map(x=>x.name)})`);throw new Error('El mapa no terminó de cargar: '+JSON.stringify({state,exceptions}));}
  await sleep(600);
  const checks=await evaluate(`(()=>({
    title:document.querySelector('.topbar h1')?.textContent,
    bins:document.getElementById('st-total')?.textContent,
    occupied:document.getElementById('st-occupied')?.textContent,
    search:!!document.getElementById('warehouse-search'),
    statusFilter:!!document.getElementById('filter-status'),
    panelsClosed:document.getElementById('warehouse-layout')?.classList.contains('no-left')&&document.getElementById('warehouse-layout')?.classList.contains('no-right'),
    overflow:document.documentElement.scrollWidth<=document.documentElement.clientWidth,
    engine:(typeof GL!=='undefined'&&GL.on)||getComputedStyle(document.getElementById('gl-fallback-note')).display==='block',
    engineMode:typeof GL!=='undefined'&&GL.on?'WebGL':'fallback 2.5D'
  }))()`);
  const logic=await evaluate(`(()=>{
    const codes=rackBinCodes(),partial=codes.find(c=>calcUtil(c).partial),over=codes.find(c=>calcUtil(c).ok&&calcUtil(c).pct>100);
    const aggregated=codes.every(c=>new Set(_binMap[c].items.map(x=>x.prodId)).size===_binMap[c].items.length);
    const exactAggregate=_binMap.AB3.items.length===1&&_binMap.AB3.items[0].prodId===101&&_binMap.AB3.items[0].qty===3;
    const actualOnly=!_binMap.BE2&&!_binMap.GD4&&!codes.includes('BE2')&&!codes.includes('GD4');
    const duplicateLocation=_binMap.AC1.locIds.length===2&&_binMap.AC1.items.some(x=>x.prodId===102&&x.qty===2);
    const searchCount=findWarehouse('AT-CHAIR').length;
    const status=document.getElementById('filter-status');status.value='high';status.dispatchEvent(new Event('change',{bubbles:true}));
    const filtered=filteredRackCodes(),filterOk=filtered.length>0&&filtered.length<codes.length&&filtered.every(c=>binStatus(c)==='high');
    document.getElementById('btn-clear-filters').click();
    const input=document.getElementById('warehouse-search');input.value='ZZ99';input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
    const invalid=!document.getElementById('search-results').hidden&&document.getElementById('search-results').textContent.includes('No encontramos');
    input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));document.activeElement?.blur();
    return{partial:!!partial,over100:!!over,aggregated,exactAggregate,actualOnly,duplicateLocation,searchCount,filterOk,invalid,typeB:getDim('CA1').h===55&&getDim('EA1').h===65,multiLevel:!!_binMap.AA10&&LVLS_BY_ROW.A===10,lazyImages:Object.values(_prodMap).every(p=>p.image===null)};
  })()`);
  const assertions={
    'título rediseñado':checks.title==='Mapa de almacén',
    'bins reales cargados':Number(checks.bins)===219,
    'stock cargado':Number(checks.occupied)>0,
    'buscador presente':checks.search,
    'filtro de estado presente':checks.statusFilter,
    'paneles cerrados al iniciar':checks.panelsClosed,
    'sin overflow horizontal desktop':checks.overflow,
    'motor 3D o fallback compatible activo':checks.engine,
    'sin excepciones durante la carga':exceptions.length===0,
    'búsqueda encuentra referencias':logic.searchCount>0,
    'quants duplicados quedan agregados':logic.aggregated,
    'cantidad agregada exacta':logic.exactAggregate,
    'sin huecos virtuales inventados':logic.actualOnly,
    'colisiones de nombre consolidan location_id':logic.duplicateLocation,
    'capacidad parcial se identifica':logic.partial,
    'sobrecapacidad no se recorta a 100%':logic.over100,
    'filtro de estado usa predicado único':logic.filterOk,
    'búsqueda inválida devuelve feedback':logic.invalid,
    'tipo B se limita a filas C/D':logic.typeB,
    'niveles de dos dígitos soportados':logic.multiLevel,
    'imágenes permanecen lazy al iniciar':logic.lazyImages
  };
  for(const [name,pass] of Object.entries(assertions))console.log(pass?'✓':'✗',name);
  console.log('· motor activo:',checks.engineMode);
  if(exceptions.length)console.error(exceptions);

  const capture=async(name,width,height,mobile=false)=>{
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});await sleep(250);
    const data=(await send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false})).data;
    fs.writeFileSync(path.join(shotDir,name),Buffer.from(data,'base64'));
    return evaluate(`({w:innerWidth,h:innerHeight,overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth})`);
  };
  const desktop=await capture('_mapa-desktop.png',1600,1000,false);
  await evaluate(`document.getElementById('btn-view-plant').click();true`);await sleep(400);const plant=await capture('_mapa-plant.png',1366,768,false);
  await evaluate(`document.getElementById('btn-view-rack').click();true`);await sleep(300);const rack=await capture('_mapa-rack.png',1366,768,false);
  await evaluate(`const code=rackBinCodes().find(c=>_binMap[c].items.length);document.querySelector('#canvas-2d-wrap [data-bin="'+code+'"]')?.click();document.getElementById('btn-view-3d').click();true`);
  await evaluate(`document.getElementById('tgl-left').click();true`);await sleep(180);
  const settings=await capture('_mapa-settings.png',1366,768,false);
  await evaluate(`document.getElementById('tgl-left').click();true`);
  await sleep(250);
  const detail=await capture('_mapa-detail.png',1366,768,false);
  await evaluate(`document.getElementById('btn-theme').click();true`);await sleep(200);
  const tablet=await capture('_mapa-tablet-dark.png',1024,768,false);
  const mobile=await capture('_mapa-mobile-dark.png',390,844,true);
  const responsive=await evaluate(`(()=>({overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,bottomSheet:getComputedStyle(document.querySelector('.side-right')).position==='absolute',detailOpen:!document.getElementById('warehouse-layout').classList.contains('no-right'),touchTargets:[...document.querySelectorAll('.toolbar-btn,.view-btn,.rot-btn,.panel-close,.header-btn')].filter(x=>x.getClientRects().length).every(x=>x.getBoundingClientRect().height>=40)}))()`);
  console.log(!desktop.overflow?'✓':'✗','desktop 1600 sin overflow');
  console.log(!plant.overflow?'✓':'✗','vista Planta sin overflow');
  console.log(!rack.overflow?'✓':'✗','vista Rack sin overflow');
  console.log(!settings.overflow?'✓':'✗','configuración desktop sin overflow');
  console.log(!detail.overflow?'✓':'✗','laptop 1366 sin overflow');
  console.log(!tablet.overflow?'✓':'✗','tablet 1024 sin overflow');
  console.log(!mobile.overflow&&!responsive.overflow?'✓':'✗','móvil 390 sin overflow');
  console.log(responsive.bottomSheet&&responsive.detailOpen?'✓':'✗','detalle móvil como bottom sheet abierto');
  console.log(responsive.touchTargets?'✓':'✗','targets toolbar móvil de al menos 40px');
  console.log(exceptions.length===0?'✓':'✗','sin excepciones durante la interacción');
  if(exceptions.length)console.error(exceptions);
  if(Object.values(assertions).some(x=>!x)||exceptions.length||desktop.overflow||plant.overflow||rack.overflow||settings.overflow||detail.overflow||tablet.overflow||mobile.overflow||responsive.overflow||!responsive.bottomSheet||!responsive.detailOpen||!responsive.touchTargets)process.exitCode=1;
}finally{
  cleanup();
}
