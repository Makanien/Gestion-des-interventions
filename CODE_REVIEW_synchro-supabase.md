# Revue de code — branche `synchro-supabase`

- **Date :** 16/08/2026
- **Branche revue :** `synchro-supabase` (base `dev`)
- **Périmètre :** 8 commits, 16 fichiers, ~1500 lignes ajoutées
- **Contexte :** intégration Supabase V2 (auth, synchronisation multi-appareil, signatures électroniques)

> Chaque item est référencé par un identifiant (`S1`, `P1`, `C1`, `D1`…) et un emplacement `fichier:ligne` pour être repris point par point.

---

## Table des matières

1. [Sécurité](#1--sécurité)
2. [Performance](#2--performance)
3. [Qualité & cohérence (bugs)](#3--qualité--cohérence-bugs)
4. [Code mort & doublons](#4--code-mort--doublons)
5. [Plan d'action priorisé](#5--plan-daction-priorisé)
6. [Checklist de suivi](#6--checklist-de-suivi)

---

## 1. 🔒 Sécurité

### S1 — RLS ouvertes en écriture à tout utilisateur authentifié *(élevé)*
- **Où :** `supabase/schema.sql:177-213`
- **Constats :** toutes les politiques sont `using (true)` / `with check (true)`. N'importe quel utilisateur connecté peut lire / modifier / supprimer **toutes** les données de l'équipe, sans notion de périmètre ou d'équipe.
- **Risque :** si l'inscription publique par email est activée (défaut Supabase), **n'importe qui peut créer un compte et accéder à tout**.
- **Remarque :** le commentaire dit « même équipe », mais rien ne l'implémente côté SQL.
- **Piste :** limiter à un périmètre réel (ex. `created_by = auth.uid()` ou table d'équipes) et/ou désactiver l'auto-inscription.

### S2 — Bucket de signatures public en lecture *(moyen)*
- **Où :** `supabase/storage.sql:3-8`
- **Constats :** `public = true` + politique `select` sur `bucket_id = 'signatures'`.
- **Risque :** les signatures (données personnelles) sont lisibles par quiconque possède l'URL, même sans authentification.

### S3 — Cohérence clé anon *(info)*
- **Où :** `config.js:10`
- **Constats :** la clé `sb_publishable_...` est commitée. Correct par nature (clé publique), mais combinée à S1 cela signifie : *authentification ⇒ accès total*.
- **Rappel :** `DEPLOYMENT.md:44` prévient bien de ne jamais exposer `service_role`.

### S4 — `handle_new_user` en `security definer` *(info)*
- **Où :** `supabase/schema.sql:148-156`
- **Constats :** pratique standard, mais risque lié à `search_path`.
- **Piste :** fixer `search_path` ou qualifier les objets dans les fonctions `security definer`.

### S5 — XSS : bien maîtrisé *(OK)*
- `esc()` est utilisé systématiquement dans les templates (`app.js:40`), y compris pour les URL de signatures et les attributs. Aucune faille XSS identifiée.

---

## 2. ⚡ Performance

### P1 — Scan complet `getAll()` + filtre JS au lieu des index IndexedDB
- **Où :** `idb.js:278-283`, `314-317`, `285-328`
- **Constats :** `listEquipementsForIntervention`, `listPiecesForIntervention`, `replaceEquipements`, `replacePieces` lisent **toute la table** puis filtrent en mémoire.
- **Aggravant :** l'index `intervention_id` n'est pas créé sur `equipements` (`idb.js:32-36`), et là où il existe (`pieces_utilisees:39`), il n'est jamais utilisé.
- **Impact :** acceptable pour quelques centaines de lignes, ne passera pas à l'échelle.
- **Résolution (23/08/2026) :** les lectures d'enfants d'une fiche passent désormais par les **index IndexedDB** au lieu de `getAll()` + filtre en mémoire :
  - **Index manquant créé** : `intervention_id` sur `equipements` (bump `DB_VERSION` 3 → 4). La migration se fait automatiquement dans `onupgradeneeded` via un helper `ensureIndex` qui ajoute l'index sur un store existant sans perdre les données.
  - **Helper dédié** : `DB.listByIndex(store, index, value)` (`idb.js`) — équivalent ciblé de `listRaw` pour les requêtes par index.
  - **Fonctions migrées** : `listEquipementsForIntervention` (index `intervention_id`), `listEquipementsForClient` (index `client_id`), `listPiecesForIntervention` / `listMesuresForIntervention` / `listPhotosForIntervention` / `listDocumentsForIntervention` (index `intervention_id`), et `DB.replaceChildren` (utilisé par les cinq `replace*` et `deleteIntervention`) ne scannent plus la table entière.
  - **Effet collatéral (P2)** : les listes d'enfants étant indexées, `getIntervention` a pu être réduite à une **seule transaction readonly** (voir P2).

### P2 — `getIntervention` en N+1
- **Où :** `idb.js:332-385`
- **Constats :** chaque détail d'intervention déclenchait 2 scans complets + 1 lecture client (puis 5 lectures séquentielles par index après P1).
- **Résolution (23/08/2026) :** `getIntervention` lit désormais l'intervention, le client (jointure `client_id`) et les 5 collections d'enfants (équipements, pièces utilisées, mesures, photos, documents) via leurs index `intervention_id` dans **une seule transaction readonly** (`multi-get`). Le N+1 structurel est éliminé : une seule transaction IndexedDB au lieu de 6 requêtes séquentielles.

### P3 — Abonnements Realtime dupliqués
- **Où :** `app.js:1033` & `app.js:1051`, `sync.js:143-157`
- **Constats :** `Sync.initRealtime()` est appelé à **chaque** événement d'auth (y compris `TOKEN_REFRESHED`, ~toutes les heures) sans garde-fou. Chaque appel recrée 4 channels ⇒ abonnements accumulés + re-pull multipliés.

### P4 — Signature base64 poussée dans la base
- **Où :** `app.js:701-711` + `sync.js:98-106`
- **Constats :** hors ligne, `client_signature_url` contient un dataURL (~100 Ko+) qui est poussé tel quel dans `interventions.client_signature_url`. Gonfle les lignes et le payload de sync.

---

## 3. 🧩 Qualité & cohérence (bugs)

### C1 — La liste d'accueil perd le nom du client après synchronisation *(élevé)*
- **Où :** `idb.js:214-217`, `sync.js:54-73`, `app.js:238-256`
- **Constats :** `listInterventions` renvoie les lignes sans joindre `client`. `applyRemote` écrase la ligne locale par `cleanRow(remote)`, qui **supprime `client`**. Dès le premier aller-retour de sync, la liste affiche « Client » partout et la recherche par nom de client ne matche plus.
- **Piste :** joindre `client` par `client_id` dans `listInterventions` (comme `getIntervention`), au lieu du champ dénormalisé.

### C2 — Équipements/pièces supprimés qui « ressuscitent » *(moyen)*
- **Où :** `idb.js:285-303` (`replaceEquipements`), `318-328` (`replacePieces`)
- **Constats :** les enfants existants sont **hard-delete** localement sans tombstone ni mise en file. La suppression n'est jamais propagée à Supabase : au prochain pull, l'enfant supprimé est réinséré (`sync.js:58-61`).
- **Résolution (23/08/2026) :** les cinq fonctions `replace*` (équipements, pièces utilisées, mesures, photos, documents) passent désormais par un helper commun `DB.replaceChildren` (`idb.js`). Les enfants retirés d'une fiche sont **soft-deletés** (tombstone `_deleted` + `deleted_at`) et **mis en file de sync** : le push les envoie en `Supabase.remove` (soft-delete côté serveur), puis le pull suivant nettoie le tombstone via `applyRemote`. Une ligne réintroduite dans la fiche (même `id`) voit son tombstone levé (`_deleted`/`deleted_at` supprimés). `created_at` est en outre préservé à la ré-édition (au lieu d'être réécrit à `now`).

### C3 — Collision d'`id` dans l'historisation d'équipement *(moyen)*
- **Où :** `idb.js:413-419`
- **Constats :** `saveClientEquipment` réutilise `eq.id || uuid()`. En édition, un équipement lié à l'intervention avec un `id` existant + nouveau n° de série : la copie « historique » écrase la ligne liée à l'intervention (même clé `id`) ⇒ l'équipement disparaît de la fiche.
- **Piste :** générer toujours un `uuid()` neuf.
- **Résolution (23/08/2026) :** `saveClientEquipment` génère désormais **toujours un `id` neuf** (`uuid()`) et ne réutilise plus celui de la ligne liée à la fiche — plus aucune écriture ne peut écraser un équipement d'intervention. La copie d'historique détache en outre `intervention_id` (ainsi que les champs locaux `_deleted`/`deleted_at`/`synced_at`) : elle reste un équipement du client, sans lien avec la fiche, et demeure visible de `listEquipementsForClient` (filtre `!intervention_id`).

### C4 — Signature hors ligne jamais ré-uploadée *(moyen)*
- **Où :** `app.js:701-711`
- **Constats :** le PRD (`DEPLOYMENT.md:82-83`) promet un envoi « dès que le réseau est disponible ». En réalité, hors ligne le dataURL reste collé dans la ligne et le blob `_client_sig_blob` est perdu après fermeture du draft : aucun upload différé n'existe.

### C5 — Orphelins côté serveur sur suppression *(bas)*
- **Où :** `idb.js:254-270`
- **Constats :** `deleteIntervention` supprime en dur les enfants localement et n'enfile que l'intervention. Côté Supabase, le soft-delete de l'intervention ne déclenche pas la cascade `on delete` sur les enfants (ce n'est qu'un `update`) ⇒ équipements/pièces orphelins.
- **Résolution (23/08/2026) :** `deleteIntervention` passe désormais par le même mécanisme que C2 — chaque enfant de la fiche (équipements, pièces utilisées, mesures, photos, documents) est **soft-deleté** (tombstone `_deleted` + `deleted_at`) via `DB.replaceChildren(store, "intervention_id", id, [])` puis **mis en file de sync** : le push les envoie en `Supabase.remove` (soft-delete côté serveur), si bien que le serveur ne conserve plus d'orphelins à la suppression d'une fiche. L'historique équipements du client (`client_id`, sans `intervention_id`) reste inchangé.

### C6 — Compteur « en attente » jamais alimenté *(bas)*
- **Où :** `app.js:32`, `186-188`, `951`
- **Constats :** `state.sync.pending` n'est jamais assigné ⇒ l'UI affiche toujours « Aucun changement en attente » alors qu'une vraie file existe (`SyncState.queue`).

### C7 — Perte de file en cas de coupure réseau pendant le push *(bas)*
- **Où :** `sync.js:81-95`
- **Constats :** la file est vidée (`SyncState.queue = []`) avant la boucle ; si `navigator.onLine` devient faux en cours de route, le reste est perdu jusqu'à un `pushAllLocal` (uniquement au sign-in).

### C8 — « Dernière écriture gagne » faussé par le trigger serveur *(bas)*
- **Où :** `schema.sql:117-123` + `sync.js:64-73`
- **Constats :** le trigger écrase `updated_at = now()` à chaque `update`. Le client compare des horodatages serveur vs client ; en cas de dérive d'horloge, la résolution de conflit devient imprévisible.
- **Résolution (23/08/2026) :** les deux côtés de la comparaison suivent désormais une **horloge unique (serveur)**. L'upsert retourne la ligne écrite (`Supabase.upsert` → `select("id, updated_at")` dans `supabase.js`) : comme le trigger `set_updated_at` a posé `updated_at` avec l'horloge du serveur, `pushChanges` (as `sync.js`) **aligne la copie locale** sur cette valeur à chaque push. La comparaison de conflits dans `applyRemote` compare ainsi deux horodatages serveur. En complément, **toute modification locale pas encore poussée** (toujours présente dans `SyncState.queue`) **l'emporte localement** pendant le pull (nouvelle garde `isPending`) : une saisie faite hors ligne n'est jamais écrasée par le remote, quelle que soit la dérive de l'horloge du mobile (les changements en file étant re-poussés ensuite).

---

## 4. 🗑️ Code mort & doublons

| Réf | Élément | Emplacement | État |
|---|---|---|---|
| D1 | `SELF_CLIENT_FIELDS` déclaré, jamais utilisé | `sync.js:23` | à supprimer |
| D2 | `removeSignature` jamais appelé (pas de nettoyage des anciens fichiers) | `supabase.js:139-150` | à supprimer ou brancher |
| D3 | `importAll` jamais exposé dans l'UI (aucun bouton d'import) | `idb.js:705-723` | à brancher ou supprimer |
| D4 | Colonne `temps_intervention` jamais écrite (« calculé » jamais calculé) | `schema.sql:42` | à renseigner ou supprimer |
| D5 | `synced_at` toujours mis à `null`, jamais renseigné, supprimé au push | `idb.js:197,235` ; `sync.js:102` | write-only |
| D6 | En-tête `-- REALTIME` dupliqué | `schema.sql:239-243` | cosmétique |
| D7 | Liste des 4 stores dupliquée 3× | `sync.js:42`, `125`, `147` | à factoriser |
| D8 | `replaceEquipements` ≈ `replacePieces` ; motif `listRaw+filter` répété 4× | `idb.js:273-328` | à factoriser |
| D9 | `state.sync.running` / `state.sync.lastPulledAt` inutilisés (double de `SyncState`) | `app.js:225` | à supprimer |

---

## 5. 🎯 Plan d'action priorisé

1. **Corriger C1** — joindre `client` par `client_id` dans `listInterventions` (feature V2 cassée).
2. **Restreindre S1** — limiter les RLS à un périmètre réel et/ou désactiver l'auto-inscription email.
3. **Corriger C2/C5** — propager les suppressions d'enfants (tombstones) au lieu de hard-delete local.
4. **Corriger C3** — `saveClientEquipment` doit générer un `id` neuf systématiquement.
5. **Nettoyer P3 + D1/D2/D4/D6/D9** — garde-fou `initRealtime`, supprimer constantes/fonctions/colonnes mortes.
6. **Traiter C4** — upload différé des signatures, ou aligner le PRD sur la réalité.

---

## 6. ✅ Checklist de suivi

> **Vérification du 23/08/2026 (branche `application-v3`) :** points revus contre le code actuel.
> ☑ = corrigé depuis la revue · ◐ = partiellement corrigé · ☐ = toujours d'actualité.

| Réf | Sévérité | Résolu | Note |
|---|---|---|---|
| S1 | Élevé | ☑ | RLS par rôle (`001_roles_rls.sql`) : interventions/pieces_utilisees/profiles scopées + anti-élévation ; clients/equipements restent partagés (barrière = inscription publique désactivée) |
| S2 | Moyen | ☐ | bucket `signatures` toujours public (choix assumé : URL directe dans le PDF) |
| S3 | Info | ☐ | clé anon publique par nature |
| S4 | Info | ☐ | `handle_new_user` toujours `security definer` sans `set search_path` (les autres fonctions l'ont) |
| S5 | OK | ☑ | rien à faire |
| P1 | Moyen | ☑ | index `intervention_id` créé sur `equipements` (V4, `ensureIndex` sur store existant) + helper `DB.listByIndex` (`idb.js`) ; les listes d'enfants d'une fiche (équipements, pièces utilisées, mesures, photos, documents) et `replaceChildren` passent par l'index — plus de scan complet ; `listEquipementsForClient` utilise l'index `client_id` |
| P2 | Bas | ☑ | `getIntervention` réécrite en **une seule transaction readonly** (multi-get) : intervention + client (jointure `client_id`) + 5 collections d'enfants par index `intervention_id` (`idb.js:332`) — le N+1 structurel est éliminé |
| P3 | Moyen | ☑ | garde-fou `realtimeStarted` (`sync.js:187`) + appel unique (`app.js:2274`) |
| P4 | Moyen | ☑ | `cleanRow` neutralise tout dataURL (`sync.js:139-140`) ; `mergeRemote` préserve le dataURL local tant que l'URL Storage n'existe pas (`sync.js:81`) |
| C1 | Élevé | ☑ | `listInterventions` joint `client` par `client_id` (`idb.js:262`) |
| C2 | Moyen | ☑ | `replace*` factorisées dans `DB.replaceChildren` (`idb.js`) : soft-delete des enfants retirés (tombstone `_deleted`/`deleted_at`) + mise en file → propagation à Supabase, nettoyage du tombstone au pull suivant, tombstone levé si la ligne revient dans la fiche |
| C3 | Moyen | ☑ | `saveClientEquipment` génère toujours un `id` neuf et détache `intervention_id`/champs locaux (`idb.js`) — plus de collision avec la ligne liée à la fiche, la copie d'historique reste visible de `listEquipementsForClient` |
| C4 | Moyen | ☑ | `uploadPendingSignatures` (`sync.js:100`) ré-upload les dataURL de signature vers le bucket `signatures` au retour du réseau, puis re-sync (appelé dans `runSync`) |
| C5 | Bas | ☑ | `deleteIntervention` soft-delete les enfants via `DB.replaceChildren(…, [])` + file de sync, pas de hard-delete (`idb.js`) |
| C6 | Bas | ☑ | `updatePendingUI` alimente `state.sync.pending` (`sync.js:115`) |
| C7 | Bas | ☑ | `pushChanges` remet en file les éléments non envoyés (`sync.js:89`) |
| C8 | Bas | ☑ | `Supabase.upsert` retourne la ligne écrite (`select("id, updated_at")`) ; `pushChanges` aligne la copie locale sur `updated_at` du serveur, la comparaison de conflits compare deux horodatages serveur ; de plus une modification locale encore dans la file de sync l'emporte localement au pull (`isPending` dans `applyRemote`) — une saisie hors ligne n'est jamais écrasée malgré la dérive d'horloge |
| D1 | Bas | ☑ | `SELF_CLIENT_FIELDS` supprimé (`sync.js`) |
| D2 | Bas | ☑ | `removeSignature` branché sur la re-signature (fiche + contrat) : l'ancien fichier Storage est supprimé dès qu'une nouvelle signature le remplace (`app.js:1497-1523, 1928-1949` ; `supabase.js:139-148`) |
| D3 | Bas | ☑ | `importAll` branché : bouton « Importer une sauvegarde » dans l'écran Compte & synchro (`app.js:2255, 2134-2149`) ; les lignes restaurées rejoignent la file de sync (`idb.js:705-717`) |
| D4 | Bas | ☑ | `temps_intervention` désormais renseigné : calculé à partir de `heure_arrivee`/`heure_depart` à la lecture de l'étape « Intervention » (réutilise `computeDuration`, `app.js`) ; champ initialisé dans le draft et chargé depuis une fiche existante ; normalisé à `""` dans `cleanRow` pour la colonne `not null` |
| D5 | Bas | ☑ | `synced_at` désormais renseigné après un push réussi : `pushChanges` aligne la copie locale sur l'horloge serveur (`synced_at = updated_at` serveur, même principe que C8) — `null` signale une ligne modifiée localement non encore poussée (`idb.js`), la valeur reste une marque locale non poussée (`cleanRow`, `sync.js`) |
| D6 | Bas | ☑ | en-tête `REALTIME` fusionné (un seul bloc) (`schema.sql:239-243`) |
| D7 | Bas | ☑ | liste centralisée dans `SYNC_STORES` (`sync.js:169`) |
| D8 | Bas | ☑ | `replace*` factorisées dans `DB.replaceChildren` ; le motif `listRaw + filtre !_deleted` est factorisé dans deux helpers `DB.listActive` / `DB.listActiveByIndex` (`idb.js:220-231`), utilisés par toutes les fonctions de liste (clients, interventions, équipements, pièces, mesures, photos, documents, appels, rendez-vous, contrats, base pièces) et `exportAll` |
| D9 | Bas | ☑ | `state.sync.running` / `lastPulledAt` supprimés — seul `state.sync.pending` (alimenté par `updatePendingUI`) est conservé (`app.js:225`) |

> **Remarque environnement :** pas de `node`/linter ni de config de build dans ce dépôt (site statique) ; la vérification syntaxique automatisée n'a pas pu être lancée.
