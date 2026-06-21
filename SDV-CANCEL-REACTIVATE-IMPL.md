# Implementación Backend: Cancelación + Reactivación SDV

**Fecha:** 2026-06-21  
**Implementado por:** Carl (código backend)  
**Estado:** Completo y testeado  

---

## Resumen

Se han implementado **5 endpoints backend** en `proxy.js` para permitir cancelación y reactivación de Solicitudes de Despacho Ventas (SDV) con auditoría centralizada, validaciones de estado y notificaciones a Ops.

---

## Endpoints Implementados

### 1. PATCH `/api/sdv/:id?action=cancel`
**Rol requerido:** Cualquier autenticado (validaciones por estado)

Cancela una SDV. Validaciones de estado:
- **Estado A, B, C:** Procede sin restricción
- **Estado D, E (empaque_in_progress):** 403 (bloqueado) salvo `force=true` + role=admin/ops_manager
- **Estado F (en tránsito):** 400 (imposible cancelar)

**Request:**
```json
{
  "motivo": "Cliente cambió idea",
  "urgencia": "normal",
  "plazo_tentativo": "2026-06-22T10:00:00Z"  // opcional
}
```

**Response 200:**
```json
{
  "ok": true,
  "sdv": { id, estado: "cancelada", cancelado_por, cancelado_at, ... },
  "auditoriaId": "aud_xyz"
}
```

**Response 403 (bloqueado):**
```json
{
  "ok": false,
  "error": "Cancelación bloqueada: empaque en progreso",
  "estado_actual": "empaque_in_progress",
  "riesgo": "alto"
}
```

**Operaciones internas:**
- Marca SDV como `cancelada`
- Si existe tarea WWP ligada, la marca como `cancelled`
- Registra en auditoría inmutable (tipo: `cancelada`)
- Notifica a Ops (bandeja + PUSH si online)
- Agrega entrada a `statusHistory`

---

### 2. POST `/api/sdv/:id/reactivation`
**Rol requerido:** Vendedora (rol=ventas)

Vendedora solicita reactivación CON nueva fecha. **No rechaza**; crea registro "pendiente" para que Ops procese.

**Request:**
```json
{
  "new_delivery_date": "2026-06-25T10:00:00Z",
  "motivo_reactivacion": "Cliente confirmó nueva fecha"
}
```

**Response 201:**
```json
{
  "ok": true,
  "reactivacion_id": "reac_xyz",
  "estado": "pendiente",
  "mensaje": "Reactivación solicitada. Ops la procesará en su programación."
}
```

**Validaciones:**
- SDV debe estar en estado `cancelada`
- Fecha no puede ser retroactiva
- `new_delivery_date` y `motivo_reactivacion` requeridos

**Operaciones internas:**
- Crea registro en tabla `sdv_reactivation_requests`
- Registra en auditoría (tipo: `reactivacion_solicitada`)
- Notifica a Ops (bandeja + PUSH)

---

### 3. PATCH `/api/sdv/reactivation/:id?action=process`
**Rol requerido:** admin, ops_manager, manager

Ops procesa reactivación: elige CUÁNDO procesarla. Crea nueva tarea WWP con nueva fecha.

**Request:**
```json
{
  "action": "process",
  "cuando_procesar": "2026-06-24T17:00:00Z",
  "notas_ops": "Incluida en ruta vespertina"
}
```

**Response 200:**
```json
{
  "ok": true,
  "nueva_tarea_id": "wt_abc123",
  "nueva_fecha": "2026-06-24T17:00:00Z",
  "mensaje": "Reactivación procesada. Nueva tarea creada."
}
```

**Validaciones:**
- Reactivación debe estar en estado `pendiente`
- Fecha no puede ser retroactiva

**Operaciones internas:**
- Crea **nueva tarea WWP** (tipo: `dispatch_order`)
  - Título: `"{cliente} (REV)"`
  - `relacionada_a_sdv`: ID de SDV cancelada original
  - `sdvOriginalCancelada`: ID de SDV cancelada original
  - `dueDate`: fecha elegida por Ops (`cuando_procesar`)
- Actualiza reactivación a estado `procesado`
- Registra en auditoría (tipo: `reactivacion_procesada`)
- Notifica a Ops

**Nota:** La vendedora que canceló puede no ser la misma que solicita reactivación (flexible).

---

### 4. GET `/api/sdv/reactivation?estado=pendiente`
**Rol requerido:** admin, ops_manager, manager

Bandeja para Ops: reactivaciones filtradas por estado (default: `pendiente`).

**Query params:**
- `?estado=pendiente` — solo pendientes (default)
- `?estado=procesado` — solo procesadas
- Etc.

**Response 200:**
```json
{
  "ok": true,
  "reactivaciones": [
    {
      "id": "reac_xyz",
      "sdv_id": "sdv_...",
      "cliente": "García & Cía",
      "solicitado_por": "María (vendedora)",
      "solicitado_at": "2026-06-21T10:47:00Z",
      "nueva_fecha_solicitada": "2026-06-25T10:00:00Z",
      "motivo": "Cliente confirmó nueva fecha",
      "estado": "pendiente",
      "procesado_por": null,
      "cuando_procesar": null,
      "nueva_tarea_id": null
    }
  ]
}
```

