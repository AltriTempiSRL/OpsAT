#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// stamp.mjs — estampado automático de espejos (F5.5 / ARQ-04, plan 10).
//
// Los "espejos sincronizados a mano" eran fuente de incidentes: hashes ?v= de
// core.js/theme.css/core-isla.js/ui-isla.css en shell+islas, APP_BUILD ×2
// (proxy.js + historial.html) y CACHE del service worker. Este script los
// vuelve mecánicos:
//
//   node scripts/stamp.mjs            → re-estampa los ?v= (idempotente)
//   node scripts/stamp.mjs --bump     → además incrementa APP_BUILD (vNNN) en
//                                       proxy.js + historial.html y wwp-vNN en sw.js
//   node scripts/stamp.mjs --check    → NO escribe; exit 1 si algo está
//                                       desincronizado (para CI y deploy.mjs)
//
// Correr SIEMPRE desde la raíz del proyecto.
// ═══════════════════════════════════════════════════════════════════════════
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const ROOT = process.cwd();
const CHECK = process.argv.includes('--check');
const BUMP = process.argv.includes('--bump');

const md5_8 = (f) => crypto.createHash('md5').update(fs.readFileSync(path.join(ROOT, f))).digest('hex').slice(0, 8);

// Assets volátiles versionados por hash (lucide/chart/xlsx/three son vendored
// estables: su ?v= solo cambia si se actualiza la librería — a mano y a propósito).
const ASSETS = ['core.js', 'theme.css', 'core-isla.js', 'ui-isla.css'];

let problemas = 0;
let cambios = 0;

const hashes = {};
for (const a of ASSETS) {
  if (!fs.existsSync(path.join(ROOT, a))) { console.error(`✗ falta ${a} (¿corriste desde la raíz?)`); process.exit(1); }
  hashes[a] = md5_8(a);
}

// 1. Re-estampar ?v= en TODOS los .html de la raíz
const htmls = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html'));
for (const h of htmls) {
  const p = path.join(ROOT, h);
  const antes = fs.readFileSync(p, 'utf-8');
  let despues = antes;
  for (const a of ASSETS) {
    const re = new RegExp('(' + a.replace('.', '\\.') + ')\\?v=[a-f0-9]+', 'g');
    despues = despues.replace(re, `$1?v=${hashes[a]}`);
  }
  if (despues !== antes) {
    if (CHECK) { console.error(`✗ ${h}: hashes ?v= desincronizados`); problemas++; }
    else { fs.writeFileSync(p, despues); console.log(`✓ ${h}: ?v= re-estampado`); cambios++; }
  }
}

// 2. APP_BUILD (proxy.js + historial.html) y CACHE (sw.js)
const leer = (f) => fs.readFileSync(path.join(ROOT, f), 'utf-8');
const mProxy = leer('proxy.js').match(/const APP_BUILD = 'v(\d+)'/);
const mHtml = leer('historial.html').match(/var APP_BUILD = 'v(\d+)'/);
const mSw = leer('sw.js').match(/const CACHE = 'wwp-v(\d+)'/);
if (!mProxy || !mHtml || !mSw) { console.error('✗ no encuentro APP_BUILD/CACHE con los patrones esperados'); process.exit(1); }

const bProxy = Number(mProxy[1]), bHtml = Number(mHtml[1]), bSw = Number(mSw[1]);
if (bProxy !== bHtml) {
  if (CHECK) { console.error(`✗ APP_BUILD divergente: proxy v${bProxy} ≠ historial v${bHtml}`); problemas++; }
  else { console.error(`✗ APP_BUILD divergente (proxy v${bProxy} ≠ historial v${bHtml}) — resolver a mano, no adivino cuál es el bueno`); process.exit(1); }
}

if (BUMP) {
  const nuevo = Math.max(bProxy, bHtml) + 1;
  const swNuevo = bSw + 1;
  fs.writeFileSync(path.join(ROOT, 'proxy.js'), leer('proxy.js').replace(/const APP_BUILD = 'v\d+'/, `const APP_BUILD = 'v${nuevo}'`));
  fs.writeFileSync(path.join(ROOT, 'historial.html'), leer('historial.html').replace(/var APP_BUILD = 'v\d+'/, `var APP_BUILD = 'v${nuevo}'`));
  fs.writeFileSync(path.join(ROOT, 'sw.js'), leer('sw.js').replace(/const CACHE = 'wwp-v\d+'/, `const CACHE = 'wwp-v${swNuevo}'`));
  console.log(`✓ APP_BUILD v${bProxy} → v${nuevo} (proxy+historial) · SW CACHE wwp-v${bSw} → wwp-v${swNuevo}`);
  cambios++;
}

if (CHECK) {
  if (problemas) { console.error(`stamp --check: ${problemas} espejo(s) desincronizado(s)`); process.exit(1); }
  console.log(`stamp --check: espejos coherentes (build v${bProxy}, sw wwp-v${bSw}, ${ASSETS.map((a) => a + '=' + hashes[a]).join(' ')})`);
} else {
  console.log(cambios ? `stamp: ${cambios} archivo(s) actualizados` : 'stamp: todo ya estaba coherente');
}
