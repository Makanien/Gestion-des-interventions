# Analyse des retours — classeur « Application 20261009.xlsx »

**Source :** `documentation/Application 20261009.xlsx` (retours client du 09/10/2026).
**Référence de comparaison :** `PRD_App_Interventions_Climat_Elec.md` v1.26 (07/10/2026), qui intègre déjà le classeur du 18/09/2026 (`Application - 20260918.xlsx`, §3.2.11 à §3.2.15) et l'état d'implémentation V3 (§3.4).
**Périmètre :** feuilles « Nouvelle intervention », « Entretien Air.Eau Sol.E », « Entretien Air.Air », « Entretien Chaudière Bois » — complété par les feuilles transverses quand elles impactent le même périmètre (« Bouton + », « Ouverture application », « Planning », « Nouvel appel », « Général »).

Légende : **NOUVEAU** (absent du PRD) · **RÉSOLU** (anomalie du 18/09 levée) · **A CONFIRMER** (à arbitrer avec le client) · **CONFORME** (identique au PRD).

**Arbitrage du 09/10/2026 (porteur de projet) :** les 12 points du §6 ont reçu une réponse (numérotées 6.1 → 6.12, reprises in fine dans ce document) ; les points concernés portent désormais la mention **ARBITRÉ**. Ces décisions sont reportées dans le PRD (v1.27 : §3.2.4, §3.2.6, §3.2.11 → §3.2.15, §5.2, §7, §11) et dans `TACHES_A_FAIRE.md` (points 15 → 20).

---

## 1. Synthèse

Le classeur du 09/10 ne change pas la structure globale (6 pages pour la fiche générique ; 7 pages + fin d'intervention partagée pour les entretiens). Il consolide le 18/09 et apporte surtout :

1. **Un nouveau flux « Entretien installation solaire »** (feuille « Bouton + »), **sans feuille de détail** dans le classeur : à cadrer de A à Z.
2. **La liste « Type d'intervention » ré-élargie** pour la fiche générique : *Sav · Garantie · Dépannage · Diagnostique · Sur devis* (le PRD l'avait restreinte à *Dépannage / Garantie / Diagnostic*, US-22).
3. **Le « Descriptif » explicitement rattaché à la page 3/6 (Équipement), obligatoire** — et les fiches d'entretien héritent de cette page par leur renvoi « comme page 3/6 de Nouvelle intervention ».
4. **La levée explicite des deux grandes anomalies du 18/09** : Chaudière bois (type d'entretien corrigé + mesures spécifiques réintégrées en « Vérification Chaudière ») et Air/Air (type d'entretien corrigé + page 5 « Vérification Unitée Intérieure ») — dans les deux cas dans l'esprit des « propositions métier » des maquettes du 05/10/2026, avec des nuances de détail à valider.
5. Des précisions UX sur l'accueil (drill-down par statut, tri Nom / Code postal / Ville) et la re-remontée explicite de la question Google Agenda bidirectionnelle (feuille « Général »).

---

## 2. Feuille « Nouvelle intervention »

### 2.1 Ce qui est conforme

- **Structure 6 pages** (1 Client · 2 Intervention · 3 Équipement · 4 Action & Pièces · 5 Photos · 6 Devis & Signature) — conforme au §3.2.6.
- **Page 1/6 Client** : mêmes champs et mêmes obligatoires (nom, adresse, CP, ville, type de bâtiment à 4 valeurs) ; Téléphone / Mail non marqués obligatoires (comme au 18/09).
- **Page 2/6** : date, heures d'arrivée/départ, forfait déplacement Z0 (Chazé-sur-Argos) à Z3 (31–50 km) — conformes.
- **Page 6/6** : toutes les règles de fin d'intervention du §3.2.14 — « Page ok », statut d'intervention saisi/affiché **avant les signatures**, signatures possibles seulement si la fiche est terminée, signature technicien obligatoire, signature client obligatoire si présent, « Enregistrer comme brouillon », « Soumettre pour validation » seulement si la fiche est signée.

### 2.2 Différences à intégrer

