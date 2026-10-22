# Plan d'action — Simplification du workflow de dossier (4 statuts)

**Destinataire :** agent de développement
**Spécification de référence :** `PRD_App_Interventions_Climat_Elec.md` v1.28, §3.3.3 et §3.3.4 (source de vérité en cas de doute)
**Branche suggérée :** `workflow-4-statuts` (à créer depuis la branche de travail courante)
**Dépôt :** application PWA vanilla JS (`app.js`, `idb.js`, `sync.js`, `pdf.js`, `sw.js`) + Supabase (`supabase/schema.sql`)

> Les numéros de lignes ci-dessous sont **indicatifs** (état du dépôt au 13/10/2026). Retrouver les blocs par leur nom de fonction / constante (`grep`) avant de modifier.

---

## 0. Résumé de la cible

```
BROUILLON ──Soumettre──► À VALIDER ──Valider──► À FACTURER ──Marquer facturé──► TERMINÉ
    ▲                        │                                                     │
    └── Renvoyer (motif) ────┘                                                     │
    └────────────────────── Rouvrir (Régis seul, motif) ───────────────────────────┘
```

| Statut (`statut_dossier`) | Libellé | Modifiable |
|---|---|---|
| `brouillon` | Brouillon | **Oui (seul statut éditable)** |
| `a_valider` | À valider | Non |
| `a_facturer` | À facturer | Non |
| `termine` | Terminé | Non |

| De → Vers | Bouton | Rôles autorisés |
|---|---|---|
| (création) → `brouillon` | Enregistrer le brouillon | tous (existant) |
| `brouillon` → `a_valider` | Soumettre pour validation | créateur/technicien affecté, ou manager |
| `a_valider` → `brouillon` | Renvoyer en brouillon (+ motif libre) | `responsable`, `secretaire` (`developpeur`) |
| `a_valider` → `a_facturer` | Valider la fiche | `responsable`, `secretaire` (`developpeur`) |
| `a_facturer` → `termine` | Marquer comme facturé | `responsable`, `secretaire` (`developpeur`) |
| `termine` → `brouillon` | Rouvrir (+ motif libre) | **`responsable` uniquement** (`developpeur` toléré pour les tests) |

**Migration des anciennes valeurs** (à appliquer partout : SQL, IndexedDB, push/pull) :

| Ancien | Nouveau |
|---|---|
| `brouillon`, `a_valider`, `a_facturer` | inchangés |
| `validee`, `facture_importee`, `facture_a_verifier` | `a_facturer` |
| `facture_verifiee`, `a_envoyer`, `cloturee` | `termine` |

**Supprimé :** import de facture, fusion fiche + facture (« dossier final »), statuts de vérification, statut « à envoyer / clôturée ».
**Conservé :** génération/partage du PDF de la fiche, import du **devis** (PDF, en parallèle, sans blocage).

---

## 1. Ordre d'exécution et règles

1. Exécuter les phases dans l'ordre (P1 → P8). Chaque phase se termine par une **vérification** à cocher.
2. Un commit par phase, message préfixé `workflow4:`.
3. **Compatibilité ascendante obligatoire** : des téléphones avec l'ancien service worker ou des données hors ligne peuvent pousser d'anciens statuts après la migration serveur. Le serveur **et** le client doivent normaliser les anciennes valeurs (P1 et P2), sinon la synchro se bloque sur la contrainte CHECK.
4. Ne pas modifier les autres parties du PRD/de l'app (planning, appels, fiches d'entretien, contrats).
5. `node` peut être absent : si indisponible, faire une relecture syntaxique manuelle (comme les tâches précédentes de `TACHES_A_FAIRE.md`).

---

## P1 — Backend Supabase (`supabase/schema.sql`)

Fichier maître **idempotent** : ajouter un bloc « Workflow 4 statuts (13/10/2026) » après la définition de `interventions` et avant les politiques RLS. Vérifier d'abord le type retourné par `public.current_role()` et le type de `created_by`.

