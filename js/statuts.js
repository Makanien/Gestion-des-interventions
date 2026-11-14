/* js/statuts.js — statuts de dossier (workflow 4 statuts). Extrait d'app.js (BP-03) : script classique, portée globale partagée ;
   chargé avant app.js dans l'ordre de index.html. */
// ---------------------------------------------------------
// Statuts de dossier — workflow 4 statuts (13/10/2026)
// BROUILLON → À VALIDER → À FACTURER → TERMINÉ
// (seul le brouillon est éditable ; voir workflowActions pour les transitions)
// ---------------------------------------------------------
const STATUT_DOSSIER = {
  brouillon: { label: "Brouillon", cls: "muted" },
  a_valider: { label: "À valider", cls: "pending" },
  a_facturer: { label: "À facturer", cls: "blue" },
  termine: { label: "Terminé", cls: "done" },
};
function statutDossierLabel(s) {
  s = DB.normalizeStatut(s);
  return STATUT_DOSSIER[s]?.label || (s || "À valider");
}
function statutDossierCls(s) {
  s = DB.normalizeStatut(s);
  return STATUT_DOSSIER[s]?.cls || "muted";
}

// Ordre canonique d'affichage des groupes de statut (Tableau de bord, filtres).
const STATUT_ORDER = ["brouillon", "a_valider", "a_facturer", "termine"];

// Icône du point de statut dans la liste des dossiers (une par statut de workflow).
const STATUT_DOSSIER_ICON = {
  brouillon: { icon: "pencil", cls: "pending" },
  a_valider: { icon: "clock", cls: "pending" },
  a_facturer: { icon: "file", cls: "blue" },
  termine: { icon: "check", cls: "done" },
};
function statutDossierDot(s) {
  s = DB.normalizeStatut(s);
  const m = STATUT_DOSSIER_ICON[s] || { icon: "clock", cls: "pending" };
  return { svg: ICONS[m.icon] || ICONS.clock, cls: m.cls };
}

// Transitions disponibles du workflow 4 statuts (actions proposées au détail).
// Renvoie, selon le statut NORMALISÉ de la fiche et le rôle courant, la liste
// des boutons d'action : { to, label, kind, needsMotif }.
//   brouillon  → a_valider   Soumettre pour validation   (créateur/tech. affecté ou manager)
//   a_valider  → a_facturer  Valider la fiche            (manager)
//   a_valider  → brouillon   Renvoyer en brouillon       (manager, motif libre)
//   a_facturer → termine     Marquer comme facturé       (manager)
//   a_facturer → a_valider   Repasser à valider          (manager, motif OBLIGATOIRE)
//   termine    → brouillon   Rouvrir                     (responsable seul, motif libre)
function workflowActions(itv) {
  const statut = DB.normalizeStatut(itv?.statut_dossier);
  switch (statut) {
    case "brouillon":
      return [{ to: "a_valider", label: "Soumettre pour validation" }];
    case "a_valider":
      if (!canValidate()) return [];
      return [
        { to: "a_facturer", label: "Valider la fiche", kind: "primary" },
        { to: "brouillon", label: "Renvoyer en brouillon", needsMotif: true },
      ];
    case "a_facturer":
      if (!canValidate()) return [];
      return [
        { to: "termine", label: "Marquer comme facturé", kind: "accent" },
        { to: "a_valider", label: "Repasser à valider", needsMotif: true },
      ];
    case "termine":
      if (!canReopen()) return [];
      return [{ to: "brouillon", label: "Rouvrir", needsMotif: true }];
    default:
      return [];
  }
}

