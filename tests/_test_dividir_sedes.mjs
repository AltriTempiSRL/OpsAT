// _test_dividir_sedes.mjs — Capa 2: POST /api/wwp/tasks/:id/dividir-sedes (14-jul).
// Offline (sin Odoo): la clasificación usa selected_location_name ya presente en los items;
// las tareas usan odooRef ficticio S99991 para que el gate de pick (fail-open / sin picks)
// no bloquee aunque haya credenciales Odoo vivas en el entorno (Aprendizaje 26, trampa 2).
// Cubre: preview 2 sedes + fix D-PTN, kit no se parte, sinAsignar bloquea, RBAC 403,
// validaciones 400 de grupos, apply crea 2 mini-cadenas con subsets/partición/presupuesto,
// SDV wwpTareas + auditoría + notifs, y el GATE EMPAREJADO: el despacho de la sede A inicia
// cuando SU empaque completa aunque el empaque B siga abierto (la clave del diseño 2-roots).
// Uso (desde la raíz del proyecto): node tests/_test_dividir_sedes.mjs
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

const PORT = 3298;
const BASE = `http://127.0.0.1:${PORT}`;
const ROOT = process.cwd();
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'testsedes-'));

const b64u = b => Buffer.from(b).toString('base64url');
let SECRET = null, ADMIN = null, MANAGER = null;
function mint(userId, role, name) {
  const h = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' })); const t = Math.floor(Date.now() / 1000);
  const pl = b64u(JSON.stringify({ userId, role, name, odooId: 98, iat: t, exp: t + 86400 }));
  const s = crypto.createHmac('sha256', SECRET).update(`${h}.${pl}`).digest('base64url');
  return `${h}.${pl}.${s}`;
}
let _ipc = 0; const nextIp = () => { const n = ++_ipc; return `10.${(n >> 16) & 255}.${(n >> 8) & 255}.${n & 255}`; };
async function api(method, p, token, body) {
  const r = await fetch(BASE + p, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': nextIp(), ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined });
  let raw = ''; try { raw = await r.text(); } catch {} let j = null; try { j = JSON.parse(raw); } catch {}
  return { status: r.status, j, raw };
}
const tasksOnDisk = () => JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'wwp-tasks.json'), 'utf8'));
const sdvOnDisk = () => JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'sdv-solicitudes.json'), 'utf8'));
const R = []; const ok = (name, cond, detail) => { R.push({ name, pass: !!cond }); console.log(`${cond ? '✓' : '✗'} ${name}${cond ? '' : '  → ' + JSON.stringify(detail)}`); };
function waitReady(ms = 20000) { const t0 = Date.now(); return new Promise((res, rej) => { (async function poll() { try { const r = await fetch(BASE + '/api/app-version'); if (r.ok) return res(true); } catch {} if (Date.now() - t0 > ms) return rej(new Error('server no levantó')); setTimeout(poll, 300); })(); }); }

// ── Seed ──────────────────────────────────────────────────────────────────────
const NOW = new Date().toISOString();
const mkItem = (id, pid, sku, name, bin, extra) => ({
  item_id: id, odoo_product_id: pid, odoo_line_id: null, sku, barcode: sku, product_name: name,
  quantity: 1, units: 1, unit_index: (extra && extra.unit_index) || 1, unit_total: 1, group_ref: id,
  fromPick: true, pickName: 'ALV/PICK/14740', selected: true, locations: [], selected_location: null,
  selected_location_name: bin, evidence_images: [], comments: '', confirmado: false, status: 'pending',
  ...(extra || {})
});
const mkTask = (id, over) => ({
  id, seq: null, parentId: null, title: 'Tarea', type: 'packaging', description: '', priority: 'medium',
  status: 'assigned', sdvId: null, assignedTo: null, managerId: 'au_mgr', managerName: 'Mano Original',
  executors: [], assignees: [], odooRef: 'S99991', client: 'CLIENTE TEST', salesperson: 'Vera',
  deliveryAddress: 'Av. Test', phone: '809', location: '', dueDate: '2026-07-20', actionNote: '',
  requester: 'Vera', sdvFolio: 'SD-T', receptorNombre: 'R', gpsCoords: null, transporteIncluido: false,
  sdvArticulos: [], staffStart: null, staffEnd: null, staffFrom: '', staffTo: '', totalHours: null,
  dependsOnPrev: false, subIndex: null, evidence: [], fotos_guia: [], dispatchStartedAt: null,
  dispatchCompletedAt: null, statusHistory: [{ status: 'assigned', date: NOW, by: 'seed', note: '' }],
  createdBy: 'seed', createdAt: NOW, updatedAt: NOW, ...over
});