| Point | Feuille 09/10 | PRD actuel | Analyse |
|---|---|---|---|
| Type d'intervention (page 2/6, obligatoire) | Sav · Garantie · Dépannage · Diagnostique · Sur devis | Dépannage · Garantie · Diagnostic (US-22, §3.2.6) | **NOUVEAU → ARBITRÉ (6.1, 2.2)** — **on prend les données du document 09/10** : liste à 5 valeurs Sav · Garantie · Dépannage · **Diagnostic** · Sur devis. Orthographe imposée : **« Diagnostic »**, jamais « Diagnostique ». |
| Page 3/6 — Équipement | « Équipement concernés » **et** « Descriptif », tous deux obligatoires | Page 3/6 = Équipement ; le « Descriptif de la demande » vit comme étape séparée du wizard (parcours §4, non pré-ciblé par la feuille 18/09) | **A CONFIRMER → ARBITRÉ (2.2, 6.5, 6.7)** — on fusionne **Équipement + Descriptif** sur la page 3/6 (descriptif **obligatoire**) ; ce bloc sert de référence aux fiches d'entretien. **Gestion actuelle conservée** : base de données des équipements avec rappel des équipements déjà utilisés ; champs **Intitulé, Marque, Modèle et N° de série obligatoires**. |

### 2.3 Nuance

- La case **« Page ok »** est marquée **Obligatoire** dans la feuille, alors que le §3.2.14 la cite sans contrainte explicite et avec « libellé/portée à clarifier ». Le caractère obligatoire devient un prérequis ; le libellé reste à clarifier.
  → **Précision arbitrée (6.9, valable pour toutes les sections — intervention et entretiens)** : « obligatoire » ne conditionne **pas le passage à la page suivante** mais le contrôle de complétude **à la validation** ; la ligne « Page ok » est le **résumé** signalant que toutes les informations obligatoires sont renseignées, et **l'astérisque des champs obligatoires est conservé**.
- Convention transverse (tous formulaires) : **les unités s'affichent avant le champ de saisie, pas dans le champ** (jamais en placeholder).

---

## 3. Feuilles « Entretien »

### 3.1 Entretien Air/Eau - Sol/Eau — feuille de référence

**CONFORME** — aucune différence de fond : la feuille reprend identiquement la feuille de référence du 18/09 (§3.2.12) : type d'entretien *Aérothermie / Géothermie / Aquathermie* ; page 4 « Vérification Groupe extérieur » et page 5 « Vérification Module hydraulique » avec exactement les mêmes champs et listes de valeurs (« Non concerné » sur les Delta T°/débits secondaires, etc.) ; page 6 « Observation / Photos » ; page 7 « Pièces utilisée » ; « Fin d'intervention — comme page 6/6 de Nouvelle intervention ».

À noter :
- le renvoi « comme page 3/6 de Nouvelle intervention » hérite désormais aussi du champ **« Descriptif » (obligatoire)** ajouté en 09/10 — répond au point ouvert du §3.2.12 (ajout éventuel du descriptif sur les fiches d'entretien) : **arbitré (6.7) — descriptif obligatoire, « Année d'installation » conservée** ;
- les points ouverts du §3.2.12 restent inchangés : absence de « T° d'air extérieur », champs sans liste de valeurs (« Charge d'usine », « Valeur anti-gel », « Différence Entrée / Sortie d'air », « Pression d'eau »).

### 3.2 Entretien Air/Air

Deux anomalies du 18/09 sont levées ; les levées convergent avec la « proposition métier Unités intérieures » (maquette 05/10/2026, §3.2.13) :

