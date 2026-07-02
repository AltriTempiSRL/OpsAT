# Corrección de Inventario — Negativos en A-CDP / PFRONTAL / JC1 / PTN
**Fecha:** 2026-06-30 | **Preparado por:** Ron (Analista Odoo) + Pit (Gerente de Operaciones)
**Total de artículos a corregir:** 46 | **Instancia Odoo:** altritempi.odoo.com

---

## Contexto

Durante la auditoría de inventario del 30 de junio 2026 se identificaron 46 artículos con stock negativo en ubicaciones físicas reales (A-CDP, PFRONTAL, JC1, PTN). Los negativos se dividen en tres grupos según su causa:

- **Grupo A — Kits phantom (20 artículos):** componentes de sets/colecciones que Odoo registra individualmente, pero que han sido despachados más veces de las que ingresaron. La corrección es en el kit padre, no en el componente.
- **Grupo B — Despacho sin recepción previa (13 artículos):** artículos movidos mediante transferencias internas (CDP/INT) usando A-CDP como origen, pero Odoo no tenía el artículo registrado en esa ubicación.
- **Grupo C — Salida registrada antes de la entrada (13 artículos):** artículos donde la salida en Odoo ocurrió antes de que se registrara la entrada a esa ubicación, principalmente en las transferencias CDP/INT/04944 y CDP/INT/05302 del 27 de junio.

> **Importante:** Antes de hacer cualquier ajuste en Odoo, verificar físicamente si el artículo está o no en la ubicación indicada. El ajuste en Odoo debe reflejar la realidad física, no al revés.

---

## GRUPO A — Kits Phantom (20 artículos)

> **Cómo leer este grupo:** Estos artículos son **componentes** de un set o colección (kit). Odoo los registra por separado, pero cuando se despacha el kit completo, Odoo descuenta cada componente. Si el kit padre fue despachado una vez de más, todos sus componentes quedan en negativo. La corrección se hace verificando el kit padre, no el componente directamente.

**Pasos generales para todos los artículos del Grupo A:**

1. Ir a **Inventario → Productos**
2. Buscar el SKU del componente (columna "Código SKU" abajo)
3. Abrir el producto → hacer clic en **"Movimientos de Stock"** (botón superior derecho)
4. Revisar la columna "Referencia" para identificar el picking del kit padre que generó la salida de más
5. Abrir ese picking → verificar si la cantidad es correcta
6. **Si el picking del kit padre tiene una unidad de más:** Inventario → Transferencias → buscar el número del picking → botón **"Devolver"** → seleccionar solo el kit padre, cantidad = 1 → Validar
7. **Si el picking es correcto y el artículo físicamente existe en la ubicación:** hacer Ajuste de Inventario (ver pasos al final de cada ficha)

---

### A-01. Kayle Sofa Cx Mod Color Beige
- **Código SKU:** `GE.KAYLE.SOFA.CX.BG.C2`
- **Ubicación Odoo:** ALVEN/Stock/A-CDP/PFRONTAL
- **Stock actual en Odoo:** -1
- **Kit padre:** `GE.KAYLE.SOFA.BG.K3` — entradas registradas: 3, salidas registradas: 4
- **Acción requerida:** Verificar físicamente si el módulo Cx del sofá Kayle Beige está en PFRONTAL. Luego revisar el kit padre.

**Pasos en Odoo:**
1. Inventario → Productos → buscar `GE.KAYLE.SOFA.BG.K3` (el kit padre)
2. Abrir → botón **"Movimientos de Stock"** → filtrar por estado "Hecho"
3. Identificar el picking de salida número 4 (el más reciente) — verificar si fue un despacho correcto o duplicado
4. Si fue duplicado: Inventario → Transferencias → abrir ese picking → **"Devolver"** → cantidad 1 del kit → Validar
5. Si fue correcto y el componente físicamente está en PFRONTAL: Inventario → Ajustes de Inventario → Nueva → Producto: `GE.KAYLE.SOFA.CX.BG.C2` → Ubicación: ALVEN/Stock/A-CDP/PFRONTAL → Cantidad contada: 1 → Razón: "Corrección post-auditoría 2026-06-30 — componente presente físicamente" → **Aplicar todo**

**Validación:** El stock de `GE.KAYLE.SOFA.CX.BG.C2` debe quedar en 0 o 1 (según conteo físico). No debe quedar negativo.

---

### A-02. Kayle Sofa Rx Mod Color Beige
- **Código SKU:** `GE.KAYLE.SOFA.RX.BG.C3`
- **Ubicación Odoo:** ALVEN/Stock/A-CDP/PFRONTAL
- **Stock actual en Odoo:** -1
- **Kit padre:** `GE.KAYLE.SOFA.BG.K3` — entradas: 3, salidas: 4
- **Acción requerida:** Misma causa que A-01 (mismo kit padre). Si se corrigió A-01 con devolución del kit padre, este también queda corregido automáticamente.

**Pasos en Odoo:**
1. Verificar si ya se hizo la devolución del kit `GE.KAYLE.SOFA.BG.K3` en A-01
2. Si sí: confirmar que este SKU quedó en 0 o positivo → fin
3. Si no: seguir los mismos pasos de A-01

**Validación:** Stock en 0 o positivo. No negativo.

---

### A-03. Kayle Sofa Lx Mod Color Beige
- **Código SKU:** `GE.KAYLE.SOFA.LX.BG.C1`
- **Ubicación Odoo:** ALVEN/Stock/A-CDP/PFRONTAL
- **Stock actual en Odoo:** -1
- **Kit padre:** `GE.KAYLE.SOFA.BG.K3` — entradas: 3, salidas: 4
- **Acción requerida:** Mismo kit padre que A-01 y A-02. Una sola devolución del kit corrige los tres.

**Pasos en Odoo:** Ver A-01. Una sola acción sobre el kit padre corrige A-01, A-02 y A-03 simultáneamente.

**Validación:** Stock en 0 o positivo.

---

### A-04. Kaes Coffee Table D130 Green Part 3
- **Código SKU:** `GZF.KAES.COFFTBL.130.PART3.BLK.C3`
- **Ubicación Odoo:** ALVEN/Stock/A-CDP/PFRONTAL
- **Stock actual en Odoo:** -1
- **Kit padre:** `GZF.KAES.COFFTBL.130.MARB.BLK.K3` — entradas: 4, salidas: 5

