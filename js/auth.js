/* js/auth.js — authentification et données locales (SEC-04). Extrait d'app.js (BP-03) : script classique, portée globale partagée ;
   chargé avant app.js dans l'ordre de index.html. */
// ---------------------------------------------------------
// AUTH (V2 — Supabase)
// ---------------------------------------------------------
function renderAuth() {
  const email = localStorage.getItem("ce_auth_email") || "";
  setApp(`
    <div class="auth-view">
      <img class="auth-logo" src="icons/android-chrome-192x192.png" alt="Climat Elec" />
      <h2 class="auth-title">Connexion</h2>
      <p class="auth-sub">Accédez à vos fiches d'intervention synchronisées</p>
      <div class="auth-card">
        <div class="field"><label>E-mail</label><input id="auth-email" type="email" value="${esc(email)}" placeholder="vous@climat-elec.fr" /></div>
        <button class="btn btn-accent" id="btn-magic">${ICONS.share} Envoyer un lien de connexion</button>
        <div class="auth-divider">ou</div>
        <div class="field"><label>Mot de passe</label><input id="auth-pass" type="password" placeholder="••••••••" /></div>
        <button class="btn btn-primary" id="btn-password">Se connecter</button>
        <p class="auth-hint">La connexion se fait par lien magique envoyé à votre e-mail, ou par mot de passe si vous en avez défini un. L'application reste utilisable hors ligne une fois connecté.</p>
      </div>
    </div>
    <div class="toast" id="toast"></div>
  `);
  $("#btn-magic").addEventListener("click", async () => {
    const email = $("#auth-email").value.trim();
    if (!email) { toast("Indiquez votre e-mail", true); return; }
    localStorage.setItem("ce_auth_email", email);
    const btn = $("#btn-magic"); btn.disabled = true;
    try { await Supabase.signInWithMagicLink(email); toast("Lien envoyé — ouvrez le lien sur ce téléphone"); }
    catch (err) { ErrorLog.error(err); toast("Erreur : " + (err.message || "envoi impossible"), true); }
    finally { btn.disabled = false; }
  });
  $("#btn-password").addEventListener("click", async () => {
    const email = $("#auth-email").value.trim();
    const password = $("#auth-pass").value;
    if (!email || !password) { toast("Renseignez e-mail et mot de passe", true); return; }
    localStorage.setItem("ce_auth_email", email);
    const btn = $("#btn-password"); btn.disabled = true;
    try { await Supabase.signInWithPassword(email, password); toast("Connecté"); go("#/"); }
    catch (err) { ErrorLog.error(err); toast("Identifiants invalides", true); }
    finally { btn.disabled = false; }
  });
}

// ---------------------------------------------------------
// SEC-04 — Données locales : propriétaire, purge, déconnexion
// Les données (clients, fiches, photos, factures en base64) sont stockées en
// clair dans IndexedDB. Trois protections :
//  1. un marqueur de PROPRIÉTAIRE (`ce_local_owner`) : un autre compte qui se
//     connecte sur l'appareil n'hérite jamais des données du précédent ;
//  2. une PURGE à la déconnexion (activée par défaut pour les managers) ;
//  3. un rappel d'activer le verrouillage de l'appareil (Compte & synchro).
// Non couvert : un verrouillage applicatif (PIN / biométrie) — un code propre
// à l'application ne protégerait pas des données lisibles dans IndexedDB.
// ---------------------------------------------------------
const LOCAL_KEYS_TO_WIPE = ["ce_appel_draft", "ce_technicien_nom"];

// Éléments locaux pas encore (ou pas correctement) synchronisés : file d'envoi,
// conflits, éléments en erreur. Leur perte serait définitive.
function localUnsyncedCount() {
  const st = window.Sync?.state;
  if (!st) return 0;
  return (st.queue?.length || 0) + (st.conflicts?.length || 0) + (st.failures?.length || 0);
}

function purgeOnLogoutEnabled() {
  let v = null;
  try { v = localStorage.getItem("ce_purge_on_logout"); } catch (e) { /* ignoré */ }
  if (v === "1") return true;
  if (v === "0") return false;
  return isManager(); // défaut : activé pour les managers, désactivé pour les techniciens
}

async function purgeLocalData() {
  if (draftPersistTimer) { clearTimeout(draftPersistTimer); draftPersistTimer = null; }
  state.draft = null;
  state.wizardDraftPending = false;
  state.appelDraft = null;
  state.clientsCache = [];
  await DB.purgeLocal();
  LOCAL_KEYS_TO_WIPE.forEach((k) => { try { localStorage.removeItem(k); } catch (e) { /* ignoré */ } });
}

