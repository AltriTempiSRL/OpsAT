# Propuesta de SOP — Compras: productos duplicados "(Copia)" en Odoo

**Para:** Equipo de Compras — Altri Tempi
**De:** Operaciones / Despachos
**Fecha:** 3 de julio de 2026
**Estado:** Propuesta para aprobación de la dirección

---

## 1. El problema y por qué importa

Al crear un producto nuevo en Odoo partiendo de uno existente, hoy se duplica el producto,
se corrige la referencia interna y el código de barras, **pero no se corrige el nombre**.
El producto queda registrado con el nombre del original más "(Copia)".

A la fecha hay **574 productos vendibles con "(Copia)" en el nombre** en el maestro de Odoo.

Ese nombre equivocado no se queda en Odoo: viaja a todo lo que sale de ahí — órdenes de venta,
tareas de despacho, fotos de evidencia y documentos que ve el cliente. Casos reales de esta semana:

- **Kholin Armchair "Color Blue (Copia)"** — el sillón físico es **marrón**. En el despacho,
  las evidencias y los documentos aparecía como azul. Un cliente puede rechazar la entrega de
  un producto correcto, o el almacén puede despachar el color equivocado confiando en el sistema.
- **Componentes del kit Lione Console** — los componentes quedaron con **nombres cruzados**
  (cada pieza llevaba el nombre de otra). Imposible verificar un despacho de kit contra el sistema.
- **Misha** — un producto registrado como *pouf* que en realidad era un *cushion*: no era una
  variante del original, era **otro producto**.

**Impacto:** riesgo de despachar el artículo o color equivocado, evidencias fotográficas
etiquetadas con nombres falsos, documentos al cliente con descripciones incorrectas, y tiempo
perdido en almacén y ventas verificando "qué es realmente" cada producto. La plataforma de
despachos ya aplicó una corrección temporal de su lado, pero **la única solución real es
corregir los nombres en Odoo y cambiar el procedimiento que los genera**.

---

## 2. Procedimiento correcto al crear un producto nuevo

### Opción A — Duplicar (solo si el producto nuevo es una variante del original: otro color, otra medida, otro acabado)

1. **Duplicar** el producto en Odoo.
2. **Renombrar INMEDIATAMENTE**, antes de cualquier otro paso:
   - Quitar "(Copia)".
   - Poner el nombre real y completo del producto nuevo, **incluyendo su color/variante real**
     (no el del original).
3. Corregir **referencia interna** y **código de barras** (esto ya se hace bien hoy — se mantiene).
4. **Verificar la imagen**: la foto debe ser la del producto nuevo. Si no se tiene, quitar la
   heredada del original; una foto del producto equivocado es peor que ninguna.
5. Si es un **kit**, abrir la lista de componentes y confirmar que **cada componente tiene su
   propio nombre correcto** (aprendizaje del caso Lione Console).

**Regla de oro: ningún producto se guarda con "(Copia)" en el nombre. Nunca.**
Si no hay tiempo de completar el renombre en ese momento, no se duplica todavía.

### Opción B — Crear desde cero

Si el producto nuevo **no es una simple variante** del existente (es otro tipo de artículo,
otro proveedor, otra categoría — como el caso Misha), **no duplicar**: crear el producto desde
cero con su nombre, referencia, código de barras e imagen propios. Duplicar solo ahorra tiempo
cuando casi todo es igual; en los demás casos siembra errores.

---

## 3. Plan de limpieza de los 574 existentes

Corregir por lotes, empezando por los que más daño pueden causar:

| Lote | Criterio | Prioridad |
|------|----------|-----------|
| 1 | Productos "(Copia)" **con stock a mano** | Inmediata — son los que se pueden despachar mañana |
| 2 | Productos "(Copia)" **con ventas u órdenes activas/recientes** (últimos 12 meses) | Alta |
| 3 | El resto (sin stock ni movimiento) | Normal — al ritmo del equipo |

**Cómo trabajar cada lote:**

1. Exportar de Odoo la lista de productos cuyo nombre contiene "(Copia)", con stock y última venta.
2. Asignar un responsable por lote y una meta semanal realista (sugerencia: **50–100 productos por semana** → limpieza completa en ~2 meses).
3. Para cada producto, **confirmar el nombre real antes de renombrar**: contra el físico, la foto
   del proveedor o el catálogo. No adivinar — el caso Kholin demuestra que el nombre heredado
   puede describir un producto distinto al real.
4. En kits, revisar también los nombres de los componentes.
5. Llevar un registro simple: fecha, producto, nombre anterior, nombre nuevo, quién corrigió.

---

## 4. Cómo verificar que estamos limpios

- **Chequeo semanal** (2 minutos): en el maestro de productos de Odoo, filtrar por nombre que
  contenga **"(Copia)"**. La meta es que el resultado sea **0**.
- Mientras dure la limpieza, ese número debe **bajar cada semana**; anotarlo en el registro del plan.
- Si aparece un "(Copia)" **nuevo** (creado esa semana), corregirlo de inmediato y repasar el
  procedimiento de la sección 2 con quien lo creó — sin el cambio de hábito, la limpieza se rehace sola.
- Al llegar a 0: mantener el chequeo **una vez al mes** como control permanente.

---

## Resumen en una línea

**Duplicar está bien; entregar el duplicado sin renombrar, no.** El nombre se corrige en el
mismo momento en que se duplica — o el producto se crea desde cero.