**Pasos en Odoo:**
1. Inventario → Productos → buscar `GZF.KAES.COFFTBL.130.MARB.BLK.K3`
2. Movimientos de Stock → identificar la 5ta salida → verificar si es correcta
3. Si fue duplicado: Inventario → Transferencias → abrir ese picking → **"Devolver"** → 1 unidad del kit → Validar
4. Si fue correcto: Inventario → Ajustes de Inventario → Producto: `GZF.KAES.COFFTBL.130.PART3.BLK.C3` → Ubicación: ALVEN/Stock/A-CDP/PFRONTAL → Cantidad contada: según físico → Razón: "Corrección auditoría 2026-06-30" → Aplicar todo

**Validación:** Stock ≥ 0.

---

### A-05. Weaver Sofa Rx Mod Color Grey
- **Código SKU:** `GZF.WEAVER.SOFA.RX.PARIS90-D.C7`
- **Ubicación Odoo:** ALVEN/Stock/A-CDP/PFRONTAL
- **Stock actual en Odoo:** -1
- **Kit padre:** `GZF.WEAVER.SOFA.PARIS90-D.K7` — entradas: 10, salidas: 11

**Pasos en Odoo:**
1. Inventario → Productos → buscar `GZF.WEAVER.SOFA.PARIS90-D.K7`
2. Movimientos de Stock → identificar la 11va salida → verificar si es correcta
3. Si fue duplicado: Inventario → Transferencias → abrir ese picking → **"Devolver"** → 1 unidad del kit → Validar
4. Si fue correcto: Ajuste de Inventario sobre el componente según conteo físico

**Validación:** Stock ≥ 0.

---

### A-06. Weaver Slope Marble Table Color Grey
- **Código SKU:** `GZF.WEAVER.SDTBL.WH.MARB.TOP.C2`
- **Ubicación Odoo:** ALVEN/Stock/A-CDP/PFRONTAL
- **Stock actual en Odoo:** -1
- **Kit padre:** `GZF.WEAVER.SOFA.PARIS90-D.K7` — entradas: 9, salidas: 10
- **Nota:** Mismo kit padre que A-05. Si se corrigió A-05 con devolución del kit, revisar si este componente también quedó corregido.

**Pasos en Odoo:** Ver A-05. Verificar después de corregir A-05.

**Validación:** Stock ≥ 0.

---

### A-07. Weaver Sofa Rx Mod Color Beige
- **Código SKU:** `GZF.WEAVER.SOFA.RX.HENNES-60A.C7`
- **Ubicación Odoo:** ALVEN/Stock/A-CDP/PFRONTAL
- **Stock actual en Odoo:** -1
- **Kit padre:** `GZF.WEAVER.SOFA.HENNES-60A.K7` — entradas: 1, salidas: 2

**Pasos en Odoo:**
1. Inventario → Productos → buscar `GZF.WEAVER.SOFA.HENNES-60A.K7`
2. Movimientos de Stock → ver las 2 salidas → verificar si ambas son correctas
3. Si hay una duplicada: Inventario → Transferencias → abrir ese picking → **"Devolver"** → 1 unidad → Validar

**Validación:** Stock ≥ 0.

---

### A-08. Irva Side Table 45 Base Color Black
- **Código SKU:** `GVF.IRVA.SDTBL45.BASE.BLK.C2`
- **Ubicación Odoo:** ALVEN/Stock/A-CDP/PFRONTAL
- **Stock actual en Odoo:** -1
- **Kit padre:** `GVF.IRVA.SDTBL45.ESME.MARB.K2` — entradas: 18, salidas: 19

**Pasos en Odoo:**
1. Inventario → Productos → buscar `GVF.IRVA.SDTBL45.ESME.MARB.K2`
2. Movimientos de Stock → identificar la 19na salida → verificar si es correcta
3. Si fue duplicado: Inventario → Transferencias → **"Devolver"** → 1 unidad → Validar

**Validación:** Stock ≥ 0.

---

### A-09. Irva Side Table 45 Lauren Black Marble Top
- **Código SKU:** `GVF.IRVA.SDTBL45.DKEMPER.TOP.C1`
- **Ubicación Odoo:** ALVEN/Stock/A-CDP/PFRONTAL
- **Stock actual en Odoo:** -1
- **Kit padre:** `GVF.IRVA.SDTBL45.DKEMPER.MARB.K2` — entradas: 10, salidas: 11

**Pasos en Odoo:**
1. Inventario → Productos → buscar `GVF.IRVA.SDTBL45.DKEMPER.MARB.K2`
2. Movimientos de Stock → identificar la 11ma salida → verificar
3. Si fue duplicado: Inventario → Transferencias → **"Devolver"** → 1 unidad → Validar

**Validación:** Stock ≥ 0.

---

### A-10. Mera Coffee Table Big Lauren Black Base
- **Código SKU:** `GVF.MERA.COFFTBL.BIG.LAUREN.BLK.BASE.C2`
- **Ubicación Odoo:** ALVEN/Stock/A-CDP/PFRONTAL
- **Stock actual en Odoo:** -1
- **Kit padre:** `GVF.MERA.COFFTBL.BIG.LAURENBLK.K2` — entradas: 4, salidas: 5

**Pasos en Odoo:**
1. Inventario → Productos → buscar `GVF.MERA.COFFTBL.BIG.LAURENBLK.K2`
2. Movimientos de Stock → identificar la 5ta salida → verificar
3. Si fue duplicado: Inventario → Transferencias → **"Devolver"** → 1 unidad → Validar

**Validación:** Stock ≥ 0.

---

### A-11. Clove Dining Table 160 Oak Base Brown
- **Código SKU:** `GDF.CLOVE.DTBL160.OAK.BASE.BRW.C2`
- **Ubicación Odoo:** ALVEN/Stock/A-CDP/PFRONTAL
- **Stock actual en Odoo:** -1
- **Kit padre:** `GDF.CLOVE.DTBL160.STN.MARB.TOP.K2` — entradas: 5, salidas: 6

**Pasos en Odoo:**
1. Inventario → Productos → buscar `GDF.CLOVE.DTBL160.STN.MARB.TOP.K2`
2. Movimientos de Stock → identificar la 6ta salida → verificar
3. Si fue duplicado: Inventario → Transferencias → **"Devolver"** → 1 unidad → Validar

**Validación:** Stock ≥ 0.

---

### A-12. Terrazo Coffee Table D70 Color Grey
- **Código SKU:** `HGI.TERRAZO.COFFTBL50.GRY.TOP.C1`
- **Ubicación Odoo:** ALVEN/Stock/A-CDP
- **Stock actual en Odoo:** -1
- **Kit padre:** `HGI.TERRAZO.COFFTBL50.GRY.K2` — entradas: 4, salidas: 5

**Pasos en Odoo:**
1. Inventario → Productos → buscar `HGI.TERRAZO.COFFTBL50.GRY.K2`
2. Movimientos de Stock → identificar la 5ta salida → verificar
3. Si fue duplicado: Inventario → Transferencias → **"Devolver"** → 1 unidad → Validar