| Point | Feuille 09/10 | PRD actuel (état 18/09) | Analyse |
|---|---|---|---|
| Type d'entretien (page 2, obligatoire) | Mono Split · Multi Split · Gainable | Feuille 18/09 : *Aérothermie / Géothermie / Aquathermie* (anomalie — recopie) ; implémentation actuelle : type « Air/Air » | **RÉSOLU** — liste enfin cohérente avec une PAC air/air ; sous-types à implémenter (`type_entretien_detail`). |
| Page 5 | **« Vérification Unitée Intérieure »** : tension d'alimentation, tension intercommunication, resserrage des bornes électrique, nettoyage filtre (Oui/Non) + état filtre (Bon/Moyen/A remplacer), test évacuation condensat (Oui/Non) + état réseau condensat (Bon/Moyen/Très moyen), nettoyage pompe de relevage (Oui/Non/Absente) + état pompe de relevage (Bon/Moyen/Très moyen/Absente), Delta T° d'air (Vérifié/Non vérifié/Non vérifiable), nettoyage unité intérieure (Oui/Non) + état visuel unité intérieure (Bon/Moyen/Très moyen) | Feuille 18/09 : « Vérification Module hydraulique » **sans objet** en air/air (anomalie — copier-coller) ; proposition métier : équivalent « Unités intérieures » (§3.2.13) | **RÉSOLU** — le bloc hydraulique sans objet disparaît au profit d'un vrai bloc unités intérieures, dans la continuité de la proposition métier. |
| Page 4 — Groupe extérieur | Même bloc que l'Air/Eau-Sol/Eau **moins « Sécurité anti-gel » et « Valeur anti-gel »** ; réordonnancement (« Vérification de fuite frigorigène » avant le nettoyage/état visuel ; « Différence Entrée / Sortie d'air » en fin de page) | Feuille 18/09 : bloc strictement identique à l'Air/Eau-Sol/Eau, anti-gel inclus (§3.2.13) | **ÉVOLUTION** — les champs anti-gel hérités du 18/09 par recopie sont retirés (sans objet pour un système air/air). Les champs fluides restent en page 4 : le **CERFA n°15497 est maintenu** (conforme à la proposition métier). |
| Équipement (page 3) | « Comme page 3/6 de Nouvelle intervention » (aucun détail de lignes) | Implémentation : 5 lignes (1 unité extérieure + jusqu'à 4 intérieures) ; la feuille 18/09 laissait entendre 3 lignes (§3.2.13) | **A CONFIRMER → ARBITRÉ (6.5)** — comme la page 3/6 de « Nouvelle intervention », **même bloc de données** (base équipements + rappel de l'historique, champs obligatoires 2.2) : la structure dédiée « 1 extérieure + 4 intérieures » est abandonnée. |

Nuances par rapport à la proposition métier :
- « **Delta T° d'air** » est un champ **unique** — la proposition maquette prévoyait des T° d'échange groupe extérieur + unités intérieures 1 à 4 → **ARBITRÉ (6.4) : on prend le champ unique du 09/10** ;
- la **T° d'air extérieur** reste absente — son retrait (déjà acté par la feuille 18/09) est confirmé par une seconde feuille → retrait confirmé (6.6) ;
- le **GWP du fluide** reste absent (supprimé au 18/09, non revenu) — données utiles au CERFA n°15497 → **ARBITRÉ (6.6) : le champ GWP du fluide est rétabli**, la validation client restant inscrite au PRD.

### 3.3 Entretien Chaudière bois

Les anomalies du 18/09 sont levées ; la feuille suit la « proposition métier » (maquette 05/10/2026, §3.2.11), avec des nuances de détail :

