# Riesgos Técnicos y Deuda Técnica — OpsAT / Dashboard Despachos

> Auditoría de arquitectura · 2026-07-22 · Hallazgos priorizados por severidad. Los marcados **[verificado]** fueron comprobados de primera mano contra el código durante esta auditoría; los marcados **[NO VERIFICADO]** son inferencias que requieren confirmación en runtime.

## Escala de severidad

- 🔴 **Crítico** — riesgo de pérdida de datos, caída del servicio o exposición de credenciales/PII. Actuar ya.
- 🟠 **Alto** — bug latente o brecha de seguridad con impacto real; actuar en el corto plazo.
- 🟡 **Medio** — deuda que erosiona mantenibilidad o abre riesgo condicional.
- ⚪ **Bajo** — higiene, cosmético o dependiente de condiciones improbables.

---

## 🔴 Críticos

### R-01 · `silentCatch` no está definida pero se invoca 73 veces **[verificado]**
- **Evidencia:** `proxy.js` — 73 ocurrencias de `silentCatch(...)` (p.ej. `:1042`, `:1050`, `:1108`, `:5702`, `:20749`); `grep` de definición (`function silentCatch` / `silentCatch =` / `silentCatch:`) en `proxy.js`, `boot.js` y `storage-pg.js` → **cero resultados**.
- **Introducción:** commit `8681d86` (21-jun-2026, "notificaciones críticas para go-live"); el patrón se copió a ≥5 commits posteriores hasta v82 (`git log -S silentCatch`).
- **Impacto:** cada vez que se ejecuta uno de esos `catch`, la llamada a la función inexistente lanza un `ReferenceError` **nuevo desde dentro del catch**, convirtiendo un error "a ignorar" en una excepción real. En helpers async invocados sin `await` (p.ej. `notifySdvToOps`, `:20749-20763`) esto degenera en `unhandledRejection`.
- **Agravante:** `proxy.js` **no registra** `process.on('uncaughtException')` ni `process.on('unhandledRejection')` (grep sin resultados). En Node ≥15 una promesa rechazada sin manejar **termina el proceso**.
- **Por qué no ha explotado (hipótesis, NO VERIFICADO):** esas ramas `catch` solo corren en la vía de error (fallo de Odoo/red/datos), que en operación normal es infrecuente; y Railway reinicia on-failure ×10, enmascarando caídas como "reinicios".
- **Acción:** definir `function silentCatch(e, ctx){ console.warn('[silent]', ctx, e?.message); }` (una línea) **y** registrar handlers globales de proceso que logueen sin morir. Coste: minutos. Es el hallazgo de mayor relación impacto/esfuerzo del sistema.

### R-02 · Credenciales de Odoo de producción commiteadas en el repo **[verificado]**
- **Evidencia:** `_ron_neg_watch.mjs:3-6` contiene en claro `ODOO_URL`, `ODOO_DB`, `ODOO_USER` y `ODOO_KEY` (API key). Confirmado el commit de origen: `1dd9827` (v156, "Salud de Inventario"). La misma API key aparece además en 5 scripts de `_archivo/scripts-ron-ejecutados/`.
- **Impacto:** cualquiera con acceso al repo (o a un clon/backup) tiene acceso de API a la instancia Odoo de la empresa. La key vive en el historial de git aunque se borre el archivo.
- **Acción:** **rotar la API key de Odoo** en el ERP (invalida todas las copias filtradas de una vez), mover el script a leer de `.env`, y purgar del historial si el repo se comparte. Rotar es la mitigación efectiva; borrar el archivo NO basta.

### R-03 · El código fuente del servidor es descargable desde producción **[verificado]**
- **Evidencia:** el handler de estáticos permite `.js` (`_ALLOWED_EXT`, `proxy.js:20467`) y `proxy.js` no está en `_FORBIDDEN` (`:20459-20466`) ni casa `_FORBIDDEN_JSON`. Un `GET /proxy.js` sirve las 20.766 líneas del backend.
- **Impacto:** expone la lógica completa de autenticación, rate-limiting, RBAC, rutas ocultas y los `FIX_SECRET` (aunque estén en ramas muertas). Facilita a un atacante mapear la superficie de ataque.
- **Acción:** añadir `proxy.js`, `boot.js`, `storage-pg.js`, `sync-from-prod.js` al denylist `_FORBIDDEN`, o servir estáticos desde una subcarpeta `public/` en vez de la raíz del proyecto.

