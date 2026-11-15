/* =========================================================
   Climat Elec — Application : point d'entrée (init).
   Le code des écrans est dans js/ (BP-03) ; voir docs/ARCHITECTURE.md §1.
   ========================================================= */
// ---------------------------------------------------------
// Init
// ---------------------------------------------------------
window.addEventListener("online", updateOfflinePill);
window.addEventListener("offline", updateOfflinePill);

async function init() {
  startLabelLinker(); // BP-05 : noms accessibles des champs (voir utils.js)
  await DB.init();
  await ErrorLog.init(); // BP-06 : journal d'erreurs local
  await Sync.initPersisted(); // SYNC-01/02 : restaure file, curseur, conflits

  // BP-01 : restauration du brouillon de wizard s'il persiste en local
  try {
    const saved = await DB.getMeta("ce_wizard_draft");
    if (saved) {
      const parsed = JSON.parse(saved);
      state.draft = parsed.draft || null;
      state.draftType = parsed.draftType || "intervention";
      state.step = parsed.step || 1;
      if (state.draft) state.wizardDraftPending = true;
    }
  } catch (e) { ErrorLog.warn("Brouillon du wizard illisible — on repart à zéro", e); }

  // BP-01 : demander la persistance du stockage IndexedDB (évite l'éviction iOS/Android)
  if (navigator.storage && navigator.storage.persist) {
    try { await navigator.storage.persist(); } catch (e) { ErrorLog.warn("storage.persist() refusé", e); }
  }

  initSupabase();
  if (Supabase.configured()) {
    Supabase.onAuthChange(async (event, session) => {
      if (session?.user) {
        // SEC-04 : les données locales appartiennent à UN compte. Un autre
        // compte ne les voit jamais (purge si rien à perdre, sinon refus).
        if (!(await enforceLocalOwner(session.user))) return;
        const { profile: pro, cachedRole } = await loadAuthProfile(session.user);
        state.auth = { user: session.user, profile: pro, cachedRole };
        const team = await Supabase.listProfiles().catch(() => null);
        state.team = team || [];
        // SEC-05 : un compte `en_attente` / au profil inconnu n'ouvre ni
        // Realtime ni synchronisation (le serveur lui refuserait tout).
        if (isMember()) {
          Sync.initRealtime();
          // SYNC-01 : la migration initiale (données locales créées avant la
          // première connexion) n'est jouée qu'une fois (marqueur _meta) — plus
          // de pushAllLocal à chaque lancement / INITIAL_SESSION.
          if (event === "SIGNED_IN" || event === "INITIAL_SESSION") await Sync.initialPushIfNeeded();
          await Sync.runSync().catch((e) => {
            ErrorLog.warn("Sync échec (nouvel essai automatique)", e);
            toast("Synchronisation en attente de réseau", true);
            scheduleSyncRetry();
          });
        }
      } else {
        // SYNC-04 : session terminée (déconnexion, token révoqué…) — arrêt
        // propre du Realtime, symétrique de initRealtime() à la connexion.
        Sync.stopRealtime();
        state.auth = null;
      }
      if (window.location.hash === "#/login" && isMember()) await renderHome();
      else {
        // Compte sans rôle actif connecté depuis la page de connexion : on quitte
        // #/login pour que le routeur (et sa garde SEC-05) affiche l'écran dédié.
        if (window.location.hash === "#/login") history.replaceState(null, "", "#/");
        await route();
      }
    });
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).then((reg) => {
      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state !== "installed" || !navigator.serviceWorker.controller) return;
          state.updateAvailable = true;
          const hash = window.location.hash || "#/";
          const inForm = !!state.draft || hash.startsWith("#/new") || hash.startsWith("#/entretien") || hash.startsWith("#/appel") || hash.startsWith("#/contrat") || hash.startsWith("#/client-edit") || hash.startsWith("#/rdv");
          // BP-01 : ne jamais recharger pendant une saisie (wizard / formulaire) —
          // on propose un bandeau "Actualiser" à la place.
          if (inForm) showUpdateBanner();
          else window.location.reload();
        });
      });
      const checkForUpdates = () => reg.update().catch(() => {});
      checkForUpdates();
      window.addEventListener("focus", checkForUpdates);
      document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") checkForUpdates(); });
    }).catch((err) => ErrorLog.warn("SW registration failed", err));
  }
  await route();
}
init();
