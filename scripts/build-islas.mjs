// Compila las islas JSX de src/islas/ a vendor/islas/ con esbuild.
// React y Astryx NO se empaquetan: llegan como globales vendorizados
// (vendor/react-globals.js + vendor/astryx.umd.js), así cada isla pesa poco.
// Se corre LOCAL y el resultado se commitea — producción sigue sin build.
import {build} from 'esbuild';
import {readdirSync, mkdirSync, readFileSync, writeFileSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';

const SRC = 'src/islas', OUT = 'vendor/islas';
mkdirSync(OUT, {recursive: true});

// Mapea los imports de Astryx/React a los globales que ya carga el HTML.
const globalsPlugin = {
  name: 'astryx-globals',
  setup(b) {
    b.onResolve({filter: /^react$|^react-dom(\/client)?$/}, a => ({path: a.path, namespace: 'g'}));
    b.onResolve({filter: /^@astryxdesign\/core/},            a => ({path: a.path, namespace: 'g'}));
    b.onLoad({filter: /.*/, namespace: 'g'}, a => {
      if (a.path === 'react') return {contents: 'module.exports = window.React'};
      if (a.path.startsWith('react-dom')) return {contents: 'module.exports = window.ReactDOM'};
      // @astryxdesign/core/Button → window.Astryx.Button (y el barrel completo)
      const sub = a.path.split('/')[2];
      return {contents: sub
        ? `module.exports = window.Astryx`      // subpath: se re-exporta el objeto entero
        : 'module.exports = window.Astryx'};
    });
  },
};

const entries = readdirSync(SRC).filter(f => f.endsWith('.jsx'));
for (const f of entries) {
  const name = f.replace(/\.jsx$/, '');
  await build({
    entryPoints: [`${SRC}/${f}`],
    bundle: true, minify: true, format: 'iife',
    globalName: `Isla_${name.replace(/-/g, '_')}`,
    jsx: 'automatic', jsxImportSource: 'react',
    define: {'process.env.NODE_ENV': '"production"'},
    plugins: [globalsPlugin],
    outfile: `${OUT}/${name}.js`,
  });
  // Estampar ?v=<md5-8> en el HTML que la carga — misma convención que core.js.
  // Sin esto el navegador sirve el bundle viejo (Cache-Control: max-age=3600).
  const hash = createHash('md5').update(readFileSync(`${OUT}/${name}.js`)).digest('hex').slice(0, 8);
  const html = `${name}.html`;
  if (existsSync(html)) {
    const antes = readFileSync(html, 'utf8');
    const re = new RegExp(`(/vendor/islas/${name}\\.js)(\\?v=[a-f0-9]+)?`, 'g');
    const despues = antes.replace(re, `$1?v=${hash}`);
    if (antes !== despues) writeFileSync(html, despues);
    console.log(`✓ ${f} → ${OUT}/${name}.js  (?v=${hash} estampado en ${html})`);
  } else {
    console.log(`✓ ${f} → ${OUT}/${name}.js  (sin HTML que estampar)`);
  }
}
