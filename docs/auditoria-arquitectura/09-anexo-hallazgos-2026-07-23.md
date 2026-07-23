# Anexo — Hallazgos en detalle · Auditoría integral OpsAT · 2026-07-23

> 132 hallazgos vigentes tras verificación adversarial (cada P0/P1 fue atacado por un
> agente escéptico independiente contra el código actual; se indica su veredicto).
> Nota de formato: el campo "Diferencia frente al estándar" del template está integrado en
> "Práctica estándar" + "Problema" cuando el auditor lo redactó de forma combinada.
> Informe principal: `09-auditoria-integral-2026-07-23.md`.


---

# Área A/B — Arquitectura general y organización del código

**Resumen del área:** OpsAT es un monolito cliente-servidor de dos procesos sin framework ni build (historial.html 34.662 líneas + proxy.js 20.964 líneas), en transición activa y bien ejecutada hacia un "monolito modular por islas": core.js (2.508 líneas) + theme.css versionados por hash, 5 islas iframe con core-isla.js compartido, y un backend que ya extrajo módulos reales (storage-pg.js, typed-schemas.js, write-queue.js, media.js) en un grafo de dependencias limpio sin ciclos. Para su contexto real —1 desarrollador, ~30 usuarios, operación física crítica— la arquitectura es ADECUADA: prioriza velocidad de iteración y resiliencia operativa, y la deuda estructural está identificada, documentada y siendo pagada de forma incremental con red de seguridad e2e (80 tests Playwright) antes y después de cada extracción. Los problemas reales del área son: dos módulos de servidor nuevos quedaron descargables en producción (regresión del patrón R-03 por denylist manual), sincronización a mano de espejos multi-archivo (APP_BUILD ×2, CACHE del SW, NOTIF_META ×3, hashes ?v= por isla), código vestigial de la remoción de Google Sheets que sigue ejecutándose en cada boot con mocks embebidos de apariencia real, duplicación masiva de patrones en proxy.js (752 Content-Type inline vs 69 usos del helper), y un proceso de versionamiento frágil (sin tags git, rama dev documentada pero inexistente, deploy manual desde árboles de trabajo compartidos por sesiones paralelas). Nada de esto exige reescritura: el plan 08 ya en marcha es el vehículo correcto; falta un carril equivalente (más liviano) para proxy.js y automatizar el estampado de versiones.

**Madurez:** 3.5/5 — Nota 3.5/5. Lo que suma: la arquitectura es deliberada y adecuada al contexto (1 dev, ~30 usuarios, operación crítica) — sin sobre-ingeniería ni infraestructura accidental; la transición a monolito modular está en ejecución real con método (red e2e primero, extracción incremental, lecciones convertidas en checklist, disciplina de hashes verificada hoy al 100%); el backend ya tiene módulos genuinos con grafo limpio; la gestión de dependencias es ejemplar (4 deps, lock, vendoring justificado); y la documentación de decisiones está por encima del estándar de equipos mucho más grandes. Lo que resta: el ~85% del monolito frontend y el 100% del routing backend siguen en dos archivos gigantes con scope global sloppy-mode como contrato; la coherencia del sistema depende de espejos sincronizados a mano y de disciplina humana (mitigada solo por tests); el proceso de release es artesanal (sin tags, deploy desde árbol vivo, sesiones paralelas en el mismo árbol) y ya ha causado incidentes; y aparecen regresiones del patrón denylist (módulos nuevos descargables) que muestran que las correcciones previas no siempre quedan blindadas estructuralmente. No es un 4 porque el grueso de la deuda estructural aún no se paga y el release sigue dependiendo de memoria humana; no es un 3 porque la dirección, el método y la velocidad de saneamiento son demostrablemente correctos.

## Fortalezas verificadas

- La tesis arquitectónica es coherente y ganadora para su contexto: cero frameworks, cero build, cambios end-to-end en minutos para 1 dev con ~30 usuarios; el sistema está en producción real y en uso diario (864 commits en ~3 meses desde 2026-05-01).
- El plan de modularización (docs/auditoria-arquitectura/08) no es papel: Olas 0-3 ejecutadas y verificadas HOY en el código — core.js:1-17 (cabecera con reglas explícitas), 4 islas iframe lazy (historial.html:6070,7707,7714,7770), core-isla.js:1-16, y suite e2e de 80 tests como prerrequisito duro antes de extraer (regla 'suite verde antes y después').
- Disciplina de cache-busting verificada: md5-8 real de core.js (77118dd8), theme.css (f232ab1b), core-isla.js (f7b1b597) y ui-isla.css (0135f0d7) coinciden EXACTAMENTE con los ?v= estampados en el shell y en las 4 islas; el contrato lo vigila tests/e2e/smoke-05-core.spec.js.
- Backend con módulos reales y grafo de dependencias limpio (sin ciclos): boot.js→storage-pg.js→typed-schemas.js; proxy.js→storage-pg/media/write-queue (proxy.js:48-51). typed-schemas.js se generó desde los datos reales de producción con receta de regeneración documentada (typed-schemas.js:1-16).
- Gestión de dependencias sana: solo 4 deps npm de runtime (package.json:22-27), node_modules NO commiteado (git ls-files: 0), package-lock.json presente, librerías vendorizadas con versión identificable (lucide 0.469.0, Chart.js 4.5.0, xlsx 1.15.0) — correcto para PWA en terminales Zebra sin CDN.
- Documentación de decisiones excepcional para un equipo de 1: MEMORIA-PROYECTO.md (263 líneas, decisiones fechadas con lecciones), CLAUDE.md operativo, 12 docs en docs/auditoria-arquitectura/, _archivo/README.md justifica cada carpeta archivada, y comentarios en código con contexto histórico (proxy.js:20-28).
- La auditoría de julio SE EJECUTÓ: re-verifiqué que R-01 (silentCatch definida en proxy.js:25), R-12 (0 hits de loadAllReports/toggleGuidedMode/_EO_MOCK/renderDevoluciones/tmCargar), R-15 (.gitignore por globs de familias), R-16B (SDK Anthropic fuera de package.json), R-17 (wwp.html y sync-from-prod.js fuera de la raíz) están corregidos en el código actual.
- Convención de commits estable y legible (feat/fix/docs/chore/test en español con cuerpos ricos: 115 feat, 63 fix en los últimos 200) y raíz del proyecto saneada por el reorg de _archivo/ (jul-08): lo huérfano se movió con inventario, no se borró.

## Hallazgo ARQ-01: Proceso de versionamiento frágil: sin tags git, rama 'dev' documentada pero inexistente, deploy manual desde árboles de trabajo vivos compartidos por sesiones paralelas

**Área:** A/B — Arquitectura general y organización del código

**Severidad:** Alta

**Estado:** Confirmado

**Componente afectado:** Proceso git/deploy (CLAUDE.md, railway up)

**Evidencia encontrada:** git tag → vacío pese a builds v113…v228; git branch -a → solo master (CLAUDE.md:46 dice 'GitHub (dev→master→push)'); CLAUDE.md:6 declara fuente de verdad una carpeta OneDrive de Windows mientras esta auditoría corre en un clon Mac; durante la auditoría apareció empaque.html sin commitear de otra sesión activa (git status en vivo).

**Situación actual:** El versionado real es APP_BUILD manual (v228) en el código; git es 'respaldo', no fuente del deploy.

**Problema:** La trazabilidad build→commit depende solo de mensajes de commit; el deploy es 'railway up' desde el working tree (lo que esté en disco, commiteado o no), con dos máquinas y varias sesiones IA editando en paralelo el MISMO árbol. El riesgo ya se materializó (absorción de cambios entre sesiones; el propio CLAUDE.md:46 advierte '⚠️ Commitear SIEMPRE antes de deployar').

**Práctica estándar de la industria:** Un tag por release y deploy solo desde árbol limpio; una rama o worktree por línea de trabajo.

**Riesgo técnico:** Producción no reproducible desde el repo; imposible bisecar regresiones por build; pérdida silenciosa de trabajo entre sesiones.

**Riesgo para el negocio:** Un deploy con trabajo a medias de otra sesión puede tumbar la operación de bodega; el rollback a un build anterior es adivinanza.

**Causa raíz probable:** El flujo nació de un solo dev en una sola máquina; hoy hay 2 máquinas + N sesiones IA y el proceso no se actualizó.

**Recomendación:** Tag git anotado en cada deploy + script de deploy que rechace árbol sucio; sesiones paralelas siempre en worktrees separados (precedente ya existe en .claude/worktrees); corregir o materializar la rama dev de CLAUDE.md.

**Solución inmediata:** git tag vNNN && git push --tags en cada deploy; verificar git status limpio antes de railway up.

**Solución definitiva:** scripts/deploy.mjs único: verifica árbol limpio → estampa hashes → bumpea APP_BUILD/CACHE → commit → tag → railway up.

**Esfuerzo estimado:** Bajo

**Prioridad:** P1

**Dependencias:** Sinergia con el hallazgo de espejos manuales (el mismo script resuelve ambos).

**Criterio de aceptación:** Cada build vNNN en producción resoluble a un commit exacto vía tag; cero deploys con árbol sucio en un mes.

**Cómo validar la corrección:** git tag --list y comparar el build de /api/app-version en prod contra el tag.

**Verificación adversarial (CONFIRMADO):** Toda la evidencia se reproduce hoy: cero tags locales y remotos (git tag y git ls-remote --tags vacíos) pese a APP_BUILD='v228' manual en proxy.js:291; solo existe master (la rama 'dev' de CLAUDE.md:46 no existe); no hay script de deploy con guardia de árbol limpio ni hooks git (scripts/ solo tiene backup y migración; .git/hooks vacío) — la única mitigación es disciplina documentada en CLAUDE.md:46 y prompt-fase3-continuar.md:24, sin enforcement. El riesgo se materializó EN VIVO durante esta verificación: una sesión paralela commiteó v228 (5275c3a) en el mismo árbol mientras corría la auditoría y ahora hay empaque.html + 5 archivos modificados sin commitear de otra sesión. Severidad Alta/P1 proporcionada para una operación de bodega en producción cuyo deploy sube lo que esté en disco. · Evidencia re-vista: git tag --list → vacío; git ls-remote --tags origin → vacío; git branch -a → solo master + claude/serene-jones-0438b2 (sin dev); CLAUDE.md:6 (ruta OneDrive Windows como fuente de verdad), CLAUDE.md:46 ('dev'→'master' inexistente + advertencia ⚠️); proxy.js:291 (APP_BUILD='v228' manual); git status --porcelain → ?? empaque.html + M historial.html/MEMORIA-PROYECTO.md/otros de sesión paralela; scripts/ sin deploy.mjs; .git/hooks sin hooks activos; docs/auditoria-arquitectura/prompt-fase3-continuar.md:24 (protocolo manual anti-deploy-sucio, sin enforcement)


## Hallazgo ARQ-02: Datos personales de apariencia real (clientes, teléfonos, direcciones) embebidos como 'mock' en el HTML servido sin autenticación

**Área:** A/B — Arquitectura general y organización del código

**Severidad:** Alta

**Estado:** Confirmado

**Componente afectado:** historial.html (bloque DATOS MOCK)

**Evidencia encontrada:** historial.html:18420-18685 ('DATOS MOCK'): var SP={'8949':{cliente:'Lissette Polanco',vendedor:'Daniela Castillo',…,lugar:'Av. Anacaona Torre Logroval XVIII Apt 9B',telefono:'(809) 224-0409',…}} — nombres completos, teléfono y dirección de entrega con nº de orden; historial.html se sirve como estático sin auth (el login es client-side).

**Situación actual:** El bloque quedó como fallback del timeline tras retirar Sheets.

**Problema:** Si estos registros provienen de órdenes reales (el formato, los SKUs 'DB.LIORA.CONS…' y los números de orden lo sugieren), hay PII de clientes descargable por cualquiera que haga GET /historial.html en producción, sin login. Si son inventados, el hallazgo baja a higiene.

**Práctica estándar de la industria:** Los mocks embebidos en assets públicos se generan sintéticos, nunca copiando producción.

**Riesgo para el negocio:** Exposición de nombre + dirección de casa + teléfono de clientes en un mercado pequeño donde son identificables; riesgo reputacional/legal.

**Causa raíz probable:** Mocks creados copiando casos reales durante el prototipo original en Artifacts.

**Recomendación:** Validar con Gabriel/Odoo si SP/GS/OD son clientes reales; si lo son, anonimizar o eliminar el bloque en el próximo deploy (misma zona de código que la limpieza de Sheets).

**Solución inmediata:** Confirmar naturaleza de los datos; anonimizar si son reales.

**Solución definitiva:** Eliminar el bloque junto con la limpieza del hallazgo Sheets.

**Esfuerzo estimado:** Bajo

**Prioridad:** P1

**Dependencias:** Hallazgo 'Código vestigial Sheets'.

**Criterio de aceptación:** grep de los nombres/teléfonos actuales en historial.html = 0 hits en producción.

**Cómo validar la corrección:** Contrastar la orden '8949' y los nombres contra Odoo (res.partner / sale.order).

**Verificación adversarial (CONFIRMADO):** El bloque DATOS MOCK sigue vivo y sin mitigar: los datos citados existen verbatim (solo drift de ~180 líneas respecto al hallazgo) y se usan activamente como fallback en buscarDirecta ('Sheets live tiene prioridad; GS mock como fallback'). historial.html se sirve estático sin auth (el _FORBIDDEN de proxy.js protege JSONs y fuente del servidor, no el HTML). Indicio fuerte de datos reales: el mismo bloque contiene órdenes de prueba explícitamente sintéticas ('PRUEBA Cliente A/B/C', teléfonos 809-555-000x) que contrastan con los registros cuestionados (teléfonos RD en formatos mixtos, direcciones completas de torre/apto, 'Altri Tempi' como lugar y personal real como Daniela Castillo/Melvin Grullon), lo que sugiere copia de casos reales, no invención. Severidad Alta/P1 se sostiene: PII de clientes descargable públicamente con esfuerzo de fix bajo; no hay decisión documentada que lo justifique. · Evidencia re-vista: historial.html:18239 ('DATOS MOCK'), 18243-18285 (var SP con '8949': Lissette Polanco / (809) 224-0409 / Av. Anacaona Torre Logroval XVIII Apt 9B), 18288 (var GS), 18308 (var OD), 21825-21828 (uso como fallback vivo en buscarDirecta); proxy.js:20620-20666 (serving estático sin auth; historial.html ausente de _FORBIDDEN)


## Hallazgo ARQ-03: Módulos de servidor nuevos (write-queue.js, typed-schemas.js) descargables desde producción — regresión del patrón R-03 por denylist manual

**Área:** A/B — Arquitectura general y organización del código

**Severidad:** Media

**Estado:** Confirmado

**Componente afectado:** proxy.js (servido de estáticos)

**Evidencia encontrada:** proxy.js:20649-20658: _FORBIDDEN incluye 'proxy.js','boot.js','storage-pg.js','sync-from-prod.js','media.js' pero NO 'write-queue.js' ni 'typed-schemas.js' (ambos existen en la raíz, creados 22-jul); proxy.js:20660 _ALLOWED_EXT incluye '.js'. El propio comentario en :20667-20669 lo admite: 'La denylist por nombre exacto se desincronizaba al aparecer archivos nuevos'.

**Situación actual:** La denylist se mantiene a mano; cada módulo de servidor nuevo nace servible por defecto. Además referencia 'sync-from-prod.js' que ya no existe (drift inverso).

**Problema:** GET /typed-schemas.js y GET /write-queue.js se sirven como estáticos en producción: typed-schemas.js expone el esquema completo (columnas y tipos) de las 24 tablas tipadas del negocio. No hay secretos, pero es divulgación de fuente e inteligencia de la BD que la auditoría previa (R-03) ya había decidido bloquear para los demás módulos.

**Práctica estándar de la industria:** Servir estáticos desde una allowlist o desde un directorio public/ separado del código de servidor.

**Riesgo técnico:** Divulgación del código y del modelo de datos; cada refactor futuro que extraiga un módulo repetirá la regresión.

**Riesgo para el negocio:** Facilita reconocimiento a un atacante (nombres de tablas/columnas de tareas, usuarios, sesiones, auditoría).

**Causa raíz probable:** Patrón denylist manual sobre una raíz que mezcla código de servidor, código de cliente y assets.

**Recomendación:** Hoy: añadir ambos archivos a _FORBIDDEN (2 líneas). Definitivo: invertir a allowlist de estáticos servibles (o denegar automáticamente todo archivo que proxy.js requiere()), para que los módulos futuros nazcan protegidos.

**Solución inmediata:** Añadir 'write-queue.js' y 'typed-schemas.js' a _FORBIDDEN.

**Solución definitiva:** Allowlist explícita de .js servibles (core.js, core-isla.js, sw.js, libs vendorizadas) y denegar el resto.

**Esfuerzo estimado:** Bajo

**Prioridad:** P1

**Dependencias:** Ninguna.

**Criterio de aceptación:** curl a /typed-schemas.js y /write-queue.js en prod devuelve 403; caso nuevo en la suite e2e de denylist.

**Cómo validar la corrección:** curl -sI en producción; test smoke-01 ampliado.

**Verificación adversarial (PARCIAL):** El hallazgo es factualmente exacto y está reproducido en producción: ambos módulos de servidor se descargan con HTTP 200 mientras proxy.js devuelve 403, confirmando que es una regresión del control R-03 y no ausencia de control; no existe ninguna mitigación en el código ni cobertura e2e. El único ajuste es la severidad: es divulgación de fuente y de esquema de BD sin secretos ni PII, con los endpoints de datos aún tras Bearer auth, en un sistema interno de ~30 usuarios — eso es Media, no Alta. Mantengo P1 porque es una regresión viva de un control ya aceptado, el fix inmediato son 2 líneas, y la causa raíz (denylist manual) garantiza reincidencia con cada módulo futuro si no se invierte a allowlist. · Evidencia re-vista: proxy.js:20649-20658 (_FORBIDDEN sin 'write-queue.js' ni 'typed-schemas.js', y con 'sync-from-prod.js' que ya no existe en la raíz); proxy.js:20659-20663 ('.js' en _ALLOWED_EXT); proxy.js:20666-20669 (comentario que admite la desincronización de la denylist); proxy.js:48 require('./write-queue.js'); storage-pg.js:49 require('./typed-schemas.js'); typed-schemas.js:18+ (esquema completo columnas/tipos de las tablas de negocio). Reproducido en vivo (22-jul-2026): HTTP 200 en https://opsat.up.railway.app/typed-schemas.js y /write-queue.js; HTTP 403 en /proxy.js. tests/e2e/smoke-01-server.spec.js:63-68 solo cubre wwp-users-auth.json y .jwt-secret.


## Hallazgo ARQ-04: Espejos sincronizados a mano en 4+ archivos: APP_BUILD ×2, versión de caché del SW, NOTIF_META ×3 y hashes ?v= por isla

**Área:** A/B — Arquitectura general y organización del código

**Severidad:** Media

**Estado:** Confirmado

**Componente afectado:** historial.html / proxy.js / sw.js / core.js / islas

**Evidencia encontrada:** historial.html:8497 (var APP_BUILD='v228') debe coincidir con proxy.js:291 (const APP_BUILD='v228'); sw.js:2 (CACHE='wwp-v59') se bumpea aparte; proxy.js:5612 comentario literal: 'ESPEJOS (mantener en sincronía, igual que APP_BUILD): historial.html: _NOTIF_META · sw.js: NOTIF_URGENCY' (el espejo cliente vive hoy en core.js:984); CLAUDE.md:51 y core-isla.js:12-14 exigen re-estampar ?v= a mano en el shell Y en todas las islas.

**Situación actual:** La mitigación actual es documentación + smoke-05/smoke-07; no hay herramienta que estampe.

**Problema:** Cada cambio transversal exige tocar 3-5 archivos en sincronía manual. Hoy todo está coherente (verifiqué hashes y builds), pero es disciplina humana + un test; el costo crece con cada isla nueva (van 5, el plan contempla ~20 módulos) y un descuido deja clientes con caché stale de 1 año (immutable) o notificaciones sin urgencia correcta.

**Práctica estándar de la industria:** Un solo comando de 'stamp/release' que derive todos los valores (un bundler lo daría gratis; aquí basta un script de 30 líneas).

**Riesgo técnico:** Deriva de espejos = bugs de caché irreproducibles en dev (el SW sirve stale-while-revalidate).

**Riesgo para el negocio:** Terminales de bodega ejecutando lógica vieja tras un deploy (hay precedente de síntomas que llegaron a prod dentro de v226).

**Causa raíz probable:** El versionado por hash se adoptó sin automatizar el estampado; los espejos NOTIF crecieron orgánicamente.

**Recomendación:** Automatizar el estampado: un script único (scripts/stamp.mjs) que recalcule los md5-8, reescriba los ?v= en shell+islas y bumpee APP_BUILD (×2) y CACHE del SW; integrarlo al script de deploy. Añadir un test que falle si _NOTIF_META (core.js) y NOTIF_META (proxy.js) divergen en claves.

**Solución inmediata:** Test e2e de divergencia de claves NOTIF_META/_NOTIF_META.

**Solución definitiva:** scripts/stamp.mjs integrado al deploy.

**Esfuerzo estimado:** Bajo

**Prioridad:** P1

**Dependencias:** Hallazgo de proceso de deploy.

**Criterio de aceptación:** Editar core.js y correr un solo comando deja todos los archivos coherentes; smoke-05 verde.

**Cómo validar la corrección:** md5 -q de cada asset vs grep de sus ?v=; diff de claves entre los tres espejos NOTIF.

**Verificación adversarial (CONFIRMADO):** Toda la evidencia se reproduce hoy (con drift de líneas: APP_BUILD del cliente está en historial.html:8310, no 8497) y no existe fix: ningún scripts/stamp.mjs ni test de divergencia NOTIF. La mitigación es incluso más débil de lo declarado — smoke-05 solo valida el formato del ?v= y el header immutable, no que el hash coincida con el md5 real del archivo, y tests/e2e/helpers/islas.js:3 promete un "guard de coherencia de hash" que no existe en ninguna spec (además ese registro omite la isla nueva empaque.html: los espejos siguen creciendo, ya hay una 5ª isla y hasta las listas de islas en tests son otro mini-espejo). Atenuantes reales que el hallazgo ya reconoce implícitamente: getHtmlBuild (proxy.js:299-310) hace semi-autocurativo el espejo APP_BUILD ×2, y los espejos NOTIF son fallback-only (el server estampa cat/urg desde v140), pero el espejo crítico — ?v= con caché immutable 1 año + CACHE del SW — queda íntegro y solo protegido por disciplina manual. Severidad Media / P1 / esfuerzo Bajo es proporcionada para una operación crítica de bodega con precedente de síntomas en prod (v226); no es una decisión deliberada sino proceso manual documentado, tal como lo enmarca el hallazgo. · Evidencia re-vista: historial.html:8310 (var APP_BUILD='v228'); proxy.js:291 (const APP_BUILD='v228'); sw.js:2 (CACHE='wwp-v59'); proxy.js:5612-5613 (comentario ESPEJOS, aún apunta a historial.html cuando el espejo vive en core.js:984); core.js:981 (cita stale "proxy.js ~4453" vs real 5614); CLAUDE.md sección Convenciones; core-isla.js:12-14; tests/e2e/smoke-05-core.spec.js:36-43 (solo formato+immutable, sin comparación md5); tests/e2e/helpers/islas.js:3 (guard prometido inexistente); scripts/ sin stamp.mjs; 5 islas con core-isla.js?v=f7b1b597 (empaque/dev-cdp/formacion/impacto/politicas)


## Hallazgo ARQ-05: core.js no es un módulo: acoplamiento textual bidireccional con el shell vía globals implícitos en sloppy mode y dependencia de la posición exacta del <script>

**Área:** A/B — Arquitectura general y organización del código

**Severidad:** Media

**Estado:** Confirmado

**Componente afectado:** core.js / historial.html

**Evidencia encontrada:** core.js:539 asigna '_token = s.accessToken' sin declaración var/let en NINGÚN archivo (grep 'var _token' = 0 hits) — global implícito que exige sloppy mode (core.js:9-11: 'SIN use strict'); core.js llama funciones definidas después en el shell: switchTab (core.js:187-193), enterApp/landAfterAuth (core.js:544-559); historial.html:8500 carga core.js síncrono en la posición exacta del código original con prohibición de moverlo (core.js:12-14).

**Situación actual:** El plan 08 lo reconoce (ES modules = 'meta de largo plazo'). La lección ya mordió: un polStopRefresh residual en switchTab tumbó el boot de todos los deep-links /wwp/* (MEMORIA-PROYECTO, Olas 0-3).

**Problema:** La 'modularización' de la Ola 1 es una extracción textual: shell y core comparten un único scope global con contrato implícito (orden de ejecución + símbolos no declarados). Es deliberado, documentado y mitigado (smoke-05), pero deja dos minas: cualquier 'use strict' o conversión a module futura rompe en runtime, y un typo de asignación crea silenciosamente un global nuevo en vez de fallar.

**Práctica estándar de la industria:** Aunque se mantenga el scope compartido, los globals de contrato se declaran explícitamente y el contrato se lista en un manifiesto.

**Riesgo técnico:** ReferenceError/TypeError en runtime al refactorizar; lint inútil (no-undef inaplicable).

**Riesgo para el negocio:** Regresiones de login/sesión (el área que vive en core.js) en terminales de bodega.

**Causa raíz probable:** Herencia del monolito: el estado nació como globals implícitos y extraer sin re-declarar era el camino de menor riesgo inmediato.

**Recomendación:** Sin revertir nada: declarar explícitamente los ~10 globals de sesión/estado compartidos en un preámbulo de core.js (var _token=null; … — cero cambio semántico en sloppy mode) y escribir el manifiesto del contrato shell↔core (qué expone, qué exige), habilitando strict mode más adelante.

**Solución inmediata:** Preámbulo con declaraciones explícitas de _token/_user/_tasks/_refreshToken etc.

**Solución definitiva:** Objeto de estado único (window.WWP) tolerante a strict mode, migrado gradualmente.

**Esfuerzo estimado:** Medio

**Prioridad:** P2

**Dependencias:** Suite e2e (ya existe).

**Criterio de aceptación:** Toda asignación a globals compartidos tiene declaración; activar 'use strict' en un branch de prueba no lanza ReferenceError en el boot.

**Cómo validar la corrección:** Prueba local con 'use strict' temporal + suite e2e completa.


## Hallazgo ARQ-06: Duplicación masiva de patrones en proxy.js: 752 'Content-Type' inline y 767 res.writeHead frente a 69 usos del helper sendJson

**Área:** A/B — Arquitectura general y organización del código

**Severidad:** Media

**Estado:** Confirmado

**Componente afectado:** proxy.js

**Evidencia encontrada:** grep -c "Content-Type" proxy.js = 752 (la auditoría del 22-jul midió 715 — creció); grep -c 'res.writeHead(' = 767; sendJson existe (proxy.js:3414) pero solo 69 call-sites lo usan.

**Situación actual:** El helper correcto ya existe; el código nuevo (Codex Bridge, proxy.js:7880-7900) SÍ lo usa. Es deuda del código viejo.

**Problema:** Cada respuesta JSON se arma a mano en cientos de handlers. Un cambio transversal (un header nuevo, un formato de error) exige N réplicas — exactamente el mecanismo por el que se propagó el bug histórico R-01 (silentCatch copiado 73 veces sin definir). La tendencia es al alza, no a la baja.

**Práctica estándar de la industria:** Respuestas centralizadas en 2-3 helpers usados por el 100% de los handlers.

**Riesgo técnico:** Inconsistencia de headers entre endpoints; fixes transversales incompletos.

**Riesgo para el negocio:** Bajo directo; alto como multiplicador del costo de cada cambio de seguridad/headers.

**Causa raíz probable:** Copy-paste como modo de desarrollo pre-helpers; nunca se hizo el barrido de adopción.

**Recomendación:** Regla de código nuevo: toda respuesta vía sendJson (ya es de facto en el código reciente). Barrido mecánico por lotes de 100-200 call-sites convirtiendo writeHead+end a sendJson, con node --check y e2e verde por lote — trabajo ideal para sesión IA supervisada.

**Solución inmediata:** Formalizar la regla para código nuevo.

**Solución definitiva:** Barrido por lotes hasta dejar writeHead solo en casos especiales (SSE, streaming, gzip).

**Esfuerzo estimado:** Medio

**Prioridad:** P2

**Dependencias:** Suite e2e como red.

**Criterio de aceptación:** res.writeHead con literal application/json < 50 ocurrencias.

**Cómo validar la corrección:** grep -c antes/después; e2e completa verde.


## Hallazgo ARQ-07: Código vestigial de la remoción de Google Sheets (R-06D): el cliente sigue llamando /api/sheets (404 intencional) en cada arranque y cae a datos mock embebidos

**Área:** A/B — Arquitectura general y organización del código

**Severidad:** Media

**Estado:** Confirmado

**Componente afectado:** historial.html

**Evidencia encontrada:** historial.html:18361 define checkSheetsConnection y :18415 la LLAMA en DOMContentLoaded (fetch('/api/sheets') con 4 reintentos de 4s); proxy.js:8587: '/api/sheets — ELIMINADO… El 404 es intencional'; historial.html:18731: el timeline usa sources=[GS_CACHE,SP,GS,OD] con GS_CACHE ya siempre vacío → solo mocks; el comentario de remoción en :24429 solo cubrió el OTRO call-site.

**Situación actual:** La poda del servidor fue limpia y documentada; el cliente conservó el consumidor entero.

**Problema:** Cada boot de cada terminal dispara 5 fetches garantizados a 404 con retries y ruido de consola, el indicador 'Sheets' queda permanentemente en rojo, y la sección de historial de despachos opera de facto solo sobre los mocks SP/GS/OD hardcodeados (~260 líneas). La remoción R-06D quedó incompleta del lado cliente.

**Práctica estándar de la industria:** Remover una integración = remover productor Y consumidor, o degradar el consumidor explícitamente.

**Riesgo técnico:** Ruido que enmascara errores reales en la console-guard de los e2e; funcionalidad mostrando datos ficticios como vivos.

**Riesgo para el negocio:** Decisiones sobre eventos mock; latencia/batería en terminales por retries inútiles.

**Causa raíz probable:** Grep incompleto en la remoción (misma causa que la lección de Ola 3: 'grep por TODOS los identificadores, no por prefijo').

**Recomendación:** Eliminar la llamada y la función (junto con GS_CACHE/SHEETS_LIVE y el indicador), y decidir el destino de la sección historial: si vive solo de mocks, retirarla o conectarla a Odoo. Convertir en paso obligatorio el checklist de remoción por identificador (la lección ya está escrita en la memoria de Ola 3).

**Solución inmediata:** Quitar la llamada de :18415 y el indicador sheets-status.

**Solución definitiva:** Eliminar toda la cadena Sheets del cliente y resolver la sección historial.

**Esfuerzo estimado:** Bajo

**Prioridad:** P2

**Dependencias:** Decisión de producto sobre la sección historial/timeline.

**Criterio de aceptación:** Cero requests a /api/sheets en el arranque.

**Cómo validar la corrección:** Arrancar local y observar Network; grep checkSheetsConnection = 0.


## Hallazgo ARQ-08: Duplicación de helpers de escape y formato en el frontend: 3 variantes de escape conviven dentro del propio shell además de los duplicados deliberados shell/islas

**Área:** A/B — Arquitectura general y organización del código

**Severidad:** Media

**Estado:** Confirmado

**Componente afectado:** historial.html / core.js / core-isla.js / almacen-mapa.html

**Evidencia encontrada:** esc (core.js:2439) ≡ escH (historial.html:21261) ≡ esc (core-isla.js:18) ≡ esc propio (almacen-mapa.html:364); además escHtml (historial.html:26769) y escapeHtml anidada (historial.html:33213); toast duplicado (core.js:2498 / core-isla.js:58) y fmtDate duplicado (core.js:2496 / core-isla.js:20).

**Situación actual:** El plan 08 ya detectó escH≡esc como 'duplicado histórico' pero no se consolidó.

**Problema:** La dupla core.js/core-isla.js es una decisión consciente (aislamiento de las islas) y es aceptable; la deuda real es que DENTRO del mismo documento shell convivan esc + escH + escHtml + escapeHtml: si un futuro fix de sanitización (como el de v221, que tuvo que tocar '4 helpers de escape') olvida una variante, queda una vía XSS diferencial en un sistema con CSP 'unsafe-inline'.

**Práctica estándar de la industria:** Un único helper de escape por scope; alias solo como re-exportación delgada.

**Riesgo técnico:** Divergencia de sanitización entre variantes ante el próximo fix de seguridad.

**Riesgo para el negocio:** XSS en una app con sesiones JWT de ~30 usuarios operativos.

**Causa raíz probable:** Copy-paste histórico entre módulos del monolito.

**Recomendación:** Convertir escH y escHtml en alias de una línea de esc hoy; barrido de call-sites y eliminación de variantes después. Mantener core-isla.js como copia canónica única para las islas (ya documentado).

**Solución inmediata:** function escH(s){return esc(s);} y equivalente para escHtml.

**Solución definitiva:** Barrido de call-sites hacia esc único.

**Esfuerzo estimado:** Bajo

**Prioridad:** P2

**Dependencias:** Suite e2e.

**Criterio de aceptación:** Una sola implementación de escape en el scope del shell.

**Cómo validar la corrección:** grep de las 4 firmas antes/después; e2e verde.


## Hallazgo ARQ-09: proxy.js sigue siendo un monolito de 20.964 líneas con routing en cascada lineal y sin carril de modularización propio

**Área:** A/B — Arquitectura general y organización del código

**Severidad:** Media

**Estado:** Confirmado

**Componente afectado:** proxy.js

**Evidencia encontrada:** wc -l proxy.js = 20.964; un único http.createServer async (proxy.js:7794) contiene la cascada: 142 'reqPath === ' + 24 'reqPath.startsWith' medidos hoy (la auditoría previa contó ~238 endpoints); sin 'use strict' (0 hits), a diferencia de TODOS los módulos nuevos (boot/storage-pg/media/write-queue/typed-schemas, todos strict).

**Situación actual:** Las capas conviven en el mismo handler (transporte, auth, negocio, integración), como documentó 01-arquitectura.md — sigue cierto en v228.

**Problema:** El plan 08 modulariza solo el FRONTEND; para el backend no hay plan más allá de las extracciones ya hechas. Con sesiones paralelas, proxy.js es el punto de colisión de merges por excelencia y el bus factor=1 se concentra ahí. El routing O(n) en sí es irrelevante a esta escala — no es un problema de performance sino de mantenibilidad.

**Práctica estándar de la industria:** Un archivo por dominio detrás de una tabla de rutas; no requiere Express.

**Riesgo técnico:** Merges conflictivos entre sesiones; regresiones por proximidad textual; onboarding imposible de un segundo dev.

**Riesgo para el negocio:** Todo el negocio de bodega vive en un archivo que solo Gabriel (y agentes con contexto) pueden navegar.

**Causa raíz probable:** Priorización correcta del frontend (donde dolían las colisiones); el backend quedó sin fecha.

**Recomendación:** Documentar un carril backend (doc 09) espejo del plan 08: tabla de rutas prefijo→handler y extracción por dominios, empezando por los que YA delimita el write-gate (tasks-sdv, inventario, averias, inspecciones, showroom — proxy.js:7856-7863), uno por sesión con e2e y harnesses verdes. Sin frameworks.

**Solución inmediata:** Escribir el plan (esfuerzo horas) para no perder la intención.

**Solución definitiva:** Extracción incremental por dominios gateados.

**Esfuerzo estimado:** Alto

**Prioridad:** P2

**Dependencias:** Suite e2e; conviene después del barrido sendJson.

**Criterio de aceptación:** proxy.js < 10k líneas actuando de router+transporte; 1 archivo por dominio gateado.

**Cómo validar la corrección:** wc -l por módulo; e2e + harnesses de contrato verdes.


## Hallazgo ARQ-10: El shell historial.html conserva 34.662 líneas con los dominios de mayor cambio dentro (tasks/SDV/estado-órdenes) y funciones intratables (renderDrawer: 1.060 líneas)

**Área:** A/B — Arquitectura general y organización del código

**Severidad:** Media

**Estado:** Confirmado

**Componente afectado:** historial.html

**Evidencia encontrada:** wc -l = 34.662 (2,2 MB servidos con no-store en cada arranque — proxy.js:20688); renderDrawer en historial.html:11525 mide 1.060 líneas; ~5.352 líneas de CSS inline y 9 bloques <script>; el plan 08 clasifica sdv* (133 funciones) y tasks/drawer como 'DIFÍCIL (al final)'.

**Situación actual:** Plan vigente y correcto; empaque en extracción en otra sesión ahora mismo.

**Problema:** Las Olas 1-3 extrajeron lo fácil (~4.800 líneas netas); el 85% del monolito sigue, incluyendo los módulos donde ocurren la mayoría de los cambios de negocio. El riesgo de la poda ya mordió dos veces (el </div> huérfano de v219 llegó a producción dentro de v226 rompiendo todos los tabs WWP — commit a2d95ce). No es hallazgo nuevo sino medición de que el grueso está por delante y las reglas de seguridad deben sostenerse.

**Práctica estándar de la industria:** Exactamente lo que el plan 08 prescribe; no cambiar de estrategia.

**Riesgo técnico:** Cada edit en la zona tasks/SDV arriesga el archivo entero; el parser HTML 'repara' en silencio los errores de estructura.

**Riesgo para el negocio:** Regresiones en el corazón operativo (tareas de bodega) por cambios en módulos vecinos.

**Causa raíz probable:** Deuda de origen del monolito; el orden fácil→difícil es correcto pero deja lo crítico al final.

**Recomendación:** Sostener el plan 08 (Olas 4-5) al ritmo actual; considerar adelantar estado-ordenes (cohesivo, 80 fns) para reducir superficie antes de sdv; automatizar el chequeo de balance de <div> por región como test e2e (la lección v219/v227 ya está escrita, falta blindarla).

**Solución inmediata:** Test que cuente hijos directos de .app-body/#tab-tasks (anti-</div> huérfano).

**Solución definitiva:** Completar Olas 4-5.

**Esfuerzo estimado:** Alto

**Prioridad:** P2

**Dependencias:** Plan 08; suite e2e.

**Criterio de aceptación:** historial.html < 15k líneas con tasks como último inquilino; smoke por isla nueva.

**Cómo validar la corrección:** wc -l tras cada ola; e2e completa.


## Hallazgo ARQ-11: Documentación operativa con detalles desactualizados que contradicen el código (index.html, rama dev, inventario de scripts/, Modo B de GitHub Pages)

**Área:** A/B — Arquitectura general y organización del código

**Severidad:** Baja

**Estado:** Confirmado

**Componente afectado:** CLAUDE.md / MEMORIA-PROYECTO.md

**Evidencia encontrada:** CLAUDE.md:13 describe index.html como 'Dashboard de despachos' pero index.html:27 es un tombstone ('Dashboard de Ventas retirado… R-06D'); CLAUDE.md:46 menciona flujo 'dev→master' y no existe rama dev; CLAUDE.md:25 lista 2 herramientas en scripts/ pero hay 4 (faltan backup-wwp.mjs — el respaldo Nivel 1 — y migrate-media-to-r2.mjs); MEMORIA-PROYECTO.md:15 afirma que GitHub Pages 'Modo B' con CSV de Sheets 'se mantiene casi en sync', incompatible con R-06D y sin rama gh-pages en el clon.

**Situación actual:** El resto del documento se mantiene al día (la fila de basedatos se corrigió en el mismo commit v228).

**Problema:** CLAUDE.md es la entrada de contexto de TODOS los agentes IA que trabajan el repo: cada detalle desactualizado se convierte en decisiones erradas (p.ej. intentar 'arreglar' el dashboard de index.html o buscar la rama dev). La calidad global de la documentación es excepcional; esto es mantenimiento puntual.

**Práctica estándar de la industria:** Revisión del CLAUDE.md como parte del checklist de cada cambio estructural.

**Riesgo técnico:** Agentes y sesiones nuevas operando sobre supuestos falsos.

**Riesgo para el negocio:** Tiempo perdido; en el caso del Modo B, posible superficie pública desatendida.

**Causa raíz probable:** Documentación viva con varios frentes de cambio simultáneos.

**Recomendación:** Corregir las 4 líneas citadas; verificar en GitHub si gh-pages existe y decidir su retiro o actualización; formalizar el ítem 'docs tocados' en el cierre de cada sesión.

**Solución inmediata:** Editar las líneas citadas.

**Solución definitiva:** Checklist de cierre de sesión con ítem de docs.

**Esfuerzo estimado:** Bajo

**Prioridad:** P3

**Dependencias:** Acceso a GitHub para verificar gh-pages.

**Criterio de aceptación:** CLAUDE.md sin afirmaciones contradichas por el código; estado del Modo B decidido y documentado.

**Cómo validar la corrección:** Releer CLAUDE.md contra ls/git branch tras el fix.


## Hallazgo ARQ-12: Suite de harnesses no reproducible en clon limpio: 7 tests leen certificados .pem gitignorados desde la raíz (residuo de R-18)

**Área:** A/B — Arquitectura general y organización del código

**Severidad:** Baja

**Estado:** Confirmado

**Componente afectado:** tests/ (harnesses .mjs)

**Evidencia encontrada:** tests/_gateodoo.mjs:20 hace fs.readFileSync de _fakecert.pem/_fakekey.pem de la raíz (ídem _test_capa1_picks, _test_v113/117/202/212); .gitignore excluye '*.pem'; en cambio tests/test-geo-contract.mjs:35 YA autogenera el certificado con openssl si falta — el patrón correcto existe en el propio repo.

**Situación actual:** Los harnesses viejos protegen fixes v113-v212; hoy solo corren en máquinas que ya tienen los .pem.

**Problema:** En un clon fresco (otra máquina, CI futura) 6-7 harnesses de regresión fallan por archivo inexistente, no por regresión real. R-18 se corrigió en los tests de contrato nuevos pero no se retro-portó a los viejos.

**Práctica estándar de la industria:** Fixtures autogenerables o commiteados si no son secretos.

**Riesgo técnico:** Red de regresión incompleta justo durante los refactors de Olas 4-5 y del backend.

**Riesgo para el negocio:** Indirecto.

**Causa raíz probable:** El patrón de autogeneración llegó después que los harnesses viejos.

**Recomendación:** Extraer el helper de autogeneración de test-geo-contract.mjs a tests/helpers/ y usarlo en los harnesses viejos (o commitear los _fake*.pem — un cert self-signed de test no es un secreto).

**Solución inmediata:** Helper compartido de certs en tests/helpers/.

**Solución definitiva:** Smoke periódico en clon limpio.

**Esfuerzo estimado:** Bajo

**Prioridad:** P3

**Dependencias:** openssl disponible (ya es supuesto de test-geo).

**Criterio de aceptación:** git clone fresco + npm ci + node tests/_gateodoo.mjs corre sin preparación manual.

**Cómo validar la corrección:** Clon temporal en scratchpad y correr los 7 harnesses.


## Hallazgo ARQ-13: Convenciones de nombres heterogéneas: español/inglés mezclado, ~15 prefijos-namespace sin registro central y doble convención en tests

**Área:** A/B — Arquitectura general y organización del código

**Severidad:** Baja

**Estado:** Confirmado

**Componente afectado:** historial.html / tests/

**Evidencia encontrada:** Muestra del shell: loadPhotoArchive, renderTasks, exportTasksCSV (inglés) junto a cargarSinAdjuntos, renderRecentTags, buscarDirecta (español); prefijos de facto sin índice central: sdv*, emp*, av*, dc*, eo*, inv*, pol*, imp*, tr*, veh*, _rs*, _do*, ca*, eqp* (el mejor mapa vive en docs/08:44-75); tests con doble convención: _test_vNNN.mjs (por build: _test_v113…_test_v212, opacos sin abrir el archivo) vs test-<dominio>-contract.mjs.

**Situación actual:** Los prefijos son consistentes DENTRO de cada módulo — el sistema funciona, solo carece de índice.

**Problema:** Para 1 dev con memoria del proyecto el costo es bajo, pero agentes IA y cualquier segundo dev dependen de grep: un prefijo no documentado alarga cada búsqueda y ya causó incidentes (los duplicados escH/POL_USE_MOCK vivían 'lejos del cluster' — lección de Ola 3). Los tests por número de build no comunican qué protegen.

**Práctica estándar de la industria:** Glosario de prefijos/módulos en el doc de entrada del repo.

**Riesgo técnico:** Greps incompletos en refactors (causa raíz ya materializada).

**Riesgo para el negocio:** Indirecto.

**Causa raíz probable:** Crecimiento orgánico a máxima velocidad, sin segundo lector humano.

**Recomendación:** Copiar la tabla módulo→prefijo del plan 08 a CLAUDE.md como 'mapa de prefijos' y añadir una línea descriptiva al header de cada _test_vNNN. No invertir más: al extraer cada isla, el nombre del archivo se vuelve el namespace y el problema se disuelve solo.

**Solución inmediata:** Tabla de prefijos en CLAUDE.md.

**Solución definitiva:** La propia modularización por islas.

**Esfuerzo estimado:** Bajo

**Prioridad:** P3

**Dependencias:** Ninguna.

**Criterio de aceptación:** CLAUDE.md con tabla de prefijos vigente; cada _test_vNNN con descripción de una línea.

**Cómo validar la corrección:** Lectura del glosario contra grep de prefijos.



---

# Área C — Backend y lógica de negocio

**Resumen del área:** El backend es un monolito Node sin frameworks (proxy.js, 20.964 líneas) con un dispatcher de ~230 rutas en cascada de `if` dentro de UNA sola función async de ~12.980 líneas (7794–20773). La capa de datos (storage-pg.js: memoria como fuente de verdad + write-behind diferencial a PG con dual-write tipado transaccional, blindaje anti-vacío, reintentos y export horario) es de calidad notablemente alta para un equipo de 1 desarrollador, igual que write-queue.js (30 líneas, contrato testeado). La concurrencia está bien pensada: gates de escritura por dominio + colas por colección con orden fijo gate→colección, jobs con flags singleton y fail-open hacia Odoo. La deuda real está en la estructura (reglas de negocio inline en handlers de 800 líneas, predicados duplicados con drift), en 3-4 bugs latentes de robustez (dispatcher sin catch-all, readBody con decodificación UTF-8 por chunk, gate retenido durante la subida del body) y en huecos menores de idempotencia y fuga de información. La mayoría de hallazgos críticos de la auditoría del 05-*.md ya fueron corregidos y verificados en el código actual.

**Madurez:** 3.5/5 — Muy por encima de lo esperable para un solo desarrollador: la capa de persistencia (write-behind diferencial, dual-write transaccional tipado, blindaje anti-vacío nacido de un incidente real, paridad verificable, rollback operativo por env var) y el modelo de concurrencia (gates por dominio + colas por colección con orden fijo, testeado) son de nivel profesional, y casi todos los hallazgos críticos de la auditoría previa fueron corregidos y son verificables en el código actual. No llega a 4 por la deuda estructural (una función de ~13.000 líneas como dispatcher, reglas de negocio inline y duplicadas con drift ya observable) y por bugs latentes de robustez fáciles de cerrar (sin catch-all, readBody con decodificación por chunk, gate retenido durante uploads, sin idempotencia en creaciones). Nada de eso amenaza los datos hoy — el riesgo dominante es la velocidad y seguridad de CAMBIO, no la operación.

## Fortalezas verificadas

- storage-pg.js es excelente para este contexto: memoria como verdad + write-behind DIFERENCIAL por fila, transacción única para collection_rows + tabla tipada (storage-pg.js:298-330, _typedApplyOps dentro del BEGIN/COMMIT de _flushOp), blindaje anti-vacío con tabla rejected_writes (:201-213), reintentos con backoff y coalescing a resync (:232-296), guardia dura al reconstruir de tipadas (jamás arrancar con datos de menos, :491-517), paridad verificable (typedParity :530) y export horario a JSON como botón de rollback (:745-753)
- write-queue.js (30 líneas): sección crítica por clave con contrato explícito y testeado (tests/_test_b1b3_colas.mjs) — el error se propaga al caller pero la cadena sobrevive; orden de adquisición fijo gate→colección sin ciclos (proxy.js:7849-7850)
- Manejo de errores de proceso correcto: silentCatch definida y logueando (proxy.js:25-28), uncaughtException/unhandledRejection registrados (:32-37) coherentes con el diseño memoria-como-verdad (morir perdería la cola; seguir + retry converge)
- Persistencia en modo archivo endurecida por incidente real: escritura atómica tmp→rename + .bak (proxy.js:108-126), loadJson fail-visible ante JSON corrupto con recuperación de .bak (:95-106), guarda anti-vacío en saveCriticalArray (:209-239), snapshots horarios ×24 y backups rotativos ×40
- Seguridad por capas verificada en el código actual: requireJwt relee el usuario en cada request (revocación inmediata, :3350-3368), RBAC + permisos de sección + chequeo de participante anti-IDOR (:3384-3411), comparaciones timing-safe en todos los tokens (:3323, :3431, :3455), proxy Odoo restringido a métodos de solo lectura (:8568), path traversal + denylist de fuente y JSON de negocio en estáticos (:20641-20676), anti-Slowloris (:20823-20826), rate limit de login por email y por IP en rutas costosas
- Jobs programados robustos: los 8+ setInterval relevantes van con flag singleton (_busy), try/catch o .catch, fail-open ante Odoo caído, y los que mutan colecciones se encolan en el gate de su dominio (out-recon :6375, inv-watchdog :6746, inv-snapshot :7599)
- Integración Odoo con timeout configurable y destroy real del socket (ODOO_RPC_TIMEOUT_MS, :7605-7649), invalidación de uid ante Access Denied (:6535, :8579) y jobs que baten en lote (search_read con name in [...] :6344) en vez de martillar
- Optimización móvil consciente: ETag sobre lista filtrada + 304 (:12749-12760), gzip con caché acotada por mtime (:315-317, :20736-20759), Range/206 para video (:20704-20727), fix documentado del ETag que reescribía 28 MB por GET (:5552-5566)
- Dependencias mínimas (pg, @aws-sdk/client-s3, nodemailer y web-push lazy) — superficie de supply-chain casi nula para una app de operación crítica
- media.js limpio: R2 con fallback a disco sin perder evidencia, validación de nombre anti-traversal que lanza (media.js:68-75), self-test incluido

## Hallazgo BE-01: El dispatcher no tiene catch-all: un error no capturado deja la request colgada sin respuesta (y el gate de dominio retenido hasta 60 s)

**Área:** C — Backend y lógica de negocio

**Severidad:** Media

**Estado:** Confirmado

**Componente afectado:** proxy.js (dispatcher)

**Evidencia encontrada:** proxy.js:7794 callback async sin try/catch envolvente; ejemplos sin try propio: GET /api/wwp/tasks :12675-12762; POST …/messages hace `await readBody(req)` en :12786 fuera de try; unhandledRejection solo loguea (:32-34)

**Situación actual:** 335 bloques try dentro del dispatcher cubren la mayoría de endpoints, pero no todos; la protección es por convención, no estructural.

**Problema:** Si un handler lanza antes de responder (JSON malformado en readBody, 'Datos corruptos' de loadJson :105, bug puntual), la promesa del callback rechaza, se loguea… y el cliente queda esperando para siempre una respuesta que no llega. En requests mutadoras el gate del dominio queda tomado hasta que el cliente corte o dispare el backstop de 60 s (:7865-7868).

**Práctica estándar de la industria:** Catch-all estructural en el request-handler con respuesta 500 sanitizada.

**Riesgo técnico:** Spinners infinitos en la app móvil; congelamiento de un dominio de escritura completo por hasta 60 s por cada error de esta clase.

**Riesgo para el negocio:** Operarios de almacén bloqueados sin feedback ante un error que debería ser un toast de 500.

**Causa raíz probable:** Los try/catch se agregaron endpoint por endpoint; nunca se puso la red estructural.

**Recomendación:** Envolver el cuerpo completo del dispatcher en try/catch que responda 500 con safeError si no se enviaron cabeceras (~6 líneas), y agregar un test que fuerce un throw y verifique 500 en vez de timeout.

**Solución inmediata:** try { …dispatcher… } catch(e) { if(!res.headersSent) sendJson(res,500,{ok:false,error:safeError(e)}); else try{res.end()}catch(_){}}

**Solución definitiva:** La misma red + test de regresión.

**Esfuerzo estimado:** Bajo

**Prioridad:** P1

**Dependencias:** Ninguna.

**Criterio de aceptación:** Un endpoint que lanza responde 500 en <100 ms y libera el gate de inmediato.

**Cómo validar la corrección:** Test: POST /api/wwp/tasks/wt_x/messages con body no-JSON → responde error, no cuelga; otro POST del dominio entra inmediatamente después.

**Verificación adversarial (CONFIRMADO):** Toda la evidencia se reproduce hoy tal cual: callback async de createServer sin try/catch envolvente (proxy.js:7794, cuerpo :7795-20773), GET /api/wwp/tasks sin try propio (:12675, con loadJson que lanza 'Datos corruptos' :105), await readBody fuera de try en POST messages (:12786, readBody rechaza en JSON.parse :7780-7781), unhandledRejection solo loguea (:32-34) y backstop del gate de 60 s (:7865-7868). Busqué mitigaciones activamente y no existen: cero usos de res.headersSent, ningún wrapper, y requestTimeout=30s (:20824) solo cubre la recepción del request, no la respuesta colgada. El comentario :29-31 documenta como deliberado no tumbar el proceso, pero nada documenta dejar la request sin respuesta; el propio comentario del gate (:7846-7847) reconoce el escenario del handler colgado sin resolverlo hacia el cliente. Severidad Media / P1 / esfuerzo Bajo es proporcionada para una operación de almacén donde un error congela el dominio de escritura tasks-sdv completo hasta 60 s. · Evidencia re-vista: proxy.js:7794 (createServer async sin catch-all, cuerpo hasta :20773); proxy.js:12675 (GET /api/wwp/tasks sin try); proxy.js:12786 (await readBody fuera de try); proxy.js:7780-7781 (readBody reject en JSON malformado); proxy.js:105 ('Datos corruptos' en loadJson); proxy.js:32-34 (unhandledRejection log-only); proxy.js:7865-7869 (backstop 60 s + release en 'close'); proxy.js:20823-20827 (timeouts que no cubren respuestas colgadas)


## Hallazgo BE-02: readBody decodifica cada chunk por separado: riesgo de corrupción UTF-8 en fronteras de chunk + JSON.parse de hasta 50 MB bloqueando el event loop

**Área:** C — Backend y lógica de negocio

**Severidad:** Media

**Estado:** Confirmado

**Componente afectado:** proxy.js readBody

**Evidencia encontrada:** proxy.js:7767-7785 — `let data = ''; req.on('data', chunk => { … data += chunk; })` sin req.setEncoding (grep sin resultados) y MAX_BODY_SIZE = 50 MB (:7766)

**Situación actual:** Los bodies chicos (<64 KB, un solo chunk) no lo disparan; los grandes (fotos/videos base64 + texto con tildes) sí pueden.

**Problema:** `data += chunk` convierte cada Buffer a string de forma independiente: un carácter multibyte (á, ñ, é, emoji — la app está en español) partido entre dos chunks TCP produce U+FFFD silenciosos en el dato guardado. Además el JSON.parse de un body de decenas de MB bloquea el proceso único para todos los usuarios.

**Práctica estándar de la industria:** Buffer.concat al final — la decodificación sobre el buffer completo es correcta por construcción.

**Riesgo técnico:** Corrupción silenciosa e intermitente de texto en tareas/mensajes/SDV; aparece como 'caracteres raros' imposibles de reproducir.

**Riesgo para el negocio:** Evidencia documental (notas de entrega, observaciones) con texto corrupto.

**Causa raíz probable:** Patrón clásico de acumulación por string copiado de ejemplos antiguos de Node.

**Recomendación:** Acumular Buffers y decodificar una sola vez con Buffer.concat(chunks).toString('utf8') (5 líneas, mismo contrato); bajar MAX_BODY_SIZE por defecto y subirlo solo en endpoints de media.

**Solución inmediata:** Cambiar a acumulación de Buffers + concat.

**Solución definitiva:** Ídem + límites por endpoint.

**Esfuerzo estimado:** Bajo

**Prioridad:** P1

**Dependencias:** Ninguna.

**Criterio de aceptación:** Roundtrip byte-exacto de un body >1 MB con 'ñ' en posiciones arbitrarias.

**Cómo validar la corrección:** Harness que postea por socket crudo con chunks de tamaño impar y compara el texto persistido.

**Verificación adversarial (CONFIRMADO):** La evidencia se reproduce byte a byte hoy: readBody (proxy.js:7767-7785) acumula con `data += chunk` sin req.setEncoding (grep sin resultados en todo el archivo) y hace JSON.parse del string completo con MAX_BODY_SIZE = 50 MB (:7766); no existe ningún lector alternativo ni Buffer.concat en la ruta de bodies (el único Buffer.concat, :5049, es de otra cosa). Los endpoints de fotos base64 con captions en español (10566-10589, 10849, 13905) pasan por este mismo readBody, y sobre la red real de Railway los chunks TCP llegan en segmentos de ~1.4 KB, por lo que incluso bodies de texto de pocos KB son multi-chunk — la exposición es mayor de lo que el propio hallazgo estima. No hay documentación (CLAUDE.md, MEMORIA-PROYECTO.md, comentarios) que lo presente como decisión deliberada. Severidad Media y P1 están bien calibradas dado que el fix es de 5 líneas y el riesgo es corrupción silenciosa de evidencia documental. · Evidencia re-vista: proxy.js:7766 (MAX_BODY_SIZE 50 MB), proxy.js:7767-7785 (readBody con `data += chunk` y JSON.parse), grep setEncoding → 0 hits, proxy.js:10570/10849/13905 (endpoints base64+caption vía readBody)


## Hallazgo BE-03: El gate de escritura por dominio se adquiere ANTES de leer el body: una subida lenta de foto/video serializa todas las mutaciones del dominio

**Área:** C — Backend y lógica de negocio

**Severidad:** Media

**Estado:** Confirmado

**Componente afectado:** proxy.js (gate B1/B2) + endpoints de media

**Evidencia encontrada:** Gate en proxy.js:7851-7874 (corre al inicio del dispatcher para todo no-GET de tasks-sdv/inventario/averias/inspecciones/showroom); readBody ocurre DENTRO de los handlers (:13067, :12786); videos de chat hasta 30 MB (:12808)

**Situación actual:** Con ~30 usuarios y subidas frecuentes de evidencia fotográfica es un freno perceptible en horas pico, no un colapso.

**Problema:** Mientras un chofer con 3G sube un video de 30 MB a /api/wwp/tasks/:id/messages, el dominio 'tasks-sdv' completo (crear/editar tareas, SDV, evidencias de TODOS los usuarios) espera en cola — hasta el requestTimeout de 30 s (:20824). El gate protege la ventana load→await→save, pero de facto también serializa la transferencia de red del body.

**Práctica estándar de la industria:** Adquirir el lock con alcance mínimo: el I/O de red fuera de la sección crítica.

**Riesgo técnico:** Latencia en cascada en el dominio más caliente del sistema justo cuando más se usa (despachos en calle con mala señal).

**Riesgo para el negocio:** Percepción de 'la app se pega' en operación de campo.

**Causa raíz probable:** El gate genérico en el dispatcher fue la forma más barata de cerrar los lost-updates (auditoría 07) — correcto, pero con alcance más amplio que la sección crítica real.

**Recomendación:** Eximir del gate externo a los endpoints de media-upload que ya re-resuelven estado dentro de queueWrite('wwp-tasks') (el POST de messages ya lo hace en :12828-12831), o mover la adquisición del gate a después de readBody manteniendo el orden gate→colección.

**Solución inmediata:** Exención selectiva de los endpoints de media con cola interna.

**Solución definitiva:** Helper de adquisición post-readBody para todos los mutadores.

**Esfuerzo estimado:** Medio

**Prioridad:** P1

**Dependencias:** Revisar endpoint por endpoint cuáles dependen del gate externo vs cola interna antes de eximir.

**Criterio de aceptación:** Un upload de 30 MB a 1 Mbps no retrasa un PATCH de status concurrente más de ~100 ms.

**Cómo validar la corrección:** Test de carrera: upload throttled + PATCH concurrente midiendo latencia; tests/_test_b1b3_colas.mjs sigue verde.

**Verificación adversarial (CONFIRMADO):** La evidencia se reproduce hoy línea por línea: el gate por dominio se adquiere en el dispatcher (al llegar los headers) para todo no-GET de tasks-sdv/inventario/averias/inspecciones/showroom y solo se libera en res 'close', mientras que readBody ocurre dentro de los handlers — la transferencia del body (paced por el cliente, hasta 30 MB de video / 50 MB MAX_BODY_SIZE) sostiene el lock del dominio. No existe fix ni mitigación: sin exención de media en el gate, sin ruta presigned a R2 (las 23 llamadas a saveMediaB64 reciben base64 vía readBody). Detalle agravante no mencionado: un video de 30 MB en 3G jamás completa dentro del requestTimeout de 30 s, así que cada reintento falla Y bloquea el dominio ~30 s. El gate es deliberado y documentado (B1/B2, auditoría 07) pero ni el comentario ni MEMORIA-PROYECTO reconocen este tradeoff, exactamente como enmarca la causa_raiz del hallazgo; Media/P1 no está inflado para el dominio más caliente en operación de campo. · Evidencia re-vista: proxy.js:7851-7874 (gate en dispatcher, release en res 'close', backstop 60s :7865); proxy.js:12786 y :13067 (readBody dentro de handlers); proxy.js:12808 (video 30 MB); proxy.js:7766 (MAX_BODY_SIZE 50 MB); proxy.js:20824 (requestTimeout 30000); proxy.js:12828-12831 (queueWrite 'wwp-tasks' con re-resolución fresca); proxy.js:4806 (fotos máx 5 MB); MEMORIA-PROYECTO.md:43 (diseño B1/B2 documentado sin mencionar el tradeoff)


## Hallazgo BE-04: Dispatcher monolítico: ~230 rutas en cascada de if dentro de una sola función de ~12.980 líneas

**Área:** C — Backend y lógica de negocio

**Severidad:** Media

**Estado:** Confirmado

**Componente afectado:** proxy.js (servidor HTTP)

**Evidencia encontrada:** proxy.js:7794 `const server = http.createServer(async (req, res) => {` … cierra en :20773; 142 comparaciones `reqPath ===` + 91 `reqPath.match(` + 16 startsWith; handler PATCH de tareas ocupa :13056-13856 (~800 líneas)

**Situación actual:** El plan 08 ya modulariza el frontend (islas); el backend sigue siendo un único archivo con una única función para todos los dominios (tareas, SDV, inventario, averías, empaque, vehículos, notificaciones, agentes, Codex Bridge).

**Problema:** Todo el enrutado, RBAC, validación, reglas de negocio, notificaciones y respuesta HTTP viven entrelazados en una única función. Cada cambio tiene radio de impacto enorme; imposible testear reglas sin levantar el servidor; el orden de los if ES el router (una ruta más específica declarada después de una genérica nunca matchea).

**Práctica estándar de la industria:** Router por tabla y handlers por dominio en módulos requeribles — sin necesidad de framework.

**Riesgo técnico:** Regresiones por colisión de scope y orden de rutas; curva de entrada altísima para cualquier colaborador (humano o agente IA); merge conflicts constantes entre sesiones paralelas (ya documentado en memoria del proyecto).

**Riesgo para el negocio:** Con bus factor 1, la velocidad de corrección de incidentes en producción depende de navegar 21k líneas bajo presión.

**Causa raíz probable:** Crecimiento orgánico incremental sin punto de corte; el patrón if-cascade funcionaba y se copió ~230 veces.

**Recomendación:** No reescribir: introducir un router-tabla (método+patrón→handler, ~50 líneas sin framework) y extraer dominios incrementalmente con el mismo patrón estrangulador que ya funcionó en el cutover de datos, empezando por SDV e inventario.

**Solución inmediata:** Router-tabla y regla: toda ruta NUEVA nace en módulo propio.

**Solución definitiva:** Extracción incremental por dominio detrás del router, validada por la suite e2e existente.

**Esfuerzo estimado:** Alto

**Prioridad:** P2

**Dependencias:** Suite e2e (72-80 tests) como red de seguridad; congelar contrato de rutas antes de mover.

**Criterio de aceptación:** proxy.js < 8.000 líneas; ningún dominio nuevo en el if-cascade; e2e verde tras cada extracción.

**Cómo validar la corrección:** npm run test:e2e tras cada módulo extraído; inventario de rutas (grep reqPath) idéntico antes/después.


## Hallazgo BE-05: Proxy Odoo genérico restringe MÉTODOS pero no MODELOS: cualquier admin/manager/ventas puede leer todo el ERP con la API key privilegiada del servidor

**Área:** C — Backend y lógica de negocio

**Severidad:** Media

**Estado:** Confirmado

**Componente afectado:** proxy.js /api/odoo

**Evidencia encontrada:** proxy.js:8555-8584 — requireJwt + requireRole(['admin','manager','ventas']) + `ODOO_PROXY_ALLOWED = new Set(['read','search','search_read',…])` (:8568); no hay allowlist de `model`

**Situación actual:** Amenaza interna (requiere JWT válido), pero el rol ventas se agregó explícitamente para tableros y amplía la audiencia.

**Problema:** El gate por método (solo lectura) es correcto, pero el campo `model` es libre: un usuario con rol 'ventas' puede hacer search_read de hr.employee, res.partner completo, purchase.order (costos de compra), account.move, etc. — datos a los que su usuario de Odoo probablemente NO tiene acceso, elevándose a los permisos de la API key del servidor.

**Práctica estándar de la industria:** Allowlist de modelos por rol y logging de la consulta.

**Riesgo técnico:** Ninguno estructural; es exposición de datos.

**Riesgo para el negocio:** Fuga interna de márgenes, costos de compra, nómina o cartera completa de clientes a roles no autorizados.

**Causa raíz probable:** El endpoint nació sin auth (ya corregido) y el fix se centró en métodos de escritura, no en el eje modelo.

**Recomendación:** Inventariar los modelos que el frontend realmente consulta y cerrar con allowlist de modelos (idealmente por rol) + registrar modelo/método/usuario en el audit log; 403 al resto.

**Solución inmediata:** Set de modelos permitidos derivado de grep en historial.html.

**Solución definitiva:** Allowlist por rol + appendAuditLog por llamada.

**Esfuerzo estimado:** Bajo

**Prioridad:** P2

**Dependencias:** Inventario de modelos usados por los tableros.

**Criterio de aceptación:** search_read de hr.employee con JWT ventas responde 403; los tableros existentes siguen funcionando.

**Cómo validar la corrección:** Test de contrato con JWT de cada rol contra 3 modelos permitidos y 3 prohibidos.


## Hallazgo BE-06: Predicado de participante de tarea implementado 3 veces con drift real (createdBy cuenta para VER pero no para EDITAR)

**Área:** C — Backend y lógica de negocio

**Severidad:** Media

**Estado:** Confirmado

**Componente afectado:** proxy.js lógica de negocio de tareas

**Evidencia encontrada:** isTaskParticipant proxy.js:3402-3411 (sin createdBy); copia inline en GET /api/wwp/tasks :12690-12696 (CON `t.createdBy === uid`); copia inline en PATCH :13084-13088 (SIN createdBy); literal ['completed','validated','cancelled'] repetido 24 veces; guard SDV terminal ['cancelada','despachada'] repetido 3 veces (:12907, :13121, :16361)

**Situación actual:** El resto de la máquina de estados de tareas (transiciones, gates de cadena madre/hijas, checklists de evidencia) está bien pensada pero embebida inline en el PATCH de 800 líneas (:13056-13856), imposible de testear sin HTTP.

**Problema:** Las reglas de autorización y los estados terminales están duplicados como literales en vez de vivir en una función/constante única. El drift ya es observable: un usuario solo-creador ve la tarea en el listado (GET) pero recibe 403 al mutarla (PATCH) — y cada nueva copia puede abrir un IDOR o cerrar un permiso legítimo sin que nadie lo note.

**Práctica estándar de la industria:** Un solo predicado + constantes + funciones puras de transición con tests unitarios.

**Riesgo técnico:** Divergencia silenciosa de autorización entre endpoints; regresiones al tocar cualquiera de las copias.

**Riesgo para el negocio:** Inconsistencias de permisos visibles al equipo y potencial hueco de acceso al revés.

**Causa raíz probable:** Copy-paste defensivo bajo presión; la función central se creó después de las copias.

**Recomendación:** Unificar en isTaskParticipant (decidiendo explícitamente si createdBy cuenta), extraer constantes TERMINAL_TASK_STATES/TERMINAL_SDV_STATES, y a mediano plazo extraer la validación de transiciones del PATCH a una función pura testeable.

**Solución inmediata:** Reemplazar las 2 copias inline por la función central.

**Solución definitiva:** canTransition(task, d, jp, tasks) pura con tests.

**Esfuerzo estimado:** Bajo

**Prioridad:** P2

**Dependencias:** Decisión de negocio: ¿el creador no-participante puede editar? (hoy: no, pero ve).

**Criterio de aceptación:** grep de los literales duplicados → 1 sola definición; test unitario del predicado.

**Cómo validar la corrección:** Tests de contrato GET vs PATCH con usuario solo-creador: comportamiento coherente.


## Hallazgo BE-07: Endpoints de creación sin idempotencia: reintentos móviles duplican tareas/solicitudes

**Área:** C — Backend y lógica de negocio

**Severidad:** Media

**Estado:** Confirmado

**Componente afectado:** proxy.js POST /api/wwp/tasks, /api/reposicion, /api/averias

**Evidencia encontrada:** proxy.js:12888-12930 — POST /api/wwp/tasks valida y crea incondicionalmente; no existe Idempotency-Key ni dedupe por id de cliente

**Situación actual:** El gate serializa las escrituras pero no deduplica: dos POST idénticos consecutivos crean dos tareas.

**Problema:** En red móvil de almacén/calle, un timeout con retry del cliente (o doble tap) crea tareas duplicadas. El folio de despachos tiene defensa de secuencia (nextDespachoFolio :440-449) pero la creación de tareas/reposiciones no tiene ninguna.

**Práctica estándar de la industria:** Idempotency-Key o id de cliente con lookup previo.

**Riesgo técnico:** Datos duplicados que ensucian KPIs y flujos de cadena (subtareas duplicadas).

**Riesgo para el negocio:** Doble picking/despacho de la misma orden si nadie nota el duplicado.

**Causa raíz probable:** El cliente y el servidor asumen red confiable; el id se genera server-side (wwpId).

**Recomendación:** Aceptar un clientRequestId generado por el frontend en los 4-5 endpoints de creación críticos y devolver el recurso existente si ya se procesó, en lugar de crear otro.

**Solución inmediata:** d.clientRequestId en POST de tareas con búsqueda de tarea reciente con ese campo.

**Solución definitiva:** Patrón uniforme en creaciones críticas + soporte en historial.html.

**Esfuerzo estimado:** Medio

**Prioridad:** P2

**Dependencias:** Cambio coordinado en el frontend (enviar el id).

**Criterio de aceptación:** Reenviar el mismo POST dos veces produce UNA tarea y dos respuestas 200 idénticas.

**Cómo validar la corrección:** Test de contrato con doble POST idéntico.


## Hallazgo BE-08: Ventana de pérdida ante muerte dura del proceso mientras PostgreSQL está caído (memoria diverge de la DB sin que nadie se entere)

**Área:** C — Backend y lógica de negocio

**Severidad:** Media

**Estado:** Confirmado

**Componente afectado:** storage-pg.js / boot.js

**Evidencia encontrada:** storage-pg.js:199-229 (la memoria es la verdad inmediata; save nunca lanza por red), :274-296 (reintentos infinitos con backoff mientras la DB no vuelva), :238-242 (coalescing a resync); boot.js:44-55 (drain solo en SIGTERM/SIGINT); export horario proxy.js:244-260

**Situación actual:** Riesgo residual explícitamente asumido por el diseño; la ventana normal (DB sana) es de milisegundos. El problema es la combinación DB-caída + muerte dura.

**Problema:** El diseño write-behind es correcto y el SIGTERM drena, pero si el proceso muere SIN señal (OOM-kill, crash del runtime) mientras la DB estuvo inaccesible un rato, se pierde todo lo escrito desde que empezó la caída de la DB, menos lo que alcanzó el export horario a JSON. Hoy no hay alerta activa cuando la cola crece o lastError persiste.

**Práctica estándar de la industria:** Alertar cuando el write-behind diverge; snapshot local inmediato ante cola creciente.

**Riesgo técnico:** Pérdida de horas de mutaciones en el peor caso compuesto.

**Riesgo para el negocio:** Pérdida de evidencia de entregas/estados del día en el escenario compuesto.

**Causa raíz probable:** Trade-off deliberado (disponibilidad sobre durabilidad estricta) sin la pata de observabilidad.

**Recomendación:** Agregar observabilidad activa: job cada 5 min que notifique a admins (createNotification, como ya hace checkDiskSpace) si queuePending>0 sostenido o lastError≠null por >10 min, y disparar un export a JSON inmediato cuando la cola supere N ops.

**Solución inmediata:** Job de vigilancia de pgStorage.health() con notificación a admins.

**Solución definitiva:** Ídem + export inmediato bajo cola creciente.

**Esfuerzo estimado:** Bajo

**Prioridad:** P2

**Dependencias:** Ninguna.

**Criterio de aceptación:** Simulando DB caída 15 min, los admins reciben notificación y el export extra se dispara.

**Cómo validar la corrección:** Test con DATABASE_URL rota a mitad de vuelo (harness con _internals).


## Hallazgo BE-09: JWT de 8 h viaja en query string para el stream SSE (persiste hallazgo R-10)

**Área:** C — Backend y lógica de negocio

**Severidad:** Media

**Estado:** Confirmado

**Componente afectado:** proxy.js SSE /api/wwp/notifications/stream

**Evidencia encontrada:** proxy.js:11202-11207 — `const token = (parsed.query||{}).token; … jwtVerify(token)`

**Situación actual:** Único hallazgo de la lista R-01..R-10 del 05-*.md relevante a backend que sigue igual (verificado hoy).

**Problema:** El token de sesión completo (válido 8 h, mismo poder que el header Authorization) queda en logs de acceso del edge de Railway, historiales y cualquier proxy intermedio. EventSource no permite headers, pero el token usado no está acotado.

**Práctica estándar de la industria:** Ticket de un solo uso para el handshake de streams.

**Riesgo técnico:** Replay de sesión desde logs durante la vida del token.

**Riesgo para el negocio:** Con el JWT completo filtrado, acceso a toda la API del usuario.

**Causa raíz probable:** Limitación de EventSource resuelta por el camino corto.

**Recomendación:** Emitir un ticket efímero solo-SSE (endpoint autenticado que devuelve un token de 60 s) o migrar el tiempo real al WebSocket /ws/wwp ya existente con auth en el primer frame.

**Solución inmediata:** POST /api/wwp/notifications/ticket (JWT en header) → ticket 60 s; el stream valida el ticket.

**Solución definitiva:** Unificar tiempo real en el WS con auth de primer frame y retirar SSE.

**Esfuerzo estimado:** Medio

**Prioridad:** P2

**Dependencias:** Cambio en core.js/historial.html (cliente SSE).

**Criterio de aceptación:** El JWT de sesión nunca aparece en una URL; ticket expirado → 401.

**Cómo validar la corrección:** Test e2e del stream con ticket fresco y vencido.


## Hallazgo BE-10: Costo CPU por guardado: los mutadores de tareas no declaran `touched`, forzando re-serialización de la colección completa en cada save

**Área:** C — Backend y lógica de negocio

**Severidad:** Baja

**Estado:** Probable

**Componente afectado:** proxy.js savers + storage-pg.js diff

**Evidencia encontrada:** storage-pg.js:141 (`ser = … JSON.stringify(item)` para toda fila no cubierta por touched); saveWwpTasks(list) sin opts en out-recon proxy.js:6365, geo :5029, enrich :5568 y la mayoría de handlers; B3 solo cableado en appendAuditLog (:3482) y notificaciones (:5859, :5881)

**Situación actual:** El tamaño real actual de wwp-tasks en producción no es verificable desde este repo (los 28 MB del comentario :5563 eran pre-R2) — de ahí estado Probable para el impacto; el mecanismo está confirmado.

**Problema:** Cada save de wwp-tasks re-stringifica TODAS las tareas para diffear (el mecanismo dirty-flags existe pero está a medio cablear). Con la colección aligerada post-R2 el costo es tolerable, pero crece linealmente con el histórico (mensajes de chat embebidos en tareas) y corre en el único hilo.

**Práctica estándar de la industria:** Declarar dirty-flags en mutaciones puntuales (PATCH toca 1-2 filas).

**Riesgo técnico:** Latencia creciente por save y CPU robada al resto de requests a medida que crece el histórico.

**Riesgo para el negocio:** Degradación lenta y difusa de toda la app.

**Causa raíz probable:** B3 se implementó donde más dolía (audit de 10.000 filas) y quedó a medias en el resto.

**Recomendación:** Completar el cableado touched en los ~20 mutadores puntuales de wwp-tasks (cambio mecánico) y medir el tamaño real de la colección en producción para decidir si el chat merece colección propia.

**Solución inmediata:** { touched: [tarea] } en los queueWrite('wwp-tasks') puntuales.

**Solución definitiva:** Ídem + decisión sobre colección de mensajes.

**Esfuerzo estimado:** Medio

**Prioridad:** P2

**Dependencias:** Confirmar tamaño real en producción.

**Criterio de aceptación:** Un PATCH de tarea stringifica O(1) filas (verificable con _internals.rowSnap).

**Cómo validar la corrección:** Harness que cuenta upserts tras PATCH puntual.


## Hallazgo BE-11: safeError incompleta y aplicada de forma inconsistente: mensajes internos de PG/Odoo llegan al cliente

**Área:** C — Backend y lógica de negocio

**Severidad:** Baja

**Estado:** Confirmado

**Componente afectado:** proxy.js manejo de errores HTTP

**Evidencia encontrada:** proxy.js:4780-4788 — safeError devuelve e.message crudo para todo error no reconocido ('Mensajes de validación propios son seguros' es un supuesto falso para errores de pg/Odoo); handlers que responden e.message directo sin safeError: login :11579, /api/odoo :8582, odoo/auth :7931

**Situación actual:** El patrón e.httpStatus ya existe y funciona en el dominio despachos; falta generalizarlo.

**Problema:** Errores inesperados (SQL, stack de Odoo, rutas) se filtran textualmente al cliente. No es explotable por sí solo pero facilita reconocimiento y confunde al usuario con mensajes técnicos.

**Práctica estándar de la industria:** Allowlist de mensajes seguros, no denylist de substrings.

**Riesgo técnico:** Fuga de detalles internos; diagnóstico difícil.

**Riesgo para el negocio:** Menor.

**Causa raíz probable:** safeError se diseñó como denylist de substrings.

**Recomendación:** Invertir el criterio: solo errores marcados como de-negocio (patrón e.httpStatus ya usado en despachos :10891) viajan con mensaje; el resto responde genérico y se loguea completo — unificable en el catch-all del hallazgo 2.

**Solución inmediata:** Marca 'mensaje seguro' vía e.httpStatus; sin marca → 'Error interno' + log.

**Solución definitiva:** Unificar en el catch-all.

**Esfuerzo estimado:** Bajo

**Prioridad:** P3

**Dependencias:** Hallazgo del catch-all.

**Criterio de aceptación:** Un error de pg simulado responde mensaje genérico y queda completo en el log.

**Cómo validar la corrección:** Test con DATABASE_URL rota en un endpoint mutador.


## Hallazgo BE-12: El health público (shallow) expone inventario de colecciones, conteos y último error de PG a visitantes anónimos

**Área:** C — Backend y lógica de negocio

**Severidad:** Baja

**Estado:** Confirmado

**Componente afectado:** proxy.js /api/health

**Evidencia encontrada:** proxy.js:8437-8454 — respuesta sin auth incluye tasksCount y `storage: pgStorage.health()`; health() devuelve el mapa completo colección→conteo y lastError con mensaje crudo de PG (storage-pg.js:764-776)

**Situación actual:** El detalle se agregó para depurar el cutover PG y quedó en la rama pública.

**Problema:** R-05 se corrigió bien (ya no hay preview de datos ni rutas), pero el shallow sigue enumerando los nombres de las ~30 colecciones internas, sus tamaños y mensajes de error de infraestructura — topología útil para un atacante e innecesaria para el healthcheck de Railway.

**Práctica estándar de la industria:** Healthcheck público mínimo; detalle autenticado.

**Riesgo técnico:** Reconocimiento de superficie.

**Riesgo para el negocio:** Menor.

**Causa raíz probable:** Conveniencia de debug durante el cutover.

**Recomendación:** Dejar el health público en {ok, build, timestamp} y mover storage/tasksCount/media a la rama ?deep=true que ya exige JWT (:8436), verificando antes que ningún monitor externo parsea esos campos.

**Solución inmediata:** Mover los campos a la rama deep.

**Solución definitiva:** Ídem.

**Esfuerzo estimado:** Bajo

**Prioridad:** P3

**Dependencias:** Confirmar consumidores del health.

**Criterio de aceptación:** curl anónimo a /api/health devuelve solo ok/build/timestamp.

**Cómo validar la corrección:** tests/e2e smoke-01 ajustado.


## Hallazgo BE-13: pbkdf2Sync (100k iteraciones) bloquea el event loop en cada intento de login

**Área:** C — Backend y lógica de negocio

**Severidad:** Baja

**Estado:** Confirmado

**Componente afectado:** proxy.js auth

**Evidencia encontrada:** proxy.js:3330-3341 — crypto.pbkdf2Sync(…, 100000, 64, 'sha512') en hashPassword y verifyPassword; invocado en el request path del login (:11541)

**Situación actual:** Visible como microcortes solo en ráfagas (7:00 AM todo el equipo).

**Problema:** Cada verificación de contraseña bloquea el único hilo ~50-100 ms. El rate limit es por email (:4711-4718), no por IP, así que ráfagas contra emails válidos queman CPU del proceso único. Con 30 usuarios el impacto normal es nulo; es un vector DoS barato de cerrar.

**Práctica estándar de la industria:** Hash de contraseña asíncrono fuera del event loop.

**Riesgo técnico:** Microcortes de latencia global durante ráfagas de login.

**Riesgo para el negocio:** Menor.

**Causa raíz probable:** API sync más simple.

**Recomendación:** Cambiar a crypto.pbkdf2 async (util.promisify, corre en el threadpool, mismo hash) y agregar rate limit de login también por IP.

**Solución inmediata:** Variante async con firma idéntica.

**Solución definitiva:** Ídem + rate limit por IP.

**Esfuerzo estimado:** Bajo

**Prioridad:** P3

**Dependencias:** Ninguna.

**Criterio de aceptación:** Login concurrente ×10 no degrada un GET simultáneo más de 10 ms.

**Cómo validar la corrección:** Micro-benchmark local (autocannon).


## Hallazgo BE-14: Flags de disparo diario de jobs viven solo en memoria: un redeploy dentro de la ventana duplica alertas

**Área:** C — Backend y lógica de negocio

**Severidad:** Baja

**Estado:** Confirmado

**Componente afectado:** proxy.js jobs programados

**Evidencia encontrada:** checkDueTodayAlert: _dueTodayAlertFiredDate en memoria, ventana 20:00-20:05 RD (proxy.js:6270, :6281-6283); invWatchdog: _invWatchdogFiredDate, ventana 08:00-08:05 (:6702, :6710-6711, :6722)

**Situación actual:** Ventanas de 5 minutos, probabilidad baja pero recurrente con deploys vespertinos.

**Problema:** Si el proceso se reinicia entre las 20:00 y 20:05 (o 08:00-08:05), el flag se pierde y la alerta se envía dos veces a todo el equipo. Molestia, no pérdida — pero las alertas duplicadas erosionan la confianza en las notificaciones.

**Práctica estándar de la industria:** Estado de scheduling persistente.

**Riesgo técnico:** Ninguno.

**Riesgo para el negocio:** Fatiga de alertas.

**Causa raíz probable:** Estado efímero por simplicidad.

**Recomendación:** Persistir la fecha de último disparo en una clave kv del storage (patrón ya usado por wwpStateVersion :4920-4928) y releerla al boot.

**Solución inmediata:** saveJson de la fecha de disparo + lectura al boot.

**Solución definitiva:** Ídem para los 3 jobs con ventana diaria.

**Esfuerzo estimado:** Bajo

**Prioridad:** P3

**Dependencias:** Ninguna.

**Criterio de aceptación:** Reinicio simulado dentro de la ventana NO re-dispara.

**Cómo validar la corrección:** Test unitario del guard con la kv precargada.


## Hallazgo BE-15: Código muerto en el dispatcher: endpoints _fix desactivados con secreto hardcodeado y variables de auth Odoo sin uso

**Área:** C — Backend y lógica de negocio

**Severidad:** Baja

**Estado:** Confirmado

**Componente afectado:** proxy.js higiene

**Evidencia encontrada:** 4 bloques `if (false && reqPath === '/api/_fix/…')` (proxy.js:7939, :8024, :8092, :8194) — uno con FIX_SECRET hardcodeado '93a0c2…' (:7940); authBusy/authQueue declaradas y jamás usadas (:7603-7604) — sin ellas, N requests simultáneas con odooUid nulo disparan N authenticate() en paralelo (estampida inofensiva)

**Situación actual:** Patrón deliberado de desactivar en vez de borrar, heredado de migraciones ejecutadas.

**Problema:** Ramas muertas de ~300 líneas con secretos dentro del archivo más caliente del proyecto. La fuente ya no es descargable (R-03 corregido, :20657), así que el riesgo es residual, pero cambiar false→true reactivaría un endpoint con secreto conocido, y la masa muerta confunde.

**Práctica estándar de la industria:** Las migraciones ejecutadas se borran; viven en el historial de git.

**Riesgo técnico:** Confusión y reactivación accidental.

**Riesgo para el negocio:** Menor.

**Causa raíz probable:** Precaución mal calibrada (miedo a perder el código).

**Recomendación:** Eliminar los 4 bloques if(false) y las 2 variables muertas (git es el archivo histórico); adoptar la convención de borrar los _fix de un solo uso tras ejecutarlos.

**Solución inmediata:** Poda de los bloques y variables.

**Solución definitiva:** Convención documentada en CLAUDE.md.

**Esfuerzo estimado:** Bajo

**Prioridad:** P3

**Dependencias:** Ninguna.

**Criterio de aceptación:** grep 'if (false' proxy.js → 0; grep authBusy → 0.

**Cómo validar la corrección:** Suite e2e verde tras la poda.



---

# Área D — APIs e integraciones

**Resumen del área:** La superficie de API vive íntegra en proxy.js (20.964 líneas): un dispatcher lineal de ~245 condicionales sobre http nativo que sirve ~238 endpoints REST, un stream SSE por usuario y un WebSocket propio con framing manual. La cobertura de autenticación es hoy casi total (230 usos de requireJwt + RBAC por rol/sección/participante; los endpoints públicos que quedan son legítimos: login, health shallow, app-version, vapid-public-key, maps-key) — los huecos que señaló la auditoría previa (R-06B, /api/odoo abierto) están corregidos y verificados. La integración crítica con Odoo (JSON-RPC, timeout 20 s, UID cacheado) tiene fail-open auditable en los gates de despacho, pero carece de reintentos, circuit breaker y monitoreo activo del enlace; las demás integraciones (OpenAI para agentes, R2 para media, web-push, Codex Bridge y backup por token dedicado) están razonablemente contenidas y degradan sin tumbar la operación. El hallazgo grave es el WebSocket /ws/wwp: acepta conexiones sin ninguna autenticación y difunde a todos los sockets el objeto completo de cada tarea mutada y las notificaciones de todos los usuarios — exposición de datos operativos (clientes, direcciones) a cualquier cliente anónimo de Internet.

**Madurez:** 3/5 — La superficie de API está muy por encima de lo que sugiere su forma (un dispatcher de 21k líneas sin framework): autenticación prácticamente total con revocación inmediata, RBAC en tres capas, proxy Odoo con allowlist, rate limits donde duele, fail-open auditable frente al ERP, caches TTL bien calibrados y degradación heurística de la IA — los hallazgos de la auditoría previa fueron corregidos de verdad. Pero no llega a 4 por tres razones concretas: (1) el WebSocket sin autenticación que difunde datos de tareas y notificaciones a clientes anónimos es una fuga activa en producción que contradice todo el trabajo de RBAC del resto del sistema; (2) la integración más crítica (Odoo) carece de circuit breaker y de monitoreo activo del enlace, y su interacción con los write-gates degrada en serie a todo el equipo durante una caída; (3) el contrato no tiene fuente de verdad (doc obsoleta a días de escrita, shapes de respuesta inconsistentes, sin idempotencia en creaciones). Para 1 desarrollador y 29 usuarios la arquitectura elegida es apropiada — la brecha es de endurecimiento y observabilidad, no de diseño.

## Fortalezas verificadas

- Cobertura de autenticación casi total y verificada endpoint por endpoint: 230 usos de requireJwt, RBAC en tres capas (requireRole, requireSectionPerm con bypass admin explícito, isTaskParticipant anti-IDOR) y relectura del usuario en cada request (proxy.js:3350-3368) que hace efectiva la revocación inmediata de sesiones — los hallazgos R-06B de la auditoría previa (averías/analysis/transfer sin JWT) están corregidos
- El proxy genérico /api/odoo quedó endurecido: JWT + roles ['admin','manager','ventas'] + allowlist de métodos de SOLO lectura (proxy.js:8568 'ODOO_PROXY_ALLOWED = read, search, search_read…'), cerrando el RPC arbitrario con la API key privilegiada que existía antes
- Fail-open de los gates Odoo (OUT/PICK) auditable y notificado: ante Odoo caído no se traba la operación física y cada bypass queda en el audit log ('out_gate_fail_open' proxy.js:13378, 'out_complete_gate_fail_open' :13313) más notificación a admins (notifyAdminSyncError :6054) — decisión operativa correcta para un almacén real
- Tokens dedicados con comparación timing-safe para Codex Bridge (proxy.js:3419-3440) y backup externo (requireBackupToken :3444), con 503 explícito si la env no está configurada; login con rate limit por email (5 intentos/15 min, :4706-4719), PBKDF2 100k iteraciones y revocación de sesiones al resetear contraseña (:11702)
- Caching pragmático por costo real: TTLs por endpoint caro (EO metrics 5 min :2487, fotos empleado Odoo 1 h :475, fotos producto 12 h con tope de entradas :493, briefs IA 30 min :1781), ETag+304 en /api/wwp/tasks con hash anti-colapso (:12749-12760), gzip con caché por mtime, y archivado por cadena que reduce el payload del listado
- media.js es una capa única R2/disco bien diseñada: fallback a disco sin pérdida si R2 falla en el put (media.js:119-124), lectura con fallback para migración sin downtime, rechazo explícito de path traversal (:68-75) y self-test incluido
- Los agentes IA degradan a modo heurístico si OpenAI falla o no hay key (proxy.js:14488+ con fallbackAgentGroupReply :4541) — ninguna feature de IA puede tumbar un flujo operativo
- El contrato realtime está bien pensado del lado REST: SSE es por usuario (sseClients keyed por userId), el cliente re-fetcha vía REST con RBAC correcto al recibir tasks:changed (core.js:1730-1747), y la versión de estado WWP se persiste para no retroceder en redeploys (B13, proxy.js:4914-4929)
- Defensas perimetrales presentes: CORS con allowlist (ALLOWED_ORIGIN), CSP, HSTS condicional, timeouts anti-slowloris (proxy.js:20824-20826), límite de body 50 MB, validación de fotos por MIME/extensión/tamaño (:4790-4808), y denylist por patrón para JSON de negocio servidos como estático (:20670)
- Existe suite e2e Playwright (tests/e2e/smoke-01..07) que cubre el contrato de arranque, login y secciones — el contrato core.js/theme.css versionado por hash está verificado por smoke-05

## Hallazgo API-01: WebSocket /ws/wwp sin autenticación difunde tareas completas y notificaciones de todos los usuarios a clientes anónimos

**Área:** D — APIs e integraciones

**Severidad:** Crítica

**Estado:** Confirmado

**Componente afectado:** proxy.js — server.on('upgrade') + broadcastWwp/broadcastWwpTasks

**Evidencia encontrada:** proxy.js:20775-20799 (handler upgrade: solo valida sec-websocket-key, ningún requireJwt/jwtVerify; verificado por grep en el rango) + proxy.js:5068-5077 (broadcastWwpTasks incluye 'task' completo en el payload pese al comentario 'No incluir tasks en el broadcast') + proxy.js:5793 (broadcastWwp('notification', { notif, userId: uid }) a TODOS los sockets) + core.js:1751 (el cliente filtra 'msg.userId === _user.id' — el filtrado es client-side, prueba que el servidor manda todo a todos)

**Problema:** Cualquier cliente de Internet puede conectarse a wss://opsat.up.railway.app/ws/wwp sin token y recibir en tiempo real: el objeto completo de cada tarea creada/modificada (título, cliente, dirección de entrega, gpsCoords, items, evidencias) vía eventos task_created/task_updated/message_created (llamadas en proxy.js:13048, 13848, 12880) y todas las notificaciones de todos los usuarios (título+mensaje con nombres de clientes).

**Práctica estándar de la industria:** Autenticar el upgrade (token en query como ya hace el SSE, o subprotocolo Sec-WebSocket-Protocol) y/o difundir solo señales sin datos (version bump + taskId), dejando que el cliente re-fetche vía REST con RBAC — patrón que el propio código ya implementa como rama 'nuevo protocolo' en core.js:1730.

**Riesgo técnico:** Exposición continua de datos sin necesidad de credenciales; imposible de detectar en logs de acceso normales (una conexión WS de larga vida).

**Riesgo para el negocio:** Fuga de PII de clientes (nombres, direcciones, teléfonos de receptores, coordenadas GPS de entregas) y de inteligencia operativa del negocio a cualquier tercero que descubra la URL.

**Causa raíz probable:** El WS nació como canal de 'invalidación de caché' (hello + version) y los broadcasts fueron acumulando payload (task, notif) sin revisar que el upgrade nunca tuvo auth; el comentario de la línea 5069 documenta la intención correcta que el código no cumple.

**Recomendación:** Dejar de incluir 'task' y 'notif' en los broadcasts (solo {event, action, taskId, version} — el cliente ya re-fetcha por REST) y exigir token JWT en el upgrade, validado como en el SSE.

**Solución inmediata:** Cambio de ~5 líneas en broadcastWwpTasks/_emitNotif para vaciar el payload de datos; la rama de re-fetch REST ya existe en core.js:1729-1748.

**Solución definitiva:** Exigir ?token= en el upgrade (jwtVerify + relectura de usuario activo) y mantener los broadcasts sin datos.

**Esfuerzo estimado:** Bajo

**Prioridad:** P0

**Dependencias:** Ninguna externa; bump de APP_BUILD y re-estampar core.js si se toca el cliente.

**Criterio de aceptación:** Una conexión anónima a /ws/wwp es rechazada (o solo recibe {event:'hello', version}); crear/editar una tarea con un socket anónimo conectado no entrega ningún campo de la tarea ni notificaciones.

**Cómo validar la corrección:** Con wscat/websocat sin token contra prod: conectar, crear una tarea de prueba desde la app y verificar que el socket no recibe payload con datos; test e2e nuevo que lo fije.

**Verificación adversarial (CONFIRMADO):** Reproduje las cuatro evidencias tal cual hoy. El upgrade en proxy.js:20775 acepta cualquier socket con solo calcular Sec-WebSocket-Accept — ningún requireJwt/jwtVerify, a diferencia del SSE (11202) que exige token. broadcastWwpTasks emite el objeto `task` completo (título, cliente, dirección, gpsCoords, items, evidencias) y _emitNotif difunde `notif` completo a TODOS los sockets, con el filtrado hecho solo en el cliente (core.js:1751), lo que confirma que el servidor manda todo a todos. El comentario de la línea 5069 documenta la intención (no incluir datos) que el código incumple, así que no es una decisión deliberada sino un descuido real. Matiz menor: la rama "nuevo protocolo" del cliente conmuta por msg.tasks (array plural), no por msg.task (singular), por lo que el cliente oficial ya re-fetchea vía REST; pero esto no mitiga la fuga porque un wscat anónimo igual recibe msg.task/notif crudos por el cable. La severidad Crítica/P0 se sostiene: es divulgación no autenticada de PII de terceros (direcciones, GPS, teléfonos) a cualquiera en Internet, cuyo impacto no depende del tamaño interno del sistema; el endpoint /ws/wwp es trivialmente descubrible en el bundle público core.js:1701. · Evidencia re-vista: proxy.js:20775-20821 (upgrade handler: solo valida sec-websocket-key, sin jwtVerify — contrasta con SSE en proxy.js:11202-11210 que sí exige ?token= + jwtVerify); proxy.js:5068-5077 (broadcastWwpTasks incluye `task,` en el payload pese al comentario "No incluir tasks en el broadcast"); proxy.js:5793 (broadcastWwp('notification',{notif,userId:uid}) a todos los sockets); core.js:1751 (filtrado client-side msg.userId===_user.id).


## Hallazgo API-02: Integración Odoo sin reintentos ni circuit breaker; con Odoo lento, los awaits dentro del write-gate serializan las mutaciones de todo el equipo

**Área:** D — APIs e integraciones

**Severidad:** Alta

**Estado:** Confirmado

**Componente afectado:** proxy.js — odooRpc/odooCall + gate de escritura por dominio

**Evidencia encontrada:** proxy.js:7605-7649 (odooRpc: un solo intento, timeout ODOO_RPC_TIMEOUT_MS=20 s, sin retry ni breaker) + proxy.js:7851-7874 (gate 'tasks-sdv' serializa TODOS los no-GET de /api/wwp/tasks y /api/sdv con backstop de 60 s) + proxy.js:13290-13425 (el PATCH de tarea hace varios await odooCall dentro del gate: OUT gate, gate de validación, gate de PICK)

**Problema:** No hay circuit breaker: con Odoo caído, cada mutación de tarea sigue intentando 1-3 llamadas RPC de hasta 20 s cada una ANTES de aplicar el fail-open, y mientras tanto retiene el lock del dominio 'tasks-sdv'. Con Odoo caído 1 hora, cada cambio de estado tarda 20-60 s y el resto del equipo espera en cola serial detrás. Tampoco hay reintento ante fallos transitorios (un blip de red = fail-open innecesario que ensucia la auditoría).

**Práctica estándar de la industria:** Breaker simple por estado (tras N fallos consecutivos, marcar Odoo 'down' X segundos y aplicar fail-open inmediato sin esperar timeout) + 1 reintento con backoff corto para errores de red transitorios en lecturas.

**Riesgo técnico:** Degradación multiplicativa: timeout de 20 s × llamadas por request × cola serial del gate; el backstop de 60 s puede soltar el lock con el handler aún corriendo, perdiendo la protección anti lost-update justo bajo estrés.

**Riesgo para el negocio:** En una caída del ERP SaaS, la app —cuyo valor es precisamente seguir operando— se vuelve casi inutilizable para cerrar despachos durante la ventana de caída.

**Causa raíz probable:** El cliente Odoo se escribió mínimo (correcto) y los gates de consistencia B1/B2 se añadieron después; nadie modeló el comportamiento compuesto timeout × serialización.

**Recomendación:** Flag 'odooDown' con ventana de 60 s para fail-open inmediato en los gates, y luego un breaker con half-open + retry único en lecturas; bajar el timeout de los gates de escritura a 8-10 s.

**Solución inmediata:** Timestamp del último fallo en odooRpc: si falló hace <60 s, los 3 gates hacen fail-open sin llamar a Odoo (~20 líneas).

**Solución definitiva:** Breaker con half-open (probar 1 llamada cada 60 s), reintento único para ECONNRESET/timeout en lecturas, timeout diferenciado por contexto.

**Esfuerzo estimado:** Medio

**Prioridad:** P1

**Dependencias:** Coordinar con la sesión que corre las olas del plan 08 para no chocar en proxy.js.

**Criterio de aceptación:** Con Odoo inaccesible, el segundo PATCH de tarea consecutivo responde en <2 s con fail-open auditado, y 5 mutaciones concurrentes terminan todas en <10 s.

**Cómo validar la corrección:** Harness en tests/ apuntando ODOO_URL a un puerto muerto, midiendo latencias de PATCH /api/wwp/tasks/:id en serie y en paralelo, antes y después.

**Verificación adversarial (CONFIRMADO):** La evidencia se reproduce hoy con desvío de líneas mínimo: odooRpc es un solo intento con timeout de 20 s por defecto y sin retry ni breaker; el gate 'tasks-sdv' serializa todos los no-GET de /api/wwp/tasks, /api/sdv y /api/_fix/ con backstop de 60 s; y el PATCH de tarea encadena hasta 3-4 awaits a Odoo dentro del gate (ensureOutPendienteCandidatos→sdvComputePickStatus son 2 llamadas, más el check del OUT confirmado, más authenticate si no hay uid). No existe mitigación: los greps por breaker/odooDown/retry solo encuentran regex de clasificación de error para responder 503 después de agotar el timeout, y un job de fondo (out-recon, cada 10 min) se encola en el mismo dominio agravando la cola con Odoo caído. No es decisión deliberada documentada: el fail-open sí lo es, pero el comentario del gate (proxy.js:7847-7848) asume que el backstop "no debería activarse jamás" porque los timeouts son menores — falso para el flujo de completar (hasta ~80 s), lo que corrobora el riesgo de soltar el lock con el handler vivo. Alta/P1 es proporcionado: el valor declarado de la app en los propios comentarios es seguir operando con el ERP caído, y ese es exactamente el escenario degradado. · Evidencia re-vista: proxy.js:7605-7606 (ODOO_RPC_TIMEOUT_MS=20000), proxy.js:7609-7650 (odooRpc un intento, sin retry/breaker), proxy.js:7851-7874 (gate 'tasks-sdv' + backstop 60 s en 7865-7868), proxy.js:13288-13425 (PATCH: awaits a odooCall en gates OUT/validación/PICK), proxy.js:1037-1042 (sdvComputePickStatus = 2 odooCalls), proxy.js:1286-1305 (ensureOutPendienteCandidatos), proxy.js:6375-6378 (out-recon en el mismo dominio cada 10 min), proxy.js:17023-17026 (clasificación odooDown post-timeout, no breaker)


## Hallazgo API-03: Monitoreo del enlace Odoo débil: el health shallow reporta un uid cacheado como 'ok', sin chequeo vivo ni alerta proactiva de caída

**Área:** D — APIs e integraciones

**Severidad:** Media

**Estado:** Confirmado

**Componente afectado:** proxy.js — /api/health

**Evidencia encontrada:** proxy.js:8449 ('odoo: { ok: !!odooUid, uid: odooUid || null }' — odooUid se setea en el boot y solo se anula ante 'Access Denied' en :8579 y :6535, nunca por caída de red) + proxy.js:6054 (notifyAdminSyncError solo se dispara desde los gates, no hay ping periódico)

**Problema:** El endpoint público de monitoreo miente por diseño: tras el boot, odoo.ok=true aunque Odoo lleve horas caído. El chequeo real (?deep=true) requiere JWT, así que un monitor externo simple no puede usarlo. No existe job que pruebe el enlace y alerte a admins — se entera el primer usuario que choca con un gate.

**Práctica estándar de la industria:** Health con señal real (última llamada Odoo exitosa hace <N min) + ping ligero periódico con alerta única al transicionar a 'down'.

**Riesgo técnico:** Falsa confianza en el monitoreo; los fail-open auditables se acumulan sin que nadie mire hasta la conciliación.

**Riesgo para el negocio:** Despachos validados sin verificación contra el ERP durante ventanas de caída no detectadas → divergencias de inventario que cuestan horas de conciliación.

**Causa raíz probable:** El health se endureció por fuga de datos (R-05/R-06C) pero la semántica de odoo.ok no se revisó.

**Recomendación:** Exponer lastOdooOkAt en el health shallow y añadir un ping periódico a Odoo con notificación a admins al caer.

**Solución inmediata:** Actualizar un timestamp en cada RPC exitosa dentro de odooRpc y reportarlo en /api/health en vez de !!odooUid.

**Solución definitiva:** Job cada 5 min con search_count trivial; al transicionar ok→fail, notifyMany a admins una vez + registro en audit; opcional monitor externo (UptimeRobot) contra /api/health.

**Esfuerzo estimado:** Bajo

**Prioridad:** P1

**Dependencias:** Ninguna.

**Criterio de aceptación:** Matando la salida a Odoo en dev, en ≤5 min los admins reciben 'Odoo caído' y /api/health refleja lastOdooOkAt estancado.

**Cómo validar la corrección:** Local con ODOO_URL inválida + observar /api/health y wwp-notifications.json.

**Verificación adversarial (CONFIRMADO):** La evidencia reproduce hoy tal cual: proxy.js:8449 reporta odoo.ok = !!odooUid en el health público, y odooUid solo se anula ante errores de auth (:6535, :8579), nunca por timeout o caída de red (odooRpc rechaza sin tocar odooUid), por lo que tras la primera RPC exitosa ok=true queda congelado durante cualquier caída. Busqué activamente el fix y no existe: sin lastOdooOkAt, y ningún job periódico prueba el enlace con alerta (invWatchdog solo corre 1 vez/día a las 08:00 y ante Odoo caído solo hace console.warn; reconcileOutPendiente cada 10 min hace early-return sin llamar a Odoo cuando no hay targets, y es fail-open con console.warn). La única detección es reactiva vía gates (notifyAdminSyncError en 13379 al chocar un usuario), cosa que el hallazgo ya reconoce. Única imprecisión menor: odooUid se setea lazy en la primera RPC, no literalmente 'en el boot' — funcionalmente idéntico; severidad Media/P1 no está inflada dado que los gates son fail-open y el fix es de esfuerzo bajo. · Evidencia re-vista: proxy.js:8449 (odoo: { ok: !!odooUid } verbatim), proxy.js:6535 y 8579 (únicos sitios que anulan odooUid, solo auth), proxy.js:8436 (deep requiere JWT), proxy.js:6054 (notifyAdminSyncError, solo llamado desde gates en 13314/13379/13422), proxy.js:7609-7670 (odooRpc/odooCall sin timestamp de éxito), proxy.js:6704-6746 (invWatchdog 1x/día, console.warn ante caída), proxy.js:6329-6378 (out-recon fail-open sin alerta)


## Hallazgo API-04: Evidencia fotográfica (fotos de entregas, averías, adjuntos SDV) servida sin autenticación

**Área:** D — APIs e integraciones

**Severidad:** Media

**Estado:** Confirmado

**Componente afectado:** proxy.js — servido de media + /api/empaque/foto

**Evidencia encontrada:** proxy.js:20589-20593 (comentario: 'Se sirve SIN Authorization a propósito: las <img>/<video> del cliente no mandan cabeceras (el endurecimiento por URL firmada es un paso posterior de Fase 1)') + proxy.js:20601-20611 (GET /wwp-fotos/, /sdv-adjuntos/, /desp-fotos/… sin guard) + proxy.js:20244-20255 (/api/empaque/foto/:fname sin requireJwt) + proxy.js:20231 (nombres parcialmente predecibles: id + '_' + Date.now() + '.ext')

**Problema:** Toda la evidencia operativa (fotos de entregas en casas de clientes, averías, adjuntos SDV) es accesible por URL sin sesión. La protección real es la no-adivinabilidad del nombre, pero varios patrones incluyen timestamps y las URLs viajan hoy en broadcasts WS sin auth (hallazgo P0), en notificaciones y en exports.

**Práctica estándar de la industria:** URLs firmadas con expiración (R2 lo soporta nativo) o gate por cookie de sesión para <img> (mismo origen sí manda cookies).

**Riesgo técnico:** Enumeración parcial por fuerza bruta de timestamps; una URL filtrada es permanente (cache 1 h - 1 año).

**Riesgo para el negocio:** Fotos del interior de casas de clientes con dirección asociada accesibles sin credenciales — el tipo de fuga que daña la confianza del cliente final.

**Causa raíz probable:** Limitación real de <img> sin cabeceras + decisión explícita de posponer el endurecimiento (documentada en el código como paso pendiente de Fase 1).

**Recomendación:** Ejecutar el paso pendiente de Fase 1: cookie de sesión HttpOnly para paths de media o URLs firmadas de R2 con TTL; mientras tanto, cerrar el WS (P0) que regala las URLs.

**Solución inmediata:** Cerrar el hallazgo P0 del WS; asegurar que ningún nombre nuevo use solo timestamp (añadir 8+ bytes aleatorios donde falten).

**Solución definitiva:** Cookie de sesión emitida al login solo para media (mismo origen) o URLs firmadas R2 con TTL.

**Esfuerzo estimado:** Medio

**Prioridad:** P2

**Dependencias:** Hallazgo WS (P0); si se opta por URL firmada, tocar historial.html donde se construyen las <img>.

**Criterio de aceptación:** GET a una URL de /wwp-fotos/ conocida sin sesión responde 401/403; con sesión, la foto carga sin regresión en iOS.

**Cómo validar la corrección:** curl sin cabeceras a una foto real tras el cambio; smoke e2e de carga de evidencia en el drawer.


## Hallazgo API-05: GET /api/wwp/tasks/:id/messages sin control de participación: cualquier usuario autenticado lee el chat de cualquier tarea

**Área:** D — APIs e integraciones

**Severidad:** Media

**Estado:** Confirmado

**Componente afectado:** proxy.js — mensajes de tarea

**Evidencia encontrada:** proxy.js:12766-12774 (solo requireJwt; devuelve task.messages sin comprobar isTaskParticipant ni rol, mientras que el listado GET /api/wwp/tasks sí filtra por participación en :12688-12709 y las mutaciones usan isTaskParticipant)

**Problema:** El modelo de visibilidad del listado (assistants solo ven sus tareas y su cadena) se salta leyendo mensajes directamente por id: un assistant con un taskId ajeno (visible en broadcasts, notificaciones o URLs compartidas) lee el chat completo de esa tarea, incluyendo fotos y coordinación interna.

**Práctica estándar de la industria:** Aplicar el mismo predicado de autorización en la lectura puntual que en el listado (isTaskParticipant || rol admin/manager/ventas-con-sdv).

**Riesgo técnico:** IDOR de lectura; inconsistencia entre superficies del mismo recurso.

**Riesgo para el negocio:** Bajo-medio en un equipo de 29 personas, pero el chat puede contener datos de clientes y discusiones de gestión.

**Causa raíz probable:** El endpoint de mensajes es anterior al endurecimiento anti-IDOR (da267a4) que solo cubrió mutaciones.

**Recomendación:** Añadir el check de participación/rol al GET de messages y extraer un helper canTaskRead(jp, task) para todas las lecturas puntuales por id.

**Solución inmediata:** 6 líneas: admin/manager pasan; assistant requiere isTaskParticipant; ventas requiere task.sdvId.

**Solución definitiva:** Helper canTaskRead reutilizado en messages, pick-status, out-badge y demás lecturas por id.

**Esfuerzo estimado:** Bajo

**Prioridad:** P2

**Dependencias:** Ninguna.

**Criterio de aceptación:** Un assistant no participante recibe 403 al pedir messages de una tarea ajena; participantes y managers siguen leyendo normal.

**Cómo validar la corrección:** Test e2e con dos usuarios assistant y una tarea de cada uno, cruzando ids.


## Hallazgo API-06: Llamadas a OpenAI sin timeout ni control de gasto

**Área:** D — APIs e integraciones

**Severidad:** Media

**Estado:** Confirmado

**Componente afectado:** proxy.js — aiComplete y fetches directos de agentes

**Evidencia encontrada:** proxy.js:1759-1770 (aiComplete: fetch sin AbortController/signal — grep de 'AbortController|signal:' en todo proxy.js devuelve cero) + :4519, :14702, :15502 (tres fetches directos más, mismo patrón) + :1746 (modelo CODEX_AUDITOR_MODEL='gpt-5.5' por env)

**Problema:** Sin timeout explícito, una respuesta colgada de OpenAI retiene el request hasta los defaults de undici (~5 min). No hay presupuesto, contador de tokens ni rate limit propio en los endpoints de chat IA más allá de JWT + requireAgentOwner (:3582) y los caches de 30 min de los briefs; un usuario ejecutivo puede generar gasto ilimitado en bucle. Features dependientes: parte del día del ops-agent, chat de agentes, mesa de agentes con rutinas programadas (tick 60 s, :4243), auditor de procesos — todas con fallback heurístico, ninguna crítica.

**Práctica estándar de la industria:** AbortSignal.timeout(30-60 s) por llamada, contador diario de llamadas/tokens con tope suave y registro del costo.

**Riesgo técnico:** Requests colgados minutos consumiendo sockets (los endpoints IA no están gateados, no bloquean mutaciones); rutinas programadas reintentando contra una API degradada.

**Riesgo para el negocio:** Factura OpenAI sin techo controlado desde la app (mitigable con límite en la cuenta OpenAI — no verificable desde el repo); percepción de 'la app se colgó'.

**Causa raíz probable:** Integración IA crecida por acreción: 4 puntos de fetch duplicados en vez de pasar todos por aiComplete.

**Recomendación:** AbortSignal.timeout(60s) en los 4 fetches, unificarlos sobre aiComplete, y añadir contador diario con tope configurable; verificar el hard limit en la cuenta OpenAI.

**Solución inmediata:** signal: AbortSignal.timeout(60_000) en los 4 fetches; unificar los 3 directos sobre aiComplete.

**Solución definitiva:** Contador diario en kv (llamadas + tokens estimados) con tope por env y aviso a admin al 80%.

**Esfuerzo estimado:** Bajo

**Prioridad:** P2

**Dependencias:** Confirmar con Gabriel el tope de gasto aceptable.

**Criterio de aceptación:** Una llamada IA contra un endpoint que no responde aborta en ≤60 s con fallback heurístico; el contador diario es visible.

**Cómo validar la corrección:** Harness con OPENAI apuntado a un mock que no responde; verificar latencia y fallback.


## Hallazgo API-07: /api/maps-key entrega la key de Google Maps sin autenticación — la mitigación declarada (restricción por dominio en GCP) no es verificable desde el repo

**Área:** D — APIs e integraciones

**Severidad:** Media

**Estado:** Requiere validación

**Componente afectado:** proxy.js — /api/maps-key

**Evidencia encontrada:** proxy.js:8425-8430 ('— Google Maps API key (sin auth; restringido por dominio en GCP) —' … res.end(JSON.stringify({ key: process.env.GOOGLE_MAPS_API_KEY || '' })) con Cache-Control public 1 h)

**Problema:** Cualquiera puede obtener la key con un GET anónimo. Si la restricción por referrer en Google Cloud no está configurada (o es laxa), terceros pueden facturar contra la cuenta de Maps de la empresa. Desde el código no se puede confirmar la restricción.

**Práctica estándar de la industria:** Key pública de Maps siempre con restricción por referrer + restricción de APIs habilitadas + alerta de presupuesto en GCP.

**Riesgo técnico:** Ninguno directo en la app.

**Riesgo para el negocio:** Facturación ajena en la cuenta GCP si la restricción no existe.

**Causa raíz probable:** Las <script src> de Maps no mandan Authorization; decisión razonable si y solo si la restricción GCP existe.

**Recomendación:** Verificar en la consola GCP la restricción por referrer (opsat.up.railway.app + localhost) y por API, con alerta de presupuesto; documentarlo en RAILWAY.md.

**Solución inmediata:** Revisión de la config GCP por Gabriel (10 min).

**Solución definitiva:** Mantener el endpoint público (patrón estándar) con la restricción documentada y revisada tras cada rotación.

**Esfuerzo estimado:** Bajo

**Prioridad:** P2

**Dependencias:** Acceso a la consola GCP.

**Criterio de aceptación:** Usar la key desde un origen ajeno falla con RefererNotAllowed.

**Cómo validar la corrección:** Probar la key en una página externa y confirmar el rechazo de Google.


## Hallazgo API-08: SSE con token JWT en query string y sin relectura del estado del usuario

**Área:** D — APIs e integraciones

**Severidad:** Media

**Estado:** Confirmado

**Componente afectado:** proxy.js — /api/wwp/notifications/stream + core.js cliente

**Evidencia encontrada:** proxy.js:11202-11210 (token por parsed.query.token, validado solo con jwtVerify — no relee usuario activo como sí hace requireJwt :3355-3363) + core.js:1646 ('/api/wwp/notifications/stream?token=' + encodeURIComponent(_token))

**Problema:** Dos efectos: (1) el JWT completo queda en URLs — logs de Railway y proxies intermedios; (2) un usuario desactivado por admin sigue recibiendo su stream de notificaciones hasta que el token expire (máx 8 h), cuando el resto de la API lo corta al instante.

**Práctica estándar de la industria:** EventSource no permite cabeceras, así que el token en query es el workaround aceptado — pero con ticket efímero dedicado al stream, o al menos revalidando el usuario al conectar.

**Riesgo técnico:** Token de 8 h persistido en logs; ventana de revocación inconsistente con el resto del sistema.

**Riesgo para el negocio:** Bajo: requiere acceso a logs de Railway (ya privilegiado).

**Causa raíz probable:** Limitación de EventSource + reutilización del access token general en vez de un ticket efímero.

**Recomendación:** Revalidar el usuario activo al conectar el stream y cortar SSE/WS del usuario al desactivarlo; a mediano plazo, ticket de un solo uso y 60 s de vida canjeado en la query.

**Solución inmediata:** Replicar la relectura de requireJwt en el handler del stream + destroy dirigido de las conexiones del usuario al desactivarlo (sseClients ya está indexado por userId).

**Solución definitiva:** Ticket efímero emitido por POST autenticado (patrón ticket-based SSE).

**Esfuerzo estimado:** Bajo

**Prioridad:** P2

**Dependencias:** Ninguna.

**Criterio de aceptación:** Desactivar un usuario cierra su stream en <10 s; los logs de acceso no contienen access tokens reutilizables (variante ticket).

**Cómo validar la corrección:** Dos sesiones: admin desactiva a la otra, verificar cierre del EventSource.


## Hallazgo API-09: Rate limiting incompleto: clave IP spoofeable vía X-Forwarded-For y login sin límite por IP

**Área:** D — APIs e integraciones

**Severidad:** Media

**Estado:** Confirmado

**Componente afectado:** proxy.js — checkIpRateLimit + login

**Evidencia encontrada:** proxy.js:7832 (_ip = primer elemento de x-forwarded-for — el cliente puede inyectar el suyo y Railway añade el real al final, por lo que [0] es controlable por el atacante) + :4754-4759 (solo 4 rutas con límite IP) + :4706-4719 (login limitado SOLO por email, 5/15 min — sin dimensión IP)

**Problema:** (1) El límite por IP de /api/odoo, /api/transfer/search, /api/averias/search y /api/analysis se evade rotando un header XFF falso; (2) el login no tiene límite por IP: credential-stuffing distribuido sobre muchos emails no se frena; (3) forgot-password y reset-password no tienen ningún rate limit. Agrava que las contraseñas semilla ('WWP2026!' proxy.js:11557) siguen siendo válidas hasta activar WWP_FORCE_PW_CHANGE.

**Práctica estándar de la industria:** Tomar la IP del salto añadido por el proxy de confianza (último elemento del XFF con los hops de Railway) y limitar login también por IP con umbral generoso.

**Riesgo técnico:** Evasión trivial del rate limit; las rutas afectadas exigen JWT, así que el impacto real es amplificación de carga sobre Odoo + stuffing en login.

**Riesgo para el negocio:** Cuentas con contraseñas semilla públicas en el código son objetivos plausibles de stuffing.

**Causa raíz probable:** split(',')[0] es el idiom más copiado para XFF; no se modeló la cadena de proxies de Railway.

**Recomendación:** Usar el elemento del XFF añadido por el edge de Railway para _ip, añadir regla IP a login/forgot-password (30/15 min), y activar WWP_FORCE_PW_CHANGE=1 cuanto antes.

**Solución inmediata:** Cambiar el parseo del XFF + regla IP en login.

**Solución definitiva:** Activar WWP_FORCE_PW_CHANGE=1 (ya implementado) y documentar la topología de proxies en RAILWAY.md.

**Esfuerzo estimado:** Bajo

**Prioridad:** P2

**Dependencias:** Confirmar cuántos hops añade Railway al XFF (1 esperado).

**Criterio de aceptación:** Requests con XFF forjado comparten bucket con la IP real; 31 logins fallidos desde una IP con emails distintos reciben 429.

**Cómo validar la corrección:** curl con -H 'X-Forwarded-For: 1.2.3.4' rotando valores contra una ruta limitada, verificando que el 429 llega igual.


## Hallazgo API-10: forgot-password en producción no entrega el token por ningún canal (sin SMTP): flujo de autoservicio roto

**Área:** D — APIs e integraciones

**Severidad:** Media

**Estado:** Confirmado

**Componente afectado:** proxy.js — /api/wwp/auth/forgot-password + nodemailer muerto

**Evidencia encontrada:** proxy.js:11660-11685 ('En prod la recuperación operativa es el admin desde Usuarios; el correo real queda en roadmap (R7)' — en Railway el token se genera y NO se imprime ni envía) + proxy.js:12-14 (nodemailer se require pero grep 'nodemailer.' = cero usos)

**Problema:** Un usuario que olvida su contraseña ve 'recibirás instrucciones' pero nunca recibe nada; depende de encontrar al admin. nodemailer está cargado sin ningún uso (peso muerto y señal confusa). El canal Odoo Discuss ya existe para otras notificaciones (:4867) y podría entregar el link de reset.

**Práctica estándar de la industria:** Entregar el reset por el canal disponible o quitar el formulario y decir explícitamente 'contacta a tu administrador'.

**Riesgo técnico:** Ninguno; deuda de UX/soporte.

**Riesgo para el negocio:** Fricción y dependencia del único admin para cada olvido de contraseña en un equipo de 29.

**Causa raíz probable:** R7 pospuesto conscientemente tras arreglar la fuga del token en logs (QW1); nodemailer quedó de un intento anterior.

**Recomendación:** Corto plazo: cambiar el copy en prod a 'pide el reset a tu administrador' o entregar el link por Odoo Discuss; medio plazo: SMTP transaccional (R7) y retirar nodemailer si no se usa.

**Solución inmediata:** Cambio de copy o envío por Odoo Discuss (canal ya integrado).

**Solución definitiva:** R7: SMTP/API transaccional (Resend/SES, gratis a este volumen) para reset y avisos críticos.

**Esfuerzo estimado:** Medio

**Prioridad:** P2

**Dependencias:** Cuenta SMTP/API de correo.

**Criterio de aceptación:** Un usuario real completa el reset sin intervención del admin, o la UI ya no promete un correo que no llega.

**Cómo validar la corrección:** Flujo completo en prod con un usuario de prueba.


## Hallazgo API-11: Contrato de respuesta inconsistente y saneamiento de errores aplicado a medias

**Área:** D — APIs e integraciones

**Severidad:** Baja

**Estado:** Confirmado

**Componente afectado:** proxy.js — toda la superficie

**Evidencia encontrada:** proxy.js:12761 (GET /api/wwp/tasks devuelve array pelado) vs :12773 ({ok:true, messages}) vs :11740 (GET /api/wwp/auth/users devuelve array pelado); safeError existe (:4780) pero p.ej. el login responde e.message crudo en 500 (:11579) y decenas de handlers hacen {ok:false,error:e.message}; acciones RPC-style via query (?action=cancel en PATCH /api/sdv/:id :19513)

**Problema:** Tres formas de éxito (array, {ok:true,...}, objeto directo) y dos de error (saneado y crudo) obligan al cliente a conocer cada endpoint y dificultan interceptores genéricos; algunos 500 pueden filtrar mensajes internos de PG/Odoo que safeError taparía.

**Práctica estándar de la industria:** Envelope único {ok, data|error} + un solo punto de serialización de errores.

**Riesgo técnico:** Fricción de mantenimiento y fugas menores de detalle interno en errores.

**Riesgo para el negocio:** Mínimo directo; deuda que encarece cada feature.

**Causa raíz probable:** Crecimiento por acreción sin capa de respuesta común (no hay middleware).

**Recomendación:** Regla de convención (CLAUDE.md): todo catch nuevo responde sendJson(res, 500, {ok:false, error: safeError(e)}); normalizar los arrays pelados al envelope durante las olas del plan 08.

**Solución inmediata:** Convención documentada + barrido de los 500 con e.message crudo en endpoints de auth.

**Solución definitiva:** Normalizar los ~15 endpoints con array pelado al envelope común (cliente y servidor en el mismo repo).

**Esfuerzo estimado:** Medio

**Prioridad:** P2

**Dependencias:** Plan 08 en curso (otra sesión) — coordinar.

**Criterio de aceptación:** grep de 'error:e.message' en respuestas 500 tiende a cero; los endpoints listados devuelven envelope.

**Cómo validar la corrección:** grep + smoke e2e de los shapes tocados.


## Hallazgo API-12: Documentación de API estática y parcialmente obsoleta; sin fuente de verdad del contrato

**Área:** D — APIs e integraciones

**Severidad:** Baja

**Estado:** Confirmado

**Componente afectado:** docs/auditoria-arquitectura/04-api-integraciones.md

**Evidencia encontrada:** docs/auditoria-arquitectura/04-api-integraciones.md (buen inventario del 22-jul pero ya desviado: marca 'Averías: Mixto — parte sin JWT (R-06B)' y 'Sheets/Analysis: Parte sin JWT' cuando hoy todos exigen JWT y /api/sheets/* fue eliminado — proxy.js:8587; las líneas citadas también driftearon). No existe OpenAPI ni tabla ruta-por-ruta viva (el 'agentB-endpoints.md' referenciado no está en el repo)

**Problema:** Los ~238 endpoints solo se conocen leyendo proxy.js; la doc existente contradice el código a días de escrita, lo que la vuelve peligrosa (alguien podría 're-arreglar' lo ya arreglado). Los agentes IA/Codex que operan sobre el repo dependen de este contexto.

**Práctica estándar de la industria:** Para un solo dev: inventario generado por script (el patrón 'if (reqPath === … && req.method === …)' es 100% grepeable), regenerado en cada auditoría.

**Riesgo técnico:** Decisiones sobre información vieja; onboarding imposible de un segundo dev.

**Riesgo para el negocio:** Bus factor: el contrato vive en la cabeza de Gabriel y en 21 mil líneas.

**Causa raíz probable:** La doc se escribió como snapshot de auditoría, no como artefacto mantenido.

**Recomendación:** Marcar en 04-*.md los hallazgos ya corregidos con fecha, y generar la tabla de endpoints por script integrado a la suite e2e para detectar drift.

**Solución inmediata:** Anotar R-06B como corregido en el doc.

**Solución definitiva:** Script tests/gen-endpoints.mjs que extraiga método+ruta+guard del dispatcher y regenere docs/ (~1 h); correrlo en la suite.

**Esfuerzo estimado:** Bajo

**Prioridad:** P2

**Dependencias:** Ninguna.

**Criterio de aceptación:** Tabla generada coincide con el dispatcher y la suite falla si se agrega un endpoint sin regenerarla.

**Cómo validar la corrección:** Ejecutar el script y comparar contra el grep manual de esta auditoría (245 checks de ruta).


## Hallazgo API-13: POSTs de creación sin idempotencia: el reintento de red duplica tareas/SDV/averías

**Área:** D — APIs e integraciones

**Severidad:** Baja

**Estado:** Confirmado

**Componente afectado:** proxy.js — POST /api/wwp/tasks, /api/sdv, /api/averias

**Evidencia encontrada:** proxy.js:12888-12937 (POST tasks: valida campos pero genera id servidor sin clave de dedupe del cliente) + :17036 (POST sdv, ídem) + :10512 (POST averías, ídem)

**Problema:** En bodegas con red móvil inestable (el caso real de los auxiliares), un timeout del cliente con retry crea la tarea/solicitud dos veces; el write-gate serializa pero no deduplica. Hay dedupe en dominios específicos (transferencias importadas :7677) pero no en las creaciones principales.

**Práctica estándar de la industria:** Idempotency-Key generada por el cliente, recordada N minutos por el servidor.

**Riesgo técnico:** Duplicados que ensucian KPIs y confunden asignaciones (dos tareas para el mismo despacho).

**Riesgo para el negocio:** Retrabajo de limpieza manual; los endpoints _fix históricos (backfills, strip-copia) sugieren que ya pasó.

**Causa raíz probable:** El retry automático del fetch/navegador no se modeló.

**Recomendación:** clientKey opcional en el body de los 3 POST principales con mapa TTL 10 min clientKey→id que devuelve el recurso ya creado en vez de duplicar.

**Solución inmediata:** Deshabilitar el botón de crear hasta respuesta en el cliente (mitiga doble click, no retry de red).

**Solución definitiva:** clientKey + mapa TTL en servidor; historial.html genera la clave.

**Esfuerzo estimado:** Medio

**Prioridad:** P3

**Dependencias:** Toca historial.html.

**Criterio de aceptación:** Reenviar el mismo POST dos veces con el mismo clientKey devuelve el mismo id sin duplicado.

**Cómo validar la corrección:** Harness en tests/ que dispare el mismo body dos veces y cuente tareas.


## Hallazgo API-14: Higiene menor de integraciones: single-flight de authenticate() muerto y CSP con orígenes de integraciones eliminadas

**Área:** D — APIs e integraciones

**Severidad:** Baja

**Estado:** Confirmado

**Componente afectado:** proxy.js — sesión Odoo y CSP

**Evidencia encontrada:** proxy.js:7603-7604 (authBusy/authQueue declarados y jamás usados — sin single-flight, N requests concurrentes con odooUid null disparan N authenticate() simultáneos) + proxy.js:7820 (connect-src aún permite https://docs.google.com y https://sheets.googleapis.com pese a que la integración Sheets se eliminó en jul-2026, :8587-8589) + :7821 (frame-ancestors permite https://gjs6301-code.github.io — verificar si el Modo B sigue vivo)

**Problema:** Tras un redeploy o un Access Denied, una ráfaga de requests provoca una tormenta de autenticaciones contra Odoo (inofensiva a esta escala, pero es el código muerto de la solución correcta); la CSP mantiene orígenes de integraciones retiradas, ampliando sin razón la superficie de exfiltración permitida.

**Práctica estándar de la industria:** Promise compartida para la autenticación en vuelo; CSP mínima alineada con las integraciones vivas.

**Riesgo técnico:** Marginal hoy; ruido y confusión para el mantenedor.

**Riesgo para el negocio:** Ninguno directo.

**Causa raíz probable:** Restos de refactors: el single-flight se declaró y nunca se cableó; la CSP no se podó al retirar Sheets.

**Recomendación:** Implementar el single-flight con promise compartida (5 líneas, usa las vars ya declaradas) y podar docs.google.com/sheets.googleapis.com de connect-src; confirmar el estado del Modo B antes de tocar frame-ancestors.

**Solución inmediata:** Single-flight + poda de connect-src.

**Solución definitiva:** Retirar frame-ancestors de GitHub Pages si el Modo B está muerto.

**Esfuerzo estimado:** Bajo

**Prioridad:** P3

**Dependencias:** Confirmación de Gabriel sobre el Modo B.

**Criterio de aceptación:** Bajo carga concurrente con uid nulo se observa 1 sola authenticate en logs; CSP sin orígenes muertos y la app funciona igual.

**Cómo validar la corrección:** Harness de 20 requests concurrentes tras anular odooUid en dev; smoke e2e completo tras podar la CSP.



---

# Área E — Base de datos y modelo de datos

**Resumen del área:** La capa de datos es un diseño memoria-primero: todo el dataset (~4.700 filas en 30 colecciones, verificado en el health de producción el 22-jul) vive en la RAM del proceso y se persiste con write-through diferencial a PostgreSQL (collection_rows JSONB + kv_store) y, desde la Fase 3B del 22-23 jul, a 24 tablas tipadas t_* por entidad con dual-write en la MISMA transacción y modo WWP_TYPED=read en producción. El cutover está excepcionalmente bien ejecutado para un equipo de 1 dev (contrato roundtrip sin pérdida vía _extra, kill-switch por env, paridad 24/24 verificada, tests dedicados), y el blindaje anti-vacío + backups multinivel responden directamente al incidente del 25-jun. Los riesgos residuales reales son: la guardia de arranque en modo read compara SOLO conteos (un ciclo off→read con ediciones serviría datos tipados obsoletos y los propagaría), el respaldo offsite de fotos quedó silenciosamente roto tras el flip a R2 (el manifest solo lista disco y la URL por defecto del script nocturno responde 404 hoy), y la integridad es 100% aplicativa (cero FKs/UNIQUE/CHECK, FSM de tareas sin enum validado, borrado duro sin auditoría). Nada de esto exige reescritura: son cierres puntuales de bajo/medio esfuerzo sobre una base sana.

**Madurez:** 3.5/5 — Muy por encima de lo esperable para un monolito de 1 dev: el cutover relacional Fase 3B es de calidad profesional (dual-write transaccional, contrato roundtrip sin pérdida, kill-switch, paridad verificada, tests dedicados contra PG real), el blindaje anti-vacío y la escritura atómica responden con ingeniería real al incidente de pérdida de datos del 25-jun, y la estrategia de respaldo tiene 4 niveles. No llega a 4 porque los mecanismos de VERIFICACIÓN continua no existen todavía (paridad solo manual, guardia de boot solo por conteos, rejected_writes sin lector, restauración jamás ensayada), la integridad es 100% convención aplicativa sin detección de huérfanos/duplicados, la FSM de la entidad central no valida su enum, y el respaldo offsite de fotos quedó silenciosamente desactualizado respecto al flip a R2 — el patrón transversal es 'defensas excelentes, observabilidad de las defensas pendiente'. Con los 5-6 cierres de esfuerzo Bajo señalados (job de paridad, backfill forzoso post-off, manifest R2, drill de restauración, alertas de blindaje) el área queda sólidamente en 4.

## Fortalezas verificadas

- Cutover relacional Fase 3B ejemplar: dual-write a la tabla tipada DENTRO de la misma transacción que collection_rows (storage-pg.js:322 '_typedApplyOps(client, base, op)'), contrato roundtrip sin pérdida (null explícito/clave nueva/drift de tipo → _extra; NULL en columna = clave ausente, storage-pg.js:365-396), kill-switch de 3 niveles por env WWP_TYPED off|dual|read (storage-pg.js:53) y paridad 24/24 verificada en prod (MEMORIA-PROYECTO.md:53).
- Blindaje anti-vacío en AMBOS backends tras el incidente del 25-jun: bloquea vaciar colecciones con >=5 filas, registra en rejected_writes (PG, storage-pg.js:206-210) o .REJECTED-*.json (archivo, proxy.js:216-223), y nunca crashea.
- Fail-visible ante corrupción: loadJson con JSON inválido intenta .bak y si no LANZA en vez de devolver [] (proxy.js:96-106); el import al boot con JSON corrupto sin .bak TUMBA el arranque (storage-pg.js:679); boot.js sale con exit(1) si PG es inaccesible — 'no se arranca sirviendo vacío' (boot.js:40).
- Escritura atómica en todos los caminos: tmp → .bak → rename (proxy.js:113-119, storage-pg.js:739-744) y descargas del backup nocturno con .part → rename (backup-wwp.mjs:86-87).
- Cola de escritura por colección con reintentos exponenciales, coalescing a resync completo cuando la DB está caída (storage-pg.js:236-241) y drenaje graceful en SIGTERM + export JSON final (boot.js:44-55) — ventana de rollback ~0 en redeploys.
- Costo de escritura acotado: diff diferencial por fila + dirty-flags B3 (opts.touched) para no re-stringificar colecciones grandes (storage-pg.js:104-128; appendAuditLog proxy.js:3482), orden fraccional con renumeración solo al agotar precisión (ORD_STEP/MIN_GAP).
- Crecimiento en RAM acotado por caps explícitos: wwp-audit 10.000 (proxy.js:3481), notificaciones 2.000 total/200 por usuario (proxy.js:5880-5881), GPS 7 días/5.000 (proxy.js:11759-11763) — el dataset total hoy es ~4.700 filas, trivial para el proceso.
- Backup multinivel: PG como primario + export horario memoria→JSON en el volumen + snapshot horario snap_* (24) + rotativos por escritura (40, modo archivo) + respaldo nocturno offsite a OneDrive con retención 30 y endpoints tokenizados (proxy.js:12245-12301, scripts/backup-wwp.mjs).
- FSM de SDV validada de verdad en backend: enum + tabla de transiciones + helper único que sella timestamps y statusHistory (proxy.js:2286-2324), con estados terminales y flujo formal de reactivación.
- Defensas de datos sucios: NUL en JSONB saneado (_pgSafe, storage-pg.js:336-339), ids naturales duplicados no rompen el guardado (remap a _rid, storage-pg.js:87-99), filas no-objeto quedan visibles en typedParity en vez de romper el flush (storage-pg.js:428-430).
- Cobertura de tests real de la capa: test-typed-cutover.mjs 29/29 contra PG real (dual-write, roundtrip, backfill, guardia de read, paridad), test-storage-pg.mjs de regresión y _test_b1b3_colas.mjs para las secciones críticas.
- Evolución de esquema idempotente y sin herramienta pesada: CREATE TABLE IF NOT EXISTS + ADD COLUMN IF NOT EXISTS en cada boot (storage-pg.js:398-412) — adecuado para 1 dev con deploy manual.

## Hallazgo DB-01: Guardia de conteos (no de contenido) al reconstruir memoria desde tablas tipadas: un ciclo off→read sirve y propaga datos obsoletos

**Área:** E — Base de datos y modelo de datos

**Severidad:** Alta

**Estado:** Confirmado

**Componente afectado:** storage-pg.js (_typedBackfill, _typedRebuildMem)

**Evidencia encontrada:** storage-pg.js:467 'if (n === memRows) continue;' (backfill solo repara si el CONTEO difiere) y storage-pg.js:500-504 (modo read: 'si el conteo no coincide con collection_rows… sigue en collection_rows' — también solo conteo)

**Situación actual:** Hoy el modo es read permanente y el escenario no se ha dado; el riesgo se activa exactamente cuando se use el kill-switch que existe para emergencias.

**Problema:** El rollback operativo documentado es 'setear WWP_TYPED=off y reiniciar' (storage-pg.js:50-52). En modo off las escrituras van SOLO a collection_rows; las ediciones típicas (updates de status, items, statusHistory) NO cambian el número de filas. Al volver a read, _typedBackfill ve conteos iguales y no repara, _typedRebuildMem pasa su guardia y la app arranca desde las tablas tipadas OBSOLETAS; el primer save propaga ese estado viejo también a collection_rows (pérdida real de las ediciones hechas durante el modo off).

**Riesgo técnico:** Regresión silenciosa de datos al reactivar read tras un periodo en off/dual-solo-rows; indetectable al boot porque los conteos coinciden.

**Riesgo para el negocio:** Tareas y SDV vuelven a estados anteriores (despachos 'reabiertos', evidencia desvinculada) justo después de una maniobra de emergencia, cuando menos capacidad de diagnóstico hay.

**Causa raíz probable:** La guardia se diseñó barata (count) porque con dual-write transaccional la divergencia de contenido 'no puede' ocurrir — pero el propio kill-switch off rompe esa invariante.

**Recomendación:** Persistir el modo WWP_TYPED en kv y forzar backfill total en cualquier transición desde off antes de reconstruir memoria en read.

**Solución inmediata:** Regla operativa escrita: tras cualquier periodo en WWP_TYPED=off, antes de volver a read correr un backfill forzoso (borrar t_* o exponer un flag/endpoint que llame _typedBackfill incondicional) y verificar /api/admin/db/typed-parity.

**Solución definitiva:** Persistir el último modo en kv_store; si el modo anterior fue 'off' (o distinto del actual), forzar backfill completo antes de _typedRebuildMem. Alternativa: comparar un checksum/max(updated_at) — requeriría añadir updated_at a las t_*.

**Esfuerzo estimado:** Bajo

**Prioridad:** P1

**Dependencias:** Ninguna

**Criterio de aceptación:** Test en test-typed-cutover.mjs: boot off → editar filas (mismo conteo) → boot read ⇒ la memoria refleja las ediciones (hoy fallaría).

**Cómo validar la corrección:** Reproducir en PG local (WWP_PG_TEST_URL): boot off, mutar una fila vía saveCollection, boot read, comparar la fila en memoria.

**Verificación adversarial (CONFIRMADO):** La evidencia se reproduce exacta hoy: guardia de solo-conteo en _typedBackfill (línea 467) y en _typedRebuildMem (500-504), con orden de boot preload→backfill→rebuild (618-621) que deja pasar el ciclo off→editar→read cuando el conteo no cambia. No existe mitigación: sin persistencia del modo en kv, sin endpoint/flag de backfill forzoso, y el propio test (tests/test-typed-cutover.mjs:197-210) demuestra la precondición del bug (edición en off deja la t_* obsoleta con mismo conteo) pero nunca prueba el retorno a read. Tampoco es decisión deliberada: MEMORIA-PROYECTO.md:53 documenta "rollback = cambiar la env var" sin advertir el retorno, lo que agrava el riesgo. Única imprecisión menor: "el primer save propaga" — las filas obsoletas no tocadas no se reescriben de inmediato a collection_rows (rowSnap coincide con lo obsoleto), pero la app sirve el estado viejo desde el boot y cualquier resync coalescido (QUEUE_COALESCE_AT=6) o renumeración sí escribe el array obsoleto completo a ambos almacenes; el resultado neto (pérdida silenciosa de las ediciones del periodo off) se sostiene. Alta/P1 defendible: trampa silenciosa exactamente en la vía de emergencia, con fix de esfuerzo bajo. · Evidencia re-vista: storage-pg.js:467 ('if (n === memRows) continue;'), storage-pg.js:500-504 (guardia de conteo en read), storage-pg.js:618-621 (orden de boot), storage-pg.js:50-53 (rollback vía env var), tests/test-typed-cutover.mjs:197-210 (off deja t_* obsoleta, sin test del retorno a read), MEMORIA-PROYECTO.md:53 (rollback documentado sin advertencia)


## Hallazgo DB-02: El respaldo offsite de fotos quedó ciego tras el flip a R2: el manifest solo inventaría disco y omite 2 carpetas

**Área:** E — Base de datos y modelo de datos

**Severidad:** Alta

**Estado:** Confirmado

**Componente afectado:** proxy.js /api/backup/manifest + media.js + scripts/backup-wwp.mjs

**Evidencia encontrada:** proxy.js:12251-12262 (manifest = fs.readdirSync de 6 carpetas de DISCO: wwp-fotos, av-fotos, desp-fotos, emp-fotos, sdv-adjuntos, prod-img — faltan 'inspection' y 'showroom-fotos' de media.KINDS, media.js:29-38); media.js:112-118 (con R2 activo mediaPut escribe SOLO al bucket, disco solo si R2 falla); health de prod 22-jul: media {mode:'r2', migrated:true}

**Situación actual:** El hallazgo crítico previo R-04/R0a (única copia en el volumen Railway) se mitigó en durabilidad (R2 es almacenamiento de objetos redundante fuera de Railway), pero se sustituyó por un hueco de cobertura de respaldo lógico: borrado accidental, bug o compromiso de credenciales R2 = pérdida irreversible de evidencia nueva.

**Problema:** Toda foto subida después del flip a R2 existe en UNA sola copia (el bucket R2): no está en el disco de Railway ni aparece en el manifest, así que el respaldo nocturno a OneDrive dejó de cubrir la evidencia nueva sin que nada lo avise. Además las fotos de inspección de vehículos y showroom nunca estuvieron en el manifest, ni siquiera en modo disco. mediaDelete borra en R2 de forma permanente.

**Riesgo técnico:** Sin segunda copia ni versioning verificado del bucket; el respaldo incremental reporta 'completo' mientras cubre cada vez menos del universo real.

**Riesgo para el negocio:** La evidencia fotográfica de entregas/averías/inspecciones es la defensa de la empresa en disputas con clientes; perder las fotos recientes es exactamente el escenario que motivó el Nivel 1.

**Causa raíz probable:** El diseño del respaldo Nivel 1 asumía 'las fotos viven en disco'; el flip a R2 (posterior) rompió el supuesto sin actualizar el manifest.

**Recomendación:** Extender el manifest a R2 + activar versioning del bucket; mientras tanto documentar que OneDrive solo cubre fotos pre-flip.

**Solución inmediata:** Añadir 'inspection' y 'showroom-fotos' al dirs del manifest y activar versioning u object lifecycle en el bucket R2 desde el dashboard de Cloudflare (sin código).

**Solución definitiva:** Manifest híbrido: con R2 activo, listar objetos del bucket (ListObjectsV2 paginado) y servirlos vía mediaGet para que backup-wwp.mjs los baje igual que antes; o job server-side de réplica R2→segundo bucket/proveedor.

**Esfuerzo estimado:** Medio

**Prioridad:** P1

**Dependencias:** Acceso al dashboard de Cloudflare R2

**Criterio de aceptación:** Una foto subida hoy aparece en el manifest y termina en OneDrive en la corrida nocturna siguiente; las carpetas inspection/showroom-fotos incluidas.

**Cómo validar la corrección:** Comparar conteo de objetos del bucket vs entradas del manifest; revisar backup-log.txt de la última corrida.

**Verificación adversarial (CONFIRMADO):** La evidencia reproduce hoy tal cual: el manifest de respaldo (proxy.js:12251-12262) hace fs.readdirSync sobre exactamente 6 carpetas de disco y omite 'inspection' y 'showroom-fotos', que sí están en media.KINDS (media.js:29-38) y se escriben activamente en producción (dataUrlToMedia en proxy.js:12216, 15882-16003). Con R2 activo, mediaPut escribe SOLO al bucket (media.js:112-118, disco únicamente si R2 falla) y mediaDelete borra en R2 sin papelera (media.js:177-183), así que ninguna foto post-flip aparece en el manifest que consume scripts/backup-wwp.mjs (líneas 66-91), cuyo propio encabezado (línea 6) sigue listando solo las 6 carpetas viejas. Busqué activamente un fix — ListObjects/listado R2 no existe en ningún archivo del repo, no hay cambios sin commitear en proxy.js/media.js/backup-wwp.mjs, y ni MEMORIA-PROYECTO.md ni comentarios documentan el hueco como decisión aceptada (al contrario: el comentario de proxy.js:12278-12280 aún afirma que manifest+fotos "ES el respaldo total"). Severidad Alta/P1 es proporcionada incluso para 1 dev/30 usuarios: la evidencia fotográfica es la defensa en disputas y el respaldo reporta éxito mientras cubre un universo cada vez menor. · Evidencia re-vista: proxy.js:12251-12262 (dirs de 6 carpetas disco, sin inspection/showroom-fotos); media.js:29-38 (KINDS con 8 tipos); media.js:112-129 (mediaPut R2-only con fallback a disco solo en error); media.js:177-183 (mediaDelete permanente en R2); scripts/backup-wwp.mjs:6,66-91 (consume el manifest disk-only); proxy.js:12216,15882,15993,16003 (escrituras reales a inspection/showroom-fotos); proxy.js:12278-12280 (comentario que aún llama a esto "el respaldo total")


## Hallazgo DB-03: La URL por defecto del respaldo nocturno responde 404: el offsite puede llevar semanas sin correr

**Área:** E — Base de datos y modelo de datos

**Severidad:** Media

**Estado:** Confirmado

**Componente afectado:** scripts/backup-wwp.mjs (Tarea de Windows en la máquina de Gabriel)

**Evidencia encontrada:** scripts/backup-wwp.mjs:23 "const BASE = process.env.WWP_BACKUP_BASE_URL || 'https://dashboard-despachos-production.up.railway.app'" — verificado hoy 22-jul: esa URL devuelve HTTP 404; la producción real es https://opsat.up.railway.app (CLAUDE.md)

**Problema:** Si la tarea programada no define WWP_BACKUP_BASE_URL con el dominio nuevo, cada corrida nocturna falla en el primer fetch (fetchRetry lanza en !r.ok) y el único respaldo fuera de Railway (datos + fotos) no se está generando. El script sale con exit(1) pero nadie monitorea ese exit code.

**Riesgo técnico:** Falso sentido de seguridad: toda la estrategia offsite depende de una tarea de Windows sin monitoreo cuyo endpoint por defecto está muerto.

**Riesgo para el negocio:** En un incidente de Railway (borrado de proyecto, volumen, DB) la última copia externa podría ser de la fecha del cambio de dominio.

**Causa raíz probable:** El dominio de producción cambió (dashboard-despachos → opsat) y el default del script no se actualizó; el respaldo corre desatendido sin alerta de fallo.

**Recomendación:** Corregir el default hoy y añadir la alerta de 'respaldo no visto en 48 h' en el servidor (patrón createNotification ya existente).

**Solución inmediata:** Revisar %USERPROFILE%\OneDrive\Documentos\Respaldos-WWP\backup-log.txt: fecha de la última corrida exitosa; actualizar el default del script a opsat.up.railway.app.

**Solución definitiva:** Heartbeat inverso: el servidor registra el timestamp del último GET exitoso a /api/backup/collections.json.gz (kv) y un job diario notifica a admins si pasan >48 h sin respaldo.

**Esfuerzo estimado:** Bajo

**Prioridad:** P1

**Dependencias:** Acceso a la máquina Windows de Gabriel

**Criterio de aceptación:** backup-log.txt muestra corrida COMPLETA con el dominio actual; alerta dispara si se pausa la tarea 2 días.

**Cómo validar la corrección:** node scripts/backup-wwp.mjs manual contra prod y revisar el log; simular fallo apagando la tarea.

**Verificación adversarial (PARCIAL):** El defecto técnico es real y vigente: el default de scripts/backup-wwp.mjs:23 sigue siendo dashboard-despachos-production.up.railway.app, que hoy devuelve 404 (opsat responde 200), y el commit de hoy ae3f500 corrigió esa misma URL en uptime.yml y docs pero olvidó el script de respaldo — es descuido, no decisión documentada, y no existe heartbeat ni monitoreo del respaldo en proxy.js. Sin embargo, la narrativa está inflada: el script y la tarea nocturna se crearon AYER (commit 497a301, 21-jul-2026), por lo que "semanas sin correr" y "última copia de la fecha del cambio de dominio" son imposibles — antes del 21-jul no existía offsite alguno y la ventana máxima de fallo es ~1 día. Además las fotos ya viven primariamente en Cloudflare R2 (fuera de Railway), lo que reduce la exposición aunque R2 sea primario y no backup. Ajusto severidad a Media manteniendo P1 porque el fix es una línea y debe hacerse hoy junto con la alerta de heartbeat propuesta. · Evidencia re-vista: scripts/backup-wwp.mjs:23 (HEAD, verificado hoy: default = dominio viejo; curl hoy: viejo→404, opsat→200); git ae3f500 (22-jul: fixó uptime.yml+docs, NO el script); git 497a301 (21-jul: creación del script — refuta "semanas"); proxy.js:47 (fotos en R2)


## Hallazgo DB-04: Restauración jamás ensayada y backups administrados de PG sin verificar

**Área:** E — Base de datos y modelo de datos

**Severidad:** Media

**Estado:** Confirmado

**Componente afectado:** Estrategia de respaldo/recuperación (Railway PG + collections.json.gz)

**Evidencia encontrada:** No existe en el repo ningún script ni runbook de restauración (grep 'restaur/restore' en MEMORIA-PROYECTO.md solo devuelve UI); el camino inverso collections.json.gz → PG depende de _importFromFiles (storage-pg.js:652-735) que SOLO importa colecciones que 'no existan aún en la DB' (storage-pg.js:666)

**Problema:** Hay 4 niveles de copia pero ninguna evidencia de un drill de restauración end-to-end. El import on-boot es solo para primera vez: restaurar sobre una DB con datos (el caso real de un desastre parcial) exige borrar tablas a mano sin procedimiento escrito. Tampoco está verificado si el PostgreSQL de Railway tiene backups/PITR propios activados.

**Riesgo técnico:** Backups sin restore probado son hipótesis; el momento de descubrir el gap sería durante el incidente.

**Riesgo para el negocio:** Horas de operación de almacén detenidas mientras se improvisa una restauración, con 29 usuarios activos.

**Causa raíz probable:** La energía se invirtió (bien) en capas de copia; el ejercicio de recuperación quedó pendiente.

**Recomendación:** Un drill de 1 hora este mes vale más que cualquier capa adicional de backup.

**Solución inmediata:** Drill documentado: PG local vacío + descomprimir un collections.json.gz real al DATA_DIR + boot → verificar conteos vs manifest. Confirmar en el dashboard Railway si el plugin PG tiene backups.

**Solución definitiva:** Script scripts/restore-wwp.mjs (gz → archivos JSON → boot con DB limpia o TRUNCATE guiado) + runbook en RAILWAY.md; drill trimestral con resultado anotado en MEMORIA-PROYECTO.md.

**Esfuerzo estimado:** Bajo

**Prioridad:** P1

**Dependencias:** Snapshot nocturno funcionando (hallazgo anterior)

**Criterio de aceptación:** Runbook escrito + una restauración completa ejecutada y cronometrada (RTO conocido).

**Cómo validar la corrección:** Ejecutar el drill en local con datos reales del snapshot.

**Verificación adversarial (CONFIRMADO):** La evidencia se reproduce hoy tal cual: _importFromFiles (storage-pg.js:652-735) solo importa colecciones ausentes de la DB (línea 666, "la DB ya la tiene") y no existe ningún script ni runbook de restauración en el repo (scripts/ solo tiene backup-wwp.mjs y herramientas de deploy; RAILWAY.md no menciona backup/restore/PITR; los hits de "restaur" en MEMORIA-PROYECTO.md y proxy.js son de UI/presencia). El hallazgo incluso se queda corto: el snapshot collections.json.gz es UN solo JSON envolvente ({exportedAt, build, storage, collections:{...}}, proxy.js:12284-12292), no archivos por colección, así que "descomprimirlo al DATA_DIR" ni siquiera funcionaría sin un paso de split previo que nadie ha escrito — el comentario de proxy.js:12279 que promete reconstruir la DB desde ese archivo es él mismo una hipótesis sin ensayar. Mitigaciones parciales (exportAllToFiles en storage-pg.js:745 y _typedBackfill idempotente en :458-486 que repoblaría las tablas tipadas tras restaurar collection_rows) facilitan el drill pero no lo sustituyen. Severidad Media/P1 bien calibrada para operación crítica post-cutover relacional; no es decisión deliberada documentada. · Evidencia re-vista: storage-pg.js:652 (async function _importFromFiles), storage-pg.js:666 (if (state.mem.has(base)) continue; // la DB ya la tiene), storage-pg.js:650 ("Importa (una vez)"), proxy.js:12281-12298 (gz = JSON envolvente único, no archivos por colección), scripts/ sin restore-wwp.mjs, RAILWAY.md sin mención alguna de backup/restore/PITR


## Hallazgo DB-05: Cero integridad declarativa: sin FKs, sin UNIQUE en ids naturales, sin CHECK; relaciones por convención de nombres

**Área:** E — Base de datos y modelo de datos

**Severidad:** Media

**Estado:** Confirmado

**Componente afectado:** storage-pg.js DDL + modelo de colecciones

**Evidencia encontrada:** DDL completo en storage-pg.js:601-613 y :398-412 — ni un REFERENCES/UNIQUE/CHECK en todo el archivo; relaciones implícitas: task.parentId, task.sdvId ↔ sdv.wwpTaskId/wwpTareas, retRef/retRefs, kitId (proxy.js:1511,1675); ids naturales duplicados se remapean en silencio a _rid en vez de rechazarse (storage-pg.js:86-91 'bug de datos: no debe romper el guardado')

**Situación actual:** Coherente con el diseño memoria-primero (la DB es un espejo de la RAM; FKs duras romperían flushes por colección con ordenamiento arbitrario). El problema no es la ausencia de FKs sino la ausencia de DETECCIÓN.

**Problema:** Toda la integridad referencial vive en disciplina aplicativa (ej. limpieza H0-4 al borrar tarea, proxy.js:13871-13892). Un bug en cualquier mutador puede dejar huérfanos (subtareas sin madre, SDV apuntando a tarea inexistente) o ids duplicados que el storage enmascara en vez de alertar, y nada lo detecta después.

**Riesgo técnico:** Corrupción lógica silenciosa y acumulativa; los remaps _rid de duplicados son invisibles.

**Riesgo para el negocio:** SDV que 'no puede regenerar su tarea' (bug histórico H0-4 ya ocurrió una vez), cadenas de subtareas varadas.

**Causa raíz probable:** Modelo documento-en-array heredado del origen como artifact + cutover que prioriza fidelidad de roundtrip sobre constraints.

**Recomendación:** No añadir FKs hoy (chocarían con el diseño); sí añadir el chequeo de integridad + alerta, y loggear cada remap por id duplicado.

**Solución inmediata:** Endpoint/job admin de integridad: huérfanos por parentId/sdvId/wwpTaskId, ids duplicados (contar remaps _rid con id natural presente), refs retRefs sin SDV — reutilizando los datos ya en memoria (barato).

**Solución definitiva:** Cuando el dual-write se retire y las t_* sean la única verdad, añadir UNIQUE sobre el id natural y FKs con ON DELETE decidido por entidad; hasta entonces, chequeo aplicativo periódico con notificación a admins.

**Esfuerzo estimado:** Medio

**Prioridad:** P2

**Dependencias:** Ninguna

**Criterio de aceptación:** Job diario reporta 0 huérfanos/duplicados o notifica a admins con detalle.

**Cómo validar la corrección:** Sembrar un huérfano en dev y confirmar la alerta.


## Hallazgo DB-06: Máquina de estados de tareas WWP incompleta: el backend nunca valida el enum de status para admin/manager

**Área:** E — Base de datos y modelo de datos

**Severidad:** Media

**Estado:** Confirmado

**Componente afectado:** proxy.js PATCH /api/wwp/tasks/:id

**Evidencia encontrada:** proxy.js:13426 'tasks[idx].status=d.status;' — sin validación contra lista de estados; las guardas existentes son parciales (auxiliar limitado a in_progress/completed :13103, validated solo admin :13110, cancelled :13129-13139); contrasta con la FSM SDV completa (proxy.js:2286-2324)

**Problema:** Un admin/manager (o un bug del frontend, o un curl con JWT válido) puede escribir cualquier string como status. Los filtros del sistema usan sets cerrados (['completed','validated','cancelled'], proxy.js:1794, 4394-4395): una tarea con status inválido queda 'ni abierta ni cerrada' — fantasma en KPIs, cierres de madre, gates de cadena y auto-despacho de SDV.

**Riesgo técnico:** Estado fuera de dominio persiste y se propaga a t_wwp_tasks; ninguna consulta lo detecta.

**Riesgo para el negocio:** Tareas invisibles en la operación diaria; métricas de cumplimiento infladas o desinfladas sin explicación.

**Causa raíz probable:** pending→assigned→in_progress→completed→validated es convención del frontend; las guardas del backend se añadieron por incidentes puntuales, nunca como FSM.

**Recomendación:** Replicar el patrón sdvTransition que ya funciona en el mismo archivo.

**Solución inmediata:** Al inicio del PATCH: if (d.status && !TASK_ESTADOS.includes(d.status)) → 400. Cinco líneas.

**Solución definitiva:** Tabla de transiciones como SDV_TRANSICIONES (con las excepciones ya codificadas: devolver completed→in_progress, reactivación) aplicada en el helper único; sumar un chequeo de estados fuera de dominio al job de integridad.

**Esfuerzo estimado:** Bajo

**Prioridad:** P2

**Dependencias:** Ninguna

**Criterio de aceptación:** PATCH con status desconocido responde 400; test e2e cubre la regresión.

**Cómo validar la corrección:** curl PATCH con status:'foo' como admin en dev → hoy persiste, después 400.


## Hallazgo DB-07: Borrado duro de tareas sin registro de auditoría ni papelera

**Área:** E — Base de datos y modelo de datos

**Severidad:** Media

**Estado:** Confirmado

**Componente afectado:** proxy.js DELETE /api/wwp/tasks/:id

**Evidencia encontrada:** proxy.js:13857-13898 — filter de la tarea + TODAS sus subtareas, broadcast 'task_deleted', y ni un appendAuditLog en el bloque (el audit log sí registra cambios de status en :13531)

**Problema:** La entidad central del negocio se elimina físicamente con sus statusHistory, items, mensajes y referencias de evidencia, sin rastro de quién/cuándo/qué en wwp-audit ni copia recuperable (más allá del snapshot horario que rota a 24 h y el offsite diario). Un borrado equivocado de una madre arrastra toda la cadena.

**Riesgo técnico:** Irreversible pasadas 24-48 h; imposible auditar borrados maliciosos o accidentales.

**Riesgo para el negocio:** Pérdida del historial operativo de un despacho completo (la evidencia fotográfica sobrevive en R2 pero queda desanclada); cero trazabilidad ante disputas internas.

**Causa raíz probable:** El endpoint es de la era pre-blindaje y nunca se le sumó el appendAuditLog que el resto de mutadores ya tiene.

**Recomendación:** El audit entry es media hora de trabajo y cierra el 80% del riesgo.

**Solución inmediata:** appendAuditLog('task_deleted', { snapshot compacto de la tarea y subtareas, by }) dentro del queueWrite — el audit ya viaja a PG con fila propia.

**Solución definitiva:** Soft-delete: mover a colección wwp-tasks-trash con TTL 30 días (obtendría tabla tipada gratis en el próximo esquema) + endpoint de restauración admin.

**Esfuerzo estimado:** Bajo

**Prioridad:** P2

**Dependencias:** Ninguna

**Criterio de aceptación:** Todo DELETE deja evento en wwp-audit con payload restaurable a mano.

**Cómo validar la corrección:** Borrar tarea en dev y buscar el evento en wwp-audit.json.


## Hallazgo DB-08: La paridad tipadas↔memoria solo se verifica a mano; ninguna alerta automática de divergencia

**Área:** E — Base de datos y modelo de datos

**Severidad:** Media

**Estado:** Confirmado

**Componente afectado:** storage-pg.js typedParity + proxy.js /api/admin/db/typed-parity

**Evidencia encontrada:** proxy.js:20575-20583 (GET admin manual); no existe ningún setInterval/job que llame typedParity() (grep en proxy.js); la guardia de boot es solo de conteos (hallazgo 1)

**Problema:** En modo read la app SIRVE desde las t_*; si un bug de _typedDecompose/_typedReconstruct o una intervención manual por SQL divergiera el contenido, nadie lo sabría hasta que un admin corra el endpoint por curiosidad. El mecanismo de detección existe y está bien hecho — solo falta dispararlo.

**Riesgo técnico:** Divergencia de contenido persistente sin señal, en la fase más delicada del cutover (primeras semanas de read).

**Riesgo para el negocio:** Datos operativos distintos según la superficie que los consulte (app vs SQL directo).

**Causa raíz probable:** El cutover se cerró hace <24 h; el job de vigilancia quedó como paso natural siguiente.

**Recomendación:** Añadir el job esta semana, mientras el dual-write sigue siendo la red de seguridad.

**Solución inmediata:** setInterval diario (patrón ya usado 14 veces en proxy.js): typedParity() → si !ok, createNotification a admins con las colecciones y difs.

**Solución definitiva:** El mismo job alimenta el criterio de retiro del dual-write (hallazgo siguiente): N días consecutivos de paridad ok.

**Esfuerzo estimado:** Bajo

**Prioridad:** P2

**Dependencias:** Ninguna

**Criterio de aceptación:** Divergencia sembrada por SQL en dev genera notificación admin en <24 h.

**Cómo validar la corrección:** UPDATE manual a una t_* en dev y esperar el job (o invocarlo).


## Hallazgo DB-09: Sin plan de retiro del dual-write y procedimiento de regeneración de typed-schemas.js perdido

**Área:** E — Base de datos y modelo de datos

**Severidad:** Media

**Estado:** Confirmado

**Componente afectado:** typed-schemas.js + storage-pg.js

**Evidencia encontrada:** typed-schemas.js:14-15 'Para regenerar: scratchpad/gen-schema.mjs de la sesión 22-jul' — find en todo el repo: gen-schema* NO existe (los scratchpads de sesión son efímeros); ningún criterio de retiro en código ni docs (MEMORIA-PROYECTO: 'retirar dual-write cuando haya confianza')

**Problema:** (a) Cada transacción escribe 2-3 veces la misma fila (collection_rows + t_* + export horario) sin fecha ni criterio para consolidar — costo aceptable hoy pero deuda estructural que se normaliza; (b) el script que generó los esquemas desde los datos reales de prod solo vivió en un scratchpad de sesión: regenerarlos ante drift masivo de tipos exige reconstruir el procedimiento desde el comentario (la query SQL sí está documentada, las reglas de mapeo solo en prosa).

**Riesgo técnico:** Campos nuevos caen a _extra para siempre (sin pérdida, pero erosionando el modelo tipado); colecciones nuevas quedan JSONB-only; nadie 'promueve' columnas porque el procedimiento se perdió.

**Riesgo para el negocio:** El valor del cutover (consultas SQL tipadas para análisis/Codex) se degrada gradualmente.

**Causa raíz probable:** Cutover ejecutado en una sesión intensiva; los artefactos auxiliares no se consolidaron al repo.

**Recomendación:** Documentar la decisión aunque sea 'dual permanente': lo caro es la ambigüedad, no el modo.

**Solución inmediata:** Reconstruir gen-schema.mjs (es corto: la query de typed-schemas.js:6-7 + reglas de :8-11) y commitearlo a scripts/.

**Solución definitiva:** Definir el criterio de retiro por escrito (ej.: 30 días de job de paridad verde → dejar de escribir collection_rows, conservando kv_store y el export JSON como rollback) y calendario de re-generación de esquemas (trimestral o al detectar >N claves nuevas en _extra).

**Esfuerzo estimado:** Bajo

**Prioridad:** P2

**Dependencias:** Job de paridad (hallazgo anterior)

**Criterio de aceptación:** scripts/gen-schema.mjs en el repo y criterio de retiro escrito en MEMORIA-PROYECTO.md.

**Cómo validar la corrección:** Correr gen-schema contra PG local y diff contra typed-schemas.js actual (debe ser estable).


## Hallazgo DB-10: El snapshot de respaldo completo exporta secretos en claro (passwordHash, refreshTokens, resetTokens, claves VAPID) a OneDrive

**Área:** E — Base de datos y modelo de datos

**Severidad:** Media

**Estado:** Confirmado

**Componente afectado:** proxy.js /api/backup/collections.json.gz

**Evidencia encontrada:** proxy.js:12284-12292 'out.collections = pgStorage.snapshotAll()' — incluye wwp-users-auth (passwordHash, resetToken — typed-schemas.js:404,407), wwp-sessions (refreshToken — :279) y vapid-keys; contrasta con /api/admin/export-data que SÍ 'excluye sesiones activas y audit log (datos sensibles)' (proxy.js:12304)

**Problema:** El respaldo total (correctamente diseñado para poder reconstruir la DB) termina en una carpeta OneDrive personal sin cifrado adicional: quien acceda a esa cuenta obtiene tokens de refresh reutilizables, hashes PBKDF2 de 29 usuarios y las claves push del sistema.

**Riesgo técnico:** Ampliación de superficie: el eslabón más débil pasa a ser una cuenta Microsoft personal.

**Riesgo para el negocio:** Suplantación de sesión de cualquier usuario (incl. admins) desde un backup filtrado.

**Causa raíz probable:** El endpoint prioriza completitud de restauración (legítimo) sin capa de cifrado en reposo del lado del consumidor.

**Recomendación:** Excluir wwp-sessions del snapshot es la vía barata: restaurar sin sesiones es deseable de todos modos.

**Solución inmediata:** Cifrar en el script nocturno antes de escribir (age/gpg simétrico con clave fuera de OneDrive), o excluir refreshToken/resetToken del snapshot (regenerables: solo fuerza re-login tras restaurar).

**Solución definitiva:** Snapshot con redacción selectiva por colección (sessions completa fuera; users-auth sin resetToken) + cifrado del archivo; documentar qué se pierde al restaurar (solo sesiones vivas).

**Esfuerzo estimado:** Bajo

**Prioridad:** P2

**Dependencias:** Coordinar con el drill de restauración

**Criterio de aceptación:** El .gz restaurable no contiene tokens vivos; restore drill confirma que la app arranca y pide re-login.

**Cómo validar la corrección:** zcat del snapshot | grep refreshToken → vacío.


## Hallazgo DB-11: rejected_writes y bloqueos del blindaje anti-vacío no se alertan a nadie

**Área:** E — Base de datos y modelo de datos

**Severidad:** Media

**Estado:** Confirmado

**Componente afectado:** storage-pg.js + proxy.js

**Evidencia encontrada:** storage-pg.js:206-210 (console.error + INSERT a rejected_writes); la tabla no se lee en ningún endpoint (grep rejected_writes: solo storage-pg.js y su test); health() no la incluye (storage-pg.js:764-776)

**Problema:** Cuando el blindaje bloquea un vaciado está atrapando, por definición, un bug grave del caller (el mismo patrón del incidente 25-jun). Hoy esa señal muere en el log de Railway y en una tabla que nadie consulta: el bug causante sigue vivo y reintentándose sin que el operador lo sepa.

**Riesgo técnico:** El síntoma del próximo bug destructor de datos queda silenciado por la propia defensa.

**Riesgo para el negocio:** Se pierde la oportunidad de arreglar la causa raíz antes de que mute a un caso que el blindaje no cubra (ej. vaciado parcial).

**Causa raíz probable:** La defensa se construyó fail-safe (no crashear) pero sin canal de observabilidad hacia humanos.

**Recomendación:** Reusar el molde exacto de checkDiskSpace: notificación 1×/día por colección afectada.

**Solución inmediata:** En el bloqueo: createNotification a admins (patrón disk-alert, proxy.js:280-283) + exponer count de rejected_writes en pgStorage.health().

**Solución definitiva:** Endpoint admin GET de rejected_writes recientes con colección/longitudes/fecha para diagnóstico.

**Esfuerzo estimado:** Bajo

**Prioridad:** P2

**Dependencias:** Ninguna

**Criterio de aceptación:** Simular save crítico vacío en dev → notificación visible a admin y contador en /api/health.

**Cómo validar la corrección:** Test unitario sobre saveCollection con critical:true y data=[] + snapshot previo >=5.


## Hallazgo DB-12: RPO real no documentado: ante crash duro (no SIGTERM) durante una caída de PG, la RAM es la única copia de lo escrito

**Área:** E — Base de datos y modelo de datos

**Severidad:** Baja

**Estado:** Confirmado

**Componente afectado:** storage-pg.js cola de escritura + export horario

**Evidencia encontrada:** storage-pg.js:199-200 'Nunca lanza por fallas de red: la memoria es la fuente de verdad inmediata y la cola reintenta'; :262-266 (solo shutdown abandona la cola); proxy.js:260 (export a JSON cada 60 min); boot.js:44-55 (drain solo en SIGTERM/SIGINT)

**Problema:** En operación normal el flush es inmediato (ventana de ms). Pero si PG está caído, las escrituras se acumulan solo en RAM (coalescidas a resync) y el respaldo JSON se refresca a lo sumo cada hora: un OOM/kill -9 del proceso en ese estado pierde hasta 1 h de operación. Es un trade-off razonable y consciente del diseño — lo que falta es que el RPO esté escrito y aceptado.

**Riesgo técnico:** Pérdida de hasta ~60 min de mutaciones en el peor caso compuesto (PG caído + crash duro).

**Riesgo para el negocio:** Re-captura manual de estados de tareas de una hora pico; probabilidad baja (dos fallas simultáneas).

**Causa raíz probable:** Diseño memoria-primero con durabilidad asíncrona; correcto para el contexto, indocumentado.

**Recomendación:** Documentar; el export condicional por error persistente es opcional y barato si se quiere.

**Solución inmediata:** Documentar el RPO por escenario en MEMORIA-PROYECTO/RAILWAY.md.

**Solución definitiva:** Si se quisiera apretar: export a JSON disparado cuando lastError lleva >N min activo (la señal ya existe en state.lastError), bajando el RPO del escenario compuesto a minutos.

**Esfuerzo estimado:** Bajo

**Prioridad:** P3

**Dependencias:** Ninguna

**Criterio de aceptación:** RPO/RTO escritos y aceptados por Gabriel.

**Cómo validar la corrección:** Revisión del doc; simular DB caída en dev y verificar export condicional si se implementa.


## Hallazgo DB-13: El umbral fijo del blindaje anti-vacío (>=5) deja sin protección colecciones críticas pequeñas

**Área:** E — Base de datos y modelo de datos

**Severidad:** Baja

**Estado:** Confirmado

**Componente afectado:** storage-pg.js / proxy.js saveCriticalArray

**Evidencia encontrada:** storage-pg.js:206 'prevLen >= 5' y proxy.js:219 'prev.length >= 5'; en prod hoy: wwp-role-defs=4, sdv-cancellation-audit=4, wwp-training-courses=3, wwp-inventario-casos=3 (health 22-jul)

**Problema:** Vaciar wwp-role-defs (la definición completa del RBAC custom) o wwp-training-courses pasaría el blindaje sin bloqueo, porque tienen menos de 5 filas. El 5 fue calibrado para el incidente de wwp-tasks, no por criticidad.

**Riesgo técnico:** Un bug tipo 25-jun sobre una colección chica no sería bloqueado (sí quedaría en backups horarios).

**Riesgo para el negocio:** Pérdida temporal del modelo de permisos o cursos: recuperable, pero con fricción.

**Causa raíz probable:** Umbral único heredado del incidente original.

**Recomendación:** Cambio de 5 líneas; aprovechar para testearlo en test-storage-pg.mjs.

**Solución inmediata:** Umbral 1 para una lista corta de colecciones config (wwp-role-defs, wwp-vehicles, emp-reglas, wwp-training-courses): nunca vaciar si tenían >=1.

**Solución definitiva:** Mapa colección→umbral en un solo const compartido por ambos backends.

**Esfuerzo estimado:** Bajo

**Prioridad:** P3

**Dependencias:** Ninguna

**Criterio de aceptación:** save crítico vacío sobre wwp-role-defs con 4 filas queda bloqueado.

**Cómo validar la corrección:** Test unitario en modo PG y archivo.


## Hallazgo DB-14: El borrado de evidencia de tareas ignora la capa media: en R2 el objeto sobrevive y la foto 'borrada' se sigue sirviendo

**Área:** E — Base de datos y modelo de datos

**Severidad:** Baja

**Estado:** Confirmado

**Componente afectado:** proxy.js DELETE /api/wwp/tasks/:id/evidence/:fname

**Evidencia encontrada:** proxy.js:13947-13948 'fs.existsSync(fpath) … fs.unlinkSync(fpath)' — borra solo del disco, no llama deleteMediaUrl/mediaDelete (que sí existen, proxy.js:56-59); con R2 activo mediaGet sirve primero del bucket (media.js:138-151)

**Problema:** El cableado de media.js quedó incompleto en este endpoint (media.js:17-20 documenta ~19 puntos a migrar): con R2 en prod, borrar evidencia elimina la referencia del JSON pero el objeto persiste en el bucket y su URL pública sigue respondiendo. Ambivalente: preserva evidencia (bueno) pero contradice la intención del admin y acumula huérfanos.

**Riesgo técnico:** Objetos huérfanos en R2 + comportamiento inconsistente entre modo disco (borra) y modo R2 (no borra).

**Riesgo para el negocio:** Una foto que un admin quiso retirar (ej. error de privacidad) sigue accesible por URL directa.

**Causa raíz probable:** Migración A1/A2 parcial: este endpoint es anterior y no se tocó.

**Recomendación:** Decidir además la política: si la evidencia debe ser inmutable, que el DELETE solo desanexe (y documentarlo); hoy es accidental.

**Solución inmediata:** Sustituir el unlink por deleteMediaUrl('wwp-fotos', fname) (ya cubre R2 y disco).

**Solución definitiva:** Barrido de los fs.unlinkSync/writeFileSync restantes sobre carpetas de media (grep) hacia mediaPut/mediaDelete.

**Esfuerzo estimado:** Bajo

**Prioridad:** P3

**Dependencias:** Ninguna

**Criterio de aceptación:** Comportamiento idéntico en disco y R2 conforme a la política elegida.

**Cómo validar la corrección:** Borrar evidencia en dev con R2 de prueba y verificar GET de la URL.


## Hallazgo DB-15: .env.example no documenta ninguna variable del stack de datos actual

**Área:** E — Base de datos y modelo de datos

**Severidad:** Baja

**Estado:** Confirmado

**Componente afectado:** .env.example

**Evidencia encontrada:** .env.example completo (leído 22-jul): sin DATABASE_URL, WWP_TYPED, PGSSL, R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY/R2_BUCKET/R2_ENDPOINT, BACKUP_TOKEN ni DISK_ALERT_MIN_MB — todas leídas en el código (storage-pg.js:53,575,589; media.js:55-58; proxy.js:1750,266)

**Problema:** La configuración que decide el backend de datos, el modo del cutover, el destino de las fotos y el acceso al respaldo vive solo en Railway y en memoria tribal. Un disaster recovery o un segundo entorno (staging) partiría de un ejemplo que describe el sistema de hace dos meses.

**Riesgo técnico:** Recrear el entorno correcto bajo presión depende de recordar variables no documentadas.

**Riesgo para el negocio:** Alarga el RTO de cualquier incidente que exija redeployar desde cero.

**Causa raíz probable:** El stack evolucionó rápido (PG jun, R2 y typed jul) y el ejemplo quedó congelado en la era Render.

**Recomendación:** 15 minutos de trabajo; hacerlo junto al runbook de restauración.

**Solución inmediata:** Añadir las ~10 variables con comentario de una línea cada una (sin valores).

**Solución definitiva:** Incluir revisión de .env.example en el checklist de deploy cuando se agregue una env nueva.

**Esfuerzo estimado:** Bajo

**Prioridad:** P3

**Dependencias:** Ninguna

**Criterio de aceptación:** Todas las process.env.* de storage-pg/media/proxy relevantes aparecen en el ejemplo.

**Cómo validar la corrección:** grep process.env en los 3 archivos vs .env.example.



---

# Área F — Frontend

**Resumen del área:** El frontend es una SPA monolítica artesanal sin framework ni build: historial.html tiene 34.662 líneas (2,21 MB; 514 KB gzip), 1.056 funciones nombradas y ~2.481 declaraciones top-level en sloppy mode, con core.js (2.508 líneas) extraído como núcleo compartido y 4-5 islas iframe con core-isla.js (Olas 1-3 del plan 08, en curso — una sesión paralela está extrayendo empaque.html ahora mismo). La disciplina de calidad es sorprendentemente alta para su naturaleza: escape XSS consistente (804 usos de esc()), CSP real en el servidor, ARIA en modales, service worker con SWR + version-gate anti-loop bien diseñado para la flota de dispositivos de gama baja, y estados de carga/error en los flujos principales. Los problemas reales son estructurales, no de descuido: tokens JWT en localStorage con CSP 'unsafe-inline' (XSS = robo de sesión), fotos de evidencia servidas sin autenticación (TODO reconocido en el código), espejos manuales de metadata en 3 archivos, acoplamiento por globals implícitos entre core.js y el shell, y un bug funcional de RBAC en el kanban por drift entre claves de permiso. La modularización por islas ya en marcha es el camino correcto; no se necesita framework ni reescritura.

**Madurez:** 3/5 — Un 3 sólido y honesto. Lo que descarta un 2: disciplina XSS consistente y verificada, CSP+security headers reales, SW con version-gate anti-loop de calidad profesional, contrato de estáticos hasheados cumplido y protegido por tests e2e, accesibilidad y estados de UI muy por encima de lo normal en herramientas internas, y una modularización (plan 08) en ejecución activa con dirección correcta. Lo que impide un 4: el shell sigue siendo un monolito de 34,6k líneas con ~2.481 globals en sloppy mode y acoplamientos implícitos core.js↔shell que solo funcionan por orden de carga; los tokens de sesión viven en localStorage bajo una CSP con 'unsafe-inline'; las fotos de evidencia se sirven sin auth; y la metadata espejada a mano en 3 archivos ya produjo drift observable (bug del kanban, tipos de notif desalineados entre core.js y sw.js). La nota pondera el contexto: para 1 desarrollador con ~30 usuarios, la arquitectura elegida (vanilla + islas, sin build) es apropiada — el déficit es de consolidación, no de elección tecnológica.

## Fortalezas verificadas

- Disciplina de escape XSS consistente y verificada por muestreo: 804 usos de esc() + 50 de escH en historial.html; chat (historial.html:12631-12634), lista/kanban de tareas (10800, 10841), drawer (descripción esc:12237), notifs (core.js:2046-2047) y las islas (politicas.html:290-302 vía escH=esc) escapan datos de usuario sistemáticamente. No se encontró ningún sink innerHTML con texto libre de usuario sin escapar en los flujos centrales.
- Service worker maduro y pensado para la operación real: SWR del HTML con cache-key normalizada (sw.js:53-67), version-gate con anti-loop por sessionStorage que borra caches y recarga una sola vez por build (core.js:1791-1820), poll de versión cada 60s incluso sin sesión — la flota converge sola tras cada deploy.
- Contrato de estáticos versionados cumplido: los stamps ?v= de core.js (77118dd8), theme.css (f232ab1b), core-isla.js (f7b1b597) y ui-isla.css (0135f0d7) COINCIDEN con el md5-8 real de cada archivo (verificado hoy), con caché immutable 1 año en proxy.js:20690-20693 y test e2e (smoke-05) que protege el contrato.
- Manejo de red robusto para wifi de almacén: authFetch con refresh automático en 401 (core.js:670-680), authFetchRetry con backoff que solo reintenta fallas de red puras y detecta respuestas no-JSON del borde de Railway durante deploys (core.js:687-714), fetchWithTimeout y mensajes de error humanos (_friendlyFetchError).
- Estados de UI completos en los flujos principales: spinner + error con mensaje en loadTasks (historial.html:9247-9259), 44 empty states, toasts tipados (error/success/info) compartidos shell+islas.
- Accesibilidad por encima de lo típico en apps internas: 181 atributos aria-, 120 role=, modales con role=dialog + aria-modal + aria-labelledby (historial.html:7219, 23154), tablist con teclado (6346), Escape en 10+ modales, prefers-reduced-motion respetado (core.js:417-419, 1216).
- Theming tokenizado y compartido: theme.css solo variables (claro + [data-theme=dark]) consumidas por shell e islas; cambio de tema en vivo entre iframes vía evento storage (core-isla.js:39-45).
- Rendimiento móvil considerado: islas iframe con loading=lazy y src on-demand (historial.html:9058-9064), xlsx.min.js (881 KB) cargado solo al exportar (25-31), lucide defer con hidratación acotada por root para Android 8 (core.js:450-472), fotos Odoo vía authFetch→blob con caché Map (core.js:265-339), gzip con caché en memoria en el server (proxy.js:20728-20758), 58 media queries y viewport correcto.
- Validación en ambos lados en la ruta principal: el wizard valida en cliente (historial.html:15855-15875) Y el server re-valida title/type/priority/fecha/límites con 400/422 (proxy.js:12893-12900), más RBAC real por JWT en POST/PATCH de tareas (proxy.js:12889-12890, 13077-13095).
- postMessage entre shell e islas siempre verifica ev.origin === location.origin (core-isla.js:83, historial.html:22758) y la sesión se comparte por storage, nunca por URL.
- Librerías locales sin CDN (lucide/xlsx/three) — correcto para un almacén con internet inestable y coherente con la CSP.

## Hallazgo FE-01: Fotos de evidencia (clientes, direcciones, entregas) servidas sin autenticación

**Área:** F — Frontend

**Severidad:** Alta

**Estado:** Confirmado

**Componente afectado:** proxy.js (capa media) + historial.html (consumo por <img>)

**Evidencia encontrada:** proxy.js:20589-20608 — comentario explícito: «Se sirve SIN Authorization a propósito: las <img>/<video> del cliente no mandan cabeceras (el endurecimiento por URL firmada es un paso posterior de Fase 1)»; prefijos públicos /av-fotos/, /desp-fotos/, /wwp-fotos/, /sdv-adjuntos/, /inspection/. El cliente los consume con <img src> directo (historial.html:11787, 12632).

**Situación actual:** Contraste interno: las fotos de empleados/productos de Odoo SÍ van protegidas por JWT (authFetch→blob, core.js:265-355), pero la evidencia operativa —que contiene datos de clientes— va abierta. La brecha ya está reconocida en el propio código como paso pendiente.

**Problema:** Cualquier persona con la URL puede descargar fotos operativas (evidencia de entregas en casas de clientes, chat de tareas, inspecciones) sin sesión. Los nombres NO son aleatorios: patrón <taskId>_<Date.now()>_<idx>.<ext> (proxy.js:13918, 10579), semi-predecibles por enumeración de timestamps si se conoce un taskId.

**Práctica estándar de la industria:** URLs firmadas con expiración (R2/S3 presigned) o query-token de corta vida emitido por el server, manteniendo el <img> directo.

**Riesgo técnico:** Exposición de media por URL filtrada (logs, historial de navegador, screenshot) o enumeración.

**Riesgo para el negocio:** Fotos de domicilios y nombres de clientes de Altri Tempi accesibles sin control — riesgo reputacional y de privacidad en una empresa que entrega a domicilio.

**Causa raíz probable:** Limitación real de <img> (no manda Authorization) resuelta con la opción más simple; el endurecimiento quedó como TODO en comentario.

**Recomendación:** Promover el firmado de URLs de media a ítem del plan activo: query-token HMAC de corta vida validado por el server, con mediaUrl() (core.js:54-58) como único punto de cambio en el cliente.

**Solución inmediata:** Query-token HMAC (?t=firma(exp,path)) validado antes de servir /wwp-fotos/* y /desp-fotos/*.

**Solución definitiva:** Presigned URLs de R2 con expiración (ya hay SDK S3 en media.js) emitidas por endpoint autenticado.

**Esfuerzo estimado:** Medio

**Prioridad:** P1

**Dependencias:** media.js/R2 ya operativos (fotos migradas a R2 el 22-jul).

**Criterio de aceptación:** GET a /wwp-fotos/<archivo> sin token → 401/403; con token vigente → 200; las <img> del drawer y chat siguen cargando.

**Cómo validar la corrección:** curl sin cabeceras a una URL de evidencia real en producción (hoy devuelve 200); repetir tras el fix.

**Verificación adversarial (CONFIRMADO):** Reproduje toda la evidencia hoy contra el working tree: el bloque de media en proxy.js sirve los prefijos de evidencia sin requireJwt, con el comentario literal «Se sirve SIN Authorization a propósito», y busqué activamente un fix (presigned, HMAC de media, query-token) sin encontrar ninguno — el único createHmac del repo es el del JWT. El alcance real es hoy incluso mayor que el citado: el bloque también sirve /prod-img/ y /showroom-fotos/ (fotos que antes iban embebidas en JSONB, migradas en A1/A2). La severidad Alta/P1 no está inflada: la base de usuarios pequeña no reduce la exposición porque producción es una URL pública de Railway y el contenido es PII de clientes (fotos de domicilios); el hallazgo tampoco confunde la decisión deliberada — la enmarca correctamente como paso pendiente reconocido en el propio código. Único matiz: la enumeración por timestamps en ms es poco práctica a escala (el vector realista es la fuga de URL), pero el propio hallazgo ya lo califica como «semi-predecible», y para la solución definitiva falta además @aws-sdk/s3-request-presigner (media.js solo trae client-s3). · Evidencia re-vista: proxy.js:20589-20618 (bloque media sin auth; comentario en 20592-20593; prefijos en 20595-20598, incluye ahora /prod-img/ y /showroom-fotos/); proxy.js:3313 (único createHmac = JWT, no media); patrón `${id}_${Date.now()}_${fi}.${ext}` en los endpoints de subida av-fotos y wwp-fotos (proxy.js ~10579 y ~13918); historial.html:11787, 11901, 11922, 12098, 12166, 12451-12452 (<img/video src=mediaUrl directo); core.js:54-58 (mediaUrl) y core.js:265-355 (contraste: fotos Odoo vía authFetch→blob con JWT); media.js:84-93 (@aws-sdk/client-s3 presente, sin presigner).


## Hallazgo FE-02: Tokens JWT (access + refresh) en localStorage con CSP 'unsafe-inline' — XSS = robo de sesión persistente

**Área:** F — Frontend

**Severidad:** Alta

**Estado:** Confirmado

**Componente afectado:** core.js (saveSession/checkStoredSession), core-isla.js, proxy.js (CSP)

**Evidencia encontrada:** core.js:664-668 — saveSession guarda {accessToken,refreshToken,user} en localStorage cuando remember está activo (checked por defecto: historial.html:5384); core-isla.js:23-26 lo relee; proxy.js:7816 — CSP con script-src 'self' 'unsafe-inline'.

**Situación actual:** La disciplina esc() es buena (fortaleza), pero es una defensa única y manual; el diseño concentra identidad + sesión larga en un storage legible por cualquier JS del origen.

**Problema:** Un solo XSS exitoso en cualquiera de los 523 sinks innerHTML del shell (o en una isla) puede exfiltrar el refresh token y mantener la sesión robada indefinidamente. La CSP no mitiga porque 'unsafe-inline' es obligatorio para el monolito inline.

**Práctica estándar de la industria:** Refresh token en cookie httpOnly+SameSite (el access de corta vida puede quedar en memoria/storage); o rotación de refresh tokens con detección de reuso.

**Riesgo técnico:** Robo de sesión persistente ante una sola regresión XSS; 29 usuarios, incluidos admins.

**Riesgo para el negocio:** Una sesión admin robada permite manipular tareas, usuarios y datos operativos del almacén.

**Causa raíz probable:** Arquitectura file://-compatible original (WWP_SERVER_ORIGIN, core.js:18) que descartó cookies; nunca se revisitó.

**Recomendación:** Corto plazo: rotación de refresh token en cada uso + vida más corta. Medio plazo: migrar el refresh token a cookie httpOnly y retirar el soporte file:// (producción es Railway, mismo origen).

**Solución inmediata:** Rotación de refresh token con invalidación del anterior y vida útil acortada (solo backend).

**Solución definitiva:** Refresh token en cookie httpOnly; el access token de corta vida es lo único visible al JS (islas incluidas).

**Esfuerzo estimado:** Medio

**Prioridad:** P2

**Dependencias:** Cambios en /api/wwp/auth/login|refresh|logout; islas y almacen-mapa solo necesitan el access token en storage.

**Criterio de aceptación:** El refresh token no aparece en localStorage/sessionStorage; el robo del access token expira en minutos.

**Cómo validar la corrección:** DevTools → Application → Local Storage en producción: hoy wwp_auth contiene ambos tokens en claro.


## Hallazgo FE-03: Monolito historial.html: 34.662 líneas, ~2.481 globals y 1.056 funciones en un espacio de nombres plano

**Área:** F — Frontend

**Severidad:** Alta

**Estado:** Confirmado

**Componente afectado:** historial.html

**Evidencia encontrada:** wc: 34.662 líneas / 2.212.852 bytes; grep: 1.056 funciones top-level, 2.481 declaraciones var/let/const top-level, 523 innerHTML, 892 handlers inline on*=; funciones gigantes: renderDrawer 1.064 líneas (historial.html:11525), loadCancelacionesKPIs 608, renderReposicion 337, _wizSave 254.

**Situación actual:** El plan 08 ya ataca esto con resultados: core.js (Ola 1), theme.css, 4 islas (Ola 3) extraídas, y empaque.html en extracción ahora mismo por otra sesión. La dirección es correcta.

**Problema:** Todo comparte un único scope global en sloppy mode: colisiones de nombres, imposibilidad de razonar por partes, y cada edición navega un archivo de 2,2 MB. El bug can('tasks_edit') (hallazgo aparte) ejemplifica el tipo de error que este entorno produce: nada valida referencias entre 1.056 funciones y 2.481 globals.

**Práctica estándar de la industria:** Para este contexto (1 dev + agentes IA, sin build): extraer islas autocontenidas con contrato postMessage — exactamente lo que se hace. NO framework ni bundler.

**Riesgo técnico:** Regresiones cruzadas al tocar cualquier sección; TDZ/orden de carga frágil; onboarding imposible para un segundo dev.

**Riesgo para el negocio:** Velocidad de entrega decreciente y bus factor 1 sobre la herramienta operativa central.

**Causa raíz probable:** Crecimiento orgánico de artifact a plataforma sin punto de corte.

**Recomendación:** Continuar el plan 08 sin pausa y priorizar las secciones más grandes restantes (drawer WWP, SDV, inventario); meta: shell reducido a auth+nav+notifs+router.

**Solución inmediata:** Siguiente ola: extraer la sección más grande restante tras empaque.

**Solución definitiva:** Shell < ~15k líneas; cada dominio en su isla sobre core-isla.js/theme.css.

**Esfuerzo estimado:** Alto

**Prioridad:** P2

**Dependencias:** Suite e2e (ya existe y protege las olas); coordinación entre sesiones paralelas en el mismo árbol.

**Criterio de aceptación:** historial.html por debajo de ~15k líneas; ninguna función nueva >300 líneas.

**Cómo validar la corrección:** wc -l historial.html tras cada ola; smoke e2e verdes.


## Hallazgo FE-04: Bug RBAC en kanban: can('tasks_edit') usa una clave de permiso inexistente — solo admin puede arrastrar tarjetas

**Área:** F — Frontend

**Severidad:** Media

**Estado:** Confirmado

**Componente afectado:** historial.html (kanbanDrop) vs core.js (can)

**Evidencia encontrada:** historial.html:10870 — «if (!can('tasks_edit')) { toast('Sin permiso para mover tareas'); return; }»; core.js:68-93 — el mapa define 'edit_task' (no 'tasks_edit'); una clave desconocida cae a PERMISSIONS[perm]||[] → false para todo rol salvo admin. Los otros 3 call-sites usan can('edit_task').

**Problema:** Encargados con wwp.editar_tarea concedido reciben «Sin permiso para mover tareas» al arrastrar en kanban, aunque pueden editar la misma tarea desde el drawer. Inconsistencia funcional pura del cliente (el server sí les permitiría el PATCH, proxy.js:13078).

**Práctica estándar de la industria:** Claves de permiso como constantes en un solo lugar; test de paridad usadas vs definidas.

**Riesgo técnico:** Fricción operativa y percepción de bug; síntoma del riesgo de strings mágicos sin validación.

**Riesgo para el negocio:** Los encargados no usan el kanban o piden a un admin.

**Causa raíz probable:** Drift de nombre entre el mapa de permisos y un call-site; nada lo detecta.

**Recomendación:** Fix de una línea ('tasks_edit'→'edit_task') + chequeo automatizado de que toda clave pasada a can()/canSection() exista en los mapas.

**Solución inmediata:** Cambiar 'tasks_edit' por 'edit_task' en historial.html:10870.

**Solución definitiva:** Test en e2e/harness que valide las claves de can() contra _PERM_SP_MAP∪PERMISSIONS∪especiales.

**Esfuerzo estimado:** Bajo

**Prioridad:** P2

**Criterio de aceptación:** Un manager con wwp.editar_tarea puede arrastrar tarjetas en kanban.

**Cómo validar la corrección:** Login como manager con ese permiso, vista kanban, arrastrar: hoy sale el toast de sin permiso.


## Hallazgo FE-05: Metadata de notificaciones espejada a mano en 3 archivos (proxy.js, core.js, sw.js) — drift garantizado

**Área:** F — Frontend

**Severidad:** Media

**Estado:** Confirmado

**Componente afectado:** core.js, sw.js, proxy.js

**Evidencia encontrada:** core.js:981-984 — «ESPEJO de NOTIF_META en proxy.js (~4453) — mantener en sincronía (igual que APP_BUILD)»; sw.js:86-135 — NOTIF_URGENCY como fallback; además _NOTIF_ICONS, _NOTIF_CTA, _NOTIF_ACTIONABLE_TYPES solo en cliente; APP_BUILD duplicado (historial.html:8497 y proxy.js:291); TYPE_LABELS/STATUS_LABELS en core.js:412-415.

**Problema:** Cada tipo de notificación nuevo exige tocar 3+ mapas en 3 archivos. El server ya estampa category/urgency (v140), pero íconos/CTAs/accionables siguen siendo fuente primaria en cliente y se desincronizan en silencio: un tipo no mapeado cae a campana genérica sin CTA (ej.: geo_evidencia_lejos existe en core.js:1016 y no en sw.js).

**Práctica estándar de la industria:** Una sola fuente de verdad servida al cliente o chequeo automatizado de paridad.

**Riesgo técnico:** Notificaciones nuevas degradadas o sin acción; el patrón ya requirió fixes espejo antes (core.js:2259-2263).

**Riesgo para el negocio:** Avisos operativos críticos que no destacan como críticos en algún canal.

**Causa raíz probable:** Sin build step que comparta constantes entre server, shell y SW.

**Recomendación:** Test de paridad de claves entre los 3 mapas ahora; a futuro, estampar también icon/cta desde el server y dejar los mapas cliente como fallback puro.

**Solución inmediata:** Harness .mjs que parsee los 3 mapas y falle ante claves faltantes.

**Solución definitiva:** Payload de notif con icon/cta estampados por el server (ya trae urgency/category).

**Esfuerzo estimado:** Medio

**Prioridad:** P2

**Criterio de aceptación:** Agregar un tipo nuevo solo en proxy.js produce render correcto en panel, toast y push.

**Cómo validar la corrección:** Diff de claves entre proxy.js NOTIF_META, core.js _NOTIF_META y sw.js NOTIF_URGENCY (hoy ya divergen).


## Hallazgo FE-06: Acoplamiento por globals implícitos: core.js depende de símbolos definidos más abajo en el shell, sin contrato

**Área:** F — Frontend

**Severidad:** Media

**Estado:** Confirmado

**Componente afectado:** core.js ↔ historial.html

**Evidencia encontrada:** core.js:1331-1332 usa escHtml() definida en historial.html:26769 (18.000 líneas después del <script src> de core.js en la 8500); core.js referencia _tasks, _drawerTask, _currentTab, renderTasks, switchTab, openDrawer, seqLabel… globals del shell; cabecera core.js:10-13: «SIN 'use strict' … No mover el tag ni hacerlo defer/async».

**Situación actual:** Decisión consciente y documentada de la Ola 1 (extracción sin cambios). Aceptable como paso intermedio, peligrosa como estado final.

**Problema:** core.js no es un módulo: es un recorte posicional del monolito. Funciona solo si se carga síncrono en la posición exacta y el shell define después ~30 símbolos que core.js consume. Cualquier reordenamiento, defer o renombre rompe en runtime sin aviso, con fallas dependientes del timing (p.ej. un push muy temprano llamaría escHtml antes de existir).

**Práctica estándar de la industria:** Interfaces explícitas o al menos asserts de arranque que verifiquen los símbolos requeridos.

**Riesgo técnico:** Fallas intermitentes en el sistema de notificaciones, canal operativo crítico.

**Riesgo para el negocio:** Bugs difíciles de reproducir en producción sin telemetría de errores JS.

**Causa raíz probable:** Extracción mecánica por líneas sin fase de formalización de interfaces.

**Recomendación:** Fase 2 del plan 08: mover a core.js los símbolos que ya usa (empezando por escHtml) y documentar/assertear la lista de globals que espera del shell.

**Solución inmediata:** Mover escHtml a core.js; assert de arranque con la lista contractual de globals.

**Solución definitiva:** core.js con interfaz explícita (window.WWPCore) y el shell registrando callbacks.

**Esfuerzo estimado:** Medio

**Prioridad:** P2

**Criterio de aceptación:** core.js pasa un chequeo de identificadores libres contra la lista contractual documentada.

**Cómo validar la corrección:** node --check + linter de identificadores libres sobre core.js.


## Hallazgo FE-07: Interpolación de datos en handlers inline: esc() no protege el contexto JavaScript (muestra: p.name sin escapar)

**Área:** F — Frontend

**Severidad:** Media

**Estado:** Confirmado

**Componente afectado:** historial.html (patrón extendido; 892 handlers inline)

**Evidencia encontrada:** historial.html:15758 — «onchange="_wizPickSel['${p.name}']=this.checked"» con p.name (nombre de picking de Odoo) SIN esc; patrón análogo con esc: onclick="openDrawer('${t.id}')" (10796), deleteEvidence('${t.id}','${e.name||…}') (11901), openLightbox('${mediaUrl(e.url)}') (12632).

**Problema:** Interpolar datos en atributos on* es doblemente frágil: (a) en 15758 no hay escape alguno — una comilla en un nombre de pick rompe el handler y permite inyectar JS; (b) incluso CON esc(), el parser HTML decodifica &#39; de vuelta a comilla dentro del valor del atributo, por lo que esc() NO protege el contexto JS — hoy salva que los ids (wt_…) y URLs del server no llevan comillas. Vector latente, no exploit actual.

**Práctica estándar de la industria:** data-attributes + delegación de eventos (el propio código ya lo hace bien en data-notif-id + openNotificationById, core.js:2043).

**Riesgo técnico:** XSS/rotura de UI si un dato de Odoo o un nombre de archivo llega con comilla; indetectable por revisión entre 892 handlers.

**Riesgo para el negocio:** Superficie XSS que, combinada con tokens en localStorage, escala a robo de sesión.

**Causa raíz probable:** Plantillas string + onclick inline como patrón por defecto del monolito.

**Recomendación:** Escapar p.name ya; regla para código nuevo: datos → data-*, comportamiento → delegación; migrar oportunísticamente al tocar cada sección.

**Solución inmediata:** Fix de 15758 + grep-auditoría de ${…} dentro de atributos on* sin esc.

**Solución definitiva:** Patrón data-* + addEventListener en todas las secciones al migrarlas a islas.

**Esfuerzo estimado:** Medio

**Prioridad:** P2

**Criterio de aceptación:** grep de on\w+="[^"]*\$\{ sin esc( con datos externos devuelve cero.

**Cómo validar la corrección:** Simular un picking con comilla en el nombre y abrir el wizard: hoy rompe el checkbox.


## Hallazgo FE-08: El server confía la identidad enviada por el frontend al crear tareas (createdBy/by spoofeables)

**Área:** F — Frontend

**Severidad:** Media

**Estado:** Confirmado

**Componente afectado:** Contrato historial.html → proxy.js (POST /api/wwp/tasks)

**Evidencia encontrada:** historial.html:15901 — el wizard manda «createdBy:_user.id, by:_user.name, byUserId:_user.id»; proxy.js:12972-12973 — el server persiste «createdBy: d.createdBy||''» y statusHistory con «by:d.createdBy||''» tal cual, pese a tener el JWT verificado (_jpTask, 12889).

**Problema:** Cualquier usuario autenticado con create_task puede atribuir la creación de una tarea (y su historial) a otra persona modificando el body. La auditoría interna deja de ser confiable.

**Práctica estándar de la industria:** Los campos de identidad/auditoría se derivan SIEMPRE del token verificado, nunca del body.

**Riesgo técnico:** Trazabilidad falsificable en el sistema de tareas.

**Riesgo para el negocio:** Las métricas de desempeño y responsabilidad por tarea (usadas para gestión de personal) pueden manipularse.

**Causa raíz probable:** El frontend nació mandando la identidad y el server la adoptó; el JWT llegó después.

**Recomendación:** Derivar createdBy/by del JWT en el handler e ignorar los del body (el frontend puede seguir mandándolos, se vuelven inertes); barrer el patrón en el resto de endpoints con el área backend.

**Solución inmediata:** createdBy = jp.userId y by = nombre resuelto del JWT en POST/PATCH de tareas.

**Solución definitiva:** Barrido de los ~238 endpoints por d.by/d.userId en body.

**Esfuerzo estimado:** Bajo

**Prioridad:** P2

**Dependencias:** Área backend (mismo hallazgo desde el otro lado).

**Criterio de aceptación:** Un POST con createdBy ajeno persiste el userId del JWT.

**Cómo validar la corrección:** curl autenticado como usuario A con createdBy de B; hoy la tarea queda atribuida a B.


## Hallazgo FE-09: Cada bump de build re-descarga y re-parsea todo el shell (2,21 MB / 514 KB gzip) en toda la flota

**Área:** F — Frontend

**Severidad:** Media

**Estado:** Confirmado

**Componente afectado:** historial.html + sw.js + core.js (version-gate)

**Evidencia encontrada:** gzip -c historial.html | wc -c = 514.196 bytes; el version-gate borra TODOS los caches y recarga (core.js:1809-1817); el HTML se sirve no-store (proxy.js:20687-20689); deploys frecuentes (v227→v228 en ~1 día).

**Situación actual:** El SWR hace el arranque normal instantáneo; el costo se concentra en el minuto post-deploy. Con deploys casi diarios es un costo real pero acotado; las islas ya reducen el peso del shell.

**Problema:** Cualquier cambio de una línea invalida el artefacto completo: ~29 dispositivos (incl. Zebra Android 8) bajan 514 KB y re-parsean 2,2 MB en cada deploy. Además el wipe borra también los estáticos immutable (?v=), forzando re-descarga de lucide (358 KB) y demás aunque no cambiaron.

**Práctica estándar de la industria:** Code splitting; sin build, el equivalente es exactamente el plan de islas en curso.

**Riesgo técnico:** Arranques lentos post-deploy en gama baja; consumo de datos móviles.

**Riesgo para el negocio:** Minutos de fricción operativa tras cada deploy en hora laboral.

**Causa raíz probable:** Monolito de artefacto único sin build; wipe de caches conservador.

**Recomendación:** Ajustar el version-gate para borrar solo la entrada /historial.html (los ?v= se auto-invalidan por URL) y seguir bajando el peso del shell vía islas.

**Solución inmediata:** Cambio de ~3 líneas en core.js:1811-1814 (delete selectivo).

**Solución definitiva:** Shell < ~500 KB tras completar las olas.

**Esfuerzo estimado:** Alto

**Prioridad:** P3

**Criterio de aceptación:** Tras un deploy, se re-descarga el HTML pero lucide/core.js/theme.css se sirven de caché.

**Cómo validar la corrección:** DevTools Network tras simular bump de APP_BUILD: hoy lucide.min.js se re-descarga.


## Hallazgo FE-10: El service worker cachea media de evidencia sin tope ni expiración dentro de un build

**Área:** F — Frontend

**Severidad:** Baja

**Estado:** Confirmado

**Componente afectado:** sw.js

**Evidencia encontrada:** sw.js:70-81 — todo GET cuyo path contenga '.' (excepto .html) se guarda cache-first para siempre en wwp-v59: incluye /wwp-fotos/*, /desp-fotos/*, /sdv-adjuntos/* (fotos y videos). Sin límite ni LRU; solo se vacía cuando el version-gate borra caches al cambiar build.

**Problema:** En dispositivos de 16-32 GB, el Cache Storage acumula todo lo visto entre deploys; una evidencia borrada en el server sigue mostrándose desde caché hasta el próximo build.

**Práctica estándar de la industria:** Excluir media mutable del SW o cachear con tope LRU.

**Riesgo técnico:** Presión de almacenamiento y datos obsoletos visibles.

**Riesgo para el negocio:** Menor; los deploys frecuentes vacían el caché a menudo.

**Causa raíz probable:** Un solo handler genérico para todos los estáticos.

**Recomendación:** Early-return en el fetch handler para los prefijos de media → red directa (el server ya manda max-age=3600).

**Solución inmediata:** Listar los 6 prefijos de media en sw.js y saltarlos.

**Esfuerzo estimado:** Bajo

**Prioridad:** P3

**Criterio de aceptación:** Las fotos de evidencia no aparecen en el Cache Storage del SW.

**Cómo validar la corrección:** DevTools → Application → Cache Storage wwp-v59 tras abrir un chat con fotos: hoy aparecen.


## Hallazgo FE-11: Contraste insuficiente de los tokens de texto atenuado en modo claro (WCAG AA)

**Área:** F — Frontend

**Severidad:** Baja

**Estado:** Confirmado

**Componente afectado:** theme.css

**Evidencia encontrada:** theme.css:32,35 — --text-muted:#7a8c9e (≈3,1:1 sobre --bg #f4f3f1) y --text-3:#a8b5c2 (≈2,0:1), por debajo del 4,5:1 de WCAG AA; usados extensamente en metadatos, tiempos de notifs y hints con fuentes de 10-11px.

**Problema:** Legibilidad pobre justo en el peor entorno: pantallas de terminales bajo luz de almacén. Es sistémico (token), no puntual.

**Práctica estándar de la industria:** Muted ≥ 4,5:1 para texto informativo.

**Riesgo técnico:** —

**Riesgo para el negocio:** Operarios que no leen a la primera fechas/estados secundarios en piso de almacén.

**Causa raíz probable:** Tokens elegidos por estética de dashboard, no probados en el hardware real.

**Recomendación:** Oscurecer 2 tokens en theme.css (p.ej. --text-muted:#5c6f84, --text-3:#8494a6) y re-estampar el ?v= — 2 líneas corrigen toda la app e islas.

**Solución inmediata:** Ajustar los 2 valores + re-stamp.

**Esfuerzo estimado:** Bajo

**Prioridad:** P3

**Criterio de aceptación:** Contraste ≥4,5:1 para --text-muted y ≥3:1 para --text-3 sobre --bg/--surface.

**Cómo validar la corrección:** Contrast checker con los pares actuales.


## Hallazgo FE-12: Mapa de permisos RBAC duplicado frontend/backend sin verificación de paridad

**Área:** F — Frontend

**Severidad:** Baja

**Estado:** Confirmado

**Componente afectado:** core.js (can/_PERM_SP_MAP/PERMISSIONS) vs proxy.js (ROLE_PERMISSIONS)

**Evidencia encontrada:** core.js:68-93 define el modelo del cliente; proxy.js usa ROLE_PERMISSIONS propio (12890, 13078). El drift ya produjo el bug can('tasks_edit'). La seguridad real está en el server (correcto); el cliente solo decide qué mostrar.

**Problema:** Dos modelos que deben evolucionar juntos a mano; al divergir, la UI ofrece acciones que el server rechaza (403 confuso) o esconde acciones permitidas (kanban).

**Práctica estándar de la industria:** El server expone las capacidades efectivas del usuario en login/refresh y el cliente las consume.

**Riesgo técnico:** Inconsistencias UI/permiso recurrentes.

**Riesgo para el negocio:** Fricción y tickets internos.

**Causa raíz probable:** Modelo de permisos nacido en cliente y luego replicado en server.

**Recomendación:** Añadir user.actions[] calculado por el server al payload de login/refresh y hacer que can() lo consulte con fallback al mapa actual.

**Solución inmediata:** Test de paridad de claves entre core.js y proxy.js.

**Solución definitiva:** can() sin listas de roles hardcodeadas para permisos que el server conoce.

**Esfuerzo estimado:** Bajo

**Prioridad:** P3

**Criterio de aceptación:** Un cambio de permisos solo en server se refleja en la UI sin tocar core.js.

**Cómo validar la corrección:** Revisión de core.js:76-81 (PERMISSIONS hardcodea roles hoy).


## Hallazgo FE-13: Peso muerto y documentación desactualizada: chart.min.js sin referencias y CLAUDE.md describiendo archivos retirados

**Área:** F — Frontend

**Severidad:** Baja

**Estado:** Confirmado

**Componente afectado:** chart.min.js, CLAUDE.md, index.html

**Evidencia encontrada:** grep de chart.min.js en *.html y proxy.js: cero referencias (los gráficos WWP son CSS/SVG artesanales); CLAUDE.md aún lista chart.min.js como «Gráficos», basedatos.html como isla activa (eliminada en commit 5275c3a; proxy.js:20585-20587 lo confirma) e index.html como «Dashboard de despachos» (es un placeholder de retiro desde jul-2026).

**Problema:** Los agentes IA que trabajan guiados por CLAUDE.md reciben un mapa falso: pueden intentar editar la isla basedatos o asumir Chart.js disponible. En este proyecto la doc ES parte del sistema de desarrollo.

**Práctica estándar de la industria:** La doc de estructura se actualiza en el mismo commit que mueve/elimina archivos.

**Riesgo técnico:** Ediciones de agentes sobre archivos muertos; confusión de contexto.

**Riesgo para el negocio:** Tiempo perdido de las sesiones de IA (el recurso de desarrollo principal).

**Causa raíz probable:** Velocidad de cambio (una ola por día) supera el ciclo de actualización de CLAUDE.md.

**Recomendación:** Actualizar la tabla de CLAUDE.md (quitar basedatos.html, corregir index.html, marcar chart.min.js) y archivar chart.min.js en _archivo/; adoptar la regla de actualizar la doc en el mismo commit de cada ola.

**Solución inmediata:** Edición de CLAUDE.md + mover chart.min.js a _archivo/assets-huerfanos/.

**Esfuerzo estimado:** Bajo

**Prioridad:** P3

**Criterio de aceptación:** CLAUDE.md refleja el árbol real; chart.min.js fuera de la raíz.

**Cómo validar la corrección:** grep chart.min.js tras archivar (debe seguir en cero referencias).



---

# Área H1 — Seguridad: re-verificación de la auditoría previa

**Resumen del área:** Re-verificados los 24 hallazgos de la auditoría del 22-jul contra el código actual (v228). El balance es muy favorable: 9 hallazgos están CORREGIDOS con evidencia (incluidos 3 de los 4 críticos: silentCatch definida + handlers de proceso, fuente del servidor en denylist, fotos migradas a R2), 7 están PARCIALES y 8 VIGENTES pero casi todos de severidad baja. Los cuatro puntos que siguen mereciendo atención real son: (1) la API key de Odoo sigue commiteada en claro en 5 scripts de _archivo/ y en el historial git, y no hay evidencia verificable de que se haya rotado; (2) el denylist de estáticos no cubre los módulos backend nuevos typed-schemas.js y write-queue.js (regresión del patrón R-03); (3) las fotos de evidencia se sirven sin autenticación por diseño interino documentado; (4) el token JWT completo sigue viajando en query string para el SSE. La postura de seguridad del sistema mejoró sustancialmente desde la auditoría previa — los fixes fueron reales, dirigidos y están comentados en el código con referencia al ID del hallazgo (R-05, R-06C, R-06D, QW2, etc.).

**Madurez:** 3.5/5 — La seguridad del sistema dio un salto real y verificable desde la auditoría del 22-jul: de los 24 hallazgos, 9 están corregidos con evidencia en código (incluidos 3 de los 4 críticos), 7 parciales y 8 vigentes de los cuales casi todos son de baja severidad. Los fundamentos son sólidos para su contexto (PBKDF2 100k, revocación inmediata por relectura de usuario, timingSafeEqual sistemático, lockout de login, CORS y headers correctos, secretos fuera del repo, denylist de fuentes, R2 para evidencia) y la remediación demostró disciplina inusual: cada fix está comentado con el ID del hallazgo. No llega a 4 por cuatro razones concretas: la API key de Odoo sigue en el árbol y en el historial sin rotación confirmada (el único resto de severidad Alta); el denylist ya se desincronizó con los 2 módulos nuevos de Fase 3B (el patrón de regresión estaba diagnosticado y ocurrió igual); las fotos de evidencia con PII se sirven sin auth como interinidad asumida; y la defensa XSS sigue siendo convención manual bajo una CSP con unsafe-inline en un frontend de 34k líneas con 519 innerHTML. Ninguno de estos es difícil de cerrar — tres de los cuatro son de esfuerzo bajo.

## Fortalezas verificadas

- R-01 CORREGIDO: silentCatch definida (proxy.js:25-27 «function silentCatch(err, ctx)») con 76 usos, y handlers globales process.on('unhandledRejection') (proxy.js:32) y process.on('uncaughtException') (proxy.js:35) que loguean sin matar el proceso — el hallazgo crítico #1 quedó cerrado en el commit 7bc8e15 («Fase 0 auditoría»)
- R-03 CORREGIDO (núcleo): el denylist de estáticos ahora incluye 'proxy.js','boot.js','storage-pg.js','sync-from-prod.js','media.js' con comentario «no debe poder descargarse en producción (R-03 auditoría)» (proxy.js:20656-20657), más el patrón _FORBIDDEN_JSON que bloquea familias enteras de .json de datos (proxy.js:20671)
- R-04 CORREGIDO (arquitectura): capa media.js con backend Cloudflare R2 (media.js:55-59 isR2Enabled) y migración histórica disco→R2 on-boot idempotente con marcador .media-r2-migrated (proxy.js:619-647); /api/health reporta media.mode para verificar en prod (proxy.js:8450-8451); la memoria del proyecto confirma fotos de inspección ya en R2
- R-05 CORREGIDO (núcleo): el health shallow ya NO expone dataDir, tasksFile ni tasksRawPreview — comentario explícito «R-05: el health público NO debe filtrar rutas del disco» (proxy.js:8437-8439); la rama ?deep=true ahora exige JWT («R-06C», proxy.js:8435-8436)
- R-06 CORREGIDO: /api/sheets-csv-index eliminado con 404 intencional (proxy.js:7936) e index.html reducido a un stub de retiro de 31 líneas («La integración con Google Sheets fue eliminada», index.html:26)
- R-06B CORREGIDO: todos los endpoints señalados exigen JWT hoy — GET /api/averias (proxy.js:10496), /api/averias/product (:10503), /api/analysis/localities (:8632), POST /api/analysis/container (:8923), GET /api/wwp/odoo-order/:ref (:16152 con comentario R-06C), /api/smoke-test (:8510)
- R-12 CORREGIDO: loadAllReports, toggleGuidedMode y _EO_MOCK_DATA ya no existen en historial.html (0 ocurrencias; poda v219)
- R-15 CORREGIDO: .gitignore reescrito con globs que cubren familias completas (wwp-*.json, sdv-*.json, emp-*.json, vapid-keys.json, push-subscriptions.json, 9 carpetas de fotos, *.pem, .jwt-secret) (.gitignore:1-35)
- R-16B CORREGIDO: @anthropic-ai/sdk eliminado de package.json (dependencias: solo @aws-sdk/client-s3, nodemailer, pg, web-push); el require quedó en try/catch opcional (proxy.js:1740) con comentario honesto «Hoy TODO corre con OpenAI» (proxy.js:1753-1754) y .env.example actualizado (:34-35)
- R-17 CORREGIDO: sync-from-prod.js, _mockup_notif_panel.html y wwp.html ya no existen en la raíz (verificado con ls)
- R-21 CORREGIDO: CLAUDE.md actualizado — documenta que wwp.html «YA NO EXISTE en la raíz» con 302 server-side y corrige la nota de Leaflet→Google Maps
- Fortalezas transversales re-confirmadas: requireJwt relee el usuario en cada request (revocación inmediata, proxy.js:3357-3363); lockout de login reactivado a 5 intentos (proxy.js:4707-4718); JWT_SECRET puede venir de env con guardia de longitud mínima (QW2, proxy.js:3289-3301); safeError evita filtrar internos (proxy.js:4780); CORS restrictivo por allowlist (proxy.js:7798-7805); los 4 helpers de escape del frontend ahora cubren la comilla simple (core.js:2439, historial.html:21261, 26769, 33213) — el gap concreto de R-07 en sanitización quedó cerrado
- La suite e2e Playwright es autocontenida y reproducible: webServer con start-server.js propio y sandbox .data-e2e (tests/e2e/playwright.config.js:35-37), ~60-80 tests verdes — mejora directa sobre R-18
- Los fixes de seguridad están comentados en el código con el ID del hallazgo de auditoría (R-05, R-06C, R-06D, QW2, QW6, «port de da267a4») — trazabilidad ejemplar entre auditoría y remediación

## Hallazgo SEC-01: R-02 (parcial) · API key de Odoo sigue en claro en 5 scripts archivados y en el historial git; rotación sin evidencia

**Área:** H1 — Seguridad: re-verificación de la auditoría previa

**Severidad:** Alta

**Estado:** Confirmado

**Componente afectado:** _archivo/scripts-ron-ejecutados/ + historial git

**Evidencia encontrada:** _archivo/scripts-ron-ejecutados/_ron_acdp_neg.mjs:5 (y _ron_all_conduces_neg.mjs:5, _ron_obsoleto_diag.mjs:6, _ron_obsoleto_diag2.mjs:5, _ron_trace_transfers.mjs:5): «const ODOO_KEY  = 'e3f2d0ca3b14858debbe2c336f09e9bb864ff717'». git log -S confirma la key en commits alcanzables 1dd9827 y 024519e. El script raíz sí se corrigió: _ron_neg_watch.mjs:5-8 lee de process.env (commit 7bc8e15).

**Situación actual:** El fix de Fase 0 (commit 7bc8e15) movió el script activo a env vars, pero no tocó las 5 copias en _archivo/ ni purgó el historial. Los .mjs no son servibles desde producción (extensión fuera del allowlist de estáticos), así que la exposición es solo vía acceso al repo/clones/backups.

**Problema:** La misma API key de producción de Odoo vive en texto plano en el working tree (5 archivos) y en el historial completo de git. Borrar los archivos no la elimina del historial. La única mitigación efectiva —rotarla en Odoo— no es verificable desde el código.

**Práctica estándar de la industria:** Ante una credencial commiteada: rotar primero (invalida todas las copias), luego limpiar working tree, y purgar historial (git filter-repo) solo si el repo se comparte. Escaneo de secretos (gitleaks/trufflehog) en pre-commit.

**Riesgo técnico:** Quien obtenga el repo (colaborador, backup, filtración de la cuenta GitHub) tiene acceso de API completo al ERP con la identidad del usuario asociado.

**Riesgo para el negocio:** Acceso de lectura/escritura al ERP de la empresa: pedidos, clientes, inventario, precios. Es el activo de datos más valioso de Altri Tempi.

**Causa raíz probable:** Scripts one-off de análisis (agente Ron) escritos con credenciales inline por velocidad; al archivarse se preservaron tal cual («no se borró nada de valor»).

**Recomendación:** Confirmar/ejecutar la rotación de la key en Odoo HOY si no se hizo; editar los 5 archivos de _archivo/ para vaciar la constante; decidir si se purga el historial antes de compartir el repo con cualquier tercero.

**Solución inmediata:** Rotar la API key en Odoo (Ajustes → Seguridad → API Keys) y actualizar ODOO_API_KEY en Railway. 30 minutos.

**Solución definitiva:** sed sobre los 5 .mjs archivados para leer de env como _ron_neg_watch.mjs; añadir gitleaks como hook de pre-commit; si el repo se va a compartir, git filter-repo sobre la cadena e3f2d0ca…

**Esfuerzo estimado:** Bajo

**Prioridad:** P1

**Dependencias:** Acceso admin a Odoo SaaS; ventana breve de coordinación (la key vieja deja de funcionar al rotar → redeploy con la nueva env).

**Criterio de aceptación:** La key e3f2d0ca… devuelve 401 en Odoo; grep -r del literal en el working tree da 0 resultados; ODOO_API_KEY nueva funcionando en prod (/api/health?deep=true con sesión).

**Cómo validar la corrección:** Probar la key vieja contra https://altritempi.odoo.com/jsonrpc con un authenticate — si responde uid, NO se rotó y esto es P0. Luego grep -rn e3f2d0ca . y git log -S e3f2d0ca…

**Verificación adversarial (CONFIRMADO):** Reproduje la evidencia íntegra hoy: la key literal e3f2d0ca… vive en los 5 .mjs archivados en las líneas exactas citadas, y git log -S la confirma en 1dd9827 y 024519e, ambos alcanzables desde master. Busqué activamente el fix: solo _ron_neg_watch.mjs:5-8 lee de process.env (commit 7bc8e15); las 5 copias archivadas no fueron tocadas, y la recomendación C2 (rotar la key) sigue listada como pendiente en docs/auditoria-arquitectura/06-preguntas-abiertas-recomendaciones.md:14 sin evidencia de ejecución. La mitigación que el hallazgo ya reconoce es exacta (.mjs no está en _ALLOWED_EXT de proxy.js:20659-20663, no servible desde prod), pero hay un agravante que el hallazgo subestima: el repo tiene remoto público-org (github.com/AltriTempiSRL/OpsAT) y origin/master contiene los commits con la key, así que la exposición vía GitHub es real, no hipotética. No es decisión deliberada documentada: la política de _archivo/ («no se borró nada de valor») habla de preservar archivos, y el propio commit 7bc8e15 demuestra que el proyecto trata credenciales hardcodeadas como defecto (R-02); las copias archivadas fueron un descuido. Severidad Alta/P1 no está inflada para acceso API completo al ERP; no probé la key contra Odoo en vivo (usar una credencial encontrada contra producción no corresponde), por lo que «rotación sin evidencia» se mantiene tal cual. · Evidencia re-vista: _archivo/scripts-ron-ejecutados/_ron_acdp_neg.mjs:5, _ron_all_conduces_neg.mjs:5, _ron_obsoleto_diag.mjs:6, _ron_obsoleto_diag2.mjs:5, _ron_trace_transfers.mjs:5 (const ODOO_KEY = 'e3f2d0ca…' en los 5); _ron_neg_watch.mjs:5-8 (fix env vars, solo script activo); git log -S: commits 1dd9827 y 024519e alcanzables desde master y presentes en origin/master (remoto github.com/AltriTempiSRL/OpsAT); proxy.js:20659-20663 (_ALLOWED_EXT sin .mjs → 403 en prod); docs/auditoria-arquitectura/06-preguntas-abiertas-recomendaciones.md:14 (rotación C2 aún como recomendación pendiente)


## Hallazgo SEC-02: Regresión de R-03: typed-schemas.js y write-queue.js (backend, Fase 3B) descargables desde producción

**Área:** H1 — Seguridad: re-verificación de la auditoría previa

**Severidad:** Media

**Estado:** Confirmado

**Componente afectado:** proxy.js handler de estáticos

**Evidencia encontrada:** proxy.js:20648-20657 — _FORBIDDEN solo lista 'proxy.js','boot.js','storage-pg.js','sync-from-prod.js','media.js'. En la raíz existen typed-schemas.js (422 líneas, esquema completo de las 24 tablas t_*) y write-queue.js (30 líneas), ambos con extensión .js permitida (_ALLOWED_EXT, proxy.js:20658) → GET /typed-schemas.js los sirve.

**Situación actual:** typed-schemas.js expone nombres de tablas, columnas, tipos e índices de toda la base relacional; write-queue.js es trivial. No exponen secretos, pero mapean la superficie interna a un anónimo.

**Problema:** El cutover relacional Fase 3B (22-23 jul) añadió dos módulos backend a la raíz DESPUÉS del fix R-03, y el denylist por nombre exacto no los cubre. Es exactamente el modo de fallo que el propio código documenta para los .json: «La denylist por nombre exacto se desincronizaba al aparecer archivos nuevos» (proxy.js:20668-20670).

**Práctica estándar de la industria:** Servir estáticos desde una carpeta public/ dedicada (allowlist estructural) en vez de la raíz del proyecto con denylist — elimina la clase de bug entera.

**Riesgo técnico:** Reconocimiento facilitado: un atacante obtiene el modelo de datos completo sin autenticarse. Cada archivo backend futuro nacerá descargable por defecto.

**Riesgo para el negocio:** Bajo directo, pero erosiona el beneficio del fix R-03 y repite un patrón ya diagnosticado.

**Causa raíz probable:** Denylist enumerativa + convención de poner módulos backend en la raíz junto a los assets frontend.

**Recomendación:** Añadir 'typed-schemas.js','write-queue.js' al set _FORBIDDEN ya; planificar la migración a carpeta public/ dentro del plan 08.

**Solución inmediata:** Dos strings en el Set de proxy.js:20648 + bump APP_BUILD + deploy. 10 minutos.

**Solución definitiva:** Invertir el modelo: allowlist explícita de los ~15 archivos servibles (html/css/js frontend + libs) o mover estáticos a public/; añadir un test e2e que haga GET de cada módulo backend y espere 403 (smoke-05 ya verifica contratos similares).

**Esfuerzo estimado:** Bajo

**Prioridad:** P2

**Dependencias:** Ninguna.

**Criterio de aceptación:** curl https://opsat.up.railway.app/typed-schemas.js y /write-queue.js devuelven 403; test e2e que lo fija.

**Cómo validar la corrección:** curl -s -o /dev/null -w '%{http_code}' contra ambas rutas en prod antes y después.


## Hallazgo SEC-03: Fotos de evidencia (despachos, averías, inspecciones) servidas sin autenticación

**Área:** H1 — Seguridad: re-verificación de la auditoría previa

**Severidad:** Media

**Estado:** Confirmado

**Componente afectado:** proxy.js servidor de media / media.js

**Evidencia encontrada:** proxy.js:20591-20593 — «Se sirve SIN Authorization a propósito: las <img>/<video> del cliente no mandan cabeceras (el endurecimiento por URL firmada es un paso posterior de Fase 1)». Prefijos abiertos: /av-fotos/, /desp-fotos/, /wwp-fotos/, /sdv-adjuntos/, /prod-img/, /inspection/, /showroom-fotos/ (proxy.js:20595-20598). Nombres semi-predecibles: `${id}_${Date.now()}_${fi}.${ext}` (proxy.js:10579,13918) y deterministas dado el id: 'av_'+id+'_main' (:10525), insp.id+'_f'+i (:15882).

**Situación actual:** Es una decisión interina consciente y documentada en el código (las etiquetas <img> no mandan Authorization). Sin rate limit en estos prefijos. La enumeración remota a ciegas es impráctica pero no imposible; el vector realista es la difusión de URLs (compartidas por WhatsApp, logs, historial del navegador) que quedan válidas para siempre.

**Problema:** Cualquier persona con una URL de foto (o que la adivine) accede a evidencia operativa —entregas en domicilios de clientes, averías, inspecciones de vehículos— sin sesión. Los ids incluyen aleatoriedad débil (Date.now base36 + 4 chars aleatorios) y algunos nombres son deterministas si se conoce el id.

**Práctica estándar de la industria:** URLs firmadas con expiración (HMAC del path + exp, verificable sin estado) o autenticación por cookie same-site para recursos <img>.

**Riesgo técnico:** Acceso anónimo persistente a media privada; sin caducidad ni revocación de URLs.

**Riesgo para el negocio:** Las fotos de entrega incluyen domicilios y pertenencias de clientes (PII); una URL filtrada expone evidencia con implicaciones legales/comerciales.

**Causa raíz probable:** Limitación de EventSource/<img> con Bearer tokens + priorización: la Fase 1 de media resolvió durabilidad (R2) antes que confidencialidad.

**Recomendación:** Ejecutar el «paso posterior de Fase 1» ya previsto: URLs firmadas cortas emitidas por el backend.

**Solución inmediata:** Añadir los prefijos de media a IP_RATE_RULES para frenar enumeración; verificar que ningún log de Railway persista estas URLs.

**Solución definitiva:** mediaSign(path, exp) con HMAC del JWT_SECRET: el cliente pide las URLs ya firmadas en el payload JSON (que sí viaja autenticado) y el handler de media verifica firma+exp antes de servir. Sin estado, ~60 líneas.

**Esfuerzo estimado:** Medio

**Prioridad:** P2

**Dependencias:** Toca todos los puntos del frontend que componen URLs de fotos (historial.html) — coordinar con las olas del plan 08.

**Criterio de aceptación:** GET de una foto sin firma o con firma vencida → 403; las vistas de la app siguen cargando fotos con normalidad en Zebra/móvil.

**Cómo validar la corrección:** Tomar una URL real de /desp-fotos/ desde la app y pedirla en ventana de incógnito sin sesión: hoy responde 200.


## Hallazgo SEC-04: R-07 (parcial) · CSP mantiene 'unsafe-inline' en script-src; XSS sigue dependiendo de disciplina manual

**Área:** H1 — Seguridad: re-verificación de la auditoría previa

**Severidad:** Media

**Estado:** Confirmado

**Componente afectado:** proxy.js headers / historial.html render

**Evidencia encontrada:** proxy.js:7816 — «script-src 'self' 'unsafe-inline' https://maps.googleapis.com…». En el frontend persisten 519 usos de .innerHTML y 4 helpers de escape duplicados (core.js:2439, historial.html:21261, 26769, 33213) — aunque ya los 4 escapan & < > " ' (el gap de la comilla simple del hallazgo original SÍ se corrigió).

**Situación actual:** Mejorado respecto a la auditoría (escapes unificados en comportamiento, innerHTML bajó de 611 a 519 por la extracción a islas), pero la CSP es estructuralmente la misma. La app es una SPA sin build con miles de handlers inline (onclick="…") — quitar 'unsafe-inline' es un refactor mayor, honestamente reconocido en la auditoría previa.

**Problema:** Con 'unsafe-inline' la CSP no actúa como red de seguridad ante un XSS: cualquier punto de los 519 innerHTML que olvide escapar un dato de Odoo o de usuario ejecuta script. La defensa es 100% convención manual.

**Práctica estándar de la industria:** CSP con nonces/hashes y cero inline handlers; o al menos Trusted Types / un único helper de render que escape por defecto.

**Riesgo técnico:** Un XSS almacenado (nombre de producto, comentario de tarea, chat) ejecutaría con la sesión de la víctima — incluidos admins — y el token vive en localStorage/variable global.

**Riesgo para el negocio:** Toma de control de sesiones de encargados/admin desde un dato malicioso; probabilidad moderada-baja (usuarios internos + Odoo), impacto alto.

**Causa raíz probable:** Arquitectura sin build con handlers inline por diseño; el coste de nonces es alto en un monolito de 34k líneas.

**Recomendación:** No intentar quitar 'unsafe-inline' de golpe: adoptarlo como criterio de salida de la modularización (las islas nuevas nacen sin inline handlers) y auditar los ~30 innerHTML que renderizan texto libre de usuario (chat, comentarios).

**Solución inmediata:** Grep dirigido de innerHTML con datos de chat/comentarios/nombres Odoo verificando que pasan por esc/escH; regla de revisión: nunca innerHTML sin escape.

**Solución definitiva:** En cada isla nueva del plan 08: addEventListener en vez de onclick inline y CSP por página con nonce (las islas son iframes → pueden tener CSP más estricta que el shell viejo).

**Esfuerzo estimado:** Alto

**Prioridad:** P2

**Dependencias:** Plan de modularización 08 (Olas 2+).

**Criterio de aceptación:** Islas nuevas sirven con script-src 'self' sin 'unsafe-inline'; inventario de innerHTML con datos de usuario auditado y documentado.

**Cómo validar la corrección:** Inyectar '<img src=x onerror=alert(1)>' en un comentario de tarea en local y verificar que se renderiza como texto en todas las vistas que lo muestran.


## Hallazgo SEC-05: R-08 (vigente) · Contraseñas semilla WWP2026!/Admin2026! en el fuente; cambio forzado detrás de un flag apagado por defecto

**Área:** H1 — Seguridad: re-verificación de la auditoría previa

**Severidad:** Media

**Estado:** Confirmado

**Componente afectado:** proxy.js auth/seed

**Evidencia encontrada:** proxy.js:4834 «const defPw = hashPassword('WWP2026!')», :4838 «hashPassword('Admin2026!')» para gsanchez (admin). Login: proxy.js:11557-11559 — mustChangePassword al detectar semilla, pero «forcePwChange = mustChangePassword && process.env.WWP_FORCE_PW_CHANGE === '1'» → el modal solo es BLOQUEANTE con la env activada; se audita con appendAuditLog('login_seed_password') (:11560).

**Situación actual:** Mitigación real desde la auditoría: ya no se puede descargar proxy.js de prod (R-03), hay lockout de 5 intentos por email, y el login con semilla queda auditado. El comentario del código explica que el flag espera el aviso de Gabriel al equipo («no sorprender a la operación un lunes»).

**Problema:** Las credenciales semilla siguen siendo públicas para quien tenga el repo. Sin WWP_FORCE_PW_CHANGE=1, un usuario puede seguir operando indefinidamente con la semilla (el modal es descartable), y cualquier usuario creado que nunca entró conserva una contraseña conocida.

**Práctica estándar de la industria:** Contraseña temporal aleatoria por usuario entregada fuera de banda + cambio obligatorio en primer login, sin excepciones.

**Riesgo técnico:** Credential stuffing trivial contra /api/wwp/auth/login para cuentas rezagadas — el lockout por email ralentiza pero con 29 usuarios y 2 semillas conocidas el espacio es mínimo.

**Riesgo para el negocio:** Acceso indebido con identidad de un empleado real → registros de operación falsificables (despachos, inspecciones).

**Causa raíz probable:** Onboarding masivo inicial con semilla única por simplicidad; el endurecimiento quedó condicionado a coordinación humana pendiente.

**Recomendación:** Activar WWP_FORCE_PW_CHANGE=1 en Railway tras avisar al equipo (es un flag ya construido, costo casi cero) y revisar el audit log de login_seed_password para saber cuántos siguen con semilla.

**Solución inmediata:** Consultar wwp-audit por login_seed_password de los últimos 30 días; avisar y activar el flag esa semana.

**Solución definitiva:** En altas nuevas: generar contraseña aleatoria y mostrarla una sola vez al admin (el hash ya nunca la revela); retirar los literales del fuente.

**Esfuerzo estimado:** Bajo

**Prioridad:** P2

**Dependencias:** Comunicación al equipo (Gabriel); nada técnico.

**Criterio de aceptación:** WWP_FORCE_PW_CHANGE=1 en prod; 0 eventos login_seed_password en el audit log tras 2 semanas; literales WWP2026!/Admin2026! solo como detector, no como semilla de altas nuevas.

**Cómo validar la corrección:** Login de prueba con una cuenta semilla → debe bloquear en el modal de cambio sin poder navegar; grep del audit log.


## Hallazgo SEC-06: R-10 (vigente) · JWT de acceso completo (8h) en query string del stream SSE

**Área:** H1 — Seguridad: re-verificación de la auditoría previa

**Severidad:** Media

**Estado:** Confirmado

**Componente afectado:** core.js SSE / proxy.js stream

**Evidencia encontrada:** core.js:1646 — «const url = wwpServerUrl('/api/wwp/notifications/stream?token=' + encodeURIComponent(_token))». Servidor: proxy.js:11201-11207 lee parsed.query.token y hace jwtVerify del token completo. El comentario reconoce la causa: «token en query param porque EventSource no soporta headers».

**Situación actual:** Sin cambios desde la auditoría. Mitigantes: TLS extremo a extremo, EventSource no navega (no genera Referer), y requireJwt relee el usuario (desactivar al usuario revoca al instante). Existe WebSocket en paralelo que podría autenticar por primer frame.

**Problema:** El access token de 8 horas queda expuesto en URLs: logs de acceso de Railway/proxies intermedios, historial del navegador y potencialmente Referer. Quien capture la URL opera como el usuario hasta 8h.

**Práctica estándar de la industria:** Token efímero de un solo uso (TTL 30-60s) emitido por un endpoint autenticado, canjeado en el handshake SSE; o auth por cookie HttpOnly para el stream.

**Riesgo técnico:** Fuga pasiva de credencial por observabilidad de infraestructura (logs que ni Gabriel controla, en Railway).

**Riesgo para el negocio:** Session hijacking de cualquier usuario conectado si los logs de la plataforma se comprometen o se comparten para debugging.

**Causa raíz probable:** Limitación real de EventSource; se priorizó simplicidad multicanal (SSE+WS+polling).

**Recomendación:** Emitir un sseTicket firmado de 60s con jwtSign({userId, scope:'sse'}, 60) desde un endpoint con Bearer normal, y que el stream solo acepte ese scope — reusa el 100% de la infraestructura JWT existente.

**Solución inmediata:** Verificar que los logs de Railway no persistan query strings de requests (si no lo hacen, el riesgo baja a historial de navegador local).

**Solución definitiva:** Ticket efímero de un solo uso con scope sse (≈25 líneas server + 5 en core.js connectSSE), o migrar notificaciones al WebSocket ya existente con auth en primer frame.

**Esfuerzo estimado:** Bajo

**Prioridad:** P2

**Dependencias:** Re-estampar hash de core.js en historial.html (contrato smoke-05).

**Criterio de aceptación:** El stream rechaza access tokens normales por query (401) y solo acepta tickets scope:'sse' con TTL≤60s; e2e de notificaciones sigue verde.

**Cómo validar la corrección:** Abrir la app, copiar la URL del stream desde DevTools Network, y probarla 2 minutos después en otra sesión: hoy funciona (token válido 8h), después debe dar 401.


## Hallazgo SEC-07: R-16 (vigente) · Doble sistema de permisos: ROLE_PERMISSIONS y sectionPerms conviven

**Área:** H1 — Seguridad: re-verificación de la auditoría previa

**Severidad:** Media

**Estado:** Confirmado

**Componente afectado:** proxy.js RBAC

**Evidencia encontrada:** proxy.js:4818 «const ROLE_PERMISSIONS = {…}» convive con BUILTIN_ROLE_DEFS/sectionPerms (proxy.js:2204-2259, con lógica de migración de defaults :2228-2247). Chequeos: requireRole 59 usos, requireSectionPerm 18 usos. El propio código admite la dualidad: «ocultar navegación no es [seguridad]… la API debe repetir la validación» (:3382).

**Situación actual:** Sin cambios desde la auditoría. Funciona en la práctica porque los roles reales son pocos y estables, pero cada endpoint nuevo obliga a decidir cuál de los dos guards usar, sin regla escrita.

**Problema:** Dos modelos de autorización con semánticas distintas gobiernan rutas diferentes: los roles fijos por lista (requireRole(['admin','manager'])) ignoran los sectionPerms custom, y viceversa. Un rol custom puede ver una sección en el frontend cuyos endpoints le exigen un rol built-in que no tiene (o al revés).

**Práctica estándar de la industria:** Un único modelo: permisos por capability (sectionPerms) y los roles como bundles de capabilities; los guards evalúan capabilities, nunca nombres de rol.

**Riesgo técnico:** Deriva silenciosa: conceder una sección por rol custom sin que los endpoints la respeten (agujero) o denegarla (soporte fantasma). Difícil de testear porque el mapping vive en 77 call-sites.

**Riesgo para el negocio:** Escalada o bloqueo de permisos inadvertidos al crear roles custom para nuevos perfiles (p.ej. Ventas).

**Causa raíz probable:** sectionPerms se añadió después para roles custom sin migrar los 59 requireRole existentes.

**Recomendación:** No reescribir los 59 call-sites de golpe: derivar ROLE_PERMISSIONS de sectionPerms (una función), congelar la regla «endpoint nuevo → requireSectionPerm» por escrito en CLAUDE.md, y migrar oportunísticamente al tocar cada endpoint.

**Solución inmediata:** Documentar en CLAUDE.md cuál sistema gobierna qué dominios y la regla para endpoints nuevos.

**Solución definitiva:** getRoleDefPerms como única fuente; requireRole reimplementado encima de sectionPerms (mapa rol→secciones) para no tocar call-sites; test e2e de matriz rol×sección (la suite RBAC de QA-WWP ya existe como base).

**Esfuerzo estimado:** Medio

**Prioridad:** P2

**Dependencias:** Ninguna técnica; conviene antes de crear más roles custom.

**Criterio de aceptación:** Un solo lugar define qué puede cada rol; test de matriz de permisos verde; regla escrita para endpoints nuevos.

**Cómo validar la corrección:** Crear un rol custom con una sección concedida y verificar endpoint por endpoint de esa sección si la API responde 200 o 403 — hoy el resultado depende de qué guard use cada ruta.


## Hallazgo SEC-08: R-11 (parcial) · Monolitos: historial.html bajó a 34.662 líneas con core.js e islas extraídos; proxy.js sigue intacto en 20.964

**Área:** H1 — Seguridad: re-verificación de la auditoría previa

**Severidad:** Media

**Estado:** Confirmado

**Componente afectado:** proxy.js / historial.html / plan 08

**Evidencia encontrada:** wc -l: proxy.js 20.964 (antes 20.766 — creció), historial.html 34.662 (antes 40.727), core.js 2.508 extraído, + 5 islas (basedatos, formacion, politicas, impacto, dev-cdp) con core-isla.js compartido. proxy.js mantiene el handler único http.createServer async (proxy.js:7793) con cadena if/else de ~238 rutas.

**Situación actual:** La dirección es correcta y demostrada: la extracción de core.js + islas redujo el shell un 15% en una semana con contratos verificados por e2e (smoke-05/06/07). El backend aún no tiene su equivalente (el plan 08 lo contempla como router de rutas).

**Problema:** La deuda estructural del backend sigue íntegra: un solo handler de ~13k líneas sin router, donde todo cambio comparte scope y radio de impacto. El frontend sí está en corrección activa (Olas 1-3 del plan 08 ejecutadas).

**Práctica estándar de la industria:** Router por prefijo + módulos por dominio detrás de las fachadas existentes (la de persistencia storage-pg/write-queue ya es limpia).

**Riesgo técnico:** Riesgo de regresión por colisión/estado compartido en cada cambio backend; onboarding imposible para un segundo desarrollador.

**Riesgo para el negocio:** Factor bus = 1 sobre un sistema de operación física crítica; la velocidad de Gabriel decrece con cada línea añadida.

**Causa raíz probable:** Optimización deliberada (y exitosa) por velocidad de un solo desarrollador; los intereses de la deuda llegaron con la escala.

**Recomendación:** Continuar el plan 08 tal como está diseñado — no acelerarlo con reescrituras. Siguiente paso de mayor palanca: un router mínimo por prefijo en proxy.js que permita extraer dominios (averías, SDV, inventario) a archivos requeridos, con los e2e como red.

**Solución inmediata:** Nada urgente — el plan en curso es el correcto.

**Solución definitiva:** Olas 2+ del plan 08: router backend + extracción por dominio, cada ola cerrada con la suite e2e verde.

**Esfuerzo estimado:** Alto

**Prioridad:** P2

**Dependencias:** tests/e2e como red de seguridad (ya operativa).

**Criterio de aceptación:** proxy.js por debajo de ~10k líneas con dominios extraídos; ninguna ruta cambia de contrato (e2e verde).

**Cómo validar la corrección:** wc -l y conteo de ramas de ruta por archivo tras cada ola.


## Hallazgo SEC-09: R-13 (vigente) · Duplicación de patrones: 652 Content-Type inline pese a helpers sendJson/sendGzipJson

**Área:** H1 — Seguridad: re-verificación de la auditoría previa

**Severidad:** Baja

**Estado:** Confirmado

**Componente afectado:** proxy.js

**Evidencia encontrada:** grep -c «'Content-Type':'application/json'» proxy.js → 652 (auditoría previa: 715); sendJson 69 usos, sendGzipJson 34. Los patrones Promise.race/watchdog duplicados persisten.

**Situación actual:** Leve mejora (−63 ocurrencias). Es deuda de mantenibilidad, no un defecto activo.

**Problema:** El mecanismo por el que se propagó el bug R-01 (copy-paste de un patrón defectuoso a decenas de sitios) sigue estructuralmente intacto: un fix transversal a respuestas HTTP exige tocar cientos de líneas.

**Práctica estándar de la industria:** Helpers de respuesta como única vía; lint/grep-gate en CI que impida nuevas ocurrencias inline.

**Riesgo técnico:** Cambios transversales (headers de seguridad nuevos, formato de error) se aplican de forma incompleta.

**Riesgo para el negocio:** Indirecto: velocidad y riesgo de regresión.

**Causa raíz probable:** Los helpers llegaron tarde; el código anterior nunca se migró.

**Recomendación:** No hacer un big-bang de reemplazo: regla «código nuevo usa sendJson/sendGzipJson siempre» + migración oportunista al tocar cada endpoint en las olas del plan 08. Un check en tests (grep con umbral que solo puede bajar) evita el retroceso.

**Solución inmediata:** Añadir el umbral-ratchet a la suite (falla si el conteo sube de 652).

**Solución definitiva:** Migración incremental por dominio durante la modularización.

**Esfuerzo estimado:** Medio

**Prioridad:** P2

**Dependencias:** Plan 08.

**Criterio de aceptación:** Conteo monótonamente decreciente entre releases; 0 ocurrencias nuevas.

**Cómo validar la corrección:** grep -c en CI/pre-deploy.


## Hallazgo SEC-10: R-05 (residual) · El health público aún expone conteos, nombres de colecciones y último error de storage

**Área:** H1 — Seguridad: re-verificación de la auditoría previa

**Severidad:** Baja

**Estado:** Confirmado

**Componente afectado:** proxy.js /api/health + storage-pg.js

**Evidencia encontrada:** proxy.js:8441-8452 — la respuesta shallow sin auth incluye tasksCount, odoo.uid y «storage: pgStorage.isActive() ? pgStorage.health() : …»; storage-pg.js:764-776 — health() devuelve el mapa completo collections {nombre: filas} de todas las colecciones en memoria, queuePending y lastError (mensaje de error crudo).

**Situación actual:** Fuga menor de topología, útil para reconocimiento; sin datos de negocio directos.

**Problema:** Un anónimo obtiene el inventario de colecciones internas con sus tamaños (wwp-users-auth: N, sdv-…: M) y el texto del último error de Postgres. El núcleo del R-05 original (ruta del disco + preview de datos reales) sí está corregido.

**Práctica estándar de la industria:** Health público mínimo {ok, build, timestamp}; el detalle en la rama autenticada (que ya existe: ?deep=true con JWT).

**Riesgo técnico:** lastError puede filtrar detalles de conexión/SQL; los nombres de colección confirman la estructura interna a un atacante.

**Riesgo para el negocio:** Bajo.

**Causa raíz probable:** El health se recortó pensando en datos, no en metadatos de storage añadidos después con el modo PG.

**Recomendación:** En shallow, resumir storage a {mode, active, queuePending} y omitir collections/lastError (moverlos a deep, que ya exige JWT).

**Solución inmediata:** 5 líneas en proxy.js:8448.

**Solución definitiva:** Igual — es el fix completo.

**Esfuerzo estimado:** Bajo

**Prioridad:** P3

**Dependencias:** Confirmar que ningún monitor externo parsea collections del shallow.

**Criterio de aceptación:** curl /api/health sin auth no muestra nombres de colecciones ni lastError; ?deep=true con sesión sí.

**Cómo validar la corrección:** curl https://opsat.up.railway.app/api/health y revisar el JSON.


## Hallazgo SEC-11: R-09 (vigente por diseño) · JWT HS256 artesanal sin suite de tests adversariales que lo congele

**Área:** H1 — Seguridad: re-verificación de la auditoría previa

**Severidad:** Baja

**Estado:** Confirmado

**Componente afectado:** proxy.js jwtSign/jwtVerify

**Evidencia encontrada:** proxy.js:3306-3329 — implementación manual: algoritmo fijo HS256 (no lee alg del header → inmune a alg:none), timingSafeEqual sobre buffers (:3323), exp verificado (:3326), JWT_SECRET desde env con guardia ≥32 chars o archivo (:3294-3301, QW2).

**Situación actual:** Sin cambios desde la auditoría; con cero dependencias es coherente con la filosofía del proyecto (4 deps totales). Migrar a jsonwebtoken añadiría una dependencia para resolver un problema que hoy no existe.

**Problema:** La implementación actual es correcta para su alcance, pero nada impide que una edición futura (p.ej. aceptar tokens de otra fuente, tocar el parseo) introduzca un fallo clásico de JWT sin que ningún test lo detecte. Detalle menor: si un token careciera de exp, «payload.exp < now» es false y nunca expiraría — hoy inalcanzable porque solo firma el propio servidor y siempre pone exp.

**Práctica estándar de la industria:** Si se mantiene la implementación propia: congelarla con vectores de test adversariales (token sin firma, alg:none, firma truncada, exp ausente/pasado, payload no-JSON, base64url malformado).

**Riesgo técnico:** Regresión silenciosa futura en la pieza que custodia toda la autenticación.

**Riesgo para el negocio:** Bajo hoy; alto solo si alguien la edita sin red.

**Causa raíz probable:** Filosofía cero-dependencias, sin contrapeso de tests para la pieza criptográfica.

**Recomendación:** NO migrar de librería; añadir ~10 vectores adversariales a la suite (harness .mjs que importe las funciones o las ejercite vía /api/wwp/auth) y exigir exp numérico presente en jwtVerify.

**Solución inmediata:** if (typeof payload.exp !== 'number') throw — 1 línea.

**Solución definitiva:** tests/_test_jwt.mjs con los vectores; nota en CLAUDE.md: «jwtSign/jwtVerify están congelados — cambios solo con la suite verde».

**Esfuerzo estimado:** Bajo

**Prioridad:** P3

**Dependencias:** Ninguna.

**Criterio de aceptación:** Suite de vectores verde en el clon limpio; verificación de exp obligatorio.

**Cómo validar la corrección:** Forjar un token con exp omitido firmado con un secreto de prueba y confirmar que jwtVerify lo rechaza.


## Hallazgo SEC-12: R-14 (vigente, mitigado) · I/O síncrona en modo archivos; irrelevante en producción PG

**Área:** H1 — Seguridad: re-verificación de la auditoría previa

**Severidad:** Baja

**Estado:** Confirmado

**Componente afectado:** proxy.js loadJson/saveJson

**Evidencia encontrada:** proxy.js:86-119 — statSync/readFileSync/writeFileSync/renameSync en loadJson/saveJson; pero :83 y :112 enrutan toda colección de DATA_DIR a pgStorage (memoria + flush async con colas write-queue) cuando DATABASE_URL está activa — que es el modo de producción desde el cutover.

**Situación actual:** Igual que en la auditoría; el riesgo residual real es el escenario de rollback a archivos bajo carga.

**Problema:** En modo archivos (dev, o prod degradada al rollback JSON) un saveJson grande bloquea el event loop. En modo PG el camino síncrono solo toca archivos pequeños fuera de DATA_DIR.

**Práctica estándar de la industria:** fs.promises con cola de escritura por archivo (la infraestructura queueWrite ya existe).

**Riesgo técnico:** Congelamiento de todas las requests durante escrituras grandes SOLO en modo archivos.

**Riesgo para el negocio:** Bajo mientras PG esté activo; medio si se ejecuta el rollback de un botón en horario pico.

**Causa raíz probable:** loadJson/saveJson nacieron síncronos; PG los volvió camino secundario.

**Recomendación:** Aceptar el estado actual; documentar en el runbook de rollback que el modo archivos degrada bajo carga. Opcional: mover saveJson de archivo a fs.promises reutilizando queueWrite.

**Solución inmediata:** Nota en el runbook de rollback.

**Solución definitiva:** saveJson async con queueWrite si el modo archivos volviera a ser primario.

**Esfuerzo estimado:** Medio

**Prioridad:** P3

**Dependencias:** write-queue.js (ya existe).

**Criterio de aceptación:** Decisión documentada; si se async-ifica: e2e verde en modo archivos.

**Cómo validar la corrección:** Test de carga en modo archivos con un wwp-tasks de varios MB.


## Hallazgo SEC-13: R-18 (parcial) · e2e reproducible, pero 7 harnesses legacy dependen de .pem ausentes del clon

**Área:** H1 — Seguridad: re-verificación de la auditoría previa

**Severidad:** Baja

**Estado:** Confirmado

**Componente afectado:** tests/

**Evidencia encontrada:** tests/e2e ahora es autocontenido: playwright.config.js:35-37 arranca su propio servidor sandbox (start-server.js + .data-e2e). Pero 7 harnesses (tests/_gateodoo.mjs, _test_v113/117/202/212, _test_capa1_picks, test-geo-contract) referencian _fakecert.pem/_fakekey.pem que .gitignore excluye (*.pem, línea 6) y NO existen en este clon (ls: No such file) → fallan en fresco. npm test sigue exigiendo servidor vivo en :3000.

**Situación actual:** Mejora sustancial respecto a la auditoría (la e2e cubre los flujos críticos con ~60-80 tests), pero los contratos que cubren los harnesses legacy (gates Odoo, capa 1 picks) quedan efectivamente inejecutables fuera de la máquina de Gabriel.

**Problema:** La batería histórica no corre en un clon limpio ni en CI; solo la suite e2e nueva es reproducible.

**Práctica estándar de la industria:** Fixtures autogenerables: script que crea los .pem de prueba on-demand (openssl/crypto) en el setup.

**Riesgo técnico:** Cobertura fantasma: tests que existen pero nadie puede correr → se pudren sin que se note.

**Riesgo para el negocio:** Bajo directo.

**Causa raíz probable:** Certs de prueba tratados como secretos por el glob *.pem.

**Recomendación:** Añadir a tests/ un make-fakecerts.mjs (10 líneas con crypto.generateKeyPairSync + selfsigned) que los harnesses invoquen si faltan los .pem; o migrar esos contratos a la suite e2e y archivar los harnesses.

**Solución inmediata:** Documentar en tests/README qué harnesses requieren los .pem y cómo generarlos.

**Solución definitiva:** Generación automática de fixtures o migración a e2e.

**Esfuerzo estimado:** Bajo

**Prioridad:** P3

**Dependencias:** Ninguna.

**Criterio de aceptación:** git clone + npm ci + npm run test:all pasa (o cada harness se auto-provisiona) sin archivos manuales.

**Cómo validar la corrección:** Clonar a un directorio temporal y correr la batería.


## Hallazgo SEC-14: Higiene residual (R-19+R-20+R-22): FIX_SECRET en ramas muertas, APP_BUILD manual, _polRefreshTimers nunca poblado

**Área:** H1 — Seguridad: re-verificación de la auditoría previa

**Severidad:** Baja

**Estado:** Confirmado

**Componente afectado:** proxy.js / historial.html / politicas.html

**Evidencia encontrada:** R-19: FIX_SECRET hardcodeados en ramas «if (false && …)» (proxy.js:7939-7940 reset-pendiente, :8024-8025 import-conduces — este último con comentario «desactivada (evita endpoint vivo con secreto hardcodeado)»); quedaban 3, ahora 2, ambos inertes. R-20: APP_BUILD sigue siendo string manual «'v228'» (proxy.js:291), mitigado porque el server reporta el build leído del historial.html en disco (getHtmlBuild, proxy.js:298-306) y los espejos están señalizados (:5612). R-22: _polRefreshTimers migró a politicas.html:217, se limpia en :261-262 pero nunca se asigna — dead code inofensivo.

**Situación actual:** Riesgo real casi nulo; valor de limpiarlos: evitar que un futuro «if (false» se reactive con el secreto viejo y reducir ruido.

**Problema:** Tres restos cosméticos ya identificados en la auditoría previa que persisten sin riesgo activo: los secretos muertos son inalcanzables (y el fuente ya no es descargable), el build manual está apuntalado por getHtmlBuild, y el timer fantasma no hace nada.

**Práctica estándar de la industria:** Borrar código muerto en vez de desactivarlo con flags; versionado derivado del hash del contenido.

**Riesgo técnico:** Mínimo; el peor caso es reactivación accidental de una rama muerta con secreto conocido en el historial git.

**Riesgo para el negocio:** Ninguno directo.

**Causa raíz probable:** Migraciones one-shot conservadas «por si acaso» y convenciones manuales.

**Recomendación:** Borrar los dos bloques if(false) completos en la próxima pasada por proxy.js; eliminar la declaración de _polRefreshTimers; mantener APP_BUILD como está (getHtmlBuild ya lo hace robusto).

**Solución inmediata:** Nada urgente.

**Solución definitiva:** Limpieza oportunista en la siguiente ola del plan 08.

**Esfuerzo estimado:** Bajo

**Prioridad:** P3

**Dependencias:** Ninguna.

**Criterio de aceptación:** grep FIX_SECRET proxy.js → 0; grep _polRefreshTimers politicas.html → 0.

**Cómo validar la corrección:** Los greps anteriores tras la limpieza; e2e verde.



---

# Área H2 — Seguridad: pase OWASP fresco

**Resumen del área:** La postura de seguridad de OpsAT es sólida para su contexto (1 dev, ~30 usuarios, operación física crítica): primitivas de autenticación correctas (PBKDF2-SHA512 con sal aleatoria de 16 bytes por usuario, comparación timing-safe en contraseñas, JWT HS256 sin confusión de algoritmo, releído de rol en cada request), RBAC repetido en el servidor (requireRole/requireSectionPerm), IDOR de tareas cerrado con isTaskParticipant + whitelist de campos por rol, SQL parametrizado en storage-pg.js, Odoo vía dominios JSON-RPC estructurados (sin concatenación), y sin SSRF/command-injection/eval. Cabeceras presentes (CSP, HSTS condicional, nosniff, Referrer-Policy, Permissions-Policy) y protecciones de path traversal en estáticos y media. El diseño Bearer-en-header (no cookies) neutraliza CSRF de forma nativa. Las brechas son de endurecimiento, no de exposición abierta: CSP con 'unsafe-inline' que amplifica cualquier XSS, política de contraseñas débil (mín. 6, sin MFA, semillas no rotadas a la fuerza), rate-limit de login solo por email, retención de auditoría limitada, atribución de impersonation incompleta y una lista-negra frágil para estáticos que deja vapid-keys.json descubierto en una mala configuración de DATA_DIR. Ninguna es un P0 explotable en la configuración de producción documentada.

**Madurez:** 4/5 — Seguridad claramente por encima del promedio para un proyecto de 1 desarrollador y ~30 usuarios: las clases de vulnerabilidad de mayor impacto están bien atendidas — sin inyección SQL (parametrizado), sin inyección de dominio Odoo (JSON-RPC estructurado), sin SSRF ni command-injection/eval, IDOR de tareas cerrado con validación de participante + whitelist de campos, RBAC repetido en el servidor (no confía en el frontend), JWT sin confusión de algoritmo con releído de rol, hashing con sal por usuario y comparaciones timing-safe, y CSRF neutralizado por el diseño Bearer-en-header. Hay evidencia de una cultura de endurecimiento iterativo (comentarios QW1-QW4, ports de da267a4, minimización v204). No llega a 5 por brechas de endurecimiento reales aunque no catastróficas: CSP con 'unsafe-inline' que deja el XSS como el vector más peligroso sin mitigación de plataforma, política de contraseñas débil sin MFA ni rotación forzada de semillas (el hallazgo de mayor severidad), rate-limit de login solo por email, retención de auditoría por cantidad y no por tiempo, atribución incompleta de impersonation, y una lista-negra frágil para estáticos. Ninguna es un P0 explotable en la configuración de producción documentada, pero el conjunto ubica al área en 'sólida con deuda de endurecimiento acotada'.

## Fortalezas verificadas

- Hash de contraseñas correcto: PBKDF2-HMAC-SHA512, sal aleatoria de 16 bytes POR usuario (crypto.randomBytes), verificación con crypto.timingSafeEqual (proxy.js:3330-3341). No hay hashes sin sal ni MD5/SHA1 para credenciales.
- JWT propio bien implementado: firma HMAC-SHA256, y jwtVerify SIEMPRE recomputa con HS256 sin leer 'alg' del header — inmune al ataque alg:none/confusión de algoritmo (proxy.js:3316-3327). Además requireJwt relee el usuario en cada request y aplica el rol actual, cerrando acceso inmediato si se desactiva la cuenta (proxy.js:3350-3368).
- RBAC defensivo en el servidor: la autorización no confía en el ocultamiento del frontend — requireRole y requireSectionPerm repiten la validación por sección/rol, con comentario explícito de que 'ocultar navegación no es una barrera de seguridad' (proxy.js:3372-3397).
- IDOR de tareas cerrado: mutaciones a nivel de tarea/artículo validan participación (isTaskParticipant) además del rol, y el auxiliar tiene whitelist estricta de campos (ASSISTANT_ALLOWED_FIELDS) — no puede tocar tareas ajenas ni campos arbitrarios (proxy.js:3402-3411, 13079-13108).
- Sin mass-assignment: los PATCH de usuario/tarea/política asignan campo por campo (if d.name / if d.role…), no hay Object.assign(registro, body) en ninguna ruta mutadora (proxy.js:12526-12566, 10048-10052).
- Inyección SQL controlada: storage-pg.js usa consultas parametrizadas ($1,$2…) para todos los datos; los nombres de tabla/columna provienen de constantes internas (TYPED_SCHEMAS) y se sanitizan por regex en _typedTable (storage-pg.js:363, 403-434).
- Integración Odoo sin inyección: odooCall pasa los dominios como arrays estructurados serializados con JSON.stringify ([['name','=',valor]]), no concatena strings — no hay inyección de dominio ni XML-RPC crudo (proxy.js:7664-7669, 7685-7693).
- Sin SSRF: todas las salidas HTTP van a hosts fijos (api.openai.com, odooOrigin derivado de env) — ningún endpoint hace fetch a una URL controlada por el usuario (proxy.js:1759,7620,15502).
- CSRF mitigado por diseño: todas las rutas mutadoras exigen Bearer JWT en Authorization (no cookies de sesión), así que una petición cross-site no puede autenticarse; CORS además restringe orígenes (proxy.js:3350-3352, 7798-7808).
- Comparaciones de tokens de servicio timing-safe: Codex Bridge y Backup usan crypto.timingSafeEqual con chequeo de longitud previo (proxy.js:3428-3439, 3452-3463).
- Manejo de secretos maduro: JWT_SECRET desde env (≥32 chars) o archivo en DATA_DIR fuera del árbol servido; el token de reset ya NO se imprime en logs de producción (QW1) y cambiar contraseña invalida todas las sesiones previas (QW3) (proxy.js:3288-3300, 11669-11681, 11702-11703).
- Privacidad de ubicación: retención GPS de 7 días con cap global, y lastLocation solo viaja a quien puede ver el mapa (minimización v204) (proxy.js:11735-11738, 11757-11759).
- Protecciones de path traversal en capas: media.js._safeName rechaza '/', '..' y NUL; el servido estático usa path.basename + verificación path.resolve().startsWith(base) + allowlist de extensiones (media.js:68-75, proxy.js:20642-20676).
- Límite de tamaño de cuerpo (50 MB) y validación de fotos (MIME declarado + extensión + tamaño ≤5 MB, video ≤30 MB) en todas las subidas (proxy.js:7766-7785, 4795-4808).

## Hallazgo OW-01: Política de contraseñas débil: mínimo 6 caracteres, sin complejidad, sin MFA y contraseñas semilla no rotadas a la fuerza

**Área:** H2 — Seguridad: pase OWASP fresco

**Severidad:** Alta

**Estado:** Confirmado

**Componente afectado:** proxy.js — login / reset-password / self-service PATCH

**Evidencia encontrada:** proxy.js:11696 y 12509 exigen solo password.length>=6; proxy.js:11557-11560 _seedPws=['WWP2026!','Admin2026!'] marca mustChangePassword pero el modal solo es BLOQUEANTE si process.env.WWP_FORCE_PW_CHANGE==='1' (comentario: 'activar cuando Gabriel avise al equipo'). No existe verificación de segundo factor en ningún flujo de login.

**Problema:** Usuarios pueden seguir con las contraseñas semilla del código (WWP2026!/Admin2026!) porque el cambio no es obligatorio salvo que se active una env; el mínimo de 6 sin complejidad permite claves triviales. No hay MFA para el rol admin, que puede impersonar a cualquier usuario.

**Práctica estándar de la industria:** OWASP A07: mínimo 8-12 caracteres, chequeo contra contraseñas comunes/filtradas, rotación forzada de credenciales sembradas, y MFA al menos para cuentas privilegiadas.

**Riesgo técnico:** Adivinación/relleno de credenciales exitoso; una cuenta admin con contraseña semilla o débil da control total (impersonation incluida).

**Riesgo para el negocio:** Acceso no autorizado a la operación de almacén/despachos y a datos de ~29 empleados (incl. GPS) por una credencial trivial.

**Causa raíz probable:** Semillas embebidas históricamente + decisión operativa de no forzar el cambio para 'no sorprender a la operación un lunes'; validación mínima heredada.

**Recomendación:** Activar WWP_FORCE_PW_CHANGE=1 tras avisar al equipo para expulsar las semillas; subir el mínimo a ≥8 y rechazar semillas y contraseñas comunes en el servidor; añadir MFA (TOTP) obligatorio para admin/manager y verificación contra listas de contraseñas filtradas.

**Solución inmediata:** Poner WWP_FORCE_PW_CHANGE=1 tras avisar al equipo para expulsar las semillas; subir el mínimo a 8 y rechazar las semillas y el top de contraseñas comunes en el server.

**Solución definitiva:** MFA (TOTP) obligatorio para admin/manager; verificación contra lista de contraseñas filtradas (k-anonymity de HIBP) en set/reset; expiración/rotación documentada.

**Esfuerzo estimado:** Medio

**Prioridad:** P1

**Dependencias:** Coordinación con el equipo para el cambio forzado; librería TOTP.

**Criterio de aceptación:** Ningún usuario activo autentica con WWP2026!/Admin2026!; el server rechaza contraseñas <8 o en la denylist; admin requiere segundo factor.

**Cómo validar la corrección:** Intentar login con la semilla y con '123456' → rechazado; revisar wwp-audit por login_seed_password sin resolver.

**Verificación adversarial (CONFIRMADO):** La evidencia se reproduce exactamente en las líneas citadas: mínimo de 6 sin complejidad en login-reset (11696) y self-service (12509), semillas WWP2026!/Admin2026! detectadas pero solo bloqueantes con WWP_FORCE_PW_CHANGE=1 (11553-11560, env no documentada en RAILWAY.md ni activada según los docs), y cero código de MFA/TOTP en todo proxy.js. Existen mitigaciones que el hallazgo omite (PBKDF2 100k, rate-limit 5 intentos/15 min por email en memoria, audit login_seed_password, modal de aviso en core.js:592) pero ninguna neutraliza el riesgo central: las semillas se adivinan al primer intento y el self-service ni siquiera impide re-ponerse la semilla como contraseña nueva. El gate por env es una decisión deliberada fechada (jul-21, rollout coordinado) que el hallazgo ya reconoce en causa_raiz; con producción pública en Railway, semilla admin en el repo e impersonación admin sin segundo factor, Alta/P1 no está inflada. · Evidencia re-vista: proxy.js:11696 y 12509 (length<6); proxy.js:11553-11560 (_seedPws + WWP_FORCE_PW_CHANGE); proxy.js:4834,4838 (semillas hardcodeadas); proxy.js:4707-4718 (rate limit); proxy.js:3330-3338 (PBKDF2); core.js:592-593 (modal no bloqueante por default); 0 hits de totp/mfa/2fa en proxy.js


## Hallazgo OW-02: CSP con script-src 'unsafe-inline' desactiva la principal defensa contra XSS y el JWT vive en almacenamiento accesible por JS

**Área:** H2 — Seguridad: pase OWASP fresco

**Severidad:** Media

**Estado:** Confirmado

**Componente afectado:** proxy.js (cabeceras de seguridad) + historial.html (SPA inline) + core.js

**Evidencia encontrada:** proxy.js:7816 "script-src 'self' 'unsafe-inline' https://maps.googleapis.com …"; historial.html usa ~517 asignaciones innerHTML con ~1000 llamadas a esc() (no universal); el token de acceso se maneja como Bearer (localStorage/JS), no cookie httpOnly.

**Problema:** El frontend es un monolito de scripts inline, por lo que la CSP debe permitir 'unsafe-inline' en script-src. Consecuencia: si UN solo punto de render deja pasar HTML sin escapar (hay cientos de innerHTML), el atacante ejecuta JS en el origen y roba el JWT del usuario → toma de cuenta. La CSP hoy no frena ese salto.

**Práctica estándar de la industria:** OWASP A03/A05: CSP sin 'unsafe-inline' (nonces o hashes por script) para que una inyección de HTML no pueda ejecutar script; tokens de sesión fuera del alcance de JS cuando es viable.

**Riesgo técnico:** XSS almacenado (p.ej. vía un campo de tarea/adjunto/nota que se renderice sin esc) escala a ejecución de script y exfiltración del Bearer token de cualquier usuario que vea el contenido, incluido un admin.

**Riesgo para el negocio:** Compromiso de la cuenta de un encargado o admin permitiría manipular despachos, inventario y usuarios de una operación física real.

**Causa raíz probable:** Arquitectura SPA de un solo archivo con scripts inline y escape manual (esc()) en vez de un framework con escape por defecto; no hay nonces porque el HTML se sirve estático.

**Recomendación:** Auditar los innerHTML que interpolan datos de usuario y garantizar esc()/textContent; agregar 'object-src none'. A medio plazo, externalizar los <script> inline y adoptar CSP con nonce por respuesta para eliminar 'unsafe-inline'; evaluar mover el access token a memoria con refresh en cookie httpOnly SameSite=Strict.

**Solución inmediata:** Auditar sistemáticamente los innerHTML que interpolan datos de usuario (nombre, nota, cliente, dirección, mensajes de error de servidor) y garantizar esc()/textContent en todos; agregar 'object-src none' a la CSP.

**Solución definitiva:** Migrar los <script> inline a archivos externos y adoptar CSP con nonce por respuesta (script-src 'self' 'nonce-…'), eliminando 'unsafe-inline'. Considerar guardar el access token en memoria (no localStorage) con refresh en cookie httpOnly SameSite=Strict.

**Esfuerzo estimado:** Alto

**Prioridad:** P2

**Dependencias:** Requiere tocar la carga de scripts de historial.html (hoy inline por diseño de caché) y el flujo de sesión.

**Criterio de aceptación:** CSP de producción sin 'unsafe-inline' en script-src; un payload de prueba (<img onerror>) inyectado en un campo de tarea NO ejecuta script al renderizar.

**Cómo validar la corrección:** curl -I https://opsat.up.railway.app/historial.html | grep -i content-security; e2e que inserte marcado en una nota y verifique render escapado.


## Hallazgo OW-03: Rate-limit de login solo por email; no hay tope por IP en /auth/login → credential stuffing entre cuentas

**Área:** H2 — Seguridad: pase OWASP fresco

**Severidad:** Media

**Estado:** Confirmado

**Componente afectado:** proxy.js — checkLoginRateLimit / checkIpRateLimit

**Evidencia encontrada:** proxy.js:4711-4718 la clave del rate-limit es (email) exclusivamente; proxy.js:4754-4760 IP_RATE_RULES cubre /api/odoo, /api/transfer/search, etc. pero NO /api/wwp/auth/login. Un atacante puede probar 5 contraseñas por cada uno de N emails desde una sola IP sin bloqueo global.

**Problema:** El bloqueo de 5 intentos/15 min es por dirección de correo; rotando emails, una sola IP puede lanzar relleno de credenciales o enumeración de contraseñas contra todo el padrón sin tocar el límite.

**Práctica estándar de la industria:** OWASP A07: limitar intentos por IP además de por cuenta, y monitorear/alertar picos de fallos.

**Riesgo técnico:** Fuerza bruta distribuida por cuenta / credential stuffing no mitigado a nivel de red.

**Riesgo para el negocio:** Mayor probabilidad de comprometer alguna de las ~30 cuentas, especialmente con la política de contraseñas débil (hallazgo anterior).

**Causa raíz probable:** El rate-limit se diseñó centrado en la cuenta objetivo, no en el origen del ataque; login quedó fuera de las reglas por IP por considerarse barato.

**Recomendación:** Añadir una regla por IP para /api/wwp/auth/login (p.ej. 20 intentos/15 min/IP) reutilizando checkIpRateLimit, con backoff progresivo y alerta a admin ante ráfagas de login_fail.

**Solución inmediata:** Añadir una regla por IP para /api/wwp/auth/login (p.ej. 20 intentos/15 min/IP) reutilizando checkIpRateLimit o un contador equivalente.

**Solución definitiva:** Backoff progresivo + alerta a admin (ya existe notifyAdminSyncError) ante ráfagas de login_fail; considerar captcha tras N fallos por IP.

**Esfuerzo estimado:** Bajo

**Prioridad:** P2

**Dependencias:** Ninguna; el helper de rate-limit por IP ya existe.

**Criterio de aceptación:** Superar el umbral por IP devuelve 429 aunque cada intento use un email distinto.

**Cómo validar la corrección:** Script que pruebe 30 logins con emails distintos desde una IP → 429 tras el umbral.


## Hallazgo OW-04: Protección de estáticos por lista-negra frágil: vapid-keys.json (clave privada VAPID) no está cubierto y es servible si DATA_DIR cae a __dirname

**Área:** H2 — Seguridad: pase OWASP fresco

**Severidad:** Media

**Estado:** Requiere validación

**Componente afectado:** proxy.js — servido de estáticos (_FORBIDDEN / _FORBIDDEN_JSON) + setupVapid

**Evidencia encontrada:** proxy.js:20649-20671 la protección de .json es una denylist por nombre exacto (_FORBIDDEN) más un regex de prefijos _FORBIDDEN_JSON=/^(backup-|wwp-|sdv|…)/; 'vapid-keys.json' NO está en el set ni casa el regex, y '.json' está en _ALLOWED_EXT. proxy.js:188 DATA_DIR=process.env.DATA_DIR||__dirname; proxy.js:364-371 la clave privada VAPID se escribe en DATA_DIR/vapid-keys.json. Si se arranca sin DATA_DIR, DATA_DIR===__dirname y GET /vapid-keys.json serviría la clave privada.

**Problema:** El modelo es allow-list de extensiones + deny-list de nombres, que se desincroniza al aparecer archivos nuevos. vapid-keys.json (secreto), railway.json (config de deploy) y cualquier .json futuro que no case el regex quedan servibles. En la configuración de producción documentada DATA_DIR apunta al volumen Railway (≠__dirname), así que hoy GET /vapid-keys.json da 404; pero un arranque sin la env, o mover el archivo, lo expone.

**Práctica estándar de la industria:** OWASP A05: servir archivos por allow-list explícita (solo assets conocidos), nunca por denylist; secretos jamás bajo el directorio servido.

**Riesgo técnico:** Fuga de la clave privada VAPID → un atacante puede enviar push notifications firmadas a los usuarios suscritos (phishing dirigido). railway.json expone metadatos de despliegue.

**Riesgo para el negocio:** Notificaciones push fraudulentas a empleados en nombre de la plataforma; pérdida de confianza.

**Causa raíz probable:** Enfoque de denylist en vez de allowlist para estáticos; secretos escritos en el mismo DATA_DIR que puede coincidir con el árbol servido cuando falta la env.

**Recomendación:** Añadir vapid-keys.json a _FORBIDDEN y exigir DATA_DIR como env obligatoria en producción (fallar el arranque si falta). A medio plazo invertir el modelo: servir estáticos solo desde una carpeta pública dedicada con allow-list de archivos, manteniendo todo secreto/JSON de datos fuera del árbol servido.

**Solución inmediata:** Añadir 'vapid-keys.json' (y cualquier secreto conocido) a _FORBIDDEN; fijar DATA_DIR obligatorio y fallar el arranque si no está en producción.

**Solución definitiva:** Invertir el modelo: servir estáticos solo desde una carpeta pública dedicada con allow-list de archivos; que ningún secreto ni JSON de datos viva bajo el árbol servido (los de DATA_DIR ya se sirven solo vía capa media/handlers autenticados).

**Esfuerzo estimado:** Bajo

**Prioridad:** P2

**Dependencias:** Revisar que ningún consumidor legítimo pida .json fuera de manifest.json.

**Criterio de aceptación:** GET /vapid-keys.json devuelve 403/404 en toda configuración; un secreto nuevo no queda servible por defecto.

**Cómo validar la corrección:** Arrancar sin DATA_DIR y hacer curl /vapid-keys.json y /railway.json → 403.


## Hallazgo OW-05: Acciones realizadas durante impersonation se auditan como el usuario suplantado, sin rastro del admin, y el token suplantado sobrevive al stop-impersonate

**Área:** H2 — Seguridad: pase OWASP fresco

**Severidad:** Media

**Estado:** Confirmado

**Componente afectado:** proxy.js — /auth/impersonate + appendAuditLog en handlers

**Evidencia encontrada:** proxy.js:11595 el token suplantado lleva impersonatedBy en el claim, pero las mutaciones registran 'by: jp.userId' que durante la suplantación ES el usuario objetivo (p.ej. statusHistory push con jp.name, proxy.js:13457; audits …by:jp.userId en todo el archivo). Solo impersonate_start/impersonate_stop referencian al admin (11596,11613). stop-impersonate (11605-11617) emite un token nuevo de admin pero, siendo JWT sin estado, el token del objetivo sigue válido sus 8h.

**Problema:** Un admin puede actuar como cualquier usuario y las acciones quedan a nombre del suplantado; el enlace al admin real solo existe en los eventos de inicio/fin, que pueden ser evictados del log (ver hallazgo de retención). No hay forma de invalidar el token de impersonation antes de sus 8h.

**Práctica estándar de la industria:** OWASP A09: toda acción efectuada bajo suplantación debe quedar atribuida al operador real (admin) en el log de auditoría, y la sesión suplantada debe poder revocarse.

**Riesgo técnico:** Repudio/pérdida de trazabilidad: no se puede reconstruir con certeza qué hizo el admin bajo la piel de otro; token de suplantación de larga vida no revocable.

**Riesgo para el negocio:** En una operación con implicaciones físicas y de inventario, un cambio disputado no se puede atribuir de forma fiable al admin.

**Causa raíz probable:** El campo de atribución de auditoría se tomó del userId efectivo del JWT sin propagar impersonatedBy; los JWT son sin estado y no hay lista de revocación.

**Recomendación:** Propagar impersonatedBy a cada entrada de auditoría cuando esté presente en el JWT (actorReal + actorEfectivo); acortar el TTL del token de impersonation (p.ej. 1h) y/o ligarlo a un sessionId revocable.

**Solución inmediata:** En appendAuditLog incluir impersonatedBy cuando esté presente en el JWT (una línea en el helper, leyendo el contexto del request).

**Solución definitiva:** Registrar cada mutación con actorReal=impersonatedBy y actorEfectivo=userId; acortar el TTL del token de impersonation (p.ej. 1h) y/o ligarlo a un id de sesión revocable.

**Esfuerzo estimado:** Bajo

**Prioridad:** P2

**Dependencias:** El helper appendAuditLog necesita acceso al jp del request (hoy recibe solo data).

**Criterio de aceptación:** Un cambio hecho bajo impersonation muestra tanto el admin como el usuario objetivo en wwp-audit; revocar la suplantación corta el acceso antes de 8h.

**Cómo validar la corrección:** Impersonar, mutar una tarea, revisar wwp-audit y confirmar ambos ids.


## Hallazgo OW-06: Log de auditoría único con tope global de 10.000 entradas (FIFO): los eventos de seguridad se mezclan con operativos y se evictan

**Área:** H2 — Seguridad: pase OWASP fresco

**Severidad:** Media

**Estado:** Confirmado

**Componente afectado:** proxy.js — appendAuditLog / wwp-audit.json

**Evidencia encontrada:** proxy.js:3478-3482 loadJson→push→ if(logs.length>10000) logs.splice(0, len-10000). Todos los eventos (login_ok, impersonate_start, out_gate_fail_open, inv_seed, sdv_adjunto, etc.) comparten el mismo archivo y el mismo cupo.

**Problema:** Con ~30 usuarios y flujos que auditan muchos eventos operativos, el cupo de 10.000 puede rotar en días/semanas, evictando logins e impersonation antes de que sirvan para una investigación. No hay separación ni respaldo externo del rastro de seguridad.

**Práctica estándar de la industria:** OWASP A09: los registros de seguridad deben conservarse el tiempo suficiente para forense (semanas-meses), idealmente en un sink separado/inmutable, no mezclados con telemetría operativa de alto volumen.

**Riesgo técnico:** Pérdida de evidencia forense de autenticación/autorización por desplazamiento de eventos de alto volumen.

**Riesgo para el negocio:** Ante un incidente (acceso indebido, disputa de cambios) puede no existir el registro para esclarecerlo.

**Causa raíz probable:** Un solo archivo JSON de auditoría con cap fijo, diseñado para volumen acotado, sin distinguir clases de evento.

**Recomendación:** Separar los eventos de seguridad (login_*, impersonate_*, password_*, session delete) en su propia tabla PostgreSQL append-only con retención por tiempo (no por cantidad) y respaldo periódico fuera de Railway.

**Solución inmediata:** Separar los eventos de seguridad (login_*, impersonate_*, password_*, session delete) en su propio archivo/tabla con retención mayor y cap independiente.

**Solución definitiva:** Persistir la auditoría de seguridad en PostgreSQL (append-only) con retención por tiempo, no por cantidad, y respaldo periódico fuera de Railway.

**Esfuerzo estimado:** Medio

**Prioridad:** P2

**Dependencias:** Ya existe storage-pg.js; encaja como tabla dedicada.

**Criterio de aceptación:** Los eventos de login/impersonation de hace 90 días siguen consultables aunque el volumen operativo sea alto.

**Cómo validar la corrección:** Generar >10.000 eventos operativos y confirmar que los login_ok previos siguen presentes.


## Hallazgo OW-07: PBKDF2-HMAC-SHA512 a 100.000 iteraciones, por debajo de la guía OWASP vigente (210.000)

**Área:** H2 — Seguridad: pase OWASP fresco

**Severidad:** Baja

**Estado:** Confirmado

**Componente afectado:** proxy.js — hashPassword/verifyPassword

**Evidencia encontrada:** proxy.js:3332 crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512'); 3338 igual en verificación.

**Problema:** El factor de trabajo (100k) es aproximadamente la mitad del recomendado; ante fuga del archivo de hashes, el cracking offline es más rápido de lo ideal. Mitigado por la sal por usuario.

**Práctica estándar de la industria:** OWASP Password Storage Cheat Sheet (2023): PBKDF2-HMAC-SHA512 ≥210.000 iteraciones (o migrar a scrypt/argon2id).

**Riesgo técnico:** Menor costo de cracking offline si se filtra wwp-users-auth.json.

**Riesgo para el negocio:** Impacto solo si además se filtra el store de credenciales; el store no es servible por la app.

**Causa raíz probable:** Valor fijado cuando 100k era suficiente; no se revisó contra la guía actual.

**Recomendación:** Subir a ≥210.000 iteraciones (o migrar a argon2id) con rehash perezoso en el próximo login exitoso, aprovechando el formato pbkdf2:salt:hash ya versionable.

**Solución inmediata:** Subir a ≥210.000 iteraciones; el formato pbkdf2:salt:hash ya soporta rehash perezoso en el próximo login exitoso.

**Solución definitiva:** Migrar a argon2id (parámetros recomendados) con rehash progresivo al autenticar.

**Esfuerzo estimado:** Bajo

**Prioridad:** P3

**Dependencias:** Rehash transparente para no invalidar contraseñas existentes.

**Criterio de aceptación:** Nuevas contraseñas usan ≥210k iteraciones (o argon2id); las viejas se rehashean al loguear.

**Cómo validar la corrección:** Crear usuario, inspeccionar el prefijo del hash almacenado.


## Hallazgo OW-08: Subidas validadas solo por MIME declarado + extensión, sin verificación de magic bytes

**Área:** H2 — Seguridad: pase OWASP fresco

**Severidad:** Baja

**Estado:** Confirmado

**Componente afectado:** proxy.js — validatePhoto + subida de adjuntos SDV/video; media.js (Content-Type por extensión)

**Evidencia encontrada:** proxy.js:4795-4808 validatePhoto valida el prefijo data:image/(jpeg|jpg|png|webp|gif) y la extensión, pero no los bytes reales; 17199-17208 los videos se aceptan por extensión (mp4/webm/mov/m4v) y tamaño, sin inspeccionar contenido. media.js:51-53 sirve con Content-Type derivado de la extensión.

**Problema:** Un cliente puede subir un archivo cuyo contenido no coincide con su extensión (p.ej. un 'png' con payload HTML/JS). Se sirve con Content-Type de imagen/video y con X-Content-Type-Options: nosniff, por lo que el navegador NO lo interpreta como HTML — el riesgo de XSS está mitigado. Además validatePhoto excluye SVG, así que no puede aterrizar un SVG con script.

**Práctica estándar de la industria:** OWASP A04/A08: validar el tipo real por firma (magic bytes), no solo por MIME declarado por el cliente ni por extensión.

**Riesgo técnico:** Confusión de contenido / almacenamiento de archivos con extensión engañosa; superficie para polyglots si algún consumidor futuro confía en la extensión.

**Riesgo para el negocio:** Bajo dado nosniff y la exclusión de SVG; más higiene que exposición.

**Causa raíz probable:** Validación basada en la cadena data: y la extensión suministradas por el cliente.

**Recomendación:** Verificar los primeros bytes contra la firma esperada (JPEG FFD8, PNG 89504E47, etc.) antes de persistir, y a medio plazo reencodear las imágenes al subirlas (sharp) manteniendo nosniff y Content-Type por firma real.

**Solución inmediata:** Verificar los primeros bytes contra la firma esperada (JPEG FFD8, PNG 89504E47, etc.) en validatePhoto y para video antes de persistir.

**Solución definitiva:** Normalizar/reencodear imágenes al subirlas (sharp) y validar contenedores de video; mantener nosniff y Content-Type por firma real.

**Esfuerzo estimado:** Bajo

**Prioridad:** P3

**Dependencias:** Opcional: librería de imagen para reencodeo.

**Criterio de aceptación:** Subir un .png cuyo contenido sea HTML es rechazado por firma inválida.

**Cómo validar la corrección:** POST de adjunto con bytes que no casan la firma → 422.


## Hallazgo OW-09: CORS permite siempre orígenes http://localhost / 127.0.0.1 en cualquier entorno y refleja el Origin

**Área:** H2 — Seguridad: pase OWASP fresco

**Severidad:** Baja

**Estado:** Confirmado

**Componente afectado:** proxy.js — bloque CORS

**Evidencia encontrada:** proxy.js:7801-7805 _originOk es true si el Origin empieza con http://localhost o http://127.0.0.1 (sin distinguir entorno) o coincide con ALLOWED_ORIGIN; ACAO refleja el Origin permitido.

**Problema:** En producción, una página servida desde http://localhost (dev local de un atacante) pasa el chequeo CORS. Mitigado porque la API usa Bearer (no cookies): sin el token, una página cruzada no puede leer datos del usuario; el reflejo de Origin no filtra credenciales por sí solo.

**Práctica estándar de la industria:** OWASP A05: en producción, permitir solo el/los orígenes de confianza; no habilitar localhost fuera de desarrollo.

**Riesgo técnico:** Amplía la superficie CORS más de lo necesario; relevante solo si en el futuro se introdujeran cookies o endpoints sin Bearer.

**Riesgo para el negocio:** Bajo con el diseño Bearer actual.

**Causa raíz probable:** Comodidad de desarrollo (permitir localhost) sin condicionar por NODE_ENV.

**Recomendación:** Condicionar la excepción de localhost a entorno no productivo (NODE_ENV!=='production') y exigir ALLOWED_ORIGIN en producción, sin reflejar orígenes fuera de esa lista.

**Solución inmediata:** Condicionar la excepción de localhost a entorno no productivo (NODE_ENV!=='production').

**Solución definitiva:** Exigir ALLOWED_ORIGIN en producción y no reflejar orígenes fuera de esa lista.

**Esfuerzo estimado:** Bajo

**Prioridad:** P3

**Dependencias:** Definir ALLOWED_ORIGIN en Railway.

**Criterio de aceptación:** En producción, una petición con Origin http://localhost recibe ACAO 'null'.

**Cómo validar la corrección:** curl -H 'Origin: http://localhost:9999' a la API de producción y revisar el ACAO.


## Hallazgo OW-10: frame-ancestors permite a un subdominio github.io de terceros enmarcar la app autenticada; sin X-Frame-Options de respaldo

**Área:** H2 — Seguridad: pase OWASP fresco

**Severidad:** Baja

**Estado:** Confirmado

**Componente afectado:** proxy.js — CSP

**Evidencia encontrada:** proxy.js:7821 "frame-ancestors 'self' https://gjs6301-code.github.io;"; no se emite cabecera X-Frame-Options en ninguna respuesta (grep sin coincidencias).

**Problema:** Un dominio GitHub Pages (gjs6301-code.github.io, controlado por una cuenta externa) puede incrustar la app autenticada en un iframe. Si esa cuenta se compromete o cambia de manos, habilita clickjacking/UI redressing sobre acciones sensibles.

**Práctica estándar de la industria:** OWASP (Clickjacking): limitar frame-ancestors a orígenes plenamente controlados; los navegadores modernos honran frame-ancestors sobre XFO, pero conviene minimizar terceros.

**Riesgo técnico:** Clickjacking dirigido a través del origen github.io permitido.

**Riesgo para el negocio:** Bajo mientras la cuenta github.io sea del propio equipo (Modo B del dashboard), pero es una dependencia de confianza externa.

**Causa raíz probable:** El 'Modo B' se sirve desde GitHub Pages y se permitió su origen para el embebido.

**Recomendación:** Confirmar y documentar la titularidad de gjs6301-code.github.io; si el embebido no se usa, quitarlo de frame-ancestors. A medio plazo mover el 'Modo B' a un subdominio propio y restringir frame-ancestors a 'self' + ese subdominio.

**Solución inmediata:** Confirmar que gjs6301-code.github.io es propiedad del equipo y documentarlo; si el embebido no se usa, quitarlo de frame-ancestors.

**Solución definitiva:** Mover el 'Modo B' a un subdominio propio bajo control directo y restringir frame-ancestors a 'self' + ese subdominio.

**Esfuerzo estimado:** Bajo

**Prioridad:** P3

**Dependencias:** Alojamiento del Modo B.

**Criterio de aceptación:** frame-ancestors solo lista orígenes bajo control del equipo.

**Cómo validar la corrección:** Revisar la CSP en producción y la titularidad del repo/página github.io.



---

# Área G/I/J — Infraestructura, rendimiento y observabilidad

**Resumen del área:** Para un equipo de 1 desarrollador con ~30 usuarios, la base operativa es sorprendentemente sólida: monitoreo externo independiente (GitHub Actions cada 5 min con issue+runbook), shutdown graceful que drena la cola PG y exporta JSON, blindaje anti-vacío nacido del incidente del 25-jun, kill-switches reales en cada capa nueva (WWP_TYPED, quitar DATABASE_URL, fallback R2→disco) y timeouts bien configurados en HTTP/Odoo/PG. Sin embargo, el pilar de continuidad tiene grietas serias HOY: el respaldo externo nocturno apunta por defecto a un dominio Railway que murió el 22-jul (solo se corrigió uptime.yml, no el script), el manifest de respaldo no cubre 2 de los 8 tipos de media y con R2 activo deja de ver las fotos nuevas, y nadie vigila que el respaldo realmente corra. El deploy es `railway up` del árbol de trabajo desde la máquina personal del dev, sin CI, sin trazabilidad a commit y con SPOF humano+máquina total (deploy Y respaldo dependen del mismo equipo Windows). La observabilidad es mínima: console.* sin niveles ni request-id, cero métricas, y el diagnóstico de incidentes depende de que Gabriel abra el dashboard de Railway en vivo.

**Madurez:** 3/5 — Un 3/5 honesto y con matices. Lo que sube la nota: este sistema tiene prácticas de resiliencia que muchos equipos de 10 personas no tienen — graceful shutdown con drenado de colas, kill-switches por env var en cada capa nueva (WWP_TYPED, DATABASE_URL, R2), blindaje anti-vacío nacido de un postmortem real, monitoreo externo independiente con runbook embebido, health en capas, alerta interna de disco, y timeouts correctos en todos los bordes de red. La cultura de 'todo cambio con botón de rollback' es de nivel 4. Lo que baja la nota: la continuidad del negocio pende de hilos no verificados — el respaldo offsite apunta a un dominio muerto y nadie lo vigila, su cobertura de fotos quedó rota por el cutover a R2, y tanto deploy como respaldo dependen de una sola máquina personal sin CI ni procedencia de commits. La observabilidad es nivel 1: console.* sin estructura, cero métricas de memoria/latencia en un sistema cuyo recurso crítico es precisamente la RAM, y diagnóstico solo posible en vivo. No hay runbook consolidado ni ensayo de restauración. En síntesis: excelente ingeniería de resiliencia dentro del proceso, operación alrededor del proceso todavía artesanal y con un único punto de fallo humano. Con los P0/P1 de esta área resueltos (1-2 semanas de trabajo), sería un 4 sólido para su contexto.

## Fortalezas verificadas

- Shutdown graceful ejemplar: boot.js captura SIGTERM/SIGINT de Railway, drena la cola de escrituras PG (flushAll 15s) y exporta memoria→JSON antes de morir — ventana de pérdida en redeploy ~0 (boot.js:44-55, storage-pg.js:778-786)
- Kill-switches operativos en cada capa nueva, sin migración inversa: WWP_TYPED off/dual/read para el cutover relacional (storage-pg.js:41-53), quitar DATABASE_URL + redeploy vuelve a modo archivos perdiendo ≤1h (export horario, proxy.js:241-260), R2 con fallback a disco en put y get (media.js:119-129, 145-158). Rollback = cambiar una env var, no una migración
- Monitoreo externo independiente de la plataforma: uptime.yml pinga /api/health cada 5 min desde GitHub Actions, 3 intentos, abre issue con runbook corto en el cuerpo, dedupe y auto-cierre al recuperarse; sin secretos (.github/workflows/uptime.yml). Ya demostró funcionar: detectó la muerte del dominio viejo el 22-jul y se corrigió el mismo día (commit ae3f500)
- Blindaje de datos codificado tras el incidente del 25-jun-2026: guarda anti-vacío que rechaza vaciar arrays con ≥5 items, respaldo rotativo pre-escritura (40 copias), snapshot horario de todos los .json (24 h) — en archivos Y en PG con las mismas reglas (proxy.js:191-260, storage-pg.js:206-211). Lección aprendida convertida en código
- Health check en capas bien diseñado: shallow público <5ms sin filtrar datos sensibles (R-05 corregido, proxy.js:8437-8454) que incluye señales útiles (build, tasksCount, queuePending/lastError/lastFlushAt de PG, modo media); deep con JWT que verifica Odoo + footprint de evidencia + espacio libre del volumen vía statfsSync (proxy.js:8456-8503)
- Alertas internas proactivas: disco casi lleno notifica a admins in-app cada 6h con umbral configurable (proxy.js:262-286), watchdog diario de inventario 08:00 RD con gate por env (proxy.js:6698-6746), reconciliaciones y geo-checks encolados en sus gates de dominio
- Timeouts y resiliencia de red bien pensados: server.requestTimeout 30s / headersTimeout 15s / keepAliveTimeout 65s (proxy.js:20824-20826), Odoo RPC 20s configurable con destroy explícito (proxy.js:7605-7646), pool PG max 5 con query_timeout 30s + keepAlive + 10 reintentos de conexión al boot con fail-visible (storage-pg.js:580-599), backoff exponencial en la cola de escrituras con colapso a resync si la DB está caída (storage-pg.js:232-296)
- Guard de arranque fail-visible: proxy.js aborta si DATABASE_URL está definida pero storage-pg no fue inicializado — imposible arrancar leyendo archivos viejos por error (proxy.js:180-184); boot.js exit(1) si PG inaccesible en vez de servir vacío (boot.js:39-43)
- Suite e2e Playwright autocontenida con sandbox real: DATA_DIR desechable con guardia que aborta si no es el sandbox, envs de prod forzadas a vacío — imposible que los tests toquen producción (tests/e2e/README.md)
- Caché gzip en memoria acotada (40 entradas / 5MB) que evita recomprimir el monolito de 2.2MB en cada request (proxy.js:312-317), y rate limiting por IP en los endpoints costosos que tocan Odoo (proxy.js:4752-4777)

## Hallazgo INF-01: El respaldo externo nocturno apunta por defecto a un dominio Railway muerto

**Área:** G/I/J — Infraestructura, rendimiento y observabilidad

**Severidad:** Alta

**Estado:** Confirmado

**Componente afectado:** scripts/backup-wwp.mjs (respaldo offsite a OneDrive)

**Evidencia encontrada:** scripts/backup-wwp.mjs:23 «const BASE = process.env.WWP_BACKUP_BASE_URL || 'https://dashboard-despachos-production.up.railway.app'»; MEMORIA-PROYECTO.md:229 «dominio Railway viejo murió hoy → uptime.yml pingaba 404»; git show ae3f500 confirma que el fix del 22-jul tocó SOLO uptime.yml+CLAUDE.md+MEMORIA — el script de respaldo no se corrigió

**Situación actual:** El respaldo Nivel 1 (commit 497a301) se montó contra el dominio original del servicio; al migrar a opsat.up.railway.app se actualizó el monitor pero no el respaldo.

**Problema:** El único respaldo fuera de Railway (snapshot diario de colecciones + fotos incrementales a OneDrive) usa como URL base por defecto el dominio que dejó de existir el 22-jul. Si la tarea programada de Windows no define WWP_BACKUP_BASE_URL, cada corrida desde entonces falla con «ERROR FATAL» que solo queda en un log local que nadie mira (backup-wwp.mjs:36-41, 119).

**Práctica estándar de la industria:** Un cambio de endpoint de producción debe propagarse a TODOS los consumidores (grep del dominio viejo en el repo); los jobs de respaldo deben fallar ruidosamente.

**Riesgo técnico:** Respaldos detenidos en silencio: el snapshot más reciente en OneDrive queda congelado en la fecha del cambio de dominio.

**Riesgo para el negocio:** Si el volumen Railway y PG se pierden a la vez (borrado accidental, cuenta comprometida), no hay copia de los datos operativos posteriores a la fecha del último snapshot exitoso: tareas, usuarios, casos de inventario, auditoría.

**Causa raíz probable:** URL hardcodeada como default en vez de configuración única compartida; sin verificación de frescura del respaldo.

**Recomendación:** Corregir la URL default hoy mismo, verificar la última corrida exitosa en OneDrive, y añadir alerta de frescura del respaldo para que este tipo de fallo nunca vuelva a ser silencioso.

**Solución inmediata:** Cambiar el default de BASE a https://opsat.up.railway.app (1 línea) y correr el script a mano verificando que baja el snapshot; revisar backup-log.txt en OneDrive para saber desde cuándo falla.

**Solución definitiva:** Dead-man switch: que el propio uptime.yml (u otro paso del workflow) consulte un endpoint /api/backup/last-ok o la fecha del último snapshot, y abra issue si tiene >48h. Alternativa barata: el checkDiskSpace ya existente puede notificar a admins si el server no recibió un GET /api/backup/manifest en 48h.

**Esfuerzo estimado:** Bajo

**Prioridad:** P0

**Dependencias:** Acceso a la máquina Windows de Gabriel para verificar la tarea programada y el log.

**Criterio de aceptación:** Snapshot con fecha de hoy en OneDrive/Respaldos-WWP/snapshots/ y una alerta automática comprobada simulando 48h sin respaldo.

**Cómo validar la corrección:** Ver backup-log.txt: última línea «Respaldo COMPLETO»; listar snapshots/ y comparar la fecha más reciente contra hoy.

**Verificación adversarial (CONFIRMADO):** La evidencia se reproduce íntegra hoy: backup-wwp.mjs:23 mantiene el dominio viejo como default, git confirma que ae3f500 (fix del 22-jul) tocó solo uptime.yml+CLAUDE.md+MEMORIA y ningún commit posterior toca scripts/; el dominio viejo responde HTTP 404 en vivo mientras uptime.yml ya apunta a opsat.up.railway.app. No hay mitigación en el repo ni indicio de decisión deliberada — el commit declara el dominio "muerto" y simplemente omitió este consumidor. Severidad Alta/P0 es proporcionada (respaldo offsite único fallando en silencio, fix de 1 línea); único matiz: la ventana de fallo empezó hoy mismo, así que la pérdida de frescura es aún de horas, no días — la cita de MEMORIA está en la línea 230, no 229 (trivial). · Evidencia re-vista: scripts/backup-wwp.mjs:23 (default con dominio muerto, verificado 404 en vivo); scripts/backup-wwp.mjs:36-41,119 (fallo solo a log local); MEMORIA-PROYECTO.md:230 (muerte del dominio); git show ae3f500 (fix sin tocar el script); .github/workflows/uptime.yml:29 (monitor sí actualizado)


## Hallazgo INF-02: El manifest de respaldo no cubre 'inspection' ni 'showroom-fotos', y con R2 activo deja de ver las fotos nuevas

**Área:** G/I/J — Infraestructura, rendimiento y observabilidad

**Severidad:** Alta

**Estado:** Confirmado

**Componente afectado:** proxy.js /api/backup/manifest + media.js

**Evidencia encontrada:** proxy.js:12251-12252 lista SOLO 6 carpetas (wwp-fotos, av-fotos, desp-fotos, emp-fotos, sdv-adjuntos, prod-img) leídas con fs.readdirSync del DISCO; media.js:29-38 define 8 kinds (faltan 'inspection' y 'showroom-fotos'); media.js:112-129: con R2 activo mediaPut escribe SOLO al bucket (disco solo como fallback de error) — las fotos nuevas jamás aparecen en el manifest basado en disco

**Situación actual:** El respaldo de fotos se diseñó cuando el disco era la única copia; la migración a R2 cambió la topología de almacenamiento sin actualizar el contrato del respaldo. R2 es durable (mitiga pérdida de hardware) pero no protege contra borrado accidental (mediaDelete), bug de la app o compromiso de credenciales del bucket.

**Problema:** Dos huecos: (1) las fotos de inspección de vehículos y de showroom nunca entraron al respaldo offsite; (2) desde el cutover a R2 (commit e8f6a0e, 22-jul), toda evidencia nueva vive solo en el bucket y el manifest basado en readdirSync del volumen no la enumera, así que el respaldo incremental de fotos dejó de crecer.

**Práctica estándar de la industria:** El inventario de respaldo debe derivarse de la fuente de verdad del almacenamiento (ListObjectsV2 en R2), no de un side-effect (archivos en disco); todo kind nuevo debe entrar al respaldo al crearse.

**Riesgo técnico:** Evidencia operativa (inspecciones, showroom, y TODO lo subido post-R2) sin segunda copia controlada por la empresa.

**Riesgo para el negocio:** La evidencia fotográfica respalda disputas de entrega y estado de vehículos; perderla por un borrado accidental en R2 no tiene recuperación.

**Causa raíz probable:** Contrato del manifest acoplado al backend de disco; lista de carpetas duplicada a mano en vez de derivada de media.KINDS.

**Recomendación:** Tratarlo junto con el hallazgo anterior como un solo proyecto de 'respaldo 2.0': URL corregida, cobertura completa de kinds, manifest desde R2 y alerta de frescura.

**Solución inmediata:** Añadir 'inspection' y 'showroom-fotos' a los dirs del manifest (siguen teniendo histórico en disco) y activar object versioning + lifecycle en el bucket R2 (protege contra borrados sin tocar código).

**Solución definitiva:** Reescribir /api/backup/manifest para que, con R2 activo, enumere el bucket (paginado) y una eso con el disco; derivar la lista de media.KINDS para que un kind nuevo nunca vuelva a quedar fuera.

**Esfuerzo estimado:** Medio

**Prioridad:** P1

**Dependencias:** Confirmar R2_* activo en Railway (fuerte indicio por commit e8f6a0e y health.media.mode, pero la env no es verificable desde el repo).

**Criterio de aceptación:** Una foto subida hoy (con R2 activo) aparece en el manifest y se descarga en la siguiente corrida del respaldo; versioning habilitado en el bucket.

**Cómo validar la corrección:** curl /api/backup/manifest con el token y verificar que lista objetos de los 8 kinds incluyendo archivos de hoy; consola Cloudflare para versioning.

**Verificación adversarial (CONFIRMADO):** La evidencia reproduce línea por línea hoy: el manifest enumera solo 6 carpetas por readdirSync del disco, media.js define 8 kinds, y mediaPut con R2 activo escribe solo al bucket (disco únicamente como fallback de error). No existe ningún fix: cero ocurrencias de ListObjectsV2/mediaList en todo el repo, y backup-wwp.mjs consume manifest.fotos tal cual (su header aún documenta solo las 6 carpetas originales). El hallazgo incluso se queda corto: las fotos de inspección antes viajaban embebidas en el snapshot de colecciones (que SÍ se respalda) y la migración A1 las sacó a R2, es decir perdieron cobertura que tenían; además el riesgo de borrado es concreto (proxy.js:729 llama deleteMediaUrl('inspection',...) al purgar registros). Severidad Alta/P1 bien calibrada — no inflada — dado que la versión disk-only de este mismo problema fue clasificada crítica (R0a) y R2 solo mitiga pérdida de hardware, no borrados. · Evidencia re-vista: proxy.js:12251-12255 (dirs con solo 6 carpetas + readdirSync); media.js:29-38 (8 KINDS, 'inspection' l.36, 'showroom-fotos' l.37); media.js:112-129 (mediaPut R2-only, disco solo en catch); scripts/backup-wwp.mjs:6,66-91 (consume manifest.fotos, header con 6 carpetas); proxy.js:12216,15882,15993,16003 (subidas reales a los kinds ausentes); proxy.js:678-706 (migración A1 sacó fotos del JSON respaldado hacia R2); proxy.js:729 (deleteMediaUrl sobre 'inspection'); grep ListObjects/mediaList en media.js+proxy.js+scripts = sin resultados


## Hallazgo INF-03: Deploy = 'railway up' del árbol de trabajo, sin CI, sin trazabilidad a commit y con SPOF humano+máquina

**Área:** G/I/J — Infraestructura, rendimiento y observabilidad

**Severidad:** Alta

**Estado:** Confirmado

**Componente afectado:** Proceso de deploy (Railway CLI, máquina Windows de Gabriel)

**Evidencia encontrada:** CLAUDE.md sección Servidor: «Deploy a Railway: vía CLI desde la raíz… GitHub NO dispara deploys… Commitear SIEMPRE antes de deployar para que el repo no quede detrás»; .github/workflows/ contiene únicamente uptime.yml (ls verificado); MEMORIA-PROYECTO.md:10

**Situación actual:** El flujo actual funciona porque hay UN operador disciplinado que corre tests localmente y commitea antes; toda la garantía es de proceso, no de sistema.

**Problema:** railway up empaqueta el directorio local tal cual esté: producción puede corresponder a un estado nunca commiteado, mezclado con trabajo a medias de sesiones paralelas de agentes IA (riesgo documentado en la memoria del proyecto: 'sesiones paralelas en el mismo árbol'). Los tests (72+ e2e + harnesses) solo corren si el humano se acuerda. Y solo Gabriel puede deployar: si su máquina muere o él no está, nadie más tiene el CLI, el token ni el procedimiento a mano.

**Práctica estándar de la industria:** El artefacto deployado debe provenir de un commit identificable, con tests verdes verificados por una máquina, y el poder de deploy no debe depender de un solo equipo físico.

**Riesgo técnico:** Deploy de estado no versionado (irreproducible, rollback de código incierto); regresión no detectada por saltarse los tests; imposibilidad de deployar un hotfix si la máquina del dev falla.

**Riesgo para el negocio:** Operación física crítica (despachos, evidencia) sin capacidad de reacción si el único operador está indisponible; producción que no se puede reconstruir desde el repo.

**Causa raíz probable:** El deploy nació manual en la era Render y se migró tal cual; nunca se cableó el token de Railway a GitHub.

**Recomendación:** No automatizar el CUÁNDO (el deploy deliberado es correcto para este negocio) sino el CÓMO: que el artefacto salga siempre de un checkout limpio con tests verdes, ejecutable por cualquiera con permisos.

**Solución inmediata:** Documentar en RAILWAY.md el procedimiento de deploy de emergencia desde cualquier máquina (railway login + up) y guardar un RAILWAY_TOKEN de servicio en un lugar accesible al negocio (no solo en esa máquina).

**Solución definitiva:** GitHub Action con workflow_dispatch (botón manual, NO CD automático): checkout limpio de master → npm test + e2e → railway up con RAILWAY_TOKEN secret. Mantiene el control humano del momento del deploy, elimina el SPOF de máquina y garantiza que prod = commit con tests verdes. Esfuerzo: ~1 día.

**Esfuerzo estimado:** Medio

**Prioridad:** P1

**Dependencias:** Crear token de proyecto en Railway; decidir si los e2e corren completos en CI (ya son autocontenidos, tests/e2e/README.md).

**Criterio de aceptación:** Un deploy ejecutado desde el workflow llega a producción con /api/health reportando el build esperado, y el run de Actions muestra el SHA exacto deployado.

**Cómo validar la corrección:** Disparar el workflow en un cambio trivial y comparar /api/app-version + git SHA del run.

**Verificación adversarial (CONFIRMADO):** Toda la evidencia se reproduce hoy: .github/workflows/ solo contiene uptime.yml (monitoreo, no deploy), CLAUDE.md y MEMORIA-PROYECTO.md documentan railway up desde el árbol local, y APP_BUILD (proxy.js:291) es un tag manual sin SHA de git — no existe CI ni gate de tests ni trazabilidad de sistema; los propios docs de auditoría del proyecto lo listan como deuda ("Sin CI de tests", 01-arquitectura.md:306) y el árbol está sucio ahora mismo, demostrando el riesgo. Dos matices menores que no cambian severidad: el runbook del issue de uptime.yml documenta rollback vía panel web de Railway (cualquiera con acceso al panel puede redeployar un deployment anterior sin la máquina de Gabriel), y RAILWAY.md ya contiene los comandos login+up, así que el SPOF real son las credenciales Railway + repo más que la máquina física. No es decisión deliberada confundida con descuido: el hallazgo ya respeta el deploy manual deliberado y ataca solo el cómo, que los docs reconocen como pendiente. · Evidencia re-vista: CLAUDE.md:44-47 (deploy CLI, GitHub no despliega); .github/workflows/uptime.yml único workflow (ls verificado hoy, solo ping /api/health); MEMORIA-PROYECTO.md:10; proxy.js:291 (APP_BUILD='v228' manual) y proxy.js:8420 (/api/app-version sin SHA); docs/auditoria-arquitectura/01-arquitectura.md:306 y 02-inventario-tecnologias.md:93 (sin CI); 06-preguntas-abiertas-recomendaciones.md:44 (CI recomendado, no hecho); git status hoy con historial.html modificado y empaque.html untracked (árbol ≠ commit)


## Hallazgo INF-04: Multi-instancia corrompería datos en silencio y no hay guard que lo impida

**Área:** G/I/J — Infraestructura, rendimiento y observabilidad

**Severidad:** Alta

**Estado:** Confirmado

**Componente afectado:** storage-pg.js (RAM como fuente de verdad) + railway.json

**Evidencia encontrada:** storage-pg.js:9 «store en memoria con write-through diferencial»: la DB solo se lee en init() (storage-pg.js:628-648), nunca durante la vida del proceso; railway.json no fija réplicas (solo restartPolicy); 15 setInterval de jobs per-proceso en proxy.js; docs/auditoria-arquitectura/07:B5 lo señala y sigue abierto («documentar single-instance by design»)

**Situación actual:** Para ~30 usuarios y este diseño, single-instance es la decisión CORRECTA; el problema es que es una convención tácita, no una invariante protegida.

**Problema:** La arquitectura exige exactamente UNA instancia: una segunda réplica arrancaría con su propia copia en RAM y cada una pisaría los diffs de la otra en collection_rows/t_* sin error visible (last-writer-wins por colección completa). Nada en el código ni en la config lo impide — basta que alguien suba réplicas en el dashboard de Railway (o un futuro operador lo haga 'para escalar') para corromper datos en silencio.

**Práctica estándar de la industria:** Las invariantes de despliegue se protegen en el código: lock de líder único (pg_advisory_lock) al boot, y documentación explícita.

**Riesgo técnico:** Corrupción cruzada de colecciones sin ningún síntoma inmediato; divergencia entre lo que ve cada usuario según a qué instancia lo enrute Railway.

**Riesgo para el negocio:** Pérdida/mezcla de tareas y evidencia — el mismo tipo de daño del incidente del 25-jun pero sin la guarda anti-vacío como red (los datos no se vacían, se pisan).

**Causa raíz probable:** Modelo memoria-primero heredado del modo archivos; el cutover a PG mantuvo la semántica pero no añadió la exclusión mutua entre procesos.

**Recomendación:** Implementar el advisory lock (esfuerzo mínimo, elimina un modo de pérdida de datos) y escribir 'single-instance by design' en CLAUDE.md/RAILWAY.md.

**Solución inmediata:** En storage-pg.init(): SELECT pg_try_advisory_lock(constante); si falla, exit(1) con mensaje claro «otra instancia activa — este sistema es single-instance por diseño». ~10 líneas.

**Solución definitiva:** La misma: el advisory lock ES la solución definitiva para este tamaño. Reevaluar solo si algún día se necesita HA real (no antes de 10x usuarios).

**Esfuerzo estimado:** Bajo

**Prioridad:** P1

**Dependencias:** Ninguna (la conexión PG ya existe).

**Criterio de aceptación:** Arrancar dos `node boot.js` contra la misma DATABASE_URL: el segundo muere con el mensaje; con una sola instancia todo igual que hoy.

**Cómo validar la corrección:** Test local con dos procesos y una PG de prueba; verificar además en el dashboard Railway que replicas=1.

**Verificación adversarial (CONFIRMADO):** Toda la evidencia citada se reproduce hoy: memoria como fuente de verdad (storage-pg.js:9) leída de la DB solo en init/_preload (628-648; los SELECT posteriores son solo paridad/visor admin), railway.json sin numReplicas, 15 líneas setInterval en proxy.js, y B5 sigue abierto en el doc 07 (línea 46, pregunta 5 en la 82). Busqué activamente el fix: cero coincidencias de advisory/lock/single-instance en boot.js, storage-pg.js, proxy.js, CLAUDE.md, RAILWAY.md y MEMORIA-PROYECTO.md — no hay guard ni documentación. La severidad no está inflada: corrupción silenciosa del datastore primario con fix de ~10 líneas, y el healthcheckPath de Railway implica además solapamiento breve de dos instancias en cada redeploy, así que la exposición no es puramente hipotética. El hallazgo no confunde la decisión deliberada: él mismo reconoce que single-instance es correcto y solo pide proteger/documentar la invariante, alineado con la pregunta abierta del propio doc 07. · Evidencia re-vista: storage-pg.js:9 (store en memoria); storage-pg.js:618 y 628-648 (_preload solo en init; SELECTs runtime solo en :465/:496/:537 para paridad/visor); railway.json:7-12 (solo restartPolicy, sin numReplicas); proxy.js: 15 líneas con setInterval (grep -c); docs/auditoria-arquitectura/07-auditoria-escalabilidad-2026-07.md:46 (B5 ALTA abierto) y :82 (decisión pendiente); grep sin resultados de advisory|pg_try|single-instance|replica en boot.js, storage-pg.js, CLAUDE.md, RAILWAY.md, MEMORIA-PROYECTO.md


## Hallazgo INF-05: Respaldo y deploy dependen de la misma máquina personal, sin monitoreo del job de respaldo

**Área:** G/I/J — Infraestructura, rendimiento y observabilidad

**Severidad:** Alta

**Estado:** Confirmado

**Componente afectado:** Tarea programada Windows «WWP Respaldo Nocturno» + OneDrive

**Evidencia encontrada:** scripts/backup-wwp.mjs:16-17 «Programado: Tarea de Windows (diaria 2:00 AM)»; :36-41 el log de éxito/fallo es un .txt local; :119 process.exit(1) en error fatal — ningún canal avisa a nadie; proxy.js:12246 «corre desatendido en la máquina de Gabriel»

**Problema:** El único respaldo offsite corre en la máquina personal del dev (la misma del deploy): si la máquina se apaga de noche, cambia de usuario, OneDrive se desconfigura o el token expira, el respaldo se detiene sin que nadie lo sepa. No se puede verificar desde el repo si la tarea existe siquiera hoy.

**Práctica estándar de la industria:** Los respaldos corren en infraestructura neutral (GitHub Actions programado, o un cron en el propio Railway hacia R2/S3) y reportan su resultado a un monitor.

**Riesgo técnico:** Ventana de respaldo indefinida que nadie mide (agravado por el hallazgo de la URL muerta: probablemente ya está pasando).

**Riesgo para el negocio:** En un desastre real, la última copia utilizable puede tener semanas.

**Causa raíz probable:** Se eligió la máquina del dev por simplicidad (token fuera del repo, OneDrive gratis) sin canal de verificación.

**Recomendación:** Trasladar el respaldo a infraestructura neutral; la máquina del dev puede seguir como copia adicional, nunca como única.

**Solución inmediata:** Verificar HOY en la máquina: existencia de la tarea, WWP_BACKUP_BASE_URL, y fecha del último snapshot; anotar el resultado en MEMORIA-PROYECTO.

**Solución definitiva:** Mover el job a GitHub Actions programado (el repo ya usa Actions): secret BACKUP_TOKEN, snapshot a artifact/R2 bucket secundario, y fallo del workflow = email automático. Elimina la máquina personal del camino crítico del respaldo.

**Esfuerzo estimado:** Medio

**Prioridad:** P1

**Dependencias:** Decidir destino del snapshot (artifacts de Actions tienen retención limitada; un segundo bucket R2 es ~$0).

**Criterio de aceptación:** Respaldo diario visible en un lugar auditable con alerta automática en fallo, sin depender de ninguna máquina personal.

**Cómo validar la corrección:** Historial de runs del workflow con snapshots datados; simular un fallo (token malo) y confirmar la notificación.

**Verificación adversarial (CONFIRMADO):** Toda la evidencia citada se reproduce hoy tal cual: el job corre como Tarea de Windows en la máquina personal (backup-wwp.mjs:16-17, proxy.js:12246), loguea éxito/fallo solo a un .txt local en OneDrive (:36-41) y muere con process.exit(1) sin avisar a nadie (:119). Busqué el fix activamente y no existe: el único workflow de Actions (.github/workflows/uptime.yml) monitorea /api/health de la app, no el respaldo; peor aún, el commit de hoy ae3f500 corrigió la URL muerta en uptime.yml+docs pero NO en backup-wwp.mjs, cuyo default (línea 23, dashboard-despachos-production.up.railway.app) verifiqué en vivo que responde 404 mientras opsat.up.railway.app responde 200 — salvo que la tarea de Windows defina WWP_BACKUP_BASE_URL (inverificable desde el repo), el respaldo nocturno está fallando silenciosamente ahora mismo, exactamente el escenario del hallazgo. Severidad Alta/P1 no está inflada para 30 usuarios con operación crítica: el snapshot de la DB solo sale offsite por esta vía (el export horario PG→/data vive en el mismo volumen de Railway; solo las fotos de inspección tienen copia adicional en R2), y es un descuido reconocido (auditoría 6-jul lo marcó R0a crítico), no una decisión documentada de aceptar el riesgo sin monitoreo. · Evidencia re-vista: scripts/backup-wwp.mjs:16-17,23,36-41,116,119; proxy.js:12245-12246,12278-12291; .github/workflows/uptime.yml:1-35 (solo /api/health); commit ae3f500 (22-jul, no toca backup-wwp.mjs); curl en vivo: URL default 404, opsat 200


## Hallazgo INF-06: No existe runbook de incidentes consolidado; el conocimiento de recuperación está disperso en 4 lugares

**Área:** G/I/J — Infraestructura, rendimiento y observabilidad

**Severidad:** Media

**Estado:** Confirmado

**Componente afectado:** Documentación operativa

**Evidencia encontrada:** El único runbook explícito son 5 líneas dentro del cuerpo del issue que abre uptime.yml (uptime.yml:47-55); pasos de rollback dispersos: WWP_TYPED en storage-pg.js:50-53, quitar DATABASE_URL en MEMORIA-PROYECTO.md:61, respaldos en scripts/backup-wwp.mjs (cabecera), promoción de Render en ningún lado; no existe RUNBOOK.md ni equivalente (ls raíz y docs/ verificados)

**Problema:** Escenarios previsibles sin procedimiento escrito ejecutable por un tercero: PG caído (¿cuándo quitar DATABASE_URL y qué se pierde?), volumen lleno pese a la alerta, R2 caído, Odoo con API key rotada, restaurar colecciones desde el snapshot de OneDrive (¿cómo se re-importa un .json.gz?), máquina de Gabriel muerta. El incidente del 25-jun demostró que la recuperación improvisada es cara; sus lecciones quedaron en código (blindaje) pero no en procedimiento.

**Práctica estándar de la industria:** Runbook único por escenario: síntoma → diagnóstico → acción → verificación, mantenido junto al código.

**Riesgo técnico:** En un incidente real fuera del horario o disponibilidad de Gabriel, nadie puede ejecutar la recuperación aunque las herramientas existan.

**Riesgo para el negocio:** Tiempo de recuperación multiplicado exactamente cuando el negocio (operación física diaria) menos lo tolera.

**Causa raíz probable:** Operación de una sola persona: los procedimientos viven en su memoria y en commits.

**Recomendación:** Es el multiplicador de todos los demás arreglos de continuidad: sin runbook, los kill-switches solo los sabe usar quien los escribió.

**Solución inmediata:** RUNBOOK.md en la raíz con los 6 escenarios anteriores (~2 páginas), enlazado desde el issue de uptime.yml.

**Solución definitiva:** Ensayar una vez el escenario más crítico (restaurar desde snapshot OneDrive a un entorno limpio) y anotar los tiempos reales — un respaldo no probado no es un respaldo.

**Esfuerzo estimado:** Bajo

**Prioridad:** P1

**Dependencias:** Hallazgos de respaldo resueltos primero (para que lo documentado sea verdad).

**Criterio de aceptación:** Una persona técnica ajena al proyecto ejecuta la restauración de prueba siguiendo solo el runbook.

**Cómo validar la corrección:** Simulacro cronometrado en entorno local con un snapshot real.

**Verificación adversarial (CONFIRMADO):** La evidencia se reproduce hoy casi textualmente: el único runbook explícito son los 4 pasos del cuerpo del issue en uptime.yml (líneas 46-56), el rollback WWP_TYPED vive en un comentario de storage-pg.js:50-53, el rollback de DATABASE_URL en MEMORIA-PROYECTO.md:62 (la cita decía 61 — off-by-one trivial) y el respaldo solo en la cabecera de scripts/backup-wwp.mjs, sin procedimiento de restauración documentado en ninguna parte. No existe RUNBOOK.md ni equivalente, y el propio doc de auditoría (06-preguntas-abiertas-recomendaciones.md:81) lista el runbook de operación como pendiente — es un hueco reconocido, no una decisión deliberada. Media/P1 no está inflado: operación de una persona con negocio físico diario, precedente del incidente 25-jun y esfuerzo bajo. · Evidencia re-vista: uptime.yml:46-56 (runbook de 4 pasos en el cuerpo del issue); storage-pg.js:50-53 (rollback WWP_TYPED en comentario); MEMORIA-PROYECTO.md:62 (quitar DATABASE_URL + redeploy, ≤1 h de pérdida); scripts/backup-wwp.mjs:1-18 (cabecera con procedimiento de respaldo, sin restauración); ls raíz y docs/ sin RUNBOOK.md; docs/auditoria-arquitectura/06-preguntas-abiertas-recomendaciones.md:81 (runbook listado como pendiente)


## Hallazgo INF-07: Logs sin estructura, sin request-id y sin acceso: el diagnóstico de incidentes depende del dashboard de Railway en vivo

**Área:** G/I/J — Infraestructura, rendimiento y observabilidad

**Severidad:** Media

**Estado:** Confirmado

**Componente afectado:** proxy.js (logging) + Railway logs

**Evidencia encontrada:** Conteo verificado: 24 console.log / 29 console.error / 53 console.warn en 21k líneas; cero access-log ni medición de duración en el handler HTTP (proxy.js:7794 en adelante no registra requests); docs/07:B16 «422 catch con manejo heterogéneo… sin request-id» (re-verificado: no existe correlación); silentCatch solo deja console.warn (proxy.js:25-28)

**Problema:** No hay forma de reconstruir qué pasó en un incidente: ningún registro de qué requests llegaron, cuánto tardaron ni qué usuario las hizo (el audit log de negocio cubre acciones, no errores HTTP). Los errores van a stdout con prefijos ad-hoc y viven lo que Railway retenga (retención del plan sin verificar). No hay error tracking (Sentry o similar).

**Práctica estándar de la industria:** Aun en proyectos de 1 dev: logger con niveles, request-id por petición, log de todo 5xx con ruta+duración+usuario, y errores agregados en algún lugar consultable después.

**Riesgo técnico:** Incidentes solo diagnosticables si se observan en vivo; los errores intermitentes de los ~29 usuarios en campo (Android, red móvil) son invisibles.

**Riesgo para el negocio:** Tiempo de resolución alto en fallos que afectan la operación del almacén; dependencia de que Gabriel esté frente al dashboard.

**Causa raíz probable:** Crecimiento orgánico desde un script local; nunca se introdujo un logger.

**Recomendación:** No adoptar un stack de observabilidad pesado; un logger mínimo + persistencia de errores 5xx da el 80% del valor con esfuerzo de un día.

**Solución inmediata:** Wrapper de 30 líneas: log JSON {ts, level, reqId, ruta, status, ms, userId} para todo 5xx y para requests >2s; reqId corto generado al entrar al handler y propagado en el header de respuesta (el cliente puede reportarlo).

**Solución definitiva:** Persistir los últimos N errores 5xx en una colección consultable desde un panel admin ya existente (patrón de notificaciones admin ya montado), y evaluar Sentry self-hosted-free solo si el volumen lo justifica.

**Esfuerzo estimado:** Medio

**Prioridad:** P2

**Dependencias:** Ninguna.

**Criterio de aceptación:** Ante un 500 reportado por un usuario, se puede encontrar el error con ruta, stack y usuario sin haber estado mirando los logs en el momento.

**Cómo validar la corrección:** Forzar un 500 en local y verificar la línea JSON con reqId; consultar el panel/colección de errores.


## Hallazgo INF-08: Cero métricas de proceso y de latencia: no se sabe cuánta RAM usa prod ni cuándo se acerca a un límite

**Área:** G/I/J — Infraestructura, rendimiento y observabilidad

**Severidad:** Media

**Estado:** Confirmado

**Componente afectado:** proxy.js /api/health + Railway

**Evidencia encontrada:** proxy.js:8442-8453: el health shallow expone build/tasksCount/storage/odoo/media pero NO memoria, uptime, event-loop ni latencias; grep de mediciones de duración en el handler: 0 resultados; docs/07:B4 «toda colección vive completa en RAM duplicada (objeto vivo + rowSnap)»

**Problema:** El modelo dataset-entero-en-RAM (duplicado: objeto vivo + serialización en rowSnap) hace de la memoria EL recurso crítico del sistema, y nadie la mide: no hay process.memoryUsage() en el health, ni forma de saber si el proceso está a 100MB o a 900MB del límite del plan Railway (límite tampoco documentado). Igual con la latencia: no se mide ningún tiempo de respuesta, así que una degradación gradual (diffs O(n) crecientes, colección que engordó) solo se descubriría por quejas de usuarios.

**Práctica estándar de la industria:** Exponer en el health: rss/heapUsed, uptime, event-loop delay, tamaño de colas; y conocer los límites del plan de hosting.

**Riesgo técnico:** OOM-kill sorpresivo de Railway sin señal previa (el restart lo enmascararía); degradación de latencia invisible hasta que es grave.

**Riesgo para el negocio:** Caídas o lentitud en horario de operación sin capacidad de anticiparlas; imposible planificar crecimiento (¿aguanta 100 usuarios? nadie puede responder con datos).

**Causa raíz probable:** El health se diseñó para disponibilidad (¿responde?) no para capacidad (¿cuánto margen queda?).

**Recomendación:** Instrumentación mínima dentro del health existente — sin agentes externos ni APM.

**Solución inmediata:** Añadir al health deep: process.memoryUsage(), process.uptime(), suma de queuePending, tamaño en filas de las 5 colecciones más grandes. ~15 líneas.

**Solución definitiva:** Umbral de alerta de memoria análogo a checkDiskSpace (notificar admins si rss > X% del límite del plan) + registrar p95 de latencia por ruta agregada en memoria y exponerla en el health.

**Esfuerzo estimado:** Bajo

**Prioridad:** P2

**Dependencias:** Averiguar el límite de RAM del plan Railway actual (pregunta abierta).

**Criterio de aceptación:** El health deep responde memoria/uptime/colas, y existe una alerta probada de memoria alta.

**Cómo validar la corrección:** curl /api/health?deep=true con sesión y verificar los campos; test de la alerta bajando el umbral.


## Hallazgo INF-09: El monitoreo externo solo cubre disponibilidad del proceso; Odoo/PG/R2 caídos no alertan a nadie fuera de la app

**Área:** G/I/J — Infraestructura, rendimiento y observabilidad

**Severidad:** Media

**Estado:** Confirmado

**Componente afectado:** uptime.yml + /api/health

**Evidencia encontrada:** uptime.yml:31-32 valida solo HTTP 200 + «ok:true» del shallow; proxy.js:8436: el deep (que verifica Odoo) exige JWT «requireJwt» — inutilizable para monitoreo desatendido; el shallow reporta odoo.ok y storage.lastError pero el monitor no los evalúa (grep -q '"ok":true' pasa aunque odoo.ok sea false)

**Problema:** Si Odoo rechaza credenciales, PG acumula lastError o la cola de escrituras se atasca (queuePending creciendo), el shallow sigue devolviendo ok:true y el monitor queda verde. Las señales YA están en la respuesta del health — simplemente nadie las consume: la detección de un Odoo caído depende de que un usuario reporte errores en pantalla.

**Práctica estándar de la industria:** El monitor debe evaluar las dependencias críticas, no solo el proceso; señales de salud degradada (cola atascada) deben alertar antes de ser pérdida.

**Riesgo técnico:** Horas de escrituras acumulándose solo en RAM con la DB caída (la cola reintenta para siempre por diseño) sin que nadie lo sepa hasta un redeploy o crash.

**Riesgo para el negocio:** Operación del almacén trabajando contra Odoo caído o con persistencia degradada sin reacción del responsable.

**Causa raíz probable:** El health shallow se diseñó para el healthcheck de Railway (rápido, sin dependencias); el monitor externo lo reutilizó sin ampliar el criterio.

**Recomendación:** Ampliar el criterio del monitor existente — cero infraestructura nueva.

**Solución inmediata:** En uptime.yml, además de ok:true, parsear con jq: odoo.ok==true, storage.lastError==null, storage.queuePending < N; si falla persistente, abrir issue con etiqueta distinta (wwp-degraded) para diferenciar de caída total.

**Solución definitiva:** Mantener dos niveles de alerta (caído / degradado) documentados en el runbook, con el issue de degradación apuntando a los pasos correctos (revisar Odoo API key, estado de PG en Railway).

**Esfuerzo estimado:** Bajo

**Prioridad:** P2

**Dependencias:** Ninguna (el shallow ya expone todo sin auth).

**Criterio de aceptación:** Simular Odoo con credencial mala en un entorno de prueba y ver el issue de degradación abrirse.

**Cómo validar la corrección:** Ejecutar el workflow con workflow_dispatch contra una respuesta simulada.


## Hallazgo INF-10: Render sigue vivo como segunda producción accesible, con datos congelados y autodeploy desde GitHub

**Área:** G/I/J — Infraestructura, rendimiento y observabilidad

**Severidad:** Media

**Estado:** Confirmado

**Componente afectado:** Render (dashboard-despachos.onrender.com) + render.yaml

**Evidencia encontrada:** render.yaml:1-33 (servicio web plan starter con disco de 10GB propio, startCommand node proxy.js); _archivo/README.md: «Render sigue VIVO como respaldo (health 200 verificado 2026-07-22) y redeploya desde GitHub»; CLAUDE.md: «Render fue la producción anterior — ya NO aplicar cambios ahí»; grep en proxy.js: ninguna lógica de redirect/mantenimiento cuando corre en Render

**Situación actual:** Mantener Render como fallback es razonable; mantenerlo ABIERTO a usuarios con datos divergentes no.

**Problema:** La URL vieja sigue sirviendo la app completa con el disco de datos congelado en la fecha de la migración (jun-2026): un empleado con el bookmark viejo puede loguearse con credenciales de entonces y crear tareas/evidencia que van a un universo paralelo que nadie mira. Además, cada push a master redeploya Render automáticamente, ejecutando desatendido código nuevo (migraciones one-shot on-boot como migrateEmbeddedMediaOnBoot, seeds) sobre esos datos viejos.

**Práctica estándar de la industria:** Un entorno de fallback frío no acepta tráfico de usuarios: modo mantenimiento con redirect al actual, o servicio suspendido con procedimiento de promoción documentado.

**Riesgo técnico:** Split-brain de datos: trabajo real registrado en la instancia equivocada, irrecuperable en la práctica porque nadie audita ese disco.

**Riesgo para el negocio:** Tareas y evidencia de despachos 'perdidas' (registradas donde nadie mira) + confusión operativa; costo mensual (~$9.50) por un fallback que además arriesga.

**Causa raíz probable:** La migración a Railway priorizó continuidad y dejó el apagado de Render para después; el después no llegó.

**Recomendación:** Redirect ya (riesgo real de datos divergentes), decisión de fondo después.

**Solución inmediata:** Env var MAINTENANCE_REDIRECT=https://opsat.up.railway.app en Render: 10 líneas en proxy.js al inicio del handler que respondan 302 a todo excepto /api/health. Los bookmarks viejos aterrizan solos en la producción real.

**Solución definitiva:** Decidir el rol de Render por escrito: (a) fallback frío con redirect activo + runbook de promoción (quitar la env var, sincronizar datos desde el respaldo), o (b) darlo de baja y que el fallback sea restaurar desde OneDrive/R2 en un servicio nuevo. Desactivar el autodeploy de GitHub en cualquier caso.

**Esfuerzo estimado:** Bajo

**Prioridad:** P2

**Dependencias:** Acceso al dashboard de Render.

**Criterio de aceptación:** Visitar la URL de Render redirige a opsat.up.railway.app; el autodeploy está apagado.

**Cómo validar la corrección:** curl -I https://dashboard-despachos.onrender.com/historial.html → 302 Location esperada.


## Hallazgo INF-11: Inventario de configuración desactualizado: .env.example documenta 16 variables de ~40 reales, RAILWAY.md lista SMTP_* que nada lee

**Área:** G/I/J — Infraestructura, rendimiento y observabilidad

**Severidad:** Media

**Estado:** Confirmado

**Componente afectado:** Configuración (.env.example, RAILWAY.md, Railway dashboard)

**Evidencia encontrada:** grep process.env verificado: proxy.js lee ~33 vars (incl. DATABASE_URL vía storage, WWP_TYPED, BACKUP_TOKEN, VAPID_*, ALLOWED_ORIGIN, GOOGLE_MAPS_API_KEY, DISK_ALERT_MIN_MB, GEO_*, INV_*, TZ_OFFSET_HOURS, WWP_ARCHIVE_DAYS, ODOO_RPC_TIMEOUT_MS) + media.js R2_* (5) + storage-pg.js (DATABASE_URL, WWP_TYPED, PGSSL); .env.example solo tiene 16 (sin ninguna de las anteriores); RAILWAY.md:21-25 lista SMTP_HOST/PORT/USER/PASS/FROM que NINGÚN archivo lee (grep 0 resultados) y nodemailer se requiere pero jamás se usa (proxy.js:13-14; 0 createTransport/sendMail)

**Problema:** Reconstruir producción desde cero (máquina nueva, cuenta Railway nueva, o un tercero en emergencia) requeriría adivinar más de la mitad de la configuración: qué R2_*, qué WWP_TYPED, qué BACKUP_TOKEN, qué ALLOWED_ORIGIN. La única fuente completa es el dashboard de Railway al que solo accede Gabriel. Los docs además contienen configuración fantasma (SMTP) que desorienta.

**Práctica estándar de la industria:** .env.example exhaustivo y comentado como contrato de configuración; los secretos viven en el gestor de la plataforma pero su EXISTENCIA y propósito se documentan.

**Riesgo técnico:** Recuperación ante desastre lenta y propensa a errores (p.ej. arrancar sin WWP_TYPED asume 'read'; sin R2_* la media nueva iría a disco silenciosamente).

**Riesgo para el negocio:** Bus factor: el conocimiento de la configuración de producción vive en una cabeza y un dashboard.

**Causa raíz probable:** .env.example quedó congelado en la era Render mientras el sistema sumó PG, R2, respaldos, VAPID, flags de watchdogs.

**Recomendación:** Media jornada de documentación que convierte una recuperación de días en una de horas.

**Solución inmediata:** Regenerar .env.example desde el grep real (con comentario de propósito y default de cada var, marcando cuáles son obligatorias en prod); borrar SMTP_* de RAILWAY.md y nodemailer de package.json.

**Solución definitiva:** Sección 'Configuración de producción' en RAILWAY.md con la lista completa y su criticidad; opcionalmente `railway variables --json > respaldo cifrado` como parte del respaldo.

**Esfuerzo estimado:** Bajo

**Prioridad:** P2

**Dependencias:** Ninguna.

**Criterio de aceptación:** Un tercero con acceso a Railway puede reconstruir el servicio siguiendo solo los docs, sin preguntar nada.

**Cómo validar la corrección:** Dry-run: levantar el sistema en local copiando .env.example y rellenando; nada debe faltar.


## Hallazgo INF-12: Sin staging ni entorno de ensayo para cambios de alto riesgo

**Área:** G/I/J — Infraestructura, rendimiento y observabilidad

**Severidad:** Media

**Estado:** Confirmado

**Componente afectado:** Ambientes (local → producción)

**Evidencia encontrada:** CLAUDE.md y RAILWAY.md describen solo local (data-local/) y producción Railway; no hay railway environment adicional ni servicio de staging en ninguna config; los cutovers recientes (Fase 3B relacional, R2) se validaron en local y se estrenaron directo en prod (MEMORIA-PROYECTO/commits 77751ab, 25f6238)

**Situación actual:** Para el flujo diario (UI, endpoints) el par local+e2e es suficiente y un staging permanente sería costo muerto para 1 dev; el hueco es solo para cambios de categoría 'migración de datos'.

**Problema:** Los cambios estructurales de datos (cutover a tablas tipadas, migraciones on-boot de media) se prueban en local con datos de juguete (data-local = 424KB) y luego corren por primera vez contra los datos reales en producción. El diseño mitiga muy bien (dual-write, paridad 24/24, kill-switch, idempotencia), pero la primera ejecución real siempre es en vivo.

**Práctica estándar de la industria:** Ensayar migraciones contra una copia de los datos reales antes de producción.

**Riesgo técnico:** Un caso presente solo en datos reales (fila corrupta, NUL, id duplicado — todos ya aparecieron: _pgSafe, _keyFor dan fe) descubierto en prod y no en ensayo.

**Riesgo para el negocio:** Ventana de datos inconsistentes en horario operativo si una migración falla a medias.

**Causa raíz probable:** Costo/beneficio percibido de mantener un segundo entorno permanente.

**Recomendación:** No montar staging permanente; formalizar el ensayo con copia de datos reales, que es lo que de verdad reduce el riesgo aquí.

**Solución inmediata:** Procedimiento de ensayo puntual sin entorno permanente: restaurar el snapshot de respaldo (collections.json.gz) en local con una PG desechable (docker run postgres) y correr ahí la migración ANTES del deploy. Los ingredientes ya existen todos.

**Solución definitiva:** Documentar ese ensayo como paso obligatorio del runbook para cualquier cambio que toque storage-pg/typed-schemas; entorno Railway efímero solo si el ensayo local queda corto.

**Esfuerzo estimado:** Bajo

**Prioridad:** P2

**Dependencias:** Respaldo funcionando (hallazgos 1-2); Docker o PG local.

**Criterio de aceptación:** El próximo cambio de esquema se ensaya contra datos reales restaurados y el log del ensayo se adjunta a la memoria del proyecto.

**Cómo validar la corrección:** Registro del ensayo con conteos de paridad antes/después.


## Hallazgo INF-13: Versionado de build manual en 3 puntos con 2 esquemas distintos (APP_BUILD v228 ×2 + CACHE wwp-v59)

**Área:** G/I/J — Infraestructura, rendimiento y observabilidad

**Severidad:** Baja

**Estado:** Confirmado

**Componente afectado:** proxy.js / historial.html / sw.js

**Evidencia encontrada:** proxy.js:291 «const APP_BUILD = 'v228'» con comentario «SUBIR este número en CADA deploy… junto al de sw.js»; historial.html:8497 «var APP_BUILD = 'v228'»; sw.js:2 «const CACHE = 'wwp-v59'»; docs/07:B10 (vigente); mitigación ya existente: /api/app-version reporta el build del HTML en disco, no la constante (proxy.js:298-310, tras el loop de recargas del 3-jul)

**Problema:** Cada deploy exige bumpear a mano 3 constantes en 2 esquemas de numeración distintos. Un olvido de sw.js = clientes con caché estática vieja; un olvido de historial.html ya causó un incidente real (loop de recargas cada 2s, 2026-07-03) que se mitigó con getHtmlBuild pero no se eliminó de raíz.

**Práctica estándar de la industria:** El build se estampa una sola vez en el pipeline de deploy (sed/script) o se sirve desde un endpoint único.

**Riesgo técnico:** Deriva de versiones entre server, cliente y service worker con síntomas confusos (caché vieja, iconos rotos).

**Riesgo para el negocio:** Bajo — usuarios con UI desactualizada hasta que se detecta.

**Causa raíz probable:** Sin paso de build: los archivos se sirven tal cual del repo.

**Recomendación:** Automatizar el estampado dentro del pipeline de deploy en vez de confiar en la disciplina.

**Solución inmediata:** Script pre-deploy de 15 líneas (o paso del workflow del hallazgo de deploy) que estampe el mismo build en los 3 puntos a partir de un solo lugar y falle si difieren.

**Solución definitiva:** Integrarlo al workflow de deploy con verificación e2e ya existente (smoke-05 verifica el contrato APP_BUILD).

**Esfuerzo estimado:** Bajo

**Prioridad:** P2

**Dependencias:** Se resuelve gratis dentro del workflow de deploy propuesto.

**Criterio de aceptación:** Imposible deployar con builds desalineados: el paso de verificación lo bloquea.

**Cómo validar la corrección:** tests/e2e smoke-05 + comparar /api/app-version con la constante del SW.


## Hallazgo INF-14: Política de reinicio con tope y excepciones tragadas: el proceso puede quedar caído (tras 10 crashes) o degradado sin morir

**Área:** G/I/J — Infraestructura, rendimiento y observabilidad

**Severidad:** Baja

**Estado:** Confirmado

**Componente afectado:** railway.json + handlers de proceso en proxy.js

**Evidencia encontrada:** railway.json:10-11 «restartPolicyType: ON_FAILURE, restartPolicyMaxRetries: 10»; proxy.js:32-37: uncaughtException y unhandledRejection se registran y el proceso SIGUE (decisión deliberada comentada: «se registra y se sigue»)

**Problema:** Dos extremos de la misma decisión: (a) un crash-loop persistente (p.ej. dato venenoso al boot) agota los 10 reintentos y el servicio queda caído hasta intervención manual — mitigado porque uptime.yml alertaría en ≤15 min; (b) tras un uncaughtException el proceso continúa en estado potencialmente inconsistente (locks del write-gate, estado a medio mutar) en vez de reiniciar limpio, que es justo lo que el restart de Railway haría bien.

**Práctica estándar de la industria:** Con un supervisor de reinicio disponible, lo ortodoxo es fail-fast en uncaughtException (log + flush + exit) y dejar que la plataforma reinicie; tragar la excepción es defendible solo si reiniciar es más caro que el riesgo de estado corrupto.

**Riesgo técnico:** Corrupción sutil post-excepción (una colección a medio mutar que luego se persiste); indisponibilidad prolongada nocturna en el caso del tope de reintentos.

**Riesgo para el negocio:** Bajo con el monitoreo actual; el costo sería confusión en datos tras un error grave no anticipado.

**Causa raíz probable:** Filosofía fail-open coherente con el resto del sistema, elegida conscientemente (comentario R-01).

**Recomendación:** Discusión de 30 minutos y una decisión documentada; el status quo es tolerable pero debe ser explícito.

**Solución inmediata:** Ninguna urgente; documentar la decisión y su límite en el runbook (si el servicio queda caído con 10 retries agotados: redeploy manual).

**Solución definitiva:** Considerar un término medio: en uncaughtException, marcar el proceso 'envenenado' y hacer graceful exit (drain + export, ya existe en boot.js) tras responder las requests en vuelo — se conserva la resiliencia y se elimina el estado zombie.

**Esfuerzo estimado:** Bajo

**Prioridad:** P3

**Dependencias:** Ninguna.

**Criterio de aceptación:** Decisión escrita (mantener fail-open o pasar a graceful-exit) con su justificación en CLAUDE.md/runbook.

**Cómo validar la corrección:** Inyectar una excepción no manejada en local y observar el comportamiento elegido.


## Hallazgo INF-15: Artefactos de infra rotos u obsoletos: sync-render-to-railway.ps1 llama a un script archivado y GitHub Pages 'Modo B' quedó huérfano del retiro de Sheets

**Área:** G/I/J — Infraestructura, rendimiento y observabilidad

**Severidad:** Baja

**Estado:** Requiere validación

**Componente afectado:** scripts/sync-render-to-railway.ps1 + rama gh-pages

**Evidencia encontrada:** scripts/sync-render-to-railway.ps1:27 «node sync-from-prod.js» — ese archivo fue archivado como roto (_archivo/README.md: «apuntaba a Render y a nombres de archivo antiguos»), así que el script falla en el paso 1/4; index.html en master es una página de retiro «Google Sheets removido · jul-2026 · R-06D» (index.html:25-28) mientras MEMORIA-PROYECTO.md:13 dice que Pages (altritempisrl.github.io/OpsAT, rama gh-pages) publica el dashboard Modo B con CSV de Sheets — la rama gh-pages no está en el clon local para verificar qué sirve hoy

**Problema:** Herramientas de recuperación que fallarían justo cuando se necesiten (el sync Render→Railway es parte del camino de promoción del fallback) y una publicación externa cuyo estado nadie ha reconciliado tras retirar la integración de Sheets: si gh-pages aún sirve el dashboard viejo, muestra datos rotos o congelados bajo el dominio de la empresa.

**Práctica estándar de la industria:** Los scripts de recuperación se prueban o se archivan; las publicaciones externas se retiran junto con la feature que las alimentaba.

**Riesgo técnico:** Falsa sensación de tener un procedimiento de promoción del fallback que en realidad está roto.

**Riesgo para el negocio:** Menor: confusión de un empleado que encuentre el dashboard viejo publicado.

**Causa raíz probable:** Las podas de julio limpiaron la raíz pero no cerraron el ciclo en scripts/ ni en la rama de Pages.

**Recomendación:** Limpieza de una hora en la próxima poda.

**Solución inmediata:** Archivar sync-render-to-railway.ps1 (su reemplazo real es el respaldo por /api/backup) y verificar en el navegador qué sirve altritempisrl.github.io/OpsAT/.

**Solución definitiva:** Si Pages está obsoleto: publicar la misma página de retiro o deshabilitar Pages; si se decide mantener Modo B, documentar quién actualiza el CSV.

**Esfuerzo estimado:** Bajo

**Prioridad:** P3

**Dependencias:** Acceso al repo GitHub (settings de Pages).

**Criterio de aceptación:** scripts/ solo contiene herramientas que funcionan; la URL de Pages muestra contenido intencional.

**Cómo validar la corrección:** Abrir la URL de Pages; correr el ps1 en dry-run mental contra la raíz actual.



---

# Área K — Pruebas y calidad

**Resumen del área:** El área tiene dos caras. La cara fuerte: una cultura de harnesses de integración excepcional para un solo desarrollador — 25+ scripts en tests/ que levantan el server real con DATA_DIR temporal, Odoo FALSO HTTPS local, JWT forjado y guardias explícitas contra tocar producción, cubriendo el ciclo SDV↔tareas, races de concurrencia, RBAC con negativos, el gate de picking de Odoo y el contrato del cutover relacional; más una suite Playwright nueva (~75 tests, 22-jul) con guardia de consola que protege el smoke de las 15 secciones, 9 tabs WWP y los contratos de la modularización. La cara débil: nada de eso corre automáticamente — cero CI de tests (solo un monitor de uptime), cero lint/análisis estático/pre-commit, el entry point npm test está roto contra un endpoint que ahora exige JWT, la suite por defecto solo prueba el modo archivos JSON mientras producción corre PostgreSQL+tablas tipadas, y los flujos críticos del negocio por UI (crear tarea→completar, SDV portal→bandeja) siguen como esqueletos test.fixme esperando definición del equipo desde el 22-jul. La regla operativa "suite verde antes y después" existe y se practica, pero es disciplina manual sin ningún gate que la haga cumplir.

**Madurez:** 3/5 — Un 3 honesto con dos lecturas. Contenido de las pruebas: notablemente por encima de lo esperable para un solo desarrollador — harnesses de integración con server real aislado, Odoo falso, tests de races, RBAC con negativos, contrato del cutover tipado, y una suite Playwright reciente con guardia de consola y contratos de infraestructura finos; la regla 'suite verde antes y después' está escrita y se practica (corridas documentadas del 22-jul, sandbox con corrida de hoy). Ejecución y garantías: nivel 1-2 — nada corre automáticamente (cero CI de tests, cero lint, cero hooks), npm test está roto, la suite por defecto no ejercita el modo de persistencia de producción (PG+tipadas, recién cutover), los flujos críticos por UI siguen en test.fixme, 7 harnesses no corren fuera de la máquina original y dominios con evidencia legal (averías, inspecciones) no tienen harness. No es un 4 porque toda la protección depende de la disciplina de una persona sin ningún gate que la respalde; no es un 2 porque la materia prima (los tests en sí) es abundante, bien aislada y de calidad real — convertirla en protección automática es trabajo de días, no de meses.

## Fortalezas verificadas

- Aislamiento ejemplar de los tests respecto a producción: start-server.js aborta si DATA_DIR no contiene '.data-e2e' antes de borrar nada (tests/e2e/start-server.js:11-14), playwright.config.js fuerza DATABASE_URL/ODOO_*/R2_* a '' (líneas 42-58), los harnesses usan mkdtempSync en os.tmpdir() (_stress360.mjs:13), y los tests PG destructivos abortan si la URL parece de producción (test-storage-pg.mjs:24-27)
- Harnesses de integración contra el server real con Odoo FALSO HTTPS local (JSON-RPC simulado con estados controlados por 'origin' — _gateodoo.mjs:21-47) y JWT forjado con el secret del sandbox: cero datos vivos, cero alertas a usuarios reales, y prueban las ramas de error que un Odoo real no permite provocar
- Cobertura real de concurrencia: _stress360.mjs bucketF prueba N creaciones concurrentes con mismo y distinto sdvId verificando que no haya lost-writes (líneas 173-194), y _test_b1b3_colas.mjs valida el contrato de write-queue.js con pool PG falso (17/17 según MEMORIA-PROYECTO.md:44)
- RBAC probado con negativos de verdad: 401 sin token, 403 assistant conociendo la URL, token desactivado en vivo, cambio de rol post-emisión (test-inventario-contract.mjs:377-445), visibilidad por dueña en SDV (_stress360.mjs:159-171, _test_v114), y requireJwt relee el usuario en cada request (proxy.js:3350-3368) — diseño verificado por los tests
- test-typed-cutover.mjs cubre exactamente lo que una migración riesgosa necesita: dual-write transaccional, roundtrip sin pérdida (null explícito vs ausente, drift de tipo, jsonb anidado, ids duplicados), backfill idempotente y paridad, usando los esquemas REALES de typed-schemas.js (header del archivo, líneas 1-12)
- La suite e2e protege contratos de infraestructura sutiles que un smoke genérico no vería: APP_BUILD parseado del HTML == /api/app-version, ?v= immutable de core.js, prohibición de 'use strict' en core.js, denylist de .json sensibles y .jwt-secret (smoke-05-core.spec.js:29-43, smoke-01-server.spec.js:63-71)
- Guardia de consola bien pensada: pageerror SIEMPRE es fallo, console.error solo se permite con allowlist comentada del porqué, y la regla escrita es ampliar la allowlist con comentario, no silenciar el guard (helpers/console-guard.js, README.md:51-53)
- Honestidad en el reporte: los flujos críticos pendientes están como test.fixme visibles en el reporte (no tests falsos-verdes), y el README documenta qué cubre cada spec y por qué se retiró smoke-06 (tests/e2e/README.md:41-43)
- La regla operativa 'suite verde ANTES y DESPUÉS de cada cambio grande' está escrita (MEMORIA-PROYECTO.md:46,240; plan 08:186) y se practica: corridas documentadas 60→66→71 verdes el 22-jul, y el sandbox .data-e2e muestra una corrida de hoy 23:44
- La auditoría previa fue accionada: R-01 (silentCatch indefinido) ya está corregido con la función definida en proxy.js:25 y handlers unhandledRejection/uncaughtException registrados (proxy.js:32-36) — el ciclo hallazgo→fix funciona
- Monitor externo de uptime independiente de Railway con auto-issue y runbook embebido (.github/workflows/uptime.yml) — observabilidad nivel 1 sin costo

## Hallazgo QA-01: Los flujos críticos del negocio por UI siguen como test.fixme sin definir

**Área:** K — Pruebas y calidad

**Severidad:** Alta

**Estado:** Confirmado

**Componente afectado:** tests/e2e/flujos-criticos.spec.js

**Evidencia encontrada:** tests/e2e/flujos-criticos.spec.js:40-52 — test.fixme('tasks: crear tarea → aparece en la lista → completar') y test.fixme('sdv: crear solicitud en portal → aparece en bandeja') con cuerpo TODO(equipo); el propio archivo (líneas 7-9) dice 'Qué flujos son críticos es conocimiento de operación (Gabriel/Filippo)'

**Situación actual:** La suite e2e garantiza que cada pantalla abre sin explotar (smoke 01-07), pero las operaciones que sostienen el negocio — crear tarea→empaque→despacho→completar y SDV portal→bandeja — solo tienen cobertura a nivel API (harnesses _stress360, _gateodoo); por UI existen únicamente 3 tests de que las vistas de tareas cargan. Los esqueletos esperan definición del equipo desde el 22-jul.

**Problema:** El monolito frontend (historial.html, ~34.000 líneas sin framework) es donde ocurren las regresiones de UI (selectores, drawers, gates de botones), y las olas 4-5 de modularización van a mover precisamente el drawer de tareas. Sin estos tests, una extracción puede dejar el flujo de despacho inoperable y la suite seguiría verde.

**Práctica estándar de la industria:** Los happy-paths críticos del negocio se cubren end-to-end por la interfaz real antes de refactors grandes; 3-5 tests de ~10 líneas cada uno bastan.

**Riesgo técnico:** Regresión de UI en el ciclo tarea/despacho no detectada por la red de seguridad que existe justamente para permitir la modularización.

**Riesgo para el negocio:** El almacén no puede crear o completar despachos tras un deploy — parálisis operativa del proceso central, detectada por los usuarios y no por los tests.

**Causa raíz probable:** Definir qué flujos son críticos requiere conocimiento de operación que el desarrollador delegó al equipo (comentario explícito en el spec); nadie ha cerrado ese pendiente.

**Recomendación:** Definir e implementar los 3-5 flujos críticos por UI antes de la Ola 4 (secciones medianas) — es el prerequisito que el propio plan 08 declaró.

**Solución inmediata:** Sesión de 1 hora con Gabriel/Filippo para nombrar los 3-5 flujos; implementarlos siguiendo el patrón ya funcionando en el mismo archivo (líneas 27-36).

**Solución definitiva:** Regla: cada bug de producción en tasks/SDV genera su test e2e por UI antes del fix (ya se hace a nivel API con los _test_vNNN; extenderlo a UI).

**Esfuerzo estimado:** Bajo

**Prioridad:** P1

**Dependencias:** Ninguna técnica; solo decisión del equipo.

**Criterio de aceptación:** flujos-criticos.spec.js sin ningún test.fixme; los 3-5 flujos corren verdes en la suite.

**Cómo validar la corrección:** npx playwright test flujos-criticos --list no muestra fixme; correr la suite completa.

**Verificación adversarial (CONFIRMADO):** La evidencia se reproduce hoy tal cual: los dos test.fixme con cuerpos TODO(equipo) están en flujos-criticos.spec.js:40-52 y el comentario de delegación al equipo en las líneas 7-9. No existe ningún test por UI que cree/complete tareas ni recorra el flujo SDV portal→bandeja (los smoke solo navegan y verifican visibilidad; la cobertura de esos flujos es exclusivamente API en tests/_stress360.mjs, _test_sdv_*.mjs y test-sdv-cancel-reactivate.sh). La severidad no está inflada: el propio plan 08 (línea 79) declara la Ola 0 como "red de seguridad (prerrequisito duro)" y sus líneas 89-90 más el README de e2e (línea 239) siguen marcando estos flujos como el pendiente abierto, con olas 2-3 ya ejecutadas y las 4-5 (que mueven el drawer de tareas) por delante. Único matiz menor: los esqueletos son del 22-jul (commit e8f6a0e, un día de antigüedad) y smoke-06 fue retirado, así que la suite vigente es 01-05+07 — nada de esto altera el fondo del hallazgo. · Evidencia re-vista: tests/e2e/flujos-criticos.spec.js:7-9,27-36,40-52 (verificado hoy); corroborado por tests/e2e/README.md:239 y docs/auditoria-arquitectura/08-plan-modularizacion.md:79,89-90; ausencia de mitigación verificada con grep sobre tests/e2e/*.spec.js (ningún click/fill de creación de tarea o SDV fuera de login/navegación)


## Hallazgo QA-02: Cero CI de tests: toda la calidad depende de disciplina manual en la máquina del dev

**Área:** K — Pruebas y calidad

**Severidad:** Alta

**Estado:** Confirmado

**Componente afectado:** .github/workflows/

**Evidencia encontrada:** .github/workflows/ contiene solo uptime.yml (monitor de /api/health cada 5 min); ningún workflow ejecuta tests. Sin hooks de git (.git/hooks vacío de no-samples), sin husky, y RAILWAY.md (runbook de deploy) no menciona tests

**Situación actual:** La regla 'suite verde ANTES y DESPUÉS' (MEMORIA-PROYECTO.md:46) es disciplina escrita, no un gate. El deploy es manual (railway up desde el working tree), GitHub no dispara nada, y nada impide commitear o deployar con la suite roja. Con sesiones paralelas de agentes IA editando el mismo árbol (riesgo documentado en la memoria del proyecto), la ventana de error humano crece.

**Problema:** Toda la inversión en tests (suite e2e + 25 harnesses) puede quedar sin ejecutar en el momento exacto en que más se necesita: un hotfix apurado o un deploy nocturno. No hay registro histórico de corridas ni forma de saber si un commit pasó la suite.

**Práctica estándar de la industria:** Un workflow de CI que corra en push la suite e2e y los harnesses offline; los tests de este repo ya son autocontenidos y sin secretos (envs forzadas a vacío), así que correrían en GitHub Actions sin configuración adicional.

**Riesgo técnico:** Regresión commiteada y deployada sin que la suite se haya ejecutado; imposible bisecar 'desde cuándo está roto' sin historial de corridas.

**Riesgo para el negocio:** Caída o corrupción funcional en producción que los tests existentes habrían atrapado gratis.

**Causa raíz probable:** El flujo de deploy nació manual (CLI desde la máquina de Gabriel) y GitHub es solo respaldo de código; nunca se cableó CI porque el único dev corre los tests localmente.

**Recomendación:** Montar el workflow de CI esta semana: es la mejora de mayor retorno/esfuerzo de toda el área — convierte la inversión en tests ya hecha en protección automática.

**Solución inmediata:** Workflow tests.yml: npm ci en tests/e2e + npx playwright install chromium + npx playwright test, más node --check de proxy.js/storage-pg.js/core.js y los harnesses offline (_test_b1b3_colas, _test_eometrics, _test_outcierre). Todo corre sin secretos.

**Solución definitiva:** Badge/issue automático en rojo (mismo patrón que uptime.yml) + checklist de deploy en RAILWAY.md que exija el enlace a la última corrida verde antes de railway up.

**Esfuerzo estimado:** Bajo

**Prioridad:** P1

**Dependencias:** Ninguna; los tests ya están aislados de Odoo/PG/R2 reales.

**Criterio de aceptación:** Cada push a master ejecuta la suite; un fallo abre issue o marca el commit en rojo.

**Cómo validar la corrección:** Push de prueba con un test roto a propósito en una rama → el workflow falla.

**Verificación adversarial (CONFIRMADO):** La evidencia se reproduce completa hoy: .github/workflows/ solo contiene uptime.yml (monitor de /api/health, sin tests), .git/hooks solo tiene samples, no hay husky ni hooksPath ni tooling de hooks en package.json, y RAILWAY.md no menciona tests ni una vez. Busqué activamente un fix (historial git de .github, archivos CI sin commitear, otros sistemas de CI) y no existe ninguno. Las premisas del hallazgo también se verifican: la regla de disciplina está en MEMORIA-PROYECTO.md:46 y los tests e2e ya aíslan secretos (playwright.config.js fuerza las envs de Odoo a vacío), por lo que el workflow propuesto correría sin configuración adicional. Severidad Alta/P1 es proporcionada: no es una decisión deliberada documentada (lo deliberado es que GitHub no dispare deploys, no que los tests no corran en CI), la operación es crítica y el matiz de que railway up deploya desde el working tree agrava el gap en vez de reducirlo. · Evidencia re-vista: .github/workflows/uptime.yml (único workflow, solo ping de health); .git/hooks/ (solo *.sample); RAILWAY.md (grep -i test → 0 resultados); MEMORIA-PROYECTO.md:46 y :240 (regla "suite verde ANTES y DESPUÉS" como texto, no gate); package.json:6-14 (scripts test:* sin cableado a CI/hooks); tests/e2e/playwright.config.js:42-51 (ODOO_URL/DB/USER/API_KEY forzadas a '')


## Hallazgo QA-03: La red de seguridad por defecto no prueba el modo de producción (PostgreSQL + tablas tipadas)

**Área:** K — Pruebas y calidad

**Severidad:** Alta

**Estado:** Confirmado

**Componente afectado:** tests/e2e/playwright.config.js + tests/test-storage-pg.mjs + tests/test-typed-cutover.mjs

**Evidencia encontrada:** playwright.config.js:45-47 fuerza DATABASE_URL:'' ('con DATABASE_URL definida node proxy.js hace exit(1)'); test-storage-pg.mjs:20-23 y test-typed-cutover.mjs:22-25 hacen 'SKIP (código 0)' sin WWP_PG_TEST_URL; ninguno de los dos está en los scripts npm de package.json

**Situación actual:** Producción corre desde el 22-23 jul PostgreSQL con WWP_TYPED=read (24 tablas tipadas, cutover Fase 3B). La suite e2e — la red de seguridad de la modularización — arranca el server en modo archivos JSON, y los dos tests que sí cubren la capa PG/tipadas (excelentes en contenido) son opcionales: exigen un PG de pruebas por env var, salen con SKIP silencioso sin ella, y no están cableados a test:all ni a ninguna rutina.

**Problema:** El camino de código que sirve a los 29 usuarios reales (storage-pg.js en modo typed-read, con dual-write a collection_rows) puede regresionar sin que ninguna corrida por defecto lo note. El SKIP con exit 0 hace fácil creer que 'todo pasó' cuando la capa de storage de producción ni se ejercitó.

**Práctica estándar de la industria:** La suite de regresión ejercita la misma configuración de persistencia que producción, o como mínimo el pipeline la corre en ambos modos.

**Riesgo técnico:** Bug en storage-pg.js/typed-schemas.js (p.ej. en el dual-write o el modo read) invisible para la suite verde; especialmente delicado mientras el cutover es reciente y el dual-write sigue activo como rollback.

**Riesgo para el negocio:** Corrupción o pérdida de datos operativos (tareas, SDV, inspecciones) en producción con la suite en verde — el peor escenario de falsa confianza.

**Causa raíz probable:** La suite e2e nació para proteger la modularización del frontend (modo archivos es más simple y hermético); el cutover relacional llegó después y los tests PG quedaron como herramienta manual del cutover, no como regresión permanente.

**Recomendación:** Prioritario mientras el dual-write siga activo: es la ventana donde un bug de paridad puede divergir tipadas vs espejo sin que nadie lo vea.

**Solución inmediata:** Documentar en README de tests que el SKIP existe y correr test-storage-pg + test-typed-cutover manualmente tras cada cambio en storage-pg.js/typed-schemas.js (mientras no haya CI).

**Solución definitiva:** En CI, levantar un PostgreSQL de servicio (GitHub Actions lo da gratis) y correr ambos tests con WWP_PG_TEST_URL apuntándole; opcionalmente un job segundo de la suite e2e con DATABASE_URL al PG efímero y WWP_TYPED=read.

**Esfuerzo estimado:** Medio

**Prioridad:** P1

**Dependencias:** Hallazgo del CI (workflow de tests); un PG efímero en el runner.

**Criterio de aceptación:** Ninguna corrida 'verde' puede omitir silenciosamente la capa PG: el pipeline muestra los dos tests ejecutados (no SKIP).

**Cómo validar la corrección:** Romper a propósito un mapper de typed-schemas.js en rama → el pipeline falla.

**Verificación adversarial (CONFIRMADO):** La evidencia se reproduce hoy línea por línea: la suite e2e fuerza DATABASE_URL:'' (modo archivos JSON), ambos tests PG hacen SKIP con exit 0 sin WWP_PG_TEST_URL, y ningún script npm ni workflow los ejecuta (.github/workflows solo tiene uptime.yml, un monitor de health sin tests). Busqué activamente fixes: no hay CI de tests, typedParity es solo un endpoint admin on-demand, y las guardias de runtime (dual-write espejo, conteos al boot) mitigan el daño pero no detectan regresiones antes del deploy. Matiz menor: MEMORIA-PROYECTO.md:63 ya documenta el SKIP, cubriendo parte de la 'solución inmediata', pero el gap central sigue íntegro; la severidad Alta/P1 es proporcionada con el cutover reciente y el dual-write activo como ventana de divergencia. · Evidencia re-vista: tests/e2e/playwright.config.js:45-47 (DATABASE_URL:'' forzada); tests/test-storage-pg.mjs:20-23 y tests/test-typed-cutover.mjs:22-25 (SKIP exit 0); package.json:6-15 (test:all sin tests PG ni e2e); .github/workflows/uptime.yml (único workflow, sin tests); proxy.js:20575 (typed-parity solo on-demand); MEMORIA-PROYECTO.md:63 (SKIP documentado)


## Hallazgo QA-04: npm test (entry point por defecto) está roto: golpea un endpoint que ahora exige JWT y presupone server corriendo

**Área:** K — Pruebas y calidad

**Severidad:** Media

**Estado:** Confirmado

**Componente afectado:** tests/test-smoke.js + package.json

**Evidencia encontrada:** package.json: "test": "node tests/test-smoke.js"; test-smoke.js:74 llama GET /api/smoke-test sin header Authorization (request() usa http.get pelado, líneas 13-27) mientras proxy.js:8510 exige sesión ('const _jpSmoke = requireJwt(req, res); if (!_jpSmoke) return;' — R-06C) y requireJwt responde 401 sin Bearer (proxy.js:3350-3352); el criterio del test es status===200 (línea 77)

**Situación actual:** npm test y npm run test:all (que lo incluye) fallan siempre en el paso smoke: el Test 2 recibirá 401. Además test-smoke.js exige un server ya corriendo en :3000 (no levanta ninguno) e imprime un estado final hardcodeado engañoso ('Sheets simulado EN VIVO', línea 133) que no refleja nada real.

**Problema:** El comando canónico de test del ecosistema Node está roto y miente: cualquier persona o agente IA que corra npm test concluirá que hay un fallo (o peor, ignorará el resultado por ruido). Los harnesses buenos quedan escondidos detrás de comandos ad-hoc.

**Práctica estándar de la industria:** npm test ejecuta la suite mínima confiable del proyecto de forma autosuficiente y su salida es veraz.

**Riesgo técnico:** Se normaliza ignorar los fallos de npm test ('siempre falla, es normal'), lo que entrena al equipo y a los agentes IA a descartar señales rojas.

**Riesgo para el negocio:** Indirecto: erosión del hábito de correr tests, que es la única defensa dado que no hay CI.

**Causa raíz probable:** test-smoke.js es de la era pre-hardening; cuando R-06C gateó /api/smoke-test con JWT nadie actualizó al consumidor.

**Recomendación:** Arreglo de una tarde; alinear los scripts npm con la realidad de la suite.

**Solución inmediata:** Repuntar npm test a la suite e2e (test:e2e) o hacer que test-smoke.js haga login con el seed admin antes de llamar /api/smoke-test.

**Solución definitiva:** Redefinir los scripts npm: test = smoke rápido autosuficiente; test:all = inventario + geo + e2e + b1b3 + (storage-pg/typed si hay PG); borrar la línea hardcodeada 'EN VIVO'.

**Esfuerzo estimado:** Bajo

**Prioridad:** P2

**Dependencias:** Ninguna.

**Criterio de aceptación:** npm test pasa en verde sobre un clon con las instrucciones del README, sin server previo corriendo.

**Cómo validar la corrección:** Correr npm test en limpio (nota: este levantamiento lo confirmó por lectura de código, sin ejecutar — el 401 es determinista: no hay header Authorization posible en ese código).


## Hallazgo QA-05: Siete harnesses no corren en un clon fresco: dependen de certificados gitignorados (hallazgo previo aún sin corregir)

**Área:** K — Pruebas y calidad

**Severidad:** Media

**Estado:** Confirmado

**Componente afectado:** tests/_gateodoo.mjs, _test_capa1_picks.mjs, _test_v113/117/202/212.mjs, test-geo-contract.mjs

**Evidencia encontrada:** .gitignore:6 excluye *.pem; _fakecert.pem/_fakekey.pem NO existen en este clon (verificado hoy con ls); _gateodoo.mjs:20 hace fs.readFileSync(path.join(ROOT,'_fakekey.pem')) sin fallback → crash ENOENT. Ya lo señaló docs/auditoria-arquitectura/05-riesgos-deuda-tecnica.md:140 el 22-jul y sigue igual

**Situación actual:** Los harnesses del Odoo falso HTTPS leen certs de la raíz que solo existen en la máquina original de Gabriel (CLAUDE.md:24 los describe como 'quedaron intencionalmente en la raíz'). test-geo-contract.mjs ya resolvió el problema bien: genera el cert con openssl y solo usa los .pem como fallback (líneas 32-41), igual que test-inventario-contract.mjs. Los 6 harnesses viejos no adoptaron ese patrón.

**Problema:** En cualquier máquina nueva (esta, un runner de CI, otro agente) 6 harnesses valiosos — incluido el del gate de picking de Odoo, lógica crítica de despacho — mueren al arrancar. Es además un bloqueante directo para el hallazgo del CI.

**Práctica estándar de la industria:** Los tests generan sus fixtures efímeros o los versionan; nunca dependen de archivos locales no reproducibles.

**Riesgo técnico:** La cobertura del gate Odoo y de los fixes v113/v117/v202/v212 es inejecutable fuera de una máquina; en la práctica esos tests dejan de correrse.

**Riesgo para el negocio:** Regresiones en el gate de picking (bloquea despachos sin pick done) sin red de seguridad ejecutable.

**Causa raíz probable:** Patrón copiado de harness en harness antes de que existiera la generación con openssl; el hallazgo de la auditoría previa no se priorizó.

**Recomendación:** Corregirlo junto con el CI: son los mismos 20 líneas de helper.

**Solución inmediata:** Extraer la createCertificate() de test-geo-contract.mjs a un helper compartido (tests/_certs.mjs) y usarla en los 6 harnesses.

**Solución definitiva:** Igual + quitar la nota obsoleta de CLAUDE.md:24 sobre los .pem en la raíz.

**Esfuerzo estimado:** Bajo

**Prioridad:** P2

**Dependencias:** openssl disponible (ya es el supuesto de geo/inventario).

**Criterio de aceptación:** git clone limpio + node tests/_gateodoo.mjs corre hasta el final sin ENOENT.

**Cómo validar la corrección:** Correr cualquiera de los 6 en este clon (hoy fallan al primer readFileSync).


## Hallazgo QA-06: El flujo SDV cancelar→reactivar no tiene cobertura automatizada: su único test usa un endpoint que ya no existe

**Área:** K — Pruebas y calidad

**Severidad:** Media

**Estado:** Confirmado

**Componente afectado:** tests/test-sdv-cancel-reactivate.sh

**Evidencia encontrada:** test-sdv-cancel-reactivate.sh:10 hace POST a /api/login con password '123456'; grep de 'api/login' en proxy.js = 0 ocurrencias (el endpoint real es /api/wwp/auth/login, proxy.js:11527). La lógica de reactivación vive en proxy.js:19717-19724 y 13128-13137; grep de 'reactivar|reactivate' en tests/*.mjs = 0 harnesses

**Situación actual:** La reactivación de solicitudes canceladas (con reglas de negocio delicadas: solo canceladas, solo autorizado, tareas canceladas solo reactivan a pending, advertencias sobre OUT ya validado en Odoo con stock descontado — proxy.js:19591) solo tiene como test un script bash muerto y el smoke e2e de que la sección sdv-reactivations renderiza.

**Problema:** Script inservible que aparenta cobertura, y un flujo con implicaciones de inventario físico (mercancía que no debe re-almacenarse sin documento) sin ninguna verificación automatizada.

**Práctica estándar de la industria:** Flujos con reglas de estado no triviales tienen test de contrato API; los scripts muertos se borran o arreglan.

**Riesgo técnico:** Regresión silenciosa en las validaciones de reactivación (p.ej. permitir reactivar una SDV cuyo OUT ya descontó stock).

**Riesgo para el negocio:** Trabajo vivo creado sobre órdenes muertas o mercancía re-almacenada sin documento — descuadre físico/contable en el almacén.

**Causa raíz probable:** El script quedó de la era pre-refactor de auth y nadie lo migró; el flujo nunca ganó un harness .mjs como los demás.

**Recomendación:** Escribirlo con la plantilla de _test_v114 (medio día).

**Solución inmediata:** Borrar o marcar OBSOLETO el .sh para que no aparente cobertura.

**Solución definitiva:** Harness _test_sdv_reactivar.mjs con el patrón estándar del repo (server aislado, casos: reactivar cancelada OK, no-cancelada 4xx, no autorizado 403, tarea cancelada→pending solo admin).

**Esfuerzo estimado:** Bajo

**Prioridad:** P2

**Dependencias:** Ninguna.

**Criterio de aceptación:** Harness verde cubriendo los 4 casos; el .sh eliminado.

**Cómo validar la corrección:** node tests/_test_sdv_reactivar.mjs desde la raíz.


## Hallazgo QA-07: Sin lint, formatter ni análisis estático; node --check es la única validación y no detecta referencias indefinidas

**Área:** K — Pruebas y calidad

**Severidad:** Media

**Estado:** Confirmado

**Componente afectado:** raíz del repo (tooling)

**Evidencia encontrada:** No existe .eslintrc*/eslint.config.*/.prettierrc* (verificado con ls), no hay husky ni hooks de git activos, package.json no tiene devDependencies de lint; la única validación referida es 'node --check' (MEMORIA-PROYECTO.md:47,231)

**Situación actual:** El backend son 20.964 líneas en un archivo sloppy-mode y el frontend 34.000 líneas de script inline; core.js deliberadamente sin 'use strict' (globals implícitos). node --check solo valida sintaxis: no atrapa variables indefinidas, sombras ni typos de nombre.

**Problema:** El bug histórico R-01 (silentCatch invocada 76 veces estando indefinida durante semanas, hoy corregida en proxy.js:25) es exactamente la clase de defecto que una pasada de no-undef habría atrapado el día uno. En un entorno donde agentes IA editan miles de líneas, el linter es la segunda lectura que no existe.

**Práctica estándar de la industria:** ESLint mínimo (no-undef, no-unused-vars) aunque el estilo quede libre; corre en pre-commit o CI en segundos.

**Riesgo técnico:** Typos que crean globals implícitos o referencias muertas viven hasta que la rama de código se ejecuta en producción.

**Riesgo para el negocio:** Errores 500 latentes en rutas poco transitadas (los catch de error, precisamente).

**Causa raíz probable:** Proyecto nacido como artifact sin tooling; nunca se añadió porque 'no hay build'.

**Recomendación:** Configuración mínima intencionalmente: reglas de corrección sí, guerras de estilo no.

**Solución inmediata:** eslint flat config con solo no-undef/no-unused-vars sobre proxy.js, storage-pg.js, write-queue.js, media.js, boot.js, core.js, core-isla.js (con globals declarados); correrlo una vez y triagear.

**Solución definitiva:** Añadirlo al workflow de CI del hallazgo P1; opcionalmente extraer los <script> de historial.html para lintearlos también.

**Esfuerzo estimado:** Bajo

**Prioridad:** P2

**Dependencias:** Ninguna (eslint como devDependency raíz no afecta el deploy: Railway usa --production).

**Criterio de aceptación:** npx eslint . en verde y corriendo en CI.

**Cómo validar la corrección:** Introducir una referencia indefinida en rama → eslint la reporta.


## Hallazgo QA-08: Cobertura por dominio dispareja: averías, inspecciones vehiculares, formación, políticas, usuarios y media/R2 no tienen ningún harness

**Área:** K — Pruebas y calidad

**Severidad:** Media

**Estado:** Confirmado

**Componente afectado:** tests/ (mapa de cobertura)

**Evidencia encontrada:** grep 'averias' en tests/*.mjs = 0 archivos; 'inspecc' = 0; 'formacion|cursos' = 0. La cobertura existente se concentra en: sdv (stress360, multiret, devolución, dividir-sedes, faseBC, v114/v192/v193), tasks/despacho (gateodoo, capa1_picks, v113-v212, outcierre), inventario (contract 36KB), geo, eo-metrics, storage (pg/typed/b1b3). Para averías/inspecciones/formación/políticas/usuarios solo existe el smoke e2e de render (smoke-03/04) y verificación manual con curl (MEMORIA-PROYECTO.md:231)

**Situación actual:** La estrategia implícita ha sido racional: harness donde hubo bug o feature nueva (los _test_vNNN nacen de casos reales). El resultado es que los dominios centrales del despacho están muy protegidos y los periféricos en cero — pero averías e inspecciones son evidencia legal/comercial (fotos, trazabilidad) y usuarios es la puerta del RBAC (CRUD de roles y permisos).

**Problema:** Un cambio transversal (p.ej. el cutover tipado, que tocó las 24 colecciones, o la migración de fotos a R2) puede romper averías o inspecciones sin que ningún test lo note más allá de 'la sección renderiza'.

**Práctica estándar de la industria:** Cobertura mínima de contrato (CRUD + permisos + persistencia) por dominio de datos, aunque sea superficial, antes que cobertura profunda en unos y nula en otros.

**Riesgo técnico:** Regresión en la persistencia o RBAC de averías/inspecciones/usuarios invisible a la suite.

**Riesgo para el negocio:** Pérdida de evidencia de averías o inspecciones (disputa con cliente sin fotos) o escalada de privilegios por bug en el CRUD de usuarios.

**Causa raíz probable:** Los harnesses nacen de bugs reportados; los dominios estables nunca dieron un bug que motivara el suyo.

**Recomendación:** No perseguir cobertura total: 2-3 harnesses de contrato en los dominios con evidencia legal bastan para este contexto.

**Solución inmediata:** Priorizar 2 harnesses de contrato: averías (crear+foto+persistencia+RBAC) e inspecciones (idem), con la plantilla estándar del repo.

**Solución definitiva:** Un _test_contrato_colecciones.mjs paramétrico que recorra los CRUD básicos de cada colección tipada contra el server aislado — barato de extender al añadir dominios.

**Esfuerzo estimado:** Medio

**Prioridad:** P2

**Dependencias:** Ninguna.

**Criterio de aceptación:** Cada dominio con datos operativos tiene al menos un harness de contrato CRUD+RBAC.

**Cómo validar la corrección:** Matriz dominio×harness en el README de tests sin celdas vacías en dominios con datos de negocio.


## Hallazgo QA-09: El guard de coherencia de hash de las islas se retiró con smoke-06 y su reemplazo quedó huérfano

**Área:** K — Pruebas y calidad

**Severidad:** Media

**Estado:** Confirmado

**Componente afectado:** tests/e2e/helpers/islas.js

**Evidencia encontrada:** helpers/islas.js:2-3 dice 'los guards de coherencia de hash (core-isla.js / theme.css) la recogen solos', pero grep de 'helpers/islas' en tests/e2e/*.spec.js = 0 (ningún spec lo importa) y grep de 'core-isla|theme.css?v' en specs = 0; el registro además omite la isla empaque que smoke-07 sí cubre (lista inline propia, smoke-07:13-18). Plan 08:127 documenta que 'smoke-06 lo vigilaba' y smoke-06 se retiró (README.md:41-43)

**Situación actual:** CLAUDE.md exige re-estampar el ?v= de core-isla.js 'en TODAS las islas' al editarlo (caché immutable 1 año). smoke-05 protege ese contrato para core.js/theme.css en el shell, pero para las 5 islas el guard murió con smoke-06 y el helper que debía alimentarlo quedó como código muerto desincronizado.

**Problema:** Editar core-isla.js y olvidar re-estampar una isla deja esa isla sirviendo un núcleo viejo cacheado por un año en los navegadores — el tipo de bug de caché difícil de diagnosticar ('a él le funciona, a ella no'), y la suite quedaría verde.

**Práctica estándar de la industria:** El contrato de versionado que la documentación declara obligatorio tiene su test (como ya lo tiene el shell en smoke-05:36-43).

**Riesgo técnico:** Isla con core-isla.js desactualizado en producción (auth/fetch/tema divergentes del shell) sin detección.

**Riesgo para el negocio:** Usuarios con comportamiento inconsistente entre pestañas WWP según caché; soporte fantasma.

**Causa raíz probable:** El retiro del visor Base de datos (pedido de Gabriel, 5275c3a) se llevó la spec smoke-06 completa, incluidos los guards genéricos que no eran específicos del visor.

**Recomendación:** ~30 líneas de spec; recupera un guard que ya existió y se perdió por accidente de scope.

**Solución inmediata:** Spec smoke-08-islas-contrato.spec.js que use el registro ISLAS: para cada isla, fetch del HTML y assert de que referencia /core-isla.js?v=<hash> y /theme.css?v=<hash> coincidiendo con el hash real servido; añadir empaque al registro.

**Solución definitiva:** Igual; el registro islas.js pasa a ser la única lista (smoke-07 la importa también).

**Esfuerzo estimado:** Bajo

**Prioridad:** P2

**Dependencias:** Ninguna.

**Criterio de aceptación:** Editar core-isla.js sin re-estampar una isla hace fallar la suite.

**Cómo validar la corrección:** Mutar el ?v= de una isla en rama → spec en rojo.


## Hallazgo QA-10: Los tests unitarios dependen de extraer funciones de proxy.js con regex + new Function

**Área:** K — Pruebas y calidad

**Severidad:** Baja

**Estado:** Confirmado

**Componente afectado:** tests/_test_eometrics.mjs, _test_outcierre.mjs

**Evidencia encontrada:** _test_eometrics.mjs:18,54-56 — extractFn(name) recorta el texto de la función del fuente y new Function(...) la re-evalúa con stubs inyectados; _test_outcierre.mjs:19,43-44 igual; _test_b1b3_colas.mjs:146-147 asserta sobre el texto del fuente ('proxySrc.includes(...)')

**Situación actual:** proxy.js no exporta nada (require lo arranca entero como servidor), así que la única forma de probar lógica pura (eoBuildMetrics, cierre de OUT) sin levantar el server es extraer el texto de la función y evaluarlo. Es ingenioso y hoy funciona.

**Problema:** El patrón es frágil: renombrar o mover la función rompe la extracción; y la función extraída corre fuera de su closure real (los stubs inyectados pueden divergir del entorno verdadero → riesgo de falso verde si la función empieza a depender de un global no inyectado).

**Práctica estándar de la industria:** La lógica pura vive en módulos con module.exports (como ya se hizo con write-queue.js, storage-pg.js, typed-schemas.js, media.js) y se prueba con require normal.

**Riesgo técnico:** Tests que se rompen por refactors textuales inocentes, o que pasan probando una copia desincronizada de la semántica real.

**Riesgo para el negocio:** Bajo directo; erosiona la confianza en la señal de los tests.

**Causa raíz probable:** Diseño monolítico de proxy.js sin separación módulo/servidor; los tests se adaptaron al monolito en vez de al revés.

**Recomendación:** Aceptarlo como deuda consciente; no reescribir por reescribir.

**Solución inmediata:** Nada urgente: verificar que extractFn falla ruidosamente (no silencioso) si el nombre no aparece.

**Solución definitiva:** Al tocar esas funciones por otra razón, moverlas a un módulo exportable (patrón write-queue.js) y convertir el harness a require directo — sin big-bang.

**Esfuerzo estimado:** Medio

**Prioridad:** P3

**Dependencias:** Va de la mano con la modularización del backend (fuera del alcance de esta área).

**Criterio de aceptación:** Ningún harness nuevo usa extracción por regex; los existentes migran oportunistamente.

**Cómo validar la corrección:** grep de 'new Function' en tests/ decrece con el tiempo.


## Hallazgo QA-11: Las guardias anti-producción de los tests PG destructivos son heurísticas débiles

**Área:** K — Pruebas y calidad

**Severidad:** Baja

**Estado:** Confirmado

**Componente afectado:** tests/test-storage-pg.mjs, tests/test-typed-cutover.mjs

**Evidencia encontrada:** test-storage-pg.mjs:8-9 '⚠️ La DB apuntada se LIMPIA (DROP de las tablas)'; la guardia (líneas 24-27) solo aborta si la URL matchea /prod|railway\.internal/ (typed añade rlwy\.net) Y no contiene wwp_dev — cualquier URL de producción con otro hostname pasa y sería limpiada

**Situación actual:** Ambos tests hacen DROP/limpieza de la DB que reciben por WWP_PG_TEST_URL. La guardia es una denylist de patrones de Railway, no una allowlist de entornos de prueba. El comentario de test-storage-pg.mjs:45-47 confirma que se ha usado el proxy público de Railway para pruebas locales — es decir, URLs remotas sí circulan por aquí.

**Problema:** Un copy-paste equivocado de una DATABASE_URL de producción con hostname no-Railway (o un futuro cambio de proveedor) destruiría las tablas de producción sin aviso.

**Práctica estándar de la industria:** Allowlist positiva: exigir que la URL contenga un marcador de test (p.ej. /wwp_dev|_test/) y abortar en caso contrario — invertir la carga de la prueba.

**Riesgo técnico:** Pérdida total de las tablas de storage en la DB apuntada por error.

**Riesgo para el negocio:** Pérdida de datos operativos si el error apunta a producción (mitigado por el espejo dual-write y backups, pero evitable con 3 líneas).

**Causa raíz probable:** La guardia se escribió contra el naming actual de Railway, no contra el caso general.

**Recomendación:** 3 líneas por archivo; hacerlo ya.

**Solución inmediata:** Invertir la condición: abortar salvo que la URL matchee /wwp_dev|localhost|127\.0\.0\.1|_test/.

**Solución definitiva:** Igual en ambos archivos + confirmación interactiva o env WWP_PG_TEST_I_KNOW=1 para URLs remotas.

**Esfuerzo estimado:** Bajo

**Prioridad:** P3

**Dependencias:** Ninguna.

**Criterio de aceptación:** Una URL arbitraria sin marcador de test provoca ABORT antes de cualquier query.

**Cómo validar la corrección:** WWP_PG_TEST_URL=postgresql://x@host-cualquiera/db node tests/test-storage-pg.mjs → ABORT.


## Hallazgo QA-12: La allowlist del console-guard es más amplia que su intención: silencia cualquier console.error de /api/odoo y /api/sheets

**Área:** K — Pruebas y calidad

**Severidad:** Baja

**Estado:** Confirmado

**Componente afectado:** tests/e2e/helpers/console-guard.js

**Evidencia encontrada:** console-guard.js:10-12 — ALLOW = [/\/api\/odoo/i, /\/api\/sheets/i] se evalúa contra texto Y URL del mensaje (línea 38): cualquier console.error que mencione esas rutas pasa, sin distinguir el 502/503 ambiental del 500/4xx de contrato roto; la distinción fina solo existe en esUpstreamAusente (líneas 25-27), que aplica al resto de /api/*

**Situación actual:** El propio guard documenta el estándar correcto ('Un 4xx o 500 NO se permite: eso es contrato roto de la app', línea 24) y lo aplica a /api/* genérico — pero las dos primeras entradas de ALLOW cortocircuitan esa lógica para las rutas Odoo/Sheets: un 500 real del backend en /api/odoo quedaría silenciado en toda la suite.

**Problema:** Precisamente las rutas de integración (las más propensas a romperse) tienen el filtro más laxo; una regresión que convierta el fallo ambiental en un 500 de la app pasaría desapercibida.

**Práctica estándar de la industria:** Allowlist por síntoma esperado (status 502/503, mensajes de reintento concretos), no por ruta completa.

**Riesgo técnico:** console.error legítimos de bug en el cliente sobre rutas Odoo/Sheets invisibles a la suite.

**Riesgo para el negocio:** Bajo; degrada la sensibilidad de la red de seguridad en su zona más caliente.

**Causa raíz probable:** Las entradas de ruta cubren los reintentos de checkOdooConnection/checkSheetsConnection al cargar (comentario, líneas 3-5) y se escribieron con brocha gorda.

**Recomendación:** Ajuste fino de 10 líneas al afinar la suite; no urgente.

**Solución inmediata:** Restringir las dos entradas al patrón de status ambiental: aplicar esUpstreamAusente también a odoo/sheets y quitar las regex de ruta pura (o acotarlas a 'Failed to load resource.*50[23]').

**Solución definitiva:** Igual; documentar en el README que la allowlist es por síntoma.

**Esfuerzo estimado:** Bajo

**Prioridad:** P3

**Dependencias:** Ninguna.

**Criterio de aceptación:** Un console.error simulado con status 500 sobre /api/odoo hace fallar el guard.

**Cómo validar la corrección:** Test unitario del guard o inyección manual en una página de prueba.



---

# Área L — Procesos reales frente al diseño

**Resumen del área:** Los controles operativos centrales que se diseñaron en el plan go-live SÍ se ejecutaron y viven en el servidor (gate de picking activado, checklist de 3 fotos, OUT-gate, watchdog de inventario), lo que distingue a este sistema de la mayoría: el diseño y el código convergen en el lazo principal. La grieta está en el lazo HUMANO de los controles: las señales de auditoría que se diseñaron para "hacer visible" la divergencia (out_gate_fail_open, dueDateAuto, audit log) se escriben pero no tienen ningún consumidor ni proceso de revisión; el plan de corrección de 46 negativos de inventario seguía 45/46 sin ejecutar al 7-jul con la causa raíz de proceso activa; y funciones enteras (tab Políticas roto meses sin que nadie lo reportara, historial de cumplimiento fabricado con datos mock en producción) revelan módulos que existen pero no se usan. Hay información de negocio gestionada fuera del sistema: el cerebro de agentes y las decisiones formales viven en el OneDrive personal de Gabriel, el deploy solo puede salir de su máquina, y tras eliminar el visor de BD la única vía de consulta de datos es SQL directo por el desarrollador. La producción anterior (Render) sigue viva con datos congelados y auto-deploy desde GitHub, y el dashboard de Ventas por Google Sheets se desmanteló sin destino documentado. Madurez 3/5: excelente institucionalización de controles en software, débil cierre del ciclo humano (quién revisa, quién ejecuta, quién decide) y bus factor 1.

**Madurez:** 3/5 — Nota 3/5. Lo que suma: los controles críticos del proceso central (picking, evidencia, validación OUT, SDV) están implementados EN EL SERVIDOR y coinciden con el diseño aprobado — el gate D2 que se decidió activar está activo y refinado con reglas de campo; la lección de los negativos se convirtió en watchdog automático; las decisiones importantes quedan escritas, fechadas y con autor; y el incidente del 25-jun produjo hardening permanente en vez de un parche. Eso es más madurez de proceso-en-software que la mayoría de sistemas de este tamaño. Lo que resta y ancla la nota: el ciclo humano de los controles está sistemáticamente incompleto — las señales de auditoría se capturan pero nadie las consume (out_gate_fail_open, dueDateAuto, audit log sin visor), el plan de corrección de inventario llevaba 45/46 sin ejecutar con la causa raíz activa, el cierre diario no tiene recordatorio ni obligatoriedad, y módulos visibles estuvieron rotos meses sin que ningún usuario lo reportara (Políticas) o muestran datos fabricados en producción (historial de cumplimiento). A esto se suma un bus factor 1 estructural (deploy, SQL, cerebro de agentes, todas las decisiones) con una cola de decisiones pendientes sin seguimiento, y dos canales zombis (Render vivo con datos congelados, dashboard Ventas/Sheets desmantelado sin destino). No es un 2 porque el núcleo operativo diario SÍ funciona como se diseñó y está en uso real intenso; no es un 4 porque un control sin revisor, un plan sin ejecutor y una organización sin segundo operador no constituyen un ciclo de proceso cerrado.

## Fortalezas verificadas

- El gate de picking (D2 del plan go-live) se ACTIVÓ de verdad y en el lugar correcto: proxy.js:13384 'ACTIVADO 2026-06-20: validar picking antes de permitir in_progress', server-side, re-chequeado en cada inicio, con reglas operativas refinadas por el equipo (regla Pit 23-jun para picks cancelados y despacho directo, proxy.js:13396-13400). El diseño aprobado se ejecutó tal cual.
- Checklist de despacho con 3 evidencias obligatorias validado en SERVIDOR antes de completar (proxy.js:13236-13237): el control es real, no cosmético de UI.
- La lección de los negativos de inventario se institucionalizó en software: watchdog diario dentro de la plataforma (proxy.js:6700-6746, INV_WATCHDOG default ON) + sección inventario-salud con casos con seguimiento, reemplazando el script manual _ron_neg_watch.mjs (archivado, _archivo/README.md:35-37).
- Disciplina correcta de corrección de inventario documentada: 'El ajuste en Odoo debe reflejar la realidad física, no al revés' (CORRECCION-INVENTARIO-2026-06-30.md:15) con pasos verificables por artículo y tabla de seguimiento.
- El incidente de pérdida de datos del 25-jun se convirtió en hardening real y permanente (escritura atómica, anti-vacío, snapshots horarios — AUDITORIA-WWP-2026-07-06.md sección 2.3) y el material del incidente quedó archivado y excluido de git (_archivo/README.md:24).
- La SDV minimiza la doble digitación: el lookup auto-puebla los artículos desde Odoo por número de orden (proxy.js:16826, articulosOdoo) — la vendedora no re-teclea el pedido, solo agrega datos de despacho (ciudad, fecha, GPS).
- Impersonation de admin auditada (proxy.js:11596 appendAuditLog('impersonate_start')) en vez de compartir contraseñas: el mecanismo de soporte correcto para una operación con usuarios de baja alfabetización digital.
- Cultura de documentación honesta y con fecha/autor: MEMORIA-PROYECTO.md registra decisiones ('decisión Gabriel 20-jul'), la auditoría del 6-jul reconoció que la plataforma estaba MÁS completa que su propia documentación, y los planes de corrección admiten explícitamente lo no ejecutado (PLAN-ACCION-NEGATIVOS-2026-07-07.md:16).

## Hallazgo PR-01: El plan de corrección de 46 negativos de inventario no consta ejecutado y la prevención de proceso (P1/P2/P4) no tiene evidencia de adopción

**Área:** L — Procesos reales frente al diseño

**Severidad:** Alta

**Estado:** Confirmado

**Componente afectado:** Proceso Odoo (recepciones CDP) + PLAN-ACCION-NEGATIVOS-2026-07-07.md

**Evidencia encontrada:** PLAN-ACCION-NEGATIVOS-2026-07-07.md:11-16: '45 de 46 siguen negativos... 5 negativos NUEVOS... el plan de corrección del 30-jun no se ha ejecutado, y la causa raíz sigue activa'. Las 5 decisiones que necesita Gabriel (líneas 86-94: quién cuenta, quién ajusta, watchdog, permisos Odoo, responsable de recepciones) solo tienen evidencia de la #3 (watchdog construido, proxy.js:6700). _archivo/README.md:54 confirma el ciclo 'AÚN ABIERTO' al 22-jul.

**Situación actual:** El flujo físico va más rápido que el registro (PLAN-ACCION:22-28): la mercancía se trabaja al llegar y la recepción en Odoo se valida días después en lote, generando negativos nuevos continuamente. El watchdog DETECTA pero no PREVIENE.

**Problema:** La parte software del plan se hizo (watchdog, sección inventario-salud, casos con conciliación automática) pero las fases físicas (Fase 1 conteo, Fase 2 ajustes en Odoo) y las medidas de proceso que atacan la causa raíz (P1: validar la recepción tránsito→CDP el mismo día ANTES de mover mercancía; P2: entrenamiento a los 3 validadores identificados; P4: restringir permisos de validación) no tienen evidencia de ejecución en ningún documento posterior al 7-jul.

**Práctica estándar de la industria:** La corrección de inventario es proceso, no software: sin responsable único de recepciones con hora límite, el detector solo documenta la sangría.

**Riesgo técnico:** Los gates de la plataforma que consultan stock Odoo (pick-gate, análisis) operan sobre cifras sabidas incorrectas en A-CDP/PFRONTAL.

**Riesgo para el negocio:** Stock negativo = ventas comprometidas sobre piezas inexistentes o piezas reales invisibles para ventas; el conteo del 30-jun ya costó dos auditorías completas y sigue abierto.

**Causa raíz probable:** Las decisiones de proceso están concentradas en Gabriel (tabla de 5 decisiones pendientes) y las correcciones requieren trabajo físico de un equipo que no es dueño del plan.

**Recomendación:** Tratarlo como el pendiente operativo #1 del área: es el único hallazgo donde el sistema ya hizo todo lo que el software puede hacer y el bloqueo es 100% de proceso.

**Solución inmediata:** Consultar el panel inventario-salud (o POST /api/inventario/watchdog-run) para conocer el estado real HOY; si los casos siguen abiertos, agendar la caminata de 2h de Fase 1 con fecha y nombre.

**Solución definitiva:** Ejecutar Fases 1-3 del plan + formalizar P1 (responsable único + hora límite de validar recepciones) y P4 (restringir quién valida transferencias en Odoo). El software ya está listo para verificar el cierre (conciliación automática corregido-auto, proxy.js sección inventario).

**Esfuerzo estimado:** Medio

**Prioridad:** P1

**Dependencias:** Decisiones 1, 2, 4 y 5 de PLAN-ACCION-NEGATIVOS:86-94; acceso Odoo; equipo físico CDP.

**Criterio de aceptación:** Watchdog reporta 0 negativos sin caso y 0 recepciones >24h durante 2 semanas seguidas; los 46+5 casos en estado corregido.

**Cómo validar la corrección:** GET /api/inventario/* (casos y negativos vivos) contra Odoo hoy; preguntar a Gabriel el estado de las 5 decisiones.

**Verificación adversarial (CONFIRMADO):** Toda la evidencia citada se reproduce hoy tal cual: las líneas 11-16, 22-28 y la tabla de 5 decisiones (86-94) de PLAN-ACCION-NEGATIVOS-2026-07-07.md existen literalmente; _archivo/README.md:54 declara los ciclos "AÚN ABIERTOS" en un README con verificación fechada 2026-07-22; y el watchdog existe en proxy.js:6698-6746 (invWatchdog) con conciliación automática (invConciliar, 6549). Busqué activamente evidencia de ejecución de Fase 1/2 y de adopción de P1/P2/P4 (grep en *.md, MEMORIA-PROYECTO.md, git log desde 7-jul, data-local) y solo hay trabajo de software posterior (v157/v182/v184/v187/v203, todo detección/monitoreo), lo que refuerza la tesis "el software detecta pero no previene". No es una decisión deliberada mal interpretada — el propio README mantiene el ciclo abierto "hasta que cierre" — y la severidad Alta/P1 es proporcionada: la plataforma misma lo trata como alerta crítica diaria a admin+manager. Única salvedad: el conteo vivo de negativos en Odoo hoy no es verificable desde el repo (el hallazgo ya lo marca como "Requiere validación" vía API/Odoo). · Evidencia re-vista: PLAN-ACCION-NEGATIVOS-2026-07-07.md:11-16,86-94; _archivo/README.md:52-54; proxy.js:6698-6746 (invWatchdog), proxy.js:6549 (invConciliar), proxy.js:6380-6420 (sección inventario-salud + seed 46 casos); MEMORIA-PROYECTO.md:211-216


## Hallazgo PR-02: Dependencia unipersonal estructural: deploy solo desde la máquina de Gabriel, consulta de datos solo por SQL directo, y conocimiento/decisiones en OneDrive personal

**Área:** L — Procesos reales frente al diseño

**Severidad:** Alta

**Estado:** Confirmado

**Componente afectado:** Proceso de deploy + gobernanza de conocimiento

**Evidencia encontrada:** CLAUDE.md: deploy 'vía CLI desde la raíz... CLI en C:\Users\Gabriel Ramirez\AppData\Roaming\npm\railway.cmd', 'GitHub... NO dispara deploys'; sin staging. Cerebro de agentes: 'C:\Users\Gabriel Ramirez\OneDrive\Documentos\Agentes-Estandar\' (CLAUDE.md, carpeta personal fuera del repo); las decisiones formales del go-live viven ahí (MEMORIA-PROYECTO.md:192 '_DECISIONES-DESPACHO-2026-06-20.md'). El visor de BD para admins se ELIMINÓ a pedido de Gabriel — 'las t_* de Fase 3B se consultan por SQL directo' (MEMORIA:21, commit 5275c3a): la única vía de consulta estructurada de datos es psql en manos del dev. 21 menciones de 'decisión Gabriel' entre proxy.js (11) e historial.html (10).

**Situación actual:** Para 1 dev + ~30 usuarios el deploy manual es razonable; lo que no es razonable es que sea IRREPRODUCIBLE por otra persona.

**Problema:** Si Gabriel no está disponible (vacaciones, enfermedad, salida), nadie puede deployar (el token/CLI viven en su máquina Windows), nadie puede consultar la BD (no hay visor ni runbook psql para terceros), y el contexto de decisiones de los agentes IA está en un OneDrive al que el equipo no necesariamente accede. El repo GitHub además puede quedar DETRÁS de producción por diseño (CLAUDE.md: '⚠️ Commitear SIEMPRE antes de deployar para que el repo no quede detrás' — la advertencia existe porque ocurrió).

**Práctica estándar de la industria:** Bus factor mínimo: runbook de deploy ejecutable por un tercero, credenciales en un lugar del equipo (no de la persona), y knowledge base en el repo o en un espacio compartido de la organización.

**Riesgo técnico:** Prod irreparable ante un bug crítico si la máquina de Gabriel no está disponible; divergencia repo↔prod no detectable por terceros.

**Riesgo para el negocio:** La plataforma es la columna operativa del almacén (gates de despacho, evidencia probatoria); su continuidad depende de una persona y una laptop.

**Causa raíz probable:** Crecimiento orgánico de proyecto personal a sistema de misión operativa sin formalizar la transición.

**Recomendación:** No cambiar el modelo (deploy manual deliberado está bien); cambiar su REPRODUCIBILIDAD. Ambos: software (runbook/CI opcional) y proceso (custodia de credenciales).

**Solución inmediata:** Runbook de deploy paso a paso (login Railway con token del equipo, railway up, verificación /api/health) probado por una segunda persona; export/copia del cerebro de agentes a un repo git de la organización.

**Solución definitiva:** Deploy reproducible desde CI opcional bajo aprobación manual (GitHub Action con gate manual — mantiene el control humano sin atar el deploy a una máquina), y una vía de consulta de datos para no-desarrolladores (restaurar un visor mínimo de solo lectura o vistas SQL documentadas).

**Esfuerzo estimado:** Medio

**Prioridad:** P1

**Dependencias:** Cuenta Railway del equipo/token compartible; decisión sobre dónde vive el cerebro de agentes.

**Criterio de aceptación:** Una persona distinta de Gabriel ejecuta un deploy completo (o un simulacro) siguiendo solo el runbook; el cerebro de agentes es accesible por la organización.

**Cómo validar la corrección:** Simulacro de deploy por un tercero; verificar acceso del equipo a Agentes-Estandar.

**Verificación adversarial (PARCIAL):** El núcleo del hallazgo está vigente y hoy incluso reforzado: el deploy sigue atado a la máquina de Gabriel (CLAUDE.md:44-46, CLI en su ruta Windows, GitHub NO dispara deploys), el cerebro de agentes y las decisiones del go-live siguen en su OneDrive personal (CLAUDE.md:63,90; MEMORIA:192), y el visor de BD fue eliminado y ya está COMMITEADO en HEAD (5275c3a, v228: basedatos.html no existe ni en disco ni en git; CLAUDE.md:18 dice explícitamente que las t_* se consultan por SQL directo). Es PARCIAL por dos correcciones evidenciales: (1) las "21 menciones de 'decisión Gabriel'" no se reproducen — hoy son 7 exactas (5 proxy.js + 2 historial.html) o ~10 con variantes, cifra desactualizada tras la modularización que sacó ~4.800 líneas de historial.html; (2) el hallazgo omite dos mitigaciones existentes: RAILWAY.md (72 líneas) YA es un runbook de deploy paso a paso con comandos CLI completos y script de importación de env vars — la "solución inmediata" existe en parte, aunque sigue anclada a "esta máquina" de Gabriel y a su login/`.env` locales — y `.github/workflows/uptime.yml` da detección de caídas visible a terceros (issue + correo cada 5 min, independiente de su laptop), lo que matiza "prod no detectable por terceros" para el caso de caída (la divergencia repo↔prod sí sigue siendo indetectable). No confunde decisión deliberada con descuido: el propio hallazgo lo reconoce y ataca la reproducibilidad, no el modelo. Severidad Alta/P1 se sostiene: bus factor 1 sobre la columna operativa del almacén, con la única vía no-SQL de consulta de datos eliminada por decisión reciente. · Evidencia re-vista: CLAUDE.md:44-46 (railway.cmd en C:\Users\Gabriel Ramirez\...; "GitHub... NO dispara deploys"; "⚠️ Commitear SIEMPRE"); CLAUDE.md:18 ("visor 'Base de datos': ELIMINADO jul-2026 — las t_* ... se consultan por SQL directo"); CLAUDE.md:63,90 (cerebro en OneDrive personal); MEMORIA-PROYECTO.md:21 (eliminación a pedido de Gabriel, commit 5275c3a = HEAD v228, verificado con git show: historial.html -4851 líneas, basedatos.html ausente de git ls-files y del disco); MEMORIA-PROYECTO.md:192 (_DECISIONES-DESPACHO-2026-06-20.md en OneDrive); conteo real "decisión Gabriel": proxy.js 5 exactas/6 con variantes, historial.html 2/4, 0 en core.js e islas (no 11+10=21). Mitigaciones no citadas por el hallazgo: RAILWAY.md:1-72 (runbook CLI completo: login, init, volume, up, domain, import-railway-env.ps1) y .github/workflows/uptime.yml (ping /api/health cada 5 min, abre issue "WWP caído" con notificación por correo, sin depender de la máquina de Gabriel). Sin workflow de deploy en CI (solo uptime.yml).


## Hallazgo PR-03: Telemetría de control diseñada que nadie consume: out_gate_fail_open, dueDateAuto y el audit log no tienen lector humano

**Área:** L — Procesos reales frente al diseño

**Severidad:** Media

**Estado:** Confirmado

**Componente afectado:** proxy.js (audit log, gates) + frontend (sin visor)

**Evidencia encontrada:** proxy.js:13378 appendAuditLog('out_gate_fail_open',...) — grep de 'outGateFailOpen|out_gate_fail_open' en historial.html/core.js/islas: 0 resultados. proxy.js:12957 'dueDateAuto: _dueAuto || undefined // true = fecha puesta por el sistema (QW5)' — grep 'dueDateAuto' en historial.html/core.js: 0 resultados. WWP_AUDIT_FILE (proxy.js:3472) se escribe en 56 puntos (appendAuditLog) pero sus únicos lectores son utilidades internas (proxy.js:3504 recuperación de títulos, 14886/15451 contexto del auditor IA): no existe GET /api/wwp/audit ni pantalla de auditoría.

**Situación actual:** El patrón se repite en el fail-open del pick-gate (proxy.js:13419-13424: 'Log pero no bloquea si falla la llamada a Odoo' + notifyAdminSyncError): el control compensatorio diseñado es 'alguien revisa después', pero ese alguien y ese después no existen como proceso.

**Problema:** QW4 se diseñó para que el fail-open del OUT-gate fuera 'visible y medible para el dashboard OUT-cierre' (AUDITORIA-WWP-2026-07-06.md:131) y QW5 para que 'la analítica distinga fecha puesta por sistema vs por humano' (línea 132). Ambas señales se capturan pero ningún dashboard, endpoint de lectura ni proceso las consume: la divergencia WWP↔Odoo sigue siendo invisible en la práctica, solo que ahora está grabada. Lo mismo aplica a impersonate_start, password_reset_requested y el resto del audit log.

**Práctica estándar de la industria:** Todo control fail-open necesita un lazo de revisión definido (quién, cada cuánto, con qué vista); telemetría sin consumidor es costo sin control.

**Riesgo técnico:** Validaciones que pasaron con Odoo caído nunca se re-verifican; el campo task.outGateFailOpen queda como fósil en la tarea.

**Riesgo para el negocio:** Despachos validados sin comprobar el OUT en Odoo pueden acumular divergencia de inventario/facturación sin que nadie lo note hasta la próxima auditoría manual (exactamente el patrón que produjo los 46 negativos).

**Causa raíz probable:** Los quick-wins de la auditoría 6-jul cerraron la mitad instrumentación pero la mitad consumo (dashboard OUT-cierre, analítica) quedó como backlog implícito sin ítem propio; no hay dueño del proceso de revisión.

**Recomendación:** Cerrar el lazo de consumo de las señales ya capturadas (esfuerzo bajo: los datos existen); cambiar software Y proceso.

**Solución inmediata:** Exponer un contador en /api/health?deep=true (fail-opens últimos 7 días, tareas con outGateFailOpen sin re-verificar) y definir la regla de proceso: el admin lo revisa en el cierre semanal.

**Solución definitiva:** Mini-panel admin 'Eventos de control' que lea el audit log filtrado (out_gate_fail_open, impersonate_start, password_reset_requested, geo_evidencia_lejos) + job que re-verifique contra Odoo las tareas con outGateFailOpen cuando Odoo vuelva (el mecanismo out-recon proxy.js:6327 ya existe como precedente).

**Esfuerzo estimado:** Bajo

**Prioridad:** P2

**Dependencias:** Ninguna técnica; requiere decisión de Gabriel sobre el dueño del ritual de revisión.

**Criterio de aceptación:** Existe una vista (o consulta SQL documentada en runbook) de eventos de control, y un proceso escrito de quién la revisa y con qué frecuencia; toda tarea con outGateFailOpen termina re-verificada o justificada.

**Cómo validar la corrección:** SELECT event, count(*) FROM t_wwp_audit WHERE event='out_gate_fail_open' GROUP BY 1; preguntar a Gabriel cuándo fue la última vez que alguien miró esos eventos.

**Verificación adversarial (PARCIAL):** La evidencia citada reproduce exacta hoy (out_gate_fail_open en proxy.js:13378, dueDateAuto en 12957 sin ningún lector, WWP_AUDIT_FILE en 3472, cero consumidores frontend de outGateFailOpen/dueDateAuto, sin GET /api/wwp/audit), pero el hallazgo omite tres controles compensatorios que debilitan su tesis central de "divergencia invisible": (a) cada fail-open dispara notifyAdminSyncError con notificación in-app en tiempo real a todos los admins (proxy.js:13314/13379/13422→6054); (b) el fail-open deja outPendiente.outState≠'done', que SÍ tiene consumo completo — chip "OUT pendiente" en tarjetas/kanban (historial.html:10630/10794), panel del drawer (11276/11288), flag 'outpend' en Estado de Órdenes (30943/31090) — y el job reconcileOutPendiente (proxy.js:6329, cada 10 min) re-verifica contra Odoo cuando vuelve y cierra el estado, refutando el riesgo técnico de que "nunca se re-verifican" (solo el marcador outGateFailOpen queda fósil); (c) el audit log SÍ tiene un lector humano: el panel Auditor de Procesos renderiza "Cambios detectados" con los últimos 25 eventos (proxy.js:14899/15430 → historial.html:16712-16715/16773), aunque sin filtro y con ventana tan corta que eventos raros (impersonate_start, password_reset_requested) se pierden — como lazo de control es débil pero existe. Queda vigente el núcleo: dueDateAuto es un fósil puro (escrito, jamás leído en ningún archivo), task.outGateFailOpen nunca se lee, no hay vista filtrada de eventos de control ni proceso escrito de revisión, y el visor Base de datos fue ELIMINADO en v228 (commit 5275c3a), cerrando incluso la vía SQL ad-hoc dentro de la app. Con el lazo OUT realmente cerrado por recon+badges, el residuo es telemetría sin consumidor + gap de proceso para 1 dev/~30 usuarios: Media/P2, no Alta/P1. · Evidencia re-vista: proxy.js:13378 (appendAuditLog 'out_gate_fail_open'), proxy.js:12957 (dueDateAuto, únicas 2 apariciones en el repo: comentario 12920 + escritura), proxy.js:3472/3504/14886/15451 (WWP_AUDIT_FILE y sus lectores), proxy.js:6329-6378 (reconcileOutPendiente, setInterval 10 min, re-verifica OUT contra Odoo), proxy.js:6054 (notifyAdminSyncError → notif in-app a admins, invocado en 13314/13379/13422), historial.html:10630/11288/30943/31090 (chip y flag "OUT pendiente en Odoo" visibles), historial.html:16712-16715 y 16773 (panel Auditor renderiza últimos 25 eventos del audit log vía proxy.js:15430), git log 5275c3a (visor Base de datos eliminado v228), grep outGateFailOpen/dueDateAuto en todo el frontend: 0 resultados


## Hallazgo PR-04: El historial de cumplimiento del tab Políticas muestra datos FABRICADOS (seed mock) en producción

**Área:** L — Procesos reales frente al diseño

**Severidad:** Media

**Estado:** Confirmado

**Componente afectado:** politicas.html (isla, ex historial.html)

**Evidencia encontrada:** politicas.html:527 'var seed = _POL_MOCK_SEED[emp.id] || _POL_MOCK_SEED.m1' dentro de polLoadHistory — el heatmap 'Historial de Cumplimiento' (✓/✗ por empleado por día, con % de cumplimiento) se genera SIEMPRE desde la semilla mock, aun con POL_USE_MOCK=false (línea 173 '✅ PRODUCCIÓN: desactivado', que solo afecta los datos en vivo). MEMORIA-PROYECTO.md:227 lo admite: 'Historial de políticas sigue siendo client-side (mock seed) — mejora futura'.

**Situación actual:** El tab acaba de repararse (v219) y ganó visibilidad; el riesgo de que alguien tome el heatmap como real subió.

**Problema:** Un admin que use el botón 'Consultar' del historial ve una matriz plausible de cumplimiento/incumplimiento POR EMPLEADO Y POR DÍA que es ruido determinístico, sin ningún aviso de que esa sección específica es demo (el aviso pol-mock-notice solo aparece cuando POL_USE_MOCK=true).

**Práctica estándar de la industria:** Datos simulados jamás se pintan en una vista de producción sin marca DEMO inequívoca, menos aún datos disciplinarios por persona.

**Riesgo técnico:** Ninguno (client-side).

**Riesgo para el negocio:** Decisión disciplinaria o evaluación de un empleado basada en incumplimientos inventados: riesgo laboral/reputacional directo en una empresa real con 29 usuarios identificables por nombre.

**Causa raíz probable:** El módulo se portó de un mockup y el historial quedó como resto del demo; al reparar el endpoint (v219) nadie desactivó la sección fabricada.

**Recomendación:** Fix inmediato de bajo esfuerzo; es el hallazgo con peor relación visibilidad/veracidad del sistema.

**Solución inmediata:** Ocultar o deshabilitar el bloque 'Historial de Cumplimiento' (o pintarle un banner 'DATOS DEMO — no usar para decisiones') — cambio de ~5 líneas en politicas.html.

**Solución definitiva:** Historial real server-side derivado de las fuentes que ya existen (breaks, tareas, inspecciones — el propio _polCtxData ya las carga para el estado en vivo), o retirar la sección si nadie la necesita.

**Esfuerzo estimado:** Bajo

**Prioridad:** P2

**Dependencias:** Decisión de Gabriel sobre si el historial de políticas es una necesidad real.

**Criterio de aceptación:** Ninguna vista de producción muestra datos por empleado que no provengan del servidor.

**Cómo validar la corrección:** Login admin → Tareas → Políticas → Consultar historial con rango de fechas: hoy pinta ✓/✗ deterministas de _POL_MOCK_SEED; tras el fix, o no existe o muestra datos reales.

**Verificación adversarial (PARCIAL):** El núcleo es vigente y reproducible hoy: polLoadHistory (politicas.html:514-537) y polExportCSV (571-595) generan SIEMPRE el historial desde _POL_MOCK_SEED aun con POL_USE_MOCK=false, y _polGetEmployees (347-351) aporta los nombres reales de /api/wwp/auth/users — todos caen al fallback m1, así que se pintan ✓/✗ fabricados por empleado real y hasta se exportan a CSV; no existe ningún fix en el repo. Pero dos sub-afirmaciones son incorrectas: el banner #pol-mock-notice (líneas 110-112) NO está condicionado a POL_USE_MOCK — es HTML estático sin toggle en ningún script, siempre visible en el tab con "Modo demo: Datos de empleados simulados" (aviso débil y con texto obsoleto, pero existe); y como todos los empleados comparten la semilla m1, todas las filas del heatmap son idénticas (% diario solo 100%/0%), lo que hace la fabricación evidente a simple vista. Con aviso presente, patrón conspicuo, y deuda documentada en MEMORIA-PROYECTO.md:227, la probabilidad de una decisión disciplinaria real basada en esto baja: ajusto a Media/P2, manteniendo el fix trivial recomendado. · Evidencia re-vista: politicas.html:527 y 582 (seed mock en historial y CSV), 173 (POL_USE_MOCK=false), 347-351 (_polGetEmployees devuelve usuarios reales), 110-112 (banner demo estático siempre visible, sin JS que lo oculte), MEMORIA-PROYECTO.md:227


## Hallazgo PR-05: Cierre del lazo WWP→Odoo sigue manual: la nota de crédito por rechazos (D3) nunca se implementó y el endpoint sync-to-odoo está muerto y con un antipatrón peligroso

**Área:** L — Procesos reales frente al diseño

**Severidad:** Media

**Estado:** Confirmado

**Componente afectado:** proxy.js:19409-19498 + proceso Odoo

**Evidencia encontrada:** D3 del plan go-live (MEMORIA-PROYECTO.md:169-172: panel 'Sincronizar a Odoo' + 'Generar nota de crédito' abriendo Odoo pre-rellenado): grep de 'account.move|nota de crédito|credit' en proxy.js e historial.html = 0 implementación. POST /api/sdv/sync-to-odoo existe (proxy.js:19412) pero grep -rln 'sync-to-odoo' en todo el repo solo da proxy.js y el doc de auditoría: CERO llamadores de frontend. Además escribe el estado directo: proxy.js:19483 "odooCall('stock.picking','write',[[picking.id],{state:'done'}])".

**Situación actual:** El OUT-gate + out-recon (proxy.js:6327) cubren la dirección Odoo→verificación; la dirección WWP→Odoo (rechazos, devoluciones parciales) es manual por decisión ('OPCIÓN C híbrido NO automático') pero ni siquiera el híbrido (panel pre-rellenado) existe.

**Problema:** Dos huecos de proceso: (1) los artículos rechazados/averiados en el despacho se capturan en WWP pero su efecto contable (nota de crédito) exige que alguien lo digite a mano en Odoo, sin recordatorio ni verificación — doble digitación con riesgo de omisión (F1 de AUDITORIA-WWP:96 sigue vigente); (2) el endpoint que marcaría el OUT como done desde WWP quedó huérfano — el proceso real es que el encargado valida el OUT a mano en Odoo y WWP solo lo verifica con el OUT-gate, lo cual está BIEN, pero el código muerto es una mina: escribir state='done' por ORM write NO procesa los stock.moves (a diferencia de button_validate) y si alguien lo cablea produciría exactamente los desajustes de quants que la empresa está corrigiendo a mano.

**Práctica estándar de la industria:** Si el efecto contable de un evento capturado digitalmente depende de re-digitación manual, debe existir al menos una bandeja de pendientes que no deje olvidar ninguno.

**Riesgo técnico:** Código muerto con write directo de estado en el ERP, invocable por admin/manager con un curl.

**Riesgo para el negocio:** Rechazos sin nota de crédito = facturación incorrecta silenciosa; sin lista de pendientes nadie sabe cuántos rechazos esperan su asiento en Odoo.

**Causa raíz probable:** D3 se pospuso a Fase 2 del go-live y nunca se retomó; sync-to-odoo fue un bloqueador (B3) implementado server-side que la evolución del proceso (validación manual del OUT + OUT-gate) dejó huérfano.

**Recomendación:** Cambiar ambos: software (matar la mina + bandeja) y proceso (dueño del asiento).

**Solución inmediata:** Eliminar o desactivar (patrón if(false && …) de los /api/_fix/*) el endpoint sync-to-odoo; listar en el dashboard OUT-cierre las tareas completadas con items rechazados/averiados sin marca de 'nota de crédito hecha'.

**Solución definitiva:** Implementar el D3 híbrido original: panel con botón que abra Odoo pre-rellenado + checkbox 'asiento registrado' auditado, sin automatizar el asiento.

**Esfuerzo estimado:** Medio

**Prioridad:** P2

**Dependencias:** Ninguna técnica; decisión de Gabriel de retomar D3.

**Criterio de aceptación:** sync-to-odoo eliminado/desactivado; existe una vista de rechazos pendientes de asiento con conteo en cero al cierre semanal.

**Cómo validar la corrección:** grep sync-to-odoo (debe estar desactivado); revisar con Pit cuántos rechazos del último mes tienen nota de crédito en Odoo.


## Hallazgo PR-06: Dashboard de Ventas por Google Sheets (Modo B) desmantelado sin destino documentado y con documentación contradictoria el mismo día

**Área:** L — Procesos reales frente al diseño

**Severidad:** Media

**Estado:** Confirmado

**Componente afectado:** index.html + RAILWAY.md + MEMORIA-PROYECTO.md + GitHub Pages

**Evidencia encontrada:** index.html (1.448 bytes, hoy un stub): 'La integración con Google Sheets fue eliminada. Este tablero ya no consume datos de la hoja publicada' (líneas 26-28, commit 6ad7dfa del 22-jul). historial.html:5809 'CONTENEDORES — sección eliminada (integración Google Sheets removida, jul-2026 R-06D)'. proxy.js:8587-8589: '/api/sheets — ELIMINADO... El 404 es intencional'. PERO: RAILWAY.md:19-20 aún lista CONT_SHEETS_ID/CONT_SHEETS_GID como variables requeridas; MEMORIA-PROYECTO.md:13 (actualizada el MISMO 22-jul) aún afirma que GitHub Pages 'publica SOLO el dashboard index.html en Modo B (CSV de Google Sheets)... NO es fósil; se mantiene casi en sync con master'; y git ls-remote origin muestra que la rama gh-pages NO existe en el remoto (solo master y refs/pull/1).

**Situación actual:** El historial git muestra que el dashboard de Ventas fue un canal deliberado y mantenido ('Dashboard Ventas: use gh-pages index.html with Vista Agrupada sections'), no un experimento.

**Problema:** Un canal de información completo para Ventas (contenedores + dashboard sin login) desapareció del sistema y ningún documento dice qué lo reemplaza: si la hoja de Google Sheets sigue viva y alimentada a mano, el proceso paralelo fuera del sistema CONTINÚA pero ya sin espejo en la app; si murió, ¿de dónde saca Ventas hoy la visibilidad de contenedores? La documentación operativa (RAILWAY.md, MEMORIA) contradice el estado real del repo el mismo día del cambio.

**Práctica estándar de la industria:** Retirar un canal de información requiere documentar el reemplazo y comunicarlo a sus consumidores; los docs de deploy deben reflejar las env vars reales.

**Riesgo técnico:** Deploy nuevo siguiendo RAILWAY.md configuraría variables muertas; la ausencia de gh-pages en el remoto sugiere que el sitio de Pages puede estar roto o sirviendo contenido huérfano no versionado.

**Riesgo para el negocio:** Ventas puede seguir consultando una hoja de Sheets que ya nadie reconcilia con la app (dos verdades), o haberse quedado sin visibilidad y estar improvisando por WhatsApp/Excel.

**Causa raíz probable:** R-06D se ejecutó como fix de seguridad (cerrar fugas) sin cerrar el ciclo de proceso del canal que alimentaba.

**Recomendación:** Cambiar ambos: docs (software) y cierre del canal con sus usuarios (proceso).

**Solución inmediata:** Actualizar RAILWAY.md (quitar CONT_SHEETS_*) y MEMORIA (párrafo Modo B); preguntar a Ventas qué usan hoy.

**Solución definitiva:** Decisión explícita: o el portal SDV + Estado de Órdenes cubren la necesidad de Ventas (y se documenta), o se construye la vista de contenedores desde Odoo (el import por transferencia interna ya existe, historial.html:6396) y se retira la hoja.

**Esfuerzo estimado:** Bajo

**Prioridad:** P2

**Dependencias:** Confirmación con el equipo de Ventas; acceso a la configuración de GitHub Pages.

**Criterio de aceptación:** Docs coherentes con el repo; declaración escrita de cuál es la fuente de visibilidad de Ventas.

**Cómo validar la corrección:** Abrir altritempisrl.github.io/OpsAT (¿qué sirve hoy?); preguntar a Ventas; verificar si la hoja CONT_SHEETS sigue editándose.


## Hallazgo PR-07: La producción anterior (Render) sigue viva con datos congelados y redeploy automático desde GitHub: dos 'producciones' simultáneas

**Área:** L — Procesos reales frente al diseño

**Severidad:** Media

**Estado:** Confirmado

**Componente afectado:** render.yaml + proceso de deploy

**Evidencia encontrada:** render.yaml presente en la raíz (startCommand 'node proxy.js', plan starter 'never sleeps'); _archivo/README.md:51-52: 'Render sigue VIVO como respaldo (health 200 verificado 2026-07-22) y redeploya desde GitHub'; CLAUDE.md: 'Render... fue la producción anterior — ya NO aplicar cambios ahí'.

**Situación actual:** El equipo lo considera respaldo deliberado; el valor real de ese respaldo (datos de hace un mes, código auto-actualizado sin pruebas) es dudoso frente a su riesgo de confusión.

**Problema:** dashboard-despachos.onrender.com responde login real con el disco /data que quedó congelado en jun-2026. Como Render SÍ auto-deploya desde GitHub master y Railway se deploya a mano, las dos instancias corren versiones distintas del código en momentos distintos, sobre datos distintos. Un usuario con la URL vieja guardada puede loguearse, crear tareas y subir evidencia a un universo paralelo sin que nadie lo note (last-write a un DATA_DIR que nadie mira). Además Render arranca con node proxy.js: si algún día se le definiera DATABASE_URL, el guard de boot.js lo tumbaría — el 'fallback' no está probado contra la arquitectura actual (tablas tipadas, R2).

**Práctica estándar de la industria:** Un entorno legado accesible con credenciales reales o se congela en modo solo-lectura/redirect, o se apaga; nunca queda en login abierto con auto-deploy.

**Riesgo técnico:** Split-brain de datos; deploy automático no verificado en una instancia que nadie monitorea.

**Riesgo para el negocio:** Trabajo operativo real perdido en la instancia fantasma; confusión de usuarios ('mis tareas desaparecieron').

**Causa raíz probable:** La migración a Railway (jun-2026) dejó Render como red de seguridad y nunca se cerró el ciclo.

**Recomendación:** Cambiar ambos: configuración (software) y decisión de contingencia (proceso).

**Solución inmediata:** Configurar Render para responder 302 a opsat.up.railway.app (o suspender el servicio tras verificar que sus datos ya no tienen valor).

**Solución definitiva:** Retirar render.yaml del repo (o marcarlo explícitamente como redirect-only) y documentar cuál es la estrategia real de contingencia (los respaldos horarios + rollback por env var de PG ya la cubren mejor).

**Esfuerzo estimado:** Bajo

**Prioridad:** P2

**Dependencias:** Verificar que ningún flujo (bookmarks de usuarios, uptime checks) apunte aún a Render.

**Criterio de aceptación:** Ningún login posible en el dominio de Render; docs sin ambigüedad de cuál es LA producción.

**Cómo validar la corrección:** curl https://dashboard-despachos.onrender.com/historial.html (debe redirigir o estar caído); revisar logs de Render por accesos recientes.


## Hallazgo PR-08: Tab Políticas estuvo roto en producción durante toda la era Node sin que ningún usuario lo reportara: señal de funcionalidad sin uso real

**Área:** L — Procesos reales frente al diseño

**Severidad:** Media

**Estado:** Confirmado

**Componente afectado:** politicas.html / proceso de adopción de módulos

**Evidencia encontrada:** MEMORIA-PROYECTO.md:227: '/api/politicas implementado en proxy.js... el tab Políticas (admin) llamaba a este endpoint y NUNCA existió en la era Node — el tab estaba roto en producción'. _archivo/README.md:28-31 lo detectó el 8-jul como 'hallazgo colateral'; se reparó recién en v219 (22-jul). El endpoint hoy existe (proxy.js:9994/10001).

**Situación actual:** La poda v219 fue la respuesta correcta para lo confirmado muerto; Políticas se decidió reparar en vez de podar, pero sin evidencia documentada de demanda.

**Problema:** Un módulo visible para admins falló silenciosamente durante semanas/meses y nadie lo notó ni lo reportó: la evidencia más fuerte disponible de que no formaba parte del proceso real de nadie. Repararlo sin asignarle dueño ni caso de uso repite el ciclo (y ahora con el historial mock del hallazgo H3 encima). El mismo patrón aplicó a los Reportes Operacionales y al Modo Guiado, ya podados en v219 tras confirmarse muertos (MEMORIA:219-226).

**Práctica estándar de la industria:** Cada módulo en producción necesita un dueño funcional y una señal de uso; reparar sin dueño produce shelf-ware mantenido.

**Riesgo técnico:** Superficie de mantenimiento y de bugs (ya demostrado) para código sin usuarios.

**Riesgo para el negocio:** Esfuerzo del único dev invertido en módulos que la operación no usa, mientras el backlog operativo real (negativos, R0a-R10) espera.

**Causa raíz probable:** Los módulos nacen de mockups/ideas sin ritual de verificación de adopción posterior.

**Recomendación:** Cambiar proceso (gobernanza de features); software solo si se decide ocultar.

**Solución inmediata:** Preguntar a los 2-3 admins si usan Políticas y para qué; si nadie, ocultar el tab (no borrar).

**Solución definitiva:** Ritual ligero de adopción: al mes de cada módulo nuevo, revisar señal de uso (bastaría un contador de vistas en el audit log, que ya existe como mecanismo) y decidir mantener/podar.

**Esfuerzo estimado:** Bajo

**Prioridad:** P2

**Dependencias:** Ninguna.

**Criterio de aceptación:** Políticas tiene dueño y uso registrado, o está oculto.

**Cómo validar la corrección:** Contador de accesos al tab tras 2 semanas; entrevista corta a admins.


## Hallazgo PR-09: Cierre diario existe pero no es obligatorio ni tiene recordatorio, y el handoff auxiliar→encargado sigue sin acuse de recibo (R4/R5 abiertos)

**Área:** L — Procesos reales frente al diseño

**Severidad:** Media

**Estado:** Confirmado

**Componente afectado:** proxy.js daily-close + proceso de cierre

**Evidencia encontrada:** Endpoints completos /api/wwp/daily-close/* (proxy.js:14152-14229) pero grep de un scheduler/recordatorio de cierre = 0 (el único setInterval diario relacionado es checkDueTodayAlert, proxy.js:6277/6315, que alerta vencimientos, no cierres). AUDITORIA-WWP-2026-07-06.md:101-102: 'El cierre diario existe pero no es obligatorio ni tiene recordatorio (scheduler apagado esperando OK)'; R4/R5 (líneas 160-161) siguen en backlog sin marca de hechos en ningún doc posterior.

**Situación actual:** El scheduler está 'esperando OK' desde el 6-jul — otra decisión en la cola de Gabriel.

**Problema:** El mecanismo de accountability diario que el propio equipo diseñó (resumen individual/equipo + respuesta del encargado) depende de que cada quien se acuerde de usarlo; sin recordatorio ni obligatoriedad, lo esperable es adopción parcial o nula (no verificable sin datos: cuántos daily-close reales hay en wwp-daily-close). El handoff 'Terminé mi parte' (auxDone, proxy.js:18310-18328) sigue unilateral: el auxiliar marca y nadie confirma recepción.

**Práctica estándar de la industria:** Un cierre diario sin recordatorio ni consecuencia no es un control, es un formulario opcional.

**Riesgo técnico:** Ninguno.

**Riesgo para el negocio:** Sin cierre diario efectivo no hay corte formal de responsabilidad por turno: las discrepancias (tareas a medias, evidencia faltante) se descubren días después.

**Causa raíz probable:** El interruptor del recordatorio quedó atado a un OK pendiente; R4/R5 compiten con el resto del backlog por la atención del único dev.

**Recomendación:** Cambiar ambos: encender el software ya escrito y definir la expectativa de proceso.

**Solución inmediata:** Consultar cuántos registros reales tiene la colección daily-close del último mes (t_wwp_daily_close) para dimensionar la adopción; si es baja, decidir encender el recordatorio (el código de notificaciones ya existe).

**Solución definitiva:** R4 (recordatorio diario + obligatoriedad suave: aviso al encargado por auxiliar sin cierre) y R5 (mgr-acknowledge) del backlog priorizado.

**Esfuerzo estimado:** Medio

**Prioridad:** P2

**Dependencias:** OK de Gabriel; NOTIF_META ya soporta el patrón.

**Criterio de aceptación:** >80% de auxiliares activos con cierre registrado por día laboral durante 2 semanas.

**Cómo validar la corrección:** SELECT count(*) FROM t_wwp_daily_close agrupado por fecha; comparar contra usuarios activos por día.


## Hallazgo PR-10: Cola de decisiones pendientes concentrada en Gabriel sin sistema de seguimiento: B5, las 5 decisiones de negativos, R-08, tamaño del volumen, backlog R0a-R10

**Área:** L — Procesos reales frente al diseño

**Severidad:** Media

**Estado:** Confirmado

**Componente afectado:** Gobernanza / proceso de decisión

**Evidencia encontrada:** docs/auditoria-arquitectura/07:82-84 'Decisión explícita sobre B5: ¿OpsAT será multi-instancia alguna vez?... documentarlo' (sin documento de decisión en el repo); PLAN-ACCION-NEGATIVOS:86-94 tabla de 5 decisiones 'que necesita tomar Gabriel' (solo la #3 tiene evidencia de resolución); AUDITORIA-WWP:143-146 'Acción manual complementaria (Gabriel): confirmar tamaño del volumen' — replicada como pendiente en 06-preguntas:58; MEMORIA:205 'Pendiente manual (Gabriel)'. La memoria persistente del propio asistente lista 'falta: ... decisión B5' como pendiente arrastrado.

**Situación actual:** Con un solo decisor el cuello es inevitable; lo evitable es la invisibilidad de la cola.

**Problema:** Las decisiones se piden por escrito en documentos dispersos (planes, auditorías, memoria) y no hay un lugar único donde se vea qué está decidido, qué espera, y desde cuándo: los quick-wins del 6-jul esperaron ~16 días su deploy (llegaron a prod arrastrados por la Fase 3B del 22-jul), las decisiones de negativos llevan 15+ días sin resolución visible, y B5 condiciona la arquitectura futura (07: 'si NO... B5/B12/B13 bajan a by design'). Irónicamente, el sistema que la empresa usa para gestionar tareas no se usa para gestionar las decisiones del propio sistema.

**Práctica estándar de la industria:** Registro de decisiones (ADR ligero o tabla única DECISIONES.md) con fecha de pedido, decisión y fecha de resolución.

**Riesgo técnico:** Trabajo técnico bloqueado o hecho dos veces (auditorías re-verificando pendientes viejos).

**Riesgo para el negocio:** Riesgos conocidos y aceptados tácitamente en vez de explícitamente (el peor modo de aceptar un riesgo).

**Causa raíz probable:** Cada sesión de trabajo/agente deja sus pendientes en su propio documento; nadie consolida.

**Recomendación:** Cambiar proceso (es puro proceso, costo casi cero).

**Solución inmediata:** Crear DECISIONES.md en la raíz consolidando las abiertas de hoy (B5, negativos 1/2/4/5, R-08, R0a residual, destino de Render, destino de Ventas/Sheets) con una línea cada una.

**Solución definitiva:** Regla de proceso: todo documento nuevo que pida una decisión la registra también en DECISIONES.md; revisarlo en el cierre semanal.

**Esfuerzo estimado:** Bajo

**Prioridad:** P2

**Dependencias:** Ninguna.

**Criterio de aceptación:** Una sola fuente lista todas las decisiones abiertas con fecha; ninguna pendiente >30 días sin al menos un 'pospuesto conscientemente'.

**Cómo validar la corrección:** Existencia y frescura del registro; cruzar contra los pendientes citados en esta auditoría.


## Hallazgo PR-11: Registro tardío de evidencia es posible sin señal: las fotos se pueden subir a tareas ya completadas/validadas y el autor es spoofeable

**Área:** L — Procesos reales frente al diseño

**Severidad:** Baja

**Estado:** Confirmado

**Componente afectado:** proxy.js endpoints de fotos

**Evidencia encontrada:** POST /api/wwp/tasks/:id/fotos-(entrega|vehiculo|recepcion) (proxy.js:19200-19230) no valida el status de la tarea: acepta subidas con la tarea en completed/validated. La entrada registra '{ by: d.by||_jpFc.name..., at: ... }' (19218): el 'by' del body PISA al del JWT. El gate de completar sí exige las 3 fotos ANTES (13236), lo cual está bien.

**Situación actual:** Con 29 usuarios de confianza el riesgo es bajo; el valor probatorio de la evidencia (disputas con clientes) es justo lo que motivó F0, y ese valor depende de la integridad temporal/autoral.

**Problema:** El diseño dice 'evidencia en el momento del despacho'; la práctica permite completar el checklist mínimo, y añadir/reemplazar evidencia después del hecho sin que ninguna marca lo distinga (el 'at' queda grabado — es detectable por análisis — pero nada lo señala ni lo impide, y el autor puede falsearse desde el cliente). El campo uploadedBy normalizado que pedía R8/F4 (AUDITORIA:115) sigue sin existir en el resto de evidencias.

**Práctica estándar de la industria:** Evidencia probatoria: autor siempre del token, timestamp del servidor, y marca visible si se agregó después del cierre.

**Riesgo técnico:** Ninguno estructural.

**Riesgo para el negocio:** En una disputa de entrega, evidencia agregada días después con autor falseable debilita la posición de la empresa.

**Causa raíz probable:** Los endpoints de fotos se construyeron para flexibilidad operativa (subir desde cualquier estado) sin distinguir el caso post-cierre.

**Recomendación:** Cambiar software; el proceso (permitir subir tarde) puede quedarse, pero señalizado.

**Solución inmediata:** Usar SIEMPRE jp.name (ignorar d.by) — 1 línea por endpoint.

**Solución definitiva:** Flag lateUpload:true cuando status ∈ {completed, validated} al subir, visible en el drawer; completar R8 (uploadedBy/startedAt/cancelReason).

**Esfuerzo estimado:** Bajo

**Prioridad:** P2

**Dependencias:** Ninguna.

**Criterio de aceptación:** Toda foto lleva autor derivado del JWT; las subidas post-cierre quedan marcadas y visibles.

**Cómo validar la corrección:** curl con body {by:'otro'} debe registrar el nombre del token; subir foto a tarea validada debe marcar lateUpload.


