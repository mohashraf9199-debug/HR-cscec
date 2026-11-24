/* HR System — Service Worker v7.3
   • الواجهة بتتخزّن على الموبايل → التطبيق يفتح حتى من غير نت
   • الصفحة: الشبكة الأول (عشان التحديثات توصل) ولو مفيش نت/بطيئة → النسخة المحفوظة
   • الـ API (POST لـ Apps Script) مابيتخزّنش خالص */
const VERSION = 'hr-v7.7.0';
const SHELL = ['./', './index.html', './api.js', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/apple-touch-icon.png', './icons/favicon-32.png'];
const FONTS = 'hr-fonts';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== FONTS).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('message', e => { if (e.data === 'skip') self.skipWaiting(); });

function timeout(ms) { return new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)); }

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                                   // الـ API = POST → مباشرة للشبكة
  const url = new URL(req.url);

  // الخطوط: من المخزن وتتحدّث في الخلفية
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(FONTS).then(c => c.match(req).then(hit => {
      const net = fetch(req).then(r => { if (r.ok || r.type === 'opaque') c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    })));
    return;
  }
  if (url.origin !== location.origin) return;

  // الصفحة نفسها: الشبكة الأول (4 ثواني) وبعدين المحفوظ
  if (req.mode === 'navigate') {
    e.respondWith(
      Promise.race([fetch(req), timeout(4000)])
        // [v7.7] بنحفظ الصفحة بس لو الرد سليم — صفحة خطأ (404/500) كانت بتتحفظ مكان التطبيق فيبطل يفتح من غير نت
        .then(r => { if (r.ok && r.type === 'basic') { const copy = r.clone(); caches.open(VERSION).then(c => c.put('./index.html', copy)); } return r; })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }
  // باقي الملفات: المحفوظ الأول
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
    if (r.ok) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
    return r;
  })));
});
