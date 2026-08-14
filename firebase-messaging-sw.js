/* 中榮 RT Dashboard — FCM 背景推播 Service Worker
   （與快取用的 sw.js 分開；只負責在 App 關閉時顯示推播通知） */
importScripts('https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyAQovYBq-bzXIzSMGRTF2yx2oyav6pxs1c',
  authDomain: 'rtdashboard-21856.firebaseapp.com',
  projectId: 'rtdashboard-21856',
  storageBucket: 'rtdashboard-21856.firebasestorage.app',
  messagingSenderId: '523621899495',
  appId: '1:523621899495:web:a5fb029ef0e56771891642',
});

// 不支援 messaging 的環境（getToken 會另行報錯）不讓 SW 評估失敗
let messaging = null;
try { messaging = firebase.messaging(); } catch (e) { /* unsupported */ }

if (messaging) {
  // 背景訊息（data-only 或 notification 都吃）
  messaging.onBackgroundMessage(function (payload) {
    const d = payload.data || {};
    const n = payload.notification || {};
    const title = n.title || d.title || '中榮 RT Dashboard';
    const body = n.body || d.body || '';
    const url = d.url || (payload.fcmOptions && payload.fcmOptions.link) || './';
    self.registration.showNotification(title, {
      body: body,
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      tag: d.tag || 'rt-push',
      data: { url: url },
    });
  });
}

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (const c of list) { if ('focus' in c) { c.navigate(url); return c.focus(); } }
    if (clients.openWindow) return clients.openWindow(url);
  }));
});
