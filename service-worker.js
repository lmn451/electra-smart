const STATIC_CACHE = 'electra-static-v3';
const OFFLINE_PAGE = '/offline.html';
const APP_SHELL = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  OFFLINE_PAGE
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => ![STATIC_CACHE].includes(k)).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only handle same-origin requests
  if (url.origin !== location.origin) return;

  // Handle API requests with network-first strategy and offline fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          // If API fails, return a custom offline response for specific endpoints
          if (event.request.method === 'GET') {
            return new Response(
              JSON.stringify({
                error: 'Offline',
                message: 'This feature requires an internet connection'
              }),
              {
                status: 503,
                headers: { 'Content-Type': 'application/json' }
              }
            );
          }
          throw new Error('Network unavailable');
        })
    );
    return;
  }

  // Cache-first for static assets
  const isStatic = APP_SHELL.includes(url.pathname);
  if (isStatic) {
    event.respondWith(
      caches.match(event.request)
        .then((cached) => {
          if (cached) return cached;

          return fetch(event.request)
            .then((res) => {
              const resClone = res.clone();
              caches.open(STATIC_CACHE)
                .then((cache) => cache.put(event.request, resClone));
              return res;
            })
            .catch(() => {
              // If it's the main page and we can't fetch it, serve offline page
              if (url.pathname === '/' || url.pathname === '/index.html') {
                return caches.match(OFFLINE_PAGE);
              }
              throw new Error('Resource unavailable offline');
            });
        })
    );
    return;
  }

  // For navigation requests, try network first, then cache, then offline page
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return caches.match('/') || caches.match(OFFLINE_PAGE);
        })
    );
  }
});
