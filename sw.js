const CACHE_NAME = 'high-hand-admin-v1';
const ASSETS = [
  './admin.html',
  './css/admin.css',
  './images/nn.png',
  './images/2h.png',
  './images/2k.png',
  './images/2r.png',
  './images/2s.png',
  './images/3h.png',
  './images/3k.png',
  './images/3r.png',
  './images/3s.png',
  './images/4h.png',
  './images/4k.png',
  './images/4r.png',
  './images/4s.png',
  './images/5h.png',
  './images/5k.png',
  './images/5r.png',
  './images/5s.png',
  './images/6h.png',
  './images/6k.png',
  './images/6r.png',
  './images/6s.png',
  './images/7h.png',
  './images/7k.png',
  './images/7r.png',
  './images/7s.png',
  './images/8h.png',
  './images/8k.png',
  './images/8r.png',
  './images/8s.png',
  './images/9h.png',
  './images/9k.png',
  './images/9r.png',
  './images/9s.png',
  './images/10h.png',
  './images/10k.png',
  './images/10r.png',
  './images/10s.png',
  './images/jh.png',
  './images/jk.png',
  './images/jr.png',
  './images/js.png',
  './images/qh.png',
  './images/qk.png',
  './images/qr.png',
  './images/qs.png',
  './images/kh.png',
  './images/kk.png',
  './images/kr.png',
  './images/ks.png',
  './images/ah.png',
  './images/ak.png',
  './images/ar.png',
  './images/as.png',
  './images/back.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});