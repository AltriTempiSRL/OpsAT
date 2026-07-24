// Compila las islas TSX de src/islas/ (typecheck obligatorio antes: npm run build:islas) a vendor/islas/ con esbuild — INSTALACIÓN
// CANÓNICA de Astryx (docs migration): imports reales de @astryxdesign/core con
// tree-shaking, CSS empaquetado con sus capas de cascada, y React dentro del
// bundle. Ya NO se usan el UMD ni react-globals: eso era un atajo de arranque.
//
// Salida por isla:
//   vendor/islas/<isla>.js   (ESM, con chunks compartidos en vendor/islas/chunks/)
//   vendor/islas/<isla>.css  (reset + astryx-base + estilos usados, en @layer)
// El HTML carga <script type="module"> y el CSS del bundle, y se estampa ?v=.
//
// Se corre LOCAL (npm run build:islas) y el resultado se commitea — producción
// sigue sirviendo estáticos, sin build en el deploy.
import {build} from 'esbuild';
import {readdirSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';

const SRC = 'src/islas', OUT = 'vendor/islas';
rmSync(join(OUT, 'chunks'), {recursive: true, force: true});
mkdirSync(OUT, {recursive: true});

const entries = readdirSync(SRC).filter(f => f.endsWith('.tsx'));
if (!entries.length) { console.log('sin islas'); process.exit(0); }

await build({
  entryPoints: entries.map(f => `${SRC}/${f}`),
  bundle: true,
  minify: true,
  format: 'esm',                      // módulos reales → permite splitting
  splitting: true,                    // React/Astryx van a chunks COMPARTIDOS
  chunkNames: 'chunks/[name]-[hash]',
  jsx: 'automatic',
  jsxImportSource: 'react',
  define: {'process.env.NODE_ENV': '"production"'},
  loader: {'.css': 'css'},
  outdir: OUT,
  logLevel: 'warning',
});

// Estampar ?v=<md5-8> del JS y el CSS en el HTML de cada isla (convención core.js).
for (const f of entries) {
  const name = f.replace(/\.tsx$/, '');
  const html = `${name}.html`;
  if (!existsSync(html)) { console.log(`✓ ${name} (sin HTML que estampar)`); continue; }
  let doc = readFileSync(html, 'utf8');
  for (const ext of ['js', 'css']) {
    const file = `${OUT}/${name}.${ext}`;
    if (!existsSync(file)) continue;
    const hash = createHash('md5').update(readFileSync(file)).digest('hex').slice(0, 8);
    const re = new RegExp(`(/vendor/islas/${name}\\.${ext})(\\?v=[a-f0-9]+)?`, 'g');
    doc = doc.replace(re, `$1?v=${hash}`);
  }
  writeFileSync(html, doc);
  console.log(`✓ ${name} compilado y estampado en ${html}`);
}
