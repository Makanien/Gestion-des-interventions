/* js/views-home.js — accueil : tableau de bord, planning, tâches, clients, fiche client. Extrait d'app.js (BP-03) : script classique, portée globale partagée ;
   chargé avant app.js dans l'ordre de index.html. */
// ---------------------------------------------------------
// HOME (Tableau de bord / Planning / Tâches / Clients)
// ---------------------------------------------------------
async function renderHome() {
  // SEC-05 : garde de dernier recours — renderHome est appelé directement depuis
  // plusieurs endroits (onglets, après connexion…) sans passer par route().
  if (!isMember()) { renderPending(); return; }
  const interventions = await DB.listInterventions();
  // Sous-titre Tableau de bord (maquette : « Accueil · N dossiers en cours ») —
  // hors dossiers clôturés, dans le périmètre du rôle connecté.
  const enCours = scopeInterventions(interventions).filter((i) => (DB.normalizeStatut(i.statut_dossier) || "a_valider") !== "termine").length;
  const subtitle = enCours ? `${todayLabel()} · ${enCours} dossier${enCours > 1 ? "s" : ""} en cours` : todayLabel();
  const tabs = [
    { id: "dashboard", label: "Tableau de bord" },
    { id: "planning", label: "Planning" },
    { id: "taches", label: "Tâches" },
    { id: "clients", label: "Clients" },
  ];
  setApp(`
    ${topbar({ title: "Climat Elec", subtitle, onHome: false, actions: `<button class="icon-btn" data-nav="stats" title="Statistiques" aria-label="Statistiques">${ICONS.chart}</button>` })}
    <div class="home-tabs">
      ${tabs.map((t) => `<button class="home-tab ${state.tab === t.id ? "active" : ""}" data-tab="${t.id}">${t.label}</button>`).join("")}
    </div>
    <main>
      <div id="tab-content"></div>
    </main>
    <button class="fab" id="fab-plus" aria-label="Créer">${ICONS.plus}</button>
    <div class="toast" id="toast"></div>
  `);

  $all(".home-tab").forEach((b) => b.addEventListener("click", () => { state.tab = b.dataset.tab; renderHome(); }));
  $("#fab-plus").addEventListener("click", openCreateSheet);

  await renderTab();
}

