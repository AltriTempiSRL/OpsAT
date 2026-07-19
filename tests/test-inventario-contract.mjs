#!/usr/bin/env node

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

const state = {
  calls: [],
  negativeQty: -2,
  negativeFailures: false,
  duplicateFailures: false,
  transitPresent: true,
  transitQty: 3,
  transitReserved: 0,
  transitOpenQty: 0,
  sellableReserved: 2,
  delayNext: null,
};

const products = {
  101: { id: 101, default_code: 'TR-101', name: 'Artículo en tránsito', barcode: '101101' },
  202: { id: 202, default_code: 'NEG-202', name: 'Artículo negativo', barcode: '202202' },
  777: { id: 777, default_code: 'KX-777', name: 'Artículo kardex', barcode: '777777', image_128: false },
};

function domainHas(domain, field, op, predicate = () => true) {
  return Array.isArray(domain) && domain.some(term => Array.isArray(term) && term[0] === field && term[1] === op && predicate(term[2]));
}

function rpcError(message) {
  const error = new Error(message);
  error.rpc = true;
  throw error;
}

function dispatchOdoo(model, method, args, kwargs) {
  const domain = Array.isArray(args) ? (args[0] || []) : [];
  state.calls.push({ model, method, args, kwargs, at: Date.now() });

  if (model === 'stock.location' && method === 'search_read') {
    if (domainHas(domain, 'usage', '=', v => v === 'transit')) {
      return [{ id: 900, complete_name: 'ALVEN/Transit/CDP Transferencias Internas', name: 'CDP Transferencias Internas' }];
    }
    if (domainHas(domain, 'complete_name', 'like')) return [{ id: 900 }];
    if (domainHas(domain, 'complete_name', 'ilike')) return [];
    if (domainHas(domain, 'id', 'child_of')) return [{ id: 24 }, { id: 25 }];
    if (domainHas(domain, 'usage', '=', v => v === 'internal')) {
      return [
        { id: 1, complete_name: 'ALVEN/Stock', name: 'Stock', location_id: false },
        { id: 24, complete_name: 'ALVEN/Stock/A-CDP', name: 'A-CDP', location_id: [1, 'ALVEN/Stock'] },
        { id: 25, complete_name: 'ALVEN/Stock/A-CDP/BIN-01', name: 'BIN-01', location_id: [24, 'ALVEN/Stock/A-CDP'] },
        { id: 26, complete_name: 'ALVEN/Stock/BIN-VENDIBLE', name: 'BIN-VENDIBLE', location_id: [1, 'ALVEN/Stock'] },
      ];
    }
    if (domainHas(domain, 'id', 'in')) {
      return [
        { id: 1, usage: 'internal', complete_name: 'ALVEN/Stock', name: 'Stock', location_id: false },
        { id: 24, usage: 'internal', complete_name: 'ALVEN/Stock/A-CDP', name: 'A-CDP', location_id: [1, 'ALVEN/Stock'] },
        { id: 25, usage: 'internal', complete_name: 'ALVEN/Stock/A-CDP/BIN-01', name: 'BIN-01', location_id: [24, 'ALVEN/Stock/A-CDP'] },
        { id: 26, usage: 'internal', complete_name: 'ALVEN/Stock/BIN-VENDIBLE', name: 'BIN-VENDIBLE', location_id: [1, 'ALVEN/Stock'] },
        { id: 900, usage: 'transit', complete_name: 'ALVEN/Transit/CDP Transferencias Internas', name: 'CDP Transferencias Internas', location_id: false },
      ];
    }
    if (domainHas(domain, 'location_id', 'in')) return [{ id: 25, location_id: [24, 'ALVEN/Stock/A-CDP'] }];
    return [];
  }

  if (model === 'stock.quant' && method === 'search_read') {
    if (domainHas(domain, 'quantity', '<', v => v === 0)) {
      if (state.negativeFailures) rpcError('mock: negativos no disponibles');
      return state.negativeQty < 0
        ? [{ id: 1, product_id: [202, products[202].name], location_id: [24, 'ALVEN/Stock/A-CDP'], quantity: state.negativeQty, reserved_quantity: 0 }]
        : [];
    }
    if (domainHas(domain, 'product_id', '=', v => Number(v) === 777)) {
      return [
        { id: 70, product_id: [777, products[777].name], location_id: [24, 'ALVEN/Stock/A-CDP'], quantity: -2, reserved_quantity: 0 },
        { id: 71, product_id: [777, products[777].name], location_id: [26, 'ALVEN/Stock/BIN-VENDIBLE'], quantity: 2, reserved_quantity: 0 },
      ];
    }
    if (domainHas(domain, 'location_id', 'in', v => Array.isArray(v) && v.includes(900))) {
      return state.transitPresent ? [{
        id: 2, product_id: [101, products[101].name], location_id: [900, 'ALVEN/Transit/CDP Transferencias Internas'],
        quantity: state.transitQty, reserved_quantity: state.transitReserved, in_date: '2026-07-01 12:00:00',
      }] : [];
    }
    if (domainHas(domain, 'product_id', 'in') && domainHas(domain, 'location_id.usage', '=')) {
      return [
        { id: 3, product_id: [101, products[101].name], location_id: [26, 'ALVEN/Stock/BIN-VENDIBLE'], quantity: 5, reserved_quantity: state.sellableReserved },
        { id: 4, product_id: [101, products[101].name], location_id: [25, 'ALVEN/Stock/A-CDP/BIN-01'], quantity: 9, reserved_quantity: 0 },
      ];
    }
    return [];
  }

  if (model === 'stock.quant' && method === 'read_group') {
    if (domainHas(domain, 'location_id.usage', '=', v => v === 'internal')) return [{ quantity: 100 }];
    if (domainHas(domain, 'location_id.usage', '=', v => v === 'inventory')) return [{ quantity: 0 }];
    if (domainHas(domain, 'location_id', 'in')) return [{ quantity: 0 }];
    return [];
  }

  if (model === 'product.template' && method === 'search_count') {
    if (domainHas(domain, 'name', 'ilike')) {
      if (state.duplicateFailures) rpcError('mock: conteo de duplicados denegado');
      return 1;
    }
    return 100;
  }

  if (model === 'product.product' && method === 'search_read') {
    const idsTerm = domain.find(term => Array.isArray(term) && term[0] === 'id' && term[1] === 'in');
    const ids = idsTerm && Array.isArray(idsTerm[2]) ? idsTerm[2] : Object.keys(products).map(Number);
    return ids.map(id => products[id]).filter(Boolean);
  }

  if (model === 'product.product' && method === 'read') {
    const ids = Array.isArray(args[0]) ? args[0] : [];
    return ids.map(id => products[id]).filter(Boolean);
  }

  if (model === 'stock.picking' && method === 'search_read') return [];
  if (model === 'stock.picking' && method === 'read') {
    const ids = Array.isArray(args[0]) ? args[0] : [];
    return ids.map(id => ({ id, user_id: [48, 'Encargado Mock'], write_uid: [1, 'Admin Mock'], location_dest_id: [26, 'ALVEN/Stock/BIN-VENDIBLE'] }));
  }

  if (model === 'stock.move' && method === 'search_count') return domainHas(domain, 'product_id', '=', v => Number(v) === 777) ? 3 : 0;
  if (model === 'stock.move' && method === 'search_read') {
    if (domainHas(domain, 'product_id', '=', v => Number(v) === 777)) {
      return [
        { id: 703, date: '2026-07-13 12:00:00', reference: 'DRAFT-NEG', location_id: [24, 'ALVEN/Stock/A-CDP'], location_dest_id: [26, 'ALVEN/Stock/BIN-VENDIBLE'], product_uom_qty: 15, quantity_done: 0, state: 'draft', picking_id: [703, 'DRAFT-NEG'] },
        { id: 702, date: '2026-07-12 12:00:00', reference: 'CANCEL-NEG', location_id: [24, 'ALVEN/Stock/A-CDP'], location_dest_id: [26, 'ALVEN/Stock/BIN-VENDIBLE'], product_uom_qty: 9, quantity_done: 0, state: 'cancel', picking_id: [702, 'CANCEL-NEG'] },
        { id: 701, date: '2026-07-11 12:00:00', reference: 'DONE-NEG', location_id: [24, 'ALVEN/Stock/A-CDP'], location_dest_id: [26, 'ALVEN/Stock/BIN-VENDIBLE'], product_uom_qty: 2, quantity_done: 2, state: 'done', picking_id: [701, 'DONE-NEG'] },
      ];
    }
    if (domainHas(domain, 'location_id', 'in', v => Array.isArray(v) && v.includes(900))) {
      return state.transitOpenQty > 0 ? [{
        id: 602, product_id: [101, products[101].name], location_id: [900, 'ALVEN/Transit/CDP Transferencias Internas'],
        location_dest_id: [26, 'ALVEN/Stock/BIN-VENDIBLE'], product_uom_qty: state.transitOpenQty, quantity_done: 0, state: 'assigned',
      }] : [];
    }
    if (domainHas(domain, 'location_dest_id', 'in', v => Array.isArray(v) && v.includes(900))) {
      return state.transitPresent ? [{ id: 601, product_id: [101, products[101].name], location_dest_id: [900, 'ALVEN/Transit/CDP Transferencias Internas'], picking_id: [501, 'CDP/INT/00501'], date: '2026-07-01 12:00:00', state: 'done' }] : [];
    }
    return [];
  }

  return method === 'search_count' ? 0 : [];
}

