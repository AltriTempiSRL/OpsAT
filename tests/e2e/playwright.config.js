// @ts-check
// ═══════════════════════════════════════════════════════════════════════════
// Ola 0 — red de seguridad Playwright (plan docs/auditoria-arquitectura/08)
//
// Levanta el server real (`node proxy.js`, modo archivos JSON) con un DATA_DIR
// desechable que se borra en cada corrida: el primer `listen` re-siembra los
// usuarios de prueba vía seedAuthUsers() (proxy.js ~4734). Sin DATABASE_URL,
// sin Odoo, sin R2 — las env se fuerzan a '' para que un .env local nunca
// contamine la corrida (loadEnv solo pisa envs undefined).
// ═══════════════════════════════════════════════════════════════════════════
const path = require('path');
const { defineConfig } = require('@playwright/test');

const ROOT = path.resolve(__dirname, '..', '..');
const DATA_DIR = path.join(__dirname, '.data-e2e');
const PORT = Number(process.env.E2E_PORT || 3100);
const BASE = `http://localhost:${PORT}`;

module.exports = defineConfig({
  testDir: __dirname,
  outputDir: path.join(__dirname, '.artifacts'),
  timeout: 30_000,
  // Tolerancia a flakiness de timing: el login real verifica bcrypt (CPU) y bajo
  // carga (server + Chromium en el mismo equipo) algún login/aserción puntual pasa
  // del timeout de forma no determinista. 2 reintentos absorben esa varianza sin
  // enmascarar roturas reales (un fallo determinista falla las 3 veces).
  retries: 2,
  // Un solo server compartido con estado en archivos JSON → serial y determinista.
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: path.join(__dirname, '.report'), open: 'never' }],
  ],
  use: {
    baseURL: BASE,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    // start-server.js limpia el sandbox .data-e2e (con guardia) y carga proxy.js.
    command: 'node tests/e2e/start-server.js',
    cwd: ROOT,
    url: `${BASE}/api/health`,
    reuseExistingServer: false,
    timeout: 30_000,
    env: {
      PORT: String(PORT),
      DATA_DIR,
      // Aislamiento: con DATABASE_URL definida `node proxy.js` hace exit(1);
      // con Odoo/Sheets reales los tests golpearían producción.
      DATABASE_URL: '',
      ODOO_URL: '',
      ODOO_DB: '',
      ODOO_USER: '',
      ODOO_API_KEY: '',
      CONT_SHEETS_ID: '',
      R2_ACCOUNT_ID: '',
      R2_ACCESS_KEY_ID: '',
      R2_SECRET_ACCESS_KEY: '',
      R2_BUCKET: '',
      WWP_FORCE_PW_CHANGE: '',
    },
  },
});
