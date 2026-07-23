'use strict';
// F2.1 (API-01, P0 de la auditoría 09): el WebSocket /ws/wwp exige un ticket
// efímero de un solo uso (emitido por POST autenticado), el broadcast de tareas
// es MUDO (señal de cambio sin objetos de negocio) y las notificaciones viajan
// solo a las conexiones de su dueño. Usa el WebSocket global de Node 22.
const { test, expect } = require('@playwright/test');
const { apiLogin } = require('./helpers/session');

const PORT = Number(process.env.E2E_PORT || 3100);
const WS_URL = `ws://localhost:${PORT}/ws/wwp`;

function conectar(url) {
  // Devuelve {opened, frames[], ws} tras abrir, o al cerrarse/timeout.
  return new Promise((resolve) => {
    const ws = new WebSocket(url);
    const frames = [];
    let opened = false;
    const done = () => resolve({ opened, frames, ws });
    const timer = setTimeout(() => { try { ws.close(); } catch {} done(); }, 3000);
    ws.onopen = () => { opened = true; clearTimeout(timer); resolve({ opened, frames, ws }); };
    ws.onmessage = (e) => frames.push(String(e.data));
    ws.onerror = () => {};
    ws.onclose = () => { clearTimeout(timer); done(); };
  });
}

test.describe('realtime WS (F2.1)', () => {
  test('conexión anónima es rechazada sin recibir un byte de negocio', async () => {
    const r = await conectar(WS_URL);
    expect(r.opened, 'el upgrade sin ticket no debe completarse').toBe(false);
    expect(r.frames).toHaveLength(0);
  });

  test('con ticket: hello llega y el broadcast de tareas es MUDO', async ({ request }) => {
    const login = await apiLogin(request);
    const auth = { Authorization: 'Bearer ' + login.accessToken };
    const tk = await (await request.post('/api/wwp/realtime/ticket', { headers: auth })).json();
    expect(tk.ok).toBe(true);
    expect(tk.ticket).toBeTruthy();

    const frames = [];
    const ws = new WebSocket(WS_URL + '?client=e2e&ticket=' + tk.ticket);
    await new Promise((res, rej) => {
      ws.onopen = res;
      ws.onerror = () => rej(new Error('WS no abrió con ticket válido'));
      setTimeout(() => rej(new Error('timeout de apertura')), 5000);
    });
    ws.onmessage = (e) => { try { frames.push(JSON.parse(e.data)); } catch {} };

    await expect.poll(() => frames.some((f) => f.event === 'hello'), { timeout: 5000 }).toBe(true);

    // Disparar un cambio real: crear una tarea por API → debe llegar la señal
    // tasks:changed SIN el objeto task ni ningún payload de negocio.
    const create = await request.post('/api/wwp/tasks', {
      headers: auth,
      data: { title: 'E2E realtime mudo', type: 'general' },
    });
    expect(create.status(), 'creación de tarea para disparar broadcast').toBeLessThan(300);

    await expect.poll(() => frames.some((f) => f.event === 'tasks:changed'), { timeout: 5000 }).toBe(true);
    const frame = frames.find((f) => f.event === 'tasks:changed');
    expect(frame.taskId, 'la señal trae identificador').toBeTruthy();
    for (const campo of ['task', 'message', 'items', 'evidence', 'parentTask', 'tasks', 'notif']) {
      expect(frame[campo], `el broadcast no debe incluir "${campo}"`).toBeUndefined();
    }
    ws.close();
  });

  test('el ticket es de un solo uso', async ({ request }) => {
    const login = await apiLogin(request);
    const auth = { Authorization: 'Bearer ' + login.accessToken };
    const tk = await (await request.post('/api/wwp/realtime/ticket', { headers: auth })).json();

    const primero = await conectar(WS_URL + '?ticket=' + tk.ticket);
    expect(primero.opened, 'primer uso abre').toBe(true);
    const reuso = await conectar(WS_URL + '?ticket=' + tk.ticket);
    expect(reuso.opened, 'reuso rechazado').toBe(false);
    try { primero.ws.close(); } catch {}
  });

  test('el ticket exige sesión', async ({ request }) => {
    const res = await request.post('/api/wwp/realtime/ticket');
    expect(res.status()).toBe(401);
  });
});
