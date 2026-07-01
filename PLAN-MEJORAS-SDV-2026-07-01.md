# Plan de mejoras SDV — Levantamiento UX multi-agente + benchmarking

**Fecha:** 2026-07-01 · **Versión base auditada:** v98
**Levantamiento por:** Mark (UX/UI), Pit (operaciones/adopción), Ron (datos Odoo), QA-WWP (integridad/RBAC), Vera (voz de ventas/trazabilidad) + investigación en internet.
**Estado:** propuesta para aprobación. NO se ha tocado código ni deployado. Flujo: reporte → aprobación de Gabriel → deploy.

---

## 1. Veredicto general

El módulo SDV es **funcionalmente maduro** y su capa de adopción de ventas es de nivel superior (ayuda por campo con ruta exacta de Odoo, banner de continuidad, notificaciones con lenguaje de ventas). El flujo 360 (vendedora → Ops → tarea WWP → despachada) está cerrado y varias promesas rotas históricas **ya se cerraron en v94–v98** (botón "Aplicar cambios de Odoo", cascada de cancelación que sí notifica al dueño del adicional, notificaciones de transición).

Los cinco agentes convergen en tres frentes de mejora:

1. **Blindaje de la máquina de estados y seguridad** (crítico, no cosmético) — hay un agujero de RBAC real y estados sin validar.
2. **Adopción y visibilidad operativa** — el handoff de aprobación tiene doble captura que empuja a Ops a saltarse la SDV, y no hay métricas de tiempo.
3. **Trazabilidad pasiva para la vendedora** — cuando vuelve a mirar en frío, la pantalla no le dice "desde cuándo / qué falta / cuándo sale".

---

## 2. Qué dice el benchmarking (internet) y cómo valida el plan

| Hallazgo externo | Fuente | Implicación para SDV |
|---|---|---|
| Minimizar niveles/aprobadores; solo aprobaciones que agregan control; 1 clic con info dinámica | Cflow, UI Bakery, Nutrient | Valida **aprobación 1-clic server-side** (Pit) — elimina doble captura |
| El status tracker es "red de seguridad": el usuario prefiere consultar por su cuenta, no solo recibir notificación | NN/g "Status Trackers", Just Eat UX | Valida **sección Seguimiento con línea de tiempo** (Vera) — hoy solo hay notificación puntual |
| Actualizaciones frecuentes de baja granularidad reducen ansiedad; color-coding e íconos para estado | NN/g, Baymard | Valida **badges honestos + estado de la tarea WWP en texto** (Vera/Mark) |
| Notificaciones multicanal según preferencia | myshyft, Cflow | Las notificaciones ya existen; robustecerlas es fase posterior |
| Cambio ERP: segmentar por disposición, soporte por rol, ayuda contextual, simplificar primero | Prosci, Whatfix, Bizowie | Valida **gate suave de datos + mantener capa de adopción** (Ron/Pit) |
| Apps de almacén: targets táctiles grandes, alertas de error inmediatas | LoadProof, Medium/Karabin | Valida **steppers de cantidad + mensajes de error accionables** (Mark) |

Conclusión: el plan no inventa; alinea SDV con patrones establecidos de workflows de aprobación, tracking de estatus y adopción ERP.

---

## 3. Backlog consolidado (todos los hallazgos, priorizados)

Severidad: 🔴 Crítico · 🟠 Alto · 🟡 Medio · ⚪ Bajo. Esfuerzo: S/M/L.

