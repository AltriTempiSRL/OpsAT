# Plan de Monitoreo de Adopción + Desempeño — Workforce Platform (WWP)

**Altri Tempi · Operaciones de Almacén, Picking, Empaque y Despacho**
**Autor:** Pit (gerente de operaciones) · **Para:** Gabriel Sánchez (dirección de operaciones)
**Versión:** 1.0 · **Fecha:** 2026-06-14 · **Estado:** propuesta para aprobación · **Diseña, no ejecuta**
**Ancla:** operacionaliza el §3 de `PLAN-GESTION-CAMBIO-WWP.md` (KPIs K1-K6 y principio 5: "reconocer la mejora, no solo el nivel absoluto").

---

## Resumen ejecutivo

Este tablero responde a la pregunta de fondo de Gabriel: **¿quién usa de verdad WWP, quién mejora, y los encargados están validando?** — medido con dato, en tiempo real y con trayectoria, no con foto. Verificado contra el código (`proxy.js`) y los datos reales: **la participación en una tarea ya se calcula** uniendo `assignedTo` + `auxiliaryAssignees[]` + `executors[]` (función `taskResponsibleIds`, L2130-2143), el `workload` activo ya existe (L4778-4792), y el `ops-agent` ya computa heurísticas reutilizables (`computeOpsAgentReport` L323+). **Hallazgo decisivo para la atribución de tareas compartidas:** una foto (`evidence_images`) **NO** guarda quién la subió, pero la **confirmación de cada item** (`empaque_confirmacion`, `fotos_guia[].confirmado_by/at`) **SÍ** registra quién y cuándo — esa es la mejor huella individual que existe hoy dentro de una tarea de grupo. **Hecho vs juicio:** todo lo de estructura de datos es hecho verificado en código; las metas y umbrales son propuestas a calibrar contra la línea base real. El diseño separa **lo construible hoy** (adopción, trayectoria, desempeño, validación) de **lo que requiere un campo nuevo** (atribución por foto: `uploadedBy` — lo que Gabriel llamó "definir a la larga").

> **Nota de datos:** el universo verificado en archivo es **15 usuarios (2 admin, 3 encargados/manager, 10 auxiliares/assistant)**; en la copia local de desarrollo (mayo) solo 3 tenían `lastLogin`. Eso **no** es la foto de producción de hoy — es la prueba de por qué este tablero hace falta: hoy nadie puede decir con certeza quién entra y quién no.

---

## 1. Métricas de ADOPCIÓN en tiempo real

**Principio rector (juicio):** "usar la plataforma" **no** es "haber hecho login". Login es condición necesaria, no suficiente. Un encargado puede entrar y no validar nada; un auxiliar puede entrar y no tocar una tarea. **Adopción real = actividad que mueve el trabajo**, no presencia.

### 1.1 Las 4 señales de adopción (de más débil a más fuerte)

| Señal | Dato fuente (verificado) | Qué prueba | Fuerza |
|---|---|---|---|
| **S1 — Acceso** | `users-auth.lastLogin`, `audit.json` evento `login_ok` | Que la persona puede y quiere entrar | Débil (presencia) |
| **S2 — Presencia/sesión** | `presenceStatus`/`presenceAt`, `sessions.lastActivity`/`expiresAt` | Que está conectado ahora | Débil-media |
| **S3 — Actividad real** | `statusHistory[].by` + `.date` (cada cambio de estado: quién y cuándo) | Que **movió trabajo** | **Fuerte** |
| **S4 — Evidencia/confirmación** | `items[].empaque_confirmacion.{by,at}`, `fotos_guia[].confirmado_by/at`, ítems con `evidence_images` | Que **completó trabajo con prueba** | **Más fuerte** |

> **Decisión de diseño:** el semáforo de adopción se construye sobre **S3 + S4** (actividad real), con S1/S2 como contexto. Un encargado con login diario y cero validaciones está **rojo**, no verde.

> **Advertencia técnica:** `statusHistory[].by` viene en **dos formatos** — a veces `userId` (`au_gsanchez`), a veces nombre completo. Antes de atribuir actividad hay que **normalizar** ambos al `userId`. **Sin esto, las métricas por persona estarán incompletas.** Es prerrequisito.

### 1.2 Semáforo de adopción por usuario (ventana móvil de 7 días)

| Estado | Auxiliar (assistant) | Encargado (manager) |
|---|---|---|
| 🟢 **Activo** | ≥1 acción S3/S4 en últimas 48h **y** ≥3 días con actividad en 7d | Ídem **y** ≥1 validación/gestión en la ventana |
| 🟡 **Tibio** | Login en 7d pero <3 días con actividad real, o última acción hace 48h-7d | Entra pero valida/gestiona poco |
| 🔴 **Inactivo** | Sin acción S3/S4 en 7d (haya hecho login o no) | Entra pero **no valida ni gestiona** |
| ⚫ **Nunca** | Sin `lastLogin` (jamás entró) | Sin `lastLogin` |