function todayLabel() {
  return new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

async function renderTab() {
  const root = $("#tab-content");
  if (state.tab === "dashboard") root.innerHTML = await dashboardHTML(); // Tableau de bord (§3.2.15) = vue par défaut
  else if (state.tab === "planning") root.innerHTML = await planningHTML();
  else if (state.tab === "taches") root.innerHTML = await tachesHTML();
  else if (state.tab === "clients") root.innerHTML = await clientsTabHTML();
  else { state.tab = "dashboard"; root.innerHTML = await dashboardHTML(); } // fallback (onglet Dossiers supprimé)
  wireTab();
}

function wireTab() {
  $all("[data-nav='detail']").forEach((el) => el.addEventListener("click", () => go(`#/detail/${el.dataset.id}`)));
  const bind = (sel, evt, cb) => { const el = $(sel); if (el) el.addEventListener(evt, cb); };
  bind("#home-search", "input", async (e) => {
    state.homeSearch = e.target.value;
    await renderTab();
    const el = $("#home-search");
    if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
  });
  bind("#pf-type", "change", (e) => { state.planFilter.type = e.target.value; renderTab(); });
  bind("#pf-tech", "change", (e) => { state.planFilter.intervenant = e.target.value; renderTab(); });
  bind("#tf-type", "change", (e) => { state.tachesFilter.type = e.target.value; renderTab(); });
  bind("#tf-tech", "change", (e) => { state.tachesFilter.intervenant = e.target.value; renderTab(); });
  bind("#client-search", "input", async (e) => {
    state.clientSearch = e.target.value;
    await renderTab();
    const el = $("#client-search");
    if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
  });
  // Onglet Tableau de bord : tri Nom / Code postal / Ville (arb. 6.12) + filtres
  bind("#df-sort", "change", (e) => { state.dashSort = e.target.value; renderTab(); });
  bind("#df-type", "change", (e) => { state.dashFilter.type = e.target.value; renderTab(); });
  bind("#df-tech", "change", (e) => { state.dashFilter.intervenant = e.target.value; renderTab(); });
  // Tableau de bord : le clic sur un titre de groupe déplie le drill-down
  // (liste des dossiers de ce statut — arb. 6.12)
  $all(".status-head[data-toggle]").forEach((el) => el.addEventListener("click", () => {
    const k = el.dataset.toggle;
    const open = !state.dossiersOpen[k];
    state.dossiersOpen[k] = open;
    el.setAttribute("aria-expanded", String(open));
    el.closest(".status-block").classList.toggle("open", open);
  }));
}

async function planningHTML() {
  const [rdvs, clients] = await Promise.all([DB.listRendezvous(), DB.listClients()]);
  const clientMap = Object.fromEntries(clients.map((c) => [c.id, c.nom]));
  const today = todayISO();
  const myName = state.auth?.profile?.full_name || "";
  const myFirstName = (myName.split(/\s+/).filter(Boolean)[0] || myName);
  const uid = state.auth?.user?.id;
  let visible = isManager() ? rdvs : rdvs.filter((r) =>
    (r.technicien_id && r.technicien_id === uid) ||
    (!r.intervenant || r.intervenant === myName || r.intervenant === myFirstName)
  );
  const f = state.planFilter;
  if (f.type) visible = visible.filter((r) => r.type === f.type);
  if (f.intervenant) visible = visible.filter((r) => r.intervenant === f.intervenant);
  const filterBar = `
    <div class="filter-row">
      <select class="filter-select" id="pf-type">
        <option value="">Type : tous</option>
        <option value="depannage" ${f.type === "depannage" ? "selected" : ""}>Dépannage</option>
        <option value="entretien" ${f.type === "entretien" ? "selected" : ""}>Entretien</option>
        <option value="rdv_devis" ${f.type === "rdv_devis" ? "selected" : ""}>Rdv devis</option>
      </select>
      ${isManager() ? `
      <select class="filter-select" id="pf-tech">
        <option value="">Intervenant : tous</option>
        ${intervenantOptions(f.intervenant)}
      </select>` : ""}
    </div>`;
  const byDate = {};
  for (const r of visible) {
    const key = r.date || today;
    (byDate[key] = byDate[key] || []).push(r);
  }
  const days = Object.keys(byDate).sort();
  const body = days.length ? days.map((d) => `
    <div class="section-label">${d === today ? "Aujourd'hui" : fmtDateShortLong(d)}</div>
    ${byDate[d].map((r) => `
      <button class="rdv-item" data-nav="rdv-edit" data-id="${r.id}">
        <span class="rdv-time">${esc(r.heure_debut || "—")}</span>
        <span class="rdv-body">
          <span class="rdv-name">${esc(clientMap[r.client_id] || "Rendez-vous")}</span>
          <span class="rdv-sub">${esc(r.note || r.type || "")}</span>
          <span class="ii-tags"><span class="tag blue">${esc(r.intervenant || "Non affecté")}</span>${r.type ? `<span class="tag">${esc(r.type)}</span>` : ""}</span>
        </span>
      </button>`).join("")}
  `).join("") : `<div class="empty-state"><div class="glyph">${ICONS.calendar}</div><h3>Aucun rendez-vous</h3><p>Créez un rendez-vous depuis le bouton + ou un appel client.</p></div>`;
  return filterBar + body;
}

function matchesType(i, t) {
  if (!t) return true;
  if (t === "Entretiens") return !!i.type_entretien || i.type_intervention === "Entretien";
  return i.type_intervention === t;
}
function matchesIntervenant(i, name) {
  if (!name) return true;
  return (i.technicien_nom || "").toLowerCase().includes(name.toLowerCase());
}
function matchesSearch(i, q) {
  const label = i.type_entretien ? (ENTRETIEN_META[i.type_entretien]?.label || "Entretien") : (i.type_intervention || "");
  return `${i.client?.nom || ""} ${i.type_intervention || ""} ${label}`.toLowerCase().includes(q);
}

async function tachesHTML() {
  const interventions = await DB.listInterventions();
  const q = state.homeSearch.trim().toLowerCase();
  const f = state.tachesFilter;
  let visible = isManager() ? interventions : interventions.filter((i) => !i.technicien_id || i.technicien_id === state.auth?.user?.id);
  if (f.type) visible = visible.filter((i) => matchesType(i, f.type));
  if (f.intervenant) visible = visible.filter((i) => matchesIntervenant(i, f.intervenant));
  // masquer les tâches réalisées par défaut (sauf si recherche active)
  const filtered = q ? visible.filter((i) => matchesSearch(i, q)) : visible.filter((i) => i.statut !== "terminee" || i.statut_dossier === "brouillon");
  const filterBar = `
    <div class="filter-row">
      <select class="filter-select" id="tf-type">
        <option value="">Type : tous</option>
        ${["Sav", "Garantie", "Dépannage", "Diagnostic", "Sur devis", "Entretiens"].map((t) => `<option value="${t}" ${f.type === t ? "selected" : ""}>${t}</option>`).join("")}
      </select>
      ${isManager() ? `
      <select class="filter-select" id="tf-tech">
        <option value="">Intervenant : tous</option>
        ${intervenantOptions(f.intervenant)}
      </select>` : ""}
    </div>`;
  return `
    <div class="search-wrap">${ICONS.search}<input id="home-search" type="text" placeholder="Rechercher un client, un type…" value="${esc(state.homeSearch)}" /></div>
    ${filterBar}
    ${filtered.length ? filtered.map(itemHTML).join("") : `<div class="empty-state"><div class="glyph">${ICONS.wrench}</div><h3>Aucune tâche</h3><p>${q || f.type || f.intervenant ? "Aucun résultat avec ces critères." : "Créez une intervention ou un entretien depuis le bouton +."}</p></div>`}`;
}

function itemHTML(itv) {
  const dot = statutDossierDot(itv.statut_dossier);
  const label = itv.type_entretien ? (ENTRETIEN_META[itv.type_entretien]?.label || "Entretien") : (itv.type_intervention || "-");
  return `
  <button class="intervention-item" data-nav="detail" data-id="${itv.id}">
    <span class="status-dot ${dot.cls}">${dot.svg}</span>
    <span class="ii-body">
      <span class="ii-top">
        <span class="ii-client">${esc(itv.client?.nom || "Client")}</span>
        <span class="ii-date">${fmtDateShort(itv.date)}</span>
      </span>
      <span class="ii-type">${esc(label)}</span>
      <span class="ii-tags">
        <span class="tag ${statutDossierCls(itv.statut_dossier)}">${statutDossierLabel(itv.statut_dossier)}</span>
        ${itv.numero ? `<span class="tag">${esc(itv.numero)}</span>` : ""}
        ${itv.devis_souhaite ? `<span class="tag">Devis souhaité</span>` : ""}
      </span>
    </span>
    ${ICONS.chevron}
  </button>`;
}

// ---------------------------------------------------------
// Tableau de bord = écran d'accueil (US-13 · US-15, §3.2.15)
// Vue synthèse groupée par statut du workflow, « Appels — À traiter » en tête
// (les appels « Enregistrer sans planifier » y arrivent jusqu'à ce qu'un RDV
// ou une fiche soit créé depuis eux). Arbitrages 09/10 (6.12) : le clic sur
// un groupe de statut ouvre le drill-down — la liste des dossiers de ce
// statut — avec tris Nom / Code postal / Ville en plus des filtres type /
// intervenant ; ces éléments valent aussi pour le technicien, dans son
// périmètre (règles §3.2.2 conservées). Bloc « Devis en cours » (maquette) :
// fiches portant l'indicateur « devis souhaité » — à arbitrer avec le client,
// le workflow (§3.3.4) n'ayant pas de statut « devis ».
// ---------------------------------------------------------

// Périmètre du rôle connecté : toute l'équipe (Régis / Delphine) ou, pour le
// technicien, uniquement ses propres lignes (même règle que l'onglet Tâches).
function scopeInterventions(list) {
  if (isManager()) return list;
  const uid = state.auth?.user?.id;
  return list.filter((i) => !i.technicien_id || i.technicien_id === uid);
}

function cmpFr(a, b) {
  return (a || "").localeCompare(b || "", "fr", { sensitivity: "base" });
}
// Tri d'une liste de dossiers : défaut « date récente », sinon Nom / CP / Ville.
function sortDossiersPar(list, mode) {
  const arr = [...list];
  if (mode === "nom") arr.sort((a, b) => cmpFr(a.client?.nom, b.client?.nom) || cmpFr(a.client?.ville, b.client?.ville));
  else if (mode === "cp") arr.sort((a, b) => cmpFr(a.client?.code_postal, b.client?.code_postal) || cmpFr(a.client?.ville, b.client?.ville) || cmpFr(a.client?.nom, b.client?.nom));
  else if (mode === "ville") arr.sort((a, b) => cmpFr(a.client?.ville, b.client?.ville) || cmpFr(a.client?.nom, b.client?.nom));
  else arr.sort((a, b) => (b.date || "").localeCompare(a.date || "") || cmpFr(a.client?.nom, b.client?.nom));
  return arr;
}

async function dashboardHTML() {
  const [interventions, appels] = await Promise.all([DB.listInterventions(), DB.listAppels()]);
  const uid = state.auth?.user?.id;
  const q = state.homeSearch.trim().toLowerCase();
  const f = state.dashFilter;

  // Bloc « Appels — À traiter » : appel non relié à un RDV ni à une fiche
  // (cycle de vie §3.2.5) ; périmètre technicien = ses propres appels (RLS).
  const appelsATraiter = appels
    .filter((a) => !a.rendezvous_id && !a.intervention_id)
    .filter((a) => isManager() || (a.created_by || "") === uid)
    .filter((a) => !q || (a.nom || "").toLowerCase().includes(q))
    .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));

  // Dossiers « en cours » (hors clôturées)
  let dossiers = scopeInterventions(interventions).filter((i) => (DB.normalizeStatut(i.statut_dossier) || "a_valider") !== "termine");
  if (f.type) dossiers = dossiers.filter((i) => matchesType(i, f.type));
  if (f.intervenant) dossiers = dossiers.filter((i) => matchesIntervenant(i, f.intervenant));
  if (q) dossiers = dossiers.filter((i) => (i.client?.nom || "").toLowerCase().includes(q));
  const dossiersDevis = dossiers.filter((i) => i.devis_souhaite);

  // Workflow 4 statuts (P5.4) : les dossiers « Terminé » sont masqués
  // par défaut mais restent accessibles — groupe replié en fin de
  // Tableau de bord, recherche et fiche client.
  let dossiersTermine = scopeInterventions(interventions).filter((i) => (DB.normalizeStatut(i.statut_dossier) || "a_valider") === "termine");
  if (f.type) dossiersTermine = dossiersTermine.filter((i) => matchesType(i, f.type));
  if (f.intervenant) dossiersTermine = dossiersTermine.filter((i) => matchesIntervenant(i, f.intervenant));
  if (q) dossiersTermine = dossiersTermine.filter((i) => (i.client?.nom || "").toLowerCase().includes(q));

  // Groupes par statut, dans l'ordre du workflow (hors clôturées) ; le bloc
  // « Devis en cours » est inséré après « À valider » (position de la maquette).
  const byStatut = {};
  for (const itv of dossiers) {
    const s = DB.normalizeStatut(itv.statut_dossier) || "a_valider";
    (byStatut[s] = byStatut[s] || []).push(itv);
  }
  // Workflow 4 statuts : ordre canonique des groupes (brouillon, a_valider,
  // a_facturer) — les « Terminé » sont hors des groupes « en cours » mais
  // restent accessibles en fin de Tableau de bord (groupe replié), par la
  // recherche, et depuis la fiche client.
  const groups = STATUT_ORDER.filter((s) => s !== "termine" && byStatut[s]?.length)
    .map((s) => ({ key: s, cls: statutDossierCls(s), label: statutDossierLabel(s), items: sortDossiersPar(byStatut[s], state.dashSort) }));
  if (dossiersDevis.length) {
    const i = groups.findIndex((g) => g.key === "a_valider");
    groups.splice(i + 1, 0, { key: "devis", cls: "violet", label: "Devis en cours", items: sortDossiersPar(dossiersDevis, state.dashSort) });
  }

  const filterBar = `
    <div class="filter-row">
      <select class="filter-select" id="df-sort">
        <option value="" ${state.dashSort ? "" : "selected"}>Trier : date récente</option>
        <option value="nom" ${state.dashSort === "nom" ? "selected" : ""}>Trier : nom</option>
        <option value="cp" ${state.dashSort === "cp" ? "selected" : ""}>Trier : code postal</option>
        <option value="ville" ${state.dashSort === "ville" ? "selected" : ""}>Trier : ville</option>
      </select>
      <select class="filter-select" id="df-type">
        <option value="">Type : tous</option>
        ${["Sav", "Garantie", "Dépannage", "Diagnostic", "Sur devis", "Entretiens"].map((t) => `<option value="${t}" ${f.type === t ? "selected" : ""}>${t}</option>`).join("")}
      </select>
      ${isManager() ? `
      <select class="filter-select" id="df-tech">
        <option value="">Intervenant : tous</option>
        ${intervenantOptions(f.intervenant)}
      </select>` : ""}
    </div>`;

  // Section repliée par défaut : le clic sur le titre ouvre le drill-down du
  // groupe (clés préfixées « dash: »).
  const block = (key, cls, label, itemsHtml, count) => {
    if (!count) return "";
    const open = !!state.dossiersOpen[`dash:${key}`];
    return `
    <div class="status-block ${open ? "open" : ""}" data-block="dash-${key}">
      <div class="status-head" data-toggle="dash:${key}" role="button" aria-expanded="${open}">
        <span class="sw sw-${cls}"></span>
        <h3>${label}</h3>
        <span class="n">${count}</span>
        <span class="chev">${ICONS.chevron}</span>
      </div>
      <div class="status-items">${itemsHtml}</div>
    </div>`;
  };

  const body = block("appels", "appel", "Appels — À traiter", appelsATraiter.map(appelHTML).join(""), appelsATraiter.length)
    + groups.map((g) => block(g.key, g.cls, g.label, g.items.map(itemHTML).join(""), g.items.length)).join("")
    + block("termine", "done", "Terminé", sortDossiersPar(dossiersTermine, state.dashSort).map(itemHTML).join(""), dossiersTermine.length);
  const filtered = !!(q || f.type || f.intervenant);

  return `<div class="search-wrap">${ICONS.search}<input id="home-search" type="text" placeholder="Rechercher un client…" value="${esc(state.homeSearch)}" /></div>
    ${filterBar}
    ${body || `<div class="empty-state"><div class="glyph">${ICONS.file}</div><h3>${filtered ? "Aucun résultat" : "Rien à traiter"}</h3><p>${filtered ? "Aucun dossier ou appel avec ces critères." : "Les dossiers en cours apparaissent ici, groupés par statut du workflow."}</p></div>`}`;
}

