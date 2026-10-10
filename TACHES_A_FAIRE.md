# Tâches à faire — V3 (compléments identifiés)

> Dernière mise à jour : 09/10/2026 (arbitrages du classeur « Application 20261009.xlsx », réponses du porteur
> de projet 6.1 → 6.12 — analyse : `documentation/Application 20261009 analyse retours.md`, PRD v1.27) :
> **nouveaux points 15 → 20** (fiche générique : types à 5 valeurs + page 3/6 Équipement/Descriptif ;
> Chaudière bois et Air/Air sur les feuilles 09/10 ; ajustements Air/Eau incl. GWP rétabli et retrait
> T° d'air extérieur ; unités avant le champ de saisie, tous formulaires ; bouton « + » solaire / retrait
> contrat) ; points 10 → 14 actualisés (types, « Page ok », Tableau de bord re-validé).
> Base historique : comparaison spec V3 (§3.3 du PRD) vs implémentation réelle
> (branche `application-v3`, revue du 25/08/2026).
>
> Légende :
> - [x] = terminé
> - [ ] = à faire
> - Le champ « Fichiers » indique où la modification se joue.

---

## 1. Contrat d'entretien annuel (US-24)

**Objectif :** compléter le contrat pour qu'il soit digitalisé de bout en bout
(édition, signatures, PDF).

- [x] Ajouter `uploadSignature` réutilisé pour les signatures du contrat — `supabase.js`
- [x] Génération du PDF du contrat (`generateContratPDF` / `downloadContratPDF`) — `pdf.js`
- [x] Ajouter `DB.getContrat(id)` — `idb.js`
- [x] `renderContrat` en mode édition + capture des signatures client/technicien + bouton PDF — `app.js`
- [x] Liste des contrats (`renderContrats`) — `app.js`
- [x] Détail d'un contrat (`renderDetailContrat`) + partage du PDF — `app.js`
- [x] Routes `#/contrat` / `#/contrats` / `#/detail-contrat/:id` — `app.js`
- [x] Actions navigation (contrat-edit, contrat-delete) — `app.js`

**Reste éventuel :** aucun bloquant identifié.

---

## 2. Statistiques — répartition « par client » (§3.3.5)

**Objectif :** ajouter la ventilation par client au tableau de bord.

- [x] Bloc déjà présent : total, par mois, par type, par technicien, par statut — `app.js` (`renderStats`)
- [x] Ajouter le regroupement `byClient` (nom du client) dans `renderStats`
- [x] Afficher la carte « Par client » (tri décroissant)

**Fichiers :** `app.js`

---

## 3. Planning & Tâches — tris/filtres (§3.2.2)

**Objectif :** ajouter le tri par type et par intervenant aux deux vues d'accueil.

### Planning (accueil)
- [x] Onglet Planning : regroupement par jour, filtres « Type » et « Intervenant » (managers) — `app.js` (`planningHTML`)
- [x] Rendez-vous cliquables → édition (`rdv-edit`) — `app.js`

### Tâches (accueil)
- [x] Filtre par type (Dépannage / Garantie / Diagnostic / Entretiens) et par intervenant — `app.js` (`tachesHTML`)
- [x] Câbler les `<select>` des filtres dans `wireTab()` (mise à jour de `state.tachesFilter` + re-rendu)
      (également câblés : filtres Planning `pf-type`/`pf-tech` et recherche `home-search`)
- [x] Vérifier que le masquage « tâches réalisées par défaut » tient compte des filtres

### CSS
- [x] Ajouter les styles `.filter-row` / `.filter-select` (et `button.rdv-item` éventuel) — `style.css`

**Fichiers :** `app.js`, `style.css`

---

## 4. Rendez-vous — CRUD complet

- [x] Édition d'un rendez-vous existant (`renderRdv(id)` + routes `#/rdv/:id`) — `app.js`
- [x] Suppression d'un rendez-vous (action `rdv-delete`) — `app.js`
- [x] Items du planning cliquables — `app.js`

**Reste éventuel :** aucun bloquant identifié.

---

## 5. Historique équipements — réutilisation au prochain passage (V2)

**Objectif :** pré-remplir l'étape Équipement à partir de l'historique du client.

- [x] L'historisation existe (fin de wizard : `DB.saveClientEquipment`) — `idb.js` / `app.js`
- [x] Dans l'étape « Équipement » du wizard, si le client a un historique :
      proposer un bouton « Reprendre l'équipement enregistré » qui alimente
      `draft.equipements` (`DB.listEquipementsForClient`) — `app.js` (`maybeShowEquipHistory`)

**Fichiers :** `app.js`

---

## 6. Upload Storage photos et documents

**Objectif :** uploader les photos et PDF vers les buckets privés (`photos`, `documents`).

- [x] Méthodes `Supabase.uploadPhoto(id, dataUrl)` et `Supabase.uploadDocument(id, dataUrl)` — `supabase.js`
- [x] En fin de wizard (fiches intervention/entretien) : uploader chaque photo
      du brouillon et renseigner `fichier_url` — `app.js` (finishWizard)
- [x] À l'import d'un devis/facture (`importDocument`) : uploader le PDF et
      renseigner `fichier_url` — `app.js`
