# Dashboard Despachos — Guía del proyecto

## Fuente de verdad: carpeta raíz

Todos los archivos editables están en la **carpeta raíz** del proyecto:
`C:\Users\Gabriel Ramirez\OneDrive\Documentos\Claude\Artifacts\dashboard-despachos-live\`

| Archivo | Descripción |
|---------|-------------|
| `historial.html` | App principal (historial + WWP embebido) |
| `wwp.html` | ⚠️ DEPRECADO — redirige a historial.html, no editar |
| `index.html` | Dashboard de despachos |
| `proxy.js` | Servidor Node.js (API + archivos estáticos) |
| `lucide.min.js` | Librería de íconos (LOCAL, no CDN) |
| `leaflet.js` / `leaflet.css` | Mapas (LOCAL, no CDN) — usados en el mapa de ubicaciones |
| `MEMORIA-PROYECTO.md` | Historial de features y decisiones (leer para contexto completo) |

## Archivos que NO se editan

- `historial.backup-20260518.html` — backup original, solo lectura
- `.claude/worktrees/` — worktrees anteriores, ignorar
- `wwp.html` — DEPRECADO. Nunca editar para implementar funcionalidades de la plataforma. Toda la lógica de Workforce Platform vive en `historial.html`. Si algo hay que arreglar o agregar en WWP, el archivo correcto es SIEMPRE `historial.html`.

## Servidor

- Correr siempre: doble clic en `restart.bat`
- URL local: `http://localhost:3000`
- **URL producción (Railway): `https://dashboard-despachos-production.up.railway.app`** ⚠️ ACTUAL desde jun 2026
  - Render (`dashboard-despachos.onrender.com`) fue la producción anterior — ya NO aplicar cambios ahí.
- Entrada principal: `/historial.html` (la raíz `/` redirige automáticamente)
- El servidor sirve desde **la raíz** (no desde ningún worktree)
- Datos persistentes: disco montado vía env var `DATA_DIR`
- Datos en local: carpeta `data-local/` (se pasa `DATA_DIR=...data-local` al correr)
- **Deploy a Railway**: vía CLI desde la raíz del proyecto (NO desde GitHub):
  `railway up --service dashboard-despachos --detach` (ver `RAILWAY.md`; CLI en `C:\Users\Gabriel Ramirez\AppData\Roaming\npm\railway.cmd`).
  GitHub (`dev`→`master`→push) es respaldo del código, NO dispara deploys. ⚠️ Commitear SIEMPRE antes de deployar para que el repo no quede detrás de producción.
  Verificar tras deploy: `/api/health` y `/historial.html` en la URL de Railway.

## Convenciones de código

- **Lucide icons**: `<script src="/lucide.min.js"></script>` — nunca CDN
- Después de inyectar `data-lucide` via innerHTML: `if(window.lucide) lucide.createIcons();`
- **Colores**: variables CSS semánticas (`--green-bg`, `--amber-text`, etc.), nunca hex hardcodeados
- **Tema**: clave localStorage `wwp_theme`, atributo `data-theme` en `<html>`

## Agentes — cerebro canónico fuera del proyecto

Los agentes (Mark, Pit, Ron, David, QA-WWP, Alpha) **no guardan conocimiento en este proyecto**.
Su cerebro único, compartido entre Claude y Codex, vive en:

```
C:\Users\Gabriel Ramirez\OneDrive\Documentos\Agentes-Estandar\
```

Antes de actuar como un agente, leer su expediente `<agente>.md` + `_NUCLEO-CARACTER.md` +
`_PERFIL-GABRIEL.md` y su sección **"No repetir"**. Al terminar, escribir los aprendizajes de
vuelta ahí, nunca en el proyecto. Ver `Agentes-Estandar\README.md`. Los subagentes de Claude
(`~/.claude/agents/<agente>.md`) ya apuntan a esa carpeta.

- **Mark** — CSS/UI, QA funcional, UX, diseño visual; decisión explícita de salida a producción.
- **Pit** — gerente de operaciones (WWP en vivo, cuellos de botella, KPIs, Odoo).
- **Ron** — analista Odoo/ERP (inventario, picks, devoluciones, trazabilidad).
- **David** — administración de edificios.
- **QA-WWP** — auditor de calidad (end-to-end, RBAC, gates HTTP, TDZ).

## Codex Bridge — reuniones desde este chat

La plataforma expone endpoints seguros para que Codex pueda consultar datos vivos y hacer el análisis en este chat, sin usar créditos OpenAI API dentro de Railway.

- Requiere `CODEX_BRIDGE_TOKEN` en Railway.
- Enviar el token por `Authorization: Bearer <token>` o header `x-codex-bridge-token`.
- Endpoints:
  - `GET /api/codex/agents/context` — contexto completo para reunión: resumen, decisiones, personas, tareas, memoria.
  - `GET /api/codex/agents/tasks?overdue=true&active=true` — tareas filtrables para análisis.
  - `GET /api/codex/agents/export/tasks.csv` — CSV descargable de tareas filtradas.
- Estos endpoints no llaman IA. Codex interpreta los datos y genera respuestas, gráficos o archivos desde el chat.

> Nota: el roster y el protocolo de invocación de agentes ahora viven en el cerebro canónico
> (`C:\Users\Gabriel Ramirez\OneDrive\Documentos\Agentes-Estandar\`) y en la guía global, no duplicados aquí.