**Validación:** Stock ≥ 0.

---

### A-13. Melpot Cabinet Drawer
- **Código SKU:** `NAT.MELPOT.CABINET.BRW.DRAWER.C5`
- **Ubicación Odoo:** ALVEN/Stock/A-CDP/JC1
- **Stock actual en Odoo:** -1
- **Kit padre:** `NAT.MELPOT.SOFA.LGHTGRY.BRW.K16` — entradas: 1, salidas: 2

**Pasos en Odoo:**
1. Inventario → Productos → buscar `NAT.MELPOT.SOFA.LGHTGRY.BRW.K16`
2. Movimientos de Stock → ver las 2 salidas → identificar la duplicada
3. Si fue duplicado: Inventario → Transferencias → **"Devolver"** → 1 unidad → Validar

**Validación:** Stock ≥ 0 en JC1.

---

### A-14. Cama King
- **Código SKU:** `CF-BR-BG003/GL`
- **Ubicación Odoo:** ALVEN/Stock/A-CDP
- **Stock actual en Odoo:** -1
- **Kit padre:** `[CKC] Cama King Selum` — entradas: 2, salidas: 3

**Pasos en Odoo:**
1. Inventario → Productos → buscar `[CKC] Cama King Selum`
2. Movimientos de Stock → ver las 3 salidas → identificar la duplicada
3. Si fue duplicado: Inventario → Transferencias → **"Devolver"** → 1 unidad → Validar

**Validación:** Stock ≥ 0.

---

### A-15. Lampara De Techo Color Madera (800)
- **Código SKU:** `MA-MD80160-1-800`
- **Ubicación Odoo:** ALVEN/Stock/A-CDP
- **Stock actual en Odoo:** -2
- **Kit padre:** `[LCP] Lampara Chandelier` — entradas: 2, salidas: 4
- **Nota:** Diferencia de 2 unidades — posible que el kit fue despachado 2 veces de más, o que hay 2 componentes por kit y se despacharon 2 kits cuando el stock era de 1.

**Pasos en Odoo:**
1. Inventario → Productos → buscar `[LCP] Lampara Chandelier`
2. Movimientos de Stock → revisar las 4 salidas → identificar cuáles son correctas
3. Inventario → Transferencias → abrir los pickings duplicados → **"Devolver"** → cantidad según lo incorrecto → Validar

**Validación:** Stock en 0 o positivo (no -2).

---

### A-16. Silla — Componente 1/2 (Dining Chair Upholstery)
- **Código SKU:** `HN-C6Z51-C-1/2`
- **Ubicación Odoo:** ALVEN/Stock/A-CDP
- **Stock actual en Odoo:** -2
- **Kit padre:** `[HN-C6Z51-C-K2] Dining Chair Upholstery` — entradas: 6, salidas: 8

**Pasos en Odoo:**
1. Inventario → Productos → buscar `[HN-C6Z51-C-K2]`
2. Movimientos de Stock → ver las 8 salidas → identificar las 2 de más
3. Inventario → Transferencias → abrir esos pickings → **"Devolver"** → 2 unidades → Validar

**Validación:** Stock en 0 o positivo.

---

### A-17. Silla — Componente 2/2 (Dining Chair Upholstery)
- **Código SKU:** `HN-C6Z51-C-2/2`
- **Ubicación Odoo:** ALVEN/Stock/A-CDP
- **Stock actual en Odoo:** -2
- **Kit padre:** `[HN-C6Z51-C-K2] Dining Chair Upholstery` — entradas: 6, salidas: 8
- **Nota:** Mismo kit padre que A-16. Una sola corrección del kit padre arregla A-16 y A-17 a la vez.

**Pasos en Odoo:** Ver A-16. La corrección sobre el kit padre aplica para ambos componentes.

**Validación:** Stock en 0 o positivo.

---

### A-18. Shade For Melt Lamp Copper
- **Código SKU:** `TD-MES01CO`
- **Ubicación Odoo:** ALVEN/Stock/A-CDP
- **Stock actual en Odoo:** -1
- **Kit padre:** `[LAMP2] Lamparas I` — entradas: 1, salidas: 2

**Pasos en Odoo:**
1. Inventario → Productos → buscar `[LAMP2] Lamparas I`
2. Movimientos de Stock → ver las 2 salidas → identificar la duplicada
3. Inventario → Transferencias → **"Devolver"** → 1 unidad → Validar

**Validación:** Stock ≥ 0.

---

### A-19. 6 Drawers & 2 Doors Cabinet Walnut
- **Código SKU:** `BH-H8242`
- **Ubicación Odoo:** ALVEN/Stock/A-CDP
- **Stock actual en Odoo:** -1
- **Kit padre:** `[VSC] Consolas Multiples` — entradas: 1, salidas: 2

**Pasos en Odoo:**
1. Inventario → Productos → buscar `[VSC] Consolas Multiples`
2. Movimientos de Stock → ver las 2 salidas → identificar la duplicada
3. Inventario → Transferencias → **"Devolver"** → 1 unidad → Validar

**Validación:** Stock ≥ 0.

---

### A-20. Jowil Rx Arm Raw Sofa Col Beige ⚠️ PRIORITARIO
- **Código SKU:** `FSV.JOWIL.SOFA.BG.RAWRX.C1`
- **Ubicación Odoo:** ALVEN/Stock/A-CDP
- **Stock actual en Odoo:** -1
- **Kit padre:** `FSV.JOWIL.SOFA.BG.RAW.K2` — entradas en esta ubicación: 0, salidas: 1
- **Nota:** Este es el más crítico del grupo A — el componente nunca entró a A-CDP pero fue despachado desde ahí. El artículo físicamente nunca estuvo registrado en A-CDP.

**Pasos en Odoo:**
1. Inventario → Productos → buscar `FSV.JOWIL.SOFA.BG.RAWRX.C1`
2. Movimientos de Stock → ver de dónde salió y hacia dónde
3. Verificar físicamente si el artículo existe en alguna ubicación del almacén
4. **Si el artículo no existe físicamente:** Inventario → Ajustes de Inventario → Nueva → Producto: `FSV.JOWIL.SOFA.BG.RAWRX.C1` → Ubicación: ALVEN/Stock/A-CDP → Cantidad contada: 0 → Razón: "Artículo nunca registrado en A-CDP, corrección auditoría 2026-06-30" → **Aplicar todo**
5. **Si el artículo sí existe físicamente en A-CDP:** crear entrada desde la ubicación real antes de corregir

**Validación:** Stock en 0. No negativo.

---