function appelHTML(a) {
  return `
  <button class="intervention-item" data-nav="appel-edit" data-id="${a.id}">
    <span class="status-dot">${ICONS.phone}</span>
    <span class="ii-body">
      <span class="ii-top">
        <span class="ii-client">${esc(a.nom || "Client")}</span>
        <span class="ii-date">${fmtStampShort(a.created_at)}</span>
      </span>
      <span class="ii-type">${esc(a.motif || "")}</span>
      <span class="ii-tags">
        <span class="tag">${esc(a.type_intervention || "")}</span>
        <span class="tag pending">À traiter</span>
      </span>
    </span>
    ${ICONS.chevron}
  </button>`;
}

// ---------------------------------------------------------
// Onglet Clients — annuaire (liste, recherche, fiche client)
// ---------------------------------------------------------
async function clientsTabHTML() {
  const [clients, interventions] = await Promise.all([DB.listClients(), DB.listInterventions()]);
  const counts = {};
  for (const i of interventions) {
    if (i.client_id) counts[i.client_id] = (counts[i.client_id] || 0) + 1;
  }
  const q = state.clientSearch.trim().toLowerCase();
  let visible = clients;
  if (q) visible = clients.filter((c) => `${c.nom || ""} ${c.ville || ""} ${c.tel || ""} ${c.code_postal || ""}`.toLowerCase().includes(q));
  return `
    <div class="search-wrap">${ICONS.search}<input id="client-search" type="text" placeholder="Rechercher un client, une ville…" value="${esc(state.clientSearch)}" /></div>
    ${visible.length ? visible.map((c) => clientItemHTML(c, counts[c.id] || 0)).join("") : `<div class="empty-state"><div class="glyph">${ICONS.user}</div><h3>Aucun client</h3><p>${q ? "Aucun résultat avec ces critères." : "Les clients se créent automatiquement lors d'un nouvel appel ou d'une intervention."}</p></div>`}`;
}