| Point | Feuille 09/10 | PRD actuel (état 18/09) | Analyse |
|---|---|---|---|
| Type d'entretien (page 2, obligatoire) | Chaudière Bûches · Chaudière Granulés · Chaudière Déchiquettée | Feuille 18/09 : *Aérothermie / Géothermie / Aquathermie* (anomalie — recopie) ; historique (§3.2.7 c) : Granulés / Bûches / Pellets ; implémentation : granules / buches / pellets | **RÉSOLU** — liste enfin cohérente avec le type d'équipement ; **« Pellets » disparaît, remplacé par « Déchiquettée » (plaquettes déchiquetées)** — **ARBITRÉ (6.2) : oui**. |
| Page 4 | **« Vérification Chaudière »** : tension d'alimentation, resserrage des bornes électrique, étalonnage granulés (Oui/Non), test alimentation granulés (Oui/Non), nettoyage WOS (Oui/Non) + **état du joint WOS** (Bon/Moyen/A remplacer), nettoyage creuset, nettoyage cendrier, nettoyage chambre de combustion, nettoyage sonde Lambda / Fumée, test combustion (Oui/Non), nettoyage chaudière (Oui/Non) + état chaudière (Bon/Moyen), nettoyage silo (Oui/Non) + état silo (Bon/Moyen), test clapet coupe-feu (Oui/Non), test bougie d'allumage (Oui/Non) | Feuille 18/09 : « Vérification Groupe extérieur » **sans objet** pour une chaudière bois (anomalie) ; mesures spécifiques disparues à réintégrer (points déjà signalés, §3.2.11) | **RÉSOLU** — l'ensemble des mesures spécifiques chaudière bois revient, conformément à la proposition métier. Détails à valider : « état du **joint** WOS » (plus granulaire que le nettoyage/état « WOS (échangeur) » des fiches papier) ; formulation « test **alimentation** granulés ». **Aucun champ fluide** : **CERFA n°15497 confirmé non applicable**. |
| Page 5 | **« Vérification réseau hydraulique »** (renommée) : pression d'eau, disconnecteur, mitigeur ECS, vannes d'équilibrage zones 1 & 2, émetteurs zones 1 & 2, aquastats de sécurité circuits 1 & 2, nettoyage filtre à tamis (Oui/Non/**Non concerné**) + état filtre à tamis (Bon/Moyen/A remplacer/**Non concerné**), nettoyage filtre à boue (Oui/Non) + état filtre à boue (Bon/Moyen/A remplacer), Delta T° d'eau primaire / secondaires 1 & 2, débits d'eau primaire / secondaires 1 & 2 | Feuille 18/09 : « Vérification Module hydraulique » complet, incluant tension d'alimentation, tension intercommunication, resserrage des bornes, nettoyage du module hydraulique et état visuel du module hydraulique | **ÉVOLUTION** — page allégée et renommée : retrait de **tension d'alimentation / tension intercommunication / resserrage des bornes** (l'électricité est désormais côté page 4 « chaudière » ; la tension intercommunication disparaît totalement de la fiche bois) et de **« Nettoyage du module hydraulique » / « État visuel du module hydraulique »** ; ajout des options « Non concerné » sur nettoyage/état filtre à tamis. |
| « Prochaine intervention prévue » | Absente de la feuille | Prévue historiquement (§3.2.7 c, colonne §5.2), point déjà ouvert depuis le 18/09 | **A CONFIRMER → ARBITRÉ (6.3)** — **on conserve** « Prochaine intervention prévue » (les fiches existantes portent déjà la donnée). |

---

## 4. Entretien installation solaire — nouveau type d'entretien

**NOUVEAU** — la feuille « Bouton + » du 09/10 ajoute une **6e entrée : « Entretien installation solaire »**. Aucune feuille de détail dans le classeur (ni pagination, ni bloc de mesures, ni listes de valeurs) : ce flux est **à cadrer de A à Z**.

Préconisation : reprendre la trame commune des fiches d'entretien (Client / Entretien / Équipement / pages de vérification dédiées / Observation-Photos / Pièces / fin d'intervention commune) avec un bloc « Vérification installation solaire » dont le contenu doit être fourni par le client ; créer un nouveau `type_entretien` dédié + sous-distinction éventuelle (`type_entretien_detail`) ; l'ajouter aux filtres/tris « Entretien » (accueil, planning, tâches) ; arbitrer l'articulation CERFA (a priori **sans objet**, pas de fluide frigorigène).

**Arbitrage (6.10) : préparer l'arrivée prochaine des données du solaire** — la trame commune et un `type_entretien` dédié seront mis en place (bloc « Vérification installation solaire » à renseigner dès réception du contenu par le client) ; ne rien inventer en attendant.

---

## 5. Feuilles transverses (pour mémoire)

- **« Bouton + »** : entrées conformes au §3.2.4 (Nouvel appel, Nouvelle intervention, 3 entretiens) **augmentées de « Entretien installation solaire »**. L'entrée « Contrat d'entretien annuel » (implémentée en V3, §3.4) n'apparaît plus — omission vraisemblable → **ARBITRÉ (6.11) : oui, volontaire — ne plus afficher « Contrat d'entretien annuel » pour le moment** (le flux et les données existants sont conservés).
- **« Nouvel appel »** : « RAS » — aucune évolution (conforme au §3.2.5 et aux divergences 18/09 déjà notées).
- **« Planning »** : conforme aux règles du §3.2.2 (planning journalier, lignes intervenant + type ; tri par intervenant ou type pour Régis / par type pour Jérémy). Même divergence qu'au 18/09 : **Delphine n'est pas mentionnée** (l'arbitrage du 19/08 lui conserve la vue équipe).
- **« Ouverture application »** : « **Page d'accueil = Tableau de bord** » est re-demandé (deuxième mention après le 18/09, §3.2.15 — « à faire valider » côté PRD au moment de l'analyse, désormais arbitrée avec les précisions 6.12 : implémentation à planifier). Nouveaux détails :
  - **drill-down par statut** : cliquer sur un groupe de statut (ex. « À valider ») ouvre la liste des dossiers de ce statut — précise la vue « groupée par statut » du §3.2.15 ;
  - **liste de tri : Nom, Code postal, Ville** — nouveaux critères de tri (au-delà des tris type/intervenant existants, §3.2.2 / §3.4) ;
  - **drill-down et tris : ARBITRÉ (6.12) — valables aussi pour le technicien, dans son périmètre** (ses propres lignes) ;
  - masquage des tâches réalisées par défaut, accessibles via le tri (déjà spécifié au §3.2.2 et implémenté) ;
  - visibilité par rôle (Régis : toutes les lignes — Jérémy : ses propres lignes) : conforme aux règles RLS (§2).
- **« Général »** : trois questions, dont deux trouvent réponse dans le PRD : base clients pour le remplissage automatique (**oui, dès la V1**) et base pièces « pour simplement la désignation » (**oui, arbitrée V3**, US-23). La troisième re-belée la demande de **synchronisation bidirectionnelle planning / Google Agenda** (création dans l'appli → agenda ; agenda → appli, pour formations, congés…) : c'est l'US-14, toujours reportée hors V3 (§3.3.6, §11) — la question est reposée explicitement et renforce le besoin de cadrage (calendrier unique vs par technicien, source de vérité, gestion des conflits).

---

## 6. Points à confirmer avec le client — arbitrés le 09/10/2026

Réponses du porteur de projet (6.1 → 6.12), avec les précisions transverses (cf. 2.2) : mot **« Diagnostic »** et non « Diagnostique » ; gestion de l'équipement conservée avec la **base de données des équipements** (rappel des équipements déjà utilisés), champs **Intitulé, Marque, Modèle et N° de série obligatoires** ; dans **tous les formulaires, les unités s'affichent avant le champ de saisie, pas dans le champ**.

1. **« Sav » et « Sur devis »** : signification attendue, articulation avec « Dépannage » et avec le workflow — la liste passe de 3 à 5 valeurs. → **Réponse (6.1) : on prend les données du document 09/10** (Sav · Garantie · Dépannage · Diagnostic · Sur devis).
2. **Chaudière bois** : « Déchiquettée » remplace-t-il « Pellets » ? → **Réponse (6.2) : oui.**
3. **Chaudière bois** : « Prochaine intervention prévue » — conserver ou retirer ? → **Réponse (6.3) : on conserve « Prochaine intervention prévue ».**
4. **Air/Air** : « Delta T° d'air » champ unique au lieu des T° d'échange par unité intérieure (max 4) ? → **Réponse (6.4) : on prend les données du document 09/10** (champ unique).
5. **Air/Air** : nombre de lignes d'équipement — 3 ou 5 ? → **Réponse (6.5) : comme la page 3/6 de « Nouvelle intervention », même bloc de données.**
6. **Air/Air et Air/Eau** : retrait de la « T° d'air extérieur » et du « GWP du fluide » ? → **Réponse (6.6) : « Delta T° d'air » — champ unique du 09/10 (cf. 6.4) ; le « GWP du fluide » est rétabli, sa confirmation client restant consignée au PRD** ; pas de réintroduction demandée pour la « T° d'air extérieur » (retrait conforme aux données 09/10).
7. **Fiches d'entretien** : « Descriptif » hérité et « Année d'installation » ? → **Réponse (6.7) : année conservée et descriptif obligatoire.**
8. **Champs sans liste de valeurs** (« Charge d'usine », « Valeur anti-gel », « Différence Entrée / Sortie d'air », « Pression d'eau ») → **Réponse (6.8) : on garde le point ouvert pour le client ; saisie libre pour le moment.**
9. **« Page ok »** → **Réponse (6.9) : valable pour toutes les sections (intervention, entretiens) ; « obligatoire » ne permet pas d'aller à la page suivante mais vérifie que tous les éléments obligatoires sont présents pour la validation ; « Page ok » = le résumé que toutes les informations obligatoires sont renseignées ; conserver l'astérisque des champs obligatoires.**
10. **Entretien installation solaire** : contenu attendu, articulation CERFA. → **Réponse (6.10) : préparer l'arrivée prochaine des données du solaire.**
11. **Bouton « + »** : absence du « Contrat d'entretien annuel » ? → **Réponse (6.11) : oui — ne plus afficher le contrat d'entretien annuel pour le moment.**
12. **Tableau de bord** : drill-down et tris valables pour le technicien ? → **Réponse (6.12) : oui, aussi pour le technicien dans son périmètre.**

---

## 7. Impact sur le PRD et le développement (arbitrages intégrés)

- **§3.2.6 (fiche générique)** : liste « Type d'intervention » → **Sav, Garantie, Dépannage, Diagnostic, Sur devis** (arbitré 6.1, orthographe « Diagnostic ») ; page 3/6 fusionnant Équipement + Descriptif (descriptif obligatoire ; gestion équipement conservée avec base + rappel, champs Intitulé/Marque/Modèle/N° de série obligatoires).
- **§3.2.11 / §3.2.12-3.2.13 (entretiens)** : appliquer les feuilles 09/10 — Chaudière bois (types **Bûches / Granulés / Déchiquettée** — 6.2, page 4 « Vérification Chaudière », page 5 « Vérification réseau hydraulique » allégée, « Non concerné » sur filtre à tamis, « Prochaine intervention prévue » **conservée** — 6.3) et Air/Air (types **Mono/Multi/Gainable**, page 5 « Vérification Unitée Intérieure », champs anti-gel retirés, « Delta T° d'air » **champ unique** — 6.4, équipement = bloc page 3/6 — 6.5) ; Air/Eau-Sol/Eau : statu quo + **GWP rétabli** (6.6, confirmation conservée au PRD) + **T° d'air extérieur retirée** (confirmée 6.6).
- **§3.2.4 / §3.3.1 (bouton « + »)** : ajouter « Entretien installation solaire » (préparer l'arrivée des données — 6.10) et **retirer « Contrat d'entretien annuel » du menu** (6.11, flux conservé).
- **§3.2.14 (fin d'intervention)** : « Page ok » = résumé de la complétude des champs obligatoires ; « obligatoire » conditionne la validation (pas la navigation) ; astérisques conservés (6.9, toutes sections).
- **§3.2.15 (Tableau de bord)** : drill-down statut → sous-liste et tris Nom / Code postal / Ville, **valables aussi pour le technicien dans son périmètre** (6.12).
- **§3.3.6 / §11 (US-14)** : la demande Google Agenda bidirectionnelle est reposée explicitement (« formation, congés ») — le report et son cadrage ultérieur restent d'actualité, à mentionner au prochain point client.
- **Modèle de données** : aucun changement structurel attendu — les listes de valeurs alimentent la table `mesures` typée ; sous-types via `type_entretien_detail` (air/air, bois, solaire) ; le GWP revient comme mesure typée ; unités systématiquement renseignées (affichage avant le champ, §7).
- **Suivi du développement** : chantiers détaillés aux **points 15 → 20 de `TACHES_A_FAIRE.md`**.
