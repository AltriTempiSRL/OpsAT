# Plan de modularización — separar la app por páginas/módulos

> Objetivo: partir `historial.html` (39k líneas, 2,46 MB, 396 globals) en módulos por
> página/dominio, **sin build step y sin big-bang**, usando el precedente que ya funciona
> en el propio repo: `almacen-mapa.html` como página separada embebida en iframe.
> Los porqués (hallazgos C1–C12) están en `07-auditoria-escalabilidad-2026-07.md`.
> Este plan es el carril FRONTEND; corre en paralelo al cutover relacional (Fase 3
> grande, `prompt-fase3-continuar.md`) sin pisarse: uno reorganiza cómo se PINTA,
> el otro cómo se GUARDA.

## Mecanismo elegido

**Islas en iframe + un `core.js` compartido y cacheado.** Tres opciones evaluadas:

| Mecanismo | Aísla scope | Aísla CSS | Caché | Riesgo | Veredicto |
|---|---|---|---|---|---|
| iframe por módulo (como `almacen-mapa.html`) | ✅ real | ✅ | ✅ por archivo | bajo (precedente vivo) | **Elegido para islas** |
| `<script src>` + IIFE/namespace | ❌ (comparte global salvo IIFE) | ❌ | ✅ | bajo | Puente para módulos que hablan mucho con tasks |
| ES modules `import()` | ✅ | ❌ | ✅ | alto (convertir 1.800 fns; verificar terminales Zebra) | Meta de largo plazo, no ahora |

Reglas del mecanismo:
- Cada isla es un `<archivo>.html` propio servido por proxy.js, cargado en el iframe de su
  `page-section` **solo al navegar** (lazy, patrón existente del mapa: `iframe.src` on-demand).
- `core.js` compartido (cacheable `?v=hash` como lucide/xlsx): `authFetch`+refresh, `esc`,
  `toast`, tema (lee `wwp_theme` de localStorage — misma clave, mismo origen), y un
  mini-contrato `postMessage` con el shell (navegación, token, badge counts).
- El token viaja al iframe por `postMessage` desde el shell (nunca por URL).
- El CSS de la isla viaja CON la isla; las variables de tema (`--*`) se extraen a
  `theme.css` compartido para que shell e islas pinten igual en claro/oscuro.
- El router del shell (paths reales v227) no cambia: navegar a `/basedatos` muestra la
  sección cuyo contenido es el iframe. Subrutas se reenvían por `postMessage`.

## Núcleo compartido (dependencia de TODOS los módulos)

Auth+red (`authFetch`/`authFetchRetry`/`fetchWithTimeout`, refresh 401), RBAC (`can`,
`canSection`, `sectionPerms`), router (`showSection`/`switchTab`/`_routeSet`), helpers
(`esc`, `toast`, `uiSetVisible`, lucide), notificaciones+realtime (SSE/WS/push, panel),
tema, estado de sesión (`_user`, `_token`, `_tasks`, `_roleDefs`). Rangos actuales aprox:
8716–11400, 21005–21290, 25865–27990, 5566–5591.

**El primer entregable del plan es extraer esto a `core.js` versionado** — sin él, cada
isla duplicaría auth/tema/escape.

## Mapa de módulos (medido 22-jul-2026; líneas aproximadas, el archivo está vivo)

### Secciones Despachos

| Módulo | HTML (id / líneas) | JS clave | Acoplamiento | Extracción |
|---|---|---|---|---|
| almacen-mapa | iframe :6217 | (ya externa) | postMessage | **HECHA** (precedente) |
| basedatos | `section-basedatos` :6489 | `dbViewerLoad`/`dbvShow` :25909+ (2 fns) | solo core | **piloto Ola 2 cumplido → visor RETIRADO** (pedido Gabriel: las `t_*` de Fase 3B se consultan por SQL directo; `5275c3a`) |
| dev-cdp | :6310 | `loadDevCdpReport`+3 :25960+ | solo core | **HECHA** (Ola 3 → `dev-cdp.html`) |
| estado-ordenes | :7253 | `eo*` (80 fns) 35479–37534 | core + cache `_eoMetrics` + Odoo | MEDIA (cohesivo pero entrelazado con sdv — separar regiones primero) |
| buscar | :5807 | `buscar*` 24072–25214 | core + drawer de tasks | MEDIA |
| solicitudes | :6151 | `sol*` 22137–23341 | core | MEDIA |
| reposicion + solicitudes-reposicion | :6056 / :5951 | `rep*` 29854–31074, `_rs*` | comparten estado `_rs*` → extraer JUNTAS | MEDIA |
| averias | :5850 | `av*` ~9014+ | core + fotos + GPS | MEDIA |
| sin-adjuntos | :6222 | `_sinAdj*` | core + tasks | MEDIA |
| inventario | :6505 | `inv*`/`invd*` (45 fns) 26185–27673 + `ca*` casos | 3 subsistemas (panorama/salud/casos) | MEDIA-DIFÍCIL |
| despacho-obsoleto | :6589 | `_do*` | core + fotos + Odoo | MEDIA-DIFÍCIL |
| sdv-portal + sdv-bandeja + sdv-reactivations | :6768/:7211/:7238 | `sdv*` (133 fns) 33596–38499 | ~40 globals `_sdv*` compartidos entre las 3 + tasks + GMap + Odoo → extraer como UNA unidad | DIFÍCIL (al final) |

