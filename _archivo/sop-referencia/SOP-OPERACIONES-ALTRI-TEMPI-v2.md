# PROCEDIMIENTO OPERATIVO ESTÁNDAR
## Gestión Integral: Compras, Inventario, Despacho y Entrega al Cliente

| Campo | Valor |
|---|---|
| **Empresa** | Altri Tempi |
| **Versión** | 2.0 |
| **Fecha** | 2026-06-12 |
| **Sistemas** | Odoo ERP + Workforce Platform (WWP) |
| **Dueño del proceso** | Coordinador de Logística |
| **Revisado por** | Gerencia de Operaciones |

---

## 1. OBJETIVO

Establecer el procedimiento operativo estándar para la gestión integral del flujo de mercancías
en Altri Tempi, desde la creación de la orden de compra hasta la entrega final al cliente,
integrando trazabilidad en **Odoo ERP** y evidencia operativa en **Workforce Platform (WWP)**.

**Odoo** es la fuente de verdad del movimiento físico — ningún movimiento es válido sin su
transferencia correspondiente registrada.
**WWP** es la fuente de verdad de la ejecución humana — evidencia, asignaciones y seguimiento
de tareas del equipo operativo.

---

## 2. ALCANCE

Este procedimiento aplica a todas las operaciones relacionadas con:

- Compras y recepción de productos
- Almacenamiento e inventario
- Preparación, despacho y entrega al cliente
- Transferencias internas entre almacenes y tiendas
- Devoluciones y notas de crédito

Aplica a todos los almacenes activos: **ALVEN · PTN · CDP · OUTLE · OUT27 · STI · NAVE2**

---

## 3. RESPONSABLES DEL PROCESO

| Rol | Responsabilidad principal |
|---|---|
| Encargado de Compras | Órdenes de compra, seguimiento de proveedores |
| Coordinador de Logística | Planificación despachos, asignación de recursos, supervisión en WWP |
| Encargado de Almacén | Recepción, inspección, validación Odoo, supervisión equipo |
| Auxiliar de Almacén | Descarga, conteo físico, escaneo handheld, empaque |
| Encargado de Tienda | Recepción en tienda, exhibición, validación Odoo |
| Auxiliar de Tienda | Apoyo descarga y ubicación en tienda |
| Ejecutivo de Ventas | Confirmación pedidos, coordinación con cliente, info de entrega |
| Chofer / Transporte | Carga, transporte, entrega física, retiro de devoluciones |
| Área Administrativa | Aprobaciones de devolución, notas de crédito, facturación |

---

## 4. REFERENCIA RÁPIDA: ESTADOS Y RUTAS ODOO

### 4.1 Estados de transferencias (stock.picking)

| Estado en Odoo | Nombre visible | Significado operativo |
|---|---|---|
| `draft` | Borrador | Creada pero no confirmada |
| `confirmed` | En espera | Esperando productos o acción previa |
| `assigned` | **Listo** | Productos reservados — se puede procesar |
| `done` | **Hecho** | Transferencia validada y cerrada |
| `cancel` | Cancelado | Anulada |

> ⚠️ Solo se trabajan transferencias en estado **Listo** (`assigned`). Nunca validar una
> transferencia si no existe el movimiento físico correspondiente.

### 4.2 Estados de pedidos de venta (sale.order)

| Estado | Nombre visible | Qué significa |
|---|---|---|
| `draft` | Cotización | No confirmado — no genera operaciones |
| `sale` | **Pedido de venta** | Confirmado — genera picking automáticamente |
| `done` | Bloqueado | Cerrado contablemente |

### 4.3 Rutas Odoo por almacén

| Almacén | Recepción | Despacho | Pick interno | Devolución cliente |
|---|---|---|---|---|
| ALVEN | `ALVEN/IN/` | `ALVEN/OUT/` | `ALVEN/PICK/` | `WH/RET/` o `ALVEN/RET/` |
| PTN | `PTN/IN/` | `PTN/OUT/` | — | `PTN/RET/` |
| CDP | `CDP/IN/` | `CDP/OUT/` | — | `CDP/RET/` |
| OUTLE | `OUTLE/IN/` | `OUTLE/OUT/` | — | `OUTLE/RET/` |
| STI | `STI/IN/` | `STI/OUT/` | — | `STI/RET/` |

### 4.4 Clasificación de mercancía por riesgo (H1–H5)