- [x] Décision : on conserve le dataURL local (offline-first) **et** on
      renseigne `fichier_url` (chemin Storage) — `app.js`

**Fichiers :** `app.js`

---

## 7. Vérification finale

- [x] Passer en revue `git diff` des fichiers modifiés (commits V3 : b24a23b→a36ca1b) — 2 bugs corrigés :
      position de la signature client dans le PDF du contrat (`pdf.js`) et rechargement
      du contrat en mode édition depuis la base (`app.js` `renderContrat`)
- [x] Contrôler la cohérence de la syntaxe JS (revue manuelle — `node` non installé sur la machine)
- [x] Incrémenter `CACHE_VERSION` dans `sw.js` (→ `climatelec-v12`)
- [x] Mettre à jour la section §3.4 du PRD avec les ajouts livrés (US-24, filtres, stats par client, upload Storage…)

**Fichiers :** `sw.js`, `PRD_App_Interventions_Climat_Elec.md`, `pdf.js`, `app.js`

---

## 8. Cycle de vie de l'appel & RDV → intervention (arbitré le 25/08/2026)

**Objectif :** appliquer l'arbitrage UX documenté dans le PRD (§3.2.5, §3.3.1, §5.2) —
l'appel est l'origine du flux (relié puis masqué) ; un RDV peut produire une intervention.

