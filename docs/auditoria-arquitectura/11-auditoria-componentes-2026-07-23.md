# Auditoría de consistencia de componentes UI — OpsAT

> **Fecha:** 2026-07-23 · **Método:** 6 agentes en paralelo, uno por familia (tabs/segmented, botones, cards/paneles, inputs/formularios, badges/estados, modales/tablas), inventariando cada variante con `archivo:línea` sobre `historial.html` (~34k líneas), `core.js`, `theme.css`, `ui-isla.css` y las 6 islas.
> **Alcance:** consistencia de componentes (¿el mismo componente se ve/comporta igual en toda la app?). NO toca lógica ni colores de marca.
> **Regla cumplida:** el inventario no modificó ningún archivo.

---

## 1. Diagnóstico transversal (el mismo en las 6 familias)

**Los tokens de `theme.css` son buenos y completos** — escala tipográfica (`--fs-*`), spacing (`--sp-*`), radios (`--radius*`), colores semánticos (`--green-bg/-text/-dot`… con dark mode), foco (`--border-focus`), sombra (`--shadow`). El problema **no son los tokens**. Es que:

1. **Los componentes canónicos existen pero se aplican sin disciplina.** ~1 de cada 4 controles usa `style=` inline; conviven decenas de clases casi-idénticas por dominio (`rep-*`, `sdv-*`, `eo2-*`, `av-*`, `do-*`, `invd-*`) que reimplementan roles ya cubiertos.
2. **Hay bases referenciadas pero NO definidas.** `.btn` (342 usos) y `.btn-secondary` (76 usos) no existen globalmente — solo dentro de 2 footers de SDV. Resultado: muchos botones se renderizan como **botón nativo gris del navegador**. (`.btn-cancel` en `politicas.html:159` tampoco existe.)
3. **Divergencia shell ↔ isla.** `historial.html` carga **solo `theme.css`**; sus ~400 clases de componente viven en su `<style>` inline. Las islas cargan `theme.css` + `ui-isla.css`, que es un **subconjunto incompleto** (tiene `.btn-primary`, `.form-input`, `.modal-*`, `.badge`, `.spinner`… pero le faltan textarea, checkbox, toggle, empty/error, tablas). Además existe una capa `<style id="ledger-homologacion">` (`historial.html:33827-33910`) que re-normaliza cards/KPIs/badges **solo en el shell** → la MISMA clase (`.imp-kpi`, `.eqp-card`, `.pol-card`, `.emp-mat-card`, `.arch-group`) se ve **distinta** en shell vs isla.
4. **Faltan componentes compartidos de estado**: no hay empty-state, loading ni error canónicos — cada sección los rehace ad-hoc (≥10 clases de vacío, ~15 spinners inline, error disfrazado de loading).
5. **Duplicación de valores** para un mismo rol: **3 azules de "primario"** (`--brand-light` #062465 / `--accent` #1b3b6f / `--brand` #0f2340), **5 colores de foco**, **6 radios de card** (6/8/10/12/14/16), **14 z-index sin escala**, **~40 hex hardcodeados** que deberían ser tokens.

**Conclusión:** no hace falta un design system externo ni tokens nuevos. Hace falta **(a) definir las bases que faltan, (b) completar la capa compartida `ui-isla.css` y cargarla también en el shell, (c) migrar las variantes duplicadas a los canónicos, y (d) propagar la homologación a las islas.** Es un design system **nativo** sobre los tokens que ya existen.

---

## 2. Inventario por familia + veredicto

### 2.1 Tabs / segmented / filtros — 25 variantes, 5 roles

| Rol | Canónico | Variantes que lo duplican | Veredicto |
|---|---|---|---|
| **Tabs de sección** (subrayado, cambia pantalla) | `.nav-tab` (`historial.html:2300`) | `.sdv-tab` (color propio), `.invd-tabs`/`.wwp-tab` (botón sólido en vez de subrayado) | **Unificar** a `.nav-tab`; `.invd`/`.wwp` como modificador `--boxed` documentado |
| **Segmented control** (pista + activo elevado) | `.eqp-subtab` (`:736`, ya limpio en isla) | `.eo2-view-seg`, `.eo2-cal-dim` (casi byte-idéntico), `.sol-tab` (inline), `.notif-pref-seg`, `.view-toggle` (mapa) | **Unificar** a un `.seg`/`.seg-btn` |
| **Chips de filtro** (píldora, 1 activo) | — (crear `.chip-filter`) | `.av-filter-btn` = `.rep-filter-btn` (**idénticos**), `.sdv-bandeja-filter`, `.stype-btn`, `.invd-chip` (varían solo el color activo) | **Unificar** a `.chip-filter` + modificadores de color |
| **Chips removibles** (con ×) | — (crear `.chip-removable`) | `.filter-chip`, `.eo2-fchip` (mismo widget) | **Unificar** |
| **Vista de lista** (el caso más flagrante) | — | `.tasks-view-bar`/`.tv-btn` (botones sólidos) vs `.eo2-view-seg` (segmented iOS): **misma función, aspecto opuesto** | **Unificar** al segmented |

**Diferencias legítimas (NO unificar):** nav de chrome (`.nav-item` sidebar, `.mob-nav-btn`), inputs de selección de formulario (`.sdv-tipo-btn`, `.do-chip`), y tiles-que-filtran (`.eo2-pi`, `.eqp-kpi`) — muestran un dato, no son píldoras.

### 2.2 Botones — ~150 con estilo inline; bases sin definir

| Aspecto | Estado | Veredicto |
|---|---|---|
| **`.btn` base + `.btn-secondary`** | **No definidos** (342/76 usos → botón nativo o inline) | **Definir YA** (foundation) |
| Azul primario | 3 tokens para el mismo rol (#062465/#1b3b6f/#0f2340) | Elegir **uno** (`--accent` es el de facto) |
| Geometría del primario | padding 9/22·8/18·5/12, radio 8 vs 6, fs 14/13/12 | Unificar |
| `.btn-new` | definido **dos veces** con estilos opuestos (`:458` vs `:2385`) | Renombrar uno |
| Botones de modal (Cancelar/Guardar) | 9 footers distintos; fw 500 vs 600/700; `.btn-primary` reasignado a rojo en un footer | Unificar footer |
| `.btn-sm` radio | `6px` literal (`:3347`) | → `var(--radius)` |
| Hex hardcodeados | 36 (Excel `#217346`, gris `#6b7280`, `#f1f5f9`…) | → tokens |
| Islas | parchean `.btn-primary` inline con 3 paddings | modificador de tamaño |

**Migración total:** ~150 botones inline → clases; ~40 clases `*-btn` especializadas → primario/secundario/peligro/pequeño/ícono/link.

### 2.3 Cards / paneles — 6 radios, borde 1px vs 1.5px

- **Canónico:** `.card` (`:375` / `ui-isla.css:7`) = `--surface` + `1px solid --border` + `--radius-md` (8px). Único tokenizado y compartido.
- **Variantes legítimas:** card-KPI (regla dividida), card-lista/fila, modal-card, panel de sección.
- **A unificar:** 4 estilos de KPI card conviviendo (radios 6/8/10/12); **10px y 14px no tienen token**; 12px se escribe literal en vez de `--radius-lg`; borde 1.5px en la familia WWP (9 selectores); colisión `.rpt-card` (2 definiciones); **divergencia shell↔isla** en `.imp-kpi/.eqp-kpi/.eqp-card/.imp-emp-card/.pol-card/.emp-mat-card/.arch-group`.
- **Falta token:** no hay `--radius` para 10/14/16/20px (usados en KPIs, modales, login). Decidir: crear `--radius-xl` o migrar a `--radius-lg`.

### 2.4 Inputs / formularios — 5 colores de foco, foco ausente en muchos

- **Canónicos:** `.form-input`, `.form-select`, `.form-textarea` (en `ui-isla.css` + shell). Razonables pero **sin disciplina**.
- **A unificar:** **foco caótico** — `--border-focus` (12), `--accent` (14), `--text-secondary` (5), `--brand-primary` (2), hex `#0369a1` (1), y **muchos campos sin `:focus`**; el token `--border-focus` existe pero se ignora (incluso `.form-select`/`.form-textarea` lo ignoran). Borde 1.5px (input) vs 1px (select). 3 fondos de campo (`--surface-2`/`--surface`/`--bg`). **Checkbox sin canónico** (5 acentos + hex + default, 5 tamaños). Toggle: 2 switches idénticos salvo tamaño (`.ur-toggle-btn`/`.uf-sched-tog`) → un `.switch`. `ui-isla.css` sin textarea/checkbox/toggle → islas reinventan (empaque con hex, formacion con variable JS `fld`).
- **Inline:** ~22.6% de los controles.

### 2.5 Badges / chips de estado — canónico bueno, 3 sistemas paralelos

- **Canónico:** `.badge` + `.b-*` (`ui-isla.css:31` + shell), respaldado por `STATUS_CSS`/`STATUS_LABELS` en `core.js:439`. **Los colores YA salen de tokens.**
- **A unificar:** **3 sistemas de estado de tarea** con misma semántica (`.b-*` vs `.wwp-s-*` vs `.wwp-task-status`, + `.mock-badge`/`.status-badge` en guías) → 5 bases, 5 radios. **3 sistemas de rol** (`.role-badge` sólido vs `.wwp-role-badge` suave, radios 10/4/20/12 + hex `#0284c7`). **Badge de conteo: 5+ implementaciones** con 3 rojos distintos (`#ef4444`/`#dc2626`/`--red-dot`) → crear `.count-badge`. Peso 700 vs 600 (sdv) vs 900 (auditor). Duplicación shell↔isla (`.pol-status-pill`, `.imp-*-badge`).
- **Falta:** empty-state canónico (mejor candidato `.wwp-empty/.empty-state`), loading canónico (`.loading`+`.spinner` + helper `loadingHtml()`), y **error canónico (no existe)** — hoy se disfraza de loading.

### 2.6 Modales / drawers / tablas — ~16 sistemas de modal, sin base de tabla

- **Modal canónico:** `.modal-overlay`/`.modal-card` (`:2771` + `ui-isla.css:35`), único con banda de cabecera de marca.
- **A unificar:** **cabecera** (banda oscura del canónico vs cabecera clara del resto — 2 lenguajes); **radio** (6/12/14/16/20); **ancho** (340→1120); **z-index** (14 valores sin escala → riesgo de solapamiento); **glifo de cierre** (`✕` vs `×`); **cierre** (los modales admin NO cierran con Escape/backdrop, al revés de lo esperado; solo 4 usan el helper `modalBackOpen`); footer usa `.btn-primary` + hack `style="background:#6b7280"` por falta de `.btn-secondary`. **CSS muerto:** `.wwp-modal-*`, `.eo-dev-modal-*`.
- **Tablas:** ~10 casi idénticas sin base (`.mv-table/.cont-table/.sol-table/.desp-table/.veh-insp-table/.pol-emp-table/.ca-tbl/.eqp-table`) → extraer `.data-table`. Outliers: `.invd-tbl` (header en minúsculas/600) y `.rpt-table` (th sin fondo). Colores hardcodeados en `.cont-table`/`.emp-tree-table` (rompen dark). Duplicación shell↔isla (`.pol-emp-table`, `.eqp-table`).
- **Legítimo (NO unificar):** `#wwp-drawer` (panel lateral full-height ≠ modal centrado), lightboxes de foto, `.cam-overlay`, `.veh-check-table` (grid), `confirm()` nativo en no-PWA.

---

## 3. Set de componentes canónicos (el "design system" nativo)

Todo sobre tokens existentes de `theme.css`. Lo que se define/consolida:

| Componente | Base | Reemplaza a |
|---|---|---|
| `.btn` + `.btn-primary`/`.btn-secondary`/`.btn-danger`/`.btn-sm`/`.btn-icon`/`.btn-link` | inline-flex + tokens; primario = `--accent`, radio `--radius` | ~150 botones inline + familias `*-btn` |
| `.nav-tab` | subrayado (ya canónico) | `.sdv-tab`, `.invd-tabs` |
| `.seg` / `.seg-btn` | pista `--surface-2` + activo elevado (`.eqp-subtab`) | `.eo2-view-seg`, `.eo2-cal-dim`, `.tasks-view-bar`, `.sol-tab`, `.notif-pref-seg` |
| `.chip-filter` (+`.is-brand`/`.is-invert`) | píldora `--radius-full` | `.av/.rep/.sdv-bandeja/.stype/.invd`-filter |
| `.chip-removable` | píldora con × | `.filter-chip`, `.eo2-fchip` |
| `.badge` + `.b-*` | ya canónico (tokens) | `.wwp-s-*`, `.wwp-task-status`, `.sdv-badge-*`, `.avb-*` |
| `.count-badge` | círculo `--red-dot` | notif/overdue/formacion badges |
| `.form-input`/`.form-select`/`.form-textarea`/`.form-check`/`.switch` | foco unificado `--border-focus`, borde 1px | ~15 familias de campo |
| `.card` (+`.card-kpi`) | `--radius-md` + `1px --border` | cards con radio/borde divergente |
| `.data-table` | th `--surface-2`/MAYÚS/700 + hover `--accent-light` | ~10 tablas |
| `.modal-*` | cabecera unificada + escala z-index/ancho | ~16 sistemas de modal |
| `.empty-state` / `.loading` / `.error-state` | compartidos | ≥10 empties + ~15 loadings inline |

**Arquitectura:** promover estos a un **layer compartido** que cargue el shell Y las islas (completar `ui-isla.css` y añadir su `<link>` a `historial.html`, o un `components.css` nuevo). Así se cierra la divergencia shell↔isla de raíz.

---

## 4. Plan de implementación por fases (riesgo creciente)

> Regla: e2e verde + verificación visual por rol antes/después de cada fase. Los cambios de CSS compartida se revisan en las pantallas de mayor tráfico.

> **ESTADO: C1–C8 IMPLEMENTADAS Y VERIFICADAS** (builds v232→v235). La convergencia se hizo
> con una capa `<style id="componentes-canonicos">` al final del shell que agrupa las variantes
> duplicadas bajo un mismo estilo **sin renombrar clases**, para que los handlers JS sigan
> intactos. Contrato adoptado (Astryx, doc 12): *la geometría es propiedad del sistema*.

| Fase | Contenido | Estado |
|---|---|---|
| **C1 — Fundación** | Definir `.btn` + `.btn-secondary` (+ mirror ui-isla) → arregla botones nativos; `.btn-sm` radio → token | ✅ v232 — 16 botones secundarios pasaron de gris-nativo a `--surface-2`+borde |
| **C1b — Taxonomía Astryx** | `.btn-lg`, `.btn-destructive` (primary/secondary/ghost/destructive) | ✅ v234 |
| **C2 — Tabs/segmented** | Segmented canónico: `.tasks-view-bar` ≡ `.eo2-view-seg` ≡ `.eo2-cal-dim` ≡ `.eqp-subtabs`; chips de filtro unificados (5 familias); `.sdv-tab` → `.nav-tab` | ✅ v234 — verificado: segmented 8px y chips 9999px idénticos en 3 pantallas |
| **C3 — Inputs** | Anillo de foco único en **29 selectores** con token nuevo `--focus-ring` (light+dark); borde homogéneo 1px; `.switch` | ✅ v234 — había 5 colores de foco y campos sin foco visible |
| **C4 — Badges** | Una geometría de píldora para los 4 sistemas de estado; `.count-badge` (eran 5 con 3 rojos); rol unificado; hex `#0284c7` → `--sky-dot` | ✅ v234 |
| **C5 — Cards/tablas** | Radio y borde propiedad del sistema (fin de 6 radios y del 1.5px); `.data-table` para las ~10 tablas | ✅ v234 |
| **C6 — Modales** | Radio `--radius-lg`; **escala de z-index por capas** (drawer < modal < lightbox < cámara) reemplaza los 14 arbitrarios | ✅ v234 |
| **C7 — Barrido inline** | Los 5 «Cancelar» dejan el hack `background:#6b7280` y usan `.btn-secondary`; hex puros → tokens; verde Excel tokenizado | ✅ v235 — los 3 hex restantes son fallbacks `var(--token,#hex)`, no rompen dark |
| **C8 — Carga y accesibilidad** | `.btn.is-loading` (≡ `isLoading` de Astryx) + `.error-state` que **no existía**; helpers únicos `btnLoading/loadingHtml/emptyHtml/errorHtml` en `core.js`; `aria-label` en los 7 botones de icono sin nombre | ✅ v235 — 0 botones sin nombre accesible |

**Pendiente (deuda de volumen, no de sistema):** migrar los ~145 botones y ~70 inputs que aún
llevan `style=` inline cosmético a las clases canónicas, y consolidar las ~40 familias `*-btn`
especializadas. El sistema ya existe; falta el barrido mecánico, que conviene hacer por pantalla
a medida que se toquen, no en un big-bang.

---

*Detalle por familia con `archivo:línea` en los transcripts de los 6 agentes. Este documento es el veredicto consolidado; la implementación arranca por C1.*
