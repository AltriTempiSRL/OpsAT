# Plan de Gestión del Cambio — Adopción de Workforce Platform (WWP)

**Altri Tempi · Operaciones de Almacén, Picking, Empaque y Despacho**
**Autor:** Pit (gerente de operaciones) · **Para:** Gabriel Sánchez (dirección de operaciones)
**Versión:** 1.0 · **Fecha:** 2026-06-14 · **Estado:** propuesta para aprobación de dirección

---

## Resumen ejecutivo

WWP no fracasará por la tecnología; fracasará —si fracasa— por la **adopción humana**. (Juicio, basado en el estándar de transformación digital: el éxito se mide por uso real, no por features entregadas.) El cambio de fondo no es "usar una app": es que **la operación pasa de gobernarse por opinión y memoria a gobernarse por dato y evidencia**, y eso redistribuye quién tiene razón en una discusión. Esa es la causa raíz de la resistencia (5 porqués, §1). Este plan ataca **8 miedos concretos** con antídotos concretos, **segmenta** al personal en 4 grupos para no tratar igual al campeón y al resistente, ancla la evaluación en **6 KPIs objetivos** para que el desempeño se mida con dato y no "a apreciación", y propone un **proceso de consecuencias por etapas (E0-E5)** que separa *"no puede"* (capacitar) de *"no quiere"* (gestionar) — más efectivo y más defendible que el "adóptate o vete" en seco. Cierra con timeline, gobernanza reutilizable, los riesgos del propio plan y **4 decisiones** que requieren a Gabriel. **Hecho vs juicio:** los miedos y la causa raíz son lectura profesional del terreno; las metas numéricas son propuestas a calibrar contra la línea base real medida en WWP antes del go-live.

---

## 1. Diagnóstico no-genérico: los 8 miedos reales y su antídoto

Un plan de cambio genérico habla de "resistencia" en abstracto. La resistencia no es abstracta: es un conjunto de **miedos específicos y racionales** desde la silla de quien hace el trabajo. Si no se nombran, no se desarman. Abajo, los 8 que veo en esta operación, cada uno con su antídoto operativo (qué hacemos, no qué decimos).

| # | Miedo (lo que la persona piensa, aunque no lo diga) | Antídoto concreto |
|---|---|---|
| **M1** | *"Me van a vigilar. Cada foto y cada timestamp es para fiscalizarme."* | Reencuadre verificable: WWP **protege** al que trabaja bien. La evidencia es su coartada ante un reclamo ("yo lo entregué sano, aquí está la foto"). Política explícita y por escrito: la evidencia se usa primero para **defender al operario y resolver el caso**, no para castigar. Primer mes: cero sanciones por datos (ver E0, §4). |
| **M2** | *"Es más lento. Antes terminaba; ahora pierdo tiempo tomando fotos y llenando campos."* | Medir el costo real de captura (segundos por tarea) y **diseñarlo para que sea mínimo** (foto desde el móvil, campos por defecto, menos toques — derivar a Mark). Mostrar el **ahorro al otro lado**: menos reprocesos, menos "¿dónde está esto?", menos discusiones. El tiempo no se pierde, se mueve aguas abajo. |
| **M3** | *"No sé usarlo. Voy a quedar en ridículo frente a los más jóvenes / frente al jefe."* | Capacitación por rol, en su idioma, en piso, no en aula. Material visual (guía de staff ya existe). **Buddy system**: cada persona con baja confianza digital tiene un campeón al lado la primera semana. Permitir equivocarse sin costo en E0. |
| **M4** | *"Esto expone mis errores. Antes un fallo se diluía; ahora queda registrado con mi nombre."* | Separar **error de proceso** de **error de persona**: feedback al proceso, no a culpas. Los primeros datos se leen como diagnóstico del sistema, no como expediente individual. Comunicar: "buscamos dónde falla el flujo, no a quién colgar". |
| **M5** | *"Van a recortar gente. Si todo queda medido y digitalizado, sobra personal."* | Mensaje directo y honesto de dirección: el objetivo es **hacer más y mejor con el equipo actual** (más throughput, menos daño, menos reproceso), no reducir cabezas. Si esto es cierto —y debe serlo para decirlo—, nombrarlo explícitamente mata el rumor más tóxico. Si no fuese cierto, **no se promete**. |
| **M6** | *"Pierdo mi poder. Yo era el que sabía dónde estaba todo / cómo se hacía; ahora lo sabe el sistema."* | Reconvertir ese saber en **estatus dentro del nuevo sistema**: el que más sabe del piso es candidato natural a campeón, a validar SOPs, a entrenar. Su conocimiento no se borra, se **institucionaliza con su nombre**. (Este es el miedo de la causa raíz.) |
| **M7** | *"Es otra moda que pasará. Aguanto callado y en tres meses volvemos a WhatsApp."* | Patrocinio visible y **sostenido** de dirección (no un discurso de lanzamiento y silencio). Quick wins tempranos publicados. Cerrar los canales paralelos de forma progresiva pero firme: WhatsApp deja de ser sistema de registro. El cambio se vuelve irreversible por consistencia, no por decreto. |
| **M8** | *"Si el sistema se cae o se equivoca, me echan la culpa a mí."* | Plan de contingencia claro y comunicado: qué hacer si WWP falla, a quién se escala, cómo se registra después. La persona nunca queda atrapada entre "el sistema no me deja" y "tienes que entregar". Un **Andon** para bloqueos de sistema con responsable y tiempo de respuesta. |