- [x] Renseigner `appels.rendezvous_id` / `rendezvous.appel_id` à la création d'un RDV depuis un appel — `app.js` (`saveAppelFromDraft("rdv")`, `renderRdv`)
- [x] Renseigner `appels.intervention_id` à la création d'une fiche depuis un appel — `app.js` (`saveAppelFromDraft("intervention")`)
- [x] Masquer de l'onglet Dossiers (bloc « Appels ») les appels reliés (`action_sortie` = `rdv` / `intervention`) ; étiqueter les appels en attente « À traiter » — `app.js` (`dossiersHTML`, `appelHTML`)
- [x] Bouton « Créer l'intervention » sur le détail d'un RDV (fiche pré-remplie client + motif) — `app.js` (`rdvToIntervention`, `renderRdv`)
- [x] Anti-doublon RDV → fiche : `rendezvous.intervention_id` renseigné à la création d'une fiche (validation ou brouillon) ; bouton du RDV bascule vers « Voir / Reprendre la fiche » ; suppression de la fiche → dé-lien du RDV — `app.js` (`linkRdvToIntervention`, `unlinkRdvFromIntervention`, action `rdv-open-intervention`), `supabase/schema.sql` (colonne `rendezvous.intervention_id`)
- [x] Possibilité de « dé-relier » un appel (en cas d'erreur) — `app.js` (`unlinkAppelFromRdv`, `unlinkAppelFromIntervention`, action `rdv-unlink`)
- [x] Élargir `appels_update` (RLS) pour permettre au technicien de relier un appel créé par un manager — `supabase/schema.sql`
- [x] Incrémenter `CACHE_VERSION` dans `sw.js` (→ `climatelec-v14`)

**Fichiers :** `app.js`, `idb.js`, `supabase/schema.sql`, `sw.js`

---

## Résumé des prochaines étapes prioritaires

| Priorité | Tâche |
|---|---|
| 1 | ~~Câbler les filtres Tâches (`wireTab`) + styles filtre (points 3)~~ ✅ |
| 2 | ~~Stats « par client » (point 2)~~ ✅ |
| 3 | ~~Réutilisation historique équipement dans le wizard (point 5)~~ ✅ |
| 4 | ~~Upload photos/documents en fin de wizard + import (point 6)~~ ✅ |
| 5 | ~~Vérification finale + `sw.js` + PRD (point 7)~~ ✅ |
| 6 | ~~Cycle de vie de l'appel & RDV → intervention (point 8)~~ ✅ |
| 7 | ~~Option « + de 15 ans » Type de bâtiment (point 9)~~ ✅ |
| 8 | ~~Refonte fiche « Entretien Chaudière bois » (point 10)~~ ✅ (07/10 — à actualiser avec la feuille 09/10, point 16) |
| 9 | ~~Refonte fiche « Entretien Air/Eau-Sol/Eau » (point 11)~~ ✅ (07/10 — ajustements 09/10 au point 18) |
| 10 | Fin d'intervention commune (point 12) — chantier partagé aux 4 fiches (fiche générique + 3 entretiens) ; « Page ok » précisée (6.9) |
| 11 | Tableau de bord = accueil (point 13) — re-validé au 09/10, à implémenter (drill-down + tris Nom/CP/Ville) |
| 12 | ~~Fiche Air/Air — page 5 « Unités intérieures » (point 14)~~ → arbitré 09/10, implémenté au point 17 ✅ |
| 13 | Retours 09/10 — fiche générique « Nouvelle intervention » (point 15) |
| 14 | Retours 09/10 — fiche « Chaudière bois » (point 16) |
| 15 | ~~Retours 09/10 — fiche « Air/Air » (point 17)~~ ✅ |
| 16 | Retours 09/10 — ajustements fiche « Air/Eau-Sol/Eau » (point 18) |
| 17 | Unités avant le champ de saisie — tous formulaires (point 19) |
| 18 | Bouton « + » — retrait « Contrat d'entretien annuel », préparation « Entretien installation solaire » (point 20) |

---

## 9. Ajout option "+ de 15 ans" dans Type de bâtiment (18/09/2026)

**Objectif :** ajouter une quatrième option "+ de 15 ans" à la liste déroulante "Type de bâtiment" sur tous les formulaires.

**Liste actuelle :** Professionnel / - de 2 ans / + de 2 ans  
**Liste cible :** Professionnel / - de 2 ans / + de 2 ans / **+ de 15 ans**

### Formulaires concernés
- [x] Écran « Nouvel appel » (`renderAppel`) — `app.js` ligne ~783
- [x] Wizard intervention/entretien étape Client — `app.js` ligne ~1162
- [x] Maquettes HTML (documentation) — `Maquettes.html` lignes ~293, ~435, ~925, ~960, ~995
- [x] Incrémenter `CACHE_VERSION` dans `sw.js` (→ `climatelec-v15`)

**Sans modification** (affichent la valeur stockée `client.type_batiment`, vérification seulement) :
PDF (`pdf.js` ~102, ~453) et détail de fiche (`app.js` ~1854).

**Fichiers :** `app.js`, `Maquettes.html`, `sw.js`

**Note :** Le PRD a été mis à jour (§3.2.5) pour refléter cette évolution.

---

## 10. Refonte du formulaire « Entretien Chaudière bois » (18/09/2026)

**Objectif :** appliquer la nouvelle demande client (classeur `documentation/Application - 20260918.xlsx`,
feuille « Entretien Chaudière Bois », mention « A FAIRE ») : la fiche chaudière bois abandonne son bloc de
mesures spécifique (combustion, WOS, creuset…) et s'aligne sur la structure de la fiche Air/Eau-Sol/Eau —
pages « Vérification Groupe extérieur » et « Vérification Module hydraulique », pagination en 7 pages,
fin d'intervention alignée sur la page 6/6 de « Nouvelle intervention ». Détail complet au **§3.2.11 du PRD**
(points arbitrés le 09/10 — cf. « Points de vigilance » ci-dessous et tâche 16).

> **Implémenté le 07/10/2026** (arbitrage : variante « proposition métier » de la maquette du 05/10/2026).

- [x] Reprendre la structure cible dans `ENTRETIEN_META.chaudiere` — **variante « proposition métier »** :
      page 4 « Vérification chaudière bois » (mesures spécifiques réintégrées : étalonnage/test remplissage
      granulés, combustion, bougie d'allumage, clapet coupe-feu, WOS, creuset, cendrier, sonde lambda,
      chambre de combustion, chaudière, silo, états visuels — en listes fermées) et page 5
      « Vérification Module hydraulique » (bloc partagé avec la fiche Air/Eau-Sol/Eau) — `app.js` (`BLOC_CHAUDIERE_BOIS`, `ENTRETIEN_META.chaudiere`)
- [x] Passer les champs de mesure de **saisies libres (avec unités)** à des **listes fermées** conformes à la
      feuille (Absente/Vérifiée/Non vérifiée/Non vérifiable · Oui/Non · R410A/R407C/R32/R290 ·
      Présent/Absent/Non concerné · Bon/Moyen/Très moyen · Bon/Moyen/A remplacer · P. Chauffant/Radiateurs) —
      rendu partagé `stepMesuresHTML` : champ portant `options` rendu en `<select>` (les 4 champs sans liste
      de valeurs restent en saisie libre avec unité). Une valeur déjà enregistrée hors liste (ancienne
      saisie libre) reste sélectionnable — `app.js` (`LISTES_MESURES`, `BLOC_GROUPE_EXTERIEUR`,
      `BLOC_MODULE_HYDRAULIQUE`, `mesureInputHTML`), la fiche Air/Eau-Sol/Eau a évolué de la même façon ;
      styles `.mesure-field` — `style.css`
- [x] Aligner la pagination du wizard sur la feuille : séparation « Client » / « Entretien » (la page 2
      porte désormais type d'entretien, date, heures d'arrivée/départ, forfait déplacement) et
      « Observation & photos » / « Pièces utilisées » ; une page de mesures par section → 7 pages +
      fin d'intervention (8 étapes) — `app.js` (`wizardSteps`, `stepEntretienHTML`, `stepObservationPhotosHTML`,
      `stepPiecesHTML`). Fiche Air/Air passée à la même structure (pages 4-5 et contenus inchangés — point 14)
- [x] Liste « Type d'entretien » : **conservée** (Granulés / Bûches / Pellets) — la liste de la feuille
      (Aérothermie/Géothermie/Aquathermie) est incohérente avec une chaudière bois ; à confirmer tout de
      même avec le client — `app.js` (`ENTRETIEN_META.chaudiere.types`)
      → **Arbitré le 09/10 (6.2)** : la liste 18/09 est remplacée par celle, cohérente, de la feuille 09/10 —
      **« Chaudière Bûches / Chaudière Granulés / Chaudière Déchiquettée »** (« Pellets » remplacé par
      « Déchiquettée », confirmé) ; implémentation à la **tâche 16**
