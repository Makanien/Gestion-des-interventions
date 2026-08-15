/* =========================================================
   Climat Elec — Application (SPA légère, sans framework)
   ========================================================= */

const ICONS = {
  plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
  back: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  clock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 16 14"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`,
  share: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>`,
  chevron: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`,
  close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  wrench: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a4 4 0 1 0-5.4 5.4L2 19l3 3 7.3-7.3a4 4 0 0 0 5.4-5.4l-2.8 2.8-2-2 2.8-2.8z"/></svg>`,
  pencil: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="M15 5l4 4"/></svg>`,
  file: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></svg>`,
  down: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
  droplet: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2s7 7.6 7 12a7 7 0 0 1-14 0c0-4.4 7-12 7-12z"/></svg>`,
  user: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  sync: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 1-9 9 9 9 0 0 1-9-9 9 9 0 0 1 9-9"/><polyline points="20 3 21 12 12 11"/></svg>`,
};

let state = {
  view: "home",
  draft: null,      // brouillon intervention en cours de création
  step: 1,
  homeSearch: "",
  clientsCache: [],
  auth: null,       // { user, profile } | null
  sync: { running: false, lastPulledAt: null, pending: 0 },
};

// ---------------------------------------------------------
// Utils
// ---------------------------------------------------------
function $(sel, root = document) { return root.querySelector(sel); }
function $all(sel, root = document) { return [...root.querySelectorAll(sel)]; }
function esc(s) { return (s ?? "").toString().replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function todayISO() { return new Date().toISOString().slice(0, 10); }
function nowHM() { const d = new Date(); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; }

function toast(msg, isError) {
  let el = $("#toast");
  el.innerHTML = `${isError ? "" : ICONS.check}<span>${esc(msg)}</span>`;
  el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("show"), 2600);
}

function emptyDraft() {
  return {
    id: null,
    client_id: null,
    client: { nom: "", adresse: "", code_postal: "", ville: "", mail: "", tel: "", type_batiment: "" },
    type_intervention: "Dépannage",
    date: todayISO(),
    heure_arrivee: nowHM(),
    heure_depart: "",
    forfait_deplacement: "",
    statut: "terminee",
    equipements: [],
    descriptif_demande: "",
    action_realisee: "",
    pieces: [],
    devis_souhaite: false,
    devis_commentaire: "",
    technicien_nom: localStorage.getItem("ce_technicien_nom") || "",
    client_present: true,
    client_signature_nom: "",
    client_signature_url: null,      // V2 : image signature client
    technicien_signature_url: null,  // V2 : image signature technicien
  };
}

async function loadDraftFromIntervention(id) {
  const itv = await DB.getIntervention(id);
  if (!itv) { state.draft = null; go("#/"); return; }
  const d = emptyDraft();
  Object.assign(d, {
    id: itv.id,
    client_id: itv.client_id,
    type_intervention: itv.type_intervention,
    date: itv.date,
    heure_arrivee: itv.heure_arrivee,
    heure_depart: itv.heure_depart,
    forfait_deplacement: itv.forfait_deplacement,
    statut: itv.statut || "terminee",
    equipements: (itv.equipements || []).map((e) => ({ ...e })),
    descriptif_demande: itv.descriptif_demande,
    action_realisee: itv.action_realisee,
    pieces: (itv.pieces || []).map((p) => ({ ...p })),
    devis_souhaite: itv.devis_souhaite || false,
    devis_commentaire: itv.devis_commentaire,
    technicien_nom: itv.technicien_nom || "",
    client_present: itv.client_present !== false,
    client_signature_nom: itv.client_signature_nom || "",
    client_signature_url: itv.client_signature_url || null,
    technicien_signature_url: itv.technicien_signature_url || null,
  });
  const client = itv.client_id ? await DB.getClient(itv.client_id) : itv.client;
  d.client = { id: client?.id, nom: client?.nom || "", adresse: client?.adresse || "", code_postal: client?.code_postal || "", ville: client?.ville || "", mail: client?.mail || "", tel: client?.tel || "", type_batiment: client?.type_batiment || "" };
  if (!d.client_id) d.client_id = client?.id || null;
  state.draft = d;
  state.step = 1;
}

// ---------------------------------------------------------
// Router
// ---------------------------------------------------------
window.addEventListener("hashchange", route);

function go(hash) { window.location.hash = hash; }

async function route() {
  const hash = window.location.hash || "#/";
  const parts = hash.replace("#/", "").split("/").filter(Boolean);

  if (parts[0] === "new") {
    if (!state.draft) state.draft = emptyDraft();
    state.step = parts[1] ? parseInt(parts[1], 10) : 1;
    renderWizard();
  } else if (parts[0] === "edit" && parts[1]) {
    await loadDraftFromIntervention(parts[1]);
    go(`#/new/${state.step || 1}`);
  } else if (parts[0] === "detail" && parts[1]) {
    await renderDetail(parts[1]);
  } else if (parts[0] === "account") {
    renderAccount();
  } else if (parts[0] === "login") {
    renderAuth();
  } else {
    state.draft = null;
    await renderHome();
  }
  window.scrollTo(0, 0);
}

