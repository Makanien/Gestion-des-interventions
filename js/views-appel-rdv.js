/* js/views-appel-rdv.js — menu +, appels, rendez-vous. Extrait d'app.js (BP-03) : script classique, portée globale partagée ;
   chargé avant app.js dans l'ordre de index.html. */
// ---------------------------------------------------------
// Bouton "+" — point d'entrée unique (US-18)
// ---------------------------------------------------------
function openCreateSheet() {
  const overlay = document.createElement("div");
  overlay.className = "sheet-overlay";
  overlay.innerHTML = `
    <div class="sheet">
      <div class="sheet-head"><h3>Créer</h3><button class="icon-btn" id="sheet-close" aria-label="Fermer" title="Fermer">${ICONS.close}</button></div>
      ${[
        { k: "appel", icon: "phone", label: "Nouvel appel", sub: "Enregistrer un contact client entrant" },
        { k: "rdv", icon: "calendar", label: "Nouveau rendez-vous", sub: "Planifier directement, sans passer par un appel" },
        { k: "intervention", icon: "wrench", label: "Nouvelle intervention", sub: "Sav, Garantie, Dépannage, Diagnostic, Sur devis" },
        { k: "entretien_air_eau", icon: "droplet", label: "Entretien Air/Eau - Sol/Eau", sub: "PAC géothermie / aérothermie" },
        { k: "entretien_air_air", icon: "wind", label: "Entretien Air/Air", sub: "Mono Split, Multi Split ou Gainable" },
        { k: "entretien_chaudiere", icon: "flame", label: "Entretien Chaudière bois", sub: "Chaudière Bûches, Granulés ou Déchiquettée" },
        // Arbitrage 6.10/6.11 (09/10, §3.2.4) : 6e entrée (trame en
        // préparation, données client à venir) ; l'entrée US-24 du menu est
        // retirée pour le moment — le flux #/contrat et ses données restent
        // accessibles.
        { k: "entretien_solaire", icon: "sun", label: "Entretien installation solaire", sub: "Trame commune — contenu à venir (§11 PRD)" },
      ].map((o) => `
        <button class="sheet-item" data-create="${o.k}">
          <span class="sheet-icon">${ICONS[o.icon]}</span>
          <span class="sheet-body"><span class="sheet-label">${o.label}</span><span class="sheet-sub">${o.sub}</span></span>
          ${ICONS.chevron}
        </button>`).join("")}
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeSheet(); });
  $("#sheet-close").addEventListener("click", closeSheet);
  $all("[data-create]").forEach((b) => b.addEventListener("click", () => {
    const k = b.dataset.create;
    closeSheet();
    if (k === "appel") { clearAppelDraft(); go("#/appel"); }
    else if (k === "rdv") { state.rdvDraft = null; state.rdvPrefill = null; go("#/rdv"); }
    else if (k === "intervention") { state.draft = emptyDraft("intervention"); state.draftType = "intervention"; go("#/new/1"); }
    else { const t = k.replace("entretien_", ""); state.draft = emptyDraft(t); state.draftType = t; go(`#/entretien/${t}/1`); }
  }));
  function closeSheet() { overlay.remove(); }
}

// ---------------------------------------------------------
// Nouvel appel (US-01)
// ---------------------------------------------------------
// Brouillon « Nouvel appel » : synchronisé depuis le DOM à chaque saisie et
// persisté dans localStorage. Sans cela, un re-rendu déclenché par la sync
// (retour sur l'onglet, refresh de session Supabase, màj du service worker,
// réveil du navigateur) remettait le formulaire à zéro et effaçait la saisie.
function syncAppelDraft() {
  const d = state.appelDraft;
  if (!d) return;
  d.nom = $("#a-nom").value.trim();
  d.adresse = $("#a-adresse").value.trim();
  d.code_postal = $("#a-cp").value.trim();
  d.ville = $("#a-ville").value.trim();
  d.tel = $("#a-tel").value.trim();
  d.mail = $("#a-mail").value.trim();
  d.motif = cleanText($("#a-motif").value);
  d.type_batiment = $("#a-bat").value;
  d.type_intervention = $("#a-type").value;
  try { localStorage.setItem("ce_appel_draft", JSON.stringify(d)); } catch (e) { ErrorLog.warn("Brouillon d'appel non sauvegardé", e); }
}
function clearAppelDraft() {
  state.appelDraft = null;
  try { localStorage.removeItem("ce_appel_draft"); } catch (e) { ErrorLog.warn("Brouillon d'appel non purgé", e); }
}