- [ ] Fin d'intervention (page finale partagée) : règles 18/09 extraites au **point 12** (communes à la fiche
      générique « Nouvelle intervention » et aux 3 fiches d'entretien) — un seul chantier
- [x] Arbitré le sort du champ « Prochaine intervention prévue » : **conservé** à la page finale
      (variante proposition métier ; retrait éventuel à confirmer) — `app.js` (`stepSignHTML`, flag `prochaine: true`), `supabase/schema.sql` inchangé
      → **Arbitré définitivement le 09/10 (6.3) : conservé** — rien à faire
- [x] Maintenu le bloc CERFA n°15497 non applicable (`cerfa: false`) — aucun champ fluide frigorigène dans
      les blocs de mesures chaudière bois (fluides de la feuille retirés)
- [x] PDF : regroupement des mesures par section (sous-titres de section du modèle, puis « Autres mesures »
      pour les anciens codes, sans conversion des fiches existantes) ; libellé « Remarque / Observation »
      à la place d'« Action réalisée » pour les fiches d'entretien — `pdf.js` (bloc « Mesures »).
      **Fiabilité 07/10 :** saut de page automatique (`ensureSpace`) sur toutes les sections et lignes
      (Mesures/CERFA multi-pages, photos, signatures), libellés et valeurs découpés (plus de chevauchement),
      données jusqu'ici manquantes ajoutées (type d'entretien + détail, année d'installation, prochaine
      intervention prévue chaudière, unités des quantités CERFA), photos sans déformation (ratio préservé).
- [x] Maquette de documentation : écran « Entretien Chaudière bois — proposition métier » — `Maquettes.html`
      (livrée 05/10/2026, commit `d53a9ce`)
- [x] Incrémenter `CACHE_VERSION` dans `sw.js` (→ `climatelec-v16`)

**Fichiers :** `app.js`, `pdf.js`, `style.css`, `Maquettes.html`, `sw.js` (+ `supabase/schema.sql` si retrait du champ « Prochaine intervention prévue »)

**Points de vigilance (mise à jour 09/10 : arbitrages rendus au §3.2.11 du PRD — implémentation à la tâche 16) :**
- Types d'entretien : **Bûches / Granulés / Déchiquettée** (le « Pellets » du 07/10 est remplacé par « Déchiquettée ») ;
- Page 4 « Vérification Chaudière » : précisions 09/10 — **état du joint WOS** (Bon/Moyen/A remplacer),
  **test alimentation granulés** (Oui/Non) ;
- Page 5 renommée **« Vérification réseau hydraulique »** et **allégée** : retrait tensions d'alimentation /
  intercommunication / resserrage des bornes (électricité passée page 4) et du duo « Nettoyage / État visuel
  du module hydraulique » ; ajout « **Non concerné** » sur nettoyage/état du filtre à tamis —
  uniquement pour la fiche bois (le bloc partagé Air/Eau reste complet, cf. tâche 18) ;
- « Prochaine intervention prévue » **conservée** (6.3) ; CERFA confirmé **non applicable** ;
- La feuille « Entretien Air.Air » du 09/10 a ses propres pages (voir tâche 17).
- Historique (résolu par les 09/10) : types 18/09 Aérothermie/Géothermie/Aquathermie copiés de la feuille
  Air.Eau (remplacés), mesures spécifiques disparues (réintégrées), « Prochaine intervention prévue »
  absente (conservée). La maquette du 05/10/2026 « proposition métier » avait préfiguré la variante
  implémentée le 07/10/2026.

---

## 11. Refonte du formulaire « Entretien Air/Eau-Sol/Eau » (18/09/2026)

**Objectif :** appliquer la feuille « Entretien Air.Eau Sol.E » du classeur `documentation/Application - 20260918.xlsx`
(feuille **de référence** du classeur — non marquée « A FAIRE » ; les fiches Chaudière bois et Air.Air y sont
alignées) : pages « Vérification Groupe extérieur » et « Vérification Module hydraulique » avec listes de valeurs
fermées, pagination en 7 pages, fin d'intervention alignée sur la page 6/6 de « Nouvelle intervention ».
Détail complet au **§3.2.12 du PRD**. À traiter **avant ou avec le point 10** : la fiche Air/Eau-Sol/Eau sert
de référence aux pages 4-5 partagées.

- [x] `ENTRETIEN_META.air_eau` : sections renommées en « Vérification Groupe extérieur » /
      « Vérification Module hydraulique » avec les champs et listes de valeurs de la feuille
      (livré avec le point 10, 07/10/2026) — `app.js` (`BLOC_GROUPE_EXTERIEUR`, `BLOC_MODULE_HYDRAULIQUE`)
- [x] Types d'entretien : ajout de « Aquathermie » (liste cible Aérothermie / Géothermie / Aquathermie,
      remplace « Air/Eau (aérothermie) » / « Sol/Eau (géothermie) ») ; anciens libellés migrés à l'ouverture
      des fiches existantes — `app.js` (`ENTRETIEN_META.air_eau.types`, `loadDraftFromIntervention`)
- [x] Mesures en listes fermées + pagination 7 pages : livrées avec le chantier partagé du
      point 10 ; fin d'intervention commune : chantier du **point 12** (page finale existante, règles à appliquer)
