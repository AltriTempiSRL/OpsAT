// _test_eometrics.mjs — Valida la LÓGICA de /api/eo-metrics extrayendo los helpers
// REALES de proxy.js con regex (patrón de los _test_*.mjs de este repo). No levanta
// el server ni toca Odoo: el endpoint es cómputo puro local. loadSdv/loadWwpTasks se
// inyectan como stubs para poder ejercitar eoBuildMetrics sobre fixtures controlados.
//
// Cubre: fecha LOCAL (no UTC), semanas ISO en bordes de año, buckets de cumplimiento,
// mediana/p90, duración de empaque, embudo (con esperaDespacho>0), entradaSalida, y
// los casos borde pedidos: "tarea sin dueDate/fechaSolicitudDeseada" y "statusHistory
// vacío". Uso: node _test_eometrics.mjs
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const SRC = fs.readFileSync(path.join(ROOT, 'proxy.js'), 'utf8');

// ── Extractor: toma una función top-level `function NAME(...) { ... }` del fuente,
// balanceando llaves desde la primera '{' tras la firma. ──────────────────────────
function extractFn(name) {
  const re = new RegExp('function\\s+' + name + '\\s*\\(', 'g');
  const m = re.exec(SRC);
  if (!m) throw new Error('No se encontró la función ' + name + ' en proxy.js');
  // Avanzar hasta la '{' de apertura del cuerpo.
  let i = SRC.indexOf('{', m.index);
  if (i < 0) throw new Error('Cuerpo no encontrado para ' + name);
  let depth = 0, end = -1;
  for (let j = i; j < SRC.length; j++) {
    const c = SRC[j];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { end = j + 1; break; } }
  }
  if (end < 0) throw new Error('Llaves desbalanceadas en ' + name);
  return SRC.slice(m.index, end);
}

const FN_NAMES = [
  'eoLocalDaySerial', 'eoDayDiff', 'eoISOWeek', 'eoLastISOWeeks',
  'eoMedian', 'eoP90', 'eoRound1', 'eoHoursBetween',
  'eoSdvDispatchDate', 'eoSdvCreatedDate', 'eoTaskStatusDate',
  'eoPackagingDurationH', 'eoBuildMetrics',
];

// Ensamblar un módulo con las funciones reales + stubs de loadSdv/loadWwpTasks.
let STUB_SDVS = [], STUB_TASKS = [];
const bodySrc = FN_NAMES.map(extractFn).join('\n\n');
const factory = new Function(
  '__getSdvs', '__getTasks',
  `
  function loadSdv() { return __getSdvs(); }
  function loadWwpTasks() { return __getTasks(); }
  ${bodySrc}
  return { ${FN_NAMES.join(', ')} };
  `
);
const EO = factory(() => STUB_SDVS, () => STUB_TASKS);

// ── Aserciones ────────────────────────────────────────────────────────────────
const R = [];
const ok = (name, cond, detail) => { R.push({ name, pass: !!cond }); console.log(`${cond ? '✓' : '✗'} ${name}${cond ? '' : '  → ' + JSON.stringify(detail)}`); };
const approx = (a, b, eps = 1e-9) => a !== null && b !== null && Math.abs(a - b) <= eps;

