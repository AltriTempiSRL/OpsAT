# Dashboard Despachos — Guía del proyecto

## NORTE del producto (declaración del dueño, 23-jul-2026)

OpsAT es **un software modular, multiusuario, para administrar la empresa en
múltiples departamentos**. Regla dura que se deriva de eso y gobierna todo cambio:

- **El sistema crece hacia AFUERA en módulos, nunca hacia adentro en el monolito.**
  Cada departamento/función nuevo entra como **isla** (`<nombre>.html` en iframe +
  su dominio en el backend + sus permisos de sección + sus tests), jamás como
  código nuevo dentro de `historial.html` o del dispatcher en cascada de `proxy.js`.
- **`historial.html` y `proxy.js` solo pueden ENCOGER.** Toda ruta/función nueva
  nace en módulo propio (islas frontend, tabla de rutas por dominio en backend).
- **RBAC = columna vertebral, no detalle.** Multi-departamento significa que cada
  usuario ve/edita solo lo suyo, con auditoría. No debilitar `ROLE_PERMISSIONS` ni
  `sectionPerms` al agregar módulos.
- Plan maestro y ejecución: `docs/auditoria-arquitectura/10-plan-maestro-*` (rumbo)
  y `10-plan-fases-*` (tareas). Auditoría base: `09-auditoria-integral-*` (132
  hallazgos). **Deploy solo vía `node scripts/deploy.mjs`** (árbol limpio + suite
  verde + tag); espejos con `node scripts/stamp.mjs`. **Single-instance por diseño**
  (advisory lock en storage-pg.js). Runbook de incidentes: `RUNBOOK.md`.

## Fuente de verdad: carpeta raíz

Todos los archivos editables están en la **carpeta raíz** del proyecto (el repo git):
`C:\Users\Gabriel Ramirez\OneDrive\Documentos\GitHub\OpsAT\`

> ⚠️ **La carpeta vieja `C:\Users\Gabriel Ramirez\OneDrive\Documentos\Claude\Artifacts\dashboard-despachos-live\` está CONGELADA** (quedó en v218) y **ya NO es la fuente de verdad**: no editar, no correr ni deployar desde ahí. Todo (editar, correr `restart.bat`, deploy con `railway`) sucede en el repo `GitHub\OpsAT`, que es a donde apunta el link de Railway (proyecto OpsAT / production / dashboard-despachos).

| Archivo | Descripción |
|---------|-------------|
| `historial.html` | App principal (historial + WWP embebido) |
| `core.js` | Núcleo compartido del shell (auth+red, RBAC, sesión, notif+SSE/WS, esc/toast) — extraído del monolito (Ola 1, plan 08). Su `<script src>` vive en la posición exacta del código original: NO moverlo ni hacerlo defer. SIN `'use strict'` (globals implícitos) |
| `theme.css` | Design tokens `--*` (claro + `[data-theme=dark]`) compartidos shell + islas (Ola 1) |
| `index.html` | Dashboard de despachos |
| `proxy.js` | Servidor Node.js (API + archivos estáticos) |
| `lucide.min.js` | Librería de íconos (LOCAL, no CDN) |
| `chart.min.js` / `xlsx.min.js` / `three.min.js` + `OrbitControls.js` | Gráficos, export Excel, mapa 3D del almacén (LOCAL, no CDN) |
| `almacen-mapa.html` | Mapa 3D del almacén (canvas 2.5D + Three.js) |
| _(visor "Base de datos": ELIMINADO jul-2026 — las tablas reales `t_*` del cutover Fase 3B se consultan por SQL directo)_ | |
| `core-isla.js` | Núcleo compartido de las ISLAS (esc, islaFetch/Bearer, islaUser, tema, toast, helpers postMessage). Al editarlo: re-estampar su `?v=` en TODAS las islas |
| `MEMORIA-PROYECTO.md` | Historial de features y decisiones (leer para contexto completo) |

## Carpetas de organización (reorg 2026-07-08)

- `tests/` — harnesses de test/QA activos y reutilizables (`_stress360.mjs`, `_gateodoo.mjs`, `_test_v1xx.mjs`, `test-smoke.js`, etc.). Se invocan **siempre desde la raíz del proyecto** (ej. `node tests/_gateodoo.mjs`), nunca con `cd tests` primero — los scripts usan `process.cwd()` para ubicar `_fakecert.pem`/`_fakekey.pem`, que se quedaron intencionalmente en la raíz.
- `scripts/` — herramientas de deploy (`import-railway-env.ps1`, `sync-render-to-railway.ps1`), documentadas en `RAILWAY.md`.
- `_archivo/` — todo lo que ya NO está en uso activo, organizado por tema (documentos históricos de planes/propuestas ya ejecutados, mockups ya portados a producción, PDFs de referencia, assets huérfanos, datos JSON huérfanos, scripts de Ron ya ejecutados, versiones originales del artifact pre-servidor Node, manuales sin uso confirmado, fotos sueltas vacías, e incidente cerrado 25-jun). Ver `_archivo/README.md` para el detalle de cada subcarpeta. No se borró nada de valor — todo quedó identificado y movido, no eliminado (salvo basura confirmada: un archivo con nombre corrupto ajeno al proyecto y carpetas vacías de integraciones no usadas).
- `leaflet.js`/`leaflet.css` se archivaron en `_archivo/assets-huerfanos/` — el mapa de ubicaciones usa **Google Maps** (`historial.html`, función `_ensureGoogleMaps`), no Leaflet. Esta nota estaba desactualizada.

## Archivos que NO se editan

- `.claude/worktrees/` — worktrees anteriores, ignorar
- `wwp.html` — YA NO EXISTE en la raíz (archivado en `_archivo/versions-artifact-original/`, poda 1/2 jul-2026). La ruta `/wwp.html` responde 302 → `historial.html` desde `proxy.js`. Toda la lógica de Workforce Platform vive en `historial.html`: si algo hay que arreglar o agregar en WWP, el archivo correcto es SIEMPRE `historial.html`.

## Servidor

- Correr siempre: doble clic en `restart.bat`
- URL local: `http://localhost:3000`
- **URL producción (Railway): `https://opsat.up.railway.app`** ⚠️ ACTUAL desde jun 2026
  - Render (`dashboard-despachos.onrender.com`) fue la producción anterior — ya NO aplicar cambios ahí.