// ---------------------------------------------------------
// Shell helpers
// ---------------------------------------------------------
function topbar({ title, subtitle, back, onHome }) {
  const accountBtn = state.auth ? `<button class="icon-btn" data-nav="account" title="Compte & synchronisation">${ICONS.user}</button>` : "";
  return `
  <div class="topbar">
    <div class="topbar-row">
      ${back ? `<button class="back-btn" data-nav="back">${ICONS.back}</button>` : `<img class="brand-mark" src="icons/android-chrome-192x192.png" alt="Climat Elec" />`}
      <div>
        <h1>${esc(title)}</h1>
        ${subtitle ? `<div class="subtitle">${esc(subtitle)}</div>` : ""}
      </div>
      ${accountBtn}
      ${onHome === false ? "" : `<button class="icon-btn" data-nav="export" title="Exporter mes données">${ICONS.down}</button>`}
    </div>
    <div class="offline-pill" id="offline-pill"><span class="offline-dot"></span>Mode hors ligne — vos données restent sur cet appareil</div>
    ${state.auth && Sync ? `<div class="offline-pill" id="sync-pill" style="background:#0d2b1a;color:#bfe8cf;"><span class="offline-dot" style="background:var(--ce-success);"></span><span id="sync-pill-text">Synchronisé</span></div>` : ""}
  </div>`;
}

function setApp(html) {
  $("#app").innerHTML = html;
  updateOfflinePill();
}

function updateOfflinePill() {
  const pill = $("#offline-pill");
  if (pill) pill.classList.toggle("show", !navigator.onLine);

  const syncPill = $("#sync-pill");
  if (syncPill && state.auth) {
    const txt = $("#sync-pill-text");
    if (!navigator.onLine) {
      syncPill.classList.add("show");
      if (txt) txt.textContent = "Hors ligne — synchronisation en attente";
    } else if (state.sync.pending > 0) {
      syncPill.classList.add("show");
      if (txt) txt.textContent = `${state.sync.pending} changement(s) à synchroniser`;
    } else {
      syncPill.classList.remove("show");
    }
  }
}

// ---------------------------------------------------------
// HOME
// ---------------------------------------------------------
async function renderHome() {
  const interventions = await DB.listInterventions();
  const q = state.homeSearch.trim().toLowerCase();
  const filtered = q
    ? interventions.filter((i) => (i.client?.nom || "").toLowerCase().includes(q) || (i.type_intervention || "").toLowerCase().includes(q))
    : interventions;

  const list = filtered.length
    ? filtered.map(itemHTML).join("")
    : `<div class="empty-state">
        <div class="glyph">${ICONS.wrench}</div>
        <h3>${q ? "Aucun résultat" : "Aucune intervention"}</h3>
        <p>${q ? "Essayez un autre nom ou type d'intervention." : "Appuyez sur + pour créer votre première fiche d'intervention."}</p>
      </div>`;

  setApp(`
    ${topbar({ title: "Climat Elec", subtitle: `${interventions.length} intervention${interventions.length > 1 ? "s" : ""} enregistrée${interventions.length > 1 ? "s" : ""}` })}
    <main>
      <div class="search-wrap">
        ${ICONS.search}
        <input id="home-search" type="text" placeholder="Rechercher un client, un type…" value="${esc(state.homeSearch)}" />
      </div>
      <div id="itv-list">${list}</div>
    </main>
    <button class="fab" data-nav="new" aria-label="Nouvelle intervention">${ICONS.plus}</button>
    <div class="toast" id="toast"></div>
  `);

  $("#home-search").addEventListener("input", (e) => {
    state.homeSearch = e.target.value;
    $("#itv-list").innerHTML = renderFilteredList();
  });

  function renderFilteredList() {
    const qq = state.homeSearch.trim().toLowerCase();
    const f = qq ? interventions.filter((i) => (i.client?.nom || "").toLowerCase().includes(qq) || (i.type_intervention || "").toLowerCase().includes(qq)) : interventions;
    return f.length ? f.map(itemHTML).join("") : `<div class="empty-state"><div class="glyph">${ICONS.search}</div><h3>Aucun résultat</h3><p>Essayez un autre terme de recherche.</p></div>`;
  }
}

