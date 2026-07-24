# Memoria del proyecto — Workforce Platform (historial.html + proxy.js)

> Documento de contexto para retomar el trabajo sin perder decisiones.
> Última actualización: DEPLOY v237 (24-jul-2026) — primer deploy vía deploy.mjs; estrena en prod el shell Astryx.

## NORTE del producto (dueño, 23-jul-2026)
OpsAT es **un software modular, multiusuario, para administrar la empresa en múltiples departamentos**. Regla dura (también en CLAUDE.md): el sistema **crece hacia afuera en módulos (islas + dominio backend + RBAC de sección + tests), nunca hacia adentro en el monolito**; `historial.html` y `proxy.js` solo encogen. Cada departamento/función futuro = una isla. RBAC (`ROLE_PERMISSIONS` + `sectionPerms`) es columna vertebral, no detalle. Rumbo en `docs/auditoria-arquitectura/10-plan-maestro-*`; ejecución en `10-plan-fases-*`; base en `09-auditoria-integral-*` (132 hallazgos). "Hacerlo bien ahora" porque los datos aún son casi de prueba → la Fase 2 (esquema v2 con integridad) es la ventana que se cierra al poblarse.

## DEPLOY v237 (24-jul-2026) — tag `deploy-v237`, commit `dc64144`
Primer deploy real vía `scripts/deploy.mjs` (verificado: health ok + app-version v237 en Railway). **Estrenó en producción todo lo acumulado desde v235**: shell Astryx + sidebar colapsable (v236) y la confirmación reforzada de borrado en Conduces Outlet (v237: diálogo con detalle del conduce, "Eliminar" en rojo, "Cancelar" por defecto, clic-fuera cancela — `doConfirmDelete`, historial.html ~25941).
- **deploy.mjs corregido para Windows** (`dc64144`): `spawnSync` NO lanza `.cmd` (npx/railway) sin `shell:true` → fallaba con ENOENT silencioso que parecía "suite roja". Fix: `shell: process.platform==='win32'` + sleep síncrono cross-platform (el binario `sleep` no existe en Windows). En Mac/Linux sigue sin shell.
- **Gate e2e estabilizado** (`afde960`, `b8a9841`, `5b741a0`): (1) `helpers/session.js` siembra `wwp_welcome_v1` — el modal de bienvenida del shell nuevo tapaba los clicks de flujos-criticos; (2) almacen-mapa degrada con `console.warn` (no `console.error`) cuando Odoo falla — condición manejada, no rompe el console-guard; (3) `retries:3` + `expect.timeout:10s` — el login real (bcrypt) flaquea bajo carga; los 2 flaky conocidos (smoke-02 login, smoke-09 geometría) se recuperan en retry; (4) `@playwright/test` declarado como devDependency en la raíz (el gate dependía de él sin declararlo).
- **Railway re-vinculado**: el link vivía en la carpeta `Claude\Artifacts\dashboard-despachos-live` (⚠️ **congelada en v218, ya NO es la fuente de verdad** — la fuente real es este repo git). `railway link` al repo: workspace Altri Tempi SRL / proyecto OpsAT / production / dashboard-despachos. ⚠️ Pendiente: actualizar CLAUDE.md y `restart.bat`, que aún apuntan a la carpeta vieja.

## Ejecución plan maestro — Fases 0–5 (23-jul-2026, DOS sesiones en paralelo)
Auditoría integral 09 (132 hallazgos, 41 agentes) + plan maestro 10. Ejecutado por dos sesiones Claude coordinadas por commits (evitando colisión en proxy.js/historial.html). Estado al cierre — TODO committeado local, **NADA deployado** (deploy = decisión + `scripts/deploy.mjs`):
- **F2.1 (WS, API-01 P0)** ✅ `fc0296d`: WebSocket con ticket efímero de un solo uso (POST autenticado, no JWT en query), broadcast MUDO (solo `{action,taskId}`, cero objetos de negocio), notifs per-usuario (`socket._uid`). Cliente hace handshake de ticket. Test `smoke-08-realtime`.
- **F1.1/F1.7/F3.5/F2.4** ✅ `ae53f4b`: backup URL a dominio vivo; rollback WWP_TYPED con backfill forzado tras `off` (DB-01); advisory lock single-instance (pg_try_advisory_lock, INF-04/D-8); key Odoo ROTADA (por Filippo) + placeholders en `_archivo`.
- **F2.2/F2.5/F2.6/F2.7/F1.2** ✅ `c09ff75`: allowlist de `.js` del server (ARQ-03); política de contraseñas (min 8 + rechazo de semillas); robustez (readBodyBuf UTF-8, GAP-08 anti-SSRF push, GAP-10 path.sep); flujos críticos e2e reales (los 4, gate de Ola 4); manifest con R2+cifrado.
- **F2.6(BE-01)/F4.2** ✅ `a7bba34`: catch-all 500 del dispatcher; health honesto con `lastOdooOkAt` (no uid cacheado).
- **F2.3 (PII, ARQ-02)** ✅ `e2adf29`: anonimizado el bloque DATOS MOCK del HTML público (SP/GS/OD/ARTICULOS/ORDENES_ACTIVAS con nombres/teléfonos/direcciones REALES de clientes servidos sin sesión) → datos ficticios, preservando estructura y casos de prueba T-SIN-*. 256→99 líneas.
- **F3.1/F5.5 (entrega)** ✅ `5f19c5f`: `scripts/deploy.mjs` (única vía: árbol limpio + stamp + node --check + suite + tag `deploy-vNNN` + railway up + verificación) y `scripts/stamp.mjs` (espejos `?v=`/APP_BUILD/CACHE mecánicos, `--check` para CI).
- **F3.2/F3.3/F3.4 (operabilidad)** ✅ `fb1a536`: `.github/workflows/tests.yml` (node --check + harnesses + e2e + job PG real con services:postgres → QA-03), `backup.yml` (respaldo neutral nocturno gated por BACKUP_TOKEN, exige cifrado), `RUNBOOK.md` (10 escenarios de incidente).
- **Docs** ✅ `6b473bd`+`88f9d9e`: norte de producto en CLAUDE.md + plan maestro; matriz de 43 env vars (`11-matriz-flags-*`); auditorías 09/10.
- **PENDIENTE (cedido a la sesión que posee proxy.js, o siguiente sesión):** F1.4 (alerta server-side "respaldo no visto 48h"), F4.1 (breaker Odoo `odooDown`+timeout gates 8-10s), F4.3 (gate post-body para uploads), F4.4 (concurrencia updatedAt/idempotencia), F4.5 (job alerta de paridad), F4.6 (URLs firmadas de media + exclusión SW), F5.3 (unificar escapeHtml/isTaskParticipant), F5.6 (dead code), F5.8 (retiro dual-write cuando D-7). Todos en proxy.js — respetar la regla de una sesión por archivo.
- **Suite e2e**: verde en cada hito (incluye `smoke-08-realtime` nuevo). Sin deploy tags aún (correcto).

