# Anexo — Hallazgos UX/IA en formato completo (2026-07-23)

> Anexo de [`10-auditoria-ux-ia-2026-07-23.md`](10-auditoria-ux-ia-2026-07-23.md). 32 hallazgos, numerados UX-01…UX-32, ordenados por área. Estados: **Confirmado** = verificado en código Y en la app corriendo (sandbox local, sesiones por rol); **Probable** = verificado en código; **Requiere validación** = necesita datos de uso u opinión de usuarios.
> Los hallazgos que ya existían en la auditoría técnica 09 con otro ángulo citan su ID original (PR-04, FE-04, API-10, SEC-07…).

---

## Hallazgo UX-01: No existe Administración — usuarios, roles, permisos y RRHH viven dentro del módulo operativo Workforce

**Área:** Arquitectura de información
**Módulo o pantalla:** WWP → tab Usuarios (+ modal de rol + modal de usuario)
**Ruta:** `/wwp/users`
**Rol afectado:** Admin (operador del sistema); indirectamente todos
**Severidad:** Crítica · **Estado:** Confirmado
**Evidencia:** tab construido solo para admin `historial.html:8364`; modal de usuario con contraseña+rol+horario semanal+almuerzo+categoría `historial.html:8016-8125`; modal de rol que edita los `sectionPerms` de las 14 secciones de TODA la app `historial.html:8138-8193`; captura de pantalla del tab en sandbox (lista de cuentas con toggles de configuración por fila).
**Situación actual:** la única puerta a la administración global del sistema es un tab dentro de "Workforce Labor", al mismo nivel visual que "Tareas".
**Problema:** una función de alcance global (gobierna el acceso a toda la app) vive dentro de un módulo operativo de dominio; el alta de una cuenta mezcla identidad/seguridad con parámetros de RRHH.
**Principio de UX incumplido:** Jakob's Law (los usuarios esperan una sección Administración/Configuración); separación configuración/operación; match con el modelo mental.
**Impacto para el usuario:** el admin debe *saber* que la seguridad se administra "dentro de Workforce"; imposible de descubrir o explicar; un futuro segundo admin necesitará entrenamiento oral.
**Impacto para el negocio:** onboarding de administradores dependiente de memoria personal (bus factor 1 también en conocimiento de UI); riesgo de errores al mezclar edición de RRHH con edición de seguridad en el mismo formulario.
**Causa probable:** acreción histórica — WWP fue la app "nueva" donde se añadió el sistema de cuentas, y nunca se separó.
**Recomendación:** crear la sección **Administración** (entrada global, solo admin) con Usuarios y permisos / Personal / Catálogos / Sistema (doc principal §18.3), y mover ahí este tab dividiendo cuenta (identidad+rol) de ficha de empleado (RRHH).
**Nueva ubicación propuesta:** Administración → Usuarios y permisos (+ Personal para la ficha)
**Nuevo nombre propuesto:** "Usuarios y permisos"
**Justificación:** alcance global ⇒ superficie global; audiencia solo-admin ⇒ fuera del camino operativo; frecuencia baja ⇒ no compite con la operación diaria.
**Prioridad:** P1 · **Esfuerzo:** Medio · **Dependencias:** decisión de sitemap (§18); redirect `/wwp/users`→`/admin/usuarios`
**Riesgo de implementación:** Bajo-Medio (el código del tab ya es autocontenido; los e2e de navegación deben actualizarse)
**Criterio de aceptación:** existe `/admin/usuarios`; `/wwp/users` redirige con aviso; el alta de cuenta ya no contiene horario/almuerzo/categoría (viven en la ficha de Personal); e2e verde.
**Métrica de éxito:** tree-test "¿dónde crearías un usuario?" ≥80% acierto sin ayuda (hoy, previsiblemente <30%).
**Método de validación:** tree-testing con 3 usuarios (Fase 5) + matriz de roles verificada en sandbox.

---

## Hallazgo UX-02: Workforce Labor mezcla 4 planos (operación, supervisión, configuración, administración) en 9 tabs hermanos

**Área:** Arquitectura de información
**Módulo o pantalla:** WWP completo
**Ruta:** `/wwp/*`
**Rol afectado:** Todos
**Severidad:** Crítica · **Estado:** Confirmado
**Evidencia:** clasificación tab por tab con evidencia en doc principal §8 (tabla); construcción dinámica por rol `historial.html:8337-8422`; solo Tareas (`7318`) e inspección de Vehículos (`7515`) son operación diaria; Empaque es 100% configuración (`empaque.html:154-178`); Usuarios es administración global (UX-01); Dashboard mezcla 3 dominios (UX-24).
**Situación actual:** una sola barra de tabs presenta "Tareas" junto a "Empaque" (configuración de datos maestros) y "Usuarios" (administración) sin distinción visual ni conceptual.
**Problema:** el contenedor no comunica qué es operación y qué es gestión; la barra cambia de composición según el rol (3/5/9 tabs), de modo que dos usuarios no pueden hablar de "la misma pantalla".
**Principio de UX incumplido:** agrupamiento por función (Gestalt), progressive disclosure, separación configuración/operación.
**Impacto para el usuario:** el encargado y el admin escanean tabs irrelevantes para su intención; el concepto "Workforce" deja de significar algo concreto.
**Impacto para el negocio:** cada función nueva "cae" en WWP por defecto (ya pasó con Empaque, Políticas, Impacto), agravando el problema con el tiempo.
**Causa probable:** WWP nació como app aparte (wwp.html) y absorbió todo lo posterior; los tabs eran el lugar barato donde colgar features.
**Recomendación:** desmontar el contenedor: operación (Tareas, Inspección, Formación-tomar) al sidebar de dominio; supervisión a Panel del equipo + Evidencias + Flota; configuración/administración a Administración (§18.1).
**Nueva ubicación propuesta:** ver matriz de reubicación (doc principal §19)
**Nuevo nombre propuesto:** el grupo operativo pasa a llamarse "Equipo y Tareas" (u "Operación del equipo")
**Justificación:** el 80% del uso diario (auxiliares y encargados en Tareas) no debe convivir con superficies admin de audiencia 1–2 personas.
**Prioridad:** P1 · **Esfuerzo:** Medio (las islas ya son iframes reubicables; plan 08 a favor) · **Dependencias:** UX-01, decisión Políticas/Impacto (UX-25)
**Riesgo de implementación:** Medio (tocar `enterApp`/`switchTab`/rutas `/wwp/*` con aliases)
**Criterio de aceptación:** ningún tab de configuración o administración al lado de Tareas; matriz §18.2 aplicada; deep-links viejos `/wwp/<tab>` responden con redirect.
**Métrica de éxito:** tiempo-a-primera-acción del auxiliar sin cambios o mejor; 0 tickets "no encuentro X" tras 1 mes.
**Método de validación:** prueba por rol en sandbox + e2e.

---

## Hallazgo UX-03: Los grupos del sidebar no corresponden a los dominios del negocio

