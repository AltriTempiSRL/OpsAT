# Plan de Go-Live — Workforce Platform Altri Tempi

**Fecha:** sábado 13 de junio de 2026 · **Go-live:** lunes 15 de junio de 2026
**Dueño del plan:** Pit (gerente de operaciones)
**Modalidad decidida por Gabriel:** Encendido total de WWP el lunes (toda la funcionalidad, todos los usuarios, a la vez) + **operación en PAPEL en paralelo como respaldo el día 1**
**Soporte de datos:** Ron (Odoo) · Validación UX/móvil: Mark · Suite y verificación en vivo: QA-WWP

---

## A. Resumen ejecutivo

Como dueño del proyecto, mi lectura es clara: **el código está listo, la configuración y las personas no del todo.** Los tres gaps más peligrosos del barrido ya están cerrados en código y verificados (devoluciones desde Odoo, OpsAgent por rol, puente Averías↔WWP). El riesgo real del lunes NO es de software: es de **configuración** (solo 1 de N reglas de empaque cargada, `wwp-locations` vacío) y de **adopción** (la mayoría de auxiliares con `lastLogin: null` — nunca han usado la app).

**Trade-off registrado:** yo recomendaba encendido por fases (primero un piloto controlado) precisamente por el riesgo de adopción. **Gabriel decidió encendido total el lunes.** Es una decisión legítima — acelera el aprendizaje real y evita meses de "medio sistema". Pero el encendido total **solo es viable con las máximas redes de seguridad**, y esas redes son las que estructura este plan: (1) cargar las reglas de empaque top este fin de semana, (2) **operación en papel en paralelo el día 1** como colchón que garantiza que el almacén no se detiene aunque WWP falle, (3) Go/No-Go medible el domingo en la noche, y (4) un rollback claro que NO para la operación. El éxito del lunes no se mide en features encendidas: se mide en **auxiliares y encargados usando la app de verdad** (ADKAR: Awareness → Desire → Knowledge → Ability → Reinforcement).

---

## B. Estado de preparación y riesgos

Clasificación: 🔴 bloqueante (no se da Go sin cerrarlo) · 🟡 mitigable (se enciende con red de seguridad) · 🟢 post-launch (se resuelve en estabilización).

| # | Riesgo | Dato verificado (corte 13-jun, fuente) | Clasif. | Acción de cierre | Responsable | Límite |
|---|--------|----------------------------------------|---------|------------------|-------------|--------|
| R1 | Reglas de empaque casi sin configurar | `empaque-reglas.json` = **1 sola regla** (categ 91 "Espejos"); `empaque-materiales.json` = 2 materiales (JSON local). Casi ningún artículo mostrará su regla al auxiliar el lunes (gap H1/G10, config viva) | 🔴 | Cargar reglas de empaque de las **top categorías** (cobertura por `categ_id` de mayor volumen) | Ron (datos Odoo) + coordinador (carga) | **Domingo 18:00** |
| R2 | Auxiliares nunca han entrado a la app | Mayoría de auxiliares con `lastLogin: null` en `wwp-users-auth.json` (2 admin + 3 managers + ~10 auxiliares con `odooId`) | 🔴 | Capacitación + **login verificado de cada auxiliar** antes del lunes (cada uno entra al menos 1 vez con su teléfono) | Coordinador + encargados | **Domingo 16:00** |
| R3 | Despliegue en vivo y login no verificados en producción | Diagnóstico hecho contra **código + JSON local**; sin credenciales WWP en sesión no se barrió producción (`.env.txt` solo trae Odoo/SMTP) | 🔴 | Verificar deploy en Railway + login en vivo por rol + suite end-to-end | QA-WWP | **Domingo 20:00** |
| R4 | `wwp-locations` vacío | `wwp-locations.json` = **VACÍO** (JSON local). El pick trae ubicación desde Odoo (`stock.move.line`); WWP no tiene catálogo propio de ubicaciones físicas | 🟡 | Confirmar con Ron que la ubicación del pick llega desde Odoo y NO depende de `wwp-locations`; si la app no la usa para el flujo del lunes → post-launch; si la usa → poblar mínimo viable | Ron + QA-WWP | **Domingo 18:00** (decisión) |
| R5 | Devoluciones: cabecera sin detalle | `loadDevoluciones()` (historial.html L13484) consulta Odoo (`stock.picking`, name ilike RET, 90 días) — **resuelto en código**. Limitación: cabecera sin artículos/motivo/valor/vendedor (L13522-13533) | 🟢 | No usar el panel de devoluciones para decisión comercial el día 1; enriquecer en semana 1+ | Ron + Mark | Post-launch |
| R6 | RBAC / permisos por rol mal aplicados en vivo | `wwp-role-defs.json` base OK; `sectionPerms` por rol: admin=todo, manager=5 claves wwp.*, assistant=solo GPS. No verificado en producción en vivo | 🟡 | QA-WWP valida RBAC real (admin/manager/assistant) en Railway | QA-WWP | **Domingo 20:00** |
| R7 | TDZ `renderDrawer` / errores JS de arranque | Riesgo conocido de orden de inicialización; no verificado en vivo | 🟡 | QA-WWP corre el drawer end-to-end en vivo (abrir tarea, ver ítems, condición, fotos) sin errores de consola | QA-WWP | **Domingo 20:00** |
| R8 | Gaps de integración ya cerrados (verificación de regresión) | D2 OpsAgent por rol (L5603-5608) y D3 puente Averías↔WWP `notifyDamage` (proxy.js ~L8050-8083, con dedup) — **resueltos**. Falta confirmar que el deploy en vivo los incluye | 🟢 | QA-WWP confirma en el build desplegado | QA-WWP | Domingo |
| R9 | Resistencia al cambio / "WhatsApp paralelo" | Juicio (no medido): el equipo opera hoy por chat/voz/papel; el riesgo es que sigan usando el canal viejo y no la app | 🟡 | Campeones por zona + huddle de arranque + reforzar que el papel del día 1 es respaldo, no canal permanente | Pit + encargados | Lunes |

