# Tâches à faire — V3 (compléments identifiés)

> Dernière mise à jour : 07/10/2026 (points 12 à 14 — retours « refonte 18/09 » matérialisés dans la mise à jour
> des maquettes du 05/10/2026, commit `d53a9ce` : fin d'intervention commune, Tableau de bord = accueil,
> page 5 « Unités intérieures » air/air ; les écrans maquette des points 10 et 11 sont livrés par ce même commit).
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
| 1 | ~~Câbler les filtres Tâches (`wireTab`) + styles filtre (points 3)~~ ✅
| 2 | ~~Stats « par client » (point 2)~~ ✅ |
| 3 | ~~Réutilisation historique équipement dans le wizard (point 5)~~ ✅ |
| 4 | ~~Upload photos/documents en fin de wizard + import (point 6)~~ ✅ |
| 5 | ~~Vérification finale + `sw.js` + PRD (point 7)~~ ✅ |
| 6 | ~~Cycle de vie de l'appel & RDV → intervention (point 8)~~ ✅ |
| 7 | ~~Option « + de 15 ans » Type de bâtiment (point 9)~~ ✅ |
| 8 | Refonte fiche « Entretien Chaudière bois » (point 10) — après confirmation client (cf. §3.2.11 du PRD) |
| 9 | Refonte fiche « Entretien Air/Eau-Sol/Eau » (point 11) — feuille de référence du classeur, à traiter avant/avec le point 10 |
| 10 | Fin d'intervention commune (point 12) — chantier partagé aux 4 fiches (fiche générique + 3 entretiens) |
| 11 | Tableau de bord = accueil (point 13) — après validation de la maquette par le client |
| 12 | Fiche Air/Air — page 5 « Unités intérieures » (point 14) — après validation de la proposition métier |

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
(dont les points à confirmer avec le client).

- [ ] Reprendre la structure cible dans `ENTRETIEN_META.chaudiere` : remplacer les sections
      « Électrique / hydraulique » + « Combustion & nettoyage » par « Vérification Groupe extérieur » et
      « Vérification Module hydraulique » (mêmes champs que la fiche Air/Eau-Sol/Eau, listes de valeurs de la feuille) — `app.js` lignes 157-191
- [ ] Passer les champs de mesure de **saisies libres (avec unités)** à des **listes fermées** conformes à la
      feuille (Absente/Vérifiée/Non vérifiée/Non vérifiable · Oui/Non · R410A/R407C/R32/R290 ·
      Présent/Absent/Non concerné · Bon/Moyen/Très moyen · Bon/Moyen/A remplacer · P. Chauffant/Radiateurs) —
      le rendu « Mesures » étant partagé, la fiche Air/Eau-Sol/Eau évolue de la même façon — `app.js` (`stepMesuresHTML` / `wireMesuresStep`)
- [ ] Aligner la pagination du wizard sur la feuille : séparer « Client » / « Entretien » (actuellement fusionnés
      dans « Client & entretien ») et « Observation / Photos » / « Pièces utilisées » (actuellement fusionnées dans
      « Remarque & pièces ») → 7 pages + fin d'intervention — `app.js` (`wizardSteps` lignes 1094-1100, `stepRemarquePiecesHTML` ligne ~1421)
- [ ] Liste « Type d'entretien » : la feuille indique Aérothermie / Géothermie / Aquathermie à la place de
      Granulés / Bûches / Pellets — **à confirmer avant modification** (incohérent avec une chaudière bois) — `app.js` ligne 160
- [ ] Fin d'intervention (page finale partagée) : règles 18/09 extraites au **point 12** (communes à la fiche
      générique « Nouvelle intervention » et aux 3 fiches d'entretien) — un seul chantier
- [ ] Arbitrer le sort du champ « Prochaine intervention prévue » (absent de la nouvelle feuille ; fiches existantes
      déjà renseignées) — `app.js` lignes 1621-1625 et 1845, `supabase/schema.sql` ligne 83
- [ ] Maintenir le bloc CERFA n°15497 non applicable (`cerfa: false`) — les champs fluides frigorigènes hérités de la
      feuille Air/Eau n'ont pas de sens pour une chaudière bois (à confirmer)
- [ ] PDF : rendu des nouvelles sections de mesures et retrait des anciennes sections chaudière — `pdf.js` (bloc « Mesures » lignes 176-193)
- [x] Maquette de documentation : écran « Entretien Chaudière bois — proposition métier » — `Maquettes.html`
      (livrée 05/10/2026, commit `d53a9ce`)
- [ ] Incrémenter `CACHE_VERSION` dans `sw.js` (→ `climatelec-v16`)

**Fichiers :** `app.js`, `pdf.js`, `Maquettes.html`, `sw.js` (+ `supabase/schema.sql` si retrait du champ « Prochaine intervention prévue »)