- Entrada principal: `/historial.html` (la raíz `/` redirige automáticamente)
- El servidor sirve desde **la raíz** (no desde ningún worktree)
- Datos persistentes: disco montado vía env var `DATA_DIR`
- Datos en local: carpeta `data-local/` (se pasa `DATA_DIR=...data-local` al correr)
- **Deploy a Railway**: vía CLI desde la raíz del proyecto (NO desde GitHub):
  `railway up --service dashboard-despachos --detach` (ver `RAILWAY.md`; CLI en `C:\Users\Gabriel Ramirez\AppData\Roaming\npm\railway.cmd`).
  GitHub (`dev`→`master`→push) es respaldo del código, NO dispara deploys. ⚠️ Commitear SIEMPRE antes de deployar para que el repo no quede detrás de producción.
  Verificar tras deploy: `/api/health` y `/historial.html` en la URL de Railway.

## Convenciones de código

- **`core.js` / `theme.css` versionados**: historial.html los referencia con `?v=<hash md5-8>` (caché immutable 1 año). Al editar cualquiera de los dos, re-estampar su hash en historial.html (`md5 -q core.js | cut -c1-8` en Mac; `certutil -hashfile core.js MD5` en Windows) — y el deploy bumpea `APP_BUILD` como siempre. La suite `tests/e2e` (smoke-05) verifica el contrato.
- **Lucide icons**: `<script src="/lucide.min.js"></script>` — nunca CDN
- Después de inyectar `data-lucide` via innerHTML: `if(window.lucide) lucide.createIcons();`
- **Colores**: variables CSS semánticas (`--green-bg`, `--amber-text`, etc.), nunca hex hardcodeados
- **Tema**: clave localStorage `wwp_theme`, atributo `data-theme` en `<html>`

## Agentes — cerebro canónico fuera del proyecto

Los agentes (Mark, Pit, Ron, David, QA-WWP, Alpha) **no guardan conocimiento en este proyecto**.
Su cerebro único, compartido entre Claude y Codex, vive en:

```
C:\Users\Gabriel Ramirez\OneDrive\Documentos\Agentes-Estandar\
```

