/* js/presence.js — présence d'édition (PRES-01). Extrait d'app.js (BP-03) : script classique, portée globale partagée ;
   chargé avant app.js dans l'ordre de index.html. */
// ---------------------------------------------------------
// PRES-01 — présence d'édition (avertissement non bloquant)
// ---------------------------------------------------------
const Presence = { id: null, timer: null, others: [] };

function presenceAvailable() {
  return !!(state.auth && navigator.onLine && Supabase.configured());
}
async function presenceTick() {
  const id = Presence.id;
  if (!id || !presenceAvailable()) return;
  try {
    const rows = await Supabase.rpc("touch_fiche_presence", { p_intervention_id: id });
    if (Presence.id !== id) return; // wizard quitté pendant l'appel
    Presence.others = Array.isArray(rows) ? rows : [];
    renderPresenceBanner();
  } catch (e) {
    ErrorLog.warn("Présence d'édition indisponible", e); // jamais bloquant
  }
}
function startPresence(id) {
  if (!id || Presence.id === id) return;
  stopPresence();
  if (!presenceAvailable()) return;
  Presence.id = id;
  presenceTick();
  Presence.timer = setInterval(presenceTick, 60000);
}
function stopPresence() {
  const id = Presence.id;
  if (Presence.timer) clearInterval(Presence.timer);
  Presence.timer = null;
  Presence.id = null;
  Presence.others = [];
  renderPresenceBanner();
  if (id && presenceAvailable()) {
    Supabase.rpc("release_fiche_presence", { p_intervention_id: id }).catch(() => {});
  }
}
function renderPresenceBanner() {
  const el = $("#presence-banner");
  if (!el) return;
  if (!Presence.others.length) { el.innerHTML = ""; return; }
  const names = [...new Set(Presence.others.map((o) => o.o_user_name || "Un autre utilisateur"))];
  const secs = Math.min(...Presence.others.map((o) => o.o_seconds_ago || 0));
  const since = secs < 60 ? "à l'instant" : `il y a ${Math.round(secs / 60)} min`;
  el.innerHTML = `<div class="banner-motif" style="background:var(--ce-pending-bg);color:var(--ce-pending);border-radius:var(--ce-radius-sm);padding:10px 12px;font-size:13px;margin-top:8px;">⚠ ${esc(names.join(", "))} ${names.length > 1 ? "modifient" : "modifie"} aussi cette fiche (actif ${since}). Si vous enregistrez tous les deux, l'un des deux devra résoudre un conflit : mieux vaut vous coordonner.</div>`;
}
window.addEventListener("pagehide", () => { if (Presence.id) stopPresence(); });

// Workflow 4 statuts : seul un brouillon est modifiable. Entre l'ouverture du
// formulaire et l'enregistrement, la fiche a pu changer de statut (soumise ou
// validée depuis un autre appareil, copie locale mise à jour par la synchro) :
// on refuse alors d'enregistrer plutôt que de ramener la fiche en brouillon.
async function ensureStillDraft(d) {
  if (!d?.id) return true;
  const cur = await DB.getRaw("interventions", d.id).catch(() => null);
  const st = cur ? DB.normalizeStatut(cur.statut_dossier) : null;
  if (cur && st && st !== "brouillon") {
    toast(`Cette fiche n'est plus un brouillon (« ${statutDossierLabel(st)} ») : vos modifications ne peuvent pas être enregistrées`, true);
    return false;
  }
  return true;
}