### Causa raíz (5 porqués)

> **Síntoma:** hay resistencia a adoptar WWP.
> 1. ¿Por qué se resisten? — Porque sienten que pierden algo, no que ganan.
> 2. ¿Por qué sienten que pierden? — Porque su forma de trabajar (memoria, criterio propio, acuerdos verbales) deja de ser la válida.
> 3. ¿Por qué deja de ser válida? — Porque ahora la verdad operativa la fija el **dato registrado**, no la palabra de quien tiene más antigüedad o más voz.
> 4. ¿Por qué eso incomoda? — Porque **quien tenía autoridad por opinión/experiencia ve que la autoridad se desplaza al sistema y al que aporta evidencia**.
> 5. ¿Por qué es tan sensible? — Porque toca el **poder y el estatus**, no la comodidad. Es identidad, no UX.

**Causa raíz (juicio profesional):** *el cambio redistribuye el poder de la opinión al dato.* Quien mandaba en una discusión por antigüedad o por volumen de voz, ahora compite con un timestamp y una foto. Por eso un plan que solo da capacitación (ataca el "no sé") y no toca el estatus (el "no quiero perder poder") deja intacta la resistencia más dura. Este plan trabaja **ambas capas**: la de capacidad (M3) y la de poder (M6), y por eso la segmentación y el proceso por etapas tratan distinto al que *no puede* y al que *no quiere*.

---

## 2. Segmentación: a quién mover y cómo

**Tesis (juicio):** el éxito del cambio **no** está en convencer a los resistentes activos ni en premiar a los campeones —esos dos extremos ya están decididos—. Está en **mover a la mayoría movible (~70%)**, que observa, copia lo que ve premiado y se inclina hacia donde sople el viento. A ese grupo se le dedica el grueso de la energía.

| Grupo | % aprox. | Cómo se reconoce | Estrategia diferenciada |
|---|---|---|---|
| **Campeones / early adopters** | ~10% | Ya prueban, preguntan, ayudan a otros sin que se lo pidan | **Darles rol y visibilidad.** Nombrarlos campeones, hacerlos co-autores de los SOPs, que entrenen. Su recompensa es estatus y reconocimiento público. Son el motor. |
| **Mayoría movible** | ~70% | Ni a favor ni en contra; esperan a ver qué pasa y qué conviene | **El foco del plan.** Se mueven con: ver al campeón reconocido, quick wins visibles, capacitación accesible, que adoptar sea claramente más fácil/seguro que resistir. Se inclinan hacia donde ven la recompensa. |
| **Resistentes pasivos** | ~15% | No confrontan; "se les olvida", lo hacen a medias, vuelven al método viejo en silencio | **Acompañamiento cercano + consecuencia suave y consistente.** Buddy, recordatorios, micro-metas. La consistencia (E1-E2) los arrastra; ceden cuando ven que el cambio no afloja y que la mayoría ya se movió. |
| **Resistentes activos** | ~5% | Critican abiertamente, siembran dudas, lideran el "esto no sirve" | **No gastar el grueso de energía en convencerlos; sí contener su influencia sobre la mayoría.** Conversación directa de dirección, expectativa explícita, proceso por etapas (E3-E5). Si tienen razón en algo puntual, se escucha; si solo bloquean, se gestiona con criterio (§4). |