| Nivel | Tipo de producto | Protocolo |
|---|---|---|
| H1 | Accesorios, decoración pequeña | Estándar |
| H2 | Muebles de tela/madera intermedios | Estándar + foto empaque |
| H3 | Vidrio, mármol, lacados | Protocolo vidrio — 2 personas mínimo |
| H4 | Piezas únicas, >80kg, voluminosas | Líder de maniobra + evidencia obligatoria |
| H5 | Boffi, marcas premium, proyectos especiales | White glove — aprobación previa, cuarentena si duda |

---

## 5. FLUJO DE PROCESOS: RECEPCIÓN EN ALMACÉN

### 5.1 Recepción física de mercancía (previo a Odoo)

**Responsable principal:** Encargado de Almacén  
**Apoyo:** Chofer proveedor, Auxiliar de Almacén  
**Ruta Odoo:** No aplica en este paso  
**Tarea WWP:** Crear tarea tipo "Recepción" en Workforce Platform antes de iniciar descarga

**Objetivo:** Garantizar que toda la mercancía sea validada físicamente y clasificada
antes de ingresar al sistema o al almacén.

**Prerrequisitos:**
- Orden de compra confirmada (`purchase` = Purchase Order) en Odoo
- Área de recepción habilitada y despejada
- Auxiliares disponibles asignados en WWP

**Pasos:**

1. El Coordinador de Logística o Encargado de Almacén **crea una tarea "Recepción" en WWP**,
   asigna al Encargado responsable e indica: proveedor, número de orden, fecha esperada y
   almacén destino.

2. El chofer o transportista se presenta en el área de recepción designada.

3. El Encargado de Almacén solicita la documentación física:
   - Orden de compra o referencia de la orden Odoo
   - Factura o conduce del proveedor
   - Guía de transporte o albarán
   
   > La documentación debe contener mínimo: proveedor, fecha, número de documento y
   > descripción de la mercancía. **En ausencia de documentación válida, no se autoriza
   > la descarga.**

4. Los Auxiliares de Almacén realizan la descarga controlada bajo supervisión del Encargado,
   colocando la mercancía **únicamente en el área de recepción asignada**.
   
   > Para productos **H3, H4 o H5**: la descarga requiere mínimo 2 personas y debe seguir el
   > protocolo de manejo premium correspondiente.

5. El Auxiliar de Almacén realiza el **conteo físico** verificando cantidades contra el picklist
   o documento del proveedor. Deja constancia escrita de cualquier diferencia.

6. El Encargado de Almacén realiza la **inspección física de cada pieza**:
   - ¿El empaque tiene golpes, roturas o está abierto?
   - ¿El producto tiene daño visible?
   - Si fue desarmado: ¿tiene instrucciones? ¿están todas las piezas?
   - ¿Está correctamente identificado?
   - Para H3+: ¿integridad de ángulos, cantos, superficies?

7. El Encargado clasifica cada pieza como **"conforme"** o **"no conforme"**.

8. **Si hay piezas no conformes:**
   - Se separan físicamente al área de "No Conformidad" o "Cuarentena"
   - Se toman fotografías
   - Se registra la avería en **WWP** (módulo Averías): fecha, proveedor, descripción,
     fotos, cantidad afectada
   - Se notifica a Compras y Administración por correo adjuntando el registro WWP
   - La mercancía no conforme **no puede continuar** el proceso hasta recibir instrucciones

9. Solo la mercancía conforme, con autorización del Encargado, continúa al siguiente proceso.

10. El Encargado **actualiza la tarea WWP** de recepción con el resultado: piezas recibidas,
    piezas no conformes, observaciones, y marca la tarea como completada.

**Condiciones:**
- Prohibido colocar mercancía conforme fuera del almacén o sin identificación
- No se permite continuar sin inspección física completa
- Toda incidencia debe quedar documentada en WWP antes de cerrar la tarea

**KPI:** Tiempo desde llegada del camión hasta mercancía inspeccionada y clasificada ≤ 3h

---

### 5.2 Registro de recepción en Odoo

**Responsable:** Encargado de Almacén  
**Ruta Odoo:** `Inventario → Operaciones → Recepciones`  
**Filtro:** Almacén correspondiente, estado = **Listo** (`assigned`)

**Objetivo:** Registrar el ingreso físico en Odoo para actualizar el stock disponible.

**Prerrequisitos:**
- Inspección física del paso 5.1 completada y aprobada
- Orden de compra en estado `purchase` (Purchase Order) en Odoo
- Solo la mercancía conforme puede ser registrada

**Pasos:**

1. El Encargado de Almacén accede a Odoo: `Inventario → Operaciones → Recepciones`

2. Localiza la recepción correspondiente a la orden de compra. Verifica que el estado
   sea **Listo** (`assigned`). Si está en `Esperando` (`confirmed`), notificar a Compras
   para que confirme la orden.