**Lectura:** los 3 bloqueantes (R1, R2, R3) son cerrables este fin de semana. Ninguno es de código. Si los tres se cierran, el encendido total con red de papel es defendible.

---

## C. PRE-implementación (sábado y domingo) — checklist accionable

Formato: **QUÉ · QUIÉN · CRITERIO DE HECHO · CUÁNDO**

### C.1 Puerta de Ron — auditoría de datos Odoo + carga de reglas
- **Auditoría de cobertura de reglas de empaque** · Ron · Lista de las top categorías (`categ_id`) por volumen de artículos en tareas activas/próximas, con % de cobertura actual (hoy: ~0% salvo Espejos) · **Sábado AM**
- **Carga de reglas de empaque top** (cierre de R1/H1/G10) · Ron (define material/regla por categ) + coordinador (escribe en `empaque-reglas.json`) · Las top categorías que cubren el grueso del volumen del lunes tienen regla cargada; verificado abriendo un ítem de cada categoría top y viendo su regla en el drawer · **Sábado–Domingo 18:00**
- **Auditoría de picks/ubicaciones** · Ron · Confirmar que los picks de las órdenes del lunes están `done` o en estado tal que el gate de pick no bloquee de forma masiva; que la ubicación viene del `stock.move.line` · **Domingo AM**
- **Auditoría de reservas y disponibilidad** · Ron · Las órdenes a despachar el lunes tienen stock reservado (no solo on-hand); marcar las que estén en backorder · **Domingo AM**
- **Decisión `wwp-locations`** (R4) · Ron + QA-WWP · Confirmado si el flujo del lunes usa `wwp-locations` o solo la ubicación del pick Odoo; si no la usa, queda post-launch documentado · **Domingo 18:00**
- **Auditoría devoluciones** · Ron · Confirmar que `loadDevoluciones` trae cabeceras RET sin romper la vista; documentar que NO sirve para decisión comercial el día 1 (R5) · **Domingo PM**