### Herramienta: "Mapa de actitud"

Instrumento simple y reutilizable para no decidir por impresión. Se ubica a cada persona en una matriz de dos ejes:

- **Eje X — Capacidad / habilidad digital:** ¿*puede* usarlo? (baja → alta)
- **Eje Y — Disposición / actitud:** ¿*quiere* usarlo? (resistente → a favor)

```
   Disposición (¿quiere?)
        ▲
A FAVOR │  Entusiasta sin skill      │  CAMPEÓN
        │  → capacitar, es aliado     │  → darle rol y visibilidad
        │     rápido                   │
────────┼─────────────────────────────┼──────────────────────────►
        │  RESISTENTE + sin skill     │  Resistente CON skill
RESISTE │  → ¿es "no puede" o         │  → este es el de poder (M6):
        │    "no quiere"? E0 lo dice   │    reconvertir su saber en estatus
        ▼
            baja ◄─ Capacidad (¿puede?) ─► alta
```

**Para qué sirve:** distingue de un vistazo al que *no puede* (cuadrantes izquierdos → **capacitación**, responsabilidad de la empresa) del que *no quiere* (cuadrantes inferiores → **gestión de disposición**, proceso por etapas). Es la base objetiva del proceso E0-E5: nadie entra a la vía de consecuencias por disposición sin antes haber pasado por la vía de capacidad. Se actualiza mensualmente; el movimiento de personas entre cuadrantes **es en sí un KPI de adopción**.

---

## 3. La medición objetiva como ancla del cambio

El reclamo más legítimo y más explosivo del equipo es: *"me van a evaluar a dedo, según le caiga bien al jefe"*. La respuesta no es prometer justicia; es **hacer la evaluación objetiva por diseño**. Cuando el desempeño se mide con dato, la evaluación deja de ser "a apreciación" y se vuelve discutible con evidencia — y eso, paradójicamente, **baja la resistencia** en vez de subirla, porque le quita arbitrariedad al jefe.

### Los 6 KPIs que convierten "apreciación" en dato justo

Todos medibles con la API de WWP (y, donde se indica, con apoyo de Ron sobre Odoo). Cada uno con **meta + tendencia**, nunca el número suelto. Las metas son **propuestas a calibrar contra la línea base real** medida antes del go-live (sin línea base no hay mejora demostrable).

| # | KPI | Definición operativa | Por qué es justo (qué reemplaza) |
|---|---|---|---|
| **K1** | **% de entregas/órdenes perfectas (Perfect Order)** | Órdenes completas + correctas + sin daño + a tiempo + con evidencia + sin reproceso + sin reclamo, sobre el total | Reemplaza "fulano trabaja bien" por un porcentaje verificable. Es el KPI central de la operación. |
| **K2** | **% de cierres con evidencia completa** | Tareas cerradas con todas las fotos/condiciones requeridas, sobre el total de tareas cerradas | Reemplaza "siempre se le olvidan las fotos" por un dato. Mide adopción real del proceso, no de la app. |
| **K3** | **Lead time orden → despacho** | Tiempo desde que la orden entra hasta que se despacha (y por etapa: pick, staging, empaque, validación) | Reemplaza "esto va lento" por dónde exactamente va lento. Mide el flujo, no a la persona. |
| **K4** | **% entregado a tiempo (vs `dueDate`)** | Tareas/órdenes cerradas dentro de su fecha compromiso | Reemplaza "siempre llega tarde" con el cumplimiento real de la promesa. |
| **K5** | **Reprocesos por avería / tasa de daño** | Artículos con `condition: damaged`, devoluciones y reempaques, por cada 100 piezas movidas (por material/etapa/equipo) | Reemplaza "tú dañaste esto" por el patrón real: ¿es la persona, el material, la etapa o el empaque? |
| **K6** | **Tareas atascadas / balance de carga** | Tareas >X h en `in_progress` sin evidencia nueva; distribución de carga por persona (4+ = sobrecarga) | Reemplaza "está flojo" / "está saturado" por la carga real. Protege al sobrecargado y expone el cuello, no a un culpable. |

