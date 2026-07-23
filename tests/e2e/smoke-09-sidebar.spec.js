'use strict';
// Sidebar colapsable (desktop): ancho 210↔64 px, labels ocultos con tooltip,
// estado persistido en localStorage wwp_sidebar_collapsed, y — lo que más
// importa — la clase NO debe afectar el drawer off-canvas de móvil (≤767px),
// que es donde trabaja la bodega.
const { test, expect } = require('@playwright/test');
const { loginBeforeLoad } = require('./helpers/session');
const { attachConsoleGuard } = require('./helpers/console-guard');

const medir = (page) => page.evaluate(() => {
  const sb = document.querySelector('.sidebar');
  const cont = document.querySelector('#screen-app') || document.querySelector('#app');
  const item = document.querySelector('.sidebar .nav-item');
  const svg = item && item.querySelector('.nav-icon svg, .nav-icon i');
  return {
    w: Math.round(sb.getBoundingClientRect().width),
    pad: cont ? getComputedStyle(cont).paddingLeft : null,
    colapsado: document.body.classList.contains('sidebar-collapsed'),
    fs: item ? getComputedStyle(item).fontSize : null,
    title: item ? item.getAttribute('title') : null,
    icono: svg ? Math.round(svg.getBoundingClientRect().width) : 0,
    aria: document.querySelector('#sidebar-collapse-btn')?.getAttribute('aria-expanded'),
    btnVisible: !!document.querySelector('#sidebar-collapse-btn')?.offsetParent,
  };
});

test('sidebar colapsable: desktop colapsa, persiste y restaura', async ({ page, request }) => {
  const guard = attachConsoleGuard(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await loginBeforeLoad(page, request);
  // Usuario "que ya aceptó": sin esto, #wwp-welcome (consentimiento de primera
  // vez, z-index 10000) cubre el sidebar y bloquea los clicks.
  await page.addInitScript(() => { try { localStorage.setItem('wwp_welcome_v1', '1'); } catch (e) {} });
  await page.goto('/wwp/tasks');
  await expect(page.locator('#screen-login')).toBeHidden({ timeout: 15_000 });
  await expect(page.locator('.sidebar')).toBeVisible({ timeout: 15_000 });

  const exp = await medir(page);
  console.log('EXPANDIDO:', JSON.stringify(exp));
  expect(exp.w).toBe(210);
  expect(exp.colapsado).toBe(false);
  expect(exp.btnVisible).toBe(true);
  expect(exp.title).toBeNull();

  await page.click('#sidebar-collapse-btn');
  await page.waitForTimeout(400);
  const col = await medir(page);
  console.log('COLAPSADO:', JSON.stringify(col));
  expect(col.w).toBe(64);
  expect(col.pad).toBe('64px');
  expect(col.fs).toBe('0px');           // label oculto
  expect(col.icono).toBeGreaterThan(10); // icono sigue visible
  expect(col.title).toBeTruthy();        // tooltip con el nombre
  expect(col.aria).toBe('false');

  await page.reload();
  await expect(page.locator('.sidebar')).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(300);
  const tras = await medir(page);
  console.log('TRAS F5  :', JSON.stringify(tras));
  expect(tras.colapsado).toBe(true);
  expect(tras.w).toBe(64);

  await page.click('#sidebar-collapse-btn');
  await page.waitForTimeout(400);
  const re = await medir(page);
  console.log('RE-EXPAND:', JSON.stringify(re));
  expect(re.w).toBe(210);
  expect(re.title).toBeNull();
  guard.assertClean();
});

test('sidebar colapsable: en móvil la clase no encoge el drawer', async ({ page, request }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await loginBeforeLoad(page, request);
  // Usuario "que ya aceptó": sin esto, #wwp-welcome (consentimiento de primera
  // vez, z-index 10000) cubre el sidebar y bloquea los clicks.
  await page.addInitScript(() => { try { localStorage.setItem('wwp_welcome_v1', '1'); } catch (e) {} });
  await page.goto('/wwp/tasks');
  await expect(page.locator('.sidebar')).toBeVisible({ timeout: 15_000 });
  await page.click('#sidebar-collapse-btn');          // colapsar en desktop
  await page.waitForTimeout(300);
  await page.setViewportSize({ width: 390, height: 844 });  // pasar a móvil
  await page.waitForTimeout(400);
  const m = await medir(page);
  console.log('MOVIL    :', JSON.stringify(m));
  expect(m.colapsado).toBe(true);   // la clase sigue puesta…
  expect(m.w).toBe(264);            // …pero el drawer conserva su ancho
  expect(m.fs).not.toBe('0px');     // y los labels se ven
});
