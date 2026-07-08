# Plan de rendimiento — WWP para auxiliares en Android 8 / poca RAM

> **Reporte de traspaso ejecutable.** Escrito 2026-07-02 tras levantamiento de **Mark** (auditoría técnica de frontend) + **Pit** (lente operativa). Diseñado para ejecutarse en otra sesión sin el contexto del chat original. App: `historial.html` (WWP vive aquí; `wwp.html` está DEPRECADO, no tocar).

---

## 0. Objetivo

Los auxiliares usan WWP en teléfonos **Android 8 de muy poca RAM (gama baja)**. Síntoma: "la carga de información está lenta". Meta operativa: **arranque repetido < 3 s a interactivo**, poder abrir la app → ver la próxima tarea → tocarla, **sin que la pantalla se reinicie mientras trabajan**.

---

## 1. Diagnóstico raíz (verificado en código, 2026-07-02)

**La lentitud NO es la red.** El servidor ya comprime: `historial.html` ~1.85 MB → **~420 KB gzip**. El cuello es **CPU + RAM** en gama baja:

1. Parsear ~1.85 MB de HTML + ejecutar **~1.55 MB de JS inline** en cada arranque, gran parte de pantallas que el auxiliar **nunca ve** (admin, SDV, reportes, mapa).
2. Convertir **586 íconos lucide a SVG en el boot** — los `createIcons()` de arranque corren **sin acotar** (`{nodes}`), así que escanean todo el documento.
3. `lucide.min.js` (80 KB gz) está **bloqueante en el `<head>`**, sin `defer`.
4. El HTML se sirve **`no-store` y el Service Worker lo excluye del caché** → cada arranque re-baja y re-parsea todo. En Android 8 la pestaña se descarta por falta de RAM, así que el auxiliar arranca **en frío ~15 veces por turno**, no una.
5. `enterApp()` dispara **7-9 cargas en cascada** antes de mostrar la 1ª tarea; el **poll de 60 s re-renderiza el DOM completo** y puede resetear lo que el auxiliar está tocando.

**Ruta crítica del auxiliar (90% del turno):** login → lista de tareas → drawer de ejecución/cierre.

### Supuestos DESCARTADOS (no invertir aquí — ya verificado)
- ❌ **Leaflet NO carga en la ruta del auxiliar.** `leaflet.js` (144 KB) solo aplica al iframe `/almacen-mapa.html`, que abre admin/manager.
- ❌ **No hay base64 pesado inline.** Los 26 `data:image` son SVG diminutos + plantillas que se llenan en runtime.
- ❌ **`xlsx.min.js` ya está diferido** (solo carga al exportar Excel, que el auxiliar no hace).

> ⚠️ **Los `archivo:línea` de abajo son anclas de referencia del 2026-07-02.** Antes de editar, re-confirmar con `grep`/búsqueda porque el archivo cambia.

---

## 2. Acciones priorizadas

### 🟢 BANDA A — Próximo deploy (horas, riesgo bajo)

| # | Acción | Dónde | Cómo verificar |
|---|--------|-------|----------------|
| **A1** | Añadir `defer` a `lucide.min.js` (o moverlo al final del `<body>`). Los `createIcons()` ya corren en/después de `DOMContentLoaded`, no cambia comportamiento. | `historial.html` (script lucide, ~L20) | La página pinta antes; íconos siguen apareciendo. |
| **A2** | `createIcons()` de boot **acotado a lo visible**: `createIcons({nodes:[<contenedor visible del rol>]})`, e hidratar por pantalla al mostrarla. | `historial.html` (boot ~L8099 y ~L18099) | Ningún ícono visible queda sin convertir; menos CPU en arranque. |
| **A3** | Cachear el `.gz` en memoria por `mtime` (hoy `zlib.gzip()` re-comprime 1.85 MB en **cada request**). | `proxy.js` (gzip on-the-fly, ~L13438) | Menor TTFB; el server no re-comprime cada vez. |
| **A4** | `Cache-Control: max-age=31536000, immutable` + versionado por hash (`?v=<hash>`) en libs (`lucide`, `xlsx`). Hoy es `max-age=3600`. | `proxy.js` (~L13435) + `historial.html` (~L20/L26) | Devtools: libs no revalidan cada hora. |
| **A5** ⚠️ | **Cachear el HTML en el Service Worker** (stale-while-revalidate). Hoy está **excluido a propósito** (`sw.js` ~L43). | `sw.js` (~L43) | Arranque repetido casi instantáneo, incluso offline momentáneo. |