## GRUPO B — Despacho sin Recepción Previa (13 artículos)

> **Cómo leer este grupo:** Estos artículos fueron movidos fuera de A-CDP mediante transferencias internas (CDP/INT), pero Odoo no tenía el artículo registrado en A-CDP. El operador usó A-CDP como origen en la transferencia sin verificar que Odoo lo ubicara allí.
>
> **Acción general:**
> 1. Ir físicamente al almacén y buscar el artículo
> 2. **Si el artículo ESTÁ físicamente en A-CDP:** hacer Ajuste de Inventario para registrar su entrada
> 3. **Si el artículo NO está en A-CDP:** hacer Ajuste de Inventario poniendo cantidad = 0 (el negativo desaparece)

---

### B-01. Rect Plant Pot 65 X 22 X 30 Crema ⚠️ PRIORITARIO (-3)
- **Código SKU:** `AN-05100S201/M`
- **Ubicación Odoo:** ALVEN/Stock/A-CDP
- **Stock actual en Odoo:** -3
- **Causa:** Transferencia `CDP/INT/04944` del 27-jun-2026 — sin ninguna entrada registrada en A-CDP
- **Acción requerida:** Verificación física urgente (el único artículo con -3 en el grupo B)

**Pasos en Odoo:**
1. **Verificación física primero:** ir a A-CDP y contar cuántas macetas AN-05100S201/M hay físicamente
2. Inventario → Ajustes de Inventario → botón **"Nueva"**
3. En la línea del ajuste: Producto = `AN-05100S201/M` → Ubicación = ALVEN/Stock/A-CDP → Cantidad contada = [cantidad física real, puede ser 0]
4. Campo "Razón del ajuste": escribir "Corrección post-auditoría 2026-06-30 — artículo movido por CDP/INT/04944 sin recepción previa en A-CDP"
5. Hacer clic en **"Aplicar todo"**
6. Confirmar con **"Aplicar"** en el diálogo

**Validación:** El stock queda igual a lo que se contó físicamente (0 si no está, o la cantidad real si sí está).

---

### B-02. Arco Rug 350 X 250 Cm
- **Código SKU:** `LD-359817`
- **Ubicación Odoo:** ALVEN/Stock/A-CDP
- **Stock actual en Odoo:** -1
- **Causa:** Transferencia `CDP/INT/04935` del 17-jun-2026 — sin entrada en A-CDP

**Pasos en Odoo:**
1. Verificar físicamente si la alfombra está en A-CDP
2. Inventario → Ajustes de Inventario → Nueva
3. Producto: `LD-359817` → Ubicación: ALVEN/Stock/A-CDP → Cantidad contada: [según físico]
4. Razón: "Corrección auditoría 2026-06-30 — CDP/INT/04935 con bin origen incorrecto"
5. **Aplicar todo**

**Validación:** Stock ≥ 0.

---

### B-03. Silla
- **Código SKU:** `TW-AC1065/W`
- **Ubicación Odoo:** ALVEN/Stock/A-CDP
- **Stock actual en Odoo:** -1
- **Causa:** Transferencia `CDP/INT/04935` del 17-jun-2026

**Pasos en Odoo:**
1. Verificar físicamente si la silla está en A-CDP
2. Inventario → Ajustes de Inventario → Nueva → Producto: `TW-AC1065/W` → Ubicación: ALVEN/Stock/A-CDP → Cantidad contada: [según físico]
3. Razón: "Corrección auditoría 2026-06-30 — CDP/INT/04935 con bin origen incorrecto"
4. **Aplicar todo**

**Validación:** Stock ≥ 0.

---

### B-04. Bentley Berger Armchair
- **Código SKU:** `SEL-18.457`
- **Ubicación Odoo:** ALVEN/Stock/A-CDP
- **Stock actual en Odoo:** -1
- **Causa:** Transferencia `CDP/INT/04935` del 17-jun-2026

**Pasos en Odoo:**
1. Verificar físicamente si el sillón está en A-CDP
2. Inventario → Ajustes de Inventario → Nueva → Producto: `SEL-18.457` → Ubicación: ALVEN/Stock/A-CDP → Cantidad contada: [según físico]
3. Razón: "Corrección auditoría 2026-06-30 — CDP/INT/04935"
4. **Aplicar todo**

**Validación:** Stock ≥ 0.

---

### B-05. Armchair Col Cream
- **Código SKU:** `FSV-S6760/C`
- **Ubicación Odoo:** ALVEN/Stock/A-CDP
- **Stock actual en Odoo:** -1
- **Causa:** Transferencia `CDP/INT/04930` del 16-jun-2026

**Pasos en Odoo:**
1. Verificar físicamente si el sillón está en A-CDP
2. Inventario → Ajustes de Inventario → Nueva → Producto: `FSV-S6760/C` → Ubicación: ALVEN/Stock/A-CDP → Cantidad contada: [según físico]
3. Razón: "Corrección auditoría 2026-06-30 — CDP/INT/04930"
4. **Aplicar todo**

**Validación:** Stock ≥ 0.

---

### B-06. Wood Bookshelf Brown
- **Código SKU:** `BH-Z8208`
- **Ubicación Odoo:** ALVEN/Stock/A-CDP
- **Stock actual en Odoo:** -1
- **Causa:** Transferencia `CDP/INT/04939` del 18-jun-2026

**Pasos en Odoo:**
1. Verificar físicamente si la librera está en A-CDP
2. Inventario → Ajustes de Inventario → Nueva → Producto: `BH-Z8208` → Ubicación: ALVEN/Stock/A-CDP → Cantidad contada: [según físico]
3. Razón: "Corrección auditoría 2026-06-30 — CDP/INT/04939"
4. **Aplicar todo**

**Validación:** Stock ≥ 0.

---

### B-07. Stool
- **Código SKU:** `SMI-CM-315`
- **Ubicación Odoo:** ALVEN/Stock/A-CDP
- **Stock actual en Odoo:** -1
- **Causa:** Transferencia `CDP/INT/04939` del 18-jun-2026

**Pasos en Odoo:**
1. Verificar físicamente si el stool está en A-CDP
2. Inventario → Ajustes de Inventario → Nueva → Producto: `SMI-CM-315` → Ubicación: ALVEN/Stock/A-CDP → Cantidad contada: [según físico]
3. Razón: "Corrección auditoría 2026-06-30 — CDP/INT/04939"
4. **Aplicar todo**

**Validación:** Stock ≥ 0.

---

### B-08. Pearl Armchair Leather Col White
- **Código SKU:** `SJ-FK-0731/P`
- **Ubicación Odoo:** ALVEN/Stock/A-CDP
- **Stock actual en Odoo:** -1
- **Causa:** Transferencia `CDP/INT/04939` del 18-jun-2026