> Umbrales (48h, 3 días, 7d) = **propuestas a calibrar**. **Hecho:** los insumos existen. **Juicio:** los cortes.

**Cómo se lee:** la lista de 🔴 y ⚫ es la **cola de intervención** del plan de cambio (entran a E1, acompañamiento). El que pasa de ⚫→🔴→🟡→🟢 es trayectoria de adopción medible (§2).

---

## 2. Métrica de TRAYECTORIA (medir mejora, no foto)

**Requisito textual de Gabriel:** *"si un empleado empezó usando poco pero mejoró, no puede ser medido igual que uno con poco uso durante todo el tiempo."* Es el principio 5 hecho número.

### 2.1 Método de ventanas móviles

```
Ventana reciente (R)  = últimos N días        (ej. días 1-14)
Ventana previa   (P)  = N días anteriores      (ej. días 15-28)
Δ (delta)             = R − P  →  signo y magnitud = tendencia
```
- **N sugerido = 14 días** (calibrable). Media móvil de 7 días para la línea diaria.
- **Pendiente (slope):** regresión lineal simple sobre la serie diaria → subiendo / plano / bajando. Es el número que distingue al que mejora del que se quedó.

### 2.2 Índice de Trayectoria (IT)

```
IT = (0.5 × Nivel_normalizado_R) + (0.5 × Mejora_normalizada)
  Nivel_normalizado_R = actividad reciente, escalada 0-100
  Mejora_normalizada  = (R − P) / max(P, base_mínima), escalada y acotada 0-100 (clamp)
```
Peso 50/50 nivel/mejora (calibrable: subir el peso de "mejora" premia más el movimiento).

| Etiqueta | Condición | Lectura |
|---|---|---|
| 🚀 **En ascenso** | Δ positivo y significativo | Reconocer públicamente (principio 5). Lo que Gabriel quiere premiar. |
| ✅ **Sostenido alto** | Nivel alto, Δ ≈ 0 | Campeón estable. Candidato a buddy/entrenador. |
| ➡️ **Estable bajo** | Nivel bajo, Δ ≈ 0 | **El que "usó poco todo el tiempo".** Foco de E1/E2. |
| 📉 **En descenso** | Δ negativo | Alerta temprana: algo cambió. Conversar. |
| 🆕 **Sin historia** | < N días en sistema | No comparable aún; no penalizar. |

**Cómo se lee:** dos personas con el mismo nivel bajo hoy se separan por su etiqueta — 🚀 recibe reconocimiento; ➡️ recibe acompañamiento. Resuelve el principio 5 con un número defendible.

---

## 3. Métricas de DESEMPEÑO por usuario (todas con tendencia)

| Métrica | Definición | Dato fuente | KPI |
|---|---|---|---|
| **Cantidad de tareas** | Activas + cerradas donde participa | `taskResponsibleIds()` L2130 | K6 |
| **% completadas** | Cerradas / total asignadas | `status`, `statusHistory` | — |
| **% cierres con evidencia completa** | Cerradas con fotos/condiciones | `selectedWithoutEvidence` L6580/L7141 | **K2** |
| **Calidad / sin avería** | Ítems sin `condition: damaged` / total | `items[].condition`, `damageType` | **K5** |
| **Perfect Order (contribución)** | Completas + sin daño + a tiempo + con evidencia + sin reproceso | combinación + `dueDate` | **K1** |
| **Lead/cycle time** | Tiempo entre transiciones donde actuó | deltas de `statusHistory[].date` | **K3** |
| **% a tiempo** | Cerradas dentro de `dueDate` | `dueDate` vs cierre | **K4** |
| **Reproceso** | Tareas reabiertas | retrocesos en `statusHistory` | K5 |

> **Anti-antipatrón:** **nunca medir cantidad sin calidad.** Por eso el desempeño se grafica como **scatter calidad × cantidad** (§6). Todo con tendencia (principio 5).

---

## 4. Modelo de ATRIBUCIÓN para tareas compartidas (el corazón del encargo)

### 4.1 El problema (palabras de Gabriel)
> *"En una tarea compartida cualquiera puede subir la foto, pero eso NO indica que los demás no hicieron el trabajo físico. Quiero que estas valoraciones sean de grupo, aunque le cuenten a cada uno individualmente."*

### 4.2 Qué dato existe HOY (hecho verificado)