**Área:** Arquitectura de información / Navegación
**Módulo o pantalla:** Sidebar global
**Ruta:** — (markup `historial.html:5438-5532`)
**Rol afectado:** Admin, Encargado, Ventas (los que ven el sidebar)
**Severidad:** Alta · **Estado:** Confirmado
**Evidencia:** "Mapa Almacén" bajo COMPRAS (`historial.html:5484` en grupo `navg-compras`); portal SDV usado por Operaciones bajo VENTAS (`5500`); "Estado de Órdenes" suelto sin grupo (`5452`); el grupo DESPACHOS contiene auditorías de transferencias (Sin Comprobante) + devoluciones (Dev→CDP) + conduces outlet — tres cosas de naturaleza distinta; captura del sidebar admin en sandbox.
**Situación actual:** 6 rótulos de grupo (Consultar/Análisis Operacional/Plataforma/Compras/Despachos/Ventas) heredados, con items colocados por historia y no por dominio.
**Problema:** el usuario no puede usar el grupo para predecir dónde está una función (information scent roto a nivel de grupo).
**Principio de UX incumplido:** information scent; card-sorting/mental model matching.
**Impacto para el usuario:** búsqueda visual lineal de los 15 items en vez de saltar al grupo correcto.
**Impacto para el negocio:** entrenamiento más largo; errores de navegación.
**Causa probable:** los grupos se crearon una vez y los items nuevos se insertaron donde hubiera espacio visual.
**Recomendación:** reagrupar por dominios reales (§5): Operación del equipo / Ventas→Despacho / Almacén / Supervisión. Ejecutable en Fase 1 **sin mover rutas** (solo mover `<a>` de grupo en el markup).
**Nueva ubicación propuesta:** ver sitemap §18.1
**Nuevo nombre propuesto:** rótulos de grupo por dominio
**Justificación:** los dominios emergen del propio levantamiento (§5), no de una taxonomía externa.
**Prioridad:** P1 (parte ejecutable en Fase 1) · **Esfuerzo:** Bajo · **Dependencias:** glosario aprobado
**Riesgo de implementación:** Muy bajo (markup + `GROUPS` en `core.js:170-177`)
**Criterio de aceptación:** cada item pertenece a un grupo cuyo rótulo describe su dominio; "Estado de Órdenes" tiene grupo.
**Métrica de éxito:** tree-test de 5 funciones ≥80%.
**Método de validación:** tree-testing Fase 5.

---

## Hallazgo UX-04: El flujo formal de reposición (D5) está oculto del menú; el flujo visible no aprueba ni genera tareas

**Área:** Arquitectura de información / Flujos
**Módulo o pantalla:** "Solicitudes Repos." (`section-solicitudes-reposicion`) vs "Reposición Showroom"/"Solicitudes Showroom"
**Ruta:** `/solicitudes-reposicion` (oculta), `/reposicion`, `/solicitudes`
**Rol afectado:** Encargado, Admin
**Severidad:** Alta · **Estado:** Confirmado (código); **Requiere validación** (por qué quedó oculto)
**Evidencia:** nav con `display:none` de fábrica `historial.html:5478`; workflow D5 completo con estados `borrador→pendiente_aprobacion→aprobada→en_proceso→completada` `proxy.js:11024-11032` y puente a tareas `proxy.js:11113`; el flujo visible (checkbox `solToggleRS` `historial.html:20267` → `wwp-solicitudes-showroom.json`) no tiene aprobación ni tareas.
**Situación actual:** dos caminos al mismo objetivo (reponer showroom) con rigor opuesto; el serio es invisible salvo deep-link o permiso explícito.
**Problema:** o bien el negocio pierde el control de aprobación que ya está construido, o mantiene un módulo muerto con costo de mantenimiento.
**Principio de UX incumplido:** visibilidad del sistema; una función = una ubicación canónica.
**Impacto para el usuario:** el encargado usa el camino informal porque es el único que ve.
**Impacto para el negocio:** solicitudes de reposición sin aprobación ni trazabilidad de tarea; inversión de desarrollo (D5) sin retorno.
**Causa probable:** D5 se construyó como workflow formal y quedó detrás de un permiso que nadie otorgó, o se decidió no usarlo y no se retiró.
**Recomendación:** pregunta directa a Gabriel (Fase 0): si el proceso requiere aprobación → fusionar: el checkbox del análisis crea la solicitud en `reposiciones.json` (D5) y el módulo unificado "Reposición Showroom" muestra Análisis+Solicitudes; si no → retirar D5 (código y sección) y documentarlo.
**Nueva ubicación propuesta:** Almacén → Reposición Showroom (vistas Análisis / Solicitudes)
**Nuevo nombre propuesto:** —
**Justificación:** un solo proceso no debe tener dos entidades de datos paralelas con reglas distintas.
**Prioridad:** P1 · **Esfuerzo:** Bajo (decisión) + Medio (fusión) · **Dependencias:** decisión de negocio
**Riesgo de implementación:** Medio si se fusiona (migrar solicitudes showroom activas)
**Criterio de aceptación:** existe un único camino con la política de aprobación decidida; ninguna sección viva queda oculta del menú para los roles que la usan.
**Métrica de éxito:** 100% de solicitudes de reposición nuevas pasan por el camino único.
**Método de validación:** revisión del flujo con el encargado de showroom.

---

## Hallazgo UX-05: La SDV está partida en 3 items de sidebar y no tiene deep-link individual

**Área:** Arquitectura de información
**Módulo o pantalla:** Solicitud de Despacho / Bandeja Solicitudes / Reactivaciones
**Ruta:** `/sdv-portal`, `/sdv-bandeja`, `/sdv-reactivations`
**Rol afectado:** Ventas, Encargado, Admin
**Severidad:** Media · **Estado:** Confirmado
**Evidencia:** tres items `historial.html:5500-5506` (Reactivaciones además `display:none` por defecto); una sola entidad `sdv-solicitudes.json` con FSM única `proxy.js:2295-2301`; deep-link pendiente documentado `MEMORIA-PROYECTO.md:34`.
**Situación actual:** crear, procesar y reactivar la MISMA entidad son tres destinos de navegación; una SDV concreta no es enlazable.
**Problema:** fragmentación artificial de un objeto de negocio único; imposible compartir "mira esta solicitud" por chat.
**Principio de UX incumplido:** una entidad = una ubicación canónica; deep-linking como estándar del propio producto (v227 lo trajo para el resto).
**Impacto para el usuario:** Ventas y Operaciones "viven" en pantallas distintas de lo mismo; contexto perdido al pasar de una a otra.
**Impacto para el negocio:** más items de menú que memorizar; fricción en la coordinación diaria Ventas↔Operaciones.
**Causa probable:** cada pantalla se construyó en un momento distinto del go-live.
**Recomendación:** un módulo "Solicitudes de Despacho (SDV)" con tabs Nueva / Bandeja / Mis solicitudes y Reactivaciones como filtro; deep-link `/sdv/<id>` que abre el detalle.
**Nueva ubicación propuesta:** Ventas→Despacho → Solicitudes de Despacho (SDV)
**Nuevo nombre propuesto:** "Solicitudes de Despacho (SDV)"
**Justificación:** una entidad, un lugar; el rol decide qué tabs ve (Ventas: Nueva+Mis; Encargado: Bandeja+todas).
**Prioridad:** P2 · **Esfuerzo:** Bajo-Medio · **Dependencias:** ninguna dura
**Riesgo de implementación:** Bajo (las 3 secciones ya comparten datos y helpers)
**Criterio de aceptación:** 1 item de sidebar; `/sdv/<id>` funciona desde notificaciones y EO; rutas viejas con alias.
**Métrica de éxito:** clics para procesar una SDV desde notificación ≤2.
**Método de validación:** medición antes/después en sandbox.