### Los 6 principios que bajan la resistencia

1. **Se mide el proceso, no a la persona** — el dato apunta a dónde falla el flujo; la conversación es de mejora, no de culpa.
2. **El dato es público y el mismo para todos** — nadie se evalúa con una vara secreta; los KPIs y sus metas se conocen de antemano.
3. **Hay línea base antes de meta** — primero se mide cómo está hoy; las metas salen del dato real, no de un número impuesto desde el escritorio.
4. **El dato se puede discutir con dato** — si alguien cree que un número es injusto, presenta evidencia; la decisión deja de ser unilateral del jefe.
5. **Se reconoce la mejora, no solo el nivel absoluto** — quien sube su KPI desde abajo se reconoce igual que quien ya estaba arriba; premia el movimiento.
6. **Primero protege, luego exige** — el primer uso del dato es defender al operario y arreglar el sistema (E0); la exigencia llega después de que el sistema es justo y conocido.

### El argumento que desarma al resistente

Cuando el resistente activo dice *"esto es para vigilarnos y botarnos"*, la respuesta no es defensiva, es un **reencuadre verificable**:

> *"Hoy te evalúan por la impresión que tenga el jefe de ti. Mañana te evalúa un número que es igual para todos, que conoces de antemano, y que puedes discutir con evidencia si crees que es injusto. WWP no te quita defensa: te la da. El que trabaja bien gana con esto, porque por fin puede probarlo. El único que pierde es el que dependía de que no se notara."*

Eso convierte el dato de **amenaza** en **escudo** para la mayoría —que trabaja bien— y deja al resistente activo sin la bandera de "es injusto", porque el sistema es, demostrablemente, *más* justo que la apreciación.

---

## 4. Consecuencias con criterio honesto

### Lo que es legítimo (validación)

La firmeza de la dirección es **legítima y necesaria**. Un cambio sin consecuencia se vuelve opcional, y un cambio opcional lo mata la mayoría movible en cuanto ve que no pasa nada por ignorarlo (es el miedo M7 hecho realidad). La dirección tiene todo el derecho a exigir que se use la herramienta de la empresa y a que el desempeño se mida. **Esto no se discute; se respalda.**

### Su límite (honestidad intelectual)

Pero el **"adóptate o vete" en seco** tiene tres costos que un buen gerente nombra antes de que ocurran:

- **Fachada / cumplimiento de cartón:** bajo amenaza pura, la gente *aparenta* usar el sistema —toma la foto sin mirar, llena el campo con cualquier cosa— y el dato se vuelve basura. Se gana adopción nominal y se pierde adopción real.
- **Fuga de talento:** parte de la resistencia está en gente **buena** que sabe del piso (los del miedo M6). Si el único camino es "úsalo perfecto desde el día uno o te vas", se pierde a quien más sabe, y se pierde por un problema de *capacidad/tiempo*, no de *voluntad*.
- **Exposición legal/laboral:** sancionar o desvincular sin un proceso documentado, gradual y con oportunidad de mejora es frágil ante cualquier reclamo laboral. La firmeza necesita un **debido proceso** que la sostenga.

**Conclusión (juicio):** la firmeza se conserva; lo que cambia es la *forma*. Un proceso por etapas da **más adopción real** que el ultimátum, porque separa al que *no puede* (se capacita y se recupera) del que *no quiere* (se gestiona con criterio y con respaldo documental), y no quema talento ni genera datos falsos por el camino.

