# Plan de Homologación SDV ↔ WWP

**Fecha:** 2026-07-02 · **Base auditada:** v108
**Levantamiento por:** Mark (inventario de botones/acciones), Pit (frontera de propiedad), Vera (divergencia/trazabilidad desde ventas), QA-WWP (caminos duales, con e2e confirmatorio en servidor aislado).
**Estado:** propuesta para aprobación. NO se ha tocado código.

---

## 1. Diagnóstico central (convergencia de los 4 agentes)

WWP nació independiente; SDV ahora es el origen de las tareas de ventas. El patrón transversal que quedó:

> **Los caminos de ENTRADA al vínculo SDV↔WWP tienen mantenimiento (v98–v108); los de SALIDA no tienen espejo.** Cancelar/borrar/reactivar una tarea es mudo hacia la SDV. Y la **frontera de propiedad de los datos no existe en código**: ambos lados editan los mismos campos (dirección, fecha, teléfono) en silencio — fork bidireccional.

**Regla de oro propuesta (Pit):** para tareas con `sdvId`, **SDV es dueño del *qué / para quién / dónde / para cuándo*** (cliente, dirección, receptor, teléfono, fecha deseada, alcance, cierre comercial) y **WWP es dueño del *quién / cómo*** (asignación, evidencias, checklist, estados intermedios, validación). Toda desviación se notifica a la vendedora.

---

## 2. Hallazgos consolidados (con evidencia)

### 🔴 Críticos — confirmados e2e por QA
| # | Hallazgo | Evidencia | Fuente |
|---|----------|-----------|--------|
| H-1 | **Auto-despachada bypasea la FSM**: escribe `sol.estado='despachada'` a ciegas (proxy.js:8052), sin leer estado actual ni `SDV_TRANSICIONES` → **resucita SDVs canceladas** ("fue despachada" de una solicitud que la vendedora vio cancelada). | e2e T3e: cancelada→despachada, HTTP 200 | QA#2, Pit B7 |
| H-2 | **Cancelar tarea con sdvId deja la SDV `en_proceso` huérfana para siempre, en silencio.** Ni statusHistory, ni notifySeller, ni aviso a Ops. La vendedora dice al cliente "está en preparación" de una orden que Ops ya mató. | e2e T1: 200, SDV intacta, 0 notifs | QA#1, Vera B1, Pit C1, Mark |
| H-3 | **"Marcar Despachada" manual con tarea activa** (historial.html:30131): fuerza estado terminal con la tarea corriendo, notifica a la vendedora sin evidencia de entrega, y encubre el problema H-4. | código | Mark B-2, Pit B1 |
| H-4 | **El wizard propaga `sdvId` a las tareas de EMPAQUE** (historial.html:15841/15879); `todasListas` exige `validated` para no-dispatch (proxy.js:8041) y el empaque casi nunca se valida → **la SDV creada vía wizard nunca auto-despacha** → Ops "resuelve" con el botón manual → círculo vicioso que mata la señal automática. | código | Mark B-1, QA camino 4 |
| H-5 | **Edición divergente sin guard en ambos sentidos**: PATCH de tarea permite editar client/deliveryAddress/phone/dueDate/odooRef de una tarea con sdvId sin sincronizar ni alertar (proxy.js:8183-8190). El chofer despacharía a una dirección que la SDV no conoce. | e2e T5: 200, SDV intacta, alertas=0 | QA C, Vera A, Pit B5 |

### 🟠 Altos
| # | Hallazgo | Fuente |
|---|----------|--------|
| H-6 | **`cancelled` cuenta como "lista" en `todasListas`** (proxy.js:8040): cancelar 1 de 2 tareas y completar la otra → SDV `despachada` completa. **Despacho parcial reportado como total.** (e2e T2c) | QA#3 |
| H-7 | **DELETE de tarea → `wwpTaskId` fantasma** y, por la idempotencia del 1-clic (`!sol.wwpTaskId`), esa SDV **nunca más puede regenerar su tarea**. (e2e T6) | QA#4 |
| H-8 | **Reactivación procesada**: push directo sin reverse-link (la SDV no lista la tarea en wwpTareas), SDV sigue `cancelada` con tarea viva, y el docstring promete notificar a la vendedora pero el código no lo hace (proxy.js:12557-12589). | QA camino 6, Vera B2 |
| H-9 | **Tarea 1-clic nace huérfana y muda**: push directo sin pasar por el POST → cero notificaciones, sin encargado, sin items → invisible para el gate anti-duplicado por ítem. | Pit B2, QA camino 1 |
| H-10 | **Wizard/buscador crean `dispatch_order` suelto sin detectar SDV activa** por odooRef → misma orden con 2 tareas activas de fuentes distintas (e2e T2a). Aplica a: Nuevos Despachos (:19718), Buscar (:17677), transferencias (:21342/:21732), recogidas (:22038/:22075). | Mark B-3, Pit, QA camino 3 |
| H-11 | **Snapshot incompleto**: `receptorNombre`, `gpsCoords` y la vendedora (salesperson/requester) NO se copian a la tarea; `phone` se copia pero el drawer de despacho no lo muestra. El chofer despacha con menos datos de los que la vendedora entregó. | Vera A/C |
| H-12 | **El drawer de tarea no menciona la SDV ni una vez** (`sdvId`: 0 referencias en renderDrawer): sin folio, sin vendedora, sin fecha deseada, sin observaciones rotuladas, sin "Ver solicitud →". | Mark C-1, Pit C3 |
| H-13 | **"Crear otra Tarea WWP" (recuperación) usa el wizard**, no el motor server-side → la tarea de recuperación nace distinta a la original (pierde observaciones, contacto, fecha deseada) y con el problema H-4. | Pit B4, Mark |

