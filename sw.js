/* 中榮 RT 隨身站 — Service Worker (Phase 1: 離線快取) */
const CACHE = 'rt-app-v0.7.3';
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

/* Phase 3 會加入 push 事件處理（Web Push） */
self.addEventListener('push', (e) => {
  let data = { title: '中榮 RT 隨身站', body: '有新公告' };
  try { if (e.data) data = e.data.json(); } catch (_) {}
  e.waitUntil(self.registration.showNotification(data.title, {
    body: data.body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', data: data.url || './'
  }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(clients.openWindow(e.notification.data || './'));
});
