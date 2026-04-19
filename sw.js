// Daily Flow — Service Worker v1.0
const CACHE_NAME = 'daily-flow-v1';
const ASSETS = [
  './index.html',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=DM+Sans:wght@300;400;500&display=swap',
];

// ===================== INSTALL =====================
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS).catch(() => {
        // Gracefully fail if some assets can't be cached (e.g., fonts offline)
        return cache.add('./index.html');
      });
    }).then(() => self.skipWaiting())
  );
});

// ===================== ACTIVATE =====================
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ===================== FETCH (Cache-First + Network Fallback) =====================
self.addEventListener('fetch', e => {
  // Skip non-GET and chrome-extension requests
  if (e.request.method !== 'GET' || e.request.url.startsWith('chrome-extension')) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        // Cache successful responses
        if (response && response.status === 200 && response.type !== 'opaque') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return response;
      }).catch(() => {
        // Offline fallback — return cached index.html
        if (e.request.destination === 'document') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

// ===================== PUSH NOTIFICATION =====================
self.addEventListener('push', e => {
  let data = { title: 'Daily Flow', body: 'Waktunya fokus! 🎯', icon: '' };
  try { data = { ...data, ...e.data.json() }; } catch {}

  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="%230f0e17"/><polygon points="256,80 272,230 420,256 272,282 256,432 240,282 92,256 240,230" fill="%23ffd93d"/></svg>',
      badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" rx="20" fill="%230f0e17"/><circle cx="48" cy="48" r="30" fill="%23ff6b6b"/></svg>',
      tag: 'daily-flow-reminder',
      renotify: true,
      vibrate: [200, 100, 200],
      data: { url: self.location.origin + '/index.html' },
      actions: [
        { action: 'open', title: '📋 Buka App' },
        { action: 'dismiss', title: '✕ Tutup' },
      ]
    })
  );
});

// ===================== NOTIFICATION CLICK =====================
self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'dismiss') return;

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes('index.html') && 'focus' in client) return client.focus();
      }
      return clients.openWindow('./index.html');
    })
  );
});

// ===================== BACKGROUND SYNC (reminder fallback) =====================
self.addEventListener('sync', e => {
  if (e.tag === 'check-reminders') {
    e.waitUntil(
      self.clients.matchAll().then(clients => {
        clients.forEach(c => c.postMessage({ type: 'CHECK_REMINDERS' }));
      })
    );
  }
});

// ===================== MESSAGE FROM APP =====================
self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (e.data?.type === 'SHOW_NOTIF') {
    const { title, body, icon } = e.data;
    self.registration.showNotification(title, {
      body,
      icon: icon || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="%230f0e17"/><polygon points="256,80 272,230 420,256 272,282 256,432 240,282 92,256 240,230" fill="%23ffd93d"/></svg>',
      vibrate: [150, 80, 150],
      tag: 'daily-flow-task',
    });
  }
});
