/* =========================================================
   Climat Elec — Génération du PDF de fiche d'intervention
   Reprend la structure de la fiche papier existante.
   Utilise jsPDF (embarqué localement dans /vendor, offline).
   ========================================================= */

function fmtDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d)) return iso;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function computeDuration(start, end) {
  if (!start || !end) return "-";
  const [h1, m1] = start.split(":").map(Number);
  const [h2, m2] = end.split(":").map(Number);
  let mins = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (mins < 0) mins += 24 * 60;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h${String(m).padStart(2, "0")}`;
}

async function generateInterventionPDF(itv, client) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 40;
  let y = 40;

  const NAVY = [22, 48, 63];
  const BLUE = [47, 134, 180];
  const ORANGE = [232, 121, 42];
  const GREY = [110, 122, 130];
  const LIGHT = [244, 246, 247];

  // ---- Header : logo mark + entreprise + bloc client ----
  doc.setFillColor(...BLUE);
  doc.circle(margin + 14, y + 10, 14, "F");
  doc.setFillColor(...ORANGE);
  doc.circle(margin + 20, y + 16, 14, "F");
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(255,255,255);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...NAVY);
  doc.text("Climat Elec", margin + 42, y + 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...GREY);
  doc.text("Géothermie · Climatisation · Pompe à chaleur · Chaudière bois/granulés", margin + 42, y + 21);
  doc.text("02 41 26 78 56  —  49500 Chazé-sur-Argos", margin + 42, y + 31);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  doc.text("FICHE D'INTERVENTION", pageW - margin, y + 10, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...GREY);
  doc.text(`Réf. ${itv.id.slice(0, 8).toUpperCase()}`, pageW - margin, y + 21, { align: "right" });
  doc.text(fmtDate(itv.date), pageW - margin, y + 31, { align: "right" });

  y += 52;
  doc.setDrawColor(...LIGHT);
  doc.setLineWidth(1);
  doc.line(margin, y, pageW - margin, y);
  y += 20;

  const sectionTitle = (label) => {
    doc.setFillColor(...LIGHT);
    doc.rect(margin, y, pageW - margin * 2, 18, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...NAVY);
    doc.text(label.toUpperCase(), margin + 8, y + 12.5);
    y += 18 + 10;
  };

  const kv = (label, value, x, w) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...GREY);
    doc.text(label, x, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...NAVY);
    const text = value && String(value).trim() ? String(value) : "-";
    doc.text(doc.splitTextToSize(text, w), x, y + 11);
  };

  const colW = (pageW - margin * 2 - 20) / 2;

  // ---- Client ----
  sectionTitle("Client");
  kv("Nom", client?.nom, margin, colW);
  kv("Ville", client ? `${client.code_postal || ""} ${client.ville || ""}`.trim() : "", margin + colW + 20, colW);
  y += 26;
  kv("Adresse", client?.adresse, margin, colW);
  kv("Type de bâtiment", client?.type_batiment, margin + colW + 20, colW);
  y += 26;
  kv("Téléphone", client?.tel, margin, colW);
  kv("Mail", client?.mail, margin + colW + 20, colW);
  y += 30;

  // ---- Intervention ----
  sectionTitle("Intervention");
  kv("Type", itv.type_intervention, margin, colW);
  kv("Date", fmtDate(itv.date), margin + colW + 20, colW);
  y += 26;
  kv("Heure d'arrivée", itv.heure_arrivee, margin, colW / 2 - 5);
  kv("Heure de départ", itv.heure_depart, margin + colW / 2 + 15, colW / 2 - 5);
  kv("Temps d'intervention", computeDuration(itv.heure_arrivee, itv.heure_depart), margin + colW + 20, colW);
  y += 26;
  kv("Forfait déplacement", itv.forfait_deplacement ? "Oui" : "Non", margin, colW);
  kv("Statut", itv.statut === "terminee" ? "Terminée avec succès" : "Nouvelle intervention à prévoir", margin + colW + 20, colW);
  y += 30;

  // ---- Équipement ----
  if (itv.equipements && itv.equipements.length) {
    sectionTitle("Équipement");
    itv.equipements.forEach((eq) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(...NAVY);
      doc.text(eq.intitule || "-", margin, y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...GREY);
      doc.text(`Marque : ${eq.marque || "-"}    Modèle : ${eq.modele || "-"}    N° série : ${eq.numero_serie || "-"}`, margin, y + 12);
      y += 26;
    });
    y += 4;
  }

  // ---- Descriptif / Action ----
  const textBlock = (label, content) => {
    sectionTitle(label);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...NAVY);
    const lines = doc.splitTextToSize(content && content.trim() ? content : "-", pageW - margin * 2 - 10);
    doc.text(lines, margin + 5, y);
    y += lines.length * 12 + 16;
  };
  textBlock("Descriptif de la demande", itv.descriptif_demande);
  textBlock("Action réalisée", itv.action_realisee);

  // ---- Pièces utilisées ----
  if (itv.pieces && itv.pieces.length) {
    sectionTitle("Pièces utilisées");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...GREY);
    doc.text("Désignation", margin, y);
    doc.text("Référence", margin + colW * 0.9, y);
    doc.text("Qté", pageW - margin - 20, y, { align: "right" });
    y += 10;
    doc.setDrawColor(...LIGHT);
    doc.line(margin, y, pageW - margin, y);
    y += 12;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...NAVY);
    itv.pieces.forEach((p) => {
      doc.text(p.designation || "-", margin, y);
      doc.text(p.reference || "-", margin + colW * 0.9, y);
      doc.text(String(p.quantite ?? "-"), pageW - margin - 20, y, { align: "right" });
      y += 16;
    });
    y += 10;
  }

  // ---- Devis ----
  sectionTitle("Devis");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...NAVY);
  doc.text(`Le client souhaite un devis : ${itv.devis_souhaite ? "Oui" : "Non"}`, margin, y);
  y += 14;
  if (itv.devis_commentaire) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...GREY);
    const lines = doc.splitTextToSize(itv.devis_commentaire, pageW - margin * 2 - 10);
    doc.text(lines, margin + 5, y);
    y += lines.length * 12;
  }
  y += 24;

  // ---- Signatures ----
  if (y > 680) { doc.addPage(); y = 50; }
  sectionTitle("Signatures");
  const sigColW = (pageW - margin * 2 - 20) / 2;
  doc.setDrawColor(...LIGHT);
  doc.rect(margin, y, sigColW, 70);
  doc.rect(margin + sigColW + 20, y, sigColW, 70);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...GREY);
  doc.text("Technicien", margin + 8, y + 14);
  doc.text("Client" + (itv.client_present === false ? " (absent)" : ""), margin + sigColW + 28, y + 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...NAVY);
  doc.setFont("times", "italic");
  doc.setFontSize(15);
  doc.text(itv.technicien_nom || "-", margin + 8, y + 40);
  doc.text(itv.client_present === false ? "" : (itv.client_signature_nom || "-"), margin + sigColW + 28, y + 40);

  y += 70 + 20;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...GREY);
  doc.text(`Fiche générée le ${new Date().toLocaleString("fr-FR")} — Climat Elec`, margin, 815);

  return doc;
}

async function downloadInterventionPDF(itv, client) {
  const doc = await generateInterventionPDF(itv, client);
  const filename = `Fiche_${(client?.nom || "client").replace(/[^a-z0-9]+/gi, "_")}_${itv.date || ""}.pdf`;

  // Partage natif si possible (mobile), sinon téléchargement classique
  const blob = doc.output("blob");
  if (navigator.canShare && navigator.canShare({ files: [new File([blob], filename, { type: "application/pdf" })] })) {
    try {
      const file = new File([blob], filename, { type: "application/pdf" });
      await navigator.share({ files: [file], title: filename });
      return;
    } catch (e) {
      // annulé ou non supporté -> fallback téléchargement
    }
  }
  doc.save(filename);
}

window.downloadInterventionPDF = downloadInterventionPDF;
