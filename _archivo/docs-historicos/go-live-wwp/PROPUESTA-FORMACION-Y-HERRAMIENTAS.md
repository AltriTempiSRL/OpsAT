# Propuesta — Herramientas de operación + Salón de Entrenamientos

> Elaborado por **Pit** (operaciones, gestión del cambio) con apoyo de **Ron** (datos Odoo) y nota de **Mark** (UI).
> Fecha: 2026-06-22 · Altri Tempi — mueblería premium, RD.
> Estado: **decisiones de Gabriel confirmadas + datos Odoo consultados en vivo.** Listo para construir.

## Decisiones confirmadas por Gabriel (2026-06-22)
1. **Examen BLOQUEANTE** — sin certificación vigente de la competencia, no se asigna la tarea.
2. **Arranque con MVP de 3 cursos** — WWP por rol + Seguridad y manejo de cargas + Empaque premium.
3. **Certificación ANUAL** — vence al año; re-certificación obligatoria.
4. **Autoría solo admin** — solo el administrador crea/edita cursos y exámenes.
5. **(nuevo) Re-examen disparado por desempeño** — el examen se vuelve a tomar según errores reales
   en campo, conectado a los KPIs del área (ver §B6).
6. **(nuevo) Botón "Retomar examen" en wwp/usuarios** — el admin manda a un usuario a re-examinarse
   por necesidad de conocimiento (ver §B8).
7. **Acceso Odoo concedido** — consulta de pesos ejecutada en vivo (ver §C, con hallazgo crítico de dato).

---

## PARTE A — Lista de herramientas por categoría

Principio rector (Pit std 21): *mover menos, mover mejor y mover con evidencia.* La herramienta no es
gasto: es prevención de daño en pieza premium. Cada categoría se especifica por **nivel de manejo
H1–H5** (a mayor fragilidad/peso, más equipo y más personas).

### A1. Materiales de empaque — **YA EXISTE, no reinventar** ✅
El catálogo canónico vive en la plataforma (`/api/empaque/materiales` y `/api/empaque/reglas`):
16 materiales (10 MVP) + 11 reglas por categoría con la secuencia **proteger → acolchar → contener
→ sellar → señalizar**. Acción aquí: **no duplicar**; en el Salón de Entrenamientos el curso de
empaque se nutre de estas mismas reglas. Si falta material en el catálogo, se agrega ahí, no en una
lista paralela.

Materiales núcleo (referencia rápida): manta acolchada, film stretch, papel glassine sin ácido,
burbuja (chica para superficie / grande para impacto), foam en lámina + esquineros, cartón
corrugado y cantoneras, fundas plásticas (sofá/colchón), bolsas rotuladas para herrajes/tornillería,
etiquetas de señalización (frágil · este lado arriba · no apilar). Regla Pit: **nunca cinta directa
al acabado.**

### A2. Herramientas de carga (manejo de material) ⏳ specs a validar con Ron
Equipo para mover sin dañar. Especificación = **capacidad por encima de la pieza más pesada real**
(de ahí la consulta a Odoo, ver §C).

| Herramienta | Para qué | Nivel H | Spec recomendada (preliminar*) |
|---|---|---|---|
| Carretilla/diablito con correa | Cajas, piezas robustas, electrodomésticos | H1–H3 | Cap. ≥ 300 kg, ruedas neumáticas |
| Plataforma rodante (furniture dolly) 4 ruedas | Sofás, gabinetes, mesas | H2–H3 | Cap. ≥ 400 kg, superficie acolchada |
| Patín hidráulico (pallet jack) | Solo si llega paletizado | H1–H3 | Cap. ≥ 2,000 kg |
| Correas de hombro/antebrazo (moving straps) | Levantamiento 2 personas | H2–H4 | Ajustables, costura reforzada |
| Correas de trinquete (ratchet straps) | Amarre dentro del camión | todos | Resistencia rotura ≥ 500 kg c/u |
| A-frame / glass dolly | Vidrio y mármol **vertical** | H4 | Con espuma de canto, freno |
| Rampa de carga | Acceso al camión | todos | Antideslizante, cap. ≥ 350 kg |
| Liftgate (plataforma hidráulica) | H3–H5 pesados | H3–H5 | En camión; cap. ≥ 700 kg |
| Mantas antideslizantes + cuñas | Estabilidad en tránsito | todos | — |
| Escalera/step ladder | Apartamentos, entregas en altura | todos | Tijera, ≥ 150 kg |

