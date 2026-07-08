# Propuesta: actualización de SDV cuando Odoo cambia después de creada — Pit + Vera + Ron

**Fecha:** 2026-07-01
**Participantes:** Pit (proceso operativo), Vera (SDV + voz de ventas), Ron (mecánica Odoo)
**Alcance:** módulo SDV en `historial.html` / `proxy.js`. Solo análisis y diseño — no se implementó código.

---

## Resumen ejecutivo

El backend ya bloquea la edición de SDV fuera de `pendiente_revision`/`rechazada` (proxy.js L10843-10847); lo que falta es exclusivamente **frontend + una ruta de escape guiada**, no una regla nueva de negocio en Odoo. El corte correcto no es solo `estado==='en_proceso'`: debe ser **estado + `wwpTareaActiva`**, porque hoy existe una ventana donde la SDV ya está `en_proceso` pero **sin ninguna tarea WWP activa** (rama ya visible en `sdvVerDetalle` L29913-29918, "Crear otra Tarea WWP") — en esa ventana, todavía no hay trabajo físico iniciado y editar seguiría siendo razonable en teoría. Odoo mismo no impone ningún bloqueo útil aquí: Ron confirma que `order_line` es editable en `sale/draft/sent` y se bloquea recién en `done`/`cancel` — muy tarde para servir de gate operativo, así que la regla debe vivir 100% en nuestra capa (SDV+WWP), no delegarse a Odoo. El riesgo real a evitar es la fragmentación: sin un campo de vínculo explícito entre la SDV original y la nueva "solicitud adicional", Operaciones recibirá dos folios para la misma orden sin saber que están relacionados, lo que puede duplicar picking o generar despachos parciales no coordinados — ya hay precedente de esto (decisión 2026-07-01: Pit/Vera ya recomendaron deshabilitar el botón de "crear otra tarea" ambiguo por el mismo motivo). La recomendación es una feature de prioridad media-alta, acotada, con un campo nuevo (`solicitudOrigenId`) y sin tocar Odoo ni el gate de pick.

---

## 1. El corte exacto — dónde se apaga la edición (Pit + Ron)

**Hecho verificado (código, 2026-07-01):**
- Backend ya bloquea PUT de la vendedora si `estado !== 'pendiente_revision' && estado !== 'rechazada'` (proxy.js L10843-10847). O sea, hoy en `en_proceso` la vendedora YA NO puede editar vía API, aunque el frontend tuviera un botón — devolvería 400 "Ya fue procesada".
- `sol.wwpTareaActiva` ya se calcula en `GET /api/sdv/:id` (L10789-10798): revisa cada `wwpTarea` vinculada contra `loadWwpTasks()` y marca `true` si alguna tiene status fuera de `{completed, validated, cancelled}`.
- En `sdvVerDetalle` (historial.html L29901-29919), para Ops (`ctx==='bandeja'`) ya existe la distinción:
  - `en_proceso` + `wwpTareaActiva=true` → botón deshabilitado "Tarea en proceso (…)" + "Marcar Despachada".
  - `en_proceso` + `wwpTareaActiva=false` → "Crear otra Tarea WWP" (esta rama es la que Pit/Vera ya recomendaron eliminar el 2026-07-01 por ambigüedad — ver decisión previa en `vera.md`).

**Juicio de Pit (proceso operativo):** el corte NO debe ser solo el estado `en_proceso`. Debe ser un compuesto:
- `pendiente_revision` → editable libremente (aún no llegó a Ops).
- `en_proceso` + `wwpTareaActiva === false` → **zona gris**: Ops ya aprobó pero nadie ha tocado físicamente la orden todavía. Aquí técnicamente se podría permitir actualizar, pero Pit recomienda **tratarla igual que bloqueada** por simplicidad y porque ya se decidió (2026-07-01) que esta ventana no debe usarse para reabrir trabajo — se prioriza claridad sobre flexibilidad marginal.
- `en_proceso` + `wwpTareaActiva === true` (o `despachada`/`cancelada`) → **bloqueado, siempre**. Ya hay una tarea WWP viva: cualquier cambio de artículos ahora es un problema de picking en curso, no de datos.