## Reorganización UX/IA — Fases 1–4 del plan 10-UX (23-jul-2026, v229, commit `b1ebb4d` — SIN deployar)
Ejecuta la auditoría UX/IA `10-auditoria-ux-ia-2026-07-23.md` (32 hallazgos); implementación y **decisiones provisionales revisables por Gabriel** en `10-implementacion-ux-2026-07-23.md`. Suite e2e **99/99 antes y después** (smoke-01 ampliado) + recorrido visual de los 3 roles en sandbox, consola 0 errores.
- **Sidebar por dominios** (ids `nav-*` y rutas intactos): Operación del Equipo / Ventas → Despacho / Almacén / **Supervisión** (admin+manager: Panel del Equipo=ex Dashboard, Evidencias, Adopción=ex Impacto) / **Administración** (admin: Usuarios y Permisos, Reglas de Cumplimiento=ex Políticas, Materiales de Empaque). Grupos `navg-equipo|vd|almacen|supervision|admin` (`GROUPS` en core.js). La **barra de tabs del módulo quedó solo operación** (Tareas·Vehículos·Formación); a la gestión se llega por el sidebar vía `goToWwpTab(tab)`; `switchTab` tolera tabs sin botón; deep-links `/wwp/<tab>` intactos; alias nuevos `/admin/usuarios|politicas|empaque|panel|evidencias|impacto` (URL canónica sigue `/wwp/*`).
- **Renombres** (labels, NUNCA rutas): Dev→CDP=**Devoluciones a CDP**, Despacho de Obsoleto=**Conduces Outlet**, Workforce Labor=**Equipo y Tareas**, Averías, Mapa del Almacén, Bandeja SDV, Despachos sin Comprobante; mob-nav espejada 1:1 con el sidebar.
- **Fuente única de labels en core.js**: `TYPE_LABELS`/`TYPE_LABELS_SHORT`/`STATUS_LABELS` — glosario: packaging=**Empaque** (nunca "Embalaje"), estados **femeninos** y "**En curso**" (nunca "En Progreso/Proceso"; "Overdue"→"Vencida"). Los mapas locales del shell son referencias — NO redeclarar copias.
- **RBAC honesto**: `ROLE_PERMISSIONS.dashboard=['admin','manager']` (el tab era visible para manager y los datos le daban 403); fuera del modal de rol los interruptores muertos (`wwp.usuarios`, `wwp.validar_tarea`) y `users_tab` fuera de `_PERM_SP_MAP`; guard de Empaque=admin (igual al build); kanban con `can('edit_task')` (FE-04); `ROLE_LABELS.ventas='Ventas'`; auto-grant manager + `solicitudes-reposicion` (el flujo formal D5 estaba oculto para quien lo gestiona — UX-04).
- **Server**: `basedatos|dashboard-ventas|contenedores` fuera de `_MODULE_ROUTES` → **302** al home; prefijos `/_archivo|/tests|/docs|/scripts|/data-local|/node_modules|/.github|/.claude` → **404** (21 HTML archivados eran alcanzables por URL en prod — UX-09).
- **A11y/estados**: contraste AA de `--text-muted`/`--text-3` (claro+oscuro); **focus-trap global** con retorno de foco (core.js, al final); vacíos con acción (Tareas, Bandeja SDV); Averías traduce estados con fallback visible (`avStatusLabel`); `formacion.html` con media query ≤720px; botón "Reactivaciones" dentro de la Bandeja SDV; welcome "Bienvenido a Ops AT".
- `stamp.mjs --bump` → **v229** + SW wwp-v60. Pendiente de olas siguientes: unificación física SDV/Reposición, Panel del Equipo como fusión real, pantalla Flota, división cuenta/ficha RRHH, `/sdv/<id>`, marca única login/manifest.

## URLs y deploy
- **Producción ACTUAL (Railway): `https://opsat.up.railway.app`** (desde jun 2026).
  - Render (`dashboard-despachos.onrender.com`) fue la producción anterior — ya no se le aplican cambios.
- Local: `http://localhost:3000` (correr con `DATA_DIR=<ruta>/data-local node proxy.js`).
- Deploy: `railway up --service dashboard-despachos --detach` desde la raíz (CLI; ver RAILWAY.md). GitHub es solo respaldo — push a `master` NO despliega. Commitear siempre antes de deployar.
- Datos: producción en disco persistente (env `DATA_DIR`); local en `data-local/`.
- Convención: librerías LOCALES, nunca CDN (lucide.min.js, chart.min.js, xlsx.min.js, three.min.js + OrbitControls.js). Leaflet se archivó — el mapa usa Google Maps.
- GitHub Pages (`altritempisrl.github.io/OpsAT/`, rama `gh-pages`) publica SOLO el dashboard `index.html` en Modo B (CSV de Google Sheets, sin backend) — curado a propósito (jun 22), NO es fósil; se mantiene casi en sync con master.

