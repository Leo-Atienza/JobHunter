/// <reference lib="webworker" />

const CACHE_NAME = 'jobhunter-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Skip non-GET and API/auth requests
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) return;

  // Network-first for HTML pages
  if (request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then((resp) => {
          if (resp.ok) {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          }
          return resp;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match('/'))),
    );
    return;
  }

  // Stale-while-revalidate for static assets (JS, CSS, images, fonts).
  // Serves cached version immediately, then updates cache in background.
  if (['style', 'script', 'image', 'font'].includes(request.destination)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request)
          .then((resp) => {
            if (resp.ok) {
              const clone = resp.clone();
              caches.open(CACHE_NAME).then((c) => c.put(request, clone));
            }
            return resp;
          })
          .catch(() => cached);

        // Return cached immediately if available, otherwise wait for network
        return cached || fetchPromise;
      }),
    );
  }
});