function itemHTML(itv) {
  const done = itv.statut === "terminee";
  return `
  <button class="intervention-item" data-nav="detail" data-id="${itv.id}">
    <span class="status-dot ${done ? "done" : "pending"}">${done ? ICONS.check : ICONS.clock}</span>
    <span class="ii-body">
      <span class="ii-top">
        <span class="ii-client">${esc(itv.client?.nom || "Client")}</span>
        <span class="ii-date">${fmtDateShort(itv.date)}</span>
      </span>
      <span class="ii-type">${esc(itv.type_intervention || "-")}</span>
      <span class="ii-tags">
        <span class="tag ${done ? "done" : "pending"}">${done ? "Terminée" : "À prévoir"}</span>
        ${itv.devis_souhaite ? `<span class="tag">Devis souhaité</span>` : ""}
      </span>
    </span>
    ${ICONS.chevron}
  </button>`;
}
function fmtDateShort(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

// ---------------------------------------------------------
// WIZARD (nouvelle intervention)
// ---------------------------------------------------------
const STEP_META = {
  1: { eyebrow: "Étape 1 / 5", title: "Client" },
  2: { eyebrow: "Étape 2 / 5", title: "Intervention" },
  3: { eyebrow: "Étape 3 / 5", title: "Équipement & demande" },
  4: { eyebrow: "Étape 4 / 5", title: "Action & pièces" },
  5: { eyebrow: "Étape 5 / 5", title: "Devis & signature" },
};

function stepsBarHTML(step) {
  return `<div class="steps-bar">${[1, 2, 3, 4, 5].map((n) => `<span class="${n < step ? "filled" : n === step ? "active" : ""}"></span>`).join("")}</div>`;
}

async function renderWizard() {
  if (state.step === 1) await ensureClientsCache();
  const meta = STEP_META[state.step];
  const bodies = { 1: stepClientHTML, 2: stepInterventionHTML, 3: stepEquipHTML, 4: stepActionHTML, 5: stepSignHTML };
  const body = bodies[state.step] ? bodies[state.step]() : "";

  setApp(`
    <div class="topbar">
      <div class="topbar-row">
        <button class="back-btn" data-nav="cancel">${ICONS.close}</button>
        <div>
          <h1>${state.draft?.id ? "Modifier l'intervention" : "Nouvelle intervention"}</h1>
        </div>
      </div>
      ${stepsBarHTML(state.step)}
    </div>
    <div class="step-title">
      <div class="step-eyebrow">${meta.eyebrow}</div>
      <h2>${meta.title}</h2>
    </div>
    <main style="padding-top:14px;">${body}</main>
    <div class="wizard-footer">
      ${state.step > 1 ? `<button class="btn btn-ghost" data-nav="prev">${ICONS.back} Retour</button>` : ""}
      <button class="btn ${state.step === 5 ? "btn-accent" : "btn-primary"}" data-nav="${state.step === 5 ? "finish" : "next"}">
        ${state.step === 5 ? `${ICONS.check} Valider la fiche` : "Continuer"}
      </button>
    </div>
    <div class="toast" id="toast"></div>
  `);

  wireStep(state.step);
}

async function ensureClientsCache() {
  state.clientsCache = await DB.listClients();
}

// ---- Step 1 : Client ----
function stepClientHTML() {
  const c = state.draft.client;
  return `
  <div class="card" style="padding:14px;">
    <div class="field combo">
      <label>Nom du client *</label>
      <input id="f-nom" type="text" autocomplete="off" placeholder="Rechercher ou saisir un nouveau nom" value="${esc(c.nom)}" />
      <div class="combo-list" id="combo-list" style="display:none;"></div>
    </div>
    <div class="field"><label>Adresse</label><input id="f-adresse" type="text" value="${esc(c.adresse)}" /></div>
    <div class="row2">
      <div class="field"><label>Code postal</label><input id="f-cp" type="text" inputmode="numeric" value="${esc(c.code_postal)}" /></div>
      <div class="field"><label>Ville</label><input id="f-ville" type="text" value="${esc(c.ville)}" /></div>
    </div>
    <div class="row2">
      <div class="field"><label>Téléphone</label><input id="f-tel" type="tel" value="${esc(c.tel)}" /></div>
      <div class="field"><label>Mail</label><input id="f-mail" type="email" value="${esc(c.mail)}" /></div>
    </div>
    <div class="field">
      <label>Type de bâtiment</label>
      <select id="f-type-bat">
        ${["", "Professionnel", "Maison + de 2 ans", "Maison - de 2 ans"].map((t) => `<option value="${esc(t)}" ${c.type_batiment === t ? "selected" : ""}>${t || "Non précisé"}</option>`).join("")}
      </select>
    </div>
  </div>`;
}

function wireClientStep() {
  const input = $("#f-nom");
  const list = $("#combo-list");

  function renderCombo() {
    const q = input.value.trim().toLowerCase();
    if (!q) { list.style.display = "none"; return; }
    const matches = state.clientsCache.filter((cl) => cl.nom.toLowerCase().includes(q)).slice(0, 6);
    const exact = state.clientsCache.some((cl) => cl.nom.toLowerCase() === q);
    let html = matches.map((cl) => `
      <div class="combo-item" data-client="${cl.id}">
        <div class="c-name">${esc(cl.nom)}</div>
        <div class="c-sub">${esc([cl.ville, cl.tel].filter(Boolean).join(" · ") || "—")}</div>
      </div>`).join("");
    if (!exact) {
      html += `<div class="combo-item new" data-client="__new__"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg><span>Créer « ${esc(input.value.trim())} »</span></div>`;
    }
    list.innerHTML = html || `<div class="combo-item">Aucun résultat</div>`;
    list.style.display = "block";
  }

  input.addEventListener("input", renderCombo);
  input.addEventListener("focus", renderCombo);

  list.addEventListener("click", (e) => {
    const item = e.target.closest("[data-client]");
    if (!item) return;
    const id = item.dataset.client;
    if (id === "__new__") {
      list.style.display = "none";
      $("#f-adresse").focus();
      return;
    }
    const cl = state.clientsCache.find((x) => x.id === id);
    if (cl) {
      state.draft.client = { ...cl };
      state.draft.client_id = cl.id;
      $("#f-nom").value = cl.nom || "";
      $("#f-adresse").value = cl.adresse || "";
      $("#f-cp").value = cl.code_postal || "";
      $("#f-ville").value = cl.ville || "";
      $("#f-tel").value = cl.tel || "";
      $("#f-mail").value = cl.mail || "";
      $("#f-type-bat").value = cl.type_batiment || "";
    }
    list.style.display = "none";
  });

  // si l'utilisateur modifie le nom après sélection, on considère que c'est potentiellement un nouveau client
  input.addEventListener("input", () => {
    if (state.draft.client_id) {
      const cl = state.clientsCache.find((x) => x.id === state.draft.client_id);
      if (cl && cl.nom !== input.value) state.draft.client_id = null;
    }
  });
}

// ---- Step 2 : Intervention ----
function stepInterventionHTML() {
  const d = state.draft;
  const types = ["Dépannage", "Entretien", "Diagnostique", "Rendez-vous", "Sur devis"];
  return `
  <div class="card" style="padding:14px;">
    <div class="field">
      <label>Type d'intervention</label>
      <select id="f-type-itv">${types.map((t) => `<option ${d.type_intervention === t ? "selected" : ""}>${t}</option>`).join("")}</select>
    </div>
    <div class="field"><label>Date</label><input id="f-date" type="date" value="${esc(d.date)}" /></div>
    <div class="row2">
      <div class="field"><label>Heure d'arrivée sur site</label><input id="f-h-arr" type="time" value="${esc(d.heure_arrivee)}" /></div>
      <div class="field"><label>Heure de départ du site</label><input id="f-h-dep" type="time" value="${esc(d.heure_depart)}" /></div>
    </div>
    <div class="field" style="margin-bottom:0;">
      <label>Forfait déplacement</label>
      <select id="f-forfait">
        ${["", "Z0 (Chazé-sur-Argos)", "Z1 (5 à 10 kms)", "Z2 (11 à 30 kms)", "Z3 (31 à 50 kms)", "Forfait"].map((z) => `<option value="${esc(z)}" ${d.forfait_deplacement === z ? "selected" : ""}>${z || "Non précisé"}</option>`).join("")}
      </select>
    </div>
  </div>
  <div class="section-label">Statut de l'intervention</div>
  <div class="segmented" id="f-statut">
    <button type="button" data-v="terminee" class="${d.statut === "terminee" ? "active" : ""}">${ICONS.check.replace('width="24" height="24"','width="14" height="14"')} Terminée</button>
    <button type="button" data-v="a_prevoir" class="${d.statut === "a_prevoir" ? "active" : ""}">${ICONS.clock.replace('width="24" height="24"','width="14" height="14"')} À prévoir</button>
  </div>`;
}

function wireInterventionStep() {
  $all("#f-statut button").forEach((b) => b.addEventListener("click", () => {
    $all("#f-statut button").forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
  }));
}

// ---- Step 3 : Équipement + descriptif ----
function equipLineHTML(eq, idx) {
  return `
  <div class="line-group" data-eq="${idx}">
    <div class="line-group-head"><span>Équipement ${idx + 1}</span><button type="button" class="remove-line" data-remove-eq="${idx}">${ICONS.trash.replace('width="24" height="24"','width="13" height="13"')} Supprimer</button></div>
    <div class="field" style="margin-bottom:10px;"><label>Intitulé</label><input type="text" data-eq-f="intitule" data-eq-i="${idx}" value="${esc(eq.intitule)}" placeholder="Ex : Pompe à chaleur air/eau" /></div>
    <div class="row2">
      <div class="field" style="margin-bottom:0;"><label>Marque</label><input type="text" data-eq-f="marque" data-eq-i="${idx}" value="${esc(eq.marque)}" /></div>
      <div class="field" style="margin-bottom:0;"><label>Modèle</label><input type="text" data-eq-f="modele" data-eq-i="${idx}" value="${esc(eq.modele)}" /></div>
    </div>
    <div class="field" style="margin-top:10px;margin-bottom:0;"><label>N° de série</label><input type="text" data-eq-f="numero_serie" data-eq-i="${idx}" value="${esc(eq.numero_serie)}" /></div>
  </div>`;
}

function stepEquipHTML() {
  const d = state.draft;
  return `
  <div class="section-label">Équipement(s) concerné(s)</div>
  <div id="eq-list">${d.equipements.map(equipLineHTML).join("")}</div>
  <button type="button" class="add-line-btn" id="add-eq">${ICONS.plus} Ajouter un équipement</button>

  <div class="section-label">Descriptif de la demande</div>
    <textarea id="f-descriptif" placeholder="Ce que signale ou demande le client…">${esc(d.descriptif_demande)}</textarea>`;
}

function wireEquipStep() {
  $("#add-eq").addEventListener("click", () => {
    state.draft.equipements.push({ intitule: "", marque: "", modele: "", numero_serie: "" });
    $("#eq-list").innerHTML = state.draft.equipements.map(equipLineHTML).join("");
    wireEquipLines();
  });
  wireEquipLines();
  autoResize("f-descriptif");
}
function autoResize(id) {
  const ta = document.getElementById(id);
  if (!ta) return;
  ta.style.height = "auto";
  ta.style.height = ta.scrollHeight + "px";
  ta.addEventListener("input", () => {
    ta.style.height = "auto";
    ta.style.height = ta.scrollHeight + "px";
  });
}
function wireEquipLines() {
  $all("[data-eq-f]").forEach((inp) => {
    inp.addEventListener("input", () => {
      const i = parseInt(inp.dataset.eqI, 10);
      state.draft.equipements[i][inp.dataset.eqF] = inp.value;
    });
  });
  $all("[data-remove-eq]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const i = parseInt(btn.dataset.removeEq, 10);
      state.draft.equipements.splice(i, 1);
      $("#eq-list").innerHTML = state.draft.equipements.map(equipLineHTML).join("");
      wireEquipLines();
    });
  });
}