// 1) Fecha LOCAL, no UTC ──────────────────────────────────────────────────────
// Un despacho a las 21:00 hora local debe caer en SU día local, no en el UTC
// siguiente. Construimos un Date LOCAL a las 21:00 y comprobamos que el serial
// coincide con el de las 09:00 del mismo día local.
{
  const nineAM = new Date(2026, 6, 15, 9, 0, 0);   // 15-jul-2026 09:00 local
  const ninePM = new Date(2026, 6, 15, 21, 0, 0);  // 15-jul-2026 21:00 local
  ok('fecha local: 09:00 y 21:00 del mismo día → mismo serial (no corrimiento UTC)',
    EO.eoLocalDaySerial(nineAM) === EO.eoLocalDaySerial(ninePM),
    { am: EO.eoLocalDaySerial(nineAM), pm: EO.eoLocalDaySerial(ninePM) });
  ok('eoDayDiff mismo día = 0', EO.eoDayDiff(ninePM, nineAM) === 0);
  ok('eoDayDiff +2 días', EO.eoDayDiff(new Date(2026, 6, 17, 8), new Date(2026, 6, 15, 23)) === 2);
  ok('eoDayDiff -1 día (antes)', EO.eoDayDiff(new Date(2026, 6, 14, 23), new Date(2026, 6, 15, 1)) === -1);
  ok('eoDayDiff inválida → null', EO.eoDayDiff('no-fecha', new Date()) === null);
}

// 2) Semanas ISO (bordes de año) ───────────────────────────────────────────────
{
  // 2026-01-01 es jueves → W01 de 2026.
  ok('ISO: 2026-01-01 → 2026-W01', EO.eoISOWeek(new Date(2026, 0, 1)) === '2026-W01', { got: EO.eoISOWeek(new Date(2026, 0, 1)) });
  // 2025-12-31 es miércoles → pertenece a 2026-W01 (año ISO adelantado).
  ok('ISO: 2025-12-31 → 2026-W01 (borde de año)', EO.eoISOWeek(new Date(2025, 11, 31)) === '2026-W01', { got: EO.eoISOWeek(new Date(2025, 11, 31)) });
  // 2021-01-01 es viernes → pertenece a 2020-W53.
  ok('ISO: 2021-01-01 → 2020-W53 (semana 53)', EO.eoISOWeek(new Date(2021, 0, 1)) === '2020-W53', { got: EO.eoISOWeek(new Date(2021, 0, 1)) });
  // 2026-06-15 (lunes) → W25.
  ok('ISO: 2026-06-15 → 2026-W25', EO.eoISOWeek(new Date(2026, 5, 15)) === '2026-W25', { got: EO.eoISOWeek(new Date(2026, 5, 15)) });
  // eoLastISOWeeks(8) referido a un lunes conocido → 8 claves crecientes, la última = la del ref.
  const w8 = EO.eoLastISOWeeks(8, new Date(2026, 5, 15)); // semana W25
  ok('eoLastISOWeeks(8) devuelve 8 semanas', w8.length === 8, { w8 });
  ok('eoLastISOWeeks: última = semana del ref (W25)', w8[7] === '2026-W25', { last: w8[7] });
  ok('eoLastISOWeeks: primera = 7 semanas antes (W18)', w8[0] === '2026-W18', { first: w8[0] });
  ok('eoLastISOWeeks: sin duplicados', new Set(w8).size === 8, { w8 });
}

// 3) Mediana / P90 / redondeo ───────────────────────────────────────────────────
{
  ok('mediana impar', EO.eoMedian([3, 1, 2]) === 2);
  ok('mediana par (promedio central)', EO.eoMedian([1, 2, 3, 4]) === 2.5);
  ok('mediana vacío → null', EO.eoMedian([]) === null);
  ok('mediana ignora no-números', EO.eoMedian([2, null, undefined, NaN, 4]) === 3);
  ok('p90 vacío → null', EO.eoP90([]) === null);
  ok('p90 un dato → ese dato', EO.eoP90([7]) === 7);
  // p90 de 1..10 (linear): rank = 0.9*9 = 8.1 → a[8]+0.1*(a[9]-a[8]) = 9 + 0.1 = 9.1
  ok('p90 interpolado 1..10 = 9.1', approx(EO.eoP90([1,2,3,4,5,6,7,8,9,10]), 9.1), { got: EO.eoP90([1,2,3,4,5,6,7,8,9,10]) });
  ok('eoRound1 1 decimal', EO.eoRound1(2.345) === 2.3);
  ok('eoRound1 null → null', EO.eoRound1(null) === null);
  ok('eoHoursBetween 2h', EO.eoHoursBetween('2026-07-01T10:00:00', '2026-07-01T12:00:00') === 2);
  ok('eoHoursBetween negativo → null', EO.eoHoursBetween('2026-07-01T12:00:00', '2026-07-01T10:00:00') === null);
  ok('eoHoursBetween falta un extremo → null', EO.eoHoursBetween(null, '2026-07-01T12:00:00') === null);
}