// Cadena A — caso S08982: 8 kits Oliver (armazón CD3 + cojín DB7, A-CDP) + 1 mesa D-PTN/SHOWROOM
const itemsA = [];
for (let n = 1; n <= 8; n++) {
  itemsA.push(mkItem(`oi_501_u${n}`, 501, 'ARM-OL', 'Armazón sillón Oliver', 'A-CDP/CD3', { unit_index: n, unit_total: 8, group_ref: 'oi_501', kitId: 'kit_oliver', kitRef: 'KOL', kitName: 'Sillón Oliver' }));
  itemsA.push(mkItem(`oi_502_u${n}`, 502, 'COJ-OL', 'Cojín sillón Oliver', 'A-CDP/DB7', { unit_index: n, unit_total: 8, group_ref: 'oi_502', kitId: 'kit_oliver', kitRef: 'KOL', kitName: 'Sillón Oliver' }));
}
itemsA.push(mkItem('oi_600_u1', 600, 'MESA-OL', 'Mesa Oliver', 'D-PTN/SHOWROOM'));
const rootA = mkTask('wt_roota', { seq: 100, title: 'Empaque CLIENTE TEST', sdvId: 'sdv_t1',
  items: itemsA, sdvArticulos: [{ sku: 'ARM-OL', quantity: 8, name: 'Armazón sillón Oliver' }, { sku: 'COJ-OL', quantity: 8, name: 'Cojín sillón Oliver' }, { sku: 'MESA-OL', quantity: 1, name: 'Mesa Oliver' }, { sku: 'EXTRA-1', quantity: 2, name: 'Sobrante omitido del pick' }] });
const dispA = mkTask('wt_dispa', { title: 'Despacho CLIENTE TEST', type: 'dispatch_order', parentId: 'wt_roota',
  subIndex: 2, dependsOnPrev: true, sdvId: 'sdv_t1', items: JSON.parse(JSON.stringify(itemsA)), sdvArticulos: [] });

// Cadena B — kit que CRUZA sedes (comp1 CDP, comp2 PTN) + 1 suelto CDP → sinAsignar bloquea
const itemsB = [
  mkItem('oi_701_u1', 701, 'KX-A', 'Comp A kit X', 'A-CDP/AA1', { kitId: 'kit_x' }),
  mkItem('oi_702_u1', 702, 'KX-B', 'Comp B kit X', 'D-PTN/SHOWROOM', { kitId: 'kit_x' }),
  mkItem('oi_703_u1', 703, 'SUELTO', 'Suelto CDP', 'A-CDP/BB1')
];
const rootB = mkTask('wt_rootb', { seq: 101, title: 'Empaque KitCruzado', sdvId: 'sdv_t2', items: itemsB });

// Cadena C — item sin ubicación → sinAsignar bloquea
const itemsC = [
  mkItem('oi_801_u1', 801, 'C1', 'CDP item', 'A-CDP/AA1'),
  mkItem('oi_802_u1', 802, 'P1', 'PTN item', 'D-PTN/SHOWROOM'),
  mkItem('oi_803_u1', 803, 'S1', 'Sin ubicación', '')
];
const rootC = mkTask('wt_rootc', { seq: 102, title: 'Empaque SinUbic', sdvId: 'sdv_t3', items: itemsC });

