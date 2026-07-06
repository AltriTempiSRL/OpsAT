# Auditoría integral de Workforce Platform (WWP) — 6 de julio de 2026

> **Alcance:** procesos y flujo completos de la plataforma (`historial.html` ~35k líneas,
> `proxy.js` ~15.7k líneas, documentos de diagnóstico previos), con 3 exploraciones
> paralelas (ciclo de vida, seguridad/backend, integraciones/módulos) y verificación
> directa en código. **Lente elegido por Gabriel:** riesgo operativo (Odoo + cierre de lazo).
> **Entregable:** este informe + quick-wins aplicados (sección 4).

---

## 1. Resumen ejecutivo y veredicto

**WWP no es un producto a medio construir.** Su lazo central —crear → asignar →
empacar/despachar → evidencia → completar → validar— está en grado de producción,
protegido con gates en el servidor (no solo en pantalla), y en uso diario real.

Además, la auditoría encontró que **la plataforma está más completa de lo que dice su
propia documentación**: varios huecos señalados en los planes de junio y del 2 de julio
ya fueron cerrados y no estaban reflejados en ningún documento:

| Hueco "pendiente" según docs | Realidad verificada en código |
|---|---|
| Cierre diario de operación | Existe: `wwp-daily-close.json` + UI ([proxy.js:571](proxy.js:571)) |
| Latido por reloj (alerta de vencimientos) | Existe: `checkDueTodayAlert` diaria ([proxy.js:4852](proxy.js:4852)) |
| Homologación SDV (H1/H2) | Existe: frontera dura de campos ([proxy.js:13399](proxy.js:13399)) + motor único server-side de crear-tarea ([proxy.js:12556](proxy.js:12556)) |
| Lógica de alertas SDV | Existe y opera en producción |

La pregunta correcta ya no es *"¿está terminado?"* sino *"¿dónde está la frontera de
robustez, cierre de lazo y escala?"*. Este informe la mapea en 6 fronteras (sección 3),
aplica los 6 arreglos de bajo riesgo/alto valor (sección 4, **verificados 19/19 en
pruebas locales**) y deja el resto como backlog priorizado (sección 5).

**El hallazgo más importante de la auditoría no es de software sino de infraestructura:
las fotos de evidencia viven SOLO en el disco de Railway** — los respaldos automáticos
cubren los datos (.json) pero excluyen las fotos ([proxy.js:165](proxy.js:165)). Si ese
disco falla, la evidencia probatoria de todos los despachos se pierde de forma permanente.
Ver F0 y R0a.

---

## 2. Lo que está sólido (con evidencia)

### 2.1 Ciclo de vida y gates
- **Pick-gate de inicio**: un despacho no puede iniciar si el pick de Odoo no está `done`;
  regla de Pit 23-jun para picks cancelados y almacenes de despacho directo
  ([proxy.js:9753](proxy.js:9753)).
- **Checklist de despacho**: 3 evidencias obligatorias antes de completar (recepción de
  documentos, foto del vehículo cargado, documentos firmados) — validado en servidor.
- **OUT-gate específico**: al validar, se comprueba en Odoo el estado del OUT *confirmado
  por el encargado* (no el agregado por orden, que engañaría con backorders)
  ([proxy.js:9722](proxy.js:9722)); override consciente con motivo auditado.
- **Cascadas** de cancelación/validación entre tarea madre y subtareas; cadenas con
  `dependsOnPrev` (un paso no inicia si el anterior no cerró).
- **Guard H0-5**: una tarea no puede nacer apuntando a una SDV cancelada o despachada.

### 2.2 Seguridad base
- Contraseñas con **PBKDF2-SHA512, 100k iteraciones** ([proxy.js:2452](proxy.js:2452)).
- **JWT HS256 con comparación timing-safe** ([proxy.js:2438](proxy.js:2438)).
- **RBAC por endpoint** (`requireRole`, `isTaskParticipant`); sin IDOR evidentes en el barrido.
- Impersonation de admin **auditada** (quién actuó como quién).
- Rate-limit de login y de cambio de contraseña self-service.

### 2.3 Persistencia blindada (post-incidente 25-jun)
- Escritura **atómica** tmp→rename; guarda **anti-vacío** que bloquea truncados y preserva
  el archivo bueno + respaldo rotativo cada 5 min ([proxy.js:135](proxy.js:135));
  **snapshot horario** de todos los .json ([proxy.js:165](proxy.js:165)).

### 2.4 Módulos completos en producción
Inspección de vehículos con gate diario, LMS/Salón de Entrenamientos, lunch/breaks,
dashboards (Estado de Órdenes, OUT-cierre, equipo, SDV-KPIs), calendario WWP con
bitácora, mapa 3D del almacén, auditor de procesos + ops-agent (IA con fallback
heurístico), Codex Bridge para reuniones con datos vivos.

---

## 3. Las 6 fronteras de oportunidad (ordenadas por el lente operativo)

