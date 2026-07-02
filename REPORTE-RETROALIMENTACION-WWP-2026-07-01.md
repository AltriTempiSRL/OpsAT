# Reporte de retroalimentacion individual por usuario WWP - Altri Tempi
**Fecha del snapshot analizado:** 2026-07-01 14:01 UTC (120 de 141 tareas activas/recientes via Codex Bridge)
**Preparado por:** Pit (gerente de operaciones)

## Resumen ejecutivo

Con el dataset real via Codex Bridge (snapshot 2026-07-01 14:01 UTC, 120 de 141 tareas activas/recientes) solo 5 personas tienen movimiento real, y de ellas solo 2 concentran casi toda la operacion: Jose Ismael Urena Montas (104 tareas, 86% del total, 3 vencidas, 7 sin evidencia) y Franklin Antonio De Jesus Candelario (10 tareas, 7 activas, 100% de sus tareas activas sin evidencia pese a tener articulos seleccionados). Melvin, Jacopo y Filippo tienen actividad minima (1-3 tareas) y no permiten diagnostico individual robusto. Limitacion estructural critica descubierta en este analisis: el bridge de Codex no expone auxiliaryAssignees[] (el campo que si existe en proxy.js para los auxiliares operativos reales), por lo que el reporte 1:1 que se puede construir hoy es por encargado/manager (owner=managerName=assignedTo), no por auxiliar de piso.

---

## Reporte individual por persona

### 1. Jose Ismael Urena Montas (manager, au_juena, odooId 49)

**Volumen** (104 tareas totales en snapshot; 12 activas)

| Metrica | Valor |
|---|---|
| Activas | 12 |
| Overdue | 3 |
| in_progress | 5 |
| assigned | 7 |
| Validadas (historico snapshot) | 67 |
| Canceladas | 25 |
| Actualizadas hoy (1-jul) | 6 |
| Stale (activa, >48h sin tocar) | 3 |
| Listas para validar | 0 |

**Calidad/evidencia**: 7 tareas activas tienen itemsSelected>0 y itemsMissingEvidence igual al total seleccionado (evidenceCount=0 en todas): 0% de evidencia fotografica en esas 7 lineas de trabajo con articulos ya escaneados.

**Cumplimiento de tiempo**: de 67 tareas validadas en el snapshot, el tiempo createdAt-updatedAt (proxy de ciclo, no de trabajo activo) promedio 16.0 h, con minimo 0.1h y maximo 70.4h. Hay dispersion amplia: algunas ordenes se cierran casi al instante (probablemente subtareas ya resueltas por la madre) y otras tardan 3 dias.

**Tareas estancadas (stale, sin movimiento hace 48h+)**:
- S07407-EVELYN DE VARGAS (item_pickup, assigned): 49h sin actualizar, vencida hace 2 dias (vencio 2026-06-29), 4 articulos sin evidencia, con escalamiento activo del sistema.
- S08050-EVELYN DE VARGAS (item_pickup, assigned): 49h sin actualizar, vencida hace 1 dia (vencio 2026-06-30), 16 articulos sin evidencia, con escalamiento activo.
- S09617-JEANNETTE ALEXANDRA A GUZMAN LULO (dispatch_order, in_progress): 28h sin actualizar, vencida hace 2 dias, 1 articulo sin evidencia, con escalamiento activo.

**Issues puntuales** (de people[].issues[]):
- "Vencio el 2026-06-29" (S07407, item_pickup)
- "Tiene articulos seleccionados sin evidencia" (S07407)
- "Vencio el 2026-06-29" (S09617, dispatch_order)
- (mismo patron se repite para S08050)

**Distribucion por tipo** (104 tareas totales): general 36 (35%), packaging 37 (36%), dispatch_order 27 (26%), item_pickup 2 (2%), staffing 2 (2%). Balanceado entre general/packaging/dispatch, no concentrado en un solo tipo, coherente con ser el manager de mayor volumen.

**Escalamientos activos**: 3 (las 3 tareas overdue arriba). El sistema sugiere en las 3 reasignar a Filippo Bencini Tesi Checo (admin, 0 tareas activas) o exigir ETA de cierre hoy.

**Fortalezas**: 0 tareas "listas para validar" acumuladas (no genera cuello de validacion), y el 65% de sus tareas historicas ya estan validated: cierra trabajo, no solo lo abre. El volumen que sostiene (104/120 = 87% del dataset) sugiere que es el motor operativo real del periodo.