**Operaciones internas:**
- Enriquece con datos de SDV (cliente)
- Ordena por `solicitado_at` DESC

---

### 5. GET `/api/sdv/kpis/cancelaciones`
**Rol requerido:** admin, ops_manager, manager

Dashboard KPI: "Cancelaciones & Devoluciones" para semana actual.

**Response 200:**
```json
{
  "ok": true,
  "kpis": {
    "totalCancelaciones": 12,
    "reactivacionesProcesadas": 3,
    "porcentajePostEmpaque": 25,
    "porcentajePostEmpaqueTarget": 5,
    "tiempoPromedioOps": 3.2,
    "tiempoPromedioTarget": 5,
    "alertas": [
      {
        "tipo": "warning",
        "mensaje": "2 reactivaciones en timeout (>1h sin procesar)"
      }
    ]
  }
}
```

**Métricas calculadas:**
- `totalCancelaciones` — COUNT(canceladas en últimos 7 días)
- `reactivacionesProcesadas` — COUNT(reactivacion_procesada en últimos 7 días)
- `porcentajePostEmpaque` — % cancelaciones con estado D/E al momento
- `porcentajePostEmpaqueTarget` — 5% (objetivo de mejora)
- `tiempoPromedioOps` — minutos promedio entre cancelación y decisión Ops
- `tiempoPromedioTarget` — 5 minutos (objetivo)
- `alertas` — listado de condiciones anómalas

---

## Tablas/Archivos Persistentes

### 1. `sdv-reactivation-requests.json` (NUEVA)
```json
{
  "id": "reac_xyz",
  "sdv_id": "sdv_123",
  "solicitado_por": "user_vendedora",
  "solicitado_por_nombre": "María",
  "solicitado_at": "2026-06-21T10:47:00Z",
  "nueva_fecha_entrega": "2026-06-25T10:00:00Z",
  "motivo_reactivacion": "Cliente confirmó nueva fecha",
  "estado": "pendiente",  // | "procesado" | "rechazado"
  "procesado_por": null,
  "procesado_por_nombre": null,
  "procesado_at": null,
  "cuando_procesar": null,
  "notas_ops": null,
  "nueva_tarea_id": null
}
```

### 2. `sdv-cancellation-audit.json` (NUEVA)
```json
{
  "id": "aud_xyz",
  "sdv_id": "sdv_123",
  "tipo_evento": "cancelada",  // | "reactivacion_solicitada" | "reactivacion_procesada"
  "usuario_id": "user_123",
  "usuario_nombre": "Juan",
  "timestamp": "2026-06-21T10:47:00Z",
  "detalles": {
    "motivo": "Cliente cambió idea",
    "estado_al_momento": "A",
    "riesgo_asumido": false,
    "fuerza_aplicada": false
  }
}
```

### Modificación: `sdv-solicitudes.json`
Se agregaron campos a cada SDV:
```json
{
  "id": "sdv_123",
  ...existentes...,
  "cancelado_por": null,  // userId
  "cancelado_por_nombre": null,  // nombre
  "cancelado_at": null  // ISO timestamp
}
```

### Notificaciones: `ops-notifications.json` (NUEVA)
```json
{
  "id": "notif_xyz",
  "sdv_id": "sdv_123",
  "tipo": "sdv_cancelada",  // | "reactivacion_pendiente"
  "cliente": "García & Cía",
  "detalles": { ... },
  "leido": false,
  "timestamp": "2026-06-21T10:47:00Z"
}
```

---

## Patrones Implementados

### Patrón 1: Auditoría Centralizada
Cada acción registra un evento inmutable en `sdv-cancellation-audit.json`:

```javascript
auditLogSdvEvent(tipo_evento, sdv_id, usuario_id, usuario_nombre, detalles);
```

**Tipos de evento:**
- `cancelada` — SDV cancelada
- `reactivacion_solicitada` — Vendedora solicita reactivación
- `reactivacion_procesada` — Ops procesa reactivación

### Patrón 2: Validación de Estado
Bloquea operaciones según estado actual:

```javascript
if (['D', 'E', 'empaque_in_progress', 'packing'].includes(estado)) {
  if (!force) return 403; // Bloqueado
  if (!['admin', 'ops_manager', 'manager'].includes(role)) return 403; // No autorizado
}
```

### Patrón 3: Notificaciones Centralizadas
Todas las notificaciones usan `notifySdvToOps()`:
- Guarda en bandeja Ops
- Envía PUSH si online (via web-push)
- Log en auditoría

```javascript
await notifySdvToOps(sdv_id, tipo, cliente, detalles);
```

### Patrón 4: Enriquecimiento de Datos
Endpoints GET retornan datos completos (cliente, nombres de usuario, etc.):

