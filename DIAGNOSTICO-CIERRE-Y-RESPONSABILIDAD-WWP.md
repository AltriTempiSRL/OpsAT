# Diagnóstico — Responsabilidad de cierre y gestión de encargados (WWP)

> Elaborado por **Pit** (operaciones, gestión del cambio, accountability) con lente de **QA-WWP**
> (validación de todas las interacciones de tarea) y **Mark** (UX de lo propuesto).
> Fecha: 2026-06-23 · datos de producción consultados en vivo (corte 11:05 UTC).
> Propósito: reforzar el cierre de tareas y la gestión de encargados **antes** de que SDV suba el workload.

---

## 1. Resumen ejecutivo (lo crítico en 5 líneas)
El "hice lo que pude hoy y mañana sigo" **no es actitud del equipo: es un hueco estructural del sistema.**
No existe ningún concepto de **cierre de día** en el código (0 coincidencias). Las **vencidas no escalan
solas**: la notificación de vencidas se dispara cuando alguien se conecta, no por un reloj — por eso 4
vencidas de ayer siguen abiertas. **El sistema mide bien el trabajo pero no cierra el ciclo ni obliga a
rendir cuenta al final del día.** Cuando SDV suba el workload, este hueco se hará crónico. La prioridad
no es más trabajo: es **darle un reloj al sistema (latido diario) y un ritual de cierre.**

> **Corrección 2026-06-23 (Gabriel tenía razón):** la primera versión decía "6 tareas esperando validación,
> la más vieja 111h". **Es incorrecto.** Solo **1 tarea madre** está realmente esperando validación
> ("Subir cuadros", 12h). Las otras 5 son **subtareas de despacho cuyas madres ya están VALIDADAS** —
> quedaron en `completed` porque **validar la madre NO cascadea a sus subtareas** (a diferencia de cancelar,
> que sí cascadea). Es una **inconsistencia de dato menor**, no un backlog operativo. Ver §2.1.

---

## 2. Diagnóstico con datos reales de producción (corte 2026-06-23 11:05 UTC)
38 tareas (26 madres). Distribución: **17 validadas · 7 canceladas · 6 completadas SIN validar · 4 en progreso · 4 asignadas.**

| Señal | Dato real | Lectura |
|---|---|---|
| **Madres esperando validación** | **1** ("Subir cuadros", 12h) | El backlog de validación real es chico. (Ver §2.1 — corrección.) |
| Subtareas "completed" de madres ya validadas | 5 (despacho) | 🟡 Inconsistencia de dato: validar la madre no cascadea a la subtarea. No es trabajo pendiente. |
| En progreso estancada | 1 tarea **73h** ("Transporte mobiliario"), además vencida | Nadie la empuja ni la cierra; no hay aviso. |
| Asignadas sin iniciar | 4 (11–13h) | No hay empujón para arrancar. |
| **Vencidas activas (madres)** | **4** (vencieron ayer 22-jun, siguen abiertas en in_progress/assigned) | 🔴 El escalamiento existe pero es pasivo y no corre por reloj. |
| Activas sin fecha límite | 2 de 7 | Sin `dueDate` = sin compromiso de cierre. |
| Estancadas ≥72h | 1 | Sin "parte de cierre" nadie rinde cuenta. |

### 2.1 Corrección del conteo de validación (Gabriel detectó el sesgo)
Las 5 subtareas que conté como "esperando validación 89–111h" son `dispatch_order` **cuyas madres ya
están `validated`** (seq 34, 40, 46, 49, 54). Secuencia real: la subtarea se completó → auto-completó la
madre (proxy.js L7613) → el admin **validó la madre** → pero validar la madre **no cascadea** a la subtarea
(no existe cascada de validación, solo de cancelación, proxy.js L7513) → la subtarea queda atrapada en
`completed`. **Backlog de validación real = 1 madre.** *Fix sugerido (1 línea de lógica):* al validar una
madre, poner en `validated` sus subtareas que ya estén en `completed` (espejo de la cascada de cancelación).
Bajo impacto, pero limpia el dato y evita que vuelva a confundir un diagnóstico.

**Hecho vs juicio:** el sistema mide bien el trabajo (evidencias, estados); el hueco real no es la validación,
es que **no hay reloj** (escalamiento por conexión, no por tiempo) ni **cierre de día** (nadie rinde cuenta de lo abierto).

---

## 3. Mapa de interacciones de todas las tareas (lente QA-WWP) — dónde se fuga la responsabilidad
Recorrido del ciclo de vida completo con el gate y el hueco de cada transición:

| Transición | Quién | Gate que existe | 🔴 Hueco de responsabilidad |
|---|---|---|---|
| pending → assigned | admin/encargado | Cert. bloqueante (v26, opcional) | Si no tiene `dueDate`, nace sin compromiso. |
| assigned → in_progress | encargado/auxiliar | Gate de pick (despacho) | **Nada empuja a iniciar** — 4 asignadas paradas. |
| auxiliar "terminé mi parte" → encargado | auxiliar | Fotos+condición+confirmación (422) | El encargado recibe notif, pero **no se le exige acusar recibo** ni cerrar. |
| in_progress → completed | encargado/auxiliar | Evidencia completa (422) — fuerte | **Nada empuja a completar** — 1 tarea 73h. |
| **completed → validated** | **solo admin** | — | 🔴 **El cuello.** `ready_to_validate` solo existe como lista pasiva en el OpsAgent; **NO hay notificación proactiva** "valida esto". → 6 tareas, hasta 4.6 días. |
| vencida | sistema | `checkOverdueTasks` notifica (máx 1/día) | 🔴 **Se dispara al conectarse un usuario, NO por reloj.** Si nadie abre la app, no avisa. No hay cron diario. |
| cierre del día | — | **NO EXISTE** | 🔴 Nadie rinde cuenta de lo abierto al terminar el turno. |

**Conclusión QA-WWP:** las transiciones *hacia adelante con evidencia* están bien protegidas (422/409/403).
Lo que falta es **presión de avance** (empujar lo parado) y **cierre de lazo** (validación + cierre de día).

---

## 4. Qué YA existe (no reinventar) vs qué falta
**Existe y se reutiliza:**
- Escalamiento de vencidas calculado (`enrichOverdueTasks`: sugiere reasignar al encargado menos cargado).
- Notificación de vencidas (`checkOverdueTasks`) — pero atada a conexión, no a reloj.
- Tipos de notificación ya definidos: `ready_to_validate`, `task_overdue`, `daily`, `daily_mistakes`, `weekly`, `report`.
- **Scheduler de rutinas automáticas** (`tickAgentRoutineScheduler`, corre cada 60s) — **APAGADO** ("no asignar rutinas hasta que Gabriel apruebe"). Es la infraestructura ideal para el latido diario.
- Termómetro de adopción por encargado (v22): % equipo activo + tasa de cierre.
- Presencia (activo/tibio/inactivo) + control de almuerzos.

**Falta (el hueco que Gabriel siente):**
1. **Cierre de día** (ritual + parte) — no existe.
2. **Notificación proactiva de validación** al admin — solo hay lista pasiva.
3. **Latido diario por reloj** (brief de mañana, recordatorio de cierre, digest de validación) — el scheduler existe pero está apagado.
4. **Scorecard diario por persona** (cerró / dejó abierto / por qué) — el termómetro es adopción agregada, no rendición diaria.
5. **`dueDate` obligatorio** — hay tareas sin compromiso.

---

## 5. Soluciones priorizadas (diseño · notificaciones · información · funcionalidad)