### FASE 0 — Blindaje (seguridad + máquina de estados) · hacer primero
| ID | Sev | Hallazgo | Ubicación | Fuente | Esf |
|----|-----|----------|-----------|--------|-----|
| F0-1 | 🔴 | **Cancelación de SDV ajena por cualquier rol.** `?action=cancel` solo tiene `requireJwt`; sin `requireRole` ni check de dueño. Assistant y otra vendedora cancelaron SDV ajenas → 200. Además valida estados que no existen en SDV (`'D','E','F','packing'`). | `proxy.js:12180-12210` | QA #2 | S |
| F0-2 | 🔴 | **Sin enum de estados en PATCH SDV.** Acepta cualquier string → 200. El `ESTADOS_VALIDOS` que existe es de OTRO módulo. Un estado basura deja la SDV con badge rojo y **sin botones (muerta en UI)**. | `proxy.js:11010-11012` | QA #1, Mark C1 | S |
| F0-3 | 🔴 | **Bloque muerto `in_process` vs `en_proceso`.** UI manda `en_proceso`; la rama auto-create de tarea escucha `in_process` (inglés). Por API `in_process` crea tarea y deja estado huérfano; por UI no auto-crea. Convergencia de 3 agentes. | `proxy.js:11024` vs `11015` | QA #3, Mark C1, Vera | S |
| F0-4 | 🟠 | **Cancelación no-cascada.** Cancelar SDV marca solo la tarea madre; subtareas hijas quedan huérfanas activas, sin audit ni notificación. | `proxy.js:12239-12246` (vs cascada L8034) | QA #4 | M |
| F0-5 | 🟡 | **Sin FSM.** Cualquier regresión de estado es válida (`despachada → pendiente_revision`). Se resuelve junto con F0-2 (mapa de transiciones). | `proxy.js:11010` | QA #5 | S |
| F0-6 | 🟡 | **Odoo caído → 500 crudo** en el lookup del formulario. | `proxy.js:10706` | QA #6, Ron | S |
| F0-7 | ⚪ | **Reverse-link no idempotente.** 2× POST con mismo `sdvId` duplica en `wwpTareas`. | `proxy.js:7728-7729` | QA #7 | S |

### FASE 1 — Adopción + trazabilidad (mayor retorno)
| ID | Sev | Hallazgo | Ubicación | Fuente | Esf |
|----|-----|----------|-----------|--------|-----|
| F1-1 | 🟠 | **Aprobación 1-clic server-side.** Hoy aprobar = doble captura en wizard → empuja a Ops a saltarse la SDV (mata adopción). El backend debe crear la tarea WWP poblada desde el snapshot de la SDV, sin wizard. Palanca de adopción #1. | `sdvConvertirTarea` `historial.html:30442-30455`; auto-create `proxy.js:11024` | Pit R1 | M |
| F1-2 | 🟠 | **Timestamps por transición de estado.** Sellar `aprobado_en`/`despachado_en`. Desbloquea 3 KPIs (SLA aprobación, lead time, tasa rechazo) de un cambio. `statusHistory` ya existe como base. | `proxy.js` transiciones L11014 | Pit R2 | S |
| F1-3 | 🟠 | **Sección "Seguimiento" en el detalle de la vendedora.** Renderizar `statusHistory` (el dato existe, el CSS de timeline ya se usa en WWP L12249) pero `sdvVerDetalle` ctx=`mis` nunca lo pinta. Convierte SDV de "formulario" a "trazabilidad" → la vendedora responde al cliente sin llamar a Ops. | `historial.html:29994-30021` | Vera 1 | M |
| F1-4 | 🟠 | **Badge honesto: rechazada ≠ cancelada.** `sdvBadge` no tiene clase para `rechazada`; cae al `else` = rojo terminal. La vendedora ve "muerto" lo que solo necesita corregir. | `historial.html:28955-28959` | Vera 2, Mark | S |
| F1-5 | 🟠 | **Filtros "Rechazadas"/"Canceladas" con contador en "Mis Solicitudes".** Los dos estados que exigen acción de la vendedora son los que no puede aislar. | `historial.html:6153-6158` | Vera 3, Mark A1 | S |
| F1-6 | 🟡 | **Estado de la tarea WWP en el historial del detalle.** Hoy lista título+fecha, no el estado (`STATUS_LABELS[t.status]`). No traduce a "¿en qué punto va?". | `historial.html:30020` | Vera 5 | S |

