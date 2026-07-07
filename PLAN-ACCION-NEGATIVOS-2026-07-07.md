# Plan de Acción — Negativos por Transferencias desde A-CDP
**Fecha:** 2026-07-07 | **Base:** `CORRECCION-INVENTARIO-2026-06-30.md` (auditoría 30-jun) + verificación en vivo contra Odoo el 7-jul
**Verificación de avance:** `node _ron_neg_watch.mjs`

---

## 1. Estado real al 7 de julio (verificado contra Odoo)

| Métrica | Valor |
|---|---|
| Artículos de la auditoría 30-jun que **siguen negativos** | **45 de 46** (solo se corrigió `GVF.IRVA.SDTBL45.DKEMPER.TOP.C1`) |
| **Negativos NUEVOS** aparecidos después de la auditoría | **5** (todos por el mismo patrón) |
| Total quants negativos hoy en A-CDP + PTN | 50 |
| Negativos en ubicación virtual del sistema anterior (no físicos, fuera de alcance) | 115 |

**Conclusión:** el plan de corrección del 30-jun no se ha ejecutado, y la causa raíz sigue activa — se generaron 5 negativos nuevos entre el 3 y el 6 de julio.

---

## 2. Causa raíz confirmada (con evidencia de Odoo)

El flujo físico va **más rápido** que el registro en Odoo:

1. La mercancía sale de PTN hacia CDP y se registra la salida (`PTN/INT/xxxx` → tránsito) — esto sí se hace a tiempo.
2. La mercancía llega físicamente al frontal de CDP (PFRONTAL) y el equipo **la trabaja de inmediato**: putaway a racks, picks, despachos.
3. La **recepción en Odoo (tránsito → A-CDP) se valida días después o en lote**. Evidencia: `CDP/INT/05534` (42 líneas) fue creada el **7-jul** para mercancía que salió de PTN el **3-jul**; el 6-jul ya se habían validado picks moviendo esas piezas dentro de A-CDP → 5 negativos nuevos.
4. Odoo permite validar transferencias forzando cantidades desde bins sin stock registrado → el bin queda negativo.
5. Agravante: las recepciones entran al **padre A-CDP**, no al bin real (PFRONTAL), así que aun validando la recepción los bins no cuadran.

**Validadores de las transferencias problema** (para entrenamiento dirigido, no para culpar):
- Melvin Grullón — CDP/INT/04930, 04933, 04935, 04939, 04940, 04944, 05302
- José Ismael Ureña — PTN/INT/04359, 04395
- Franklin Antonio de Jesús Candelario — CDP/INT/05292

**Nota Grupo A (kits phantom):** causa distinta — kits despachados más veces de las que entraron. Se corrige por el kit padre según la guía del 30-jun. No es problema de transferencias, pero sigue pendiente completo (19/20).

---

## 3. Plan de corrección

### Fase 0 — Hoy mismo (detener el sangrado) — Responsable: encargado CDP
1. **Validar `CDP/INT/05534`** (recepción pendiente tránsito → A-CDP, 42 líneas) tan pronto se confirme que la mercancía llegó físicamente. Esto es lo que mantiene vivos los 5 negativos nuevos.
2. Tras validar, **corregir bin por bin los 5 nuevos SIN ajuste de inventario**: hacer una transferencia interna de A-CDP (padre) → al bin negativo (PFRONTAL / IG4) por 1 unidad de cada SKU:
   - `HON.DELY.CHAIR.BG.P` (IG4), `JH.NALTO.RUG.300X400.WSAND.P`, `GZF.RHAYE.OTT.MOTA-02C .P`, `ZN.KEA.CEILAMP.GOLD.100.P`, `MOR.LILO.WING.ARMCH.BLUE.RED.BG.P` (PFRONTAL)
3. **Regla inmediata para el equipo:** ninguna transferencia/pick desde un bin de A-CDP se valida si Odoo muestra 0 en ese bin. Si la pieza está físicamente pero Odoo dice 0 → primero resolver la entrada (¿hay recepción pendiente?), después mover.

### Fase 1 — Conteo físico dirigido (1 caminata, ~2h) — Responsable: a designar
Una sola caminata con checklist de los 26 SKUs de Grupos B y C (+ `FSV.JOWIL.SOFA.BG.RAWRX.C1` de A-20). Anotar cantidad física por SKU en A-CDP (y el cojín `CC-P-235-T` en PTN/Cuarto Lámparas). Sin este conteo NO se hace ningún ajuste — el ajuste refleja la realidad física, no al revés.