No hace falta granularidad por sub-estado de la tarea WWP (`assigned` vs `in_progress`) ni por evidencia fotográfica: la primera vez que existe una tarea WWP activa, Operaciones ya invirtió tiempo/pick en esa SDV, y eso basta como corte. Ir más fino (ej. "solo bloquear si ya hay fotos subidas") añade complejidad sin beneficio real, porque el pick ya reservó/movió stock desde el momento en que la tarea existe.

**Juicio de Ron (mecánica Odoo):** confirmado en la bitácora del 2026-06-23 (`ron.md`): en la vista real de `sale.order`, `order_line` (artículos/cantidades) es editable en `draft/sent/approved/sale` y se bloquea recién en `done`/`cancel`. Eso es **demasiado tarde** para servir de gate operativo — cuando Odoo bloquea, el picking ya puede llevar mucho tiempo avanzado. Conclusión: **Odoo NO impone ninguna regla que sirva como corte para este proceso; la regla tiene que vivir enteramente en SDV/WWP**, tal como ya está implementada en el backend. No hay riesgo de duplicar una regla de Odoo porque Odoo no cubre este caso — solo bloquea líneas ya facturadas/entregadas (`qty_invoiced`), que es una situación distinta y más tardía.

---

## 2. Flujo cuando SÍ puede actualizar (`pendiente_revision`) — Vera (UX de ventas)

Hoy: `sdvOpenEditModal` (historial.html L29972+) abre un modal de edición manual de campos locales (receptor, transporte, observaciones, GPS), pero **no dispara el refresh de Odoo automáticamente** ni muestra el diff de artículos. Vera recomienda:

- **Al abrir el modal de edición en `pendiente_revision`**, disparar automáticamente `GET /api/sdv/:id/odoo/refresh` (ya existe) y si `summary.addedCount + removedCount + modifiedCount + fieldChangedCount > 0`, mostrar un **banner de diff** arriba del modal (no un modal separado que agregue un clic más): "Odoo tiene cambios: +2 artículos, 1 modificado. [Aplicar cambios] [Ignorar]". Aplicar debe ser explícito, no automático — la vendedora necesita ver qué cambió antes de aceptarlo, porque puede ser un error de otra persona en Odoo.
- Razón de UX: la vendedora piensa en "ya vendí, ¿cuándo sale?", no en "voy a auditar mi solicitud". Si el sistema aplica el diff sin mostrarlo, ella pierde trazabilidad de qué cambió y por qué (viola el principio de Vera §3.5 "Historial no es adorno"). Mostrar antes de aplicar es más lento en 1 clic pero evita que la vendedora reporte al cliente datos que ya no corresponden a la orden real.
- El botón debe llamarse en el lenguaje de ventas: **"Actualizar desde Odoo"**, no "Sincronizar" ni "Refresh" — Vera insiste en usar el vocabulario que la vendedora ya usa (S07XXX, "orden", "cliente"), no jerga técnica.

---

## 3. Flujo cuando NO puede actualizar (ya en despacho) — Vera + Pit

**Mensaje a la vendedora:** cuando `estado==='en_proceso'` (con tarea activa) o más avanzado, en `ctx==='mis'` — hoy sin ninguna rama, solo datos — agregar:

> "Esta solicitud ya está en preparación por Operaciones y no se puede editar. Si necesitas agregar o cambiar artículos de esta orden, crea una **solicitud adicional** — el sistema la vincula automáticamente a esta."
> Botón: **"Crear solicitud adicional para esta orden"**.