### FASE 2 — Pulido UX/UI
| ID | Sev | Hallazgo | Ubicación | Fuente | Esf |
|----|-----|----------|-----------|--------|-----|
| F2-1 | 🟠 | **Fecha deseada + semáforo de vencimiento en la card**, reutilizando `DUE_CARD_STYLE` de WWP. Convierte la bandeja en herramienta de priorización real. | `sdvCardHtml` `historial.html:29900` | Mark A2 | M |
| F2-2 | 🟠 | **Fotos reales de artículos en el detalle** (hoy fuerza placeholder aunque el portal de creación sí pinta `it.image`). Ops aprueba sin ver el producto. | `historial.html:29938-29943` | Mark A3, Ron | S/M |
| F2-3 | 🟠 | **XSS latente en `onclick`** con ids/folios interpolados → migrar cards/acciones a `data-*` + `addEventListener`. | `historial.html:29910, 30022` | Mark A4 | M |
| F2-4 | 🟡 | **Modal propio de rechazo** (hoy `window.prompt`); textarea + folio/cliente visibles. El motivo lo lee la vendedora. | `historial.html:30407` | Mark M2 | S |
| F2-5 | 🟡 | **Stepper táctil de cantidad** en vez de `input type=number` (teclado tapa media pantalla en móvil). | `historial.html:29264` | Mark M1 | S |
| F2-6 | 🟡 | **Link "Ver tarea en WWP" sin gate de rol** para la vendedora → callejón sin salida. Ocultar o convertir en estado legible. | `historial.html:30019, 30422` | Vera 4 | S |
| F2-7 | ⚪ | **Copy desalineado**: mensajes de rechazo/bloqueo mandan a «Buscar/Actualizar» (pestaña de creación) en vez del botón real del modal. | `historial.html:29985` | Vera 6 | S |
| F2-8 | ⚪ | Emojis mezclados con Lucide; doble `display` frágil; chip "ADICIONAL" para escaneo. | varios `historial.html` | Mark B1/B3/M3 | S |

### FASE 3 — Datos Odoo + proceso
| ID | Sev | Hallazgo | Ubicación | Fuente | Esf |
|----|-----|----------|-----------|--------|-----|
| F3-1 | 🟠 | **Fallback de Ciudad** (city → `state_id` → penúltima línea de `contact_address`). Ciudad ausente en **84%** de direcciones recientes. Sube cobertura visible sin tocar Odoo. | `proxy.js:10644` (refresh), `10459` (lookup) | Ron C1 | M |
| F3-2 | 🟠 | **Estado real del pick en el refresh** (hoy filtra solo `assigned` → devuelve 0 ítems si el pick está `done`/`waiting`; se lee como "sin cambios"). Distinguir listo / bloqueado por stock / despachado. | `proxy.js:10652` | Ron C2, P2 | M |
| F3-3 | 🟡 | **Gate suave de datos al crear**: si ciudad/teléfono vacíos, avisar con link al contacto principal en Odoo. Teléfono ausente en 38%. | formulario creación | Ron C3 | S |
| F3-4 | 🟡 | **Aplicar/señalar reducciones de cantidad** (el flujo "adicional" solo cubre aumentos; una baja en Odoo no tiene camino → riesgo de despachar de más). | diff `proxy.js:10566-10575` | Ron C5 | M |
| F3-5 | 🟡 | **Estandarizar idioma a `es_DO`** en 7 cuentas en inglés (ATMOSS, Benjamín Acevedo, Filippo Bencini, Gabriela Ramírez, Lulú Pulgar, Paola Shephard, Ruth Calcaño). Distinguir `lang` de usuario vs. de cliente. | Odoo (operativo) | Ron P4 | S (proceso) |

### FASE 4 — Proyecto de fondo (planear, no urgente)
| ID | Sev | Hallazgo | Fuente | Esf |
|----|-----|----------|--------|-----|
| F4-1 | 🟠 | **SDV-sombra para "Nuevos Despachos".** Todo despacho directo genera SDV automática (folio, notifica vendedora, entra al KPI). Una sola verdad de throughput. Recomendado DESPUÉS de estabilizar F1-1. | Pit R3 | L |
| F4-2 | 🟡 | **Dashboard SDV accionable** con los 7 KPIs (SLA aprobación, lead time, tasa rechazo, % con vínculo WWP, % vía SDV vs directo, adopción por vendedora, tiempo de ciclo). Requiere F1-2. | Pit R4 | M/L |

---

## 3-bis. Cobertura de backup — PRERREQUISITO BLOQUEANTE (validado por QA-WWP, Vera, Ron)

**Hallazgo central (3 agentes convergen, verificado en `proxy.js`):** el archivo de SDV **NO usa la capa de blindaje** que sí protege a WWP. Está en la misma condición que tenía `wwp-tasks.json` antes del incidente del 25-jun.