// ---- Step 4 : Action réalisée + pièces ----
function pieceLineHTML(p, idx) {
  return `
  <div class="line-group" data-piece="${idx}">
    <div class="line-group-head"><span>Pièce ${idx + 1}</span><button type="button" class="remove-line" data-remove-piece="${idx}">${ICONS.trash.replace('width="24" height="24"','width="13" height="13"')} Supprimer</button></div>
    <div class="field" style="margin-bottom:10px;"><label>Désignation</label><input type="text" data-p-f="designation" data-p-i="${idx}" value="${esc(p.designation)}" /></div>
    <div class="row2">
      <div class="field" style="margin-bottom:0;"><label>Référence</label><input type="text" data-p-f="reference" data-p-i="${idx}" value="${esc(p.reference)}" /></div>
      <div class="field" style="margin-bottom:0;"><label>Quantité</label><input type="number" min="0" step="1" data-p-f="quantite" data-p-i="${idx}" value="${esc(p.quantite)}" /></div>
    </div>
  </div>`;
}

function stepActionHTML() {
  const d = state.draft;
  return `
  <div class="section-label">Action réalisée</div>
    <textarea id="f-action" placeholder="Détail de l'intervention effectuée…">${esc(d.action_realisee)}</textarea>
  <div class="section-label">Pièces utilisées</div>
  <div id="piece-list">${d.pieces.map(pieceLineHTML).join("")}</div>
  <button type="button" class="add-line-btn" id="add-piece">${ICONS.plus} Ajouter une pièce</button>`;
}