### C.2 Puerta de Mark — validación UX/móvil
- **Validación móvil del auxiliar (teléfono)** · Mark · El flujo del auxiliar (recibir tarea → abrir drawer → ver ítems y regla de empaque → registrar condición → subir foto → marcar terminado) funciona en pantalla de teléfono, sin elementos cortados, con botones tappables · **Domingo AM**
- **Validación del encargado** · Mark · El encargado puede asignar, ver carga, completar y enviar a validación; estados claros (pending→assigned→in_progress→completed→validated) · **Domingo AM**
- **Estados vacíos y mensajes de error** · Mark · Si una tarea no tiene regla de empaque, el drawer muestra un estado claro (no un error roto); mensajes de error legibles para usuario no técnico · **Domingo AM**
- **Flujo por rol** · Mark (con QA-WWP) · admin/manager/assistant ven solo lo que les corresponde; el auxiliar no ve secciones de admin · **Domingo PM**

### C.3 Puerta de QA-WWP — suite end-to-end y verificación en vivo
- **Suite end-to-end** · QA-WWP · Ciclo completo de una tarea de empaque/despacho con datos reales: crear/asignar → drawer → condición → foto → completar → validar (solo admin); reportado `✓/✗/NO PROBADO` · **Domingo PM**
- **RBAC por rol** · QA-WWP · admin (todo), manager (5 claves wwp.*), assistant (solo GPS) verificado en vivo; ningún rol accede a lo que no debe · **Domingo 20:00**
- **Gates HTTP** · QA-WWP · Endpoints responden con el código correcto; PATCH de condición/estado funcionan; ningún 500 en los flujos del lunes · **Domingo 20:00**
- **TDZ `renderDrawer`** (R7) · QA-WWP · Abrir el drawer en vivo sin error de inicialización ni consola roja · **Domingo 20:00**
- **Verificación de deploy en Railway** · QA-WWP · El build desplegado incluye D1/D2/D3 (devoluciones, OpsAgent por rol, puente averías `notifyDamage` con dedup); commit/build confirmado · **Domingo 20:00**
- **Login en vivo por rol** · QA-WWP · Al menos 1 admin, 1 manager y 1 assistant logean exitosamente en producción desde teléfono · **Domingo 20:00**

> **Nota de honestidad (límite declarado):** el diagnóstico de Pit se hizo contra código + JSON local; **no se barrió producción en vivo** por falta de credenciales WWP en sesión. La verificación en vivo (deploy, login, RBAC, drawer) es **puerta obligatoria de QA-WWP/Ron antes del domingo en la noche** y es lo que convierte este plan de "debería funcionar" a "verificado".

### C.4 Datos maestros, capacitación y gestión del cambio
- **Carga de reglas de empaque top** · (ver C.1, R1) · cubierto arriba · **Domingo 18:00**
- **Catálogo de ubicaciones** (R4) · Ron · resuelto o documentado como post-launch · **Domingo 18:00**
- **Usuarios y roles** · Coordinador · Los ~10 auxiliares + 3 managers + 2 admin tienen credenciales activas, rol correcto y `odooId` mapeado; lista impresa para el huddle · **Domingo 16:00**
- **Capacitación SEPARADA por rol:**
  - *Auxiliares* · Pit (guion) + encargados (dan la sesión) · Sesión corta (30–40 min) enfocada en SU flujo en el teléfono: recibir tarea, abrir, ver regla del artículo, registrar condición, foto, marcar terminado, pedir ayuda (Andon). Criterio de hecho: **cada auxiliar completa una tarea de práctica de punta a punta en su propio teléfono** · **Sábado/Domingo**
  - *Encargados* · Pit · Sesión separada (45–60 min): asignar, balancear carga (4+ = sobrecarga), completar, enviar a validar, leer el tablero, escalar averías. Criterio de hecho: cada encargado asigna y cierra una tarea de práctica · **Sábado/Domingo**
- **Definición de campeones (ADKAR)** · Pit + encargados · 1 campeón por zona/turno (auxiliar respetado que ya entendió la app) designado y briefeado para apoyar a sus pares el lunes · **Domingo**
- **Comunicación al equipo** · Pit · Mensaje único y claro al equipo: qué cambia el lunes, **por qué** (trazabilidad, evidencia, menos errores en piezas premium), que habrá respaldo en papel, a quién pedir ayuda. Que quede claro que el papel del día 1 es red de seguridad, NO el canal permanente · **Domingo PM**
- **Simulacro / dry-run con datos reales** · Pit + encargados + QA-WWP · Ensayo del lunes con 2–3 órdenes reales: huddle simulado, asignación, empaque con foto/condición, validación, y registro en papel paralelo. Criterio de hecho: el ciclo completo corre sin que nadie se trabe · **Domingo PM**
- **PLAN DE ROLLBACK preparado** (ver D.5) · Pit · Documentado, comunicado y con responsable de decisión definido antes del lunes · **Domingo PM**

