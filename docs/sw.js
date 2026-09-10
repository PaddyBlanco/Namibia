// Service Worker fuer Offline-Faehigkeit (schlechtes/kein Netz unterwegs in Namibia).
// CACHE_VERSION und die versionierten URLs unten werden von
// scripts/build_site_data.py::stamp_asset_versions() automatisch gepflegt -
// nicht von Hand aendern, ausser den Dateinamen in PRECACHE_URLS selbst.
const CACHE_VERSION = "07f695a7";
const CACHE_NAME = "namibia2026-" + CACHE_VERSION;
const PRECACHE_URLS = [
  "./",
  "index.html",
  "assets/css/style.css?v=e5ad36c6",
  "assets/js/app.js?v=f01b93e6",
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
  const url = new URL(req.url);
  if (url.pathname.endsWith("/assets/data/site-data.json")) {
    const key = url.origin + url.pathname; // ohne ?t=, sonst waechst der Cache pro Aufruf
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(key, copy));
        return res;
      }).catch(() => caches.match(key))
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