### P1 — Cerrar el lazo de VALIDACIÓN (recalibrado: el backlog es chico, pero el lazo sí conviene cerrarlo)
*Nota tras la corrección §2.1: hoy NO hay crisis de validación (1 madre, 12h). Aun así, el lazo es pasivo
y conviene cerrarlo antes de que SDV suba el volumen.*
- **Fix inmediato (1 línea)**: cascada de validación madre→subtareas completadas (limpia las 5 atrapadas).
- **Notificación** proactiva: al pasar a `completed`, push al admin "✅ Lista para validar: [tarea]" (hoy solo lista pasiva).
- **Diseño**: badge contador en la nav del admin + **Bandeja de validación** ordenada por antigüedad (rojo si >24h).
- **Funcionalidad** (decisión #4): validación en lote vs una por una.
- *Esfuerzo bajo · impacto medio (preventivo para SDV, no urgente hoy).*

### 🥈 P2 — "Cierre de Día" (el ritual que falta — ataca directo el "mañana sigo")
- **Funcionalidad**: botón **"Cerrar mi día"** (encargado y auxiliar). Muestra sus tareas abiertas y exige
  decidir cada una: ✓ cerrada · ⏸ bloqueada (motivo obligatorio) · ➡️ continúa mañana (con **ETA**).
  Genera un **parte de cierre** firmado (logueado en audit) por persona.
- **Notificación**: recordatorio al final del turno "Cierra tu día: tienes N tareas abiertas" (usa el latido P3).
- **Diseño (admin)**: panel **"Cierre del día"** — quién cerró su parte y quién no, qué se arrastra a mañana
  y **por qué** (bloqueos vs continúa). Convierte "hice lo que pude" en un compromiso explícito y trazable.
- **Información**: el carry-over de hoy precarga el brief de mañana.
- *Esfuerzo medio · impacto alto en cultura de cierre.* Es la pieza central de lo que pides.

### 🥉 P3 — Encender el LATIDO diario (activar lo que ya existe, apagado)
- Activar el `tickAgentRoutineScheduler` para 3 rutinas por reloj (no por conexión):
  1. **Brief de mañana** (7:30am) al encargado: tus vencidas, en riesgo y arrastres de ayer.
  2. **Recordatorio de cierre** (fin de turno): "cierra tu día / valida lo pendiente".
  3. **Digest de validación** (admin): lo que espera su visto bueno.
- Mover `checkOverdueTasks` a un **cron diario real** (hoy depende de que alguien se conecte).
- *Esfuerzo bajo-medio (la infra existe) · impacto alto en constancia.* Requiere tu OK porque hoy está
  deliberadamente apagado.

### P4 — Reforzar la GESTIÓN del encargado (visibilidad para que gestione, no solo reciba)
- **Vista "Mi equipo hoy"** (encargado): estado de sus auxiliares — quién está parado, qué espera handoff,
  qué hay que empujar. Hoy el encargado recibe avisos sueltos; no tiene un tablero de mando de su gente.
- **Scorecard diario por persona**: asignadas / iniciadas / cerradas / vencidas / arrastradas + motivos.
  Extiende el termómetro (de adopción agregada → rendición diaria).
- **Acuse de "terminé mi parte"**: cuando el auxiliar entrega, el encargado debe **acusar recibo** (no solo
  recibir notif) → el handoff se vuelve un compromiso de dos lados.
- *Esfuerzo medio · impacto alto en accountability del mando medio.*

### P5 — Compromiso de origen (cerrar la fuga de entrada)
- **`dueDate` obligatorio** al crear/asignar (hay 2 activas sin fecha). Sin fecha = sin cierre posible.
- **ETA explícita** al iniciar tareas de riesgo (despacho/instalación).
- *Esfuerzo bajo.*

---

## 6. Lente SDV — por qué hacer esto AHORA (antes del go-live)
Hoy con 8 tareas activas el cuello de validación ya acumula 4.6 días. **Cuando SDV inyecte el flujo de
despacho, el volumen de completadas-sin-validar y de vencidas crece proporcionalmente.** Si el lazo no
cierra solo y no hay cierre de día, el equipo trabajará más pero el "mañana sigo" se hará crónico y la
trazabilidad hacia ventas (que SDV promete) se rompe. **P1 + P3 son pre-requisitos de un SDV sano**;
P2 + P4 son lo que sostiene la cultura cuando sube la carga.

---

## 7. Recomendación de arranque (qué construir primero)
**Paquete pre-SDV (alto impacto, bajo riesgo):** P1 (notif + bandeja de validación) + P3 (latido diario,
encender scheduler + cron de vencidas) + P5 (dueDate obligatorio). Luego P2 (Cierre de Día) como pieza
central, y P4 (gestión del encargado) para sostener.

---

## 9. PROPUESTA COMPLETA — P2 "Cierre de Día"
**Objetivo:** convertir "hice lo que pude, mañana sigo" en un cierre explícito por persona, trazable y con orgullo.

**Quién:** auxiliares y encargados cierran lo suyo; el admin ve el consolidado.

**Disparo:** botón permanente **"Cerrar mi día"** en la barra + recordatorio automático al final del turno
(vía el latido P3) si tiene tareas abiertas y no ha cerrado.

**Flujo del operador (encargado/auxiliar):**
1. Toca "Cerrar mi día" → ve SUS tareas activas (assigned/in_progress + las que entregó y esperan algo).
2. Por cada tarea decide (3 botones grandes, táctil):
   - ✓ **Cerrada/entregada** (si ya tiene su evidencia, pasa a completed).
   - ⏸ **Bloqueada** — **motivo obligatorio** de una lista: falta pick · falta material · cliente no disponible · falta personal · espera validación · otro (texto).
   - ➡️ **Continúa mañana** — **ETA obligatoria** (fecha/hora) + nota corta opcional.
3. No se confirma hasta decidir todas (modo obligatorio) o se permite "cerrar con N sin decidir" (modo sugerido).
4. Confirma → genera el **parte de cierre** {persona, fecha, cerradas, bloqueadas+motivo, continúa+ETA, hora}. Se loguea en audit.
5. Mensaje positivo: *"Día cerrado. 3 cerradas, 1 bloqueada, 2 continúan. Buen trabajo."* (refuerzo, no castigo).

**Panel del admin — "Cierre del día":**
- Personas: ✓ cerró su parte · ⏳ no ha cerrado · — sin tareas hoy.
- Por persona: cerradas, bloqueadas (con motivo), arrastres (con ETA).
- Consolidado: total cerrado / bloqueado por motivo (top bloqueadores) / arrastrado a mañana. Señal roja: tarea arrastrada >2 días.
- Los bloqueos son **información para desbloquear**, no para culpar (¿falta pick? ¿falta personal? → decisión de Ops).

**Datos / KPI:** nuevo `wwp-daily-close.json` (parte por persona/día); KPIs: % que cierra su día · arrastre promedio · top motivos de bloqueo · arrastres recurrentes. El carry-over precarga el brief de mañana (P3).

**Gestión del cambio (recomendación):** **arrancar como recordatorio fuerte con incumplimiento visible**
(el admin ve quién no cerró) y **endurecer a obligatorio tras 2–3 semanas** de adopción. Imponer fricción
el día 1 genera rechazo (ADKAR); primero hábito, luego obligatoriedad. → Esta es la decisión #2.

**Esfuerzo:** medio (UI nueva + persistencia + panel admin). **Riesgo:** bajo-medio (aditivo).

---

## 10. PROPUESTA COMPLETA — P3 "Latido Diario"
**Objetivo:** darle un **reloj** al sistema — que las cosas pasen por tiempo, no porque alguien se conecte.

**Infra (ya existe):** `tickAgentRoutineScheduler` corre cada 60s pero está apagado para rutinas. Cada rutina
se define {hora, días, rol destinatario, contenido}. Las notificaciones usan tipos ya definidos
(`daily`, `task_overdue`, `ready_to_validate`) + Web Push (ya funciona).

**Las 3 rutinas + el cron de vencidas:**
1. **Brief de la mañana** (sug. 7:30am) → a cada encargado (+ resumen admin): *"Hoy tienes: 2 vencidas, 3 que vencen hoy, 1 arrastrada de ayer (ETA 10am), 2 sin iniciar."* Arranca con foco, no con la bandeja fría.
2. **Recordatorio de cierre** (sug. fin de turno) → a quien tenga tareas abiertas: *"Cierra tu día: N tareas abiertas."* Enlaza al flujo P2.
3. **Digest de validación** (sug. 8am y 4pm) → al admin: *"N listas para validar (la más vieja Xh)."* Cierra el lazo hoy pasivo.
4. **Cron real de vencidas**: `checkOverdueTasks` por reloj (mañana + tarde), no solo al conectarse alguien (hoy depende de eso, proxy.js L5854).

**Anti-spam:** respeta el "máx 1 por tarea por día" ya existente; el brief es **1 resumen consolidado**, no N notifs sueltas. Cada rutina deja registro auditable (cuándo corrió, a quién, qué resumió).

**Configurable:** horarios, días laborables y qué rol recibe qué. Requiere de ti: **OK para encender el
scheduler** (hoy apagado por tu regla) + los **horarios reales** del turno y los **días** (¿L-V o L-S?). Esta es la decisión #3.

**Esfuerzo:** bajo-medio (la infra existe; es definir rutinas + mover `checkOverdueTasks` al reloj).
**Riesgo:** bajo (es notificación, no toca datos). Único cuidado: no inundar → brief consolidado.

---

## Decisiones para Gabriel (actualizadas)
1. ~~Paquete pre-SDV~~ — **omitido por ahora** (a tu pedido).
2. **Cierre de Día (P2)**: propuesta completa arriba (§9). Recomiendo arrancar como **recordatorio fuerte
   con incumplimiento visible** → endurecer a obligatorio en 2–3 semanas. ¿De acuerdo, o lo quieres obligatorio desde el día 1?
3. **Latido Diario (P3)**: propuesta completa arriba (§10). Necesito tu **OK para encender el scheduler**
   + **horarios reales** del turno (sugerido brief 7:30am · cierre fin de turno · digest 8am/4pm) + **días** (¿L-V o L-S?).
4. **Validación**: backlog real = 1 (corregido). ¿Aplico el **fix de cascada** madre→subtareas (limpia las 5)
   y agrego la **notificación proactiva + bandeja**? ¿Validación en lote o una por una?