### El proceso por etapas E0-E5

| Etapa | Nombre | Qué pasa | Propósito |
|---|---|---|---|
| **E0** | **Periodo sin sanción (gracia)** | Ventana inicial (sugerido ~4 semanas tras go-live) donde **se usa WWP, se capacita y se permite equivocarse sin ninguna consecuencia disciplinaria**. Se miden líneas base. Único objetivo: aprender y estabilizar. | Desactiva M1, M3, M4. Da tiempo real al *"no puede"*. Genera la línea base honesta de los KPIs. |
| **E1** | **Acompañamiento** | Quien aún no adopta recibe **apoyo dirigido**: buddy/campeón al lado, capacitación focalizada en su brecha específica (vista en el mapa de actitud). Conversación de apoyo, no de advertencia. | Resuelve el *"no puede"* con recursos antes de exigir. La mayoría se mueve aquí. |
| **E2** | **Expectativa explícita** | Conversación uno-a-uno: se nombra la expectativa concreta y medible ("a partir de ahora, cierre con foto en todas tus tareas"), se confirma que tiene los medios y se fija una fecha de revisión. Queda registrada. | Aquí empieza a separarse el *"no puede"* (ya resuelto en E1) del *"no quiere"*. Sin sorpresas. |
| **E3** | **Advertencia formal documentada** | Si tras E0-E2 (con capacidad ya garantizada) la persona **decide** no adoptar, advertencia formal por escrito, con hechos (los KPIs), expectativa, apoyo ofrecido y plazo. | Debido proceso. Protege a la empresa y deja claro que es *decisión* de la persona, no falta de medios. |
| **E4** | **Plan de mejora con plazo (PIP)** | Plan formal, corto y medible, con metas concretas, seguimiento y fecha límite. Última oportunidad estructurada de recuperarse. | Da una salida real al que reacciona tarde; consolida la defensa documental. |
| **E5** | **Decisión laboral** | Si tras todo lo anterior persiste el *"no quiere"*, se procede a la decisión que corresponda **con todo el proceso documentado** detrás, y definida por dirección con RRHH. | Cierra el ciclo con respaldo. La consecuencia existe y es firme, pero es el final de un proceso justo, no su comienzo. |

**Por qué E0-E5 da MÁS adopción que "adóptate o vete":**

1. **Recupera al "no puede".** El ultimátum pierde por igual al que no quiere y al que solo necesitaba tiempo o ayuda; E0-E1 rescata a este segundo, que suele ser gente valiosa.
2. **Produce dato real, no fachada.** Sin amenaza inmediata (E0), la gente usa el sistema de verdad para aprenderlo, y la línea base es honesta. La adopción es real, no de cartón.
3. **Aísla al resistente activo sin mártires.** Cuando el proceso es visiblemente justo, el que igual se niega queda solo: no puede vender el relato de "víctima del jefe arbitrario" a la mayoría, porque todos vieron el apoyo que recibió. Le quita su única arma política.
4. **Sostiene la firmeza con debido proceso.** La consecuencia de E5 es **más sólida y más defendible** precisamente porque hubo E0-E4 documentado detrás. Firmeza con respaldo > firmeza improvisada.
5. **Mueve a la mayoría por la vía correcta.** El ~70% no se mueve por miedo; se mueve por ver que adoptar es claramente el camino apoyado y reconocido. E0-E2 construye ese ambiente; el palo (E3+) queda como excepción para el 5%, no como el clima general.

---

## 5. Timeline de implementación

Qué · quién · cuándo. (Las semanas son relativas al go-live; los responsables se confirman con Gabriel.)

