# Inventario de Tecnologías — OpsAT / Dashboard Despachos

> Auditoría de arquitectura · 2026-07-22 · Toda versión está verificada contra `package-lock.json`, cabeceras de los assets vendorizados o el código fuente. Lo no verificable se marca **NO VERIFICADO**.

## 1. Runtime y lenguaje

| Tecnología | Versión | Propósito | Dónde | Evidencia |
|---|---|---|---|---|
| Node.js | `>=18.0.0` (engine declarado) | Runtime del servidor | Todo el backend | `package.json` `engines.node` |
| JavaScript (CommonJS) | ES2020+ | Lenguaje del backend | `proxy.js`, `boot.js`, `storage-pg.js` | `require(...)` en los 3 |
| JavaScript (navegador, sloppy mode) | ES2017+ | Lenguaje del frontend | `historial.html`, `index.html`, `almacen-mapa.html` | `historial.html` sin `'use strict'` |
| HTML5 + CSS3 | — | UI (SPA monolítica sin framework) | `historial.html` (40.727 líneas) | — |
| SQL (PostgreSQL) | — | Backend de datos en producción | `storage-pg.js` (DDL inline) | `storage-pg.js:350-362` |

**No hay framework de servidor (sin Express/Koa/Fastify) ni framework de frontend (sin React/Vue/Angular).** El servidor usa el módulo `http` nativo; el cliente manipula el DOM directamente con `innerHTML` + template strings.

## 2. Dependencias de producción (npm)

Cuatro dependencias directas declaradas en `package.json`; el árbol completo (`package-lock.json`) suma 39 paquetes.

| Paquete | Versión | Propósito | Uso en el código |
|---|---|---|---|
| `@anthropic-ai/sdk` | 0.104.1 | IA — "Gerente de Operaciones" (OpsAgent) y Mesa de Agentes | `proxy.js` (endpoints de agentes IA) |
| `pg` | 8.22.0 | Cliente PostgreSQL (backend de datos dual) | `storage-pg.js` (`Pool`, DDL, write-through) |
| `nodemailer` | 6.10.1 | Envío de correos (reclamos, alertas) | `proxy.js` — carga **lazy** con `try/catch` |
| `web-push` | 3.6.7 | Notificaciones push (VAPID) | `proxy.js` — carga **lazy** con `try/catch` |

Transitivas relevantes: `jws`/`jwa`/`ecdsa-sig-formatter` (firma para web-push), `pg-pool`/`pg-protocol`/`pg-types` (driver PG), `https-proxy-agent`/`agent-base` (SDK Anthropic). **Ninguna librería de JWT** en el árbol: el token de sesión de la app es una implementación HS256 artesanal con `crypto` (ver `04`/`05`).

> **Observación:** `nodemailer` y `web-push` se cargan con `try{require()}catch{}`, de modo que su ausencia degrada la funcionalidad sin tumbar el arranque. Es una decisión deliberada de resiliencia.

## 3. Librerías de frontend (vendorizadas, servidas localmente — nunca CDN)

Convención del proyecto (CLAUDE.md): **todas las librerías se sirven locales, jamás desde CDN.**

| Librería | Versión | Propósito | Dónde se usa | Evidencia |
|---|---|---|---|---|
| Lucide Icons | 0.469.0 | Iconografía | `historial.html`, etc. (`lucide.createIcons()`, 205 usos) | `lucide.min.js` cabecera |
| Chart.js | 4.5.0 | Gráficos del dashboard de ventas | **Solo `index.html`** (no en historial.html) | `chart.min.js` cabecera |
| SheetJS (`xlsx`) | 0.18.5 | Export a Excel | `historial.html` (Nuevos Despachos, conduce Obsoleto), carga **lazy** `_loadXlsx` | `xlsx.min.js` cabecera |
| Three.js | r147 | Render 3D del mapa de almacén | **Solo `almacen-mapa.html`** | `three.min.js` `REVISION="147"` |
| OrbitControls | (UMD compat. r147) | Cámara orbital del mapa 3D | `almacen-mapa.html` | `OrbitControls.js` — sin string de versión (**NO VERIFICADO** commit exacto) |
| Google Maps JS API | (remota, on-demand) | Mapa GPS de auxiliares + Street View del SDV | `historial.html` (`_ensureGoogleMaps`) | key vía `/api/maps-key` |

**Peso muerto potencial:** `chart.min.js` (208 KB) y `three.min.js` (608 KB) se referencian solo desde archivos embebidos por iframe; `xlsx.min.js` (882 KB) es la librería más pesada del repo y se carga perezosamente. `historial.html` no consume Chart.js ni Three.js directamente (sus gráficos son SVG/canvas propios).

## 4. Almacenamiento y persistencia

