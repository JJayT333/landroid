const CACHE_NAME = 'landroid-shell-v5';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './dist/app.js',
  './dist/app.css',
  './dist/workspaceStorage.js',
  './dist/storageProvider.js',
  './dist/workspaceDomain.js',
  './dist/auditLog.js',
  './dist/syncEngine.js',
  './dist/dropboxIntegration.js',
  './dist/mathEngine.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

function isNavigationRequest(request) {
  return request.mode === 'navigate' || request.destination === 'document';
}

const CACHEABLE_ORIGINS = new Set([self.location.origin]);
const CACHEABLE_CDN_PREFIXES = [
  'https://cdn.tailwindcss.com/',
  'https://unpkg.com/',
  'https://cdnjs.cloudflare.com/',
  'https://fonts.googleapis.com/',
  'https://fonts.gstatic.com/',
];

function isCacheable(url) {
  if (CACHEABLE_ORIGINS.has(new URL(url).origin)) return true;
  return CACHEABLE_CDN_PREFIXES.some((prefix) => url.startsWith(prefix));
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith((async () => {
    try {
      const response = await fetch(event.request);
      if (response && response.ok && isCacheable(event.request.url)) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
      }
      return response;
    } catch (_) {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      if (isNavigationRequest(event.request)) {
        const cachedIndex = await caches.match('./index.html');
        if (cachedIndex) return cachedIndex;
      }
      return new Response('Offline', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
  })());
});
