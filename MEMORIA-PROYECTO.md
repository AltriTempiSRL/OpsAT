# Memoria del proyecto — Workforce Platform (historial.html + proxy.js)

> Documento de contexto para retomar el trabajo sin perder decisiones.
> Última actualización: sesión de rediseño del flujo de tareas (jun 2026).

## URLs y deploy
- **Producción ACTUAL (Railway): `https://dashboard-despachos-production.up.railway.app`** (desde jun 2026).
  - Render (`dashboard-despachos.onrender.com`) fue la producción anterior — ya no se le aplican cambios.
- Local: `http://localhost:3000` (correr con `DATA_DIR=<ruta>/data-local node proxy.js`).
- Deploy: `railway up --service dashboard-despachos --detach` desde la raíz (CLI; ver RAILWAY.md). GitHub es solo respaldo — push a `master` NO despliega. Commitear siempre antes de deployar.
- Datos: producción en disco persistente (env `DATA_DIR`); local en `data-local/`.
- Convención: librerías LOCALES, nunca CDN (lucide.min.js, leaflet.js, leaflet.css).

## Modelo de tareas (WWP) — conceptos clave
- Tipos: `packaging`, `dispatch_order`, `warehouse_move`, `item_pickup`, `truck_loading`, `general`, `staffing`.
- Estados: pending → assigned → in_progress → completed → validated (+ cancelled).
- Cadena: tarea madre + subtareas (`parentId`, `subIndex`, `dependsOnPrev`).
- Participantes: `managerId` (encargado/responsable), `assignees`/`auxiliaryAssignees` (auxiliares), `executors`.
  - El PATCH de tarea sincroniza `assignees` y `auxiliaryAssignees` juntos (para liberar/reemplazar sin residuos).
