/* js/shell.js — routeur et éléments communs de l'interface. Extrait d'app.js (BP-03) : script classique, portée globale partagée ;
   chargé avant app.js dans l'ordre de index.html. */
// ---------------------------------------------------------
// Router
// ---------------------------------------------------------
window.addEventListener("hashchange", route);

function go(hash) { window.location.hash = hash; }
function goReplace(hash) { window.location.replace(hash); }

async function route() {
  const hash = window.location.hash || "#/";
  const parts = hash.replace("#/", "").split("/").filter(Boolean);
  const isHome = parts.length === 0;
  if (!isHome) hideDraftResumeBanner();
  // PRES-01 : on ne signale « je modifie cette fiche » que tant que le wizard est ouvert.
  if (!["new", "entretien", "edit"].includes(parts[0])) stopPresence();

  // SEC-05 / SEC-09 : compte connecté sans rôle actif (en attente de validation,
  // ou profil non chargé) — seuls Compte, Connexion et Confidentialité restent
  // accessibles ; aucune donnée métier n'est affichée.
  if (!isMember() && !["account", "login", "privacy"].includes(parts[0])) {
    renderPending();
    window.scrollTo(0, 0);
    return;
  }

  if (parts[0] === "new") {
    if (!state.draft) { state.draft = emptyDraft("intervention"); state.draftType = "intervention"; }
    state.step = parts[1] ? parseInt(parts[1], 10) : 1;
    renderWizard();
  } else if (parts[0] === "entretien" && parts[1]) {
    if (!state.draft || state.draftType !== parts[1]) { state.draft = emptyDraft(parts[1]); state.draftType = parts[1]; }
    state.step = parts[2] ? parseInt(parts[2], 10) : 1;
    renderWizard();
  } else if (parts[0] === "edit" && parts[1]) {
    // Workflow 4 statuts : seul un brouillon peut être modifié. Garde sur la
    // route (accès direct par URL) — redirection vers le détail + message.
    const editTarget = await DB.getIntervention(parts[1]);
    const editStatut = DB.normalizeStatut(editTarget?.statut_dossier);
    if (editTarget && editStatut && editStatut !== "brouillon") {
      toast("Seul un brouillon peut être modifié", true);
      goReplace(`#/detail/${parts[1]}`);
      return;
    }
    await loadDraftFromIntervention(parts[1]);
    await loadDraftFromIntervention(parts[1]);
    if (state.draftType === "intervention") goReplace(`#/new/${state.step || 1}`);
    else goReplace(`#/entretien/${state.draftType}/${state.step || 1}`);
  } else if (parts[0] === "detail" && parts[1]) {
    await renderDetail(parts[1]);
  } else if (parts[0] === "appel") {
    if (parts[1]) await renderAppelEdit(parts[1]);
    else { state.appelDraft = null; await renderAppel(); }
  } else if (parts[0] === "rdv") {
    renderRdv(parts[1] || null);
  } else if (parts[0] === "contrats") {
    renderContrats();
  } else if (parts[0] === "contrat") {
    await renderContrat(parts[1] || null);
  } else if (parts[0] === "detail-contrat" && parts[1]) {
    await renderDetailContrat(parts[1]);
  } else if (parts[0] === "clients") {
    state.tab = "clients";
    await renderHome();
  } else if (parts[0] === "client" && parts[1]) {
    await renderClientDetail(parts[1]);
  } else if (parts[0] === "client-edit" && parts[1]) {
    await renderClientEdit(parts[1]);
  } else if (parts[0] === "stats") {
    await renderStats();
  } else if (parts[0] === "account") {
    renderAccount();
  } else if (parts[0] === "privacy") {
    renderPrivacy();
  } else if (parts[0] === "login") {
    renderAuth();
  } else {
    if (!state.wizardDraftPending) state.draft = null;
    await renderHome();
    if (state.wizardDraftPending) showDraftResumeBanner();
    // BP-01 : écran sûr — appliquer la mise à jour si aucun bandeau n'est déjà présenté.
    else if (state.updateAvailable && !updateBannerEl) window.location.reload();
  }
  window.scrollTo(0, 0);
}

