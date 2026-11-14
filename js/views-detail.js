/* js/views-detail.js — détail d'une fiche, workflow, documents. Extrait d'app.js (BP-03) : script classique, portée globale partagée ;
   chargé avant app.js dans l'ordre de index.html. */
// ---------------------------------------------------------
// DÉTAIL + WORKFLOW + DOCUMENTS
// ---------------------------------------------------------
async function renderDetail(id) {
  const itv = await DB.getIntervention(id);
  if (!itv) { go("#/"); return; }
  const client = itv.client_id ? await DB.getClient(itv.client_id) : itv.client;
  const meta = itv.type_entretien ? ENTRETIEN_META[itv.type_entretien] : null;
  const label = meta ? meta.label : (itv.type_intervention || "-");
  // Workflow 4 statuts : seul un brouillon est modifiable (les fiches de
  // l'ancien workflow sans statut conservent leur éditabilité).
  const statutNorm = DB.normalizeStatut(itv.statut_dossier);
  const canEditItv = !statutNorm || statutNorm === "brouillon";
  const fmtStampFull = (iso) => iso ? (new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })) : "";

  setApp(`
    <div class="topbar">
      <div class="topbar-row">
        <button class="back-btn" data-nav="back" aria-label="Retour">${ICONS.back}</button>
        <div><h1>${esc(client?.nom || "Détail")}</h1><div class="subtitle">${esc(label)}</div></div>
        <div class="topbar-actions">
          <button class="icon-btn" data-nav="duplicate" data-id="${itv.id}" title="Dupliquer" aria-label="Dupliquer">${ICONS.copy}</button>
          ${canEditItv ? `<button class="icon-btn" data-nav="edit" data-id="${itv.id}" title="Modifier" aria-label="Modifier">${ICONS.pencil}</button>` : ""}
          <button class="icon-btn" data-nav="delete" data-id="${itv.id}" title="Supprimer" aria-label="Supprimer">${ICONS.trash}</button>
        </div>
      </div>
    </div>
    <main>
      <div class="detail-header">
        <div class="meta">${itv.numero
          ? `${esc(itv.numero)} · `
          : (Supabase.configured() ? "n° à la synchronisation · " : "")
        }${fmtDateShortLong(itv.date)}</div>
        <div class="ii-tags" style="margin-top:10px;">
          <span class="tag ${statutDossierCls(itv.statut_dossier)}">${statutDossierLabel(itv.statut_dossier)}</span>
          <span class="tag ${interventionStatutCls(itv.statut)}">${interventionStatutLabel(itv.statut)}</span>
          ${itv.devis_souhaite ? `<span class="tag">Devis souhaité</span>` : ""}
          ${itv.prochaine_intervention_prevue ? `<span class="tag">Prochaine intervention prévue</span>` : ""}
          ${itv.page_ok ? `<span class="tag">Page ok</span>` : ""}
        </div>
        ${itv.motif_retour && ["brouillon", "a_valider"].includes(DB.normalizeStatut(itv.statut_dossier)) ? `<div class="banner-motif" style="margin-top:10px;background:var(--ce-pending-bg);color:var(--ce-pending);border-radius:var(--ce-radius-sm);padding:10px 12px;font-size:13px;">${DB.normalizeStatut(itv.statut_dossier) === "a_valider" ? "Repassé à valider" : "Renvoyé"} : ${esc(itv.motif_retour)}</div>` : ""}
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
        ${(itv.valide_le || itv.facture_le) ? `<div class="kv"><div class="k">Traçabilité</div><div class="v">${[
          itv.valide_le ? `Validée le ${fmtStampFull(itv.valide_le)}${itv.valide_par && resolveTechFullName(itv.valide_par) ? ` par ${esc(resolveTechFullName(itv.valide_par))}` : ""}` : "",
          itv.facture_le ? `Facturée le ${fmtStampFull(itv.facture_le)}${itv.facture_par && resolveTechFullName(itv.facture_par) ? ` par ${esc(resolveTechFullName(itv.facture_par))}` : ""}` : "",
        ].filter(Boolean).join(" · ")}</div></div>` : ""}
      </div>
      <div id="dossier-history"></div>

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
    <input type="file" id="doc-devis-input" accept="application/pdf" style="display:none;" />
  `);

  $("#btn-pdf").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.innerHTML = `${ICONS.file} Génération du PDF…`;
    try { await downloadInterventionPDF(itv, client); toast("PDF prêt"); }
    catch (err) { ErrorLog.error(err); toast("Erreur lors de la génération du PDF", true); }
    finally { btn.disabled = false; btn.innerHTML = `${ICONS.share} Générer et partager le PDF`; }
  });

  $("#doc-devis-input").addEventListener("change", () => importDocument(itv.id, "devis", $("#doc-devis-input")));
  loadDossierHistory(itv.id);
}