### R-04 · Las fotos (evidencia operativa) no tienen respaldo externo **[verificado vía informe de auditoría interna]**
- **Evidencia:** `AUDITORIA-WWP-2026-07-06.md` y `MEMORIA-PROYECTO.md:160` documentan que los backups automáticos cubren solo los `.json`; el volumen de Railway (`DATA_DIR`) es la única copia de las fotos de despacho/avería/inspección (6 carpetas).
- **Impacto:** una pérdida del volumen (o su corrupción) borra irrecuperablemente toda la evidencia fotográfica de entregas, averías e inspecciones — con implicaciones legales/comerciales.
- **Estado:** el respaldo Nivel 1 (`scripts/backup-wwp.mjs`) ya copia fotos incrementales a OneDrive, pero depende de una tarea de Windows en la máquina de un empleado (punto único de fallo humano). Falta respaldo offsite server-side.

---

## 🟠 Altos

### R-05 · `/api/health` filtra datos y topología sin autenticación **[verificado]**
- **Evidencia:** `proxy.js:8503-8521` — la respuesta pública incluye `dataDir` (ruta absoluta del disco), `tasksFile`, `tasksCount`, `tasksFileSize` y **`tasksRawPreview`: los primeros 200 caracteres del contenido real** de `wwp-tasks.json`.
- **Impacto:** fuga de estructura interna y de un fragmento de datos de negocio a cualquier visitante. El healthcheck de uptime solo necesita `{ok:true}`.
- **Acción:** recortar la respuesta shallow a `{ok, build, timestamp}`; mover el detalle a la rama `?deep=true` protegida por token.

### R-06 · Datos de despacho de `index.html` efectivamente públicos **[verificado]**
- **Evidencia:** `index.html` lee un CSV **publicado** de Google Sheets (URL pública, `index.html:316`) y, en modo iframe, `/api/sheets-csv-index` del proxy re-fetchea esa misma URL **sin auth y con `Access-Control-Allow-Origin: *`** (`proxy.js:7987-7996`). El "PIN" `'3094'` (`index.html:155`) es una comprobación en cliente, cosmética.
- **Impacto:** los datos comerciales del dashboard de ventas son accesibles sin sesión.
- **Acción:** proteger `/api/sheets-csv-index` con JWT + permiso `dashboard-ventas`; despublicar el CSV de Sheets.

### R-06B · Endpoints sensibles que tocan Odoo o datos sin autenticación **[verificado]**
- **Evidencia:** varios endpoints responden sin `requireJwt`:
  - `GET /api/averias` y `GET /api/averias/product` (`proxy.js:10547`, `:10553`) devuelven el catálogo de averías completo sin sesión — inconsistente con `/api/averias/search` y `/lookup`, que **sí** exigen JWT (`:9585`, `:9620`).
  - `GET /api/wwp/odoo-order/:ref` (`proxy.js:16087`), `/api/analysis/localities` (`:8757`) y `POST /api/analysis/container` (`:9047`) consultan Odoo con la **API key privilegiada** sin JWT → exponen stock/artículos de cualquier orden a un anónimo.
  - `GET /api/maps-key` (`:8493`) entrega la Google Maps API key (mitigado por restricción de dominio en GCP, según comentario); `GET /api/smoke-test` (`:8597`) revela el UID de Odoo.
- **Impacto:** fuga de datos de negocio e inventario; posible abuso de la cuota de Odoo/Maps a través de endpoints abiertos.
- **NO VERIFICADO:** si alguno es intencional (p.ej. consumido por `index.html` sin login). Debe decidirse explícitamente por endpoint.
- **Acción:** exigir JWT + permiso a todo lo que toque Odoo o datos; si `index.html` necesita datos públicos, servirlos por un endpoint acotado y cacheado, no por el proxy Odoo genérico.

