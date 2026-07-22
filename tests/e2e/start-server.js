'use strict';
// Arranque del server para la suite E2E (lo invoca webServer de Playwright).
// Cross-platform (el `rm -rf` de shell no existe en Windows): limpia el
// DATA_DIR desechable y carga el proxy real.
const fs = require('fs');
const path = require('path');

const dataDir = process.env.DATA_DIR || '';
// Guardia: SOLO se borra el sandbox de la suite. Si DATA_DIR apunta a otra
// cosa (data-local, un volumen real), abortar antes que destruir datos.
if (!dataDir.includes('.data-e2e')) {
  console.error('[e2e] DATA_DIR no apunta al sandbox .data-e2e — abortando: ' + dataDir);
  process.exit(1);
}
fs.rmSync(dataDir, { recursive: true, force: true });

require(path.resolve(__dirname, '..', '..', 'proxy.js'));
