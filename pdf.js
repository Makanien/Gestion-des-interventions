/* =========================================================
   Climat Elec — Génération du PDF de fiche d'intervention
   Mise en page recalée sur les coordonnées exactes de la fiche
   papier originale (extraites du PDF fourni), même police de
   labels (Times italique), mêmes teintes (badges gris-lavande,
   bandeau cyan), même logo (image réelle extraite du PDF).
   Utilise jsPDF (embarqué localement dans /vendor, offline).
   ========================================================= */

const CE_INK = [68, 68, 68];        // couleur de texte réelle de la fiche d'origine (#444)
const CE_BADGE_BG = [240, 239, 245]; // fond pâle des titres de section (#F0EFF5)
const CE_BAR_BG = [84, 236, 253];    // bandeau "Fiche d'intervention" (#54ECFD)
const CE_BORDER = [200, 202, 206];   // bordures des encadrés (#C8CACE)
const CE_LEFT = 20;
const CE_RIGHT = 575; // largeur utile (595pt de large - marges)

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d)) return iso;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function computeDuration(start, end) {
  if (!start || !end) return "";
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

  // ---- helpers de dessin ----
  const label = (text, x, yTop, opts = {}) => {
    doc.setFont("times", "italic");
    doc.setFontSize(opts.size || 8.3);
    doc.setTextColor(...CE_INK);
    doc.text(text, x, yTop + (opts.baseline ?? 8.5));
  };
  const value = (text, x, yTop, opts = {}) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(opts.size || 9.3);
    doc.setTextColor(...CE_INK);
    const t = text && String(text).trim() ? String(text) : "";
    if (opts.maxWidth) {
      doc.text(doc.splitTextToSize(t, opts.maxWidth), x, yTop + (opts.baseline ?? 8.5));
    } else {
      doc.text(t, x, yTop + (opts.baseline ?? 8.5));
    }
  };
  const sectionBadge = (text, x, yTop, w) => {
    const h = 13.5;
    doc.setFillColor(...CE_BADGE_BG);
    doc.rect(x - 4, yTop - 2, w, h, "F");
    doc.setFont("times", "bolditalic");
    doc.setFontSize(9.2);
    doc.setTextColor(...CE_INK);
    doc.text(text, x, yTop + 9);
  };
  const checkbox = (x, yTop, checked) => {
    const s = 7.5;
    doc.setDrawColor(...CE_INK);
    doc.setLineWidth(0.7);
    doc.rect(x, yTop, s, s);
    if (checked) {
      doc.setLineWidth(1.1);
      doc.line(x + 1.2, yTop + 4, x + 3, yTop + 6.3);
      doc.line(x + 3, yTop + 6.3, x + 6.4, yTop + 1.2);
    }
  };
  const box = (x, yTop, w, h) => {
    doc.setDrawColor(...CE_BORDER);
    doc.setLineWidth(0.8);
    doc.rect(x, yTop, w, h);
  };
  const textInBox = (text, x, yTop, w) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.3);
    doc.setTextColor(...CE_INK);
    const lines = doc.splitTextToSize(text && text.trim() ? text : "", w - 12);
    doc.text(lines, x + 6, yTop + 13);
  };

  // ---- Logo (image réelle extraite du PDF d'origine) ----
  if (window.LOGO_CLIMAT_ELEC_PNG) {
    const w = 150, h = 150 / (604 / 192);
    doc.addImage(window.LOGO_CLIMAT_ELEC_PNG, "PNG", CE_LEFT, 10, w, h);
  }

  // ---- Bloc Client (haut droit) ----
  sectionBadge("Client", 384.4, 16.5, 40);
  label("Nom:", 220.3, 40.0);
  value(client?.nom, 250, 40.0, { maxWidth: 140 });
  label("Adresse:", 218.3, 53.4);
  value(client?.adresse, 258, 53.4, { maxWidth: 130 });
  label("Ville:", 394.0, 53.4);
  value(client?.ville, 420, 53.4, { maxWidth: 100 });
  label("Code postal:", 218.3, 67.6);
  value(client?.code_postal, 272, 67.6, { maxWidth: 110 });
  label("Mail:", 394.0, 67.6);
  value(client?.mail, 417, 67.6, { maxWidth: 105 });
  label("Type de Bâtiment .", 218.3, 83.6);
  value(client?.type_batiment, 300, 83.6, { maxWidth: 90 });
  label("Tél:", 394.0, 81.8);
  value(client?.tel, 413, 81.8, { maxWidth: 105 });

  // ---- Bandeau titre "Fiche d'intervention" ----
  doc.setFillColor(...CE_BAR_BG);
  doc.rect(CE_LEFT, 102.5, CE_RIGHT - CE_LEFT, 17.5, "F");
  doc.setFont("times", "bolditalic");
  doc.setFontSize(10.5);
  doc.setTextColor(...CE_INK);
  doc.text("Fiche d’intervention", 297.5, 114.5, { align: "center" });

  // ---- Intervention ----
  sectionBadge("Intervention", 21.9, 125.0, 76);
  label("Type          .", 21.8, 148.4);
  value(itv.type_intervention, 60, 148.4, { maxWidth: 125 });
  label("Heure d’arrivé sur site", 196.2, 147.5);
  value(itv.heure_arrivee, 300.3, 147.5, { maxWidth: 65 });
  checkbox(355, 146, itv.statut === "terminee");
  label("Intervention terminée avec succès", 371.2, 147.5, { size: 8.3 });

  label("Date", 21.8, 168.2);
  value(fmtDate(itv.date), 60, 168.2, { maxWidth: 125 });
  label("Heure de départ du site", 195.8, 168.4);
  value(itv.heure_depart, 300.3, 168.4, { maxWidth: 65 });
  checkbox(355, 167, itv.statut === "a_prevoir");
  label("Nouvelle intervention à prévoir", 371.2, 168.4, { size: 8.3 });

  label("Forfait déplacement", 21.8, 188.1);
  value(itv.forfait_deplacement, 112, 188.1, { maxWidth: 75, size: 8.3 });
  label("Temps d’intervention", 195.8, 189.3);
  value(computeDuration(itv.heure_arrivee, itv.heure_depart), 300.3, 189.3, { maxWidth: 65 });

  // ---- Equipement ----
  sectionBadge("Equipement", 22.4, 213.0, 78);
  const eqRows = [230.8, 246.6, 262.1];
  for (let i = 0; i < 3; i++) {
    const eq = itv.equipements?.[i] || {};
    const y = eqRows[i];
    label("Intitulé", 22.4, y);
    value(eq.intitule, 56, y, { maxWidth: 96 });
    label("Marque", 161.2, y);
    value(eq.marque, 191, y, { maxWidth: 100 });
    label("Modèle", 301.3, y);
    value(eq.modele, 331, y, { maxWidth: 100 });
    label("N° Série", 441.0, y);
    value(eq.numero_serie, 477, y, { maxWidth: 78 });
  }

  // ---- Descriptif de la demande ----
  sectionBadge("Descriptif de la demande", 19.8, 288.8, 152);
  box(CE_LEFT, 307, CE_RIGHT - CE_LEFT, 50);
  textInBox(itv.descriptif_demande, CE_LEFT, 307, CE_RIGHT - CE_LEFT);

  // ---- Action réalisée ----
  sectionBadge("Action réalisée", 19.8, 365.3, 94);
  box(CE_LEFT, 383, CE_RIGHT - CE_LEFT, 112);
  textInBox(itv.action_realisee, CE_LEFT, 383, CE_RIGHT - CE_LEFT);

  // ---- Pièces utilisées ----
  sectionBadge("Pièces utilisée", 21.8, 503.9, 88);
  const pRows = [526.6, 540.8, 555.0, 569.1, 583.3, 597.5, 611.7, 625.8];
  for (let i = 0; i < 8; i++) {
    const p = itv.pieces?.[i] || {};
    const y = pRows[i];
    label("Désignation", 21.8, y);
    value(p.designation, 76, y, { maxWidth: 258 });
    label("Référence", 342.2, y);
    value(p.reference, 388, y, { maxWidth: 120 });
    label("Quantité", 480.7, y);
    value(p.quantite != null && p.quantite !== "" ? p.quantite : "", 520, y, { maxWidth: 40 });
  }

  // ---- Devis ----
  label("Le client souhaites t-il un devis", 21.6, 653.8, { size: 9 });
  checkbox(133, 652.3, !!itv.devis_souhaite);
  box(CE_LEFT, 668, CE_RIGHT - CE_LEFT, 40);
  textInBox(itv.devis_commentaire, CE_LEFT, 668, CE_RIGHT - CE_LEFT);

  // ---- Signatures ----
  label("Signature du technicien", 21.8, 718.4, { size: 9 });
  label("Nom", 19.8, 729.8);
  value(itv.technicien_nom, 45, 729.8, { maxWidth: 250 });
  label("Date", 21.8, 741.2);
  value(fmtDate(itv.date), 50, 741.2, { maxWidth: 245 });

  label("Signature du client", 318.8, 718.4, { size: 9 });
  label("Nom", 318.8, 729.8);
  value(itv.client_present ? itv.client_signature_nom : "", 344, 729.8, { maxWidth: 230 });
  label("Date", 318.8, 741.2);
  value(itv.client_present ? fmtDate(itv.date) : "", 347, 741.2, { maxWidth: 225 });
  label("Présent", 318.8, 752.5);
  checkbox(360, 751.2, !!itv.client_present);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(160, 160, 160);
  doc.text(`Généré le ${new Date().toLocaleString("fr-FR")} — Climat Elec`, CE_RIGHT, 825, { align: "right" });

  return doc;
}

async function downloadInterventionPDF(itv, client) {
  const doc = await generateInterventionPDF(itv, client);
  const filename = `Fiche_${(client?.nom || "client").replace(/[^a-z0-9]+/gi, "_")}_${itv.date || ""}.pdf`;

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
