# Plan de remediación por fases — OpsAT · 2026-07-23

> Deriva de la auditoría integral [`09-auditoria-integral-2026-07-23.md`](09-auditoria-integral-2026-07-23.md) (los IDs entre paréntesis referencian su matriz §5), **recalibrada con los criterios reales del dueño** (23-jul):
> dueño = operaciones = dev principal · ~30 usuarios estables, crecimiento por MÓDULOS · tolerancia a pérdida de datos **casi cero** (fotos = evidencia) · futuro: agentes IA + un dev profesional contratado.
>
> Este plan pasó una **revisión adversarial** contra el estado real del repo (23-jul): se corrigieron 14 problemas — entre ellos el gate que congelaba el plan 08, un P1 sin cobertura (DB-01), el cifrado del snapshot antes de moverlo a infra de terceros (DB-10), y 4 referencias de matriz cruzadas.
>
> **Reglas de ejecución (aplican a todas las fases):**
> 1. Cada tarea se ejecuta en su propia sesión/PR controlada — nunca mezclada con features (regla de la propia auditoría).
> 2. Suite e2e verde ANTES y DESPUÉS de cada cambio (regla ya vigente del plan 08).
> 3. Commit SIEMPRE antes de deploy; desde la Fase 3, deploy solo vía el script (árbol limpio + tests + tag).
> 4. Una fase no se declara cerrada por "código hecho" sino por su **criterio de salida verificado**.
> 5. El plan 08 (modularización por islas) **continúa en paralelo** — su único gate nuevo es F2.7 (flujos críticos e2e) antes de la Ola 4, que está adelantado a la semana 1–2 precisamente para no frenarlo.

**Mapa del plan:**

| Fase | Nombre | Cuándo | Esfuerzo estimado | Estado |
|---|---|---|---|---|
| F0 | Decisiones de una sentada | Hoy | 1–2 h (solo decidir) | ✅ resueltas con recomendación |
| F1 | Continuidad de datos | Semana 1 — **antes que todo** | 3 sesiones | 🟡 código hecho; falta correr respaldo real + drill |
| F2 | Cerrar exposición + gate del plan 08 | Semana 1–2 (solapa con F1) | 3–4 sesiones | ✅ código hecho, suite verde |
| F3 | El sistema operable sin ti | Semanas 2–4 | 3–4 sesiones | 🟡 deploy.mjs/CI/RUNBOOK/advisory lock hechos; falta simulacro real |
| F4 | Resiliencia Odoo + concurrencia | Semanas 4–6 | 3–4 sesiones | 🟡 F4.2 (health honesto) adelantado; resto pendiente |
| F5 | Preparación del dev + simplificación (kill-list) | Semanas 6–10 | 5–6 sesiones | 🟡 F5.5 (stamp) hecho; resto pendiente |
| F6 | Módulos con integridad + cierre de lazos de proceso | Meses 2–4 | continuo | ⬜ pendiente |
| F7 | Continuo opcional | Cuando duela | según señal | ⬜ pendiente |

> **Progreso 23-jul (esta ejecución):** commits `5f19c5f` → (esta línea). Todo el trabajo de CÓDIGO de F1/F2/F3 y varios adelantos (F4.2, F5.5) están en `master` con suite e2e verde (83+ tests). Lo que queda de F1/F3 NO es código: son acciones del dueño en consolas externas (correr el respaldo, el drill de restauración, el simulacro de deploy) — detalladas al pie de cada fase.

---

## F0 — Decisiones de una sentada (hoy, 1–2 h)

Eres el dueño de todas las decisiones pendientes del sistema. Diez decisiones desbloquean el resto del plan; ninguna requiere código, todas tienen recomendación:

| # | Decisión | Recomendación | Desbloquea |
|---|---|---|---|
| D-1 | **¿Se rotó la API key de Odoo** expuesta en el historial git? | Si no consta con certeza: rotarla (F2.4) | F2 |
| D-2 | **Render**: ¿apagar o redirect? | Redirect 302 → `opsat.up.railway.app`, **previo snapshot final de sus datos** (son la última copia pre-migración) | F3.6 |
| D-3 | **Datos "MOCK" `SP`/`GS`/`OD`** (historial.html:18420 — nombres, teléfonos, direcciones): ¿clientes reales? | Si hay duda, tratarlos como reales → anonimizar | F2.3 |
| D-4 | **Tab Políticas** (datos fabricados, señales de cero uso): ¿retirar o hacer real? | Retirar; revivirlo solo si Operaciones lo pide con caso de uso | F5.6 |
| D-5 | **Visibilidad de contenedores para Ventas**: ¿qué usan hoy? ¿revive el dashboard o muere `CONT_SHEETS_ID`? | Preguntar a Ventas esta semana; si nadie lo usa, retirar env vars y placeholder | F5.6 |
| D-6 | **Transporte realtime único**: ¿WS o SSE? | WS (ya bidireccional) + polling de respaldo; retirar SSE **solo tras verificar entrega per-usuario de notifs por WS** | F5.2 |
| D-7 | **Criterio de retiro del dual-write** `collection_rows` | 4 semanas de paridad limpia (alerta automática F4.5 sin disparos) **+** drill de restauración F1.5 aprobado → apagar espejo | F5.8 |
| D-8 | **B5 multi-instancia**: ¿el sistema es single-instance por diseño? | Sí — sellar con advisory lock (F3.5) y nota en CLAUDE.md | F3.5 |
| D-9 | **`WWP_FORCE_PW_CHANGE=1`**: ¿qué día se avisa al equipo? | Esta semana; el modal bloqueante ya está programado (proxy.js:11559 + core.js:593) | F2.5 |
| D-10 | **Retención de evidencia**: ¿cuántos años se guardan fotos y colecciones cerradas? | Definir número (p.ej. fotos 2 años, audit 1 año) — sin él no se puede diseñar purga ni dimensionar respaldo | F1, F6.5 |

**Criterio de salida:** las 10 decisiones anotadas en MEMORIA-PROYECTO.md con fecha. (Las preguntas 1–10 de §11 del informe quedan respondidas de paso.)

---

## F1 — Continuidad de datos (semana 1 — tu "casi cero" manda)

**Objetivo:** que el respaldo que crees tener exista, cubra todo, avise cuando falle, esté probado con una restauración real — y que el kill-switch del cutover no pueda corromper al usarse.

| # | Tarea | Ref | Esfuerzo |
|---|---|---|---|
| F1.1 | Corregir la URL default del respaldo nocturno (`scripts/backup-wwp.mjs:23` → `opsat.up.railway.app`) y **verificar en OneDrive cuándo corrió con éxito por última vez** | INF-01 (P0) | 30 min |
| F1.2 | Extender `/api/backup/manifest` a los **8 kinds** de media (faltan `inspection`, `showroom-fotos`) y a **R2** (hoy solo inventaría disco — ciego a toda foto post-flip). En la misma tarea: **cifrar el snapshot de colecciones o excluir campos secretos** (`passwordHash`, `refreshTokens`, `resetTokens`, claves VAPID viajan hoy en claro — DB-10); es precondición de F3.3 | INF-02, DB-02, DB-10 | 1–2 sesiones |
| F1.3 | **Segunda copia de R2**: verificar en consola qué ofrece R2 realmente (el versioning/replicación nativos pueden no existir) → replicación diaria a un segundo bucket/proveedor (el SDK S3 ya está en `media.js:84`) o Bucket Lock anti-borrado + descarga offsite vía el manifest F1.2 | DB-02 | ½–1 sesión |
| F1.4 | **Alerta server-side "respaldo no visto en 48 h"** (patrón `createNotification` existente) — el fallo silencioso de F1.1 no puede repetirse | DB-03 | 1–2 h |
| F1.5 | **Drill de restauración** (1 h cronometrada): snapshot OneDrive → entorno limpio → app sirviendo datos + fotos. Documentar cada comando → semilla del runbook (F3.4) | DB-04 | 1 sesión |
| F1.6 | Verificar en la consola Railway: **backups/PITR del PostgreSQL** activados + tamaño/uso del volumen | §11-3 | 15 min consola |
| F1.7 | **Fix del rollback `WWP_TYPED`**: persistir el modo en kv y **forzar backfill total en cualquier transición desde `off`** — hoy la guardia compara solo conteos y un ciclo off→read arranca sirviendo datos viejos (storage-pg.js:467) | DB-01 (P1) | ½ sesión |

