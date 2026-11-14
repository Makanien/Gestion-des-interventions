/* js/views-wizard.js — assistant de saisie (fiches d'intervention et d'entretien). Extrait d'app.js (BP-03) : script classique, portée globale partagée ;
   chargé avant app.js dans l'ordre de index.html. */
// ---------------------------------------------------------
// WIZARD
// ---------------------------------------------------------
function wizardSteps() {
  if (state.draftType === "intervention") {
    return [
      { id: "client", title: "Client", render: stepClientHTML, wire: wireClientStep, read: readClientStep },
      { id: "intervention", title: "Intervention", render: stepInterventionHTML, wire: wireInterventionStep, read: readInterventionStep },
      { id: "equipement", title: "Équipement & demande", render: stepEquipHTML, wire: wireEquipStep, read: readEquipStep },
      { id: "action", title: "Action & pièces", render: stepActionHTML, wire: wirePiecesStep, read: readActionStep },
      { id: "photos", title: "Photos", render: stepPhotosHTML, wire: wirePhotosStep, read: () => true },
      { id: "signature", title: "Devis & signature", render: stepSignHTML, wire: wireSignStep, read: readSignStep },
    ];
  }
  // Structure feuille 18/09 : 7 pages + fin d'intervention (§3.2.11 / §3.2.12) —
  // 1 Client · 2 Entretien · 3 Équipement · 4-5 Mesures (une page par section,
  // la page 5 — dernière — portant le CERFA le cas échéant) · 6 Observation & photos ·
  // 7 Pièces utilisées · fin Devis & signature.
  const meta = ENTRETIEN_META[state.draftType];
  const mesuresSteps = meta.mesures.map((s, i) => ({
    id: `mesures_${i + 1}`,
    title: s.section,
    render: () => stepMesuresHTML(i),
    wire: wireMesuresStep,
    read: () => readMesuresSectionStep(i),
  }));
  return [
    { id: "client", title: "Client", render: stepClientHTML, wire: wireClientStep, read: readClientStep },
    { id: "entretien", title: "Entretien", render: stepEntretienHTML, wire: wireEntretienStep, read: readEntretienStep },
    { id: "equipement", title: "Équipement & demande", render: stepEquipHTML, wire: wireEquipStep, read: readEquipStep },
    ...mesuresSteps,
    { id: "observation_photos", title: "Observation & photos", render: stepObservationPhotosHTML, wire: wireObservationPhotosStep, read: readObservationStep },
    { id: "pieces", title: "Pièces utilisées", render: stepPiecesHTML, wire: wirePiecesStep, read: readPiecesStep },
    { id: "signature", title: "Devis & signature", render: stepSignHTML, wire: wireSignStep, read: readSignStep },
  ];
}

function stepsBarHTML(step, total) {
  return `<div class="steps-bar">${Array.from({ length: total }, (_, i) => `<span class="${i < step - 1 ? "filled" : i === step - 1 ? "active" : ""}"></span>`).join("")}</div>`;
}

async function renderWizard() {
  const steps = wizardSteps();
  if (state.step < 1) state.step = 1;
  if (state.step > steps.length) state.step = steps.length;
  if (state.step === 1) await ensureClientsCache();
  const step = steps[state.step - 1];
  const title = state.draft?.id ? (state.draftType === "intervention" ? "Modifier l'intervention" : "Modifier l'entretien") : (state.draftType === "intervention" ? "Nouvelle intervention" : (ENTRETIEN_META[state.draftType]?.label || "Nouvel entretien"));

  setApp(`
    <div class="topbar">
      <div class="topbar-row">
        <button class="back-btn" data-nav="cancel" aria-label="Annuler et fermer">${ICONS.close}</button>
        <div><h1>${esc(title)}</h1><div class="subtitle">${state.draft?.numero ? esc(state.draft.numero) : (Supabase.configured() ? "n° attribué à la synchronisation" : "")}</div></div>
      </div>
      ${stepsBarHTML(state.step, steps.length)}
    </div>
    <div class="step-title">
      <div id="presence-banner"></div>
      ${state.draft?.motif_retour && (!state.draft.statut_dossier || state.draft.statut_dossier === "brouillon") ? `<div class="banner-motif" style="background:var(--ce-pending-bg);color:var(--ce-pending);border-radius:var(--ce-radius-sm);padding:10px 12px;font-size:13px;margin-top:8px;">Renvoyé : ${esc(state.draft.motif_retour)}</div>` : ""}
      <div class="step-eyebrow">Étape ${state.step} / ${steps.length}</div>
      <h2>${step.title}</h2>
    </div>
    <main style="padding-top:14px;">${step.render()}</main>
    <div class="wizard-footer">
      ${state.step > 1 ? `<button class="btn btn-ghost" data-nav="prev">${ICONS.back} Retour</button>` : ""}
      <button class="btn btn-ghost" data-nav="brouillon">${ICONS.file} Enregistrer le brouillon</button>
      <button class="btn ${state.step === steps.length ? "btn-accent" : "btn-primary"}" data-nav="${state.step === steps.length ? "finish" : "next"}">
        ${state.step === steps.length ? `${ICONS.check} Soumettre pour validation` : "Continuer"}
      </button>
    </div>
    <div class="toast" id="toast"></div>
  `);
  // PRES-01 : avertissement non bloquant si quelqu'un d'autre modifie la même fiche.
  if (state.draft?.id) startPresence(state.draft.id); else stopPresence();
  renderPresenceBanner();
  step.wire();
}

async function ensureClientsCache() {
  state.clientsCache = await DB.listClients();
}