> **A5 = mayor impacto operativo, pero ÚNICO con riesgo de deploy.** Mal hecho deja equipos viejos "pegados" a una versión vieja (ya hubo incidente de version-gate). **OBLIGATORIO amarrarlo al `_checkVersion` existente** (`historial.html` ~L9091, corre cada 60 s; el SW ya hace `skipWaiting`+navigate en activate, `sw.js` ~L26-33): servir del caché para velocidad, pero migrar en cuanto `_checkVersion` detecte versión nueva. Al tocar `sw.js`, **bumpear la constante `CACHE`** (p. ej. `wwp-v47`).

**Recomendación de deploy:**
- **Opción completa (recomendada):** A1–A5 en **un solo deploy**, con A5 validado contra el version-gate.
- **Opción conservadora (menor riesgo la 1ª vez):** A1–A4 ahora, A5 en el siguiente deploy tras validar la migración de versión.

### 🟡 BANDA B — Semana siguiente (días, riesgo medio)

- **B1 · Diferir la cascada de `enterApp()`** (`historial.html` ~L9279): pintar la tarea del auxiliar **primero**; mandar a *idle* lo que no es de su ruta (notificaciones históricas, dropdowns de usuarios, gates que no aplican hoy). Meta: 1ª tarea visible **< 2 s** tras login.
- **B2 · Render incremental de la lista** (`renderTasks`/`filterTasks`, ~L10393; `loadTasks` ~L10338): en cada poll/WS (poll ~L9086) repintar **solo lo que cambió**, preservar checkboxes/scroll y **no** correr `createIcons()`+avatares sobre todas las cards. Meta: **0 reseteos** de lo que el auxiliar está tocando.
- **B3 · Diferir el render del markup de pantallas no-iniciales** (admin/SDV/reportes/mapa) → menos nodos DOM y RAM. Cuidado con TDZ (`renderDrawer` es grande).
- **B4 · Pre-cachear `lucide.min.js` en el array `STATIC` del SW** (`sw.js` ~L3-13) + bump de `CACHE`. 2ª visita instantánea. (1 línea.)
- **B5 · Minificar el JS/CSS inline** (~1.9 MB sin minificar) con un build step, sin romper el flujo de deploy actual.

### 🔴 BANDA C — Estructural (semanas, riesgo alto — deuda, NO próximo deploy)

- **C1 · Partir el monolito** (núcleo del auxiliar + módulos por rol / code-splitting). Fix de fondo a "un rol carga el peso de todos". Requiere validar en hardware real antes de tocar.

---

## 3. Reglas de deploy (Railway)

- **Deploy vía CLI desde la raíz** (NO GitHub): `railway up --service dashboard-despachos --detach`. CLI en `C:\Users\Gabriel Ramirez\AppData\Roaming\npm\railway.cmd`. Ver `RAILWAY.md`.
- **Commitear SIEMPRE antes de deployar** para que el repo no quede detrás de producción.
- **Agrupar en un solo deploy.** Cada deploy Railway = **1-4 min de 502** por conmutación de volumen (sin blue/green). El 502 post-deploy es conmutación, no crash. No fragmentar en varios deploys.
- **Ventana fuera de horario de picking** (temprano AM o fin de turno).
- **Regla de oro:** reporte → **OK explícito de Gabriel** → deploy. Nunca commitear/deployar sin su visto bueno.
- **Verificar tras deploy:** `/api/health` y `/historial.html` en `https://dashboard-despachos-production.up.railway.app`.

### Validación rápida (local, sin stress360)
Para cambios que no dependen de Odoo, usar **test curl dirigido (~10 s)**, NO `_stress360` (700 s+ por reintentos Odoo). Correr local con `restart.bat` (`http://localhost:3000`, `DATA_DIR=...data-local`), usuarios semilla + Bearer.