- [ ] **P1.1 — Colonnes** sur `public.interventions` :
  ```sql
  alter table public.interventions add column if not exists motif_retour text;
  alter table public.interventions add column if not exists valide_par  uuid;        -- même type que created_by
  alter table public.interventions add column if not exists valide_le   timestamptz;
  alter table public.interventions add column if not exists facture_par uuid;
  alter table public.interventions add column if not exists facture_le  timestamptz;
  ```
- [ ] **P1.2 — Fonction de normalisation** (réutilisée par le trigger et le backfill) :
  ```sql
  create or replace function public.normalize_statut_dossier(s text) returns text
  language sql immutable as $$
    select case s
      when 'validee' then 'a_facturer'
      when 'facture_importee' then 'a_facturer'
      when 'facture_a_verifier' then 'a_facturer'
      when 'facture_verifiee' then 'termine'
      when 'a_envoyer' then 'termine'
      when 'cloturee' then 'termine'
      else s end $$;
  ```
- [ ] **P1.3 — Trigger de normalisation** `BEFORE INSERT OR UPDATE` sur `interventions` : `new.statut_dossier := public.normalize_statut_dossier(new.statut_dossier)`. Le nommer `interventions_10_normalize_statut` (les triggers s'exécutent par ordre alphabétique : il doit passer **avant** le trigger de contrôle).
- [ ] **P1.4 — Backfill** (idempotent) :
  ```sql
  update public.interventions
     set statut_dossier = public.normalize_statut_dossier(statut_dossier)
   where statut_dossier in ('validee','facture_importee','facture_a_verifier','facture_verifiee','a_envoyer','cloturee');
  ```
  (Le trigger `updated_at` existant fera re-télécharger ces lignes aux clients : comportement souhaité.)
- [ ] **P1.5 — Contrainte CHECK**, **après** le backfill :
  ```sql
  alter table public.interventions drop constraint if exists interventions_statut_dossier_check;
  alter table public.interventions add constraint interventions_statut_dossier_check
    check (statut_dossier in ('brouillon','a_valider','a_facturer','termine'));
  ```
- [ ] **P1.6 — Trigger de contrôle des transitions** `interventions_20_enforce_statut` (`BEFORE UPDATE`, `security definer`, `set search_path = public`) :
  - Ne rien contrôler si `auth.uid() is null` (SQL Editor, migrations) ni si `statut_dossier` n'a pas changé (les upserts de synchro renvoient la ligne entière).
  - Autoriser uniquement les 6 transitions du tableau §0, avec `public.is_manager()` pour validation/facturation et `current_role() in ('responsable','developpeur')` pour la réouverture.
  - Sinon : `raise exception 'Transition de statut non autorisée : % → % (rôle %)', old.statut_dossier, new.statut_dossier, public.current_role() using errcode = '42501';`
  - **Horodatage serveur** dans le même trigger : passage `a_valider → a_facturer` ⇒ `valide_par = auth.uid(), valide_le = now()` ; passage `a_facturer → termine` ⇒ `facture_par = auth.uid(), facture_le = now()` ; passage vers `brouillon` ⇒ `valide_*` et `facture_*` remis à `null`.
- [ ] **P1.7 — Documents** : mettre à jour le commentaire de `documents.type` (`'devis' | 'contrat_entretien'` ; `'facture'` obsolète, lignes existantes conservées). **Ne pas** supprimer les lignes ni ajouter de contrainte sur `type`.
- [ ] **P1.8 — RLS** : ne pas toucher aux politiques `interventions_*` (le contrôle fin passe par le trigger).

**Vérification P1** (SQL Editor, en re-jouant le fichier **deux fois** pour tester l'idempotence) : plus aucune valeur hors des 4 statuts ; un `update ... set statut_dossier='cloturee'` produit `termine` ; un UPDATE depuis un rôle technicien `a_valider → a_facturer` est refusé (tester avec un JWT technicien ou via le dashboard Auth si possible).

---

## P2 — Données locales et synchro (`idb.js`, `sync.js`)

- [ ] **P2.1 — Table de correspondance partagée** : ajouter dans `idb.js` (objet `DB`) `LEGACY_STATUT` + `normalizeStatut(s)` (mêmes correspondances que P1.2 ; renvoie `s` si inconnu).
- [ ] **P2.2 — Migration IndexedDB** `migrateWorkflow4()` : calquée sur `migrateV2toV3`, protégée par `DB.getMeta("migrated_workflow_4")`, parcourt `DB.listRaw("interventions")` et réécrit `statut_dossier` normalisé via `putRaw`. **Ne pas** mettre en file de synchro et **ne pas** modifier `updated_at`/`synced_at` (le serveur est migré par P1 ; éviter une tempête de push). L'appeler au même endroit que `migrateV2toV3`. Pas de bump de `DB_VERSION` (aucun store/index créé).
- [ ] **P2.3 — Corriger la migration V2→V3 existante** (`idb.js`, ~l.136) : `itv.statut === "terminee" ? "validee" : "a_valider"` → `"a_facturer"` à la place de `"validee"`.
- [ ] **P2.4 — `DB.setStatutDossier(id, statut, extra = {})`** (`idb.js`, ~l.466) : fusionner `extra` dans la fiche (`motif_retour`, `valide_par`, `valide_le`, `facture_par`, `facture_le`), conserver `updated_at`/`synced_at = null`/`enqueueSync`. Normaliser `statut` en entrée.
- [ ] **P2.5 — `sync.js`** (~l.233, nettoyage avant upsert) : appliquer `DB.normalizeStatut` au push **et** dans `applyRemote` (pull/Realtime) pour les `interventions`. Vérifier la liste des champs « purement locaux » retirés avant upsert : les 5 nouvelles colonnes **doivent partir** vers Supabase.
- [ ] **P2.6 — Rejet de transition par le serveur** : lire `pushChanges` ; si l'erreur est `42501` (transition refusée, ex. technicien hors ligne dont l'état local est périmé), **ne pas boucler en retry** : retirer l'élément de la file, afficher un toast explicite (« Changement de statut refusé — fiche resynchronisée ») et déclencher un pull pour ré-aligner la ligne locale.

**Vérification P2** : charger l'app avec des données locales contenant tous les anciens statuts → après rechargement, tous normalisés, aucune entrée créée dans la file de synchro (compteur « en attente » à 0).

---

## P3 — Constantes et rôles (`app.js`, haut de fichier ~l.36-81, ~l.387)

- [ ] **P3.1 — `STATUT_DOSSIER`** réduit à 4 entrées : `brouillon` (muted), `a_valider` (pending), `a_facturer` (blue), `termine` (done). Pour tout statut inconnu/ancien, `statutDossierLabel`/`Cls` passent d'abord par `DB.normalizeStatut`.
- [ ] **P3.2 — `STATUT_DOSSIER_ICON`** réduit à 4 entrées (réutiliser les icônes existantes : `pencil`, `clock`, `file`, `check`).
- [ ] **P3.3 — `STATUT_ORDER = ["brouillon","a_valider","a_facturer","termine"]`** : remplace l'usage de `Object.keys(WORKFLOW_NEXT)` pour l'ordre des groupes du Tableau de bord (~l.887).
- [ ] **P3.4 — Helpers de rôle** (à côté de `isManager`, ~l.387) :
  - `canValidate()` = `isManager()` (responsable, secrétaire, développeur) ;
  - `canReopen()` = `!state.auth || ["responsable","developpeur"].includes(currentRole())`.
  - ⚠️ `isManager()` renvoie `true` quand `!state.auth` (mode local sans compte) : conserver ce comportement, y compris pour `canReopen()`.
- [ ] **P3.5 — Remplacer `WORKFLOW_NEXT`** par `workflowActions(itv)` renvoyant, selon `statut_dossier` normalisé et les rôles, une liste `{ to, label, kind, needsMotif }` :
  - `brouillon` → `[{ to:"a_valider", label:"Soumettre pour validation" }]`
  - `a_valider` → si `canValidate()` : `[{ to:"a_facturer", label:"Valider la fiche", kind:"primary" }, { to:"brouillon", label:"Renvoyer en brouillon", needsMotif:true }]`, sinon `[]`
  - `a_facturer` → si `canValidate()` : `[{ to:"termine", label:"Marquer comme facturé", kind:"accent" }]`, sinon `[]`
  - `termine` → si `canReopen()` : `[{ to:"brouillon", label:"Rouvrir", needsMotif:true }]`, sinon `[]`

**Vérification P3** : `grep -n "validee\|facture_\|a_envoyer\|cloturee" app.js` ne doit plus renvoyer que la table de correspondance (et éventuellement des commentaires).

---

## P4 — Écran détail (`app.js`, `renderDetail` ~l.2450-2610 et gestionnaire `wf` ~l.2866-2900)

- [ ] **P4.1 — Nettoyage** dans `renderDetail` : supprimer `hasFacture`, `dossierPret`, le bouton `#btn-dossier` et son écouteur, l'`<input id="doc-input">` et son écouteur `importDocument(..., "facture", ...)`. Garder `#btn-pdf` (« Générer et partager le PDF ») et `#doc-devis-input`.
- [ ] **P4.2 — `workflowButtonsHTML(itv)`** : supprimer le bouton « Importer la facture (PDF) » ; garder « Importer le devis (PDF) » ; générer les boutons depuis `workflowActions(itv)` (classe `btn-accent` pour `kind:"accent"`).
- [ ] **P4.3 — `documentsHTML`** : texte vide → « Aucun document. Importez le devis produit par votre logiciel externe. » ; conserver le libellé « Facture » pour d'éventuels documents historiques `type === "facture"` (consultation/suppression possibles, plus d'ajout).
- [ ] **P4.4 — Gestionnaire `wf`** :
  - garder la règle existante « signatures obligatoires avant soumission » (`to === "a_valider"`) ;
  - **supprimer** toute la branche `to === "facture_verifiee"` (import facture + génération du dossier fusionné) ;
  - si l'action a `needsMotif` : ouvrir une petite modale (réutiliser le style existant des modales/toasts) avec un `<textarea>` **libre, facultatif**, boutons Annuler / Confirmer ; appliquer le nettoyage de texte existant (trim, lignes vides) ; passer le résultat dans `motif_retour` ;
  - `a_valider → a_facturer` : `extra = { valide_par: state.auth?.user?.id ?? null, valide_le: now }` ;
  - `a_facturer → termine` : `extra = { facture_par: …, facture_le: now }` ;
  - vers `brouillon` : `extra = { motif_retour, valide_par:null, valide_le:null, facture_par:null, facture_le:null }` ;
  - `brouillon → a_valider` : `extra = { motif_retour: null }` ;
  - toast « Statut mis à jour » puis `renderDetail`.