function clientItemHTML(c, n) {
  return `
  <button class="intervention-item" data-nav="client-open" data-id="${c.id}">
    <span class="status-dot">${ICONS.user}</span>
    <span class="ii-body">
      <span class="ii-top">
        <span class="ii-client">${esc(c.nom || "Client")}</span>
        <span class="ii-date">${n} dossier${n === 1 ? "" : "s"}</span>
      </span>
      <span class="ii-type">${esc([c.ville, c.tel].filter(Boolean).join(" · ") || "—")}</span>
    </span>
    ${ICONS.chevron}
  </button>`;
}

// ---------------------------------------------------------
// Fiche client — détail + dossiers du client
// ---------------------------------------------------------
async function renderClientDetail(id) {
  const client = await DB.getClient(id);
  if (!client) { go("#/"); return; }
  const interventions = await DB.listInterventions();
  const dossiers = interventions
    .filter((i) => i.client_id === id)
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  // Équipements connus = historique client (copies sans fiche) + équipements
  // de toutes les fiches du client. L'historisation à la finalisation ne copie
  // que les lignes avec n° de série : la liste fusionne donc les deux sources
  // (dédupliquées) pour couvrir tous les équipements de tous les dossiers.
  const eqRows = [...(await DB.listEquipementsForClient(id))];
  for (const d of dossiers) {
    const rows = await DB.listEquipementsForIntervention(d.id);
    eqRows.push(...rows);
  }
  const equipements = mergeEquipements(eqRows);

  setApp(`
    <div class="topbar">
      <div class="topbar-row">
        <button class="back-btn" data-nav="back" aria-label="Retour">${ICONS.back}</button>
        <div><h1>${esc(client.nom || "Client")}</h1><div class="subtitle">Fiche client</div></div>
        <div class="topbar-actions"><button class="icon-btn" data-nav="client-edit" data-id="${esc(client.id)}" title="Modifier le client" aria-label="Modifier le client">${ICONS.pencil}</button></div>
      </div>
    </div>
    <main>
      <div class="detail-header">
        <div class="meta">${dossiers.length} dossier${dossiers.length === 1 ? "" : "s"} enregistré${dossiers.length === 1 ? "" : "s"}</div>
        ${client.type_batiment ? `<div class="ii-tags" style="margin-top:10px;"><span class="tag">${esc(client.type_batiment)}</span></div>` : ""}
      </div>

      <div class="section-label">Coordonnées</div>
      <div class="card">
        <div class="kv"><div class="k">Adresse</div><div class="v">${esc([client.adresse, client.code_postal, client.ville].filter(Boolean).join(" ") || "-")}</div></div>
        <div class="kv"><div class="k">Téléphone</div><div class="v">${esc(client.tel || "-")}</div></div>
        <div class="kv"><div class="k">Mail</div><div class="v">${esc(client.mail || "-")}</div></div>
        <div class="kv"><div class="k">Type de bâtiment</div><div class="v">${esc(client.type_batiment || "-")}</div></div>
      </div>

      ${equipements.length ? `
      <div class="section-label">Équipements connus</div>
      <div class="card">
        ${equipements.map((eq) => `<div class="kv"><div class="k">${esc(eq.intitule || "Équipement")}</div><div class="v">${esc([eq.marque, eq.modele].filter(Boolean).join(" "))}${eq.numero_serie ? ` · N° ${esc(eq.numero_serie)}` : ""}</div></div>`).join("")}
      </div>` : ""}

      <div class="section-label">Dossiers</div>
      ${dossiers.length ? dossiers.map(clientDossierHTML).join("") : `<div class="card"><div class="block-text">Aucun dossier pour ce client.</div></div>`}
    </main>
    <div class="toast" id="toast"></div>
  `);
}

