// ═══════════════════════════════════════════════════════════════════════════
// scripts/migrate-media-to-r2.mjs — copia las fotos/videos EXISTENTES del disco
// (DATA_DIR/<carpeta>) a Cloudflare R2, reutilizando la capa media.js.
//
// Idempotente: salta lo que ya existe en R2 (HeadObject). Deja el disco intacto
// (rollback = seguir leyendo de disco quitando las R2_*). Las 3 grafías legadas
// de inspección (inspection/inspections/inspeccion) se unifican en 'inspection'.
//
// Uso (desde la raíz del proyecto, con las R2_* y DATA_DIR en el entorno):
//   DATA_DIR=/data node scripts/migrate-media-to-r2.mjs          # sube
//   DATA_DIR=/data node scripts/migrate-media-to-r2.mjs --dry    # simula
// ═══════════════════════════════════════════════════════════════════════════

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import media from '../media.js';   // CommonJS → import default = module.exports

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = process.env.DATA_DIR || ROOT;
const DRY = process.argv.includes('--dry');

// Carpetas de media en disco. Las 3 grafías de inspección van a la key canónica.
const FOLDERS = ['av-fotos', 'desp-fotos', 'emp-fotos', 'wwp-fotos', 'sdv-adjuntos',
                 'prod-img', 'inspection', 'inspections', 'inspeccion'];
const CANON = { inspections: 'inspection', inspeccion: 'inspection' };

if (!media.isR2Enabled()) {
  console.error('R2 no configurado. Exportá R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, ' +
                'R2_SECRET_ACCESS_KEY y R2_BUCKET antes de correr esta migración.');
  process.exit(1);
}

console.log(`Migración media → R2  (DATA_DIR=${DATA_DIR}${DRY ? ' · DRY RUN' : ''})`);

let up = 0, skip = 0, err = 0, bytes = 0;
for (const folder of FOLDERS) {
  const dir = path.join(DATA_DIR, folder);
  let files;
  try { files = fs.readdirSync(dir); } catch { continue; }   // carpeta inexistente
  const kind = CANON[folder] || folder;
  console.log(`\n▸ ${folder} → ${kind}: ${files.length} archivo(s)`);
  for (const name of files) {
    const fp = path.join(dir, name);
    let st;
    try { st = fs.statSync(fp); } catch { continue; }
    if (!st.isFile()) continue;
    try {
      if (await media.mediaExists(kind, name)) { skip++; continue; }
      if (DRY) { console.log(`  [dry] subiría ${kind}/${name} (${st.size}B)`); up++; continue; }
      await media.mediaPut(kind, name, fs.readFileSync(fp));
      up++; bytes += st.size;
      if (up % 50 === 0) console.log(`  … ${up} subidos`);
    } catch (e) {
      err++;
      console.warn(`  ✗ ${kind}/${name}: ${e.message}`);
    }
  }
}

console.log(`\n${DRY ? '[DRY] ' : ''}Hecho — subidos=${up} saltados=${skip} errores=${err}` +
            (DRY ? '' : ` (${(bytes / 1048576).toFixed(1)} MB)`));
process.exit(err ? 1 : 0);