**Criterio de salida:** un respaldo nocturno verde verificado en OneDrive con cobertura total (datos cifrados + 8 kinds + R2 con segunda copia), un documento de restauración ejecutado de punta a punta, y un test que pruebe el ciclo off→read con edición intermedia. Hasta entonces, ningún trabajo de F4+ debería empezar.

---

## F2 — Cerrar exposición + gate del plan 08 (semana 1–2, solapa con F1)

**Objetivo:** que nada del negocio sea visible sin sesión, que las cuentas dejen de tener credenciales conocidas — y dejar listo el gate que la Ola 4 del plan 08 necesita para arrancar.

| # | Tarea | Ref | Esfuerzo |
|---|---|---|---|
| F2.1 | **WS autenticado + broadcast mudo**. Nota de estado: el broadcast de listas ya está mudo (proxy.js:5068) — lo que fuga es el objeto `task` individual, los `message` de chat (proxy.js:12880) y las notifs de todos. Hacer: vaciar esos payloads (el re-fetch cliente ya existe, core.js:1730), **auth por ticket efímero de un solo uso obtenido por POST autenticado** (NO token en query — ese es justo el anti-patrón del SSE que la auditoría condena, BE-09), y **mapear conexión→usuario** para poder entregar notifs per-usuario (prerequisito de F5.2) | API-01 (P0), BE-09 | 1 sesión |
| F2.2 | **Allowlist de estáticos `.js`** (hoy: añadir `write-queue.js`/`typed-schemas.js` a `_FORBIDDEN`; en la misma sesión invertir el modelo para que módulos futuros nazcan protegidos) | ARQ-03 | 1–2 h |
| F2.3 | **PII fuera del HTML público**: anonimizar/eliminar el bloque DATOS MOCK según D-3 | ARQ-02 | 1 h |
| F2.4 | **Key de Odoo**: ejecutar D-1 (rotar) + **grep de la key por todo el repo y vaciar CADA hit** (no lista fija: hay 5–7 archivos en `_archivo/` según cómo se cuente) | SEC-01 | 1 h |
| F2.5 | **Contraseñas**: `WWP_FORCE_PW_CHANGE=1` (según aviso D-9) + mínimo 8 + rechazar semillas server-side | OW-01 | 2 h |
| F2.6 | **Micro-fixes de robustez** (una sesión): catch-all 500 del dispatcher (BE-01), `readBody` con `Buffer.concat` (BE-02), `startsWith(_basePath + path.sep)` (GAP-10), allowlist de dominios push (GAP-08), health sin inventario de colecciones para anónimos (nota: un monitoreo externo profundo futuro necesitará token de solo-lectura), y **tapón de fotos mientras llega F4.6**: sufijo aleatorio de 8 bytes en nombres NUEVOS + rate-limit de los prefijos de media (los nombres actuales `<taskId>_<timestamp>` son enumerables) | BE-01/02, GAPs, FE-01 parcial | 1 sesión |
| F2.7 | **Flujos críticos e2e** (3–5 por UI: crear tarea→empaque→despacho→completar; SDV; RBAC negativo) — hoy son `test.fixme` esperando definición. **Adelantado desde F5 por la revisión adversarial: es el gate de la Ola 4 del plan 08, que es lo inmediato siguiente** — sin esto, el plan 08 quedaría congelado o avanzaría sin red | QA-01 (P1) | 1–2 sesiones |

