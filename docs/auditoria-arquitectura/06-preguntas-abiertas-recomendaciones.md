# Recomendaciones y Preguntas Abiertas — OpsAT

> Auditoría de arquitectura · 2026-07-22

## Parte A — Recomendaciones priorizadas

Cada recomendación indica el/los riesgo(s) que ataca (ver `05-riesgos-deuda-tecnica.md`), el esfuerzo estimado y el impacto esperado.

### 🔴 Críticas — hacer antes que cualquier feature nueva

| # | Recomendación | Riesgos | Esfuerzo | Impacto esperado |
|---|---|---|---|---|
| C1 | **Definir `silentCatch` + registrar `process.on('uncaughtException'/'unhandledRejection')`** que loguean sin matar el proceso | R-01 | ~30 min | Elimina un `ReferenceError` latente en 73 puntos y el riesgo de caída por promesa rechazada. La mejor relación impacto/esfuerzo del sistema |
| C2 | **Rotar la API key de Odoo** en el ERP y mover el script a `.env` | R-02 | ~1h + coordinación | Invalida la credencial filtrada en el repo y en 5 scripts de `_archivo/` |
| C3 | **Bloquear la descarga del fuente**: añadir `proxy.js`/`boot.js`/`storage-pg.js`/`sync-from-prod.js` al denylist de estáticos, o servir estáticos desde `public/` | R-03 | ~1h | Cierra la exposición del backend completo en producción |
| C4 | **Asegurar respaldo offsite server-side de las fotos** (no depender solo de la tarea de Windows en la máquina de un empleado) | R-04 | ~4-8h | Elimina el punto único de fallo sobre la única copia de la evidencia fotográfica |

### 🟠 Importantes — corto plazo

| # | Recomendación | Riesgos | Esfuerzo | Impacto |
|---|---|---|---|---|
| I1 | **Exigir JWT + permiso a todo endpoint que toque Odoo o datos** (`/api/averias`, `/api/wwp/odoo-order`, `/api/analysis/*`); acotar lo que `index.html` necesite público a un endpoint dedicado y cacheado | R-06B, R-06 | ~1 día | Cierra fugas de inventario/datos y abuso de cuota Odoo/Maps |
| I2 | **Recortar `/api/health` shallow** a `{ok, build, timestamp}`; mover el detalle a `?deep=true` con token | R-05 | ~1h | Deja de filtrar `DATA_DIR` y un fragmento de datos reales |
| I3 | **Unificar el escape HTML** en un solo `escapeHtml` que cubra `& < > " '` y auditar los `innerHTML` con datos de usuario | R-07 | ~2-3 días | Reduce la superficie XSS; prerequisito para quitar `'unsafe-inline'` |
| I4 | **Decidir el proveedor de IA**: si es OpenAI, eliminar `@anthropic-ai/sdk` y corregir la documentación; si es Claude, cablear `anthropicClient` | R-16B | ~2h | Elimina dependencia muerta y confusión de mantenimiento |
| I5 | **Semillas de contraseña aleatorias por despliegue**, entregadas fuera de banda | R-08 | ~2h | Cierra credenciales conocidas para usuarios semilla nunca logueados |
| I6 | **Handshake seguro para SSE/WS**: token efímero de un solo uso o auth en el primer frame WS | R-10 | ~1 día | Deja de filtrar el JWT por query string y autentica el WS |

### 🟡 Mejoras estructurales — mediano plazo

| # | Recomendación | Riesgos | Esfuerzo | Impacto |
|---|---|---|---|---|
| M1 | **Introducir un router de rutas** (tabla `método+patrón → handler`) sin adoptar framework, para romper la cascada de 227 `if` y habilitar middleware de auth/headers | R-11, R-13 | ~1 semana | Base para extraer módulos; elimina las 715 repeticiones de headers |
| M2 | **Extraer módulos por dominio** empezando por SDV e Inventario (ya tienen prefijos propios), detrás de la fachada de datos existente | R-11 | Incremental | Reduce el radio de impacto por cambio; hace testeable cada dominio |
| M3 | **Consolidar los dos sistemas de permisos** en `sectionPerms` y derivar los roles fijos de él | R-16 | ~3 días | Elimina ambigüedad de autorización |
| M4 | **Eliminar código muerto** (`loadAllReports`, `toggleGuidedMode`, `_EO_MOCK_DATA` sin definir, etc.) | R-12 | ~1 día | Reduce 2.5 MB de frontend y quita un `ReferenceError` armado |
| M5 | **Completar `.gitignore`** (colecciones SDV/inventario/GPS, VAPID, carpetas de fotos) y forzar `DATA_DIR` fuera del árbol | R-15 | ~1h | Evita commits accidentales de PII y claves |
| M6 | **Migrar el JWT artesanal a `jsonwebtoken`** o congelar y testear la implementación con vectores adversariales | R-09 | ~1 día | Reduce riesgo de vulnerabilidad sutil en auth |
| M7 | **Higiene de la raíz**: mover `_ron_neg_watch.mjs`, `_mockup_notif_panel.html`, `sync-from-prod.js` (roto) a `_archivo/`; añadir `'use strict'` al frontend | R-17, R-11 | ~2h | Limpia la raíz; el strict mode expone globals implícitos |