---

## D. DURANTE (lunes, día 1) — operación asistida

Principio rector: **mover menos, mover mejor, mover con evidencia.** El día 1 NO es para máxima productividad; es para **adopción sin daño y sin detener el almacén.**

### D.1 Huddle de arranque (07:30–07:50)
- Quién sale hoy (órdenes/rutas del día), qué está bloqueado (picks no `done`, averías abiertas), quién está sobrecargado, qué decisión necesita el admin.
- Recordar las 3 reglas de oro del día: (1) toda pieza H3–H5 con foto de condición antes de mover, (2) si la app no muestra la regla de empaque del artículo, **se registra en papel y se sigue** (no se detiene), (3) cualquier duda → Andon al campeón/encargado, no improvisar.
- Confirmar campeones por zona y que cada auxiliar tiene su teléfono con sesión iniciada.

### D.2 Soporte en piso (gemba) por persona/zona
- Pit + encargados + campeones recorren el piso de forma continua las primeras 3–4 horas.
- Asignación de soporte: un campeón/encargado por zona (recepción, picking/staging, empaque, despacho), de modo que **ningún auxiliar quede sin alguien a quien preguntar a la vista**.
- Foco en las primeras tareas de cada auxiliar: que la primera la completen acompañados (Ability en ADKAR).