function wirePiecesStep() {
  $("#add-piece").addEventListener("click", () => {
    state.draft.pieces.push({ designation: "", reference: "", quantite: 1 });
    $("#piece-list").innerHTML = state.draft.pieces.map(pieceLineHTML).join("");
    wirePieceLines();
  });
  wirePieceLines();
  autoResize("f-action");
}
function wirePieceLines() {
  $all("[data-p-f]").forEach((inp) => {
    inp.addEventListener("input", () => {
      const i = parseInt(inp.dataset.pI, 10);
      const f = inp.dataset.pF;
      state.draft.pieces[i][f] = f === "quantite" ? Number(inp.value || 0) : inp.value;
    });
  });
  $all("[data-remove-piece]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const i = parseInt(btn.dataset.removePiece, 10);
      state.draft.pieces.splice(i, 1);
      $("#piece-list").innerHTML = state.draft.pieces.map(pieceLineHTML).join("");
      wirePieceLines();
    });
  });
}

// ---- Step 5 : Devis + signature + récap ----
function stepSignHTML() {
  const d = state.draft;
  return `
  <div class="toggle-row">
    <div><div class="t-label">Le client souhaite-t-il un devis</div><div class="t-hint">Une action de suivi sera à prévoir</div></div>
    <button class="switch ${d.devis_souhaite ? "on" : ""}" id="f-devis" type="button"></button>
  </div>
  <div class="card" style="padding:14px;margin-bottom:18px;">
    <div class="field" style="margin-bottom:0;"><label>Commentaire devis (optionnel)</label><textarea id="f-devis-com" placeholder="Précisions à conserver pour le devis…">${esc(d.devis_commentaire)}</textarea></div>
  </div>

  <div class="section-label">Signatures</div>
  <div class="card" style="padding:14px;">
    <div class="field"><label>Nom du technicien</label>
      <input id="f-tech" type="text" list="tech-list" value="${esc(d.technicien_nom)}" placeholder="Votre nom" />
      <datalist id="tech-list">
        <option value="GARDAIS Jérémy"></option>
        <option value="CHANTEUX Régis"></option>
      </datalist>
    </div>
    <div class="toggle-row" style="margin-top:2px;">
      <div><div class="t-label">Client présent</div></div>
      <button class="switch ${d.client_present ? "on" : ""}" id="f-present" type="button"></button>
    </div>
    <div class="field" style="margin-bottom:0;" id="wrap-client-sig">
      <label>Nom du client (signature)</label>
      <input id="f-client-sig" type="text" value="${esc(d.client_signature_nom)}" placeholder="${d.client.nom ? esc(d.client.nom) : "Nom du client"}" />
      <div class="hint">La signature électronique tactile est disponible : appuyez sur le bouton ci-dessous.</div>
    </div>
    <button type="button" class="add-line-btn" id="btn-client-sign" style="margin-top:10px;">${ICONS.pencil.replace('width="24" height="24"','width="15" height="15"')} Signer (client)</button>
    <div class="sig-preview" id="client-sig-preview" style="display:${d.client_signature_url ? "block" : "none"};margin-top:10px;">
      <img id="client-sig-img" src="${d.client_signature_url ? esc(d.client_signature_url) : ""}" alt="Signature client" />
    </div>
    <div class="field" style="margin-top:12px;">
      <label>Signature technicien (facultative)</label>
      <button type="button" class="add-line-btn" id="btn-tech-sign" style="margin-top:6px;">${ICONS.pencil.replace('width="24" height="24"','width="15" height="15"')} Signer (technicien)</button>
      <div class="sig-preview" id="tech-sig-preview" style="display:${d.technicien_signature_url ? "block" : "none"};margin-top:10px;">
        <img id="tech-sig-img" src="${d.technicien_signature_url ? esc(d.technicien_signature_url) : ""}" alt="Signature technicien" />
      </div>
    </div>
  </div>

  <div class="section-label">Récapitulatif</div>
  <div class="card">
    <div class="kv"><div class="k">Client</div><div class="v">${esc(d.client.nom || "-")}</div></div>
    <div class="kv"><div class="k">Type</div><div class="v">${esc(d.type_intervention)}</div></div>
    <div class="kv"><div class="k">Date</div><div class="v">${fmtDateShortLong(d.date)}</div></div>
    <div class="kv"><div class="k">Statut</div><div class="v">${d.statut === "terminee" ? "Terminée avec succès" : "À prévoir"}</div></div>
    <div class="kv"><div class="k">Équipements</div><div class="v">${d.equipements.length || 0}</div></div>
    <div class="kv"><div class="k">Pièces</div><div class="v">${d.pieces.length || 0}</div></div>
  </div>`;
}
function fmtDateShortLong(iso) {
  if (!iso) return "-";
  return new Date(iso + "T00:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
}

function wireSignStep() {
  $("#f-devis").addEventListener("click", (e) => e.currentTarget.classList.toggle("on"));
  $("#f-present").addEventListener("click", (e) => {
    e.currentTarget.classList.toggle("on");
    $("#wrap-client-sig").style.display = e.currentTarget.classList.contains("on") ? "block" : "none";
  });
  if (!state.draft.client_present) $("#wrap-client-sig").style.display = "none";
  autoResize("f-devis-com");

  // Signature tactile client
  $("#btn-client-sign")?.addEventListener("click", async () => {
    const blob = await signatureModal({ title: "Signature du client" });
    if (!blob) return;
    state.draft._client_sig_blob = blob;
    state.draft.client_signature_url = await blobToDataURL(blob);
    const prev = $("#client-sig-preview");
    prev.style.display = "block";
    $("#client-sig-img").src = state.draft.client_signature_url;
  });

  // Signature tactile technicien
  $("#btn-tech-sign")?.addEventListener("click", async () => {
    const blob = await signatureModal({ title: "Signature du technicien" });
    if (!blob) return;
    state.draft._technicien_sig_blob = blob;
    state.draft.technicien_signature_url = await blobToDataURL(blob);
    const prev = $("#tech-sig-preview");
    prev.style.display = "block";
    $("#tech-sig-img").src = state.draft.technicien_signature_url;
  });
}

function wireStep(step) {
  if (step === 1) wireClientStep();
  if (step === 2) wireInterventionStep();
  if (step === 3) wireEquipStep();
  if (step === 4) wirePiecesStep();
  if (step === 5) wireSignStep();
}

function cleanText(v) {
  return v
    .split("\n")
    .map(l => l.trimEnd())
    .filter((l, i, a) => !(l === "" && a[i - 1] === ""))
    .join("\n")
    .trim();
}

function readStepIntoDraft(step) {
  const d = state.draft;
  if (step === 1) {
    d.client = {
      ...d.client,
      id: d.client_id || d.client.id,
      nom: $("#f-nom").value.trim(),
      adresse: $("#f-adresse").value.trim(),
      code_postal: $("#f-cp").value.trim(),
      ville: $("#f-ville").value.trim(),
      tel: $("#f-tel").value.trim(),
      mail: $("#f-mail").value.trim(),
      type_batiment: $("#f-type-bat").value,
    };
    if (!d.client.nom) { toast("Merci d'indiquer le nom du client", true); return false; }
  }
  if (step === 2) {
    d.type_intervention = $("#f-type-itv").value;
    d.date = $("#f-date").value || todayISO();
    d.heure_arrivee = $("#f-h-arr").value;
    d.heure_depart = $("#f-h-dep").value;
    d.forfait_deplacement = $("#f-forfait").value;
    d.statut = $("#f-statut .active")?.dataset.v || "terminee";
  }
  if (step === 3) {
    d.descriptif_demande = cleanText($("#f-descriptif").value);
  }
  if (step === 4) {
    d.action_realisee = cleanText($("#f-action").value);
  }
  if (step === 5) {
    d.devis_souhaite = $("#f-devis").classList.contains("on");
    d.devis_commentaire = cleanText($("#f-devis-com").value);
    d.technicien_nom = $("#f-tech").value.trim();
    d.client_present = $("#f-present").classList.contains("on");
    d.client_signature_nom = $("#f-client-sig").value.trim();
    if (d.technicien_nom) localStorage.setItem("ce_technicien_nom", d.technicien_nom);
  }
  return true;
}

async function finishWizard() {
  if (!readStepIntoDraft(5)) return;
  const d = state.draft;
  const isEdit = !!d.id;

  // Upload des signatures tactiles vers Supabase Storage (si configuré).
  if (Supabase.configured() && state.auth && navigator.onLine) {
    try {
      if (d.client_present && d._client_sig_blob) {
        d.client_signature_url = await Supabase.uploadSignature(`sig-client-${Date.now()}`, d._client_sig_blob);
      }
      if (d._technicien_sig_blob) {
        d.technicien_signature_url = await Supabase.uploadSignature(`sig-tech-${Date.now()}`, d._technicien_sig_blob);
      }
    } catch (e) {
      console.warn("Upload signature échoué (sera synchronisé plus tard)", e);
    }
  }

  // Sauvegarde / mise à jour du client
  const savedClient = await DB.saveClient({ ...d.client });
  d.client_id = savedClient.id;
  d.client = savedClient;

  // Sauvegarde de l'intervention
  const itv = { ...d };
  delete itv.client; // on ne garde que client_id comme référence normalisée
  itv.client = { nom: savedClient.nom, ville: savedClient.ville }; // dénormalisation légère pour affichage rapide liste

  // Historisation des équipements par client (V2) : on ajoute les équipements
  // qui n'ont pas encore d'historique chez ce client.
  if (savedClient.id && d.equipements?.length) {
    const existing = await DB.listEquipementsForClient(savedClient.id);
    for (const eq of d.equipements) {
      const hasSerie = eq.numero_serie && eq.numero_serie.trim();
      const already = existing.some((e) => hasSerie && e.numero_serie === eq.numero_serie);
      if (!already && hasSerie) {
        await DB.saveClientEquipment(savedClient.id, eq);
      }
    }
  }

  const saved = await DB.saveIntervention(itv);
  toast(isEdit ? "Fiche mise à jour" : "Fiche enregistrée");
  state.draft = null;
  go(`#/detail/${saved.id}`);
}

// ---------------------------------------------------------
// DÉTAIL
// ---------------------------------------------------------
async function renderDetail(id) {
  const itv = await DB.getIntervention(id);
  if (!itv) { go("#/"); return; }
  const client = itv.client_id ? await DB.getClient(itv.client_id) : itv.client;
  const done = itv.statut === "terminee";

  setApp(`
    <div class="topbar">
      <div class="topbar-row">
        <button class="back-btn" data-nav="back">${ICONS.back}</button>
        <div><h1>Détail intervention</h1></div>
        <div class="topbar-actions">
          <button class="icon-btn" data-nav="edit" data-id="${itv.id}" title="Modifier">${ICONS.pencil}</button>
          <button class="icon-btn" data-nav="delete" data-id="${itv.id}" title="Supprimer">${ICONS.trash}</button>
        </div>
      </div>
    </div>
    <main>
      <div class="detail-header">
        <h2>${esc(client?.nom || "Client")}</h2>
        <div class="meta">${fmtDateShortLong(itv.date)} · ${esc(itv.type_intervention || "")}</div>
        <div class="ii-tags" style="margin-top:10px;">
          <span class="tag ${done ? "done" : "pending"}">${done ? "Terminée avec succès" : "Nouvelle intervention à prévoir"}</span>
          ${itv.devis_souhaite ? `<span class="tag">Devis souhaité</span>` : ""}
        </div>
      </div>

      <div class="section-label">Client</div>
      <div class="card">
        <div class="kv"><div class="k">Adresse</div><div class="v">${esc([client?.adresse, client?.code_postal, client?.ville].filter(Boolean).join(" ") || "-")}</div></div>
        <div class="kv"><div class="k">Téléphone</div><div class="v">${esc(client?.tel || "-")}</div></div>
        <div class="kv"><div class="k">Mail</div><div class="v">${esc(client?.mail || "-")}</div></div>
        <div class="kv"><div class="k">Type de bâtiment</div><div class="v">${esc(client?.type_batiment || "-")}</div></div>
      </div>

      <div class="section-label">Intervention</div>
      <div class="card">
        <div class="kv"><div class="k">Horaires</div><div class="v">${esc(itv.heure_arrivee || "-")} → ${esc(itv.heure_depart || "-")}</div></div>
        <div class="kv"><div class="k">Forfait déplacement</div><div class="v">${esc(itv.forfait_deplacement || "-")}</div></div>
      </div>

      ${itv.equipements?.length ? `
      <div class="section-label">Équipement</div>
      <div class="card">
        ${itv.equipements.map((eq) => `<div class="kv"><div class="k">${esc(eq.intitule || "Équipement")}</div><div class="v">${esc([eq.marque, eq.modele].filter(Boolean).join(" "))}${eq.numero_serie ? ` · N° ${esc(eq.numero_serie)}` : ""}</div></div>`).join("")}
      </div>` : ""}

      <div class="section-label">Descriptif de la demande</div>
      <div class="card"><div class="block-text">${esc(itv.descriptif_demande || "-")}</div></div>

      <div class="section-label">Action réalisée</div>
      <div class="card"><div class="block-text">${esc(itv.action_realisee || "-")}</div></div>

      ${itv.pieces?.length ? `
      <div class="section-label">Pièces utilisées</div>
      <div class="card">
        ${itv.pieces.map((p) => `<div class="kv"><div class="k">${esc(p.designation || "-")}</div><div class="v">${esc(p.reference || "-")} · Qté ${esc(p.quantite ?? "-")}</div></div>`).join("")}
      </div>` : ""}

      <div class="section-label">Signatures</div>
      <div class="card">
        <div class="kv"><div class="k">Technicien</div><div class="v">${esc(itv.technicien_nom || "-")}</div></div>
        ${itv.technicien_signature_url ? `<div class="sig-preview" style="border:none;"><img src="${esc(itv.technicien_signature_url)}" alt="Signature technicien" /></div>` : ""}
        <div class="kv"><div class="k">Client</div><div class="v">${itv.client_present ? esc(itv.client_signature_nom || "-") : "Absent"}</div></div>
        ${itv.client_signature_url ? `<div class="sig-preview" style="border:none;"><img src="${esc(itv.client_signature_url)}" alt="Signature client" /></div>` : ""}
      </div>

      <div style="margin-top:22px;">
        <button class="btn btn-accent" id="btn-pdf">${ICONS.share} Générer et partager le PDF</button>
      </div>
    </main>
    <div class="toast" id="toast"></div>
  `);

  $("#btn-pdf").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.innerHTML = `${ICONS.file} Génération du PDF…`;
    try {
      await downloadInterventionPDF(itv, client);
      toast("PDF prêt");
    } catch (err) {
      console.error(err);
      toast("Erreur lors de la génération du PDF", true);
    } finally {
      btn.disabled = false;
      btn.innerHTML = `${ICONS.share} Générer et partager le PDF`;
    }
  });
}