- [x] CERFA n°15497 : maintenu (`cerfa: true`), cohérent avec la feuille (champs fluides frigorigènes présents)
- [x] PDF : rendu des nouvelles sections de mesures (regroupement par section) — `pdf.js` (bloc « Mesures »)
- [x] Maquette de documentation : écran « Entretien Air/Eau - Sol/Eau — refonte 18/09 » (pages 4/7 Groupe extérieur
      et 5/7 Module hydraulique, listes fermées) — `Maquettes.html` (livrée 05/10/2026, commit `d53a9ce`)
- [x] Incrémenter `CACHE_VERSION` dans `sw.js` (→ `climatelec-v16`, cumulé avec le point 10)

**Fichiers :** `app.js`, `pdf.js`, `style.css`, `Maquettes.html`, `sw.js`

**Points de vigilance (mise à jour 09/10 : arbitrages rendus au §3.2.12 du PRD ; ajustements à la tâche 18) :**
- « T° d'air extérieur » : **retrait confirmé au 09/10 (6.6)** — la fin de bloc conservée le 07/10
  (`t_air_ext`) est à retirer de la fiche Air/Eau-Sol/Eau (`BLOC_MODULE_HYDRAULIQUE`) ;
- « GWP du fluide » : **champ rétabli au 09/10 (6.6)** en page 4 (utile au CERFA) — confirmation client
  restant consignée au PRD (tâche 18) ;
- Champs sans liste de valeurs (« Charge d'usine », « Valeur anti-gel », « Différence Entrée/Sortie d'air »,
  « Pression d'eau ») : **saisie libre conservée (6.8)**, **unités affichées avant le champ** (convention
  tous formulaires, cf. tâche 19) — la question des unités attendues reste ouverte pour le client (point §11 du PRD) ;
- « Année d'installation » : **conservée (6.7)** ; « Descriptif » : **obligatoire (6.7)**, hérité de la
  page 3/6 arbitrée (cf. tâches 15) ;
- Données existantes saisies avec unités (V, bar, °C…) : conservées en base, pas de conversion prévue
  (table `mesures` typée, aucun changement de schéma).
- Historique : la feuille « Entretien Air.Air » 18/09 (contenu copié de la feuille Air.Eau) a été remplacée
  par la feuille 09/10 dédiée — cf. point 10.

---

## 12. Fin d'intervention commune — règles statut & signatures (18/09)

**Objectif :** appliquer les règles de la feuille 18/09 à la page finale « Devis & Signature », désormais
**commune** à la fiche générique « Nouvelle intervention » (page 6/6) et aux 3 fiches d'entretien (page finale,
après 7/7 « Pièces utilisées »). Maquette dédiée « Fin d'intervention » (`documentation/Maquettes.html`,
écran `fin_intervention`, groupe « Refonte 18/09 — à valider ») ; spécification au **§3.2.14 du PRD**.

- [ ] Déplacer la saisie du **statut d'intervention** en tête de l'étape finale (avant les signatures) — `app.js`
      (`stepSignHTML` ligne ~1609 ; le statut est actuellement saisi à l'étape « Intervention »)
- [ ] **Verrouiller les signatures** tant que le statut est « À effectuer » (débloquées si « Effectuée » ou
      « Effectuée, suite à prévoir ») — `app.js` (`stepSignHTML` / `wireSignStep` ligne ~1662)
- [ ] Signature **technicien obligatoire** (actuellement « facultative ») — `app.js` (`stepSignHTML` ligne ~1645,
      validation dans `finishWizard` ligne ~1728)
- [ ] Signature **client obligatoire si le client est présent** — `app.js` (`readSignStep` / `finishWizard`)
- [ ] **« Soumettre pour validation » désactivé** tant que la fiche n'est pas signée (technicien + client si
      présent) — `app.js` (`finishWizard` ligne ~1728, workflow `brouillon → a_valider`)
- [ ] Ajouter la case **« Page ok »** — **précision arbitrée le 09/10 (6.9)** : « Page ok » est le **résumé/attestation
      que toutes les informations obligatoires sont renseignées** ; les champs « obligatoires » **ne bloquent pas le
      passage à la page suivante**, ils conditionnent le **contrôle de complétude à la validation** ; **conserver
      l'astérisque** des champs obligatoires (toutes sections : intervention + entretiens). À persister si besoin :
      `app.js`, `idb.js`, `supabase/schema.sql` (colonne à prévoir, ex. `page_ok bool`)
- [ ] « Enregistrer comme brouillon » conservé à la page finale (déjà présent à toutes les étapes — à vérifier) — `app.js`
- [ ] PDF : figurer ou non la case « Page ok » sur le PDF généré (à arbitrer) — `pdf.js`
- [ ] Incrémenter `CACHE_VERSION` dans `sw.js` (→ `climatelec-v16`, cumulé avec les points 10-11-13-14)

**Fichiers :** `app.js`, `pdf.js`, `sw.js` (+ `idb.js`, `supabase/schema.sql` si « Page ok » persistée)