- [ ] **P4.5 — Verrouillage d'édition** : le bouton « Modifier » (icône stylo) n'apparaît que si `statut_dossier === "brouillon"` (« Dupliquer » reste disponible). Ajouter un **garde sur la route `#/edit/:id`** : si la fiche n'est pas en brouillon → redirection vers le détail + toast « Seul un brouillon peut être modifié ». Vérifier que `duplicateIntervention` produit bien un **brouillon** (`statut_dossier` nul/brouillon dans le draft, cf. `emptyDraft` ~l.442).
- [ ] **P4.6 — Bandeau motif** : sur le détail et dans l'éditeur d'un brouillon portant un `motif_retour`, afficher un bandeau « Renvoyé : <motif> » (texte échappé via `esc()`).
- [ ] **P4.7 — Traçabilité** (optionnel, discret) : sur le détail, afficher « Validée le … par … » / « Facturée le … par … » si `valide_le` / `facture_le` renseignés (nom via la liste équipe `resolveTechFullName` si disponible).
- [ ] **P4.8 — Partage de la fiche** : s'assurer que « Générer et partager le PDF » reste visible à **tous** les statuts (plus de statut « à envoyer »).

**Vérification P4** : parcourir le cycle complet sur une fiche (voir matrice P8).

---

## P5 — Listes, Tableau de bord, Tâches (`app.js`)

