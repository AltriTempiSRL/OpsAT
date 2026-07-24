// WWP Service Worker — Cache-first para estáticos + Web Push
const CACHE = 'wwp-v68';
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
  // HTML principal: stale-while-revalidate — sirve del caché al instante (arranque
  // en frío rápido en equipos de poca RAM) y revalida en segundo plano. Servir
  // "stale" no deja equipos pegados a una versión vieja: _checkVersion (en
  // historial.html, corre a los 2s y cada 60s) borra TODOS los caches y recarga
  // en cuanto /api/app-version (que el SW nunca intercepta) reporte build nuevo.
  // Cache key normalizado a /historial.html: ?task= / ?reset= reciben el mismo body.
  // v227 (rutas de módulo con path real): CUALQUIER navegación sin '.' en el path
  // (/inventario, /buscar/S09115, /wwp/tasks/…) es la app → misma entrada de caché.
  // Los .html reales (almacen-mapa.html, wwp-guide.html) llevan punto y NO entran.
  // Subpaths con puntos (/averias/JC.ART….P) van a red directa — funcionan sin SWR.
  if (e.request.method === 'GET' && (url.pathname === '/historial.html' || url.pathname === '/historial' ||
      (e.request.mode === 'navigate' && !url.pathname.includes('.')))) {
    e.respondWith(
      caches.open(CACHE).then(c =>
        c.match('/historial.html').then(cached => {
          const net = fetch(e.request).then(res => {
            if (res.ok) c.put('/historial.html', res.clone()).catch(() => {});
            return res;
          });
          if (cached) { e.waitUntil(net.catch(() => {})); return cached; }
          return net;
        })
      ).catch(() => fetch(e.request))
    );
    return;
  }
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

// Mapa de tipo de notificación → urgencia.
// FALLBACK: desde v140 el payload push ya trae `urgency` estampada por el
// servidor (fuente de verdad: NOTIF_META en proxy.js, espejo _NOTIF_META en
// historial.html). Este mapa solo cubre payloads viejos sin el campo.
const NOTIF_URGENCY = {
  // Críticas → rojo
  task_overdue:      'critical',
  task_rejected:     'critical',
  pick_incomplete:   'critical',
  packing_blocked:   'critical',
  damage_detected:   'critical',
  cancel_blocked:    'critical',
  system_sync_error: 'critical',
  inventario_negativo: 'critical',
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
  // Críticas → rojo (v180: canal vendedora)
  sdv_seller_rechazada: 'critical',
  // Alertas → ámbar (v180)
  sdv_seller_cancelada: 'alert',
  reposicion_rechazada: 'alert',
  // Éxito → verde (v180)
  sdv_seller_despachada: 'success',
  sdv_seller_parcial:    'success',
  // Info → azul (default)
  task_assigned:    'info',
  subtask_assigned: 'info',
  sdv_new_pending:  'info',
  status_changed:   'info',
  comment_new:      'info',
  lunch_ended:      'info',
  agent_routine:    'info',
  reposicion_nueva: 'info',
  // Info (v180)
  sdv_seller_aprobada:   'info',
  sdv_seller_en_ruta:    'info',
  sdv_seller_pausa:      'alert',
  sdv_seller_reactivada: 'info',
  sdv_seller_reprogramada: 'alert',
  curso_retake:          'info',
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

  const count    = data.count || 1;
  const title    = (data.title || data.appTitle || 'Ops AT') + (count > 1 ? ' ×' + count : '');
  const body     = data.message || data.body || '';
  const tag      = data.tag     || 'wwp-notif';
  const taskId   = data.relatedTaskId || null;
  const notifType = data.type   || '';
  // v180: target tipado {kind,id,ctx?} + id de la notif — el click rutea por esto
  const target   = data.target  || null;
  const notifId  = data.notifId || data.id || null;

  const urgency  = data.urgency || NOTIF_URGENCY[notifType] || 'info';
  const assets   = RICH_ASSETS[urgency];
  const actions  = ACTIONS[urgency];
  const url      = data.actionUrl || data.url || '/historial.html';

  // requireInteraction solo para críticas (la notif no desaparece sola)
  const requireInteraction = urgency === 'critical';

  // Un fold (coalesced) actualiza la notif existente del OS sin volver a vibrar/alertar;
  // la primera de la cadena sí re-alerta (renotify true).
  const renotify = !data.coalesced;

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
      renotify,
      requireInteraction,
      vibrate,
      actions,
      data: { taskId, url, notifType, urgency, target, notifId }
    })
  );
});

self.addEventListener('notificationclick', e => {
  const { taskId, url, target, notifId } = e.notification.data || {};
  const action = e.action;

  // Acciones que no navegan
  if (action === 'dismiss' || action === 'later') {
    e.notification.close();
    return;
  }

  // Acción 'view' o click en el cuerpo de la notificación.
  // v180: preferir `url` (el server ya la construye como ?notif=<id> — el router del
  // cliente resuelve el destino por target). Fallback legacy: ?task= codificado.
  e.notification.close();
  const dest = url || (taskId ? '/historial.html?task=' + encodeURIComponent(taskId) : '/historial.html');

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes('/historial.html') && 'focus' in c);
      if (existing) {
        existing.postMessage({ type: 'NOTIFICATION_CLICK', taskId, notifId, target, url: dest });
        return existing.focus();
      }
      return clients.openWindow(dest);
    })
  );
});