**Pasos en Odoo:**
1. Verificar físicamente si el sillón blanco está en A-CDP
2. Inventario → Ajustes de Inventario → Nueva → Producto: `SJ-FK-0731/P` → Ubicación: ALVEN/Stock/A-CDP → Cantidad contada: [según físico]
3. Razón: "Corrección auditoría 2026-06-30 — CDP/INT/04939"
4. **Aplicar todo**

**Validación:** Stock ≥ 0.

---

### B-09. Dining Chair Brown
- **Código SKU:** `NI-XL3120/B`
- **Ubicación Odoo:** ALVEN/Stock/A-CDP
- **Stock actual en Odoo:** -1
- **Causa:** Transferencia `CDP/INT/04939` del 18-jun-2026

**Pasos en Odoo:**
1. Verificar físicamente si la silla café está en A-CDP
2. Inventario → Ajustes de Inventario → Nueva → Producto: `NI-XL3120/B` → Ubicación: ALVEN/Stock/A-CDP → Cantidad contada: [según físico]
3. Razón: "Corrección auditoría 2026-06-30 — CDP/INT/04939"
4. **Aplicar todo**

**Validación:** Stock ≥ 0.

---

### B-10. Cordoba Sillas De Comedor
- **Código SKU:** `NZ-DC1193/BR`
- **Ubicación Odoo:** ALVEN/Stock/A-CDP
- **Stock actual en Odoo:** -1
- **Causa:** Transferencia `CDP/INT/04933` del 16-jun-2026

**Pasos en Odoo:**
1. Verificar físicamente si la silla está en A-CDP
2. Inventario → Ajustes de Inventario → Nueva → Producto: `NZ-DC1193/BR` → Ubicación: ALVEN/Stock/A-CDP → Cantidad contada: [según físico]
3. Razón: "Corrección auditoría 2026-06-30 — CDP/INT/04933"
4. **Aplicar todo**

**Validación:** Stock ≥ 0.

---

### B-11. Mesa De Centro
- **Código SKU:** `WF-P103`
- **Ubicación Odoo:** ALVEN/Stock/A-CDP
- **Stock actual en Odoo:** -1
- **Causa:** Transferencia `CDP/INT/04933` del 16-jun-2026

**Pasos en Odoo:**
1. Verificar físicamente si la mesa está en A-CDP
2. Inventario → Ajustes de Inventario → Nueva → Producto: `WF-P103` → Ubicación: ALVEN/Stock/A-CDP → Cantidad contada: [según físico]
3. Razón: "Corrección auditoría 2026-06-30 — CDP/INT/04933"
4. **Aplicar todo**

**Validación:** Stock ≥ 0.

---

### B-12. Dining Chair Small
- **Código SKU:** `SD-081D`
- **Ubicación Odoo:** ALVEN/Stock/A-CDP
- **Stock actual en Odoo:** -1
- **Causa:** Transferencia `CDP/INT/04944` del 27-jun-2026

**Pasos en Odoo:**
1. Verificar físicamente si la silla está en A-CDP
2. Inventario → Ajustes de Inventario → Nueva → Producto: `SD-081D` → Ubicación: ALVEN/Stock/A-CDP → Cantidad contada: [según físico]
3. Razón: "Corrección auditoría 2026-06-30 — CDP/INT/04944"
4. **Aplicar todo**

**Validación:** Stock ≥ 0.

---

### B-13. Cojin ⚠️ Ubicación diferente — PTN
- **Código SKU:** `CC-P-235-T`
- **Ubicación Odoo:** ALVEN/Stock/D-PTN/CUARTO LAMP (P-2)
- **Stock actual en Odoo:** -1
- **Causa:** Transferencia `PTN/INT/04359` del 22-jun-2026 — sin entrada en PTN/CUARTO LAMP

**Pasos en Odoo:**
1. Verificar físicamente si el cojín está en el Cuarto de Lámparas de PTN
2. Inventario → Ajustes de Inventario → Nueva → Producto: `CC-P-235-T` → Ubicación: ALVEN/Stock/D-PTN/CUARTO LAMP (P-2) → Cantidad contada: [según físico]
3. Razón: "Corrección auditoría 2026-06-30 — PTN/INT/04359 con bin origen incorrecto"
4. **Aplicar todo**

**Validación:** Stock ≥ 0 en PTN/CUARTO LAMP.

---

## GRUPO C — Salida Registrada Antes de la Entrada (13 artículos)

> **Cómo leer este grupo:** La entrada del artículo a A-CDP llegó al sistema DESPUÉS de que se registró su salida. Esto ocurre cuando se valida una transferencia interna desde A-CDP antes de registrar formalmente la recepción del artículo en esa ubicación. La mayoría proviene de las transferencias `CDP/INT/04944` y `CDP/INT/05302` del 27 de junio 2026.
>
> **Acción general:** Verificar físicamente si el artículo aún está en A-CDP. Si ya salió (lo más probable), hacer Ajuste de Inventario a 0. Si sigue ahí, ajustar a la cantidad física.

---

### C-01. Armchair Blue
- **Código SKU:** `SJ-FK-0731B`
- **Ubicación Odoo:** ALVEN/Stock/A-CDP
- **Stock actual en Odoo:** -1
- **Causa:** Salida registrada 2026-06-16 (`CDP/INT/04933`), entrada registrada 2026-06-26 (10 días después)
- **Transferencia a revisar:** CDP/INT/04933

**Pasos en Odoo:**
1. Inventario → Transferencias → buscar **CDP/INT/04933** → abrir → revisar la línea de este SKU → confirmar bin origen que usó Odoo
2. Verificar físicamente si el sillón azul está en A-CDP hoy
3. **Si ya no está:** Inventario → Ajustes de Inventario → Nueva → Producto: `SJ-FK-0731B` → Ubicación: ALVEN/Stock/A-CDP → Cantidad contada: 0 → Razón: "Salida registrada 16-jun antes de entrada 26-jun — corrección auditoría 2026-06-30" → **Aplicar todo**
4. **Si todavía está físicamente:** Cantidad contada: 1 → Aplicar todo

**Validación:** Stock ≥ 0.

---

### C-02. Lampara De Techo Color Madera (380)
- **Código SKU:** `MA-MD80160-1-380`
- **Ubicación Odoo:** ALVEN/Stock/A-CDP
- **Stock actual en Odoo:** -1
- **Causa:** Salida 2026-06-27 (`CDP/INT/05302`), entrada 2026-06-29
- **Transferencia a revisar:** CDP/INT/05302