### 🟡 Medios
| # | Hallazgo | Fuente |
|---|----------|--------|
| H-14 | Subtarea agregada a cadena no hereda `sdvId` (`subBase` :15730) → la SDV puede auto-despacharse con un paso abierto. | Mark, Pit B6, QA camino 5 |
| H-15 | Prioridad `'medium'` hardcodeada en 3 sitios; debería derivar de `fechaSolicitudDeseada` (patrón ya existe en Reposición, proxy.js:6107). | Pit |
| H-16 | `dueDate` reprogramado por Ops no notifica a la vendedora ni escribe `sol.fechaEntrega` → ella promete una fecha que ya no existe. | Vera B, Pit |
| H-17 | Eventos intermedios invisibles para la vendedora: tarea devuelta, gate de picking bloqueado, tarea vencida, "en ruta" (dispatchStartedAt existe y no se usa). | Vera B, Pit C2 |
| H-18 | Kanban drop a Completado evita el gate cliente de entrega-por-artículo (server solo valida 3 fotos) → auto-despachada con entregas sin registrar. | Mark B-8 |
| H-19 | "Retirado por cliente" no lee `transporteIncluido` de la SDV → el chofer puede contradecirla sin aviso. | Mark |
| H-20 | Reactivar tarea cancelada por cascada no consulta el estado de la SDV (tarea viva sobre SDV cancelada). | Mark, QA B-5 |
| H-21 | **Bug colateral** (hallado por los 3): historial.html:17677 pasa un objeto a `abrirNuevaTareaWWP` (firma posicional) → wizard con `[object Object]`. | Mark, Pit, QA |

---

## 3. Plan de homologación por fases

### FASE H0 — Integridad del vínculo (backend, crítico) · el espejo de salida
> Cierra H-1, H-2, H-6, H-7, H-8, H-14, H-20. Todo en `proxy.js`, validable con curl sin Odoo.

| ID | Acción |
|----|--------|
| H0-1 | **Helper único `sdvTransition(sol, nuevo, por, nota)`** que valida contra `SDV_TRANSICIONES` — TODA escritura de `sol.estado` pasa por ahí (auto-despachada :8052, cancelación :12370, reactivación). Reactivación agrega su transición explícita (`cancelada→en_proceso` con nota), no bypass. |
| H0-2 | **Espejo de cancelación**: tarea con sdvId cancelada → si no quedan tareas activas del sdvId y la SDV está `en_proceso` → transición visible (propuesta: `pendiente_revision` con nota "tarea cancelada: motivo") + notifySeller + notifica a Ops. |
| H0-3 | **`todasListas` distingue cancelado de entregado**: mezcla → `despachada` con nota "despacho parcial (N de M)"; todo cancelado → aplica H0-2. |
| H0-4 | **DELETE de tarea con sdvId**: limpiar/reapuntar `wwpTaskId`, depurar `wwpTareas`, devolver `linkedSdv` en la respuesta. |
| H0-5 | **POST /api/wwp/tasks con sdvId valida estado de la SDV**: 409 si `cancelada`/`despachada` (salvo flag del flujo de reactivación). |
| H0-6 | **Reactivación por el camino canónico**: reverse-link completo + `sdvTransition` + el notifySeller que el docstring promete. |
| H0-7 | **`subBase` hereda `sdvId`** (1 línea) + reactivar tarea consulta estado de la SDV. |

### FASE H1 — Un solo motor de creación + cierre honesto
> Cierra H-3, H-4, H-9, H-10, H-13, H-15.

