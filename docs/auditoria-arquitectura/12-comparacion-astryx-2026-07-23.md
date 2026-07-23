# Comparación: componentes OpsAT vs. Astryx (design system de Meta)

> **Fecha:** 2026-07-23 · **Fuente:** `https://astryx.atmeta.com` — `@astryxdesign/core v0.1.8`, repo `github.com/facebook/astryx`, © Meta Platforms.
> **Objetivo declarado por Gabriel:** *"este es el que quiero que implementemos al final"*.
> **Base de comparación:** auditoría de componentes propia ([`11-auditoria-componentes`](11-auditoria-componentes-2026-07-23.md), 6 familias inventariadas con `archivo:línea`).

---

## 1. El hallazgo que decide todo: Astryx es React

Antes de comparar píxeles, el dato duro:

| | Astryx | OpsAT |
|---|---|---|
| **Naturaleza** | Librería de **componentes React** (`.tsx`) | HTML/CSS/JS **vanilla** |
| **Import** | `import {Card} from '@astryxdesign/core/Card'` | clases CSS en un `<style>` |
| **Props** | `children: ReactNode` | atributos HTML |
| **Build** | Requiere bundler (ejemplos: Next.js, Vite) + npm | **Sin build. Sin npm en frontend.** Archivos estáticos |
| **Estilos** | StyleX (CSS-in-JS atómico) + CSS en `@layer astryx-base` | `<style>` inline + `theme.css` + `ui-isla.css` |
| **Estructura** | Componentes por archivo | monolito `historial.html` (34k líneas) + 6 islas iframe |

**Consecuencia:** *"implementar Astryx"* literalmente = **migrar el frontend entero a React + pipeline de build**. No es un refactor de componentes; es reescribir una app en producción que usan ~30 personas todos los días. Eso contradice la regla dura del proyecto (`CLAUDE.md`: sin build, librerías locales, nunca CDN) y el NORTE (crecer en módulos, no reescribir).

**Pero** hay una parte de Astryx que **sí es adoptable hoy sin tocar la arquitectura**: sus *tokens* (CSS custom properties puras) y sus *convenciones de API*. Ver §4.

---

## 2. Card — lado a lado

### Astryx `Card`

**Props (la lista COMPLETA):**
| Prop | Valores |
|---|---|
| `padding` | `0 \| 0.5 \| 1 \| 1.5 \| 2 \| 3 \| 4 \| 5 \| 6 \| 8 \| 10` (default **4**) — escala de spacing |
| `variant` | `default` \| `transparent` \| `muted` \| `blue`/`cyan`/`gray`/`green`/`orange`/`pink`/`purple`/`red`/`teal`/`yellow` — usa el token `--color-background-<name>` |
| `width` / `maxWidth` / `height` / `minHeight` | `SizeValue` |
| `children` | `ReactNode` |

**Lo que NO tiene: ni `radius`, ni `border`, ni `shadow`, ni `elevation`.** La geometría es propiedad del sistema — el consumidor no puede desviarla. Composición: se combina con `Layout` para header/content/footer con **divisores automáticos**.

### OpsAT hoy

| Eje | Astryx | OpsAT (medido) |
|---|---|---|
| Nº de "componentes" card | **1** | **40+** clases (`.card`, `.sol-card`, `.eo-card`, `.invd-card`, `.wwp-*-card`, `.emp-mat-card`…) |
| Radio | fijo (sistema) | **6 valores**: 6/8/10/12/14/16 (+20 en login); 10 y 14px **sin token** |
| Borde | fijo | **3 anchos**: 1px / 1.5px (familia WWP, 9 selectores) / 2px |
| Padding | escala de 11 pasos, default 4 | **40+ combinaciones** en px crudos; la más común aparece 10 veces |
| Fondo | `variant` (14 opciones tokenizadas) | ad-hoc; parte tokens, parte hex |
| Header/footer | `Layout` con divisores automáticos | cada card fabrica el suyo |
| Sombra | fija por variante | **5 valores** distintos solo en modales |

### La diferencia más importante NO es geométrica — es filosófica

Astryx dice, textualmente, en su guía de uso:

> *"Cards are NOT the default layout tool… Only reach for a Card when items need clear interaction boundaries or visual comparison in a grid."*

Y su regla de decisión: **"¿Podría reordenar o eliminar esto de forma independiente?"** Si sí → card. Si no → es una región de página: encabezado + `Stack`/`Section`, **sin caja**.

Sus "Don't" explícitos:
- **No** envolver secciones de página en cards ("General Settings", "Notification Preferences", grupos de formulario → son regiones, no cards).
- **No** anidar cards.
- **No** usar variantes de color para *estado* (para eso, `Banner`/`Badge`); el color es para *categorizar*.
- **No** crear rejillas de cards idénticas (icono + título + texto repetido).

**OpsAT hace exactamente lo contrario:** casi toda sección vive dentro de un panel con borde. Por eso la auditoría encontró 40+ variantes de card — porque *todo* acabó siendo una card. Ésta es la corrección de mayor impacto visual y conceptual, y **es gratis**: no requiere Astryx, solo aplicar el criterio.

---

## 3. Button — lado a lado

### Astryx `Button`

| Prop | Valores |
|---|---|
| `variant` | `primary` \| **`secondary` (default)** \| `ghost` \| `destructive` |
| `size` | `sm` \| **`md` (default)** \| `lg` |
| `label` | **string, requerido** — nombre accesible (visible por defecto; `aria-label` si `isIconOnly`) |
| `icon` / `endContent` / `isIconOnly` | icono antes/después; modo cuadrado solo-icono |
| `isLoading` / `clickAction` | **estado de carga integrado**: `clickAction` async muestra spinner mientras la promesa está pendiente |
| `isDisabled` / `isInterruptible` / `tooltip` / `width` / `type` / `form` | — |

**Tampoco tiene `padding`, `radius` ni `color`.** `variant` + `size` son dueños de la geometría.

### Comparación

| Eje | Astryx | OpsAT tras Fase C1 (hoy) | Veredicto |
|---|---|---|---|
| Taxonomía de variantes | primary / secondary / ghost / destructive | `.btn-primary` / `.btn-secondary` / `.btn-ghost` / `.btn-danger` | ✅ **Ya coincide** (solo cambia el nombre `danger`→`destructive`) |
| Tamaños | sm / md / lg | `.btn-sm` + default | ⚠️ falta `lg` |
| Default | **secondary** | primario de facto | ⚠️ invertido |
| Geometría por instancia | imposible (la posee el sistema) | **~150 botones con `style=` inline**; 3 azules de "primario"; padding 9/22·8/18·5/12 | ❌ la brecha grande |
| Estado de carga | integrado (`isLoading`, `clickAction`) | **no existe** | ❌ falta |
| Accesibilidad | `label` obligatorio | botones de icono sin `aria-label` en varios sitios | ❌ falta |
| Nº de clases de botón | 1 componente | **~40 clases `*-btn`** + inline | ❌ |

**Nota positiva:** la Fase C1 que ya implementé (base `.btn` + primary/secondary/ghost/danger sobre tokens) aterrizó, sin saberlo, en **la misma taxonomía que Astryx**. El camino ya apunta en la dirección correcta.

---

## 4. Tokens: la parte de Astryx que SÍ se puede adoptar hoy

Astryx entrega sus tokens como **CSS custom properties puras**, en paquetes de tema independientes del runtime React:

```css
@import '@astryxdesign/core/reset.css';
@import '@astryxdesign/core/astryx.css';
@import '@astryxdesign/theme-neutral/theme.css';
```

Temas disponibles: `theme-neutral` (recomendado como base), `butter`, `chocolate`, `gothic` (solo dark), `matcha`, `stone`, `y2k`.

| | Astryx | OpsAT `theme.css` |
|---|---|---|
| Color | `--color-background-<name>` (blue/green/red/…) | `--green-bg` / `--green-text` / `--green-dot` |
| Spacing | escala numérica `0…10` | `--sp-1 … --sp-8` |
| Radio | del tema (fijo por componente) | `--radius-sm/--radius/--radius-md/--radius-lg/--radius-full` |
| Dark mode | por tema | `[data-theme=dark]` |
| Capas CSS | `@layer reset`, `@layer astryx-base` | sin capas |