---

## Hallazgo UX-06: El trío Reposición/Showroom usa nombres cruzados y backend invertido

**Área:** Terminología / IA
**Módulo o pantalla:** Reposición Showroom · Solicitudes Repos. · Solicitudes Showroom
**Ruta:** `/reposicion`, `/solicitudes-reposicion`, `/solicitudes`
**Rol afectado:** Encargado, Admin
**Severidad:** Alta · **Estado:** Confirmado
**Evidencia:** "Solicitudes Showroom" persiste en `wwp-solicitudes-showroom.json` (`proxy.js:2263`) pero "Solicitudes Repos." persiste en `reposiciones.json` (`proxy.js:452`) — la palabra clave visible no coincide con su almacenamiento; la ruta genérica `/solicitudes` es específica de showroom; los tres labels comparten 2 palabras entre sí.
**Situación actual:** tres pantallas con nombres casi permutables para un solo proceso de negocio.
**Problema:** ni usuarios ni desarrolladores pueden inferir qué pantalla hace qué por el nombre.
**Principio de UX incumplido:** consistencia y estándares; distintividad de etiquetas.
**Impacto para el usuario:** prueba-y-error para encontrar la vista correcta.
**Impacto para el negocio:** soporte oral recurrente; riesgo de registrar en la pantalla equivocada.
**Causa probable:** features añadidas en momentos distintos sin glosario.
**Recomendación:** módulo único "Reposición Showroom" (vistas Análisis / Solicitudes) tras resolver UX-04.
**Nueva ubicación propuesta:** Almacén → Reposición Showroom
**Nuevo nombre propuesto:** "Reposición Showroom · Análisis" y "· Solicitudes"
**Justificación:** un proceso = un módulo con vistas nombradas por función.
**Prioridad:** P1 · **Esfuerzo:** Medio · **Dependencias:** UX-04
**Riesgo de implementación:** Medio (migración/alias de 3 rutas)
**Criterio de aceptación:** máximo 1 item de sidebar para reposición; nombres únicos no permutables.
**Métrica de éxito:** tree-test "¿dónde pides reponer un artículo al showroom?" ≥80%.
**Método de validación:** tree-testing.

---

## Hallazgo UX-07: Dos paradigmas de navegación coexisten sin unificar

**Área:** Navegación
**Módulo o pantalla:** shell (screen-historial ↔ screen-app)
**Ruta:** global
**Rol afectado:** Todos los que ven ambos mundos (admin, encargado)
**Severidad:** Media · **Estado:** Confirmado
**Evidencia:** "Workforce Labor" no es una sección sino un cambio de pantalla (`goToWWP()`→`showScreen('screen-app')` `core.js:477-503`); WWP tiene topbar propia (presencia, perfil) que el resto no tiene (`historial.html:7268-7309`); el sidebar pasa a drawer dentro de WWP; captura del auxiliar con sidebar de 1 item.
**Situación actual:** entrar a Workforce "sale" del dashboard; volver requiere el botón "← Historial" o el drawer.
**Problema:** dos apps pegadas con costuras visibles; la ubicación del menú y del perfil cambia según dónde estés.
**Principio de UX incumplido:** consistencia; ley de la experiencia previa dentro del propio producto.
**Impacto para el usuario:** desorientación de primeros días; explicaciones tipo "primero entra a Workforce y AHÍ busca el tab".
**Impacto para el negocio:** entrenamiento; la fusión posterior de cualquier módulo choca con la frontera.
**Causa probable:** herencia de wwp.html como app separada, embebida después.
**Recomendación:** Fase 2.5: un solo shell — sidebar por dominios siempre visible; topbar única (presencia+perfil+notificaciones global).
**Nueva ubicación propuesta:** —
**Nuevo nombre propuesto:** —
**Justificación:** un paradigma = predecibilidad; además libera el footer del sidebar (notificaciones al topbar).
**Prioridad:** P2 · **Esfuerzo:** Medio · **Dependencias:** UX-02 (reubicación de tabs)
**Riesgo de implementación:** Medio (CSS/JS de show/hide de pantallas; e2e cubre)
**Criterio de aceptación:** el usuario nunca "cambia de app"; perfil y notificaciones en el mismo lugar en todas las secciones.
**Métrica de éxito:** 0 menciones de "¿dónde quedó el menú?" en el mes post-cambio.
**Método de validación:** prueba de usabilidad por rol.

---

## Hallazgo UX-08: Rutas de módulo fantasma y residuos de navegación retirada

**Área:** Navegación / Deuda
**Módulo o pantalla:** router
**Ruta:** `/basedatos`, `/dashboard-ventas`, `/contenedores`
**Rol afectado:** — (higiene)
**Severidad:** Baja · **Estado:** Confirmado
**Evidencia:** rutas en `_MODULE_ROUTES` `proxy.js:20629-20630` que el router client-side no reconoce (`_routeSectionValida` `historial.html:24319-24322`) y caen al landing en silencio; `nav-basedatos` en `applyNavPerms` sin markup (`core.js:156,172`); aliases `inventario-salud`/`validacion` (`historial.html:24152,24414`); tab `auditor` autolimpiante (`historial.html:8357-8360`).
**Situación actual:** el mapa de rutas del servidor y el del cliente divergen; código de navegación apunta a elementos inexistentes.
**Problema:** deuda que confunde a quien mantiene y produce deep-links que "no hacen nada".
**Principio de UX incumplido:** — (higiene técnica con efecto UX menor)
**Impacto para el usuario:** un link viejo a `/basedatos` aterriza al home sin explicación.
**Impacto para el negocio:** costo de mantenimiento y sorpresas en QA.
**Causa probable:** retiros (visor BD, dashboard ventas) sin limpleza completa del router.
**Recomendación:** retirar las 3 rutas de `_MODULE_ROUTES` (con 302 al destino lógico), borrar `nav-basedatos` de core.js, documentar los aliases vivos.
**Nueva ubicación propuesta:** — · **Nuevo nombre propuesto:** —
**Justificación:** el router es el contrato de navegación; debe reflejar la realidad.
**Prioridad:** P3 (entra en Fase 1 por costo casi nulo) · **Esfuerzo:** Bajo · **Dependencias:** re-estampar hash de core.js si se toca
**Riesgo de implementación:** Muy bajo
**Criterio de aceptación:** `_MODULE_ROUTES` == secciones válidas del cliente; e2e del fallback SPA actualizado.
**Métrica de éxito:** — · **Método de validación:** e2e.

---

## Hallazgo UX-09: 21 páginas obsoletas (`_archivo/`, `tests/`) servibles por URL directa en producción