function findOpenSsl() {
  const candidates = [
    process.env.OPENSSL_BIN,
    process.platform === 'win32' ? 'C:\\Program Files\\Git\\mingw64\\bin\\openssl.exe' : null,
    'openssl',
  ].filter(Boolean);
  for (const candidate of candidates) {
    const probe = spawnSync(candidate, ['version'], { encoding: 'utf8', windowsHide: true });
    if (!probe.error && probe.status === 0) return candidate;
  }
  throw new Error('OpenSSL es requerido para crear el certificado efímero del mock Odoo');
}

function createCertificate(dir) {
  const key = path.join(dir, 'mock-odoo-key.pem');
  const cert = path.join(dir, 'mock-odoo-cert.pem');
  const openssl = findOpenSsl();
  const out = spawnSync(openssl, [
    'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert,
    '-subj', '/CN=127.0.0.1', '-days', '2',
  ], { encoding: 'utf8', windowsHide: true });
  if (out.status !== 0) throw new Error('No se pudo crear certificado mock: ' + (out.stderr || out.error?.message || 'openssl'));
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
    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => {
      let payload;
      try {
        payload = JSON.parse(raw || '{}');
      } catch (error) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ jsonrpc: '2.0', id: payload?.id || null, error: { code: 1, message: error.message, data: { message: error.message } } }));
        return;
      }
      const params = payload.params || {};
      const rpcArgs = params.args || [];
      const model = rpcArgs[3];
      const method = rpcArgs[4];
      const callArgs = rpcArgs[5] || [];
      const delayed = state.delayNext;
      const matchesDelay = delayed && delayed.model === model && delayed.method === method &&
        (!delayed.domainField || domainHas(callArgs[0] || [], delayed.domainField, delayed.domainOp || '=', v => delayed.domainAny || v === delayed.domainValue));
      const execute = () => {
        if (res.destroyed) return;
        try {
          let result;
          if (params.service === 'common' && params.method === 'authenticate') {
            result = 1;
          } else if (params.service === 'object' && params.method === 'execute_kw') {
            const [, , , rpcModel, rpcMethod, args = [], kwargs = {}] = rpcArgs;
            result = dispatchOdoo(rpcModel, rpcMethod, args, kwargs);
          } else {
            result = null;
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ jsonrpc: '2.0', id: payload.id, result }));
        } catch (error) {
          if (res.destroyed) return;
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ jsonrpc: '2.0', id: payload.id, error: { code: 1, message: error.message, data: { message: error.message } } }));
        }
      };
      if (matchesDelay) {
        state.delayNext = null;
        setTimeout(execute, Math.max(0, delayed.ms || 0));
      } else {
        execute();
      }
    });
  });
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', resolve).once('error', reject));
  return { server, port: server.address().port };
}