### F0 · Durabilidad de la evidencia fotográfica — el core probatorio ⚠️ LA MÁS URGENTE
**Lo eficiente ya está resuelto:** compresión en el cliente (`_compressImage`, 1280px /
JPEG 82% — [historial.html:15047](historial.html:15047), ~193 KB por foto medido),
archivos en disco servidos por URL (no base64 en los .json), deduplicación por huella
SHA-256 ([proxy.js:13811](proxy.js:13811)), limpieza al borrar tareas.

**Lo frágil es la durabilidad:**
- Los respaldos automáticos **excluyen las fotos**: `snapshotAllCritical` solo copia
  `.json` ([proxy.js:165](proxy.js:165)). **El volumen de Railway es la única copia.**
- Sin offload a object storage (R2/B2/S3); sin política de retención/archivado.
- Videos de chat sin comprimir (hasta 30 MB c/u — [proxy.js:9254](proxy.js:9254)).
- Hasta hoy, sin visibilidad del disco → un "disco lleno" rompería la subida de evidencia
  y el cierre de tareas sin ningún aviso previo. **Cerrado hoy con QW6.**

### F1 · Divergencia con Odoo (doble verdad)
- La sincronización es unidireccional (WWP→Odoo); un pick cancelado en Odoo no degrada
  la tarea en WWP.
- Sin reconciliación de cantidades SDV↔pick en `sync-to-odoo`.
- La avería se captura localmente pero no genera nota de crédito (`account.move`) en Odoo.
- El OUT-gate es **fail-open**: si Odoo está caído, la validación pasa (intencional para
  no frenar la operación). Hasta hoy ese paso era invisible. **Hecho medible hoy con QW4.**

### F2 · Cierre de lazo / accountability
- El cierre diario existe pero no es obligatorio ni tiene recordatorio (scheduler apagado
  esperando OK).
- El handoff auxiliar→encargado es unilateral (sin acuse de recibo).
- `dueDate` no era obligatorio → tareas que nacían "sin compromiso". **Cerrado hoy con QW5.**
- La notificación "listo para validar" es pasiva (no hay bandeja de validación).

### F3 · Seguridad — huecos puntuales
- El token de reset de contraseña se imprimía **completo en los logs de Railway**, con URL
  `localhost` fija (inservible en prod). **Cerrado hoy con QW1.**
- Cambiar/resetear contraseña no invalidaba las sesiones existentes. **Cerrado hoy con QW3.**
- `JWT_SECRET` solo podía vivir en archivo del disco de datos. **Opción env agregada hoy (QW2).**
- Refresh token sin rotación; sin SMTP/Discuss para el correo real de reset (→ R7).

### F4 · Brechas de captura para analítica de personas
Sin `startedAt` a nivel tarea, sin `cancelReason`, sin `uploadedBy` en fotos,
`statusHistory.by` sin normalizar, atribución por auxiliar no expuesta en el bridge (→ R8).

### F5 · Deuda técnica y escala
Monolito de 35k (front) + 15.7k (back) líneas; persistencia JSON last-write-wins — sana
para el equipo actual (<50 usuarios), no escala a 100+ (→ R9, R10).

---

## 4. Quick-wins aplicados hoy (verificados 19/19 en local)

| # | Qué se arregló | Dónde | Verificación |
|---|---|---|---|
| QW1 | El enlace/token de reset **ya no se imprime en logs de producción** (en local sí, con host real del request, para poder probar); evento auditable `password_reset_requested` | [proxy.js:8304](proxy.js:8304) | PASS ×3 (local imprime, prod no filtra, audit) |
| QW2 | `JWT_SECRET` acepta **variable de entorno** (el secreto puede dejar de tocar disco). ⚠️ Activarla en Railway invalida los tokens vivos → relogin de todos; decidir cuándo | [proxy.js:2413](proxy.js:2413) | PASS ×2 (firma con env, rechaza la de archivo) |
| QW3 | Cambiar o resetear contraseña **cierra todas las sesiones previas** del usuario (3 rutas: reset por token, self-service, admin) | [proxy.js:8336](proxy.js:8336), [9003](proxy.js:9003), [9020](proxy.js:9020) | PASS ×4 |
| QW4 | El **fail-open del OUT-gate deja huella**: marca `task.outGateFailOpen {at, outRef, error}` + evento auditable `out_gate_fail_open`. No cambia el comportamiento (sigue sin frenar la operación), pero la divergencia ya es visible y medible para el dashboard OUT-cierre | [proxy.js:9744](proxy.js:9744) | PASS ×3 (con Odoo caído real) |
| QW5 | **Ninguna tarea nace sin fecha compromiso**: sin `dueDate` → subtarea hereda la del padre; staffing usa su fecha fin; despacho vence HOY; el resto mañana. Marca `dueDateAuto:true` para que la analítica distinga fecha puesta por sistema vs por humano | [proxy.js:9353](proxy.js:9353) | PASS ×3 |
| QW6 | `/api/health?deep=true` reporta **footprint de evidencia** (archivos y MB por carpeta `wwp-fotos`/`av-fotos`/`desp-fotos`/`emp-fotos`) + **espacio libre/total del volumen**. Base para dimensionar el disco y alertar antes de que se llene | [proxy.js:6012](proxy.js:6012) | PASS ×3 |

