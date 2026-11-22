/**
 * LigaFoot Optimizer PWA — Service Worker (sw.js)
 * Cache-First + Background Refresh untuk seluruh App Shell sehingga
 * aplikasi bisa dibuka 100% offline di HP (termasuk Mode Pesawat).
 */
const CACHE_NAME = 'ligafoot-opt-pwa-v8-4-5';

const APP_SHELL_FILES = [
  './',
  './index.html',
  './styles.css',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './js/engine/config.js',
  './js/engine/utils.js',
  './js/engine/economy.js',
  './js/engine/tactics.js',
  './js/engine/roster.js',
  './js/engine/scout.js',
  './js/engine/club.js',
  './js/storage.js',
  './js/gdrive.js',
  './js/ui/core.js',
  './js/ui/tab1_command.js',
  './js/ui/tab2_warroom.js',
  './js/ui/tab3_tactics.js',
  './js/ui/tab4_squad.js',
  './js/ui/tab5_academy.js',
  './js/ui/tab6_finance.js',
  './js/ui/tab7_scout.js',
  './js/ui/tab8_tools.js',
  './js/app_loader.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        APP_SHELL_FILES.map((url) => cache.add(url).catch(() => null))
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Database statis sudah di-cache di IndexedDB oleh storage.js
  if (url.pathname.includes('static_db')) {
    event.respondWith(
      fetch(req).catch(() => caches.match(req))
    );
    return;
  }

  // App Shell: Network-first untuk HTML/JS agar update GitHub Pages cepat masuk, fallback ke cache saat offline
  event.respondWith(
    fetch(req)
      .then((resp) => {
        if (resp && resp.status === 200 && resp.type === 'basic') {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone)).catch(() => null);
        }
        return resp;
      })
      .catch(() => caches.match(req).then((cached) => cached || caches.match('./index.html')))
  );
});