// Cadena D — ya tiene evidencia en un item → 409
const itemsD = [
  mkItem('oi_901_u1', 901, 'D1', 'CDP item', 'A-CDP/AA1', { evidence_images: ['/wwp-fotos/x.jpg'], confirmado: true }),
  mkItem('oi_902_u1', 902, 'D2', 'PTN item', 'D-PTN/SHOWROOM')
];
const rootD = mkTask('wt_rootd', { seq: 103, title: 'Empaque ConEvidencia', sdvId: 'sdv_t4', items: itemsD });

const mkSdv = (id, folio, wwpTaskId, tareas) => ({
  id, folio, tipoSolicitud: 'despacho_cliente', estado: 'en_proceso', clienteNombre: 'CLIENTE TEST',
  odooOrderRef: 'S99991', direccionEntrega: 'Av. Test', receptorNombre: 'R', receptorContacto: '809',
  fechaSolicitudDeseada: '2026-07-20', vendedorNombre: 'Vera', creadoPor: 'au_vera', creadoNombre: 'Vera',
  creadoAt: NOW, articulosOdoo: [], observaciones: '', wwpTaskId, wwpTareas: tareas.map(tid => ({ taskId: tid, titulo: tid, creadoAt: NOW }))
});

fs.writeFileSync(path.join(DATA_DIR, 'wwp-tasks.json'), JSON.stringify([rootA, dispA, rootB, rootC, rootD], null, 2));
fs.writeFileSync(path.join(DATA_DIR, 'sdv-solicitudes.json'), JSON.stringify([
  mkSdv('sdv_t1', 'SD-2026-0025T', 'wt_roota', ['wt_roota', 'wt_dispa']),
  mkSdv('sdv_t2', 'SD-T2', 'wt_rootb', ['wt_rootb']),
  mkSdv('sdv_t3', 'SD-T3', 'wt_rootc', ['wt_rootc']),
  mkSdv('sdv_t4', 'SD-T4', 'wt_rootd', ['wt_rootd'])
], null, 2));
const mkUser = (id, name, role, odooId) => ({ id, name, email: id + '@t.do', passwordHash: 'pbkdf2:x:y', role, odooId, active: true, lastLogin: null, createdAt: NOW });
fs.writeFileSync(path.join(DATA_DIR, 'wwp-users-auth.json'), JSON.stringify([
  mkUser('au_admin', 'Admin QA', 'admin', 98), mkUser('au_mgr', 'Manager QA', 'manager', 99),
  mkUser('au_frank', 'Franklin', 'manager', 55), mkUser('au_jose', 'José Ismael', 'assistant', 56)
], null, 2));
fs.writeFileSync(path.join(DATA_DIR, 'wwp-task-seq.json'), JSON.stringify({ seq: 200 }));

