# Auditoría de escalabilidad — 2026-07-22

> Segunda pasada de auditoría (la primera vive en `00`–`06`). Foco: **todo lo que está mal
> o no escala HOY**, medido sobre el árbol actual (proxy.js 20.663 líneas / historial.html
> ~39.100 líneas / build v227 en working tree) y sobre los **datos reales de producción**
> (PostgreSQL vía psql, 22-jul-2026). Lo ya resuelto de la auditoría 1 (silentCatch,
> handlers de proceso, I/O sync, media→R2) no se repite acá.
>
> El plan de acción derivado de esta auditoría está en `08-plan-modularizacion.md`
> (frontend) y en la Fase 3 del plan de modernización (backend/datos).

## Resumen ejecutivo

El sistema **funciona y es resiliente**, pero tiene un techo duro de crecimiento con tres
raíces: (1) **la RAM del proceso es la fuente de verdad** — Postgres es un espejo diferido,
no un store compartido — lo que hace imposible correr más de una instancia; (2) **cada
escritura re-serializa la colección completa** para diffear (CPU síncrona en el event
loop, O(n) por save y hasta O(n²) con reordenamientos); (3) **dos monolitos** — un handler
HTTP de 12.804 líneas con 251 ramas de ruteo, y una SPA de 2,46 MB con 396 globals y
~1.800 funciones en un solo scope — hacen que cada cambio tenga radio de impacto total y
que dos sesiones de trabajo colisionen en los mismos archivos (pasa hoy, literalmente).

Además hay **datos con forma equivocada**: fotos base64 dentro del JSONB
(`wwp-inspecciones` = 27 filas / **17 MB**, el 99% en un solo campo `fotos_condicion`)
que la migración a R2 no cubrió.

---

## A. Datos (medido contra PG de producción)

| # | Sev | Hallazgo | Evidencia | Fix |
|---|-----|----------|-----------|-----|
| A1 | **ALTA** | Fotos de inspección en base64 dentro del JSONB: `wwp-inspecciones` pesa **17 MB con 27 filas** (~650 KB/fila); `fotos_condicion` concentra 17 MB, `items` 49 kB. Cada boot lo carga entero a RAM (×2 con el rowSnap), cada save lo re-serializa. | `SELECT pg_column_size` por campo, 22-jul | Migrar `fotos_condicion` (y `firmaConductor`) a R2 como se hizo con el resto de media (Fase 1); dejar en el JSONB solo las keys/URLs |
| A2 | MEDIA | Mismo patrón en chico: `averias.image` = 199 kB de los 204 kB de la colección; `wwp-solicitudes-showroom.imageBase64` = ~123 kB. Crecen con cada alta. | idem | idem A1 |
| A3 | MEDIA | Colecciones append-only sin política de retención visible: `wwp-notifications` (2.000 filas), `wwp-audit` (1.688), `wwp-sessions` (68). Si 2.000 es un cap, verificarlo; audit no lo tiene. | conteo por colección | Cap/archivado por edad (mover a tabla histórica o export) |
| A4 | BAJA | El proxy TCP público de Railway PG corta conexiones intermitentemente (3 cortes en ~20 conexiones durante esta auditoría). Afecta solo tooling externo (psql), no a la app (usa la URL interna). | sesión psql 22-jul | Reintentos en scripts de tooling; nada que hacer en la app |

## B. Backend (proxy.js / storage-pg.js)

