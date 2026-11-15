/* js/helpers.js — utilitaires. Extrait d'app.js (BP-03) : script classique, portée globale partagée ;
   chargé avant app.js dans l'ordre de index.html. */
// ---------------------------------------------------------
// Utils
// ---------------------------------------------------------
function $(sel, root = document) { return root.querySelector(sel); }
function $all(sel, root = document) { return [...root.querySelectorAll(sel)]; }
// esc() / html`…` : voir utils.js (BP-03).
// BP-03 : liste des intervenants issue de `profiles` (state.team) — plus de noms
// codés en dur ; repli historique tant qu'aucun profil n'est connu. La valeur déjà
// enregistrée sur la fiche reste toujours sélectionnable.
function intervenantOptions(current, { withEmpty = false } = {}) {
  const names = intervenantsFromProfiles(state.team);
  if (current && !names.includes(current)) names.unshift(current);
  const opts = names.map((t) => html`<option value="${t}" ${current === t ? "selected" : ""}>${t}</option>`);
  const empty = withEmpty ? html`<option value="" ${current ? "" : "selected"}>Non affecté</option>` : "";
  return html`${empty}${opts}`.toString();
}
function todayISO() { return new Date().toISOString().slice(0, 10); }
function nowHM() { const d = new Date(); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; }

// Un toast affiché juste avant un changement d'écran est effacé par le rendu suivant : flashToast() le garde
// en attente et l'affiche sur l'écran d'arrivée (voir setApp).
function flashToast(msg) {
  state.flash = msg;
}
function toast(msg, isError) {
  let el = $("#toast");
  el.innerHTML = `${isError ? "" : ICONS.check}<span>${esc(msg)}</span>`;
  el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("show"), 2600);
}

// SEC-09 : moindre privilège. Ordre de résolution du rôle (connecté) :
//   1. profil chargé depuis le serveur ;
//   2. dernier rôle CONNU de ce compte sur cet appareil (cache `_meta`, validité
//      30 jours) — c'est ce qui laisse un manager travailler hors ligne ;
//   3. sinon « inconnu » : AUCUN accès (écran « Profil non chargé »), jamais un
//      rôle par défaut. Le serveur reste l'autorité (RLS) : le cache ne donne
//      que l'affichage, pas les droits.
// Non connecté (mode local V1) : usage local inchangé, jamais manager.
const ROLES_ACTIFS = ["responsable", "technicien", "secretaire", "developpeur"];
const ROLE_CACHE_MAX_AGE_MS = 30 * 24 * 3600 * 1000;
function currentRole() {
  if (!state.auth) return "technicien";
  return state.auth.profile?.role || state.auth.cachedRole || "inconnu";
}
function isManager() { return !!state.auth && ["responsable", "secretaire", "developpeur"].includes(currentRole()); }
// SEC-05 : membre actif (rôle validé par le responsable). Hors connexion
// (mode local) l'usage local reste possible ; connecté, `en_attente` et
// `inconnu` n'ont accès à rien.
function isMember() { return !state.auth || ROLES_ACTIFS.includes(currentRole()); }

async function cacheRole(userId, role) {
  try { await DB.setMeta("ce_role_cache", { uid: userId, role, at: Date.now() }); } catch (e) { /* cache indisponible : pas bloquant */ }
}
async function loadCachedRole(userId) {
  try {
    const c = await DB.getMeta("ce_role_cache");
    if (c && c.uid === userId && ROLES_ACTIFS.concat("en_attente").includes(c.role) && Date.now() - c.at < ROLE_CACHE_MAX_AGE_MS) return c.role;
  } catch (e) { /* ignoré */ }
  return null;
}
// Charge le profil du compte connecté. Distingue « profil absent côté serveur »
// (= en_attente : le serveur applique le même repli) d'un ÉCHEC de lecture
// (réseau) pour lequel on retombe sur le dernier rôle connu.
async function loadAuthProfile(user) {
  let profile = null, failed = false;
  try { profile = await Supabase.getProfile(user.id); } catch (e) { failed = true; }
  if (!failed && !profile) profile = { id: user.id, full_name: "", role: "en_attente" };
  if (profile?.role) await cacheRole(user.id, profile.role);
  const cachedRole = profile?.role ? null : await loadCachedRole(user.id);
  return { profile, cachedRole };
}
// Workflow 4 statuts : validation et facturation = managers
// (responsable / secrétaire / developpeur).
function canValidate() { return isManager(); }
// Rouverture d'un dossier Terminé : responsable uniquement
// (developpeur toléré pour les tests). SEC-09 : hors session, aucun droit.
function canReopen() { return !!state.auth && ["responsable", "developpeur"].includes(currentRole()); }