- Este botón pre-llena: `odooOrderRef` (misma orden), `tipoSolicitud`, `clienteNombre`, `direccionEntrega`, `ciudadEntrega`, `receptorNombre/Contacto` — todo lo que ya tiene la SDV original, para que la vendedora solo tenga que revisar/ajustar artículos y confirmar. Reduce fricción y error de captura (uno de los "errores típicos" que Vera ya documenta en §4b: "confirmar con artículos incorrectos por búsqueda rápida").
- **Trazabilidad obligatoria (Vera):** la nueva SDV debe guardar `solicitudOrigenId` (folio/ID de la original). Sin esto, Vera no puede reconstruir "qué pasó con esta orden" cuando aparezcan 2+ folios para el mismo `odooOrderRef` — rompe el principio de auditoría 360 de Vera. Además, la SDV original debería reflejar en su detalle "Solicitud adicional creada: SDV-XXXX" (relación bidireccional, similar a como ya se muestra `wwpTareas` como historial).
- Vera valora que este flujo cumple su regla §4b de "diseño que invita al error o lo evita": en vez de dejar que la vendedora intente editar y reciba un error genérico, el sistema la reencauza con contexto, sin que tenga que llamar a Operaciones para preguntar qué hacer (fricción evitable que Vera ya señala como problema recurrente).

---

## 4. Riesgo operativo — fragmentación de SDVs (Pit)

Sin el vínculo `solicitudOrigenId` y sin una convención visual clara, este flujo puede degenerar en:
- **Picking duplicado**: si Operaciones no ve que dos SDVs son de la misma orden, puede generar dos tareas WWP para la misma orden Odoo, con dos personas preparando la misma mercancía o, peor, la misma tarea validada dos veces (afecta métricas de OTIF y puede duplicar despacho).
- **Confusión en bandeja**: hoy la bandeja de Ops (`sdvBandejaCargar`) no agrupa por `odooOrderRef`. Dos folios para `S09575` aparecerían como dos tarjetas sueltas, sin indicio visual de relación, a menos que se agregue.

**Mitigación mínima recomendada (sin sobre-construir):**
1. Campo `solicitudOrigenId` en el schema de SDV (persistido, no solo UI).
2. En la card (`sdvCardHtml`) y en el detalle, si `solicitudOrigenId` existe, mostrar un badge/link "↳ Adicional de SDV-XXXX" — igual de visible para Ops que para ventas.
3. **No** agrupar automáticamente ni fusionar tareas WWP: cada SDV adicional sigue su propio ciclo de aprobación y su propia tarea WWP si Operaciones decide crearla — igual que hoy. La única diferencia es que ahora queda explícito el vínculo, y Operaciones puede decidir con contexto si conviene esperar/consolidar en el picking físico (decisión humana, no automática).
4. Esto es consistente con la decisión ya tomada el 2026-07-01 (deshabilitar "crear otra tarea WWP" ambigua): Pit y Vera ya establecieron que no se debe inventar un flujo de despacho parcial escondido. La "solicitud adicional" es justamente la vía correcta y explícita para ese caso, en vez del atajo que se descartó.

---

## 5. Recomendación final concreta

**Campos/estado nuevos:**
- `solicitudOrigenId` (string, id de la SDV original) — nuevo campo en el schema de SDV. No requiere estado nuevo ni migración de datos existentes (default `null`/ausente).
- No se necesita ningún estado SDV nuevo. El corte usa lo que ya existe: `estado` + `wwpTareaActiva` (ya calculado).

**Endpoints a tocar:**
1. `POST /api/sdv` — aceptar `solicitudOrigenId` opcional en el body y persistirlo tal cual los demás campos (mismo patrón que `odooOrderRef`).
2. `PUT /api/sdv/:id` (o el endpoint equivalente de edición) — sin cambios de lógica de bloqueo (ya es correcta); solo verificar que el mensaje de error 400 "Ya fue procesada" se traduzca en el frontend a un mensaje accionable (ver punto 3) en vez de mostrarse crudo.
3. `GET /api/sdv/:id` — ya devuelve `wwpTareaActiva`; opcionalmente agregar `solicitudOrigenId` y, si se quiere el vínculo inverso, un campo derivado `solicitudesAdicionales: [...]` (buscar SDVs con `solicitudOrigenId === this.id`) para mostrarlo en el detalle de la original. Esto es un nice-to-have, no bloqueante.
4. `GET /api/sdv/:id/odoo/refresh` — sin cambios de backend; se reutiliza tal cual desde el frontend en el punto 2.