### ⚪ Futuras / opcionales

- Introducir un linter (ESLint) y formatter en el repo.
- CI que corra la suite de tests (requiere versionar los `.pem` de test o autogenerarlos siempre).
- Considerar `fs.promises` con cola para las escrituras en modo archivos (R-14).
- Documentar el `APP_BUILD` manual como parte del checklist de deploy (R-20).

---

## Parte B — Preguntas abiertas / áreas ambiguas

Estas son las zonas donde la auditoría no pudo concluir con certeza y se requiere confirmación del equipo original o verificación en runtime.

1. **¿Los endpoints públicos que tocan Odoo son intencionales?** `/api/averias`, `/api/wwp/odoo-order/:ref`, `/api/analysis/*` responden sin JWT. ¿Es por consumo desde `index.html` sin login, o es un descuido? La respuesta cambia si I1 es un fix o un rediseño. **[NO VERIFICADO]**

2. **¿Por qué está instalado el SDK de Anthropic si nunca se invoca?** ¿Fue una migración de Claude → OpenAI a medias, o una intención futura? Determina si I4 es "borrar" o "cablear". **[NO VERIFICADO]**

3. **¿Cuál es el estado real del volumen de Railway (`DATA_DIR`)?** El informe de auditoría interna del 6-jul dejó pendiente confirmar tamaño y uso. Es la única copia de las fotos (R-04). **[pendiente manual del equipo]**

4. **¿Se está usando el backend PostgreSQL en producción hoy, o se revirtió a archivos?** La migración es de jul-2026 y el rollback es trivial (quitar `DATABASE_URL`). El modo activo determina qué riesgos de performance aplican (R-14). **[NO VERIFICADO en runtime]**

5. **¿El seed de usuarios/migración de imágenes tras `listen()` causa problemas?** Hay una ventana donde el server acepta conexiones antes de terminar el seed. **[NO VERIFICADO]**

6. **¿Está mitigada la `/api/maps-key` por restricción de dominio en GCP?** Un comentario lo afirma; no se pudo verificar la configuración de Google Cloud. **[NO VERIFICADO]**

7. **¿La mitigación server-side del token SSE en query string existe?** (rotación / vida corta). El informe del frontend no pudo confirmarla. **[NO VERIFICADO]**

8. **¿Cuán desfasados están los manuales embebidos** (`wwp-guide*.html`, fechados 2026-05-13) respecto a la app actual (v218)? Se sirven sin auth. **[NO VERIFICADO]**

9. **Sufijos exactos de algunos subrecursos** construidos por concatenación de strings (submit de examen de formación, fotos de inspección vehicular, history de políticas) y el consumo exacto de `/api/wwp/metrics/equipo` no se resolvieron al 100%. **[NO VERIFICADO]**

10. **¿Hay afinidad de proceso configurada en Railway?** El realtime (WS/SSE con estado en memoria) asume un solo proceso. Si Railway escalara a múltiples instancias, las señales dirty se perderían entre clientes conectados a instancias distintas. **[NO VERIFICADO]**

---

## Parte C — Documentación faltante (qué debería documentarse mejor)

- **Contrato de datos de cada colección**: no hay esquema (ni JSON Schema ni TypeScript) de la forma de una tarea, una SDV, un usuario. Está implícito en el código.
- **Catálogo de endpoints**: no existe un OpenAPI/Swagger; el único inventario es el que produjo esta auditoría (`04`).
- **Matriz rol × sección × permiso**: el RBAC está disperso entre `ROLE_PERMISSIONS`, `sectionPerms` y los `requireSectionPerm` de cada ruta. Falta una tabla canónica.
- **Runbook de operación** más allá del de caída (`uptime.yml`): qué hacer ante cola de PG atascada, disco lleno, o corrupción de una colección.
- **Diagrama de estados oficial** de tarea y de SDV (esta auditoría los infirió del código).
- **Decisión IA**: qué proveedor, qué modelo, qué prompts (hoy solo en comentarios dispersos).
