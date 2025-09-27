const STATIC_CACHE = 'electra-static-v3';
const APP_SHELL = [
  '/',
  '/index.html',
  '/styles.css',
  '/manifest.webmanifest'
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

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only handle same-origin requests
  if (url.origin !== location.origin) return;

  // Bypass all API requests (never cache)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }

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

  // Cache-first for built assets (Vite) under /assets/
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request).then((res) => {
        const resClone = res.clone();
        caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, resClone));
        return res;
      }))
    );
    return;
  }
});