// ---- Étape Client ----
function clientFieldsHTML(c) {
  return `
    <div class="field combo">
      <label>Nom du client *</label>
      <input id="f-nom" type="text" autocomplete="off" placeholder="Rechercher ou saisir un nouveau nom" value="${esc(c.nom)}" />
      <div class="combo-list" id="combo-list" style="display:none;"></div>
    </div>
    <div class="field"><label>Adresse *</label><input id="f-adresse" type="text" value="${esc(c.adresse)}" /></div>
    <div class="row2">
      <div class="field"><label>Code postal *</label><input id="f-cp" type="text" inputmode="numeric" value="${esc(c.code_postal)}" /></div>
      <div class="field"><label>Ville *</label><input id="f-ville" type="text" value="${esc(c.ville)}" /></div>
    </div>
    <div class="row2">
      <div class="field"><label>Téléphone</label><input id="f-tel" type="tel" value="${esc(c.tel)}" /></div>
      <div class="field"><label>Mail</label><input id="f-mail" type="email" value="${esc(c.mail)}" /></div>
    </div>
    <div class="field">
      <label>Type de bâtiment *</label>
      <select id="f-type-bat">
        ${["", "Professionnel", "- de 2 ans", "+ de 2 ans", "+ de 15 ans"].map((t) => `<option value="${esc(t)}" ${c.type_batiment === t ? "selected" : ""}>${t || "Non précisé"}</option>`).join("")}
      </select>
    </div>`;
}

function stepClientHTML() {
  return `<div class="card" style="padding:14px;">${clientFieldsHTML(state.draft.client)}</div>`;
}

// ---- Étape Entretien (page 2 feuille 18/09 : type, date, heures, forfait) ----
const ZONES_FORFAIT = ["", "Z0 (Chazé-sur-Argos)", "Z1 (5 à 10 kms)", "Z2 (11 à 30 kms)", "Z3 (31 à 50 kms)", "Forfait"];
function stepEntretienHTML() {
  const meta = draftMeta();
  const d = state.draft;
  // Fiches existantes : un sous-type enregistré hors liste (ex. « Air/Air »
  // avant la refonte 09/10) reste proposé au sélecteur pour requalification
  // manuelle — même tolérance que pour les mesures hors liste.
  const legacyType = d.type_entretien_detail && !meta.types.includes(d.type_entretien_detail)
    ? `<option selected>${esc(d.type_entretien_detail)}</option>`
    : "";
  // Fiche solaire (arb. 6.10, en préparation) : la liste des types
  // d'installation est attendue du client (§11 du PRD) — saisie libre en
  // attendant, pour ne pas bloquer la complétude « Page ok ».
  const typeControl = meta.types.length
    ? `<select id="f-type-entretien">
        ${legacyType}
        ${meta.types.map((t) => `<option ${state.draft.type_entretien_detail === t ? "selected" : ""}>${t}</option>`).join("")}
      </select>`
    : `<input id="f-type-entretien" type="text" value="${esc(d.type_entretien_detail)}" placeholder="À préciser (liste à venir du client)" />`;
  return `
  <div class="card" style="padding:14px;">
    <div class="field">
      <label>Type d'entretien *</label>
      ${typeControl}
    </div>
    <div class="field"><label>Date</label><input id="f-date" type="date" value="${esc(d.date)}" /></div>
    <div class="row2">
      <div class="field"><label>Heure d'arrivée</label><input id="f-h-arr" type="time" value="${esc(d.heure_arrivee)}" /></div>
      <div class="field"><label>Heure de départ</label><input id="f-h-dep" type="time" value="${esc(d.heure_depart)}" /></div>
    </div>
    <div class="field" style="margin-bottom:0;">
      <label>Forfait déplacement</label>
      <select id="f-forfait">
        ${ZONES_FORFAIT.map((z) => `<option value="${esc(z)}" ${d.forfait_deplacement === z ? "selected" : ""}>${z || "Non précisé"}</option>`).join("")}
      </select>
    </div>
  </div>`;
}
function wireEntretienStep() {}
function readEntretienStep() {
  const d = state.draft;
  const sel = $("#f-type-entretien");
  if (sel) d.type_entretien_detail = sel.value;
  d.date = $("#f-date").value || todayISO();
  d.heure_arrivee = $("#f-h-arr").value;
  d.heure_depart = $("#f-h-dep").value;
  // D4 : renseigne `temps_intervention` (calculé à partir des heures saisies)
  // au lieu de laisser la colonne vide — le même calcul alimente le PDF.
  const dur = computeDuration(d.heure_arrivee, d.heure_depart);
  d.temps_intervention = dur === "-" ? "" : dur;
  d.forfait_deplacement = $("#f-forfait").value;
  return true;
}

function wireClientStep() { wireClientCombo(); }