**Points de vigilance (mise à jour 09/10, 6.9 — précision arbitrée au §3.2.14 du PRD) :**
- « Page ok » = **résumé de la complétude** des champs obligatoires (astérisque conservé) ; les champs
  « obligatoires » ne bloquent **pas la navigation** vers la page suivante, seulement la **validation** finale —
  s'assurer que la validation de complétude est appliquée par page/à la soumission, sur toutes les sections
  (intervention + entretiens).

---

## 13. Tableau de bord = écran d'accueil (retours 18/09 + 09/10 — validé, à implémenter)

**Objectif :** remplacer « accueil = planning » (arbitrage du 16/08) par un **Tableau de bord** : vue synthèse
par statut du workflow (US-13 · US-15) + bloc « Appels — À traiter ». Les onglets Planning / Tâches / Dossiers
sont **conservés** ; seul l'écran ouvert par défaut change. Maquette dédiée (écran `dashboard`, groupe
« Refonte 18/09 — à valider ») ; spécification au **§3.2.15 du PRD** — **validée au 09/10**
(demande re-confirmée, drill-down + tris arbitrés 6.12).

- [x] **Faire valider la maquette** « Tableau de bord » par le client (en remplacement de « accueil = planning »
      du 16/08) — **validée** : demande re-confirmée par le client au 09/10 (« Page d'accueil = Tableau de
      bord », 2e mention) et précisions arbitrées (6.12, cf. ci-dessous et §3.2.15 du PRD)
- [ ] Afficher le Tableau de bord comme **vue par défaut de l'accueil** — blocs par statut de dossier
      (À valider, À facturer, À vérifier, À envoyer…) + bloc **« Appels — À traiter »** en tête (les appels
      « Enregistrer sans planifier » y arrivent) — `app.js` (rendu des onglets lignes ~503-505 ; `dossiersHTML`
      ligne ~636 réutilisable comme base des blocs par statut)
- [ ] **Retours 09/10 (arbitrés 6.12)** : **drill-down par statut** — clic sur un groupe de statut ouvre la
      liste des dossiers de ce statut ; **tris Nom / Code postal / Ville** (en plus des tris type/intervenant) —
      valables **aussi pour le technicien, dans son périmètre** — `app.js`
- [ ] Arbitrer le bloc **« Devis en cours »** de la maquette : le workflow (§3.3.4) n'a pas de statut « devis » —
      proposer un bloc fiches portant l'indicateur « devis souhaité », ou le retirer — à arbitrer avec le client
- [ ] **Vue par rôle** : toute l'équipe pour Régis/Delphine, propres lignes pour Jérémy (règles §3.2.2 conservées) — `app.js`
- [ ] Incrémenter `CACHE_VERSION` dans `sw.js` (→ `climatelec-v16`, cumulé)

**Fichiers :** `app.js`, `style.css`, `sw.js`

**Points de vigilance (mise à jour 09/10, cf. PRD §3.2.15) :**
- Maquette **validée** (re-demande explicite 09/10) ; précisions arbitrées (6.12) : drill-down, tris
  Nom/CP/Ville, **périmètre technicien inclus**.
- Bloc « Devis en cours » sans équivalent dans le workflow de statuts (§3.3.4) — à arbitrer.

---

## 14. Fiche « Entretien Air/Air » — page 5 « Unités intérieures » (proposition métier, 05/10/2026)

> **✅ Arbitré le 09/10/2026** : la feuille « Entretien Air.Air » du classeur `Application 20261009.xlsx`
> lève les deux anomalies du 18/09 (types + page 5) et converge avec la proposition métier, avec des
> nuances arbitrées (réponses 6.4, 6.5, 6.6 — détail au §3.2.13 du PRD). L'implémentation est portée par la
> **tâche 17** ci-dessous : liste type Mono Split / Multi Split / Gainable, page 5 « Vérification Unitée
> Intérieure » extraites de la feuille 09/10, page 4 sans « anti-gel », « Delta T° d'air » **champ unique**
> (nuance vs la maquette qui prévoyait des T° par unité 1 à 4), équipement = **même bloc que la page 3/6**
> (la structure dédiée 5 lignes 1 extérieure + 4 intérieures est abandonnée), GWP du fluide rétabli
> (confirmation client conservée au PRD), « T° d'air extérieur » retirée, CERFA maintenu.
> → **Implémenté le 09/10/2026** — voir la tâche 17.

---

## 15. Fiche générique « Nouvelle intervention » — retours 09/10 (arbitrés)

**Objectif :** appliquer les arbitrages du 09/10 à la fiche générique (analyse
`documentation/Application 20261009 analyse retours.md` §2, réponses 6.1, 2.2, 6.7 ; PRD §3.2.6).

- [ ] Liste « **Type d'intervention** » (page 2) : passer de 3 à **5 valeurs** — **Sav · Garantie ·
      Dépannage · Diagnostic · Sur devis** (orthographe imposée « Diagnostic », jamais « Diagnostique »)
      — `app.js` (select `f-type-itv`, `stepInterventionHTML`)
- [ ] Page 3/6 : fusionner l'étape **Équipement** et le **« Descriptif »** (saisie sur la même page) ;
      le descriptif devient **obligatoire** — `app.js` (`stepEquipementHTML`, validation `finishWizard`)
