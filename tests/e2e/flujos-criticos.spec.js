'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// Flujos críticos de tasks/SDV — la parte de Ola 0 que define EL EQUIPO.
//
// El smoke (specs 01–04) garantiza "cada módulo abre y no explota". Esto otro
// garantiza "las operaciones que no pueden romperse siguen funcionando".
// Qué flujos son críticos es conocimiento de operación (Gabriel/Filippo):
//
//   TODO(equipo): definir 3–5 flujos reales siguiendo el patrón de abajo.
//   Candidatos mencionados en el plan 08 y MEMORIA-PROYECTO:
//     - tasks: crear tarea → aparece en la lista → abrir drawer → completar
//     - tasks: filtros/vistas persisten (wwp_task_view / wwp_task_filters)
//     - sdv: crear solicitud en sdv-portal → aparece en sdv-bandeja
//     - sdv: cancelar → reactivar (ya existe test-sdv-cancel-reactivate.sh a
//       nivel API; aquí iría la versión por UI)
//
// Cada flujo son ~5–10 líneas: navegar, click/fill con selectores reales,
// y un expect de resultado. El ejemplo "vistas de tareas por URL" de abajo
// muestra el patrón funcionando.
// ═══════════════════════════════════════════════════════════════════════════
const { test, expect } = require('@playwright/test');
const { loginBeforeLoad } = require('./helpers/session');
const { attachConsoleGuard } = require('./helpers/console-guard');

// Ejemplo del patrón (real, verificado): las subrutas de vistas de tareas
// (_ROUTE_TASK_VIEWS, historial.html ~27906) no rompen el panel.
for (const vista of ['list', 'kanban', 'cal']) {
  test(`tasks: la vista /wwp/tasks/${vista} carga sin errores JS`, async ({ page, request }) => {
    const guard = attachConsoleGuard(page);
    await loginBeforeLoad(page, request);
    await page.goto('/wwp/tasks/' + vista);
    await expect(page.locator('#screen-login')).toBeHidden({ timeout: 15_000 });
    await expect(page.locator('#tab-tasks')).toBeVisible({ timeout: 15_000 });
    guard.assertClean();
  });
}

// ── Flujos por definir (marcados fixme: aparecen en el reporte como pendientes,
//    no fallan la suite). Reemplazar el cuerpo y quitar el .fixme al definirlos.
test.fixme('tasks: crear tarea → aparece en la lista → completar', async ({ page, request }) => {
  // TODO(equipo): ~5-10 líneas. Esqueleto sugerido:
  // await loginBeforeLoad(page, request);
  // await page.goto('/wwp/tasks');
  // await page.click('<selector botón nueva tarea>');
  // await page.fill('<selector título>', 'E2E tarea de prueba');
  // await page.click('<selector guardar>');
  // await expect(page.locator('text=E2E tarea de prueba')).toBeVisible();
});

test.fixme('sdv: crear solicitud en portal → aparece en bandeja', async ({ page, request }) => {
  // TODO(equipo): definir con los selectores reales de sdv-portal/sdv-bandeja.
});