// ---------------------------------------------------------
// Navigation events (délégation globale)
// ---------------------------------------------------------
document.addEventListener("click", (e) => {
  const list = $("#combo-list");
  if (list && !e.target.closest(".combo")) list.style.display = "none";
});

document.addEventListener("click", async (e) => {
  const nav = e.target.closest("[data-nav]");
  if (!nav) return;
  const action = nav.dataset.nav;

  if (action === "new") { state.draft = emptyDraft(); go("#/new/1"); }
  else if (action === "detail") go(`#/detail/${nav.dataset.id}`);
  else if (action === "edit") {
    if (state.draft && state.draft.id !== nav.dataset.id) state.draft = null;
    go(`#/edit/${nav.dataset.id}`);
  }
  else if (action === "back") { if (window.history.length > 1) window.history.back(); else go("#/"); }
  else if (action === "cancel") { state.draft = null; go("#/"); }
  else if (action === "prev") { if (state.step > 1) { readStepIntoDraft(state.step); go(`#/new/${state.step - 1}`); } }
  else if (action === "next") { if (readStepIntoDraft(state.step)) go(`#/new/${state.step + 1}`); }
  else if (action === "finish") finishWizard();
  else if (action === "export") exportData();
  else if (action === "account") go("#/account");
  else if (action === "login") go("#/login");
  else if (action === "logout") signOutUser();
  else if (action === "sync-now") { runSyncNow(); }
  else if (action === "delete") {
    if (confirm("Supprimer définitivement cette fiche d'intervention ?")) {
      await DB.deleteIntervention(nav.dataset.id);
      go("#/");
    }
  }
});