### Pestañas WWP (Workforce)

| Tab | HTML | JS clave | Acoplamiento | Extracción |
|---|---|---|---|---|
| formacion | :8187 | `tr*` (18 fns) 11431–11740 | solo core | **HECHA** (Ola 3 → `formacion.html`, badge por postMessage) |
| politicas | :8032 | `pol*` (13 fns) 31182–31622 | solo core | **HECHA** (Ola 3 → `politicas.html`, on/off de timers por postMessage) |
| impacto | :8050 | `imp*` :20693+ | solo core | **HECHA** (Ola 3 → `impacto.html`, incluye `eqp*`) |
| empaque | :8112 | `emp*` (25 fns) 32235–32855 | core + fotos | **HECHA** (Ola 3 → `empaque.html`, 1ª isla con upload de fotos; el subsistema del drawer + lightbox compartido + `apiFetch` QUEDAN en el shell) |
| dashboard | :7735 | `loadDashboard`, charts :13413 | core + chart.min.js | MEDIA |
| users | :7825 | `loadUsers`, `showUserRoute` :20951 | core + roles + GMap | MEDIA |
| vehiculos | :7842 | `veh*` + gate `_vehGate` en `switchTab` | gate acoplado al router de tabs | MEDIA |
| archivo | :8168 | `loadPhotoArchive` :12167 | lee `_tasks` | MEDIA |
| tasks | :7644 | drawer :14139+, lifecycle, filtros | **el corazón: lo referencian buscar, archivo, sin-adjuntos, sdv y el realtime** | DIFÍCIL (último) |

## Orden de ejecución (olas)

**Ola 0 — red de seguridad (prerrequisito duro).** Playwright sobre la app servida (sin
build): login, smoke de cada sección (navega + no hay error de consola + render básico),
y los flujos críticos de tasks/SDV. Hoy hay CERO tests de frontend (hallazgo C6) — sin
esto, toda extracción es a ciegas.
→ **HECHA la base (22-jul-2026):** suite en `tests/e2e/` (autocontenida, no toca el
package.json raíz), 60 tests verdes en ~22s: contratos HTTP del server (health,
redirects, fallback SPA de los 20 paths, no-store, denylist), login por UI, deep-link
de las 15 secciones + 9 tabs WWP con guardia de consola (pageerror = fallo; solo se
permite ruido ambiental 502/503 de Odoo/PG ausentes en local). Correr:
`cd tests/e2e && npx playwright test` (o `npm run test:e2e` desde la raíz).
**Pendiente de Ola 0:** los flujos críticos tasks/SDV reales — esqueletos `fixme` en
`tests/e2e/flujos-criticos.spec.js` esperando que el equipo defina los 3–5 flujos.