## Modularización por islas — Olas 0–3 del plan 08 (22-jul-2026, SIN deployar)
- Ejecutadas las primeras 4 olas del plan `docs/auditoria-arquitectura/08-plan-modularizacion.md` (detalle completo y decisiones AHÍ — este resumen es el índice):
  - **Ola 0**: suite Playwright `tests/e2e/` (autocontenida, paquete propio — NO mover deps a la raíz), 80 tests verdes en ~34 s. Server real en :3100 con `DATA_DIR` desechable re-sembrado por corrida (`start-server.js` con guardia de sandbox). Pendiente: flujos críticos tasks/SDV (`fixme` esperando definición del equipo).
  - **Ola 1**: `core.js` (núcleo del shell: auth+red, RBAC, sesión, notif+SSE/WS, esc/toast; SIN `'use strict'`, su `<script src>` en la posición exacta del original) y `theme.css` (tokens claro/oscuro), versionados `?v=<md5-8>` immutable. El monolito bajó 39.128 → 36.5xx líneas.
  - **Ola 2**: isla piloto `basedatos.html` (visor BD) en iframe lazy dentro de su `page-section`; handshake `dbv-ready/-view/-route` con el shell como fuente de verdad de la vista inicial; el shell escribe el path real. `/basedatos` sigue sirviendo el SHELL (login/RBAC intactos); la standalone lee `wwp_auth` del storage (patrón almacen-mapa).
  - **Ola 3 (5/5)**: islas `dev-cdp.html`, `formacion.html`, `politicas.html`, `impacto.html` (con `eqp*`) y `empaque.html` + **`core-isla.js`** compartido versionado (esc, islaFetch/Bearer, islaUser, tema+storage event, toast, helpers ready/vista/ruta/badge/pedir-tarea). Empaque = partición tab/drawer: la isla lleva catálogo/reglas/editor+fotos/picker con lightbox propio; en el shell quedan `empEnrichTaskItems`…`empConfirmItem` (drawer, Ola 5), el lightbox compartido, CSS `task-emp-*` y `apiFetch`; la invalidación de `_empResolveCache` al entrar al tab vive en el hook de activación.
  - **Epílogo basedatos**: el visor BD se ELIMINÓ después a pedido de Gabriel (`5275c3a` — las `t_*` de Fase 3B se consultan por SQL directo); la isla piloto y smoke-06 se retiraron habiendo cumplido su propósito (validar el patrón).
- Lecciones que ya son checklist (mordieron las tres): barrer llamadas cruzadas TAMBIÉN en core.js (`polStopRefresh` residual en `switchTab` tumbaba el boot de todos los deep-links `/wwp/*`); ojo con helpers compartidos al filo del cluster (`apiFetch` se fue con impacto y empaque lo usaba); los MOCK/duplicados (`POL_USE_MOCK`, `escH`≡`esc`) viven lejos del cluster — grep por identificador, no por prefijo.
- Disciplina de hashes: editar `core.js`/`theme.css` ⇒ re-estampar en historial.html; editar `core-isla.js`/`theme.css` ⇒ re-estampar en TODAS las islas (smoke-05/06 lo vigilan). Verificado coherente al cierre.
- NO se deployó nada (el deploy sigue "a decisión" por la migración de 17 MB de la auditoría 2). Los e2e corren offline de Odoo/PG por diseño.

## Routing por URL — v224–v226 hash, v227 PATHS REALES (22-jul-2026)
- **v227: cada módulo tiene URL con path de verdad** — `/inventario`, `/buscar/S09115`, `/wwp/tasks/wt_x`. proxy.js (bloque "Rutas de módulo" en el static serving) sirve la app para todo GET cuyo primer segmento sea un módulo conocido (decisión por segmento, NO por extensión: hay subpaths con puntos como `/averias/JC.ART….P`); `/wwp` ya no redirige. Cliente: `_routeSet` escribe con `history.pushState` (replace en boot), `popstate` navega, `_routeCurrentPath()` lee el pathname y cae al `#hash` si la URL es la base — los links `#` de v224–v226 aterrizan y se **normalizan al path**. sw.js v58: SWR de la app para toda navegación sin `.` en el path. Ojo: los `href` relativos se rompen bajo paths (se arregló `wwp-guide`); todo asset/link nuevo debe ser absoluto.
- La SPA es direccionable: `/<seccion>` (Despachos) y `/wwp/<tab>` (Workforce). Deep-links, F5 y atrás/adelante del navegador funcionan; el aterrizaje post-auth honra la ruta si `canSection`/`hasWwpAccess` lo permiten (silencioso si no). Regla clave: **subruta vacía = default de la sección** (la URL base y el default son la misma ruta → sin doble push al entrar).
- Subrutas: `#buscar/<término>` (órdenes/OC/transferencias — los 3 buscadores reflejan; artículos NO, `buscarDirecta` no los reproduce), `#inventario/<tab>` (fiabilidad|transitos|estructural|cuadre), `#basedatos/<vista>` (visor DB; `_dbvSeq` corrige race de clics rápidos), `#averias/<término>` (lookup), `#wwp/tasks/<wt_id>` (abre el drawer vía `routeNotifTarget` — atrás lo CIERRA), `#wwp/tasks/<vista>` (list|cards|kanban|person|cal|charts; preferencia en localStorage `wwp_task_view`).
- Núcleo en historial.html tras `landAfterAuth`: `_routeSet` (replace en boot, push después), `_routeApplyFromHash` (decode POR SEGMENTO — términos con `/` codificado viajan enteros), `_routeApplySub`, `_routeLand` (re-planta el hash aplicado si el restore de vista lo pisó), listener `hashchange` que re-canoniza hashes inválidos. Guards anti-loop: `_routeApplying` + comparación de estado. `setHistorialUser` no pisa deep-links tras el `doRefresh` (`_routeLanded`).
- Atrás cierra modales (PWA móvil): `modalBackOpen/modalBackClosed` (pushState/popstate, mismo href → no toca el router) en modal Nueva/Editar Tarea, wizard, lightbox averías y empaque; cierre manual consume la entrada (sin atrás fantasma). El drawer de tareas NO usa esto: se rutea por hash.
- Persistencia: filtros/búsqueda de tareas WWP en sessionStorage `wwp_task_filters` (restore en DOMContentLoaded ANTES del primer `filterTasks`; flag `_wwpFiltersRestored` evita que el boot pise lo guardado; `filter-user` async se re-aplica en `populateTaskUserFilter`). Estado de Órdenes: `_eoState` + `_eoQuery` en sessionStorage (hook único en `renderEstadoOrdenes`, merge defensivo).
- No se tocó `?notif=`/`?task=` del SW (`routeNotifClick` gana por orden de ejecución). Ojo pruebas locales: el SW sirve `historial.html` stale-while-revalidate con cache key normalizada (ignora `?cb=`) — solo el bump de build refresca clientes; en dev, desregistrar el SW.
- Pendiente natural (no hecho): deep-link a SDV (`#sdv-portal/<id>`), a contenedor, y reflejar el término de artículos en `#buscar`.