3. Verifica que los productos y cantidades de la recepción coincidan con:
   - La documentación del proveedor
   - El conteo físico realizado en 5.1

4. Abre la recepción. Si la recepción incluye **lotes o seriales (H4/H5)**, verifica que
   estén configurados antes de validar.

5. Registra la **cantidad realmente recibida** en el campo "Hecho" de cada línea.
   - Si se recibió la totalidad: cantidad Hecho = cantidad Demanda
   - Si hubo faltante: registrar solo lo físicamente recibido

6. Verifica la **ubicación destino** de cada línea: debe corresponder a la zona correcta
   según el tipo de producto (ver §4.4 y putaway rules configuradas).

7. Hace clic en **Validar**.
   - Si las cantidades no coinciden, Odoo pregunta qué hacer:
     - **"Crear un pedido atrasado" (backorder):** para faltantes que llegarán después.
       Indicar fecha esperada si se conoce. Notificar a Compras.
     - **"Sin pedido atrasado":** solo si el faltante fue error del proveedor definitivo
       y no se esperan más unidades.

8. **Resultado:** Movimiento de stock generado, inventario actualizado,
   número de recepción `[WH]/IN/XXXXX` confirmado.

**Condiciones:**
- No registrar cantidades no recibidas físicamente (prohibido)
- Toda diferencia debe ser comunicada a Compras antes de cerrar la recepción
- Los backorders deben tener motivo documentado

**KPI:** Tiempo desde inspección física aprobada hasta validación en Odoo ≤ 2h

---

### 5.3 Etiquetado de artículos y conteo digital (handheld)

**Responsable principal:** Encargado de Almacén  
**Apoyo:** Auxiliar de Almacén  
**Ruta Odoo:** `Inventario → Operaciones → Recepciones → [Recepción] → Imprimir etiquetas`

**Objetivo:** Garantizar identificación individual de cada artículo con trazabilidad en Odoo.

**Pasos:**

1. Desde la recepción en Odoo, hacer clic en **Imprimir etiquetas** para los artículos recibidos.
   Verificar que las etiquetas contengan: referencia interna, nombre de producto, código de barras
   legible.

2. El Auxiliar de Almacén adhiere **una etiqueta individual por cada artículo**.
   - En cajas con múltiples artículos: abrir la caja y etiquetar cada artículo por separado.
   - Nunca etiquetar solo la caja exterior.

3. Desde el dispositivo portátil (handheld), acceder a la recepción en Odoo.

4. Seleccionar la opción de **escaneo de productos** dentro del documento de recepción.

5. Escanear uno a uno todos los artículos etiquetados, validando que:
   - Cada lectura corresponde a un artículo físico recibido
   - Las cantidades se actualizan en el sistema conforme al escaneo

6. Al finalizar el escaneo, confirmar que el total escaneado coincide con el conteo físico.

7. Si hay diferencias: **detener el proceso y revisar** antes de continuar.

8. Para artículos en tienda: imprimir también etiquetas con precio (usando Atmos o sistema
   correspondiente) para colocar en exhibición.

**Condiciones:**
- No imprimir etiquetas si la recepción no corresponde a la orden correcta
- No realizar conteo digital sin etiquetado previo
- Prohibido confirmar la recepción con diferencias entre conteo físico y digital

---

### 5.4 Verificación y ubicación física en almacén

**Responsable:** Encargado de Almacén  
**Ruta Odoo:** `Inventario → Productos → [Producto] → Ubicaciones`  
**Herramienta WWP:** Actualizar tarea de recepción con ubicación física asignada

**Pasos:**

1. Trasladar la mercancía conforme a la ubicación asignada según las reglas de putaway:
   - Vidrio/mármol → Zona Vidrio (vertical, espuma entre piezas)
   - Tela/cuero → Zona Tela (horizontal, sin peso encima)
   - Boffi/proyectos → Zona Proyecto (acceso restringido, etiquetar con código proyecto)
   - Accesorios → Zona Mezzanine o bins correspondientes
   - No conforme/pendiente → Zona Cuarentena (nunca mezclar con stock activo)

2. Confirmar que la **ubicación física coincide** con la ubicación registrada en Odoo.

3. Para almacén ALVEN: verificar que la ubicación siga la nomenclatura de bins
   (ej. `ALVEN/Stock/A-CDP/AA1`).

4. Registrar la ubicación en la tarea WWP si es diferente a la ubicación por defecto.

**Resultado:** Producto almacenado en ubicación correcta, trazable en Odoo, tarea WWP cerrada.

**KPI:** Exactitud de ubicación (ubicación física = Odoo) ≥ 98%

