'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// media.js — Capa única de almacenamiento de fotos y videos (Cloudflare R2 o disco)
//
// Objetivo (Fase 1 auditoría): sacar la evidencia (fotos/videos) del disco de
// Railway —hoy su única copia— hacia Cloudflare R2, SIN cambiar las URLs que la
// app ya tiene guardadas. El contrato de URL público sigue siendo /<kind>/<name>
// (p.ej. /wwp-fotos/abc.jpg); lo único que cambia es de dónde se lee/escribe.
//
//   • Con R2_* en el entorno  → objetos en el bucket R2 (S3-compatible).
//   • Sin R2_* (dev/local/tests) → archivos en DATA_DIR/<kind>/ (comportamiento
//     histórico). Así este módulo funciona y se testea sin credenciales.
//
// El SDK de AWS S3 se carga de forma PEREZOSA: solo se requiere si R2 está
// activo, para no obligar a instalarlo en modo disco.
//
// Wiring en proxy.js (paso siguiente de Fase 1): reemplazar los ~19 puntos de
// `fs.writeFileSync(<DIR>, Buffer.from(b64,'base64'))` por `mediaPut(kind,...)`,
// los borrados por `mediaDelete`, y el servido estático de esas carpetas por
// `mediaGet` con validación de sesión.
// ═══════════════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || __dirname;

// Tipos válidos → carpeta canónica. La carpeta ES el prefijo de la URL pública.
const KINDS = new Set([
  'av-fotos',     // fotos de avería
  'desp-fotos',   // fotos de despacho (recepción/vehículo/entrega)
  'emp-fotos',    // fotos de empaque
  'wwp-fotos',    // chat de tareas (fotos Y videos) — la más grande
  'sdv-adjuntos', // adjuntos de SDV (fotos/videos)
  'prod-img',     // imágenes de producto de Odoo (deduplicadas por SHA-1)
  'inspection',   // inspección de vehículos (unifica las grafías legadas)
]);

// Grafías legadas que solo se LEEN por compatibilidad (unificación de las 3
// variantes que conviven hoy en el código: inspection / inspections / inspeccion).
const LEGACY_READ_ALIASES = { 'inspection': ['inspections', 'inspeccion'] };

const _MIME = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
  '.m4v': 'video/x-m4v',
};

function contentTypeFor(name) {
  return _MIME[path.extname(String(name || '')).toLowerCase()] || 'application/octet-stream';
}

function isR2Enabled() {
  return !!(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID &&
            process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET);
}
function mode() { return isR2Enabled() ? 'r2' : 'disk'; }

function _assertKind(kind) {
  if (!KINDS.has(kind)) throw new Error('media: kind inválido: ' + kind);
}
// Nombre de archivo seguro: rechaza cualquier cosa con separador de ruta, '..'
// o NUL. Los nombres de media son planos (hash/timestamp+ext), así que un
// separador es señal de bug o de intento de path traversal → se lanza, no se
// reescribe en silencio.
function _safeName(name) {
  const s = String(name || '');
  if (!s || s === '.' || s === '..' ||
      s.includes('/') || s.includes('\\') || s.includes('\0')) {
    throw new Error('media: nombre inválido: ' + s);
  }
  return s;
}
function _key(kind, name) { return kind + '/' + name; }
function _publicUrl(kind, name) { return '/' + kind + '/' + name; }

// ── Backend R2 (carga perezosa del SDK) ──────────────────────────────────────
let _s3 = null;
function _r2() {
  if (_s3) return _s3;
  let S3;
  try { S3 = require('@aws-sdk/client-s3'); }
  catch { throw new Error('media: R2 activo pero falta @aws-sdk/client-s3 — corré `npm i @aws-sdk/client-s3`'); }
  // Endpoint estándar derivado del Account ID; overridable con R2_ENDPOINT para
  // buckets con jurisdicción (EU: <id>.eu.r2.cloudflarestorage.com, FedRAMP:
  // <id>.fedramp.r2.cloudflarestorage.com) o cualquier endpoint S3 custom.
  const endpoint = process.env.R2_ENDPOINT ||
    ('https://' + process.env.R2_ACCOUNT_ID + '.r2.cloudflarestorage.com');
  _s3 = {
    lib: S3,
    client: new S3.S3Client({
      region: 'auto',
      endpoint,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    }),
  };
  return _s3;
}

// ── API pública ──────────────────────────────────────────────────────────────

// Guarda un Buffer y devuelve la URL pública estable (/<kind>/<name>).
async function mediaPut(kind, name, buf, contentType) {
  _assertKind(kind);
  name = _safeName(name);
  const ct = contentType || contentTypeFor(name);
  if (isR2Enabled()) {
    const { lib, client } = _r2();
    await client.send(new lib.PutObjectCommand({
      Bucket: process.env.R2_BUCKET, Key: _key(kind, name), Body: buf, ContentType: ct,
    }));
  } else {
    const dir = path.join(DATA_DIR, kind);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, name), buf);
  }
  return _publicUrl(kind, name);
}