### R-07 · CSP con `'unsafe-inline'` en `script-src` + sanitización XSS manual e inconsistente **[verificado]**
- **Evidencia CSP:** `proxy.js:7904` — `script-src 'self' 'unsafe-inline' ...`. Con `'unsafe-inline'` habilitado, la CSP no frena la inyección de scripts inline.
- **Evidencia sanitización:** el frontend define **4 helpers de escape distintos** — `esc` (`historial.html:21653`), `escH` (`:25519`), `escHtml` (`:31040`) y `escapeHtml` (`:39278`). Solo el último escapa la comilla simple (`&#39;`); los otros tres solo cubren `&<>"`. El render usa `innerHTML` + template strings de forma masiva (611 `.innerHTML`, 723 backticks) y el escape se aplica **por convención manual**.
- **Impacto:** atributos HTML delimitados con comilla simple quedan sin proteger en la mayoría del código; cualquier punto que olvide escapar es un XSS almacenado (los datos vienen de Odoo y de inputs de usuario). La CSP no actúa como red de seguridad.
- **Acción:** unificar en un solo `escapeHtml` que cubra `& < > " '`; auditar los puntos de `innerHTML` con datos de usuario; eliminar `'unsafe-inline'` (requiere refactor a nonces o listeners, esfuerzo alto).
- **Nota:** explotabilidad concreta punto-por-punto **NO VERIFICADA** en esta auditoría.

### R-08 · Contraseñas semilla en el código fuente **[verificado]**
- **Evidencia:** `proxy.js:4638,4642` — semillas `WWP2026!` / `Admin2026!` para los 15 usuarios iniciales.
- **Mitigación existente:** `mustChangePassword` fuerza el cambio en el primer login (`:11591-11594`).
- **Riesgo residual:** cualquier usuario semilla que nunca haya entrado conserva una credencial conocida y pública (el fuente es descargable, ver R-03).
- **Acción:** generar semillas aleatorias por despliegue y entregarlas fuera de banda; o exigir onboarding por invitación.

### R-09 · JWT artesanal HS256 sin librería **[verificado]**
- **Evidencia:** `proxy.js:3108-3130` implementa firma/verificación HS256 a mano con `crypto` (usa `timingSafeEqual`, correcto). No usa `jsonwebtoken` ni equivalente.
- **Riesgo:** las implementaciones artesanales de JWT son un foco histórico de vulnerabilidades (confusión de algoritmo, validación incompleta de claims). Aquí el algoritmo es fijo (no lee `alg` del header, lo que evita el ataque clásico `alg:none`), pero cualquier cambio futuro puede introducir fallos sutiles.
- **Atenuante:** `requireJwt` relee el usuario del disco en cada request (`:3153-3171`), lo que da revocación inmediata — una fortaleza.
- **Acción:** considerar migrar a `jsonwebtoken`; como mínimo, congelar y testear la implementación actual con vectores adversariales.

### R-10 · Token JWT viaja por query string en el stream SSE **[verificado por informe frontend]**
- **Evidencia:** `historial.html:10688` — la conexión SSE envía el JWT como parámetro de URL (los `EventSource` no permiten cabeceras).
- **Impacto:** los tokens en query string se filtran a logs de acceso, proxies y `Referer`. Mitigación server-side (rotación/tiempo de vida corto) **NO VERIFICADA**.
- **Acción:** usar tokens efímeros de un solo uso para el handshake SSE, o migrar el stream a WebSocket (que ya existe en paralelo) con auth en el primer frame.

---

## 🟡 Medios (deuda técnica estructural)

### R-11 · Dos monolitos gigantes concentran todo el sistema **[verificado]**
- `proxy.js`: **20.766 líneas**, un único handler HTTP async de ~12.700 líneas (`:7882-20581`) con cadena if/else de ~238 ramas de ruta, sin router ni middleware.
- `historial.html`: **40.727 líneas** (~31.000 de JS en 6 `<script>`), todo el estado en variables globales top-level, **sin `'use strict'`**, con `renderDrawer` de **1.060 líneas** (`:15251`).
- **Impacto:** curva de aprendizaje altísima, riesgo de colisión de nombres en scope global (`4.807 var` vs `70 let`/`1.479 const`), imposibilidad de tree-shaking o carga parcial, y un radio de impacto enorme por cambio.
- **Acción:** no reescribir de golpe; extraer módulos por dominio incrementalmente (empezar por SDV e Inventario, que ya tienen prefijos `_sdv*`/`inv*` propios) detrás de un router de rutas en el backend.

