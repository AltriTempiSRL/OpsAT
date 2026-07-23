'use strict';
// Smoke a nivel HTTP (sin navegador): salud, redirects, fallback SPA v227 y
// denylist de archivos sensibles. Documenta el contrato server-side del que
// dependerán las islas (plan 08).
const { test, expect } = require('@playwright/test');
const { ADMIN } = require('./helpers/session');

// _MODULE_ROUTES en proxy.js (~20387): primer segmento del path → historial.html.
// Excepción: /almacen-mapa se sirve como página propia (proxy.js:20165) — es la
// isla precedente del plan 08 y tiene su propio test abajo.
const MODULE_ROUTES = [
  'buscar', 'contenedores', 'reposicion', 'solicitudes-reposicion', 'solicitudes',
  'sin-adjuntos', 'dev-cdp', 'despacho-obsoleto', 'inventario',
  'averias', 'basedatos', 'dashboard-ventas', 'estado-ordenes', 'sdv-portal',
  'sdv-bandeja', 'sdv-reactivations', 'inventario-salud', 'validacion', 'wwp',
];

test.describe('server: salud y contratos HTTP', () => {
  test('GET /api/health responde ok', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.build).toBeTruthy();
  });

  test('GET / redirige a /historial.html', async ({ request }) => {
    const res = await request.get('/', { maxRedirects: 0 });
    expect(res.status()).toBe(302);
    expect(res.headers()['location']).toContain('/historial.html');
  });

  test('GET /wwp.html (deprecado) redirige a /historial.html', async ({ request }) => {
    const res = await request.get('/wwp.html', { maxRedirects: 0 });
    expect(res.status()).toBe(302);
    expect(res.headers()['location']).toContain('/historial.html');
  });

  test('historial.html se sirve con no-store (nunca cachear el monolito)', async ({ request }) => {
    const res = await request.get('/historial.html');
    expect(res.status()).toBe(200);
    expect(res.headers()['cache-control'] || '').toContain('no-store');
  });

  for (const route of MODULE_ROUTES) {
    test(`fallback SPA: /${route} sirve historial.html`, async ({ request }) => {
      const res = await request.get('/' + route);
      expect(res.status()).toBe(200);
      expect(res.headers()['content-type'] || '').toContain('text/html');
      const html = await res.text();
      expect(html).toContain('screen-login');
    });
  }

  test('isla precedente: /almacen-mapa sirve su propia página (no el monolito)', async ({ request }) => {
    const res = await request.get('/almacen-mapa');
    expect(res.status()).toBe(200);
    const html = await res.text();
    expect(html).toContain('Mapa CDP');
    expect(html).not.toContain('screen-login');
  });

  test('denylist: wwp-users-auth.json NO se sirve como estático', async ({ request }) => {
    const res = await request.get('/wwp-users-auth.json');
    expect([403, 404]).toContain(res.status());
  });

  test('denylist: .jwt-secret NO se sirve como estático', async ({ request }) => {
    const res = await request.get('/.jwt-secret');
    expect([403, 404]).toContain(res.status());
  });

  // F2.2 (ARQ-03): allowlist de .js — los módulos del SERVER (presentes y
  // futuros) son 403; solo los .js de cliente pasan.
  for (const mod of ['/proxy.js', '/storage-pg.js', '/write-queue.js', '/typed-schemas.js', '/media.js', '/boot.js']) {
    test(`allowlist JS: ${mod} (módulo del server) NO se sirve`, async ({ request }) => {
      expect((await request.get(mod)).status()).toBe(403);
    });
  }
  for (const mod of ['/core.js', '/core-isla.js', '/sw.js']) {
    test(`allowlist JS: ${mod} (cliente) SÍ se sirve`, async ({ request }) => {
      expect((await request.get(mod)).status()).toBe(200);
    });
  }

  // F2.6 (GAP-08): el endpoint de suscripción push rechaza endpoints que no
  // sean de un servicio de push conocido (anti-SSRF).
  test('push: endpoint SSRF (host arbitrario) es rechazado', async ({ request }) => {
    const login = await request.post('/api/wwp/auth/login', { data: ADMIN });
    const token = (await login.json()).accessToken;
    const res = await request.post('/api/wwp/push/subscribe', {
      headers: { Authorization: `Bearer ${token}` },
      data: { subscription: { endpoint: 'https://169.254.169.254/latest/meta-data', keys: {} } },
    });
    expect(res.status()).toBe(400);
  });
});

test.describe('server: auth API', () => {
  test('login con password inválida es rechazado', async ({ request }) => {
    const res = await request.post('/api/wwp/auth/login', {
      data: { email: ADMIN.email, password: 'incorrecta-123' },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test('login con seed admin devuelve JWT + refresh + user admin', async ({ request }) => {
    const res = await request.post('/api/wwp/auth/login', { data: ADMIN });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(String(body.accessToken).split('.')).toHaveLength(3); // JWT HS256
    expect(body.refreshToken).toBeTruthy();
    expect(body.user.role).toBe('admin');
  });

  test('refresh emite un accessToken nuevo', async ({ request }) => {
    const login = await (await request.post('/api/wwp/auth/login', { data: ADMIN })).json();
    const res = await request.post('/api/wwp/auth/refresh', {
      data: { refreshToken: login.refreshToken },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(String(body.accessToken).split('.')).toHaveLength(3);
  });
});