**Lectura para el 1:1**: las 3 vencidas son la misma familia de ordenes (EVELYN DE VARGAS / JEANNETTE) atascadas simultaneamente en item_pickup y dispatch_order: no son 3 problemas distintos sino un solo cuello en una cadena (probablemente pick no cerrado o espera de definicion aguas arriba). Conversacion sugerida: no es "trabajas lento", es "que bloquea especificamente estas 2 ordenes desde hace 2 dias?", y exigir subir evidencia de los articulos ya seleccionados antes de avanzar mas trabajo nuevo.

---

### 2. Franklin Antonio De Jesus Candelario (manager, au_fcandelario, odooId 48)

**Volumen** (10 tareas totales; 7 activas)

| Metrica | Valor |
|---|---|
| Activas | 7 |
| Overdue | 0 |
| in_progress | 4 |
| assigned | 3 |
| Validadas | 1 |
| Canceladas | 2 |
| Actualizadas hoy | 3 |
| Stale (>48h) | 0 |

**Calidad/evidencia (senal mas fuerte de este reporte)**: las 7 tareas activas de Franklin tienen itemsSelected>0 y itemsMissingEvidence = itemsSelected (evidenceCount=0 en las 7):

| Orden | Tipo | Seleccionados | Sin evidencia |
|---|---|---|---|
| S09628-D MINERVA DECORACIONES (dispatch) | dispatch_order | 102 | 102 |
| S09628-D MINERVA DECORACIONES (empaque) | packaging | 102 | 102 |
| S09639-ALMACENES UNIDOS SAS | dispatch_order | 3 | 3 |
| S07407-EVELYN DE VARGAS | packaging | 4 | 4 |
| S08050-EVELYN DE VARGAS | packaging | 16 | 16 |
| S07614-AG123 HOLDING (dispatch) | dispatch_order | 126 | 126 |
| S07614-AG123 HOLDING (empaque) | packaging | 12 | 12 |

Esto es 100% de sus tareas activas sin una sola foto de evidencia, incluyendo una orden de 102 unidades y otra de 126. No estan vencidas todavia (dueDate 2026-07-01/07-02), por eso no aparecen como "overdue", pero es el patron de riesgo mas claro del reporte: si no se sube evidencia antes de la fecha limite, manana o pasado se convierten en vencidas sin registro fotografico.

**Cumplimiento de tiempo**: sin stale (todas actualizadas en las ultimas 48h), sin overdue. 1 validada con ciclo de 16.4h.

**Distribucion por tipo** (10 tareas): packaging 5 (50%), dispatch_order 4 (40%), general 1 (10%). Concentrado en packaging+dispatch, coherente con encargado de despacho, no de picking.

**Escalamientos activos**: 0.

**Fortalezas**: 0 vencidas, 0 stale, ritmo de actualizacion bueno (3 de 7 activas tocadas hoy mismo). El problema no es ritmo ni atraso, es disciplina de registro fotografico, que es distinto y hay que nombrarlo asi en el 1:1 para no confundir "lento" con "no sube evidencia".

**Lectura para el 1:1**: Franklin mueve bien el flujo (sin atrasos) pero no esta subiendo fotos de los articulos seleccionados en ninguna de sus 7 tareas activas. Conversacion: reforzar que "seleccionar articulo" y "confirmar con evidencia" son dos pasos distintos y el segundo no se esta completando: riesgo directo si el cliente reclama una pieza faltante o danada sin foto de respaldo (viola el gate de despacho: no despachar si falta foto de condicion).

---

### 3. Melvin Staling Grullon Gomez (manager, au_mgrullon)

**Volumen**: 3 tareas totales, 1 activa (assigned), 2 validadas, 0 overdue, 0 stale, 1 actualizada hoy.

**Calidad/evidencia**: la unica tarea activa (S09598-HUASCAR CUEVAS, item_pickup) tiene 1 articulo seleccionado y 1 sin evidencia.

**Cumplimiento de tiempo**: las 2 validadas cerraron rapido (1.8h y 4.1h de createdAt-updatedAt): el mejor ritmo del grupo, aunque con muestra muy pequena.

**Distribucion por tipo**: general 2, item_pickup 1.

**Escalamientos**: 0.

**Fortalezas**: 0 overdue, cierre rapido en las 2 tareas validadas. Limitacion: muestra de solo 3 tareas no permite concluir un patron solido; declararlo asi en el 1:1, no tratarlo como "bajo desempeno" ni "alto desempeno" con tan poca base.

---

### 4. Jacopo Bencini Tesi Checo (admin, au_jbencini)

**Volumen**: 2 tareas, ambas validated, 0 activas, 0 overdue.

**Cumplimiento de tiempo**: ciclo createdAt-updatedAt de 124.7h y 144.2h (5-6 dias): el mas lento del grupo, pero es admin, no encargado de piso; probablemente estas tareas no son su prioridad diaria. No hay suficiente volumen ni contexto de rol para interpretarlo como demora operativa.

