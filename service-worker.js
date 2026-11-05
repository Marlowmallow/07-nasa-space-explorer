const CACHE_NAME = 'nasa-space-explorer-cache-v1';

const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './js/script.js',
  './js/dateRange.js',
  './manifest.json',
  './assets/icons/icon.svg',
  './img/nasa-worm-logo.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching app shell');
        return cache.addAll(APP_SHELL);
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => (
          key.startsWith('nasa-space-explorer-cache-') && key !== CACHE_NAME
        ))
          .map((key) => {
            console.log('[Service Worker] Deleting old cache:', key);
            return caches.delete(key);
          })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);
  const isApiCall = url.hostname === 'science.nasa.gov';

  if (isApiCall) {
    event.respondWith(networkFirst(event.request));
  } else if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(event.request));
  }
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }

  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.log('[Service Worker] Network request failed, serving from cache:', request.url);
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    throw error;
  }
}