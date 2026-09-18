// makeSite replaces this configuration with a content-versioned static manifest.
const OFFLINE_BUILD = /* OFFLINE_BUILD */ { version: 'development', urls: [] };
const CACHE_PREFIX = 'circuitjs1-app-cache-';
const CACHE_NAME = `${CACHE_PREFIX}${OFFLINE_BUILD.version}`;
const staticPaths = new Set(OFFLINE_BUILD.urls);

function cachePath(url) {
  const path = url.pathname.endsWith('/') ? `${url.pathname}index.html` : url.pathname;
  return staticPaths.has(path) ? path : null;
}

function immutableAsset(path) {
  return /\/assets\/[^/]+-[\w-]{8,}\.(js|css)$/.test(path)
    || /\/[A-F0-9]{32}\.cache\.(js|html)$/.test(path);
}

function usable(response, path) {
  if (!response.ok || response.redirected) return false;
  const type = response.headers.get('Content-Type') || '';
  // Never store an HTML fallback under a script, stylesheet or other asset URL.
  return path.endsWith('.html') ? type.includes('text/html') : !type.includes('text/html');
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Cache the complete simulator before activating; a failed download keeps
    // the previous worker available rather than publishing a partial offline app.
    for (let index = 0; index < OFFLINE_BUILD.urls.length; index += 8) {
      await Promise.all(OFFLINE_BUILD.urls.slice(index, index + 8).map(async path => {
        const response = await fetch(path, { cache: 'reload' });
        if (!usable(response, path)) throw new Error(`Invalid offline resource: ${path}`);
        await cache.put(path, response);
      }));
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // Keep the immediately preceding version for assets requested by open tabs.
    const names = (await caches.keys()).filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME);
    const previous = names.filter(name => name !== `${CACHE_PREFIX}v1`).pop();
    await Promise.all(names.filter(name => name !== previous).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || request.headers.has('Authorization')) return;
  const path = cachePath(url) || (url.pathname.startsWith('/circuit/') && immutableAsset(url.pathname) ? url.pathname : null);
  // Explicit static allowlist: never cache APIs, authentication or missing URLs.
  if (!path) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    if (immutableAsset(path)) {
      const names = await caches.keys();
      for (const name of [CACHE_NAME, ...names.filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)]) {
        const cached = await (await caches.open(name)).match(path);
        if (cached) return cached;
      }
    }
    try {
      const response = await fetch(request, { cache: 'no-cache' });
      if (usable(response, path)) {
        await cache.put(path, response.clone());
        return response;
      }
      const cached = await cache.match(path);
      return cached || response;
    } catch (error) {
      const cached = await cache.match(path);
      if (cached) return cached;
      throw error;
    }
  })());
});
