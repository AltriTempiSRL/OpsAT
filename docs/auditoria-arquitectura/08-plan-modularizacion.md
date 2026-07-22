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
| basedatos | `section-basedatos` :6489 | `dbViewerLoad`/`dbvShow` :25909+ (2 fns) | solo core | **FÁCIL — piloto ideal** |
| dev-cdp | :6310 | `loadDevCdpReport`+3 :25960+ | solo core | FÁCIL |
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
| formacion | :8187 | `tr*` (18 fns) 11431–11740 | solo core | FÁCIL |
| politicas | :8032 | `pol*` (13 fns) 31182–31622 | solo core | FÁCIL-MEDIA |
| impacto | :8050 | `imp*` :20693+ | solo core | FÁCIL-MEDIA |
| empaque | :8112 | `emp*` (25 fns) 32235–32855 | core + fotos | FÁCIL-MEDIA |
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

**Ola 2 — piloto isla: `basedatos`.** 2 funciones, solo-lectura, admin-only, cero estado
compartido: el módulo perfecto para validar el mecanismo iframe + postMessage (token,
tema, subrutas `/basedatos/<vista>`). Éxito = patrón documentado y repetible.

**Ola 3 — islas fáciles.** dev-cdp, formacion, politicas, impacto, empaque. Una por PR,
verificada con la suite de Ola 0.

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