- [ ] **P5.1** (~l.639, compteur « en cours ») : `!== "cloturee"` → `!== "termine"`.
- [ ] **P5.2** (~l.874, dossiers en cours) : `!== "cloturee"` → `!== "termine"`.
- [ ] **P5.3** (~l.887, groupes du Tableau de bord) : itérer sur `STATUT_ORDER` privé de `termine`, ordre `brouillon, a_valider, a_facturer` ; le bloc « Devis en cours » reste inséré **après `a_valider`**. Le drill-down par statut (retours 09/10) doit fonctionner avec les nouvelles clés.
- [ ] **P5.4 — Accès aux « Terminé »** : les dossiers `termine` sont masqués du Tableau de bord par défaut mais **doivent rester accessibles** (recherche, filtre de statut de l'onglet Dossiers, fiche client). Vérifier qu'un filtre/tri permet de les lister ; sinon ajouter une entrée « Terminé » dans le sélecteur de statut existant.
- [ ] **P5.5** (~l.2659, statistiques par statut) : libellés via `statutDossierLabel` (déjà le cas) ; vérifier l'affichage avec 4 statuts.
- [ ] **P5.6** : le bouton de RDV lié à une fiche (~l.1366) affiche `statutDossierLabel(...)` : contrôler le rendu avec les nouveaux libellés.
- [ ] **P5.7** : ouverture d'une fiche depuis une liste (~l.2937) : `brouillon` → `#/edit/…`, sinon détail (comportement existant, à conserver).

---

## P6 — Suppression du code mort (dossier final fusionné)

- [ ] **P6.1 — `pdf.js`** : supprimer `buildMergedDossierPDF` / `downloadMergedDossierPDF` (~l.451-500, repérer par « dossier final »). **Ne pas toucher** à `downloadInterventionPDF`, `generateContratPDF`.
- [ ] **P6.2 — `app.js`** : supprimer les appels restants à `downloadMergedDossierPDF`.
- [ ] **P6.3 — `pdf-lib`** : vérifier `grep -rn "PDFLib\|pdf-lib" .` ; si seul le dossier fusionné l'utilisait, retirer `<script src="vendor/pdf-lib.min.js">` de `index.html` (~l.38), l'entrée `./vendor/pdf-lib.min.js` du tableau `ASSETS` de `sw.js` (~l.23), et supprimer `vendor/pdf-lib.min.js`.
- [ ] **P6.4** : supprimer l'écouteur/la route `import-facture` et la gestion de `type === "facture"` à l'import (`importDocument` ne doit plus être appelée qu'avec `"devis"`).

**Vérification P6** : l'app se charge sans erreur console, hors ligne comprise (le service worker ne doit plus tenter de mettre en cache un fichier supprimé, sinon `cache.addAll` échoue).

---

## P7 — Documentation et déploiement

- [ ] **P7.1 — `sw.js`** : incrémenter `CACHE_VERSION` (`climatelec-v23` → `climatelec-v24`).
- [ ] **P7.2 — `README.md`** : remplacer la puce « Workflow de dossier (V3) » par : « Brouillon → À valider → À facturer → Terminé ; le devis est importé en PDF, la facture reste dans le logiciel externe ».
- [ ] **P7.3 — `supabase/DEPLOYMENT.md`** : ajouter une note « Workflow 4 statuts : rejouer `schema.sql` (idempotent) **avant** de déployer le front ».
- [ ] **P7.4 — `TACHES_A_FAIRE.md`** : ajouter une section « 22. Simplification du workflow de dossier (13/10/2026) » reprenant P1-P6 sous forme de cases à cocher + fichiers touchés.
- [ ] **P7.5 — `PRD_App_Interventions_Climat_Elec.md`** : au §3.4, passer l'entrée « Simplification du workflow de dossier (13/10/2026 — à développer) » en « livrée » avec la date ; ajouter une ligne au tableau §9 (roadmap).
- [ ] **P7.6 — `documentation/Maquettes.html`** (si les maquettes affichent les anciens statuts) : signaler à l'humain plutôt que modifier sans validation.

**Ordre de déploiement :** 1) rejouer `schema.sql` sur Supabase ; 2) déployer le front. L'inverse est sans danger grâce à la normalisation côté client (P2), mais la contrainte CHECK doit être créée **après** le backfill.