**Método de verificación:** `node --check` + servidor local con `data-local` y Odoo
inalcanzable a propósito (para probar el fail-open real), harness de 19 aserciones con
usuarios semilla y Bearer, restauración completa de los datos locales al terminar.
Sin `_stress360` (cambios sin dependencia de Odoo, según convención del proyecto).

**Nada de esto está desplegado.** El deploy requiere OK explícito de Gabriel
(commit+push antes de `railway up`, un solo deploy agrupado, fuera de ventana de picking).

### Acción manual complementaria (Gabriel / infra)
Confirmar en el panel de Railway el **tamaño del volumen** montado en `DATA_DIR` y su
**uso actual**. No es visible desde el código (QW6 lo hará visible tras el deploy) y
define la urgencia de R0a/R0b.

---

## 5. Backlog priorizado (roadmap — no se toca sin decisión)

| # | Oportunidad | Lente | Sev. | Esfuerzo |
|---|---|---|---|---|
| R0a | **Backup offsite de las fotos** (sync de `*-fotos/` a object storage S3-compatible o snapshot periódico del volumen) — hoy el volumen de Railway es la única copia de la evidencia | Evidencia | **Crítica** | Medio |
| R0b | Offload de evidencia a object storage (Cloudflare R2 / Backblaze B2) con referencias en JSON; desacopla la evidencia del disco de cómputo | Evidencia | Alta | Alto |
| R0c | Comprimir/acotar videos de chat + política de retención/archivado de evidencia validada | Evidencia | Media | Medio |
| R1 | Sync inverso de picking Odoo→WWP (pick cancelado/anulado degrada la tarea) | Odoo | Alta | Medio |
| R2 | Reconciliación de cantidad SDV↔pick en `sync-to-odoo` (aviso, no bloqueo duro primero) | Odoo | Alta | Medio |
| R3 | Nota de crédito automática por avería (`/api/averias/:id/sync-to-odoo` → `account.move`) | Odoo | Media | Medio |
| R4 | Cierre diario obligatorio + recordatorio (encender scheduler, hoy apagado) | Cierre | Alta | Medio |
| R5 | Acuse de recibo del handoff auxiliar→encargado (`/tasks/:id/mgr-acknowledge`) | Cierre | Media | Bajo |
| R6 | Notificación proactiva "listo para validar" + bandeja de validación | Cierre | Media | Bajo |
| R7 | Rotación de refresh token + SMTP/Discuss real para el correo de reset | Seguridad | Media | Medio |
| R8 | Captura: `startedAt`, `cancelReason`, `uploadedBy`, normalizar `statusHistory.by`, atribución por auxiliar en el bridge | Analítica | Media | Medio |
| R9 | Perf Banda B (render incremental, diferir cascada `enterApp`) y C (partir el monolito) | Escala | Media | Alto |
| R10 | Persistencia JSON→SQLite/PG (transacciones, fin del race last-write-wins) para >100 usuarios | Escala | Media | Alto |

Cada fila puede convertirse en una sesión propia con su agente (Ron para Odoo,
Carl para backend/persistencia, Pit para proceso/cierre, Mark para UI).

---

## 6. Anexo — mapa de evidencia por fase del ciclo

| Fase | Mecanismo | Referencia |
|---|---|---|
| Creación | Validaciones de tipo/prioridad/fecha + guard SDV terminal + default `dueDate` (QW5) | [proxy.js:9324](proxy.js:9324) |
| Creación desde SDV | Motor único server-side (H1-1), mismo snapshot que aprobación 1-clic | [proxy.js:12556](proxy.js:12556) |
| Inicio (despacho) | Pick-gate: pick `done` en Odoo; regla cancel/directo | [proxy.js:9753](proxy.js:9753) |
| Inicio (empaque/almacén) | Gate de items asignados + aviso picking pendiente | [proxy.js:9645](proxy.js:9645) |
| Ejecución | Evidencia comprimida cliente + dedup SHA-256 + servida por URL | [historial.html:15047](historial.html:15047), [proxy.js:13811](proxy.js:13811) |
| Completar (despacho) | Checklist 3 fotos + entrega por artículo | [proxy.js:9664](proxy.js:9664) |
| Validar (despacho) | OUT-gate específico + override auditado + fail-open auditable (QW4) | [proxy.js:9722](proxy.js:9722) |
| Cierre diario | `wwp-daily-close.json` + UI | [proxy.js:571](proxy.js:571) |
| Latido de reloj | `checkDueTodayAlert` (vencen hoy, no cerradas) | [proxy.js:4852](proxy.js:4852) |
| Persistencia | Atómica + anti-vacío + rotativos + snapshot horario (solo .json) | [proxy.js:135](proxy.js:135), [165](proxy.js:165) |
| Salud | `/api/health` (shallow/deep) + evidencia y disco (QW6) | [proxy.js:6012](proxy.js:6012) |

*Informe generado en la sesión de auditoría del 6-jul-2026. Los números de línea
corresponden al estado del código CON los quick-wins ya aplicados.*