async function renderAppel(isEdit = false) {
  await ensureClientsCache();
  let d = state.appelDraft;
  if (!d) {
    try {
      d = JSON.parse(localStorage.getItem("ce_appel_draft") || "null");
      // Brouillon d'une édition abandonnée : ne pas le recharger dans un « Nouvel appel ».
      if (d && d.id) d = null;
    } catch (e) { d = null; }
  }
  if (!d) d = { client_id: null, nom: "", adresse: "", code_postal: "", ville: "", tel: "", mail: "", motif: "", type_batiment: "+ de 2 ans", type_intervention: "Dépannage" };
  state.appelDraft = d;
  setApp(`
    ${topbar({
      title: isEdit ? "Modifier l'appel" : "Nouvel appel",
      subtitle: isEdit ? "Mettre à jour ou supprimer" : "Contexte d'un appel client",
      back: true,
      actions: isEdit ? `<button class="icon-btn" data-nav="appel-delete" data-id="${d.id}" title="Supprimer" aria-label="Supprimer">${ICONS.trash}</button>` : "",
    })}
    <main>
      <div class="card" style="padding:14px;">
        <div class="field combo">
          <label>Nom du client *</label>
          <input id="a-nom" type="text" autocomplete="off" value="${esc(d.nom)}" placeholder="Rechercher ou saisir un nouveau nom" />
          <div class="combo-list" id="a-combo-list" style="display:none;"></div>
        </div>
        <div class="field"><label>Adresse *</label><input id="a-adresse" type="text" value="${esc(d.adresse)}" /></div>
        <div class="row2">
          <div class="field"><label>Code postal *</label><input id="a-cp" type="text" inputmode="numeric" value="${esc(d.code_postal)}" /></div>
          <div class="field"><label>Ville *</label><input id="a-ville" type="text" value="${esc(d.ville)}" /></div>
        </div>
        <div class="row2">
          <div class="field"><label>Téléphone *</label><input id="a-tel" type="tel" value="${esc(d.tel)}" /></div>
          <div class="field"><label>Mail *</label><input id="a-mail" type="email" value="${esc(d.mail)}" /></div>
        </div>
        <div class="field"><label>Motif de l'appel *</label><textarea id="a-motif">${esc(d.motif)}</textarea></div>
        <div class="field"><label>Type de bâtiment *</label>
          <select id="a-bat">${["Professionnel", "- de 2 ans", "+ de 2 ans", "+ de 15 ans"].map((t) => `<option ${d.type_batiment === t ? "selected" : ""}>${t}</option>`).join("")}</select>
        </div>
        <div class="field"><label>Type d'intervention *</label>
          <select id="a-type">${["Devis", "Dépannage", "Garantie", "Entretien", "Diagnostic"].map((t) => `<option ${d.type_intervention === t ? "selected" : ""}>${t}</option>`).join("")}</select>
        </div>
      </div>
      ${isEdit
        ? `<button class="btn btn-accent" data-nav="appel-update" style="margin-top:14px;">${ICONS.check} Enregistrer les modifications</button>
           <button class="btn btn-primary" data-nav="appel-rdv" style="margin-top:9px;">${ICONS.calendar} Créer le rendez-vous →</button>
           <button class="btn btn-ghost" data-nav="appel-intervention">${ICONS.wrench} Créer l'intervention →</button>`
        : `<button class="btn btn-accent" data-nav="appel-rdv" style="margin-top:14px;">${ICONS.calendar} Créer le rendez-vous →</button>
           <button class="btn btn-primary" data-nav="appel-intervention">${ICONS.wrench} Créer l'intervention →</button>
           <button class="btn btn-ghost" data-nav="appel-save">Enregistrer sans planifier</button>`}
    </main>
    <div class="toast" id="toast"></div>
  `);
  wireAppelCombo();
}

async function renderAppelEdit(id) {
  const a = await DB.getRaw("appels", id);
  if (!a || a._deleted) { go("#/"); return; }
  state.appelDraft = a;
  await renderAppel(true);
}

function wireAppelCombo() {
  const input = $("#a-nom");
  const list = $("#a-combo-list");
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
    if (id === "__new__") { list.style.display = "none"; $("#a-adresse").focus(); return; }
    const cl = state.clientsCache.find((x) => x.id === id);
    if (cl) {
      state.appelDraft.client_id = cl.id;
      $("#a-nom").value = cl.nom || "";
      $("#a-adresse").value = cl.adresse || "";
      $("#a-cp").value = cl.code_postal || "";
      $("#a-ville").value = cl.ville || "";
      $("#a-tel").value = cl.tel || "";
      $("#a-mail").value = cl.mail || "";
      const bat = $("#a-bat");
      if (cl.type_batiment && [...bat.options].some((o) => o.value === cl.type_batiment)) bat.value = cl.type_batiment;
    }
    syncAppelDraft();
    list.style.display = "none";
  });
  input.addEventListener("input", () => {
    if (state.appelDraft.client_id) {
      const cl = state.clientsCache.find((x) => x.id === state.appelDraft.client_id);
      if (cl && cl.nom !== input.value) state.appelDraft.client_id = null;
    }
  });
  // Persiste le brouillon à chaque saisie (texte + sélecteurs).
  [["a-nom", "input"], ["a-adresse", "input"], ["a-cp", "input"], ["a-ville", "input"], ["a-tel", "input"], ["a-mail", "input"], ["a-motif", "input"], ["a-bat", "change"], ["a-type", "change"]].forEach(([id, ev]) => {
    const el = $("#" + id);
    if (el) el.addEventListener(ev, syncAppelDraft);
  });
}

function readAppelDraft() {
  syncAppelDraft();
  const d = state.appelDraft;
  if (!d.nom) { toast("Merci d'indiquer le nom du client", true); return false; }
  return true;
}

async function saveAppelFromDraft(action) {
  if (!readAppelDraft()) return;
  const d = state.appelDraft;
  // utilise le client sélectionné, sinon retrouve ou crée par nom (insensible à la casse)
  const client = d.client_id
    ? await DB.getClient(d.client_id)
    : await DB.findOrCreateClientByName({ nom: d.nom, adresse: d.adresse, code_postal: d.code_postal, ville: d.ville, mail: d.mail, tel: d.tel, type_batiment: d.type_batiment });
  const clientId = client?.id || null;
  // "save" = simple mise à jour d'un appel existant : on conserve son action_sortie.
  const appel = { ...d, client_id: clientId, action_sortie: action === "save" ? (d.action_sortie || "sans_suite") : action };
  await DB.saveAppel(appel);

  if (action === "save") {
    clearAppelDraft();
    toast("Appel enregistré");
    go("#/");
  } else if (action === "rdv") {
    state.rdvPrefill = { appel_id: appel.id, client_id: clientId, nom: d.nom, note: d.motif, type: d.type_intervention === "Devis" ? "rdv_devis" : (d.type_intervention === "Entretien" ? "entretien" : "depannage") };
    clearAppelDraft();
    go("#/rdv");
  } else if (action === "intervention") {
    // pré-remplit une nouvelle intervention ; le motif de l'appel devient le descriptif.
    state.draft = emptyDraft("intervention");
    state.draftType = "intervention";
    state.draft.appel_id = appel.id;
    state.draft.client = { id: clientId, nom: d.nom, adresse: d.adresse, code_postal: d.code_postal, ville: d.ville, mail: d.mail, tel: d.tel, type_batiment: d.type_batiment };
    state.draft.client_id = clientId;
    state.draft.client_signature_nom = d.nom || "";
    state.draft.type_intervention = ["Sav", "Garantie", "Dépannage", "Diagnostic", "Sur devis"].includes(d.type_intervention) ? d.type_intervention : "Dépannage";
    if (d.motif) state.draft.descriptif_demande = d.motif;
    clearAppelDraft();
    go("#/new/2");
  } else {
    clearAppelDraft();
    toast("Appel enregistré");
    go("#/");
  }
}

// ---------------------------------------------------------
// Rendez-vous (US-02)
// ---------------------------------------------------------
async function renderRdv(id) {
  const p = state.rdvPrefill || {};
  let d;
  if (id) {
    d = state.rdvDraft = await DB.getRaw("rendezvous", id);
  } else {
    d = state.rdvDraft || { date: todayISO(), heure_debut: "09:00", heure_fin: "10:00", type: "depannage", intervenant: "", note: p.note || "" };
    // Un brouillon d'édition abandonné garde un `id` : on repart d'un formulaire
    // vierge (nouveau RDV) en conservant la saisie en cours le cas échéant.
    if (d.id) { d = { ...d, id: undefined, created_at: undefined }; }
    state.rdvDraft = d;
  }
  const isEdit = !!id && !!d;
  if (!d) { go("#/"); return; }
  const lienAppel = isEdit && d.appel_id ? await DB.getRaw("appels", d.appel_id) : null;
  // Anti-doublon : si une fiche a déjà été créée depuis ce RDV (ou depuis son
  // appel d'origine), le bouton devient « Voir / Reprendre la fiche ».
  let ficheLiee = null;
  if (isEdit) {
    const itvId = d.intervention_id || (lienAppel && lienAppel.intervention_id) || null;
    if (itvId) {
      const itv = await DB.getRaw("interventions", itvId);
      if (itv && !itv._deleted) ficheLiee = itv;
    }
  }
  // Client du rendez-vous : connu (appel d'origine, édition) → simple rappel ; sinon (création directe,
  // ou ancien RDV sans client) → champ de saisie avec suggestion des clients existants.
  const knownClientId = isEdit ? d.client_id : p.client_id || d.client_id || null;
  const knownClient = knownClientId ? await DB.getClient(knownClientId) : null;
  const knownName = (knownClient && knownClient.nom) || p.nom || "";
  const clientChoices = knownName ? [] : await DB.listClients();
  // Coordonnées du client à la CRÉATION : vérifiables/corrigeables pour un client existant, à renseigner pour un nouveau.
  // (Pas à la modification d'un rendez-vous, ni quand seul un nom d'appel est connu sans fiche client.)
  const showCoords = !isEdit && (!knownName || !!knownClient);
  setApp(`
    ${topbar({ title: isEdit ? "Modifier le rendez-vous" : "Nouveau rendez-vous", subtitle: "Planning", back: true, actions: isEdit ? `<button class="icon-btn" data-nav="rdv-delete" data-id="${d.id}" title="Supprimer" aria-label="Supprimer">${ICONS.trash}</button>` : "" })}
    <main>
      <div class="card" style="padding:14px;">
        ${knownName
          ? `<div class="note blue">Client : <strong>${esc(knownName)}</strong></div>`
          : `<div class="field">
               <label>Client *</label>
               <input id="r-client" type="text" list="r-clients-list" autocomplete="off" placeholder="Choisir un client ou saisir un nouveau nom" value="${esc(d.client_nom_saisi || "")}" />
               <datalist id="r-clients-list">${clientChoices.map((c) => `<option value="${esc(c.nom)}"></option>`).join("")}</datalist>
               <div class="hint">Un nom inconnu crée un nouveau client (à compléter ensuite depuis sa fiche).</div>
             </div>`}
        ${showCoords
          ? `<div class="section-label" style="margin:4px 0 8px;">Coordonnées du client</div>
             <div id="r-coords-hint" class="hint" style="margin:0 0 8px;">${knownClient ? "Vérifiez les coordonnées du client : toute correction est enregistrée sur sa fiche." : ""}</div>
             <div class="field"><label>Adresse</label><input id="r-adresse" type="text" value="${esc(knownClient?.adresse)}" /></div>
             <div class="row2">
               <div class="field"><label>Code postal</label><input id="r-cp" type="text" inputmode="numeric" value="${esc(knownClient?.code_postal)}" /></div>
               <div class="field"><label>Ville</label><input id="r-ville" type="text" value="${esc(knownClient?.ville)}" /></div>
             </div>
             <div class="row2">
               <div class="field"><label>Téléphone</label><input id="r-tel" type="tel" value="${esc(knownClient?.tel)}" /></div>
               <div class="field"><label>Mail</label><input id="r-mail" type="email" value="${esc(knownClient?.mail)}" /></div>
             </div>`
          : ""}
        ${lienAppel ? `<div class="note">Issu de l'appel client du ${fmtStampShort(lienAppel.created_at)}.</div>` : ""}
        ${ficheLiee ? `<div class="note blue">Fiche d'intervention déjà créée pour ce rendez-vous.</div>` : ""}
        <div class="field"><label>Date *</label><input id="r-date" type="date" value="${esc(d.date)}" /></div>
        <div class="row2">
          <div class="field"><label>Heure début</label><input id="r-hdeb" type="time" value="${esc(d.heure_debut)}" /></div>
          <div class="field"><label>Heure fin</label><input id="r-hfin" type="time" value="${esc(d.heure_fin)}" /></div>
        </div>
        <div class="field"><label>Type</label>
          <select id="r-type">
            <option value="depannage" ${d.type === "depannage" ? "selected" : ""}>Dépannage</option>
            <option value="entretien" ${d.type === "entretien" ? "selected" : ""}>Entretien</option>
            <option value="rdv_devis" ${d.type === "rdv_devis" ? "selected" : ""}>Rdv devis</option>
          </select>
        </div>
        <div class="field"><label>Intervenant</label>
          <select id="r-intervenant">${intervenantOptions(d.intervenant, { withEmpty: true })}</select>
        </div>
        <div class="field"><label>Note / motif</label><textarea id="r-note">${esc(d.note)}</textarea></div>
      </div>
      <button class="btn btn-accent" id="btn-save-rdv" style="margin-top:14px;">${ICONS.check} ${isEdit ? "Enregistrer les modifications" : "Enregistrer le rendez-vous"}</button>
      ${isEdit ? (ficheLiee
        ? `<button class="btn btn-primary" data-nav="rdv-open-intervention" data-id="${ficheLiee.id}" style="margin-top:9px;">${ICONS.file} ${DB.normalizeStatut(ficheLiee.statut_dossier) === "brouillon" ? "Reprendre la fiche" : "Voir la fiche"}</button>`
        : `<button class="btn btn-primary" data-nav="rdv-intervention" data-id="${d.id}" style="margin-top:9px;">${ICONS.wrench} Créer l'intervention →</button>`) : ""}
      ${lienAppel ? `<button class="btn btn-ghost" data-nav="rdv-unlink" data-id="${d.id}" style="margin-top:9px;">Détacher de l'appel d'origine</button>` : ""}
    </main>
    <div class="toast" id="toast"></div>
  `);
  const COORDS = [["adresse", "#r-adresse"], ["code_postal", "#r-cp"], ["ville", "#r-ville"], ["tel", "#r-tel"], ["mail", "#r-mail"]];
  const normNomRdv = (v) => (v || "").trim().replace(/\s+/g, " ").toLowerCase();
  const matchClient = (typed) => clientChoices.find((c) => normNomRdv(c.nom) === normNomRdv(typed));
  if (showCoords && !knownName) {
    // Le nom saisi (ou choisi dans la liste) désigne un client existant → ses coordonnées se remplissent pour vérification ;
    // un nom inconnu → champs à renseigner. On ne détruit jamais ce que l'utilisateur a modifié lui-même.
    let filledFrom = null;
    $("#r-client").addEventListener("input", () => {
      const typed = $("#r-client").value;
      const m = matchClient(typed);
      const hint = $("#r-coords-hint");
      if (m) {
        if (filledFrom !== m.id) {
          COORDS.forEach(([k, sel]) => { $(sel).value = m[k] || ""; });
          filledFrom = m.id;
        }
        hint.textContent = "Client existant : vérifiez ses coordonnées — toute correction est enregistrée sur sa fiche.";
      } else {
        if (filledFrom) {
          const prev = clientChoices.find((c) => c.id === filledFrom);
          COORDS.forEach(([k, sel]) => { if ($(sel).value === (prev?.[k] || "")) $(sel).value = ""; });
          filledFrom = null;
        }
        hint.textContent = typed.trim() ? "Nouveau client : renseignez ses coordonnées (facultatif, modifiable ensuite depuis sa fiche)." : "";
      }
    });
  }
  $("#btn-save-rdv").addEventListener("click", async () => {
    const d = state.rdvDraft;
    d.date = $("#r-date").value || todayISO();
    d.heure_debut = $("#r-hdeb").value;
    d.heure_fin = $("#r-hfin").value;
    d.type = $("#r-type").value.toLowerCase();
    d.intervenant = $("#r-intervenant").value;
    d.technicien_id = resolveTechId(d.intervenant);
    d.note = cleanText($("#r-note").value);
    // Coordonnées saisies (création) : contrôle du mail avant toute écriture.
    const coords = {};
    if (showCoords) {
      COORDS.forEach(([k, sel]) => { coords[k] = ($(sel).value || "").trim(); });
      if (!validMail(coords.mail)) { toast("Adresse mail invalide", true); $("#r-mail").focus(); return; }
    }
    // Client saisi (création directe) : on retrouve le client existant (même nom, sans tenir compte de la casse)
    // ou on en crée un — jamais de doublon.
    let clientCree = false;
    let coordsMaj = false;
    let clientRdv = knownClient;
    if (!knownName) {
      const typed = ($("#r-client")?.value || "").trim().replace(/\s+/g, " ");
      if (!typed) { toast("Indiquez le client", true); $("#r-client")?.focus(); return; }
      const existing = matchClient(typed);
      clientRdv = existing || (await DB.findOrCreateClientByName({ nom: typed, ...coords }));
      clientCree = !existing;
      d.client_id = clientRdv.id;
    }
    // Client existant : on ne réécrit sa fiche que si une coordonnée a réellement changé.
    if (showCoords && clientRdv && !clientCree) {
      const raw = await DB.getRaw("clients", clientRdv.id);
      if (raw && COORDS.some(([k]) => (coords[k] || "") !== (raw[k] || ""))) {
        await DB.saveClient({ ...raw, ...coords });
        coordsMaj = true;
      }
    }
    if (!isEdit) {
      if (state.rdvPrefill?.client_id) d.client_id = state.rdvPrefill.client_id;
      if (state.rdvPrefill?.appel_id) d.appel_id = state.rdvPrefill.appel_id;
    }
    await DB.saveRendezvous(d);
    if (d.appel_id) await linkAppelToRdv(d.appel_id, d.id);
    state.rdvDraft = null; state.rdvPrefill = null;
    flashToast(clientCree ? "Rendez-vous enregistré — nouveau client créé" : coordsMaj ? "Rendez-vous enregistré — coordonnées du client mises à jour" : isEdit ? "Rendez-vous modifié" : "Rendez-vous enregistré");
    state.tab = "planning";
    go("#/");
  });
}

// ---------------------------------------------------------
// Cycle de vie de l'appel (arbitré le 25/08/2026)
// L'appel est l'origine du flux : dès qu'un RDV ou une fiche est créé depuis
// lui, il est relié (`appels.rendezvous_id` / `appels.intervention_id`) puis
// masqué de la liste active (bloc « Appels »). Un « dé-lien » est possible.
// ---------------------------------------------------------
async function linkAppelToRdv(appelId, rdvId) {
  if (!appelId || !rdvId) return;
  const appel = await DB.getRaw("appels", appelId);
  if (!appel || appel._deleted) return;
  appel.rendezvous_id = rdvId;
  appel.action_sortie = "rdv";
  await DB.saveAppel(appel);
}

async function linkAppelToIntervention(appelId, interventionId) {
  if (!appelId || !interventionId) return;
  const appel = await DB.getRaw("appels", appelId);
  if (!appel || appel._deleted) return;
  // SEC-03 : le lien s'écrit en local puis part avec la synchronisation normale
  // (l'intervention n'existe pas encore côté serveur à cet instant : un appel
  // direct au serveur échouerait sur la clé étrangère). Les droits sont portés
  // par la RLS (`appels_select`/`appels_update`) et le trigger
  // `appels_restrict_update` côté base.
  appel.intervention_id = interventionId;
  appel.action_sortie = "intervention";
  await DB.saveAppel(appel);
}

async function unlinkAppelFromRdv(rdv) {
  if (!rdv || !rdv.appel_id) return;
  const appel = await DB.getRaw("appels", rdv.appel_id);
  if (appel && !appel._deleted) {
    appel.rendezvous_id = null;
    appel.action_sortie = "sans_suite";
    await DB.saveAppel(appel);
  }
}

async function unlinkAppelFromIntervention(interventionId) {
  if (!interventionId) return;
  const appels = await DB.listAppels();
  const linked = appels.find((a) => a.intervention_id === interventionId);
  if (linked) {
    linked.intervention_id = null;
    linked.action_sortie = "sans_suite";
    await DB.saveAppel(linked);
  }
}

// Lien RDV → fiche : évite qu'un même rendez-vous produise plusieurs fiches
// (anti-doublon — le bouton du RDV bascule vers « Voir / Reprendre la fiche »).
async function linkRdvToIntervention(rdvId, interventionId) {
  if (!rdvId || !interventionId) return;
  const rdv = await DB.getRaw("rendezvous", rdvId);
  if (!rdv || rdv._deleted) return;
  rdv.intervention_id = interventionId;
  await DB.saveRendezvous(rdv);
}

async function unlinkRdvFromIntervention(interventionId) {
  if (!interventionId) return;
  const rdvs = await DB.listRendezvous();
  const linked = rdvs.find((r) => r.intervention_id === interventionId);
  if (linked) {
    linked.intervention_id = null;
    await DB.saveRendezvous(linked);
  }
}

// « Créer l'intervention » depuis un rendez-vous : la fiche s'ouvre pré-remplie
// avec le client et le motif du RDV (ferme la chaîne Appel → RDV → Fiche).
async function rdvToIntervention(id) {
  const rdv = await DB.getRaw("rendezvous", id);
  if (!rdv || rdv._deleted) return;
  const client = rdv.client_id ? await DB.getClient(rdv.client_id) : null;
  state.draft = emptyDraft("intervention");
  state.draftType = "intervention";
  state.draft.rdv_id = rdv.id;
  state.draft.appel_id = rdv.appel_id || null;
  if (client) {
    state.draft.client_id = client.id;
    state.draft.client = { id: client.id, nom: client.nom || "", adresse: client.adresse || "", code_postal: client.code_postal || "", ville: client.ville || "", mail: client.mail || "", tel: client.tel || "", type_batiment: client.type_batiment || "" };
  }
  // Pré-remplissage : technicien affecté au RDV (sinon la personne qui crée),
  // et nom du client pour la signature.
  const techName = resolveTechFullName(rdv.technicien_id, rdv.intervenant);
  if (techName) state.draft.technicien_nom = techName;
  if (client?.nom) state.draft.client_signature_nom = client.nom;
  state.draft.type_intervention = rdv.type === "depannage" ? "Dépannage" : rdv.type === "rdv_devis" ? "Sur devis" : "Diagnostic";
  if (rdv.note) state.draft.descriptif_demande = rdv.note;
  if (rdv.date) state.draft.date = rdv.date;
  go(client ? "#/new/2" : "#/new/1");
}

