/* Lexora PWA Service Worker - Stale-while-revalidate static, Network-first API */
const CACHE_NAME = 'lexora-v1';
const PRECACHE = ['/', '/index.html', '/manifest.json', '/favicon.ico', '/offline.html'];
const OFFLINE_URL = '/offline.html';

// Static assets: js, css, png, svg, woff2
const STATIC_REGEX = /\.(js|css|png|svg|woff2)$/;

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
      .catch(() => {})
  );
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  // API / Supabase - Network-first
  if (url.pathname.includes('/api/') || url.hostname.includes('supabase.co')) {
    e.respondWith(networkFirst(request));
    return;
  }

  // Static assets (js, css, png, svg, woff2) - Stale-while-revalidate
  if (STATIC_REGEX.test(url.pathname) || url.pathname.startsWith('/assets/')) {
    e.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Navigation - Network-first con fallback offline
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then((r) => (r.ok ? cachePut(request, r.clone()).then(() => r) : Promise.reject()))
        .catch(() => caches.match(request).then((c) => c || caches.match(OFFLINE_URL)))
    );
    return;
  }

  // Default - Stale-while-revalidate
  e.respondWith(staleWhileRevalidate(request));
});

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const fetchPromise = fetch(request).then(async (res) => {
    if (res.ok) await cachePut(request, res.clone());
    return res;
  });
  return cached || fetchPromise;
}

async function networkFirst(request) {
  try {
    const res = await fetch(request);
    if (res.ok) await cachePut(request, res.clone());
    return res;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response(JSON.stringify({ error: 'Offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

function cachePut(request, response) {
  return caches.open(CACHE_NAME).then((cache) => cache.put(request, response));
}
