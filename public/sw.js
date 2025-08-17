const CACHE = 'kids-flashcards-v2'; // bump para invalidar cache antigo com assets removidos
// Detect base path (GitHub Pages subdirectory) from service worker scope
const BASE = (self.registration && self.registration.scope) ? new URL(self.registration.scope).pathname.replace(/\/$/, '') : '';
const CORE_ASSETS = [
  BASE + '/',
  BASE + '/index.html',
  BASE + '/manifest.webmanifest'
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
  const url = new URL(req.url);
  const isHtml = req.destination === 'document' || (req.headers.get('accept')||'').includes('text/html');
  const isAsset = /\/assets\//.test(url.pathname);
  if (isHtml) {
    // network-first para HTML evitar apontar para bundle antigo
    e.respondWith(
      fetch(req).then(r => {
        const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return r;
      }).catch(()=> caches.match(req).then(c=> c || caches.match(BASE + '/index.html') || Response.error()))
    );
    return;
  }
  if (isAsset) {
    // stale-while-revalidate para assets versionados
    e.respondWith(
      caches.match(req).then(cacheRes => {
        const fetchPromise = fetch(req).then(networkRes => {
          if (networkRes.ok) caches.open(CACHE).then(c => c.put(req, networkRes.clone()));
          return networkRes;
        });
        return cacheRes || fetchPromise;
      })
    );
    return;
  }
  // default cache-first
  e.respondWith(
    caches.match(req).then(cacheRes => cacheRes || fetch(req).then(fetchRes => {
      if (fetchRes.ok) caches.open(CACHE).then(c => c.put(req, fetchRes.clone()));
      return fetchRes;
    }).catch(()=> caches.match(BASE + '/')))
  );
});
