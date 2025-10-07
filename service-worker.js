// Build identifier: update this (or any content in this file) on each deploy to trigger SW update
const BUILD_ID = '2025-10-07T17:57:32Z-ea60501';
const STATIC_CACHE = `electra-static-${BUILD_ID}`;
const OFFLINE_PAGE = '/offline.html';
// Precache essential static assets (exclude navigation pages to keep them network-first)
const APP_SHELL = [
  '/styles.css',
  '/app.js',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon-180x180.png',
  '/icons/favicon-16x16.png',
  '/icons/favicon-32x32.png',
  '/icons/mstile-150x150.png',
  OFFLINE_PAGE
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    await cache.addAll(APP_SHELL);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
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

  // Cache-first for static assets (APP_SHELL only)
  if (APP_SHELL.includes(url.pathname)) {
    event.respondWith((async () => {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      try {
        const res = await fetch(event.request);
        const cache = await caches.open(STATIC_CACHE);
        cache.put(event.request, res.clone());
        return res;
      } catch (err) {
        // Fallback to offline page only for navigation (handled below), otherwise propagate
        return Promise.reject(err);
      }
    })());
    return;
  }

  // For navigation requests, always network-first, then cache, then offline page
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return caches.match('/') || caches.match(OFFLINE_PAGE);
        })
    );
  }
});