**Criterio de salida:** batería de curls anónimos contra prod (WS, `/typed-schemas.js`, health, prefijos de media con rate-limit) convertida en spec e2e permanente; 0 cuentas con contraseña semilla; flujos críticos verdes en la suite → **Ola 4 del plan 08 desbloqueada**.

---

## F3 — El sistema operable sin ti (semanas 2–4)

**Objetivo:** que un tercero autorizado (el dev futuro, o tú desde otra máquina) pueda deployar, restaurar y diagnosticar sin tu memoria. Si tú eres el negocio, esta fase ES continuidad de la empresa.

| # | Tarea | Ref | Esfuerzo |
|---|---|---|---|
| F3.1 | **`scripts/deploy.mjs`**: rechaza árbol sucio → corre suite → tag `deploy-vNNN` → `railway up`. Se convierte en LA única vía de deploy | ARQ-01, INF-03, GAP-01 | 1 sesión |
| F3.2 | **CI en GitHub Actions**: `node --check` + harnesses + e2e en cada push (molde: `uptime.yml` ya en el repo). No gatea el deploy (eso lo hace F3.1 local) — da historial y red para el dev futuro | QA-02 | 1 sesión |
| F3.3 | **Respaldo en infraestructura neutral**: mover el job nocturno a un cron fuera de tu máquina (GitHub Actions cron u otro host); tu máquina queda como copia extra. **PRECONDICIÓN: F1.2 (snapshot cifrado/sin secretos) completada** — sin eso, esto exportaría hashes y tokens en claro a infra de terceros | INF-05 | 1 sesión |
| F3.4 | **Runbook único de incidentes** (semilla = drill F1.5): PG caído, volumen lleno, R2 caído, Odoo sin key, restaurar desde OneDrive, "la máquina del dev murió", promoción/apagado de Render | INF-06 | 1 sesión |
| F3.5 | **Advisory lock anti multi-instancia** en storage-pg.js + "single-instance by design" en CLAUDE.md/RAILWAY.md (sella D-8) | INF-04 | 1–2 h |
| F3.6 | **Ejecutar D-2 sobre Render**: primero **descargar snapshot final de sus datos** (última copia pre-migración — exigencia PR-07), después redirect 302 o apagado — muere la segunda producción fantasma | INF (dif.), PR-07 | ½ sesión |
| F3.7 | **Custodia de credenciales**: token Railway, acceso R2, key Odoo, JWT_SECRET — inventariados y accesibles para un sucesor definido (no solo en tu máquina/cabeza) | PR-02 | 2 h |

**Criterio de salida:** simulacro — desde una máquina limpia (o un agente sin tu contexto), alguien clona el repo, corre la suite, deploya con F3.1 y ejecuta un escenario del runbook, sin preguntarte nada.

---

## F4 — Resiliencia Odoo + concurrencia real (semanas 4–6)

**Objetivo:** que una caída del ERP no arrodille a la bodega, que el monitoreo no mienta, y que dos personas editando lo mismo no se pisen en silencio.