// ---------------------------------------------------------
// Shell helpers
// ---------------------------------------------------------
function topbar({ title, subtitle, back, onHome, actions }) {
  const accountBtn = state.auth
    ? `<button class="icon-btn" data-nav="account" title="Compte & synchronisation" aria-label="Compte & synchronisation">${ICONS.checkedUser}</button>`
    : `<button class="icon-btn" data-nav="login" title="Se connecter" aria-label="Se connecter">${ICONS.user}</button>`;
  const extra = actions ? `<div class="topbar-actions">${actions}<button class="icon-btn" data-nav="account" title="Compte & synchronisation" aria-label="Compte & synchronisation">${state.auth ? ICONS.checkedUser : ICONS.user}</button></div>` : accountBtn;
  return `
  <div class="topbar">
    <div class="topbar-row">
      ${back ? `<button class="back-btn" data-nav="back" aria-label="Retour">${ICONS.back}</button>` : `<img class="brand-mark" src="icons/android-chrome-192x192.png" alt="Climat Elec" />`}
      <div>
        <h1>${esc(displayName())}</h1>
        ${subtitle ? `<div class="subtitle">${esc(subtitle)}</div>` : ""}
      </div>
      ${extra}
      ${onHome === false ? "" : `<button class="icon-btn" data-nav="export" title="Exporter mes données" aria-label="Exporter mes données">${ICONS.down}</button>`}
    </div>
    <div class="offline-pill" id="offline-pill"><span class="offline-dot"></span>Mode hors ligne — vos données restent sur cet appareil</div>
    ${state.auth && Sync ? `<div class="offline-pill" id="sync-pill" data-nav="account" role="button" style="background:#0d2b1a;color:#bfe8cf;cursor:pointer;"><span class="offline-dot" style="background:var(--ce-success);"></span><span id="sync-pill-text">Synchronisé</span></div>` : ""}
  </div>`;
}

function displayName() {
  if (state.auth) {
    const name = (state.auth.profile?.full_name || "").trim();
    const email = state.auth.user?.email || "";
    return name || email || "Mon compte";
  }
  return "Climat Elec";
}

function setApp(html) {
  $("#app").innerHTML = html;
  updateOfflinePill();
  // Message différé (voir flashToast) : affiché sur l'écran qui VIENT d'être rendu.
  if (state.flash && $("#toast")) {
    const msg = state.flash;
    state.flash = null;
    toast(msg);
  }
}
function updateOfflinePill() {
  const pill = $("#offline-pill");
  if (pill) pill.classList.toggle("show", !navigator.onLine);
  const syncPill = $("#sync-pill");
  if (syncPill && state.auth) {
    const txt = $("#sync-pill-text");
    // Couleurs par défaut (synchronisé / en cours) ; l'état « conflit » passe en alerte.
    syncPill.style.background = "#0d2b1a";
    syncPill.style.color = "#bfe8cf";
    if (!navigator.onLine) {
      syncPill.classList.add("show");
      if (txt) txt.textContent = "Hors ligne — synchronisation en attente";
    } else if (state.sync.conflicts > 0) {
      // SYNC-01 : un conflit non résolu doit se voir partout, pas seulement sur « Compte & synchro ».
      syncPill.classList.add("show");
      syncPill.style.background = "#4a2c05";
      syncPill.style.color = "#ffd9a0";
      if (txt) txt.textContent = `${state.sync.conflicts} conflit(s) à résoudre — touchez ici (Compte & synchro)`;
    } else if (state.sync.pending > 0) {
      syncPill.classList.add("show");
      if (txt) txt.textContent = `${state.sync.pending} changement(s) à synchroniser`;
    } else if (state.sync.errors > 0) {
      syncPill.classList.add("show");
      if (txt) txt.textContent = `${state.sync.errors} élément(s) impossible(s) à synchroniser — voir Compte & synchro`;
    } else {
      syncPill.classList.remove("show");
    }
  }
}