---

## 6. FLUJO DE PROCESOS: PREPARACIÓN Y DESPACHO

### 6.1 Validación del pedido de venta para despacho

**Responsable:** Ejecutivo de Ventas  
**Ruta Odoo:** `Ventas → Pedidos → Pedidos de venta`  
**Estado requerido del pedido:** `sale` (Pedido de venta — confirmado)

**Pasos:**

1. El Ejecutivo de Ventas accede al pedido del cliente y verifica:
   - Estado: `sale` (Pedido de venta). Si está en `draft` (Cotización), confirmar primero.
   - Productos, cantidades y precios
   - Dirección de entrega correcta
   - Datos de contacto del cliente para coordinación de entrega

2. Solicita al cliente:
   - Nombre de la persona que recibirá la entrega
   - Disponibilidad de horario (ventana de tiempo de 2h mínimo)
   - Rutas de acceso para productos grandes o H3+
   - Si requiere armado o instalación: condiciones del área

3. Valida en Odoo que los productos del pedido tengan **stock disponible reservado**
   (estado del picking asociado: **Listo** `assigned`).
   - Si el picking está en `Esperando` (`confirmed`): coordinar con Almacén antes de confirmar fecha.
   - Si hay stock negativo o insuficiente: escalar a Coordinador de Logística antes de comprometer fecha.

4. Envía correo a Coordinador de Logística y Administración con:
   - Número de pedido Odoo (`S0XXXX`)
   - Número de picking/conduce (`ALVEN/OUT/XXXXX`)
   - Datos del cliente y ventana horaria acordada
   - Observaciones especiales (nivel H del producto, acceso difícil, armado requerido)

**KPI:** Confirmación de disponibilidad a cliente en ≤ 4h desde solicitud

---

### 6.2 Planificación del despacho

**Responsable:** Coordinador de Logística  
**Ruta Odoo:** `Inventario → Operaciones → Transferencias`  
**Tarea WWP:** Crear tarea "Preparación de Despacho" en Workforce Platform

**Pasos:**

1. El Coordinador de Logística recibe el correo de Ventas y accede al picking correspondiente
   en Odoo (`ALVEN/OUT/XXXXX` o `[WH]/OUT/XXXXX`).

2. Verifica en Odoo que el picking esté en estado **Listo** (`assigned`):
   - Productos correctos y cantidades
   - Ubicaciones origen
   - Fecha programada de entrega

3. Si existe algún impase (producto dañado, faltante, acceso imposible al cliente),
   informa por correo a Ventas con detalle y retorna al paso 6.1.

4. **Crea tarea en WWP** "Preparación de Despacho" con:
   - Título: `Despacho [número picking] — [nombre cliente]`
   - Asignados: Encargado de Almacén + Auxiliares que ejecutarán
   - Descripción: número picking Odoo, productos, observaciones del cliente, nivel H de los productos
   - Fecha límite: fecha de entrega acordada
   - Adjunto o referencia a la orden Odoo

5. Coordina con Encargado de Almacén la disponibilidad de personal y vehículo.

6. Define y comunica la ruta de entrega al Chofer.

7. Actualiza en Odoo la **fecha prevista de entrega** (`scheduled_date`) si difiere de la original.

8. Responde el correo de Ventas confirmando la fecha y hora de entrega.

---

### 6.3 Preparación física del despacho (picking)

**Responsable:** Encargado de Almacén  
**Apoyo:** Auxiliar de Almacén  
**Ruta Odoo:** `Inventario → Operaciones → Transferencias → [PICK o OUT]`  
**Tarea WWP:** Actualizar tarea "Preparación de Despacho" con avance

**Prerrequisito:** Tarea WWP creada y asignada (paso 6.2)

**Pasos:**

1. El Encargado accede en Odoo al Pick correspondiente (`ALVEN/PICK/XXXXX`):
   - Verifica que esté en estado **Listo** (`assigned`)
   - Confirma productos, cantidades y ubicaciones origen

2. El Auxiliar de Almacén accede al pick desde el handheld y escanea el código de barras
   del documento para abrir la operación.

3. El Auxiliar se dirige a las ubicaciones indicadas y localiza los productos.

4. Realiza el pick **escaneando cada producto uno a uno**:
   - Respeta estrictamente los productos y cantidades indicados
   - El sistema actualiza automáticamente las cantidades procesadas
   
   > Para productos **H3**: mínimo 2 personas; verificar empaque antes de mover.  
   > Para productos **H4/H5**: coordinar con líder de maniobra; registrar evidencia fotográfica
   > en la tarea WWP antes de mover la pieza.