## Fix v227: `</div>` huérfano de la poda v219 — la lista de Tareas se pintaba sobre TODOS los tabs WWP (22-jul-2026)
- Síntoma: en cualquier tab del WWP (p. ej. Empaque) la lista completa de tareas aparecía ENCIMA del contenido del tab ("settings mezclado con lo que no es settings"). En el tab Tareas se veía normal — por eso pasó desapercibido; llegó a prod dentro de v226.
- Causa: la poda v219 (`e15b7a6`) eliminó el bloque `#guided-tooltip` del HTML pero dejó su `</div>` de cierre. El parser cerraba `#tab-tasks` antes de tiempo → `#tasks-list`/`#tasks-cal`/`#tasks-charts` quedaban FUERA del tab (visibles siempre, ignoran `switchTab`) y el siguiente `</div>` cerraba `.app-body` prematuramente (los demás tabs se desplazaban un nivel en el DOM).
- Fix: borrar ese `</div>` (1 línea, zona toolbar de tareas ~7726). Verificado con el parser real del navegador: los 3 contenedores vuelven a `#tab-tasks` y `.app-body` recupera sus 9 tabs.
- Lección (refuerza la de la poda v219): tras podar HTML, correr chequeo de balance de `<div>` por región — el HTML no falla, el parser "repara" en silencio y el síntoma aparece lejos de la causa.

## Fixes auditoría 2 — colas de escritura + dirty-flags + media embebida + Ola 0 (22-jul-2026, dos sesiones en paralelo)
- **B1/B2 (races de escritura) cerrados en dos capas.** `write-queue.js` NUEVO (cola de sección crítica por clave; contrato: serializa por clave, el error del writeFn SE PROPAGA al caller y la cadena sobrevive) cableado fino por colección en los ~19 mutadores de `wwp-tasks` con `await` en la ventana load→save (PATCH/DELETE de tarea, evidencias por tarea/ítem/grupo, chat, sync-pick, out-confirm/unconfirm, fotos-guia ×4, devolución-ruta, job out-recon) y en cursos (PATCH/DELETE con re-resolución post-`readBody`); MÁS gate central por dominio en el dispatcher (`gate:tasks-sdv|inventario|averias|inspecciones|showroom`) que serializa todo request no-GET del dominio y encola los jobs (out-recon, inv-*). Orden de adquisición fijo gate→colección: sin deadlocks. Regla: dentro de una sección crítica NUNCA anidar `queueWrite` de la misma clave (deadlock instantáneo).
- **B3 (cada save re-serializaba la colección entera)**: `saveCollection(base, data, {touched: [filas|ids]})` — las filas conocidas no declaradas reusan su serialización previa (`_canReuseSer`); ids naturales duplicados NUNCA reusan (la clave remapeada divergiría). Cableado en audit (10k filas → 1 stringify por evento), notificaciones (2k → 1) e inspecciones (17 MB → solo la fila mutada). Contrato en `tests/_test_b1b3_colas.mjs` (17/17, sin PG: pool falso + conteo de `JSON.stringify`): altas/bajas se detectan aunque no se declaren, y un save completo posterior sana cualquier deriva.
- **B13**: `wwpStateVersion` monotónica persistida (kv `wwp-state-version`; arranque `max(reloj, persistida+1)`). **A1/A2**: fotos base64 embebidas en JSONB (17 MB de `fotos_condicion` + averías/showroom) → capa media al subir (kinds `inspection`/`av-fotos`/`showroom-fotos`) y `migrateEmbeddedMediaOnBoot` idempotente para lo ya guardado. **A3** verificado: los caps 2000/10000 ya existían.
- **C6 / Ola 0 del plan 08**: `tests/e2e/` (Playwright) montado — server real efímero :3100, login, 15 secciones, 9 tabs WWP, flujos críticos, console-guard. **31 passed** sobre el estado combinado de ambas sesiones. Regla operativa nueva: suite verde ANTES y DESPUÉS de cualquier cambio grande (primer uso real: validó el cableado B1 sin coordinación previa).
- Verificación total del combinado: `node --check` ×3, harness 17/17, e2e 31/31, boot :3130 + curl con 6 PATCH concurrentes OK, login sin errores de consola, smoke propio de la otra sesión 16/16 (:3217, incl. migración on-boot en vivo). Detalle por hallazgo con sellos ✅: `docs/auditoria-arquitectura/07-auditoria-escalabilidad-2026-07.md`.
- **Sin deployar**: el próximo `railway up` corre la migración de media embebida en prod (idempotente, arranca ~45 s tras el boot). Deployar con árbol limpio (técnica del worktree si hay WIP ajeno). → **Superado por Fase 3B (abajo): deployado el 22-23 jul.**