### R-12 · Código muerto embarcado en producción **[verificado]**
Verificado por ausencia total de llamadas:
- `loadAllReports` (`historial.html:32062`) — Reportes Operacionales R1–R9 completos, inalcanzables.
- `toggleGuidedMode` (`:14191`) — "Modo guiado", sin caller.
- `_EO_MOCK_DATA` (`:37112`) — **se usa pero nunca se define**: activar el flag `_EO_MOCK` rompería el tablero Estado de Órdenes con `ReferenceError` (bug latente, no solo código muerto).
- Otros reportados por el inventario de features: `renderDevoluciones` acordeón, Monitor de Tránsitos standalone (`tmCargar`), `renderPendientes`, `cargarPendientesOut`.
- **Acción:** eliminar; el `_EO_MOCK_DATA` sin definir debe quitarse o definirse aunque el flag esté apagado.

### R-13 · Duplicación masiva de patrones **[verificado]**
- `'Content-Type':'application/json'` inline **715 veces** pese a existir helpers `sendJson` (58 usos) y `sendGzipJson` (33) — `proxy.js`.
- Patrón `Promise.race` con timeout para Odoo copiado ~8 veces (`proxy.js:9373 … 16067`).
- Patrón de "watchdog diario a hora RD" duplicado 3-4 veces.
- 4 helpers de escape HTML en el frontend (ver R-07); múltiples formateadores de fecha (`historial.html:21710, 21957, 12406, 35237`).
- **Impacto:** un fix debe replicarse N veces (justo el mecanismo por el que se propagó R-01).

### R-14 · I/O de disco 100% síncrona en el servidor **[verificado]**
- **Evidencia:** `proxy.js` usa `fs.readFileSync`/`writeFileSync`/`renameSync` en el hot path (`loadJson`/`saveJson`, `:34-76`); 78 funciones `async` conviven con I/O bloqueante.
- **Atenuante:** `loadJson` cachea por `mtime`, y con Postgres activo las colecciones viven en memoria (la escritura a PG sí es async). El riesgo real es en modo archivos.
- **Impacto:** en modo JSON, un `saveJson` de un archivo grande (tareas ~MB) bloquea el event loop y congela todas las peticiones concurrentes.
- **Acción:** en modo archivos, mover las escrituras a `fs.promises` con cola; en producción PG el impacto es menor.

### R-15 · `.gitignore` incompleto para colecciones nuevas **[verificado]**
- **Evidencia:** `.gitignore` excluye los `wwp-*.json` principales y fotos, pero **faltan** `sdv-*.json`, `wwp-inventario-*`, `wwp-locations.json` (GPS con PII), `push-subscriptions.json`, `vapid-keys.json` y las carpetas `desp-fotos/`, `emp-fotos/`, `sdv-adjuntos/`, `prod-img/`.
- **Impacto:** si el servidor se corre en la raíz sin `DATA_DIR`, se pueden commitear accidentalmente datos con PII y las claves VAPID.
- **Acción:** completar el `.gitignore`; idealmente forzar `DATA_DIR` fuera del árbol del repo siempre.

### R-16 · Dos sistemas de permisos conviviendo **[verificado por informe núcleo]**
- **Evidencia:** `ROLE_PERMISSIONS` (`proxy.js:4622-4633`) coexiste con `sectionPerms` de roles custom (`:2009-2021`). Chequeos vía `requireRole` (55 usos) y `requireSectionPerm` (18 usos).
- **Impacto:** ambigüedad sobre cuál gobierna en cada ruta; riesgo de que un permiso se conceda por un sistema y se niegue por el otro.
- **Acción:** unificar en el modelo `sectionPerms` y derivar los roles fijos de él.

