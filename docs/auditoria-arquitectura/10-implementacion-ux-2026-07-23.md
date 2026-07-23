# Implementación del plan UX/IA (doc 10) — 2026-07-23, build v229

> Ejecuta las Fases 1–4 de [`10-auditoria-ux-ia-2026-07-23.md`](10-auditoria-ux-ia-2026-07-23.md) por pedido de Gabriel ("arreglemos todo esto de inmediato"). **Verificado**: suite e2e 99/99 verdes antes y después; recorrido visual en sandbox con los 3 roles (Admin/Encargado/Auxiliar); consola en 0 errores. **SIN deployar** — el deploy es `node scripts/deploy.mjs` cuando Gabriel dé el OK (30 usuarios en vivo; salida gradual según §20 Fase 6).

## Qué cambió (por hallazgo)

### Fase 1 — renombres, reagrupado, RBAC, rutas, contraste
- **UX-11/12 (P0)**: "Dev→CDP" → **"Devoluciones a CDP"**; "Despacho de Obsoleto" → **"Conduces Outlet"** (sidebar + mob-nav + permisos del modal de rol). Rutas intactas.
- **UX-03**: sidebar reagrupado por dominios — **Operación del Equipo / Ventas → Despacho / Almacén / Supervisión / Administración** (los rótulos COMPRAS/VENTAS/PLATAFORMA/etc. desaparecen). Ids `nav-*` y rutas sin cambios; grupos nuevos `navg-equipo|vd|almacen|supervision|admin` (historial.html + `GROUPS` en core.js).
- **UX-07 (parcial)**: "Workforce Labor" → **"Equipo y Tareas"** en toda superficie visible (sidebar, mob, toast, modal de rol, timeline).
- **UX-15**: **fuente única de labels** — `TYPE_LABELS` / `TYPE_LABELS_SHORT` / `STATUS_LABELS` en core.js; los 6 mapas locales + `_WWP_*` del shell ahora son referencias. Glosario aplicado: `packaging`=**Empaque** (adiós "Embalaje"), estados femeninos (**Asignada/Completada/Validada/Cancelada**) y **"En curso"** (adiós "En Progreso"/"En progreso"; "Overdue"→"Vencida"). Filtros y KPIs actualizados.
- **UX-16**: labels espejados 1:1 escritorio/móvil (Buscador, Averías, Mapa del Almacén, Solicitud de Despacho, Bandeja SDV…).
- **UX-18**: `ROLE_PERMISSIONS.dashboard = ['admin','manager']` (proxy.js) — el Encargado ya recibe los datos del panel que su tab siempre le mostró.
- **UX-19**: retirados del modal de rol los interruptores sin efecto (`wwp.usuarios`, `wwp.validar_tarea`) y la entrada `users_tab` de `_PERM_SP_MAP`; guard de Empaque igualado al build (admin-only) en `guardTab`.
- **UX-21**: `ROLE_LABELS.ventas = 'Ventas'`.
- **UX-22 / FE-04**: kanban usa `can('edit_task')` (la clave `tasks_edit` no existía) — el Encargado ya puede arrastrar tarjetas.
- **UX-08**: `basedatos`/`dashboard-ventas`/`contenedores` fuera de `_MODULE_ROUTES` → **302 a /historial.html**; residuo `nav-basedatos` limpiado de core.js.
- **UX-09**: **prefijos bloqueados en el static serving** (`/_archivo`, `/tests`, `/docs`, `/scripts`, `/data-local`, `/node_modules`, `/.github`, `/.claude`) → 404. Los 21 HTML archivados dejan de ser alcanzables.
- **UX-29 (contraste)**: `--text-muted`/`--text-3` a ≥4.5:1 AA en claro (`#4d5e73`/`#5b6b80`) y oscuro (`#8b99ad`/`#77879b`) en theme.css.

### Fase 2 — Administración + consolidaciones (navegación primero, sin mover código de pantallas)
- **UX-01/02**: la barra de tabs de "Equipo y Tareas" queda **solo con operación** (Tareas · Vehículos · Formación). Los tabs de gestión se alcanzan desde el sidebar:
  - **SUPERVISIÓN** (admin+encargado): Panel del Equipo (ex Dashboard) · Evidencias · Adopción (Impacto, admin).
  - **ADMINISTRACIÓN** (solo admin): Usuarios y Permisos · Reglas de Cumplimiento (Políticas) · Materiales de Empaque.
  - Mecánica: `goToWwpTab()` nuevo (historial.html) + visibilidad por rol en `applyNavPerms` (core.js). El contenido de cada pantalla NO se movió — cambia cómo se llega y cómo se llama. `switchTab`/`guardTab`/deep-links `/wwp/<tab>` intactos (smoke-04 verde).