**Pasos en Odoo:**
1. Inventario → Transferencias → buscar **CDP/INT/05302** → revisar línea de este SKU
2. Verificar físicamente si la lámpara está en A-CDP
3. Inventario → Ajustes de Inventario → Nueva → Producto: `MA-MD80160-1-380` → Ubicación: ALVEN/Stock/A-CDP → Cantidad contada: [según físico, probablemente 0] → Razón: "Salida 27-jun antes de entrada 29-jun — CDP/INT/05302 — corrección auditoría 2026-06-30" → **Aplicar todo**

**Validación:** Stock ≥ 0.

---

### C-03. Tabitha Ottoman White
- **Código SKU:** `FG.TABITHA.OTT.WH.P`
- **Ubicación Odoo:** ALVEN/Stock/A-CDP
- **Stock actual en Odoo:** -1
- **Causa:** Salida 2026-06-17 (`CDP/INT/04935`), entrada 2026-06-25
- **Transferencia a revisar:** CDP/INT/04935

**Pasos en Odoo:**
1. Inventario → Transferencias → buscar **CDP/INT/04935** → revisar línea de este SKU
2. Verificar físicamente
3. Inventario → Ajustes de Inventario → Nueva → Producto: `FG.TABITHA.OTT.WH.P` → Ubicación: ALVEN/Stock/A-CDP → Cantidad contada: [según físico] → Razón: "Salida 17-jun antes de entrada 25-jun — corrección auditoría 2026-06-30" → **Aplicar todo**

**Validación:** Stock ≥ 0.

---

### C-04. Mesa De Centro Gris
- **Código SKU:** `WF-SE130C/G`
- **Ubicación Odoo:** ALVEN/Stock/A-CDP
- **Stock actual en Odoo:** -1
- **Causa:** IN=4 (último 2026-06-25), OUT=5 (último 2026-06-20 `CDP/INT/04940`)
- **Transferencia a revisar:** CDP/INT/04940

**Pasos en Odoo:**
1. Inventario → Transferencias → buscar **CDP/INT/04940** → revisar línea de este SKU
2. Verificar físicamente si la mesa gris está en A-CDP
3. Inventario → Ajustes de Inventario → Nueva → Producto: `WF-SE130C/G` → Ubicación: ALVEN/Stock/A-CDP → Cantidad contada: [según físico] → Razón: "Salidas exceden entradas — CDP/INT/04940 — corrección auditoría 2026-06-30" → **Aplicar todo**

**Validación:** Stock ≥ 0.

---

### C-05. Brass Plus White Clothshade Plus Glass Silver
- **Código SKU:** `ARD-RB9046-1`
- **Ubicación Odoo:** ALVEN/Stock/A-CDP
- **Stock actual en Odoo:** -1
- **Causa:** Salida 2026-06-27 (`CDP/INT/04944`), entrada 2026-06-29
- **Transferencia a revisar:** CDP/INT/04944

**Pasos en Odoo:**
1. Inventario → Transferencias → buscar **CDP/INT/04944** → revisar línea de este SKU
2. Verificar físicamente
3. Inventario → Ajustes de Inventario → Nueva → Producto: `ARD-RB9046-1` → Ubicación: ALVEN/Stock/A-CDP → Cantidad contada: [según físico] → Razón: "Salida 27-jun antes de entrada 29-jun — CDP/INT/04944 — corrección auditoría 2026-06-30" → **Aplicar todo**

**Validación:** Stock ≥ 0.

---

### C-06. Cocktail Table
- **Código SKU:** `SI-TRAN105/W`
- **Ubicación Odoo:** ALVEN/Stock/A-CDP
- **Stock actual en Odoo:** -1
- **Causa:** Salida 2026-06-27 (`CDP/INT/04944`), entrada 2026-06-26
- **Transferencia a revisar:** CDP/INT/04944

**Pasos en Odoo:**
1. Inventario → Transferencias → buscar **CDP/INT/04944** → revisar línea de este SKU
2. Verificar físicamente
3. Inventario → Ajustes de Inventario → Nueva → Producto: `SI-TRAN105/W` → Ubicación: ALVEN/Stock/A-CDP → Cantidad contada: [según físico] → Razón: "Salidas > entradas — CDP/INT/04944 — corrección auditoría 2026-06-30" → **Aplicar todo**

**Validación:** Stock ≥ 0.

---

### C-07. Mesa
- **Código SKU:** `BH-08002`
- **Ubicación Odoo:** ALVEN/Stock/A-CDP
- **Stock actual en Odoo:** -1
- **Causa:** Salida 2026-06-27 (`CDP/INT/05302`), entrada 2026-06-29
- **Transferencia a revisar:** CDP/INT/05302

**Pasos en Odoo:**
1. Inventario → Transferencias → buscar **CDP/INT/05302** → revisar línea de este SKU
2. Verificar físicamente
3. Inventario → Ajustes de Inventario → Nueva → Producto: `BH-08002` → Ubicación: ALVEN/Stock/A-CDP → Cantidad contada: [según físico] → Razón: "Salida 27-jun antes de entrada 29-jun — CDP/INT/05302 — corrección auditoría 2026-06-30" → **Aplicar todo**

**Validación:** Stock ≥ 0.

---

### C-08. Mesita De Noche 3 Gabetas
- **Código SKU:** `TEMPO-107`
- **Ubicación Odoo:** ALVEN/Stock/A-CDP
- **Stock actual en Odoo:** -1
- **Causa:** Salida 2026-06-27 (`CDP/INT/05302`), entrada 2026-06-29
- **Transferencia a revisar:** CDP/INT/05302

**Pasos en Odoo:**
1. Inventario → Transferencias → buscar **CDP/INT/05302** → revisar línea de este SKU
2. Verificar físicamente
3. Inventario → Ajustes de Inventario → Nueva → Producto: `TEMPO-107` → Ubicación: ALVEN/Stock/A-CDP → Cantidad contada: [según físico] → Razón: "Salida 27-jun antes de entrada 29-jun — CDP/INT/05302 — corrección auditoría 2026-06-30" → **Aplicar todo**

**Validación:** Stock ≥ 0.

---

### C-09. Lampara De Mesa
- **Código SKU:** `SU-676T`
- **Ubicación Odoo:** ALVEN/Stock/A-CDP
- **Stock actual en Odoo:** -1
- **Causa:** Salida 2026-06-27 (`CDP/INT/05302`), entrada 2026-06-29
- **Transferencia a revisar:** CDP/INT/05302

