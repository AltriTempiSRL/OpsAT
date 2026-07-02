// Ron — Pick ALVEN/PICK/15084 vs Tarea #0062
// Lee credenciales SOLO de variables de entorno. No hardcodea nada.
import https from 'https';
import http from 'http';

const ODOO_URL  = process.env.ODOO_URL  || 'https://altritempi.odoo.com';
const ODOO_DB   = process.env.ODOO_DB   || '';
const ODOO_USER = process.env.ODOO_USER || '';
const ODOO_KEY  = process.env.ODOO_KEY  || '';
const RAILWAY   = process.env.RAILWAY_URL || '';   // ej. https://dashboard-despachos-production.up.railway.app
const WWP_TOKEN = process.env.WWP_TOKEN || '';     // Bearer token pre-generado (opcional)

if (!ODOO_DB || !ODOO_USER || !ODOO_KEY) {
  console.error('Faltan variables de entorno: ODOO_DB, ODOO_USER, ODOO_KEY');
  process.exit(1);
}

function postJsonDirect(url, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const data   = JSON.stringify(body);
    const lib    = parsed.protocol === 'https:' ? https : http;
    const req    = lib.request({
      hostname: parsed.hostname,
      port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path:     parsed.pathname + (parsed.search || ''),
      method:   'POST',
      headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, res => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => { try { resolve(JSON.parse(buf)); } catch { resolve(buf); } });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function getJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib    = parsed.protocol === 'https:' ? https : http;
    lib.get({
      hostname: parsed.hostname,
      port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path:     parsed.pathname + (parsed.search || ''),
      headers
    }, res => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => { try { resolve(JSON.parse(buf)); } catch { resolve(buf); } });
    }).on('error', reject);
  });
}

async function odooJSONRPC(method, service, args) {
  const r = await postJsonDirect(`${ODOO_URL}/jsonrpc`, {
    jsonrpc: '2.0', id: 1, method: 'call',
    params: { service, method, args }
  });
  if (r?.error) throw new Error(JSON.stringify(r.error));
  return r.result;
}

console.log('='.repeat(70));
console.log('RON — Pick ALVEN/PICK/15084 vs Tarea #0062');
console.log(new Date().toISOString());
console.log('='.repeat(70));

// 1) Auth Odoo
const uid = await odooJSONRPC('authenticate', 'common', [ODOO_DB, ODOO_USER, ODOO_KEY, {}]);
if (!uid) { console.error('❌ Auth Odoo falló'); process.exit(1); }
console.log(`\nOdoo uid: ${uid}`);

async function kw(model, method, args, kwargs = {}) {
  return odooJSONRPC('execute_kw', 'object', [ODOO_DB, uid, ODOO_KEY, model, method, args, kwargs]);
}

// 2) Pick ALVEN/PICK/15084
const picks = await kw('stock.picking', 'search_read',
  [[['name', '=', 'ALVEN/PICK/15084']]],
  { fields: ['id','name','state','origin','date_done'], limit: 1 });

if (!picks?.length) { console.error('❌ Pick no encontrado'); process.exit(1); }
const pick = picks[0];
console.log(`\nPick: ${pick.name} | id=${pick.id} | state=${pick.state} | origin=${pick.origin}`);

// 3) Move lines
const lines = await kw('stock.move.line', 'search_read',
  [[['picking_id', '=', pick.id]]],
  { fields: ['product_id','qty_done','product_uom_qty'], limit: 500 });
console.log(`Líneas: ${lines.length}`);

// 4) SKUs
const prodIds = [...new Set(lines.map(l => l.product_id[0]))];
const prods   = await kw('product.product', 'search_read',
  [[['id', 'in', prodIds]]],
  { fields: ['id','default_code','name'], limit: 500 });
const pm = Object.fromEntries(prods.map(p => [p.id, p]));

const pickSkus = new Map();
for (const l of lines) {
  const p   = pm[l.product_id[0]];
  const sku = p?.default_code || `[${l.product_id[1]}]`;
  if (!pickSkus.has(sku)) pickSkus.set(sku, { name: p?.name || l.product_id[1], dem: 0, done: 0 });
  pickSkus.get(sku).dem  += l.product_uom_qty;
  pickSkus.get(sku).done += l.qty_done;
}

