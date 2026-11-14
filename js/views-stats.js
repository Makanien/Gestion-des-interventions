/* js/views-stats.js — statistiques. Extrait d'app.js (BP-03) : script classique, portée globale partagée ;
   chargé avant app.js dans l'ordre de index.html. */
// ---------------------------------------------------------
// STATISTIQUES
// ---------------------------------------------------------
async function renderStats() {
  const itvs = await DB.listInterventions();
  const byMonth = {};
  const byType = {};
  const byTech = {};
  const byStatut = {};
  const byClient = {};
  for (const i of itvs) {
    const m = (i.date || "").slice(0, 7);
    byMonth[m] = (byMonth[m] || 0) + 1;
    const t = i.type_entretien ? (ENTRETIEN_META[i.type_entretien]?.label || "Entretien") : (i.type_intervention || "-");
    byType[t] = (byType[t] || 0) + 1;
    const tech = i.technicien_nom || "Non renseigné";
    byTech[tech] = (byTech[tech] || 0) + 1;
    byStatut[statutDossierLabel(i.statut_dossier)] = (byStatut[statutDossierLabel(i.statut_dossier)] || 0) + 1;
    const client = i.client?.nom || "Non renseigné";
    byClient[client] = (byClient[client] || 0) + 1;
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

      <div class="section-label">Par client</div>
      <div class="card">
        ${sortedByVal(byClient).map(([k, v]) => `<div class="kv"><div class="k" style="width:auto;flex:1;">${esc(k)}</div><div class="v">${v}</div></div>`).join("") || `<div class="block-text">Aucune donnée.</div>`}
      </div>
    </main>
    <div class="toast" id="toast"></div>
  `);
}
function monthLabel(ym) {
  const [y, m] = ym.split("-");
  return new Date(`${y}-${m}-01T00:00:00`).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