async function stopServer(server) {
  if (!server?.listening) return;
  await new Promise(resolve => server.close(resolve));
}

async function waitForExit(child, timeoutMs = 5000) {
  if (!child || child.exitCode != null) return;
  await Promise.race([
    new Promise(resolve => child.once('exit', resolve)),
    new Promise(resolve => setTimeout(resolve, timeoutMs)),
  ]);
}

async function startApp(mockPort, extraEnv = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inventario-http-'));
  const port = await freePort();
  const logs = [];
  const child = spawn(process.execPath, ['proxy.js'], {
    cwd: root,
    env: {
      ...process.env,
      DATA_DIR: dataDir,
      PORT: String(port),
      ODOO_URL: `https://127.0.0.1:${mockPort}`,
      ODOO_DB: 'test-db',
      ODOO_USER: 'test-user',
      ODOO_API_KEY: 'test-key',
      JWT_SECRET: 'inventory-tests-only-secret-32-bytes-minimum',
      NODE_TLS_REJECT_UNAUTHORIZED: '0',
      INV_WATCHDOG: '0',
      INV_TRANSIT_RECON_MINUTES: '0',
      INV_SELLABLE_LOCATION_IDS: '26',
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
      const response = await fetch(base + '/api/health');
      if (response.status === 200 || response.status === 502) return { child, base, dataDir, logs };
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  child.kill();
  throw new Error('Timeout arrancando proxy:\n' + logs.join('').slice(-4000));
}

async function stopApp(app) {
  if (!app) return;
  if (app.child.exitCode == null) app.child.kill();
  await waitForExit(app.child);
  const resolved = path.resolve(app.dataDir);
  const tempRoot = path.resolve(os.tmpdir());
  if (resolved.startsWith(tempRoot + path.sep) && path.basename(resolved).startsWith('inventario-http-')) {
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}

async function api(base, pathname, { token, method = 'GET', body } = {}) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(base + pathname, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: response.status, data, headers: response.headers };
}

async function login(base, email, password = PASSWORD) {
  const response = await api(base, '/api/wwp/auth/login', { method: 'POST', body: { email, password } });
  assert.equal(response.status, 200, 'login ' + email + ': ' + JSON.stringify(response.data));
  assert.ok(response.data?.accessToken, 'login sin accessToken para ' + email);
  return response.data;
}

async function patchRole(base, token, roleId, sectionPerms) {
  const response = await api(base, '/api/wwp/role-defs/' + encodeURIComponent(roleId), { token, method: 'PATCH', body: { sectionPerms } });
  assert.equal(response.status, 200, JSON.stringify(response.data));
  return response.data.role;
}

async function createUser(base, token, { name, email, role }) {
  const response = await api(base, '/api/wwp/auth/users', { token, method: 'POST', body: { name, email, password: PASSWORD, role } });
  assert.equal(response.status, 201, JSON.stringify(response.data));
  return response.data.user;
}

const results = [];
async function check(name, fn) {
  const started = Date.now();
  try {
    await fn();
    results.push({ name, ok: true, ms: Date.now() - started });
    console.log('✓', name);
  } catch (error) {
    results.push({ name, ok: false, ms: Date.now() - started, error });
    console.error('✗', name, '\n  ', error.message);
  }
}

function readCases(dataDir) {
  const file = path.join(dataDir, 'wwp-inventario-casos.json');
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
}

let mock;
let app;
let degradedApp;
let secondApp;
let timeoutApp;
const certDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inventario-cert-'));

try {
  mock = await startMockOdoo(certDir);
  app = await startApp(mock.port);
  const admin = await login(app.base, ADMIN_EMAIL, ADMIN_PASSWORD);
  const adminToken = admin.accessToken;
  const manager = await login(app.base, 'fcandelario@altritempi.com.do');
  const assistant = await login(app.base, 'adelacruz@altritempi.com.do');

  await check('RBAC: sin token recibe 401', async () => {
    const r = await api(app.base, '/api/inventario/panorama');
    assert.equal(r.status, 401);
  });

  await check('RBAC: assistant recibe 403 aunque conozca la URL', async () => {
    const r = await api(app.base, '/api/inventario/panorama', { token: assistant.accessToken });
    assert.equal(r.status, 403);
  });

  await patchRole(app.base, adminToken, 'manager', { inventario: true });
  let firstPanorama;
  let initialNegativeCalls;
  let initialPanoramaAt;
  await check('RBAC: manager con inventario:true recibe 200', async () => {
    initialPanoramaAt = Date.now();
    const r = await api(app.base, '/api/inventario/panorama', { token: manager.accessToken });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.equal(r.data?.ok, true);
    firstPanorama = r.data;
    assert.equal(r.data.senales.s3.allowlistConfigured, true);
    assert.equal(r.data.senales.s3.confiabilidad, 'alta');
    assert.equal(r.data.senales.s3.count, 1);
    assert.equal(r.data.senales.s3.items[0].unidadesBinVendible, 3, 'S3 debe usar quantity - reserved_quantity');
    assert.deepEqual(r.data.senales.s3.items[0].bins.map(b => b.locId), [26], 'S3 debe respetar allowlist explícita');
    initialNegativeCalls = state.calls.filter(c => c.model === 'stock.quant' && c.method === 'search_read' && domainHas(c.args?.[0], 'quantity', '<')).length;
    assert.ok(initialNegativeCalls >= 1);
  });

  await check('RBAC: manager con inventario:false recibe 403', async () => {
    await patchRole(app.base, adminToken, 'manager', { inventario: false });
    const r = await api(app.base, '/api/inventario/panorama', { token: manager.accessToken });
    assert.equal(r.status, 403, JSON.stringify(r.data));
    await patchRole(app.base, adminToken, 'manager', { inventario: true });
  });

  await check('RBAC: admin conserva acceso 200', async () => {
    const r = await api(app.base, '/api/inventario/panorama', { token: adminToken });
    assert.equal(r.status, 200, JSON.stringify(r.data));
  });

  let customRole;
  let customUser;
  await check('RBAC: rol personalizado con inventario:true recibe 200', async () => {
    const roleResp = await api(app.base, '/api/wwp/role-defs', { token: adminToken, method: 'POST', body: { name: 'Auditor Inventario', sectionPerms: { inventario: true } } });
    assert.equal(roleResp.status, 200, JSON.stringify(roleResp.data));
    customRole = roleResp.data.role;
    customUser = await createUser(app.base, adminToken, { name: 'Auditor Inventario', email: 'inventario.custom@example.test', role: customRole.id });
    const session = await login(app.base, 'inventario.custom@example.test');
    const r = await api(app.base, '/api/inventario/panorama', { token: session.accessToken });
    assert.equal(r.status, 200, JSON.stringify(r.data));
  });

  await check('RBAC: token de usuario desactivado deja de autorizar', async () => {
    const user = await createUser(app.base, adminToken, { name: 'Manager Revocable', email: 'manager.revocable@example.test', role: 'manager' });
    const session = await login(app.base, 'manager.revocable@example.test');
    const disabled = await api(app.base, '/api/wwp/auth/users/' + user.id, { token: adminToken, method: 'PATCH', body: { active: false } });
    assert.equal(disabled.status, 200, JSON.stringify(disabled.data));
    const denied = await api(app.base, '/api/inventario/panorama', { token: session.accessToken });
    assert.ok([401, 403].includes(denied.status), 'token desactivado todavía obtuvo HTTP ' + denied.status);
  });

  await check('RBAC: token con rol cambiado deja de conservar privilegio manager', async () => {
    const user = await createUser(app.base, adminToken, { name: 'Manager Mutable', email: 'manager.mutable@example.test', role: 'manager' });
    const session = await login(app.base, 'manager.mutable@example.test');
    const changed = await api(app.base, '/api/wwp/auth/users/' + user.id, { token: adminToken, method: 'PATCH', body: { role: 'assistant' } });
    assert.equal(changed.status, 200, JSON.stringify(changed.data));
    const denied = await api(app.base, '/api/inventario/panorama', { token: session.accessToken });
    assert.ok([401, 403].includes(denied.status), 'token con rol anterior todavía obtuvo HTTP ' + denied.status);
  });

  await check('Concurrencia: seed no sobrescribe un caso creado mientras espera Odoo', async () => {
    state.delayNext = { model: 'product.product', method: 'search_read', domainField: 'default_code', domainOp: 'in', domainAny: true, ms: 450 };
    const seedPromise = api(app.base, '/api/inventario/seed-caso-inicial', { token: adminToken, method: 'POST', body: {} });
    await new Promise(resolve => setTimeout(resolve, 100));
    const concurrent = await api(app.base, '/api/inventario/casos', { token: adminToken, method: 'POST', body: { titulo: 'Caso creado durante seed', items: [] } });
    assert.equal(concurrent.status, 200, JSON.stringify(concurrent.data));
    const seed = await seedPromise;
    assert.equal(seed.status, 409, JSON.stringify(seed.data));
    assert.ok(readCases(app.dataDir).some(c => c.id === concurrent.data.caso.id), 'el caso concurrente se perdió');
    const retry = await api(app.base, '/api/inventario/seed-caso-inicial', { token: adminToken, method: 'POST', body: {} });
    assert.equal(retry.status, 200, JSON.stringify(retry.data));
    assert.ok(retry.data.created.length > 0 || retry.data.already.length > 0);
  });

  await check('Salud: reconcilia la respuesta sin mutar el caso persistido', async () => {
    const created = await api(app.base, '/api/inventario/casos', {
      token: adminToken, method: 'POST',
      body: { titulo: 'Reaparición funcional', items: [{ ref: 'NEG-202', causa: 'B', productId: 202, productName: products[202].name, barcode: products[202].barcode }] },
    });
    assert.equal(created.status, 200, JSON.stringify(created.data));
    assert.equal(created.data.caso.items.length, 1);
    const caseId = created.data.caso.id;
    const itemId = created.data.caso.items[0].itemId;
    const corrected = await api(app.base, `/api/inventario/casos/${caseId}/items/${itemId}`, {
      token: adminToken, method: 'PATCH', body: { accion: 'corregir' },
    });
    assert.equal(corrected.status, 200, JSON.stringify(corrected.data));
    const before = readCases(app.dataDir).find(c => c.id === caseId).items[0];
    assert.equal(before.seguimiento, 'corregido');
    const health = await api(app.base, '/api/inventario/salud', { token: adminToken });
    assert.equal(health.status, 200, JSON.stringify(health.data));
    const responseItem = health.data.casos.find(c => c.id === caseId).items[0];
    assert.equal(responseItem.seguimiento, 'pendiente', 'la reaparición negativa debe verse de inmediato');
    assert.equal(responseItem.qtyNeg, state.negativeQty);
    const after = readCases(app.dataDir).find(c => c.id === caseId).items[0];
    assert.equal(after.seguimiento, 'corregido', 'GET /salud no debe persistir la conciliación');
    assert.equal(after.notas.length, before.notas.length, 'GET /salud escribió una nota en disco');
  });

  await check('Auditoría global: guarda con control de versión y es idempotente', async () => {
    const first = await api(app.base, '/api/inventario/auditoria-global', { token: adminToken, method: 'POST', body: {} });
    assert.equal(first.status, 200, JSON.stringify(first.data));
    const refsAfterFirst = readCases(app.dataDir).flatMap(c => c.items || []).filter(i => i.tipo !== 'transito').map(i => i.ref);
    const second = await api(app.base, '/api/inventario/auditoria-global', { token: adminToken, method: 'POST', body: {} });
    assert.equal(second.status, 200, JSON.stringify(second.data));
    const refsAfterSecond = readCases(app.dataDir).flatMap(c => c.items || []).filter(i => i.tipo !== 'transito').map(i => i.ref);
    assert.deepEqual(refsAfterSecond.slice().sort(), refsAfterFirst.slice().sort(), 'la segunda auditoría duplicó referencias');
  });

  await check('Casos cerrados: sus artículos quedan en solo lectura', async () => {
    const created = await api(app.base, '/api/inventario/casos', {
      token: adminToken, method: 'POST', body: { titulo: 'Caso cerrado funcional', items: [{ ref: 'CLOSED-1', causa: '?' }] },
    });
    assert.equal(created.status, 200, JSON.stringify(created.data));
    const caseId = created.data.caso.id;
    const itemId = created.data.caso.items[0].itemId;
    const closed = await api(app.base, `/api/inventario/casos/${caseId}/cerrar`, {
      token: adminToken, method: 'POST', body: { force: true },
    });
    assert.equal(closed.status, 200, JSON.stringify(closed.data));
    const denied = await api(app.base, `/api/inventario/casos/${caseId}/items/${itemId}`, {
      token: adminToken, method: 'PATCH', body: { accion: 'nota', texto: 'No debe guardarse' },
    });
    assert.equal(denied.status, 409, JSON.stringify(denied.data));
    const item = readCases(app.dataDir).find(c => c.id === caseId).items[0];
    assert.equal(item.notas.length, 0);
  });

  await check('Calidad: fallo parcial degrada higiene sin inventar score cero', async () => {
    state.duplicateFailures = true;
    degradedApp = await startApp(mock.port);
    const degradedAdmin = await login(degradedApp.base, ADMIN_EMAIL, ADMIN_PASSWORD);
    const r = await api(degradedApp.base, '/api/inventario/panorama', { token: degradedAdmin.accessToken });
    state.duplicateFailures = false;
    await stopApp(degradedApp);
    degradedApp = null;
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.equal(r.data.dataQuality.status, 'degraded');
    assert.equal(r.data.dataQuality.complete, false);
    assert.equal(r.data.scores.higiene.score, null);
    assert.notEqual(r.data.scores.fiabilidad.score, null);
    assert.ok(r.data.dataQuality.warnings.some(w => w.source === 'duplicados'));
  });

  await check('Anomalías: publica una foto completa sin límites silenciosos', async () => {
    const r = await api(app.base, '/api/inventario/anomalias', { token: adminToken });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.equal(r.data.dataQuality?.status, 'fresh');
    assert.equal(r.data.dataQuality?.complete, true);
    assert.equal(r.data.dataQuality?.truncated, false);
    assert.ok(Array.isArray(r.data.parentNodes));
    assert.ok(Array.isArray(r.data.frozenRoots));
  });

  await check('Tránsito: separa cobertura parcial de cantidad huérfana', async () => {
    state.transitPresent = true;
    state.transitQty = 3;
    state.transitReserved = 1;
    state.transitOpenQty = 1;
    const elapsed = Date.now() - initialPanoramaAt;
    if (elapsed < 2_100) await new Promise(resolve => setTimeout(resolve, 2_100 - elapsed));
    const r = await api(app.base, '/api/transit/monitor?refresh=1', { token: adminToken });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    const item = r.data.locations[0].items[0];
    assert.equal(item.qtyTotal, 3);
    assert.equal(item.qtyPendiente, 1);
    assert.equal(item.qtyHuerfana, 2);
    assert.equal(item.qty, 2);
    assert.equal(r.data.totals.countMixtos, 1);
    assert.equal(r.data.totals.unidadesPendientes, 1);
    assert.equal(r.data.totals.unidadesHuerfanas, 2);
    state.transitReserved = 0;
    state.transitOpenQty = 0;
  });

  await check('Tránsito: conciliación es idempotente y no oscila', async () => {
    state.transitPresent = true;
    state.transitReserved = 0;
    state.transitOpenQty = 0;
    const created = await api(app.base, '/api/inventario/casos', { token: adminToken, method: 'POST', body: { titulo: 'Caso tránsito funcional', items: [] } });
    assert.equal(created.status, 200, JSON.stringify(created.data));
    const caseId = created.data.caso.id;
    const added = await api(app.base, `/api/inventario/casos/${caseId}/transito`, {
      token: adminToken, method: 'POST', body: { prodId: 101, locId: 900, ref: 'TR-101', name: products[101].name, qty: 3, locName: 'CDP Transferencias Internas' },
    });
    assert.equal(added.status, 200, JSON.stringify(added.data));

    let item = readCases(app.dataDir).find(c => c.id === caseId).items[0];
    assert.equal(item.seguimiento, 'pendiente');

    state.transitPresent = false;
    await new Promise(resolve => setTimeout(resolve, 5_200));
    let r = await api(app.base, '/api/inventario/snapshot-run', { token: adminToken, method: 'POST', body: {} });
    assert.equal(r.status, 200);
    item = readCases(app.dataDir).find(c => c.id === caseId).items[0];
    assert.equal(item.seguimiento, 'corregido');
    assert.equal(item.corregidoAuto, true);
    const correctedNotes = item.notas.length;
    const correctedAt = item.corregidoAt;

    r = await api(app.base, '/api/inventario/snapshot-run', { token: adminToken, method: 'POST', body: {} });
    assert.equal(r.status, 200);
    item = readCases(app.dataDir).find(c => c.id === caseId).items[0];
    assert.equal(item.notas.length, correctedNotes);
    assert.equal(item.corregidoAt, correctedAt);

    state.transitPresent = true;
    await new Promise(resolve => setTimeout(resolve, 5_200));
    r = await api(app.base, '/api/inventario/snapshot-run', { token: adminToken, method: 'POST', body: {} });
    assert.equal(r.status, 200);
    item = readCases(app.dataDir).find(c => c.id === caseId).items[0];
    assert.equal(item.seguimiento, 'pendiente');
    const reopenedNotes = item.notas.length;

    r = await api(app.base, '/api/inventario/snapshot-run', { token: adminToken, method: 'POST', body: {} });
    assert.equal(r.status, 200);
    item = readCases(app.dataDir).find(c => c.id === caseId).items[0];
    assert.equal(item.notas.length, reopenedNotes);
  });

  await check('Kardex: cancelado no suplanta al movimiento done culpable', async () => {
    const r = await api(app.base, '/api/inventario/kardex/777', { token: adminToken });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.equal(r.data.culprit?.ref, 'DONE-NEG');
    assert.equal(r.data.culprit?.state, 'done');
    assert.equal(r.data.culprit?.confidence, 'probable');
    assert.equal(r.data.culprit?.kind, 'debito-nodo-agregacion');
    assert.equal(r.data.dataQuality.culpritAssessment, 'probable');
    assert.equal(r.data.moves.find(m => m.ref === 'DRAFT-NEG')?.culprit, false);
    assert.equal(r.data.moves.find(m => m.ref === 'CANCEL-NEG')?.culprit, false);
    assert.equal(r.data.moves.find(m => m.ref === 'DONE-NEG')?.culprit, true);
    assert.equal(r.data.totalMoves, 3);
  });

  await check('Resiliencia: un RPC colgado no envenena el coalescer de Panorama', async () => {
    timeoutApp = await startApp(mock.port, { ODOO_RPC_TIMEOUT_MS: '600', INV_PANO_RUN_TIMEOUT_MS: '1200' });
    const session = await login(timeoutApp.base, ADMIN_EMAIL, ADMIN_PASSWORD);
    state.delayNext = { model: 'stock.location', method: 'search_read', domainField: 'usage', domainOp: '=', domainValue: 'transit', ms: 1_500 };
    const failed = await api(timeoutApp.base, '/api/inventario/panorama', { token: session.accessToken });
    assert.ok([502, 503].includes(failed.status), 'el RPC demorado devolvió HTTP ' + failed.status);
    const recovered = await api(timeoutApp.base, '/api/inventario/panorama', { token: session.accessToken });
    assert.equal(recovered.status, 200, JSON.stringify(recovered.data));
    await stopApp(timeoutApp);
    timeoutApp = null;
  });

  await check('Refresh: fuerza foto nueva tras throttle sin esperar TTL de 5 minutos', async () => {
    state.negativeQty = -7;
    const elapsed = Date.now() - initialPanoramaAt;
    if (elapsed < 30_200) await new Promise(resolve => setTimeout(resolve, 30_200 - elapsed));

    const beforePlain = state.calls.filter(c => c.model === 'stock.quant' && c.method === 'search_read' && domainHas(c.args?.[0], 'quantity', '<')).length;
    const cached = await api(app.base, '/api/inventario/panorama', { token: adminToken });
    assert.equal(cached.status, 200);
    assert.equal(cached.data.senales.s2.unidades, Math.abs(firstPanorama.senales.s2.unidades));
    const beforeForce = state.calls.filter(c => c.model === 'stock.quant' && c.method === 'search_read' && domainHas(c.args?.[0], 'quantity', '<')).length;
    assert.equal(beforeForce, beforePlain, 'la carga normal no debía saltar TTL');

    const fresh = await api(app.base, '/api/inventario/panorama?refresh=1', { token: adminToken });
    assert.equal(fresh.status, 200, JSON.stringify(fresh.data));
    assert.equal(fresh.data.senales.s2.unidades, 7);
    const afterForce = state.calls.filter(c => c.model === 'stock.quant' && c.method === 'search_read' && domainHas(c.args?.[0], 'quantity', '<')).length;
    assert.ok(afterForce > beforeForce, 'refresh=1 no consultó de nuevo negativos');
  });

  await check('Calidad: negativos unavailable anulan fiabilidad y publican la fuente', async () => {
    await stopApp(app);
    app = null;
    state.negativeFailures = true;
    secondApp = await startApp(mock.port);
    const secondAdmin = await login(secondApp.base, ADMIN_EMAIL, ADMIN_PASSWORD);
    const r = await api(secondApp.base, '/api/inventario/panorama', { token: secondAdmin.accessToken });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.equal(r.data.dataQuality.status, 'degraded');
    assert.equal(r.data.dataQuality.sources.negativos.status, 'unavailable');
    assert.equal(r.data.scores.fiabilidad.score, null);
    assert.equal(r.data.senales.s2.status, 'unavailable');
    assert.equal(r.data.senales.s2.count, null);
    assert.ok(r.data.dataQuality.warnings.some(w => w.source === 'negativos'));
    state.negativeFailures = false;
  });

  await check('Contrato UI: shell base intacto y todos los scripts inline compilan', async () => {
    const { Script } = await import('node:vm');
    const html = fs.readFileSync(path.join(root, 'historial.html'), 'utf8');
    for (const id of ['screen-login', 'screen-historial', 'screen-app', 'nav-inventario', 'section-inventario']) {
      assert.ok(html.includes(`id="${id}"`), 'falta elemento base #' + id);
    }
    for (const marker of ['function authFetch', 'function canSection', 'function navTo']) {
      assert.ok(html.includes(marker), 'falta función base: ' + marker);
    }
    for (const marker of ['Señal heurística:', 'Caso cerrado:', 'Mixtos (', 'Evento probable asociado al descuadre:']) {
      assert.ok(html.includes(marker), 'falta contrato UI de Inventario: ' + marker);
    }
    const scriptRe = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
    let match; let count = 0;
    while ((match = scriptRe.exec(html))) {
      const attrs = match[1] || '';
      if (/\bsrc\s*=|type\s*=\s*["'](?:application\/json|importmap)["']/i.test(attrs)) continue;
      new Script(match[2], { filename: 'historial-inline-' + (++count) + '.js' });
    }
    assert.ok(count > 0);
  });
} finally {
  state.negativeFailures = false;
  state.duplicateFailures = false;
  await stopApp(app);
  await stopApp(degradedApp);
  await stopApp(secondApp);
  await stopApp(timeoutApp);
  await stopServer(mock?.server);
  const resolvedCert = path.resolve(certDir);
  if (resolvedCert.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(resolvedCert).startsWith('inventario-cert-')) {
    fs.rmSync(resolvedCert, { recursive: true, force: true });
  }
}

const failed = results.filter(r => !r.ok);
console.log(`\nInventario HTTP: ${results.length - failed.length}/${results.length} pruebas aprobadas.`);
if (failed.length) {
  console.error('\nFallos:');
  failed.forEach(r => console.error('- ' + r.name + ': ' + r.error.message));
  process.exitCode = 1;
}
