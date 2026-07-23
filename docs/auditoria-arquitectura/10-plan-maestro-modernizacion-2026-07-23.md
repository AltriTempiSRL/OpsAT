# Plan maestro de modernización — hacerlo correctamente

> **Fecha:** 2026-07-23 · **Insumos:** auditoría integral 09 (132 hallazgos verificados,
> plan de remediación §8), plan de modularización 08 (en ejecución, Olas 0–3 hechas),
> y la pregunta de Filippo: *"¿este diseño es correcto? Si vamos a hacer algo bien, hay
> que hacerlo ahora que estamos empezando — los datos son casi de prueba"*.
> Este doc responde esa pregunta y consolida TODO en un solo plan ejecutable.

---

## 0. Veredicto honesto: ¿está bien diseñado? ¿reescribimos?

**Cómo nació:** sin arquitecto. Gabriel no es técnico; el sistema se acumuló por parches
de agentes de IA sobre un artifact inicial. Ninguna propiedad del diseño actual merece
respeto *por ser el diseño* — cada una se juzga por sus méritos hoy.

**Qué encontró el juicio por méritos** (41 agentes de auditoría, doc 09): la **forma
global resultó correcta para este contexto** — monolito modular sin build, un proceso,
Postgres + R2, 4 dependencias, librerías vendorizadas para las Zebra, islas en
progreso. No por genialidad, sino porque la presión de uso diario (~30 usuarios) fue
puliendo lo que dolía. Lo **objetivamente roto no es el código: es la operación
alrededor** — respaldo apuntando a un dominio muerto, cero CI, deploy irreproducible
desde una laptop personal, WebSocket sin auth, fotos públicas, credenciales semilla
válidas, restauración jamás ensayada.

**¿Reescribir desde cero ("ahora que empezamos")? NO. Razones concretas:**

1. **El activo no son los datos — son las reglas.** Los ~238 endpoints codifican meses
   de aprendizaje operativo (la FSM de SDV, los gates de picking contra Odoo, el
   watchdog de negativos, el checklist de 3 fotos, los fail-open auditados). Esas
   reglas NO existen en ningún documento: solo en este código. Una reescritura tendría
   que extraerlas de aquí de todas formas — o perderlas y redescubrirlas a golpes en
   la bodega.
2. **El equipo es no-técnico + agentes de IA.** Un rewrite significa mantener DOS
   sistemas (el viejo en producción + el nuevo a medias) sin nadie que pueda arbitrar
   técnicamente entre ambos. Es la receta clásica de proyecto muerto.
3. **"Datos desechables" abarata la capa de DATOS, no la reescritura** — y la capa de
   datos ya se modernizó (24 tablas tipadas, Fase 3B). Lo que sí abarata se aprovecha
   en la Fase 2 de este plan.
4. Si empezáramos de cero HOY con juicio profesional, elegiríamos… básicamente esta
   misma forma (Node + PG + R2, sin framework SPA, sin microservicios) pero **bien
   organizada y bien operada desde el día 1**. Ese estado final es alcanzable por
   estrangulamiento desde lo que ya existe — sin apagar nada.

**La respuesta a "¿es la forma correcta de trabajar?" es: el código sí (con deudas
listadas), la FORMA DE TRABAJAR no.** Lo que se moderniza con más urgencia es el
proceso: CI, deploy reproducible, respaldos probados, seguridad de superficie, y
reglas que no dependan de la memoria de nadie.

---

## 1. Decisiones que abren caminos (dueño: Gabriel + Filippo)

