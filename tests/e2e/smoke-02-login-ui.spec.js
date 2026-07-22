'use strict';
// Login por la UI real (único spec que pasa por el formulario; el resto inyecta
// sesión). Selectores: #f-email / #f-password / #btn-login (historial.html ~5614+),
// error #login-error.show, éxito showScreen('screen-app') (~9290).
const { test, expect } = require('@playwright/test');
const { ADMIN } = require('./helpers/session');
const { attachConsoleGuard } = require('./helpers/console-guard');

test.describe('login UI', () => {
  test('carga fría muestra la pantalla de login sin errores JS', async ({ page }) => {
    const guard = attachConsoleGuard(page);
    await page.goto('/historial.html');
    await expect(page.locator('#screen-login')).toBeVisible();
    await expect(page.locator('#f-email')).toBeVisible();
    await expect(page.locator('#f-password')).toBeVisible();
    guard.assertClean();
  });

  test('password incorrecta muestra el error y NO entra', async ({ page }) => {
    await page.goto('/historial.html');
    await page.fill('#f-email', ADMIN.email);
    await page.fill('#f-password', 'incorrecta-123');
    await page.click('#btn-login');
    await expect(page.locator('#login-error')).toHaveClass(/show/);
    await expect(page.locator('#screen-login')).toBeVisible();
  });

  test('login correcto aterriza en la app y persiste wwp_auth', async ({ page }) => {
    const guard = attachConsoleGuard(page);
    await page.goto('/historial.html');
    await page.fill('#f-email', ADMIN.email);
    await page.fill('#f-password', ADMIN.password);
    await page.click('#btn-login');
    // Tras login desaparece la pantalla de login; admin aterriza según ruta.
    await expect(page.locator('#screen-login')).toBeHidden({ timeout: 15_000 });
    const stored = await page.evaluate(() =>
      localStorage.getItem('wwp_auth') || sessionStorage.getItem('wwp_auth'));
    expect(stored, 'wwp_auth debe persistirse tras login').toBeTruthy();
    const parsed = JSON.parse(stored);
    expect(parsed.accessToken).toBeTruthy();
    expect(parsed.user && parsed.user.role).toBe('admin');
    guard.assertClean();
  });
});