- Kits: componentes con `kitId/kitRef/kitName/kitImage`; tarjeta-kit sintética `isKit:true` (item_id `kit_<kitId>_<inst>`) cuando está armado.
  - ⚠️ Los componentes de un kit ARMADO quedan `selected:false` (kit-toggle). v202 los protege en TODAS las rutas que reescriben items: merge v113 (pool+huérfanos), `getOrderClaims` (reclaman su unidad), `PUT /items` (re-adjunta los ocultos si el payload trae la tarjeta armada sin ellos — el carrito del modal Editar solo precarga `selected`). El drawer además renderiza la tarjeta-kit aunque no queden componentes (aviso + confirmable), para que la tarea nunca sea imposible de completar. Harness: `tests/_test_v202.mjs` (caso #0177 S07286).

## El WIZARD de creación de tareas (reemplaza el modal plano)
Punto de entrada: `openNewTaskModal()` → `openTaskWizard(opts)`. 4 pasos, cada uno pantalla independiente.
- **Paso 1 — Concepto** (`_WIZ_DEF`): Empaque (`pack`), Empaque y Despacho (`pack_dispatch`), Empaque y Almacenamiento (`pack_store`), Tarea Libre (`free`), **Solicitud de Personal (`staffing`)**.
- **Paso 2 — Encargados** (`_wizS2`): SOLO managers (no admins). Multi-select para empaque (`packers`) y para despacho/almacén (`dispatchMgrs`/`storeMgrs`, también multi). Fechas límite independientes. **Encargado OBLIGATORIO en todos los conceptos** (bloquea avanzar sin él).
- **Paso 3 — Órdenes** (`_wizS3`): buscador Odoo. El título se auto-genera de la orden (no campo manual). Selector de múltiples picks + devoluciones RET. Carrito con qty editable + botón ÷ para split por encargado/localidad. Kits agrupados con foto. Prompt "¿agregar otra orden?". Descripción disponible en todos los conceptos; fotos de guía en Tarea Libre.
- **Paso 4 — Resumen** → Crear.
- Multi-encargado de empaque → una tarea por encargado. Multi-despachador → una subtarea de despacho por persona.

### Variantes del wizard
- **Subtarea** (`openTaskWizard({subtaskParentId})`): Paso 1 muestra tipos individuales (`_WIZ_SUBTYPE_DEF`: Despacho/Almacenamiento/Recogida/Carga/Libre). Hereda artículos de la madre (checkboxes) + toggle "Requiere paso anterior". Botón "+ Nueva subtarea" usa esto.
- **Solicitud de Personal** (`staffing`): Paso 2 = solicitante (texto) + actividad + rango fechas + horario (horas calculadas) + multi-select de AUXILIARES con detección de conflictos. Si un auxiliar ya está en una tarea activa, alerta y permite elegir reemplazo en esa tarea (libera al auxiliar). Responsable = creador automáticamente. Paso 3 = instrucciones + fotos.
- **Desde contexto** (`abrirNuevaTareaWWP`, postMessage, devoluciones CDP): pre-llena concepto/orden/descripción y salta pasos.

### Validación de conflictos de orden (en wizFetch / `_wizCheckOrderConflicts`)
- Bloquea crear si ya existe una cadena compuesta activa (pack_dispatch ↔ pack_store) para la misma orden, o si todos los artículos ya están reclamados. Banner con tareas relacionadas y botón "Ver".

## Vista de DESPACHO (auxiliar/ejecutor) — drawer especial para `dispatch_order`
- Orden del drawer: contexto orden → estado del pick → checklist → artículos a entregar → [botón abajo] → historial.
- **Gate de inicio por pick Odoo**: el despacho solo puede iniciar cuando el pick está `done` (realizado). Endpoint `GET /tasks/:id/pick-status`. Banner verde/ámbar. Validado también en backend.
- **Checklist de despacho** (3 fotos obligatorias antes de completar): Recibir/validar documentos (`fotos_recepcion`), Foto de vehículo cargado (`fotos_vehiculo`), Documentos de entrega firmados (`fotos_entrega`). Endpoints genéricos `POST/DELETE /tasks/:id/fotos-(recepcion|vehiculo|entrega)`.
- **Artículos orientados a entrega**: por artículo — estado (Entregado OK / Con avería+tipo / No entregado), foto(s). Endpoint `PATCH /tasks/:id/items/:itemId/entrega`.
- Hereda config de kit del empaque: kit armado = 1 unidad; desarmado = componentes. `syncKitStructureToChildren()` en backend (corre en kit-toggle y PUT /items del empaque).
- El auxiliar asignado al despacho puede iniciar/cerrar su propio despacho.
- Aislamiento: auxiliar con solo despacho ve únicamente lo de despacho (oculta guía/evidencia/subtareas de empaque); el contexto de la orden queda como referencia.

## Filtrado de lista del auxiliar
- `auxFinishedAndStale()`: oculta tareas donde el auxiliar ya terminó (auxDone o cerrada) mostrando solo su próxima tarea. Reaparece si el encargado modifica la tarea después (`itemsUpdatedAt` > fecha de terminado). `itemsUpdatedAt` se setea en PUT /items y en edición de campos por encargado.

## pick-diff (banner "El pick cambió")
- No reporta cambio falso por split entre encargados: excluye unidades reclamadas por OTRAS tareas activas de la misma orden (`getOrderClaims` por unidad). Solo avisa por cambios reales del pick en Odoo.

## Botón "Actualizar" en el drawer
- `refreshDrawer()` recarga la tarea desde el servidor sin refrescar el browser. Ícono refresh en el header del drawer.

## Notificaciones
- Click en notificación con tarea borrada → toast "La tarea ya no existe" (antes no hacía nada).
- Endpoint `DELETE /notifications/orphans` (borra notifs cuya tarea no existe). El botón "Limpiar" borra leídas + huérfanas.

## Impersonation (admin actúa como otro usuario sin login)
- Backend: `POST /auth/impersonate` (admin → token de otro usuario con `impersonatedBy` + auditoría), `POST /auth/stop-impersonate`.
- Frontend: menú de perfil "Cambiar de usuario" (solo admin) → modal lista buscable. Banner morado "Actuando como X" + "Volver a mi cuenta". Token de 8h sin refresh.

## Geolocalización GPS (rastreo de auxiliares)
- Permiso de rol **`wwp.rastreo_gps`** (configurable en Roles → Editar permisos, sección "Campo"). Activo por defecto para Auxiliar. Admins NO rastrean.
- `_captureGeo(context, taskId)`: captura best-effort en iniciar/completar tarea, "Terminé mi parte", subir fotos de despacho. Solo si el rol tiene el permiso.
- Backend: `POST /auth/location` (guarda `lastLocation` + historial `wwp-locations.json`, retención 7 días). `GET /auth/locations` (última de todos, filtra por permiso), `GET /auth/users/:id/locations` (recorrido).
- **Mapa** (Leaflet local): botón "Ver mapa" en Usuarios (solo admin) → modal con pines de auxiliares; click → popup + "Ver recorrido" (polyline inicio rojo / intermedios azul / última verde). `invalidateSize()` tras abrir el modal (si no, tiles no cargan).
- ⚠️ **CSP/Permissions-Policy** (proxy.js ~línea 1360): `Permissions-Policy: geolocation=(self)` (sin esto el GPS no funciona); CSP `img-src`/`connect-src` incluyen `https://*.tile.openstreetmap.org` (sin esto el mapa sale gris).
- Permiso del navegador: una vez por dispositivo+navegador (no por cuenta).

## Pantalla de bienvenida + consentimiento (primera vez, todos los usuarios)
- `maybeShowWelcome()` en `enterApp` si no existe flag `wwp_welcome_v1`. Describe la plataforma (foco en sección Tareas) + permisos. Botón "Aceptar y continuar" dispara notificaciones + ubicación (si rol con rastreo) en secuencia. Opción "Ahora no".
- Para re-ver: `localStorage.removeItem('wwp_welcome_v1')` y recargar.

## PLAN GO-LIVE SOLICITUD DE DESPACHO (2026-06-20)

**Decisiones Aprobadas (Gabriel):**

### D1: Creación de Solicitud de Despacho
- **Vendedoras** crean orden en Odoo (`sale.order`)
- **Encargado o Admin de Operaciones** procesa y convierte en tarea WWP (`dispatch_order`)
- Implementación: nueva sección "Órdenes listas para despacho" (lista órdenes Odoo sin tarea WWP)
- Estimación Fase 1: 16-20h (componente nuevo + filtrado + integración Odoo)

### D2: Gate de Picking — ACTIVAR
- Al clic "Iniciar despacho": validar picking Odoo `state='done'` + cantidades coinciden
- Re-chequear cada inicio (no solo una vez)
- Línea 6842 proxy.js: desactivar comentario "temporalmente desactivado"
- Estimación: 4-6h

### D3: Sync Rechazos/Averías a Odoo — OPCIÓN C (Híbrido, Fase 2)
- Al completar despacho con items rechazados/dañados: mostrar panel "Sincronizar a Odoo"
- Botón "Generar nota de crédito" → abre Odoo pre-rellena (NO automático)
- Estimación Fase 2: 12-16h (puede avanzar si hay tiempo)

### D4: KPIs de Despacho — FASE 2
- Estructura datos ahora (Fase 1): campos `dispatchStartedAt`, `dispatchCompletedAt`
- Dashboard post-Go-Live (despachos/turno, tiempo promedio, tasa rechazo)
- Estimación Fase 1: 2h (schema); Fase 2: 12-16h (UI)

**BLOQUEADORES CRÍTICOS (FASE 1 — pre-Go-Live):**
1. Activar gate picking (QA/Pit, 4-6h)
2. Estado vacío manejo (Mark, 3-4h)
3. Sync Odoo retorno — `PATCH stock.picking.state='done'` (Ron, 12-16h)
4. RBAC testeo con usuarios reales (QA, 4-6h)

**SPRINT FASE 1 (jun 20-24):**
- Mié 20 (tarde): B1 gate picking, D1 diseño
- Jue 21: B2 UI, B4 RBAC test, D1 wizard
- Vie 22-23: B3 sync Odoo, D1 backend
- Lun 24: Go-Live testing + deploy

**Implementación: Equipo (Pit, Mark, Ron, QA)**
- Cerebro canónico: `C:\Users\Gabriel Ramirez\OneDrive\Documentos\GitHub\Agentes\Agentes-Estandar\_DECISIONES-DESPACHO-2026-06-20.md`
- QA-WWP expediente actualizado con audit strategy 2026-06-20

## Auditoría integral WWP (6-jul-2026)
- Informe formal: `AUDITORIA-WWP-2026-07-06.md` — veredicto: plataforma madura y en producción; 6 fronteras de oportunidad (F0 evidencia, F1 Odoo, F2 cierre de lazo, F3 seguridad, F4 analítica, F5 escala) + backlog R0a-R10.
- Quick-wins aplicados en `proxy.js` (verificados 19/19 en local, pendiente deploy con OK):
  - QW1: token de reset fuera de logs de prod (en local sí, con host dinámico) + audit `password_reset_requested`.
  - QW2: `JWT_SECRET` acepta env (⚠️ activarla en Railway = relogin de todos).
  - QW3: cambio/reset de contraseña invalida las sesiones del usuario (3 rutas).
  - QW4: fail-open del OUT-gate auditable (`task.outGateFailOpen` + evento `out_gate_fail_open`).
  - QW5: `dueDate` default al crear (subtarea hereda, staffing=fecha fin, despacho=hoy, resto=mañana; `dueDateAuto:true`).
  - QW6: `/api/health?deep=true` reporta footprint de fotos por carpeta + espacio del volumen (`fs.statfsSync`).
- Hallazgo crítico: los backups automáticos NO cubren las fotos (solo .json) — el volumen de Railway es la única copia de la evidencia (→ R0a backup offsite, severidad crítica).
- Pendiente manual (Gabriel): confirmar en Railway tamaño y uso del volumen `DATA_DIR`.

## Pendientes / notas abiertas
- Deploy de los quick-wins de la auditoría: espera OK explícito (commit+push antes de `railway up`).
- Posibles mejoras sugeridas no implementadas: ubicación al subir cada evidencia individual de artículo (ya se captura en fotos de despacho).

## Salud de Inventario — negativos Odoo con casos (v156, 7-jul-2026)
- Contexto: auditoría 30-jun (46 negativos A-CDP/PTN, `CORRECCION-INVENTARIO-2026-06-30.md`) + verificación 7-jul (45/46 vigentes + 5 nuevos por recepción de tránsito tardía). Odoo es SaaS → no se puede instalar `stock_no_negative`; el control vive en la plataforma. Plan: `PLAN-ACCION-NEGATIVOS-2026-07-07.md`.
- Sección nueva `inventario-salud` (sidebar Análisis Operacional, solo admin+manager): negativos vivos (excluye legacy "sistema anterior"), recepciones de tránsito pendientes con antigüedad, y casos con seguimiento por SKU (pendiente → verificado físico → corregido) + notas + responsable.
- Backend: `wwp-inventario-casos.json` (saveCriticalArray), 8 endpoints `/api/inventario/*`, cache Odoo TTL 5 min (force 30s), auto-conciliación (corregido-auto al desaparecer el negativo, reabre si reaparece), heurística de causa (A=kit phantom vía mrp.bom, B=sin IN previo, C=salida antes de entrada por balance corriente), seed idempotente de los 2 casos iniciales (46+5).
- Watchdog diario 08:00 RD (`INV_WATCHDOG`, default ON) → notificación `inventario_negativo` (operacion/critical, en NOTIF_META + espejos historial/sw) a admin+manager si hay negativos sin caso o recepciones >24h. `POST /api/inventario/watchdog-run` (admin) lo fuerza para verificar tras deploy.
- Verificado en local (curl + navegador): RBAC 401/403, seed idempotente, conciliación (Irva + MOR.LILO corregidos-auto), heurística A con kit exacto `GE.KAYLE.SOFA.BG.K3` y B en `AN-05100S201/M`, PATCH acciones con auditoría, gate 409 al cerrar con pendientes, watchdog E2E con notificación, fail-open sin Odoo (banner + casos persistidos).
