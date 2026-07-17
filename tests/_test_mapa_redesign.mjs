import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const html=fs.readFileSync(path.join(root,'almacen-mapa.html'),'utf8');
const css=fs.readFileSync(path.join(root,'almacen-mapa.css'),'utf8');
let ok=0,fail=0;
const test=(name,cond)=>{if(cond){ok++;console.log('✓',name);}else{fail++;console.error('✗',name);}};

const inlineScripts=[];
let at=0;
while((at=html.indexOf('<script',at))!==-1){
  const openEnd=html.indexOf('>',at),open=html.slice(at,openEnd+1),close=html.indexOf('</script>',openEnd);
  if(close===-1)break;
  if(!/\bsrc\s*=/.test(open))inlineScripts.push(html.slice(openEnd+1,close));
  at=close+9;
}
test('se encontró un script inline principal',inlineScripts.length===1);
const mainScript=inlineScripts[0]||'';
for(const [i,code] of inlineScripts.entries()){
  try{new vm.Script(code,{filename:`almacen-inline-${i}.js`});test(`script ${i+1} compila`,true);}catch(e){console.error(e);test(`script ${i+1} compila`,false);}
}

const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
const dupIds=[...new Set(ids.filter((id,i)=>ids.indexOf(id)!==i))];
test('sin IDs duplicados',dupIds.length===0);
test('CSS externo conectado',html.includes('href="/almacen-mapa.css"'));
test('responsive desktop/tablet/móvil',/@media \(max-width:1199px\)/.test(css)&&/@media \(max-width:820px\)/.test(css)&&/@media \(max-width:520px\)/.test(css));
test('respeta movimiento reducido',css.includes('prefers-reduced-motion:reduce'));
test('usa 100dvh',css.includes('height:100dvh'));
test('buscador operativo nuevo',html.includes('id="warehouse-search"')&&!html.includes('id="bin-search"'));
test('filtro por estado presente',html.includes('id="filter-status"'));
test('detalle y configuración cerrados inicialmente',html.includes('class="layout no-left no-right"'));
test('estados loading/error/retry presentes',html.includes('id="loading-action"')&&html.includes("setLoading('No pudimos cargar el mapa'"));
test('sin alert() en el mapa',!mainScript.includes('alert('));
test('quants asociados por location_id',mainScript.includes('binByLocId[locId]'));
test('quants agregados por producto',mainScript.includes('_itemsByProd[prodId]'));
test('no inventa altura cuando faltan 3 dimensiones',mainScript.includes('w>0&&d>0&&h>0'));
test('bins 3D salen de ubicaciones reales',mainScript.includes('const binList=rackBinCodes().map'));
test('filtro único gobierna raycast',mainScript.includes('if(code&&matchesActiveFilters(code))return code'));
test('highlight 3D tolera escena aún no construida',mainScript.includes('if(!GL.ready || !GL.selMesh) return'));
test('métricas separan referencias y unidades',html.includes('Referencias')&&html.includes('Unidades')&&mainScript.includes('sumUnits'));
test('escape aplicado a datos Odoo',mainScript.includes('esc(p.name)')&&mainScript.includes('esc(path)'));
test('imágenes de producto se cargan bajo demanda',mainScript.includes("fields:['id','image_128']")&&!mainScript.includes("'description_purchase','image_128'"));
test('SVG dinámico no usa var() en atributo fill/stroke',!/(?:fill|stroke)="var\(/.test(mainScript));

const cssOpens=(css.match(/{/g)||[]).length,cssCloses=(css.match(/}/g)||[]).length;
test('llaves CSS balanceadas',cssOpens===cssCloses);
const defined=new Set([...(`${html}\n${css}`).matchAll(/--([a-zA-Z0-9-]+)\s*:/g)].map(m=>m[1]));
const used=new Set([...(`${html}\n${css}`).matchAll(/var\(--([a-zA-Z0-9-]+)/g)].map(m=>m[1]));
const missing=[...used].filter(x=>!x.endsWith('-')&&!defined.has(x));
if(missing.length)console.error('Tokens faltantes:',missing);
test('todos los tokens CSS usados están definidos',missing.length===0);

const requestedIcons=[...new Set([...html.matchAll(/data-lucide="([^"]+)"/g)].map(m=>m[1]).filter(x=>!x.includes('${')).concat(['sun','moon']))];
const lucideCode=fs.readFileSync(path.join(root,'lucide.min.js'),'utf8');
const iconContext={};vm.createContext(iconContext);vm.runInContext(lucideCode,iconContext);
const iconMap=iconContext.lucide?.icons||{};
const pascal=name=>name.split('-').map(x=>x.charAt(0).toUpperCase()+x.slice(1)).join('');
const missingIcons=requestedIcons.filter(name=>!iconMap[name]&&!iconMap[pascal(name)]);
if(missingIcons.length)console.error('Iconos faltantes:',missingIcons);
test('todos los iconos Lucide existen localmente',missingIcons.length===0);

console.log(`\nMapa rediseño: ${ok} OK · ${fail} fallos`);
if(fail)process.exit(1);
