const CACHE_NAME = 'high-hand-admin-v3';
const ASSETS = [
    'admin.html',
    'manifest.json',
    'images/misc/icon-192.png',
    'images/misc/icon-512.png',
    'images/misc/logo.png',
    'css/admin.css'
];

self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching Files');
        return cache.addAll(ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activated');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(cache => cache !== CACHE_NAME)
          .map(cache => {
            console.log('Service Worker: Clearing Old Cache');
            return caches.delete(cache);
          })
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  console.log('Service Worker: Fetching', event.request.url);
  event.respondWith(
    fetch(event.request)
      .catch(() => caches.match(event.request))
  );
});