### Fase 2 — Correcciones en Odoo por lotes — Responsable: quien designe Gabriel + guía del 30-jun
Orden de ejecución:
1. **Prioritarios:** `AN-05100S201/M` (-3, B-01) y `FSV.JOWIL.SOFA.BG.RAWRX.C1` (A-20, nunca entró a A-CDP).
2. **Grupos B y C (26 SKUs):** ajuste de inventario a la cantidad contada (probablemente 0 en la mayoría), agrupando por transferencia causante para hacerlo en tandas (04933, 04935, 04939, 04944, 05302…). Razón estándar: referencia a auditoría 30-jun + transferencia causante. Pasos detallados por artículo en `CORRECCION-INVENTARIO-2026-06-30.md`.
3. **Grupo A (19 SKUs, 12 kits padres):** revisar el kit padre y devolver la salida de más (la devolución de 1 kit corrige varios componentes a la vez: Kayle corrige 3, HN-C6Z51 corrige 2, etc.). Solo usar ajuste si el picking del kit resultó correcto.

### Fase 3 — Verificación — Responsable: Gabriel / Ron
Correr `node _ron_neg_watch.mjs`: debe reportar 0 pendientes, 0 nuevos y 0 recepciones pendientes viejas. Repetir a la semana para confirmar que no reaparecen.

---

## 4. Plan de prevención (que no vuelva a ocurrir)

### P1 — Proceso de recepción (inmediato, sin software) ⭐ la medida que ataca la causa raíz
- **La recepción tránsito → CDP se valida en Odoo el mismo día que llega el camión, ANTES de mover/guardar cualquier pieza.** Nombrar un responsable único de validar recepciones en CDP con hora límite (ej. antes de las 3 pm).
- Al validar la recepción, registrar el destino en el **bin real** (PFRONTAL u otro), no en el padre A-CDP — o hacer el putaway en Odoo inmediatamente después.
- Prohibido validar INT/picks "forzando" cantidad desde un bin que Odoo muestra en 0.

### P2 — Entrenamiento dirigido (esta semana, 30 min)
Sesión corta con Melvin, José Ismael y Franklin usando los casos reales de esta auditoría: qué pasa en Odoo cuando se fuerza una salida sin stock, cómo verificar el bin antes de validar, y qué hacer si la pieza está pero Odoo dice 0.

### P3 — Watchdog automático de negativos en la plataforma (propuesta, ~1 día de desarrollo)
Job diario en `proxy.js` que consulte quants negativos en ubicaciones internas + recepciones de tránsito pendientes >24h, y dispare una notificación crítica por el sistema de notificaciones de WWP (v140). Detección en <24 horas en vez de esperar a la próxima auditoría. **Pendiente OK de Gabriel para construirlo.**

### P4 — Restricciones en Odoo
- altritempi.odoo.com es **Odoo Online (SaaS)** → NO se puede instalar el módulo OCA `stock_no_negative` que bloquearía negativos. Las opciones reales:
  - Restringir el permiso de validar transferencias internas a menos usuarios.
  - Usar la app **Código de Barras** para recepciones y transferencias (respeta reservas y dificulta forzar cantidades).
- Conteo cíclico semanal del frontal (PFRONTAL) — 15 min, detecta drift antes de que crezca.

### P5 — Kits (Grupo A)
- Regla operativa: los sets/colecciones se despachan **por el kit padre**, nunca moviendo componentes sueltos.
- Incluir 2-3 kits de alta rotación en el conteo cíclico semanal.

---

## 5. Decisiones que necesita tomar Gabriel

| # | Decisión | Opciones |
|---|---|---|
| 1 | ¿Quién ejecuta el conteo físico (Fase 1) y cuándo? | Nombre + fecha |
| 2 | ¿Quién aplica los ajustes en Odoo (Fase 2)? | Nombre (con la guía del 30-jun) |
| 3 | ¿Construir el watchdog automático (P3)? | Sí / No |
| 4 | ¿Restringir permisos de validación de transferencias en Odoo (P4)? | Sí / No / a quiénes |
| 5 | Responsable único + hora límite de validar recepciones en CDP (P1) | Nombre + hora |

---

*Generado el 2026-07-07 con verificación en vivo contra Odoo (uid 98) | Script de seguimiento: `_ron_neg_watch.mjs`*