\* *Preliminar*: las capacidades se confirman contra el **peso real de los artículos en Odoo** (§C).
Regla: ninguna correa/diablito por debajo de la pieza más pesada del catálogo activo.

### A3. Caja de herramientas completa (armado/ensamblaje) ⏳ familias a validar con Ron
La tarea tipo "llevar y armar mueble" exige ensamblar sin marcar la pieza. Muebles europeos/IKEA y
sistemas Boffi usan **métrica** (Allen/hex). Caja recomendada:

- Juego de destornilladores (Phillips + plano, varios tamaños)
- Set de llaves Allen/hex **métricas** + juego de puntas
- Llaves combinadas métricas
- Atornillador/taladro inalámbrico + brocas madera/metal + puntas (con embrague de torque)
- **Martillo de goma** (ensamblar sin marcar) — no martillo metálico sobre la pieza
- Nivel/burbuja + escuadra (nivelación final, entrega white glove)
- Cinta métrica
- Alicates (punta, corte, presión)
- Cúter (regla Pit: nunca dirigir el filo hacia la pieza)
- Grapadora de tapicería
- Fieltros adhesivos para patas (protege piso del cliente)
- Llave de torque (piezas estructurales / camas / sistemas modulares)
- Organizador de tornillería + bolsas rotuladas
- Linterna de cabeza, lápiz/marcador, guantes de agarre, cinturón porta-herramientas

Validación Ron: qué familias se entregan **armadas** (productos con `mrp.bom` / kits `.Cn` / sistemas
Boffi H5) → define el set fino (p. ej. Boffi exige hex métrico de precisión + torque).

### A4. Herramientas de seguridad ⏳ estándar a validar
Estándares de referencia: **OSHA 1910** (manejo de materiales), **ecuación de levantamiento NIOSH**
(límite ideal ≈ **23 kg por persona** → arriba de eso, 2 personas o equipo, encaja directo con los
niveles H), PPE bajo **ANSI/ISEA**, y en RD el **Reglamento 522-06 de Seguridad y Salud en el
Trabajo** (Ministerio de Trabajo).

- Faja lumbar / soporte de espalda
- Guantes (anticorte para desempaque + agarre para carga)
- Calzado de seguridad punta reforzada (ASTM F2413 / ISO 20345)
- Gafas de seguridad (al abrir empaques/flejes)
- Rodilleras (armado en piso)
- Chaleco reflectante (carga/descarga en vía pública)
- Conos de seguridad (al estacionar para descargar)
- Botiquín de primeros auxilios **en cada camión**
- Extintor en el camión (requisito vehicular) + triángulos
- Arnés (solo si hay trabajo en altura)

Regla operativa derivada de NIOSH (se enseña en el curso de seguridad): **pieza > 23 kg = 2 personas
mínimo; H3–H5 = equipo + plan de maniobra**, sin excepción.

### A5. Certificados para auxiliares (pueden ser internacionales) + fuentes de contenido
Certificaciones relevantes y **de dónde tomar la información** para construir cada curso (todas con
material público y creíble):

