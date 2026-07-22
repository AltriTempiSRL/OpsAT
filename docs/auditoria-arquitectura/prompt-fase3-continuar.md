# Prompt — Continuar/terminar la Fase 3 (base de datos relacional) — OpsAT

> Pegá esto en una conversación NUEVA de Claude Code, en el repo OpsAT.
> Encara el cutover relacional (Tarea B) y/o la modularización del frontend (Tarea C).
> Exige verificación real (curl + navegador + SQL), no suposiciones.
>
> ⚠️ ACTUALIZADO 22-jul-2026 (2ª sesión): la Tarea A (read-layer/visor) YA ESTÁ HECHA
> y verificada — no la repitas; su sección quedó abajo como registro con lo único
> pendiente (deploy). Se sumó la Tarea C (separar la app por páginas/módulos +
> auditoría de escalabilidad, docs 07 y 08).

---

Trabajás en OpsAT: plataforma de despachos/almacén. Backend monolito Node en `proxy.js` (cascada de rutas, sin Express), SPA en `historial.html` (~40k líneas, sin framework). **Backend de datos DUAL** (`storage-pg.js`): en producción usa **PostgreSQL** donde cada colección son filas **JSONB** en las tablas genéricas `collection_rows`/`kv_store` (NO hay tablas por entidad); en local, archivos JSON. Deploy a prod = `railway up -d -y` (CLI linkeada a **OpsAT / production / dashboard-despachos**); el push a GitHub NO despliega.

**Qué es la Fase 3:** hacer los datos **visibles y consultables como tablas** (read-layer) y, a futuro, el **cutover** a un esquema relacional real donde la app escriba en tablas tipadas.

**Estado actual (verificá con `git log`):**
- Read-layer TERMINADO (commit `5163d22`, 22-jul): **13 vistas SQL tipadas** + visor admin **"Base de datos"** con 13 botones. Las vistas proyectan `collection_rows` (JSONB) como tablas legibles, SIN cambiar cómo la app lee/escribe.
- Las 13 vistas ya están **CREADAS y verificadas en el PG de prod** (por psql directo, con datos reales — campos confirmados con `jsonb_object_keys`, cero columnas fantasma). `v_inspecciones` EXCLUYE `fotos_condicion` (17 MB de base64 — ver hallazgo A1 del doc 07).
- **Pendiente SOLO deploy** (`railway up -d -y` cuando el árbol esté limpio de trabajo ajeno): hasta entonces prod (v226/v227) sirve por el endpoint las vistas que su proceso whitelistea; las nuevas responden al deployar. Verificar tras deploy: `/api/health` build nuevo + visor lista 13 vistas con datos.

## ⚠️ ANTES DE TOCAR NADA — concurrencia (crítico en este repo)
Puede haber **otra sesión de Claude editando el mismo árbol**. SIEMPRE corré `git status` y `git diff` antes de editar, commitear o deployar. **Nunca hagas `railway up` si hay cambios sin commitear que no son tuyos** (sube trabajo ajeno a medias). Commiteá SOLO tus archivos (`git add <archivo-específico>`, no `git add .`). Re-chequeá `git status` justo antes de cada commit.

## Tarea A — Read-layer ✅ HECHA (22-jul, commit `5163d22`) — solo registro
Lo que se hizo (no repetir): 13 botones en `DBV_VIEWS`; DDLs de `v_sdv`/`v_inspecciones`/`v_vehiculos` corregidos con los campos REALES de prod (los best-effort tenían `tipo/cliente/vendedora/odooRef`, `estado/userId/userName`, `nombre/tipo/modelo/activo` — todos inexistentes; los reales: `tipoSolicitud/clienteNombre/creadoNombre/odooOrderRef`, `apto/createdBy/createdByName`, `name/fuelType/isBuiltin`); +5 vistas nuevas (`v_solicitudes_showroom` sin `imageBase64`, `v_materiales`, `v_reglas_empaque`, `v_despachos_obsoleto`, `v_cursos`); todo aplicado y verificado en el PG de prod vía psql (túnel público flaky: reintentar con backoff y `set -o pipefail` — un `| cut` enmascara el exit code de psql). Verificado en navegador local: 13 botones, consola limpia, deep-link `/basedatos/sdv` activa el botón (el router valida contra `DBV_VIEWS`).
**Único pendiente: deploy** (`railway up -d -y` con árbol limpio; el bump v227 del router ya cubre el version-gate — no hace falta bump propio si van en el mismo deploy).

