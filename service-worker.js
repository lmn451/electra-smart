const STATIC_CACHE = 'electra-static-v1';
const API_CACHE = 'electra-api-v1';
const APP_SHELL = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => ![STATIC_CACHE, API_CACHE].includes(k)).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only handle same-origin requests
  if (url.origin !== location.origin) return;

  // Cache-first for static assets
  const isStatic = APP_SHELL.includes(url.pathname);
  if (isStatic) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request).then((res) => {
        const resClone = res.clone();
        caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, resClone));
        return res;
      }))
    );
    return;
  }

  // Network-first for API JSON with offline fallback (read-only)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).then((res) => {
        if (event.request.method === 'GET' && res.ok) {
          const resClone = res.clone();
          caches.open(API_CACHE).then((cache) => cache.put(event.request, resClone));
        }
        return res;
      }).catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        return new Response(JSON.stringify({ error: 'offline', message: 'No cached data available.' }), { status: 503, headers: { 'content-type': 'application/json' } });
      })
    );
    return;
  }
});