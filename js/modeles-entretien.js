/* js/modeles-entretien.js — modèles de fiches d'entretien. Extrait d'app.js (BP-03) : script classique, portée globale partagée ;
   chargé avant app.js dans l'ordre de index.html. */
// ---------------------------------------------------------
// Modèles de fiches d'entretien (US-19) — refonte 18/09 (§3.2.11 / §3.2.12),
// feuilles 09/10 (arbitrages 6.2 → 6.6, §3.2.13 pour l'air/air, §3.2.11 pour
// la chaudière bois).
// Chaque champ de mesure porte soit une liste fermée (`options`, feuille),
// soit une saisie libre avec unité (`unite` — affichée à côté du libellé,
// AVANT le champ, jamais en placeholder : convention 09/10, tous formulaires).
// Les blocs des pages 4-5 (« Vérification Groupe extérieur » / « Vérification
// Module hydraulique ») sont partagés entre les fiches ; la chaudière bois
// applique la feuille 09/10 sur la base proposition métier du 05/10/2026
// (page 4 « Vérification Chaudière », page 5 « Vérification réseau
// hydraulique » allégée et dédiée) ; l'air/air reprend le bloc Groupe
// extérieur référentiel (moins l'anti-gel) et gagne la page 5 « Vérification
// Unitée Intérieure » de la feuille 09/10. La fiche solaire (arb. 6.10,
// 09/10 — §3.2.4) est une TRAME : bloc de mesures et liste des types
// d'installation à venir du client (§11 du PRD).
// ---------------------------------------------------------
const LISTES_MESURES = {
  verifFem: ["Absente", "Vérifiée", "Non vérifiée", "Non vérifiable"],
  verifMasc: ["Absent", "Vérifié", "Non vérifié", "Non vérifiable"],
  verifNC: ["Vérifié", "Non vérifié", "Non vérifiable", "Non concerné"],
  ouiNon: ["Oui", "Non"],
  ouiNonNC: ["Oui", "Non", "Non concerné"],
  typeFluide: ["R410A", "R407C", "R32", "R290"],
  presentAbsent: ["Présent", "Absent"],
  presentAbsentNC: ["Présent", "Absent", "Non concerné"],
  etatVisuel: ["Bon", "Moyen", "Très moyen"],
  etatRemplacer: ["Bon", "Moyen", "A remplacer"],
  etatRemplacerNC: ["Bon", "Moyen", "A remplacer", "Non concerné"],
  etatSimple: ["Bon", "Moyen"],
  emetteur: ["P. Chauffant", "Radiateurs"],
  combustion: ["Effectué", "À revoir", "Non effectué"],
  bougie: ["Fonctionne", "À remplacer", "Non concerné"],
  clapet: ["Fonctionne", "À revoir", "Non concerné"],
  verif: ["Vérifié", "Non vérifié", "Non vérifiable"],
  ouiNonAbsente: ["Oui", "Non", "Absente"],
  etatRelevage: ["Bon", "Moyen", "Très moyen", "Absente"],
};

// Page 4 — « Vérification Groupe extérieur » (valeurs de la feuille Air.Eau Sol.E).
// « GWP du fluide » rétabli (arb. 6.6, 09/10 — utile au CERFA ; confirmation
// client conservée au PRD), même code/placement que la page 4 Air/Air.
const BLOC_GROUPE_EXTERIEUR = [
  { code: "ge_tension_alim", libelle: "Tension d'alimentation", options: LISTES_MESURES.verifFem },
  { code: "ge_amperage", libelle: "Ampérage de fonctionnement", options: LISTES_MESURES.verifMasc },
  { code: "ge_tension_intercom", libelle: "Tension intercommunication", options: LISTES_MESURES.verifFem },
  { code: "ge_resserrage_bornes", libelle: "Resserrage des bornes électrique", options: LISTES_MESURES.ouiNon },
  { code: "ge_pression_fluide", libelle: "Pression fluide", options: LISTES_MESURES.verifFem },
  { code: "ge_type_fluide", libelle: "Type de fluide", options: LISTES_MESURES.typeFluide },
  { code: "ge_charge_usine", libelle: "Charge d'usine", unite: "kg" },
  { code: "ge_gwp_fluide", libelle: "GWP du fluide" },
  { code: "ge_antigel", libelle: "Sécurité anti-gel", options: LISTES_MESURES.presentAbsentNC },
  { code: "ge_valeur_antigel", libelle: "Valeur anti-gel" },
  { code: "ge_diff_entree_sortie_air", libelle: "Différence Entrée / Sortie d'air" },
  { code: "ge_nettoyage", libelle: "Nettoyage du groupe extérieur", options: LISTES_MESURES.ouiNon },
  { code: "ge_visuel", libelle: "État visuel du groupe extérieur", options: LISTES_MESURES.etatVisuel },
  { code: "ge_verif_fuite", libelle: "Vérification de fuite frigorigène", options: LISTES_MESURES.verifMasc },
];

