'use strict';
// Smoke de las 15 secciones Despachos (deep-link v227): navegar al path real,
// exigir que la sección renderice y que no haya excepciones JS. Es la red de
// seguridad del plan 08: cada extracción a isla debe dejar esto en verde.
// Mapa path→section: NAV_SECTION_MAP (historial.html ~25867) + PAGE_SECTIONS.
const { test, expect } = require('@playwright/test');
const { loginBeforeLoad } = require('./helpers/session');
const { attachConsoleGuard } = require('./helpers/console-guard');

const SECCIONES = [
  ['buscar', 'section-buscar'],
  ['reposicion', 'section-reposicion'],
  ['solicitudes-reposicion', 'section-solicitudes-reposicion'],
  ['solicitudes', 'section-solicitudes'],
  ['sin-adjuntos', 'section-sin-adjuntos'],
  ['dev-cdp', 'section-dev-cdp'],
  ['despacho-obsoleto', 'section-despacho-obsoleto'],
  ['inventario', 'section-inventario'],
  ['averias', 'section-averias'],
  ['basedatos', 'section-basedatos'],
  ['estado-ordenes', 'section-estado-ordenes'],
  ['sdv-portal', 'section-sdv-portal'],
  ['sdv-bandeja', 'section-sdv-bandeja'],
  ['sdv-reactivations', 'section-sdv-reactivations'],
];

for (const [ruta, sectionId] of SECCIONES) {
  test(`deep-link /${ruta} renderiza #${sectionId} sin errores JS`, async ({ page, request }) => {
    const guard = attachConsoleGuard(page);
    await loginBeforeLoad(page, request);
    await page.goto('/' + ruta);
    await expect(page.locator('#screen-login')).toBeHidden({ timeout: 15_000 });
    const seccion = page.locator('#' + sectionId);
    await expect(seccion, `la sección #${sectionId} debe estar visible en /${ruta}`)
      .toBeVisible({ timeout: 15_000 });
    // Render básico: la sección no está vacía.
    const hijos = await seccion.locator(':scope > *').count();
    expect(hijos, `#${sectionId} no debe estar vacía`).toBeGreaterThan(0);
    guard.assertClean();
  });
}

// almacen-mapa es la isla precedente del plan 08 y se comporta distinto según
// cómo se llegue: el deep-link /almacen-mapa sirve la página standalone
// (proxy.js:20165) y la navegación in-app muestra la sección con iframe.
test('deep-link /almacen-mapa carga la página standalone del mapa', async ({ page, request }) => {
  const guard = attachConsoleGuard(page);
  await loginBeforeLoad(page, request); // la página lee wwp_auth por sí misma
  await page.goto('/almacen-mapa');
  await expect(page).toHaveTitle(/Mapa CDP/, { timeout: 15_000 });
  guard.assertClean();
});

test('navegación in-app a almacen-mapa muestra #section-almacen-mapa (iframe)', async ({ page, request }) => {
  const guard = attachConsoleGuard(page);
  await loginBeforeLoad(page, request);
  await page.goto('/buscar');
  await expect(page.locator('#screen-login')).toBeHidden({ timeout: 15_000 });
  await page.click('#nav-almacen-mapa');
  await expect(page.locator('#section-almacen-mapa')).toBeVisible({ timeout: 15_000 });
  guard.assertClean();
});
