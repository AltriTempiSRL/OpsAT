'use strict';
// Smoke de las 9 pestañas WWP (deep-link /wwp/<tab>): panel #tab-<name> visible
// y sin excepciones JS. Tabs válidos: _ROUTE_WWP_TABS (historial.html ~27861).
const { test, expect } = require('@playwright/test');
const { loginBeforeLoad } = require('./helpers/session');
const { attachConsoleGuard } = require('./helpers/console-guard');

const TABS = [
  'tasks', 'dashboard', 'users', 'vehiculos', 'politicas',
  'impacto', 'empaque', 'formacion', 'archivo',
];

for (const tab of TABS) {
  test(`deep-link /wwp/${tab} muestra el panel #tab-${tab} sin errores JS`, async ({ page, request }) => {
    const guard = attachConsoleGuard(page);
    await loginBeforeLoad(page, request);
    await page.goto('/wwp/' + tab);
    await expect(page.locator('#screen-login')).toBeHidden({ timeout: 15_000 });
    await expect(page.locator('#screen-app'), 'WWP vive en #screen-app')
      .toHaveClass(/active/, { timeout: 15_000 });
    await expect(page.locator('#tab-' + tab), `panel #tab-${tab} visible`)
      .toBeVisible({ timeout: 15_000 });
    guard.assertClean();
  });
}