5. El Auxiliar verifica que los productos estén correctamente **empacados y protegidos**
   para traslado, siguiendo la guía de empaque por material.

6. El Auxiliar traslada los productos preparados al **área de carga** designada.

7. El Auxiliar informa al Encargado que la carga está lista para validación.

8. El Encargado realiza **verificación física final**: producto, cantidad, estado general
   y correspondencia con el pick.

9. El Encargado **sube fotos del empaque** a la tarea WWP antes de aprobar la carga.

10. Si durante el pick se detecta que un producto está dañado o faltante:
    - Registrar la cantidad real disponible
    - Notificar inmediatamente al Coordinador de Logística y a Ventas
    - Crear registro de avería en WWP si hay daño
    - **No continuar** con el despacho del artículo afectado sin autorización

**Condiciones:**
- No preparar mercancía sin autorización para ejecutar el pick
- Prohibido colocar mercancía preparada fuera del área de pick asignada
- Ningún producto H4/H5 se mueve sin evidencia fotográfica en WWP

**KPI:** Pick completado con 0 errores de producto o cantidad ≥ 97%

---

### 6.4 Carga del vehículo

**Responsable:** Encargado de Almacén  
**Apoyo:** Auxiliar de Almacén, Chofer  
**Ruta Odoo:** No aplica en este paso  
**Tarea WWP:** Actualizar tarea con confirmación de carga

**Pasos:**

1. El Chofer realiza la **validación del vehículo** conforme al checklist establecido:
   - Estado general del vehículo (limpieza, protecciones disponibles)
   - Materiales de armado (herramientas, mantas, cinta, espuma)
   - Documentación de la ruta (conduce, guía de entrega)

2. El Encargado de Almacén revisa el checklist y **aprueba la carga**.

3. El Chofer posiciona el vehículo en el área de carga asignada.

4. El Auxiliar y el Chofer realizan la carga conforme al orden de la ruta definida,
   verificando que:
   - Las cantidades cargadas son correctas
   - La mercancía está correctamente colocada y protegida
   - Los productos H3+ van con protección específica (espuma, mantas, sujeción)
   - Los productos H4/H5 van cargados en último lugar (salen primero)

5. El Chofer **recibe y firma** la documentación de entrega (conduce Odoo impreso).
   Con la firma, asume responsabilidad de la mercancía transportada.

6. El Encargado **actualiza la tarea WWP** con confirmación de carga y foto del vehículo
   cargado (especialmente para H3+).

**Condiciones:**
- No cargar mercancía sin aprobación del Encargado
- El Chofer no puede retirar mercancía sin firmar la documentación
- Ningún producto H3+ se carga sin protección adecuada

---

### 6.5 Registro y validación en Odoo (salida de inventario)

**Responsable:** Encargado de Almacén  
**Ruta Odoo:** `Inventario → Operaciones → Transferencias → [OUT/conduce]`

**Pasos:**

1. Una vez cargado el vehículo, el Encargado accede al conduce (`ALVEN/OUT/XXXXX`) en Odoo.

2. Verifica que la cantidad "Hecho" refleje exactamente lo que fue cargado.
   - Si hubo artículo que no pudo despacharse: ajustar la cantidad a lo real y crear backorder.

3. Hace clic en **Validar**.
   - El stock sale del sistema automáticamente
   - Se genera el movimiento contable correspondiente

4. Imprime o envía digitalmente el **conduce validado** al Chofer como documento de entrega.

**Resultado:** Stock actualizado en Odoo, salida registrada, conduce listo para entrega.

> ⚠️ Nunca validar en Odoo si el vehículo no ha salido o si hay mercancía con incidencias
> no notificadas.

---

### 6.6 Entrega física al cliente

**Responsable:** Chofer (con apoyo de Auxiliar si aplica)  
**Ruta Odoo:** No aplica en este paso  
**Tarea WWP:** Actualizar tarea con evidencia de entrega al llegar y al completar

**Guión operativo del Chofer:**

Al llegar al punto de entrega:
> "Buenos días / tardes. Soy [nombre completo] de la compañía Altri Tempi. Vengo a realizar
> la entrega de los artículos [descripción]. ¿Con quién tengo el gusto?"

> "¿Puede indicarme dónde estaré colocando los artículos?"

Antes de ingresar los productos al espacio del cliente:
- Evaluar el área de entrega (acceso, espacio, piso)
- Para H3+: colocar mantas protectoras en el piso antes de ingresar la pieza
- Verificar herramientas de armado disponibles si aplica

Al presentar los productos:
> "Por favor, validemos que los productos y cantidades coincidan con el documento de despacho."

