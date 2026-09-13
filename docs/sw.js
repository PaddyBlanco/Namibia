// Service Worker fuer Offline-Faehigkeit (schlechtes/kein Netz unterwegs in Namibia).
// CACHE_VERSION und die versionierten URLs unten werden von
// scripts/build_site_data.py::stamp_asset_versions() automatisch gepflegt -
// nicht von Hand aendern, ausser den Dateinamen in PRECACHE_URLS selbst.
const CACHE_VERSION = "57621d93";
const CACHE_NAME = "namibia2026-" + CACHE_VERSION;
const PRECACHE_URLS = [
  "./",
  "index.html",
  "assets/css/style.css?v=a58d163d",
  "assets/js/app.js?v=7b8a7315",
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

  // Kostendaten laufen NICHT ueber den Worker: app.js holt sie selbst von
  // zwei Quellen und haelt den letzten Stand in localStorage (11.09.2026).
  if (new URL(req.url).pathname.endsWith("/assets/data/site-data.json")) return;

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
