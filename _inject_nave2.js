'use strict';
const fs=require('fs'), path=require('path'), crypto=require('crypto');
const DATA_DIR=process.env.DATA_DIR||'/data';
const DESPACHOS_FILE=path.join(DATA_DIR,'despachos-obsoleto.json');
const SEQ_FILE=path.join(DATA_DIR,'despacho-obsoleto-seq.json');
function loadJson(f,d){try{return JSON.parse(fs.readFileSync(f,'utf8'))}catch(e){return d}}
function saveJson(f,v){fs.writeFileSync(f,JSON.stringify(v,null,2))}
function uid(p){return p+'_'+Date.now()+'_'+crypto.randomBytes(4).toString('hex')}

const NAVE2=JSON.parse(fs.readFileSync(path.join(__dirname,'_nave2_data.json'),'utf8'));
const now=new Date().toISOString();
let despachos=loadJson(DESPACHOS_FILE,[]);

let d=despachos.find(x=>x.folio==='CO-0001');
if(!d){
  let seq=loadJson(SEQ_FILE,{seq:0});
  if(seq.seq<1) seq.seq=1;
  saveJson(SEQ_FILE,seq);
  d={
    id:uid('do'),folio:'CO-0001',seq:1,estado:'abierto',
    receptor:{nombre:'',empresa:'',telefono:'',cedula:''},
    lineas:[],creadoPor:'system-inject',creadoAt:now,updatedAt:now,
    entregadoAt:null,entregadoPor:null,notas:''
  };
  despachos.push(d);
  console.log('CO-0001 creado');
} else {
  console.log('CO-0001 encontrado — lineas previas:', d.lineas.length);
}

const existingPids=new Set((d.lineas||[]).map(l=>String(l.productId)));
let added=0, skipped=0;
NAVE2.forEach(function(item){
  if(existingPids.has(String(item.pid))){ skipped++; return; }
  d.lineas.push({
    lineId:uid('ln'),productId:item.pid,
    ref:item.ref||'',name:item.name||'',barcode:item.barcode||'',
    location:item.loc||'NAVE2/Existencias',
    qty:Math.round(item.qty)||1,
    condicion:'',
    aprobacion:'aprobado',
    motivoRechazo:'',aprobadoPor:'system-inject',aprobadoAt:now,
    fotos:[],createdAt:now,createdBy:'system-inject'
  });
  added++;
});
d.updatedAt=now;
saveJson(DESPACHOS_FILE,despachos);
console.log('Agregadas:',added,'| omitidas:',skipped);
console.log('Total lineas CO-0001:',d.lineas.length);