// Page 5 — « Vérification Module hydraulique » (valeurs de la feuille).
// La « T° d'air extérieur » est retirée (arb. 6.6, confirmé 09/10 — absente
// de la feuille, comme pour les fiches bois et air/air) ; les valeurs déjà
// saisies sous l'ancien code « t_air_ext » restent en base sans conversion
// et sont rendues « Autres mesures » au PDF.
const BLOC_MODULE_HYDRAULIQUE = [
  { code: "mh_tension_alim", libelle: "Tension d'alimentation", options: LISTES_MESURES.verifFem },
  { code: "mh_tension_intercom", libelle: "Tension intercommunication", options: LISTES_MESURES.verifFem },
  { code: "mh_resserrage_bornes", libelle: "Resserrage des bornes électrique", options: LISTES_MESURES.ouiNon },
  { code: "mh_delta_t_primaire", libelle: "Delta T° d'eau primaire", options: LISTES_MESURES.verif},
  { code: "mh_delta_t_secondaire", libelle: "Delta T° d'eau secondaire 1 et 2", options: LISTES_MESURES.verifNC },
  { code: "mh_debit_primaire", libelle: "Débit d'eau primaire", options: LISTES_MESURES.verifMasc },
  { code: "mh_debit_secondaire", libelle: "Débit d'eau secondaire 1 et 2", options: LISTES_MESURES.verifNC },
  { code: "mh_pression_eau", libelle: "Pression d'eau", unite: "bar" },
  { code: "mh_nettoyage_tamis", libelle: "Nettoyage filtre à tamis", options: LISTES_MESURES.ouiNon },
  { code: "mh_etat_tamis", libelle: "État filtre à tamis", options: LISTES_MESURES.etatRemplacer },
  { code: "mh_nettoyage_boue", libelle: "Nettoyage filtre à boue", options: LISTES_MESURES.ouiNon },
  { code: "mh_etat_boue", libelle: "État filtre à boue", options: LISTES_MESURES.etatRemplacer },
  { code: "mh_disconnecteur", libelle: "Disconnecteur", options: LISTES_MESURES.presentAbsent },
  { code: "mh_mitigeur_ecs", libelle: "Mitigeur ECS", options: LISTES_MESURES.presentAbsentNC },
  { code: "mh_aquastat_c1", libelle: "Aquastat de sécurité circuit 1", options: LISTES_MESURES.presentAbsentNC },
  { code: "mh_aquastat_c2", libelle: "Aquastat de sécurité circuit 2", options: LISTES_MESURES.presentAbsentNC },
  { code: "mh_nettoyage_module", libelle: "Nettoyage du module hydraulique", options: LISTES_MESURES.ouiNon },
  { code: "mh_visuel_module", libelle: "État visuel du module hydraulique", options: LISTES_MESURES.etatVisuel },
  { code: "mh_vanne_z1", libelle: "Vanne d'équilibrage zone 1", options: LISTES_MESURES.presentAbsentNC },
  { code: "mh_vanne_z2", libelle: "Vanne d'équilibrage zone 2", options: LISTES_MESURES.presentAbsentNC },
  { code: "mh_emetteur_z1", libelle: "Émetteur zone 1", options: LISTES_MESURES.emetteur },
  { code: "mh_emetteur_z2", libelle: "Émetteur zone 2", options: LISTES_MESURES.emetteur },
];