// 4) Fecha real de despacho + creación de SDV ───────────────────────────────────
{
  ok('despacho: despachadaEn gana', EO.eoSdvDispatchDate({ despachadaEn: 'A', fechaEntrega: 'B' }) === 'A');
  ok('despacho: cae a fechaEntrega', EO.eoSdvDispatchDate({ fechaEntrega: 'B' }) === 'B');
  ok('despacho: cae a statusHistory despachada', EO.eoSdvDispatchDate({ statusHistory: [{ estado: 'en_proceso', at: 'X' }, { estado: 'despachada', at: 'Y' }] }) === 'Y');
  ok('despacho: nunca → null', EO.eoSdvDispatchDate({ statusHistory: [] }) === null);
  ok('creación: fechaSolicitud gana', EO.eoSdvCreatedDate({ fechaSolicitud: 'C', creadoAt: 'D' }) === 'C');
  ok('creación: cae a creadoAt', EO.eoSdvCreatedDate({ creadoAt: 'D' }) === 'D');
}

// 5) statusHistory de tarea + duración de empaque (incl. casos borde) ────────────
{
  const task = { statusHistory: [
    { status: 'pending', date: '2026-07-01T08:00:00' },
    { status: 'in_progress', date: '2026-07-01T10:00:00' },
    { status: 'in_progress', date: '2026-07-01T10:30:00' }, // reanudación
    { status: 'completed', date: '2026-07-01T12:00:00' },
    { status: 'validated', date: '2026-07-01T13:00:00' },
  ]};
  ok('primer in_progress', EO.eoTaskStatusDate(task, 'in_progress', false) === '2026-07-01T10:00:00');
  ok('último completed', EO.eoTaskStatusDate(task, 'completed', true) === '2026-07-01T12:00:00');
  ok('estado ausente → null', EO.eoTaskStatusDate(task, 'cancelled', false) === null);
  // Empaque: 10:00 → max(completed 12:00, validated 13:00) = 13:00 → 3h
  ok('duración empaque = 3h (primer in_progress → último completed/validated)', EO.eoPackagingDurationH(task) === 3, { got: EO.eoPackagingDurationH(task) });
  // Borde: statusHistory vacío → null (no lanza)
  ok('CASO BORDE statusHistory vacío → duración null', EO.eoPackagingDurationH({ statusHistory: [] }) === null);
  ok('CASO BORDE statusHistory ausente → duración null', EO.eoPackagingDurationH({}) === null);
  // Solo in_progress, sin cierre → null
  ok('empaque sin completed/validated → null', EO.eoPackagingDurationH({ statusHistory: [{ status: 'in_progress', date: '2026-07-01T10:00:00' }] }) === null);
}