// IMP-01 : historique des changements de statut (journal serveur, lecture
// seule). Consultatif et en ligne seulement : jamais bloquant pour l'écran.
const STATUT_LABELS = { brouillon: "Brouillon", a_valider: "À valider", a_facturer: "À facturer", termine: "Terminé" };
async function loadDossierHistory(id) {
  const box = $("#dossier-history");
  if (!box || !navigator.onLine || !state.auth || !isMember() || !Supabase.configured()) return;
  let events;
  try { events = await Supabase.listDossierEvents(id); } catch (e) { return; }
  const box2 = $("#dossier-history"); // l'écran a pu changer pendant l'attente
  if (!box2 || !events.length) return;
  const when = (iso) => new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  box2.innerHTML = `
    <div class="section-label">Historique du dossier</div>
    <div class="card">
      ${events.map((ev) => {
        const who = resolveTechFullName(ev.actor_id) || ROLE_LABELS[ev.actor_role] || "Système";
        const step = ev.from_statut ? `${STATUT_LABELS[ev.from_statut] || ev.from_statut} → ${STATUT_LABELS[ev.to_statut] || ev.to_statut}` : `Créé (${STATUT_LABELS[ev.to_statut] || ev.to_statut})`;
        return `<div class="kv"><div class="k">${esc(when(ev.created_at))}</div><div class="v">${esc(step)} · ${esc(who)}${ev.motif ? `<br><span style="font-size:12px;opacity:.8;">${esc(ev.motif)}</span>` : ""}</div></div>`;
      }).join("")}
    </div>`;
}

function documentsHTML(itv) {
  const docs = itv.documents || [];
  if (!docs.length) return `<div class="card"><div class="block-text">Aucun document. Importez le devis produit par votre logiciel externe.</div></div>`;
  // « Facture » : libellé conservé pour d'éventuels documents historiques
  // (consultation / suppression possibles, plus d'ajout).
  return docs.map((doc) => `
    <div class="kv">
      <div class="k">${doc.type === "devis" ? "Devis" : doc.type === "facture" ? "Facture" : "Contrat"}</div>
      <div class="v" style="flex:1;">${esc(doc.nom || "-")}${doc.numero_externe ? ` · ${esc(doc.numero_externe)}` : ""}</div>
      <button class="icon-btn" style="margin-left:auto;background:#eef2f4;color:var(--ce-navy);" data-nav="open-doc" data-id="${doc.id}" aria-label="Ouvrir le document" title="Ouvrir le document">${ICONS.file}</button>
      <button class="icon-btn" style="margin-left:6px;background:#eef2f4;color:var(--ce-danger);" data-nav="del-doc" data-id="${doc.id}" aria-label="Supprimer le document" title="Supprimer le document">${ICONS.trash}</button>
    </div>`).join("");
}

function workflowButtonsHTML(itv) {
  const actions = workflowActions(itv);
  return `
  <div class="wf-actions">
    <button class="btn btn-ghost" data-nav="import-devis" data-id="${itv.id}">${ICONS.upload} Importer le devis (PDF)</button>
    ${actions.map((a) => `<button class="btn ${a.kind === "accent" ? "btn-accent" : "btn-primary"}" data-nav="wf" data-id="${itv.id}" data-to="${a.to}" style="margin-top:9px;">${ICONS.check} ${a.label}</button>`).join("")}
  </div>`;
}

// Modale « motif » (renvoi en brouillon / rouverture d'un dossier) : saisie
// libre et facultative, style réutilisé de la modale de signature
// (.sig-overlay / .sig-modal). Résout null (Annuler) ou le texte nettoyé
// (trim, lignes vides) via le nettoyage existant `cleanText`.
function askMotif(title = "Motif (facultatif)", required = false) {
  return new Promise((resolve) => {
    const ov = document.createElement("div");
    ov.className = "sig-overlay";
    ov.innerHTML = `
      <div class="sig-modal">
        <div class="sig-head"><h3>${esc(title)}</h3><button class="icon-btn motif-close" aria-label="Fermer" title="Fermer">${ICONS.close}</button></div>
        <textarea id="motif-textarea" rows="4" placeholder="${required ? "Motif obligatoire" : "Précisez le motif si besoin (facultatif)"}" style="width:100%;box-sizing:border-box;padding:10px;border:1px solid var(--ce-border);border-radius:var(--ce-radius-sm);font:inherit;resize:vertical;"></textarea>
        <div class="sig-actions" style="margin-top:12px;">
          <button class="btn btn-ghost motif-cancel">Annuler</button>
          <button class="btn btn-primary motif-confirm">Confirmer</button>
        </div>
      </div>`;
    document.body.appendChild(ov);
    const ta = ov.querySelector("#motif-textarea");
    ta.focus();
    const close = (val) => { ov.remove(); resolve(val); };
    ov.querySelector(".motif-close").addEventListener("click", () => close(null));
    ov.querySelector(".motif-cancel").addEventListener("click", () => close(null));
    ov.querySelector(".motif-confirm").addEventListener("click", () => {
      const v = cleanText(ta.value || "");
      if (required && !v) { ta.style.borderColor = "var(--ce-danger, #c0392b)"; ta.focus(); return; }
      close(v);
    });
    ov.addEventListener("click", (e) => { if (e.target === ov) close(null); });
  });
}

async function importDocument(interventionId, type, inputEl) {
  const file = inputEl.files[0];
  inputEl.value = "";
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) { toast("Fichier trop volumineux (max 10 Mo)", true); return; }
  const dataUrl = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(file); });
  const doc = { type, nom: file.name, data_url: dataUrl, numero_externe: "" };
  // Upload du PDF vers Supabase Storage (bucket privé « documents »).
  // Le dataURL local est conservé pour l'affichage offline-first.
  if (Supabase.configured() && state.auth && navigator.onLine) {
    try {
      doc.fichier_url = await Supabase.uploadDocument(interventionId, dataUrl);
    } catch (e) { ErrorLog.warn("Upload document échoué", e); }
  }
  await DB.addDocument(interventionId, doc);
  toast(type === "devis" ? "Devis importé" : "Document importé");
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

