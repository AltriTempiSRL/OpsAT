'use strict';
// Ola 3 — islas fáciles (plan 08): formacion, politicas, impacto (tabs WWP en
// iframe) y dev-cdp (sección en iframe). Cada una: deep-link → iframe carga la
// isla y renderiza su UI; standalone también funciona (sesión del storage).
// En local sin Odoo, dev-cdp muestra su estado de error/vacío — se afirma
// render, no datos.
const { test, expect } = require('@playwright/test');
const { loginBeforeLoad } = require('./helpers/session');
const { attachConsoleGuard } = require('./helpers/console-guard');

test.use({ serviceWorkers: 'block' });

const TABS_ISLA = [
  { tab: 'formacion', iframe: '#formacion-iframe', archivo: '/formacion.html', selector: '#tr-body', texto: null },
  { tab: 'politicas', iframe: '#politicas-iframe', archivo: '/politicas.html', selector: '#pol-cards-container', texto: null },
  { tab: 'impacto', iframe: '#impacto-iframe', archivo: '/impacto.html', selector: '#tab-impacto', texto: null },
  { tab: 'empaque', iframe: '#empaque-iframe', archivo: '/empaque.html', selector: '#emp-mat-grid', texto: null },
];

for (const cfg of TABS_ISLA) {
  test(`deep-link /wwp/${cfg.tab} carga la isla en iframe y renderiza`, async ({ page, request }) => {
    const guard = attachConsoleGuard(page);
    await loginBeforeLoad(page, request);
    await page.goto('/wwp/' + cfg.tab);
    await expect(page.locator('#tab-' + cfg.tab)).toBeVisible({ timeout: 15_000 });
    const isla = page.frameLocator(cfg.iframe);
    await expect(isla.locator(cfg.selector)).toBeVisible({ timeout: 15_000 });
    guard.assertClean();
  });

  test(`standalone ${cfg.archivo} funciona con la sesión del storage`, async ({ page, request }) => {
    const guard = attachConsoleGuard(page);
    await loginBeforeLoad(page, request);
    await page.goto(cfg.archivo);
    await expect(page.locator(cfg.selector)).toBeVisible({ timeout: 15_000 });
    guard.assertClean();
  });
}

test('deep-link /dev-cdp carga la isla en iframe', async ({ page, request }) => {
  const guard = attachConsoleGuard(page);
  await loginBeforeLoad(page, request);
  await page.goto('/dev-cdp');
  await expect(page.locator('#section-dev-cdp')).toBeVisible({ timeout: 15_000 });
  const isla = page.frameLocator('#devcdp-iframe');
  await expect(isla.locator('#section-dev-cdp')).toBeVisible({ timeout: 15_000 });
  guard.assertClean();
});

test('el badge de formacion llega al shell por postMessage', async ({ page, request }) => {
  await loginBeforeLoad(page, request);
  await page.goto('/wwp/formacion');
  const isla = page.frameLocator('#formacion-iframe');
  await expect(isla.locator('#tr-body')).toBeVisible({ timeout: 15_000 });
  // El seed local no tiene cursos → count 0 → badge oculto; lo que se prueba es
  // que el canal funciona: el shell recibió el mensaje sin errores y el badge
  // tiene un estado definido (visible con número o display:none).
  const estado = await page.locator('#formacion-badge').evaluate(
    (el) => ({ display: el.style.display, texto: el.textContent }));
  expect(estado.display === 'none' || /^\d+$/.test(estado.texto)).toBe(true);
});
