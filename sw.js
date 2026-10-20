// Rebus Club offline support.
// The app itself is cached on install; the page is fetched fresh when online
// (so updates arrive) and served from the cache when offline.
const CACHE = 'rebus-club-3c5e35b915';
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
  'fonts/fonts.css',
  'fonts/archivo-black-latin.woff2',
  'fonts/archivo-black-latin-ext.woff2',
  'fonts/bricolage-grotesque-latin.woff2',
  'fonts/bricolage-grotesque-latin-ext.woff2',
  'fonts/figtree-latin.woff2',
  'fonts/figtree-latin-ext.woff2',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(APP)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

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

  // Everything else (icons, fonts, manifest): cache first. A theme's fonts aren't in APP, since
  // most players never pick that theme, so they're saved the first time they're fetched instead.
  event.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
    if (res.ok && url.pathname.includes('/fonts/')) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  })));
});