| ID | Acción |
|----|--------|
| H1-1 | **"Crear otra Tarea WWP" reusa `createWwpTaskFromSdv` server-side** (endpoint dedicado), no el wizard. El wizard queda para tareas no-venta. |
| H1-2 | **Resolver H-4**: decidir la señal de cierre para cadenas (opciones: (a) solo la(s) tarea(s) `dispatch_order` del sdvId gobiernan el cierre — el empaque es paso intermedio encadenado; (b) empaque `completed` cuenta como listo). Requiere decisión D3/D4. |
| H1-3 | **"Marcar Despachada" eliminado cuando hay tarea activa**; sin tarea queda como override con motivo obligatorio y rastro "manual" (decisión D1). |
| H1-4 | **La tarea 1-clic notifica al nacer** (Ops/bandeja "sin encargado") y deriva **prioridad** de `fechaSolicitudDeseada` (≤48h→urgent, ≤5d→high). |
| H1-5 | **Cross-check de SDV activa en el wizard/buscador**: al capturar odooRef, si existe SDV activa → avisar y ofrecer vincular (setear `_wizSdvId`). |
| H1-6 | Fix colateral :17677 (firma posicional). |

### FASE H2 — Frontera de campos (la regla de oro hecha código)
> Cierra H-5, H-11, H-16, H-19. Requiere decisión D2.

| ID | Acción |
|----|--------|
| H2-1 | **Guard de campos propiedad-SDV en PATCH de tarea** (client/deliveryAddress/phone/dueDate/odooRef/location con sdvId): duro (422 "edita la SDV") o blando (warn+audit+alerta) según D2. |
| H2-2 | **PATCH de SDV propaga a tareas activas** los campos propiedad-SDV + notificación de cambio al equipo de la tarea. |
| H2-3 | **Completar el snapshot**: copiar `receptorNombre`, `gpsCoords`, vendedora (salesperson/requester desde creadoPor), `transporteIncluido`. |
| H2-4 | **dueDate movido por Ops** → escribir `sol.fechaEntrega` + notifySeller (renegociación de promesa visible). |

### FASE H3 — Visibilidad bidireccional (UI)
> Cierra H-12, H-17, H-18, H-19-UI.

| ID | Acción |
|----|--------|
| H3-1 | **Bloque "Solicitud de Ventas" en el drawer de tarea**: folio SD-…, vendedora, fecha deseada con semáforo, GPS como link, teléfono/receptor, observaciones rotuladas, "Ver solicitud →" (simétrico de sdvIrATarea). |
| H3-2 | **Eventos intermedios a la vendedora**: tarea cancelada/devuelta (con motivo), "tu despacho inició/en ruta" (dispatchStartedAt), gate de picking bloqueado; registrados también en `statusHistory` de la SDV (la bitácora de cara a ventas). |
| H3-3 | **Comparador pick Odoo vs `articulosOdoo`** al sincronizar items: aviso "el pick difiere de lo solicitado (N artículos)". |
| H3-4 | **`transporteIncluido` visible en el checklist** y como default/advertencia de "Retirado por cliente". |
| H3-5 | Kanban: condicionar drop a Completado para tareas con sdvId (o replicar gate server de entrega-por-artículo). |

### Backlog declarado (fuera de estas fases)
- F4-1 SDV-sombra para "Nuevos Despachos" (silo confirmado, proyecto grande).
- C2 alerta proactiva de "promesa en riesgo" a la vendedora (tarea vencida).
- Badge "orden con solicitud adicional activa" en card WWP.
- F2-3 refactor XSS (pendiente previo).

---

## 4. Decisiones — TOMADAS por Gabriel (2026-07-02)

| # | Decisión | Resolución |
|---|----------|-----------|
| **D1** | "Marcar Despachada" manual | ✅ **Con tarea activa: se elimina. Sin tarea activa: override con motivo obligatorio y rastro "cierre manual".** |
| **D2** | Frontera de campos propiedad-SDV en PATCH de tarea | ✅ **DURA: 422 "edita la SDV, no la tarea".** Una sola verdad garantizada. |
| **D3** | ¿Quién decide el empaque? | ✅ **Toggle del aprobador en el 1-clic** (evolucionable a regla por categoría después). |
| **D4** | Señal de cierre de la SDV | ✅ **Solo las tareas `dispatch_order` del vínculo gobiernan el cierre** (el empaque es paso intermedio encadenado). |

## 5. KPIs de éxito de la homologación (Pit, PDCA)
- SDVs `en_proceso` sin tarea activa >24h = **0**
- SDVs `despachada` con tarea abierta = **0**
- Tareas 1-clic sin encargado >2h = **0**
- Divergencias dirección/fecha SDV↔tarea detectadas = **0** (post H2)
- % de tareas de despacho nacidas con sdvId (vs sueltas) → tendencia a 100%

---
*Los 4 expedientes de agentes fueron actualizados con sus hallazgos (mark.md, pit.md, vera.md, qa-wwp.md §6/§10). Evidencia e2e de QA en servidor aislado; producción no fue tocada.*