// Page 4 chaudière bois — « Vérification Chaudière » (feuille « Entretien
// Chaudière Bois » du classeur 20261009, arb. 6.2/6.3, §3.2.11 — base
// proposition métier 07/10) : l'électricité passe côté page 4, les codes
// « mh_tension_alim » / « mh_resserrage_bornes » sont conservés pour reprendre
// les valeurs déjà saisies ; « Test remplissage granulés » devient
// « Test alimentation granulés » (même mesure), « État du WOS » cède la place
// à l'« État du joint WOS » (code dédié), l'état du creuset disparaît (absent
// de la feuille). Valeurs saisies sous un ancien code : conservées en base
// sans conversion — rendues « Autres mesures » au PDF.
const BLOC_CHAUDIERE_BOIS = [
  { code: "mh_tension_alim", libelle: "Tension d'alimentation", options: LISTES_MESURES.verifFem },
  { code: "mh_resserrage_bornes", libelle: "Resserrage des bornes électrique", options: LISTES_MESURES.ouiNon },
  { code: "etalonnage_granules", libelle: "Étalonnage granulés", options: LISTES_MESURES.ouiNon },
  { code: "test_remplissage_granules", libelle: "Test alimentation granulés", options: LISTES_MESURES.ouiNon },
  { code: "wos_nettoyage", libelle: "Nettoyage WOS", options: LISTES_MESURES.ouiNon },
  { code: "wos_joint", libelle: "État du joint WOS", options: LISTES_MESURES.etatRemplacer },
  { code: "creuset_nettoyage", libelle: "Nettoyage creuset", options: LISTES_MESURES.ouiNon },
  { code: "cendrier_nettoyage", libelle: "Nettoyage cendrier", options: LISTES_MESURES.ouiNon },
  { code: "chambre_combustion", libelle: "Nettoyage chambre de combustion", options: LISTES_MESURES.ouiNon },
  { code: "sonde_lambda", libelle: "Nettoyage sonde Lambda / Fumée", options: LISTES_MESURES.ouiNon },
  { code: "test_combustion", libelle: "Test combustion", options: LISTES_MESURES.ouiNon },
  { code: "chaudiere_nettoyage", libelle: "Nettoyage chaudière", options: LISTES_MESURES.ouiNon },
  { code: "visuel_chaudiere", libelle: "État chaudière", options: LISTES_MESURES.etatSimple },
  { code: "silo_nettoyage", libelle: "Nettoyage silo", options: LISTES_MESURES.ouiNon },
  { code: "visuel_silo", libelle: "État silo", options: LISTES_MESURES.etatSimple },
  { code: "test_clapet", libelle: "Test clapet coupe-feu", options: LISTES_MESURES.ouiNon },
  { code: "test_bougie", libelle: "Test bougie d'allumage", options: LISTES_MESURES.ouiNon },
];

// Page 5 chaudière bois — « Vérification réseau hydraulique » (feuille 09/10) :
// bloc allégé dédié à la fiche bois — électricité déplacée en page 4,
// « Tension intercommunication » disparaît totalement de la fiche, duo
// « Nettoyage / État visuel du module hydraulique » retiré, « Non concerné »
// ajouté sur le nettoyage et l'état du filtre à tamis, « T° d'air extérieur »
// absente de la feuille. Le bloc « Vérification Module hydraulique » partagé
// avec l'Air/Eau-Sol/Eau reste complet (cf. tâche 18).
const BLOC_RESEAU_HYDRAULIQUE_CHAUDIERE = [
  { code: "mh_pression_eau", libelle: "Pression d'eau", unite: "bar" },
  { code: "mh_disconnecteur", libelle: "Disconnecteur", options: LISTES_MESURES.presentAbsent },
  { code: "mh_mitigeur_ecs", libelle: "Mitigeur ECS", options: LISTES_MESURES.presentAbsentNC },
  { code: "mh_vanne_z1", libelle: "Vanne d'équilibrage zone 1", options: LISTES_MESURES.presentAbsentNC },
  { code: "mh_vanne_z2", libelle: "Vanne d'équilibrage zone 2", options: LISTES_MESURES.presentAbsentNC },
  { code: "mh_emetteur_z1", libelle: "Émetteur zone 1", options: LISTES_MESURES.emetteur },
  { code: "mh_emetteur_z2", libelle: "Émetteur zone 2", options: LISTES_MESURES.emetteur },
  { code: "mh_aquastat_c1", libelle: "Aquastat de sécurité circuit 1", options: LISTES_MESURES.presentAbsentNC },
  { code: "mh_aquastat_c2", libelle: "Aquastat de sécurité circuit 2", options: LISTES_MESURES.presentAbsentNC },
  { code: "mh_nettoyage_tamis", libelle: "Nettoyage filtre à tamis", options: LISTES_MESURES.ouiNonNC },
  { code: "mh_etat_tamis", libelle: "État filtre à tamis", options: LISTES_MESURES.etatRemplacerNC },
  { code: "mh_nettoyage_boue", libelle: "Nettoyage filtre à boue", options: LISTES_MESURES.ouiNon },
  { code: "mh_etat_boue", libelle: "État filtre à boue", options: LISTES_MESURES.etatRemplacer },
  { code: "mh_delta_t_primaire", libelle: "Delta T° d'eau primaire", options: LISTES_MESURES.verif },
  { code: "mh_delta_t_secondaire", libelle: "Delta T° d'eau secondaire 1 et 2", options: LISTES_MESURES.verifNC },
  { code: "mh_debit_primaire", libelle: "Débit d'eau primaire", options: LISTES_MESURES.verif },
  { code: "mh_debit_secondaire", libelle: "Débit d'eau secondaire 1 et 2", options: LISTES_MESURES.verifNC },
];

