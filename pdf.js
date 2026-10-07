/* =========================================================
   Climat Elec — Génération du PDF de fiche d'intervention
   Mise en page "épurée" en sections/cartes, avec le logo réel
   (extrait du PDF fourni) en bannière d'en-tête.
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

// Charge une image (dataURL ou URL) en données utilisables par jsPDF.
function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// Format jsPDF déduit du type mime du dataURL (sinon JPEG par défaut).
function imageFormat(url) {
  return String(url || "").startsWith("data:image/png") ? "PNG" : "JPEG";
}

async function generateInterventionPDF(itv, client) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  const pageBottom = pageH - 46; // zone du pied de page réservée (815 pt)
  let y = 34;

  const NAVY = [22, 48, 63];
  const GREY = [110, 122, 130];
  const LIGHT = [244, 246, 247];

  // Saut de page automatique : chaque section / ligne vérifie la place
  // disponible avant de dessiner, pour qu'aucune donnée ne passe sous le
  // bord bas de la page (fiches d'entretien longues).
  const ensureSpace = (h) => {
    if (y + h > pageBottom) { doc.addPage(); y = 50; }
  };

  // ---- Bannière logo (image réelle extraite du PDF d'origine) ----
  const logoH = 75;
  if (window.LOGO_CLIMAT_ELEC_PNG) {
    const w = 236;
    doc.addImage(window.LOGO_CLIMAT_ELEC_PNG, "PNG", margin, y, w, logoH);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  doc.text("FICHE D'INTERVENTION", pageW - margin, y + 10, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...GREY);
  doc.text(`Réf. ${itv.numero || itv.id.slice(0, 8).toUpperCase()}`, pageW - margin, y + 21, { align: "right" });
  doc.text(fmtDate(itv.date), pageW - margin, y + 31, { align: "right" });

  y += logoH + (window.LOGO_CLIMAT_ELEC_PNG ? 12 : 0);
  doc.setDrawColor(...LIGHT);
  doc.setLineWidth(1);
  doc.line(margin, y, pageW - margin, y);
  y += 10;

  const sectionTitle = (label) => {
    ensureSpace(34);
    doc.setFillColor(...LIGHT);
    doc.rect(margin, y, pageW - margin * 2, 16, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...NAVY);
    doc.text(label.toUpperCase(), margin + 8, y + 11);
    y += 14 + 10;
  };

  // Dessine un couple label (gris) / valeur (gras, retournée à la ligne dans
  // la largeur w) et retourne le nombre de lignes de valeur.
  const kv = (label, value, x, w) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...GREY);
    doc.text(label, x, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...NAVY);
    const text = value && String(value).trim() ? String(value) : "-";
    const lines = doc.splitTextToSize(text, w);
    doc.text(lines, x, y + 11);
    return lines.length;
  };

  // Ligne de couples [label, valeur, x, largeur] : avance de la hauteur max.
  const kvRows = (...items) => {
    const counts = items.map(([label, value, x, w]) => kv(label, value, x, w));
    y += Math.max(...counts) * 12 + 11;
  };

  const colW = (pageW - margin * 2 - 20) / 2;

  // Modèle d'entretien (refonte 18/09) si la fiche porte un type d'entretien.
  const metaITV = itv.type_entretien
    ? (typeof ENTRETIEN_META !== "undefined" ? (ENTRETIEN_META[itv.type_entretien] || null) : null)
    : null;

  // ---- Client ----
  sectionTitle("Client");
  kvRows(
    ["Nom", client?.nom, margin, colW],
    ["Ville", client ? `${client.code_postal || ""} ${client.ville || ""}`.trim() : "", margin + colW + 20, colW],
  );
  kvRows(
    ["Adresse", client?.adresse, margin, colW],
    ["Type de bâtiment", client?.type_batiment, margin + colW + 20, colW],
  );
  kvRows(
    ["Téléphone", client?.tel, margin, colW],
    ["Mail", client?.mail, margin + colW + 20, colW],
  );

  // ---- Intervention ----
  sectionTitle("Intervention");
  if (metaITV) {
    // Libellé + type d'entretien détaillé (ex. « Entretien Air/Eau - Sol/Eau — Géothermie »).
    kvRows(["Type d'entretien", `${metaITV.label}${itv.type_entretien_detail ? ` — ${itv.type_entretien_detail}` : ""}`, margin, pageW - margin * 2]);
  }
  kvRows(
    ["Type", itv.type_intervention, margin, colW],
    ["Date", fmtDate(itv.date), margin + colW + 20, colW],
  );
  kvRows(
    ["Heure d'arrivée", itv.heure_arrivee, margin, colW / 2 - 5],
    ["Heure de départ", itv.heure_depart, margin + colW / 2 + 15, colW / 2 - 5],
    ["Temps d'intervention", computeDuration(itv.heure_arrivee, itv.heure_depart), margin + colW + 20, colW],
  );
  kvRows(
    ["Forfait déplacement", itv.forfait_deplacement, margin, colW],
    ["Statut", itv.statut === "terminee" ? "Effectuée" : itv.statut === "terminee_suite" ? "Effectuée, suite à prévoir" : "À effectuer", margin + colW + 20, colW],
  );

  // ---- Équipement ----
  if ((itv.equipements && itv.equipements.length) || itv.annee_installation) {
    sectionTitle("Équipement");
    if (itv.annee_installation) {
      kvRows(["Année d'installation", itv.annee_installation, margin, colW / 2 - 5]);
    }
    itv.equipements.forEach((eq) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...GREY);
      const detail = doc.splitTextToSize(
        `Marque : ${eq.marque || "-"}    Modèle : ${eq.modele || "-"}    N° série : ${eq.numero_serie || "-"}`,
        pageW - margin * 2,
      );
      ensureSpace(14 + detail.length * 11 + 4);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(...NAVY);
      doc.text(eq.intitule || "-", margin, y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...GREY);
      doc.text(detail, margin, y + 12);
      y += 14 + detail.length * 11 + 4;
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
    lines.forEach((ln) => {
      ensureSpace(14);
      doc.text(ln, margin + 5, y);
      y += 12;
    });
    y += 6;
  };
  // Les fiches d'entretien n'ont pas descriptif : bloc masqué si vide.
  if (!metaITV || (itv.descriptif_demande || "").trim()) {
    textBlock("Descriptif de la demande", itv.descriptif_demande);
  }
  textBlock(metaITV ? "Remarque / Observation" : "Action réalisée", itv.action_realisee);

  // ---- Pièces utilisées ----
  if (itv.pieces && itv.pieces.length) {
    sectionTitle("Pièces utilisées");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...GREY);
    doc.text("Désignation", margin, y);
    doc.text("Référence", margin + colW * 0.9, y);
    doc.text("Qté", pageW - margin - 20, y, { align: "right" });
    y += 8;
    doc.setDrawColor(...LIGHT);
    doc.line(margin, y, pageW - margin, y);
    y += 10;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...NAVY);
    itv.pieces.forEach((p) => {
      const dLines = doc.splitTextToSize(p.designation || "-", colW * 0.85);
      const rLines = doc.splitTextToSize(p.reference || "-", colW * 0.9);
      ensureSpace(Math.max(dLines.length, rLines.length) * 12 + 4);
      doc.text(dLines, margin, y);
      doc.text(rLines, margin + colW * 0.9, y);
      doc.text(String(p.quantite ?? "-"), pageW - margin - 20, y, { align: "right" });
      y += Math.max(dLines.length, rLines.length) * 12 + 4;
    });
    y += 8;
  }

  // ---- Mesures (fiches d'entretien — refonte 18/09 : une section par page 4/5) ----
  const mesures = (itv.mesures || []).filter((m) => !String(m.code).startsWith("cerfa_"));
  // Colonnes partagées mesure / CERFA : libellé à gauche, valeur alignée à droite.
  const valueW = 140;
  const labelW = pageW - margin * 2 - valueW - 10;
  const rowMesureWith = (m) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...GREY);
    const libLines = doc.splitTextToSize(m.libelle || "-", labelW);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...NAVY);
    const valLines = doc.splitTextToSize(`${m.valeur || ""} ${m.unite || ""}`.trim() || "-", valueW);
    ensureSpace(Math.max(libLines.length, valLines.length) * 12 + 4);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...GREY);
    doc.text(libLines, margin, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...NAVY);
    doc.text(valLines, pageW - margin, y, { align: "right" });
    y += Math.max(libLines.length, valLines.length) * 12 + 4;
  };
  if (mesures.length) {
    sectionTitle("Mesures");
    const rowMesure = rowMesureWith;
    const subHeader = (label) => {
      ensureSpace(30);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...NAVY);
      doc.text(label, margin, y);
      y += 16;
    };
    if (metaITV) {
      // Regroupement par page du modèle (Vérification Groupe extérieur / Module
      // hydraulique / Vérification chaudière bois…), puis mesures orphelines
      // (anciens codes) sous « Autres mesures ».
      const used = new Set();
      for (const s of metaITV.mesures) {
        const items = mesures.filter((m) => s.items.some((i) => i.code === m.code));
        if (!items.length) continue;
        items.forEach((m) => used.add(m.code));
        subHeader(s.section);
        items.forEach(rowMesure);
      }
      const others = mesures.filter((m) => !used.has(m.code));
      if (others.length) {
        subHeader("Autres mesures");
        others.forEach(rowMesure);
      }
    } else {
      mesures.forEach(rowMesure);
    }
    y += 10;
  }

  // ---- CERFA n°15497 ----
  const cerfa = (itv.mesures || [])
    .filter((m) => String(m.code).startsWith("cerfa_"))
    // l'unité « Oui / Non » est une indication de saisie, pas une unité à imprimer
    .map((m) => ({ ...m, unite: (m.unite || "").includes("/") ? "" : (m.unite || "") }));
  if (cerfa.length) {
    sectionTitle("CERFA n°15497 — Fluides frigorigènes");
    cerfa.forEach(rowMesureWith);
    y += 10;
  }

  // ---- Photos (page dédiée, grille 2 colonnes, ratio préservé) ----
  if (itv.photos && itv.photos.length) {
    doc.addPage();
    y = 50;
    sectionTitle("Photos");
    const photoW = (pageW - margin * 2 - 20) / 2;
    const photoMaxH = 180;
    for (let i = 0; i < itv.photos.length; i += 2) {
      const els = [];
      for (let j = i; j < Math.min(i + 2, itv.photos.length); j++) {
        const ph = itv.photos[j];
        if (!ph.data_url) continue;
        const img = await loadImage(ph.data_url);
        // Ajuste au cadre sans déformation (largeur photoW, hauteur bornée).
        let drawH = photoMaxH, drawW = photoW, offsetW = 0;
        if (img) {
          const s = Math.min(photoW / img.width, photoMaxH / img.height);
          drawW = img.width * s;
          drawH = img.height * s;
          offsetW = (photoW - drawW) / 2;
        }
        const caps = ph.legende
          ? doc.splitTextToSize(ph.legende, photoW).slice(0, 3)
          : [];
        els.push({ ph, img, drawW, drawH, offsetW, caps });
      }
      if (!els.length) continue;
      const rowH = Math.max(...els.map((e) => e.drawH + (e.caps.length ? e.caps.length * 10 + 8 : 0)));
      ensureSpace(rowH + 20);
      els.forEach((e, j) => {
        const x = margin + j * (photoW + 20) + e.offsetW;
        if (e.img) doc.addImage(e.img, imageFormat(e.ph.data_url), x, y, e.drawW, e.drawH);
        else { doc.setDrawColor(...LIGHT); doc.rect(margin + j * (photoW + 20), y, photoW, e.drawH); }
        if (e.caps.length) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8.5);
          doc.setTextColor(...GREY);
          doc.text(e.caps, margin + j * (photoW + 20), y + e.drawH + 12);
        }
      });
      y += rowH + 18;
    }
    y += 8;
  }

  // ---- Devis ----
  ensureSpace(46);
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
    doc.splitTextToSize(itv.devis_commentaire, pageW - margin * 2 - 10).forEach((ln) => {
      ensureSpace(14);
      doc.text(ln, margin + 5, y);
      y += 12;
    });
  }
  // Chaudière bois : mention « Prochaine intervention prévue » (page finale).
  if (metaITV?.prochaine) {
    ensureSpace(22);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...NAVY);
    doc.text(`Prochaine intervention prévue : ${itv.prochaine_intervention_prevue ? "Oui" : "Non"}`, margin, y);
    y += 18;
  }
  y += 6;

  // ---- Signatures ----
  ensureSpace(118);
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

  const drawSigImage = async (url, x, y, w, h) => {
    if (!url) return false;
    try {
      const img = await loadImage(url);
      if (img) { doc.addImage(img, imageFormat(url), x, y, w, h); return true; }
    } catch (e) { console.warn("Signature non chargée", e); }
    return false;
  };

  // Technicien : image tactile si dispo, sinon nom en texte.
  const techImgDrawn = itv.technicien_signature_url
    ? await drawSigImage(itv.technicien_signature_url, margin + 8, y + 22, sigColW - 16, 40)
    : false;
  if (!techImgDrawn) doc.text(itv.technicien_nom || "-", margin + 8, y + 40);

  // Client : image tactile si dispo, sinon nom en texte.
  const clientImgDrawn = itv.client_signature_url && itv.client_present !== false
    ? await drawSigImage(itv.client_signature_url, margin + sigColW + 28, y + 22, sigColW - 16, 40)
    : false;
  if (!clientImgDrawn && itv.client_present !== false) {
    doc.text(itv.client_signature_nom || "-", margin + sigColW + 28, y + 40);
  }

  y += 70 + 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...GREY);
  doc.text(`Fiche générée le ${new Date().toLocaleString("fr-FR")} — Climat Elec`, margin, 815);

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

// Récupère le PDF d'un document importé (dataURL) sous forme de bytes.
async function docBytesFromDataUrl(dataUrl) {
  const res = await fetch(dataUrl);
  return res.arrayBuffer();
}

// Construit le dossier final : fiche d'intervention + facture fusionnées.
// Retourne null si aucune facture n'est importée dans le dossier.
async function buildMergedDossierPDF(itv, client) {
  const facture = (itv.documents || []).find((d) => d.type === "facture" && d.data_url);
  if (!facture) return null;

  const fiche = await generateInterventionPDF(itv, client);
  const ficheBytes = fiche.output("arraybuffer");

  const { PDFDocument } = window.PDFLib;
  const merged = await PDFDocument.create();

  const ficheDoc = await PDFDocument.load(ficheBytes);
  const factureDoc = await PDFDocument.load(await docBytesFromDataUrl(facture.data_url));

  const facturePages = await merged.copyPages(factureDoc, factureDoc.getPageIndices());
  facturePages.forEach((p) => merged.addPage(p));

  const fichePages = await merged.copyPages(ficheDoc, ficheDoc.getPageIndices());
  fichePages.forEach((p) => merged.addPage(p));

  return merged.save();
}

// Télécharge (ou partage via l'API native) le dossier final fusionné.
async function downloadMergedDossierPDF(itv, client) {
  const bytes = await buildMergedDossierPDF(itv, client);
  if (!bytes) throw new Error("Aucune facture importée dans ce dossier");

  const filename = `Dossier_${(client?.nom || "client").replace(/[^a-z0-9]+/gi, "_")}_${itv.date || ""}.pdf`;
  const blob = new Blob([bytes], { type: "application/pdf" });

  if (navigator.canShare && navigator.canShare({ files: [new File([blob], filename, { type: "application/pdf" })] })) {
    try {
      const file = new File([blob], filename, { type: "application/pdf" });
      await navigator.share({ files: [file], title: filename });
      return;
    } catch (e) {
      // annulé ou non supporté -> fallback téléchargement
    }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ---------------------------------------------------------
// CONTRAT D'ENTRETIEN ANNUEL (US-24) — PDF généré
// ---------------------------------------------------------
async function generateContratPDF(contrat, client) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 40;
  let y = 34;

  const NAVY = [22, 48, 63];
  const GREY = [110, 122, 130];
  const LIGHT = [244, 246, 247];

  // ---- Bannière logo ----
  let logoH = 60;
  if (window.LOGO_CLIMAT_ELEC_PNG) {
    const w = 200;
    doc.addImage(window.LOGO_CLIMAT_ELEC_PNG, "PNG", margin, y, w, logoH);
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...NAVY);
    doc.text("Climat Elec", margin, y + 24);
    logoH = 0;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  doc.text("CONTRAT D'ENTRETIEN ANNUEL", pageW - margin, y + 10, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...GREY);
  doc.text(`Réf. ${contrat.numero || "CTR-____-___"}`, pageW - margin, y + 21, { align: "right" });
  doc.text(fmtDate(contrat.created_at ? contrat.created_at.slice(0, 10) : null), pageW - margin, y + 31, { align: "right" });

  y += logoH + (window.LOGO_CLIMAT_ELEC_PNG ? 10 : 14);
  doc.setDrawColor(...LIGHT);
  doc.setLineWidth(1);
  doc.line(margin, y, pageW - margin, y);
  y += 14;

  const sectionTitle = (label) => {
    doc.setFillColor(...LIGHT);
    doc.rect(margin, y, pageW - margin * 2, 16, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...NAVY);
    doc.text(label.toUpperCase(), margin + 8, y + 11);
    y += 14 + 12;
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
  kv("Nom", client?.nom || contrat.nom, margin, colW);
  kv("Ville", client ? `${client.code_postal || ""} ${client.ville || ""}`.trim() : "", margin + colW + 20, colW);
  y += 24;
  kv("Adresse", client?.adresse, margin, colW);
  kv("Téléphone", client?.tel, margin + colW + 20, colW);
  y += 24;
  kv("Mail", client?.mail, margin, colW);
  kv("Type de bâtiment", client?.type_batiment, margin + colW + 20, colW);
  y += 22;

  // ---- Objet du contrat ----
  sectionTitle("Objet");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...NAVY);
  const obj = doc.splitTextToSize(
    "Le présent contrat a pour objet la réalisation d'entretiens annuels sur les équipements de climatisation / pompe à chaleur / chaudière installés chez le client, conformément aux conditions générales ci-dessous.",
    pageW - margin * 2 - 10,
  );
  doc.text(obj, margin + 5, y);
  y += obj.length * 12 + 18;

  // ---- Prestations ----
  if (y > 620) { doc.addPage(); y = 50; }
  sectionTitle("Prestations");
  kv("Nombre de passages par an", contrat.nb_passages, margin, colW);
  kv("Tarification par zone / km", contrat.tarification_zone_km, margin + colW + 20, colW);
  y += 22;

  // ---- Conditions générales ----
  if (contrat.conditions_generales && y < 640) {
    sectionTitle("Conditions générales");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...NAVY);
    const lines = doc.splitTextToSize(contrat.conditions_generales, pageW - margin * 2 - 10);
    doc.text(lines, margin + 5, y);
    y += lines.length * 12 + 18;
  }

  // ---- Signatures ----
  if (y > 620) { doc.addPage(); y = 50; }
  sectionTitle("Signatures");
  const sigColW = (pageW - margin * 2 - 20) / 2;
  doc.setDrawColor(...LIGHT);
  doc.rect(margin, y, sigColW, 70);
  doc.rect(margin + sigColW + 20, y, sigColW, 70);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...GREY);
  doc.text("Le technicien (Climat Elec)", margin + 8, y + 14);
  doc.text("Le client", margin + sigColW + 28, y + 14);
  doc.setFont("times", "italic");
  doc.setFontSize(15);
  doc.setTextColor(...NAVY);

  const drawSig = async (url, x, w, h) => {
    if (!url) return false;
    try {
      const img = await loadImage(url);
      if (img) { doc.addImage(img, "PNG", x, y + 20, w, h); return true; }
    } catch (e) { console.warn("Signature non chargée", e); }
    return false;
  };

  const clientSigDrawn = await drawSig(contrat.client_signature_url, margin + sigColW + 28, sigColW - 16, 42);
  if (!clientSigDrawn) {
    doc.setFont("times", "italic");
    doc.setFontSize(14);
    doc.text(contrat.signe_client || "-", margin + sigColW + 28, y + 48);
  }
  const techSigDrawn = await drawSig(contrat.technicien_signature_url, margin + 8, sigColW - 16, 42);
  if (!techSigDrawn) {
    doc.setFont("times", "italic");
    doc.setFontSize(14);
    doc.text(contrat.signe_technicien || "-", margin + 8, y + 48);
  }

  y += 90;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...GREY);
  doc.text(`Document généré le ${new Date().toLocaleString("fr-FR")} — Climat Elec`, margin, 815);

  return doc;
}

async function downloadContratPDF(contrat, client) {
  const doc = await generateContratPDF(contrat, client);
  const filename = `Contrat_${(client?.nom || contrat.nom || "client").replace(/[^a-z0-9]+/gi, "_")}_${(contrat.numero || "").replace(/[^a-z0-9]+/gi, "_")}.pdf`;
  const blob = doc.output("blob");
  if (navigator.canShare && navigator.canShare({ files: [new File([blob], filename, { type: "application/pdf" })] })) {
    try {
      const file = new File([blob], filename, { type: "application/pdf" });
      await navigator.share({ files: [file], title: filename });
      return;
    } catch (e) { /* annulé → fallback */ }
  }
  doc.save(filename);
}

window.downloadInterventionPDF = downloadInterventionPDF;
window.downloadContratPDF = downloadContratPDF;
window.buildMergedDossierPDF = buildMergedDossierPDF;
window.downloadMergedDossierPDF = downloadMergedDossierPDF;