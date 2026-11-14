/* js/nav-events.js — délégation globale des événements de navigation. Extrait d'app.js (BP-03) : script classique, portée globale partagée ;
   chargé avant app.js dans l'ordre de index.html. */
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
  else if (action === "client-open") go(`#/client/${nav.dataset.id}`);
  else if (action === "edit") {
    if (state.draft && state.draft.id !== nav.dataset.id) state.draft = null;
    goReplace(`#/edit/${nav.dataset.id}`);
  }
  else if (action === "duplicate") duplicateIntervention(nav.dataset.id);
  else if (action === "wf") {
    const id = nav.dataset.id;
    const to = nav.dataset.to;
    // COH-06 : contrôle de rôle et de transition avant toute écriture locale
    // (le serveur refuserait de toute façon la synchronisation : mieux vaut
    // le dire tout de suite que laisser un élément en erreur dans la file).
    const cur = await DB.getIntervention(id);
    if (!canTransition(DB.normalizeStatut(cur?.statut_dossier), to)) {
      toast("Action non autorisée pour votre rôle ou pour l'état actuel du dossier", true);
      return;
    }
    const from = DB.normalizeStatut(cur?.statut_dossier);
    // « Soumettre pour validation » (§3.2.14) : impossible tant que la fiche
    // n'est pas signée (technicien + client si présent). Ne s'applique pas à la
    // dévalidation (a_facturer → a_valider) : la fiche est déjà signée.
    if (to === "a_valider" && from === "brouillon") {
      const fiche = await DB.getIntervention(id);
      if (!fiche || !fiche.technicien_signature_url || (fiche.client_present !== false && !fiche.client_signature_url)) {
        toast("La fiche doit être signée (technicien + client si présent) avant d'être soumise pour validation", true);
        return;
      }
    }
    // Workflow 4 statuts : `extra` porte la traçabilité poussée vers Supabase
    // (valide_par/valide_le, facture_par/facture_le, motif_retour).
    const now = new Date().toISOString();
    let extra = {};
    if (to === "a_valider" && from === "a_facturer") {
      // Dévalidation : motif OBLIGATOIRE (exigé aussi par le serveur) ; la trace
      // de validation est effacée, le dossier devra être re-validé.
      const motif = await askMotif("Motif du retour à valider (obligatoire)", true);
      if (!motif) return; // Annulé — aucun changement
      extra = { motif_retour: motif, valide_par: null, valide_le: null };
    } else if (to === "a_valider") {
      extra = { motif_retour: null };
    } else if (to === "a_facturer") {
      extra = { valide_par: state.auth?.user?.id ?? null, valide_le: now };
    } else if (to === "termine") {
      extra = { facture_par: state.auth?.user?.id ?? null, facture_le: now };
    } else if (to === "brouillon") {
      // Renvoyer en brouillon / rouvrir : motif libre et facultatif.
      const motif = await askMotif();
      if (motif === null) return; // Annulé — aucun changement
      extra = {
        motif_retour: motif,
        valide_par: null, valide_le: null,
        facture_par: null, facture_le: null,
      };
    }
    await DB.setStatutDossier(id, to, extra);
    toast("Statut mis à jour");
    await renderDetail(id);
  }
  else if (action === "import-devis") { $("#doc-devis-input").click(); }
  else if (action === "open-doc") { openDocument(nav.dataset.id); }
  else if (action === "del-doc") {
    if (confirm("Supprimer ce document ?")) { await DB.deleteDocument(nav.dataset.id); await renderDetail(state.draft?.id || location.hash.split("/")[2]); }
  }
  else if (action === "back") { if (window.history.length > 1) window.history.back(); else go("#/"); }
  else if (action === "cancel") { clearPersistedDraft(); state.draft = null; goReplace("#/"); }
  else if (action === "prev") { if (state.step > 1) { readStepIntoDraft(state.step); if (state.draftType === "intervention") goReplace(`#/new/${state.step - 1}`); else goReplace(`#/entretien/${state.draftType}/${state.step - 1}`); } }
  else if (action === "next") { if (readStepIntoDraft(state.step)) { if (state.draftType === "intervention") goReplace(`#/new/${state.step + 1}`); else goReplace(`#/entretien/${state.draftType}/${state.step + 1}`); } }
  else if (action === "finish") finishWizard();
  else if (action === "brouillon") saveBrouillon();
  else if (action === "export") exportData();
  else if (action === "import") $("#import-file").click();
  else if (action === "account") go("#/account");
  else if (action === "login") go("#/login");
  else if (action === "logout") signOutUser();
  else if (action === "reload-profile") reloadProfile();
  else if (action === "privacy") go("#/privacy");
  else if (action === "stats") go("#/stats");
  else if (action === "sync-now") runSyncNow();
  else if (action === "force-resend") forceResendAll();
  else if (action === "conflict-keep-local") resolveConflictAction(nav.dataset.store, nav.dataset.id, true);
  else if (action === "conflict-keep-remote") resolveConflictAction(nav.dataset.store, nav.dataset.id, false);
  else if (action === "sync-retry-failed") retryFailedAction(nav.dataset.store, nav.dataset.id);         // SYNC-03
  else if (action === "sync-discard-failed") discardFailedAction(nav.dataset.store, nav.dataset.id);    // SYNC-03
  else if (action === "errorlog-copy") {                                                                     // BP-06
    const txt = ErrorLog.toText();
    try { await navigator.clipboard.writeText(txt); toast("Journal copié"); }
    catch (e) { toast("Copie impossible — sélectionnez le texte à la main", true); }
  }
  else if (action === "errorlog-clear") { await ErrorLog.clear(); await renderAccount(); }                   // BP-06
  else if (action === "appel-edit") go(`#/appel/${nav.dataset.id}`);
  else if (action === "appel-delete") {
    if (confirm("Supprimer cet appel ?")) { await DB.deleteAppel(nav.dataset.id); toast("Appel supprimé"); go("#/"); }
  }
  else if (action === "appel-update") saveAppelFromDraft("save");
  else if (action === "appel-rdv") saveAppelFromDraft("rdv");
  else if (action === "appel-intervention") saveAppelFromDraft("intervention");
  else if (action === "appel-save") saveAppelFromDraft("sans_suite");
  else if (action === "contrat-edit") go(`#/contrat/${nav.dataset.id}`);
  else if (action === "contrat-delete") {
    if (confirm("Supprimer ce contrat ?")) { await DB.deleteContrat(nav.dataset.id); toast("Contrat supprimé"); go("#/contrats"); }
  }
  else if (action === "rdv-edit") go(`#/rdv/${nav.dataset.id}`);
  else if (action === "rdv-intervention") await rdvToIntervention(nav.dataset.id);
  else if (action === "rdv-open-intervention") {
    const itv = await DB.getRaw("interventions", nav.dataset.id);
    if (itv && !itv._deleted && DB.normalizeStatut(itv.statut_dossier) === "brouillon") goReplace(`#/edit/${nav.dataset.id}`);
    else go(`#/detail/${nav.dataset.id}`);
  }
  else if (action === "rdv-unlink") {
    const r = await DB.getRaw("rendezvous", nav.dataset.id);
    await unlinkAppelFromRdv(r);
    if (r && r.appel_id) { r.appel_id = null; await DB.saveRendezvous(r); }
    toast("Rendez-vous détaché de l'appel");
    go(`#/rdv/${nav.dataset.id}`);
  }
  else if (action === "rdv-delete") {
    if (confirm("Supprimer ce rendez-vous ?")) {
      await unlinkAppelFromRdv(await DB.getRaw("rendezvous", nav.dataset.id));
      await DB.deleteRendezvous(nav.dataset.id);
      toast("Rendez-vous supprimé");
      state.tab = "planning";
      go("#/");
    }
  }
  else if (action === "delete") {
    if (confirm("Supprimer définitivement cette fiche ?")) {
      await unlinkAppelFromIntervention(nav.dataset.id);
      await unlinkRdvFromIntervention(nav.dataset.id);
      await DB.deleteIntervention(nav.dataset.id);
      go("#/");
    }
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

async function importData() {
  const file = $("#import-file").files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!data || typeof data !== "object") throw new Error("Format invalide");
    if (!confirm("Importer cette sauvegarde ? Les données locales existantes seront complétées/écrasées par celles du fichier.")) return;
    await DB.importAll(data);
    toast("Sauvegarde importée");
    if (window.location.hash === "#/account") await renderAccount();
    else await renderHome();
  } catch (err) {
    ErrorLog.error(err);
    toast("Import impossible — fichier invalide", true);
  }
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