| # | Sev | Hallazgo | Evidencia | Fix |
|---|-----|----------|-----------|-----|
| B1 | **ALTA** | `queueWrite` (cola anti-race) está **definida y jamás invocada** — 1 sola mención en todo el archivo: su definición. No hay serialización efectiva de escrituras. | `proxy.js:4712`; `grep -c queueWrite` = 1 | Cablearla en los saves de colecciones mutadas concurrentemente (arreglo de una tarde, impacto alto) |
| B2 | **ALTA** | Race read-modify-write: el patrón `loadX() → mutar referencia viva → await odooCall() → saveX()` deja ventana de lost-update entre requests (Node es monohilo pero el `await` abre la ventana). | patrón en `:656-657`, ≥40 `await odooCall` entre `:940-2927`; `loadCollection` devuelve la referencia viva (`storage-pg.js:145-148`) | `queueWrite` por colección (B1) o copy+compare-and-swap |
| B3 | **ALTA** | Cada save diffea re-serializando la colección entera: `_diffArray` hace `JSON.stringify(item)` por fila en cada guardado aunque cambie 1 sola; anti-ancla anidado → hasta O(n²). CPU síncrona en el event loop. | `storage-pg.js:84-123` | Dirty-flags por id al mutar; diff incremental |
| B4 | **ALTA** | Toda colección vive completa en RAM **duplicada** (objeto vivo + string serializado en `rowSnap`). El boot hace full-scan de `collection_rows` sin límite. | `storage-pg.js:373-393`, `:385` | No precargar colecciones de consulta; paginar las append-only |
| B5 | **ALTA** | Multi-instancia imposible: la DB solo se lee en boot; un write en la instancia A jamás lo ve B. SSE/WS (`sseClients`, `wwpWsClients`), rate-limits (`_loginAttempts`, `_ipRateMap`) y 14 `setInterval` de jobs son per-proceso. | `storage-pg.js:145`, `proxy.js:4814-4815`, `:4607/:4653`, 14 × `setInterval` | Decisión explícita: si se quiere escalar horizontal, DB como fuente de verdad + pub/sub externo + jobs con líder único. Si no, documentar "single-instance by design" |
| B6 | **ALTA** | Un handler HTTP de **12.804 líneas** (`createServer` `:7673`→`:20477`) con 251 puntos de dispatch (141 `===`, 92 `.match`, 18 `.startsWith`) sin router. | medido | Router método+path → handler; módulos de dominio (ver plan 08) |
| B7 | MEDIA | Guard de auth copiado ~230 veces (`requireJwt`) + doble sistema `requireRole`(60)/`requireSectionPerm`(18). Olvidar el guard en una rama nueva = endpoint abierto (así nacieron las fugas R-05/R-06B). | `grep -c` | Tabla de rutas declarativa `{auth, perm}` aplicada por el router |
| B8 | MEDIA | 746 `Content-Type` inline (creció desde 715), 761 `writeHead`, mientras `sendJson`(69)/`sendGzipJson`(34) existen y casi no se usan. Cambios transversales (headers de seguridad, cache) hay que replicarlos cientos de veces. | `grep -c` | Toda respuesta por helper; prohibir `writeHead` crudo en review |
| B9 | MEDIA | WebSocket artesanal sin auth en el upgrade (valida solo el path); no verifica JWT ni Origin. Atenuante: solo viajan pings de versión, el re-fetch va por REST con RBAC. | `proxy.js:20479-20525` | Token en query del upgrade o primer frame; considerar lib `ws` |
| B10 | MEDIA | Triple espejo manual server↔cliente↔SW: `NOTIF_META` en 3 archivos (proxy `:5501`, historial `:9794`, sw `:90`) y `APP_BUILD`/`CACHE` con **dos esquemas de numeración** (v227 / wwp-v58). Un olvido = notificaciones rotas o caché vieja. | comentarios "mantener en sincronía" | Servir la config desde un endpoint único; build inyectado |
| B11 | MEDIA | Odoo: patrón `Promise.race` timeout copiado 14 veces (creció desde 8); sin circuit-breaker central. | `grep -c Promise.race` = 14 | Timeout+retry+breaker DENTRO de `odooCall`, borrar los sueltos |
| B12 | MEDIA | 14 jobs `setInterval` dentro del proceso web (snapshots, reconcile, watchdogs, geo-stale…): en multi-instancia se dispararían N veces; uno pesado bloquea requests. | `:240,:266,:4143,:4921,:6202,:6257,:6625,:7394,:7478…` | Extraer a worker con lock de líder (cuando aplique B5) |
| B13 | MEDIA | `wwpStateVersion = Date.now()` per-proceso: en redeploy la versión "retrocede"; entre instancias sería incoherente. | `proxy.js:4816` | Versión monotónica persistida |
| B14 | BAJA | Vistas SQL leen con seq-scan + extracción JSONB sin índices funcionales (aceptable hoy: admin-only, baja frecuencia). | `storage-pg.js:537+`, índice único `(collection, ord)` | Índices por expresión si el visor crece |
| B15 | BAJA | Semillas de contraseña conocidas en el código (`WWP2026!`/`Admin2026!`, 15 usuarios). Atenuado por `mustChangePassword`. Decisión abierta R-08. | `proxy.js:4736-4744` | Semillas aleatorias entregadas fuera de banda |
| B16 | BAJA | 422 `catch` con manejo heterogéneo (console.* con prefijos ad-hoc, niveles a criterio); sin request-id para correlacionar. | `grep -c` | Logger central con niveles |

## C. Frontend (historial.html — 39.114 líneas / 2,46 MB medidos)