**Points de vigilance (à confirmer avec le client, cf. PRD §3.2.11) :**
- « Type d'entretien » Aérothermie/Géothermie/Aquathermie : semble copié de la feuille Air.Eau.
- Perte des mesures spécifiques chaudière bois (combustion, WOS, creuset, sonde lambda, silo…).
- Champ « Prochaine intervention prévue » non repris dans la feuille.
- La feuille « Entretien Air.Air » du même classeur porte la même mention « A FAIRE » (contenu identique à
  Air.Eau) : évolution analogue de la fiche Air/Air à prévoir si confirmée — détaillée au point 14.
- La maquette du 05/10/2026 porte une **alternative « proposition métier »** (validateur client) : page 4 
  « Vérification chaudière bois » au lieu de « Groupe extérieur » (mesures spécifiques réintégrées), page 5
  « Module hydraulique » conservée (circuit d'eau réel), champs fluides retirés (CERFA non applicable),
  Granulés/Bûches/Pellets (liste d'origine), « Prochaine intervention prévue » conservé — implémenter la
  variante retenue après validation.

---

## 11. Refonte du formulaire « Entretien Air/Eau-Sol/Eau » (18/09/2026)

**Objectif :** appliquer la feuille « Entretien Air.Eau Sol.E » du classeur `documentation/Application - 20260918.xlsx`
(feuille **de référence** du classeur — non marquée « A FAIRE » ; les fiches Chaudière bois et Air.Air y sont
alignées) : pages « Vérification Groupe extérieur » et « Vérification Module hydraulique » avec listes de valeurs
fermées, pagination en 7 pages, fin d'intervention alignée sur la page 6/6 de « Nouvelle intervention ».
Détail complet au **§3.2.12 du PRD**. À traiter **avant ou avec le point 10** : la fiche Air/Eau-Sol/Eau sert
de référence aux pages 4-5 partagées.

- [ ] `ENTRETIEN_META.air_eau` : renommer les sections « Groupe extérieur » / « Circuit eau & divers » en
      « Vérification Groupe extérieur » / « Vérification Module hydraulique » et y porter les champs et listes de
      valeurs de la feuille (détail des évolutions de champs au §3.2.12 du PRD) — `app.js` lignes 86-126
- [ ] Types d'entretien : ajouter « Aquathermie » (liste cible Aérothermie / Géothermie / Aquathermie,
      remplace « Air/Eau (aérothermie) » / « Sol/Eau (géothermie) ») — `app.js` ligne 89
- [ ] Mesures en listes fermées + pagination 7 pages + fin d'intervention : travaux **partagés** déjà listés au
      point 10 (un seul chantier pour les 3 fiches d'entretien + page finale commune avec la fiche générique)
- [ ] CERFA n°15497 : maintenu (`cerfa: true`), cohérent avec la feuille (champs fluides frigorigènes présents)
- [ ] PDF : rendu des nouvelles sections de mesures — `pdf.js` (bloc « Mesures » lignes 176-193)
- [x] Maquette de documentation : écran « Entretien Air/Eau - Sol/Eau — refonte 18/09 » (pages 4/7 Groupe extérieur
      et 5/7 Module hydraulique, listes fermées) — `Maquettes.html` (livrée 05/10/2026, commit `d53a9ce`)
- [ ] Incrémenter `CACHE_VERSION` dans `sw.js` (→ `climatelec-v16`, cumulé avec le point 10)

**Fichiers :** `app.js`, `pdf.js`, `Maquettes.html`, `sw.js`

**Points de vigilance (à confirmer avec le client, cf. PRD §3.2.12) :**
- « T° d'air extérieur » : présente dans la fiche actuelle (`t_air_ext`), absente des pages 4-5 de la feuille.
- Champs sans liste de valeurs (« Charge d'usine », « Valeur anti-gel », « Différence Entrée/Sortie d'air »,
  « Pression d'eau ») : saisie libre conservée ? Unités à réafficher ?
- « Année d'installation » (affichée à l'étape Équipement des fiches d'entretien) absente de la feuille :
  conserver ou retirer ? « Descriptif » (obligatoire en page 3/6 de Nouvelle intervention) : à ajouter ?
- Données existantes saisies avec unités (V, bar, °C…) : conservées en base, pas de conversion prévue
  (table `mesures` typée, aucun changement de schéma).
- La feuille « Entretien Air.Air » (contenu identique) : même évolution à confirmer — cf. point 10.

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
- [ ] Ajouter la case **« Page ok — fiche complète et vérifiée »** (libellé/portée à clarifier avec le client) ;
      à persister si confirmée : `app.js`, `idb.js`, `supabase/schema.sql` (colonne à prévoir, ex. `page_ok bool`)
- [ ] « Enregistrer comme brouillon » conservé à la page finale (déjà présent à toutes les étapes — à vérifier) — `app.js`
- [ ] PDF : figurer ou non la case « Page ok » sur le PDF généré (à arbitrer) — `pdf.js`
- [ ] Incrémenter `CACHE_VERSION` dans `sw.js` (→ `climatelec-v16`, cumulé avec les points 10-11-13-14)

**Fichiers :** `app.js`, `pdf.js`, `sw.js` (+ `idb.js`, `supabase/schema.sql` si « Page ok » persistée)

**Points de vigilance (à clarifier avec le client, cf. PRD §3.2.14) :**
- Libellé et portée du champ « Page ok » (case de confirmation de page — fonction exacte à définir ; la feuille
  indique l'intitulé brut « Page ok »).

---

## 13. Tableau de bord = écran d'accueil (retour 18/09 — à faire valider)

**Objectif :** remplacer « accueil = planning » (arbitrage du 16/08) par un **Tableau de bord** : vue synthèse
par statut du workflow (US-13 · US-15) + bloc « Appels — À traiter ». Les onglets Planning / Tâches / Dossiers
sont **conservés** ; seul l'écran ouvert par défaut change. Maquette dédiée (écran `dashboard`, groupe
« Refonte 18/09 — à valider ») ; spécification au **§3.2.15 du PRD**.

- [ ] **Faire valider la maquette** « Tableau de bord » par le client (en remplacement de « accueil = planning »
      du 16/08) — ne pas implémenter avant accord
- [ ] Si validé : afficher le Tableau de bord comme **vue par défaut de l'accueil** — blocs par statut de dossier
      (À valider, À facturer, À vérifier, À envoyer…) + bloc **« Appels — À traiter »** en tête (les appels
      « Enregistrer sans planifier » y arrivent) — `app.js` (rendu des onglets lignes ~503-505 ; `dossiersHTML`
      ligne ~636 réutilisable comme base des blocs par statut)
- [ ] Arbitrer le bloc **« Devis en cours »** de la maquette : le workflow (§3.3.4) n'a pas de statut « devis » —
      proposer un bloc fiches portant l'indicateur « devis souhaité », ou le retirer — à arbitrer avec le client
- [ ] **Vue par rôle** : toute l'équipe pour Régis/Delphine, propres lignes pour Jérémy (règles §3.2.2 conservées) — `app.js`
- [ ] Incrémenter `CACHE_VERSION` dans `sw.js` (→ `climatelec-v16`, cumulé)

**Fichiers :** `app.js`, `style.css`, `sw.js`

**Points de vigilance (cf. PRD §3.2.15) :**
- Statut maquette « à faire valider » : retour du 18/09 non encore arbitré.
- Bloc « Devis en cours » sans équivalent dans le workflow de statuts (§3.3.4) — à arbitrer.

---

## 14. Fiche « Entretien Air/Air » — page 5 « Unités intérieures » (proposition métier, 05/10/2026)

**Objectif :** si la proposition métier (maquette « Entretien Air/Air ») est validée en alternative à l'application
littérale de la feuille « Entretien Air.Air » (copie de la feuille hydraulique, sans objet pour une PAC air/air —
cf. **§3.2.13 du PRD**), remplacer la page 5 « Vérification Module hydraulique » par une page **« Unités
intérieures »** ; le reste (pages 1-2, 4, 6-7 et fin d'intervention) est partagé avec le chantier commun des
points 10-11-12.

- [ ] **Faire valider la proposition** : page 5 « Unités intérieures » (nettoyage/état des filtres intérieurs,
      nettoyage pompe de relevage des condensats, T° d'échange groupe extérieur et unités intérieures 1 à 4,
      état visuel des unités, T° d'air extérieur) — `Maquettes.html`
- [ ] Conserver **5 lignes d'équipement** (1 unité extérieure + jusqu'à 4 intérieures, structure actuelle) au lieu
      de 3 (feuille) — `ENTRETIEN_META.air_air` (`app.js` lignes 127-146)
- [ ] Arbitrer « **GWP du fluide** » : retiré par la feuille mais utile au CERFA (§3.2.13) — `app.js` / `pdf.js`
- [ ] Écarter la liste « Type d'entretien » Aérothermie/Géothermie/Aquathermie (copie de la feuille) : arbitrer
      entre liste dédiée air/air et conservation de la liste commune — `app.js` ligne ~130
- [ ] Contenu de `ENTRETIEN_META.air_air` : page 4 + fin d'intervention partagées, page 5 dédiée, **CERFA maintenu
      (`cerfa: true`)** — `app.js`, `pdf.js`
- [ ] Incrémenter `CACHE_VERSION` dans `sw.js` (→ `climatelec-v16`, cumulé)

**Fichiers :** `app.js`, `pdf.js`, `Maquettes.html`, `sw.js`

**Points de vigilance (à confirmer avec le client, cf. PRD §3.2.13) :**
- La feuille Air.Air est un copier-coller de la feuille Air/Eau-Sol/Eau : ne pas appliquer telle quelle.
- Champs sans liste de valeurs (« Charge d'usine », « Valeur anti-gel », « Différence Entrée/Sortie d'air »,
  « Pression d'eau ») : même question que le point 11 (saisie libre, unités ?).