```javascript
// GET /api/sdv/reactivation enriquece con datos de SDV
const sdvMap = {};
sdvList.forEach(s => { sdvMap[s.id] = s; });
reacEnriquecidas = reacList.map(r => ({
  ...r,
  cliente: sdvMap[r.sdv_id]?.clienteNombre || 'Sin cliente'
}));
```

---

## Validaciones de Entrada

Todos los endpoints validan:

1. **JWT requerido** — `requireJwt(req, res)`
2. **Role requerido** — `requireRole(jp, res, ['admin', ...])`
3. **Campos requeridos:**
   - CANCEL: `motivo`
   - REACTIVATE: `new_delivery_date`, `motivo_reactivacion`
   - PROCESS: `cuando_procesar`
4. **Fechas válidas:** No retroactivas, formato ISO 8601
5. **Estados válidos:** Solo canceladas pueden reactivarse

---

## Flujo Completo de Usuario

```
Vendedora crea SDV
    ↓
Ops aprueba (estado: in_process)
    ↓
[Vendedora cancela]
    ↓
SDV → estado: cancelada
Auditoría: tipo_evento = "cancelada"
Notificación → Ops
    ↓
[Vendedora solicita reactivación con nueva fecha]
    ↓
POST /api/sdv/:id/reactivation
Crea registro: sdv_reactivation_requests (estado: pendiente)
Auditoría: tipo_evento = "reactivacion_solicitada"
Notificación → Ops (Bandeja de reactivaciones)
    ↓
[Ops ve bandeja: GET /api/sdv/reactivation?estado=pendiente]
    ↓
[Ops procesa reactivación]
    ↓
PATCH /api/sdv/reactivation/:id?action=process
Crea nueva tarea WWP
Actualiza reactivación a "procesado"
Auditoría: tipo_evento = "reactivacion_procesada"
Notificación → Ops
    ↓
[Dashboard KPI]
    ↓
GET /api/sdv/kpis/cancelaciones
Muestra: total, % post-empaque, tiempo Ops, alertas
```

---

## Errores y Códigos HTTP

| Código | Condición | Endpoint |
|--------|-----------|----------|
| 200 | Éxito (PATCH, GET) | Todos |
| 201 | Creado (POST reactivation) | POST /api/sdv/:id/reactivation |
| 400 | Validación fallida (fecha retroactiva, estado inválido, etc.) | Todos |
| 401 | Sin JWT o JWT inválido | Todos |
| 403 | Cancelación bloqueada (estado D/E, sin force) o rol no autorizado | PATCH /api/sdv/:id?action=cancel, PATCH /api/sdv/reactivation/:id |
| 404 | SDV/Reactivación no encontrada | Todos |
| 422 | Campo requerido faltante | Todos |
| 500 | Error interno | Todos |

---

## Testing

Se incluye script de testing: `test-sdv-cancel-reactivate.sh`

```bash
bash test-sdv-cancel-reactivate.sh
```

**Flujo del test:**
1. Login como vendedor
2. Crear SDV de prueba
3. Cancelar SDV
4. Solicitar reactivación
5. Login como Ops/Manager
6. Ver bandeja de reactivaciones
7. Procesar reactivación
8. Ver KPIs

---

## Compatibilidad con UI (Mark)

Los payloads coinciden exactamente con la especificación:

- ✅ Modal cancelación (motivo, observaciones, confirmación)
- ✅ Modal bloqueo (estados D-E)
- ✅ Bandeja "Reactivaciones pendientes" (Ops)
- ✅ Modal procesar reactivación (Ops: fecha/hora)
- ✅ Dashboard KPI section

---

## Notas de Implementación

1. **wwpId()** y **nextTaskSeq()** son funciones existentes en proxy.js
2. **Auditoría inmutable:** Una vez registrado, no se puede modificar; solo se añaden nuevos eventos
3. **Notificaciones lazy:** Si web-push no está instalado, se ignoran PRUSHs (no fallan los endpoints)
4. **Banda JSON comprida:** Respuestas GET usan `sendGzipJson()` para reducir payload
5. **Cache:** Ninguno (datos siempre frescos); futuro: agregar TTL en bandeja Ops si es necesario
6. **Transacciones:** No hay lock pessimista; se usan lectura + escritura secuencial (suficiente para write-queue de RailWay)

---

## Archivos Modificados

- ✅ `proxy.js` — +500 líneas (5 endpoints + 2 funciones auxiliares + 5 constantes)
- ✅ `test-sdv-cancel-reactivate.sh` — script curl para testing
- 🆕 Tablas JSON: `sdv-reactivation-requests.json`, `sdv-cancellation-audit.json`, `ops-notifications.json`
- 🔄 Modificado: `sdv-solicitudes.json` (se agregan campos `cancelado_*`)

---

## Próximos Pasos (Mark - UI)

1. Componentes modales para cancelación/reactivación
2. Bandeja Ops (visual de reactivaciones pendientes)
3. Dashboard KPI section
4. Notificaciones en tiempo real (banner de nuevas reactivaciones)
5. Integración con flujo de empaque (UI valida "no se puede cancelar si en empaque")

---

**Estado:** ✅ Completo y listo para integración con UI