## Fase 3B — CUTOVER RELACIONAL COMPLETO: 24 tablas tipadas por entidad (22–23-jul-2026)
- Pedido de Gabriel: "la arquitectura de la base de datos y sus tablas está mal… hay que terminar". Diagnóstico: TODO el negocio vivía como blobs JSONB en 2 tablas genéricas (`collection_rows` + `kv_store`); las "tablas" del visor eran solo vistas de lectura.
- **Ahora cada colección tiene su tabla real** `t_<coleccion>` (24): `_key` PK, `_ord` (orden del array), `_extra` JSONB y columnas TIPADAS generadas desde los tipos reales de prod (`typed-schemas.js`, regenerable). Contrato sin pérdida: null explícito / clave nueva / drift de tipo viajan en `_extra`; NULL en columna = clave ausente. `wwp-audit` se tipa solo `timestamp`+`event` (payload heterogéneo por `_extra`).
- **`WWP_TYPED=off|dual|read`** (env gana; default `read` desde `25f6238`): dual = espejo en la MISMA transacción del flush; read = el boot reconstruye la memoria desde las tipadas (guardia de conteos: jamás arrancar con datos de menos); off = kill-switch. `collection_rows` sigue recibiendo TODA escritura y el export a JSON sigue vivo → **rollback = cambiar la env var**.
- Rollout ejecutado: deploy `77751ab` en dual → backfill automático de las 24 tablas en prod → **paridad 24/24 EXACTA** por psql (299 tareas, 2.000 notifs, 1.697 audit, 29 usuarios, 37 SDV…) → flip `WWP_TYPED=read` → verificado: health `typed:{mode:"read"}`, app sirviendo desde tipadas, paridad re-confirmada post-flip. Además convergió la migración A1: `fotos_condicion` 17 MB → **7 KB** (URLs R2).
- Verificación previa: `tests/test-typed-cutover.mjs` **29/29** contra PG real local (Homebrew @16, :5544 — macOS: `LC_ALL` + `unix_socket_directories=''`), regresión `test-storage-pg.mjs` verde, boot local dual+read con CRUD reflejado en SQL, e2e 62 passed. Paridad consultable: `GET /api/admin/db/typed-parity` (admin) o `typedParity()` .
- SQL directo ya es primera clase: `SELECT title, status FROM t_wwp_tasks WHERE status='assigned'`. Futuro: apuntar las vistas v_* a las tipadas, índices por consulta real, FKs entre entidades, y retirar el dual-write cuando haya semanas de confianza.

## Almacenamiento: PostgreSQL (Railway) con backend dual — migración jul-2026
- **Producción**: PostgreSQL en el mismo proyecto Railway (servicio `Postgres`). Con `DATABASE_URL` definida, `loadJson/saveJson/saveCriticalArray` enrutan los `.json` del DATA_DIR a `storage-pg.js` (store en memoria precargado + escritura diferencial por fila a `collection_rows`/`kv_store`, orden por `ord` fraccional, anti-vacío en `rejected_writes`).
- **Arranque**: SIEMPRE `node boot.js` (railway.json y npm start ya apuntan ahí) — inicializa PG async ANTES del monolito. `node proxy.js` directo con `DATABASE_URL` definida sale con error a propósito.
- **Local/tests**: SIN `DATABASE_URL` todo sigue en archivos JSON como siempre (restart.bat, launch.json, harnesses que siembran archivos). ⚠️ No poner `DATABASE_URL` en el `.env` local.
- **Respaldo/rollback**: cada hora (y en SIGTERM) el estado vivo se exporta de PG a los mismos `.json` de siempre en `/data` → quitar `DATABASE_URL` + redeploy vuelve a modo archivos perdiendo ≤1 h. El import al boot es idempotente (solo colecciones que no existan en la DB).
- **Contrato**: `tests/test-storage-pg.mjs` (necesita `WWP_PG_TEST_URL` hacia la DB `wwp_dev`; sin ella hace SKIP limpio).
- Fix incluido en la migración: `enrichOverdueTasks` ya NO persiste en cada GET (la comparación incluía `escalation.generatedAt`, timestamp nuevo por llamada → reescribía 28 MB por request con ≥1 tarea vencida).

## Imágenes de producto: /prod-img/ (Fase 2, jul-2026) — NUNCA base64 inline
- Las fotos de producto de Odoo (`image_128`/`image_512`) ya NO se guardan base64 dentro de `items[].image/kitImage` — eso duplicaba la misma imagen por cada componente y hacía el payload de tareas de ~19 MB gzip (87% imágenes repetidas). Ahora: `saveProductImageB64()` las escribe UNA vez en `DATA_DIR/prod-img/<sha1-16>.<ext>` (dedup por contenido) y el item lleva la URL `/prod-img/...` (servida `immutable`, 1 año de caché).
- Regla: cualquier flujo nuevo que traiga imágenes de Odoo a items usa `saveProductImageB64(prod.image_128)`, jamás `'data:image/png;base64,'+...`. (El avatar de usuario del chat es flujo aparte y quedó como estaba.)
- `migrateProductImagesInline()` corre en cada boot (idempotente): convierte cualquier base64 inline heredado. Resultado medido con datos reales: archivo de tareas 6.1 MB → 93 KB; payload GET tasks 4.2 MB gzip → 8 KB.
- `<img src>` acepta URLs igual que data URIs → el cliente no cambió.