function wireClientCombo() {
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
    if (!exact) html += `<div class="combo-item new" data-client="__new__"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg><span>Créer « ${esc(input.value.trim())} »</span></div>`;
    list.innerHTML = html || `<div class="combo-item">Aucun résultat</div>`;
    list.style.display = "block";
  }
  input.addEventListener("input", renderCombo);
  input.addEventListener("focus", renderCombo);
  list.addEventListener("click", (e) => {
    const item = e.target.closest("[data-client]");
    if (!item) return;
    const id = item.dataset.client;
    if (id === "__new__") { list.style.display = "none"; $("#f-adresse").focus(); return; }
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
  input.addEventListener("input", () => {
    if (state.draft.client_id) {
      const cl = state.clientsCache.find((x) => x.id === state.draft.client_id);
      if (cl && cl.nom !== input.value) state.draft.client_id = null;
    }
  });
}

function captureClientFields() {
  const d = state.draft;
  const prevNom = d.client.nom;
  d.client = { ...d.client, id: d.client_id || d.client.id, nom: $("#f-nom").value.trim(), adresse: $("#f-adresse").value.trim(), code_postal: $("#f-cp").value.trim(), ville: $("#f-ville").value.trim(), tel: $("#f-tel").value.trim(), mail: $("#f-mail").value.trim(), type_batiment: $("#f-type-bat").value };
  // La signature client suit le nom du client tant qu'elle n'a pas été
  // personnalisée manuellement (pré-remplissage automatique).
  if (!d.client_signature_nom || d.client_signature_nom === prevNom) d.client_signature_nom = d.client.nom;
  if (state.draftType !== "intervention") {
    d.type_entretien = state.draftType;                          // clé machine (air_eau / air_air / chaudiere / solaire)
    const sel = $("#f-type-entretien");                          // présent seulement à l'étape Entretien
    if (sel) d.type_entretien_detail = sel.value;
  }
}
// Arbitrage 6.9 (§3.2.14) : les champs obligatoires (astérisque) ne bloquent
// pas le passage à la page suivante — le contrôle de complétude est appliqué
// à la validation finale (finishWizard, « Page ok »).
function readClientStep() {
  captureClientFields();
  return true;
}

// ---- Étape Intervention ----
function interventionStatutLabel(s) {
  if (s === "terminee") return "Effectuée";
  if (s === "terminee_suite") return "Effectuée, suite à prévoir";
  return "À effectuer";
}
function interventionStatutCls(s) {
  return s === "terminee" ? "done" : "pending";
}
function stepInterventionHTML() {
  const d = state.draft;
  // Arb. 6.1 (09/10, §3.2.6) : liste à 5 valeurs — orthographe « Diagnostic ».
  const types = ["Sav", "Garantie", "Dépannage", "Diagnostic", "Sur devis"];
  return `
  <div class="card" style="padding:14px;">
    <div class="field">
      <label>Type d'intervention</label>
      <select id="f-type-itv">${types.map((t) => `<option ${d.type_intervention === t ? "selected" : ""}>${t}</option>`).join("")}</select>
    </div>
    <div class="field"><label>Date</label><input id="f-date" type="date" value="${esc(d.date)}" /></div>
    <div class="row2">
      <div class="field"><label>Heure d'arrivée</label><input id="f-h-arr" type="time" value="${esc(d.heure_arrivee)}" /></div>
      <div class="field"><label>Heure de départ</label><input id="f-h-dep" type="time" value="${esc(d.heure_depart)}" /></div>
    </div>
    <div class="field" style="margin-bottom:0;">
      <label>Forfait déplacement</label>
      <select id="f-forfait">
        ${ZONES_FORFAIT.map((z) => `<option value="${esc(z)}" ${d.forfait_deplacement === z ? "selected" : ""}>${z || "Non précisé"}</option>`).join("")}
      </select>
    </div>
  </div>`;
}
function wireInterventionStep() {}
function readInterventionStep() {
  const d = state.draft;
  d.type_intervention = $("#f-type-itv").value;
  d.date = $("#f-date").value || todayISO();
  d.heure_arrivee = $("#f-h-arr").value;
  d.heure_depart = $("#f-h-dep").value;
  // D4 : renseigne `temps_intervention` (calculé à partir des heures saisies)
  // au lieu de laisser la colonne vide — le même calcul alimente le PDF.
  const dur = computeDuration(d.heure_arrivee, d.heure_depart);
  d.temps_intervention = dur === "-" ? "" : dur;
  d.forfait_deplacement = $("#f-forfait").value;
  // Le statut est désormais saisi en tête de la page finale (§3.2.14, point 12).
  return true;
}

// ---- Étape Équipement + descriptif ----
// Page 3/6 (arb. 2.2/6.5/6.7 du 09/10, §3.2.6) : Équipement + Descriptif sur
// la même page, descriptif obligatoire, champs Intitulé / Marque / Modèle /
// N° de série obligatoires — page de référence partagée par les fiches
// d'entretien (« comme page 3/6 de Nouvelle intervention »).
function equipLineHTML(eq, idx) {
  return `
  <div class="line-group" data-eq="${idx}">
    <div class="line-group-head"><span>Équipement ${idx + 1}</span><button type="button" class="remove-line" data-remove-eq="${idx}">${ICONS.trash.replace('width="24" height="24"', 'width="13" height="13"')} Supprimer</button></div>
    <div class="field" style="margin-bottom:10px;"><label>Intitulé *</label><input type="text" data-eq-f="intitule" data-eq-i="${idx}" value="${esc(eq.intitule)}" placeholder="Ex : Pompe à chaleur air/eau" /></div>
    <div class="row2">
      <div class="field" style="margin-bottom:0;"><label>Marque *</label><input type="text" data-eq-f="marque" data-eq-i="${idx}" value="${esc(eq.marque)}" /></div>
      <div class="field" style="margin-bottom:0;"><label>Modèle *</label><input type="text" data-eq-f="modele" data-eq-i="${idx}" value="${esc(eq.modele)}" /></div>
    </div>
    <div class="field" style="margin-top:10px;margin-bottom:0;"><label>N° de série *</label><input type="text" data-eq-f="numero_serie" data-eq-i="${idx}" value="${esc(eq.numero_serie)}" /></div>
  </div>`;
}

function stepEquipHTML() {
  const d = state.draft;
  const meta = draftMeta();
  return `
  ${meta ? `<div class="card" style="padding:14px;margin-bottom:12px;"><div class="field" style="margin-bottom:0;"><label>Année d'installation</label><input id="f-annee" type="text" inputmode="numeric" placeholder="Ex : 2021" value="${esc(d.annee_installation)}" /></div></div>` : ""}
  <div id="eq-reuse"></div>
  <div class="section-label">Équipement(s) concerné(s) *</div>
  <div id="eq-list">${d.equipements.map(equipLineHTML).join("")}</div>
  <button type="button" class="add-line-btn" id="add-eq">${ICONS.plus} Ajouter un équipement</button>
  <div class="section-label">Descriptif de la demande *</div><textarea id="f-descriptif" placeholder="Ce que signale ou demande le client…">${esc(d.descriptif_demande)}</textarea>`;
}
function wireEquipStep() {
  $("#add-eq").addEventListener("click", () => {
    const meta = draftMeta();
    if (state.draft.equipements.length >= (meta?.maxEq || 5)) { toast(`Maximum ${meta?.maxEq || 5} équipements`, true); return; }
    state.draft.equipements.push({ intitule: "", marque: "", modele: "", numero_serie: "" });
    $("#eq-list").innerHTML = state.draft.equipements.map(equipLineHTML).join("");
    wireEquipLines();
  });
  wireEquipLines();
  maybeShowEquipHistory();
  autoResize("f-descriptif");
}

// Réutilisation de l'historique équipements du client (V2, point 5)
async function maybeShowEquipHistory() {
  const el = $("#eq-reuse");
  const clientId = state.draft.client_id;
  if (!el || !clientId || state.draft.equipements.length) { if (el) el.innerHTML = ""; return; }
  const history = await DB.listEquipementsForClient(clientId);
  const usable = history.filter((e) => e.intitule && e.intitule.trim());
  if (!usable.length) { el.innerHTML = ""; return; }
  el.innerHTML = `
  <div class="reuse-block">
    <div class="reuse-info">${usable.length} équipement${usable.length > 1 ? "s" : ""} déjà enregistré${usable.length > 1 ? "s" : ""} pour ce client</div>
    <button type="button" class="btn btn-ghost" id="reuse-eq">${ICONS.sync} Reprendre l'équipement enregistré</button>
  </div>`;
  $("#reuse-eq").addEventListener("click", () => {
    state.draft.equipements = usable.map((e) => ({ intitule: e.intitule, marque: e.marque || "", modele: e.modele || "", numero_serie: e.numero_serie || "" }));
    el.innerHTML = "";
    $("#eq-list").innerHTML = state.draft.equipements.map(equipLineHTML).join("");
    wireEquipLines();
  });
}
function autoResize(id) {
  const ta = document.getElementById(id);
  if (!ta) return;
  ta.style.height = "auto";
  ta.style.height = ta.scrollHeight + "px";
  ta.addEventListener("input", () => { ta.style.height = "auto"; ta.style.height = ta.scrollHeight + "px"; });
}
function wireEquipLines() {
  $all("[data-eq-f]").forEach((inp) => inp.addEventListener("input", () => {
    const i = parseInt(inp.dataset.eqI, 10);
    state.draft.equipements[i][inp.dataset.eqF] = inp.value;
  }));
  $all("[data-remove-eq]").forEach((btn) => btn.addEventListener("click", () => {
    const i = parseInt(btn.dataset.removeEq, 10);
    state.draft.equipements.splice(i, 1);
    $("#eq-list").innerHTML = state.draft.equipements.map(equipLineHTML).join("");
    wireEquipLines();
  }));
}
function readEquipStep() {
  state.draft.descriptif_demande = cleanText($("#f-descriptif")?.value || "");
  if (draftMeta()) state.draft.annee_installation = $("#f-annee")?.value.trim() || "";
  return true;
}

// ---- Étape Action & pièces ----
function pieceLineHTML(p, idx) {
  return `
  <div class="line-group" data-piece="${idx}">
    <div class="line-group-head"><span>Pièce ${idx + 1}</span><button type="button" class="remove-line" data-remove-piece="${idx}">${ICONS.trash.replace('width="24" height="24"', 'width="13" height="13"')} Supprimer</button></div>
    <div class="field" style="margin-bottom:10px;position:relative;"><label>Désignation</label><input type="text" data-p-f="designation" data-p-i="${idx}" value="${esc(p.designation)}" placeholder="Rechercher une pièce…" /><div class="combo-list piece-combo" style="display:none;"></div></div>
    <div class="row2">
      <div class="field" style="margin-bottom:0;"><label>Référence</label><input type="text" data-p-f="reference" data-p-i="${idx}" value="${esc(p.reference)}" /></div>
      <div class="field" style="margin-bottom:0;"><label>Quantité</label><input type="number" min="0" step="1" data-p-f="quantite" data-p-i="${idx}" value="${esc(p.quantite)}" /></div>
    </div>
  </div>`;
}
function stepActionHTML() {
  const d = state.draft;
  return `
  <div class="section-label">Action réalisée</div><textarea id="f-action" placeholder="Détail de l'intervention effectuée…">${esc(d.action_realisee)}</textarea>
  <div class="section-label">Pièces utilisées</div>
  <div id="piece-list">${d.pieces.map(pieceLineHTML).join("")}</div>
  <button type="button" class="add-line-btn" id="add-piece">${ICONS.plus} Ajouter une pièce</button>`;
}
// Pages 6 (Observation & photos) et 7 (Pièces utilisées) des fiches d'entretien.
function stepObservationPhotosHTML() {
  const d = state.draft;
  return `
  <div class="section-label">Observation</div><textarea id="f-action" placeholder="Observations de l'entretien…">${esc(d.action_realisee)}</textarea>
  ${stepPhotosHTML()}`;
}
function stepPiecesHTML() {
  const d = state.draft;
  return `
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
  // autocomplétion désignation (base pièces, US-23)
  DB.listPiecesBase().then((base) => {
    $all("[data-p-f='designation']").forEach((inp) => {
      const idx = parseInt(inp.dataset.pI, 10);
      const list = inp.parentElement.querySelector(".piece-combo");
      inp.addEventListener("input", () => {
        const q = inp.value.trim().toLowerCase();
        if (!q) { list.style.display = "none"; return; }
        const matches = base.filter((p) => p.designation.toLowerCase().includes(q)).slice(0, 5);
        const exact = base.some((p) => p.designation.toLowerCase() === q);
        let html = matches.map((p) => `<div class="combo-item" data-d="${esc(p.designation)}"><div class="c-name">${esc(p.designation)}</div></div>`).join("");
        if (!exact) html += `<div class="combo-item new" data-d="__new__"><span>Créer « ${esc(inp.value.trim())} »</span></div>`;
        list.innerHTML = html || `<div class="combo-item">Aucun résultat</div>`;
        list.style.display = "block";
      });
      list.addEventListener("click", async (e) => {
        const item = e.target.closest("[data-d]");
        if (!item) return;
        const d = item.dataset.d;
        list.style.display = "none";
        if (d === "__new__") {
          state.draft.pieces[idx].designation = inp.value.trim();
          await DB.savePieceBase(inp.value.trim());
        } else {
          inp.value = d;
          state.draft.pieces[idx].designation = d;
        }
      });
    });
  });
  $all("[data-p-f]").forEach((inp) => inp.addEventListener("input", () => {
    const i = parseInt(inp.dataset.pI, 10);
    const f = inp.dataset.pF;
    state.draft.pieces[i][f] = f === "quantite" ? Number(inp.value || 0) : inp.value;
  }));
  $all("[data-remove-piece]").forEach((btn) => btn.addEventListener("click", () => {
    const i = parseInt(btn.dataset.removePiece, 10);
    state.draft.pieces.splice(i, 1);
    $("#piece-list").innerHTML = state.draft.pieces.map(pieceLineHTML).join("");
    wirePieceLines();
  }));
}
function readActionStep() {
  state.draft.action_realisee = cleanText($("#f-action").value);
  return true;
}
function readObservationStep() {
  state.draft.action_realisee = cleanText($("#f-action").value);
  return true;
}
function readPiecesStep() { return true; }
function wireObservationPhotosStep() {
  wirePhotosStep();
  autoResize("f-action");
}

// ---- Étapes Mesures (entretiens — une page par section, refonte 18/09) ----
// Un champ porte soit une liste fermée (`options`, valeurs de la feuille),
// soit une saisie libre avec unité (`unite` — affichée à côté du libellé,
// avant le champ, jamais en placeholder : convention 09/10, arb. 6.8).
// Une valeur déjà enregistrée hors liste (ancienne saisie libre) reste
// sélectionnable.
function mesureInputHTML(m, valeur) {
  const control = m.options?.length
    ? (() => {
        const listed = m.options.includes(valeur);
        const extra = valeur && !listed ? `<option selected>${esc(valeur)}</option>` : "";
        return `<select data-mesure-code="${m.code}" class="mesure-field">
          <option value="">—</option>
          ${m.options.map((o) => `<option ${valeur === o ? "selected" : ""}>${esc(o)}</option>`).join("")}
          ${extra}
        </select>`;
      })()
    // Convention 09/10 (arb. 6.8, §7 du PRD) : l'unité s'affiche AVANT le
    // champ (à côté du libellé), jamais dans le champ (pas de placeholder).
    : `<input type="text" inputmode="decimal" data-mesure-code="${m.code}" class="mesure-field" value="${esc(valeur)}" />`;
  return `
    <div class="kv" style="padding:8px 14px;">
      <div class="k" style="width:auto;flex:1;">${esc(m.libelle)}${m.options?.length ? "" : (m.unite ? ` <span class="unite">(${esc(m.unite)})</span>` : "")}</div>
      <div class="v" style="width:130px;flex:none;">${control}</div>
    </div>`;
}

function stepMesuresHTML(sectionIdx) {
  const meta = draftMeta();
  const d = state.draft;
  const val = (code) => (d.mesures.find((m) => m.code === code)?.valeur || "");
  const sec = meta.mesures[sectionIdx];
  const sectionHTML = `
    <div class="card">
      ${sec.items.map((m) => mesureInputHTML(m, val(m.code))).join("")}
    </div>`;
  const isLast = sectionIdx === meta.mesures.length - 1;
  const cerfa = meta.cerfa && isLast ? `
    <div class="section-label">CERFA n°15497 — fluides frigorigènes</div>
    <div class="card">
      ${CERFA_FIELDS.map((f) => `
        <div class="kv" style="padding:8px 14px;">
          <div class="k" style="width:auto;flex:1;">${esc(f.libelle)}${f.unite ? ` <span class="unite">(${esc(f.unite)})</span>` : ""}</div>
          <div class="v" style="width:130px;flex:none;"><input type="text" data-mesure-code="${f.code}" value="${esc(val(f.code))}" style="width:100%;padding:8px;border:1px solid var(--ce-border);border-radius:8px;" /></div>
        </div>`).join("")}
    </div>
    <div class="note blue" style="margin-top:10px;">Formulaire CERFA sur une seule page (document officiel) — unités affichées à côté du champ, saisie de la valeur seule.</div>` : "";
  // Fiche solaire (arb. 6.10) : une section en attente du contenu client
  // (§11 du PRD) s'affiche en note de préparation plutôt qu'une card vide.
  const attente = meta.trameAttente && !sec.items.length
    ? `<div class="note blue" style="margin-top:10px;">Bloc « ${esc(sec.section)} » en préparation : contenu attendu du client (§11 du PRD).</div>`
    : "";
  return `${sectionHTML}${attente}${cerfa}`;
}
function wireMesuresStep() {}
// Lecture limitée aux champs présents sur la page courante : les mesures des
// autres pages (et les anciens codes hors modèle) restent inchangées.
function readMesuresSectionStep(sectionIdx) {
  const meta = draftMeta();
  const sec = meta.mesures[sectionIdx];
  if (!sec) return true;
  const items = [...sec.items];
  if (meta.cerfa && sectionIdx === meta.mesures.length - 1) CERFA_FIELDS.forEach((f) => items.push(f));
  const map = new Map();
  state.draft.mesures.forEach((m) => map.set(m.code, m));
  for (const m of items) {
    const input = document.querySelector(`[data-mesure-code="${m.code}"]`);
    if (!input) continue;
    const valeur = input.value.trim();
    const libelle = m.libelle;
    if (map.has(m.code)) map.get(m.code).valeur = valeur;
    else map.set(m.code, { code: m.code, libelle, valeur, unite: m.unite || "", type_entretien: state.draftType });
  }
  // on conserve toutes les mesures (même vides) pour la ré-édition
  state.draft.mesures = [...map.values()];
  return true;
}

// ---- Étape Photos (US-21) ----
function stepPhotosHTML() {
  const d = state.draft;
  return `
  <div class="photo-grid" id="photo-grid">
    ${d.photos.map((p, i) => `
      <div class="photo-card">
        <img src="${esc(p.data_url)}" alt="Photo" />
        <input type="text" data-photo-legende="${i}" placeholder="Légende" value="${esc(p.legende)}" />
        <button type="button" class="remove-line" data-remove-photo="${i}">${ICONS.trash.replace('width="24" height="24"', 'width="13" height="13"')} Supprimer</button>
      </div>`).join("")}
    <button type="button" class="photo-add" id="add-photo">${ICONS.camera} Ajouter une photo</button>
    <input type="file" id="photo-input" accept="image/*" capture="environment" style="display:none;" />
  </div>`;
}
// Redimensionne une photo vers un dataURL JPEG raisonnable (limite le poids en base).
function resizeImageToDataURL(file, maxDim = 1200, quality = 0.8) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const scale = maxDim / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}
function wirePhotosStep() {
  const input = $("#photo-input");
  $("#add-photo").addEventListener("click", () => input.click());
  input.addEventListener("change", async () => {
    const file = input.files[0];
    if (!file) return;
    const dataUrl = await resizeImageToDataURL(file);
    if (!dataUrl) { toast("Impossible de lire la photo", true); return; }
    state.draft.photos.push({ data_url: dataUrl, legende: "" });
    input.value = "";
    rerenderPhotos();
  });
  wirePhotoLines();
}
function rerenderPhotos() {
  const old = $("#photo-grid");
  const wrap = document.createElement("div");
  wrap.innerHTML = stepPhotosHTML();
  old.replaceWith(wrap.firstElementChild);
  wirePhotosStep();
}
function wirePhotoLines() {
  $all("[data-photo-legende]").forEach((inp) => inp.addEventListener("input", () => {
    state.draft.photos[parseInt(inp.dataset.photoLegende, 10)].legende = inp.value;
  }));
  $all("[data-remove-photo]").forEach((btn) => btn.addEventListener("click", () => {
    state.draft.photos.splice(parseInt(btn.dataset.removePhoto, 10), 1);
    rerenderPhotos();
  }));
}