**Área:** IA / Exposición
**Módulo o pantalla:** static serving
**Ruta:** `/_archivo/**.html` (19), `/tests/**.html` (2)
**Rol afectado:** — (cualquier visitante)
**Severidad:** Alta · **Estado:** Probable (deducido del código estático; no se ejecutó request contra prod)
**Evidencia:** allowlist de extensiones permite cualquier `.html` bajo `__dirname` sin denylist de prefijos `proxy.js:20641-20676`; `_archivo/` y `tests/` trackeados en git (→ deployados con `railway up`); entre ellos el `wwp.html` original archivado — mientras `/wwp.html` redirige, `/_archivo/versions-artifact-original/wwp.html` se serviría tal cual.
**Situación actual:** pantallas retiradas de la navegación siguen alcanzables por URL con apariencia de app real.
**Problema:** violación directa de la regla "no dejar pantallas obsoletas visibles"; una URL archivada compartida hace meses sigue mostrando una app vieja con datos mock.
**Principio de UX incumplido:** control del inventario visible; coherencia de la superficie pública.
**Impacto para el usuario:** confusión grave si alguien aterriza en la app vieja (login que no funciona o UI de otra era).
**Impacto para el negocio:** imagen y soporte; superficie de análisis para terceros.
**Causa probable:** el archivado (jul-2026) movió archivos pero el static serving nunca filtró carpetas.
**Recomendación:** denylist de prefijos `/_archivo`, `/tests`, `/docs`, `/scripts` en el static serving (o sacar `_archivo/` del deploy).
**Nueva ubicación propuesta:** — · **Nuevo nombre propuesto:** —
**Justificación:** ya existe el patrón denylist para `.json` sensibles; extenderlo a prefijos es 1 condición.
**Prioridad:** P1 (Fase 1) · **Esfuerzo:** Bajo · **Dependencias:** ninguna
**Riesgo de implementación:** Muy bajo (verificar que ninguna función viva referencia esos paths)
**Criterio de aceptación:** `curl /_archivo/...` → 404; e2e de denylist ampliado.
**Métrica de éxito:** 0 hits legítimos bloqueados tras 2 semanas.
**Método de validación:** curl + e2e.

---

## Hallazgo UX-10: La barra móvil omite Estado de Órdenes, Solicitudes Repos. y Reactivaciones

**Área:** Móvil / Navegación
**Módulo o pantalla:** `.mob-nav`
**Ruta:** — (`historial.html:5543-5558`)
**Rol afectado:** usuarios móviles con esas secciones
**Severidad:** Media · **Estado:** Confirmado (con matiz: los chips están `display:none` en ≤767px y el drawer del sidebar sí lo muestra todo)
**Evidencia:** botones de la mob-nav enumerados sin esos 3 destinos `historial.html:5543-5558`; chips ocultos en móvil `historial.html:3419` ("reemplazados por el drawer").
**Situación actual:** superficie de navegación duplicada (chips) que ya no se muestra pero se mantiene en el código con inventario desalineado.
**Problema:** doble fuente de verdad de la navegación móvil; si los chips se reactivan, faltarán destinos.
**Principio de UX incumplido:** única fuente de verdad de navegación.
**Impacto para el usuario:** hoy menor (drawer completo); latente si se reusa la barra.
**Impacto para el negocio:** mantenimiento de markup muerto.
**Causa probable:** transición al drawer sin retirar los chips.
**Recomendación:** eliminar los chips muertos o regenerarlos desde la misma lista del sidebar (fuente única).
**Prioridad:** P2 · **Esfuerzo:** Bajo · **Dependencias:** —
**Riesgo de implementación:** Muy bajo
**Criterio de aceptación:** una sola definición de items de navegación alimenta ambas superficies.
**Métrica de éxito:** — · **Método de validación:** revisión móvil en sandbox.
**Nueva ubicación propuesta / nombre:** —

---

## Hallazgo UX-11: "Dev→CDP" se lee como pantalla de desarrollo

**Área:** Terminología
**Módulo o pantalla:** sidebar → Dev→CDP (isla dev-cdp)
**Ruta:** `/dev-cdp`
**Rol afectado:** Todos los que lo ven — incluido el dueño del producto
**Severidad:** Alta · **Estado:** Confirmado
**Evidencia:** label `historial.html:5492`; significado real "Devoluciones de tiendas recibidas en almacén CDP" (`dev-cdp.html:6,26-30`); **el brief de esta auditoría lo lista como "funciones o pantallas identificadas como DEV"** — el malentendido está documentado en el propio encargo.
**Situación actual:** abreviatura "Dev" (Devoluciones) colisiona con la convención universal "dev"=desarrollo.
**Problema:** un módulo de negocio parece herramienta interna; candidato erróneo a "ocultar/borrar".
**Principio de UX incumplido:** correspondencia sistema↔mundo real; evitar abreviaturas ambiguas.
**Impacto para el usuario:** módulo infrautilizado o ignorado por parecer técnico.
**Impacto para el negocio:** las devoluciones recibidas (dinero real) pierden visibilidad; esta misma auditoría casi lo clasifica mal.
**Causa probable:** abreviatura de espacio en el sidebar.
**Recomendación:** renombrar label a **"Devoluciones a CDP"** (ruta puede quedar `/dev-cdp` con alias futuro `/devoluciones-cdp`).
**Nueva ubicación propuesta:** grupo Almacén
**Nuevo nombre propuesto:** "Devoluciones a CDP"
**Justificación:** el nombre completo cabe (13 items actuales tienen labels más largos).
**Prioridad:** **P0** · **Esfuerzo:** Bajo (label + mob-nav + título de sección) · **Dependencias:** glosario
**Riesgo de implementación:** Nulo
**Criterio de aceptación:** ninguna superficie muestra "Dev→CDP".
**Métrica de éxito:** en tree-test, "¿dónde ves las devoluciones recibidas en CDP?" ≥90%.
**Método de validación:** tree-testing.

---

## Hallazgo UX-12: "Despacho de Obsoleto" se lee como pantalla obsoleta de despacho

**Área:** Terminología
**Módulo o pantalla:** sidebar → Despacho de Obsoleto
**Ruta:** `/despacho-obsoleto`
**Rol afectado:** Todos
**Severidad:** Alta · **Estado:** Confirmado
**Evidencia:** label `historial.html:5495-5496`; función real: conduces `CO-####` de salida de mercancía OBSOLETO/NAVE2 «como está», con fotos de condición e impresión para firma (`historial.html:6263-6290`, backend `proxy.js:10617-10645`); el brief lo lista como "Despacho obsoleto" entre lo posiblemente retirable.
**Situación actual:** "Obsoleto" (nombre del almacén/categoría de mercancía) leído como adjetivo de la pantalla.
**Problema:** un flujo documental vivo y con valor legal (firma de quien recibe) parece candidato a borrado.
**Principio de UX incumplido:** correspondencia con el mundo real; nombres auto-explicativos.
**Impacto para el usuario/negocio:** mismo patrón que UX-11.
**Causa probable:** nombre interno del almacén trasladado tal cual al label.
**Recomendación:** renombrar a **"Conduces Outlet (Obsoleto/Nave 2)"** — la palabra "conduce" es la que el negocio usa para el documento.
**Nueva ubicación propuesta:** grupo Ventas→Despacho
**Nuevo nombre propuesto:** "Conduces Outlet"
**Justificación:** nombra el ARTEFACTO (conduce) y no la mercancía; desambigua.
**Prioridad:** **P0** · **Esfuerzo:** Bajo · **Dependencias:** glosario (validar "Conduces Outlet" vs "Conduces Obsoleto" con Gabriel)
**Riesgo de implementación:** Nulo
**Criterio de aceptación:** label nuevo en sidebar+mob+título.
**Métrica de éxito:** tree-test ≥90%.
**Método de validación:** tree-testing.

