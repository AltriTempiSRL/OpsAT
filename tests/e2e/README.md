# E2E Playwright — Ola 0 del plan de modularización

Red de seguridad del plan `docs/auditoria-arquitectura/08-*` (hallazgo C6 de la
auditoría 07: cero tests de frontend). **Toda extracción a isla exige esta suite
verde ANTES y DESPUÉS del cambio.**

## Correr

```bash
cd tests/e2e && npm install && npx playwright install chromium   # solo la primera vez
npx playwright test                                              # desde tests/e2e/
```

Reporte HTML: `npx playwright show-report .report`

## Cómo funciona

- Levanta el server real (`node proxy.js`, **puerto 3100**, HTTP, modo archivos
  JSON) con `DATA_DIR=tests/e2e/.data-e2e` **desechable**: se borra en cada
  corrida y `seedAuthUsers()` re-siembra los usuarios de prueba. Nunca toca
  `data-local/` ni producción; Odoo/Sheets/PG/R2 se fuerzan a vacío.
- Login: casi todos los tests inyectan la sesión por API en localStorage
  (`wwp_auth`) antes de cargar — el formulario se prueba solo en
  `smoke-02-login-ui`.
- Criterio de fallo: cualquier `pageerror` (excepción JS) + cualquier
  `console.error` fuera de la allowlist (`helpers/console-guard.js` — solo el
  ruido esperado de Odoo/Sheets sin credenciales).

## Archivos

| Spec | Cubre |
|---|---|
| `smoke-01-server` | `/api/health`, redirects `/` y `/wwp.html`, fallback SPA de los 20 paths v227, `no-store`, denylist de `.json` sensibles, contrato login/refresh |
| `smoke-02-login-ui` | formulario real: error con clave mala, entrada con clave buena, persistencia `wwp_auth` |
| `smoke-03-secciones` | deep-link de las 15 secciones Despachos → sección visible + sin errores JS |
| `smoke-04-wwp-tabs` | deep-link de los 9 tabs WWP → panel visible + sin errores JS |
| `flujos-criticos` | vistas de tareas por URL (real) + esqueletos `fixme` que **el equipo debe definir** |
| `smoke-05-core` | contrato Ola 1: core.js servido+immutable, núcleo definido en window, `APP_BUILD` dentro del HTML (= `/api/app-version`), tokens de theme.css en claro y oscuro |
| `smoke-06-isla-basedatos` | contrato Ola 2 (isla piloto): iframe con 13 vistas, subvista por handshake postMessage, la isla actualiza el path real, standalone con sesión del storage, mismo hash de theme.css en shell e isla |
| `smoke-07-islas-ola3` | islas dev-cdp/formacion/politicas/impacto: deep-link embebido renderiza contenido real de cada isla, standalone con sesión del storage, y el badge de formacion llega al shell por postMessage |

## Notas

- Es un paquete **autocontenido**: no mover `@playwright/test` al `package.json`
  raíz (Railway construye la raíz con `npm install --production` y el lockfile
  raíz se deploya).
- Puerto 3100 para no chocar con el dev server local de la 3000.
- Si un cambio legítimo introduce un `console.error` esperado, ampliar la
  allowlist en `helpers/console-guard.js` con comentario del porqué — no
  silenciar el guard.