| # | Decisión | Recomendación | Qué desbloquea |
|---|---|---|---|
| D1 | **¿Los datos actuales son de verdad desechables?** ⚠ La auditoría describe uso real diario y fotos que son *evidencia legal de entregas* — confirmar POR COLECCIÓN qué se puede resetear | Tratar FOTOS DE EVIDENCIA e inspecciones como NO desechables; tareas/notifs/audit/datos de prueba pueden resetearse si el negocio lo confirma por escrito | La "vía rápida" de la Fase 2 (esquema v2 por wipe en vez de migración) |
| D2 | **¿Purgar el historial de git?** (la API key de Odoo vive en commits viejos) | Sí, DESPUÉS de rotar la key (8.1 #4) y antes de compartir el repo con más gente | Repo compartible sin regalar el ERP |
| D3 | **¿Quién más puede deployar y restaurar?** | Filippo como segundo operador: credenciales Railway en custodia compartida + runbook probado por él | Elimina el bus factor 1 (PR-02) |
| D4 | **Render (producción fantasma)** | Apagar o dejar 302 a `opsat.up.railway.app` — nunca aceptando logins | Cierra el split-brain (8.1 #10) |
| D5 | **¿Multi-instancia algún día?** | NO por diseño (30 usuarios); sellarlo con advisory lock (8.1 #9) | Cierra B5 con dueño y fecha |
| D6 | **¿Build step / TypeScript / framework?** | NO ahora (Zebra + equipo no-técnico + costo de migración > beneficio a esta escala). Re-evaluar cuando shell < 20k líneas Y proxy modular Y haya un segundo dev humano | Evita el error clásico de "modernizar" la parte que funciona |

---

## 2. La constitución — reglas permanentes de trabajo

Como el creador no es técnico, **las buenas prácticas no pueden vivir en su memoria:
tienen que vivir en el sistema** (CI que bloquea, scripts que rehúsan, tests que
fallan). Estas 10 reglas aplican a todo trabajo futuro, humano o de agente:

1. **Nada llega a master sin CI verde** (e2e + `node --check` + harnesses). El CI es
   el arquitecto suplente: bloquea aunque nadie recuerde por qué.
2. **Todo deploy = árbol limpio + suite verde + tag git** (`scripts/deploy.mjs` lo
   exige por código). Rollback = redeploy del tag anterior. Nunca `railway up` a mano.
3. **Ningún archivo monolítico crece más**: toda ruta, función o sección NUEVA nace en
   módulo/isla propia. Los monolitos solo pueden encoger.
4. **Extraer = copiar → verificar → borrar**, con suite verde antes y después (regla
   de oro del plan 08; los 3 mordiscos de la Ola 3 son el porqué).
5. **Secretos solo en env/Railway.** Jamás en código, docs o historial; toda rotación
   se anota en MEMORIA con fecha.
6. **Toda decisión pendiente tiene dueño y fecha** en MEMORIA (hoy hay ~5 flotando).
7. **Una sesión de agente por dominio de archivos a la vez** (o worktrees); commits
   tempranos y chicos. Las colisiones de hoy (dos sesiones en historial.html) costaron
   horas de arqueología.
8. **Cada incidente deja un test** que lo habría atrapado (ya es cultura: `</div>`
   huérfano → chequeo de balance; seguirla).
9. **Los espejos manuales se estampan con script** (`stamp.mjs`: hashes `?v=`,
   APP_BUILD ×2, CACHE del SW) — nunca de memoria.
10. **Lo que no está en el repo o en MEMORIA no existe.** El conocimiento crítico del
    sistema sale del OneDrive personal hacia el repo/custodia compartida.

---

## 3. Fases

### Fase 0 — Parar el sangrado (esta semana; casi todo esfuerzo BAJO)
Es el paquete 8.1 de la auditoría, tal cual — 11 ítems, en orden de dolor:
cerrar el WebSocket (API-01, P0) · respaldo 2.0 urgente + verificar la última corrida
(INF-01/02, DB-02/03) · drill de restauración (DB-04) · rotar la API key de Odoo
(SEC-01) · allowlist de estáticos (ARQ-03) · sacar la PII "mock" del HTML público ·
`WWP_FORCE_PW_CHANGE=1` + mínimo 8 y semillas rechazadas (OW-01) · **CI mínimo en
GitHub Actions (QA-02)** · advisory lock (INF-04) · decidir Render (D4) · micro-fixes
de robustez (catch-all 500, readBody con Buffer, health honesto de Odoo).

**Meta de la semana:** ningún dato de negocio accesible sin sesión; respaldo corriendo
verificado; CI bloqueando; segunda persona pudo deployar siguiendo el runbook.

### Fase 1 — Entrega reproducible y calidad (semanas 1–2)
`scripts/deploy.mjs` (limpio+verde+tag+up, ejecutable por terceros) · `stamp.mjs` ·
**sesión de 1 hora con ustedes para nombrar los 3–5 flujos críticos** y convertir los
`test.fixme` en tests reales (QA-01 — prerrequisito declarado de la Ola 4) · suite en
modo PG+tipadas dentro del CI (QA-03) · RUNBOOK.md único de incidentes (INF-06) ·
branch protection + flujo de PR adaptado a agentes (regla 7).

### Fase 2 — Datos correctos de una vez (semanas 2–4 — LA ventana "datos de prueba")
Aquí es donde tu premisa vale oro, **si D1 se confirma**:
- **Esquema v2 con integridad declarativa** (adelanta el ítem 25 de 3–6 meses a ahora):
  UNIQUE en ids naturales, FKs entre entidades núcleo (tasks↔subtasks↔sdv), CHECK de
  estados de las FSM, índices según consultas reales. Con datos desechables esto es
  *crear tablas bien y re-sembrar*, no migrar — 10× más barato que después.
- **Retiro anticipado del dual-write** (ítem 24): paridad monitoreada 2 semanas → se
  apaga el espejo `collection_rows`; el export JSON horario queda como única red.
- **Fix del rollback tipadas** (ítem 15) ANTES del retiro — el kill-switch debe ser
  confiable mientras exista.
- Retención formal (notifs/audit/GPS) decidida por Gabriel · semillas de usuarios
  nuevas (post OW-01) · purga del historial git (D2) · R2 versioning ON.
- Si D1 = "no son desechables": mismo destino, vía migraciones, en la cadencia
  original de la auditoría (3–6 meses). El plan no cambia — cambia el costo.

### Fase 3 — Backend estrangulado (continuo, 1–3 meses)
El mismo patrón que ya funcionó dos veces (WWP_TYPED, islas), aplicado a proxy.js:
**router-tabla + módulos por dominio** (ítem 23; toda ruta nueva se registra, no se
encadena — regla 3) · cliente Odoo con breaker/retry y timeout de gates 8–10 s (ítem
13 — con Odoo caído, mutación < 10 s y admins avisados) · gate post-body para uploads
(ítem 18) · idempotencia + precondición `updatedAt` (ítem 20) · FSM de tareas
server-side (ítem 26) · cerrar los lazos con Odoo que hoy son memoria humana (ítem 27:
bandeja de rechazos, consumo de `out_gate_fail_open`, recepción tránsito→CDP).

### Fase 4 — Frontend por olas (continuo — el plan 08 sigue tal cual)
Olas 4–5: reordenar clusters `eo*`/`sdv*`, extraer secciones medianas, luego
inventario/despacho-obsoleto/trilogía SDV, tasks al final (ítem 22). Meta: shell
< 20k líneas a fin de año, ningún archivo propio > 5k al cierre (ítem 30). En el
camino: sweep de `innerHTML`/escape, y CSP sin `unsafe-inline` como cierre (requiere
haber sacado los ~772 onclick inline — es consecuencia de las olas, no un proyecto
aparte).

### Fase 5 — Operación madura (3–12 meses)
Respaldo en infra neutral, fuera de la laptop (ítem 21) · observabilidad proporcional:
request-id, logs JSON, error tracking ligero, KPIs del go-live (ítem 31) · MFA para
admin/manager (ítem 32) · paginación y purga en listados grandes (ítem 28) · offline
para la calle con Background Sync (ítem 29, depende de idempotencia) · prueba de carga
y presupuesto de RAM a 10× (ítem 33) · gobierno: matriz de flags y custodia (ítem 34).

---

## 4. Qué NO haremos (anti-lista, con porqué)

- **React/Vue/Svelte + bundler + TypeScript**: costo de migración de ~1.800 funciones
  y una cadena de build que el equipo no puede depurar, para beneficio marginal a esta
  escala. Las Zebra agradecen archivos planos. (Re-evaluable vía D6.)
- **Express/Fastify**: con 4 deps de runtime y el router-tabla casero, un framework
  solo agrega superficie de dependencias.
- **Microservicios / Kubernetes / APM distribuido / staging permanente**: costo
  operativo que un equipo de 1+agentes no puede pagar; confirmado "no aplica" por el
  crítico de completitud de la auditoría.
- **ORM**: las 24 tablas tipadas + SQL parametrizado ya dan lo que se necesita.
- **Reescritura big-bang**: ver §0.

## 5. Métricas de éxito (90 días)

1. CI verde obligatorio en master; 0 deploys sin tag.
2. Respaldo con cobertura total + drill de restauración ejecutado por Filippo.
3. 0 bytes de negocio por WS/fotos/HTML sin sesión; 0 credenciales semilla válidas;
   key de Odoo rotada.
4. Flujos críticos e2e en verde en CI (incluido modo PG+tipadas).
5. Esquema v2 con FKs/UNIQUE/CHECK activo; dual-write retirado con fecha anotada.
6. historial.html < 28k líneas (Ola 4 en curso); toda ruta backend nueva en módulo.
7. Runbook probado por una segunda persona; 0 decisiones pendientes sin dueño y fecha.

## 6. Nota final sobre la premisa "nada tiene un porqué"

Matiz importante: el repo SÍ tiene porqués — MEMORIA-PROYECTO, comentarios fechados,
12 docs de auditoría; la auditoría integral lo llama "documentación de decisiones
excepcional para un equipo de 1". Lo que faltó nunca fue registro: fue **una forma
global elegida a propósito y una operación a la altura del código**. Eso es
exactamente lo que este plan instala — sin tirar los meses de aprendizaje operativo
que ya están pagados y funcionando en producción.

> Fuentes: [09-auditoria-integral](09-auditoria-integral-2026-07-23.md) (hallazgos y
> plan §8 completo, IDs citados aquí) · [09-anexo](09-anexo-hallazgos-2026-07-23.md)
> (los 132 hallazgos con evidencia archivo:línea) · [08-plan-modularizacion](08-plan-modularizacion.md)
> (el carril frontend, Olas 0–3 hechas).