// Modifier un client (coordonnées). Les fiches et PDF lisent le client par son identifiant : la correction
// s'applique donc partout. Le client est synchronisé comme toute autre donnée (contrôle de conflit inclus).
const TYPES_BATIMENT = ["", "Professionnel", "- de 2 ans", "+ de 2 ans", "+ de 15 ans"];
function normNom(s) { return (s || "").trim().replace(/\s+/g, " ").toLowerCase(); }
function validMail(m) { return !m || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m); }

async function renderClientEdit(id) {
  const client = await DB.getRaw("clients", id);
  if (!client || client._deleted) { go("#/clients"); return; }
  // Un type de bâtiment hors liste (ancienne valeur) reste sélectionnable : on ne le perd pas en enregistrant.
  const types = client.type_batiment && !TYPES_BATIMENT.includes(client.type_batiment) ? [client.type_batiment, ...TYPES_BATIMENT] : TYPES_BATIMENT;
  setApp(`
    <div class="topbar">
      <div class="topbar-row">
        <button class="back-btn" data-nav="back" aria-label="Annuler et revenir à la fiche">${ICONS.back}</button>
        <div><h1>Modifier le client</h1><div class="subtitle">${esc(client.nom || "")}</div></div>
      </div>
    </div>
    <main>
      <div class="card" style="padding:14px;">
        <div class="field"><label>Nom du client *</label><input id="ce-nom" type="text" autocomplete="off" value="${esc(client.nom)}" /></div>
        <div class="field"><label>Adresse</label><input id="ce-adresse" type="text" value="${esc(client.adresse)}" /></div>
        <div class="row2">
          <div class="field"><label>Code postal</label><input id="ce-cp" type="text" inputmode="numeric" value="${esc(client.code_postal)}" /></div>
          <div class="field"><label>Ville</label><input id="ce-ville" type="text" value="${esc(client.ville)}" /></div>
        </div>
        <div class="row2">
          <div class="field"><label>Téléphone</label><input id="ce-tel" type="tel" value="${esc(client.tel)}" /></div>
          <div class="field"><label>Mail</label><input id="ce-mail" type="email" value="${esc(client.mail)}" /></div>
        </div>
        <div class="field"><label>Type de bâtiment</label>
          <select id="ce-bat">${types.map((t) => `<option value="${esc(t)}" ${client.type_batiment === t || (!client.type_batiment && t === "") ? "selected" : ""}>${esc(t || "Non précisé")}</option>`).join("")}</select>
        </div>
      </div>
      <button class="btn btn-accent" id="btn-save-client" style="margin-top:14px;">${ICONS.check} Enregistrer les modifications</button>
      <button class="btn btn-ghost" data-nav="back" style="margin-top:9px;">Annuler</button>
    </main>
    <div class="toast" id="toast"></div>
  `);
  $("#btn-save-client").addEventListener("click", async () => {
    const nom = $("#ce-nom").value.trim().replace(/\s+/g, " ");
    const mail = $("#ce-mail").value.trim();
    if (!nom) { toast("Le nom du client est obligatoire", true); $("#ce-nom").focus(); return; }
    if (!validMail(mail)) { toast("Adresse mail invalide", true); $("#ce-mail").focus(); return; }
    // Deux clients de même nom rendraient les recherches ambiguës (et « retrouver par nom » les fusionnerait).
    const others = await DB.listClients();
    if (others.some((c) => c.id !== id && normNom(c.nom) === normNom(nom))) {
      toast("Un autre client porte déjà ce nom", true);
      $("#ce-nom").focus();
      return;
    }
    const next = {
      ...client,
      nom,
      adresse: $("#ce-adresse").value.trim(),
      code_postal: $("#ce-cp").value.trim(),
      ville: $("#ce-ville").value.trim(),
      tel: $("#ce-tel").value.trim(),
      mail,
      type_batiment: $("#ce-bat").value,
    };
    const changed = ["nom", "adresse", "code_postal", "ville", "tel", "mail", "type_batiment"].some((k) => (next[k] || "") !== (client[k] || ""));
    if (changed) {
      await DB.saveClient(next);
      flashToast("Client modifié");
    }
    go(`#/client/${id}`);
  });
}

