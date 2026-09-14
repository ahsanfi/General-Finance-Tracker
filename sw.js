/* Only the generic offline screen is cached. Account data and API calls never are. */
const CACHE = 'fintracker-offline-v1';
const offlineURL = new URL('offline.html', self.registration.scope).href;
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.add(new Request(offlineURL, {cache:'reload'}))));
});
self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  const scope = new URL(self.registration.scope);
  if (request.method !== 'GET' || url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  const appPage = url.pathname === scope.pathname || url.pathname === scope.pathname + 'index.html';
  if (request.mode === 'navigate' && appPage) {
    event.respondWith(fetch(request, {cache:'no-cache'}).catch(async () =>
      (await caches.match(offlineURL)) || new Response('FinTracker needs an internet connection. Reconnect and reopen the app.', {headers:{'Content-Type':'text/plain'}})));
  }
});