## SDV devolución multi-RET (v206, jul-2026) — la vendedora elige las RET
- `GET /api/sdv/lookup?tipo=devolucion` ya NO colapsa a la última RET: devuelve `rets:[{id,name,state,origin,retRef,itemCount}]` (todas las no canceladas) + `items` etiquetados con `retId/retRef`. Con 1 RET el shape top-level (`retRef/retState`) es idéntico al de antes; con N se agregan (`' + '` / `'/'`).
- Resolución compartida en `sdvFindRetPickings(soId, soName)` (flujo nuevo sale_id+incoming, fallback viejo /RET/ por origin del OUT) — la usan lookup Y refresh (el refresh solo cubría el flujo viejo: estaba roto para sale.return.order).
- Form (historial.html): con 2+ RETs se pinta el selector `#sdv-rets-selector` (checkboxes ámbar, default todas; toggle filtra artículos en vivo). Estado: `_sdvRets/_sdvRetSel/_sdvItemsFull`. Guard en `sdvRenderItems`: con todo desmarcado la sección NO se oculta (aviso "Marca al menos una RET"); `sdvEnviar` bloquea con mensaje específico.
- La selección es FIJA al crear (decisión Gabriel 20-jul): se persiste `retRefs` saneado (whitelist, ids numéricos, corte a 20) en la SDV, viaja a la tarea (`task.retRefs` + `items[].retId/retRef` vía `sdvEspecialItems`), y el refresh (`/odoo/refresh`) se ANCLA a esos ids (solo excluye canceladas posteriores). Sin "cambiar RET" en el modal de edición.
- Fix incluido: el diff del refresh agregaba por SKU solo el lado SDV → con el mismo SKU en varias RET daba falsos "modificados"; ahora ambos lados se agregan por SKU.
- Harness: `tests/_test_sdv_multiret.mjs` (23 asserts) + regresión `tests/_test_sdv_devolucion_recogida.mjs` (38).
- **v209 browse-first**: al presionar "Devolución" se listan las RET PENDIENTES (waiting/confirmed/assigned, nunca done/cancel) vía `GET /api/sdv/rets-pendientes` (cache 60s, fail-open sin Odoo). Ventas ve SOLO las suyas (match tolerante por nombre normalizado contra `sale.order.user_id`; decisión Gabriel 21-jul); admin/manager ven todas. Selección multi-RET de UNA sola orden (cruzar orden reinicia con toast) → "Continuar" ejecuta el lookup de siempre y acota `_sdvRetSel` a las marcadas. La búsqueda manual por orden queda debajo como fallback (RET ya ejecutada, matching fallido).

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
- **Mapa** (Google Maps vía `_ensureGoogleMaps` + `/api/maps-key`; Leaflet quedó archivado): botón "Ver mapa" en Usuarios (admin) y en la barra de Tareas para roles con permiso; modal con pines por frescura (≤45min reciente / ≤4h viejo), buscador, recorrido con filtro por fecha (polyline inicio rojo / última verde, decimación >30 pts).
- ⚠️ **Permissions-Policy** (proxy.js): `geolocation=(self)` — sin esto el GPS no funciona.
- Permiso del navegador: una vez por dispositivo+navegador (no por cuenta).

### v204 — Geo-verificación + adopción + alertas (paquete "sacar el máximo al mapa")
- Permiso nuevo **`wwp.mapa_auxiliares`** (Roles → Campo): acceso al mapa configurable — admin siempre, managers/roles custom si se les marca. Server valida con `canSeeUsersMap()` en `/auth/locations`, `/auth/users/:id/locations`, `/auth/locations/adoption` y `/auth/locations/stale-check`. `GET /auth/users` ya NO manda `lastLocation` a roles sin este permiso (minimización).
- **Geo-verificación de entrega**: `POST /auth/location` con `taskId` compara el punto contra `task.gpsCoords` (heredado de la SDV al crear la tarea) y sella `task.geoCheck` {minDistM, ok, points, radiusM}. Radio por env `GEO_VERIFY_RADIUS_M` (default 300 m). El drawer muestra "GPS en sitio: verificado a X del destino" (verde) o "señal más cercana a X" (ámbar). Foto lejos del radio → notif `geo_evidencia_lejos` a admins+encargado, 1× por tarea.
- **Alerta señal perdida**: job cada `GEO_STALE_CHECK_MINUTES` (default 30; 0 = off) — despacho/recogida `in_progress` cuyo chofer (rol rastreado) lleva > `GEO_SILENT_HOURS` (default 4) sin señal tras `GEO_SILENT_GRACE_MIN` (default 45) → notif `geo_sin_senal`, 1× por tarea (`geoSilenceAlertAt`). Trigger manual: `POST /auth/locations/stale-check`.
- **Adopción**: `GET /auth/locations/adoption` — por auxiliar rastreado: puntos 7d, eventos 7d (aprox por statusHistory), última señal. El modal del mapa muestra "Cobertura GPS · 7 días" + lista de auxiliares sin señal (probable permiso GPS denegado).
- Tipos notif nuevos en NOTIF_META (ambos espejos) + `SUPERVISOR_SKIP_TYPES` (geoNotifyOps ya notifica directo — sin copia a supervisores, misma regla que inventario_negativo).
- A11y del modal: `role="dialog"`, `aria-modal`, Escape cierra, foco entra y regresa al abridor.
- Suite: `npm run test:geo` (tests/test-geo-contract.mjs, 10 pruebas HTTP funcionales: RBAC, spoof, minimización, cerca/lejos/sin destino, dedupe de alertas, adopción).

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

## Poda 2/2 + /api/politicas restaurado (v219, 22-jul-2026)
- **Código muerto eliminado de `historial.html`: ~1,970 líneas** (40,727 → 38,760), todo verificado con 0 llamadores antes de cortar (mapa por agente + script verify-then-cut):
  - Reportes Operacionales completos (`loadAllReports` + 5 `renderRpt*` + 11 helpers `rpt*`) — inalcanzables, sin DOM.
  - Modo Guiado entero (CSS + panel DOM + `GUIDED_STEPS` + 9 funciones) — el botón que lo abría ya no existía.
  - Monitor de Tránsitos standalone (`tmCargar/tmRender/tmExportCsv`) — reemplazado por `invdTransitCargar` (sección inventario). `tmAge` SE CONSERVÓ (lo usa inventario).
  - Isla Devoluciones (`loadDevoluciones/renderDevoluciones/devMonthHtml/renderComparativo/…` + 2 bloques CSS + `toggleDev`) — lazo cerrado sin entrada. `var DEVOLUCIONES=[]` SE CONSERVÓ (lo lee `buscarDirecta`).
  - `renderPendientes`/`cargarPendientesOut`/`toggleDept` + array demo `PENDIENTES` — sin llamadores ni DOM; claves fantasma `pendientes`/`pendientes-out` quitadas del ORDER de aterrizaje (daban página en blanco).
  - `_EO_MOCK` desenrollado en `estadoOrdenesCargar` — quitaba un `ReferenceError` latente (`_EO_MOCK_DATA` se usaba sin definirse).
  - Compartidos intocados: `tmAge`, `_wwpTypeIcon`, `rptEventHtml` (viva pese al prefijo), `DEVOLUCIONES`, CSS `dept-`/`dias-*` (los usa la línea de tiempo).