Antes de actuar como un agente, leer su expediente `<agente>.md` + `_NUCLEO-CARACTER.md` +
`_PERFIL-GABRIEL.md` y su sección **"No repetir"**. Al terminar, escribir los aprendizajes de
vuelta ahí, nunca en el proyecto. Ver `Agentes-Estandar\README.md`. Los subagentes de Claude
(`~/.claude/agents/<agente>.md`) ya apuntan a esa carpeta.

- **Mark** — CSS/UI, QA funcional, UX, diseño visual; decisión explícita de salida a producción.
- **Pit** — gerente de operaciones (WWP en vivo, cuellos de botella, KPIs, Odoo).
- **Ron** — analista Odoo/ERP (inventario, picks, devoluciones, trazabilidad).
- **David** — administración de edificios.
- **QA-WWP** — auditor de calidad (end-to-end, RBAC, gates HTTP, TDZ).

## Codex Bridge — reuniones desde este chat

La plataforma expone endpoints seguros para que Codex pueda consultar datos vivos y hacer el análisis en este chat, sin usar créditos OpenAI API dentro de Railway.

- Requiere `CODEX_BRIDGE_TOKEN` en Railway.
- Enviar el token por `Authorization: Bearer <token>` o header `x-codex-bridge-token`.
- Endpoints:
  - `GET /api/codex/agents/context` — contexto completo para reunión: resumen, decisiones, personas, tareas, memoria.
  - `GET /api/codex/agents/tasks?overdue=true&active=true` — tareas filtrables para análisis.
  - `GET /api/codex/agents/export/tasks.csv` — CSV descargable de tareas filtradas.
- Estos endpoints no llaman IA. Codex interpreta los datos y genera respuestas, gráficos o archivos desde el chat.

> Nota: el roster y el protocolo de invocación de agentes ahora viven en el cerebro canónico
> (`C:\Users\Gabriel Ramirez\OneDrive\Documentos\Agentes-Estandar\`) y en la guía global, no duplicados aquí.

<!-- ASTRYX:START -->
Astryx v0.1.8 · 153 components
CLI: run every command as `npx astryx <cmd>` (shown below as `astryx ...`).

SETUP (once, in your app entry e.g. main.tsx) — without these, components render unstyled:
  import "@astryxdesign/core/reset.css";
  import "@astryxdesign/core/astryx.css";

WORKFLOW — discover, don't guess. Before writing UI:
1. `astryx build "<idea>"` — START HERE: returns a kit (closest [page] + [block]s + [component]s). No args = full playbook.
2. `astryx template <name> [--skeleton]` — scaffold the [page]/[block]s it named, or study their layout. Templates are reference code.
3. `astryx component <Name>` — props + examples for every component you use.

RULES:
- No <div> — components do all layout/spacing. Full page → AppShell; sidebar nav → SideNav.
- Frame first: pick the shell (AppShell / Layout+LayoutPanel) and budget regions in px BEFORE writing content (`astryx docs layout`).
- Dense data = rows (Table, List/Item) edge-to-edge — never Card-wrapped list items. Card = dashboard widgets, galleries, settings groups only.
- Status → StatusDot/Token; Badge only for counts and enumerated states, never decoration.
- Custom styling: component props first; else style/className with tokens — var(--color-*|--spacing-*|--radius-*). No raw hex/px. (No StyleX/Tailwind compiler here — don't use xstyle/utility classes.)
- Tokens for every value (`astryx docs tokens`). Brand/accent via `astryx theme` — never override --color-* in :root.
- SELF-CHECK before you finish: re-read the file and replace any raw <div>/<span> layout, imported .css/@apply, or hardcoded value (#hex, 16px) with the component or a token (var(--color-*|--spacing-*|…)). If unsure a component/prop exists, run `astryx component <Name>` / `astryx search "<thing>"`; don't hand-roll CSS.

MORE CLI:
  search "<query>"   find any component / hook / doc / template / block
  component --list   153 components by category
  template --list    page + block recipes
  docs <topic>       color, elevation, icons, illustrations, internationalization, layout, migration, motion, principles, shape, spacing, styling, theme, tokens, typography
  swizzle <Name>     eject component source for deep customization
  upgrade --apply    run after any @astryxdesign/core bump
<!-- ASTRYX:END -->