## Tarea B — El cutover relacional (megaproyecto, incremental — NO de una sesión)
Objetivo: que la app **escriba** en tablas tipadas por entidad en vez de blobs JSONB. Enfoque **estrangulador, una entidad a la vez** (empezá por las chicas y estables: `usuarios`, `roles`):
1. Diseñá la tabla tipada + índices + claves foráneas (DDL en `storage-pg.js`).
2. Backfill idempotente desde la colección JSONB actual (conservá ids).
3. Enrutá lecturas/escrituras de ESA entidad a la tabla, **detrás de la fachada `loadJson`/`saveJson`** (el resto del monolito no cambia).
4. **Doble escritura** breve (tabla + colección JSONB) como red de seguridad; verificá paridad; luego cutover.
5. Verificá con el harness de esa entidad (`tests/_test_vNNN.mjs`, `tests/test-storage-pg.mjs`) + conteos. Mantené el export a JSON como rollback.
El plan detallado está en `~/.claude/plans/deep-cooking-clover.md` (Fase 3). Es de **semanas**; hacela y verificala **una entidad por vez**; se puede pausar entre entidades sin dejar el sistema a medias.

## Tarea C — Separar la app por páginas/módulos + sanear lo que no escala (agregada 22-jul)
La auditoría de escalabilidad completa (backend + frontend + datos, todo medido) está en
`docs/auditoria-arquitectura/07-auditoria-escalabilidad-2026-07.md`, y el plan de
modularización del frontend en `08-plan-modularizacion.md`. Resumen operativo:
1. **Quick-wins backend** (independientes, empezá por acá): cablear `queueWrite` (definida
   en `proxy.js:4712` y JAMÁS llamada — cierra la ventana de lost-update); migrar
   `fotos_condicion` de `wwp-inspecciones` a R2 (17 MB de base64 en JSONB, patrón de
   Fase 1 ya existente); dirty-flags en `_diffArray` de `storage-pg.js` (hoy re-serializa
   la colección ENTERA en cada save).
2. **Modularización frontend** (plan 08, por olas): Ola 0 = Playwright mínimo (hoy hay
   CERO tests de frontend — prerrequisito duro); Ola 1 = extraer `core.js` + `theme.css`
   compartidos; Ola 2 = isla piloto `basedatos` en iframe (el precedente vivo es
   `almacen-mapa.html`); olas 3–5 = resto de secciones de fácil a difícil (SDV y
   tasks/drawer al final). NO hagas big-bang; una isla por sesión, con la suite verde.
3. Cada ítem se pausa/retoma sin dejar nada a medias; C y B (cutover) no se bloquean
   entre sí — se pueden intercalar por dominio.

## Patrón del codebase (reusar, no reinventar)
- `storage-pg.js`: `const READABLE_VIEWS = new Set([...])` (whitelist), `_createViews()` (array de DDLs `CREATE OR REPLACE VIEW v_x AS SELECT data->>'campo' AS alias ... FROM collection_rows WHERE collection = 'X' ORDER BY ord` — **best-effort**: un DDL que falla se atrapa y no tumba el boot), `readView(name)` (solo whitelisteadas).
- `proxy.js`: `GET /api/admin/db/:view` (solo admin; mapea `:view`→`v_<view>`; 503 si no hay Postgres).
- `historial.html`: sección `#section-basedatos`, `DBV_VIEWS`, `dbViewerLoad()` / `dbvShow(view)` (pinta la vista como `<table>`, escapa con `esc()`).

## Verificación (obligatoria antes de decir "listo")
- `node --check proxy.js && node --check storage-pg.js`.
- Boot local: `DATA_DIR=/tmp/f3 PORT=3130 ODOO_MODE=off node boot.js &` → `historial.html` carga **sin errores de consola**; los botones del visor renderizan. (En local, sin Postgres, el endpoint da 503 — es esperado; el dato real sale en prod.)
- Tras deploy: `/api/health` build nuevo; en prod, logueado admin, el visor lista las 8 vistas como tablas.

## Contexto/docs
- Plan: `~/.claude/plans/deep-cooking-clover.md`.
- Memoria de estado: `memory/opsat-modernizacion-estado.md` (estado completo de la modernización).
- Auditoría/prompts hermanos: `docs/auditoria-arquitectura/`.

## Reglas
- Aditivo sobre `historial.html` (agregá, no borres por rango: estructura entrelazada, funciones intercaladas con `var`/arrays en uso — casi se borra código vivo si asumís "hasta la próxima `function`").
- Verificá TODO; lo no verificable, decilo. No inventes nombres de campo — confirmalos con `SELECT` real.