**Ola 1 — `core.js` + `theme.css`.** Extraer el núcleo compartido a archivos versionados
(`?v=hash`). El shell los carga con `<script src>`; el monolito sigue funcionando igual
(las funciones pasan de inline a archivo — mismo scope global, cero riesgo de semántica).
Beneficio inmediato: 2 sesiones pueden editar core y módulos sin colisionar, y el
navegador cachea el núcleo.
→ **HECHA (22-jul-2026, build v228):** `core.js` (2.509 líneas — auth+red con el patch
de fetch, RBAC `can`/`canSection`, sesión `doLogin`/`checkStoredSession`, notificaciones
+ SSE/WS, y utilities `esc`/autofill/`showErr`/`togglePw`/`fmtDate`/`toast`; ex líneas
8826–11242 + 21001–21073) y `theme.css` (design tokens `--*` claro + `[data-theme=dark]`;
ex 34–151), ambos con `?v=<hash md5-8>` (immutable 1 año). Decisiones clave: (1) el tag
`<script src="/core.js">` vive en la POSICIÓN exacta del código original — mismo orden de
ejecución; no moverlo ni hacerlo defer/async; (2) `APP_BUILD` se quedó en el HTML a
propósito (`getHtmlBuild` de proxy.js lo parsea con regex del archivo); (3) sin
`'use strict'` en core.js (los globals implícitos `_token`/`_user`/`_tasks` requieren
sloppy mode); (4) el bloque iOS-PWA + APP_BUILD (8716–8825) quedó inline como preámbulo.
Contrato protegido por `tests/e2e/smoke-05-core.spec.js` (6 tests); suite completa 66
verdes. Disciplina al editar core/theme: re-estampar su `?v=` en historial.html.
El monolito bajó de 39.128 a 36.524 líneas.

**Ola 2 — piloto isla: `basedatos`.** 2 funciones, solo-lectura, admin-only, cero estado
compartido: el módulo perfecto para validar el mecanismo iframe + postMessage (token,
tema, subrutas `/basedatos/<vista>`). Éxito = patrón documentado y repetible.
→ **HECHA (22-jul-2026, mismo build v228):** isla `basedatos.html` en la raíz; la sección
del shell quedó en iframe lazy (patrón almacen-mapa: `src` al navegar) + puente
`_dbvIsla*` de ~35 líneas. **El patrón repetible quedó así:**
- *Subrutas*: handshake `dbv-ready` (isla→shell al cargar) → `dbv-view` (shell→isla; el
  shell es la fuente de verdad de la vista inicial — elimina el doble-fetch en
  deep-links) → `dbv-route` (isla→shell al mostrar; el shell escribe el path real con
  `_routeSet`, filtrando ecos por igualdad con `_dbvLastView`). Origen validado en ambos
  lados; fallback a default si el puente no contesta en 1500 ms.
- *Token*: la isla lee `wwp_auth` (sessionStorage||localStorage) EN CADA fetch — patrón
  ya probado de almacen-mapa; hereda los refresh del shell sin contrato extra. (El
  postMessage de token del plan original solo hará falta si las islas cambian de origen.)
- *Tema*: `theme.css?v=` compartido + `wwp_theme` aplicado al cargar + evento `storage`
  para cambio en vivo. ⚠ Disciplina: editar theme.css ⇒ re-estampar `?v=` en el shell Y
  en cada isla (test `smoke-06` lo vigila).
- *Deep-link server-side*: `/basedatos` sigue sirviendo el SHELL (login/RBAC intactos) —
  a diferencia de `/almacen-mapa` que sirve la isla standalone; `/basedatos.html`
  standalone también funciona (lee la sesión del storage).
Verificado: suite 71 verdes (5 nuevos en `tests/e2e/smoke-06-isla-basedatos.spec.js`).
El monolito ya no contiene el visor: −44 líneas netas más.
→ **Epílogo (mismo día, `5275c3a`):** el visor Base de datos se ELIMINÓ de la app a
pedido de Gabriel — las tablas `t_*` del cutover Fase 3B se consultan por SQL directo.
La isla y su spec (smoke-06) se retiraron; el piloto ya había cumplido su propósito:
validar el patrón iframe+postMessage que heredaron las islas de Ola 3.

**Ola 3 — islas fáciles.** dev-cdp, formacion, politicas, impacto, empaque. Una por PR,
verificada con la suite de Ola 0.
→ **HECHA 5 de 5 (22-jul-2026, noche):** islas `dev-cdp.html`, `formacion.html`,
`politicas.html`, `impacto.html` (esta última incluye el subsistema `eqp*` de equipo)
y `empaque.html` (la última en salir — ver partición abajo).
Novedades del patrón al pasar de 1 isla a 4:
- **`core-isla.js` versionado** (`?v=<hash md5-8>`, cargado por las 5 islas): `esc`,
  `islaFetch`/`_authHeaders` (Bearer desde `wwp_auth` en cada request), `islaUser`,
  tema + evento `storage`, `toast` idéntico al del shell, y helpers del contrato:
  `islaAnunciarReady`/`islaOnVista`/`islaReportarRuta` + `islaBadge` (badge del tab en
  el shell, p.ej. cursos pendientes de formacion) + `islaPedirTarea` (la isla PIDE crear
  tarea; el wizard vive en el shell y no se duplica). Disciplina: editarlo ⇒ re-estampar
  su `?v=` en TODAS las islas.
