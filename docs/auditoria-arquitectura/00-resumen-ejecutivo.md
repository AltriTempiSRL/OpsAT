# Resumen Ejecutivo — Auditoría de Arquitectura OpsAT

> Levantamiento técnico y transferencia de conocimiento · 2026-07-22
> Alcance: 100% del código propio (~72.600 líneas). Método: análisis estático por módulos con verificación directa de los hallazgos críticos contra el código (`archivo:línea`). Sin modificar código de la aplicación.

---

## Qué es OpsAT

Es la **plataforma operativa de almacén y despachos** de Altri Tempi, integrada con el ERP **Odoo**. Digitaliza el flujo físico de la bodega — empaque, despacho, devoluciones, inventario, inspección de vehículos, personal — con evidencia fotográfica y GPS, sobre terminales industriales Zebra y móviles. Está **en producción real** (build v218), en uso diario, desarrollada por una sola persona en ~3 meses (823 commits, may–jul 2026).

## La arquitectura en una frase

Un **monolito cliente-servidor de dos capas, sin frameworks y sin build**: un backend Node.js de un solo archivo (`proxy.js`, 20.766 líneas, ~238 endpoints, sobre el módulo `http` nativo) y un frontend SPA de un solo archivo (`historial.html`, 40.727 líneas, 34 sistemas funcionales), con un backend de datos dual PostgreSQL/archivos JSON (`storage-pg.js`) que es la pieza de ingeniería más limpia del repo.

```
Terminal Zebra/móvil (PWA)
      │
  historial.html ──iframe──▶ index.html (ventas) · almacen-mapa.html (3D)
      │  REST + SSE + WebSocket
  proxy.js  ◀── boot.js (bootstrap async)
      │             │
  storage-pg.js ────┘
      │
  PostgreSQL / Filesystem (JSON + fotos)
      │
  Odoo ERP · OpenAI · Google Sheets/Maps · Web Push
```

## Veredicto

**Sistema maduro en resiliencia operativa y funcionalidad, inmaduro en modularidad de código.** La apuesta arquitectónica — minimizar infraestructura para que un desarrollador itere a máxima velocidad — funcionó: llegó a producción y opera a diario. Pero la deuda estructural (dos archivos gigantes, estado global, duplicación masiva) empezó a cobrar intereses, siendo el caso más claro un bug latente propagado por copy-paste (ver abajo).

### Lo que está sorprendentemente bien
- **Resiliencia de datos de primer nivel**: escritura atómica (`tmp→bak→rename`), guarda anti-vacío que rechaza borrados masivos accidentales, triple backup (rotativo 5 min / snapshot horario / offsite), y un backend PostgreSQL con write-through diferencial, orden fraccional y **rollback de un botón** a archivos JSON.
- **Seguridad de sesión sólida**: PBKDF2-SHA512 (100k iteraciones), `timingSafeEqual` en todas las comparaciones sensibles, y revocación inmediata (el guard relee el usuario en cada request).
- **Fail-open deliberado y auditado** en los gates de Odoo (>20 sitios): la bodega no se detiene si el ERP cae.
- **Realtime multicapa** (WebSocket + SSE + polling) con degradación elegante ante los redeploys de Railway.
- **Comentarios de mantenimiento excepcionales**, con fechas y contexto de cada decisión.

### Lo que hay que arreglar ya (verificado de primera mano)

| # | Hallazgo crítico | Evidencia | Acción | Esfuerzo |
|---|---|---|---|---|
| 1 | **`silentCatch` se invoca 73 veces pero no está definida** — lanza `ReferenceError` desde dentro de cada `catch`; sin handler global de proceso, una promesa rechazada puede tumbar el server. Latente desde el 21-jun, propagado por copy-paste | `proxy.js` (73 usos, 0 definiciones) | Definir la función (1 línea) + handlers de proceso | ~30 min |
| 2 | **API key de Odoo de producción commiteada** en el repo (y en 5 scripts archivados) | `_ron_neg_watch.mjs:3-6`, commit `1dd9827` | Rotar la key en Odoo | ~1h |
| 3 | **El código fuente del servidor es descargable** desde producción (`GET /proxy.js`) | `proxy.js:20459-20467` | Añadir al denylist de estáticos | ~1h |
| 4 | **Las fotos (evidencia legal) no tienen respaldo offsite server-side** — el volumen de Railway es la única copia | `AUDITORIA-WWP-2026-07-06.md:160` | Backup offsite automatizado | ~4-8h |

Los cuatro son de esfuerzo bajo o medio y deberían atacarse antes que cualquier feature nueva.

### Hallazgo notable de arquitectura
**La IA no es Claude, es OpenAI.** Pese a que toda la documentación (CLAUDE.md, `.env.example`) dice "Gerente de Operaciones con Claude/Anthropic", el cliente de Anthropic se instancia pero **nunca se invoca**; los call-sites reales usan `api.openai.com` con modelo `gpt-5.5` (`proxy.js:1545` vs `:1562`). El SDK de Anthropic es una dependencia muerta.

## Riesgos por severidad (24 hallazgos totales)

| Severidad | # | Temas |
|---|---|---|
| 🔴 Crítico | 4 | `silentCatch`, credencial Odoo, fuente descargable, backup de fotos |
| 🟠 Alto | 7 | endpoints sin auth, fuga en `/api/health`, XSS+CSP, contraseñas semilla, JWT artesanal, token en query SSE |
| 🟡 Medio | 9 | monolitos gigantes, código muerto, duplicación, I/O síncrona, doble RBAC, IA OpenAI/Claude, `.gitignore` incompleto |
| ⚪ Bajo | 4 | `FIX_SECRET` muertos, `APP_BUILD` manual, docs imprecisas |

## Recomendación estratégica

**Pagar la deuda crítica sin reescribir.** El sistema no necesita una reescritura — necesita: (1) los cuatro fixes críticos esta semana; (2) cerrar las brechas de autenticación; y (3) empezar a extraer módulos por dominio **detrás de las fachadas que ya existen** (la de persistencia es excelente), comenzando por un router de rutas que rompa la cascada de 227 `if` del backend. La base es funcional y resiliente; el trabajo es estructural e incremental, no una demolición.

---

## Índice de la auditoría

| Documento | Contenido |
|---|---|
| `00-resumen-ejecutivo.md` | Este documento |
| `01-arquitectura.md` | Documento completo: estilo, patrones, capas, flujos de ejecución, estado, eventos, seguridad, calidad, performance, testing, deploy. Diagramas Mermaid (componentes, capas, secuencias) |
| `02-inventario-tecnologias.md` | Todas las tecnologías con versión, propósito y ubicación |
| `03-mapa-modulos.md` | Estructura del proyecto, responsabilidades, dependencias, persistencia, flujo de datos |
| `04-api-integraciones.md` | ~238 endpoints por dominio, cliente Odoo, motor de tareas/SDV, notificaciones, IA |
| `05-riesgos-deuda-tecnica.md` | 24 hallazgos priorizados con evidencia y acción |
| `06-preguntas-abiertas-recomendaciones.md` | Recomendaciones priorizadas, preguntas abiertas, documentación faltante |
```
