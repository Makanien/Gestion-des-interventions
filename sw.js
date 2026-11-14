/* =========================================================
   Climat Elec — Service Worker
   Stratégie (BP-04) :
   - app shell (ASSETS) précaché à l'installation, servi cache-first, 100 % hors ligne ;
   - navigation, index.html et config.js : RÉSEAU d'abord (3 s max), cache en repli —
     une nouvelle version est donc vue dès qu'il y a du réseau ;
   - liste blanche : seules les URL de ASSETS sont mises en cache (jamais d'API ni de
     contenu tiers) ; tout le reste passe directement par le navigateur ;
   - CACHE_VERSION est ESTAMPILLÉ À LA BUILD (scripts/stamp-sw.mjs : empreinte du contenu
     de dist/) — plus d'incrément manuel, plus d'oubli. Hors build = « climatelec-dev ».
   ========================================================= */
// v31 : branche fix/sync-04-num-01 (v30 est utilisé par la branche
// fix/securite-analyse, non encore fusionnée — saut volontaire pour éviter
// le recoupement).
// v32 : fix/etape-1 — suppression de l'objet Storage à la suppression
// photo/document (SEC-02/SEC-11), retrait du bandeau « maquettes » (SEC-06).
// v33 : rattrapage Storage photos/documents (uploadPendingBinaries, repli data_url).
// v34 : étape 2 fiabilité — BP-01 (brouillon wizard persistant, bandeau MAJ, storage.persist), COH-05, SEC-03.
// v35 : SEC-03 — abandon de la RPC link_appel (lien appel → intervention via la synchronisation normale).
// v36 : signatures — upload sans upsert (la RLS du bucket interdit INSERT … ON CONFLICT DO UPDATE).
// v37 : fusion étape 2 + SYNC-01 (base du push = version vue à l'ouverture du formulaire), bandeau de conflit, présence d'édition (PRES-01), garde « plus un brouillon ».
// v38 : étape 3 — rôle `en_attente` + repli moindre privilège (SEC-05/SEC-09), propriétaire des
// données locales + purge à la déconnexion (SEC-04), Équipe & rôles (SEC-07), historique du
// dossier (IMP-01), page Confidentialité (SEC-13), CSP resserrée (SEC-12).
// v39 : retour À facturer → À valider (motif obligatoire).
// v40 : étape 4 — utils.js (esc/html), errorlog.js (BP-06), intervenants issus de profiles, zoom autorisé (BP-05).
// Historique avant l'estampillage automatique : dernière version manuelle = v40.
const CACHE_VERSION = "climatelec-dev"; // remplacé par scripts/stamp-sw.mjs (build)
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./config.js",
  "./utils.js",
  "./errorlog.js",
  "./idb.js",
  "./supabase.js",
  "./sync.js",
  "./sync-persist.js",
  "./signature.js",
  "./pdf.js",
  "./js/icons.js",
  "./js/statuts.js",
  "./js/modeles-entretien.js",
  "./js/state.js",
  "./js/helpers.js",
  "./js/shell.js",
  "./js/views-home.js",
  "./js/views-appel-rdv.js",
  "./js/views-wizard.js",
  "./js/presence.js",
  "./js/views-detail.js",
  "./js/views-stats.js",
  "./js/views-contrat.js",
  "./js/nav-events.js",
  "./js/auth.js",
  "./js/views-compte.js",
  "./app.js",
  "./manifest.json",
  "./logo-data.js",
  "./assets/logo-climat-elec.png",
  "./vendor/jspdf.umd.min.js",
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

const NETWORK_FIRST = new Set(["/", "/index.html", "/config.js"]);
const NETWORK_TIMEOUT_MS = 3000;
const PRECACHED = new Set(ASSETS.map((a) => new URL(a, self.location).pathname));

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_VERSION).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function networkFirst(request, fallbackKey) {
  return new Promise((resolve) => {
    let settled = false;
    const useCache = () =>
      caches.match(fallbackKey || request, { ignoreSearch: true }).then((hit) => {
        if (hit) return resolve(hit);
        return null;
      });
    const timer = setTimeout(() => {
      if (!settled) useCache();
    }, NETWORK_TIMEOUT_MS);
    fetch(request)
      .then((response) => {
        clearTimeout(timer);
        if (response && response.status === 200 && response.type === "basic") {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(fallbackKey || request, clone));
        }
        settled = true;
        resolve(response);
      })
      .catch(() => {
        clearTimeout(timer);
        settled = true;
        useCache().then(() => resolve(Response.error()));
      });
  });
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Supabase, CDN… : jamais interceptés

  const isNavigation = request.mode === "navigate";
  if (isNavigation || NETWORK_FIRST.has(url.pathname)) {
    event.respondWith(networkFirst(request, isNavigation ? "./index.html" : request));
    return;
  }
  if (!PRECACHED.has(url.pathname)) return; // liste blanche : on ne met rien d'autre en cache
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
});
