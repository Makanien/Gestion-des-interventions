/* =========================================================
   Climat Elec — Application (SPA légère, sans framework)
   V3 : planning, appel, entretiens dédiés, workflow de dossier,
        import PDF devis/facture, statistiques, brouillon, numérotation.
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
  checkedUser: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/><polyline points="18 3 21.5 6.5 16 12"/></svg>`,
  sync: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 1-9 9 9 9 0 0 1-9-9 9 9 0 0 1 9-9"/><polyline points="20 3 21 12 12 11"/></svg>`,
  calendar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  phone: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
  camera: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`,
  copy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
  chart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
  flame: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2c1 3 4 5 4 9a4 4 0 0 1-8 0c0-2 1-4 2-5 0 2 1 3 2 4 0-2-1-4 0-8z"/></svg>`,
  wind: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.6 4.6A2 2 0 1 1 11 8H2"/><path d="M12.6 19.4A2 2 0 1 0 14 16H2"/><path d="M17.5 8a2.5 2.5 0 1 1 1 4.8H2"/></svg>`,
  upload: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`,
};

// ---------------------------------------------------------
// Statuts de dossier (workflow V3 — US-13)
// ---------------------------------------------------------
const STATUT_DOSSIER = {
  brouillon: { label: "Brouillon", cls: "muted" },
  a_valider: { label: "À valider", cls: "pending" },
  validee: { label: "Validée", cls: "blue" },
  a_facturer: { label: "À facturer", cls: "blue" },
  facture_importee: { label: "Facture importée", cls: "violet" },
  facture_a_verifier: { label: "Facture à vérifier", cls: "orange" },
  facture_verifiee: { label: "Facture vérifiée", cls: "blue" },
  a_envoyer: { label: "À envoyer", cls: "orange" },
  cloturee: { label: "Clôturée", cls: "done" },
};
function statutDossierLabel(s) { return STATUT_DOSSIER[s]?.label || (s || "À valider"); }
function statutDossierCls(s) { return STATUT_DOSSIER[s]?.cls || "muted"; }

// Icône du point de statut dans la liste des dossiers (une par statut de workflow).
const STATUT_DOSSIER_ICON = {
  brouillon: { icon: "pencil", cls: "pending" },
  a_valider: { icon: "clock", cls: "pending" },
  validee: { icon: "check", cls: "done" },
  a_facturer: { icon: "file", cls: "blue" },
  facture_importee: { icon: "down", cls: "violet" },
  facture_a_verifier: { icon: "search", cls: "orange" },
  facture_verifiee: { icon: "check", cls: "blue" },
  a_envoyer: { icon: "upload", cls: "orange" },
  cloturee: { icon: "check", cls: "done" },
};
function statutDossierDot(s) {
  const m = STATUT_DOSSIER_ICON[s] || { icon: "clock", cls: "pending" };
  return { svg: ICONS[m.icon] || ICONS.clock, cls: m.cls };
}

// Transition "suivante" du workflow (actions proposées au détail).
const WORKFLOW_NEXT = {
  brouillon: [{ statut: "a_valider", label: "Soumettre pour validation" }],
  a_valider: [{ statut: "validee", label: "Valider la fiche" }, { statut: "brouillon", label: "Revenir en brouillon" }],
  validee: [{ statut: "a_facturer", label: "Marquer « à facturer »" }],
  a_facturer: [{ statut: "facture_importee", label: "Marquer facture importée" }],
  facture_importee: [{ statut: "facture_a_verifier", label: "Passer à vérification" }],
  facture_a_verifier: [{ statut: "facture_verifiee", label: "Vérifier et fusionner" }],
  facture_verifiee: [{ statut: "a_envoyer", label: "Marquer prêt à envoyer" }],
  a_envoyer: [{ statut: "cloturee", label: "Clôturer (envoyé au client)" }],
  cloturee: [{ statut: "a_envoyer", label: "Rouvrir (à envoyer)" }],
};

// Actions de sortie d'un appel (US-01).
const ACTION_SORTIE = {
  rdv: { label: "RDV créé", cls: "blue" },
  intervention: { label: "Intervention créée", cls: "violet" },
  sans_suite: { label: "Sans suite", cls: "pending" },
};

// ---------------------------------------------------------
// Modèles de fiches d'entretien (US-19)
// ---------------------------------------------------------
const ENTRETIEN_META = {
  air_eau: {
    label: "Entretien Air/Eau - Sol/Eau",
    icon: "droplet",
    types: ["Air/Eau (aérothermie)", "Sol/Eau (géothermie)"],
    maxEq: 3,
    cerfa: true,
    mesures: [
      { section: "Groupe extérieur", items: [
        { code: "tension_alim", libelle: "Tension d'alimentation", unite: "V" },
        { code: "amperage", libelle: "Ampérage de fonctionnement", unite: "A" },
        { code: "tension_intercom", libelle: "Tension intercommunication", unite: "V" },
        { code: "pression_fluide", libelle: "Pression fluide frigo", unite: "bar" },
        { code: "type_fluide", libelle: "Type de fluide", unite: "" },
        { code: "charge_usine", libelle: "Charge d'usine", unite: "kg" },
        { code: "debit_eau_primaire", libelle: "Débit eau primaire", unite: "m³/h" },
        { code: "t_entree_air_ge", libelle: "T° entrée d'air groupe ext.", unite: "°C" },
        { code: "t_sortie_air_ge", libelle: "T° sortie d'air groupe ext.", unite: "°C" },
      ]},
      { section: "Circuit eau & divers", items: [
        { code: "t_eau_aller_primaire", libelle: "T° eau aller primaire", unite: "°C" },
        { code: "t_eau_retour_primaire", libelle: "T° eau retour primaire", unite: "°C" },
        { code: "t_eau_aller_sec1", libelle: "T° eau aller secondaire 1", unite: "°C" },
        { code: "t_eau_retour_sec1", libelle: "T° eau retour secondaire 1", unite: "°C" },
        { code: "t_eau_aller_sec2", libelle: "T° eau aller secondaire 2", unite: "°C" },
        { code: "t_eau_retour_sec2", libelle: "T° eau retour secondaire 2", unite: "°C" },
        { code: "debits_eau_sec", libelle: "Débits eau secondaires", unite: "m³/h" },
        { code: "pression_eau", libelle: "Pression d'eau", unite: "bar" },
        { code: "t_air_ext", libelle: "T° d'air extérieur", unite: "°C" },
        { code: "filtres", libelle: "Nettoyage / état filtres (tamis, boue)", unite: "" },
        { code: "disconnecteur", libelle: "Disconnecteur", unite: "" },
        { code: "mitigeur_ecs", libelle: "Mitigeur ECS", unite: "" },
        { code: "antigel", libelle: "Sécurité anti-gel", unite: "" },
        { code: "aquastat", libelle: "Aquastat de sécurité", unite: "" },
        { code: "visuel_ge_ui", libelle: "Nettoyage / état visuel GE & unité int.", unite: "" },
        { code: "resserrage_bornes", libelle: "Resserrage des bornes électriques", unite: "" },
        { code: "vannes_equilibrage", libelle: "Vannes d'équilibrage", unite: "" },
        { code: "emetteurs_z1", libelle: "Émetteurs zone 1", unite: "" },
        { code: "emetteurs_z2", libelle: "Émetteurs zone 2", unite: "" },
      ]},
    ],
  },
  air_air: {
    label: "Entretien Air/Air",
    icon: "wind",
    types: ["Air/Air"],
    maxEq: 5,
    cerfa: true,
    mesures: [
      { section: "Groupe extérieur", items: [
        { code: "tension_alim", libelle: "Tension d'alimentation", unite: "V" },
        { code: "amperage", libelle: "Ampérage", unite: "A" },
        { code: "tension_intercom", libelle: "Tension intercommunication", unite: "V" },
        { code: "resserrage_bornes", libelle: "Resserrage des bornes", unite: "" },
        { code: "t_echange_ge", libelle: "T° d'échange groupe ext.", unite: "°C" },
        { code: "t_air_ext", libelle: "T° d'air extérieur", unite: "°C" },
        { code: "filtres_interieurs", libelle: "Nettoyage / état filtres intérieurs", unite: "" },
        { code: "pompe_relevage", libelle: "Nettoyage pompe de relevage", unite: "" },
        { code: "pression_fluide", libelle: "Pression fluide frigo", unite: "bar" },
        { code: "type_fluide", libelle: "Type de fluide", unite: "" },
        { code: "charge_usine", libelle: "Charge usine", unite: "kg" },
        { code: "gwp_fluide", libelle: "GWP fluide", unite: "" },
        { code: "visuel_ge_ui", libelle: "Nettoyage / état visuel GE & unités int.", unite: "" },
      ]},
      { section: "Unités intérieures", items: [
        { code: "ui1_t", libelle: "T° échange unité 1", unite: "°C" },
        { code: "ui2_t", libelle: "T° échange unité 2", unite: "°C" },
        { code: "ui3_t", libelle: "T° échange unité 3", unite: "°C" },
        { code: "ui4_t", libelle: "T° échange unité 4", unite: "°C" },
      ]},
    ],
  },
  chaudiere: {
    label: "Entretien Chaudière bois",
    icon: "flame",
    types: ["Granulés", "Bûches", "Pellets"],
    maxEq: 3,
    cerfa: false,
    prochaine: true,
    mesures: [
      { section: "Électrique / hydraulique", items: [
        { code: "tension_alim", libelle: "Tension d'alimentation", unite: "V" },
        { code: "resserrage_bornes", libelle: "Resserrage des bornes", unite: "" },
        { code: "vannes_equilibrage", libelle: "Vannes d'équilibrage", unite: "" },
        { code: "emetteurs_z1", libelle: "Émetteurs zone 1", unite: "" },
        { code: "emetteurs_z2", libelle: "Émetteurs zone 2", unite: "" },
        { code: "t_air_ext", libelle: "T° d'air extérieur", unite: "°C" },
        { code: "filtres_boue", libelle: "Nettoyage / état filtres & filtre à boue", unite: "" },
        { code: "pression_eau", libelle: "Pression eau", unite: "bar" },
        { code: "disconnecteur", libelle: "Disconnecteur", unite: "" },
        { code: "mitigeur_ecs", libelle: "Mitigeur ECS", unite: "" },
      ]},
      { section: "Combustion & nettoyage", items: [
        { code: "etalonnage_granules", libelle: "Étalonnage & test remplissage granulés", unite: "" },
        { code: "wos", libelle: "Nettoyage & état du WOS (échangeur)", unite: "" },
        { code: "creuset", libelle: "Nettoyage creuset / cendrier", unite: "" },
        { code: "sonde_lambda", libelle: "Nettoyage sonde lambda", unite: "" },
        { code: "chambre_combustion", libelle: "Nettoyage chambre de combustion", unite: "" },
        { code: "chaudiere", libelle: "Nettoyage chaudière", unite: "" },
        { code: "silo_interne", libelle: "Nettoyage silo interne", unite: "" },
        { code: "test_combustion", libelle: "Test de combustion", unite: "" },
        { code: "test_clapet", libelle: "Test clapet coupe-feu", unite: "" },
        { code: "test_bougie", libelle: "Test bougie d'allumage", unite: "" },
        { code: "visuel_chaudiere", libelle: "État visuel chaudière & silo interne", unite: "" },
      ]},
    ],
  },
};

// Champs réglementaires CERFA n°15497 (US-25), affichés sur une seule page.
const CERFA_FIELDS = [
  { code: "cerfa_etancheite", libelle: "Contrôle d'étanchéité effectué", unite: "Oui / Non" },
  { code: "cerfa_quantite_fluide", libelle: "Quantité de fluide manipulée", unite: "kg" },
  { code: "cerfa_type_fluide", libelle: "Type de fluide", unite: "" },
  { code: "cerfa_dechets", libelle: "Déchets ADR / RID", unite: "Oui / Non" },
  { code: "cerfa_attestation", libelle: "N° attestation de capacité", unite: "" },
];

// ---------------------------------------------------------
// State
// ---------------------------------------------------------
let state = {
  view: "home",
  tab: "planning",       // planning | taches | dossiers
  draft: null,
  draftType: "intervention", // intervention | air_eau | air_air | chaudiere
  step: 1,
  homeSearch: "",
  clientsCache: [],
  auth: null,
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

function currentRole() { return state.auth?.profile?.role || "responsable"; }
function isManager() { return !state.auth || ["responsable", "secretaire"].includes(currentRole()); }

function emptyClient() {
  return { nom: "", adresse: "", code_postal: "", ville: "", mail: "", tel: "", type_batiment: "" };
}

function emptyDraft(type) {
  return {
    id: null,
    client_id: null,
    client: emptyClient(),
    type_intervention: type === "intervention" ? "Dépannage" : "Entretien",
    type_entretien: "",
    type_entretien_detail: "",
    date: todayISO(),
    heure_arrivee: nowHM(),
    heure_depart: "",
    forfait_deplacement: "",
    statut: "terminee",
    statut_dossier: null,
    numero: null,
    annee_installation: "",
    equipements: [],
    descriptif_demande: "",
    action_realisee: "",
    pieces: [],
    mesures: [],
    photos: [],
    documents: [],
    devis_souhaite: false,
    devis_commentaire: "",
    prochaine_intervention_prevue: false,
    technicien_nom: localStorage.getItem("ce_technicien_nom") || "",
    client_present: true,
    client_signature_nom: "",
    client_signature_url: null,
    technicien_signature_url: null,
    _brouillon: false,
  };
}

function draftMeta() {
  return state.draftType === "intervention" ? null : ENTRETIEN_META[state.draftType];
}

async function loadDraftFromIntervention(id) {
  const itv = await DB.getIntervention(id);
  if (!itv) { state.draft = null; go("#/"); return; }
  const type = itv.type_entretien || "intervention";
  state.draftType = ENTRETIEN_META[type] ? type : "intervention";
  const d = emptyDraft(state.draftType);
  Object.assign(d, {
    id: itv.id,
    client_id: itv.client_id,
    type_intervention: itv.type_intervention,
    type_entretien: itv.type_entretien || "",
    type_entretien_detail: itv.type_entretien_detail || "",
    date: itv.date,
    heure_arrivee: itv.heure_arrivee,
    heure_depart: itv.heure_depart,
    forfait_deplacement: itv.forfait_deplacement,
    statut: itv.statut || "terminee",
    statut_dossier: itv.statut_dossier || null,
    numero: itv.numero || null,
    annee_installation: itv.annee_installation || "",
    equipements: (itv.equipements || []).map((e) => ({ ...e })),
    descriptif_demande: itv.descriptif_demande,
    action_realisee: itv.action_realisee,
    pieces: (itv.pieces || []).map((p) => ({ ...p })),
    mesures: (itv.mesures || []).map((m) => ({ ...m })),
    photos: (itv.photos || []).map((p) => ({ ...p })),
    documents: (itv.documents || []).map((doc) => ({ ...doc })),
    devis_souhaite: itv.devis_souhaite || false,
    devis_commentaire: itv.devis_commentaire,
    prochaine_intervention_prevue: itv.prochaine_intervention_prevue || false,
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
    if (!state.draft) { state.draft = emptyDraft("intervention"); state.draftType = "intervention"; }
    state.step = parts[1] ? parseInt(parts[1], 10) : 1;
    renderWizard();
  } else if (parts[0] === "entretien" && parts[1]) {
    if (!state.draft || state.draftType !== parts[1]) { state.draft = emptyDraft(parts[1]); state.draftType = parts[1]; }
    state.step = parts[2] ? parseInt(parts[2], 10) : 1;
    renderWizard();
  } else if (parts[0] === "edit" && parts[1]) {
    await loadDraftFromIntervention(parts[1]);
    if (state.draftType === "intervention") go(`#/new/${state.step || 1}`);
    else go(`#/entretien/${state.draftType}/${state.step || 1}`);
  } else if (parts[0] === "detail" && parts[1]) {
    await renderDetail(parts[1]);
  } else if (parts[0] === "appel") {
    if (parts[1]) await renderAppelEdit(parts[1]);
    else { state.appelDraft = null; await renderAppel(); }
  } else if (parts[0] === "rdv") {
    renderRdv();
  } else if (parts[0] === "contrat") {
    renderContrat(parts[1] || null);
  } else if (parts[0] === "stats") {
    await renderStats();
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
function topbar({ title, subtitle, back, onHome, actions }) {
  const accountBtn = state.auth
    ? `<button class="icon-btn" data-nav="account" title="Compte & synchronisation">${ICONS.checkedUser}</button>`
    : `<button class="icon-btn" data-nav="login" title="Se connecter">${ICONS.user}</button>`;
  const extra = actions ? `<div class="topbar-actions">${actions}<button class="icon-btn" data-nav="account" title="Compte & synchronisation">${state.auth ? ICONS.checkedUser : ICONS.user}</button></div>` : accountBtn;
  return `
  <div class="topbar">
    <div class="topbar-row">
      ${back ? `<button class="back-btn" data-nav="back">${ICONS.back}</button>` : `<img class="brand-mark" src="icons/android-chrome-192x192.png" alt="Climat Elec" />`}
      <div>
        <h1>${esc(displayName())}</h1>
        ${subtitle ? `<div class="subtitle">${esc(subtitle)}</div>` : ""}
      </div>
      ${extra}
      ${onHome === false ? "" : `<button class="icon-btn" data-nav="export" title="Exporter mes données">${ICONS.down}</button>`}
    </div>
    <div class="offline-pill" id="offline-pill"><span class="offline-dot"></span>Mode hors ligne — vos données restent sur cet appareil</div>
    ${state.auth && Sync ? `<div class="offline-pill" id="sync-pill" style="background:#0d2b1a;color:#bfe8cf;"><span class="offline-dot" style="background:var(--ce-success);"></span><span id="sync-pill-text">Synchronisé</span></div>` : ""}
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
// HOME (Planning / Tâches / Dossiers)
// ---------------------------------------------------------
async function renderHome() {
  const [interventions, rendezvous] = await Promise.all([DB.listInterventions(), DB.listRendezvous()]);
  const tabs = [
    { id: "planning", label: "Planning" },
    { id: "taches", label: "Tâches" },
    { id: "dossiers", label: "Dossiers" },
  ];
  setApp(`
    ${topbar({ title: "Climat Elec", subtitle: todayLabel(), onHome: false, actions: `<button class="icon-btn" data-nav="stats" title="Statistiques">${ICONS.chart}</button>` })}
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
  if (state.tab === "planning") root.innerHTML = await planningHTML();
  else if (state.tab === "taches") root.innerHTML = await tachesHTML();
  else root.innerHTML = await dossiersHTML();
  wireTab();
}

function wireTab() {
  $all("[data-nav='detail']").forEach((el) => el.addEventListener("click", () => go(`#/detail/${el.dataset.id}`)));
}

async function planningHTML() {
  const [rdvs, clients] = await Promise.all([DB.listRendezvous(), DB.listClients()]);
  const clientMap = Object.fromEntries(clients.map((c) => [c.id, c.nom]));
  const today = todayISO();
  const myName = state.auth?.profile?.full_name || "";
  const myFirstName = myName.split(/\s+/).filter(Boolean).pop() || myName;
  const visible = isManager() ? rdvs : rdvs.filter((r) => !r.intervenant || r.intervenant === myName || r.intervenant === myFirstName);
  const byDate = {};
  for (const r of visible) {
    const key = r.date || today;
    (byDate[key] = byDate[key] || []).push(r);
  }
  const days = Object.keys(byDate).sort();
  if (!days.length) return `<div class="empty-state"><div class="glyph">${ICONS.calendar}</div><h3>Aucun rendez-vous</h3><p>Créez un rendez-vous depuis le bouton + ou un appel client.</p></div>`;

  return days.map((d) => `
    <div class="section-label">${d === today ? "Aujourd'hui" : fmtDateShortLong(d)}</div>
    ${byDate[d].map((r) => `
      <div class="rdv-item">
        <span class="rdv-time">${esc(r.heure_debut || "—")}</span>
        <span class="rdv-body">
          <span class="rdv-name">${esc(clientMap[r.client_id] || "Rendez-vous")}</span>
          <span class="rdv-sub">${esc(r.note || r.type || "")}</span>
          <span class="ii-tags"><span class="tag blue">${esc(r.intervenant || "Non affecté")}</span>${r.type ? `<span class="tag">${esc(r.type)}</span>` : ""}</span>
        </span>
      </div>`).join("")}
  `).join("");
}

async function tachesHTML() {
  const interventions = await DB.listInterventions();
  const q = state.homeSearch.trim().toLowerCase();
  const visible = isManager() ? interventions : interventions.filter((i) => !i.technicien_id || i.technicien_id === state.auth?.user?.id);
  // masquer les tâches réalisées par défaut (sauf si recherche)
  let filtered = q ? visible : visible.filter((i) => i.statut !== "terminee");
  if (q) filtered = visible.filter((i) => (i.client?.nom || "").toLowerCase().includes(q) || (i.type_intervention || "").toLowerCase().includes(q));
  return `
    <div class="search-wrap">${ICONS.search}<input id="home-search" type="text" placeholder="Rechercher un client, un type…" value="${esc(state.homeSearch)}" /></div>
    ${filtered.length ? filtered.map(itemHTML).join("") : `<div class="empty-state"><div class="glyph">${ICONS.wrench}</div><h3>Aucune tâche</h3><p>${q ? "Essayez un autre terme." : "Créez une intervention ou un entretien depuis le bouton +."}</p></div>`}`;
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

async function dossiersHTML() {
  const [interventions, appels] = await Promise.all([DB.listInterventions(), DB.listAppels()]);
  const order = Object.keys(WORKFLOW_NEXT);
  const byStatut = {};
  for (const itv of interventions) {
    const s = itv.statut_dossier || "a_valider";
    (byStatut[s] = byStatut[s] || []).push(itv);
  }
  const keys = order.filter((k) => byStatut[k]?.length);
  // ajouter les statuts inconnus
  for (const k of Object.keys(byStatut)) if (!keys.includes(k)) keys.push(k);

  const appelsBlock = appels.length ? `
    <div class="status-block">
      <div class="status-head"><span class="sw sw-appel"></span><h3>Appels</h3><span class="n">${appels.length}</span></div>
      ${appels.map(appelHTML).join("")}
    </div>` : "";

  if (!keys.length && !appels.length) return `<div class="empty-state"><div class="glyph">${ICONS.file}</div><h3>Aucun dossier</h3><p>Les fiches terminées apparaissent ici, classées par statut.</p></div>`;
  return appelsBlock + keys.map((k) => `
    <div class="status-block">
      <div class="status-head"><span class="sw sw-${statutDossierCls(k)}"></span><h3>${statutDossierLabel(k)}</h3><span class="n">${byStatut[k].length}</span></div>
      ${byStatut[k].map(itemHTML).join("")}
    </div>`).join("");
}

function appelHTML(a) {
  const sortie = ACTION_SORTIE[a.action_sortie];
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
        ${sortie ? `<span class="tag ${sortie.cls}">${esc(sortie.label)}</span>` : ""}
      </span>
    </span>
    ${ICONS.chevron}
  </button>`;
}

// ---------------------------------------------------------
// Bouton "+" — point d'entrée unique (US-18)
// ---------------------------------------------------------
function openCreateSheet() {
  const overlay = document.createElement("div");
  overlay.className = "sheet-overlay";
  overlay.innerHTML = `
    <div class="sheet">
      <div class="sheet-head"><h3>Créer</h3><button class="icon-btn" id="sheet-close">${ICONS.close}</button></div>
      ${[
        { k: "appel", icon: "phone", label: "Nouvel appel", sub: "Enregistrer un contact client entrant" },
        { k: "intervention", icon: "wrench", label: "Nouvelle intervention", sub: "Dépannage, Garantie, Diagnostic" },
        { k: "entretien_air_eau", icon: "droplet", label: "Entretien Air/Eau - Sol/Eau", sub: "PAC géothermie / aérothermie" },
        { k: "entretien_air_air", icon: "wind", label: "Entretien Air/Air", sub: "Mono-split ou multi-split" },
        { k: "entretien_chaudiere", icon: "flame", label: "Entretien Chaudière bois", sub: "Granulés, bûches, pellets" },
        { k: "contrat", icon: "file", label: "Contrat d'entretien annuel", sub: "Digitaliser le contrat (US-24)" },
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
    if (k === "appel") go("#/appel");
    else if (k === "intervention") { state.draft = emptyDraft("intervention"); state.draftType = "intervention"; go("#/new/1"); }
    else if (k === "contrat") go("#/contrat");
    else { const t = k.replace("entretien_", ""); state.draft = emptyDraft(t); state.draftType = t; go(`#/entretien/${t}/1`); }
  }));
  function closeSheet() { overlay.remove(); }
}

// ---------------------------------------------------------
// Nouvel appel (US-01)
// ---------------------------------------------------------
async function renderAppel(isEdit = false) {
  await ensureClientsCache();
  const d = state.appelDraft || { client_id: null, nom: "", adresse: "", code_postal: "", ville: "", tel: "", mail: "", motif: "", type_batiment: "+ de 2 ans", type_intervention: "Dépannage" };
  state.appelDraft = d;
  setApp(`
    ${topbar({
      title: isEdit ? "Modifier l'appel" : "Nouvel appel",
      subtitle: isEdit ? "Mettre à jour ou supprimer" : "Contexte d'un appel client",
      back: true,
      actions: isEdit ? `<button class="icon-btn" data-nav="appel-delete" data-id="${d.id}" title="Supprimer">${ICONS.trash}</button>` : "",
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
          <select id="a-bat">${["Professionnel", "- de 2 ans", "+ de 2 ans"].map((t) => `<option ${d.type_batiment === t ? "selected" : ""}>${t}</option>`).join("")}</select>
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
    list.style.display = "none";
  });
  input.addEventListener("input", () => {
    if (state.appelDraft.client_id) {
      const cl = state.clientsCache.find((x) => x.id === state.appelDraft.client_id);
      if (cl && cl.nom !== input.value) state.appelDraft.client_id = null;
    }
  });
}

function readAppelDraft() {
  const d = state.appelDraft;
  d.nom = $("#a-nom").value.trim();
  d.adresse = $("#a-adresse").value.trim();
  d.code_postal = $("#a-cp").value.trim();
  d.ville = $("#a-ville").value.trim();
  d.tel = $("#a-tel").value.trim();
  d.mail = $("#a-mail").value.trim();
  d.motif = cleanText($("#a-motif").value);
  d.type_batiment = $("#a-bat").value;
  d.type_intervention = $("#a-type").value;
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
    state.appelDraft = null;
    toast("Appel enregistré");
    go("#/");
  } else if (action === "rdv") {
    state.rdvPrefill = { client_id: clientId, nom: d.nom, note: d.motif, type: d.type_intervention === "Devis" ? "rdv_devis" : (d.type_intervention === "Entretien" ? "entretien" : "depannage") };
    state.appelDraft = null;
    go("#/rdv");
  } else if (action === "intervention") {
    // pré-remplit une nouvelle intervention
    state.draft = emptyDraft("intervention");
    state.draftType = "intervention";
    state.draft.client = { id: clientId, nom: d.nom, adresse: d.adresse, code_postal: d.code_postal, ville: d.ville, mail: d.mail, tel: d.tel, type_batiment: d.type_batiment };
    state.draft.client_id = clientId;
    state.draft.type_intervention = ["Dépannage", "Garantie", "Diagnostic"].includes(d.type_intervention) ? d.type_intervention : "Dépannage";
    state.appelDraft = null;
    go("#/new/2");
  } else {
    state.appelDraft = null;
    toast("Appel enregistré");
    go("#/");
  }
}

// ---------------------------------------------------------
// Rendez-vous (US-02)
// ---------------------------------------------------------
function renderRdv() {
  const p = state.rdvPrefill || {};
  const d = state.rdvDraft || { date: todayISO(), heure_debut: "09:00", heure_fin: "10:00", type: "depannage", intervenant: "", note: p.note || "" };
  state.rdvDraft = d;
  setApp(`
    ${topbar({ title: "Nouveau rendez-vous", subtitle: "Planning", back: true })}
    <main>
      <div class="card" style="padding:14px;">
        ${p.nom ? `<div class="note blue">Client : <strong>${esc(p.nom)}</strong></div>` : ""}
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
          <select id="r-intervenant">${["", "Jérémy", "Régis", "Delphine"].map((t) => `<option ${d.intervenant === t ? "selected" : ""}>${t || "Non affecté"}</option>`).join("")}</select>
        </div>
        <div class="field"><label>Note / motif</label><textarea id="r-note">${esc(d.note)}</textarea></div>
      </div>
      <button class="btn btn-accent" id="btn-save-rdv" style="margin-top:14px;">${ICONS.check} Enregistrer le rendez-vous</button>
    </main>
    <div class="toast" id="toast"></div>
  `);
  $("#btn-save-rdv").addEventListener("click", async () => {
    const d = state.rdvDraft;
    d.date = $("#r-date").value || todayISO();
    d.heure_debut = $("#r-hdeb").value;
    d.heure_fin = $("#r-hfin").value;
    d.type = $("#r-type").value.toLowerCase();
    d.intervenant = $("#r-intervenant").value;
    d.note = cleanText($("#r-note").value);
    if (state.rdvPrefill?.client_id) d.client_id = state.rdvPrefill.client_id;
    await DB.saveRendezvous(d);
    state.rdvDraft = null; state.rdvPrefill = null;
    toast("Rendez-vous enregistré");
    state.tab = "planning";
    go("#/");
  });
}

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
  return [
    { id: "client_entretien", title: "Client & entretien", render: stepClientEntretienHTML, wire: wireClientEntretienStep, read: readClientEntretienStep },
    { id: "equipement", title: "Équipement", render: stepEquipHTML, wire: wireEquipStep, read: readEquipStep },
    { id: "mesures", title: "Mesures", render: stepMesuresHTML, wire: wireMesuresStep, read: readMesuresStep },
    { id: "remarque_pieces", title: "Remarque & pièces", render: stepRemarquePiecesHTML, wire: wireRemarquePiecesStep, read: readRemarquePiecesStep },
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
        <button class="back-btn" data-nav="cancel">${ICONS.close}</button>
        <div><h1>${esc(title)}</h1>${state.draft?.numero ? `<div class="subtitle">${esc(state.draft.numero)}</div>` : ""}</div>
      </div>
      ${stepsBarHTML(state.step, steps.length)}
    </div>
    <div class="step-title">
      <div class="step-eyebrow">Étape ${state.step} / ${steps.length}</div>
      <h2>${step.title}</h2>
    </div>
    <main style="padding-top:14px;">${step.render()}</main>
    <div class="wizard-footer">
      ${state.step > 1 ? `<button class="btn btn-ghost" data-nav="prev">${ICONS.back} Retour</button>` : `<button class="btn btn-ghost" data-nav="brouillon">${ICONS.file} Brouillon</button>`}
      <button class="btn ${state.step === steps.length ? "btn-accent" : "btn-primary"}" data-nav="${state.step === steps.length ? "finish" : "next"}">
        ${state.step === steps.length ? `${ICONS.check} Valider la fiche` : "Continuer"}
      </button>
    </div>
    <div class="toast" id="toast"></div>
  `);
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
        ${["", "Professionnel", "- de 2 ans", "+ de 2 ans"].map((t) => `<option value="${esc(t)}" ${c.type_batiment === t ? "selected" : ""}>${t || "Non précisé"}</option>`).join("")}
      </select>
    </div>`;
}

function stepClientHTML() {
  return `<div class="card" style="padding:14px;">${clientFieldsHTML(state.draft.client)}</div>`;
}

function stepClientEntretienHTML() {
  const meta = draftMeta();
  return `
  <div class="card" style="padding:14px;">
    ${clientFieldsHTML(state.draft.client)}
    <div class="field" style="margin-bottom:0;">
      <label>Type d'entretien *</label>
      <select id="f-type-entretien">
        ${meta.types.map((t) => `<option ${state.draft.type_entretien_detail === t ? "selected" : ""}>${t}</option>`).join("")}
      </select>
    </div>
  </div>`;
}

function wireClientStep() { wireClientCombo(); }
function wireClientEntretienStep() { wireClientCombo(); }

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
  d.client = { ...d.client, id: d.client_id || d.client.id, nom: $("#f-nom").value.trim(), adresse: $("#f-adresse").value.trim(), code_postal: $("#f-cp").value.trim(), ville: $("#f-ville").value.trim(), tel: $("#f-tel").value.trim(), mail: $("#f-mail").value.trim(), type_batiment: $("#f-type-bat").value };
  if (state.draftType !== "intervention") {
    d.type_entretien = state.draftType;                          // clé machine (air_eau / air_air / chaudiere)
    d.type_entretien_detail = $("#f-type-entretien")?.value || "";
  }
}
function readClientStep() {
  captureClientFields();
  if (!state.draft.client.nom) { toast("Merci d'indiquer le nom du client", true); return false; }
  return true;
}
function readClientEntretienStep() {
  captureClientFields();
  if (!state.draft.client.nom) { toast("Merci d'indiquer le nom du client", true); return false; }
  return true;
}

// ---- Étape Intervention ----
function stepInterventionHTML() {
  const d = state.draft;
  const types = ["Dépannage", "Garantie", "Diagnostic"];
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
        ${["", "Z0 (Chazé-sur-Argos)", "Z1 (5 à 10 kms)", "Z2 (11 à 30 kms)", "Z3 (31 à 50 kms)", "Forfait"].map((z) => `<option value="${esc(z)}" ${d.forfait_deplacement === z ? "selected" : ""}>${z || "Non précisé"}</option>`).join("")}
      </select>
    </div>
  </div>
  <div class="section-label">Statut de l'intervention</div>
  <div class="segmented" id="f-statut">
    <button type="button" data-v="terminee" class="${d.statut === "terminee" ? "active" : ""}">Terminée avec succès</button>
    <button type="button" data-v="a_prevoir" class="${d.statut === "a_prevoir" ? "active" : ""}">Nouvelle intervention à prévoir</button>
  </div>`;
}
function wireInterventionStep() {
  $all("#f-statut button").forEach((b) => b.addEventListener("click", () => {
    $all("#f-statut button").forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
  }));
}
function readInterventionStep() {
  const d = state.draft;
  d.type_intervention = $("#f-type-itv").value;
  d.date = $("#f-date").value || todayISO();
  d.heure_arrivee = $("#f-h-arr").value;
  d.heure_depart = $("#f-h-dep").value;
  d.forfait_deplacement = $("#f-forfait").value;
  d.statut = $("#f-statut .active")?.dataset.v || "terminee";
  return true;
}

// ---- Étape Équipement + descriptif ----
function equipLineHTML(eq, idx) {
  return `
  <div class="line-group" data-eq="${idx}">
    <div class="line-group-head"><span>Équipement ${idx + 1}</span><button type="button" class="remove-line" data-remove-eq="${idx}">${ICONS.trash.replace('width="24" height="24"', 'width="13" height="13"')} Supprimer</button></div>
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
  const meta = draftMeta();
  const max = meta?.maxEq || 3;
  return `
  ${meta ? `<div class="card" style="padding:14px;margin-bottom:12px;"><div class="field" style="margin-bottom:0;"><label>Année d'installation</label><input id="f-annee" type="text" inputmode="numeric" placeholder="Ex : 2021" value="${esc(d.annee_installation)}" /></div></div>` : ""}
  <div class="section-label">Équipement(s) concerné(s)</div>
  <div id="eq-list">${d.equipements.map(equipLineHTML).join("")}</div>
  <button type="button" class="add-line-btn" id="add-eq">${ICONS.plus} Ajouter un équipement</button>
  ${state.draftType === "intervention" ? `<div class="section-label">Descriptif de la demande</div><textarea id="f-descriptif" placeholder="Ce que signale ou demande le client…">${esc(d.descriptif_demande)}</textarea>` : ""}`;
}
function wireEquipStep() {
  $("#add-eq").addEventListener("click", () => {
    const meta = draftMeta();
    if (state.draft.equipements.length >= (meta?.maxEq || 3)) { toast(`Maximum ${meta?.maxEq || 3} équipements`, true); return; }
    state.draft.equipements.push({ intitule: "", marque: "", modele: "", numero_serie: "" });
    $("#eq-list").innerHTML = state.draft.equipements.map(equipLineHTML).join("");
    wireEquipLines();
  });
  wireEquipLines();
  if (state.draftType === "intervention") autoResize("f-descriptif");
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
  if (state.draftType === "intervention") state.draft.descriptif_demande = cleanText($("#f-descriptif").value);
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
function stepRemarquePiecesHTML() {
  const d = state.draft;
  return `
  <div class="section-label">Remarque / Observation</div><textarea id="f-action" placeholder="Observations de l'entretien…">${esc(d.action_realisee)}</textarea>
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
function readRemarquePiecesStep() {
  state.draft.action_realisee = cleanText($("#f-action").value);
  return true;
}

// ---- Étape Mesures (entretiens) ----
function stepMesuresHTML() {
  const meta = draftMeta();
  const d = state.draft;
  const val = (code) => (d.mesures.find((m) => m.code === code)?.valeur || "");
  const sections = meta.mesures.map((s) => `
    <div class="section-label">${esc(s.section)}</div>
    <div class="card">
      ${s.items.map((m) => `
        <div class="kv" style="padding:8px 14px;">
          <div class="k" style="width:auto;flex:1;">${esc(m.libelle)}</div>
          <div class="v" style="width:110px;flex:none;"><input type="text" inputmode="decimal" data-mesure-code="${m.code}" placeholder="${esc(m.unite)}" value="${esc(val(m.code))}" style="width:100%;padding:8px;border:1px solid var(--ce-border);border-radius:8px;" /></div>
        </div>`).join("")}
    </div>`).join("");

  const cerfa = meta.cerfa ? `
    <div class="section-label">CERFA n°15497 — fluides frigorigènes</div>
    <div class="card">
      ${CERFA_FIELDS.map((f) => `
        <div class="kv" style="padding:8px 14px;">
          <div class="k" style="width:auto;flex:1;">${esc(f.libelle)}</div>
          <div class="v" style="width:110px;flex:none;"><input type="text" data-mesure-code="${f.code}" placeholder="${esc(f.unite)}" value="${esc(val(f.code))}" style="width:100%;padding:8px;border:1px solid var(--ce-border);border-radius:8px;" /></div>
        </div>`).join("")}
    </div>` : "";
  return `<div class="note blue">Formulaire CERFA sur une seule page (document officiel).</div>${sections}${cerfa}`;
}
function wireMesuresStep() {}
function readMesuresStep() {
  const meta = draftMeta();
  const codes = [];
  meta.mesures.forEach((s) => s.items.forEach((m) => codes.push(m)));
  if (meta.cerfa) CERFA_FIELDS.forEach((f) => codes.push(f));
  const map = new Map();
  state.draft.mesures.forEach((m) => map.set(m.code, m));
  for (const m of codes) {
    const input = document.querySelector(`[data-mesure-code="${m.code}"]`);
    const valeur = input ? input.value.trim() : "";
    const libelle = m.libelle;
    if (map.has(m.code)) map.get(m.code).valeur = valeur;
    else map.set(m.code, { code: m.code, libelle, valeur, unite: m.unite, type_entretien: state.draftType });
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
function stepSignHTML() {
  const d = state.draft;
  const meta = draftMeta();
  return `
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
      <input id="f-client-sig" type="text" value="${esc(d.client_signature_nom)}" placeholder="${d.client.nom ? esc(d.client.nom) : "Nom du client"}" />
      <div class="hint">La signature électronique tactile est disponible.</div>
    </div>
    <button type="button" class="add-line-btn" id="btn-client-sign" style="margin-top:10px;">${ICONS.pencil.replace('width="24" height="24"', 'width="15" height="15"')} Signer (client)</button>
    <div class="sig-preview" id="client-sig-preview" style="display:${d.client_signature_url ? "block" : "none"};margin-top:10px;"><img id="client-sig-img" src="${d.client_signature_url ? esc(d.client_signature_url) : ""}" alt="Signature client" /></div>
    <div class="field" style="margin-top:12px;">
      <label>Signature technicien (facultative)</label>
      <button type="button" class="add-line-btn" id="btn-tech-sign" style="margin-top:6px;">${ICONS.pencil.replace('width="24" height="24"', 'width="15" height="15"')} Signer (technicien)</button>
      <div class="sig-preview" id="tech-sig-preview" style="display:${d.technicien_signature_url ? "block" : "none"};margin-top:10px;"><img id="tech-sig-img" src="${d.technicien_signature_url ? esc(d.technicien_signature_url) : ""}" alt="Signature technicien" /></div>
    </div>
  </div>

  <div class="section-label">Récapitulatif</div>
  <div class="card">
    <div class="kv"><div class="k">Client</div><div class="v">${esc(d.client.nom || "-")}</div></div>
    <div class="kv"><div class="k">Type</div><div class="v">${state.draftType === "intervention" ? esc(d.type_intervention) : (meta?.label || "Entretien")}</div></div>
    <div class="kv"><div class="k">Date</div><div class="v">${fmtDateShortLong(d.date)}</div></div>
    <div class="kv"><div class="k">Statut</div><div class="v">${d.statut === "terminee" ? "Terminée avec succès" : "Nouvelle intervention à prévoir"}</div></div>
    <div class="kv"><div class="k">Équipements</div><div class="v">${d.equipements.length || 0}</div></div>
    <div class="kv"><div class="k">Pièces</div><div class="v">${d.pieces.length || 0}</div></div>
    <div class="kv"><div class="k">Photos</div><div class="v">${d.photos.length || 0}</div></div>
  </div>`;
}
function wireSignStep() {
  $("#f-devis").addEventListener("click", (e) => e.currentTarget.classList.toggle("on"));
  $("#f-prochaine")?.addEventListener("click", (e) => e.currentTarget.classList.toggle("on"));
  $("#f-present").addEventListener("click", (e) => {
    e.currentTarget.classList.toggle("on");
    $("#wrap-client-sig").style.display = e.currentTarget.classList.contains("on") ? "block" : "none";
  });
  if (!state.draft.client_present) $("#wrap-client-sig").style.display = "none";
  autoResize("f-devis-com");

  $("#btn-client-sign")?.addEventListener("click", async () => {
    const blob = await signatureModal({ title: "Signature du client" });
    if (!blob) return;
    state.draft._client_sig_blob = blob;
    state.draft.client_signature_url = await blobToDataURL(blob);
    const prev = $("#client-sig-preview");
    prev.style.display = "block";
    $("#client-sig-img").src = state.draft.client_signature_url;
  });
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
function readSignStep() {
  const d = state.draft;
  d.devis_souhaite = $("#f-devis").classList.contains("on");
  d.devis_commentaire = cleanText($("#f-devis-com").value);
  if ($("#f-prochaine")) d.prochaine_intervention_prevue = $("#f-prochaine").classList.contains("on");
  d.technicien_nom = $("#f-tech").value.trim();
  d.client_present = $("#f-present").classList.contains("on");
  d.client_signature_nom = $("#f-client-sig").value.trim();
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
  if (s && s.read) return s.read();
  return true;
}

async function finishWizard() {
  if (!readStepIntoDraft(state.step)) return;
  const d = state.draft;
  const isEdit = !!d.id;
  const steps = wizardSteps();

  // Upload des signatures tactiles vers Supabase Storage (si configuré).
  if (Supabase.configured() && state.auth && navigator.onLine) {
    try {
      if (d.client_present && d._client_sig_blob) d.client_signature_url = await Supabase.uploadSignature(`sig-client-${Date.now()}`, d._client_sig_blob);
      if (d._technicien_sig_blob) d.technicien_signature_url = await Supabase.uploadSignature(`sig-tech-${Date.now()}`, d._technicien_sig_blob);
    } catch (e) { console.warn("Upload signature échoué", e); }
  }

  // Sauvegarde client
  const savedClient = d.client_id
    ? await DB.saveClient({ ...d.client })
    : await DB.findOrCreateClientByName({ ...d.client });
  d.client_id = savedClient.id;
  d.client = savedClient;

  // Historisation des équipements par client (V2)
  if (savedClient.id && d.equipements?.length) {
    const existing = await DB.listEquipementsForClient(savedClient.id);
    for (const eq of d.equipements) {
      const hasSerie = eq.numero_serie && eq.numero_serie.trim();
      const already = existing.some((e) => hasSerie && e.numero_serie === eq.numero_serie);
      if (!already && hasSerie) await DB.saveClientEquipment(savedClient.id, eq);
    }
  }

  // Un brouillon finalisé repart en attente de validation.
  if (!d.statut_dossier || d.statut_dossier === "brouillon") d.statut_dossier = "a_valider";

  const itv = { ...d };
  itv.client = { nom: savedClient.nom, ville: savedClient.ville };

  const saved = await DB.saveIntervention(itv);
  toast(isEdit ? "Fiche mise à jour" : "Fiche enregistrée");
  state.draft = null;
  go(`#/detail/${saved.id}`);
}

async function saveBrouillon() {
  // Capture best-effort de l'étape courante (un brouillon peut être incomplet).
  const steps = wizardSteps();
  const s = steps[state.step - 1];
  try {
    if (s.id === "client" || s.id === "client_entretien") captureClientFields();
    else if (s.read) s.read();
  } catch (e) { /* brouillon tolérant */ }
  const d = state.draft;
  const savedClient = d.client_id
    ? await DB.saveClient({ ...d.client })
    : await DB.findOrCreateClientByName({ ...d.client });
  d.client_id = savedClient.id;
  d.client = savedClient;
  const itv = { ...d, _brouillon: true };
  itv.client = { nom: savedClient.nom, ville: savedClient.ville };
  const saved = await DB.saveIntervention(itv);
  toast("Brouillon enregistré");
  state.draft = null;
  go(`#/detail/${saved.id}`);
}