**Pasos en Odoo:**
1. Inventario → Transferencias → buscar **CDP/INT/05302** → revisar línea de este SKU
2. Verificar físicamente
3. Inventario → Ajustes de Inventario → Nueva → Producto: `SU-676T` → Ubicación: ALVEN/Stock/A-CDP → Cantidad contada: [según físico] → Razón: "Salida 27-jun antes de entrada 29-jun — CDP/INT/05302 — corrección auditoría 2026-06-30" → **Aplicar todo**

**Validación:** Stock ≥ 0.

---

### C-10. Mesa De Centro En Mimbre Natural
- **Código SKU:** `TEMPO-150`
- **Ubicación Odoo:** ALVEN/Stock/A-CDP
- **Stock actual en Odoo:** -1
- **Causa:** Salida 2026-06-18 (`CDP/INT/04939`), entrada 2026-06-26
- **Transferencia a revisar:** CDP/INT/04939

**Pasos en Odoo:**
1. Inventario → Transferencias → buscar **CDP/INT/04939** → revisar línea de este SKU
2. Verificar físicamente
3. Inventario → Ajustes de Inventario → Nueva → Producto: `TEMPO-150` → Ubicación: ALVEN/Stock/A-CDP → Cantidad contada: [según físico] → Razón: "Salida 18-jun antes de entrada 26-jun — CDP/INT/04939 — corrección auditoría 2026-06-30" → **Aplicar todo**

**Validación:** Stock ≥ 0.

---

### C-11. Ottoman Rectangular Missoni
- **Código SKU:** `TEMPO-126`
- **Ubicación Odoo:** ALVEN/Stock/A-CDP
- **Stock actual en Odoo:** -1
- **Causa:** Salida 2026-06-27 (`CDP/INT/04944`), entrada 2026-06-26
- **Transferencia a revisar:** CDP/INT/04944

**Pasos en Odoo:**
1. Inventario → Transferencias → buscar **CDP/INT/04944** → revisar línea de este SKU
2. Verificar físicamente
3. Inventario → Ajustes de Inventario → Nueva → Producto: `TEMPO-126` → Ubicación: ALVEN/Stock/A-CDP → Cantidad contada: [según físico] → Razón: "Salidas > entradas — CDP/INT/04944 — corrección auditoría 2026-06-30" → **Aplicar todo**

**Validación:** Stock ≥ 0.

---

### C-12. Terrazo Coffee Table D50 Color Grey
- **Código SKU:** `HGI.ELLEN.SDTBL50.GRY.P`
- **Ubicación Odoo:** ALVEN/Stock/A-CDP
- **Stock actual en Odoo:** -1
- **Causa:** Salida 2026-06-27 (`CDP/INT/04944`), entrada 2026-06-29
- **Transferencia a revisar:** CDP/INT/04944

**Pasos en Odoo:**
1. Inventario → Transferencias → buscar **CDP/INT/04944** → revisar línea de este SKU
2. Verificar físicamente
3. Inventario → Ajustes de Inventario → Nueva → Producto: `HGI.ELLEN.SDTBL50.GRY.P` → Ubicación: ALVEN/Stock/A-CDP → Cantidad contada: [según físico] → Razón: "Salida 27-jun antes de entrada 29-jun — CDP/INT/04944 — corrección auditoría 2026-06-30" → **Aplicar todo**

**Validación:** Stock ≥ 0.

---

### C-13. Jewellery Box
- **Código SKU:** `RG-LD4622`
- **Ubicación Odoo:** ALVEN/Stock/A-CDP
- **Stock actual en Odoo:** -1
- **Causa:** IN=29 (2026-06-27), OUT=30 (2026-06-27 `CDP/INT/05292`) — mismo día, la salida superó las entradas disponibles
- **Transferencia a revisar:** CDP/INT/05292

**Pasos en Odoo:**
1. Inventario → Transferencias → buscar **CDP/INT/05292** → revisar todas las líneas de este SKU
2. Verificar físicamente si quedan Jewellery Box en A-CDP
3. Inventario → Ajustes de Inventario → Nueva → Producto: `RG-LD4622` → Ubicación: ALVEN/Stock/A-CDP → Cantidad contada: [según físico] → Razón: "Salida excedió entradas del mismo día — CDP/INT/05292 — corrección auditoría 2026-06-30" → **Aplicar todo**

**Validación:** Stock ≥ 0.

---

## Resumen de Correcciones — Tabla de Seguimiento