- [ ] Équipement : **gestion actuelle conservée** (base de données équipements avec bouton
      « Reprendre l'équipement enregistré ») ; rendre **obligatoires** les champs **Intitulé, Marque,
      Modèle, N° de série** — `app.js` (validation équipements ; le PDF/détail affichent déjà les champs)
- [ ] Vérifier l'orthographe « Diagnostic » partout (formulaires, filtres, statistiques, PDF) — `app.js`, `pdf.js`
- [ ] Pré-remplissage : le descriptif hérité de l'appel/RDV reste reporté sur la page 3/6 — `app.js`
- [ ] PDF : bloc Équipement + Descriptif conforme à la fusion — `pdf.js`
- [ ] Incrémenter `CACHE_VERSION` dans `sw.js`

**Fichiers :** `app.js`, `pdf.js`, `sw.js`

---

## 16. Fiche « Entretien Chaudière bois » — feuille 09/10 (arbitrée)

**Objectif :** appliquer la feuille « Entretien Chaudière Bois » du classeur `Application 20261009.xlsx`
(arbitrage 6.2/6.3 ; PRD §3.2.11). La fiche 07/10 (proposition métier) sert de base.

- [ ] Types d'entretien : passer à **« Chaudière Bûches · Chaudière Granulés · Chaudière Déchiquettée »**
      (« Pellets » remplacé par « Déchiquettée ») — `app.js` (`ENTRETIEN_META.chaudiere.types`) ;
      ancien libellé « Pellets » des fiches existantes conservé/toléré à l'ouverture (pas de conversion)
- [ ] Page 4 « Vérification Chaudière » : intégrer les précisions 09/10 — **état du joint WOS**
      (Bon/Moyen/A remplacer, champ séparé du nettoyage WOS) et **« Test alimentation granulés »** (Oui/Non) —
      `app.js` (`BLOC_CHAUDIERE_BOIS`)
- [ ] Page 5 renommée **« Vérification réseau hydraulique »** et **allégée** (fiche bois uniquement) :
      retirer « Tension d'alimentation », « Tension intercommunication » (disparait totalement de la fiche
      bois), « Resserrage des bornes électrique », « Nettoyage du module hydraulique » et « État visuel du
      module hydraulique » ; ajouter l'option « Non concerné » sur le nettoyage **et** l'état du filtre
      à tamis — `app.js` (bloc dédié chaudière ; ne pas toucher à `BLOC_MODULE_HYDRAULIQUE` partagé
      avec l'Air/Eau)
- [ ] PDF : rendu des libellés « Vérification Chaudière » / « Vérification réseau hydraulique » — `pdf.js`
- [ ] Incrémenter `CACHE_VERSION` dans `sw.js` (cumulé)

**Fichiers :** `app.js`, `pdf.js`, `sw.js`

---

## 17. Fiche « Entretien Air/Air » — feuille 09/10 (arbitrée)

**Objectif :** appliquer la feuille « Entretien Air.Air » du classeur `Application 20261009.xlsx`
(arbitrages 6.4/6.5/6.6 ; PRD §3.2.13 ; remplace la tâche 14 ci-dessus).

> **Implémenté le 09/10/2026** (comparaison sur la feuille du classeur ; PDF inchangé — le bloc
> « Mesures » regroupe par section du modèle, les anciens codes passant en « Autres mesures »).

- [x] Types d'entretien : **Mono Split · Multi Split · Gainable** — `app.js` (`ENTRETIEN_META.air_air.types`,
      `type_entretien_detail`) ; fiches existantes (type « Air/Air ») requalifiées à l'ouverture :
      l'ancienne valeur reste proposée au sélecteur (option tolérante, même mécanisme que les
      mesures hors liste) — `app.js` (`stepEntretienHTML`)
- [x] Page 5 : remplacer « Unités intérieures » (maquette) par **« Vérification Unitée Intérieure »**
      de la feuille 09/10 — tension d'alimentation, tension intercommunication, resserrage des bornes
      électrique, nettoyage filtre (Oui/Non) + état filtre (Bon/Moyen/A remplacer), test évacuation
      condensat (Oui/Non) + état réseau condensat (Bon/Moyen/Très moyen), nettoyage pompe de relevage
      (Oui/Non/Absente) + état pompe de relevage (Bon/Moyen/Très moyen/Absente), **Delta T° d'air**
      (Vérifié/Non vérifié/Non vérifiable), nettoyage unité intérieure (Oui/Non) + état visuel
      (Bon/Moyen/Très moyen) — `app.js` (`ENTRETIEN_META.air_air` pages 4-5, `BLOC_UNITE_INTERIEURE`,
      listes `ouiNonAbsente` / `etatRelevage` / `verif` ajoutées à `LISTES_MESURES`)
- [x] Page 4 « Vérification Groupe extérieur » : reprendre le bloc référentiel **moins** les champs
      « Sécurité anti-gel » et « Valeur anti-gel » (retrait en air/air) ; « Vérification de fuite
      frigorigène » **avant** nettoyage/état visuel ; « Différence Entrée / Sortie d'air » en fin de page —
      `app.js` (`BLOC_GROUPE_EXTERIEUR_AIR_AIR`)