| Archivo | Ruta de guardado | Protección hoy |
|---|---|---|
| `wwp-tasks.json` | `saveWwpTasks` → `saveCriticalArray` (proxy.js:322) | ✅ anti-vacío + rotativo ×40 + snapshot horario |
| **`sdv-solicitudes.json`** | `saveSdv` → `saveJson` **plano** (proxy.js:1100) | ⚠️ **solo snapshot horario** — sin anti-vacío, sin respaldo pre-escritura |
| `sdv-alertas.json` | `saveJson` plano (proxy.js:13113) | ⚠️ solo snapshot horario |
| `sdv-reactivation-requests.json` | `saveJson` plano (proxy.js:13119) | ⚠️ solo snapshot horario |
| `sdv-cancellation-audit.json` | `saveJson` plano (proxy.js:13121) | ⚠️ solo snapshot horario |
| `sdv-seq.json` (folios) | `saveJson` **ni atómico** (proxy.js:1104) | 🔴 riesgo de colisión de folios |

**Por qué importa AHORA:** casi todo lo que el plan persiste (F0-1, F0-2, F0-3, F0-4, F1-1, F1-2, F3-x) aterriza en `sdv-solicitudes.json`. Peor: **F1-1 (aprobación 1-clic) y F1-2 (timestamps) elevan mucho la frecuencia de escritura** sobre ese archivo desprotegido → más escrituras = más superficie de riesgo de una mala escritura que hoy nada frena.

**Qué es irreemplazable y DEBE quedar en la capa protegida** (Vera + Ron):

| Dato | Clasificación | Por qué |
|---|---|---|
| `statusHistory` (incluye el motivo de rechazo anidado en `[].nota`) | 🔴 Irreemplazable | No existe en ninguna otra fuente. Es la línea de tiempo que F1-3 va a renderizar. |
| Timestamps de transición (F1-2) | 🔴 Irreemplazable | Perdidos = no hay SLA/lead time histórico. |
| `solicitudOrigenId` (enlace adicional↔origen) | 🔴 Irreemplazable | Sin esto no se reconstruye una orden con 2+ folios. |
| `wwpTareas` / `wwpTaskId` (lado SDV del reverse-link) | 🔴 Irreemplazable | El vínculo a la ejecución. |
| `articulosOdoo[].quantity` (cantidad **al crear**) | 🔴 Irreemplazable | Odoo solo guarda la cantidad **actual**; es la base del diff. Snapshot histórico que Odoo no reproduce. |
| `folio`, `creadoPor`, `fechaSolicitud`, audit de cancelación | 🔴 Irreemplazable | Datos locales sin origen en Odoo. |
| Cliente, dirección, ciudad, teléfono, artículos-vivos, fotos | 🟢 Re-derivable | Un `/odoo/refresh` los repuebla (con el valor **actual**). Backup deseable, no crítico. |
| Estado de la tarea WWP | 🟢 Re-derivable | Vive en `wwp-tasks.json` (ya protegido). |

> Regla que deja Ron: **"viene de Odoo" ≠ "no crítico".** El criterio es *¿Odoo reproduce hoy el mismo valor?* Los dos snapshots disfrazados de "dato de Odoo" son cantidad-al-crear y pick-ya-despachado.

**Acciones de backup a agregar (nueva Fase BK, va ANTES del Sprint 1):**

> **Estado: BK-1, BK-2, BK-3 IMPLEMENTADAS en código el 2026-07-01 (pendiente de deploy con OK de Gabriel).** Sintaxis verificada (`node --check` OK), arranque limpio en `DATA_DIR` aislado (`/api/health` ok:true), y BK-4 verificado (grep de escrituras directas = 0). No se ha deployado.

