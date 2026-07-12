/*
 * Capno service worker — offline support.
 *
 * Strategy:
 *  - Navigations (HTML): network-first, falling back to the cached copy so a
 *    previously-visited view (student monitor, controller, library) opens
 *    with no connectivity. Scenario data ships inside the JS bundle, so a
 *    cached page is a fully working simulator.
 *  - Static assets (/_next/static, icons, manifest): cache-first — they are
 *    content-hashed and immutable.
 */

const VERSION = 'capno-v5';
const RUNTIME_CACHE = `${VERSION}-runtime`;
const PAGE_CACHE = `${VERSION}-pages`;

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((n) => !n.startsWith(VERSION)).map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Immutable build assets + icons + brand art: cache-first.
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/brand/') ||
    url.pathname === '/manifest.webmanifest'
  ) {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      }),
    );
    return;
  }

  // Page navigations: network-first with cache fallback.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(PAGE_CACHE);
        try {
          const response = await fetch(request);
          if (response.ok) cache.put(request, response.clone());
          return response;
        } catch {
          const cached = await cache.match(request);
          if (cached) return cached;
          // Last resort: any cached page shell (client router recovers the route).
          const shell = await cache.match('/');
          if (shell) return shell;
          throw new Error('offline and not cached');
        }
      })(),
    );
  }
});