| Certificación / competencia | Estándar / fuente para el curso |
|---|---|
| Manejo manual de cargas | **OSHA QuickCards** (dominio público), **NIOSH Lifting Equation**, **HSE UK** manual handling |
| Primeros auxilios + RCP | **Cruz Roja Dominicana**, American Red Cross, AHA |
| Manejo defensivo (choferes) | **INTRANT** (RD), Smith System (referencia) |
| Amarre/transporte seguro de carga | **FMCSA Cargo Securement Handbook** (US DOT) |
| Operación de montacargas (si aplica) | OSHA 1910.178 |
| Entrega white glove / manejo de muebles | **IAM / AMSA (ProMover)** mejores prácticas + SOPs internos Altri Tempi |
| Empaque por material | **Estándar de empaque interno** (ya en la plataforma) + manuales de fabricante |
| Armado | Manuales OEM (IKEA, Boffi, etc.) |

Estas fuentes alimentan directamente los cursos de la Parte B. La mayoría es gratuita y
adaptable; lo interno (empaque, SDV, manejo premium) ya está escrito por Pit en SOPs del proyecto.

---

## PARTE B — Salón de Entrenamientos (conceptualización)

### B1. Concepto central
Un módulo nuevo en WWP donde **cada empleado ve los cursos requeridos por su rol**, lee/observa el
contenido y **rinde un examen al final**. Aprobar = certificación registrada en su expediente. El
pago operativo (no es "capacitación bonita"): **vincular la certificación a la asignación de tareas**
y medir su efecto en daños/reprocesos. Transformación digital = adopción + resultado, no features
(Pit std 9).

### B2. Catálogo de cursos (8 solicitados) y mapeo por rol
| Curso | Rol(es) objetivo | Contenido base |
|---|---|---|
| **WWP por rol** (uno por rol) | admin / encargado / auxiliar | Cómo usar la plataforma según su rol: crear/iniciar/evidencia/validar |
| **Encargados** | encargado | Liderazgo de maniobra, gate de despacho, asignación, QC, decisiones |
| **Auxiliares** | auxiliar | Flujo de trabajo, evidencia, handoff "terminé mi parte" |
| **Empaque** | auxiliar / encargado | Secuencia + reglas por material (vidrio/cuero/madera) — del estándar interno |
| **Armado** | auxiliar | Ensamblaje, herramientas, nivelación, herrajes, no marcar la pieza |
| **Choferes** | auxiliar (chofer) | Manejo defensivo, ruta, documentos, trato al cliente |
| **Transporte seguro** | auxiliar (chofer) / encargado | Amarre de carga, liftgate, A-frame, distribución de peso |
| **Entrega a clientes (white glove)** | auxiliar / encargado | Protocolo de entrega, protección, firma conforme, manejo de daño |
| **Seguridad y manejo de cargas** | todos | NIOSH/OSHA, PPE, cuándo 2 personas, primeros auxilios básicos |

El curso **WWP por rol** y **Seguridad** son transversales (todos). Los demás se asignan según función.

### B3. Modelo de datos (propuesta)
- `courses`: `id, title, roles[], category, lessons[], passingScore, version, requiredFor[]`
- `lessons`: `id, courseId, title, type(text|image|video|pdf), content, order`
- `exams`: `id, courseId, questions[]{ q, options[], correctIdx, explanation }`
- `results`: `userId, courseId, status(pending|in_progress|passed|failed), score, attempts, completedAt, certExpiresAt`

Persistencia consistente con el patrón actual (archivos JSON en `DATA_DIR`, como `emp-*.json`,
`reposiciones.json`, etc.).

### B4. UI/UX — capa Mark (a validar en implementación)
- **Tab nuevo** "Salón de Entrenamientos" (ícono `graduation-cap`), gating por rol como el resto de la nav.
- **Grilla de cursos** con badges de estado: `Requerido` · `En progreso` · `Completado ✓` · `Vencido`.
- **Vista de curso**: lecciones en acordeón → botón "Tomar examen" (bloqueado hasta leer las lecciones).
- **Examen**: una pregunta a la vez o lista; al enviar → puntaje + repaso de respuestas incorrectas con explicación.
- **Mi expediente de formación**: certificaciones, puntajes, vencimientos.
- **Vista admin**: crear/editar cursos y exámenes; **matriz de progreso del equipo** (quién aprobó qué); asignar cursos requeridos por rol.