---

## P8 — Tests manuels (matrice de recette)

Comptes : **Jérémy** (`technicien`), **Delphine** (`secretaire`), **Régis** (`responsable`). Une fiche de test par parcours.

| # | Scénario | Résultat attendu |
|---|---|---|
| 1 | Jérémy crée une intervention et clique « Enregistrer le brouillon » à l'étape 2 | Statut Brouillon, reprise possible, visible dans Tâches |
| 2 | Jérémy termine et soumet sans signature | Refus avec message (règle existante) |
| 3 | Jérémy signe puis soumet | Statut À valider ; plus de bouton « Modifier » ; aucun bouton de validation visible pour lui |
| 4 | Delphine ouvre la fiche, « Renvoyer en brouillon » avec motif « Photo manquante » | Retour Brouillon ; Jérémy voit le bandeau avec le motif ; `valide_*` vides |
| 5 | Jérémy complète puis soumet de nouveau | À valider ; `motif_retour` effacé |
| 6 | Régis « Valider la fiche » | À facturer ; `valide_par/valide_le` renseignés |
| 7 | Delphine « Marquer comme facturé » | Terminé ; `facture_par/facture_le` renseignés ; disparaît du Tableau de bord par défaut mais retrouvable (recherche/filtre) |
| 8 | Delphine ouvre une fiche Terminé | **Aucun** bouton « Rouvrir » |
| 9 | Régis « Rouvrir » avec motif libre | Brouillon, motif affiché, `valide_*`/`facture_*` remis à vide |
| 10 | Jérémy tente `#/edit/<id>` d'une fiche À valider (URL directe) | Redirection vers le détail + toast |
| 11 | Détail d'une fiche à n'importe quel statut | « Générer et partager le PDF » fonctionne ; plus de bouton facture ni dossier final |
| 12 | Import d'un devis PDF sur une fiche À valider/À facturer | OK, sans impact sur le statut |
| 13 | Données locales avec anciens statuts (`cloturee`, `facture_importee`…) puis rechargement | Normalisés en `termine` / `a_facturer`, file de synchro vide |
| 14 | Jérémy hors ligne soumet, puis reconnexion | Synchro OK, statut À valider côté serveur |
| 15 | Fiche passée À facturer par Régis pendant que Jérémy (hors ligne, état périmé) tente de la repasser À valider | Serveur refuse (42501), pas de boucle de retry, fiche ré-alignée au pull |
| 16 | Mode sans compte (non connecté, local) | Toutes les actions disponibles (comportement `isManager()` existant) |
| 17 | Rejouer `schema.sql` deux fois | Aucune erreur, aucune donnée modifiée la 2ᵉ fois |
| 18 | Hors ligne après déploiement (nouveau service worker) | App chargée depuis le cache sans erreur `addAll` |

---

## Critères d'acceptation globaux

1. Seuls 4 statuts existent côté serveur (CHECK), client (constantes) et UI.
2. Les 6 transitions du §0 fonctionnent, avec les bons rôles ; toute autre est refusée côté serveur.
3. Aucun reste d'import de facture ni de « dossier final » dans l'interface ni dans `pdf.js`.
4. Les données existantes sont migrées sans perte, serveur et appareils.
5. Seul un brouillon est modifiable ; un dossier Terminé n'est rouvrable que par Régis.
6. `CACHE_VERSION` incrémentée ; documentation (README, DEPLOYMENT, TACHES, PRD) à jour.

## Hors périmètre (ne pas faire)

- Synchronisation Google Agenda, envoi d'e-mail automatique, génération de factures/devis.
- Verrouillage serveur du **contenu** des fiches non brouillon (la règle d'édition reste côté interface).
- Refonte du Tableau de bord au-delà des clés de statut.