| Fase | Cuándo | Qué se hace | Quién |
|---|---|---|---|
| **Pre go-live** | Semanas −3 a −1 | Mensaje de patrocinio de dirección (el *por qué*, y el mensaje de M5: no es para recortar). Identificar y nombrar campeones. Capacitación inicial por rol en piso. Definir y comunicar los 6 KPIs y sus principios. Confirmar interlocutor de RRHH. Preparar guías. **Medir línea base de los 6 KPIs.** | Dirección (patrocinio); Pit (KPIs, capacitación, mapa de actitud); RRHH (proceso E); Mark (fricción de la app); Ron (datos base Odoo) |
| **Semana 1** | Go-live + E0 arranca | Arranca **E0 (sin sanción)**. Buddy system activo. Huddle diario corto (10-15 min): qué salió, qué se trabó, qué duda hay de WWP. Resolver fricción de uso en caliente (a Mark). Primer **quick win** publicado. | Pit (huddle, seguimiento); campeones (buddy); Mark (ajustes de fricción) |
| **Mes 1** | Semanas 1-4 | E0 completo. Mapa de actitud inicial. Capacitación focalizada (E1) a quien lo necesite. Primeros KPIs leídos **como diagnóstico del sistema**, no como evaluación de personas. Quick wins semanales. Cierre progresivo de canales paralelos. Al terminar E0: conversaciones de expectativa explícita (E2) donde aplique. | Pit (KPIs, mapa, huddle); campeones; dirección (refuerzo visible) |
| **Trimestre** | Meses 1-3 | KPIs con **tendencia** (no foto), metas calibradas sobre la línea base real. Retro mensual con 1-2 Kaizen priorizados. Proceso E3-E5 disponible para los casos de *"no quiere"* ya filtrados. Evaluar adopción real (uso + resultado, no solo logins). Institucionalizar lo aprendido en el **playbook** (§6). | Pit (retro, KPIs, Kaizen); dirección (gobernanza); RRHH (casos E) |

---

## 6. Gobernanza + playbook reutilizable

El objetivo no es solo adoptar WWP una vez, sino **dejar instalada la capacidad de adoptar cualquier herramienta o proceso futuro** sin reinventar el método cada vez. Los 8 pasos para institucionalizar y escalar:

1. **Dueño del cambio nombrado.** Cada adopción tiene un responsable explícito (accountable) y un patrocinador de dirección. Sin dueño, el cambio se diluye.
2. **Diagnóstico de miedos antes de lanzar.** Repetir el ejercicio de §1 para la nueva herramienta: nombrar los miedos reales y su antídoto *antes* del go-live, no después de la resistencia.
3. **Segmentación + mapa de actitud.** Clasificar al personal afectado en los 4 grupos y ubicar en la matriz capacidad/disposición. Foco en la mayoría movible.
4. **KPIs con línea base antes de meta.** Definir cómo se medirá el éxito (uso real + resultado) y medir el punto de partida *antes* de empezar. Sin línea base, no hay prueba de impacto.
5. **Red de campeones permanente.** Mantener un grupo de referentes entrenados que se reactiva en cada cambio. El estatus de campeón es un activo de la empresa, no de un proyecto.
6. **Proceso de consecuencias estándar (E0-E5).** Usar siempre la misma escala que separa *no puede* de *no quiere*, con debido proceso. Reutilizable, justa y defendible en cada adopción.
7. **Cadencia de seguimiento fija.** Huddle diario en go-live → retro mensual con tendencia de KPIs → 1-2 Kaizen priorizados. La adopción se sostiene con ritmo, no con un lanzamiento.
8. **Captura de aprendizajes (playbook vivo).** Tras cada adopción, registrar qué funcionó, qué falló y qué se ajusta —en el cerebro de los agentes y en un playbook de la empresa— para que el siguiente cambio empiece más arriba.

---

## 7. Los 8 riesgos del propio plan (RC1-RC8) y su mitigación

Un plan de cambio también puede fallar. Estos son los riesgos del plan en sí, no de la operación.

