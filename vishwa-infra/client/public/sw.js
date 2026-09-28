// Minimal app-shell service worker. Goals, in order of importance:
//  1. Never make business data stale or wrong — every /api/ request always
//     goes straight to the network, untouched, never cached.
//  2. Let the browser (desktop or mobile) treat this as a real installable
//     app rather than just a bookmark.
//  3. Survive brief network hiccups (e.g. phone Wi-Fi drops for a second)
//     by falling back to the last good copy of the app shell.
//
// Network-first, not cache-first: Vite gives every build's JS/CSS a new
// hashed filename, so if we ever served a cached index.html referencing an
// old hash after an update, those files would 404. Always trying the
// network first means an online user always gets the current build; the
// cache is only a fallback for when the network genuinely isn't there.
const CACHE = 'vishwa-shell-v1';

self.addEventListener('install', () => { self.skipWaiting(); });

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/')) return; // always live, never cached

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || (request.mode === 'navigate' ? caches.match('/') : undefined)))
  );
});