| # | Sev | Hallazgo | Evidencia | Fix |
|---|-----|----------|-----------|-----|
| C1 | **CRÍTICA** | Un archivo concentra TODO: ~29.800 líneas JS (76%) + ~5.760 CSS + ~3.530 HTML. Sin framework, sin build, sin módulos. Dos sesiones editándolo colisionan (pasa hoy). El navegador re-descarga 2,46 MB por visita (`Cache-Control: no-store`, línea 5). | `wc`; bloques `<script>` 8716–21288, 21290–33067, 33091–33552, 33554–38529 | Separar por módulos — plan completo en `08-plan-modularizacion.md` |
| C2 | **CRÍTICA** | **396 variables globales** en un único scope + ~1.800 funciones globales (1.243 declaradas + 562 arrow asignadas). La disciplina de prefijos (`_sdv*`, `_eo*`) mitiga pero no aísla: cualquier función puede pisar el estado de cualquier módulo. | `grep -oE` col-0, dedup | Namespace/IIFE por módulo (paso 2 del plan 08) |
| C3 | ALTA | 4.362 `var` vs 60 `let`/1.419 `const`: arranque dependiente del orden textual (hoisting); `enterApp` se usa en 6 puntos antes de definirse. Reordenar bloques puede romper el boot — esto ya casi borra código vivo en la poda de julio. | `grep -c` | Grafo de arranque explícito (un `init()`); migrar por módulo al extraer |
| C4 | ALTA | 772 `onclick` inline (960 `on*=` totales) vs 85 `addEventListener`: obliga a que todo sea global (refuerza C2), impide CSP sin `unsafe-inline`. | `grep -c` | Delegación por `data-action` al extraer cada módulo |
| C5 | ALTA | Render por strings + `innerHTML` en 585 puntos. `esc()` se usa bien (1.084 veces) PERO hay ~17 interpolaciones de datos de servidor sin escapar en la misma línea (`t.icon` :11346, `attach.dataUrl` :15726 — subido por usuario, vector real) y 39 template-literals a innerHTML. `esc()` no cubre `href/src` (`javascript:`). | grep de patrones | Auditar los ~56 casos; helper de atributos seguros |
| C6 | ALTA | **Cero tests de frontend** — `tests/` solo cubre contratos backend. 29k líneas de UI sin red de seguridad: cualquier refactor es a ciegas. | inspección `tests/` | Playwright sobre la app servida ANTES de extraer módulos (paso 0 del plan) |
| C7 | MEDIA | Boilerplate repetido: spinner ×31, "Cargando" ×55, fila-error ×21, patrón `try{authFetch→json→if(!ok)pinta→catch pinta}` en decenas de loaders. | `grep -c` | Helper `renderAsync(host, fetcher, renderFn)` |
| C8 | MEDIA | 3.248 `style="` inline en HTML generado por JS: cero reutilización, rediseñar = tocar JS. | `grep -c` | Clases CSS al extraer cada módulo |
| C9 | MEDIA | CSS: 107 `!important`, 279 selectores por id, 81 `z-index` sin escala documentada → guerras de especificidad y bugs de solapamiento. CSS de módulos (`.rs-`, `.ca-`, `.eo2-`) mezclado en el bloque global. | `grep -c` en bloque 33–5565 | Escala `--z-*` en variables; co-localizar CSS por módulo |
| C10 | MEDIA | Clusters `eo*` (80 fns, estado-ordenes) y `sdv*` (133 fns) **entrelazados en el mismo bloque físico** (33554–38529): no se pueden extraer por corte limpio. | rangos medidos | Desenredar en regiones antes de extraer |
| C11 | MEDIA | ~10 cachés client-side ad-hoc (`_odooPhotoCache`, `_eoMetrics`, `_wwpDpoCache`…) cada una con su TTL; sin invalidación común → datos rancios y memoria en sesiones largas de terminal. | grep de nombres | Helper `cache(key, ttl, fetcher)` |
| C12 | BAJA | Observabilidad casi nula en campo: 20 `console.*` en 29k líneas de JS. | `grep -c` | Logger activable por query param |

## Prioridad práctica (qué haría primero)

1. **B1 — cablear `queueWrite`** (una tarde; cierra B2, la ventana de corrupción real).
2. **A1 — migrar `fotos_condicion` a R2** (patrón ya existente de Fase 1; -17 MB de RAM/boot/saves).
3. **C6 — Playwright mínimo** (login + smoke por sección): prerrequisito de TODO el plan 08.
4. **B3 — dirty-flags en `_diffArray`** (el costo por escritura deja de crecer con el tamaño).
5. **Decisión explícita sobre B5**: ¿OpsAT será multi-instancia alguna vez? Si NO (razonable para
   un equipo de este tamaño), documentarlo y B5/B12/B13 bajan a "by design"; si SÍ, son el
   prerrequisito de todo lo demás.
6. **Plan 08** (modularización frontend) en paralelo, isla por isla.
