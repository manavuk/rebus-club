// Rebus Club offline support.
// The app itself is cached on install; the page is fetched fresh when online
// (so updates arrive) and served from the cache when offline.
const CACHE = 'rebus-club-17b82ae43f';
const FONTS = 'rebus-club-fonts';
const APP = [
  './',
  'index.html',
  'render.js',
  'puzzles.js',
  'meanings.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon-32.png',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(APP)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== FONTS).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Google Fonts: use the saved copy straight away and refresh it in the background.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.open(FONTS).then(async cache => {
        const hit = await cache.match(req);
        const fresh = fetch(req).then(res => { if (res.ok || res.type === 'opaque') cache.put(req, res.clone()); return res; }).catch(() => hit);
        return hit || fresh;
      })
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  // The page and its scripts: network first so updates arrive together, cache when offline.
  if (req.mode === 'navigate' || url.pathname.endsWith('.js')) {
    const key = req.mode === 'navigate' ? 'index.html' : req;
    event.respondWith(
      fetch(req)
        .then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(key, copy)); } return res; })
        .catch(() => caches.match(key))
    );
    return;
  }

  // Everything else (icons, manifest): cache first.
  event.respondWith(caches.match(req).then(hit => hit || fetch(req)));
});
