/* js/state.js — état de l'application et brouillon de wizard (BP-01). Extrait d'app.js (BP-03) : script classique, portée globale partagée ;
   chargé avant app.js dans l'ordre de index.html. */
// ---------------------------------------------------------
// State
// ---------------------------------------------------------
let state = {
  view: "home",
  tab: "dashboard",      // dashboard | planning | taches | clients (défaut : Tableau de bord, §3.2.15)
  draft: null,
  draftType: "intervention", // intervention | air_eau | air_air | chaudiere | solaire (préparation 09/10)
  step: 1,
  homeSearch: "",
  clientSearch: "",
  planFilter: { type: "", intervenant: "" },
  tachesFilter: { type: "", intervenant: "" },
  dashFilter: { type: "", intervenant: "" }, // filtres type / intervenant du Tableau de bord
  dashSort: "",          // tri du Tableau de bord : "" (date récente) | nom | cp | ville (arb. 6.12)
  dossiersOpen: {},      // sections dépliées du Tableau de bord (clé = "dash:<statut>" ou "dash:appels")
  clientsCache: [],
  auth: null,
  team: [],
  sync: { pending: 0, conflicts: 0, errors: 0 },
  updateAvailable: false,   // BP-01 : nouvelle version du SW prête, reload à la demande
  wizardDraftPending: false, // BP-01 : un brouillon de wizard attend d'être repris
};

// ---------------------------------------------------------
// Brouillon de wizard — persistance IndexedDB (BP-01)
// Le brouillon est sauvegardé dans _meta (clé "ce_wizard_draft") à chaque
// changement d'étape et à la fermeture de l'onglet, puis restauré au démarrage.
let draftPersistTimer = null;
let updateBannerEl = null;

function persistDraft(immediate = false) {
  if (!state.draft) return;
  if (draftPersistTimer) clearTimeout(draftPersistTimer);
  const payload = {
    draft: state.draft,
    draftType: state.draftType,
    step: state.step,
    updatedAt: new Date().toISOString(),
  };
  const save = () => DB.setMeta("ce_wizard_draft", JSON.stringify(payload)).catch(() => {});
  if (immediate) save();
  else draftPersistTimer = setTimeout(save, 800);
}

function clearPersistedDraft() {
  if (draftPersistTimer) { clearTimeout(draftPersistTimer); draftPersistTimer = null; }
  DB.setMeta("ce_wizard_draft", null).catch(() => {});
}

let draftResumeEl = null;
function showDraftResumeBanner() {
  if (draftResumeEl) return;
  const stepLabel = state.draftType === "intervention"
    ? "intervention"
    : (ENTRETIEN_META[state.draftType]?.label || "entretien");
  draftResumeEl = document.createElement("div");
  draftResumeEl.className = "banner resume";
  draftResumeEl.style = "background:var(--ce-pending-bg);color:var(--ce-pending);border:1px solid var(--ce-pending);border-radius:8px;padding:10px 14px;margin:10px;text-align:center;font-size:14px;";
  draftResumeEl.innerHTML = `
    Brouillon de ${esc(stepLabel)} en cours (saisie non terminée).
    <button id="btn-resume-draft" style="margin-left:8px;padding:6px 12px;background:var(--ce-pending);color:#fff;border:none;border-radius:6px;cursor:pointer;">Reprendre</button>
    <button id="btn-dismiss-draft" style="margin-left:6px;padding:6px 12px;background:#fff;border:1px solid var(--ce-pending);border-radius:6px;cursor:pointer;">Ignorer</button>
  `;
  document.body.insertBefore(draftResumeEl, document.body.firstChild);
  $("#btn-resume-draft")?.addEventListener("click", () => {
    hideDraftResumeBanner();
    state.wizardDraftPending = false;
    if (state.draftType === "intervention") go(`#/new/${state.step || 1}`);
    else go(`#/entretien/${state.draftType}/${state.step || 1}`);
  });
  $("#btn-dismiss-draft")?.addEventListener("click", () => {
    hideDraftResumeBanner();
    state.wizardDraftPending = false;
    clearPersistedDraft();
    state.draft = null;
  });
}
function hideDraftResumeBanner() {
  if (draftResumeEl) { draftResumeEl.remove(); draftResumeEl = null; }
}
function showUpdateBanner() {
  if (updateBannerEl) return;
  updateBannerEl = document.createElement("div");
  updateBannerEl.className = "banner update";
  updateBannerEl.style = "background:var(--ce-success-bg);color:var(--ce-success);border:1px solid var(--ce-success);border-radius:8px;padding:10px 14px;margin:10px;text-align:center;font-size:14px;";
  updateBannerEl.innerHTML = `
    Une mise à jour de l'application est disponible.
    <button id="btn-apply-update" style="margin-left:8px;padding:6px 12px;background:var(--ce-blue);color:#fff;border:none;border-radius:6px;cursor:pointer;">Actualiser</button>
  `;
  document.body.insertBefore(updateBannerEl, document.body.firstChild);
  $("#btn-apply-update")?.addEventListener("click", () => {
    hideUpdateBanner();
    state.updateAvailable = false;
    window.location.reload();
  });
}
function hideUpdateBanner() {
  if (updateBannerEl) { updateBannerEl.remove(); updateBannerEl = null; }
}