// Page 4 Air/Air — « Vérification Groupe extérieur » (feuille 09/10, arb. 6.6) :
// bloc référentiel de l'Air/Eau-Sol/Eau moins « Sécurité anti-gel » et
// « Valeur anti-gel » (sans objet en air/air) ; « Vérification de fuite
// frigorigène » placée avant le nettoyage/état visuel ; « Différence Entrée /
// Sortie d'air » en fin de page ; « GWP du fluide » rétabli (utile au CERFA —
// confirmation client conservée au PRD).
const BLOC_GROUPE_EXTERIEUR_AIR_AIR = [
  { code: "ge_tension_alim", libelle: "Tension d'alimentation", options: LISTES_MESURES.verifFem },
  { code: "ge_amperage", libelle: "Ampérage de fonctionnement", options: LISTES_MESURES.verifMasc },
  { code: "ge_tension_intercom", libelle: "Tension intercommunication", options: LISTES_MESURES.verifFem },
  { code: "ge_resserrage_bornes", libelle: "Resserrage des bornes électrique", options: LISTES_MESURES.ouiNon },
  { code: "ge_pression_fluide", libelle: "Pression fluide", options: LISTES_MESURES.verifFem },
  { code: "ge_type_fluide", libelle: "Type de fluide", options: LISTES_MESURES.typeFluide },
  { code: "ge_charge_usine", libelle: "Charge d'usine", unite: "kg" },
  { code: "ge_gwp_fluide", libelle: "GWP du fluide" },
  { code: "ge_verif_fuite", libelle: "Vérification de fuite frigorigène", options: LISTES_MESURES.verifMasc },
  { code: "ge_nettoyage", libelle: "Nettoyage du groupe extérieur", options: LISTES_MESURES.ouiNon },
  { code: "ge_visuel", libelle: "État visuel du groupe extérieur", options: LISTES_MESURES.etatVisuel },
  { code: "ge_diff_entree_sortie_air", libelle: "Différence Entrée / Sortie d'air" },
];

// Page 5 Air/Air — « Vérification Unitée Intérieure » (feuille 09/10, arb. 6.4) :
// le bloc hydraulique (sans objet en air/air) disparaît au profit des mesures
// air/air ; « Delta T° d'air » est un champ unique qui remplace les
// T° d'échange des unités 1 à 4.
const BLOC_UNITE_INTERIEURE = [
  { code: "ui_tension_alim", libelle: "Tension d'alimentation", options: LISTES_MESURES.verifFem },
  { code: "ui_tension_intercom", libelle: "Tension intercommunication", options: LISTES_MESURES.verifFem },
  { code: "ui_resserrage_bornes", libelle: "Resserrage des bornes électrique", options: LISTES_MESURES.ouiNon },
  { code: "ui_nettoyage_filtre", libelle: "Nettoyage filtre", options: LISTES_MESURES.ouiNon },
  { code: "ui_etat_filtre", libelle: "État filtre", options: LISTES_MESURES.etatRemplacer },
  { code: "ui_test_condensat", libelle: "Test évacuation condensat", options: LISTES_MESURES.ouiNon },
  { code: "ui_etat_reseau_condensat", libelle: "État réseau condensat", options: LISTES_MESURES.etatVisuel },
  { code: "ui_nettoyage_pompe_relevage", libelle: "Nettoyage pompe de relevage", options: LISTES_MESURES.ouiNonAbsente },
  { code: "ui_etat_pompe_relevage", libelle: "État pompe de relevage", options: LISTES_MESURES.etatRelevage },
  { code: "ui_delta_t_air", libelle: "Delta T° d'air", options: LISTES_MESURES.verif },
  { code: "ui_nettoyage_unite", libelle: "Nettoyage de l'unité intérieure", options: LISTES_MESURES.ouiNon },
  { code: "ui_etat_visuel_unite", libelle: "État visuel de l'unité intérieure", options: LISTES_MESURES.etatVisuel },
];

