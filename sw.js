// WWP Service Worker — Cache-first para estáticos + Web Push
const CACHE = 'wwp-v40';
const STATIC = [
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-192.svg',
  '/icon-512.svg',
  '/badge-critical.svg',
  '/badge-alert.svg',
  '/badge-success.svg',
  '/badge-info.svg',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
    .then(() => self.clients.claim())
    .then(() => self.clients.matchAll({ type: 'window', includeUncontrolled: true }))
    .then(clients => Promise.all(
      clients
        .filter(c => /\/(historial\.html|$|\?)/.test(new URL(c.url).pathname))
        .map(c => c.navigate(c.url).catch(() => c.postMessage({ type: 'SW_RELOAD' })))
    ))
  );
});

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.pathname.startsWith('/api/') || url.pathname.includes('/notifications/stream')) return;
  if (url.pathname.endsWith('.html') || url.pathname === '/' || !url.pathname.includes('.')) return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok && e.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => new Response('Offline', {status: 503}));
    })
  );
});

// ── Web Push ──────────────────────────────────────────────────────────────────

// Mapa de tipo de notificación → urgencia
const NOTIF_URGENCY = {
  // Críticas → rojo
  task_overdue:      'critical',
  task_rejected:     'critical',
  pick_incomplete:   'critical',
  packing_blocked:   'critical',
  damage_detected:   'critical',
  cancel_blocked:    'critical',
  system_sync_error: 'critical',
  // Alertas → ámbar
  evidence_incomplete:    'alert',
  stock_changed:          'alert',
  task_cancelled:         'alert',
  reactivacion_pendiente: 'alert',
  sdv_cancelada:          'alert',
  // Éxito → verde
  task_completed:          'success',
  task_validated:          'success',
  reposicion_aprobada:     'success',
  reactivacion_procesada:  'success',
  // Info → azul (default)
  task_assigned:    'info',
  subtask_assigned: 'info',
  sdv_new_pending:  'info',
  status_changed:   'info',
  comment_new:      'info',
  lunch_ended:      'info',
  agent_routine:    'info',
  reposicion_nueva: 'info',
};

// Badges por urgencia. No usar `image`: Chrome muestra una imagen grande que
// ocupa demasiado espacio y distrae en notificaciones operativas.
const RICH_ASSETS = {
  critical: { badge: '/badge-critical.svg' },
  alert:    { badge: '/badge-alert.svg' },
  success:  { badge: '/badge-success.svg' },
  info:     { badge: '/badge-info.svg' },
};

// Acciones por urgencia
// iOS: máx 2 acciones. Android/Chrome/Windows: hasta 3.
const ACTIONS = {
  critical: [
    { action: 'view',    title: '👁 Ver' },
    { action: 'later',   title: '⏱ Luego' },
    { action: 'dismiss', title: '❌ Descartar' },
  ],
  alert: [
    { action: 'view',    title: '👁 Ver' },
    { action: 'dismiss', title: 'Descartar' },
  ],
  success: [
    { action: 'view', title: '✅ Ver' },
  ],
  info: [
    { action: 'view', title: '📋 Ver' },
  ],
};

self.addEventListener('push', e => {
  let data = {};
  try {
    data = e.data ? e.data.json() : {};
  } catch(err) {
    data = { title: 'Ops AT', body: e.data ? e.data.text() : '' };
  }

  const title    = data.title || data.appTitle || 'Ops AT';
  const body     = data.message || data.body || '';
  const tag      = data.tag     || 'wwp-notif';
  const taskId   = data.relatedTaskId || null;
  const notifType = data.type   || '';

  const urgency  = data.urgency || NOTIF_URGENCY[notifType] || 'info';
  const assets   = RICH_ASSETS[urgency];
  const actions  = ACTIONS[urgency];
  const url      = data.actionUrl || data.url || '/historial.html';

  // requireInteraction solo para críticas (la notif no desaparece sola)
  const requireInteraction = urgency === 'critical';

  // Vibración por urgencia (Android)
  const vibrate = urgency === 'critical' ? [200, 100, 200, 100, 200]
                : urgency === 'alert'    ? [150, 75, 150]
                : [100];

  e.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon:  '/icon-192.png',
      badge: assets.badge,
      tag,
      renotify: true,
      requireInteraction,
      vibrate,
      actions,
      data: { taskId, url, notifType, urgency }
    })
  );
});

self.addEventListener('notificationclick', e => {
  const { taskId, url } = e.notification.data || {};
  const action = e.action;

  // Acciones que no navegan
  if (action === 'dismiss' || action === 'later') {
    e.notification.close();
    return;
  }

  // Acción 'view' o click en el cuerpo de la notificación
  e.notification.close();
  const target = taskId ? `/historial.html?task=${taskId}` : (url || '/historial.html');

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes('/historial.html') && 'focus' in c);
      if (existing) {
        existing.postMessage({ type: 'NOTIFICATION_CLICK', taskId });
        return existing.focus();
      }
      return clients.openWindow(target);
    })
  );
});
