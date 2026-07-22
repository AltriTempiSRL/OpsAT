'use strict';
// Guardia de consola para el smoke: una excepción JS no capturada (pageerror)
// SIEMPRE es fallo. console.error se filtra con una allowlist de ruido esperado
// en local sin credenciales Odoo/Sheets: checkOdooConnection() y
// checkSheetsConnection() reintentan 4× al cargar (historial.html ~21480+).
//
// Ojo Chromium: en "Failed to load resource: ... status of 401" el texto NO trae
// la URL — viaja en msg.location().url. Por eso la allowlist se evalúa contra
// texto Y URL de origen del mensaje.
const ALLOW = [
  /\/api\/odoo/i,
  /\/api\/sheets/i,
  // Isla almacen-mapa: su helper odoo() (almacen-mapa.html ~1743) loguea
  // "Invalid URL" cuando no hay credenciales Odoo en local. Solo ese origen.
  /Invalid URL[\s\S]*\/almacen-mapa:\d+/,
];

// 502/503 sobre /api/* = upstream no disponible en el entorno local de test:
// 502 = proxy a Odoo sin credenciales (p.ej. odoo-photo, proxy.js ~12579);
// 503 = subsistema apagado por diseño (p.ej. visor BD sin PostgreSQL,
// proxy.js ~20577). Un 4xx o 500 NO se permite: eso es contrato roto de la app.
function esUpstreamAusente(text, url) {
  return /status of 50[23]\b/.test(text) && /\/api\//.test(url);
}

function attachConsoleGuard(page) {
  const errors = [];
  page.on('pageerror', (e) => {
    errors.push({ kind: 'pageerror', text: String((e && e.message) || e) });
  });
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    const url = (msg.location() && msg.location().url) || '';
    if (ALLOW.some((re) => re.test(text) || re.test(url))) return;
    if (esUpstreamAusente(text, url)) return;
    errors.push({ kind: 'console.error', text: text + (url ? `  ← ${url}` : '') });
  });
  return {
    errors,
    assertClean() {
      if (errors.length) {
        const lines = errors.map((e) => `  [${e.kind}] ${e.text}`).join('\n');
        throw new Error('Errores de consola no permitidos:\n' + lines);
      }
    },
  };
}

module.exports = { attachConsoleGuard };