async function exportData() {
  const data = await DB.exportAll();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `climat-elec-sauvegarde-${todayISO()}.json`;
  a.click();
  toast("Sauvegarde exportée");
}

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
    try {
      await Supabase.signInWithMagicLink(email);
      toast("Lien envoyé — ouvrez le lien sur ce téléphone");
    } catch (err) {
      console.error(err);
      toast("Erreur : " + (err.message || "envoi impossible"), true);
    } finally { btn.disabled = false; }
  });

  $("#btn-password").addEventListener("click", async () => {
    const email = $("#auth-email").value.trim();
    const password = $("#auth-pass").value;
    if (!email || !password) { toast("Renseignez e-mail et mot de passe", true); return; }
    localStorage.setItem("ce_auth_email", email);
    const btn = $("#btn-password"); btn.disabled = true;
    try {
      await Supabase.signInWithPassword(email, password);
      toast("Connecté");
      go("#/");
    } catch (err) {
      console.error(err);
      toast("Identifiants invalides", true);
    } finally { btn.disabled = false; }
  });
}

async function signOutUser() {
  if (!confirm("Se déconnecter ? Vos données déjà enregistrées restent sur cet appareil.")) return;
  try { if (Supabase.configured()) await Supabase.signOut(); } catch (e) { console.warn(e); }
  state.auth = null;
  go("#/login");
}