// Fusionne l'historique client et les équipements des fiches en dédupliquant
// (intitulé + marque + modèle + n° de série, insensible à la casse/espaces) ;
// ignore les lignes vides et les tombstones résiduels.
function mergeEquipements(rows) {
  const key = (eq) => [eq.intitule, eq.marque, eq.modele, eq.numero_serie]
    .map((x) => (x ?? "").toString().trim().toLowerCase()).join("|");
  const seen = new Map();
  for (const eq of rows) {
    if (!eq || eq._deleted) continue;
    const fields = [eq.intitule, eq.marque, eq.modele, eq.numero_serie];
    if (!fields.some((x) => (x ?? "").toString().trim())) continue;
    const k = key(eq);
    if (!seen.has(k)) seen.set(k, eq);
  }
  return [...seen.values()];
}

function clientDossierHTML(itv) {
  const dot = statutDossierDot(itv.statut_dossier);
  const label = itv.type_entretien ? (ENTRETIEN_META[itv.type_entretien]?.label || "Entretien") : (itv.type_intervention || "-");
  return `
  <button class="intervention-item" data-nav="detail" data-id="${itv.id}">
    <span class="status-dot ${dot.cls}">${dot.svg}</span>
    <span class="ii-body">
      <span class="ii-top">
        <span class="ii-client">${esc(label)}</span>
        <span class="ii-date">${fmtDateShort(itv.date)}</span>
      </span>
      <span class="ii-type">${esc(itv.type_entretien_detail || itv.technicien_nom || "")}</span>
      <span class="ii-tags">
        <span class="tag ${statutDossierCls(itv.statut_dossier)}">${statutDossierLabel(itv.statut_dossier)}</span>
        ${itv.numero ? `<span class="tag">${esc(itv.numero)}</span>` : ""}
        ${itv.devis_souhaite ? `<span class="tag">Devis souhaité</span>` : ""}
      </span>
    </span>
    ${ICONS.chevron}
  </button>`;
}