Si se detecta alguna incidencia al momento de la entrega:
> "Estoy registrando esta observación para notificarla al área correspondiente antes de
> validar la entrega."
- **El Chofer toma fotografías** de la incidencia
- Notifica inmediatamente al Coordinador de Logística por WhatsApp/llamada
- **No valida la entrega del artículo con incidencia** sin autorización previa

Al confirmar entrega conforme:
> "Si todo está conforme, ¿podría por favor firmar el documento de despacho como
> confirmación de recepción?"

Al finalizar:
> "Muchas gracias. Cualquier observación adicional puede canalizarse a través de su vendedora."

El Chofer **actualiza la tarea WWP** con:
- Foto de la firma del cliente en el conduce
- Foto del producto instalado/entregado en el área final
- Hora de entrega completada

**Condiciones:**
- No validar en Odoo mercancía con incidencias sin notificación previa
- La firma del conduce es obligatoria para cerrar la entrega

---

### 6.7 Cierre y seguimiento post-entrega

**Responsable:** Coordinador de Logística  
**Ruta Odoo:** `Inventario → Operaciones → Transferencias → [picking done]`  
**Tarea WWP:** Marcar tarea "Preparación de Despacho" como completada

**Pasos:**

1. El Coordinador verifica en Odoo que el conduce esté en estado **Hecho** (`done`).

2. Revisa la tarea WWP: ¿tiene evidencias completas? (foto carga, foto entrega, firma cliente).

3. Si el Chofer reportó novedades:
   - Registrar en WWP la novedad con fotos
   - Si hay daño de entrega: crear avería en WWP y notificar a Ventas y Administración
   - Coordinar seguimiento con cliente vía Ventas

4. Archivar documentación física (conduce firmado) según procedimiento de administración.

5. Marcar la tarea WWP como **completada**.

**KPI:** Entregas sin incidente / total entregas ≥ 98%  
**KPI:** Tareas WWP con evidencia completa / total tareas despacho ≥ 95%

---

## 7. FLUJO DE PROCESOS: RECEPCIÓN EN TIENDA

### 7.1 Recepción física en tienda

**Responsable:** Encargado de Tienda  
**Apoyo:** Personal de Tienda  
**Tarea WWP:** Crear tarea "Recepción en Tienda" con los mismos campos del proceso 5.1

> Mismo protocolo de inspección que §5.1 — aplican todos los mismos criterios de
> conformidad, no conformidad, cuarentena y registro de averías en WWP.

**Diferencias vs. almacén:**
- La documentación de entrada es la **transferencia interna Odoo** desde el almacén origen
  (`[WH]/INT/XXXXX`), no una orden de compra directa
- Las incidencias se notifican al Encargado de Almacén origen además de Compras/Administración

---

### 7.2 Registro de recepción en Odoo (transferencia interna)

**Responsable:** Encargado de Tienda  
**Ruta Odoo:** `Inventario → Operaciones → Transferencias`  
**Filtrar por:** Transferencias internas (`INT`), estado = **Listo** (`assigned`)

**Pasos:**

1. Acceder a la transferencia interna correspondiente en Odoo.
   Ejemplo: `PTN/INT/XXXXX` o `CDP/INT/XXXXX`.

2. Entregar el picklist al Auxiliar.

3. El Auxiliar escanea los productos con el handheld, uno a uno.

4. El Auxiliar hace clic en **Guardar y Continuar** al completar cada línea.

5. El Encargado revisa las cantidades registradas y hace clic en **Validar**.

6. Actualizar tarea WWP con resultado de recepción.

**Condiciones:**
- Prohibido validar cantidades no recibidas físicamente
- El inventario se actualiza automáticamente al validar

---

### 7.3 Ubicación en tienda / exhibición

**Responsable:** Encargado de Tienda  
**Ruta Odoo:** `Inventario → Productos`  
**Herramienta:** Atmos (para etiquetas de precio y RFID si aplica)

**Pasos:**

1. El Encargado recibe de Ventas la solicitud de colocar productos en tienda.

2. Valida que la ubicación de exhibición esté disponible.

3. En Atmos: imprimir etiqueta de precio y etiqueta RFID (si aplica).
   - Si es un kit: imprimir etiqueta para cada parte del kit.

4. El Auxiliar traslada y ubica la mercancía en el área de exhibición.

5. Actualizar la tarea WWP como completada.

**Resultado:** Transferencia en estado `done` en Odoo, inventario actualizado, producto en tienda.

---

## 8. FLUJO DE PROCESOS: ENTREGA DIRECTA A CLIENTE (DROPSHIP / SIN STOCK)

### 8.1 Validación del pedido para entrega directa

