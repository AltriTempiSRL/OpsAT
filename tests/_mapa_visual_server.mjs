import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const port=Number(process.env.PORT||3047);
const rows=['A','B','C','D','E','F','G','H'];
const cols=['A','B','C','D','E'];
const omitted=new Set(['BE2','GD4']);
const locations=[{id:1,name:'A-CDP',complete_name:'WH/A-CDP'}];
let locId=10;
for(const row of rows)for(const col of cols)for(let level=1;level<=(row==='C'||row==='D'?7:5);level++){
  const code=`${row}${col}${level}`;
  if(!omitted.has(code))locations.push({id:locId++,name:code,complete_name:`WH/A-CDP/${code}`});
}
locations.push({id:898,name:'AA10',complete_name:'WH/A-CDP/AA10'});
locations.push({id:900,name:'Frontal',complete_name:'WH/A-CDP/Frontal'});
locations.push({id:901,name:'AC1',complete_name:'WH/A-CDP-OVERFLOW/AC1'});

const products=[
  {id:101,default_code:'AT-CHAIR-01',name:'Silla tapizada Siena',barcode:'746000000101',description_purchase:'50 x 40 x 30'},
  {id:102,default_code:'AT-LAMP-02',name:'Lámpara de mesa Ámbar',barcode:'746000000102',description_purchase:'35 x 35 x 48'},
  {id:103,default_code:'AT-TABLE-03',name:'Mesa auxiliar Roble',barcode:'746000000103',description_purchase:'80 x 65'},
  {id:104,default_code:'AT-VASE-04',name:'Jarrón artesanal Arena',barcode:'746000000104',description_purchase:''},
  {id:105,default_code:'AT-SOFA-05',name:'Módulo sofá Lino',barcode:'746000000105',description_purchase:'100 x 80 x 40'}
];
const locByName={};locations.forEach(x=>{if(!locByName[x.name])locByName[x.name]=x;});
const quants=[];
const add=(bin,prod,qty)=>quants.push({product_id:[prod,products.find(p=>p.id===prod)?.name||'Producto'],location_id:[locByName[bin].id,locByName[bin].complete_name],quantity:qty});
let i=0;
for(const row of rows)for(const col of cols)for(let level=1;level<=(row==='C'||row==='D'?7:5);level++){
  const code=`${row}${col}${level}`,mod=i++%9;if(!locByName[code])continue;
  if(mod===0)continue;
  if(mod===1)add(code,101,3);
  if(mod===2)add(code,101,7);
  if(mod===3)add(code,105,3);
  if(mod===4)add(code,103,2);
  if(mod===5){add(code,101,2);add(code,104,3);}
  if(mod===6)add(code,102,4);
  if(mod===7){add(code,101,2);add(code,101,1);}
  if(mod===8)add(code,105,1);
}
add('AA10',102,2);
add('Frontal',104,18);add('Frontal',102,6);
quants.push({product_id:[102,products.find(p=>p.id===102).name],location_id:[901,'WH/A-CDP-OVERFLOW/AC1'],quantity:2});

const type={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.png':'image/png','.svg':'image/svg+xml'};
const send=(res,status,data,contentType)=>{res.writeHead(status,{'Content-Type':contentType});res.end(data);};
const page=(items,kwargs={})=>items.slice(Number(kwargs.offset)||0,(Number(kwargs.offset)||0)+(Number(kwargs.limit)||items.length));
const allowedFiles=new Map([
  ['/almacen-mapa.html','almacen-mapa.html'],['/almacen-mapa.css','almacen-mapa.css'],
  ['/three.min.js','three.min.js'],['/OrbitControls.js','OrbitControls.js'],['/lucide.min.js','lucide.min.js']
]);

http.createServer((req,res)=>{
  (async()=>{
    const url=new URL(req.url,'http://localhost');
    if(url.pathname==='/api/odoo'&&req.method==='POST'){
      let raw='';for await(const chunk of req)raw+=chunk;
      const body=JSON.parse(raw||'{}');let result=[];
      if(body.method!=='search_read'||!['stock.location','stock.quant','product.product'].includes(body.model))return send(res,400,JSON.stringify({ok:false,error:'Contrato Odoo no soportado por la fixture.'}),'application/json; charset=utf-8');
      if(body.model==='stock.location')result=page(locations,body.kwargs);
      if(body.model==='stock.quant')result=page(quants,body.kwargs);
      if(body.model==='product.product'){
        const domain=body.args?.[0]||[],ids=domain.find(x=>x[0]==='id'&&(x[1]==='in'||x[1]==='='));
        const wanted=ids?(ids[1]==='in'?ids[2]:[ids[2]]):products.map(p=>p.id);
        result=products.filter(p=>wanted.includes(p.id)).map(p=>body.kwargs?.fields?.includes('image_128')?{id:p.id,image_128:false}:p);
      }
      return send(res,200,JSON.stringify({ok:true,result}),'application/json; charset=utf-8');
    }
    let pathname=url.pathname;if(pathname==='/')pathname='/almacen-mapa.html';
    const relative=allowedFiles.get(pathname);
    if(req.method!=='GET'||!relative)return send(res,404,'Not found','text/plain; charset=utf-8');
    const target=path.join(root,relative);
    if(!fs.existsSync(target))return send(res,404,'Not found','text/plain; charset=utf-8');
    return send(res,200,fs.readFileSync(target),type[path.extname(target)]||'application/octet-stream');
  })().catch(error=>{if(!res.headersSent)send(res,500,JSON.stringify({ok:false,error:error.message}),'application/json; charset=utf-8');else res.destroy();});
}).listen(port,'127.0.0.1',()=>console.log(`map visual fixture http://127.0.0.1:${port}/almacen-mapa.html`));