- **Canal on/off** (politicas): el shell avisa `politicas-view on|off` al entrar/salir
  del tab para que la isla reanude/pare sus timers de refresco — reemplaza el
  `polStopRefresh()` que el shell llamaba en `switchTab`.
- **Aprendizajes que ahora son checklist de extracción** (los tres mordieron):
  (1) el barrido de llamadas cruzadas debe incluir `core.js`, no solo historial.html —
  un `polStopRefresh` residual en `switchTab` tumbaba el boot de TODOS los deep-links
  `/wwp/*` (el catch de auth borraba la sesión); (2) ojo con helpers compartidos al
  filo del cluster: el corte de impacto se llevó `apiFetch`, que empaque (aún en el
  shell) usa — hubo que devolverlo; (3) los duplicados históricos (`escH` ≡ `esc`) y
  los bloques MOCK pueden vivir lejos del cluster (`POL_USE_MOCK` estaba 400 líneas
  antes) — grep por TODOS los identificadores del módulo, no por prefijo.
- **empaque — partición tab/drawer**: la isla se lleva el TAB (catálogo, reglas por
  familia, editor con upload de foto, picker, copia propia del lightbox); en el shell
  QUEDAN el subsistema del drawer de tareas (`empEnrichTaskItems`…`empConfirmItem` —
  el drawer es de Ola 5), el lightbox compartido, el CSS `task-emp-*` y `apiFetch`.
  La invalidación de `_empResolveCache` al entrar al tab (semántica de `empInit`)
  vive ahora en el hook de activación del shell; isla y shell tienen caches de
  resolve INDEPENDIENTES por diseño. `modalBackOpen/Closed` (atrás-cierra-modal PWA)
  son stubs no-op en la isla — integración de history del shell, no aplica en iframe.
Verificado: suite 80 verdes (smoke-07-islas-ola3 cubre deep-link embebido, standalone
con sesión del storage, y el badge por postMessage). Hashes coherentes: `core-isla.js`
y `theme.css` con el mismo `?v=` en shell + 5 islas.

**Ola 4 — separar regiones entrelazadas.** Reordenar los clusters `eo*` vs `sdv*` en
bloques contiguos (solo mover texto, sin cambiar lógica, con la suite verde) y extraer
estado-ordenes. Después buscar, solicitudes, reposicion(+solicitudes-reposicion),
averias, sin-adjuntos, dashboard, users, vehiculos, archivo.

**Ola 5 — los pesados.** inventario (3 subsistemas), despacho-obsoleto, la trilogía SDV
como una unidad, y al final tasks/drawer (para entonces el core tendrá la API postMessage
madura y el resto de módulos ya no vivirán en el mismo scope).

**Regla de oro heredada del incidente de la poda:** en `historial.html` NUNCA borrar por
rango "hasta la próxima function" — las funciones están intercaladas con `var`/arrays
vivos. Extraer = copiar a la isla + verificar + recién entonces borrar del monolito, con
la suite de Ola 0 verde antes y después de cada paso.

## Qué gana el proyecto en cada ola

- Ola 1: fin de las colisiones entre sesiones en el 80% de los edits; caché del núcleo.
- Ola 2–3: cada isla nueva deja de pagar los 2,46 MB (`no-store`) — carga solo su HTML
  chico + core cacheado; CSS y scope aislados (adiós hallazgos C2/C4/C9 por módulo).
- Ola 4–5: el monolito queda reducido a shell (nav+auth+router) + tasks, y cada dominio
  tiene dueño, archivo y ciclo de deploy conceptual propio.

## Relación con el cutover relacional (Fase 3 grande)

Independientes y complementarios: la modularización toca el CLIENTE (cómo se pinta), el
cutover toca el STORAGE (tablas tipadas detrás de `loadJson`/`saveJson`). Se pueden
intercalar por dominio: p.ej. al extraer la isla `inventario`, es buen momento para
cutover de `wwp-inventario-casos`. Ninguno bloquea al otro.