---

## Hallazgo UX-13: "Solicitud" nombra 4 entidades y "Despacho" 3 conceptos sin relación

**Área:** Terminología / Modelo conceptual
**Módulo o pantalla:** transversal
**Ruta:** —
**Rol afectado:** Todos
**Severidad:** Alta · **Estado:** Confirmado
**Evidencia:** 4 entidades "solicitud": SDV (`sdv-solicitudes.json`), reposición D5 (`reposiciones.json`), showroom (`wwp-solicitudes-showroom.json`), staffing (tarea `type:'staffing'`); "Despacho" = SDV (Ventas) vs "Despacho de Obsoleto" (conduce) vs grupo "Despachos" del sidebar (auditorías de transferencias); en Estado de Órdenes las filas son "órdenes" en el título y "solicitudes" en el vacío (`historial.html:7059` vs título `6927+`, verificado en pantalla).
**Situación actual:** los dos sustantivos más importantes de la operación son ambiguos.
**Problema:** imposible comunicar sin desambiguar oralmente ("¿solicitud de qué?").
**Principio de UX incumplido:** un término = un significado (consistencia semántica).
**Impacto para el usuario:** errores de pantalla; conversaciones más largas; búsqueda fallida.
**Impacto para el negocio:** onboarding y soporte.
**Causa probable:** cada feature nombró su entidad localmente.
**Recomendación:** glosario oficial (§12 del principal): "Solicitud de Despacho (SDV)" siempre con apellido; "solicitud de reposición" con apellido; staffing = "Solicitud de Personal" (ya lo es); el grupo "Despachos" del sidebar se disuelve en la reagrupación (UX-03); dentro de Estado de Órdenes unificar fila=orden.
**Prioridad:** P1 · **Esfuerzo:** Medio (barrido de labels) · **Dependencias:** glosario aprobado
**Riesgo de implementación:** Bajo
**Criterio de aceptación:** "solicitud" nunca aparece sin apellido en labels de navegación/títulos.
**Métrica de éxito:** ambigüedad léxica 0 en superficie de navegación.
**Método de validación:** barrido automatizado de labels + revisión.
**Nueva ubicación/nombre:** — (transversal)

---

## Hallazgo UX-14: Cinco variantes de marca para la misma aplicación

**Área:** Terminología / Marca
**Módulo o pantalla:** transversal
**Rol afectado:** Todos
**Severidad:** Media · **Estado:** Confirmado
**Evidencia:** "ALTRI TEMPI / Dashboard Operativo" (`historial.html:5442-5443`), "Ops AT" (`<title>` de islas, manifest "Ops AT"), "Workforce"/"WWP" (módulo y welcome "Bienvenido a Workforce" `7169`), "OpsAT" (repo/URL prod), "Altri Tempi · Ventas" (Estado de Órdenes).
**Problema/Impacto:** el usuario no sabe cómo llamar a la herramienta ("entra al dashboard"/"a Workforce"/"a Ops"); las notificaciones push y el icono PWA dicen "Ops AT" mientras el login dice otra cosa.
**Principio incumplido:** consistencia de identidad.
**Causa probable:** renombres históricos sin barrido.
**Recomendación:** decidir UNA marca visible (propuesta: **"Ops AT"**, corta y ya en manifest/íconos) con subtítulo "Operaciones Altri Tempi"; barrido de títulos.
**Prioridad:** P2 · **Esfuerzo:** Bajo · **Dependencias:** decisión Gabriel · **Riesgo:** Nulo
**Criterio de aceptación:** login, sidebar, manifest, islas y welcome usan la misma marca.
**Métrica/Validación:** revisión visual.
**Ubicación/nombre:** —

---

## Hallazgo UX-15: Estados y tipos de tarea sin fuente única — 6 mapas de tipo y 4 de estado inline divergentes

**Área:** Terminología / Consistencia
**Módulo o pantalla:** transversal (tareas, SDV, KPIs, filtros)
**Rol afectado:** Todos
**Severidad:** Alta · **Estado:** Confirmado
**Evidencia:** mapas de tipo en `historial.html:8503, 9338, 11871, 16027, 18569, 31847` (`packaging`="Empaque" en 4, "Embalaje" en 2 y en el filtro `7362`); estados en `9337, 10688, 18576, 31845` ("En Progreso" vs "En progreso" `7321/7354`); SDV usa "En Proceso" (`4277-4281`) — tres grafías del mismo concepto; KPI introduce "Vencidas" (derivado) y omite Asignado/Validado.
**Problema:** el mismo objeto se etiqueta distinto según la pantalla; el filtro dice "Embalaje" y la tarjeta "Empaque".
**Principio incumplido:** consistencia; single source of truth.
**Impacto usuario:** duda de si son cosas distintas; búsquedas/filtreos fallidos.
**Impacto negocio:** cada nueva vista multiplica la divergencia.
**Causa probable:** copy-paste de mapas inline en cada render.
**Recomendación:** constante única compartida (shell + islas vía core/core-isla) para labels de tipo y estado; decidir grafías oficiales (propuesta: "En curso" para ambos mundos; "Empaque").
**Prioridad:** P1 (Fase 1) · **Esfuerzo:** Bajo-Medio · **Dependencias:** re-estampar hashes (disciplina existente)
**Riesgo:** Bajo (harness de labels puede vigilarlo)
**Criterio de aceptación:** grep de "Embalaje"/"En Progreso"/"En Proceso" en labels = solo la fuente única.
**Métrica:** 0 divergencias en barrido automatizado.
**Validación:** script de barrido + e2e visual básico.
**Ubicación/nombre:** —

---

## Hallazgo UX-16: Labels distintos por superficie para el mismo destino (escritorio vs móvil vs título)

**Área:** Terminología
**Severidad:** Media · **Estado:** Confirmado
**Evidencia:** "Workforce Labor"↔"Workforce" (`5471/5547`), "Artículos Averiados"↔"Averías"↔"Registro de Averías" (`5466/5548/5676`), "Buscador"↔"Buscar" (`5458/5546`), "Solicitud de Despacho"↔"Sol. Despacho" (`5501/5556`), "Evidencias"↔id interno `archivo`.
**Problema/Impacto:** el usuario que cambia de dispositivo no reconoce el destino; documentación/soporte usan nombres distintos.
**Principio incumplido:** consistencia inter-superficie.
**Recomendación:** regla "una función = un nombre" (§12) aplicada en Fase 1; abreviar solo por truncado CSS, no por sinónimo.
**Prioridad:** P2 (entra con Fase 1) · **Esfuerzo:** Bajo · **Riesgo:** Nulo
**Criterio de aceptación:** mismo string en sidebar/mob/título por destino.
**Módulo/Ruta/Rol/Causa/Ubicación/Nombre/Métrica/Validación:** ver UX-14 (mismo patrón).