// ---------------------------------------------------------
// DÉTAIL + WORKFLOW + DOCUMENTS
// ---------------------------------------------------------
async function renderDetail(id) {
  const itv = await DB.getIntervention(id);
  if (!itv) { go("#/"); return; }
  const client = itv.client_id ? await DB.getClient(itv.client_id) : itv.client;
  const meta = itv.type_entretien ? ENTRETIEN_META[itv.type_entretien] : null;
  const label = meta ? meta.label : (itv.type_intervention || "-");

  setApp(`
    <div class="topbar">
      <div class="topbar-row">
        <button class="back-btn" data-nav="back">${ICONS.back}</button>
        <div><h1>${esc(client?.nom || "Détail")}</h1><div class="subtitle">${esc(label)}</div></div>
        <div class="topbar-actions">
          <button class="icon-btn" data-nav="duplicate" data-id="${itv.id}" title="Dupliquer">${ICONS.copy}</button>
          <button class="icon-btn" data-nav="edit" data-id="${itv.id}" title="Modifier">${ICONS.pencil}</button>
          <button class="icon-btn" data-nav="delete" data-id="${itv.id}" title="Supprimer">${ICONS.trash}</button>
        </div>
      </div>
    </div>
    <main>
      <div class="detail-header">
        <div class="meta">${itv.numero ? `${esc(itv.numero)} · ` : ""}${fmtDateShortLong(itv.date)}</div>
        <div class="ii-tags" style="margin-top:10px;">
          <span class="tag ${statutDossierCls(itv.statut_dossier)}">${statutDossierLabel(itv.statut_dossier)}</span>
          <span class="tag ${itv.statut === "terminee" ? "done" : "pending"}">${itv.statut === "terminee" ? "Terminée avec succès" : "Nouvelle intervention à prévoir"}</span>
          ${itv.devis_souhaite ? `<span class="tag">Devis souhaité</span>` : ""}
          ${itv.prochaine_intervention_prevue ? `<span class="tag">Prochaine intervention prévue</span>` : ""}
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
        ${itv.type_entretien_detail ? `<div class="kv"><div class="k">Type d'entretien</div><div class="v">${esc(itv.type_entretien_detail)}</div></div>` : ""}
        ${itv.annee_installation ? `<div class="kv"><div class="k">Année install.</div><div class="v">${esc(itv.annee_installation)}</div></div>` : ""}
        <div class="kv"><div class="k">Horaires</div><div class="v">${esc(itv.heure_arrivee || "-")} → ${esc(itv.heure_depart || "-")}</div></div>
        <div class="kv"><div class="k">Forfait déplacement</div><div class="v">${esc(itv.forfait_deplacement || "-")}</div></div>
      </div>

      ${itv.equipements?.length ? `
      <div class="section-label">Équipement</div>
      <div class="card">
        ${itv.equipements.map((eq) => `<div class="kv"><div class="k">${esc(eq.intitule || "Équipement")}</div><div class="v">${esc([eq.marque, eq.modele].filter(Boolean).join(" "))}${eq.numero_serie ? ` · N° ${esc(eq.numero_serie)}` : ""}</div></div>`).join("")}
      </div>` : ""}

      ${itv.descriptif_demande ? `
      <div class="section-label">Descriptif de la demande</div>
      <div class="card"><div class="block-text">${esc(itv.descriptif_demande)}</div></div>` : ""}

      <div class="section-label">${meta ? "Remarque / Observation" : "Action réalisée"}</div>
      <div class="card"><div class="block-text">${esc(itv.action_realisee || "-")}</div></div>

      ${itv.mesures?.length ? `
      <div class="section-label">Mesures</div>
      <div class="card">
        ${itv.mesures.filter((m) => !m.code.startsWith("cerfa_")).map((m) => `<div class="kv"><div class="k">${esc(m.libelle)}</div><div class="v">${esc(m.valeur || "-")} ${esc(m.unite || "")}</div></div>`).join("")}
      </div>` : ""}

      ${itv.mesures?.some((m) => m.code.startsWith("cerfa_")) ? `
      <div class="section-label">CERFA n°15497</div>
      <div class="card">
        ${itv.mesures.filter((m) => m.code.startsWith("cerfa_")).map((m) => `<div class="kv"><div class="k">${esc(m.libelle)}</div><div class="v">${esc(m.valeur || "-")}</div></div>`).join("")}
      </div>` : ""}

      ${itv.pieces?.length ? `
      <div class="section-label">Pièces utilisées</div>
      <div class="card">
        ${itv.pieces.map((p) => `<div class="kv"><div class="k">${esc(p.designation || "-")}</div><div class="v">${esc(p.reference || "-")} · Qté ${esc(p.quantite ?? "-")}</div></div>`).join("")}
      </div>` : ""}

      ${itv.photos?.length ? `
      <div class="section-label">Photos</div>
      <div class="photo-grid">
        ${itv.photos.map((p) => `<div class="photo-card"><img src="${esc(p.data_url)}" alt="Photo" />${p.legende ? `<div class="photo-legende">${esc(p.legende)}</div>` : ""}</div>`).join("")}
      </div>` : ""}

      <div class="section-label">Signatures</div>
      <div class="card">
        <div class="kv"><div class="k">Technicien</div><div class="v">${esc(itv.technicien_nom || "-")}</div></div>
        ${itv.technicien_signature_url ? `<div class="sig-preview" style="border:none;"><img src="${esc(itv.technicien_signature_url)}" alt="Signature technicien" /></div>` : ""}
        <div class="kv"><div class="k">Client</div><div class="v">${itv.client_present ? esc(itv.client_signature_nom || "-") : "Absent"}</div></div>
        ${itv.client_signature_url ? `<div class="sig-preview" style="border:none;"><img src="${esc(itv.client_signature_url)}" alt="Signature client" /></div>` : ""}
      </div>

      <div class="section-label">Documents du dossier</div>
      ${documentsHTML(itv)}

      <div class="section-label">Actions</div>
      ${workflowButtonsHTML(itv)}

      <div style="margin-top:22px;">
        <button class="btn btn-accent" id="btn-pdf">${ICONS.share} Générer et partager le PDF</button>
      </div>
    </main>
    <div class="toast" id="toast"></div>
    <input type="file" id="doc-input" accept="application/pdf" style="display:none;" />
    <input type="file" id="doc-devis-input" accept="application/pdf" style="display:none;" />
  `);

  $("#btn-pdf").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.innerHTML = `${ICONS.file} Génération du PDF…`;
    try { await downloadInterventionPDF(itv, client); toast("PDF prêt"); }
    catch (err) { console.error(err); toast("Erreur lors de la génération du PDF", true); }
    finally { btn.disabled = false; btn.innerHTML = `${ICONS.share} Générer et partager le PDF`; }
  });

  $("#doc-input").addEventListener("change", () => importDocument(itv.id, "facture", $("#doc-input")));
  $("#doc-devis-input").addEventListener("change", () => importDocument(itv.id, "devis", $("#doc-devis-input")));
}

function documentsHTML(itv) {
  const docs = itv.documents || [];
  if (!docs.length) return `<div class="card"><div class="block-text">Aucun document. Importez le devis ou la facture produits par votre logiciel externe.</div></div>`;
  return docs.map((doc) => `
    <div class="kv">
      <div class="k">${doc.type === "devis" ? "Devis" : doc.type === "facture" ? "Facture" : "Contrat"}</div>
      <div class="v" style="flex:1;">${esc(doc.nom || "-")}${doc.numero_externe ? ` · ${esc(doc.numero_externe)}` : ""}</div>
      <button class="icon-btn" style="margin-left:auto;background:#eef2f4;color:var(--ce-navy);" data-nav="open-doc" data-id="${doc.id}">${ICONS.file}</button>
      <button class="icon-btn" style="margin-left:6px;background:#eef2f4;color:var(--ce-danger);" data-nav="del-doc" data-id="${doc.id}">${ICONS.trash}</button>
    </div>`).join("");
}

function workflowButtonsHTML(itv) {
  const next = WORKFLOW_NEXT[itv.statut_dossier] || [];
  return `
  <div class="wf-actions">
    <button class="btn btn-ghost" data-nav="import-devis" data-id="${itv.id}">${ICONS.upload} Importer le devis (PDF)</button>
    <button class="btn btn-ghost" data-nav="import-facture" data-id="${itv.id}">${ICONS.upload} Importer la facture (PDF)</button>
    ${next.map((n) => `<button class="btn ${n.statut === "cloturee" ? "btn-accent" : "btn-primary"}" data-nav="wf" data-id="${itv.id}" data-to="${n.statut}" style="margin-top:9px;">${ICONS.check} ${n.label}</button>`).join("")}
  </div>`;
}

async function importDocument(interventionId, type, inputEl) {
  const file = inputEl.files[0];
  inputEl.value = "";
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) { toast("Fichier trop volumineux (max 10 Mo)", true); return; }
  const dataUrl = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(file); });
  const doc = { type, nom: file.name, data_url: dataUrl, numero_externe: "" };
  await DB.addDocument(interventionId, doc);
  toast(type === "devis" ? "Devis importé" : "Facture importée");
  await renderDetail(interventionId);
}

async function duplicateIntervention(id) {
  const itv = await DB.getIntervention(id);
  if (!itv) return;
  const type = itv.type_entretien || "intervention";
  state.draftType = ENTRETIEN_META[type] ? type : "intervention";
  const d = emptyDraft(state.draftType);
  d.client = itv.client_id ? { ...(await DB.getClient(itv.client_id)) || emptyClient() } : emptyClient();
  d.client_id = itv.client_id;
  d.equipements = (itv.equipements || []).map((e) => ({ ...e, id: undefined }));
  d.annee_installation = itv.annee_installation || "";
  d.type_entretien = itv.type_entretien || "";
  d.type_entretien_detail = itv.type_entretien_detail || "";
  state.draft = d;
  if (type === "intervention") go("#/new/1");
  else go(`#/entretien/${type}/1`);
}

// ---------------------------------------------------------
// STATISTIQUES
// ---------------------------------------------------------
async function renderStats() {
  const itvs = await DB.listInterventions();
  const byMonth = {};
  const byType = {};
  const byTech = {};
  const byStatut = {};
  for (const i of itvs) {
    const m = (i.date || "").slice(0, 7);
    byMonth[m] = (byMonth[m] || 0) + 1;
    const t = i.type_entretien ? (ENTRETIEN_META[i.type_entretien]?.label || "Entretien") : (i.type_intervention || "-");
    byType[t] = (byType[t] || 0) + 1;
    const tech = i.technicien_nom || "Non renseigné";
    byTech[tech] = (byTech[tech] || 0) + 1;
    byStatut[statutDossierLabel(i.statut_dossier)] = (byStatut[statutDossierLabel(i.statut_dossier)] || 0) + 1;
  }
  const months = Object.keys(byMonth).sort().slice(-6);
  const maxMonth = Math.max(1, ...Object.values(byMonth));
  const sortedByVal = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1]);

  setApp(`
    ${topbar({ title: "Statistiques", back: true })}
    <main>
      <div class="stat-big"><div class="stat-num">${itvs.length}</div><div class="stat-label">interventions enregistrées</div></div>

      <div class="section-label">Par mois</div>
      <div class="card" style="padding:16px;">
        ${months.length ? months.map((m) => `
          <div class="stat-row"><span class="stat-row-label">${esc(monthLabel(m))}</span>
            <div class="stat-bar"><div class="stat-bar-fill" style="width:${Math.round((byMonth[m] / maxMonth) * 100)}%;"></div></div>
            <span class="stat-row-num">${byMonth[m]}</span></div>`).join("") : `<div class="block-text">Aucune donnée.</div>`}
      </div>

      <div class="section-label">Par type</div>
      <div class="card">
        ${sortedByVal(byType).map(([k, v]) => `<div class="kv"><div class="k" style="width:auto;flex:1;">${esc(k)}</div><div class="v">${v}</div></div>`).join("") || `<div class="block-text">Aucune donnée.</div>`}
      </div>

      <div class="section-label">Par technicien</div>
      <div class="card">
        ${sortedByVal(byTech).map(([k, v]) => `<div class="kv"><div class="k" style="width:auto;flex:1;">${esc(k)}</div><div class="v">${v}</div></div>`).join("") || `<div class="block-text">Aucune donnée.</div>`}
      </div>

      <div class="section-label">Par statut</div>
      <div class="card">
        ${sortedByVal(byStatut).map(([k, v]) => `<div class="kv"><div class="k" style="width:auto;flex:1;">${esc(k)}</div><div class="v">${v}</div></div>`).join("") || `<div class="block-text">Aucune donnée.</div>`}
      </div>
    </main>
    <div class="toast" id="toast"></div>
  `);
}
function monthLabel(ym) {
  const [y, m] = ym.split("-");
  return new Date(`${y}-${m}-01T00:00:00`).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

// ---------------------------------------------------------
// CONTRAT D'ENTRETIEN (US-24)
// ---------------------------------------------------------
function renderContrat(id) {
  const c = state.contratDraft || { id: id || null, client_id: null, nb_passages: "1", tarification_zone_km: "", conditions_generales: "", signe_client: "", signe_technicien: "" };
  state.contratDraft = c;
  setApp(`
    ${topbar({ title: "Contrat d'entretien annuel", back: true })}
    <main>
      <div class="card" style="padding:14px;">
        <div class="field"><label>Client *</label><input id="ct-client" type="text" placeholder="Nom du client" value="${esc(c.nom || "")}" /></div>
        <div class="field"><label>Nombre de passages</label>
          <select id="ct-passages">${["1", "2", "3", "4"].map((n) => `<option ${c.nb_passages === n ? "selected" : ""}>${n}</option>`).join("")}</select>
        </div>
        <div class="field"><label>Tarification par zone / km</label><input id="ct-zone" type="text" value="${esc(c.tarification_zone_km)}" placeholder="Ex : Z2 — 25 €" /></div>
        <div class="field"><label>Conditions générales</label><textarea id="ct-cg" placeholder="Conditions générales du contrat…">${esc(c.conditions_generales)}</textarea></div>
      </div>
      <button class="btn btn-accent" id="btn-save-contrat" style="margin-top:14px;">${ICONS.check} Enregistrer le contrat</button>
    </main>
    <div class="toast" id="toast"></div>
  `);
  $("#btn-save-contrat").addEventListener("click", async () => {
    const nom = $("#ct-client").value.trim();
    if (!nom) { toast("Indiquez le nom du client", true); return; }
    const client = await DB.findOrCreateClientByName({ nom });
    state.contratDraft.client_id = client.id;
    state.contratDraft.nom = client.nom;
    state.contratDraft.nb_passages = $("#ct-passages").value;
    state.contratDraft.tarification_zone_km = $("#ct-zone").value.trim();
    state.contratDraft.conditions_generales = cleanText($("#ct-cg").value);
    if (!state.contratDraft.numero) state.contratDraft.numero = await DB.nextNumero("CTR");
    await DB.saveContrat({ ...state.contratDraft });
    state.contratDraft = null;
    toast("Contrat enregistré");
    go("#/");
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

  if (action === "detail") go(`#/detail/${nav.dataset.id}`);
  else if (action === "edit") {
    if (state.draft && state.draft.id !== nav.dataset.id) state.draft = null;
    go(`#/edit/${nav.dataset.id}`);
  }
  else if (action === "duplicate") duplicateIntervention(nav.dataset.id);
  else if (action === "wf") {
    await DB.setStatutDossier(nav.dataset.id, nav.dataset.to);
    toast("Statut mis à jour");
    await renderDetail(nav.dataset.id);
  }
  else if (action === "import-devis") { $("#doc-devis-input").click(); }
  else if (action === "import-facture") { $("#doc-input").click(); }
  else if (action === "open-doc") { openDocument(nav.dataset.id); }
  else if (action === "del-doc") {
    if (confirm("Supprimer ce document ?")) { await DB.deleteDocument(nav.dataset.id); await renderDetail(state.draft?.id || location.hash.split("/")[2]); }
  }
  else if (action === "back") { if (window.history.length > 1) window.history.back(); else go("#/"); }
  else if (action === "cancel") { state.draft = null; go("#/"); }
  else if (action === "prev") { if (state.step > 1) { readStepIntoDraft(state.step); if (state.draftType === "intervention") go(`#/new/${state.step - 1}`); else go(`#/entretien/${state.draftType}/${state.step - 1}`); } }
  else if (action === "next") { if (readStepIntoDraft(state.step)) { if (state.draftType === "intervention") go(`#/new/${state.step + 1}`); else go(`#/entretien/${state.draftType}/${state.step + 1}`); } }
  else if (action === "finish") finishWizard();
  else if (action === "brouillon") saveBrouillon();
  else if (action === "export") exportData();
  else if (action === "account") go("#/account");
  else if (action === "login") go("#/login");
  else if (action === "logout") signOutUser();
  else if (action === "stats") go("#/stats");
  else if (action === "sync-now") runSyncNow();
  else if (action === "appel-edit") go(`#/appel/${nav.dataset.id}`);
  else if (action === "appel-delete") {
    if (confirm("Supprimer cet appel ?")) { await DB.deleteAppel(nav.dataset.id); toast("Appel supprimé"); go("#/"); }
  }
  else if (action === "appel-update") saveAppelFromDraft("save");
  else if (action === "appel-rdv") saveAppelFromDraft("rdv");
  else if (action === "appel-intervention") saveAppelFromDraft("intervention");
  else if (action === "appel-save") saveAppelFromDraft("sans_suite");
  else if (action === "delete") {
    if (confirm("Supprimer définitivement cette fiche ?")) { await DB.deleteIntervention(nav.dataset.id); go("#/"); }
  }
});

async function openDocument(id) {
  const doc = await DB.getRaw("documents", id);
  if (!doc || !doc.data_url) { toast("Document introuvable", true); return; }
  const a = document.createElement("a");
  a.href = doc.data_url;
  a.download = doc.nom || "document.pdf";
  a.target = "_blank";
  a.click();
}

async function exportData() {
  const data = await DB.exportAll();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `climat-elec-sauvegarde-${todayISO()}.json`;
  a.click();
  toast("Sauvegarde exportée");
}

function fmtDateShort(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}
function fmtStampShort(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}
function fmtDateShortLong(iso) {
  if (!iso) return "-";
  return new Date(iso + "T00:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
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
    try { await Supabase.signInWithMagicLink(email); toast("Lien envoyé — ouvrez le lien sur ce téléphone"); }
    catch (err) { console.error(err); toast("Erreur : " + (err.message || "envoi impossible"), true); }
    finally { btn.disabled = false; }
  });
  $("#btn-password").addEventListener("click", async () => {
    const email = $("#auth-email").value.trim();
    const password = $("#auth-pass").value;
    if (!email || !password) { toast("Renseignez e-mail et mot de passe", true); return; }
    localStorage.setItem("ce_auth_email", email);
    const btn = $("#btn-password"); btn.disabled = true;
    try { await Supabase.signInWithPassword(email, password); toast("Connecté"); go("#/"); }
    catch (err) { console.error(err); toast("Identifiants invalides", true); }
    finally { btn.disabled = false; }
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
        <div class="kv"><div class="k">Rôle</div><div class="v">${esc(currentRole())}</div></div>
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
      <div class="card"><div class="block-text">Sauvegardez manuellement l'intégralité de vos données (clients, interventions, équipements, pièces, appels, rendez-vous, mesures, photos, documents, contrats) au format JSON.</div></div>
      <button class="btn btn-ghost" data-nav="export" style="margin-top:12px;">${ICONS.down} Exporter toutes les données</button>

      ${state.auth ? `<button class="btn btn-ghost" data-nav="logout" style="margin-top:12px;color:var(--ce-danger);">Se déconnecter</button>` : ""}
    </main>
    <div class="toast" id="toast"></div>
  `);

  $("#btn-save-name")?.addEventListener("click", async () => {
    const name = $("#acct-name").value.trim();
    try { await Supabase.updateProfile(name); if (state.auth?.profile) state.auth.profile.full_name = name; toast("Nom enregistré"); }
    catch (err) { console.error(err); toast("Erreur d'enregistrement", true); }
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
    toast("Erreur de synchronisation — nouvel essai automatique", true);
    scheduleSyncRetry();
  }
}

let _retryTimer = null;
function scheduleSyncRetry(delay = 5000) {
  if (_retryTimer) return;
  _retryTimer = setTimeout(async () => {
    _retryTimer = null;
    if (!navigator.onLine) return;
    try {
      await Sync.pushAllLocal();
      await Sync.runSync();
      toast("Synchronisation réussie");
      if (window.location.hash === "#/account") await renderAccount();
      else await renderHome();
    } catch (err) {
      console.warn("Nouvel essai de synchronisation échoué", err);
      scheduleSyncRetry(Math.min(delay * 2, 30000));
    }
  }, delay);
}

// ---------------------------------------------------------
// Init
// ---------------------------------------------------------
window.addEventListener("online", updateOfflinePill);
window.addEventListener("offline", updateOfflinePill);

async function init() {
  await DB.init();
  initSupabase();
  if (Supabase.configured()) {
    Supabase.onAuthChange(async (event, session) => {
      if (session?.user) {
        const pro = await Supabase.getProfile(session.user.id).catch(() => null);
        state.auth = { user: session.user, profile: pro };
        Sync.initRealtime();
        if (event === "SIGNED_IN" || event === "INITIAL_SESSION") await Sync.pushAllLocal();
        await Sync.runSync().catch((e) => {
          console.warn("Sync échec (nouvel essai automatique)", e);
          toast("Synchronisation en attente de réseau", true);
          scheduleSyncRetry();
        });
      } else {
        state.auth = null;
      }
      if (window.location.hash === "#/login") await renderHome();
      else await route();
    });
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).then((reg) => {
      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) window.location.reload();
        });
      });
      const checkForUpdates = () => reg.update().catch(() => {});
      checkForUpdates();
      window.addEventListener("focus", checkForUpdates);
      document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") checkForUpdates(); });
    }).catch((err) => console.warn("SW registration failed", err));
  }
  await route();
}
init();
