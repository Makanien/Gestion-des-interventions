/* =========================================================
   Climat Elec — Service Worker
   Stratégie : cache-first sur l'app shell pour un fonctionnement
   100% hors ligne après la première visite (avec réseau).
   Incrémenter CACHE_VERSION à chaque déploiement de nouvelle version.
   ========================================================= */
const CACHE_VERSION = "climatelec-v11";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./config.js",
  "./idb.js",
  "./supabase.js",
  "./sync.js",
  "./signature.js",
  "./pdf.js",
  "./app.js",
  "./manifest.json",
  "./logo-data.js",
  "./assets/logo-climat-elec.png",
  "./vendor/jspdf.umd.min.js",
  "./vendor/pdf-lib.min.js",
  "./vendor/supabase-js.min.js",
  "./icons/favicon-16x16.png",
  "./icons/favicon-32x32.png",
  "./icons/favicon.ico",
  "./icons/android-chrome-192x192.png",
  "./icons/android-chrome-512x512.png",
  "./icons/icon-maskable-192.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (response && response.status === 200 && response.type === "basic") {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          if (event.request.mode === "navigate") return caches.match("./index.html");
        });
    })
  );
});