// ---- Étape Devis & signature ----
// Page finale commune à la fiche générique et aux 3 fiches d'entretien
// (§3.2.14 — feuille 18/09, précisions 09/10 arb. 6.9) : le statut est saisi
// en tête, avant les signatures ; les signatures ne sont possibles que si la
// fiche est terminée ; « Page ok » atteste la complétude des champs
// obligatoires (contrôle appliqué à la soumission, pas à la navigation).
function stepSignHTML() {
  const d = state.draft;
  const meta = draftMeta();
  const locked = d.statut === "a_prevoir";
  return `
  <div class="section-label">Statut de l'intervention</div>
  <div class="segmented" id="f-statut">
    <button type="button" data-v="a_prevoir" class="${locked ? "active" : ""}">À effectuer</button>
    <button type="button" data-v="terminee" class="${d.statut === "terminee" ? "active" : ""}">Effectuée</button>
    <button type="button" data-v="terminee_suite" class="${d.statut === "terminee_suite" ? "active" : ""}">Effectuée, suite à prévoir</button>
  </div>
  <div class="hint" id="sig-lock-note" style="display:${locked ? "block" : "none"};">Les signatures sont débloquées une fois la fiche marquée « Effectuée » ou « Effectuée, suite à prévoir ».</div>

  <div class="section-label">Signatures</div>
  <div class="card" style="padding:14px;">
    <div class="field"><label>Nom du technicien</label>
      <input id="f-tech" type="text" list="tech-list" value="${esc(d.technicien_nom)}" placeholder="Votre nom" />
      <datalist id="tech-list"><option value="GARDAIS Jérémy"></option><option value="CHANTEUX Régis"></option></datalist>
    </div>
    <div class="toggle-row" style="margin-top:2px;">
      <div><div class="t-label">Client présent</div></div>
      <button class="switch ${d.client_present ? "on" : ""}" id="f-present" type="button"></button>
    </div>
    <div class="field" style="margin-bottom:0;" id="wrap-client-sig">
      <label>Nom du client (signature)</label>
      <input id="f-client-sig" type="text" value="${esc(d.client_signature_nom || d.client.nom)}" placeholder="${d.client.nom ? esc(d.client.nom) : "Nom du client"}" />
      <div class="hint">Signature obligatoire si le client est présent — signature électronique tactile disponible.</div>
    </div>
    <button type="button" class="add-line-btn" id="btn-client-sign" style="margin-top:10px;"${locked ? " disabled" : ""}>${ICONS.pencil.replace('width="24" height="24"', 'width="15" height="15"')} Signer (client)</button>
    <div class="sig-preview" id="client-sig-preview" style="display:${d.client_signature_url ? "block" : "none"};margin-top:10px;"><img id="client-sig-img" src="${d.client_signature_url ? esc(d.client_signature_url) : ""}" alt="Signature client" /></div>
    <div class="field" style="margin-top:12px;">
      <label>Signature technicien (obligatoire)</label>
      <button type="button" class="add-line-btn" id="btn-tech-sign" style="margin-top:6px;"${locked ? " disabled" : ""}>${ICONS.pencil.replace('width="24" height="24"', 'width="15" height="15"')} Signer (technicien)</button>
      <div class="sig-preview" id="tech-sig-preview" style="display:${d.technicien_signature_url ? "block" : "none"};margin-top:10px;"><img id="tech-sig-img" src="${d.technicien_signature_url ? esc(d.technicien_signature_url) : ""}" alt="Signature technicien" /></div>
    </div>
  </div>

  <div class="section-label">Devis & confirmation</div>
  <div class="toggle-row">
    <div><div class="t-label">Le client souhaite-t-il un devis</div><div class="t-hint">Une action de suivi sera à prévoir</div></div>
    <button class="switch ${d.devis_souhaite ? "on" : ""}" id="f-devis" type="button"></button>
  </div>
  <div class="card" style="padding:14px;margin-bottom:18px;">
    <div class="field" style="margin-bottom:0;"><label>Commentaire devis (optionnel)</label><textarea id="f-devis-com" placeholder="Précisions à conserver pour le devis…">${esc(d.devis_commentaire)}</textarea></div>
  </div>

  ${meta?.prochaine ? `
  <div class="toggle-row">
    <div><div class="t-label">Prochaine intervention prévue</div><div class="t-hint">En plus du statut d'intervention</div></div>
    <button class="switch ${d.prochaine_intervention_prevue ? "on" : ""}" id="f-prochaine" type="button"></button>
  </div>` : ""}

  ${pageOkStatusHTML()}

  <div class="section-label">Récapitulatif</div>
  <div class="card">
    <div class="kv"><div class="k">Client</div><div class="v">${esc(d.client.nom || "-")}</div></div>
    <div class="kv"><div class="k">Type</div><div class="v">${state.draftType === "intervention" ? esc(d.type_intervention) : (meta?.label || "Entretien")}</div></div>
    <div class="kv"><div class="k">Date</div><div class="v">${fmtDateShortLong(d.date)}</div></div>
    <div class="kv"><div class="k">Statut</div><div class="v">${interventionStatutLabel(d.statut)}</div></div>
    <div class="kv"><div class="k">Équipements</div><div class="v">${d.equipements.length || 0}</div></div>
    <div class="kv"><div class="k">Pièces</div><div class="v">${d.pieces.length || 0}</div></div>
    <div class="kv"><div class="k">Photos</div><div class="v">${d.photos.length || 0}</div></div>
  </div>`;
}
// Verrouillage dynamique de la page finale (§3.2.14) : signatures possibles
// seulement si le statut est « Effectuée » ou « Effectuée, suite à prévoir » ;
// « Soumettre pour validation » possible seulement si la fiche est signée
// (technicien + client si présent). Applique aussi l'état initial au rendu.
function wireSignStep() {
  $all("#f-statut button").forEach((b) => b.addEventListener("click", () => {
    $all("#f-statut button").forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
    state.draft.statut = b.dataset.v;
    applySignLockUI();
  }));
  $("#f-devis").addEventListener("click", (e) => e.currentTarget.classList.toggle("on"));
  $("#f-prochaine")?.addEventListener("click", (e) => e.currentTarget.classList.toggle("on"));
  // « Page ok » : indicateur de statut calculé (aucun câblage utilisateur).
  $("#f-present").addEventListener("click", (e) => {
    e.currentTarget.classList.toggle("on");
    $("#wrap-client-sig").style.display = e.currentTarget.classList.contains("on") ? "block" : "none";
    applySignLockUI();
  });
  if (!state.draft.client_present) $("#wrap-client-sig").style.display = "none";
  autoResize("f-devis-com");
  applySignLockUI();

  $("#btn-client-sign")?.addEventListener("click", async () => {
    const blob = await signatureModal({ title: "Signature du client" });
    if (!blob) return;
    // D2 : une re-signature rend l'ancien fichier Storage obsolète — on le supprime.
    const oldUrl = state.draft.client_signature_url;
    state.draft._client_sig_blob = blob;
    state.draft.client_signature_url = await blobToDataURL(blob);
    const prev = $("#client-sig-preview");
    prev.style.display = "block";
    $("#client-sig-img").src = state.draft.client_signature_url;
    applySignLockUI();
    if (Supabase.configured() && navigator.onLine && oldUrl && oldUrl.startsWith("http")) {
      try { await Supabase.removeSignature(oldUrl); } catch (e) { ErrorLog.warn("Suppression ancienne signature client échouée", e); }
    }
  });
  $("#btn-tech-sign")?.addEventListener("click", async () => {
    const blob = await signatureModal({ title: "Signature du technicien" });
    if (!blob) return;
    const oldUrl = state.draft.technicien_signature_url;
    state.draft._technicien_sig_blob = blob;
    state.draft.technicien_signature_url = await blobToDataURL(blob);
    const prev = $("#tech-sig-preview");
    prev.style.display = "block";
    $("#tech-sig-img").src = state.draft.technicien_signature_url;
    applySignLockUI();
    if (Supabase.configured() && navigator.onLine && oldUrl && oldUrl.startsWith("http")) {
      try { await Supabase.removeSignature(oldUrl); } catch (e) { ErrorLog.warn("Suppression ancienne signature technicien échouée", e); }
    }
  });
}
function applySignLockUI() {
  const d = state.draft;
  const locked = d.statut === "a_prevoir";
  const present = signClientPresent();
  $("#btn-client-sign")?.toggleAttribute("disabled", locked);
  $("#btn-tech-sign")?.toggleAttribute("disabled", locked);
  const note = $("#sig-lock-note");
  if (note) note.style.display = locked ? "block" : "none";
  // Indicateur de statut « Page ok » : complétude des informations obligatoires
  const missing = pageOkMissingLabels();
  const pageOkState = $("#page-ok-state");
  const pageOkHint = $("#page-ok-hint");
  if (pageOkState) {
    pageOkState.className = `tag ${missing.length ? "muted" : "done"}`;
    pageOkState.textContent = pageOkStateText(missing);
  }
  if (pageOkHint) pageOkHint.textContent = pageOkHintText(missing);
  const signee = !!d.technicien_signature_url && (!present || !!d.client_signature_url);
  const finish = document.querySelector('.wizard-footer [data-nav="finish"]');
  if (finish) {
    finish.toggleAttribute("disabled", !signee);
    finish.title = signee ? "" : "Signature requise (technicien + client si présent) — la fiche doit être marquée « Effectuée » pour signer";
  }
}
// « Page ok » (§3.2.14, arb. 6.9) — indicateur de statut, pas une case à
// cocher : c'est le résumé que toutes les informations obligatoires sont
// renseignées (champs obligatoires de toutes les sections + signatures).
// Calculé à l'affichage et actualisé à chaque changement sur la page finale.
function signClientPresent() {
  return $("#f-present") ? $("#f-present").classList.contains("on") : state.draft.client_present;
}
function pageOkMissingLabels() {
  const d = state.draft;
  const present = signClientPresent();
  const manquants = [...requiredFieldsMissing()];
  if (!d.technicien_signature_url) manquants.push("Signature du technicien");
  if (present && !d.client_signature_url) manquants.push("Signature du client");
  return manquants;
}
function pageOkComputed() {
  return pageOkMissingLabels().length === 0;
}
function pageOkStateText(missing) {
  return missing.length ? "À compléter" : "Page ok";
}
function pageOkHintText(missing) {
  return missing.length ? `À renseigner : ${missing.join(", ")}` : "Toutes les informations obligatoires (*) de toutes les pages sont renseignées.";
}
function pageOkStatusHTML() {
  const missing = pageOkMissingLabels();
  return `
  <div class="toggle-row" id="page-ok-row">
    <div><div class="t-label">Page ok</div><div class="t-hint" id="page-ok-hint">${esc(pageOkHintText(missing))}</div></div>
    <span id="page-ok-state" class="tag ${missing.length ? "muted" : "done"}">${esc(pageOkStateText(missing))}</span>
  </div>`;
}
function readSignStep() {
  const d = state.draft;
  d.statut = $("#f-statut .active")?.dataset.v || d.statut;
  d.devis_souhaite = $("#f-devis").classList.contains("on");
  d.devis_commentaire = cleanText($("#f-devis-com").value);
  if ($("#f-prochaine")) d.prochaine_intervention_prevue = $("#f-prochaine").classList.contains("on");
  d.technicien_nom = $("#f-tech").value.trim();
  d.client_present = signClientPresent();
  d.client_signature_nom = $("#f-client-sig").value.trim();
  // Statut « Page ok » calculé (complétude obligatoires + signatures) — persisté.
  d.page_ok = pageOkComputed();
  if (d.technicien_nom) localStorage.setItem("ce_technicien_nom", d.technicien_nom);
  return true;
}

