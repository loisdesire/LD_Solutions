// Vanova admin PWA service worker.
//
// Deliberately minimal - this is NOT an offline-first cache for the
// dashboard. Booking and calendar data changes by the minute; serving a
// stale cached page here could show an owner appointments that no longer
// exist, or hide one that just came in. Its two real jobs are:
//   1. satisfy the browser's installability requirement (a registered SW
//      with a fetch handler present), so "Add to Home Screen" is offered
//   2. receive and display push notifications for new bookings
//
// Registered per-business with a narrow scope (see PwaRegister.tsx), so
// installing one business's dashboard never affects another's.

const STATIC_CACHE = 'vanova-static-v1';
const STATIC_ASSETS = ['/icon-192.png', '/icon-512.png', '/icon-maskable-192.png', '/icon-maskable-512.png', '/logo.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== STATIC_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// Cache-first, but ONLY for the fixed list of static assets above - every
// page and every API call goes straight to the network, always, so the
// dashboard can never show stale bookings or stale settings.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || !STATIC_ASSETS.includes(url.pathname)) return;
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // Non-JSON push payload - just show something rather than throwing.
  }
  const title = data.title || 'New booking';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/icon-192.png',
      // `badge` is a DIFFERENT role from `icon`, not a smaller copy of it -
      // Android derives the status-bar/notification-shade glyph from this
      // image's alpha channel alone and renders it as a flat silhouette,
      // discarding all color. icon-192.png is full-color and detailed
      // (fine for the large `icon` slot), so as a badge it doesn't come
      // out as a clean mark - reported live as a big blank white block,
      // sitting right next to the same logo rendered properly as the
      // large icon, reading as two different, inconsistent logos on one
      // notification. No purpose-built small monochrome asset (a simple
      // white shape on full transparency, ~96x96) exists in /public yet -
      // until one does, omitting `badge` lets Chrome fall back to its own
      // default treatment instead of a broken-looking custom one.
      tag: data.tag || 'vanova-notification',
      data: { url: data.url || '/' },
    })
  );
});

// Focus an already-open tab on this dashboard instead of always opening a
// new one - a business owner tapping the notification twice shouldn't end
// up with three copies of their own dashboard.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(targetUrl) && 'focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