// Vérifie que la base locale appartient bien au compte qui se connecte.
// Renvoie false si la connexion a été refusée ou si la page se recharge.
async function enforceLocalOwner(user) {
  const owner = await DB.getMeta("ce_local_owner");
  if (!owner) {
    // Première connexion (ou installation antérieure à SEC-04) : le compte
    // connecté adopte les données présentes.
    await DB.setMeta("ce_local_owner", user.id);
    return true;
  }
  if (owner === user.id) return true;

  if (localUnsyncedCount() > 0) {
    // Des modifications d'un AUTRE compte attendent d'être envoyées : on ne les
    // efface pas, on ne les montre pas non plus.
    try { await Supabase.signOut(); } catch (e) { ErrorLog.warn(e); }
    Sync.stopRealtime();
    state.auth = null;
    alert("Connexion refusée : cet appareil contient des modifications non synchronisées d'un autre compte.\n\nReconnectez-vous d'abord avec ce compte pour les envoyer au serveur, puis déconnectez-vous.");
    go("#/login");
    return false;
  }

  // Rien à perdre : on repart d'une base vide pour ce compte (tout est sur le serveur).
  try {
    await purgeLocalData();
    await DB.setMeta("ce_local_owner", user.id);
  } catch (e) {
    ErrorLog.warn("Purge locale impossible", e);
    try { await Supabase.signOut(); } catch (e2) { /* ignoré */ }
    state.auth = null;
    alert("Impossible de préparer cet appareil pour un autre compte (effacement des données locales échoué). Connexion refusée.");
    go("#/login");
    return false;
  }
  window.location.reload(); // repart d'un état mémoire propre (file de sync, curseur)
  return false;
}

async function signOutUser() {
  const purge = purgeOnLogoutEnabled();
  // Avant d'effacer : tenter d'envoyer ce qui attend (si le réseau le permet).
  if (purge && navigator.onLine && Supabase.configured() && localUnsyncedCount() > 0) {
    toast("Synchronisation avant déconnexion…");
    try { await Sync.runSync(); } catch (e) { ErrorLog.warn(e); }
  }
  const unsynced = localUnsyncedCount();
  let msg = purge
    ? "Se déconnecter ? Les données enregistrées sur cet appareil seront EFFACÉES (elles restent sur le serveur et reviendront à la prochaine connexion)."
    : "Se déconnecter ? Vos données déjà enregistrées restent sur cet appareil.";
  if (unsynced > 0) {
    msg += purge
      ? `\n\n⚠ ${unsynced} élément(s) ne sont PAS synchronisés avec le serveur et seront DÉFINITIVEMENT PERDUS. Annulez, puis ouvrez « Compte & synchro » pour les envoyer.`
      : `\n\nNote : ${unsynced} élément(s) restent à synchroniser — reconnectez-vous avec ce compte pour les envoyer.`;
  }
  if (!confirm(msg)) return;

  try { if (Supabase.configured()) await Supabase.signOut(); } catch (e) { ErrorLog.warn(e); }
  // SYNC-04 : ferme les canaux Realtime et permet un ré-abonnement propre
  // à la reconnexion (sinon les événements du compte précédent continuent
  // d'être reçus, et un second abonnement se superpose au premier).
  Sync.stopRealtime();
  state.auth = null;

  if (purge) {
    try {
      await purgeLocalData();
    } catch (e) {
      ErrorLog.warn("Purge locale impossible", e);
      alert("L'effacement des données de cet appareil a échoué. Vos données y sont toujours : videz les données du site depuis les réglages du navigateur si l'appareil est perdu ou partagé.");
      go("#/login");
      return;
    }
    window.location.hash = "#/login";
    window.location.reload(); // état mémoire propre (file de sync, curseur, caches)
    return;
  }
  go("#/login");
}

// SEC-05 / SEC-09 : écran des comptes sans rôle actif.
function renderPending() {
  const role = currentRole();
  const unknown = role !== "en_attente";
  setApp(`
    ${topbar({ title: unknown ? "Profil non chargé" : "Compte en attente" })}
    <main>
      <div class="empty-state" style="padding-top:48px;">
        <div class="glyph">${ICONS.user}</div>
        <h3>${unknown ? "Votre profil n'a pas pu être chargé" : "Votre compte est en attente de validation"}</h3>
        <p class="block-text">${unknown
          ? "Impossible de vérifier votre rôle (pas de réseau, ou serveur indisponible). Par sécurité, aucune donnée n'est affichée tant que le profil n'est pas chargé."
          : "Le responsable doit valider votre compte et vous attribuer un rôle avant que vous puissiez accéder aux fiches. Renseignez votre nom dans « Compte », puis prévenez le responsable."}</p>
        <button class="btn btn-primary" data-nav="reload-profile" style="margin-top:14px;">${ICONS.sync} Réessayer</button>
        <button class="btn btn-ghost" data-nav="account" style="margin-top:12px;">Compte</button>
      </div>
    </main>
    <div class="toast" id="toast"></div>
  `);
}

async function reloadProfile() {
  if (!state.auth?.user) return;
  const { profile, cachedRole } = await loadAuthProfile(state.auth.user);
  state.auth.profile = profile;
  state.auth.cachedRole = cachedRole;
  if (!profile) toast("Profil inaccessible — vérifiez la connexion", true);
  if (isMember()) {
    const team = await Supabase.listProfiles().catch(() => null);
    state.team = team || state.team;
    Sync.initRealtime();
    await Sync.initialPushIfNeeded().catch(() => {});
    Sync.runSync().catch(() => scheduleSyncRetry());
  }
  await route();
}