---

## Hallazgo UX-17: Jerga técnica y de ERP expuesta sin glosario (SDV, OUT, RET, PICK, folio, Kanban, IDs Odoo)

**Área:** Terminología
**Severidad:** Media · **Estado:** Confirmado
**Evidencia:** "SDV" nunca expandida en UI (`6711`); "Cierre del ciclo OUT en Odoo" (`10086`); "RET existente en Odoo" (`6464`); "folio" (`10035`); "Kanban" (`7394`); "Odoo ID (empleado)" (`8124`); almacenes CDP/PTN/NAVE2 sin leyenda (`6635-6648`).
**Problema/Impacto:** auxiliares y vendedoras deben aprender el vocabulario del ERP para usar su propia herramienta; para personal nuevo cada sigla es una barrera.
**Principio incumplido:** hablar el idioma del usuario.
**Causa probable:** los constructores (equipo técnico + Odoo) trasladaron su jerga.
**Recomendación:** expandir sigla en el primer uso por pantalla ("Solicitud de Despacho (SDV)"); tooltip/leyenda para almacenes; "Kanban"→"Tablero" (opcional); mantener OUT/RET/PICK solo en pantallas de Encargado/Admin (su audiencia los domina).
**Prioridad:** P2 · **Esfuerzo:** Bajo · **Riesgo:** Nulo
**Criterio de aceptación:** ningún label de navegación con sigla sin expandir; jerga ERP ausente de las pantallas de auxiliar.
**Resto de campos:** patrón UX-14.

---

## Hallazgo UX-18: El Encargado ve el tab Dashboard pero el backend le responde 403

**Área:** RBAC / Flujo
**Módulo o pantalla:** WWP → Dashboard
**Ruta:** `/wwp/dashboard`
**Rol afectado:** Encargado (manager)
**Severidad:** Alta · **Estado:** Confirmado (código; sandbox sin datos no dispara la carga completa)
**Evidencia:** el tab se construye si `can('dashboard')` y manager tiene `wwp.dashboard:true` (`historial.html:8342`, `proxy.js:2212`); los endpoints de datos exigen admin (`ROLE_PERMISSIONS.dashboard=['admin']` `proxy.js:4819`, usos `14263, 15731, 15840`).
**Situación actual:** pantalla visible cuyo contenido no carga para su segundo público.
**Problema:** frontera frontend/backend desincronizada; el permiso configurable promete lo que el servidor niega.
**Principio incumplido:** visibilidad del estado del sistema; no mostrar lo que no se puede usar.
**Impacto usuario:** encargados con un tab "roto" — y probablemente acostumbrados a ignorarlo (síntoma de módulo sin uso).
**Impacto negocio:** los KPIs de supervisión no llegan a quien supervisa.
**Causa probable:** endurecimiento del backend posterior a la creación del tab.
**Recomendación:** decisión de producto (Fase 0): o abrir los endpoints a manager (si el Panel del equipo es para encargados — recomendado) o quitar el tab a manager.
**Nueva ubicación:** Panel del equipo (§18)
**Prioridad:** P1 · **Esfuerzo:** Bajo · **Dependencias:** decisión (c) de Fase 0 · **Riesgo:** Bajo
**Criterio de aceptación:** rol manager: o ve datos o no ve el tab; nunca 403 silencioso.
**Métrica:** 0 respuestas 403 a managers en dashboard tras el cambio.
**Validación:** sesión manager en sandbox + logs.
**Nombre propuesto:** —

---

## Hallazgo UX-19: Permisos configurables sin ningún efecto (`wwp.usuarios`, `wwp.validar_tarea`) y guard de Empaque divergente

**Área:** RBAC
**Módulo o pantalla:** Editor de roles (modal)
**Ruta:** `/wwp/users` (modal)
**Rol afectado:** Admin (quien configura)
**Severidad:** Alta · **Estado:** Confirmado
**Evidencia:** `wwp.usuarios` en el modal (`historial.html:8173`) pero el tab Usuarios es `role==='admin'` hardcoded (`8364`, `core.js:189`) y `can('users_tab')` no se evalúa nunca; `wwp.validar_tarea` en el modal (`8180`) pero `validate_task` hardcoded solo-admin (`core.js:67,88`); Empaque: build admin-only (`8412`) vs `guardTab` con `can('dashboard')` (`core.js:192`) — un manager con dashboard puede entrar por URL a un tab que no ve.
**Situación actual:** el editor de permisos ofrece interruptores desconectados.
**Problema:** el admin cree delegar (p.ej. validar tareas a un encargado senior) y el sistema lo ignora en silencio.
**Principio incumplido:** honestidad del sistema; prevención de errores de configuración.
**Impacto usuario:** confianza rota en el editor de roles; troubleshooting a ciegas.
**Impacto negocio:** delegación imposible sin tocar código (cuello de botella en Gabriel).
**Causa probable:** permisos añadidos al modal antes/después de endurecer los checks.
**Recomendación:** retirar del modal los interruptores muertos (o conectarlos de verdad, decisión por permiso); unificar build+guard de Empaque; añadir descripción por permiso en el modal.
**Prioridad:** P1 (Fase 1) · **Esfuerzo:** Bajo · **Riesgo:** Bajo
**Criterio de aceptación:** todo checkbox del editor tiene efecto verificable; build==guard para los 9 tabs.
**Métrica:** matriz permiso→efecto verificada al 100%.
**Validación:** prueba de matriz en sandbox (patrón de esta auditoría).
**Ubicación/nombre:** —

---

## Hallazgo UX-20: Dos sistemas de roles coexisten (role-defs vigente vs `wwp-roles.json` legacy por empleado Odoo)

**Área:** RBAC / Modelo
**Severidad:** Media · **Estado:** Confirmado (=SEC-07/R-16 de la auditoría 09, cara UX)
**Evidencia:** sistema vigente `wwp-role-defs.json` (`proxy.js:2203-2260`); carril legacy `wwp-roles.json` mapeando `hr.employee` Odoo→rol usado solo por `GET/PATCH /api/wwp/users` legacy (`proxy.js:12628-12671`).
**Problema/Impacto:** dos respuestas a "¿dónde se administra el rol de X?"; riesgo de editar el carril muerto.
**Recomendación:** confirmar si el carril legacy tiene consumidores; retirarlo o documentarlo como interno.
**Prioridad:** P2 · **Esfuerzo:** Medio · **Riesgo:** Medio (verificar consumidores)
**Criterio de aceptación:** una sola fuente de rol por usuario.
**Resto de campos:** técnicos en SEC-07 (auditoría 09).

---