| # | Tarea | Ref | Esfuerzo |
|---|---|---|---|
| F4.1 | **Flag `odooDown` (ventana 60 s)** para fail-open inmediato en gates → luego breaker con half-open + retry único en lecturas; timeout de gates de escritura 8–10 s | API-02 | 1–2 sesiones |
| F4.2 | **Health honesto**: `lastOdooOkAt` en el shallow + ping periódico a Odoo con notificación a admins al caer | API-03 | 2 h |
| F4.3 | **Gate post-body**: eximir del gate de dominio a los uploads de media (o adquirirlo tras `readBody`) — un video de 30 MB en 3G no debe serializar al equipo | BE-03 | 1 sesión |
| F4.4 | **Concurrencia entre usuarios**: `updatedAt` como precondición en PATCH de tareas (409 en conflicto) + idempotency keys en los POST de creación (el retry móvil hoy duplica) | GAP-02, API | 1–2 sesiones |
| F4.5 | **Alerta automática de paridad tipadas↔espejo** (job diario que corre `typedParity()` — ya existe, storage-pg.js:530 — y notifica divergencia) — es además el reloj del criterio D-7 | DB (paridad) | 2 h |
| F4.6 | **URLs firmadas para media** (HMAC corta vida). Ojo: `mediaUrl()` de core.js NO es el único punto de cambio — la isla `empaque.html` renderiza `foto_url` directo y el SW cachea media cache-first. Hacer: **firmar server-side dentro de `foto_url`** (así las islas no cambian) + **excluir los prefijos de media del caché del SW** (si no, cada firma nueva crea una entrada de caché sin tope — FE-10) | FE-01, FE-10 | 1–2 sesiones |

**Criterio de salida:** harness de latencia (30 clientes concurrentes con Odoo simulado lento) muestra mutaciones <10 s con ERP caído; curl anónimo a una foto → 403; doble-submit no duplica.

---

## F5 — Preparación del dev + simplificación (semanas 6–10) — el kill-list con fechas

**Objetivo:** que el dev profesional que contrates herede un sistema que se explica solo, sin las redundancias que hoy solo tu memoria sostiene. Cada retiro reduce lo que hay que explicar.

| # | Tarea | Ref | Esfuerzo |
|---|---|---|---|
| F5.1 | **Suite en modo producción dentro del CI**: los tests de storage-pg/typed-cutover corren contra PG real en GitHub Actions (servicio postgres), no SKIP silencioso | QA-03 | 1 sesión |
| F5.2 | **Retirar SSE** (ejecuta D-6). **PRECONDICIÓN: F2.1 completada con mapping conexión→usuario verificado** — hoy el SSE es el único canal per-usuario de notifs; apagar sin eso deja al equipo sin notificaciones realtime | R-10, simplif. | 1 sesión |
| F5.3 | **Consolidaciones seguras**: un solo `escapeHtml` que cubra `&<>"'` reemplaza a los 4; un solo predicado `isTaskParticipant` (arregla el drift creador-ve-pero-no-edita) | R-07, dup. | 1 sesión |
| F5.4 | **RBAC — primero documentar, después unificar**: (a) documentar cuál modelo gobierna qué (`ROLE_PERMISSIONS` = rol→acción; `sectionPerms` = usuario→sección — son cosas distintas, no duplicados triviales) + **test de paridad frontend/backend**; (b) SOLO con ese test verde, evaluar derivar uno del otro — es un merge semántico con riesgo real de regresión de permisos | SEC-07, R-16 | 1 sesión (a); (b) aparte |
| F5.5 | **`scripts/stamp.mjs`**: recalcula md5-8, re-estampa `?v=` en shell+islas, bumpea APP_BUILD ×2 y CACHE del SW; integrado a `deploy.mjs`; test de paridad NOTIF_META | ARQ-04 | 1 sesión |
| F5.6 | **Peso muerto fuera** (ejecuta D-4/D-5): tab Políticas, `chart.min.js` sin referencias, `dueDateAuto` (usarlo en métricas o quitarlo), restos de Sheets según D-5 | dead code | 1 sesión |
| F5.7 | **CLAUDE.md sin drift + matriz de flags**: corregir las afirmaciones que el código contradice (basedatos, index.html, chart) y crear la tabla flag→valor prod→default→plan de retiro (46 env vars) | GAP-09, docs | 1 sesión |
| F5.8 | **Retiro del dual-write** cuando se cumpla D-7 (4 semanas de F4.5 limpio + drill F1.5 OK — el reloj cierra justo en la semana 8–10): apagar espejo; `collection_rows` queda como histórico congelado | DB (dual) | 1 sesión |

