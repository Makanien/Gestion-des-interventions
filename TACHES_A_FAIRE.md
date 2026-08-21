# Tâches à faire — V3 (compléments identifiés)

> Dernière mise à jour : 21/08/2026 — sur la base de la comparaison spec V3 (§3.3 du PRD)
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
- [ ] Dans l'étape « Équipement » du wizard, si le client a un historique :
      proposer un bouton « Reprendre l'équipement enregistré » qui alimente
      `draft.equipements` (`DB.listEquipementsForClient`)

**Fichiers :** `app.js`

---

## 6. Upload Storage photos et documents

**Objectif :** uploader les photos et PDF vers les buckets privés (`photos`, `documents`).

- [x] Méthodes `Supabase.uploadPhoto(id, dataUrl)` et `Supabase.uploadDocument(id, dataUrl)` — `supabase.js`
- [ ] En fin de wizard (fiches intervention/entretien) : uploader chaque photo
      du brouillon et renseigner `fichier_url` — `app.js` (finishWizard)
- [ ] À l'import d'un devis/facture (`importDocument`) : uploader le PDF et
      renseigner `fichier_url` — `app.js`
- [ ] Décider si on conserve le dataURL local (offline-first) en plus de l'upload

**Fichiers :** `app.js`

---

## 7. Vérification finale

- [ ] Passer en revue `git diff` des fichiers modifiés
- [ ] Contrôler la cohérence de la syntaxe JS (ex. `node --check` si disponible)
- [ ] Incrémenter `CACHE_VERSION` dans `sw.js` avant déploiement
- [ ] Mettre à jour la section §3.4 du PRD avec les ajouts livrés

**Fichiers :** `sw.js`, `PRD_App_Interventions_Climat_Elec.md`

---

## Résumé des prochaines étapes prioritaires

| Priorité | Tâche |
|---|---|
| 1 | ~~Câbler les filtres Tâches (`wireTab`) + styles filtre (points 3)~~ ✅
| 2 | Stats « par client » (point 2) |
| 3 | Réutilisation historique équipement dans le wizard (point 5) |
| 4 | Upload photos/documents en fin de wizard + import (point 6) |
| 5 | Vérification finale + `sw.js` + PRD (point 7) |