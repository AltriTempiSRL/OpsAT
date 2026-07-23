'use strict';
// Ola 1: core.js/theme.css extraídos del monolito (plan 08). Estos tests
// protegen el contrato de la extracción:
//  - el server sirve el núcleo y lo cachea fuerte cuando va versionado (?v=)
//  - el shell define las funciones núcleo en el scope global (sloppy mode)
//  - APP_BUILD sigue DENTRO de historial.html — getHtmlBuild (proxy.js ~292)
//    lo parsea del HTML con /var APP_BUILD = '...'/: si alguien lo mueve a
//    core.js, /api/app-version queda desfasado y el version-gate recarga mal.
const { test, expect } = require('@playwright/test');
const { loginBeforeLoad } = require('./helpers/session');
const { attachConsoleGuard } = require('./helpers/console-guard');

// El SW (sw.js) recarga la página una vez al tomar control en un contexto
// fresco (controllerchange → reload), lo que destruye el contexto de evaluate.
// Estos specs verifican core/theme, no el SW → bloquearlo los hace deterministas.
test.use({ serviceWorkers: 'block' });

test.describe('core.js (Ola 1)', () => {
  test('GET /core.js sirve el núcleo completo', async ({ request }) => {
    const res = await request.get('/core.js');
    expect(res.status()).toBe(200);
    const js = await res.text();
    for (const marca of ['function authFetch', 'function can(', 'function canSection(',
      'function connectSSE', 'function esc(', 'function toast(', 'function doLogin']) {
      expect(js, `core.js debe contener "${marca}"`).toContain(marca);
    }
    // Como DIRECTIVA al inicio (comentarios de por medio no cuentan): el header
    // del archivo menciona la frase, eso es válido.
    const abreConUseStrict = /^\s*(\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*['"]use strict['"]/.test(js);
    expect(abreConUseStrict, 'core.js NO debe abrir con directiva use strict (globals implícitos del monolito)')
      .toBe(false);
    expect(js, 'APP_BUILD NO debe vivir en core.js (getHtmlBuild lo parsea del HTML)')
      .not.toContain('var APP_BUILD');
  });

  test('core.js versionado (?v=) se cachea immutable; historial.html lo referencia con hash', async ({ request }) => {
    const html = await (await request.get('/historial.html')).text();
    const m = html.match(/<script src="\/core\.js\?v=([0-9a-f]{8})"><\/script>/);
    expect(m, 'historial.html debe cargar /core.js?v=<hash md5-8>').toBeTruthy();
    const res = await request.get('/core.js?v=' + m[1]);
    expect(res.status()).toBe(200);
    expect(res.headers()['cache-control'] || '').toContain('immutable');
  });

  test('el shell define el núcleo en window (orden de carga intacto)', async ({ page, request }) => {
    const guard = attachConsoleGuard(page);
    await loginBeforeLoad(page, request);
    await page.goto('/historial.html');
    await expect(page.locator('#screen-login')).toBeHidden({ timeout: 15_000 });
    const tipos = await page.evaluate(() => ({
      esc: typeof esc, toast: typeof toast, authFetch: typeof authFetch,
      can: typeof can, canSection: typeof canSection, connectSSE: typeof connectSSE,
      uiSetVisible: typeof uiSetVisible, appBuild: typeof APP_BUILD,
    }));
    for (const [k, v] of Object.entries(tipos)) {
      expect(v, `${k} debe estar definido`).toBe(k === 'appBuild' ? 'string' : 'function');
    }
    guard.assertClean();
  });

  test('APP_BUILD del cliente coincide con /api/app-version (parser getHtmlBuild vivo)', async ({ page, request }) => {
    const server = await (await request.get('/api/app-version')).json();
    expect(server.build).toMatch(/^v\d+/);
    await page.goto('/historial.html');
    const cliente = await page.evaluate(() => window.APP_BUILD);
    expect(cliente).toBe(server.build);
  });
});

test.describe('theme.css (Ola 1)', () => {
  test('los design tokens resuelven en modo claro (default)', async ({ page }) => {
    await page.goto('/historial.html');
    const v = await page.evaluate(() => ({
      surface: getComputedStyle(document.documentElement).getPropertyValue('--surface').trim(),
      greenBg: getComputedStyle(document.documentElement).getPropertyValue('--green-bg').trim(),
    }));
    expect(v.surface, 'token --surface claro').toBe('#f4f3f1');
    expect(v.greenBg, 'token --green-bg claro').toBe('#e2f0e8');
  });

  test('wwp_theme=dark aplica los tokens oscuros', async ({ page }) => {
    await page.addInitScript(() => { try { localStorage.setItem('wwp_theme', 'dark'); } catch (e) {} });
    await page.goto('/historial.html');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const surface = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--surface').trim());
    expect(surface, 'token --surface oscuro (Night Ops)').toBe('#14171e');
  });
});
