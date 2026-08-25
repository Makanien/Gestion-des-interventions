# Tâches à faire — V3 (compléments identifiés)

> Dernière mise à jour : 25/08/2026 — sur la base de la comparaison spec V3 (§3.3 du PRD)
> vs implémentation réelle (branche `application-v3`).
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