// Page 4 « Vérification installation solaire » — TRAME d'attente (arb. 6.10,
// 09/10 — §3.2.4) : le contenu du bloc est attendu du client (données à venir,
// §11 du PRD). La page s'affiche en préparation (note explicative) jusqu'à
// réception des champs ; aucun champ frigorigène — CERFA a priori non
// applicable.
const BLOC_INSTALLATION_SOLAIRE = [];

const ENTRETIEN_META = {
  air_eau: {
    label: "Entretien Air/Eau - Sol/Eau",
    icon: "droplet",
    types: ["Aérothermie", "Géothermie", "Aquathermie"],
    maxEq: 5,
    cerfa: true,
    mesures: [
      { section: "Vérification Groupe extérieur", items: BLOC_GROUPE_EXTERIEUR },
      { section: "Vérification Module hydraulique", items: BLOC_MODULE_HYDRAULIQUE },
    ],
  },
  air_air: {
    label: "Entretien Air/Air",
    icon: "wind",
    // Feuille 09/10 (arb. 6.4/6.5/6.6, §3.2.13) : sous-types enfin cohérents
    // avec une PAC air/air ; les fiches existantes (type « Air/Air ») sont
    // requalifiées à l'ouverture — l'ancienne valeur reste proposée au
    // sélecteur, cf. stepEntretienHTML.
    types: ["Mono Split", "Multi Split", "Gainable"],
    maxEq: 5, // même bloc de données que la page 3/6 de « Nouvelle intervention » (6.5)
    cerfa: true,
    mesures: [
      { section: "Vérification Groupe extérieur", items: BLOC_GROUPE_EXTERIEUR_AIR_AIR },
      { section: "Vérification Unitée Intérieure", items: BLOC_UNITE_INTERIEURE },
    ],
  },
  chaudiere: {
    label: "Entretien Chaudière bois",
    icon: "flame",
    // Feuille 09/10 (arb. 6.2) : « Chaudière Déchiquettée » remplace « Pellets » ;
    // les anciens libellés (Granulés, Bûches, Pellets) des fiches existantes
    // restent proposés au sélecteur (option tolérante, cf. stepEntretienHTML).
    types: ["Chaudière Bûches", "Chaudière Granulés", "Chaudière Déchiquettée"],
    maxEq: 5,
    cerfa: false, // aucun champ fluide frigorigène — CERFA n°15497 non applicable (confirmé 09/10)
    prochaine: true, // « Prochaine intervention prévue » conservée (arb. 6.3)
    mesures: [
      { section: "Vérification Chaudière", items: BLOC_CHAUDIERE_BOIS },
      { section: "Vérification réseau hydraulique", items: BLOC_RESEAU_HYDRAULIQUE_CHAUDIERE },
    ],
  },
  // Fiche « Entretien installation solaire » — PRÉPARATION (arb. 6.10, 09/10,
  // §3.2.4) : entrée activée dans le bouton « + » avec la trame commune des
  // entretiens (7 pages + fin d'intervention). La liste des types
  // d'installation et le bloc « Vérification installation solaire » restent
  // attendus du client (§11 du PRD) : en leur absence le type se saisit
  // librement (cf. stepEntretienHTML) et la page de mesures affiche la note
  // de préparation (cf. stepMesuresHTML). Aucun changement de schéma attendu
  // (`type_entretien` en texte).
  solaire: {
    label: "Entretien installation solaire",
    icon: "sun",
    types: [], // liste des types d'installation : à venir du client (§11 du PRD)
    maxEq: 5,
    cerfa: false, // pas de fluide frigorigène — CERFA n°15497 a priori non applicable (6.10)
    trameAttente: true, // trame en préparation : données client à venir
    mesures: [
      { section: "Vérification installation solaire", items: BLOC_INSTALLATION_SOLAIRE },
    ],
  },
};

// Champs réglementaires CERFA n°15497 (US-25), affichés sur une seule page.
const CERFA_FIELDS = [
  { code: "cerfa_etancheite", libelle: "Contrôle d'étanchéité effectué", unite: "Oui / Non" },
  { code: "cerfa_quantite_fluide", libelle: "Quantité de fluide manipulée", unite: "kg" },
  { code: "cerfa_type_fluide", libelle: "Type de fluide", unite: "" },
  { code: "cerfa_dechets", libelle: "Déchets ADR / RID", unite: "Oui / Non" },
  { code: "cerfa_attestation", libelle: "N° attestation de capacité", unite: "" },
];

