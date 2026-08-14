/* 中榮 RT 隨身站 — Service Worker (Phase 1: 離線快取) */
const CACHE = 'rt-app-v0.8.3';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './data/config.json',
  './data/announcements.json',
  './data/announcements-groups.json',
  './data/knowledge.json',
  './data/schedule.json',
  './data/database.json',
  './data/vent.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './vendor/firebase-app-compat.js',
  './vendor/firebase-messaging-compat.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()).catch(() => {})
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* 網頁殼與 data：network-first（有網路拿新的、沒網路用快取）；其他資產：cache-first */
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 外部連結（儀表板等）不攔截

  const isData = url.pathname.endsWith('.json') || url.pathname.endsWith('.html') || url.pathname.endsWith('/');
  if (isData) {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
  } else {
    e.respondWith(caches.match(req).then(r => r || fetch(req)));
  }
});

/* Web Push（FCM）：直接在此處理，不在 SW 內載 Firebase SDK（compat 需要 window，SW 無 window 會失敗） */
self.addEventListener('push', (e) => {
  let p = {};
  try { if (e.data) p = e.data.json(); } catch (_) { try { p = { notification: { body: e.data && e.data.text() } }; } catch (__) {} }
  const n = p.notification || {};
  const d = p.data || {};
  const title = n.title || d.title || '中榮 RT Dashboard';
  const body = n.body || d.body || '';
  const url = d.url || (p.fcmOptions && p.fcmOptions.link) || n.click_action || './';
  e.waitUntil(self.registration.showNotification(title, {
    body: body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png',
    tag: d.tag || 'rt-push', data: { url: url },
  }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) { if ('focus' in c) { try { c.navigate(url); } catch (_) {} return c.focus(); } }
    if (clients.openWindow) return clients.openWindow(url);
  }));
});
