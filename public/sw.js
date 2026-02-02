/* Lexora PWA Service Worker - Cache-first for static, Network-first for API */
const CACHE_VERSION = 'lexora-v2';
const PRECACHE = ['/', '/index.html', '/manifest.json', '/favicon.ico', '/offline.html'];
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;
const OFFLINE_URL = '/offline.html';

// Install - precache critical assets + skipWaiting for immediate activation
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
      .catch(() => {})
  );
});

// Listen for skipWaiting from page (update prompt)
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// Activate - claim clients, clean old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith('lexora-') && k !== STATIC_CACHE && k !== DYNAMIC_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch - apply strategies
self.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = new URL(request.url);
  const isNav = request.mode === 'navigate';

  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // Static assets - Cache First (HTML, CSS, JS, fonts, images)
  const isStatic = url.pathname.startsWith('/assets/') ||
    url.pathname.match(/\.(js|css|woff2?|ttf|otf|png|jpg|jpeg|webp|svg|ico|gif)$/);
  if (isStatic) {
    e.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // API / Supabase - Network First
  if (url.pathname.includes('/api') || url.pathname.includes('functions') || url.hostname.includes('supabase')) {
    e.respondWith(networkFirst(request, DYNAMIC_CACHE));
    return;
  }

  // HTML navigation - Network First with offline fallback
  if (isNav) {
    e.respondWith(
      fetch(request)
        .then((r) => (r.ok ? cachePut(request, r.clone(), DYNAMIC_CACHE).then(() => r) : Promise.reject()))
        .catch(() => caches.match(request).then((c) => c || caches.match(OFFLINE_URL)))
    );
    return;
  }

  // Default - Stale While Revalidate
  e.respondWith(staleWhileRevalidate(request, DYNAMIC_CACHE));
});

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const res = await fetch(request);
    if (res.ok) await cachePut(request, res.clone(), cacheName);
    return res;
  } catch {
    return new Response('', { status: 503, statusText: 'Service Unavailable' });
  }
}

async function networkFirst(request, cacheName) {
  try {
    const res = await fetch(request);
    if (res.ok) await cachePut(request, res.clone(), cacheName);
    return res;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response(JSON.stringify({ error: 'Offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cached = await caches.match(request);
  const fetchPromise = fetch(request).then(async (res) => {
    if (res.ok) await cachePut(request, res.clone(), cacheName);
    return res;
  });
  return cached || fetchPromise;
}

function cachePut(request, response, cacheName) {
  return caches.open(cacheName).then((cache) => cache.put(request, response));
}
