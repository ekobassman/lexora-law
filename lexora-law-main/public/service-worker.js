/* Lexora PWA Service Worker - Cache First for static, Network First for API */
const CACHE_VERSION = 'lexora-v1';
const PRECACHE = ['/', '/index.html', '/manifest.json', '/favicon.ico', '/offline.html'];
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;
const OFFLINE_URL = '/offline.html';

// Install - precache critical assets
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

// Activate - claim clients and clean old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k.startsWith('lexora-') && k !== STATIC_CACHE && k !== DYNAMIC_CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch - apply strategies
self.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = new URL(request.url);
  const isNav = request.mode === 'navigate';

  // Skip non-GET and cross-origin
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // Static assets - Cache First
  if (url.pathname.startsWith('/assets/') || url.pathname.match(/\.(js|css|woff2?|ttf|png|jpg|jpeg|webp|svg|ico)$/)) {
    e.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // API / dynamic - Network First (same-origin only)
  if (url.pathname.includes('/api') || url.pathname.includes('functions')) {
    e.respondWith(networkFirst(request, DYNAMIC_CACHE));
    return;
  }

  // HTML / navigation - Network First with offline fallback
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