**Distribucion**: general 1, dispatch_order 1.

**Fortalezas**: 0 overdue, 0 pendiente.

**Limitacion**: 2 tareas no alcanzan para un diagnostico 1:1 real; solo dejar constancia de que existe actividad registrada.

---

### 5. Filippo Bencini Tesi Checo (admin, au_mqglt4n89o3d)

**Volumen**: 1 tarea, cancelled, sin overdue, sin evidencia pendiente.

**Nota relevante fuera de su propio historial**: el sistema lo senala como candidato de reasignacion en las 3 escalaciones de Jose Ismael ("Filippo tiene 0 tareas activas"). Con solo 1 tarea historica (cancelada) en el dataset, es plausible que tenga capacidad libre real, pero no hay suficiente evidencia de que domine el tipo de tarea (item_pickup, dispatch_order) que se le sugiere asumir: esto es una recomendacion del sistema a validar por un humano, no un hecho de que Filippo pueda tomar esas 3 ordenes sin friccion.

---

## Personas con 0 tareas en el dataset (no reportables hoy)

Del roster de 15 usuarios (wwp-users-auth.json), 10 son assistant (auxiliares): Albert, Harold, Franchi, Dennis, Jose Angel De La Rosa, Jose Miguel De Jesus, Jose Rafael Linares, Jose Rodriguez, Julio Cesar Pache, Welby Rodriguez. Ninguno aparece como owner/managerName en las 120 tareas del snapshot, porque ese campo solo captura al encargado/manager, nunca al auxiliar ejecutor (ver brecha #1 abajo). No se puede generar su reporte individual con este dataset; si sabemos que existen y estan activos en el roster, pero su actividad real de piso no esta en los campos que trae el bridge.

---

## Brechas de captura de datos (segunda parte solicitada)

Evaluado contra el dataset + verificacion directa en proxy.js/historial.html. Son concretas y verificadas, no especulacion:

**1. El bridge de Codex no expone auxiliaryAssignees[]: brecha mas grave para retroalimentacion 1:1**
proxy.js si tiene el campo (lineas 529, 2792, 7494, 7517, 7605, 7963-8029) y lo usa activamente para notificaciones y permisos. Pero el payload de /api/codex/agents/tasks y /api/codex/agents/context solo trae owner/managerId/managerName/assignedTo: los cuatro son siempre el mismo encargado (verificado: 120/120 coincidencias owner=managerName). Impacto: hoy no se puede construir un reporte 1:1 real para los 10 auxiliares que ejecutan picking/empaque en el piso, solo para los 3 managers con actividad. Recomendacion: agregar auxiliaryAssignees[] (resuelto a nombres) al payload del bridge; es la brecha de mayor valor para este tipo de reporte.

**2. No existe motivo estructurado de cancelacion**
Se busco cancelReason/motivoCancel/cancel_reason en proxy.js y historial.html: 0 coincidencias. Con 25 tareas canceladas de Jose Ismael y 2 de Franklin en este snapshot, no se puede saber si se cancelo por error de captura, cambio de cliente, duplicado, etc. Recomendacion: campo obligatorio cancelReason (enum corto: duplicado / cambio_cliente / error_captura / otro+texto) en el PATCH de cancelacion.

**3. No hay timestamp de inicio real de trabajo, solo updatedAt**
Verificado: no existe startedAt a nivel de tarea WWP (el unico startedAt que existe en el codigo es de certificaciones del Salon de Entrenamientos, linea 403, no de tareas). Se usa createdAt-updatedAt como proxy de ciclo, pero eso mezcla "tiempo en cola sin tocar" con "tiempo trabajando": no se puede separar cuanto tardo Jose Ismael trabajando una tarea vs cuanto espero antes de empezar. Recomendacion: capturar startedAt en la transicion assigned->in_progress (ya existe el evento, solo falta persistir el timestamp) para medir tiempo real de ejecucion vs tiempo de espera; esto habilita un KPI de lead time real, no solo de "ultima vez que se toco".

**4. statusHistory[].by no esta normalizado de forma confiable para atribucion individual**
Esto ya estaba documentado en la bitacora de Pit (decision 2026-06-14): statusHistory[].by puede venir como userId, oe_<odooId> o nombre completo, sin normalizar. No se puede atribuir con certeza "quien hizo que paso" cuando hay varios ejecutores en la cadena. Sigue sin resolverse; sigue siendo prerrequisito para metricas de atribucion fina.

**5. No hay feedback estructurado del encargado sobre el auxiliar**
No existe ningun campo tipo managerFeedback/auxiliaryRating en las tareas. Todo el "feedback" hoy es un actionNote de texto libre por tarea (y en este snapshot, actionNote viene vacio en las tareas revisadas). Recomendacion: si Gabriel quiere retroalimentacion 1:1 con trazabilidad, agregar un campo corto de feedback del encargado al cerrar/validar (ej. "cumplio estandar" / "requiere refuerzo en X" con motivo), enlazado al KPI de certificacion ya disenado para el Salon de Entrenamientos (decision 2026-06-22): cerraria el lazo error-en-campo -> recapacitacion dirigida.

**6. No hay tasa de rechazo por auxiliar en checklist de empaque**
El estandar de empaque (16 materiales, 11 reglas) existe (/api/empaque/reglas), pero no se encontro en el dataset ni en el codigo un contador de "checklist fallido/reintentado" por persona. Esto seria el insumo directo para medir disciplina de empaque por auxiliar; hoy solo se puede inferir indirectamente via itemsMissingEvidence.

**7. No hay motivo estructurado de reasignacion**
El sistema ya sugiere reasignaciones (escalation.action: reassign_or_escalate) pero cuando un admin efectivamente reasigna, no se ve campo que capture el porque (sobrecarga, ausencia, error de asignacion inicial, etc.). Sin esto, no se puede medir si las reasignaciones sugeridas por el sistema realmente se ejecutan ni por que motivo real.

---

## Recomendaciones priorizadas

1. Que: exponer auxiliaryAssignees[] resuelto a nombres en el payload del bridge de Codex. Quien: quien mantiene el endpoint /api/codex/agents/* (Carl/backend). Por que: sin esto, el reporte 1:1 de hoy cubre solo 3 managers de 15 usuarios activos; es la brecha de mayor impacto para el objetivo original de la tarea.
2. Que: exigir evidencia fotografica en las 7 tareas activas de Franklin (S09628, S09639, S07407, S08050, S07614) antes de su dueDate. Quien: Franklin, supervisado por Gabriel/admin. Por que: 100% de sus tareas activas tienen articulos seleccionados sin una sola foto; riesgo directo de despacho sin evidencia de condicion (viola gate de despacho).
3. Que: resolver hoy las 3 vencidas de Jose Ismael (S07407 item_pickup, S09617 dispatch_order, S08050 item_pickup); el sistema ya sugiere reasignar a Filippo o exigir ETA. Quien: Jose Ismael + admin decide reasignacion. Por que: son la misma cadena de 2 ordenes bloqueada hace 2 dias, con escalamiento activo del propio sistema.
4. Que: agregar cancelReason estructurado al PATCH de cancelacion. Quien: Carl (backend). Por que: 27 tareas canceladas en este snapshot sin motivo capturado; no se puede aprender del patron de cancelaciones sin esto.
5. Que: capturar startedAt en la transicion assigned->in_progress. Quien: Carl (backend, cambio de bajo riesgo). Por que: hoy el "tiempo de ciclo" reportado es proxy (createdAt-updatedAt), no tiempo real de trabajo; mejora todos los KPIs de lead time futuros.

---

## Limitaciones declaradas explicitamente

- Snapshot vivo del 2026-07-01 14:01 UTC, 120 de 141 tareas: no es el historico completo de junio; tareas archivadas/purgadas del feed activo pueden faltar.
- El reporte cubre solo managers/encargados (owner=managerName=assignedTo siempre coincide, verificado 120/120), no auxiliares operativos, por la brecha #1 arriba.
- Los tiempos de "ciclo" usan createdAt-updatedAt como proxy; no es tiempo de trabajo activo real (brecha #3).
- Melvin y Jacopo tienen muestra de 1-3 tareas: insuficiente para concluir patrones de desempeno, solo se reportan como referencia.
- wwp-audit.json revisado de nuevo: sigue teniendo solo eventos login_fail (30 registros), sin nuevos tipos de evento utiles para este analisis.

---

## Fuentes (solo lectura, sin modificar)

- C:\Users\Gabriel Ramirez\OneDrive\Documentos\Claude\Artifacts\dashboard-despachos-live\data-local\_codex_context.json
- C:\Users\Gabriel Ramirez\OneDrive\Documentos\Claude\Artifacts\dashboard-despachos-live\data-local\_codex_tasks.json
- C:\Users\Gabriel Ramirez\OneDrive\Documentos\Claude\Artifacts\dashboard-despachos-live\data-local\_tasks_export.csv
- C:\Users\Gabriel Ramirez\OneDrive\Documentos\Claude\Artifacts\dashboard-despachos-live\data-local\wwp-users-auth.json
- C:\Users\Gabriel Ramirez\OneDrive\Documentos\Claude\Artifacts\dashboard-despachos-live\data-local\wwp-audit.json
- Codigo verificado: proxy.js (lineas 529, 403, 2792, 7494, 7517, 7605, 7963-8029), sin cambios.