| # | SKU | Nombre | Qty neg. | Grupo | Acción | Responsable | Hecho |
|---|-----|--------|----------|-------|--------|-------------|-------|
| 1 | GE.KAYLE.SOFA.CX.BG.C2 | Kayle Sofa Cx Mod Beige | -1 | A | Devolver kit GE.KAYLE.SOFA.BG.K3 | | ☐ |
| 2 | GE.KAYLE.SOFA.RX.BG.C3 | Kayle Sofa Rx Mod Beige | -1 | A | Se corrige con A-01 | | ☐ |
| 3 | GE.KAYLE.SOFA.LX.BG.C1 | Kayle Sofa Lx Mod Beige | -1 | A | Se corrige con A-01 | | ☐ |
| 4 | GZF.KAES.COFFTBL.130.PART3.BLK.C3 | Kaes Coffee Table Part 3 | -1 | A | Devolver kit GZF.KAES.COFFTBL.130.MARB.BLK.K3 | | ☐ |
| 5 | GZF.WEAVER.SOFA.RX.PARIS90-D.C7 | Weaver Sofa Rx Grey | -1 | A | Devolver kit GZF.WEAVER.SOFA.PARIS90-D.K7 | | ☐ |
| 6 | GZF.WEAVER.SDTBL.WH.MARB.TOP.C2 | Weaver Slope Marble Table | -1 | A | Se corrige con A-05 | | ☐ |
| 7 | GZF.WEAVER.SOFA.RX.HENNES-60A.C7 | Weaver Sofa Rx Beige | -1 | A | Devolver kit GZF.WEAVER.SOFA.HENNES-60A.K7 | | ☐ |
| 8 | GVF.IRVA.SDTBL45.BASE.BLK.C2 | Irva Side Table Base Black | -1 | A | Devolver kit GVF.IRVA.SDTBL45.ESME.MARB.K2 | | ☐ |
| 9 | GVF.IRVA.SDTBL45.DKEMPER.TOP.C1 | Irva Side Table Top | -1 | A | Devolver kit GVF.IRVA.SDTBL45.DKEMPER.MARB.K2 | | ☐ |
| 10 | GVF.MERA.COFFTBL.BIG.LAUREN.BLK.BASE.C2 | Mera Coffee Table Base | -1 | A | Devolver kit GVF.MERA.COFFTBL.BIG.LAURENBLK.K2 | | ☐ |
| 11 | GDF.CLOVE.DTBL160.OAK.BASE.BRW.C2 | Clove Dining Table Base | -1 | A | Devolver kit GDF.CLOVE.DTBL160.STN.MARB.TOP.K2 | | ☐ |
| 12 | HGI.TERRAZO.COFFTBL50.GRY.TOP.C1 | Terrazo Coffee Table D70 | -1 | A | Devolver kit HGI.TERRAZO.COFFTBL50.GRY.K2 | | ☐ |
| 13 | NAT.MELPOT.CABINET.BRW.DRAWER.C5 | Melpot Cabinet Drawer | -1 | A | Devolver kit NAT.MELPOT.SOFA.LGHTGRY.BRW.K16 | | ☐ |
| 14 | CF-BR-BG003/GL | Cama King | -1 | A | Devolver kit [CKC] Cama King Selum | | ☐ |
| 15 | MA-MD80160-1-800 | Lampara Techo Madera (800) | -2 | A | Devolver 2 uds kit [LCP] Lampara Chandelier | | ☐ |
| 16 | HN-C6Z51-C-1/2 | Silla Comp 1/2 | -2 | A | Devolver 2 uds kit [HN-C6Z51-C-K2] | | ☐ |
| 17 | HN-C6Z51-C-2/2 | Silla Comp 2/2 | -2 | A | Se corrige con A-16 | | ☐ |
| 18 | TD-MES01CO | Shade Melt Lamp Copper | -1 | A | Devolver kit [LAMP2] Lamparas I | | ☐ |
| 19 | BH-H8242 | 6 Drawers Cabinet Walnut | -1 | A | Devolver kit [VSC] Consolas Multiples | | ☐ |
| 20 | FSV.JOWIL.SOFA.BG.RAWRX.C1 | Jowil Sofa Beige Rx | -1 | A | ⚠️ Ajuste inventario a 0 — nunca entró a A-CDP | | ☐ |
| 21 | AN-05100S201/M | Rect Plant Pot Crema | -3 | B | ⚠️ Verificar físico → Ajuste inventario | | ☐ |
| 22 | LD-359817 | Arco Rug 350x250 | -1 | B | Verificar físico → Ajuste inventario | | ☐ |
| 23 | TW-AC1065/W | Silla | -1 | B | Verificar físico → Ajuste inventario | | ☐ |
| 24 | SEL-18.457 | Bentley Berger Armchair | -1 | B | Verificar físico → Ajuste inventario | | ☐ |
| 25 | FSV-S6760/C | Armchair Col Cream | -1 | B | Verificar físico → Ajuste inventario | | ☐ |
| 26 | BH-Z8208 | Wood Bookshelf Brown | -1 | B | Verificar físico → Ajuste inventario | | ☐ |
| 27 | SMI-CM-315 | Stool | -1 | B | Verificar físico → Ajuste inventario | | ☐ |
| 28 | SJ-FK-0731/P | Pearl Armchair White | -1 | B | Verificar físico → Ajuste inventario | | ☐ |
| 29 | NI-XL3120/B | Dining Chair Brown | -1 | B | Verificar físico → Ajuste inventario | | ☐ |
| 30 | NZ-DC1193/BR | Cordoba Sillas Comedor | -1 | B | Verificar físico → Ajuste inventario | | ☐ |
| 31 | WF-P103 | Mesa De Centro | -1 | B | Verificar físico → Ajuste inventario | | ☐ |
| 32 | SD-081D | Dining Chair Small | -1 | B | Verificar físico → Ajuste inventario | | ☐ |
| 33 | CC-P-235-T | Cojin | -1 | B | Verificar físico en PTN → Ajuste inventario | | ☐ |
| 34 | SJ-FK-0731B | Armchair Blue | -1 | C | Revisar CDP/INT/04933 → Ajuste inventario | | ☐ |
| 35 | MA-MD80160-1-380 | Lampara Techo Madera (380) | -1 | C | Revisar CDP/INT/05302 → Ajuste inventario | | ☐ |
| 36 | FG.TABITHA.OTT.WH.P | Tabitha Ottoman White | -1 | C | Revisar CDP/INT/04935 → Ajuste inventario | | ☐ |
| 37 | WF-SE130C/G | Mesa Centro Gris | -1 | C | Revisar CDP/INT/04940 → Ajuste inventario | | ☐ |
| 38 | ARD-RB9046-1 | Brass White Clothshade | -1 | C | Revisar CDP/INT/04944 → Ajuste inventario | | ☐ |
| 39 | SI-TRAN105/W | Cocktail Table | -1 | C | Revisar CDP/INT/04944 → Ajuste inventario | | ☐ |
| 40 | BH-08002 | Mesa | -1 | C | Revisar CDP/INT/05302 → Ajuste inventario | | ☐ |
| 41 | TEMPO-107 | Mesita Noche 3 Gabetas | -1 | C | Revisar CDP/INT/05302 → Ajuste inventario | | ☐ |
| 42 | SU-676T | Lampara De Mesa | -1 | C | Revisar CDP/INT/05302 → Ajuste inventario | | ☐ |
| 43 | TEMPO-150 | Mesa Centro Mimbre | -1 | C | Revisar CDP/INT/04939 → Ajuste inventario | | ☐ |
| 44 | TEMPO-126 | Ottoman Rectangular Missoni | -1 | C | Revisar CDP/INT/04944 → Ajuste inventario | | ☐ |
| 45 | HGI.ELLEN.SDTBL50.GRY.P | Terrazo Coffee Table D50 | -1 | C | Revisar CDP/INT/04944 → Ajuste inventario | | ☐ |
| 46 | RG-LD4622 | Jewellery Box | -1 | C | Revisar CDP/INT/05292 → Ajuste inventario | | ☐ |

---

## Cómo hacer un Ajuste de Inventario en Odoo (referencia rápida)

1. Menú principal → **Inventario**
2. Menú superior → **Operaciones** → **Ajustes de Inventario**
3. Botón **"Nueva"** (esquina superior izquierda)
4. Llenar:
   - **Producto:** escribir el SKU o nombre y seleccionar de la lista
   - **Ubicación:** escribir ALVEN/Stock/A-CDP y seleccionar (o la ubicación indicada)
   - **Cantidad contada:** el número que hay físicamente (puede ser 0)
   - **Razón del ajuste:** siempre escribir el motivo con referencia a esta auditoría
5. Clic en **"Aplicar todo"**
6. En el diálogo de confirmación → clic en **"Aplicar"**
7. Verificar que el stock quedó en el valor esperado: Inventario → Productos → buscar el SKU → revisar columna "A Mano"

---

*Documento generado el 2026-06-30 | Ron (Analista Odoo) + Pit (Gerente de Operaciones) | dashboard-despachos-live*
