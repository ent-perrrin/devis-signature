/* Mon carnet – fonctionnement hors ligne.
   Change VERSION à chaque mise à jour pour que les téléphones récupèrent la nouvelle version. */
const VERSION = 'carnet-v1';
const LOCAL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];
const REMOTE = [
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    await c.addAll(LOCAL);
    // Bibliothèques PDF : mises en cache au premier lancement avec Internet
    await Promise.all(REMOTE.map(async u => {
      try { const r = await fetch(u, { mode: 'cors' }); if (r.ok) { await c.put(u, r); return; } } catch (_) {}
      try { const r = await fetch(u, { mode: 'no-cors' }); await c.put(u, r); } catch (_) {}
    }));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Les services en ligne (relais Google, etc.) ne sont jamais mis en cache
  if (url.hostname.endsWith('script.google.com') || url.hostname.endsWith('googleusercontent.com')) return;
  e.respondWith((async () => {
    const c = await caches.open(VERSION);
    if (req.mode === 'navigate') {
      // Page : réseau d'abord (pour les mises à jour), sinon la copie enregistrée
      try { const r = await fetch(req); if (r && r.ok) c.put('./index.html', r.clone()); return r; }
      catch (_) { return (await c.match('./index.html')) || (await c.match('./')); }
    }
    const hit = await c.match(req, { ignoreSearch: url.origin === location.origin });
    if (hit) return hit;
    try {
      const r = await fetch(req);
      if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone()).catch(() => {});
      return r;
    } catch (_) {
      return new Response('', { status: 504, statusText: 'Hors ligne' });
    }
  })());
});