- **Alias `/admin/<x>`**: `admin` añadido a `_MODULE_ROUTES`; el router cliente mapea `usuarios|politicas|empaque|panel|evidencias|impacto` → su tab (URL canónica sigue `/wwp/<tab>`).
- **UX-05 (parcial)**: labels "Bandeja SDV"/"Reactivaciones SDV" agrupados bajo Ventas→Despacho + **botón "Reactivaciones" dentro de la Bandeja** (acceso contextual al flujo excepcional). La unificación física en tabs queda para la ola siguiente.
- **UX-04 (parcial)**: `solicitudes-reposicion` añadida al **auto-grant del manager** — el flujo formal D5 (con aprobación y tareas) deja de estar oculto para quien lo gestiona.

### Fases 3–4 — estados, a11y, móvil
- **UX-31**: vacíos con acción — Tareas ("+ Nueva Tarea" si `can('create_task')`) y Bandeja SDV ("+ Nueva Solicitud de Despacho"); Averías ya no pinta estados crudos (`avStatusLabel` con fallback visible "Estado: X").
- **UX-29 (foco)**: **focus-trap global** en core.js — Tab queda dentro del modal `[aria-modal]` visible y el foco vuelve al disparador al cerrar (MutationObserver).
- **UX-30**: `formacion.html` con media query ≤720px (reflow, targets ≥38px, tablas con scroll propio).
- **UX-14 (parcial)**: welcome "Bienvenido a **Ops AT**".

### Infra del cambio
- `stamp.mjs` re-estampó `?v=` (core.js `cf30df97`, theme.css `df4ca9ce`) en shell + 5 islas; `--bump` → **APP_BUILD v229** (proxy+historial) + SW `wwp-v60`.
- e2e: smoke-01 actualizado (rutas retiradas→302, prefijos→404, `admin` en fallback SPA) — **99 tests** (93 previos + 6 nuevos).

## Decisiones tomadas de forma PROVISIONAL (revisables por Gabriel, todas de 1 línea)
| # | Decisión | Dónde revertir |
|---|---|---|
| 1 | Dashboard abierto a **manager** (recomendación UX-18a) | `ROLE_PERMISSIONS.dashboard` en proxy.js |
| 2 | D5 visible para manager vía auto-grant (en vez de retirarlo) — su fusión con Solicitudes Showroom espera confirmación de uso | `_MANAGER_AUTO_GRANT_SECTIONS` en core.js |
| 3 | Políticas/Impacto **siguen existiendo** (renombradas y reubicadas); el retiro o la fusión en un Panel único espera datos de uso (PR-04/PR-08) | — |
| 4 | Glosario aplicado: "En curso", femeninos, "Empaque", marca "Ops AT" solo en welcome (la marca completa del login/sidebar espera decisión) | `STATUS_LABELS`/`TYPE_LABELS` en core.js |
| 5 | Nombres nuevos: "Conduces Outlet" (validar vs "Conduces Obsoleto"), "Equipo y Tareas", "Panel del Equipo", "Reglas de Cumplimiento", "Adopción (Impacto)" | labels en historial.html |

## Qué queda para las olas siguientes (de la propuesta §18–§20)
- Unificación física SDV (un contenedor con tabs Nueva/Bandeja/Mis) y Reposición (Análisis+Solicitudes en un módulo) — hoy agrupadas y bien nombradas, no fusionadas.
- Panel del Equipo como fusión real (dashboard-tareas + almuerzos + adopción + cumplimiento) y pantalla Flota (maestro+historial) — hoy el Dashboard sigue mixto.
- División cuenta/ficha RRHH del modal de usuario (UX-27); URL canónica `/admin/*` con `_routeSet` propio; deep-link `/sdv/<id>`; recuperación de contraseña (UX-23, necesita canal); skeletons; unificación de paradigma total (sidebar visible dentro de WWP en desktop ya lo está; falta fundir topbars).
- Marca única en login/manifest/sidebar (decisión 4).

## Verificación (evidencia)
- e2e **99/99** (35 s) — incluye: 302 de rutas retiradas, 404 de prefijos bloqueados, fallback SPA con `admin`, deep-links de los 9 tabs, islas, realtime, core/theme.
- Sandbox visual: Admin ve los 5 grupos nuevos + Administración; Encargado ve Supervisión (Panel del Equipo **con datos**, sin 403) y Solicitudes de Reposición; Auxiliar ve solo Operación del Equipo y su `/admin/usuarios` degrada a Tareas sin error. Consola: 0 errores.
- `stamp --check`: espejos coherentes (v229, wwp-v60).

## Deploy (cuando Gabriel dé OK)
```bash
node scripts/deploy.mjs
```
(la vía única F3.1: limpio+stamp+checks+suite+tag+railway+verificación). Tras deploy: verificar `/api/health` (v229), `/basedatos` → 302, `/_archivo/README.md` → 404, y que un Encargado vea datos en Panel del Equipo.
