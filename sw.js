// WWP Service Worker — Cache-first para estáticos + Web Push
const CACHE = 'wwp-v3';
const STATIC = [
  '/manifest.json',
  '/icon-192.svg',
  '/icon-512.svg',
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
    ).then(() => self.clients.claim())
  );
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
self.addEventListener('push', e => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch(err) {}

  const title   = data.title   || 'Ops AT';
  const body    = data.message || data.body || '';
  const icon    = data.icon    || '/icon-192.png';
  const badge   = data.badge   || '/favicon-32.png';
  const tag     = data.tag     || 'wwp-notif';
  const taskId  = data.relatedTaskId || null;

  e.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      tag,
      renotify: true,
      data: { taskId, url: '/historial.html' }
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || '/historial.html';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes('/historial.html') && 'focus' in c);
      if (existing) return existing.focus();
      return clients.openWindow(target);
    })
  );
});
