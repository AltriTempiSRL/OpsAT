# Prompt reutilizable — Auditoría de autorización de la API (OpsAT)

> Pegá esto en una sesión nueva de Claude Code (o dáselo a un subagente) para encontrar
> errores de la clase "R-06B": endpoints con autenticación faltante o inconsistente.
> Está calibrado para ESTE codebase y exige **verificación con curl**, no suposiciones.

---

Actúa como **auditor de seguridad**. Tu objetivo es encontrar **fallos de autorización en la superficie de API** de OpsAT: endpoints que exponen datos o ejecutan acciones sin la autenticación/permiso correctos, o con auth inconsistente entre endpoints hermanos o entre frontend y backend. **NO modifiques código** — solo audita y reporta con evidencia (`archivo:línea` + resultado de `curl`).

## Contexto del codebase (no asumas otra cosa)
- Todo el backend está en `proxy.js`: un único handler HTTP con una **cascada de ~238** `if (reqPath === … && req.method === …)`. No hay Express ni middleware — **cada endpoint aplica (o no) su propio guard**.
- Guards disponibles: `requireJwt(req,res)` (sesión), `requireRole(jp,res,[roles])`, `requireSectionPerm(…)`, `isTaskParticipant(…)` (anti-IDOR por tarea), `requireBackupToken(req,res)`, token de Codex (`x-codex-bridge-token`). Un endpoint sin **ninguno** de estos es **público**.
- El frontend (`historial.html`) llama con `authFetch(url,opts)` (envía `Authorization: Bearer <token>`) o con `fetch(url,opts)` **plano (sin token)**. Un endpoint autenticado llamado con `fetch` plano se rompe (401); un endpoint que **debería** requerir auth pero se llama con `fetch` plano suele delatar que el backend **no lo protege**.

## Clase de bug a cazar ("R-06B" y parientes)
1. **Sin guard + expone datos/PII**: lee colecciones y devuelve usuarios, tareas, averías, inventario, ubicaciones GPS, etc.
2. **Sin guard + ejecuta acción**: `POST/PATCH/DELETE` que escriben datos.
3. **Sin guard + pega a Odoo** con la API key privilegiada (`odooCall`/`execute_kw`) → filtra datos del ERP y quema su cuota.
4. **Inconsistencia entre hermanos**: mismo recurso donde unos métodos/rutas tienen guard y otros no (ej. `/api/averias/search` con JWT pero `/api/averias` sin — el caso original).
5. **JWT sin rol/permiso**: endpoint con `requireJwt` pero sin `requireRole`/`requireSectionPerm` donde debería (cualquier logueado ve/hace algo que debería ser admin/manager).
6. **Mismatch front↔back**: `fetch` plano hacia un endpoint con guard (roto), o `authFetch` hacia uno sin guard (fuga).
7. **Fuga en respuestas públicas**: rutas de salud/estado que devuelven rutas de disco, previews de datos, o ids internos.

## Método (ejecútalo, no lo describas)
1. Extrae TODOS los endpoints: `grep -nE "reqPath (===|\.match|\.startsWith)" proxy.js`. Para cada uno, lee las ~5 líneas siguientes y clasifica el guard (público / requireJwt / +rol / +permiso / token).
2. Determina qué hace cada endpoint: ¿lee/escribe colección? ¿llama a Odoo? ¿toca PII (usuarios, GPS, contraseñas)?
3. Cruza con el frontend: por cada endpoint sensible, busca sus call-sites — `grep -nE "(fetch|authFetch)\('[^']*/api/<recurso>" historial.html` — y anota si mandan token.
4. **VERIFICA cada hallazgo (no lo asumas)**: levantá el server local
   `DATA_DIR=/tmp/audit PORT=3199 ODOO_MODE=off node boot.js &`
   y hacé `curl -s -o /dev/null -w "%{http_code}" http://localhost:3199<endpoint>` **sin token**.
   `200` con datos = **fuga CONFIRMADA**; `401/403` = protegido. Repetí para `POST/PATCH/DELETE` con `-X`.

## Entregable
Tabla priorizada:

| endpoint | método | guard actual | qué expone/hace | ¿anómalo? | severidad | evidencia (proxy.js:línea · curl) |

…seguida de una lista de **acciones** (qué guard agregar a cuál, y qué call-sites del frontend pasar a `authFetch`). Ordená por severidad: primero **escrituras y datos/Odoo sin auth**, luego **inconsistencias entre hermanos**, luego **JWT-sin-rol**.

## Reglas
- Toda afirmación con `archivo:línea` **+ resultado de `curl`**. Sin verificar = **"SOSPECHA"**, no "hallazgo".
- Distinguí **"público a propósito"** (health shallow, login, `/api/maps-key` con restricción GCP, estáticos) de **"fuga"**. Ante la duda, marcá **"decisión humana"**.
- No modifiques código. No borres nada. Reportá.

---

### Cómo lo cerramos (patrón ya probado en R-06B)
Para cada fuga confirmada, el fix es coordinado front+back:
1. **Backend**: agregar `const _jp = requireJwt(req, res); if (!_jp) return;` como primera línea del bloque `if` del endpoint (y `requireRole`/`requireSectionPerm` si aplica).
2. **Frontend**: cambiar los `fetch('/api/…')` de ese recurso a `authFetch('/api/…')` (es drop-in: mismo `(url,opts)`, agrega el Bearer y maneja 401→refresh). Verificar que **no quede ningún `fetch` plano** a ese recurso.
3. **Verificar**: `curl` sin token → 401; boot + consola del navegador sin errores; bump `APP_BUILD`; deploy; smoke test en prod (401 sin token).
