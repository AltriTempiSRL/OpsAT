'use strict';
// Sesión E2E contra el seed de proxy.js (seedAuthUsers, ~4734): estas
// credenciales solo existen en el DATA_DIR desechable de la suite, que se
// re-siembra en cada corrida. Nunca apuntar esta suite a data-local/ ni a prod.
const ADMIN = { email: 'gsanchez@altritempi.com.do', password: 'Admin2026!' };

async function apiLogin(request, creds = ADMIN) {
  const res = await request.post('/api/wwp/auth/login', { data: creds });
  if (!res.ok()) throw new Error(`login API falló: HTTP ${res.status()}`);
  const body = await res.json();
  if (!body.ok || !body.accessToken) throw new Error('login API sin accessToken: ' + JSON.stringify(body).slice(0, 200));
  return body;
}

// Inyecta la sesión ANTES de que cargue historial.html: checkStoredSession()
// (historial.html ~9344) lee localStorage['wwp_auth'] y aterriza logueado,
// sin pasar por el formulario. El login por UI se cubre en su propio spec.
async function loginBeforeLoad(page, request, creds = ADMIN) {
  const s = await apiLogin(request, creds);
  const payload = JSON.stringify({
    accessToken: s.accessToken,
    refreshToken: s.refreshToken,
    user: s.user,
  });
  await page.addInitScript((v) => {
    try { localStorage.setItem('wwp_auth', v); } catch (e) {}
  }, payload);
  return s;
}

module.exports = { ADMIN, apiLogin, loginBeforeLoad };
