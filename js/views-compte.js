/* js/views-compte.js — compte & synchronisation, équipe & rôles, confidentialité. Extrait d'app.js (BP-03) : script classique, portée globale partagée ;
   chargé avant app.js dans l'ordre de index.html. */
// ---------------------------------------------------------
// COMPTE & SYNCHRONISATION (V2)
// ---------------------------------------------------------
// SYNC-01 : libellé lisible d'un conflit selon la table concernée.
async function conflictLabel(c) {
  const row = await DB.getRaw(c.store, c.id).catch(() => null);
  return row?.numero || row?.nom || row?.designation || row?.legende || c.id;
}

async function renderAccount() {
  const supConfigured = Supabase.configured();
  const user = state.auth?.user;
  const profile = state.auth?.profile;
  const pending = state.sync.pending || 0;
  // SYNC-01 : conflits en attente de résolution explicite.
  const conflicts = (window.Sync && Sync.state.conflicts) || [];
  const conflictRows = await Promise.all(conflicts.map(async (c) => ({ ...c, label: await conflictLabel(c) })));
  // SYNC-03 : éléments refusés par le serveur (RLS, contrainte…) ou trop
  // souvent retentés — en attente d'un choix explicite. Aucune perte : la
  // copie locale reste intacte jusqu'à la résolution.
  const failures = (window.Sync && Sync.state.failures) || [];
  const failureRows = await Promise.all(failures.map(async (f) => ({ ...f, label: await conflictLabel(f) })));
  const errorLogRows = ErrorLog.list(); // BP-06

  setApp(`
    ${topbar({ title: "Compte & synchro", back: true })}
    <main>
      ${user ? `
      <div class="section-label">Mon compte</div>
      <div class="card">
        <div class="kv"><div class="k">Nom</div><div class="v">${esc(profile?.full_name || "-")}</div></div>
        <div class="kv"><div class="k">Rôle</div><div class="v">${esc(ROLE_LABELS[currentRole()] || currentRole())}</div></div>
        <div class="kv"><div class="k">E-mail</div><div class="v">${esc(user.email || "-")}</div></div>
      </div>
      <div class="field" style="margin-top:14px;">
        <label>Nom affiché</label>
        <input id="acct-name" type="text" value="${esc(profile?.full_name || "")}" placeholder="Votre nom de technicien" />
        <button class="btn btn-primary" id="btn-save-name" style="margin-top:10px;">Enregistrer le nom</button>
      </div>
      ${currentRole() === "responsable" ? `
      <div class="section-label">Équipe &amp; rôles</div>
      <div class="card" id="team-roles"><div class="block-text">Chargement…</div></div>
      <div class="block-text" style="font-size:12px;margin-top:6px;">Un nouveau compte arrive « En attente de validation » et n'accède à aucune donnée : attribuez-lui un rôle. Le rôle Développeur ne s'attribue pas depuis l'application.</div>` : ""}` : `
      <div class="section-label">Compte</div>
      <div class="card"><div class="block-text">Non connecté. Connectez-vous pour synchroniser vos fiches entre appareils.</div></div>
      <button class="btn btn-accent" data-nav="login" style="margin-top:12px;">${ICONS.user} Se connecter</button>`}

      <div class="section-label">Synchronisation</div>
      <div class="card" style="padding:14px;">
        ${supConfigured && state.auth
          ? `<div class="sync-status ${navigator.onLine ? "ok" : "warn"}"><span class="dot"></span>${navigator.onLine ? "En ligne — synchronisation automatique active" : "Hors ligne — les changements seront synchronisés dès le retour du réseau"}</div>
             <div class="sync-status ${pending === 0 ? "ok" : "warn"}"><span class="dot"></span>${pending === 0 ? "Aucun changement en attente" : `${pending} changement(s) en attente d'envoi`}</div>
             ${conflictRows.length ? `
             <div class="sync-status warn"><span class="dot"></span>⚠ ${conflictRows.length} conflit(s) : versions locale et serveur divergentes — aucune donnée n'a été écrasée</div>
             <div class="block-text" style="margin:4px 0 8px;font-size:13px;">Ni l'un ni l'autre choix ne fusionne les deux versions : l'autre sera perdue. <strong>Avant de choisir, notez ce que vous voulez conserver</strong> de la version qui ne sera pas retenue, puis ressaisissez-le après la résolution.</div>
             ${conflictRows.map((c) => `
               <div class="kv"><div class="k">${esc(c.store)}</div><div class="v">${esc(c.label)}</div></div>
               <div style="display:flex;gap:8px;flex-wrap:wrap;margin:6px 0 10px;">
                 <button class="btn btn-primary" data-nav="conflict-keep-local" data-store="${esc(c.store)}" data-id="${esc(c.id)}">Garder ma version</button>
                 <button class="btn btn-ghost" data-nav="conflict-keep-remote" data-store="${esc(c.store)}" data-id="${esc(c.id)}">Garder la version serveur</button>
             </div>`).join("")}` : ""}
             ${failureRows.length ? `
             <div class="sync-status warn"><span class="dot"></span>⚠ ${failureRows.length} élément(s) impossible(s) à synchroniser — vos données restent enregistrées sur cet appareil</div>
             ${failureRows.map((f) => `
               <div class="kv"><div class="k">${esc(f.store)}</div><div class="v">${esc(f.label)}</div></div>
               <div class="block-text" style="font-size:12px;margin:0;">Motif : ${esc(f.reason || "Erreur inconnue")}${f.status === "permanent" ? " — erreur permanente" : ` — après ${f.attempts} tentatives`}</div>
               <div style="display:flex;gap:8px;flex-wrap:wrap;margin:6px 0 10px;">
                 <button class="btn btn-primary" data-nav="sync-retry-failed" data-store="${esc(f.store)}" data-id="${esc(f.id)}">Réessayer</button>
                 <button class="btn btn-ghost" data-nav="sync-discard-failed" data-store="${esc(f.store)}" data-id="${esc(f.id)}">Ne plus synchroniser cet élément</button>
               </div>`).join("")}` : ""}
               <button class="btn btn-primary" data-nav="sync-now" style="margin-top:12px;">${ICONS.sync} Synchroniser maintenant</button>
              <button class="btn btn-ghost" data-nav="force-resend" style="margin-top:12px;">Tout renvoyer vers le serveur (récupération)</button>
              <button class="btn btn-ghost" data-nav="reset-pull" style="margin-top:12px;">Re-télécharger toutes les données (récupération)</button>`
          : `<div class="sync-status warn"><span class="dot"></span>${supConfigured ? "Connectez-vous pour activer la synchronisation." : "Supabase non configuré (voir config.js)."}</div>`}
      </div>

      <div class="section-label">Journal d'erreurs (support)</div>
      <div class="card" style="padding:14px;">
        ${errorLogRows.length
          ? `<div class="block-text" style="font-size:12px;margin:0 0 8px;">Les ${errorLogRows.length} dernières erreurs de cet appareil (aucune donnée client, rien n'est envoyé automatiquement).</div>
             ${errorLogRows.slice(0, 15).map((e) => `<div class="block-text" style="font-size:12px;margin:0 0 6px;word-break:break-word;"><strong>${esc(new Date(e.at).toLocaleString("fr-FR"))}</strong> — ${esc(e.message)}${e.cause ? ` : ${esc(e.cause)}` : ""}${e.code ? ` (${esc(e.code)})` : ""}${e.status ? ` HTTP ${esc(e.status)}` : ""}</div>`).join("")}
             <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
               <button class="btn btn-ghost" data-nav="errorlog-copy">Copier le journal</button>
               <button class="btn btn-ghost" data-nav="errorlog-clear">Vider</button>
             </div>`
          : `<div class="block-text" style="margin:0;">Aucune erreur enregistrée.</div>`}
      </div>

      <div class="section-label">Données locales</div>
      <div class="card"><div class="block-text">Sauvegardez manuellement l'intégralité de vos données (clients, interventions, équipements, pièces, appels, rendez-vous, mesures, photos, documents, contrats) au format JSON, ou restaurez-les depuis un fichier de sauvegarde.</div></div>
      <button class="btn btn-ghost" data-nav="export" style="margin-top:12px;">${ICONS.down} Exporter toutes les données</button>
      <button class="btn btn-ghost" data-nav="import" style="margin-top:12px;">${ICONS.upload} Importer une sauvegarde</button>
      <input type="file" id="import-file" accept="application/json" style="display:none;" />

      ${state.auth ? `
      <label style="display:flex;gap:10px;align-items:flex-start;margin-top:16px;font-size:14px;">
        <input type="checkbox" id="purge-toggle" ${purgeOnLogoutEnabled() ? "checked" : ""} style="margin-top:3px;" />
        <span>Effacer les données de cet appareil à la déconnexion<br><span style="font-size:12px;opacity:.75;">Recommandé sur un téléphone partagé ou susceptible d'être perdu. Par défaut : activé pour les managers.</span></span>
      </label>` : ""}
      <div class="block-text" style="font-size:12px;margin-top:12px;">🔒 Les données de l'application sont enregistrées sur cet appareil sans chiffrement propre à l'application : <strong>activez le verrouillage de l'écran</strong> (code, empreinte ou visage).</div>
      <button class="btn btn-ghost" data-nav="privacy" style="margin-top:12px;">Confidentialité et données personnelles</button>

      ${state.auth ? `<button class="btn btn-ghost" data-nav="logout" style="margin-top:12px;color:var(--ce-danger);">Se déconnecter</button>` : ""}
    </main>
    <div class="toast" id="toast"></div>
  `);

  $("#btn-save-name")?.addEventListener("click", async () => {
    const name = $("#acct-name").value.trim();
    try { await Supabase.updateProfile(name); if (state.auth?.profile) state.auth.profile.full_name = name; toast("Nom enregistré"); }
    catch (err) { ErrorLog.error(err); toast("Erreur d'enregistrement", true); }
  });
  $("#import-file")?.addEventListener("change", () => importData());
  $("#purge-toggle")?.addEventListener("change", (e) => {
    try { localStorage.setItem("ce_purge_on_logout", e.target.checked ? "1" : "0"); } catch (err) { /* ignoré */ }
    toast(e.target.checked ? "Les données seront effacées à la déconnexion" : "Les données resteront sur l'appareil après déconnexion");
  });
  if (currentRole() === "responsable") renderTeamRoles();
}

// ---------------------------------------------------------
// Équipe & rôles (SEC-05 / SEC-07 / IMP-12) — responsable uniquement.
// L'autorité est la RPC serveur `set_user_role` (réservée au responsable,
// refuse `developpeur`, protège le dernier responsable, journalise).
// ---------------------------------------------------------
const ROLE_LABELS = {
  responsable: "Responsable", secretaire: "Secrétaire", technicien: "Technicien",
  developpeur: "Développeur", en_attente: "En attente de validation", inconnu: "Non chargé",
};
async function renderTeamRoles() {
  const box = $("#team-roles");
  if (!box) return;
  let team;
  try { team = await Supabase.listProfiles(); }
  catch (e) { box.innerHTML = `<div class="block-text">Liste indisponible (hors ligne ?).</div>`; return; }
  state.team = team;
  const me = state.auth?.user?.id;
  const rows = team.filter((p) => p.id !== me).sort((a, b) =>
    (b.role === "en_attente") - (a.role === "en_attente") || (a.full_name || "").localeCompare(b.full_name || ""));
  const options = (cur) => ["en_attente", "technicien", "secretaire", "responsable", ...(cur === "developpeur" ? ["developpeur"] : [])]
    .map((r) => `<option value="${r}" ${r === cur ? "selected" : ""} ${r === "developpeur" ? "disabled" : ""}>${esc(ROLE_LABELS[r])}</option>`).join("");
  box.innerHTML = rows.length ? rows.map((p) => `
    <div class="kv"><div class="k">${esc(p.full_name || `(sans nom) ${String(p.id).slice(0, 8)}`)}</div>
      <div class="v"><select data-role-target="${esc(p.id)}" data-role-prev="${esc(p.role)}">${options(p.role)}</select></div></div>`).join("")
    : `<div class="block-text">Aucun autre compte.</div>`;
}
document.addEventListener("change", async (e) => {
  const sel = e.target.closest?.("select[data-role-target]");
  if (!sel) return;
  const { roleTarget: target, rolePrev: prev } = sel.dataset;
  const next = sel.value;
  const name = sel.closest(".kv")?.querySelector(".k")?.textContent || "ce compte";
  if (!confirm(`Attribuer le rôle « ${ROLE_LABELS[next]} » à ${name} ?`)) { sel.value = prev; return; }
  sel.disabled = true;
  try { await Supabase.setUserRole(target, next); toast("Rôle mis à jour"); }
  catch (err) { ErrorLog.error(err); toast("Changement refusé : " + (err.message || "erreur"), true); }
  await renderTeamRoles();
});

// ---------------------------------------------------------
// Confidentialité (SEC-13) — page d'information. Les informations propres à
// l'exploitant (identité, contact, durées) viennent de config.js
// (`PRIVACY_INFO`) ; tant qu'elles ne sont pas renseignées, la page l'indique
// au lieu d'inventer une valeur.
// ---------------------------------------------------------
function renderPrivacy() {
  const info = window.PRIVACY_INFO || {};
  const todo = `<em>à renseigner par l'exploitant</em>`;
  setApp(`
    ${topbar({ title: "Confidentialité", back: true })}
    <main>
      <div class="section-label">Qui traite vos données ?</div>
      <div class="card"><div class="block-text">${info.exploitant ? esc(info.exploitant) : todo}${info.contact ? `<br>Contact : ${esc(info.contact)}` : `<br>Contact : ${todo}`}</div></div>

      <div class="section-label">Données traitées</div>
      <div class="card"><div class="block-text">Coordonnées des clients (nom, adresse, téléphone, e-mail), historique des interventions, équipements, photos, devis/factures importés, signatures, et comptes de l'équipe (nom, e-mail, rôle). Ces données servent à gérer les interventions, les rendez-vous et la facturation.</div></div>

      <div class="section-label">Où sont-elles stockées ?</div>
      <div class="card"><div class="block-text">Sur un serveur Supabase (base de données et fichiers) utilisé pour le compte de l'entreprise, avec accès limité aux comptes validés par le responsable, et en copie sur chaque appareil pour travailler hors ligne. Sur l'appareil, les données ne sont pas chiffrées par l'application : activez le verrouillage de l'écran. Un manager peut faire effacer les données de l'appareil à la déconnexion (réglage « Compte &amp; synchro »).</div></div>

      <div class="section-label">Durée de conservation</div>
      <div class="card"><div class="block-text">${info.conservation ? esc(info.conservation) : todo}<br>Les éléments supprimés dans l'application sont d'abord masqués puis purgés définitivement du serveur selon cette durée.</div></div>

      <div class="section-label">Vos droits</div>
      <div class="card"><div class="block-text">Un client peut demander l'accès à ses données, leur rectification ou leur effacement : adressez la demande au contact ci-dessus. Le responsable dispose d'outils pour exporter les données d'un client et les anonymiser.</div></div>
    </main>
    <div class="toast" id="toast"></div>
  `);
}

async function runSyncNow() {
  if (!navigator.onLine) { toast("Hors ligne — synchronisation impossible", true); return; }
  toast("Synchronisation…");
  try {
    // SYNC-01 : plus de pushAllLocal ici — seules les lignes réellement
    // modifiées localement (file persistée) sont envoyées.
    await Sync.runSync();
    toast("Synchronisation terminée");
    if (window.location.hash === "#/account") await renderAccount();
    else await renderHome();
  } catch (err) {
    ErrorLog.error(err);
    toast("Erreur de synchronisation — nouvel essai automatique", true);
    scheduleSyncRetry();
  }
}

// SYNC-01 : résolution explicite d'un conflit (Compte & synchro).
async function resolveConflictAction(store, id, keepLocal) {
  try {
    await Sync.resolveConflict(store, id, keepLocal);
    toast(keepLocal ? "Votre version a été renvoyée" : "Version serveur appliquée");
  } catch (e) {
    ErrorLog.error(e);
    toast("Résolution impossible — réessayez", true);
  }
  await renderAccount();
}

// SYNC-03 : retente un élément passé en erreur (Compte & synchro).
async function retryFailedAction(store, id) {
  if (!navigator.onLine) { toast("Hors ligne — réessayez à la reconnexion", true); return; }
  toast("Nouvel essai…");
  try {
    await Sync.retryFailed(store, id);
    toast("Synchronisation de l'élément effectuée");
  } catch (e) {
    ErrorLog.error("Nouvel essai de synchronisation échoué", e);
    toast("Élément toujours en erreur — voir le motif", true);
    scheduleSyncRetry();
  }
  await renderAccount();
}

// SYNC-03 : abandon explicite d'un élément (jamais appelé automatiquement) —
// il ne sera plus poussé ; la copie locale reste sur l'appareil.
async function discardFailedAction(store, id) {
  const f = ((window.Sync && Sync.state.failures) || []).find((x) => x.store === store && x.id === id);
  if (!f) { await renderAccount(); return; }
  const label = `${f.store} — ${String(f.id).slice(0, 8)}…`;
  if (!confirm(`Ne plus synchroniser « ${label} » ?\n\nLa modification concernée restera sur cet appareil, mais ne sera JAMAIS envoyée au serveur ni aux autres appareils.`)) return;
  Sync.discardFailed(store, id);
  toast("Élément retiré de la synchronisation");
  await renderAccount();
}

// SYNC-01 : renvoi massif explicite et averti (récupération uniquement).
async function forceResendAll() {
  if (!confirm("Renvoyer TOUTES les données locales vers le serveur ?\n\nAttention : en cas de divergence, la version locale écrasera celle du serveur. À n'utiliser qu'en cas de récupération nécessaire.")) return;
  toast("Renvoi en cours…");
  try {
    await Sync.pushAllLocal(true); // SYNC-03 : force=true (action explicite de récupération)
    await Sync.runSync();
    toast("Données renvoyées");
  } catch (e) {
    ErrorLog.warn(e);
    toast("Renvoi partiel — nouvel essai automatique", true);
    scheduleSyncRetry();
  }
  await renderAccount();
}

// SYNC recovery : re-télécharge l'intégralité des données depuis le serveur
// (réinitialise le curseur de pull). Utile si une synchro partielle a laissé
// des fiches manquantes sur cet appareil.
async function resetPullAll() {
  if (!navigator.onLine) { toast("Hors ligne — re-téléchargement impossible", true); return; }
  if (!confirm("Re-télécharger TOUTES les données depuis le serveur ?\n\nLes données locales existantes seront complétées par celles du serveur (sans écraser vos modifications en attente).")) return;
  toast("Téléchargement en cours…");
  try {
    if (Sync.resetPullCursor) await Sync.resetPullCursor();
    await Sync.runSync();
    toast("Données re-téléchargées");
  } catch (e) {
    ErrorLog.error(e);
    toast("Re-téléchargement partiel — nouvel essai automatique", true);
    scheduleSyncRetry();
  }
  if (window.location.hash === "#/account") await renderAccount();
  else await renderHome();
}
let _retryTimer = null;
function scheduleSyncRetry(delay = 5000) {
  if (_retryTimer) return;
  _retryTimer = setTimeout(async () => {
    _retryTimer = null;
    if (!navigator.onLine) return;
    try {
      // SYNC-01 : la file persistée est déjà l'état de la vérité locale ;
      // on ne repousse plus l'intégralité des données à chaque retry.
      await Sync.runSync();
      toast("Synchronisation réussie");
      if (window.location.hash === "#/account") await renderAccount();
      else await renderHome();
    } catch (err) {
      ErrorLog.warn("Nouvel essai de synchronisation échoué", err);
      scheduleSyncRetry(Math.min(delay * 2, 30000));
    }
  }, delay);
}

// ---------------------------------------------------------
// Synchronisation ↦ affichage : quand une modification venue d'un autre
// appareil (Realtime ou pull de sync) vient d'être appliquée localement,
// l'écran courant est re-rendu — plus besoin de rafraichir l'application
// pour voir les changements des autres sessions.
// Garde-fous : on n'interrompt JAMAIS une saisie (formulaire RDV / client /
// appel / contrat, wizard de fiche, feuille « Créer », modale de signature,
// champ actif) — la vue est rafraîchie à l'occasion suivante.
// ---------------------------------------------------------
window.onRemoteDataChanged = () => {
  const hash = window.location.hash || "#/";
  const safeHash =
    hash === "#/" ||
    ["#/clients", "#/stats", "#/account"].includes(hash) ||
    hash.startsWith("#/detail/") ||
    hash.startsWith("#/detail-contrat/");
  if (!safeHash) return; // wizard / formulaires : on ne touche pas à l'écran
  const ae = document.activeElement;
  // Seule la saisie de TEXTE en cours est préservée (un re-rendu effacerait
  // le champ non validé). Un filtre <select> focus ne fait pas perdre de
  // saisie : on laisse passer le rafraîchissement.
  if (ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA" || ae.isContentEditable)) return;
  if (document.querySelector(".sheet-overlay, .sig-overlay")) return;
  if (hash === "#/" && $("#tab-content")) renderTab(); // onglet courant + position de défilement préservées
  else route();
};

// Rattrapage des sessions restées ouvertes (Realtime coupé, onglet en
// arrière-plan, WebSocket instable) : relance un pull + push au retour
// sur l'application et régulièrement quand l'écran est visible.
async function syncWhenIdle() {
  if (!Supabase.configured() || !state.auth || !navigator.onLine) return;
  if (Sync.state?.running) return;
  try { await Sync.runSync(); } catch (e) { /* déjà journalisé — nouvel essai plus tard */ }
}
window.addEventListener("focus", syncWhenIdle);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") syncWhenIdle();
});

// BP-01 : sauvegarde du brouillon du wizard à la saisie (debounce), au passage
// en arrière-plan et à la fermeture — sans cela, la saisie de l'étape courante
// est perdue si l'OS tue l'application.
function isWizardRoute() {
  const h = window.location.hash || "";
  return !!state.draft && (h.startsWith("#/new") || h.startsWith("#/entretien"));
}
function snapshotWizardDraft(immediate) {
  if (!isWizardRoute()) return;
  try { readStepIntoDraftSilently(); } catch (e) { /* champs absents : on garde le brouillon tel quel */ }
  persistDraft(immediate);
}
function readStepIntoDraftSilently() {
  const s = wizardSteps()[state.step - 1];
  if (s && s.read) s.read();
}
document.addEventListener("input", () => snapshotWizardDraft(false));
document.addEventListener("change", () => snapshotWizardDraft(false));
window.addEventListener("pagehide", () => snapshotWizardDraft(true));
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") snapshotWizardDraft(true);
});
setInterval(() => { if (document.visibilityState === "visible") syncWhenIdle(); }, 30000);