| # | Riesgo del plan | Mitigación |
|---|---|---|
| **RC1** | **El periodo sin sanción (E0) se lee como "esto es opcional"** y nadie adopta. | Comunicar E0 como *aprendizaje obligatorio sin castigo*, no como *libre*. El uso se exige desde el día 1; lo que no se sanciona en E0 es el *error*, no la *ausencia*. Huddle diario hace visible quién no entró. |
| **RC2** | **El patrocinio de dirección se enfría** tras el lanzamiento (M7 se cumple). | Compromiso explícito de dirección de presencia sostenida (decisión §8). Quick wins publicados mantienen el tema vivo. Es la decisión que más sostiene todo el plan. |
| **RC3** | **Los KPIs se usan para castigar antes de tiempo** y confirman el miedo M1/M4. | Principio 6 ("primero protege, luego exige") y E0 son regla, no sugerencia. Si un mando salta a castigar con el dato en el mes 1, se corrige al mando, no al operario. |
| **RC4** | **Captura de evidencia demasiado pesada** (M2 real): la gente la evade y el dato se ensucia. | Medir segundos por tarea; derivar a Mark la reducción de fricción. Si capturar cuesta demasiado, **es problema de diseño de la app**, no de disciplina del operario. |
| **RC5** | **Campeones mal elegidos** (por jerarquía, no por influencia real) y la mayoría no los sigue. | Elegir campeones por **influencia y disposición** (mapa de actitud), no por cargo. Un buen campeón puede ser un auxiliar respetado, no necesariamente un encargado. |
| **RC6** | **Metas impuestas sin línea base** generan rechazo ("ese número es inventado"). | Disciplina dura: **primero línea base, después meta** (principio 3). Ninguna meta numérica se comunica como exigencia hasta tener el dato real de partida. |
| **RC7** | **El resistente activo captura la narrativa** de la mayoría movible antes de que el plan dé frutos. | Quick wins **tempranos y visibles** (semana 1) para que la mayoría vea beneficio antes de que el escéptico tenga tiempo de "tener razón". Conversación directa de dirección con el resistente activo. |
| **RC8** | **WhatsApp/canales paralelos sobreviven** y vacían a WWP de contenido real. | Cierre **progresivo pero firme**: WhatsApp deja de ser sistema de registro por etapas, con fecha. Lo que no está en WWP, no cuenta. Respaldo de dirección para sostenerlo. |

---

## 8. Las 4 decisiones que requieren a Gabriel

Pit recomienda, Gabriel aprueba.

1. **Aprobar el proceso de consecuencias por etapas (E0-E5).**
   *Qué se decide:* adoptar la escala graduada que separa *"no puede"* de *"no quiere"* como política oficial, en lugar del "adóptate o vete" en seco.
   *Por qué requiere a Gabriel:* fija la política disciplinaria del cambio y compromete a la empresa a un debido proceso. Es la columna vertebral del plan.

2. **Avalar el periodo sin sanción E0.**
   *Qué se decide:* aceptar una ventana inicial (~4 semanas, a confirmar) donde se usa WWP y se mide, pero no se sanciona el error.
   *Por qué requiere a Gabriel:* exige a la dirección **contener el impulso de castigar temprano** y confiar en que la adopción real rinde más que la forzada. Es contraintuitivo y por eso necesita respaldo explícito de la cabeza.

3. **Confirmar el patrocinio sostenido de dirección.**
   *Qué se decide:* compromiso de presencia visible y continua (no solo el discurso de lanzamiento): respaldar a los mandos, sostener el cierre de canales paralelos, mantener el tema vivo durante el trimestre.
   *Por qué requiere a Gabriel:* es el factor #1 de éxito o fracaso de cualquier cambio (riesgo RC2) y el antídoto del miedo M7. Ningún plan compensa la ausencia del patrocinador.

4. **Definir el interlocutor de RRHH.**
   *Qué se decide:* quién, del lado de recursos humanos / laboral, valida y acompaña el proceso E3-E5 (advertencias, PIP, decisión laboral) para que tenga validez formal.
   *Por qué requiere a Gabriel:* las etapas E3-E5 tienen implicaciones laborales y legales que **exceden operaciones**. Pit diseña el proceso operativo; la solidez jurídica la da RRHH.

---

*Fin del plan. Documento de propuesta — no ejecuta cambios en sistemas. Las metas numéricas de los KPIs se calibran contra la línea base real medida en WWP antes del go-live (disciplina: sin línea base no hay mejora demostrable). Los porcentajes de segmentación (~10/70/15/5) son referencias de diseño, no mediciones.*
