'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// boot.js — arranque del servidor con inicialización async del almacenamiento
//
// proxy.js es un monolito CommonJS que llama loadJson/saveJson SÍNCRONOS desde
// su carga de módulo; Postgres es async. Este bootstrap inicializa storage-pg
// ANTES de requerir proxy.js, de modo que desde la primera línea del monolito
// las colecciones ya estén en memoria (precargadas desde la DB).
//
// Sin DATABASE_URL: no hace nada especial y carga proxy.js (backend JSON de
// archivos, comportamiento histórico). `node proxy.js` directo sigue siendo
// válido para ese modo (restart.bat, tests).
// ═══════════════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

// Réplica mínima del loader de .env de proxy.js: DATABASE_URL puede venir del
// archivo .env local y boot corre ANTES de que proxy.js lo inyecte.
(function preloadEnvFile() {
  for (const name of ['.env', '.env.txt']) {
    const f = path.join(__dirname, name);
    if (!fs.existsSync(f)) continue;
    for (const line of fs.readFileSync(f, 'utf-8').split('\n')) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.+)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim();
    }
    break;
  }
})();

const storage = require('./storage-pg.js');

(async () => {
  if (storage.isEnabled()) {
    const dataDir = process.env.DATA_DIR || __dirname;
    try {
      await storage.init({ dataDir });
    } catch (e) {
      console.error('[boot] FATAL: PostgreSQL no disponible — no se arranca sirviendo vacío.');
      console.error('[boot] ' + e.message);
      process.exit(1);
    }
    // Railway envía SIGTERM al redesplegar: drenar cola + exportar a JSON
    // (minimiza la ventana de rollback a ~0).
    let closing = false;
    const graceful = async (sig) => {
      if (closing) return;
      closing = true;
      console.log('[boot] ' + sig + ' — drenando escrituras y exportando respaldo JSON…');
      try { await storage.shutdown(); } catch (e) { console.warn('[boot] shutdown:', e.message); }
      process.exit(0);
    };
    process.on('SIGTERM', () => graceful('SIGTERM'));
    process.on('SIGINT', () => graceful('SIGINT'));
  }
  require('./proxy.js');
})().catch(e => {
  console.error('[boot] error fatal:', e);
  process.exit(1);
});
