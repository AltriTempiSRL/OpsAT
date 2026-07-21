#!/usr/bin/env node
// Suite funcional HTTP del paquete GPS v204 (mapa de auxiliares):
//   - RBAC configurable del mapa (wwp.mapa_auxiliares) + minimización lastLocation
//   - Geo-verificación de evidencia contra el destino de la tarea (gpsCoords)
//   - Alerta "evidencia lejos del destino" (1× por tarea)
//   - Alerta "chofer sin señal" (stale-check manual)
//   - Endpoint de adopción del rastreo (7 días)
// Levanta el proxy real con DATA_DIR temporal y un mock Odoo mínimo (las rutas
// geo no llaman Odoo; el mock evita ruido de arranque). Correr desde la raíz:
//   node tests/test-geo-contract.mjs

import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import https from 'node:https';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const PASSWORD = 'WWP2026!';
const ADMIN_EMAIL = 'gsanchez@altritempi.com.do';
const ADMIN_PASSWORD = 'Admin2026!';

// Destino de prueba: Zona Colonial SD. "Cerca" ≈ 70 m; "lejos" ≈ 5.5 km.
const DEST = { lat: 18.4861, lng: -69.9312 };
const NEAR = { lat: 18.48672, lng: -69.9312 };
const FAR  = { lat: 18.5355, lng: -69.9312 };

function createCertificate(dir) {
  const key = path.join(dir, 'mock-odoo-key.pem');
  const cert = path.join(dir, 'mock-odoo-cert.pem');
  const r = spawnSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-keyout', key, '-out', cert,
    '-days', '2', '-nodes', '-subj', '/CN=127.0.0.1'], { stdio: 'ignore' });
  if (r.status !== 0) {
    // Fallback: certs del repo (los usan otros harnesses; quedaron a propósito en la raíz)
    return { key: fs.readFileSync(path.join(root, '_fakekey.pem')), cert: fs.readFileSync(path.join(root, '_fakecert.pem')) };
  }
  return { key: fs.readFileSync(key), cert: fs.readFileSync(cert) };
}

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', resolve).once('error', reject));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

async function startMockOdoo(certDir) {
  const tls = createCertificate(certDir);
  const server = https.createServer(tls, (req, res) => {
    let raw = '';
    req.on('data', c => { raw += c; });
    req.on('end', () => {
      let payload = {};
      try { payload = JSON.parse(raw || '{}'); } catch {}
      const params = payload.params || {};
      let result = null;
      if (params.service === 'common' && params.method === 'authenticate') result = 1;
      else if (params.service === 'object') {
        const method = (params.args || [])[4];
        result = method === 'search_count' ? 0 : [];
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ jsonrpc: '2.0', id: payload.id || null, result }));
    });
  });
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', resolve).once('error', reject));
  return { server, port: server.address().port };
}