**Módulo Odoo:** Ventas  
**Responsable:** Ejecutivo de Ventas  
**Ruta Odoo:** `Ventas → Pedidos → Pedidos de venta`

**Pasos:**

1. Acceder al pedido del cliente. Estado: `sale` (Pedido de venta confirmado).

2. Validar: productos, cantidades, dirección de entrega.

3. Solicitar al cliente: nombre del receptor, disponibilidad horaria, rutas de acceso.

4. Transmitir información por correo a Operaciones.

---

### 8.2 Preparación de la entrega directa

**Módulo Odoo:** Inventario  
**Responsable:** Encargado de Almacén / Logística  
**Ruta Odoo:** `Inventario → Operaciones → Transferencias → [conduce OUT]`

**Pasos:**

1. Acceder al conduce vinculado al pedido de venta.
   - Si el flujo es de 2 o 3 pasos: verificar primero el Pick (`ALVEN/PICK/XXXXX`)
     y luego el OUT (`ALVEN/OUT/XXXXX`).

2. Verificar: cliente, ubicación origen, productos y cantidades.

3. Registrar cantidad "Hecho" al recibir la mercancía del proveedor o al confirmar el pick.

4. Validar la entrega.

5. Crear tarea WWP "Entrega Directa" y continuar desde §6.3 (preparación física).

**Resultado:** Salida directa a cliente sin generar stock disponible intermedio.

---

## 9. FLUJO DE DEVOLUCIONES Y NOTAS DE CRÉDITO

### 9.1 Solicitud y autorización de devolución

**Responsables:** Ventas / Administración  
**Ruta Odoo:** `Ventas → Pedidos → Pedidos de venta → [Orden] → Devoluciones`  
**Tarea WWP:** Crear tarea "Gestión de Devolución" asignada a Encargado de Almacén

**Pasos:**

1. Ventas recibe la solicitud de devolución del cliente y la documenta por escrito con:
   - Número de pedido Odoo original (`S0XXXX`)
   - Número de conduce original (`ALVEN/OUT/XXXXX`)
   - Motivo de devolución
   - Productos y cantidades a devolver

2. Ventas comunica por correo a Administración y Almacén.

3. Administración revisa y **autoriza o rechaza** conforme a la política vigente.

4. Una vez autorizada, Ventas envía a Encargado de Almacén:
   - Número de conduce original de referencia
   - Productos autorizados para devolución
   - Si el cliente trae la mercancía o si se debe hacer retiro

5. **Crea tarea WWP** "Gestión de Devolución": asigna Encargado de Almacén,
   incluye número de conduce, productos, motivo y fecha esperada.

**Condiciones:**
- No se permite iniciar ningún retiro o recepción de devolución sin autorización escrita de Administración
- No comprometer reposiciones, cambios o notas de crédito durante el proceso de retiro

---

### 9.2 Retiro de mercancía del cliente (si aplica)

**Responsable:** Chofer  
**Ruta Odoo:** No aplica en este paso

**Guión del Chofer al llegar al domicilio:**

> "Buenos días / tardes. Mi nombre es [nombre completo], vengo en representación de
> Altri Tempi para retirar la mercancía correspondiente a una devolución."

> "¿Podría por favor confirmarme su nombre y el producto a devolver?"

> "Procederé a revisar los artículos para confirmar que coincidan con la devolución autorizada."

Durante la revisión:
> "Estoy validando cantidad y estado general del producto antes de su traslado."

Si se observa novedad:
> "Estaré enviando fotos del artículo para hacer las validaciones correspondientes antes
> de completar el proceso."
- Tomar fotografías
- Notificar al Coordinador antes de cargar

Al completar:
> "La mercancía ha sido retirada y será procesada internamente según nuestro procedimiento."

> "Muchas gracias por su colaboración. Cualquier seguimiento adicional será gestionado
> por su vendedora."

**Condiciones:**
- No retirar mercancía adicional no incluida en la devolución autorizada
- No firmar ningún documento por parte del cliente que implique compromisos comerciales

---

### 9.3 Recepción física de la mercancía devuelta

**Responsable:** Encargado de Almacén  
**Tarea WWP:** Actualizar tarea "Gestión de Devolución" con evidencia de recepción

**Pasos:**

1. El Encargado recibe físicamente la mercancía devuelta.

2. Verifica: producto, cantidad, número de serie si aplica, y estado general.

3. El Auxiliar escanea los productos devueltos con el handheld.

4. Tomar fotografías del estado de la mercancía devuelta (obligatorio).

