// Retire the legacy cache-first worker. It cached HTML, missing-page fallbacks,
// and authenticated API responses indefinitely across deployments.
// Keep this file at its original URL so existing installations can upgrade.
self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter(name => name.startsWith('circuitjs1-app-cache-'))
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

// Deliberately do not intercept fetch: HTTP cache rules and the network handle
// requests, including login validation. Do not reload tabs or erase user data.
