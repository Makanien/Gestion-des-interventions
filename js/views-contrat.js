/* js/views-contrat.js — contrat d'entretien. Extrait d'app.js (BP-03) : script classique, portée globale partagée ;
   chargé avant app.js dans l'ordre de index.html. */
// ---------------------------------------------------------
// CONTRAT D'ENTRETIEN (US-24)
// ---------------------------------------------------------
async function renderContrat(id) {
  let c;
  if (id) {
    c = state.contratDraft = await DB.getContrat(id);
    if (!c) { go("#/contrats"); return; }
  } else {
    c = (state.contratDraft && !state.contratDraft.id)
      ? state.contratDraft
      : { id: null, client_id: null, nom: "", nb_passages: "1", tarification_zone_km: "", conditions_generales: "", signe_client: "", signe_technicien: "", client_signature_url: null, technicien_signature_url: null, numero: null };
    state.contratDraft = c;
  }
  const isEdit = !!c.id;
  setApp(`
    ${topbar({ title: isEdit ? "Modifier le contrat" : "Contrat d'entretien annuel", back: true, actions: isEdit ? `<button class="icon-btn" data-nav="contrat-delete" data-id="${c.id}" title="Supprimer" aria-label="Supprimer">${ICONS.trash}</button>` : "" })}
    <main>
      <div class="card" style="padding:14px;">
        <div class="field"><label>Client *</label><input id="ct-client" type="text" placeholder="Nom du client" value="${esc(c.nom || "")}" /></div>
        <div class="field"><label>Nombre de passages</label>
          <select id="ct-passages">${["1", "2", "3", "4"].map((n) => `<option ${c.nb_passages === n ? "selected" : ""}>${n}</option>`).join("")}</select>
        </div>
        <div class="field"><label>Tarification par zone / km</label><input id="ct-zone" type="text" value="${esc(c.tarification_zone_km)}" placeholder="Ex : Z2 — 25 €" /></div>
        <div class="field"><label>Conditions générales</label><textarea id="ct-cg" placeholder="Conditions générales du contrat…">${esc(c.conditions_generales)}</textarea></div>
      </div>
      <div class="section-label">Signatures</div>
      <div class="card" style="padding:14px;">
        <button type="button" class="add-line-btn" id="btn-ct-client-sign">${ICONS.pencil.replace('width="24" height="24"', 'width="15" height="15"')} Signer (client)</button>
        <div class="sig-preview" id="ct-client-preview" style="display:${c.client_signature_url ? "block" : "none"};margin-top:10px;"><img id="ct-client-img" src="${c.client_signature_url ? esc(c.client_signature_url) : ""}" alt="Signature client" /></div>
        <button type="button" class="add-line-btn" id="btn-ct-tech-sign" style="margin-top:10px;">${ICONS.pencil.replace('width="24" height="24"', 'width="15" height="15"')} Signer (technicien)</button>
        <div class="sig-preview" id="ct-tech-preview" style="display:${c.technicien_signature_url ? "block" : "none"};margin-top:10px;"><img id="ct-tech-img" src="${c.technicien_signature_url ? esc(c.technicien_signature_url) : ""}" alt="Signature technicien" /></div>
      </div>
      <button class="btn btn-accent" id="btn-save-contrat" style="margin-top:14px;">${ICONS.check} Enregistrer le contrat</button>
      ${isEdit ? `<button class="btn btn-primary" id="btn-pdf-contrat" style="margin-top:9px;">${ICONS.file} Générer le PDF du contrat</button>` : ""}
    </main>
    <div class="toast" id="toast"></div>
  `);
  $("#btn-ct-client-sign").addEventListener("click", async () => {
    const blob = await signatureModal({ title: "Signature du client" });
    if (!blob) return;
    const oldUrl = state.contratDraft.client_signature_url;
    state.contratDraft._client_sig_blob = blob;
    state.contratDraft.client_signature_url = await blobToDataURL(blob);
    const p = $("#ct-client-preview"); p.style.display = "block"; $("#ct-client-img").src = state.contratDraft.client_signature_url;
    if (Supabase.configured() && navigator.onLine && oldUrl && oldUrl.startsWith("http")) {
      try { await Supabase.removeSignature(oldUrl); } catch (e) { ErrorLog.warn("Suppression ancienne signature client échouée", e); }
    }
  });
  $("#btn-ct-tech-sign").addEventListener("click", async () => {
    const blob = await signatureModal({ title: "Signature du technicien" });
    if (!blob) return;
    const oldUrl = state.contratDraft.technicien_signature_url;
    state.contratDraft._technicien_sig_blob = blob;
    state.contratDraft.technicien_signature_url = await blobToDataURL(blob);
    const p = $("#ct-tech-preview"); p.style.display = "block"; $("#ct-tech-img").src = state.contratDraft.technicien_signature_url;
    if (Supabase.configured() && navigator.onLine && oldUrl && oldUrl.startsWith("http")) {
      try { await Supabase.removeSignature(oldUrl); } catch (e) { ErrorLog.warn("Suppression ancienne signature technicien échouée", e); }
    }
  });
  $("#btn-save-contrat").addEventListener("click", async () => {
    const nom = $("#ct-client").value.trim();
    if (!nom) { toast("Indiquez le nom du client", true); return; }
    const client = await DB.findOrCreateClientByName({ nom });
    state.contratDraft.client_id = client.id;
    state.contratDraft.nom = client.nom;
    state.contratDraft.nb_passages = $("#ct-passages").value;
    state.contratDraft.tarification_zone_km = $("#ct-zone").value.trim();
    state.contratDraft.conditions_generales = cleanText($("#ct-cg").value);
    if (Supabase.configured() && state.auth && navigator.onLine) {
      try {
        if (state.contratDraft._client_sig_blob) state.contratDraft.client_signature_url = await Supabase.uploadSignature(`ct-client-${uuid()}`, state.contratDraft._client_sig_blob);
        if (state.contratDraft._technicien_sig_blob) state.contratDraft.technicien_signature_url = await Supabase.uploadSignature(`ct-tech-${uuid()}`, state.contratDraft._technicien_sig_blob);
      } catch (e) { ErrorLog.warn("Upload signature échoué", e); }
    }
    // NUM-01 : référence attribuée côté serveur à la première synchronisation
    // (trigger `set_numero_contrat`) — plus de compteur local source de
    // doublons entre appareils. Repli local uniquement sans Supabase (mode V1).
    if (!state.contratDraft.numero && !Supabase.configured()) state.contratDraft.numero = await DB.nextNumero("CTR");
    const saved = await DB.saveContrat({ ...state.contratDraft });
    state.contratDraft = null;
    toast("Contrat enregistré");
    go(`#/detail-contrat/${saved.id}`);
  });
  $("#btn-pdf-contrat")?.addEventListener("click", async () => {
    const client = state.contratDraft.client_id ? await DB.getClient(state.contratDraft.client_id) : null;
    try { await downloadContratPDF(state.contratDraft, client); toast("PDF du contrat généré"); }
    catch (err) { ErrorLog.error(err); toast("Erreur lors de la génération du PDF", true); }
  });
}