| Dato | ¿Autor individual? | Implicación |
|---|---|---|
| `assignedTo` + `auxiliaryAssignees[]` + `executors[]` | **Sí** — define el **grupo** | Sabemos **quiénes** integran la tarea ✅ |
| `evidence_images[]` (fotos) | **NO** — array de URLs, sin autor | **No** sabemos quién subió cada foto ❌ |
| `items[].empaque_confirmacion.{by,at}` | **Sí** | Mejor huella individual ✅ |
| `fotos_guia[].confirmado_by/at`, `evidencias[].by` | **Sí** | Huella adicional ✅ |
| `statusHistory[].by` + `.date` | **Sí** (tras normalizar) | Quién hizo avanzar ✅ |
| `messages[].fromId` | **Sí** | Participación blanda ✅ |

**Conclusión (honestidad):** la intuición de Gabriel es correcta — **"subió la foto" no es atribuible hoy** (la foto no tiene autor). Pero **"confirmó el item / movió el estado / aportó evidencia de guía" SÍ**. Hoy se atribuye **participación**, no autoría de cada foto.

### 4.3 Opciones de modelo

| Opción | Cómo | Veredicto |
|---|---|---|
| **A — Crédito compartido pleno** | Cada participante recibe **+1 crédito completo** por la tarea | **Base recomendada** — es lo que Gabriel pidió |
| **B — Crédito dividido (1/N)** | Reparte 1/N | Descartado (contradice a Gabriel, penaliza el equipo) |
| **C — Ponderado por rol** | Pesos por rol | Opcional, fase 2 |
| **D — Ponderado por huella** | Crédito pleno + bonus por huella verificable | **Evolución recomendada de A** |

### 4.4 Recomendación: híbrido A→D, en dos capas
1. **Capa de crédito (lo que Gabriel pidió, hoy):** crédito de grupo compartido = cada participante recibe el crédito **completo** en su gráfico. Una tarea compartida de 3 suma 1 a cada uno, no se diluye.
2. **Capa de huella (contexto, sin restar crédito):** mostrar "confirmó X de Y ítems", "movió el estado N veces", "aportó evidencia de guía". El que hizo trabajo físico pero no tocó la app conserva su crédito; el encargado ve la huella para su juicio cualitativo. **El sistema no decide quién trabajó físico — eso lo sabe el encargado en gemba; el sistema le da el dato para apoyar, no sustituir.**

### 4.5 Qué falta ("a la larga" de Gabriel)
**Un campo nuevo lo resuelve:** agregar `uploadedBy` + `uploadedAt` a cada `evidence_images[]` (hoy solo URL). Cambio pequeño y de bajo riesgo (Mark). **No bloquea** — la capa 1 funciona ya.

---

## 5. Medición del trabajo de los ENCARGADOS (validación)

Regla verificada: **solo admin valida** (`status: validated`, L5651). Managers/encargados gestionan (asignan, supervisan, confirman, cierran a `completed`). El tablero mide ambas.

| Métrica | Definición | Dato fuente | Detecta |
|---|---|---|---|
| **Validaciones / cierres** | Cambios a `validated`/`completed` por persona | `statusHistory` por `by` | Quién cierra y quién no |
| **Velocidad de validación** | Tiempo `completed`→`validated`/cierre | deltas de fecha | Cuello de botella en supervisión |
| **Backlog "completadas sin validar"** | Tareas en `completed` esperando, por encargado y antigüedad | `status` + tiempo | **El KPI más importante del bloque** — WIP atascado |
| **Cobertura de supervisión** | % de tareas de sus auxiliares que tocó | `taskResponsibleIds` + `statusHistory.by` | Encargado ausente vs presente |
| **Calidad de supervisión** | Validó/cerró y luego se reabrió o tuvo avería | retrocesos + `condition: damaged` | Validación "de cartón" |
| **Carga del encargado** | Tareas activas bajo su `managerId` (4+ = sobrecarga) | `workload` L4778 | Encargado saturado |

**Cómo se lee:** backlog alto + velocidad lenta = cuello de botella (rebalancear, no "valida más rápido"). Validación rápida + reaperturas altas = validación de cartón (riesgo de calidad). **Andon:** alerta cuando una tarea lleva >X h en `completed` sin validar.

---

## 6. Diseño de la VISUALIZACIÓN (dashboard)

Cada gráfico lleva a una decisión (no dashboards sin decisión).

