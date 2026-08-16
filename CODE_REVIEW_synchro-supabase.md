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

### P2 — `getIntervention` en N+1
- **Où :** `idb.js:218-226`
- **Constats :** chaque détail d'intervention déclenche 2 scans complets + 1 lecture client.

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

### C3 — Collision d'`id` dans l'historisation d'équipement *(moyen)*
- **Où :** `idb.js:305-311`
- **Constats :** `saveClientEquipment` réutilise `eq.id || uuid()`. En édition, un équipement lié à l'intervention avec un `id` existant + nouveau n° de série : la copie « historique » écrase la ligne liée à l'intervention (même clé `id`) ⇒ l'équipement disparaît de la fiche.
- **Piste :** générer toujours un `uuid()` neuf.

### C4 — Signature hors ligne jamais ré-uploadée *(moyen)*
- **Où :** `app.js:701-711`
- **Constats :** le PRD (`DEPLOYMENT.md:82-83`) promet un envoi « dès que le réseau est disponible ». En réalité, hors ligne le dataURL reste collé dans la ligne et le blob `_client_sig_blob` est perdu après fermeture du draft : aucun upload différé n'existe.

### C5 — Orphelins côté serveur sur suppression *(bas)*
- **Où :** `idb.js:254-270`
- **Constats :** `deleteIntervention` supprime en dur les enfants localement et n'enfile que l'intervention. Côté Supabase, le soft-delete de l'intervention ne déclenche pas la cascade `on delete` sur les enfants (ce n'est qu'un `update`) ⇒ équipements/pièces orphelins.

### C6 — Compteur « en attente » jamais alimenté *(bas)*
- **Où :** `app.js:32`, `186-188`, `951`
- **Constats :** `state.sync.pending` n'est jamais assigné ⇒ l'UI affiche toujours « Aucun changement en attente » alors qu'une vraie file existe (`SyncState.queue`).

### C7 — Perte de file en cas de coupure réseau pendant le push *(bas)*
- **Où :** `sync.js:81-95`
- **Constats :** la file est vidée (`SyncState.queue = []`) avant la boucle ; si `navigator.onLine` devient faux en cours de route, le reste est perdu jusqu'à un `pushAllLocal` (uniquement au sign-in).

### C8 — « Dernière écriture gagne » faussé par le trigger serveur *(bas)*
- **Où :** `schema.sql:117-123` + `sync.js:64-73`
- **Constats :** le trigger écrase `updated_at = now()` à chaque `update`. Le client compare des horodatages serveur vs client ; en cas de dérive d'horloge, la résolution de conflit devient imprévisible.

---

## 4. 🗑️ Code mort & doublons

| Réf | Élément | Emplacement | État |
|---|---|---|---|
| D1 | `SELF_CLIENT_FIELDS` déclaré, jamais utilisé | `sync.js:17` | à supprimer |
| D2 | `removeSignature` jamais appelé (pas de nettoyage des anciens fichiers) | `supabase.js:127-130` | à supprimer ou brancher |
| D3 | `importAll` jamais exposé dans l'UI (aucun bouton d'import) | `idb.js:358-364` | à brancher ou supprimer |
| D4 | Colonne `temps_intervention` jamais écrite (« calculé » jamais calculé) | `schema.sql:42` | à renseigner ou supprimer |
| D5 | `synced_at` toujours mis à `null`, jamais renseigné, supprimé au push | `idb.js:197,235` ; `sync.js:102` | write-only |
| D6 | En-tête `-- REALTIME` dupliqué | `schema.sql:240-246` | cosmétique |
| D7 | Liste des 4 stores dupliquée 3× | `sync.js:42`, `125`, `147` | à factoriser |
| D8 | `replaceEquipements` ≈ `replacePieces` ; motif `listRaw+filter` répété 4× | `idb.js:273-328` | à factoriser |
| D9 | `state.sync.running` / `state.sync.lastPulledAt` inutilisés (double de `SyncState`) | `app.js:32` | à supprimer |

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

| Réf | Sévérité | Résolu | Note |
|---|---|---|---|
| S1 | Élevé | ☐ | |
| S2 | Moyen | ☐ | |
| S3 | Info | ☐ | |
| S4 | Info | ☐ | |
| S5 | OK | ☐ | rien à faire |
| P1 | Moyen | ☐ | |
| P2 | Bas | ☐ | |
| P3 | Moyen | ☐ | |
| P4 | Moyen | ☐ | |
| C1 | Élevé | ☐ | |
| C2 | Moyen | ☐ | |
| C3 | Moyen | ☐ | |
| C4 | Moyen | ☐ | |
| C5 | Bas | ☐ | |
| C6 | Bas | ☐ | |
| C7 | Bas | ☐ | |
| C8 | Bas | ☐ | |
| D1 | Bas | ☐ | |
| D2 | Bas | ☐ | |
| D3 | Bas | ☐ | |
| D4 | Bas | ☐ | |
| D5 | Bas | ☐ | |
| D6 | Bas | ☐ | |
| D7 | Bas | ☐ | |
| D8 | Bas | ☐ | |
| D9 | Bas | ☐ | |

> **Remarque environnement :** pas de `node`/linter ni de config de build dans ce dépôt (site statique) ; la vérification syntaxique automatisée n'a pas pu être lancée.