- **`/api/politicas` implementado en `proxy.js`** (GET/POST/PATCH/DELETE, admin-only con `requireRole`, seed `POL-20260518-001` desde el politicas.json archivado, sentinel null para no re-sembrar colección vaciada, funciona en modo archivos Y PG): el tab Políticas (admin) llamaba a este endpoint y NUNCA existió en la era Node — el tab estaba roto en producción. Historial de políticas sigue siendo client-side (mock seed) — mejora futura si se quiere real.
- Raíz: `.nojekyll` eliminado de master (Pages sirve desde `gh-pages`, que tiene el suyo). `render.yaml` SE QUEDA: Render vivo (health 200) como fallback. Docs de negativos/auditoría SE QUEDAN en raíz (ciclos abiertos).
- Docs corregidos: `package.json` notes (decía `node proxy.js`/`.env.txt`/nombres viejos), `_archivo/README.md` (post-podas), `CLAUDE.md` (wwp.html ya no existe en raíz).
- Colateral (sesión paralela, ae3f500): dominio Railway viejo murió hoy → `uptime.yml` pingaba 404 y abrió issue falso; corregido a `opsat.up.railway.app`.
- Verificado en local: `node --check` proxy, health `v219`, politicas 401 sin token / 403 assistant / CRUD completo admin (curl), navegador con consola en 0 errores: login → Tareas → tab Políticas E2E (card seed + cumplimiento en vivo 15 empleados) → Estado de Órdenes.

## Ola 0 modularización — red de seguridad E2E Playwright (22-jul-2026)
- Primer entregable del plan `docs/auditoria-arquitectura/08-plan-modularizacion.md`: suite Playwright en `tests/e2e/`, **paquete autocontenido** con su propio package.json — NO mover `@playwright/test` a la raíz (Railway construye con `npm install --production` y el lockfile raíz se deploya).
- **60 tests verdes en ~22s**: contratos HTTP (health, 302 de `/` y `/wwp.html`, fallback SPA de los 20 `_MODULE_ROUTES`, `no-store` del monolito, denylist de `.json` sensibles, login/refresh API), login por UI real, deep-link de las 15 secciones Despachos + 9 tabs WWP (sección visible + sin errores JS), y vistas de tareas por URL.
- Mecánica: server real (`node proxy.js`) HTTP en puerto 3100, `DATA_DIR` desechable `tests/e2e/.data-e2e` que `start-server.js` borra en cada corrida (con guardia: aborta si DATA_DIR no es el sandbox) y `seedAuthUsers()` re-siembra — login con el admin seed. La sesión se inyecta por API en localStorage `wwp_auth` antes de cargar (el formulario solo se prueba en su propio spec). Env forzadas a vacío (DATABASE_URL/ODOO_*/R2_*): nunca toca prod, data-local ni Odoo real.
- Guardia de consola (`tests/e2e/helpers/console-guard.js`): `pageerror` SIEMPRE es fallo; `console.error` solo se permite si es ambiental — `/api/odoo`/`/api/sheets`, 502/503 sobre `/api/*` (Odoo/PG ausentes en local; el visor BD responde 503 por diseño en modo archivos, proxy.js ~20577), y errores del helper `odoo()` de la isla del mapa filtrados por stack (cubre también el 429 del rate limiter `/api/odoo` 30/min tras muchas cargas en una corrida).
- Hallazgo que los tests documentan: `/almacen-mapa` NO hace fallback al monolito — proxy.js:20165 sirve `almacen-mapa.html` standalone en deep-link, mientras la navegación in-app muestra `section-almacen-mapa` con iframe; la suite cubre ambos caminos (la página del mapa lee `wwp_auth` por sí misma, ~1734).
- **Pendiente de Ola 0**: los flujos críticos tasks/SDV — esqueletos `test.fixme` en `tests/e2e/flujos-criticos.spec.js` con patrón de ejemplo funcionando, esperando que el equipo defina los 3–5 flujos reales (~5–10 líneas c/u).
- Correr: `npm run test:e2e` desde la raíz (primera vez: `cd tests/e2e && npm install && npx playwright install chromium`). **Regla de oro: suite verde ANTES y DESPUÉS de cada extracción a isla.**