**La estructura de tokens de OpsAT ya es equivalente en cobertura** (color semántico, spacing, radio, tipografía, dark). No está lejos; está *nombrada distinto* y **aplicada sin disciplina**.

⚠️ Advertencia de integración que Astryx documenta: sus hojas usan **cascade layers**; CSS sin capa (como todo el `<style>` de OpsAT) **gana** sobre `@layer astryx-base` sin importar la especificidad. Mezclarlas sin declarar el orden de capas produce resultados impredecibles.

---

## 5. Las tres opciones reales

| Opción | Qué implica | Esfuerzo | Riesgo | Reversible |
|---|---|---|---|---|
| **A · Adoptar convenciones (nativo)** | Rehacer las clases de OpsAT para que cumplan el *contrato* de Astryx: variantes/tamaños fijos, geometría propiedad del sistema, sin overrides por instancia, filosofía "card = excepción". Sin React, sin build, sin dependencia. | Medio (= plan C2–C7 que ya existe, re-apuntado a la nomenclatura Astryx) | Bajo | Sí |
| **B · A + vendorizar los tokens de Astryx** | Además de A, traer `theme-neutral/theme.css` al repo (como se vendoriza lucide/chart) y mapear los tokens de OpsAT a los de Astryx. Paridad visual real. | Medio-Alto | Medio (cascade layers, remapeo de ~50 tokens) | Sí, con esfuerzo |
| **C · Migrar a React + Astryx** | Reescribir el frontend: React + bundler + reconstruir 15 secciones, 9 tabs, 6 islas y ~1.000 funciones del monolito. | **Muy alto** (meses) | **Muy alto** — app en producción, uso diario, 1 desarrollador | No |

### Recomendación

**Opción A ahora; B cuando A esté consolidada; C solo si hay una razón de negocio que lo justifique** (p. ej. contratar un equipo frontend, o que la app crezca a un producto multi-cliente).

Razones:
1. **A entrega el 80% del beneficio visible** (consistencia real) con el 5% del riesgo. El problema que motivó todo esto — "hay varios tipos de tabs / botones / cards" — se resuelve con A, no con React.
2. La Fase C1 ya demostró que el camino converge: la taxonomía de botones de OpsAT **ya coincide** con la de Astryx.
3. **C contradice el NORTE del producto** (crecer en módulos, no reescribir el monolito) y multiplicaría el bus-factor-1 que la auditoría 09 marcó como riesgo principal.
4. A y B dejan a OpsAT **listo para C**: si un día se migra a React, cada clase tendrá su componente Astryx equivalente 1:1.

---

## 6. Qué cambia en el plan C2–C7 si el destino es Astryx

El plan de la auditoría 11 sigue siendo válido; solo se re-apunta la nomenclatura y se añade la disciplina de "geometría propiedad del sistema":

| Fase | Ajuste para converger a Astryx |
|---|---|
| C1 ✅ | Renombrar `.btn-danger` → `.btn-destructive`; añadir `.btn-lg`; hacer **secondary** el default |
| C2 tabs | Mapear a los componentes reales de Astryx (`ToggleButtonGroup`, `Tabs`) en vez de inventar `.seg` |
| C3 inputs | Adoptar el contrato de sus inputs (label obligatorio, estados de error/ayuda) |
| C4 badges | `Badge` para categorías, `Banner` para estado — la separación que Astryx exige |
| C5 cards | **Aplicar la regla "card = excepción"**: retirar cards de las regiones de página (mayor impacto visual de todo el plan) |
| C6 modales | Contrato de `Dialog`/`Layout` con divisores automáticos |
| C7 inline | Erradicar `style=` por instancia — es lo que Astryx hace imposible por diseño |
| **C8 nuevo** | Estado de carga en botones (`isLoading`) y `aria-label` obligatorio en botones de icono |

---

*Comparación hecha leyendo la documentación pública de Astryx (Card, Button, Getting Started). No se instaló ningún paquete ni se ejecutó su CLI.*
