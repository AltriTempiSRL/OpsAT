# _archivo/ — reorganización 2026-07-08

Todo lo que está aquí **ya no está en uso activo** (no lo lee `proxy.js`, no lo sirve
`historial.html`/`index.html`, no aparece en `package.json` ni en los `.bat` de arranque).
Nada se borró — se movió e identificó, para que la raíz del proyecto solo tenga lo que
está vivo hoy. Ver `CLAUDE.md` para la estructura completa del proyecto.

| Carpeta | Contenido | Por qué se archivó |
|---|---|---|
| `docs-historicos/go-live-wwp/` | Planes de lanzamiento y gestión del cambio de WWP (mayo-jun 2026) | Ciclo cerrado, WWP ya está en producción |
| `docs-historicos/sdv/` | Planes y propuestas de Solicitud de Despacho/Venta (jul 2026) | Fases ya implementadas y desplegadas |
| `docs-historicos/inventario-odoo/` | Transferencias a Obsoleto, lista de renombrado de compras | Investigaciones puntuales ya resueltas |
| `docs-historicos/performance/` | Diagnóstico de performance en Android 8 y cierre/responsabilidad WWP | Diagnósticos ya atendidos |
| `docs-historicos/compras/` | Propuesta SOP duplicados de compras | Propuesta ya evaluada |
| `sop-referencia/` | SOP de Operaciones v2 y lista de herramientas de transporte | Documentación de referencia, no código vivo |
| `mockups-portados/` | Mockups HTML ya portados a `historial.html`/`index.html` en producción | El código real reemplazó al mockup |
| `pdfs-referencia/` | PDFs de soporte de investigaciones AA1/NAVE2 | Material de referencia puntual |
| `versions-artifact-original/` | 13 snapshots del prototipo original en Claude.ai Artifacts, previo al servidor Node.js actual | Historia de origen del proyecto, no del servidor actual |
| `manuales/` | Manuales de posiciones (auditor de procesos, auxiliar de almacén, encargado, gerente) | Sin referencias de código; confirmado por Gabriel que ya no está en uso |
| `assets-huerfanos/` | `leaflet.js`/`leaflet.css` (el mapa real usa Google Maps), íconos/SVGs sin referencias (`logo.svg`, `thumbnail.png`, `hero-*.svg`, `icon-at-badge.svg`) | 0 referencias encontradas en el código actual |
| `datos-huerfanos/` | JSON con nombres que el backend ya no usa (`empaque-materiales.json`/`empaque-reglas.json` — el código real usa `emp-materiales.json`/`emp-reglas.json` en `DATA_DIR`), `politicas.json` (no existe endpoint `/api/politicas` en `proxy.js` pese a que el frontend lo llama — ver nota abajo), datasets puntuales de investigación (`_aa1_baseline.json`, `_nave2_*.json`), y el backup del incidente del 15-jun | Huérfanos confirmados contra el código real de `proxy.js` |
| `scripts-ron-ejecutados/` | Scripts de investigación puntual de Ron (`_ron_acdp_neg.mjs`, `_ron_obsoleto_diag*.mjs`, etc.) e inyección de datos NAVE2 | Ya ejecutados, no están en `package.json` ni se re-corren |
| `fotos-huerfanas/` | `av-fotos/`, `emp-fotos/`, `empaque-fotos/`, `wwp-fotos/` — carpetas que quedaron sueltas en la raíz | El servidor usa `DATA_DIR` (→ `data-local/` en local, `/data` en Railway) para fotos reales; estas carpetas del root estaban **100% vacías** (0 archivos) al momento de archivarlas |
| `incidentes-cerrados/_RECOVERY_2026-06-25/` | Handoff y dumps del incidente de pérdida de datos del 25-jun | Incidente cerrado, ya remediado (ver `MEMORIA-PROYECTO.md`) — **contiene datos sensibles, sigue excluido de git** (patrón en `.gitignore`) |

## Hallazgo colateral (no arreglado, solo documentado)

El tab "Políticas" de `historial.html` llama a `/api/politicas`, pero ese endpoint **no existe**
en `proxy.js` (0 resultados al buscarlo). El `politicas.json` archivado aquí es de una versión
anterior. Si el tab sigue visible en producción, probablemente esté devolviendo 404 — pendiente
de que Gabriel decida si se repara el endpoint o se retira el tab.

## Qué NO se archivó (y por qué)

- `_ron_neg_watch.mjs` — Gabriel confirmó que el watchdog de negativos sigue activo; se quedó en la raíz.
- `_ron_stamhouse_detalle.md` — es un documento vivo que Ron actualiza entre sesiones (ver memoria del proyecto); se quedó en la raíz.
- `sync-from-prod.js` — usa rutas relativas a `__dirname` (`data-local/`, `.env`); moverlo de carpeta rompería esas rutas sin tocar el código, así que se quedó en la raíz.