### B5. Mecánica de examen
- Puntaje de aprobación configurable (sugerido **80%**).
- Intentos limitados (sugerido 3) → luego enfriamiento o revisión con supervisor.
- Banco de preguntas con aleatorización (evita memorizar el orden).
- Tipos: opción múltiple y verdadero/falso (autocalificable, fácil de autorar).

### B6. Integración operativa + re-examen por desempeño (Pit — el verdadero valor)
Esto es lo que separa "capacitación bonita" de un sistema que mejora la operación. El examen **no es
un evento único**: es un lazo de mejora continua (PDCA). Error en campo → re-capacitación dirigida →
medir si el error baja. Feedback basado en datos y enfocado en el **proceso, no en culpas**.

- **Gating BLOQUEANTE de asignación**: sin certificación vigente de la competencia, la tarea no se
  asigna. Ej.: solo un auxiliar certificado en "armado" recibe tareas de armado.
- **Onboarding**: un auxiliar nuevo debe aprobar los cursos núcleo (WWP + Seguridad) antes de su primera tarea.
- **Re-certificación ANUAL**: `certExpiresAt` = +1 año; al vencer, el curso vuelve a `pending` (bloquea hasta re-aprobar).

**Re-examen disparado por la operación (auto + manual).** Cada KPI/señal de error en WWP mapea a un
curso. Al cruzar un umbral, el sistema marca el curso del trabajador como `pending` (re-examen
requerido) y notifica. Disparadores propuestos:

| Señal en WWP (dato real existente) | KPI del área | Curso que se re-dispara |
|---|---|---|
| `condition: damaged` atribuido al trabajador | daños/100 piezas | Empaque / Manejo seguro (según material) |
| Tarea **devuelta** a pending por admin (trabajo rechazado) | % retrabajo | WWP por rol |
| Evidencia incompleta repetida (faltan fotos al cerrar) | % cierres con evidencia | WWP por rol |
| Devolución de cliente por causa **empaque/daño** | devoluciones por causa | Empaque premium |
| Tarea vencida/abandonada reincidente | tareas vencidas | WWP / responsabilidad |

- **Umbral configurable** (ej.: 2 daños en 30 días, o 1 devolución por empaque) → re-examen automático;
  el admin también puede dispararlo manual (§B8).
- **KPIs del Salón**: % del equipo certificado por curso requerido · puntaje promedio · certificaciones
  por vencer · **re-exámenes disparados por causa** · **correlación certificación ↔ daños/100 piezas**
  (la métrica que prueba el ROI: ¿el certificado daña menos?).
- **Cierre del lazo (Pit)**: tablero que cruza *trabajador × KPI de error × estado de certificación*.
  Si un trabajador acumula daños Y su certificación está vencida/pendiente → señal roja priorizada.

### B7. Gestión del cambio y MVP (cómo arrancar sin que muera)
Estandarizar antes de digitalizar (Pit std 8). Arranque por piezas (como prefiere Gabriel):

**MVP — 3 cursos de mayor impacto y menor esfuerzo de autoría** (contenido ya existe parcialmente):
1. **WWP por rol** (reduce errores de uso de la plataforma — adopción)
2. **Seguridad y manejo de cargas** (cumplimiento + menos lesiones — riesgo)
3. **Empaque premium** (menos daños/reprocesos — calidad, contenido ya en `/api/empaque/reglas`)

Quick win medible: tasa de certificación de los 3 + tendencia de daños/100 piezas a 4 semanas.
Luego se agregan los 5 cursos restantes.