| ID | Acción | Ubicación | Esf | Estado |
|----|--------|-----------|-----|--------|
| BK-1 | **Migrar `saveSdv` a `saveCriticalArray`** (1 línea, simétrico a `saveWwpTasks:322`). Bloqueante antes de F0-1/F0-4 (que aumentan cancelaciones y mutaciones). | `proxy.js:1100` | S | ✅ hecho |
| BK-2 | Migrar los colaterales a `saveCriticalArray`: alertas, reactivation-requests, cancellation-audit. | `proxy.js:13113/13119/13121` | S | ✅ hecho |
| BK-3 | Dar escritura atómica a `sdv-seq.json` (via `saveJson`) — antes ni atómico → colisión de folios. | `proxy.js:1104` | S | ✅ hecho |
| BK-4 | **Regla post-F1-1:** un `grep` de `saveJson(SDV_FILE` / `writeFileSync(SDV_FILE` debe dar **0** — un handler server-side nuevo (la aprobación 1-clic) podría saltarse la protección sin querer. | verificación | S | ✅ verificado (0 hoy); re-correr tras F1-1 |
| BK-5 | (Opcional) Snapshot horario 24→72 (colchón de fin de semana). Retención rotativa 40 sigue bien. | `proxy.js:160` | S | ⬜ opcional, no hecho |

**Validación de cierre:** QA-WWP propone correr el e2e del anti-vacío (intento de vaciar `sdv-solicitudes.json` con ≥5 ítems → debe RECHAZAR y preservar) una vez implementado BK-1.

---

## 4. KPIs para medir que el plan funcionó (Pit)
- **% SDV con vínculo WWP** ≥ 98% (era 11% en jun) — ya medible.
- **% despachos vía SDV vs directo** en tendencia ascendente = adopción real (requiere F4-1 para medir los directos).
- **SLA de aprobación** ≤ 30 min laborables (requiere F1-2).
- **Lead time solicitud→despacho** — línea base primero (requiere F1-2).
- **Tasa de rechazo** por motivo (top 3).
- **Llamadas de ventas a Ops "¿cuándo sale?"** — proxy cualitativo del éxito de F1-3.

---

## 5. Secuencia recomendada de implementación

**Sprint 0 (backup) — Fase BK, PRIMERO DE TODO.** BK-1 a BK-3 (migrar SDV y colaterales a `saveCriticalArray` + atomizar folios). Es 1 sesión corta, todo en `proxy.js`, y cierra el riesgo de data-loss que hoy existe y que las fases siguientes agravan. Ver §3-bis.

**Sprint 1 (blindaje) — Fase 0 completa.** Todo S/M, mismo archivo (`proxy.js`), sin riesgo de UI. Cierra el agujero de seguridad (F0-1) y la máquina de estados (F0-2/3/5) de un paquete. **Responsable: backend/Carl + QA-WWP valida con harness.**

**Sprint 2 (adopción + trazabilidad) — Fase 1.** F1-1 (1-clic) + F1-2 (timestamps) juntos (Pit R1+R2); F1-3/4/5/6 (Vera+Mark) suben la confianza de ventas. **Responsable: Mark (UI) + backend; Vera valida desde ventas.**

**Sprint 3 (pulido) — Fase 2.** Mark lidera; F2-1 y F2-2 primero (mayor impacto visible).

**Sprint 4 (datos) — Fase 3.** Ron define, backend implementa fallback/estado de pick; los cambios de idioma y captura de ciudad son operativos (Pit coordina con ventas).

**Fase 4** se planea aparte una vez estable el 1-clic.

---

## 6. Decisiones que necesita Gabriel
1. **¿Se aprueba arrancar por el Sprint 1 (blindaje)?** Contiene un agujero de seguridad real (cancelación ajena) — recomendación fuerte: sí, primero.
2. **Aprobación 1-clic server-side (F1-1):** ¿se aprueba el diseño? Es la mayor palanca de adopción.
3. **Timestamps de transición (F1-2):** ¿van en el mismo paquete que F1-1? Sin ellos el dashboard nace ciego.
4. **SDV-sombra (F4-1):** ¿al plan ahora o después de estabilizar el 1-clic? Recomendación: después.
5. **Cambios operativos de Odoo (F3-3 captura ciudad/teléfono, F3-5 idioma):** ¿se coordinan con ventas por separado del código?

---

*Fuentes de código verificadas por los agentes contra v98. Investigación externa: NN/g (status trackers), Cflow/UI Bakery/Nutrient (approval workflows), Prosci/Whatfix/Bizowie (adopción ERP), LoadProof/Medium (UX almacén móvil), Odoo 19 release notes.*