console.log('\n── ARTÍCULOS EN ALVEN/PICK/15084 ────────────────────────────────────');
console.log('SKU'.padEnd(32) + 'Nombre'.padEnd(46) + 'Demanda  Hecho');
console.log('-'.repeat(92));
for (const [sku, v] of [...pickSkus.entries()].sort((a, b) => a[0].localeCompare(b[0])))
  console.log(sku.padEnd(32) + v.name.slice(0, 44).padEnd(46) + String(v.dem).padEnd(9) + v.done);
console.log(`\nTotal SKUs únicos: ${pickSkus.size}`);

// 5) Tarea #0062 vía Railway (si hay token)
if (!RAILWAY || !WWP_TOKEN) {
  console.log('\n⚠️  RAILWAY_URL o WWP_TOKEN no configurados.');
  console.log('   Para comparar con la tarea, correr con:');
  console.log('   RAILWAY_URL=https://dashboard-despachos-production.up.railway.app WWW_TOKEN=<bearer> ...');
  console.log('\nListado de SKUs del pick (para comparación manual):');
  for (const [sku, v] of pickSkus)
    console.log(`  ${sku} | ${v.name} | demanda: ${v.dem}`);
  process.exit(0);
}

const tasksR = await getJson(`${RAILWAY}/api/wwp/tasks`, { Authorization: `Bearer ${WWP_TOKEN}` });
const arr    = Array.isArray(tasksR) ? tasksR : (tasksR?.tasks || []);
let taskObj  = arr.find(t => t.seq === 62);
if (!taskObj) taskObj = arr.find(t => String(t.title).includes('S07639') || String(t.title).includes('JOCELLE'));
if (!taskObj) {
  console.log('❌ Tarea #0062 no encontrada en Railway.');
  console.log('Primeras tareas:', arr.slice(0, 5).map(t => `#${t.seq} ${t.title}`));
  process.exit(1);
}
console.log(`\nTarea: #${taskObj.seq} — ${taskObj.title} | estado: ${taskObj.status}`);

const rawItems = taskObj.items || [];
const taskSkus = new Map();
for (const it of rawItems) {
  const sku  = it.sku || it.default_code || it.product_code || '?';
  const qty  = it.unit_total ?? it.qty ?? 1;
  if (!taskSkus.has(sku)) taskSkus.set(sku, { name: it.product_name || it.name || '', qty: 0, sel: !!it.selected });
  taskSkus.get(sku).qty += qty;
  taskSkus.get(sku).sel ||= !!it.selected;
}

console.log('\n── ARTÍCULOS EN TAREA #0062 ─────────────────────────────────────────');
console.log('Sel  SKU'.padEnd(37) + 'Nombre'.padEnd(44) + 'Cant');
console.log('-'.repeat(85));
for (const [sku, v] of [...taskSkus.entries()].sort((a, b) => a[0].localeCompare(b[0])))
  console.log((v.sel ? '✓' : ' ').padEnd(5) + sku.padEnd(32) + v.name.slice(0, 42).padEnd(44) + v.qty);

// 6) Diferencias
console.log('\n── EXTRAS EN TAREA (quitar) ─────────────────────────────────────────');
const extras = [...taskSkus.entries()].filter(([s]) => !pickSkus.has(s));
if (!extras.length) console.log('✅ Ninguno');
else extras.forEach(([s, v]) =>
  console.log(`  ⚠️  ${s.padEnd(32)} ${v.name.slice(0,40)} ×${v.qty}${v.sel?' [SEL]':''}`));

console.log('\n── FALTANTES EN TAREA (faltan agregar) ──────────────────────────────');
const missing = [...pickSkus.entries()].filter(([s]) => !taskSkus.has(s));
if (!missing.length) console.log('✅ Ninguno');
else missing.forEach(([s, v]) =>
  console.log(`  📦 ${s.padEnd(32)} ${v.name.slice(0,40)} ×${v.dem}`));

console.log('\n── DIFERENCIAS DE CANTIDAD ──────────────────────────────────────────');
let diffs = 0;
for (const [sku, tv] of taskSkus) {
  if (pickSkus.has(sku) && tv.qty !== pickSkus.get(sku).dem) {
    console.log(`  ${sku.padEnd(32)} tarea=${tv.qty}  pick=${pickSkus.get(sku).dem}`);
    diffs++;
  }
}
if (!diffs) console.log('✅ Sin diferencias de cantidad');

console.log('\n='.repeat(70));
console.log('FIN — ' + new Date().toISOString());