async function finishWizard() {
  if (!readStepIntoDraft(state.step)) return;
  const d = state.draft;
  if (!(await ensureStillDraft(d))) return;
  const appelId = d.appel_id || null;
  const rdvId = d.rdv_id || null;
  const isEdit = !!d.id;

  // Fin d'intervention commune (§3.2.14) : la fiche doit être terminée et
  // signée — technicien obligatoire, client obligatoire si présent — pour
  // être soumise à la validation (brouillon → à valider).
  if (d.statut === "a_prevoir") {
    toast("La fiche doit être marquée « Effectuée » ou « Effectuée, suite à prévoir » pour être signée et soumise", true);
    return;
  }
  if (!d.technicien_signature_url) {
    toast("Signature du technicien obligatoire avant de soumettre la fiche", true);
    return;
  }
  if (d.client_present && !d.client_signature_url) {
    toast("Signature du client obligatoire (client présent)", true);
    return;
  }
  // Champs obligatoires de toutes les sections : vérifiés ici seulement
  // (jamais pendant la navigation, cf. arbitrage 6.9 — « Page ok »).
  const manquants = requiredFieldsMissing();
  if (manquants.length) {
    toast(`Fiche incomplète : ${manquants.join(", ")}`, true);
    return;
  }

  // Upload des signatures tactiles vers Supabase Storage (si configuré).
  if (Supabase.configured() && state.auth && navigator.onLine) {
    try {
      if (d.client_present && d._client_sig_blob) d.client_signature_url = await Supabase.uploadSignature(`sig-client-${uuid()}`, d._client_sig_blob);
      if (d._technicien_sig_blob) d.technicien_signature_url = await Supabase.uploadSignature(`sig-tech-${uuid()}`, d._technicien_sig_blob);
    } catch (e) { ErrorLog.warn("Upload signature échoué", e); }
  }

  // Upload des photos vers Supabase Storage (bucket privé « photos »).
  // On conserve le dataURL local (offline-first) et on renseigne en plus
  // `fichier_url` avec le chemin de l'objet stocké dans le bucket.
  if (Supabase.configured() && state.auth && navigator.onLine) {
    for (let i = 0; i < d.photos.length; i++) {
      const photo = d.photos[i];
      if (!photo || !photo.data_url || photo.fichier_url) continue;
      try {
        photo.fichier_url = await Supabase.uploadPhoto(d.id, photo.data_url);
      } catch (e) { ErrorLog.warn("Upload photo échoué", e); }
    }
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

  // Un brouillon finalisé repart en attente de validation (motif de renvoi
  // effacé à la soumission).
  if (!d.statut_dossier || d.statut_dossier === "brouillon") {
    d.statut_dossier = "a_valider";
    d.motif_retour = "";
  }

  const itv = { ...d };
  itv.client = { nom: savedClient.nom, ville: savedClient.ville };

  const saved = await DB.saveIntervention(itv);
  if (appelId) await linkAppelToIntervention(appelId, saved.id);
  if (rdvId) await linkRdvToIntervention(rdvId, saved.id);
  toast(isEdit ? "Fiche mise à jour" : "Fiche enregistrée");
  clearPersistedDraft(); // BP-01 : brouillon consommé
  state.draft = null;
  goReplace(`#/detail/${saved.id}`);
}

async function saveBrouillon() {
  // Capture best-effort de l'étape courante (un brouillon peut être incomplet).
  const steps = wizardSteps();
  const s = steps[state.step - 1];
  try {
    if (s.id === "client") captureClientFields();
    else if (s.read) s.read();
  } catch (e) { /* brouillon tolérant */ }
  const d = state.draft;
  if (!(await ensureStillDraft(d))) return;
  const appelId = d.appel_id || null;
  const rdvId = d.rdv_id || null;
  // Brouillon tolérant (arbitrage 6.9) : jamais bloqué — un client sans nom
  // est créé localement, les champs obligatoires seront contrôlés à la
  // validation finale (finishWizard).
  const savedClient = (d.client_id ? await DB.saveClient({ ...d.client }) : await DB.findOrCreateClientByName({ ...d.client }))
    || await DB.saveClient({ ...d.client });
  d.client_id = savedClient.id;
  d.client = savedClient;
  const itv = { ...d, _brouillon: true };
  itv.client = { nom: savedClient.nom, ville: savedClient.ville };
  const saved = await DB.saveIntervention(itv);
  if (appelId) await linkAppelToIntervention(appelId, saved.id);
  if (rdvId) await linkRdvToIntervention(rdvId, saved.id);
  toast("Brouillon enregistré");
  clearPersistedDraft(); // BP-01 : brouillon consommé
  state.draft = null;
  goReplace(`#/detail/${saved.id}`);
}

