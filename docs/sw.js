/* Lake Wallenpaupack map — keeps the last-loaded map available when the signal is weak or gone.
   Network first, so a visitor online always gets the current map; the saved copy is used only when the network fails or takes too long. */
const CACHE = 'lake-map-v1';
const KEEP = u => u.origin === location.origin || u.hostname === 'cdn.jsdelivr.net' || u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || !KEEP(u)) return;                 // weather, traffic and everything else go straight to the network
  e.respondWith((async () => {
    const cache = await caches.open(CACHE), key = u.origin === location.origin ? u.origin + u.pathname : e.request.url;   // one saved copy per file, whatever the ?query
    const net = fetch(e.request).then(r => { if (r && (r.ok || r.type === 'opaque')) cache.put(key, r.clone()); return r; });
    const saved = await cache.match(key);
    if (!saved) return net;
    return Promise.race([net.catch(() => saved), new Promise(res => setTimeout(() => res(saved), 5000))]);
  })());
});
