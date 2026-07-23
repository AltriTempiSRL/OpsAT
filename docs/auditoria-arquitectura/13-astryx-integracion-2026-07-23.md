# Astryx integrado en OpsAT — sin pipeline de build

> **Fecha:** 2026-07-23 · **Estado:** ✅ funcionando y verificado en navegador.
> **Decisión de Gabriel:** *"instala astryx quiero que siga con eso aunque sea difícil"*.
> Continúa la comparación del [doc 12](12-comparacion-astryx-2026-07-23.md).

---

## 1. El problema y cómo se resolvió

Astryx (`@astryxdesign/core`, design system de Meta) entrega **componentes React**. OpsAT es
**vanilla sin build**. La suposición inicial era que usarlo exigía migrar el frontend entero a
React + bundler.

**No fue necesario.** El paquete exporta un bundle **UMD** (`dist/astryx.umd.js`) que se carga
con un `<script>` normal y solo necesita `React`/`ReactDOM` como globales. Como React 19 ya no
publica builds UMD, se genera uno propio **una sola vez, localmente**, y se commitea.

**Resultado: producción sigue sirviendo archivos estáticos. `railway up` no cambia. Cero build
en el deploy.** Igual que `lucide.min.js` — alguien lo compiló, aquí solo se sirve.

---

## 2. Qué se instaló y dónde vive cada cosa

| Paquete | Tipo | Por qué |
|---|---|---|
| `@astryxdesign/core` | **devDependency** | Fuente de `astryx.umd.js` + CSS |
| `@astryxdesign/theme-neutral` | **devDependency** | Tokens del tema |
| `@astryxdesign/cli` | **devDependency** | Referencia de componentes/tokens |
| `esbuild` | **devDependency** | Compila el bundle de React globals |

⚠️ **Son devDependencies a propósito**: producción **nunca importa** React ni Astryx — solo
sirve los estáticos de `vendor/`. Las dependencias de runtime siguen siendo **4**
(`pg`, `@aws-sdk/client-s3`, `web-push`, `nodemailer`).

### Archivos vendorizados (commiteados, servidos como estáticos)

| Archivo | Tamaño | Qué es |
|---|---|---|
| `vendor/react-globals.js` | 189 K | React 19.2.8 + ReactDOM expuestos como globales (compilado local) |
| `vendor/astryx.umd.js` | 742 K | Bundle UMD de Astryx — expone el global `Astryx` con **433 componentes** |
| `vendor/astryx.css` | 124 K | Estilos de los componentes |
| `vendor/astryx-reset.css` | 12 K | Reset |
| `vendor/astryx-theme.css` | 18 K | Tokens del tema neutral |

**Peso total ≈ 1,1 MB.** Solo lo cargan las páginas que lo usen — el shell (`historial.html`)
**no lo carga**, así que las terminales Zebra no pagan ese costo salvo en módulos nuevos.

---

## 3. Cómo usarlo (patrón verificado)

Orden de carga **obligatorio**: reset → theme → componentes → React → Astryx.

```html
<link rel="stylesheet" href="/vendor/astryx-reset.css">
<link rel="stylesheet" href="/vendor/astryx-theme.css">
<link rel="stylesheet" href="/vendor/astryx.css">
...
<script src="/vendor/react-globals.js"></script>
<script src="/vendor/astryx.umd.js"></script>
<script>
  var h = React.createElement;                      // sin JSX: no hay compilación
  var Card = Astryx.Card, Button = Astryx.Button;
  function Vista() {
    return h(Card, {padding: 4},
      h(Astryx.Heading, {level: 3}, 'Título'),
      h(Button, {label: 'Guardar', variant: 'primary', onClick: guardar})
    );
  }
  ReactDOM.createRoot(document.getElementById('root')).render(h(Vista));
</script>
```

Ejemplo vivo y completo: **`astryx-demo.html`** (página de verificación con diagnóstico).

### Trampas descubiertas (cuestan tiempo si no se saben)

1. **La API es estricta: si falta una prop obligatoria, el componente NO renderiza y NO avisa.**
   `Heading` exige `level` (1–6); `Button` exige `label`. Un `Heading` sin `level` sale vacío
   en silencio. Esa disciplina es justo lo que hace consistente al sistema.
2. **React 19 renderiza async**: comprobar el DOM justo después de `.render()` da vacío. Hay que
   esperar un tick.
3. **Sin JSX** hay que usar `React.createElement`. Si se vuelve incómodo, la vía sin build es
   `htm` (template literals); con build, JSX normal.
4. **El allowlist de `.js` del servidor** (`proxy.js`, F2.2) bloquea cualquier `.js` no listado:
   los archivos nuevos de `vendor/` **deben registrarse ahí** o dan 403.
5. **El CLI exige Node ≥22.13** (hay v22.11) → `npx astryx init` no corre. No es bloqueante: la
   documentación está en `astryx.atmeta.com` y en los `.d.ts` de `node_modules`.

---

## 4. Regenerar los archivos vendorizados

```bash
npm run build:vendor
```

Recompila `react-globals.js` y vuelve a copiar los 4 archivos de Astryx desde `node_modules`.
Correrlo tras cada actualización de `@astryxdesign/core`, y **commitear el resultado**.

---

## 5. Camino recomendado de adopción

El NORTE del producto dice: *crecer en módulos (islas), nunca en el monolito*. Astryx encaja
exactamente ahí:

| Paso | Qué | Estado |
|---|---|---|
| 1 | Probar que el stack corre sin build | ✅ hecho (`astryx-demo.html`) |
| 2 | **Construir el próximo módulo nuevo con Astryx**, como isla | ← siguiente |
| 3 | Migrar islas existentes (empaque/formación/políticas/impacto) una por una, cuando toque tocarlas | pendiente |
| 4 | El shell (`historial.html`, 34k líneas) — **al final, o nunca** | evaluar |

**No conviene migrar el shell.** Es una app en producción, uso diario, un solo desarrollador.
La capa de componentes canónicos (doc 11) ya le dio consistencia en CSS nativo, y sigue siendo
la respuesta correcta para el monolito. Astryx es para **lo nuevo**.

### Deploy

Se añadió **`.railwayignore`**: sin él, `railway up` subiría los ~194 MB de `node_modules` en
cada deploy (Railway instala las dependencias desde `package.json` durante su build). `vendor/`
sí se sube — es el artefacto que producción sirve.

---

## 6. Aviso de seguridad no relacionado

`npm audit` reportó **1 vulnerabilidad alta en `nodemailer` ≤9.0.0** (inyección de comandos
SMTP, CRLF en headers, TLS en OAuth2). **Es preexistente**, no viene de Astryx — solo salió a
la luz porque `npm install` corre auditoría. El arreglo (`nodemailer@9.0.3`) es *breaking*, así
que requiere decisión y prueba del envío de correo. Queda anotado, no aplicado.