1. **Semáforo de adopción (tiempo real)** — grid de tarjetas por usuario 🟢🟡🔴⚫, agrupadas por rol, con sparkline 7d y etiqueta de trayectoria. *Decisión: ¿quién no usa la plataforma? (pregunta #1 de Gabriel).*
2. **Cantidad de tareas por usuario** *(pedido #3a)* — barras horizontales apiladas por estado (activas/completadas/validadas), marca de sobrecarga (4+), toggle individual vs compartida. *Decisión: balance de carga.*
3. **Nivel de uso en el tiempo** *(pedido #3b)* — líneas de media móvil 7d por usuario, con marca de go-live y fin de E0. *Decisión: ¿la adopción sube, se aplana o cae?*
4. **Scatter Calidad × Cantidad** *(pedido #3c)* — X=cantidad, Y=calidad, tamaño=trayectoria. Cuadrantes (campeones / volumen sin calidad / foco E1 / cuidadoso). *Decisión: no premiar volumen sin calidad.*
5. **Ranking por Trayectoria** — tabla ordenable por el IT (§2.2), "quién más mejoró". *Decisión: reconocimiento del que sube (principio 5).*
6. **Heatmap de actividad (calendario)** — filas=usuarios, columnas=días, intensidad=actividad. *Decisión: patrones de trabajo, quién desapareció.*
7. **Panel de Encargados** — tabla por encargado (validaciones, velocidad, **backlog sin validar**, reaperturas) + embudo pending→…→validated con conteo atascado. *Decisión: ¿validan? ¿dónde se traba? (propósito #2 de Gabriel).*

> **Regla transversal:** ningún número va solo — **siempre nivel + flecha de tendencia** (↑↓→).

---

## 7. Construible AHORA vs A FUTURO

### 7.1 Construible ya (sin cambio de modelo)
Semáforo de adopción (S1-S4) · Índice de Trayectoria y líneas de uso · tareas por usuario, % completadas, % a tiempo, calidad, Perfect Order · crédito de grupo compartido (capa 1) · métricas de encargados · heatmap, scatter, ranking, embudo.
> **Único prerrequisito:** **normalizar `statusHistory[].by`** (nombre ↔ userId). Bajo riesgo (Mark).

### 7.2 Requiere cambio de modelo ("a la larga")

| Capacidad | Qué falta | Esfuerzo |
|---|---|---|
| **Atribución por foto** | Campo `uploadedBy`+`uploadedAt` en `evidence_images[]` | Bajo (Mark) |
| **"subió evidencia" vs "trabajo físico"** | Imposible 100% por software | Se cubre con capa de huella + criterio del encargado |
| **Tiempo activo real por tarea** | Tracking de interacción | Medio, fase 2 |
| **Persistencia histórica (tendencias largas)** | Snapshots diarios de KPIs (los JSON se sobrescriben) | Medio |

> **Juicio:** el 80% del valor es construible ya. Lo "a la larga" enriquece, no bloquea. Recomiendo arrancar con lo construible y agregar `uploadedBy` en paralelo.

---

## 8. Próximos pasos (qué · quién · cuándo)

| # | Acción | Quién | Cuándo |
|---|---|---|---|
| 1 | **Aprobar diseño** y elegir alcance v1 (recomiendo: todo el §7.1) | Gabriel | Ahora |
| 2 | **Medir línea base** de KPIs y adopción por usuario en producción | Pit + Ron | Esta semana |
| 3 | **Normalizar `statusHistory[].by`** | Mark | Prerrequisito v1 |
| 4 | **Endpoint de métricas** que extienda `computeOpsAgentReport()` con adopción+trayectoria+desempeño | Mark | v1 |
| 5 | **Construir el dashboard** (§6) | Mark | v1 |
| 6 | **Agregar `uploadedBy`/`uploadedAt`** a `evidence_images[]` | Mark | Fase 2 (paralelo) |
| 7 | **Política de uso**: el tablero se lee como diagnóstico del sistema en E0, no como expediente individual | Pit + Gabriel + RRHH | Con go-live |
| 8 | **Cadencia**: alimenta huddle diario + retro mensual con tendencia | Pit | Continuo |

### Decisiones que requieren a Gabriel
1. **Alcance de la v1** (recomiendo: todo el §7.1 ya; `uploadedBy` en paralelo).
2. **Pesos del Índice de Trayectoria** (propuesta 50/50 nivel/mejora — ¿premiar más el movimiento?).
3. **Confirmar el modelo de atribución A→D** (crédito de grupo pleno + capa de huella). Define la semántica de todo el tablero.
4. **Política de lectura en E0** (diagnóstico, no castigo) — para que medir no sabotee la adopción.

---

*Fin del plan. Documento de propuesta — no ejecuta cambios. Metas, umbrales y pesos se calibran contra la línea base real antes del go-live. Estructura de datos verificada en `proxy.js` y los JSON de WWP al 2026-06-14; el conteo de usuarios (15) proviene del archivo de desarrollo y debe re-confirmarse contra producción.*