- [x] Retirer les « T° échange unité 1 à 4 » (remplacés par le **champ unique « Delta T° d'air »**, 6.4)
      — `app.js` (page 5 remplacée ; anciens codes conservés en base sans conversion)
- [x] Équipement (page 3) : abandonner la structure dédiée « 1 extérieure + 4 intérieures » au profit du
      **même bloc que la page 3/6** de « Nouvelle intervention » (base équipements + rappel, champs
      Intitulé/Marque/Modèle/N° de série obligatoires — 6.5) — `app.js` (`ENTRETIEN_META.air_air` :
      `maxEq` 5 → 3, bloc équipement déjà partagé avec la fiche générique)
- [x] **GWP du fluide** : champ rétabli en page 4 (utile au CERFA ; confirmation client conservée au PRD)
      — `app.js` (`ge_gwp_fluide` après « Charge d'usine »), `pdf.js` (rendu générique, rien à faire)
- [x] « T° d'air extérieur » : absente (retrait conforme aux feuilles 18/09 et 09/10) — rien à ajouter
- [x] CERFA n°15497 maintenu (`cerfa: true`) — `app.js`, `pdf.js` (inchangé)
- [x] Maquette de documentation « Entretien Air/Air » alignée sur la feuille 09/10 — `Maquettes.html`
- [x] Incrémenter `CACHE_VERSION` dans `sw.js` (→ `climatelec-v17`)

**Fichiers :** `app.js`, `pdf.js`, `Maquettes.html`, `sw.js`

---

## 18. Fiche « Entretien Air/Eau-Sol/Eau » — ajustements 09/10

**Objectif :** la feuille de référence 09/10 est identique au 18/09 — appliquer les arbitrages
6.6 / 6.7 / 6.8 récents (PRD §3.2.12).

- [ ] Retirer « **T° d'air extérieur** » (`t_air_ext`) de la fin de bloc hydraulique (retrait confirmé
      au 09/10) — `app.js` (`BLOC_MODULE_HYDRAULIQUE`), `pdf.js`
- [ ] Ajouter le champ « **GWP du fluide** » à la page 4 « Vérification Groupe extérieur » (saisie,
      utile au CERFA ; confirmation client conservée au PRD) — `app.js`, `pdf.js`
- [ ] Champs sans liste de valeurs : saisie libre conservée (6.8), **unités affichées avant le champ**
      (cf. tâche 19) ; question des unités laissée ouverte (point §11 du PRD)
- [ ] « Année d'installation » : conservée (6.7) — rien à faire ; « Descriptif » ajouté via la tâche 15
      (héritage page 3/6 des fiches d'entretien)
- [ ] Incrémenter `CACHE_VERSION` dans `sw.js` (cumulé)

**Fichiers :** `app.js`, `pdf.js`, `sw.js`

---

## 19. Unités affichées avant le champ de saisie — tous formulaires (09/10)

**Objectif :** convention validée par le porteur de projet : **l'unité apparaît avant le champ de saisie,
pas dans le champ** (pas de placeholder d'unité) — tous formulaires (wizard, mesures, CERFA).

- [ ] `mesureInputHTML` : retirer l'unité du `placeholder` des champs en saisie libre
      (elle est déjà indiquée à côté du libellé, **avant** le champ — conserver/renforcer cet affichage)
      — `app.js` (ligne ~1619), `style.css` le cas échéant
- [ ] Vérifier les autres champs à unité (CERFA : quantité kg, déchets, etc.) pour le même rendu — `app.js`
- [ ] PDF : unités déjà portées sur les libellés — vérifier qu'elles restent affichées à côté du champ — `pdf.js`
- [ ] Incrémenter `CACHE_VERSION` dans `sw.js` (cumulé)

**Fichiers :** `app.js`, `pdf.js`, `style.css`, `sw.js`

---

## 20. Bouton « + » — solaire préparé, retrait de l'entrée « Contrat d'entretien annuel » (09/10)

**Objectif :** appliquer la feuille « Bouton + » du classeur 09/10 arbitrée (6.10, 6.11 ; PRD §3.2.4).

- [ ] Retirer l'entrée « **Contrat d'entretien annuel** » de la feuille d'action du bouton « + » (le flux
      `#/contrat`, la liste `#/contrats` et les données existantes restent accessibles — US-24 conservée)
      — `app.js` (menu, ligne ~765)
- [ ] Ajouter l'entrée « **Entretien installation solaire** » (**préparation** 6.10) : clé `solaire` dans
      `ENTRETIEN_META` (trame commune 7 pages + fin d'intervention, bloc « Vérification installation
      solaire » à renseigner dès réception des données du client, CERFA a priori non applicable) ;
      l'activer à l'entrée du menu dès la trame en place — `app.js`, `pdf.js` (libellé entretien),
      `supabase/schema.sql` (aucun changement attendu : `type_entretien` en texte)
- [ ] Filtres/tris « Entretiens » (planning, tâches, accueil) : prévoir la ventilation du nouveau type
      solaire — `app.js`
- [ ] Incrémenter `CACHE_VERSION` dans `sw.js` (cumulé)

**Fichiers :** `app.js`, `pdf.js`, `Maquettes.html`, `sw.js`
**Reste attendu du client :** contenu du bloc « Vérification installation solaire » et liste des types
d'installation (point ouvert §11 du PRD).