## Hallazgo UX-21: El rol `ventas` no tiene etiqueta y su experiencia es residual

**Área:** RBAC / Roles
**Módulo o pantalla:** ROLE_LABELS / experiencia Ventas
**Rol afectado:** Ventas
**Severidad:** Media · **Estado:** Confirmado
**Evidencia:** `ROLE_LABELS={admin,manager:'Encargado',assistant:'Auxiliar'}` sin `ventas` (`core.js:415`); ventas excluido de WWP (`core.js:146-149`); su universo = Estado de Órdenes + portal SDV.
**Situación actual:** el 4º rol del sistema es un caso especial cosido con excepciones (regla especial de `estado-ordenes`, exclusión de WWP).
**Problema:** el badge de rol de un usuario ventas no renderiza etiqueta amigable; su navegación es correcta de facto pero no está declarada como experiencia diseñada.
**Recomendación:** añadir `ventas:'Ventas'` a labels; declarar su sidebar (3 items §18.2) como diseño explícito; aterrizaje = Estado de Órdenes (ya ocurre).
**Prioridad:** P2 · **Esfuerzo:** Bajo · **Riesgo:** Nulo
**Criterio de aceptación:** badge correcto; matriz de rol documentada.
**Resto:** patrón UX-18.

---

## Hallazgo UX-22: En el kanban solo el admin puede arrastrar tarjetas (clave de permiso inexistente)

**Área:** RBAC / Flujo
**Módulo o pantalla:** Tareas → vista Kanban
**Ruta:** `/wwp/tasks/kanban`
**Rol afectado:** Encargado
**Severidad:** Media · **Estado:** Confirmado (=FE-04 auditoría 09)
**Evidencia:** el drag chequea `can('tasks_edit')` — clave que no existe en `_PERM_SP_MAP` (la real es `edit_task`) → false para todo no-admin (FE-04, `historial.html` kanban).
**Problema/Impacto:** el encargado (que SÍ puede editar tareas) no puede usar la interacción principal de la vista; percepción de "kanban decorativo".
**Recomendación:** corregir la clave (1 línea) — entra en Fase 1.
**Prioridad:** P2 · **Esfuerzo:** Bajo · **Riesgo:** Nulo
**Criterio de aceptación:** manager arrastra tarjetas según su permiso real.
**Resto:** detalle técnico en FE-04.

---

## Hallazgo UX-23: La recuperación de contraseña no funciona en producción

**Área:** Flujo (autoservicio)
**Módulo o pantalla:** Olvidé mi contraseña
**Ruta:** pantalla `screen-forgot`
**Rol afectado:** Todos
**Severidad:** Alta · **Estado:** Confirmado (=API-10 auditoría 09)
**Evidencia:** sin SMTP configurado el token de reset no se entrega por ningún canal en prod (API-10); el flujo UI existe y promete un correo.
**Problema/Impacto:** el único autoservicio de cuenta está roto; cada olvido = interrupción a Gabriel (impersonación/reset manual).
**Principio incumplido:** recuperación ante errores.
**Recomendación:** o canal real (SMTP/WhatsApp interno) o rediseñar el flujo como "pide el reset a tu encargado" con cola visible para admin.
**Prioridad:** P1 (Fase 3) · **Esfuerzo:** Medio · **Dependencias:** decisión de canal
**Criterio de aceptación:** un usuario recupera acceso sin intervención de Gabriel, o el flujo declara honestamente el camino asistido.
**Resto:** técnico en API-10.

---

## Hallazgo UX-24: El Dashboard de WWP apila tres dominios (tareas + almuerzos RRHH + inspecciones de flota)

**Área:** IA
**Módulo o pantalla:** WWP → Dashboard
**Ruta:** `/wwp/dashboard`
**Rol afectado:** Admin (Encargado cuando se arregle UX-18)
**Severidad:** Media · **Estado:** Confirmado
**Evidencia:** secciones apiladas: KPIs+tendencia de tareas (`historial.html:7410-7422`), Control de almuerzos (`7424-7458`), Inspecciones de vehículos con export (`7460-7494`).
**Problema:** "Dashboard" es un cajón de sastre de supervisión; el historial de inspecciones queda lejos de Vehículos (su dominio).
**Principio incumplido:** agrupación por dominio; nombres descriptivos ("Dashboard" no dice de qué).
**Recomendación:** repartir: KPIs de tareas → Panel del equipo (o header de Tareas); almuerzos → Panel del equipo (sección Personal); inspecciones → Flota.
**Nueva ubicación:** Panel del equipo / Flota (§18)
**Prioridad:** P2 (Fase 2.4) · **Esfuerzo:** Medio · **Dependencias:** UX-02
**Criterio de aceptación:** cada bloque vive en su dominio; el término "Dashboard" desaparece como nombre de tab.
**Resto:** patrón UX-02.

---

## Hallazgo UX-25: Políticas — historial fabricado en producción y sin señales de uso real

**Área:** Producto / IA
**Módulo o pantalla:** WWP → Políticas (isla)
**Ruta:** `/wwp/politicas`
**Rol afectado:** Admin
**Severidad:** Media · **Estado:** Confirmado (PR-04) + Requiere validación (uso)
**Evidencia:** historial de cumplimiento con seed mock en prod (PR-04; `politicas.html:176-195` `pol-mock-notice`); el tab estuvo roto toda la era Node sin reportes (PR-08); audiencia solo-admin; único dato real: cumplimiento en vivo del día.
**Problema:** módulo a medio construir en el nivel más alto de la navegación; datos fabricados junto a datos reales (riesgo de decisiones sobre números falsos).
**Principio incumplido:** honestidad de datos; no mantener módulos por inercia.
**Recomendación:** decisión (Fase 0): (a) completarlo (historial real) y fusionar su monitoreo en Panel del equipo, o (b) retirarlo de la navegación conservando el código. Mientras: etiquetar el historial como simulado de forma inequívoca.
**Prioridad:** P2 · **Esfuerzo:** decisión + Medio · **Dependencias:** datos de uso Fase 0
**Criterio de aceptación:** cero datos fabricados visibles en prod; el módulo existe solo si alguien lo usa.
**Resto:** PR-04/PR-08.

---

## Hallazgo UX-26: La gestión de flota está partida en tres lugares

**Área:** IA
**Módulo o pantalla:** Vehículos (form + modal) / Dashboard (historial)
**Ruta:** `/wwp/vehiculos`, `/wwp/dashboard`
**Rol afectado:** Encargado, Admin
**Severidad:** Media · **Estado:** Confirmado
**Evidencia:** inspección diaria en el tab (`historial.html:7515-7701`); maestro CRUD en modal "Gestionar vehículos" (`27087-27140`); historial de inspecciones en Dashboard (`7460-7494`).
**Problema:** para responder "¿cómo está la camioneta X?" hay que visitar 3 superficies; el maestro (configuración) está dentro de la pantalla operativa.
**Recomendación:** cara operativa (Inspección) se queda; cara de gestión (Flota: maestro+historial+cumplimiento) en una sola pantalla de supervisión; maestro editable desde Administración→Catálogos.
**Nueva ubicación:** Flota (§18.1)
**Prioridad:** P2 · **Esfuerzo:** Medio · **Dependencias:** UX-02
**Criterio de aceptación:** un lugar operativo + un lugar de gestión; cero configuración en la pantalla de inspección.
**Resto:** patrón UX-24.

