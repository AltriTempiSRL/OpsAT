# Prompt — Continuar/terminar la Fase 3 (base de datos relacional) — OpsAT

> Pegá esto en una conversación NUEVA de Claude Code, en el repo OpsAT.
> Termina la parte tractable (visor completo) y encara el cutover relacional.
> Exige verificación real (curl + navegador + SQL), no suposiciones.

---

Trabajás en OpsAT: plataforma de despachos/almacén. Backend monolito Node en `proxy.js` (cascada de rutas, sin Express), SPA en `historial.html` (~40k líneas, sin framework). **Backend de datos DUAL** (`storage-pg.js`): en producción usa **PostgreSQL** donde cada colección son filas **JSONB** en las tablas genéricas `collection_rows`/`kv_store` (NO hay tablas por entidad); en local, archivos JSON. Deploy a prod = `railway up -d -y` (CLI linkeada a **OpsAT / production / dashboard-despachos**); el push a GitHub NO despliega.

**Qué es la Fase 3:** hacer los datos **visibles y consultables como tablas** (read-layer) y, a futuro, el **cutover** a un esquema relacional real donde la app escriba en tablas tipadas.

**Estado actual (verificá con `git log`):**
- Read-layer: **8 vistas SQL tipadas** + un visor admin **"Base de datos"** en la app (sidebar → Análisis Operacional). Las vistas proyectan `collection_rows` (JSONB) como tablas legibles, SIN cambiar cómo la app lee/escribe.
- **5 vistas + el visor YA están vivas en prod** (`v_usuarios/v_roles/v_tareas/v_averias/v_inventario`, build v226).
- **3 vistas nuevas committeadas pero SIN botón ni deploy** (commit `86f3baf`): `v_sdv`, `v_inspecciones`, `v_vehiculos` (en `storage-pg.js` `_createViews`), con campos **best-effort** (pueden tener columnas nulas si adiviné mal un nombre de campo).

## ⚠️ ANTES DE TOCAR NADA — concurrencia (crítico en este repo)
Puede haber **otra sesión de Claude editando el mismo árbol**. SIEMPRE corré `git status` y `git diff` antes de editar, commitear o deployar. **Nunca hagas `railway up` si hay cambios sin commitear que no son tuyos** (sube trabajo ajeno a medias). Commiteá SOLO tus archivos (`git add <archivo-específico>`, no `git add .`). Re-chequeá `git status` justo antes de cada commit.

## Tarea A — Terminar el read-layer (tractable, ~1–2 h)
1. **Botones del visor**: en `historial.html`, buscá `var DBV_VIEWS = [` y agregá las 3 vistas nuevas al array:
   `{ key:'sdv', label:'SDV' }, { key:'inspecciones', label:'Inspecciones' }, { key:'vehiculos', label:'Vehículos' }`.
   (El endpoint `GET /api/admin/db/:view` ya sirve cualquier vista whitelisteada; el `key` mapea a `v_<key>`. No hay que tocar el backend para esto.)
2. **Bump `APP_BUILD`** en `proxy.js` y `historial.html` (cambió el frontend → los clientes recargan por el version-gate).
3. **Deploy** `railway up -d -y`. Esperá el build; verificá `build` nuevo en `/api/health`.
4. **Verificar campos reales de las 3 vistas** (usé best-effort): en Railway → servicio Postgres → Data, corré `SELECT * FROM v_sdv LIMIT 3;` (y `v_inspecciones`, `v_vehiculos`). Si una columna sale **toda NULL**, el nombre de campo del DDL está mal — corregilo en `storage-pg.js` `_createViews` mirando cómo se construye el objeto real en `proxy.js` (colecciones: `sdv-solicitudes`, `wwp-inspecciones`, `wwp-vehicles`), re-deployá. Idealmente agregá también las vistas que falten de colecciones útiles (`wwp-solicitudes-showroom`, `emp-materiales`, `emp-reglas`, `despachos-obsoleto`, `wwp-training-courses`).

## Tarea B — El cutover relacional (megaproyecto, incremental — NO de una sesión)
Objetivo: que la app **escriba** en tablas tipadas por entidad en vez de blobs JSONB. Enfoque **estrangulador, una entidad a la vez** (empezá por las chicas y estables: `usuarios`, `roles`):
1. Diseñá la tabla tipada + índices + claves foráneas (DDL en `storage-pg.js`).
2. Backfill idempotente desde la colección JSONB actual (conservá ids).
3. Enrutá lecturas/escrituras de ESA entidad a la tabla, **detrás de la fachada `loadJson`/`saveJson`** (el resto del monolito no cambia).
4. **Doble escritura** breve (tabla + colección JSONB) como red de seguridad; verificá paridad; luego cutover.
5. Verificá con el harness de esa entidad (`tests/_test_vNNN.mjs`, `tests/test-storage-pg.mjs`) + conteos. Mantené el export a JSON como rollback.
El plan detallado está en `~/.claude/plans/deep-cooking-clover.md` (Fase 3). Es de **semanas**; hacela y verificala **una entidad por vez**; se puede pausar entre entidades sin dejar el sistema a medias.

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