5. Clasificar según condición:
   - **Condición A (sin daño):** → zona de stock disponible (se puede revender)
   - **Con daño o defecto:** → zona de Cuarentena (esperar decisión)
   - **Irrecuperable:** → zona de Scrap (requiere autorización para dar de baja)

6. Registrar evidencia fotográfica y clasificación en la tarea WWP.

---

### 9.4 Registro de devolución en Odoo (reverse transfer)

**Responsable:** Encargado de Almacén  
**Ruta Odoo:** `Inventario → Operaciones → Transferencias → [conduce original] → Devolver`

**Pasos:**

1. Localizar el conduce original de entrega en Odoo (`ALVEN/OUT/XXXXX` o `[WH]/OUT/XXXXX`).

2. Hacer clic en el botón **"Devolver"** (Reverse Transfer).

3. En el asistente de devolución:
   - Seleccionar los productos y cantidades a devolver
   - Indicar la ubicación destino:
     - Mercancía sin daño → `[WH]/Stock`
     - Con daño / pendiente → `[WH]/Cuarentena`
   - El sistema creará un picking de tipo `RET` (`[WH]/RET/XXXXX`)

4. Validar el reverse transfer.
   - El número generado (`ALVEN/RET/XXXXX` o `WH/RET/XXXXX`) es la referencia de la devolución.
   - El stock se actualiza automáticamente.

5. Registrar el número de RET en la tarea WWP y en el correo a Administración.

---

### 9.5 Nota de crédito y cierre

**Responsable:** Administración  
**Ruta Odoo:** `Facturación → Clientes → [Factura original] → Nota de Crédito`

**Pasos:**

1. Administración verifica que el reverse transfer (`RET`) esté en estado `done`.

2. Emite la nota de crédito desde la factura original correspondiente.

3. Notifica a Ventas y al cliente.

4. Encargado de Almacén marca la tarea WWP como completada.

**Condiciones:**
- No emitir nota de crédito sin reverse transfer validado en Odoo
- No registrar devolución en Odoo sin recepción física validada
- Toda devolución en Odoo debe referenciar el conduce original

**KPI:** Tiempo desde recepción física hasta nota de crédito emitida ≤ 48h

---

## 10. APÉNDICE A — TAREAS WWP: CONVENCIÓN DE NOMBRES

| Tipo de tarea | Formato del título |
|---|---|
| Recepción de compra | `Recepción [WH]/IN/XXXXX — [Proveedor]` |
| Preparación de despacho | `Despacho [WH]/OUT/XXXXX — [Cliente]` |
| Entrega directa | `Entrega Directa [S0XXXX] — [Cliente]` |
| Recepción en tienda | `Recepción Tienda [WH]/INT/XXXXX` |
| Gestión devolución | `Devolución [WH]/RET/XXXXX — [Cliente]` |
| Registro de avería | `Avería [producto] — [fecha]` |

---

## 11. APÉNDICE B — RESUMEN DE RUTAS ODOO

| Operación | Ruta en Odoo |
|---|---|
| Ver recepciones pendientes | `Inventario → Operaciones → Recepciones` |
| Ver despachos listos | `Inventario → Operaciones → Transferencias` → filtrar OUT / Listo |
| Ver picks internos | `Inventario → Operaciones → Transferencias` → filtrar PICK / Listo |
| Imprimir etiquetas | `[Recepción] → Imprimir etiquetas` |
| Crear devolución cliente | `[Conduce OUT] → Devolver` |
| Ver stock por ubicación | `Inventario → Productos → [Producto] → Ubicaciones` |
| Ver historial de movimientos | `Inventario → Reportes → Historial de movimientos` |
| Crear ajuste de inventario | `Inventario → Operaciones → Ajustes de inventario` |

---

## 12. APÉNDICE C — PROTOCOLO H1–H5 (RESUMEN)

| Nivel | Ejemplos | Mínimo personas | Foto WWP | Cuarentena si duda |
|---|---|---|---|---|
| H1 | Accesorios, deco pequeña | 1 | No requerida | No |
| H2 | Muebles tela/madera estándar | 1 | Recomendada | No |
| H3 | Vidrio, mármol, lacados, espejos | **2** | **Obligatoria** | Sí |
| H4 | Piezas únicas, >80kg, gran volumen | **2 + líder** | **Obligatoria** | Sí |
| H5 | Boffi, diseñador, proyectos premium | **Equipo designado** | **Obligatoria** | **Siempre** |

> Para H5: ningún movimiento sin aprobación del Coordinador de Logística.
> Para H3+: nunca en batch picking. Siempre picking individual.

---

*Fin del documento*  
*Versión 2.0 — 2026-06-12 — Altri Tempi*