**Criterio de salida (el examen real):** un dev externo (o un agente SIN memoria del proyecto) recibe solo el repo + CLAUDE.md + runbook y en **una semana**: levanta local, corre la suite, hace un cambio pequeño en una isla y lo deploya con el script. Si necesita preguntarte algo, eso que preguntó es el siguiente ítem de F5.7.

---

## F6 — Módulos con integridad + cierre de lazos de proceso (meses 2–4, continuo)

**Objetivo:** seguir creciendo en módulos (tu plan real) sobre una base que no acumule las deudas que esta auditoría encontró — y cerrar los lazos operativos donde el software ya terminó y falta el proceso.

**Carril software:**

| # | Tarea | Ref |
|---|---|---|
| F6.1 | **Plan 08 continúa** (Olas 4–5, desbloqueadas desde F2.7) con el estampado F5.5 — el costo marginal por isla queda en ~0 | plan 08 |
| F6.2 | **Carril proxy.js**: tabla de rutas (método+path → handler) y extracción gradual por dominios (tasks, sdv, inventario) — es donde el dev nuevo va a trabajar; que no herede la cascada de 238 ifs | R-11, BE |
| F6.3 | **Integridad declarativa en tipadas**: UNIQUE en ids naturales → FKs núcleo (tasks↔subtasks↔sdv) → CHECK de estados; después de F5.8 | DB |
| F6.4 | **FSM de estados server-side** (hoy: convención del cliente + guardas puntuales) | DB |
| F6.5 | **Purga/archivado con la retención D-10** — mantiene plana la RAM con años de crecimiento por módulos | GAP-05 |

**Carril proceso (eres Operaciones — esto es tuyo, no del código):**

| # | Tarea | Ref |
|---|---|---|
| F6.6 | **Bandeja de rechazos → Odoo (D3 del go-live)**: panel de pendientes de nota de crédito; deja de depender de memoria | PR (dif.1) |
| F6.7 | **Consumir `out_gate_fail_open`**: panel/endpoint + revisión semanal — el control existe pero nadie lo lee | PR (dif.2) |
| F6.8 | **Recepción tránsito→CDP el mismo día** (P1 del plan de negativos): el software ya hizo todo; el bloqueo es 100 % de proceso físico + las fases de conteo/ajuste pendientes | PR-01 |

**Criterio de salida:** negativos nuevos/mes → 0 sostenido; 0 rechazos sin resolver >7 días; cada módulo nuevo entra con isla + tests + estampado automático.

---

## F7 — Continuo opcional (cuando la señal aparezca)

- **Observabilidad proporcional** (request-id, logs con nivel, error tracking ligero, `process.memoryUsage()` en health) — cuando el primer incidente post-runbook cueste más de lo que debería.
- **MFA (TOTP) para admin/manager** — idealmente antes de que entre el dev (su cuenta también será poderosa).
- **Cola offline de escrituras** (Background Sync; depende de F4.4) — solo si los choferes reportan pérdidas reales en la calle.
- **Prueba de carga del gate** (GAP-06) — si tras F4 la bodega aún percibe lentitud en picos.

---

## Qué NO está en el plan (a propósito)

Sin staging permanente, sin microservicios, sin framework frontend, sin APM, sin paginación por escala de usuarios, sin multi-instancia: **confirmado no-aplica para 30 usuarios estables**. Si alguna de estas aparece en una propuesta futura (tuya, de un agente o del dev nuevo), la carga de la prueba es de quien la propone.

## Seguimiento

Marcar cada tarea al completarla en este documento (checkbox por edición) y registrar el cierre de cada fase en MEMORIA-PROYECTO.md con fecha y evidencia del criterio de salida. Las fases F1–F2 no admiten reordenamiento; de F3 en adelante, el orden interno de tareas es flexible mientras se respeten las dependencias marcadas (D-x → tarea, y las PRECONDICIONES explícitas: F1.2→F3.3, F2.1→F5.2, F4.5+F1.5→F5.8).