### B8. Botón "Retomar examen" en wwp/usuarios (admin)
Ubicación: módulo de usuarios, en `.user-row-actions` (junto a "Editar"), solo visible para admin
(`historial.html` ~L15228). Flujo:
- Admin pulsa **"Formación"** en la fila del usuario → modal con sus cursos y estado (aprobado/puntaje/vencimiento).
- Botón **"Mandar a retomar examen"** por curso → marca ese `results` del usuario como `pending`
  (re-examen requerido) + **registra el motivo** (texto libre o causa predefinida: "daño en tarea #X",
  "necesidad de conocimiento", "actualización de SOP") + **notifica** al usuario (estilo `task_assigned`).
- Si el curso es bloqueante, el usuario **no recibe tareas de esa competencia** hasta re-aprobar.
- El usuario ve el curso como **"Requerido — re-examen"** en su Salón de Entrenamientos.
- Queda en audit log (`appendAuditLog`) para trazabilidad: quién mandó a re-examinar a quién, cuándo y por qué.

Esto le da al admin el control manual del lazo de B6, complementando el disparo automático por KPI.

### B9. Banco de preguntas y re-examen dirigido por errores
El re-examen **no repite el mismo examen**: prioriza las preguntas de los temas donde el trabajador
falló (en el examen anterior o en campo). El banco de preguntas se etiqueta por **competencia/tema**
(ej. "vidrio", "amarre", "evidencia"). Si el disparo vino por un daño de vidrio, el re-examen carga
más preguntas de la etiqueta "vidrio". Así la re-capacitación ataca la brecha real, no es genérica.

---

## PARTE C — Datos Odoo consultados en vivo (Ron) ✅
Ejecutado en vivo 2026-06-22 (uid 98, JSONRPC, solo lectura). **Cifras reales, no supuestos.**

### 🚩 Hallazgo crítico de Ron (curiosidad activa): el dato de peso está casi vacío
**Solo el 8% de los productos vendibles (814 de 10,459) tiene peso capturado en Odoo.** Y entre los
que sí lo tienen, hay **errores de captura evidentes** (una alfombra a 2,320 kg, una consola a 1,520 kg
— físicamente imposibles). Conclusión: **no se pueden dimensionar las herramientas con precisión solo
con Odoo hoy.** Esto es, por sí mismo, un hallazgo operativo: el peso es un dato base para seguridad
(NIOSH), elección de equipo y planificación de maniobra, y está sin gobernar.

### C1 — Peso por familia (kg), solo piezas con peso capturado
| Familia | Máx | Prom | Vol prom m³ | n |
|---|--:|--:|--:|--:|
| Aparadores/Consolas (Sala) | 1,520* | 192 | 1.13 | 31 |
| Mesas de Comedor | 1,291 | 292 | — | 18 |
| Bespoke / Closets | 950 | 835 | 3.03 | 8 |
| Sofás y Seccionales | 728 | 214 | 4.17 | 50 |
| Bespoke / Wall Unit | 725 | 663 | 1.70 | 2 |
| Camas King | 216 | 119 | 1.38 | 23 |
| Sillones/Butacas | 224 | 43 | 0.83 | 72 |
| Mesas de Centro | 225 | 68 | 1.82 | 37 |
| Espejos (Decoración) | 250 | 69 | 0.38 | 9 |

\* valores máx con errores de captura; los **promedios** son más confiables que los máx.

### C2 — Top piezas más pesadas (catálogo, con peso capturado)
Closets Bespoke 770–950 kg (`*K*` = kits que se arman en sitio), sofás hasta 728 kg, mesas de mármol
~1,290 kg. Aun descontando errores, el rango **real y recurrente es 200–700 kg** en sofás, closets y
mesas de mármol → **nada de esto es levantamiento manual**; exige equipo + cuadrilla (H3–H5).