| Tecnología | Propósito | Evidencia |
|---|---|---|
| PostgreSQL (Railway) | Backend de datos en producción cuando `DATABASE_URL` está definida | `storage-pg.js`, `boot.js:35` |
| Archivos JSON (filesystem) | Backend de datos histórico / local / tests; también respaldo legible y rollback | `proxy.js` `loadJson/saveJson` (`:34-76`) |
| Modelo de tablas PG | `collection_rows` (arrays con orden fraccional `ord`), `kv_store` (objetos), `rejected_writes` (auditoría anti-vacío) | `storage-pg.js:350-362` |

El diseño es un **backend dual**: el mismo código (`loadJson/saveJson/saveCriticalArray`) enruta a Postgres o a archivos según `DATABASE_URL`, con memoria precargada al boot y write-through diferencial por fila. Ver documento `03`/`persistencia`.

## 5. Infraestructura, deploy y operación

| Tecnología | Propósito | Evidencia |
|---|---|---|
| Railway (NIXPACKS) | **Producción actual** (desde jun-2026); `node boot.js`; healthcheck `/api/health`; restart on-failure ×10 | `railway.json` |
| Render (starter) | Producción **anterior** (ya no recibe cambios) | `render.yaml` |
| Disco persistente montado (`DATA_DIR=/data`) | Fotos, JSON de respaldo, datos de runtime | `render.yaml`, `RAILWAY.md` |
| GitHub Actions | Monitoreo de uptime cada 5 min → abre/cierra issue `wwp-down` | `.github/workflows/uptime.yml` |
| Service Worker (PWA) | Caché offline + push; caché `wwp-v57` | `sw.js` |
| Web App Manifest | Instalable como app "Ops AT" | `manifest.json` |
| Tarea programada de Windows | Respaldo nocturno 2:00 AM a OneDrive | `scripts/backup-wwp.mjs`, doc interna |

**GitHub NO dispara deploys**: el push a `master` es solo respaldo del código; el deploy es manual vía Railway CLI (`railway up`). Esto implica que **el repositorio puede quedar por detrás de producción** si se despliega sin commitear (riesgo documentado en CLAUDE.md).

## 6. Integraciones externas

| Servicio | Protocolo | Propósito | Evidencia |
|---|---|---|---|
| Odoo ERP (`altritempi.odoo.com`) | JSON-RPC sobre HTTPS | Fuente de verdad de inventario, picks, órdenes, devoluciones | `proxy.js` (cliente Odoo), CSP `connect-src` |
| Google Sheets | CSV publicado + API | Control de contenedores | `proxy.js` `/api/sheets*`, `.env` `CONT_SHEETS_ID` |
| Google Maps / Street View | JS API remota | Mapa GPS, ubicación de entregas | `/api/maps-key` |
| Anthropic Claude | SDK oficial | Gerente de Operaciones IA | `@anthropic-ai/sdk` |
| OpenAI / Codex | (Codex Bridge — sin API en Railway) | Auditor de procesos; consulta datos vivos vía endpoints `/api/codex/*` | `.env` `CODEX_BRIDGE_TOKEN`, CLAUDE.md |
| SMTP (configurable) | SMTP | Correos de reclamo/alerta | `nodemailer`, `.env` `SMTP_*` |

> Los detalles de cada integración (endpoints, caching, fail-open, modelos Odoo) se documentan en `04-api-integraciones.md`.

## 7. Herramientas de testing

| Herramienta | Propósito | Evidencia |
|---|---|---|
| Node.js (scripts `.mjs` a mano) | Harnesses de regresión que arrancan `proxy.js` real con puerto+DATA_DIR temporal | `tests/_test_vNNN.mjs` (convención: NNN = build del fix) |
| `node:assert` / asserts manuales | Aserciones en los harnesses | `tests/` |
| Odoo falso (HTTPS local con `_fakecert.pem`) | Simular Odoo sin tocar producción | `tests/_gateodoo.mjs:21` |
| OpenSSL (autogenerado) | Cert TLS efímero para contratos geo/inventario | `tests/test-geo-contract.mjs`, `test-inventario-contract.mjs` |

**No hay framework de test** (sin Jest/Mocha/Vitest), ni cobertura instrumentada, ni CI de tests. `npm test` corre `test-smoke.js`, que **requiere el servidor vivo en `:3000`**. Ver `05`/testing.

## 8. Ausencias notables (lo que el stack NO tiene)

- Sin bundler ni transpiler (no hay Webpack/Vite/Babel en build; el frontend es un `.html` monolítico servido tal cual).
- Sin TypeScript.
- Sin linter/formatter en el repo (sin ESLint/Prettier configurados).
- Sin framework de servidor ni de cliente.
- Sin ORM (el acceso a PG es SQL directo en `storage-pg.js`).
- Sin contenedores propios (Dockerfile) — se delega en NIXPACKS de Railway.
- Sin gestión de secretos externa (los secretos son variables de entorno + un `.jwt-secret` opcional en disco).