---

## Hallazgo UX-27: La ficha RRHH del empleado vive dentro del alta de cuenta

**Área:** IA / Configuración
**Módulo o pantalla:** Modal de usuario
**Ruta:** `/wwp/users` (modal)
**Rol afectado:** Admin
**Severidad:** Media · **Estado:** Confirmado
**Evidencia:** horario semanal por día (`historial.html:8060-8111`), almuerzo permitido (`8048-8057`), categoría/equipo (`8114-8118`) y toggles por fila (Resumen/Inspección) dentro del formulario de cuenta; captura del tab Usuarios.
**Problema:** identidad/seguridad (contraseña, rol) y RRHH (horario) en el mismo formulario — dos intenciones, dos riesgos, un solo modal.
**Recomendación:** dividir cuenta (Usuarios y permisos) vs ficha de empleado (Personal), compartiendo el registro de datos.
**Prioridad:** P2 (Fase 2.1) · **Esfuerzo:** Medio · **Dependencias:** UX-01
**Criterio de aceptación:** cambiar un horario no pasa por el formulario de seguridad.
**Resto:** patrón UX-01.

---

## Hallazgo UX-28: Las Solicitudes Showroom no generan tareas (asimetría con el resto de flujos)

**Área:** Flujo
**Módulo o pantalla:** Solicitudes Showroom
**Ruta:** `/solicitudes`
**Severidad:** Baja · **Estado:** Confirmado
**Evidencia:** sin endpoint `crear-tarea` (a diferencia de SDV `proxy.js:16351` y D5 `proxy.js:11113`); completar = checkbox manual (`historial.html:20264`).
**Problema/Impacto:** el traslado físico al showroom no entra al sistema de tareas (sin asignación, evidencia ni trazabilidad — todo lo que el producto sabe hacer bien).
**Recomendación:** al consolidar (UX-04/06), decidir si la solicitud aprobada genera tarea `warehouse_move` (recomendado: sí, reusa la cadena existente).
**Prioridad:** P3 · **Esfuerzo:** Medio · **Dependencias:** UX-04
**Criterio de aceptación:** decisión documentada; si sí, el flujo crea tareas como los demás.
**Resto:** patrón UX-04.

---

## Hallazgo UX-29: Contraste insuficiente del texto terciario (≈1.8:1, 466 usos) y modales sin gestión de foco

**Área:** Accesibilidad
**Módulo o pantalla:** transversal
**Rol afectado:** Todos (crítico en bodega: pantallas con reflejos, guantes, prisa)
**Severidad:** Alta · **Estado:** Confirmado (relacionado FE-11)
**Evidencia:** `--text-3:#a8b5c2` sobre `--bg:#f4f3f1` ≈1.8:1 (AA exige 4.5:1), 466 usos; dark `--text-3:#4a5568` sobre `#14171e` también bajo (`theme.css:95`); focus-trap/retorno de foco: 0 implementaciones (Escape sí existe, 8 handlers).
**Problema/Impacto:** metadatos ilegibles en condiciones de almacén; navegación por teclado se sale de los modales.
**Recomendación:** subir `--text-3` a ≥4.5:1 en ambos temas (cambio en `theme.css`, 1 PR con re-estampado); helper único de focus-trap reutilizado por los modales.
**Prioridad:** P1 (contraste en Fase 1; focus-trap Fase 4) · **Esfuerzo:** Bajo-Medio
**Criterio de aceptación:** tokens pasan AA; Tab no escapa de un modal abierto y el foco regresa al disparador.
**Resto:** FE-11.

---

## Hallazgo UX-30: La isla Formación no tiene ninguna media query (rol auxiliar en terminales Zebra)

**Área:** Responsive
**Módulo o pantalla:** Formación (isla)
**Ruta:** `/wwp/formacion`
**Rol afectado:** Auxiliar
**Severidad:** Media · **Estado:** Confirmado
**Evidencia:** `formacion.html` con 0 `@media` (vs empaque 1, impacto 2); accesible a todos los roles (`historial.html:8387-8395`); los auxiliares operan en móvil/Zebra.
**Problema/Impacto:** matriz del equipo y cursos no refluyen; certificarse desde el dispositivo real es hostil — y la certificación **bloquea la asignación de tareas** (`enforceGate`), así que la fricción tiene efecto operativo.
**Recomendación:** pase responsive de la isla (tarjetas apiladas, tabla→lista) — Fase 4 o antes si el gate se usa activamente.
**Prioridad:** P2 · **Esfuerzo:** Bajo · **Riesgo:** Nulo
**Criterio de aceptación:** curso+examen completables a 375px sin scroll horizontal.
**Resto:** —

---

## Hallazgo UX-31: Estados vacíos sin acción, solo spinners, y estados crudos del backend en Averías

**Área:** Estados de pantalla
**Módulo o pantalla:** transversal
**Severidad:** Media · **Estado:** Confirmado
**Evidencia:** 29 spinners / 0 skeletons; vacíos ad-hoc ("No hay tareas que mostrar" `9215`, "Sin solicitudes activas… Marca artículos en Reposición" `5965` — este SÍ orienta, es el patrón a copiar); Averías renderiza `'+a.status+'` crudo con color fallback (`26250`); denegación de deep-link silenciosa (`24406`).
**Problema/Impacto:** el vacío no enseña el siguiente paso; primer uso = pantalla muerta; estados desconocidos se muestran sin traducir.
**Recomendación:** componente compartido de empty-state (icono+mensaje+CTA) aplicado a las 5 listas top; skeletons en listas de alto tráfico; mapa de estados con fallback visible ("Estado desconocido: X"); toast suave en denegación de deep-link.
**Prioridad:** P2 (Fase 4; CTA de vacíos puede adelantarse a Fase 1) · **Esfuerzo:** Bajo-Medio
**Criterio de aceptación:** las 5 listas top tienen vacío con acción; ningún estado crudo visible.
**Resto:** —

---

## Hallazgo UX-32: Breakpoints sin sistema (14 valores entre 380 y 1100)

**Área:** UI / Deuda
**Severidad:** Baja · **Estado:** Confirmado
**Evidencia:** breakpoints 380, 400, 480, 500, 520, 600, 640, 700, 720, 760, 767, 860, 920, 960, 1100 dispersos (agente terminología §5).
**Problema/Impacto:** comportamientos de reflow impredecibles entre secciones; costo de QA responsive.
**Recomendación:** normalizar a 2 puntos (767/1023 ya son los principales) **gradualmente**, al tocar cada sección — no como big-bang.
**Prioridad:** P3 · **Esfuerzo:** Alto acumulado, Bajo por sección · **Riesgo:** Bajo si es gradual
**Criterio de aceptación:** toda media query nueva usa los puntos estándar.
**Resto:** —

---

*Fin del anexo — 32 hallazgos. Matriz resumida y propuesta en el documento principal.*
