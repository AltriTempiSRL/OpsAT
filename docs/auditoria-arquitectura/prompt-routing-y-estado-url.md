# Prompt — Arreglar routing por URL + encontrar errores similares (OpsAT)

> Pegá esto en una conversación NUEVA de Claude Code. Es para arreglar que la app
> no tenga URLs por módulo, y para encontrar otros problemas de la misma clase
> (estado que debería vivir en la URL pero vive solo en JS). Exige verificación
> real en el navegador, no suposiciones.

---

Actúa como ingeniero frontend senior en el repo OpsAT (app en `historial.html`, ~40k líneas, SPA sin framework ni router). Tenés DOS objetivos:

## Objetivo A — Arreglar: cada módulo debe tener su propia URL
**Problema:** la app es una sola página. La navegación solo muestra/oculta secciones con `display`, sin tocar la URL. Consecuencias reales que hay que resolver:
- No se puede compartir ni marcar el link de un módulo (Inventario, Base de datos, etc.).
- Al refrescar (F5) siempre vuelve al inicio, no a la sección donde estaba.
- El botón "atrás/adelante" del navegador no navega entre secciones.

**Contexto del código (verificalo, no asumas):**
- Navegación de secciones de Despachos: `function navTo(section)` → llama `showSection(target)` + `setNavActive(section)` + un init lazy por sección. Las secciones válidas están en el array `var PAGE_SECTIONS=[…]` (~16) y el remapeo en `var NAV_SECTION_MAP={…}`. `var CURRENT_SECTION` guarda la actual.
- Navegación de tabs de Workforce (otra pantalla, `screen-app`): `function switchTab(tab)` (~9 tabs). Entrar/salir de Workforce: `function goToWWP()`.
- Aterrizaje tras login: `function landAfterAuth()` → `enterApp()` → muestra `screen-historial` o `screen-app` según rol.
- Hoy NO hay uso de `location.hash` ni `hashchange` (verificalo: `grep -n "location.hash\|hashchange" historial.html`).
- Ojo: ya se maneja `?notif=`/`?task=` por query string (del service worker) — no lo pises.

**Qué implementar (hash routing, aditivo):**
1. Que `navTo`/`switchTab` reflejen la ubicación en `location.hash` (ej. `#inventario`, `#basedatos`, y para tabs `#wwp/tareas` o similar).
2. Un listener `window.addEventListener('hashchange', …)` que navegue al cambiar el hash (back/forward y edición manual de la URL).
3. Al cargar (dentro/al final de `landAfterAuth`), leer el hash y aterrizar en esa sección/tab si el usuario tiene acceso (`canSection`), en vez del default.
4. **Evitar loops**: guardá contra re-navegar si el hash ya apunta a la sección actual (`target===CURRENT_SECTION`). Al salir a Workforce, limpiá el hash de sección.
5. Respetar permisos: si el hash apunta a algo sin acceso, no navegar (sin toast molesto en carga).

**Verificación OBLIGATORIA en navegador (no declares "listo" sin esto):**
- Levantá local: `DATA_DIR=/tmp/route PORT=3123 ODOO_MODE=off node boot.js &`, abrí `http://localhost:3123/historial.html`.
- Consola sin errores tras cargar.
- Navegar a una sección → la URL muestra `#seccion`.
- Cargar directo `…/historial.html#inventario` → aterriza en Inventario.
- Botón "atrás" del navegador → vuelve a la sección anterior.
- F5 en una sección → se queda en esa sección.
- Confirmá que globals core (`PAGE_SECTIONS`, `navTo`, `showSection`) siguen definidos (sin romper el parse).
- Bump `APP_BUILD` (en `proxy.js` y `historial.html`) para que los clientes reciban el cambio.

## Objetivo B — Encontrar errores SIMILARES (misma clase)
La clase de bug es: **estado que debería ser direccionable/persistente vía la URL, pero vive solo en variables JS y se pierde**. Audita `historial.html` y reportá (sin arreglar, salvo que se pida) otros casos:
- No se puede deep-linkear a un ítem específico (una tarea, orden, SKU) — solo a secciones.
- Estado que se pierde al refrescar: filtros activos, búsqueda escrita, ítem seleccionado, drawer/modal abierto, tab interno.
- Lugares donde el "atrás" del navegador debería cerrar un modal/drawer y no lo hace.
- Cualquier estado navegable guardado solo en globals (`_…`) sin reflejo en URL ni `localStorage`.

Entregá: (1) el arreglo del Objetivo A verificado en navegador, y (2) una lista priorizada de los casos del Objetivo B con `historial.html:línea` y el impacto de UX.

## Reglas
- Additivo: agregá, no borres lógica existente. Este archivo tiene estructura entrelazada (funciones intercaladas con `var` en uso) — **nunca borres por rango sin leer el fin real de cada bloque**.
- Verificá TODO en el navegador antes de decir que funciona.
- Si algo no se puede verificar, decilo explícitamente.