---

## 4. Medición y KPIs (Pit)

- **Línea base PRIMERO:** cronometrar **3 arranques en un teléfono real de auxiliar** antes de tocar nada, y 3 después en el mismo equipo. *Sin línea base no se declara mejora.*
- **Falta dato in-vivo:** no hay métrica de TTI/RAM en el código; las estimaciones de tiempo son supuestos, no telemetría. Para cerrar diagnóstico: **Lighthouse con CPU throttle 4-6× + red Slow 3G**, o el Performance/Memory profiler en un Android 8 (real o emulado), antes/después de Banda A.
- **KPIs a 7 días:**
  1. TTI cronometrado antes/después en equipo real.
  2. Logins de auxiliares/día (`lastLogin`, ya se rastrea) — proxy de adopción.
  3. Pregunta en el huddle: *"¿se te trabó la app hoy?"* → cero "sí" a la semana 2 = éxito.
- **Comunicación a auxiliares:** casi nada. *"La app va a abrir más rápido. Si un día carga raro justo tras una actualización, ciérrala y ábrela una vez — es normal."*

---

## 5. Checklist de ejecución (para la próxima sesión)

1. [x] Confirmar con Gabriel: **Banda A completa (A1–A5)** — aprobada 2026-07-02 ("procede").
2. [ ] Confirmar con Gabriel: **¿medir línea base en teléfono real antes de tocar código?** (no bloqueó la implementación; sigue pendiente para declarar mejora)
3. [x] Re-confirmar los `archivo:línea` con `grep` — hecho 2026-07-02.
4. [x] Implementar A1–A5 en `historial.html` / `proxy.js` / `sw.js` (`CACHE` → `wwp-v50`, build → v115). **Hallazgo clave:** la copia local de lucide IGNORA `{nodes}`/`{el}` — se creó `lucideHydrate(root)` en historial.html que replica el reemplazo acotado.
5. [x] A5 validado contra `_checkVersion`: simulación de deploy local (v115→v116→v115) — el cliente migró solo en ambas direcciones, HTML re-cacheado, sin quedar pegado.
6. [x] Validación rápida local: headers OK (no-store HTML, immutable ?v=, gzip), caché gz 3-9 ms/req, boot de auxiliar con 0 íconos pendientes, `transferSize:0` (SW sirve del caché), 0 errores JS.
7. [x] **DEPLOYADO a Railway 2026-07-02 ~15:50** con OK de Gabriel. ⚠️ **Commit a GitHub PENDIENTE por decisión de Gabriel** ("solo deploy, el commit a github todavía") — el repo está DETRÁS de producción hasta que autorice commitear.
8. [x] Verificado en Railway: `/api/health` ok build v115 (156 tareas intactas, Odoo ok), HTML no-store+gzip, `?v=` immutable, `sw.js` con `wwp-v50`.
9. [ ] A los 7 días (≈2026-07-09): revisar KPI-1/2/3 y cerrar el ciclo.

> Nota B1 detectada en validación: el escaneo completo de íconos que queda en el boot viene de
> `renderDevoluciones()` y demás cargas async de la cascada de arranque (post-Odoo, no bloquea
> el interactivo). Se resuelve con **B1 — diferir la cascada**, no en Banda A.

---

## 6. Decisiones PENDIENTES de Gabriel

1. **Paquete de Banda A:** ¿completo (A1–A5, con A5 amarrado al version-gate) o conservador (A1–A4 ahora, A5 después)?
2. **Línea base:** ¿medir en teléfono real de auxiliar antes de tocar código?
3. **Alcance:** ¿implementar la banda aprobada, o dejar esto como plan por ahora?

---

*Fuentes: levantamiento Mark (técnico) + Pit (operativo), 2026-07-02. Memoria del proyecto: `project_perf_auxiliares_android8.md`. Aprendizajes técnicos consolidados en el cerebro canónico de Mark; los de Pit están en su respuesta para pasar a `pit.md`.*