// COH-06 : miroir CLIENT des transitions autorisées (confort d'affichage et
// message clair). L'AUTORITÉ est le trigger serveur `enforce_statut_dossier_workflow`
// (refus 42501 en synchronisation) — ce contrôle ne protège rien à lui seul.
function canTransition(from, to) {
  if (from === "brouillon" && to === "a_valider") return isMember();
  if (from === "a_valider" && (to === "a_facturer" || to === "brouillon")) return canValidate();
  if (from === "a_facturer" && to === "a_valider") return canValidate();
  if (from === "a_facturer" && to === "termine") return canValidate();
  if (from === "termine" && to === "brouillon") return canReopen();
  return false;
}

// Résout le nom d'intervenant (texte) vers l'uuid du profil, pour que la
// RLS serveur (technicien_id = auth.uid()) laisse le bon technicien
// récupérer son rendez-vous en synchronisation.
function resolveTechId(name) {
  if (!name) return null;
  const n = name.trim().toLowerCase();
  const match = (state.team || []).find((p) => {
    const fn = (p.full_name || "").trim().toLowerCase();
    if (!fn) return false;
    const parts = fn.split(/\s+/).filter(Boolean);
    return fn === n || (parts[0] || "") === n || parts.includes(n);
  });
  return match ? match.id : null;
}

// Résout le nom complet d'un technicien affecté à un rendez-vous
// (via technicien_id, sinon via le prénom affiché), pour pré-remplir
// le champ « Nom du technicien » de la fiche. Retourne le texte tel quel
// si aucun profil ne correspond (fallback sur l'intervenant).
function resolveTechFullName(technicienId, intervenant) {
  if (technicienId) {
    const p = (state.team || []).find((x) => x.id === technicienId);
    if (p && p.full_name) return p.full_name;
  }
  if (!intervenant) return "";
  const n = intervenant.trim().toLowerCase();
  const match = (state.team || []).find((p) => {
    const fn = (p.full_name || "").trim().toLowerCase();
    if (!fn) return false;
    const parts = fn.split(/\s+/).filter(Boolean);
    return fn === n || (parts[0] || "") === n || parts.includes(n);
  });
  return match ? match.full_name : intervenant.trim();
}

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
    temps_intervention: "",
    statut: type === "intervention" ? "a_prevoir" : "terminee",
    statut_dossier: null,
    motif_retour: "", // workflow 4 statuts : préservé tant que le dossier reste brouillon
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
    page_ok: false, // « Page ok » (§3.2.14, arb. 6.9) — indicateur de complétude calculé, persisté
    technicien_nom: localStorage.getItem("ce_technicien_nom") || state.auth?.profile?.full_name || "",
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
    // SYNC-01 : version serveur vue à l'ouverture (base du push conditionnel).
    // Absente si la copie locale a des modifications non poussées (synced_at null) :
    // la base de la file de synchronisation prévaut alors.
    ...(itv.synced_at ? { _base_updated_at: itv.synced_at } : {}),
    client_id: itv.client_id,
    type_intervention: itv.type_intervention,
    type_entretien: itv.type_entretien || "",
    type_entretien_detail: itv.type_entretien_detail || "",
    date: itv.date,
    heure_arrivee: itv.heure_arrivee,
    heure_depart: itv.heure_depart,
    forfait_deplacement: itv.forfait_deplacement,
    temps_intervention: itv.temps_intervention || "",
    statut: itv.statut || "a_prevoir",
    statut_dossier: itv.statut_dossier || null,
    motif_retour: itv.motif_retour || "",
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
    page_ok: itv.page_ok || false,
    technicien_nom: itv.technicien_nom || "",
    client_present: itv.client_present !== false,
    client_signature_nom: itv.client_signature_nom || "",
    client_signature_url: itv.client_signature_url || null,
    technicien_signature_url: itv.technicien_signature_url || null,
  });
  const client = itv.client_id ? await DB.getClient(itv.client_id) : itv.client;
  d.client = { id: client?.id, nom: client?.nom || "", adresse: client?.adresse || "", code_postal: client?.code_postal || "", ville: client?.ville || "", mail: client?.mail || "", tel: client?.tel || "", type_batiment: client?.type_batiment || "" };
  if (!d.client_id) d.client_id = client?.id || null;
  // Refonte 18/09 : migration douce des anciens libellés d'entretien
  // (« Air/Eau (aérothermie) » / « Sol/Eau (géothermie) ») vers la liste cible.
  const etm = ENTRETIEN_META[state.draftType];
  if (etm && d.type_entretien_detail && !etm.types.includes(d.type_entretien_detail)) {
    const legacyMapping = { "Air/Eau (aérothermie)": "Aérothermie", "Sol/Eau (géothermie)": "Géothermie" };
    const mapped = legacyMapping[d.type_entretien_detail];
    if (mapped && etm.types.includes(mapped)) d.type_entretien_detail = mapped;
  }
  state.draft = d;
  state.step = 1;
}