### R-16B · La IA está documentada como Claude pero implementada con OpenAI; el SDK de Anthropic es código muerto **[verificado]**
- **Evidencia:** `anthropicClient` se instancia (`proxy.js:1545`) pero **no se invoca en ninguna parte** (cero `.messages.create` / `anthropic.` en el archivo). Los 5 call-sites de IA usan `fetch('https://api.openai.com/v1/responses')` con `CODEX_AUDITOR_MODEL='gpt-5.5'` (`:1549`, `:1562`, `:4320`).
- **Discrepancia documental:** CLAUDE.md, `.env.example` ("Gerente de Operaciones: usa Claude / Anthropic") y los comentarios describen el feature como impulsado por Claude. La realidad es OpenAI.
- **Impacto:** `@anthropic-ai/sdk` (0.104.1) es una dependencia instalada y un cliente vivo pero inerte; `ANTHROPIC_API_KEY` configurada no hace nada. Confusión de mantenimiento y superficie de dependencia innecesaria.
- **Acción:** decidir el proveedor real; si es OpenAI, eliminar el SDK de Anthropic y corregir la documentación; si se quiere Claude, cablear `anthropicClient` en los call-sites.

### R-17 · Artefactos huérfanos y desactualizados en la raíz **[verificado]**
- `sync-from-prod.js` apunta a **Render** (producción vieja, `:18`) y usa nombres de archivo obsoletos (`empaque-materiales.json` cuando hoy es `emp-materiales.json`) → roto si se ejecuta.
- `_mockup_notif_panel.html` ya fue portado a producción (commit `5d27667`) pero sigue en la raíz (servible públicamente).
- `wwp.html` (3.393 líneas) **no es un redirect**: es la app WWP vieja completa; la deprecación es solo un 302 server-side (`proxy.js:20293`). Con otro server estático revive.
- **Acción:** mover a `_archivo/`; corregir o borrar `sync-from-prod.js`.

### R-18 · Suite de tests no reproducible en clon limpio **[verificado]**
- **Evidencia:** 6 harnesses (`_gateodoo`, `_test_capa1_picks`, `_test_v113/117/202/212`) leen `_fakecert.pem`/`_fakekey.pem` desde la raíz, pero `.gitignore:5-6` excluye `*.pem` → **no existen en el clon**. Fallan en fresco.
- `test-storage-pg.mjs` **hace DROP de tablas** de la DB apuntada por `WWP_PG_TEST_URL` (skip limpio si no está la env — atenuante).
- `npm test` requiere el servidor vivo en `:3000`.
- **Impacto:** no hay forma de correr la batería completa sin setup manual; imposible en CI tal cual.

---

## ⚪ Bajos (higiene)

- **R-19** `FIX_SECRET` hardcodeados en ramas muertas `if(false && …)` (`proxy.js:8007`, `:8092`, `:20304`) — inertes; limpiar por higiene. **[verificado]**
- **R-20** `APP_BUILD` es un string manual (`historial.html:9055`, `proxy.js`) — el auto-update depende de acordarse de bumpearlo; sin él, los clientes no se refrescan. **[verificado por informe]**
- **R-21** Documentación imprecisa: CLAUDE.md dice que `wwp.html` "redirige" (es server-side, no in-file) y que se usa Leaflet en un punto (ya archivado, es Google Maps). **[verificado]**
- **R-22** `_polRefreshTimers` (`historial.html:32794`) declarado y limpiado pero nunca poblado — dead code inofensivo. **[verificado por informe]**

---

## Resumen cuantitativo

| Severidad | Cantidad | IDs |
|---|---|---|
| 🔴 Crítico | 4 | R-01 … R-04 |
| 🟠 Alto | 7 | R-05, R-06, R-06B, R-07 … R-10 |
| 🟡 Medio | 9 | R-11 … R-16, R-16B, R-17, R-18 |
| ⚪ Bajo | 4 | R-19 … R-22 |

**Total: 24 hallazgos.** **Los cuatro críticos son de esfuerzo bajo o medio** y deberían atacarse antes que cualquier feature nueva: definir `silentCatch` + handlers de proceso (R-01), rotar la key de Odoo (R-02), bloquear la descarga de fuentes (R-03) y asegurar el respaldo offsite de fotos (R-04).