**Qué cambia en `sdvVerDetalle` (`ctx==='mis'`):**
- Agregar rama para `estado==='en_proceso'`:
  - Si `wwpTareaActiva === false` → tratar igual que "bloqueado" (por la decisión ya tomada de no dar flexibilidad en esta zona gris): mostrar el mismo mensaje/botón de "Crear solicitud adicional".
  - Si `wwpTareaActiva === true` (o estado `despachada`) → mismo mensaje + botón "Crear solicitud adicional para esta orden", pre-llenando datos vía un nuevo modal (o reutilizando el modal de creación existente con valores precargados + `solicitudOrigenId` oculto).
- En `pendiente_revision`, modificar `sdvOpenEditModal` para disparar el refresh automático y mostrar el banner de diff antes de que la vendedora edite manualmente (punto 2).
- En la card (`sdvCardHtml`) y en el detalle, mostrar el badge de vínculo si `solicitudOrigenId` existe (punto 4).

**Orden de prioridad de implementación:**
1. **(Alta)** Mensaje + botón "Crear solicitud adicional" con pre-llenado y `solicitudOrigenId` — cierra el hueco más visible que vio Gabriel (SDV en_proceso sin ninguna acción para la vendedora) y evita la llamada a Operaciones.
2. **(Alta)** Persistir y mostrar `solicitudOrigenId` en card/detalle (ambos lados: ventas y bandeja Ops) — sin esto, el punto 1 crea el riesgo de fragmentación del punto 4.
3. **(Media)** Refresh automático + banner de diff en `pendiente_revision` — mejora de UX, no bloqueante; hoy la vendedora puede seguir usando el refresh manual si se expone un botón simple aunque no muestre diff bonito.
4. **(Baja/opcional)** `solicitudesAdicionales` derivado en el detalle de la SDV original, para que Ops vea "esta SDV tiene 1 adicional vinculada" sin tener que buscar por `odooOrderRef` manualmente.

No se requiere ninguna consulta adicional a Odoo en vivo para cerrar este diseño — el comportamiento de bloqueo de `order_line` ya está verificado y documentado por Ron (2026-06-23). Si más adelante se quiere afinar el gate con datos de picking real (ej. bloquear también si el PICK asociado ya está `done` aunque la tarea WWP siga `assigned`), eso sí requeriría una consulta Odoo puntual — no es necesaria para esta primera versión.

---

## Referencias de código verificadas en esta sesión

- `historial.html` L29873-29967 — función `sdvVerDetalle` (rama `ctx==='mis'` sin caso para `en_proceso`).
- `historial.html` L29849-29871 — función `sdvCardHtml`.
- `historial.html` L29972+ — función `sdvOpenEditModal`.
- `proxy.js` L10471-10585 — endpoint `GET /api/sdv/:id/odoo/refresh`.
- `proxy.js` L10778-10803 — endpoint `GET /api/sdv/:id` (cálculo de `wwpTareaActiva`).
- `proxy.js` L10840-10879 — endpoint `PUT` de edición de SDV (bloqueo de edición fuera de estados tempranos).
- `proxy.js` L10712-10761 — endpoint `POST /api/sdv` (creación).

## Registro en cerebro canónico de agentes

Esta decisión quedó registrada en Zona B (§6 Decisiones) de:
- `C:\Users\Gabriel Ramirez\OneDrive\Documentos\Agentes-Estandar\pit.md`
- `C:\Users\Gabriel Ramirez\OneDrive\Documentos\Agentes-Estandar\vera.md`
- `C:\Users\Gabriel Ramirez\OneDrive\Documentos\Agentes-Estandar\ron.md`