async function renderContrats() {
  const [contrats, clients] = await Promise.all([DB.listContrats(), DB.listClients()]);
  const clientMap = Object.fromEntries(clients.map((c) => [c.id, c]));
  setApp(`
    ${topbar({ title: "Contrats d'entretien", back: true })}
    <main>
      <div class="section-label">Contrats annuels</div>
      ${contrats.length ? contrats.map((ct) => `
        <button class="intervention-item" data-nav="contrat-edit" data-id="${ct.id}">
          <span class="status-dot">${ICONS.file}</span>
          <span class="ii-body">
            <span class="ii-top"><span class="ii-client">${esc(ct.nom || clientMap[ct.client_id]?.nom || "Client")}</span><span class="ii-date">${esc(ct.numero || "")}</span></span>
            <span class="ii-type">${esc(`${ct.nb_passages ? ct.nb_passages + " passage(s)/an" : ""}${ct.tarification_zone_km ? " · " + ct.tarification_zone_km : ""}`)}</span>
            <span class="ii-tags">${ct.client_signature_url ? `<span class="tag done">Signé</span>` : `<span class="tag pending">Non signé</span>`}</span>
          </span>
          ${ICONS.chevron}
        </button>`).join("") : `<div class="empty-state"><div class="glyph">${ICONS.file}</div><h3>Aucun contrat</h3><p>Les contrats existants restent consultables ici (US-24) — l'entrée de création dans le bouton + est suspendue (arbitrage 6.11, 09/10).</p></div>`}
    </main>
    <div class="toast" id="toast"></div>
  `);
}

async function renderDetailContrat(id) {
  const ct = await DB.getContrat(id);
  if (!ct) { go("#/contrats"); return; }
  const client = ct.client_id ? await DB.getClient(ct.client_id) : null;
  setApp(`
    ${topbar({ title: "Contrat d'entretien", subtitle: ct.numero || "", back: true, actions: `<button class="icon-btn" data-nav="contrat-edit" data-id="${ct.id}" title="Modifier" aria-label="Modifier">${ICONS.pencil}</button>` })}
    <main>
      <div class="detail-header"><div class="meta">${esc(client?.nom || ct.nom || "Client")}</div></div>
      <div class="section-label">Prestations</div>
      <div class="card">
        <div class="kv"><div class="k">Passages / an</div><div class="v">${esc(ct.nb_passages || "-")}</div></div>
        <div class="kv"><div class="k">Tarification</div><div class="v">${esc(ct.tarification_zone_km || "-")}</div></div>
        <div class="kv"><div class="k">Client</div><div class="v">${client ? esc([client.adresse, client.code_postal, client.ville].filter(Boolean).join(" ")) || "-" : "-"}</div></div>
      </div>
      ${ct.conditions_generales ? `
      <div class="section-label">Conditions générales</div>
      <div class="card"><div class="block-text">${esc(ct.conditions_generales)}</div></div>` : ""}
      <div class="section-label">Signatures</div>
      <div class="card">
        <div class="kv"><div class="k">Client</div><div class="v">${ct.signe_client || ct.client_signature_url ? (ct.signe_client || "Signé") : "Non signé"}</div></div>
        ${ct.client_signature_url ? `<div class="sig-preview" style="border:none;"><img src="${esc(ct.client_signature_url)}" alt="Signature client" /></div>` : ""}
        <div class="kv"><div class="k">Technicien</div><div class="v">${ct.signe_technicien || ct.technicien_signature_url ? (ct.signe_technicien || "Signé") : "Non signé"}</div></div>
        ${ct.technicien_signature_url ? `<div class="sig-preview" style="border:none;"><img src="${esc(ct.technicien_signature_url)}" alt="Signature technicien" /></div>` : ""}
      </div>
      <button class="btn btn-accent" id="btn-pdf-contrat" style="margin-top:14px;">${ICONS.file} Partager le PDF du contrat</button>
    </main>
    <div class="toast" id="toast"></div>
  `);
  $("#btn-pdf-contrat").addEventListener("click", async () => {
    try { await downloadContratPDF(ct, client); toast("PDF du contrat généré"); }
    catch (err) { ErrorLog.error(err); toast("Erreur lors de la génération du PDF", true); }
  });
}