async function startApp(mockPort, extraEnv = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'geo-http-'));
  const port = await freePort();
  const logs = [];
  const child = spawn(process.execPath, ['proxy.js'], {
    cwd: root,
    env: {
      ...process.env,
      DATA_DIR: dataDir,
      PORT: String(port),
      ODOO_URL: `https://127.0.0.1:${mockPort}`,
      ODOO_DB: 'test-db', ODOO_USER: 'test-user', ODOO_API_KEY: 'test-key',
      JWT_SECRET: 'geo-tests-only-secret-at-least-32-bytes!',
      NODE_TLS_REJECT_UNAUTHORIZED: '0',
      INV_WATCHDOG: '0', INV_TRANSIT_RECON_MINUTES: '0',
      GEO_STALE_CHECK_MINUTES: '0',       // sin job automático: se dispara manual
      GEO_VERIFY_RADIUS_M: '300',
      GEO_SILENT_HOURS: '0',              // cualquier silencio alerta (stale-check)
      GEO_SILENT_GRACE_MIN: '0',
      ...extraEnv,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  child.stdout.on('data', b => logs.push(String(b)));
  child.stderr.on('data', b => logs.push(String(b)));
  const base = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (child.exitCode != null) throw new Error('proxy terminó al arrancar:\n' + logs.join('').slice(-4000));
    try {
      const r = await fetch(base + '/api/health');
      if (r.status === 200 || r.status === 502) return { child, base, dataDir, logs };
    } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  child.kill();
  throw new Error('Timeout arrancando proxy:\n' + logs.join('').slice(-4000));
}

async function stopApp(app) {
  if (!app) return;
  if (app.child.exitCode == null) app.child.kill();
  await new Promise(r => setTimeout(r, 300));
  const resolved = path.resolve(app.dataDir);
  if (resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(resolved).startsWith('geo-http-')) {
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}

async function api(base, pathname, { token, method = 'GET', body } = {}) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const r = await fetch(base + pathname, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text();
  let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: r.status, data };
}

async function login(base, email, password = PASSWORD) {
  const r = await api(base, '/api/wwp/auth/login', { method: 'POST', body: { email, password } });
  assert.equal(r.status, 200, 'login ' + email + ': ' + JSON.stringify(r.data));
  return r.data;
}

async function createUser(base, token, { name, email, role }) {
  const r = await api(base, '/api/wwp/auth/users', { token, method: 'POST', body: { name, email, password: PASSWORD, role } });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  return r.data.user;
}

async function patchRole(base, token, roleId, sectionPerms) {
  const r = await api(base, '/api/wwp/role-defs/' + encodeURIComponent(roleId), { token, method: 'PATCH', body: { sectionPerms } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  return r.data.role;
}

// Siembra una tarea directamente en DATA_DIR (el proxy relee el archivo por request).
function seedTask(dataDir, task) {
  const file = path.join(dataDir, 'wwp-tasks.json');
  const tasks = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
  tasks.push(task);
  fs.writeFileSync(file, JSON.stringify(tasks), 'utf8');
  return task.id;
}

function readTasks(dataDir) {
  return JSON.parse(fs.readFileSync(path.join(dataDir, 'wwp-tasks.json'), 'utf8'));
}

function readNotifs(dataDir) {
  const f = path.join(dataDir, 'wwp-notifications.json');
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : [];
}

function mkTask(id, over = {}) {
  const now = new Date().toISOString();
  return {
    id, seq: 9000, title: 'Despacho geo ' + id, type: 'dispatch_order', status: 'in_progress',
    priority: 'medium', sdvId: null, assignedTo: null, managerId: null, executors: [], assignees: [],
    gpsCoords: DEST.lat + ', ' + DEST.lng, deliveryAddress: 'Calle El Conde 1',
    evidence: [], items: [],
    statusHistory: [{ status: 'in_progress', date: new Date(Date.now() - 3600000).toISOString(), by: 'Test' }],
    createdAt: now, updatedAt: now, ...over,
  };
}

const results = [];
async function check(name, fn) {
  try { await fn(); results.push({ name, ok: true }); console.log('✓ ' + name); }
  catch (e) { results.push({ name, ok: false, error: e }); console.log('✗ ' + name + '\n   ' + (e.message || e)); }
}

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'geo-certs-'));
const mock = await startMockOdoo(scratch);
let app;

try {
  app = await startApp(mock.port);
  const admin = await login(app.base, ADMIN_EMAIL, ADMIN_PASSWORD);
  const aux = await createUser(app.base, admin.accessToken, { name: 'Aux Geo', email: 'auxgeo@test.local', role: 'assistant' });
  const auxSession = await login(app.base, 'auxgeo@test.local');
  const mgr = await createUser(app.base, admin.accessToken, { name: 'Mgr Geo', email: 'mgrgeo@test.local', role: 'manager' });
  const mgrSession = await login(app.base, 'mgrgeo@test.local');

  await check('RBAC: mapa sin token → 401', async () => {
    const r = await api(app.base, '/api/wwp/auth/locations');
    assert.equal(r.status, 401);
  });

  await check('RBAC: manager sin permiso NO ve mapa, recorrido ni adopción', async () => {
    for (const p of ['/api/wwp/auth/locations', '/api/wwp/auth/users/' + aux.id + '/locations', '/api/wwp/auth/locations/adoption']) {
      const r = await api(app.base, p, { token: mgrSession.accessToken });
      assert.equal(r.status, 403, p + ' → ' + r.status);
    }
  });

  await check('POST /location: el auxiliar escribe SU ubicación (userId del JWT)', async () => {
    const r = await api(app.base, '/api/wwp/auth/location', { token: auxSession.accessToken, method: 'POST',
      body: { lat: NEAR.lat, lng: NEAR.lng, accuracy: 10, context: 'permiso inicial', userId: 'au_gsanchez' } });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    const locs = await api(app.base, '/api/wwp/auth/locations', { token: admin.accessToken });
    assert.equal(locs.status, 200);
    const me = (locs.data.users || []).find(u => u.id === aux.id);
    assert.ok(me, 'el auxiliar debe aparecer en el mapa');
    assert.ok(!(locs.data.users || []).some(u => u.id === 'au_gsanchez' && u.lastLocation && Math.abs(u.lastLocation.lat - NEAR.lat) < 1e-9),
      'el body no puede plantar la ubicación en otro usuario');
  });

  await check('RBAC: manager CON wwp.mapa_auxiliares ve mapa y adopción', async () => {
    await patchRole(app.base, admin.accessToken, 'manager', { 'wwp.mapa_auxiliares': true });
    const r1 = await api(app.base, '/api/wwp/auth/locations', { token: mgrSession.accessToken });
    assert.equal(r1.status, 200, JSON.stringify(r1.data));
    const r2 = await api(app.base, '/api/wwp/auth/locations/adoption', { token: mgrSession.accessToken });
    assert.equal(r2.status, 200);
    await patchRole(app.base, admin.accessToken, 'manager', {});
  });

  await check('Minimización: manager sin permiso de mapa NO recibe lastLocation en /users', async () => {
    const r = await api(app.base, '/api/wwp/auth/users', { token: mgrSession.accessToken });
    assert.equal(r.status, 200);
    assert.ok(r.data.every(u => u.lastLocation == null), 'lastLocation debe viajar null a roles sin mapa');
    const ra = await api(app.base, '/api/wwp/auth/users', { token: admin.accessToken });
    assert.ok(ra.data.some(u => u.lastLocation != null), 'admin sí la recibe');
  });

  await check('Geo-verificación: punto cercano sella geoCheck.ok=true en la tarea', async () => {
    const tid = seedTask(app.dataDir, mkTask('wt_geo_near'));
    const r = await api(app.base, '/api/wwp/auth/location', { token: auxSession.accessToken, method: 'POST',
      body: { lat: NEAR.lat, lng: NEAR.lng, accuracy: 8, context: 'foto entrega', taskId: tid } });
    assert.equal(r.status, 200);
    assert.ok(r.data.geoCheck, 'la respuesta trae geoCheck');
    assert.equal(r.data.geoCheck.ok, true, 'a ~70 m del destino debe verificar');
    const t = readTasks(app.dataDir).find(x => x.id === tid);
    assert.ok(t.geoCheck && t.geoCheck.ok === true && t.geoCheck.minDistM <= 300, JSON.stringify(t.geoCheck));
    assert.ok(!readNotifs(app.dataDir).some(n => n.type === 'geo_evidencia_lejos' && n.relatedTaskId === tid),
      'cerca del destino NO alerta');
  });

  await check('Geo-verificación: foto lejos alerta UNA vez y no verifica', async () => {
    const tid = seedTask(app.dataDir, mkTask('wt_geo_far', { managerId: mgr.id }));
    for (let i = 0; i < 2; i++) {
      const r = await api(app.base, '/api/wwp/auth/location', { token: auxSession.accessToken, method: 'POST',
        body: { lat: FAR.lat, lng: FAR.lng, accuracy: 8, context: 'foto entrega', taskId: tid } });
      assert.equal(r.status, 200);
      assert.equal(r.data.geoCheck.ok, false, 'a ~5.5 km NO debe verificar');
    }
    const t = readTasks(app.dataDir).find(x => x.id === tid);
    assert.ok(t.geoCheck.minDistM > 1000, 'distancia sellada en km');
    const alerts = readNotifs(app.dataDir).filter(n => n.type === 'geo_evidencia_lejos' && n.relatedTaskId === tid);
    assert.ok(alerts.length >= 1, 'debe alertar');
    const porUsuario = {};
    alerts.forEach(n => { porUsuario[n.userId] = (porUsuario[n.userId] || 0) + 1; });
    assert.ok(Object.values(porUsuario).every(c => c === 1), '1 alerta por destinatario aunque lleguen más fotos lejos');
    assert.ok(alerts.some(n => n.userId === mgr.id), 'el encargado de la tarea recibe la alerta');
  });

  await check('Geo-verificación: tarea sin gpsCoords no sella nada', async () => {
    const tid = seedTask(app.dataDir, mkTask('wt_geo_nogps', { gpsCoords: null }));
    const r = await api(app.base, '/api/wwp/auth/location', { token: auxSession.accessToken, method: 'POST',
      body: { lat: NEAR.lat, lng: NEAR.lng, context: 'foto entrega', taskId: tid } });
    assert.equal(r.status, 200);
    assert.equal(r.data.geoCheck, null);
    const t = readTasks(app.dataDir).find(x => x.id === tid);
    assert.ok(!t.geoCheck, 'sin destino no hay veredicto');
  });

  await check('Sin señal: stale-check alerta 1× la tarea en curso del chofer callado', async () => {
    const tid = seedTask(app.dataDir, mkTask('wt_geo_silent', {
      executors: [aux.id], managerId: mgr.id,
      statusHistory: [{ status: 'in_progress', date: new Date(Date.now() - 2 * 3600000).toISOString(), by: 'Test' }],
    }));
    const r1 = await api(app.base, '/api/wwp/auth/locations/stale-check', { token: admin.accessToken, method: 'POST' });
    assert.equal(r1.status, 200);
    assert.ok(r1.data.alerted >= 1, 'debe alertar al menos la tarea sembrada: ' + JSON.stringify(r1.data));
    const t = readTasks(app.dataDir).find(x => x.id === tid);
    assert.ok(t.geoSilenceAlertAt, 'la tarea queda marcada');
    assert.ok(readNotifs(app.dataDir).some(n => n.type === 'geo_sin_senal' && n.relatedTaskId === tid), 'notificación creada');
    const r2 = await api(app.base, '/api/wwp/auth/locations/stale-check', { token: admin.accessToken, method: 'POST' });
    const again = readNotifs(app.dataDir).filter(n => n.type === 'geo_sin_senal' && n.relatedTaskId === tid);
    const porUser = {};
    again.forEach(n => { porUser[n.userId] = (porUser[n.userId] || 0) + 1; });
    assert.ok(Object.values(porUser).every(c => c === 1), 'no re-alerta la misma tarea');
  });

  await check('Adopción: cuenta puntos 7d por auxiliar rastreado', async () => {
    const r = await api(app.base, '/api/wwp/auth/locations/adoption', { token: admin.accessToken });
    assert.equal(r.status, 200);
    const me = (r.data.users || []).find(u => u.id === aux.id);
    assert.ok(me, 'el auxiliar con rastreo aparece');
    assert.ok(me.pts7d >= 4, 'los puntos posteados cuentan: ' + JSON.stringify(me));
    assert.ok(!(r.data.users || []).some(u => u.role === 'admin'), 'admins no se rastrean ni se listan');
  });

} finally {
  await stopApp(app);
  await new Promise(r => mock.server.close(r));
  fs.rmSync(scratch, { recursive: true, force: true });
}

const failed = results.filter(x => !x.ok);
console.log('\nGeo v204: ' + (results.length - failed.length) + '/' + results.length + ' pruebas aprobadas.');
if (failed.length) process.exit(1);