### D.3 Qué monitorear en vivo (tablero)
- **Adopción** (el KPI #1 del día): nº de auxiliares que efectivamente abrieron y completaron al menos una tarea en la app (vs. `lastLogin` null de antes). Es la métrica que dice si el cambio está prendiendo.
- **Vencidas / atascadas:** tareas mucho tiempo en `in_progress` sin evidencia nueva.
- **Cuellos de botella:** despachos esperando picks no `done` (gate de pick), subtareas frenadas por `dependsOnPrev`.
- **Carga por persona:** sobrecargados (4+) vs. libres → rebalanceo en caliente.
- **Calidad / averías:** cualquier `condition: damaged` → escalar siempre; confirmar que el puente `notifyDamage` crea el registro en averías.
- **Pendientes de cierre:** completadas sin validar (solo admin valida), fotos/condiciones faltantes.
- **Errores de sistema:** consola/errores HTTP reportados por auxiliares → QA-WWP de guardia.

### D.4 Señales Andon y escalamiento
| Señal (Andon) | Quién atiende | Tiempo objetivo | Escala a |
|---------------|---------------|-----------------|----------|
| App no muestra regla de empaque del artículo | Encargado | inmediato | Se registra en papel, sigue; Ron carga la regla faltante |
| Ubicación no encontrada / pick no listo | Encargado | inmediato | Ron (Odoo) |
| Artículo dañado (avería) | Encargado | inmediato | Admin (decisión) + verificar que se creó la avería |
| Bloqueo de sistema / error en pantalla | Campeón → QA-WWP de guardia | 15 min | Si afecta a varios → evaluar rollback (D.5) |
| Auxiliar no puede logear / app trabada en su teléfono | Campeón | inmediato | Opera en papel mientras se resuelve |

### D.5 Operación en PAPEL en paralelo (el colchón del día 1)
- **Qué se registra en papel** (hoja simple por orden/auxiliar): nº de orden, cliente, artículos preparados, condición (OK / avería + tipo), quién lo hizo, hora, ¿foto tomada sí/no?, ruta/staging. Es el registro mínimo para que, si WWP falla, **el despacho no se detenga y no se pierda trazabilidad**.
- **Regla operativa:** la app es el sistema primario; el papel es el respaldo. Si la app funciona, se usa la app y el papel es el espejo de seguridad. Si la app falla para un auxiliar/zona, **ese auxiliar/zona opera en papel y sigue produciendo.**
- **Conciliación al cierre del día** · Pit + encargados · Al terminar el turno se cotejan las hojas de papel contra lo que quedó registrado en WWP: toda orden despachada debe existir en ambos; las diferencias (orden en papel pero no en WWP) se cargan o se documentan como hueco a cerrar. Criterio: **0 órdenes despachadas sin trazabilidad** (en uno u otro sistema), y lista de lo que faltó capturar en la app para corregir el martes.

### D.6 Procedimiento de ROLLBACK (cuándo, quién decide, cómo NO se detiene el almacén)
- **Quién decide:** Gabriel (o, si no está disponible, Pit con confirmación de Gabriel por mensaje). La decisión NO la toma un auxiliar ni se decide en caliente sin escalamiento.
- **Cuándo se evalúa rollback** (gatillos): error de sistema que impide a **varias** zonas trabajar y QA-WWP no lo resuelve en ~30 min · pérdida de datos/trazabilidad detectada · el flujo de un proceso crítico (despacho del día) se está retrasando por la herramienta, no por la operación.
- **Qué significa rollback aquí:** NO es apagar el almacén. Significa **caer 100% a la operación en papel** (que ya está corriendo en paralelo) para los procesos afectados, mientras QA-WWP/Mark estabilizan la app. El almacén sigue despachando con papel; WWP se reincorpora por zona a medida que se estabiliza.
- **Reanudación:** se vuelve a WWP cuando QA-WWP confirma el fix en vivo y se hace una prueba con 1 orden antes de reabrir la zona. Todo lo registrado en papel durante la caída se concilia en WWP al cierre (D.5).

---

## E. POST (semana 1 de estabilización)

### E.1 KPIs con línea base desde el día 1
La línea base se captura **el lunes mismo** (no antes — antes no había datos de uso). Cada KPI con meta y tendencia, no número suelto.

| KPI | Cómo se mide | Meta semana 1 | Por qué |
|-----|--------------|---------------|---------|
| **Adopción real** (uso, no features) | nº auxiliares que completan ≥1 tarea/día en la app ÷ auxiliares activos | ≥ 80% al día 3, 100% al día 5 | Es el verdadero indicador del cambio (ADKAR) |
| % cierres con evidencia completa | tareas completadas con foto + condición ÷ completadas | ≥ 90% | Calidad de trazabilidad en piezas premium |
| Tareas atascadas (>X h sin evidencia) | conteo del tablero | tendencia a la baja | Detecta abandono del flujo / retorno al chat viejo |
| Cobertura de reglas de empaque | % de ítems del día que muestran su regla en el drawer | ≥ 90% al día 3 | Cierra el gap R1 que arrancó incompleto |
| Averías escaladas correctamente | averías con registro en el módulo ÷ daños reportados | 100% | Valida el puente notifyDamage en operación real |
| % órdenes en papel vs. app | órdenes solo-en-app ÷ total | crece cada día | Mide cuándo el papel deja de ser necesario |
| Lead time orden → despacho (línea base) | desde código/tablero | establecer base, no mejorar aún | Base para Kaizen posterior |

### E.2 Cadencia de seguimiento
- **Huddle diario** (07:30) toda la semana 1: adopción de ayer, atascos, averías, qué decidir hoy.
- **Cierre diario** (Pit): terminadas / pendientes / bloqueadas / evidencias faltantes / incidentes / aprendizajes / prioridades de mañana + conciliación papel↔WWP.
- **Retro al viernes (día 5):** tendencia de los KPIs + 1–2 acciones Kaizen priorizadas (impacto × esfuerzo).

### E.3 Ciclo de feedback y Kaizen
- Buzón simple (con el campeón) de "qué te traba de la app" recogido en cada huddle.
- Los gaps que arrancaron incompletos (reglas de empaque faltantes, ubicaciones, enriquecimiento de devoluciones R5) entran al **Kaizen backlog** priorizado, no se improvisan en caliente.
- Cada queja recurrente → 5 porqués antes de "arreglar la app": ¿es código, config o capacitación?

### E.4 Validación de ADOPCIÓN real (no features)
- No declarar éxito por "todo está encendido". Declararlo por **uso sostenido**: que al día 5 los auxiliares usen la app sin que un campeón esté al lado, y que el chat/WhatsApp paralelo haya bajado.
- Refuerzo (ADKAR-Reinforcement): reconocer en el huddle a quien adoptó bien; corregir sobre el proceso, nunca culpar a la persona.

### E.5 Criterios de "implementación estable" (para retirar el respaldo en papel)
Se retira el papel cuando, de forma sostenida (≥3 días seguidos):
1. Adopción ≥ 95% (auxiliares completando en la app).
2. ≥ 90% de cierres con evidencia completa.
3. 0 errores de sistema bloqueantes nuevos.
4. Conciliación papel↔WWP da 0 diferencias 3 días seguidos (la app captura todo lo que captura el papel).
5. Cobertura de reglas de empaque ≥ 90%.

Hasta cumplir esos 5, el papel sigue como red. Quitarlo antes es volver a confiar en un sistema no probado en condiciones reales.

---

## F. Go / No-Go del domingo en la noche

Checklist medible. **Todos los 🔴 deben estar en ✓ para dar Go.**

| # | Criterio (medible) | Verifica | Estado |
|---|--------------------|----------|--------|
| 1 | 🔴 Reglas de empaque de las top categorías cargadas y visibles en el drawer (R1) | Ron + coordinador | ☐ |
| 2 | 🔴 Cada auxiliar logeó al menos 1 vez en su teléfono y completó 1 tarea de práctica (R2) | Coordinador + encargados | ☐ |
| 3 | 🔴 Deploy en Railway verificado en vivo con D1/D2/D3 incluidos; login por rol OK (R3, R8) | QA-WWP | ☐ |
| 4 | 🔴 Suite end-to-end ✓ en lo crítico del lunes (drawer, condición, foto, completar, validar) | QA-WWP | ☐ |
| 5 | 🟡 RBAC por rol verificado en vivo (admin/manager/assistant) (R6) | QA-WWP | ☐ |
| 6 | 🟡 Drawer abre sin TDZ/errores de consola en vivo (R7) | QA-WWP | ☐ |
| 7 | 🟡 Decisión `wwp-locations` cerrada: no bloquea el flujo del lunes (R4) | Ron + QA-WWP | ☐ |
| 8 | 🟡 Validación móvil del auxiliar y del encargado ✓ | Mark | ☐ |
| 9 | 🟡 Campeones designados y briefeados; comunicación enviada al equipo (R9) | Pit | ☐ |
| 10 | 🟡 Dry-run con datos reales corrido sin trabas | Pit + QA-WWP | ☐ |
| 11 | 🔴 Hojas de respaldo en papel impresas y rollback comunicado | Pit | ☐ |

**Regla de decisión:**
- **Todos los 🔴 en ✓ →** GO con encendido total + papel en paralelo.
- **Un 🔴 sin cerrar →** No-Go automático de ese componente. Como Gabriel decidió encendido total, la red que lo sostiene es el papel: si falta el #1 (reglas de empaque), se enciende igual **pero esa parte opera con la regla en papel** desde el huddle; si falta el #3/#4 (deploy/suite no verificados en vivo), **no se enciende WWP** y se opera el lunes 100% en papel mientras QA-WWP cierra la verificación — porque encender un sistema no verificado en vivo es el único riesgo que el papel no compensa (puede corromper datos/trazabilidad).
- **Los 🟡 sin cerrar no frenan el Go**, pero cada uno abierto entra como riesgo declarado del día 1 con su mitigación de papel/gemba.

---

**Cierre del dueño:** el plan respeta la decisión de Gabriel (encendido total) y la hace defendible con las máximas redes: config cargada, gente verificada en vivo, papel en paralelo y un Go/No-Go que no es opinión sino checklist. Lo único que aún requiere verificación con credenciales/datos en vivo —y por eso es puerta dura de QA-WWP/Ron el domingo— es el deploy en Railway, el login por rol, el RBAC y el drawer. Yo diagnostiqué contra código y JSON local; **declaro ese límite abiertamente**: sin esa verificación en vivo, el lunes se opera en papel, no a ciegas. Mover menos, mover mejor, mover con evidencia.