// Devuelve { body, contentType, stream } o null si no existe.
//  - R2: body = stream legible (stream:true) → el handler hace pipe a la respuesta.
//  - disco: body = Buffer (stream:false).
async function mediaGet(kind, name) {
  _assertKind(kind);
  name = _safeName(name);
  if (isR2Enabled()) {
    const { lib, client } = _r2();
    try {
      const r = await client.send(new lib.GetObjectCommand({
        Bucket: process.env.R2_BUCKET, Key: _key(kind, name),
      }));
      return { body: r.Body, contentType: r.ContentType || contentTypeFor(name), stream: true };
    } catch (e) {
      if (!(e && (e.name === 'NoSuchKey' || (e.$metadata && e.$metadata.httpStatusCode === 404)))) throw e;
      // No está en R2 → cae al disco (evidencia histórica aún sin migrar). Permite
      // un flip a R2 SIN downtime: lo viejo se sirve de disco, lo nuevo de R2, y la
      // migración puede correr después sin apuro. Cuando todo esté en R2, el disco
      // deja de consultarse solo (nunca habrá miss).
    }
  }
  // disco (modo disco puro, o fallback tras un miss en R2): carpeta canónica + grafías legadas
  for (const k of [kind, ...(LEGACY_READ_ALIASES[kind] || [])]) {
    const f = path.join(DATA_DIR, k, name);
    if (fs.existsSync(f)) return { body: fs.readFileSync(f), contentType: contentTypeFor(name), stream: false };
  }
  return null;
}

async function mediaExists(kind, name) {
  _assertKind(kind);
  name = _safeName(name);
  if (isR2Enabled()) {
    const { lib, client } = _r2();
    try {
      await client.send(new lib.HeadObjectCommand({ Bucket: process.env.R2_BUCKET, Key: _key(kind, name) }));
      return true;
    } catch { return false; }
  }
  for (const k of [kind, ...(LEGACY_READ_ALIASES[kind] || [])]) {
    if (fs.existsSync(path.join(DATA_DIR, k, name))) return true;
  }
  return false;
}

async function mediaDelete(kind, name) {
  _assertKind(kind);
  name = _safeName(name);
  if (isR2Enabled()) {
    const { lib, client } = _r2();
    await client.send(new lib.DeleteObjectCommand({ Bucket: process.env.R2_BUCKET, Key: _key(kind, name) }));
    return true;
  }
  let removed = false;
  for (const k of [kind, ...(LEGACY_READ_ALIASES[kind] || [])]) {
    const f = path.join(DATA_DIR, k, name);
    try { if (fs.existsSync(f)) { fs.unlinkSync(f); removed = true; } } catch { /* best-effort */ }
  }
  return removed;
}

module.exports = {
  isR2Enabled, mode, contentTypeFor,
  mediaPut, mediaGet, mediaExists, mediaDelete,
  KINDS, DATA_DIR,
};

// ── Auto-test de humo (modo disco): `node media.js` ──────────────────────────
// Round-trip put→get→exists→delete sobre DATA_DIR. No toca R2.
if (require.main === module) {
  (async () => {
    if (isR2Enabled()) { console.log('[media] R2 activo — el auto-test solo cubre modo disco; salteando.'); return; }
    const name = 'selftest-' + Date.now() + '.txt';
    const payload = Buffer.from('media.js self-test ' + new Date().toISOString());
    let ok = true;
    const url = await mediaPut('wwp-fotos', name, payload, 'text/plain');
    console.log('put →', url, '(mode:', mode() + ')');
    const got = await mediaGet('wwp-fotos', name);
    if (!got || !got.body.equals(payload)) { ok = false; console.error('✗ get devolvió contenido distinto'); }
    else console.log('get → OK, contentType:', got.contentType);
    if (!(await mediaExists('wwp-fotos', name))) { ok = false; console.error('✗ exists=false tras put'); }
    else console.log('exists → true');
    await mediaDelete('wwp-fotos', name);
    if (await mediaExists('wwp-fotos', name)) { ok = false; console.error('✗ exists=true tras delete'); }
    else console.log('delete → OK');
    // rechazo de path traversal
    try { await mediaPut('wwp-fotos', '../escape.txt', payload); ok = false; console.error('✗ no rechazó traversal'); }
    catch { console.log('traversal → rechazado OK'); }
    console.log(ok ? '\n✅ media.js self-test PASÓ (modo disco)' : '\n❌ media.js self-test FALLÓ');
    process.exit(ok ? 0 : 1);
  })().catch(e => { console.error('self-test error:', e); process.exit(1); });
}