### C3 — Productos que se arman (define la caja de herramientas A3)
**1,428 BOM phantom** (kits/armado) en el catálogo. Confirma que el armado es masivo y la categoría A3
(caja de herramientas) está plenamente justificada; muchos closets/wall units (`*K*`) se ensamblan en
el domicilio del cliente.

### Specs definitivas (con el dato disponible) + recomendación de gobierno de dato
- **Equipo de carga (A2)**: dimensionar a la banda real **200–700 kg con cuadrilla**: diablito/dolly
  cap. ≥ 400 kg, correas de trinquete ≥ 750 kg de rotura, **liftgate obligatorio** para closets/sofás/
  mármol (H3–H5), A-frame para espejos/vidrio. No fiarse de los máx con error; usar promedios + criterio.
- **Seguridad (A4)**: con piezas de 200+ kg, la regla NIOSH (23 kg/persona) implica **cuadrilla + equipo
  siempre** en H3–H5; esto va al curso de Seguridad como regla dura.
- **🔧 Recomendación de Pit (quick win Kaizen)**: lanzar un **mini-proyecto de captura de peso/volumen
  en Odoo** para las familias top (sofás, closets, mesas, camas). Hoy 92% sin dato. Beneficio triple:
  (1) dimensiona el equipo con precisión, (2) habilita la regla de seguridad por pieza, (3) alimenta el
  curso de manejo seguro con datos reales. Dueño: Ron define el campo; Ops captura en recepción.

*Reproducible:* script `/tmp/ron_pesos.mjs` (login JSONRPC → `read_group` + `search_read` + `search_count`).

---

## Próximos pasos (decisiones cerradas — listo para construir)
1. Construir **MVP de 3 cursos** (WWP por rol · Seguridad · Empaque), examen **bloqueante**, cert. **anual**, autoría **admin**.
2. Implementar el **lazo de re-examen por KPI** (B6) + **botón "Retomar examen" en usuarios** (B8) + **banco etiquetado por tema** (B9).
3. **Mark** valida la UI antes de construir (tab nuevo, grilla de cursos, examen, matriz admin).
4. Paralelo recomendado: **mini-proyecto de captura de peso en Odoo** (Ron + Ops) para cerrar el gap del 92%.

> Nota de implementación: esto es un **módulo nuevo** (datos `courses/lessons/exams/results`, endpoints, UI).

## ✅ ESTADO: MVP CONSTRUIDO Y VERIFICADO (2026-06-22) — pendiente tu OK para deploy
Implementado en `proxy.js` + `historial.html` + `sw.js` (build **v26**):
- **Backend**: helpers (gate, calificación, re-examen, seed) + 8 endpoints `/api/wwp/training/*` (listar, detalle, crear/editar/borrar, rendir examen, retake, matriz). 3 cursos MVP sembrados con lecciones + exámenes reales.
- **Gate bloqueante**: cableado en la asignación de tareas (`PATCH /api/wwp/tasks/:id`). **Seguro por defecto**: solo bloquea cuando el admin activa `enforceGate` en el curso, así el deploy NO frena la operación el día uno.
- **Re-examen automático**: cuando se devuelve una tarea a pendiente (gobernado por `autoRetake`, apagado por defecto) + **botón "Examen" en wwp/usuarios** (manual, con motivo + notificación + audit).
- **UI**: tab "Formación" (todos los roles), grilla de cursos con estado, lector + examen autocalificable con repaso, editor de cursos (admin), matriz del equipo (admin).
- **Verificado**: server arranca y siembra; flujo e2e con auth real (admin + auxiliar) — listar, rendir (100%/0%), certificar, retake, matriz, RBAC 403; gate bloquea no-certificado (409) y permite certificado (200); UI renderiza sin errores de consola (cursos, examen).

**Riesgo de deploy**: bajo. Todo lo nuevo es aditivo; gates apagados por defecto. Lo único visible para todos al instante: el tab "Formación" con los 3 cursos. **Espero tu OK para commit + deploy a Railway.**
