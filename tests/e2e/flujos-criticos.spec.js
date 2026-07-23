'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// Flujos críticos de tasks/SDV — la parte de Ola 0 que define EL EQUIPO.
// F2.7 (plan 10): implementados los 4 flujos reales el 2026-07-23.
//
// El smoke (specs 01–04) garantiza "cada módulo abre y no explota". Esto otro
// garantiza "las operaciones que no pueden romperse siguen funcionando":
//   1. tasks: crear (API) → visible en la lista → completar (FSM) → reflejado en UI
//   2. sdv:   crear (API) → aparece en la bandeja de Ops
//   3. RBAC negativo: assistant ajeno → 403; sin token → 401
//   4. drawer: deep-link /wwp/tasks/<id> abre el drawer sin errores JS
//
// Notas de contrato (descubiertas en proxy.js, no cambiarlas sin leerlo):
//   - POST /api/wwp/tasks [admin|manager]: title+type requeridos; tipo 'general'
//     no toca Odoo; sin asignados nace status 'pending' (con managerId/assignedTo
//     nacería 'assigned'). Responde {ok,task}. QW5: dueDate auto = mañana.
//   - PATCH /api/wwp/tasks/:id: no hay enum-FSM dura para admin, pero sí gates
//     por tipo (dispatch_order exige PICK done para in_progress y checklist de
//     fotos + OUT done para completed; packaging exige items). 'general' sin
//     items pasa limpio pending→in_progress→completed. 'cancelled' solo sale a
//     'pending' y solo por admin. 'validated' es solo-admin.
//   - Assistant solo puede PATCHear {status,note,by,byUserId} y SOLO si participa
//     (managerId/assignedTo/executors/assignees) → si no, 403.
//   - POST /api/sdv [ventas|manager|admin]: tipoSolicitud ∈ SDV_TIPOS; el resto
//     opcional para 'despacho_cliente'. Responde 201 {ok,solicitud} con folio.
//     100% offline (sin Odoo). GET /api/sdv alimenta #sdv-bandeja-list.
// ═══════════════════════════════════════════════════════════════════════════
const { test, expect } = require('@playwright/test');
const { loginBeforeLoad, apiLogin } = require('./helpers/session');
const { attachConsoleGuard } = require('./helpers/console-guard');

// Ejemplo del patrón (real, verificado): las subrutas de vistas de tareas
// (_ROUTE_TASK_VIEWS, historial.html ~24341) no rompen el panel.
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

// Estado compartido entre flujos (workers=1 → mismo proceso, orden serial del
// archivo): el flujo 1 crea la tarea; el RBAC (3) y el drawer (4) la reutilizan.
let tareaE2E = null;

test('tasks: crear tarea general vía API → visible en la lista → completar (FSM) → reflejado en UI', async ({ page, request }) => {
  const guard = attachConsoleGuard(page);
  const s = await loginBeforeLoad(page, request);
  const hdr = { Authorization: 'Bearer ' + s.accessToken };
  const titulo = 'E2E-flujo-tarea-' + Date.now();
  const crear = await request.post('/api/wwp/tasks', { headers: hdr, data: { title: titulo, type: 'general' } });
  expect(crear.ok(), 'POST /api/wwp/tasks').toBeTruthy();
  tareaE2E = { id: (await crear.json()).task.id, titulo };
  await page.goto('/wwp/tasks/list');
  await expect(page.locator('#screen-login')).toBeHidden({ timeout: 15_000 });
  await expect(page.locator('#tasks-list .task-list-row', { hasText: titulo }), 'la tarea nueva aparece en la lista')
    .toBeVisible({ timeout: 15_000 });
  // FSM: sin asignados nace 'pending' → in_progress → completed (sin saltos; 'general' no tiene gates).
  for (const status of ['in_progress', 'completed']) {
    const r = await request.patch('/api/wwp/tasks/' + tareaE2E.id, { headers: hdr, data: { status } });
    expect(r.ok(), 'PATCH status=' + status).toBeTruthy();
  }
  await page.reload();
  // Las completadas viven en el accordion "Completadas — en espera de validación" (cerrado por defecto).
  await page.locator('summary.task-archive-summary', { hasText: 'Completadas' }).click();
  await expect(page.locator('#tasks-list .task-list-row[data-status="completed"]', { hasText: titulo }),
    'la tarea completada aparece en el archivo de completadas').toBeVisible({ timeout: 15_000 });
  guard.assertClean();
});

test('sdv: crear solicitud vía API → aparece en la bandeja de Ops', async ({ page, request }) => {
  const guard = attachConsoleGuard(page);
  const s = await loginBeforeLoad(page, request);
  const cliente = 'E2E-cliente-' + Date.now();
  const crear = await request.post('/api/sdv', {
    headers: { Authorization: 'Bearer ' + s.accessToken },
    data: { tipoSolicitud: 'despacho_cliente', clienteNombre: cliente,
            odooOrderRef: 'E2E-SO-' + Date.now(), direccionEntrega: 'Av. E2E #1', ciudadEntrega: 'Santo Domingo' },
  });
  expect(crear.status(), 'POST /api/sdv responde 201').toBe(201);
  const folio = (await crear.json()).solicitud.folio;
  await page.goto('/sdv-bandeja');
  await expect(page.locator('#screen-login')).toBeHidden({ timeout: 15_000 });
  const card = page.locator('#sdv-bandeja-list .sdv-list-card', { hasText: folio });
  await expect(card, `la SDV ${folio} aparece en la bandeja`).toBeVisible({ timeout: 15_000 });
  await expect(card).toContainText(cliente);
  guard.assertClean();
});

test('RBAC negativo: assistant no participante recibe 403 y sin token el listado responde 401', async ({ request }) => {
  expect(tareaE2E, 'requiere la tarea creada en el flujo de tasks').toBeTruthy();
  // hcheco es 'assistant' del seed (seedAuthUsers, proxy.js ~4832; password default WWP2026!)
  // y NO participa en la tarea E2E → el RBAC granular del PATCH debe cortarlo con 403.
  const aux = await apiLogin(request, { email: 'hcheco@altritempi.com.do', password: 'WWP2026!' });
  const patch = await request.patch('/api/wwp/tasks/' + tareaE2E.id, {
    headers: { Authorization: 'Bearer ' + aux.accessToken },
    data: { status: 'in_progress' },
  });
  expect(patch.status(), 'assistant ajeno a la tarea → 403').toBe(403);
  const sinToken = await request.get('/api/wwp/tasks');
  expect(sinToken.status(), 'GET /api/wwp/tasks sin Bearer → 401').toBe(401);
});

test('drawer: el deep-link /wwp/tasks/<id> abre el drawer de la tarea sin errores JS', async ({ page, request }) => {
  expect(tareaE2E, 'requiere la tarea creada en el flujo de tasks').toBeTruthy();
  const guard = attachConsoleGuard(page);
  await loginBeforeLoad(page, request);
  await page.goto('/wwp/tasks/' + tareaE2E.id);
  await expect(page.locator('#screen-login')).toBeHidden({ timeout: 15_000 });
  await expect(page.locator('#tab-tasks')).toBeVisible({ timeout: 15_000 });
  // Ruta con id (no vista) → _routeApplyTasksExtra → routeNotifTarget → openDrawer (core.js ~2313).
  await expect(page.locator('#wwp-drawer'), 'el drawer abre').toHaveClass(/open/, { timeout: 15_000 });
  await expect(page.locator('#drawer-title')).toContainText(tareaE2E.titulo);
  guard.assertClean();
});
