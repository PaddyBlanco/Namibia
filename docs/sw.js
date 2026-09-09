// Service Worker fuer Offline-Faehigkeit (schlechtes/kein Netz unterwegs in Namibia).
// CACHE_VERSION und die versionierten URLs unten werden von
// scripts/build_site_data.py::stamp_asset_versions() automatisch gepflegt -
// nicht von Hand aendern, ausser den Dateinamen in PRECACHE_URLS selbst.
const CACHE_VERSION = "a1d6a014";
const CACHE_NAME = "namibia2026-" + CACHE_VERSION;
const PRECACHE_URLS = [
  "./",
  "assets/css/style.css?v=f7a76650",
  "assets/js/app.js?v=aa9e863c",
  "assets/data/site-data.json",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || !req.url.startsWith(self.location.origin)) return;

  // Kostendaten: bei Netz immer die frischeste Version holen und cachen,
  // ohne Netz auf die zuletzt bekannte zurueckfallen (kein Fehlerbild).
  if (req.url.endsWith("/assets/data/site-data.json")) {
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // App-Shell (HTML/CSS/JS): sofort aus dem Cache antworten, im Hintergrund
  // parallel neu laden und den Cache auffrischen - schnell UND aktuell.
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req).then((res) => {
        if (res.ok) caches.open(CACHE_NAME).then((cache) => cache.put(req, res.clone()));
        return res;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
