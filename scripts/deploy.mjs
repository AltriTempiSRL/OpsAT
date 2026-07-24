#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// deploy.mjs — LA única vía de deploy (F3.1 / ARQ-01, INF-03, plan 10).
//
// Flujo:  node scripts/stamp.mjs --bump   (si hubo cambios de front)
//         git commit …
//         node scripts/deploy.mjs [--dry-run]
//
// Qué exige, en orden (cada paso aborta el deploy si falla):
//   1. Árbol git LIMPIO (todo committeado — el deploy empaqueta el directorio).
//   2. Espejos coherentes (stamp --check).
//   3. node --check de los módulos del server.
//   4. Suite e2e completa en verde.
//   5. Tag git `deploy-vNNN` (NNN = APP_BUILD) — trazabilidad commit↔deploy.
//   6. `railway up --service dashboard-despachos --detach`.
//   7. Verificación post-deploy: /api/health ok y /api/app-version == vNNN.
//
// Rollback: `git checkout deploy-vANTERIOR && node scripts/deploy.mjs` (RUNBOOK.md).
// Ejecutable por cualquier tercero autorizado con Railway CLI logueada.
// Sin shell strings: todo via spawnSync con array de argumentos.
// ═══════════════════════════════════════════════════════════════════════════
import { spawnSync } from 'child_process';
import fs from 'fs';

const DRY = process.argv.includes('--dry-run');
// Windows: npx/railway son .cmd (shims batch) y spawnSync NO los lanza sin shell
// (Node 22 bloquea .cmd sin shell:true → ENOENT). En Mac/Linux shell=false, con lo
// que se conserva la garantía "sin shell strings" del diseño; los args son todos
// fijos/derivados de fuentes seguras (no entran datos de usuario).
const WIN = process.platform === 'win32';

function out(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf-8', shell: WIN });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} → exit ${r.status}: ${(r.stderr || '').slice(0, 300)}`);
  return (r.stdout || '').trim();
}
function run(etiqueta, cmd, args, opts = {}) {
  console.log(`\n── ${etiqueta} ──`);
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: WIN, ...opts });
  if (r.status !== 0) { console.error(`✗ ${etiqueta} FALLÓ — deploy abortado`); process.exit(1); }
}
// sleep síncrono cross-platform (el binario 'sleep' no existe en Windows).
const espera = (seg) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, seg * 1000);

// 1. Árbol limpio
const sucio = out('git', ['status', '--porcelain']);
if (sucio) {
  console.error('✗ Árbol sucio — commitea o descarta antes de deployar (el deploy empaqueta el directorio):\n' + sucio);
  process.exit(1);
}

// 2. Espejos
run('stamp --check', 'node', ['scripts/stamp.mjs', '--check']);

// 3. Sintaxis del server
for (const f of ['proxy.js', 'boot.js', 'storage-pg.js', 'media.js', 'write-queue.js', 'typed-schemas.js']) {
  if (fs.existsSync(f)) run(`node --check ${f}`, 'node', ['--check', f]);
}

// 4. Suite e2e
run('suite e2e', 'npx', ['playwright', 'test'], { cwd: 'tests/e2e' });

// 5. Tag (build estrictamente vNNN por regex — sin entrada libre)
const build = (fs.readFileSync('proxy.js', 'utf-8').match(/const APP_BUILD = '(v\d+)'/) || [])[1];
if (!build) { console.error('✗ no pude leer APP_BUILD de proxy.js'); process.exit(1); }
const tag = `deploy-${build}`;
const tagsPrevios = out('git', ['tag', '-l', 'deploy-*']).split('\n').filter(Boolean);
if (tagsPrevios.includes(tag) && !DRY) {
  console.error(`✗ el tag ${tag} ya existe — ¿olvidaste \`node scripts/stamp.mjs --bump\` + commit?`);
  process.exit(1);
}

if (DRY) {
  console.log(`\n✓ DRY-RUN OK — todo listo para deployar ${build} (tag ${tag}). Sin tag, sin railway up.`);
  process.exit(0);
}

out('git', ['tag', tag]);
console.log(`✓ tag ${tag} creado (commit ${out('git', ['rev-parse', '--short', 'HEAD'])})`);

// 6. Railway
run('railway up', 'railway', ['up', '--service', 'dashboard-despachos', '--detach']);

// 7. Verificación post-deploy (reintentos: el healthcheck de Railway tarda)
const URL = process.env.DEPLOY_URL || 'https://opsat.up.railway.app';
console.log(`\n── verificando ${URL} (hasta 3 min) ──`);
const t0 = Date.now();
let ok = false;
while (Date.now() - t0 < 180_000) {
  try {
    const health = JSON.parse(out('curl', ['-s', '-m', '10', URL + '/api/health']));
    const ver = JSON.parse(out('curl', ['-s', '-m', '10', URL + '/api/app-version']));
    if (health.ok && ver.build === build) { ok = true; break; }
    console.log(`  … health.ok=${health.ok} build=${ver.build} (esperando ${build})`);
  } catch { console.log('  … aún no responde'); }
  espera(10);
}
if (!ok) {
  const anterior = tagsPrevios.length ? tagsPrevios[tagsPrevios.length - 1] : '(sin tags previos)';
  console.error(`✗ el deploy no verificó en 3 min — REVISAR YA. Rollback: git checkout ${anterior} && node scripts/deploy.mjs`);
  process.exit(1);
}
console.log(`\n✓ DEPLOY VERIFICADO: ${build} vivo en ${URL} (tag ${tag}). Anotar en MEMORIA-PROYECTO.md.`);