// ---------------------------------------------------------
// COMPTE & SYNCHRONISATION (V2)
// ---------------------------------------------------------
async function renderAccount() {
  const supConfigured = Supabase.configured();
  const user = state.auth?.user;
  const profile = state.auth?.profile;
  const pending = state.sync.pending || 0;

  setApp(`
    ${topbar({ title: "Compte & synchro", back: true })}
    <main>
      ${user ? `
      <div class="section-label">Mon compte</div>
      <div class="card">
        <div class="kv"><div class="k">Nom</div><div class="v">${esc(profile?.full_name || "-")}</div></div>
        <div class="kv"><div class="k">E-mail</div><div class="v">${esc(user.email || "-")}</div></div>
      </div>
      <div class="field" style="margin-top:14px;">
        <label>Nom affiché</label>
        <input id="acct-name" type="text" value="${esc(profile?.full_name || "")}" placeholder="Votre nom de technicien" />
        <button class="btn btn-primary" id="btn-save-name" style="margin-top:10px;">Enregistrer le nom</button>
      </div>` : `
      <div class="section-label">Compte</div>
      <div class="card"><div class="block-text">Non connecté. Connectez-vous pour synchroniser vos fiches entre appareils.</div></div>
      <button class="btn btn-accent" data-nav="login" style="margin-top:12px;">${ICONS.user} Se connecter</button>`}

      <div class="section-label">Synchronisation</div>
      <div class="card" style="padding:14px;">
        ${supConfigured && state.auth
          ? `<div class="sync-status ${navigator.onLine ? "ok" : "warn"}"><span class="dot"></span>${navigator.onLine ? "En ligne — synchronisation automatique active" : "Hors ligne — les changements seront synchronisés dès le retour du réseau"}</div>
             <div class="sync-status ${pending === 0 ? "ok" : "warn"}"><span class="dot"></span>${pending === 0 ? "Aucun changement en attente" : `${pending} changement(s) en attente d'envoi`}</div>
             <button class="btn btn-primary" data-nav="sync-now" style="margin-top:12px;">${ICONS.sync} Synchroniser maintenant</button>`
          : `<div class="sync-status warn"><span class="dot"></span>${supConfigured ? "Connectez-vous pour activer la synchronisation." : "Supabase non configuré (voir config.js)."}</div>`}
      </div>

      <div class="section-label">Données locales</div>
      <div class="card"><div class="block-text">Sauvegardez manuellement l'intégralité de vos données (clients, interventions, équipements, pièces) au format JSON.</div></div>
      <button class="btn btn-ghost" data-nav="export" style="margin-top:12px;">${ICONS.down} Exporter toutes les données</button>

      ${state.auth ? `<button class="btn btn-ghost" data-nav="logout" style="margin-top:12px;color:var(--ce-danger);">Se déconnecter</button>` : ""}
    </main>
    <div class="toast" id="toast"></div>
  `);

  $("#btn-save-name")?.addEventListener("click", async () => {
    const name = $("#acct-name").value.trim();
    try {
      await Supabase.updateProfile(name);
      if (state.auth?.profile) state.auth.profile.full_name = name;
      toast("Nom enregistré");
    } catch (err) {
      console.error(err);
      toast("Erreur d'enregistrement", true);
    }
  });
}

async function runSyncNow() {
  if (!navigator.onLine) { toast("Hors ligne — synchronisation impossible", true); return; }
  toast("Synchronisation…");
  try {
    await Sync.pushAllLocal();
    await Sync.runSync();
    toast("Synchronisation terminée");
    if (window.location.hash === "#/account") await renderAccount();
    else await renderHome();
  } catch (err) {
    console.error(err);
    toast("Erreur de synchronisation", true);
  }
}

// ---------------------------------------------------------
// Init
// ---------------------------------------------------------
window.addEventListener("online", updateOfflinePill);
window.addEventListener("offline", updateOfflinePill);

async function init() {
  await DB.init();

  // Supabase : restore session + écoute des changements d'auth.
  initSupabase();
  if (Supabase.configured()) {
    Supabase.onAuthChange(async (event, session) => {
      if (session?.user) {
        const pro = await Supabase.getProfile(session.user.id).catch(() => null);
        state.auth = { user: session.user, profile: pro };
        Sync.initRealtime();
        if (event === "SIGNED_IN") {
          await Sync.pushAllLocal();
        }
        Sync.runSync().catch((e) => console.warn("Sync échec", e));
      } else {
        state.auth = null;
      }
      if (window.location.hash === "#/login") await renderHome();
      else route();
    });

    // Restaure une session existante au chargement.
    try {
      const { data } = await Supabase.getSession();
      if (data?.session?.user) {
        const pro = await Supabase.getProfile(data.session.user.id).catch(() => null);
        state.auth = { user: data.session.user, profile: pro };
        Sync.initRealtime();
        Sync.runSync().catch((e) => console.warn("Sync échec", e));
      }
    } catch (e) { console.warn("Session restore failed", e); }
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").then((reg) => {
      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            window.location.reload();
          }
        });
      });
    }).catch((err) => console.warn("SW registration failed", err));
  }
  await route();
}
init();
