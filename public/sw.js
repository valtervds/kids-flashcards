const CACHE = 'kids-flashcards-v1';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(
    caches.match(req).then(cacheRes => cacheRes || fetch(req).then(fetchRes => {
      const copy = fetchRes.clone();
      caches.open(CACHE).then(c => c.put(req, copy));
      return fetchRes;
    }).catch(() => caches.match('/'))) // fallback root
  );
});
