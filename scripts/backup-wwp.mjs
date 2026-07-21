// ═══════════════════════════════════════════════════════════════════════════
// backup-wwp.mjs — Respaldo nocturno de WWP (Nivel 1, jul-2026)
//
// Baja de producción TODO lo que no tiene otra copia:
//   1. Fotos de evidencia (incremental: solo archivos nuevos o cambiados) de
//      wwp-fotos, av-fotos, desp-fotos, emp-fotos, sdv-adjuntos y prod-img.
//   2. Snapshot completo de las colecciones de datos (la DB entera en un .gz).
//
// Destino: %USERPROFILE%\OneDrive\Documentos\Respaldos-WWP\  (OneDrive lo sube
// a la nube solo). Retención: 30 snapshots de datos; las fotos se acumulan
// (son la única copia histórica — no se borran nunca desde aquí).
//
// Token: NO va en el repo. Se lee de %USERPROFILE%\.wwp-backup-token (una línea)
// o de la env WWP_BACKUP_TOKEN. Debe coincidir con BACKUP_TOKEN en Railway.
//
// Correr a mano:  node scripts/backup-wwp.mjs
// Programado:     Tarea de Windows "WWP Respaldo Nocturno" (diaria 2:00 AM)
// ═══════════════════════════════════════════════════════════════════════════
import fs from 'fs';
import path from 'path';
import os from 'os';

const BASE = process.env.WWP_BACKUP_BASE_URL || 'https://dashboard-despachos-production.up.railway.app';
const DEST = process.env.WWP_BACKUP_DEST || path.join(os.homedir(), 'OneDrive', 'Documentos', 'Respaldos-WWP');
const KEEP_SNAPSHOTS = 30;

function readToken() {
  if (process.env.WWP_BACKUP_TOKEN) return process.env.WWP_BACKUP_TOKEN.trim();
  const f = path.join(os.homedir(), '.wwp-backup-token');
  try { return fs.readFileSync(f, 'utf-8').trim(); } catch { return ''; }
}
const TOKEN = readToken();
if (!TOKEN) { console.error('FALTA el token: crea %USERPROFILE%\\.wwp-backup-token o define WWP_BACKUP_TOKEN'); process.exit(1); }
const HDRS = { 'x-backup-token': TOKEN };

const logFile = path.join(DEST, 'backup-log.txt');
function log(msg) {
  const line = new Date().toISOString() + '  ' + msg;
  console.log(line);
  try { fs.appendFileSync(logFile, line + '\n'); } catch {}
}

async function fetchRetry(url, opts = {}, tries = 3) {
  let lastErr;
  for (let i = 1; i <= tries; i++) {
    try {
      const r = await fetch(url, { ...opts, headers: { ...HDRS, ...(opts.headers || {}) } });
      if (r.status === 401 || r.status === 503) throw Object.assign(new Error('auth/config: HTTP ' + r.status), { fatal: true });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r;
    } catch (e) {
      lastErr = e;
      if (e.fatal) throw e;
      if (i < tries) await new Promise(r => setTimeout(r, 5000 * i));
    }
  }
  throw lastErr;
}

async function main() {
  fs.mkdirSync(DEST, { recursive: true });
  const t0 = Date.now();
  log('── Respaldo iniciado (' + BASE + ') ──');

  // 1. Manifest
  const manifest = await (await fetchRetry(BASE + '/api/backup/manifest')).json();
  if (!manifest.ok) throw new Error('manifest: ' + JSON.stringify(manifest).slice(0, 200));
  const cols = Object.keys(manifest.collections || {}).length;
  log('Manifest: ' + manifest.fotos.length + ' fotos en servidor, ' + cols + ' colecciones (build ' + manifest.build + ')');

  // 2. Fotos incrementales
  let nuevos = 0, bajados = 0, fallidos = 0, bytes = 0;
  for (const f of manifest.fotos) {
    if (!/^[\w.\-]+$/.test(f.name) || !/^[\w\-]+$/.test(f.dir)) { log('SKIP nombre sospechoso: ' + f.dir + '/' + f.name); continue; }
    const localDir = path.join(DEST, 'fotos', f.dir);
    const localPath = path.join(localDir, f.name);
    try {
      const st = fs.statSync(localPath);
      if (st.size === f.size) continue; // ya lo tenemos
    } catch { /* no existe → bajar */ }
    nuevos++;
    try {
      fs.mkdirSync(localDir, { recursive: true });
      const r = await fetchRetry(BASE + '/' + f.dir + '/' + encodeURIComponent(f.name));
      const buf = Buffer.from(await r.arrayBuffer());
      fs.writeFileSync(localPath + '.part', buf);
      fs.renameSync(localPath + '.part', localPath);
      bajados++; bytes += buf.length;
    } catch (e) {
      fallidos++;
      log('FALLO foto ' + f.dir + '/' + f.name + ': ' + e.message);
    }
  }
  log('Fotos: ' + nuevos + ' pendientes → ' + bajados + ' bajadas (' + Math.round(bytes / 1048576 * 10) / 10 + ' MB), ' + fallidos + ' fallidas');

  // 3. Snapshot de colecciones (la DB completa)
  const day = new Date().toISOString().slice(0, 10);
  const snapDir = path.join(DEST, 'snapshots');
  fs.mkdirSync(snapDir, { recursive: true });
  const snapPath = path.join(snapDir, 'wwp-collections-' + day + '.json.gz');
  const rs = await fetchRetry(BASE + '/api/backup/collections.json.gz');
  const gz = Buffer.from(await rs.arrayBuffer());
  fs.writeFileSync(snapPath + '.part', gz);
  fs.renameSync(snapPath + '.part', snapPath);
  log('Snapshot de datos: ' + snapPath + ' (' + Math.round(gz.length / 1024) + ' KB)');

  // 4. Retención de snapshots (30)
  const snaps = fs.readdirSync(snapDir).filter(f => f.startsWith('wwp-collections-')).sort();
  while (snaps.length > KEEP_SNAPSHOTS) {
    const victim = snaps.shift();
    try { fs.unlinkSync(path.join(snapDir, victim)); log('Retención: borrado ' + victim); } catch {}
  }

  const secs = Math.round((Date.now() - t0) / 1000);
  log('── Respaldo COMPLETO en ' + secs + ' s ──');
  if (fallidos > 0) { log('ATENCIÓN: ' + fallidos + ' fotos fallaron — se reintentan en la próxima corrida.'); process.exit(2); }
}

main().catch(e => { log('ERROR FATAL: ' + e.message); process.exit(1); });