// 6) eoBuildMetrics end-to-end sobre fixtures (dentro de la ventana de 60d) ──────
{
  const nowMs = Date.now();
  const iso = msAgo => new Date(nowMs - msAgo).toISOString();
  const H = 36e5, D = 864e5;
  // SDV 1: prometida hoy, despachada hoy (al día). SDV 2: prometida hace 5d,
  // despachada hoy (tarde >=3). SDV 3: prometida hace 1d, despachada hoy (tarde 1-2).
  // SDV 4: sin fechaSolicitudDeseada (CASO BORDE: no entra a cumplimiento).
  const todayDispatch = iso(0);
  STUB_SDVS = [
    { id: 's1', creadoAt: iso(3 * D), fechaSolicitudDeseada: new Date(nowMs).toISOString(),       despachadaEn: todayDispatch },
    { id: 's2', creadoAt: iso(6 * D), fechaSolicitudDeseada: new Date(nowMs - 5 * D).toISOString(), despachadaEn: todayDispatch },
    { id: 's3', creadoAt: iso(4 * D), fechaSolicitudDeseada: new Date(nowMs - 1 * D).toISOString(), despachadaEn: todayDispatch },
    { id: 's4', creadoAt: iso(2 * D), fechaSolicitudDeseada: null, despachadaEn: todayDispatch }, // sin dueDate
    { id: 's5', creadoAt: iso(1 * D) }, // creada, no despachada
  ];
  // Tareas: packaging con sdvId (cuentan) + una con SOLO odooRef (se EXCLUYE) +
  // dispatch_order del mismo sdvId para esperaDespacho.
  const pkgStart = iso(2 * H); // empezó hace 2h (dentro de ventana)
  STUB_TASKS = [
    // packaging 2 items → bucket peq1a3; empaque 1h; esperaInicio 1h
    { id: 't1', type: 'packaging', sdvId: 's1', items: [{}, {}], createdAt: iso(3 * H),
      statusHistory: [{ status: 'in_progress', date: iso(2 * H) }, { status: 'completed', date: iso(1 * H) }] },
    // packaging 5 items → bucket med4a10; empaque 2h
    { id: 't2', type: 'packaging', sdvId: 's2', items: [{}, {}, {}, {}, {}], createdAt: iso(5 * H),
      statusHistory: [{ status: 'in_progress', date: iso(4 * H) }, { status: 'validated', date: iso(2 * H) }] },
    // packaging 12 items → bucket gra11mas; empaque 0.5h
    { id: 't3', type: 'packaging', sdvId: 's3', items: new Array(12).fill({}),
      createdAt: iso(2 * H), statusHistory: [{ status: 'in_progress', date: iso(1.5 * H) }, { status: 'completed', date: iso(1 * H) }] },
    // packaging con sdvId pero SIN items (CASO BORDE: no clasifica por tamaño)
    { id: 't4', type: 'packaging', sdvId: 's4', items: [],
      statusHistory: [{ status: 'in_progress', date: iso(2 * H) }, { status: 'completed', date: iso(1 * H) }] },
    // dispatch_order de s1: arranca 0.5h tras fin de empaque de t1 (empaque t1 terminó hace 1h)
    { id: 't5', type: 'dispatch_order', sdvId: 's1', dispatchStartedAt: iso(0.5 * H),
      statusHistory: [{ status: 'in_progress', date: iso(0.5 * H) }] },
    // tarea con SOLO odooRef, sin sdvId → DEBE EXCLUIRSE del universo
    { id: 't6', type: 'packaging', odooRef: 'S99999', items: [{}, {}],
      statusHistory: [{ status: 'in_progress', date: iso(2 * H) }, { status: 'completed', date: iso(1 * H) }] },
  ];

  const m = EO.eoBuildMetrics(60, 5);
  ok('payload universo = sdv', m.universo === 'sdv');
  ok('payload ventanaDias=60, minN=5', m.ventanaDias === 60 && m.minN === 5);
  ok('cumplimientoSemanal tiene 8 semanas', m.cumplimientoSemanal.length === 8);
  ok('entradaSalidaSemanal tiene 8 semanas', m.entradaSalidaSemanal.length === 8);
  // Cumplimiento: s1 alDia, s2 tarde3mas, s3 tarde1a2, s4 excluida (sin dueDate). Todas semana actual.
  const lastCump = m.cumplimientoSemanal[7];
  ok('cumplimiento semana actual: alDia=1', lastCump.alDia === 1, { lastCump });
  ok('cumplimiento semana actual: tarde3mas=1', lastCump.tarde3mas === 1, { lastCump });
  ok('cumplimiento semana actual: tarde1a2=1', lastCump.tarde1a2 === 1, { lastCump });
  ok('cumplimiento: SDV sin dueDate NO cuenta (antes+alDia+tarde=3, no 4)',
    (lastCump.antes + lastCump.alDia + lastCump.tarde1a2 + lastCump.tarde3mas) === 3, { lastCump });
  // Empaque por tamaño: t1 en peq (2 items), t2 en med (5), t3 en gra (12), t4 excluida (0 items), t6 excluida (sin sdvId)
  ok('empaque peq1a3: n=1', m.empaquePorTamano.peq1a3.n === 1, { peq: m.empaquePorTamano.peq1a3 });
  ok('empaque med4a10: n=1', m.empaquePorTamano.med4a10.n === 1, { med: m.empaquePorTamano.med4a10 });
  ok('empaque gra11mas: n=1', m.empaquePorTamano.gra11mas.n === 1, { gra: m.empaquePorTamano.gra11mas });
  ok('empaque peq medianaH ≈ 1h', m.empaquePorTamano.peq1a3.medianaH === 1, { got: m.empaquePorTamano.peq1a3.medianaH });
  // Embudo: empaque cuenta t1,t2,t3,t4 (todas con duración) = 4; esperaInicio cuenta las que tienen createdAt (t1,t2,t3) = 3
  ok('embudo empaque n=4 (todas las packaging con duración, incl. sin items)', m.embudo.empaque.n === 4, { emp: m.embudo.empaque });
  ok('embudo esperaInicio n=3 (packaging con createdAt)', m.embudo.esperaInicio.n === 3, { ei: m.embudo.esperaInicio });
  ok('embudo esperaDespacho n=1 (solo s1 tiene dispatch hermano posterior positivo)', m.embudo.esperaDespacho.n === 1, { ed: m.embudo.esperaDespacho });
  ok('embudo esperaDespacho medianaH ≈ 0.5h', m.embudo.esperaDespacho.medianaH === 0.5, { got: m.embudo.esperaDespacho.medianaH });
  ok('embudo NO incluye "ruta" (solo 3 etapas)', Object.keys(m.embudo).length === 3 && !('ruta' in m.embudo), { keys: Object.keys(m.embudo) });
  // Entrada/salida semana actual: creadas = las creadas esta semana; despachadas = s1..s4 (4)
  const lastES = m.entradaSalidaSemanal[7];
  ok('entradaSalida semana actual: despachadas=4', lastES.despachadas === 4, { lastES });
  ok('universo excluye odooRef-solo: t6 no infló ningún bucket', (m.empaquePorTamano.peq1a3.n + m.empaquePorTamano.med4a10.n + m.empaquePorTamano.gra11mas.n) === 3, { emp: m.empaquePorTamano });
}

// 7) Universo vacío no lanza y devuelve estructura válida ────────────────────────
{
  STUB_SDVS = []; STUB_TASKS = [];
  let m;
  try { m = EO.eoBuildMetrics(60, 5); ok('universo vacío no lanza', true); }
  catch (e) { ok('universo vacío no lanza', false, { err: e.message }); }
  ok('universo vacío: 8 semanas con ceros', m && m.cumplimientoSemanal.length === 8 && m.cumplimientoSemanal.every(w => w.antes === 0 && w.alDia === 0 && w.tarde1a2 === 0 && w.tarde3mas === 0));
  ok('universo vacío: empaque n=0 y medianaH null', m && m.empaquePorTamano.peq1a3.n === 0 && m.empaquePorTamano.peq1a3.medianaH === null);
  ok('universo vacío: embudo p90H null', m && m.embudo.empaque.p90H === null);
}

const fails = R.filter(x => !x.pass).length;
console.log(`\n═══ ${R.length - fails}/${R.length} pasaron ═══${fails ? ` · ${fails} FALLARON` : ''}`);
process.exit(fails ? 1 : 0);