(async () => {
  const srv = spawn('node', ['proxy.js'], { cwd: ROOT, env: { ...process.env, DATA_DIR, PORT: String(PORT) } });
  let serr = ''; srv.stderr.on('data', d => serr += d.toString());
  const cleanup = () => { try { srv.kill('SIGKILL'); } catch {} try { fs.rmSync(DATA_DIR, { recursive: true, force: true }); } catch {} };
  try {
    await waitReady();
    SECRET = fs.readFileSync(path.join(DATA_DIR, '.jwt-secret'), 'utf8').trim();
    ADMIN = mint('au_admin', 'admin', 'Admin QA');
    MANAGER = mint('au_mgr', 'manager', 'Manager QA');
    const URL_A = '/api/wwp/tasks/wt_roota/dividir-sedes';

    console.log('\n── 1. RBAC: solo admin ──');
    const rb1 = await api('POST', URL_A, MANAGER, {});
    ok('manager → 403', rb1.status === 403, { status: rb1.status });
    const rb2 = await api('POST', URL_A, null, {});
    ok('sin token → 401', rb2.status === 401, { status: rb2.status });
    const nf = await api('POST', '/api/wwp/tasks/wt_nope/dividir-sedes', ADMIN, {});
    ok('tarea inexistente → 404', nf.status === 404, { status: nf.status });

    console.log('\n── 2. PREVIEW cadena A (vía la HIJA → resuelve la raíz): 2 sedes, D-PTN normalizada ──');
    const pv = await api('POST', '/api/wwp/tasks/wt_dispa/dividir-sedes', ADMIN, { apply: false });
    const sedes = (pv.j && pv.j.sedes) || [];
    ok('200 preview elegible', pv.status === 200 && pv.j && pv.j.preview === true && pv.j.elegible === true, { status: pv.status, j: pv.j && { e: pv.j.elegible, m: pv.j.motivoNoElegible } });
    ok('raíz resuelta = wt_roota', pv.j && pv.j.raiz && pv.j.raiz.id === 'wt_roota', { raiz: pv.j && pv.j.raiz });
    ok('2 sedes: CDP(16) primera (más items) + PTN(1) — fix D-PTN→PTN', sedes.length === 2 && sedes[0].sede === 'CDP' && sedes[0].nItems === 16 && sedes[1].sede === 'PTN' && sedes[1].nItems === 1, { s: sedes.map(x => [x.sede, x.nItems]) });
    ok('mesa clasificada en PTN con bin visible', sedes.length === 2 && sedes[1].items[0] && sedes[1].items[0].item_id === 'oi_600_u1' && /D-PTN/.test(sedes[1].items[0].bin), { it: sedes[1] && sedes[1].items[0] });
    ok('sinAsignar vacío', pv.j && Array.isArray(pv.j.sinAsignar) && pv.j.sinAsignar.length === 0, { sa: pv.j && pv.j.sinAsignar });

    console.log('\n── 3. Kit que cruza sedes → sinAsignar bloquea ──');
    const pvB = await api('POST', '/api/wwp/tasks/wt_rootb/dividir-sedes', ADMIN, { apply: false });
    ok('preview B: elegible=false con motivo', pvB.status === 200 && pvB.j && pvB.j.elegible === false && /sin sede clara/i.test(pvB.j.motivoNoElegible || ''), { j: pvB.j && { e: pvB.j.elegible, m: pvB.j.motivoNoElegible } });
    ok('kit completo (2 comps) en sinAsignar con motivo "cruza sedes"', pvB.j && pvB.j.sinAsignar.length === 2 && pvB.j.sinAsignar.every(x => /cruza sedes/.test(x.motivo)), { sa: pvB.j && pvB.j.sinAsignar });
    const apB = await api('POST', '/api/wwp/tasks/wt_rootb/dividir-sedes', ADMIN, { apply: true, grupos: [{ sede: 'CDP' }, { sede: 'PTN' }] });
    ok('apply B → 409', apB.status === 409, { status: apB.status });

    console.log('\n── 4. Item sin ubicación → bloquea; evidencia previa → bloquea ──');
    const pvC = await api('POST', '/api/wwp/tasks/wt_rootc/dividir-sedes', ADMIN, { apply: false });
    ok('preview C: elegible=false + 1 sinAsignar', pvC.status === 200 && pvC.j && pvC.j.elegible === false && pvC.j.sinAsignar.length === 1 && pvC.j.sinAsignar[0].item_id === 'oi_803_u1', { j: pvC.j && { e: pvC.j.elegible, sa: pvC.j.sinAsignar } });
    const apC = await api('POST', '/api/wwp/tasks/wt_rootc/dividir-sedes', ADMIN, { apply: true, grupos: [{ sede: 'CDP' }, { sede: 'PTN' }] });
    ok('apply C → 409 (sinAsignar sin resolver)', apC.status === 409, { status: apC.status });
    const apD = await api('POST', '/api/wwp/tasks/wt_rootd/dividir-sedes', ADMIN, { apply: true, grupos: [{ sede: 'CDP' }, { sede: 'PTN' }] });
    ok('apply D (con evidencia) → 409 con motivo de evidencia', apD.status === 409 && /evidencia/i.test((apD.j && apD.j.error) || ''), { status: apD.status, e: apD.j && apD.j.error });

    console.log('\n── 5. Validaciones 400 de grupos (apply A) ──');
    const v1 = await api('POST', URL_A, ADMIN, { apply: true });
    ok('sin grupos → 400', v1.status === 400, { status: v1.status });
    const v2 = await api('POST', URL_A, ADMIN, { apply: true, grupos: [{ sede: 'CDP' }] });
    ok('falta la sede PTN → 400', v2.status === 400 && /PTN/.test(v2.j.error), { status: v2.status, e: v2.j && v2.j.error });
    const v3 = await api('POST', URL_A, ADMIN, { apply: true, grupos: [{ sede: 'CDP' }, { sede: 'XXX' }] });
    ok('sede desconocida → 400', v3.status === 400 && /desconocida/i.test(v3.j.error), { status: v3.status });
    const v4 = await api('POST', URL_A, ADMIN, { apply: true, grupos: [{ sede: 'CDP', empaqueEncargados: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] }, { sede: 'PTN' }] });
    ok('3 encargados → 400', v4.status === 400 && /Máximo 2/.test(v4.j.error), { status: v4.status });
    const v5 = await api('POST', URL_A, ADMIN, { apply: true, grupos: [{ sede: 'CDP', due: '20-07-2026' }, { sede: 'PTN' }] });
    ok('due mal formado → 400', v5.status === 400 && /Fecha inválida/.test(v5.j.error), { status: v5.status });

    console.log('\n── 6. APPLY cadena A: 2 mini-cadenas (CDP=Franklin ancla, PTN=José nueva) ──');
    const ap = await api('POST', URL_A, ADMIN, { apply: true, by: 'Admin QA', grupos: [
      { sede: 'CDP', empaqueEncargados: [{ id: 'au_frank', name: 'Franklin' }], despachoEncargados: [{ id: 'au_frank', name: 'Franklin' }], due: '2026-07-18' },
      { sede: 'PTN', empaqueEncargados: [{ id: 'au_jose', name: 'José Ismael' }], despachoEncargados: [{ id: 'au_jose', name: 'José Ismael' }] }
    ] });
    ok('apply → 200 con 2 cadenas', ap.status === 200 && ap.j && ap.j.applied === true && (ap.j.cadenas || []).length === 2, { status: ap.status, j: ap.j });
    const cCdp = ap.j && ap.j.cadenas.find(c => c.sede === 'CDP');
    const cPtn = ap.j && ap.j.cadenas.find(c => c.sede === 'PTN');
    ok('CDP = ancla (raíz existente, seq 100) / PTN = nueva con seq propio', cCdp && cCdp.ancla === true && cCdp.rootId === 'wt_roota' && cCdp.rootSeq === 100 && cPtn && cPtn.ancla === false && cPtn.rootId !== 'wt_roota' && typeof cPtn.rootSeq === 'number' && cPtn.rootSeq > 200, { cCdp, cPtn });

    const disk = tasksOnDisk();
    const rA = disk.find(x => x.id === 'wt_roota');
    const dA = disk.find(x => x.id === 'wt_dispa');
    const rP = disk.find(x => x.id === (cPtn && cPtn.rootId));
    const dP = disk.find(x => x.id === (cPtn && cPtn.dispatchIds[0]));
    ok('ancla CDP: título [CDP], 16 items (todos A-CDP), localidad, Franklin', rA && rA.title === '[CDP] Empaque CLIENTE TEST' && rA.items.length === 16 && rA.items.every(i => /^A-CDP/.test(i.selected_location_name)) && rA.localidad === 'CDP' && rA.managerId === 'au_frank', { rA: rA && { t: rA.title, n: rA.items.length, m: rA.managerId } });
    ok('kit Oliver NO partido: los 16 items con kitId quedaron en CDP', rA && rA.items.filter(i => i.kitId === 'kit_oliver').length === 16, { n: rA && rA.items.filter(i => i.kitId).length });
    ok('hijo CDP conservado: mismo id, acotado a 16, [CDP], due del grupo', dA && dA.parentId === 'wt_roota' && dA.items.length === 16 && /^\[CDP\]/.test(dA.title) && dA.dueDate === '2026-07-18' && dA.managerId === 'au_frank', { dA: dA && { p: dA.parentId, n: dA.items.length, due: dA.dueDate } });
    ok('raíz PTN nueva: packaging, 1 item (mesa), José, assigned, sdvId heredado', rP && rP.type === 'packaging' && rP.title === '[PTN] Empaque CLIENTE TEST' && rP.items.length === 1 && rP.items[0].item_id === 'oi_600_u1' && rP.managerId === 'au_jose' && rP.status === 'assigned' && rP.sdvId === 'sdv_t1' && rP.odooRef === 'S99991', { rP: rP && { t: rP.title, n: rP.items.length, m: rP.managerId, s: rP.status } });
    ok('hijo PTN nuevo: dispatch, parentId=raíz PTN, subIndex 2, dependsOnPrev, 1 item', dP && dP.type === 'dispatch_order' && dP.parentId === rP.id && dP.subIndex === 2 && dP.dependsOnPrev === true && dP.items.length === 1, { dP: dP && { p: dP.parentId, si: dP.subIndex, dep: dP.dependsOnPrev, n: dP.items.length } });
    ok('las 2 mini-cadenas NO dependen entre sí (raíces sin parentId)', rA.parentId == null && rP.parentId == null, { a: rA.parentId, p: rP.parentId });
    const union = [...rA.items, ...rP.items].map(i => i.item_id).sort();
    const orig = itemsA.map(i => i.item_id).sort();
    ok('PARTICIÓN: unión de subsets == 17 items originales, sin duplicados', union.length === 17 && JSON.stringify(union) === JSON.stringify(orig), { u: union.length });
    ok('presupuesto: ancla conserva sobrante EXTRA-1(2) + ARM/COJ(8); PTN solo MESA-OL(1)',
      rA.sdvArticulos.some(a => a.sku === 'EXTRA-1' && a.quantity === 2) && rA.sdvArticulos.some(a => a.sku === 'ARM-OL' && a.quantity === 8) && !rA.sdvArticulos.some(a => a.sku === 'MESA-OL') && rP.sdvArticulos.length === 1 && rP.sdvArticulos[0].sku === 'MESA-OL' && rP.sdvArticulos[0].quantity === 1,
      { anc: rA.sdvArticulos, ptn: rP.sdvArticulos });
    const sol1 = sdvOnDisk().find(s => s.id === 'sdv_t1');
    ok('SDV: wwpTareas incluye las 2 tareas nuevas; wwpTaskId sigue = wt_roota', sol1 && sol1.wwpTaskId === 'wt_roota' && sol1.wwpTareas.some(w => w.taskId === rP.id) && sol1.wwpTareas.some(w => w.taskId === dP.id), { w: sol1 && sol1.wwpTareas.map(x => x.taskId) });
    const audit = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'wwp-audit.json'), 'utf8'));
    const aEv = audit.find(a => a.event === 'chain_sede_split');
    ok('auditoría chain_sede_split con sedes/conteos/by', !!aEv && aEv.rootId === 'wt_roota' && aEv.sedes.length === 2 && aEv.totalItems === 17 && aEv.by === 'Admin QA', { aEv });
    let notifs = [];
    try { notifs = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'wwp-notifications.json'), 'utf8')); } catch {}
    ok('notificación task_assigned a José (raíz PTN nueva)', notifs.some(n => n.userId === 'au_jose' && n.type === 'task_assigned' && n.target && n.target.id === rP.id), { n: notifs.filter(n => n.userId === 'au_jose').map(n => n.type) });
    const pv2 = await api('POST', URL_A, ADMIN, { apply: false });
    ok('re-preview de la ancla post-split: elegible=false (una sola sede)', pv2.status === 200 && pv2.j.elegible === false && /misma sede/i.test(pv2.j.motivoNoElegible || ''), { m: pv2.j && pv2.j.motivoNoElegible });

    console.log('\n── 7. GATE EMPAREJADO: despacho A inicia cuando SU empaque completa, aunque el B siga abierto ──');
    const gN = await api('PATCH', '/api/wwp/tasks/' + dP.id, ADMIN, { status: 'in_progress', by: 'Admin QA' });
    ok('despacho PTN NO inicia con su empaque PTN abierto → 409', gN.status === 409 && /empaque/i.test(gN.j.error || ''), { status: gN.status, e: gN.j && gN.j.error });
    // Completar el empaque CDP: sembrar evidencia/confirmación/condición en sus 16 items (en disco)
    const disk2 = tasksOnDisk();
    const rA2 = disk2.find(x => x.id === 'wt_roota');
    rA2.items.forEach(i => { i.evidence_images = ['/wwp-fotos/e.jpg']; i.confirmado = true; i.condition = 'good'; });
    fs.writeFileSync(path.join(DATA_DIR, 'wwp-tasks.json'), JSON.stringify(disk2, null, 2));
    const s1 = await api('PATCH', '/api/wwp/tasks/wt_roota', ADMIN, { status: 'in_progress', by: 'Admin QA' });
    const s2 = await api('PATCH', '/api/wwp/tasks/wt_roota', ADMIN, { status: 'completed', by: 'Admin QA' });
    ok('empaque CDP: in_progress → completed OK (exención handoff intacta)', s1.status === 200 && s2.status === 200, { s1: s1.status, s2: s2.status, e1: s1.j && s1.j.error, e2: s2.j && s2.j.error });
    const gA = await api('PATCH', '/api/wwp/tasks/wt_dispa', ADMIN, { status: 'in_progress', by: 'Admin QA' });
    ok('LA CLAVE: despacho CDP inicia (SU empaque completo) aunque el empaque PTN siga abierto', gA.status === 200, { status: gA.status, e: gA.j && gA.j.error });
    const gN2 = await api('PATCH', '/api/wwp/tasks/' + dP.id, ADMIN, { status: 'in_progress', by: 'Admin QA' });
    ok('despacho PTN sigue bloqueado por SU empaque (no por el ajeno) → 409', gN2.status === 409, { status: gN2.status });
    const disk3 = tasksOnDisk();
    const rP2 = disk3.find(x => x.id === rP.id);
    rP2.items.forEach(i => { i.evidence_images = ['/wwp-fotos/e2.jpg']; i.confirmado = true; i.condition = 'good'; });
    fs.writeFileSync(path.join(DATA_DIR, 'wwp-tasks.json'), JSON.stringify(disk3, null, 2));
    const s3 = await api('PATCH', '/api/wwp/tasks/' + rP.id, ADMIN, { status: 'in_progress', by: 'Admin QA' });
    const s4 = await api('PATCH', '/api/wwp/tasks/' + rP.id, ADMIN, { status: 'completed', by: 'Admin QA' });
    const gP = await api('PATCH', '/api/wwp/tasks/' + dP.id, ADMIN, { status: 'in_progress', by: 'Admin QA' });
    ok('al completar el empaque PTN, su despacho por fin inicia', s3.status === 200 && s4.status === 200 && gP.status === 200, { s3: s3.status, s4: s4.status, g: gP.status, e: gP.j && gP.j.error });

    ok('stderr del server sin crash (ReferenceError/TypeError)', !/ReferenceError|TypeError: .*(is not a function|of undefined)/.test(serr), { serr: serr.slice(-400) });
  } catch (e) {
    console.error('HARNESS ERROR:', e);
    R.push({ name: 'harness sin excepción', pass: false });
  } finally {
    const pass = R.filter(x => x.pass).length;
    console.log(`\n══ RESULTADO: ${pass}/${R.length} ══`);
    cleanup();
    process.exit(pass === R.length ? 0 : 1);
  }
})();