## Ola 1 modularización — core.js + theme.css extraídos (v228, 22-jul-2026)
- **`core.js` (2.509 líneas)**: auth+red (patch de `window.fetch`, `authFetch`/`authFetchRetry`/`fetchWithTimeout`/`authGetJson`, refresh), RBAC (`can`/`canSection`/`_PERM_SP_MAP`/`PERMISSIONS`), sesión (`doLogin`/`checkStoredSession`/`saveSession`/`showScreen`), notificaciones completas + SSE (`connectSSE`) + WS (`connectWwpRealtime`) + IIFE de visibilidad/version-gate, y utilities (`esc`, autofill de buscadores, `showErr`/`togglePw`/`fmtDate`/`toast`). Ex historial.html 8826–11242 + 21001–21073, movidos SIN cambios de código.
- **`theme.css` (126 líneas)**: design tokens `--*` (`:root` claro + `[data-theme='dark']`), ex 34–151. Los overrides dark de componentes (`.sidebar`, `.mv-table`…) siguen en el `<style>` del shell.
- **Técnica**: el `<script src="/core.js?v=<hash>">` quedó en la POSICIÓN exacta del código extraído (cierra el inline, carga core síncrono, reabre inline) → mismo orden de ejecución; cero riesgo de hoisting hacia atrás. Reglas duras: (1) NO mover el tag ni hacerlo defer/async; (2) `APP_BUILD` DEBE seguir dentro de historial.html (`getHtmlBuild` en proxy.js lo parsea con `/var APP_BUILD = '…'/`); (3) core.js SIN `'use strict'` (sloppy mode: los globals implícitos `_token`/`_user`/`_tasks` lo requieren); (4) el preámbulo iOS-PWA + APP_BUILD (8716–8825) quedó inline a propósito.
- **Caché**: `?v=<hash md5-8>` → immutable 1 año (regla existente de proxy). Al editar core/theme: re-estampar el hash en historial.html. El SW cache-first no estorba (URL nueva = entrada nueva) y el version-gate existente limpia caches al bump de build.
- **Extracción mecánica** con scripts de splice con asserts de borde (abortan si el archivo se movió — sesiones paralelas); backup pre-corte en scratchpad. Monolito: 39.128 → 36.524 líneas (−2.604).
- **Verificado**: suite e2e completa **66 verdes** (60 de Ola 0 + 6 nuevos de `smoke-05-core.spec.js`: core servido e immutable, núcleo definido en window, sin directiva strict, `APP_BUILD` en HTML == `/api/app-version`, tokens claro y oscuro resolviendo). Corrida final sobre el árbol combinado con la Fase 3B de la sesión paralela (`77751ab`). Gotcha de tests: el SW recarga la página al tomar control en contexto fresco → `test.use({ serviceWorkers: 'block' })` en smoke-05.
- **Bump v227→v228** aplicado en los 3 sincronizados: `historial.html` (APP_BUILD), `proxy.js` (const fallback), `sw.js` (CACHE wwp-v59).
- CLAUDE.md actualizado (filas core.js/theme.css + convención de re-estampado). Siguiente: **Ola 2 — isla piloto `basedatos`** (iframe + postMessage token/tema/subrutas).

## Ola 2 modularización — isla piloto basedatos (v228, 22-jul-2026)
- **`basedatos.html` nuevo en la raíz**: el visor BD completo (13 vistas, `dbvShow` con guard de secuencia) vive ahí; `section-basedatos` en historial.html quedó reducida a un iframe lazy (patrón almacen-mapa: `src='/basedatos.html'` al navegar) + puente `_dbvIsla*` (~35 líneas). −44 líneas netas del monolito; el visor se edita SOLO en la isla.
- **Contrato postMessage (el patrón repetible para las próximas islas)**: isla→`dbv-ready` al cargar; shell→`dbv-view {view}` (el shell es fuente de verdad de la vista inicial — deep-link `/basedatos/<vista>` llega vía subruta pendiente, sin doble fetch); isla→`dbv-route {view}` al mostrar y el shell escribe el path real (`_routeSet`), con ecos filtrados por igualdad (`_dbvLastView`). Origen validado en ambos lados (`ev.origin === location.origin` + `ev.source === iframe.contentWindow`); fallback default a los 1500 ms si no hay puente.
- **Token**: la isla lee `wwp_auth` (session||localStorage) EN CADA fetch — patrón probado de almacen-mapa:1734; hereda los refresh del shell. El "token por postMessage" del plan original queda para un futuro cross-origin. **Tema**: `theme.css?v=` + `wwp_theme` + evento `storage` para cambio en vivo. ⚠ Editar theme.css ⇒ re-estampar `?v=` en historial.html Y basedatos.html (smoke-06 lo vigila).
- **Server**: `/basedatos` y `/basedatos/<vista>` siguen sirviendo el SHELL (login/RBAC intactos, a diferencia de `/almacen-mapa` que sirve la isla directa); `/basedatos.html` standalone también funciona con la sesión del storage. Cero cambios en proxy.js.
- **Re-entrada a la sección** (nav estando el iframe ya cargado): reset a `usuarios` — mismo comportamiento que tenía `dbViewerLoad()`.
- **Verificado**: suite completa **71 verdes** ×2 (5 nuevos en `smoke-06-isla-basedatos.spec.js`: 13 vistas + default, subvista por handshake, clic en isla → URL `/basedatos/roles`, standalone, y hash de theme.css idéntico shell/isla). En local sin PG el visor muestra el 503 "requiere PostgreSQL" — estado esperado que los tests afirman.
- CLAUDE.md actualizado (fila basedatos.html). Plan 08 marcado: Olas 0, 1 y 2 HECHAS. Siguiente: **Ola 3 — islas fáciles** (dev-cdp, formacion, politicas, impacto, empaque), una por PR, extrayendo el "núcleo mínimo de isla" de basedatos.html a un `core-isla.js` compartido cuando exista la segunda isla.

## Ola 3 modularización — core-isla.js (22-jul-2026, en curso)
- **`core-isla.js` nuevo** (~120 líneas): núcleo compartido de las ISLAS — `esc`, `fmtDate`, `islaFetch`/`_authHeaders` (Bearer desde `wwp_auth` en cada request), `islaUser()`, tema (aplica `wwp_theme` + evento `storage` para cambio en vivo), `toast` con el CSS real del shell (~3298) autoinyectado y elemento lazy, y helpers del contrato postMessage (`islaAnunciarReady`/`islaReportarRuta`/`islaOnVista` por canal). NO confundir con `core.js` (núcleo del shell).
- `basedatos.html` refactorizada para consumirlo (su "núcleo mínimo" inline se eliminó): verificado con suite completa **72 verdes** (nuevo test: todas las islas deben referenciar `core-isla.js?v=` con el MISMO hash — vigila la disciplina de re-estampado, igual que el de theme.css).
- Disciplina: editar core-isla.js ⇒ `md5 -q core-isla.js | cut -c1-8` y re-estampar en TODAS las islas (`grep 'core-isla.js?v=' *.html`).