function cleanText(v) {
  return v
    .split("\n")
    .map((l) => l.trimEnd())
    .filter((l, i, a) => !(l === "" && a[i - 1] === ""))
    .join("\n")
    .trim();
}

function readStepIntoDraft(step) {
  const steps = wizardSteps();
  const s = steps[step - 1];
  let ok = true;
  if (s && s.read) ok = s.read();
  persistDraft(); // BP-01 : brouillon persiste à chaque changement d'étape
  return ok;
}

// Contrôle de complétude des champs obligatoires — arbitrage 6.9 (§3.2.14) :
// les champs marqués d'un astérisque ne bloquent pas la navigation entre les
// pages, ils conditionnent la soumission finale. Valable pour la fiche
// générique comme pour les fiches d'entretien.
function requiredFieldsMissing() {
  const d = state.draft;
  const manquants = [];
  if (!(d.client.nom || "").trim()) manquants.push("Nom du client");
  if (!(d.client.adresse || "").trim()) manquants.push("Adresse");
  if (!(d.client.code_postal || "").trim()) manquants.push("Code postal");
  if (!(d.client.ville || "").trim()) manquants.push("Ville");
  if (!(d.client.type_batiment || "").trim()) manquants.push("Type de bâtiment");
  if (draftMeta() && !(d.type_entretien_detail || "").trim()) manquants.push("Type d'entretien");
  // Page 3/6 (arbitrages 09/10 — 2.2, 6.5, 6.7 ; §3.2.6) : « Équipement
  // concerné(s) » et « Descriptif de la demande » obligatoires, champs
  // Intitulé / Marque / Modèle / N° de série obligatoires sur chaque ligne.
  if (!(d.descriptif_demande || "").trim()) manquants.push("Descriptif de la demande");
  if (!d.equipements?.length) manquants.push("Équipement concerné");
  d.equipements.forEach((eq, i) => {
    const n = i + 1;
    if (!(eq.intitule || "").trim()) manquants.push(`Intitulé (équipement ${n})`);
    if (!(eq.marque || "").trim()) manquants.push(`Marque (équipement ${n})`);
    if (!(eq.modele || "").trim()) manquants.push(`Modèle (équipement ${n})`);
    if (!(eq.numero_serie || "").trim()) manquants.push(`N° de série (équipement ${n})`);
  });
  return manquants;
}

