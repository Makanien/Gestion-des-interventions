# Analyse de l'application « Climat Elec — Fiches d'intervention »

- **Dépôt analysé :** `Makanien/Gestion-des-interventions` (branche `main`, commit `286608e`)
- **Date de l'analyse :** 09/10/2026
- **Périmètre demandé :** cohérence (PRD / README / code / schéma SQL), sécurité, bonnes pratiques, pistes d'amélioration
- **Format :** document conçu pour être repris par un agent de développement (identifiants stables, fichiers, correctif attendu, critères d'acceptation)

---

## 0. Lecture rapide

### 0.1 Verdict global

Le projet est **solide pour un projet de cette taille** : architecture offline-first cohérente, RLS par rôle réfléchie, échappement HTML systématique (`esc()`), documentation abondante et revue de code interne déjà menée. La documentation est même plus riche que la moyenne.

Mais la lecture du code révèle **des écarts importants entre ce que le PRD et la revue de code déclarent « résolu » et ce que le code fait réellement**. Les plus graves concernent la synchronisation (risque de **perte de données** entre appareils) et le stockage (fuites possibles via les politiques Storage).

### 0.2 Les 7 points à traiter en premier

| # | ID | Sévérité | Résumé |
|---|----|----------|--------|
| 1 | SYNC-01 | 🔴 Élevée | `pushAllLocal()` est appelé à chaque démarrage, « Synchroniser maintenant » et chaque retry : les données **locales écrasent les données serveur** (y compris des versions plus récentes saisies sur un autre appareil). |
| 2 | SEC-01 | 🔴 Élevée | La politique `signatures_read` n'est pas limitée à `authenticated` : n'importe qui avec la clé anon (publique) peut **lister** toutes les signatures. Le « nom non devinable (UUID) » ne protège donc plus rien. |
| 3 | SEC-02 | 🔴 Élevée | Buckets privés `photos` / `documents` : lecture ouverte à **tout** utilisateur authentifié. Le périmètre par rôle des tables est contourné pour les fichiers (factures, devis, photos). |
| 4 | SCHEMA-01 | 🔴 Élevée | `interventions.technicien_id` est utilisé par les policies/triggers mais **n'est jamais créé** dans `schema.sql`. Le « fichier maître idempotent sur base neuve » échoue (à confirmer sur un projet Supabase vierge). |
| 5 | NUM-01 | 🟠 Moyenne+ | La numérotation `FIC/ENT/CTR` est un **compteur local à chaque appareil** (`_meta`, non synchronisé, aucune contrainte d'unicité) : doublons de numéros garantis avec 2 techniciens. Contredit le PRD (« compteur synchronisé »). |
| 6 | SYNC-02 | 🟠 Moyenne+ | File de sync et curseur de pull **non persistés**, pull **sans pagination** (limite 1000 lignes), pull de tous les `data_url` base64 à chaque lancement. |
| 7 | UX-01 | 🟠 Moyenne+ | Le service worker déclenche `window.location.reload()` sans condition : une fiche en cours de saisie (wizard) est **perdue** (seul le brouillon « Nouvel appel » est persisté). |

### 0.3 Limites de l'analyse (honnêteté sur ce qui a été vérifié)

- **Lu intégralement :** `README.md`, `PRD_App_Interventions_Climat_Elec.md`, `TACHES_A_FAIRE.md`, `CODE_REVIEW_synchro-supabase.md`, `supabase/schema.sql`, `supabase.js`, `sync.js`, `config.js`, `sw.js`, `index.html`, `manifest.json`.
- **Lu en partie (extraits ciblés + recherches `grep`) :** `app.js` (2558 lignes), `idb.js` (728 lignes). `pdf.js`, `signature.js`, `style.css`, `supabase/DEPLOYMENT.md` n'ont été que survolés ou interrogés par `grep`.
- **Non exécuté :** aucun test en conditions réelles (pas de projet Supabase de test, pas de navigateur). Les points marqués **« à confirmer par test »** découlent d'une lecture du code et de la sémantique PostgreSQL/Supabase ; ils doivent être reproduits avant correction.
- **Non audité :** la configuration réelle du projet Supabase (inscription publique désactivée ? Redirect URLs ? SMTP ? sauvegardes ?), l'hébergement de production, le contenu réel de la base.
- Ce document n'est **pas un avis juridique** (RGPD, valeur probante des signatures, obligations liées au CERFA/fluides) : les points concernés sont à faire valider par un professionnel.

---

## 1. Cohérence

### 1.1 Cohérence interne PRD ↔ code ↔ schéma ↔ README

#### COH-01 — Le PRD annonce une synchronisation qui n'existe pas (numérotation) 🟠
- **PRD §5.2 :** « un compteur par type de document… compteur local **synchronisé** ».
- **Code (`idb.js:275-281`) :** `nextNumero()` lit/écrit `numero_{PREFIX}_{année}` dans le store `_meta`. `_meta` n'est pas dans `SYNC_STORES` (`sync.js`). Le schéma n'a **aucun index unique** sur `interventions.numero` / `contrats_entretien.numero` (défaut `''`).
- **Conséquence :** deux appareils génèrent chacun `FIC-2026-001`.
- → voir **NUM-01** (§4).

#### COH-02 — Deux « statuts » qui se télescopent dans le PRD 🟡
- **PRD §5.1 :** `Intervention.statut` = `a_prevoir | terminee | terminee_suite` (défaut `a_prevoir`).
- **PRD §5.2 :** « Intervention (extensions V3) : `+ statut: brouillon | a_valider | … | cloturee` » — même nom, autre sémantique.
- **Réalité (code/schéma) :** deux colonnes distinctes : `statut` (statut terrain) et `statut_dossier` (workflow).
- **Schéma :** `statut` a pour défaut `'terminee'` et le commentaire dit `'terminee' | 'a_prevoir'` (2 valeurs, pas 3) ; le PRD dit défaut `a_prevoir`. `statut_dossier` a pour défaut `'a_valider'` alors que le PRD place « Brouillon » en premier.
- **Action :** corriger PRD §5.2 (`statut_dossier`), aligner commentaire + défaut SQL, ajouter des contraintes `CHECK` (voir DB-01).

#### COH-03 — Modèle de données PRD §5.2 ≠ schéma réel 🟡
| PRD §5.2 | Schéma réel |
|---|---|
| `Mesure.fiche_id` | `mesures.intervention_id` |
| `Photo.url (Supabase Storage)` | `photos.data_url` (base64 **synchronisé en base**) + `photos.fichier_url` |
| `ContratEntretien.pdf_url` | colonne absente (le PDF est régénéré à la demande) |
| `Intervention.prochaine_intervention_prevue: bool` | `boolean` — une **date** serait plus utile métier (voir IMP-02) |
| `Appel.rendezvous_id` | `appels.rendezvous_id uuid` **sans clé étrangère** (alors que `rendezvous.appel_id` en a une) |
| Commentaire `photos.fichier_url` : « URL Storage **publique** » | bucket `photos` **privé**, et la valeur stockée est un **chemin**, pas une URL |

#### COH-04 — Rôles : 3 dans le PRD, 4 dans le code 🟡
- **PRD §2 (note)** : enum à 3 valeurs (`responsable`, `technicien`, `secretaire`). **PRD §3.4 + schéma** : 4 valeurs, avec `developpeur` (privilèges manager complets, via `is_manager()`).
- **UI (`app.js:238`)** : `currentRole()` retourne **`"responsable"` par défaut** si le profil n'est pas chargé ; `isManager()` est **vrai quand l'utilisateur n'est pas connecté**. En cas d'échec du chargement du profil (`.catch(() => null)`), un technicien voit l'interface manager (la RLS protège les données, mais l'UI est trompeuse et provoque des 403 en sync). → **SEC-09**.

#### COH-05 — « Bouton + » proposé à tous, contrat réservé aux managers 🟠
- **UI (`app.js:703-717`)** : « Contrat d'entretien annuel » est proposé sans condition de rôle.
- **RLS (`contrats_insert`)** : `with check (public.is_manager())`.
- **Conséquence :** un technicien crée un contrat localement, la sync échoue en 403 en boucle (voir SYNC-03).

#### COH-06 — Contrôle des rôles du workflow : spécifié mais non appliqué 🟠
- **PRD** : Régis valide, Delphine facture, Régis vérifie la facture.
- **Code (`app.js:2236-2252`)** : l'action `wf` appelle `DB.setStatutDossier(id, to)` **sans aucun contrôle de rôle ni de transition autorisée**. **Serveur :** la RLS autorise la mise à jour de la fiche par son créateur/technicien, sans règle sur `statut_dossier`.
- **Conséquence :** un technicien peut valider/clôturer sa propre fiche ; aucune traçabilité de qui a changé le statut.

#### COH-07 — Statut du projet périmé dans le PRD / TACHES_A_FAIRE 🟡
- PRD §3 et §9 : V3 « en cours sur la branche `application-v3` » ; en réalité fusionnée dans `main` (PR #13 à #15) et seule `main` existe sur le dépôt.
- PRD §9 étape 4 **« Mise en usage réel / tests terrain — À faire »** alors que V2 et V3 sont développées : **les tests terrain n'ont jamais eu lieu** avant d'empiler V3. C'est un risque produit majeur (voir §6, plan d'action, étape 0).
- `TACHES_A_FAIRE.md` : 100 % coché, plus d'utilité courante.
- La revue `CODE_REVIEW_synchro-supabase.md` cite des numéros de ligne (`app.js:2274`, etc.) qui ne correspondent plus.

#### COH-08 — README en retard sur le code 🟡
- Exemple `climatelec-v6` alors que `CACHE_VERSION = "climatelec-v14"`.
- Liste des fichiers : manquent `vendor/pdf-lib.min.js`, `logo-data.js`, `documentation/`, `CODE_REVIEW_*`, `TACHES_A_FAIRE.md`, `PRD_*`.
- Ne mentionne pas les rôles (`responsable/technicien/secretaire/developpeur`), ni le prérequis critique « **inscription publique désactivée** » (c'est pourtant la barrière de sécurité principale, cf. SEC-05).
- Recommande « Netlify Drop : glisser ce dossier entier » → **publie aussi** `documentation/`, `supabase/schema.sql`, le PRD, les PDF et la page `Maquettes.html` (voir SEC-06).

#### COH-09 — Éléments « temporaires » toujours en production 🟡
- `index.html` : bandeau « Voir les maquettes des écrans » marqué « retirer après validation client », toujours présent.

#### COH-10 — Realtime : promesse vs réalité 🟡
- Le schéma publie 11 tables en Realtime ; `sync.js:initRealtime` n'écoute que 4 (`clients`, `interventions`, `equipements`, `pieces_utilisees`). **`rendezvous` (le planning !), `appels`, `mesures`, `photos`, `documents`, `contrats_entretien`, `pieces`** ne déclenchent aucune synchro en direct.
- Chaque événement lance un `runSync()` complet (pull de **toutes** les tables) : coûteux (voir SYNC-02).

#### COH-11 — PRD : document trop long et mélangé 🟡
- 700 lignes / 68 Ko mêlant spécification, journal de modifications (§3.1, §3.4), roadmap et backlog. Le PRD §8 (sécurité/RGPD) n'a pas suivi la V3.
- **Action :** scinder en `PRD.md` (cible, stable), `CHANGELOG.md` (livraisons), `docs/ARCHITECTURE.md` (sync, RLS).

### 1.2 Ce qui est cohérent (à conserver)
- Les 3 rôles métier, les 9 statuts de dossier, les 6 types de création du bouton « + », le cycle de vie de l'appel (liaison → masquage → « À traiter ») sont décrits de façon identique dans PRD, TACHES et code.
- La stratégie « import PDF, pas de génération de devis/facture » est appliquée partout (code + PRD).
- Les garde-fous annoncés comme corrigés par la revue interne (P1, P2, P3, C1, C2, C3, C5, D1…D9) sont bien présents dans le code lu.

---

## 2. Sécurité

> Légende : 🔴 élevée · 🟠 moyenne · 🟡 faible / défense en profondeur · ✅ bon point

### 2.1 Points positifs ✅
- **XSS :** `esc()` couvre `& < > " '` ; 118 usages ; aucun `eval`, `new Function`, `document.write`, `onclick=` inline. Les `src` d'images (photos, signatures) passent par `esc()`. Les `<option>` de `app.js:549, 605, 956` interpolent des constantes (non utilisateur) : sans risque aujourd'hui.
- **Clé Supabase :** clé *publishable* (publique par nature), `service_role` absente du dépôt.
- **RLS activée sur les 12 tables**, `anon` sans aucun `GRANT`, fonctions `security definer` avec `set search_path = public`, anti-élévation de rôle (`prevent_role_escalation`).
- **Bibliothèques embarquées** (`vendor/`) : pas de CDN tiers à l'exécution. Versions : `jsPDF 4.2.1` (03/2026), `supabase-js 2.112.3` (récentes).

### 2.2 Constats

#### SEC-01 🔴 — Les signatures sont listables publiquement
- **Où :** `supabase/schema.sql`, section Storage : `create policy signatures_read … for select using (bucket_id = 'signatures')` — **sans** `to authenticated`, donc valable pour le rôle `anon`.
- **Pourquoi c'est grave :** un bucket *public* sert déjà ses objets par URL directe **sans** policy. Cette policy `select` ne sert qu'à autoriser `storage.from('signatures').list()`, c'est-à-dire **l'énumération de tous les noms** par quiconque connaît l'URL du projet et la clé anon (toutes deux dans `config.js`, dépôt public). La mitigation « UUID non devinable » (revue S2) est donc **neutralisée**.
- **Correctif attendu :** supprimer `signatures_read` (le bucket public continue de servir les URLs directes). Idéalement, passer à un bucket **privé** + URLs signées longues générées à la génération du PDF, ou embarquer la signature dans le PDF final et ne plus l'exposer.
- **Critères d'acceptation :** `curl` avec la clé anon sur `/storage/v1/object/list/signatures` → liste vide/403 ; une URL publique connue fonctionne toujours (si bucket public conservé).

#### SEC-02 🔴 — Photos / documents : le périmètre par rôle est contourné
- **Où :** policies `photos_*` et `documents_*` sur `storage.objects` : `to authenticated using (bucket_id = '…')`.
- **Constat :** tout utilisateur connecté (ex. le technicien) peut **lister et télécharger** toutes les photos, devis et **factures** de tous les clients, alors que les tables `photos` / `documents` sont restreintes par intervention. `update`/`delete` sont aussi ouverts à tous les authentifiés.
- **Correctif attendu :** nommer les objets `{intervention_id}/{uuid}.ext` et écrire des policies basées sur le premier segment du chemin (`(storage.foldername(name))[1]`) avec la même règle que la table (`is_manager() OR l'intervention appartient au technicien`). Restreindre `update/delete` aux managers ou au créateur.
- **Lié :** `app.js:1749` et `app.js:1979` nomment les objets `photo-${Date.now()}-${i}` / `doc-${Date.now()}-${type}` avec `upsert: true` → collision possible entre appareils et écrasement silencieux (voir SEC-11).

#### SEC-03 🟠 — Politiques `UPDATE` sans `WITH CHECK` et colonnes de propriété modifiables
- **Où :** `interventions_update`, `rendezvous_update`, `appels_update`, etc.
- **Constat :** sans `with check`, la ligne modifiée n'est vérifiée que par la clause `using`. Un utilisateur peut modifier `created_by` / `technicien_id` d'une ligne qu'il possède (transfert de propriété, ou pour la « cacher »). Aucun trigger n'interdit de modifier `created_by`.
- **`appels_update using (true)`** (ajoutée le 25/08 « pour que le technicien puisse relier un appel du responsable ») : (a) trop large pour les lignes que l'on peut voir ; (b) probablement **inefficace** pour le cas visé : l'`UPDATE … WHERE id = …` nécessite aussi de pouvoir **lire** la ligne (`appels_select` réservé aux managers/créateur), donc la mise à jour ne touchera **0 ligne sans erreur** → *à confirmer par test* avec un compte technicien.
- **Correctif attendu :** (1) trigger `BEFORE UPDATE` rendant `created_by` immuable ; (2) `with check` explicites ; (3) remplacer le besoin « technicien relie un appel » par une fonction RPC `security definer` `link_appel(appel_id, rdv_id, intervention_id)` n'autorisant que ces colonnes.

#### SEC-04 🟠 — Données personnelles en clair sur l'appareil, non purgées à la déconnexion
- **Où :** `app.js:2412` `signOutUser()` (la confirmation dit « vos données restent sur cet appareil »), `app.js:725-752` (brouillon d'appel en `localStorage`, clé `ce_appel_draft`), IndexedDB (clients, photos, factures PDF en base64).
- **Risques :** téléphone perdu/volé ou partagé ; un second compte connecté sur le même appareil voit **toutes** les données locales (pas de partition par utilisateur) ; la session Supabase est persistante et auto-rafraîchie.
- **Correctif attendu :** (1) option « purger les données locales à la déconnexion » activée par défaut pour les comptes managers, après avoir vérifié que la file de sync est vide (sinon avertir) ; (2) effacer `ce_appel_draft` au logout ; (3) préfixer/partitionner la base IndexedDB par `user.id` ou refuser la connexion d'un autre compte tant que la base n'est pas purgée ; (4) verrouillage applicatif (code PIN / biométrie WebAuthn) ou rappel d'activer le verrouillage de l'appareil ; (5) documenter dans le PRD §8.

#### SEC-05 🟠 — La barrière principale (inscription publique) n'est ni versionnée ni vérifiable
- **Constat :** schéma, README et PRD s'appuient sur « inscription publique désactivée » (réglage Dashboard). Comme `clients`, `equipements`, `pieces` sont lisibles/écrivables par **tout** `authenticated` (`using (true)`), un seul compte créé par erreur = accès à tous les clients.
- **Correctif attendu :** (1) ajouter dans la section 0 du README une **checklist de déploiement sécurité** (inscription désactivée, Redirect URLs, SMTP, MFA) ; (2) défense en profondeur : policies de `clients`/`equipements` conditionnées à un rôle **explicite** (ex. `public.current_role() in (…)` avec rôle `aucun` par défaut pour les nouveaux inscrits au lieu de `technicien`) ; (3) `handle_new_user` : créer le profil avec un rôle `en_attente` tant qu'un manager ne l'a pas validé.

#### SEC-06 🟠 — Dépôt public + publication du dossier entier
- **Constat :** le dépôt est public et contient : emails professionnels réels (`schema.sql`, `DEPLOYMENT.md` : 4 adresses dont celle du compte `developpeur`), URL du projet Supabase, PRD complet (organisation interne, noms des employés), PDF de fiches. Le README conseille de déposer **le dossier entier** sur Netlify → ces fichiers sont aussi servis publiquement, ainsi que `documentation/Maquettes.html`.
- **Correctif attendu :** (1) passer le dépôt en **privé** (outil métier d'un client) ; (2) sortir le bloc `BACKFILL` aux vrais emails de `schema.sql` vers un fichier non versionné (`supabase/seed.local.sql`, listé dans `.gitignore`) ; (3) déployer uniquement un dossier `dist/`/`public/` (script de copie) sans `documentation/`, `supabase/`, `*.md` ; (4) ajouter `.gitignore`, `LICENSE` (ou mention « propriétaire »).
- Les commits contiennent aussi une seconde adresse email d'auteur (`a.debare@packr.com`) : à anonymiser si nécessaire.

#### SEC-07 🟠 — Gestion des rôles : élévation possible entre managers, compte `developpeur` sensible
- **`set_user_role`** : tout `is_manager()` (donc aussi `secretaire`, `developpeur`) peut attribuer **n'importe quel rôle**, dont `responsable` et `developpeur`, à n'importe quel utilisateur, y compris lui-même. Le commentaire dit « responsable / secretaire » mais `is_manager()` inclut `developpeur`.
- **`developpeur`** : rôle avec **accès complet aux données clients** associé à un compte email personnel (gmail) ; non prévu au PRD §2.
- **Correctif attendu :** `set_user_role` réservée à `responsable` (et ne pouvant pas créer `developpeur`) ; supprimer ou désactiver le rôle `developpeur` en production (le créer à la demande, expirer) ; imposer **MFA** aux rôles manager (voir SEC-10).

#### SEC-08 🟠 — Valeur probante des signatures et intégrité des documents signés
- **Constat :** la signature est une image PNG sans empreinte, sans horodatage fiable, sans lien cryptographique avec le contenu de la fiche ; l'image est **remplaçable** (`upsert: true`, `signatures_update/delete` ouverts à tout authentifié) ; une fiche signée reste modifiable. À l'inverse, l'objectif métier est une preuve d'intervention/consentement client.
- **Correctif attendu (à faire valider juridiquement) :** à la signature, figer la fiche : calculer un **hash SHA-256** du contenu (JSON canonique) + horodatage serveur + identité du signataire, les stocker dans une table append-only `signatures_log` ; interdire la modification d'une fiche signée sauf avenant ; insérer le hash et l'horodatage dans le PDF.

#### SEC-09 🟡 — Repli d'interface dangereux
- `currentRole()` → `"responsable"` par défaut ; `isManager()` vrai hors connexion (`app.js:238-239`). Inverser : **moindre privilège** par défaut (rôle inconnu = lecture minimale + message « profil non chargé ») et conserver le dernier rôle connu en cache local pour l'offline.

#### SEC-10 🟡 — Durcissement de l'authentification Supabase (à vérifier dans le Dashboard)
- Activer **MFA TOTP** pour `responsable`, `secretaire`, `developpeur` ; politique de mot de passe forte / protection contre les mots de passe compromis ; SMTP personnalisé (les emails par défaut sont limités et peu fiables) ; **Redirect URLs** limitées à l'URL de production ; durée de session et déconnexion après inactivité pour les managers.
- Le lien magique redirige vers `window.location.origin + pathname` : OK si la liste des Redirect URLs est stricte.

#### SEC-11 🟡 — Noms d'objets Storage prévisibles et `upsert: true`
- `photo-${Date.now()}-${i}` et `doc-${Date.now()}-${type}` : prévisibles et collisionnables ; l'objet n'est jamais supprimé quand la photo/le document est supprimé (orphelins). Utiliser `{intervention_id}/{id de la ligne}.ext` (cf. SEC-02), supprimer l'objet à la suppression de la ligne.

#### SEC-12 🟡 — En-têtes et CSP
- Aucune CSP. L'app n'a pas de scripts tiers : une CSP stricte est réaliste. Ajouter (meta ou en-têtes d'hébergeur) : `default-src 'self'; connect-src 'self' https://<projet>.supabase.co wss://<projet>.supabase.co; img-src 'self' data: blob: https://<projet>.supabase.co; style-src 'self' 'unsafe-inline'; script-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'`. Ajouter `Referrer-Policy`, `X-Content-Type-Options`, `Permissions-Policy`. (Les styles inline nombreux imposent `'unsafe-inline'` pour `style-src` dans l'état actuel.)

#### SEC-13 🟡 — RGPD (à faire valider)
- Aucune mention de confidentialité trouvée dans `app.js`/`index.html` (le PRD §8 la prévoit « à prévoir »).
- Le « soft-delete » conserve indéfiniment les données (`deleted_at`) : **aucune purge** ni durée de conservation ; le droit à l'effacement n'est pas implémentable en l'état.
- Les techniciens voient **tous** les clients (partage voulu) : documenter la finalité ; envisager de limiter à ceux de leurs fiches/RDV.
- **Correctif attendu :** registre des traitements simple, page « Confidentialité », job de purge (`deleted_at < now() - interval '…'`), procédure d'export/effacement d'un client.

#### SEC-14 🟡 — Sauvegarde / reprise après sinistre
- La seule sauvegarde documentée est l'export JSON **manuel** (clients, fiches…). Les `data_url` sont dans la base mais les fichiers Storage ne sont pas couverts. Vérifier le plan Supabase (sauvegardes quotidiennes vs PITR), planifier un `pg_dump` + copie du Storage, tester une restauration.

---

## 3. Synchronisation et intégrité des données (le cœur du risque)

#### SYNC-01 🔴 — Les données locales écrasent le serveur à chaque lancement
- **Où :** `app.js:2527` (`SIGNED_IN` **et `INITIAL_SESSION`** → `Sync.pushAllLocal()`), `app.js:2479` (`runSyncNow`), `app.js:2498` (`scheduleSyncRetry`), `sync.js` (`applyRemote`, garde `isPending`).
- **Mécanisme (lecture du code) :** `pushAllLocal()` met **toutes** les lignes locales en file. `runSync()` fait ensuite `pullChanges()` : pour chaque ligne reçue, `applyRemote()` fait `if (isPending) return;` → **la version distante est ignorée** pour toute ligne présente en local. Puis `pushChanges()` fait un `upsert` de **toutes** les lignes locales, et le trigger serveur `set_updated_at` met `updated_at = now()`.
- **Scénario :** Régis corrige une fiche sur son appareil à 10 h. Le téléphone de Jérémy, resté hors ligne depuis la veille, est ouvert à 11 h avec du réseau : sa version **ancienne** de la fiche remplace celle de Régis sur le serveur.
- **À confirmer par test** (2 appareils/navigateurs) puis corriger.
- **Correctif attendu :**
  1. Supprimer `pushAllLocal()` des chemins automatiques (`INITIAL_SESSION`, retry, bouton). Ne l'utiliser qu'une fois, pour la **migration initiale** (marqueur `_meta.initial_push_done`) ou via une action « Tout renvoyer » explicite et avertie.
  2. **Persister la file de sync** dans IndexedDB (`_meta.sync_queue` ou store dédié) pour qu'elle survive à un rechargement (c'est la raison d'être de `pushAllLocal`).
  3. Au push, envoyer `updated_at` de base (version vue) et refuser l'écrasement si le serveur est plus récent (contrôle optimiste via fonction RPC ou `update … where updated_at = :base`) ; en cas de conflit, afficher un écran de résolution plutôt qu'un « dernier gagne » silencieux.
- **Critères d'acceptation (test automatisé ou manuel scripté) :** A et B synchronisés ; A modifie hors ligne ; B modifie en ligne ; A se reconnecte → le conflit est détecté et signalé, aucune donnée n'est écrasée silencieusement ; relancer l'app sur un appareil sans modification locale ne produit **aucun** `upsert`.

#### SYNC-02 🟠 — Pull coûteux, non paginé, curseur fragile
- **Curseur en mémoire :** `SyncState.lastPulledAt` n'est pas persisté → à chaque lancement, **pull complet** de 11 tables.
- **Curseur basé sur l'horloge du téléphone :** `lastPulledAt = new Date().toISOString()` puis `gte(updated_at, since)` comparé à des `updated_at` **serveur**. Un téléphone en avance de quelques minutes **manque** des modifications. (La revue C8 n'a corrigé que le sens push.) Utiliser `max(updated_at)` des lignes reçues (avec léger recouvrement) et un tri stable `order(updated_at, id)`.
- **Pas de pagination :** `Supabase.list()` n'a pas de `.range()`. PostgREST/Supabase limite à **1000 lignes** par requête par défaut → troncature silencieuse dès qu'une table dépasse ce volume (`photos`, `documents`, `mesures` y arriveront vite : une fiche d'entretien génère des dizaines de mesures).
- **Poids :** `select("*")` ramène `photos.data_url` et `documents.data_url` (images/PDF en base64) **à chaque pull**, et chaque événement Realtime relance un pull complet. De plus `cleanRow` ne neutralise que les `dataURL` de **signatures** : les `data_url` des photos/documents sont **poussés dans Postgres** *et* dans Storage (double stockage).
- **Correctif attendu :** pagination par curseur ; ne pas sélectionner `data_url` dans le pull courant (récupérer à la demande depuis Storage via URL signée) ; Storage = source de vérité pour les binaires ; Realtime : appliquer la ligne reçue (payload) au lieu de relancer un pull global ; stocker les binaires en `Blob` dans IndexedDB plutôt qu'en base64.

#### SYNC-03 🟠 — Éléments « empoisonnés » : retry infini sans issue (à confirmer par test)
- **Cas identifiés :** (a) contrat créé par un technicien (COH-05) ; (b) **rendez-vous non affecté** : visible par toute l'équipe (`rendezvous_select … intervenant = ''`), donc téléchargé par le technicien, puis re-poussé par `pushAllLocal` alors que `rendezvous_update` ne l'autorise pas → 403 RLS à chaque synchro ; (c) tout enregistrement dont le technicien n'a plus le droit.
- **Effet :** `pushChanges` remet l'élément en file et lève une erreur → `scheduleSyncRetry` toutes les 5-30 s, indéfiniment ; message générique « Erreur de synchronisation ». Aucun plafond de tentatives, aucune « boîte aux lettres des échecs ».
- **Correctif attendu :** compteur de tentatives par élément ; au-delà de N échecs avec erreur permanente (401/403/409/422), passer en statut `en_erreur` visible dans « Compte & synchro » avec le motif lisible ; ne jamais re-pousser une ligne qui n'a pas été modifiée localement (corrige aussi (b)). Dans `Supabase.remove`, vérifier `count`/`select` : un `update` bloqué par la RLS renvoie 0 ligne **sans erreur** et l'élément est considéré comme synchronisé à tort.

#### NUM-01 🟠 — Numérotation non unique entre appareils
- Voir COH-01. **Correctif attendu :** attribuer le numéro **côté serveur** à la première synchronisation (séquence Postgres par type/année + trigger ou RPC), afficher « brouillon local » tant qu'il n'est pas attribué ; ajouter `create unique index … on interventions(numero) where numero <> ''` (idem contrats). Si un numéro doit être utilisable hors ligne (fiche remise au client), utiliser un préfixe par appareil/technicien (`FIC-JG-2026-001`) et le documenter. Mettre à jour PRD §5.2/§11.
- **Critères d'acceptation :** deux appareils hors ligne créent chacun une fiche, se synchronisent : aucun doublon de `numero`, contrainte unique active.

#### SYNC-04 🟡 — Autres observations
- `pullChanges` ne purge jamais une ligne devenue **invisible** (retrait de droits, changement d'affectation) : elle reste sur l'appareil.
- `initRealtime` : `realtimeStarted` n'est jamais remis à `false` à la déconnexion et les canaux ne sont pas fermés (`removeChannel`).
- `app.js:306` : `state.auth.profile.full_name` utilisé pour la suggestion de signature ; valeur issue d'un champ librement éditable par l'utilisateur (`updateProfile`) → elle sert aussi à la RLS des RDV par **nom** (`rendezvous_select`) : un utilisateur peut se renommer « Régis » pour voir les RDV de Régis. Ne **pas** baser la RLS sur le nom ; ne garder que `technicien_id` (le backfill et la résolution `resolveTechId()` existent déjà).

---

## 4. Schéma SQL (Supabase)

#### SCHEMA-01 🔴 — `interventions.technicien_id` jamais créée
- **Constat :** `technicien_id` n'est déclarée que dans `create table rendezvous` (ligne ~178). Pour `interventions`, aucune colonne `technicien_id` ni `alter table … add column technicien_id`. Pourtant : trigger `interventions_set_technicien`, policies `interventions_select/insert/update` et `pieces/mesures/photos/documents_*` (via `i.technicien_id`), bloc `BACKFILL` (`update public.interventions set technicien_id = …`).
- **Effet :** sur une base **vierge**, le script échoue à la création de la première policy qui référence la colonne. La base de production actuelle fonctionne probablement parce que la colonne a été créée par un script antérieur aujourd'hui supprimé (`migrations/002_v3.sql`) : le « fichier maître » ne représente donc **pas** l'état réel.
- **Correctif attendu :** `alter table public.interventions add column if not exists technicien_id uuid references auth.users(id) on delete set null;` + index. **Valider en exécutant le script sur un projet Supabase vierge**, puis comparer avec la production (`supabase db diff`).

#### DB-01 🟡 — Contraintes manquantes
- Aucun `CHECK`/enum pour `statut`, `statut_dossier`, `type_intervention`, `type_entretien`, `rendezvous.type/statut`, `appels.action_sortie`, `documents.type`. → ajouter des `CHECK … in (…)` (ou types enum), en tolérant les valeurs historiques.
- Heures (`heure_arrivee`, `heure_debut`…) et `nb_passages`/`tarification_zone_km` en `text` : contrôler le format (`CHECK (heure ~ '^\d{2}:\d{2}$' or heure = '')`) ou typer `time`/`numeric`.
- `appels.rendezvous_id` sans FK ; `uuid-ossp` → préférer `gen_random_uuid()` (natif).
- Index manquants pour la synchro : `(updated_at)` sur les tables tirées par `gte(updated_at, …)`.

#### DB-02 🟡 — Cycle de vie des migrations
- Un seul fichier « tout-en-un » qui fait `drop policy if exists … create policy …` est pratique pour une première installation, mais **le relancer en production ré-applique toutes les policies** et contient un `BACKFILL` aux emails réels. Passer à des **migrations Supabase CLI** horodatées (`supabase/migrations/*.sql`) + `supabase/seed.sql` + une vérification CI (`supabase db reset` sur une base jetable).

#### DB-03 🟡 — Autres
- `profiles_insert` autorise un utilisateur à insérer son propre profil avec `role = 'technicien'` : cohérent. Mais `profiles_select using (true)` expose `full_name`/`role` de tous (accepté, équipe de 4).
- `documents.data_url` / `photos.data_url` : colonnes `text` volumineuses dans des tables pull-ées en `select *` (voir SYNC-02) ; envisager de les retirer du schéma.

---

## 5. Bonnes pratiques de développement

#### BP-01 🟠 — Perte de saisie lors d'une mise à jour de l'application (UX-01)
- **Où :** `app.js:2543-2549` : `if (newWorker.state === "installed" && navigator.serviceWorker.controller) window.location.reload();` + `skipWaiting()` dans `sw.js`. Le correctif du 25/08 ne protège que « Nouvel appel » ; le **wizard** d'intervention/entretien (`state.draft`) n'est jamais persisté (`state.draft` en mémoire uniquement).
- **Correctif attendu :** (1) persister le brouillon du wizard dans IndexedDB à chaque changement d'étape/champ (debounce) et le restaurer ; (2) ne recharger que lorsque l'utilisateur est sur un écran « sûr », ou afficher un bandeau « Mise à jour disponible — Actualiser » ; (3) demander `navigator.storage.persist()` (aucune occurrence trouvée dans le code) pour limiter l'éviction d'IndexedDB sur iOS/Android.

#### BP-02 🟠 — Absence totale de tests, lint, CI
- Aucun `package.json`, aucun test, aucun linter, aucune CI, pas de `.gitignore` ; la revue note que la syntaxe JS « n'a pas pu être vérifiée automatiquement » (pas de `node` installé).
- **Correctif attendu :** `package.json` minimal (dev uniquement) avec ESLint + Prettier ; **tests unitaires** (Vitest) sur `idb.js` (via `fake-indexeddb`), la résolution de conflits, `cleanRow`, `esc`, la numérotation ; **tests E2E hors ligne** (Playwright : créer une fiche hors ligne → reconnecter → vérifier la sync) ; **tests RLS** (pgTAP ou script `supabase test db`) avec un compte par rôle ; GitHub Actions exécutant lint + tests à chaque PR.

#### BP-03 🟡 — Structure du code
- `app.js` : 2558 lignes, scripts globaux (pas de modules ES), rendu par concaténation de gabarits `innerHTML`. Fonctionne, mais difficile à tester/maintenir et la sécurité repose sur la discipline `esc()`.
- **Correctif progressif :** découper en modules ES (`views/`, `state.js`, `wizard.js`, `workflow.js`, `planning.js`), centraliser un helper de gabarit qui échappe par défaut (ex. tag template `html\`…\``), supprimer les `catch (e) {}` muets, factoriser les `"Jérémy","Régis","Delphine"` codés en dur (`app.js:549, 605, 956`) → **liste issue de `profiles`** (sinon tout nouvel employé impose un déploiement).

#### BP-04 🟡 — Service worker
- `CACHE_VERSION` incrémenté **à la main** (oubli = utilisateurs bloqués sur l'ancienne version, cache-first sur tout). Générer la version depuis un hash des fichiers (script de build) ; stratégie *network-first avec repli cache* pour `index.html`/`config.js` ; ne mettre en cache que la liste blanche `ASSETS` (le `put` dynamique actuel met en cache toute réponse `GET` same-origin).
- Le dossier `documentation/` ne doit pas être servi (cf. SEC-06).

#### BP-05 🟡 — Accessibilité
- `index.html` : `maximum-scale=1` empêche le zoom (WCAG 1.4.4) alors que l'usage terrain (plein soleil, gros doigts) en a besoin → retirer. Vérifier labels `for`/`aria-*`, contrastes (PRD §7 les promet), focus visible, cibles tactiles ≥ 44 px, `lang="fr"` ✅.

#### BP-06 🟡 — Observabilité
- 37 `console.*` et plusieurs échecs avalés ; l'utilisateur ne voit qu'un toast générique. Ajouter un **journal d'erreurs local** consultable dans « Compte & synchro » (dernières erreurs de sync avec cause) et, si accepté, un envoi vers un outil de suivi (Sentry/GlitchTip, sans données client).

#### BP-07 🟡 — Dépendances
- `pdf-lib 1.17.1` n'est plus maintenu (dernière version 2021) : surveiller ou utiliser un fork maintenu. Documenter les versions embarquées (`vendor/VERSIONS.md` + source/hash) et une procédure de mise à jour (jsPDF a connu plusieurs CVE sur des versions anciennes : la 4.2.1 embarquée est récente, mais il n'existe aucun suivi automatisé → activer Dependabot/Renovate dès qu'un `package.json` existe).

#### BP-08 🟡 — Hygiène du dépôt
- Ajouter `.gitignore`, `LICENSE`/mention de propriété, `docs/` (déplacer PRD, revue, tâches, guide de déploiement), `AGENTS.md`/`CONTRIBUTING.md` (conventions pour agents : voir §7), `CHANGELOG.md`. Corriger la description du dépôt (« artisant » → « artisan »).

---

## 6. Améliorations proposées (valeur produit)

| ID | Amélioration | Valeur | Effort |
|----|--------------|--------|--------|
| IMP-01 | **Journal d'audit** (qui a validé / facturé / clôturé quoi et quand) : table `dossier_events` append-only alimentée par RPC `transition_dossier(id, to)` qui **applique** les rôles et les transitions autorisées (corrige COH-06) | Élevée | M |
| IMP-02 | **Rappels d'entretien annuel** : remplacer `prochaine_intervention_prevue` (booléen) par une **date** ; liste « entretiens à planifier ce mois-ci » ; création de RDV en un clic. C'est le levier de chiffre d'affaires le plus direct pour un chauffagiste | Élevée | M |
| IMP-03 | **Écran de résolution de conflit** et indicateur d'état de sync par fiche (✔ synchronisé / ⏳ en attente / ⚠ erreur) | Élevée | M |
| IMP-04 | **Verrouillage de fiche signée** + hash + horodatage (voir SEC-08) | Élevée | M |
| IMP-05 | **Photos** : miniatures, compression, stockage `Blob`, affichage via URL signée, limite de taille/nombre par fiche, progression d'upload | Moyenne | M |
| IMP-06 | **Planning** : vue semaine, glisser-déposer, détection de chevauchements, itinéraire/lien Maps depuis l'adresse client (liens `tel:`/`mailto:` cliquables sur la fiche client) | Moyenne | M |
| IMP-07 | **Recherche** globale (client, n° de série, n° de fiche) et filtres enregistrés | Moyenne | S |
| IMP-08 | **Export comptable/CSV** et tableau de bord côté serveur (vues SQL) plutôt que calculé sur l'appareil | Moyenne | S |
| IMP-09 | **Sauvegarde automatisée** (dump planifié + copie Storage + test de restauration) ; alerte si la file de sync est en attente depuis > 24 h | Élevée | S |
| IMP-10 | **Validation métier du CERFA 15497 et des fiches** par un professionnel du froid/fluides (champs obligatoires, traçabilité des fluides, conservation légale) ; ajout de contrôles de saisie (valeurs plausibles, unités) sur les mesures | Élevée | S |
| IMP-11 | **Test terrain** structuré (2 semaines, 2 techniciens, checklist hors ligne / mauvais réseau / mise à jour pendant saisie) **avant** toute nouvelle fonctionnalité | Très élevée | S |
| IMP-12 | Gérer la liste des intervenants depuis `profiles` (ajout d'un technicien sans modifier le code) et les rôles via un écran réservé au responsable | Moyenne | S |

---

## 7. Plan d'action ordonné (pour un agent de développement)

### 7.1 Règles de travail à respecter pour toute modification
1. **Ne jamais committer sur `main` directement** : une branche par lot, PR relue.
2. **Toute modification d'un fichier servi** (`*.js`, `index.html`, `style.css`, `manifest.json`, `vendor/*`) ⇒ **incrémenter `CACHE_VERSION`** dans `sw.js` (tant que BP-04 n'est pas fait).
3. **SQL :** modifier `supabase/schema.sql` en restant **idempotent** ; tester sur une **base vierge** et sur une copie de la production ; ne jamais y remettre d'emails réels.
4. **Échappement :** toute donnée utilisateur interpolée dans un gabarit passe par `esc()` ; ne jamais ajouter de `eval`/handler inline.
5. **Offline-first :** toute écriture passe d'abord par IndexedDB puis par la file de sync (ne pas appeler Supabase directement depuis l'UI pour les données métier).
6. **Documentation :** mettre à jour PRD (§ concernés), README et ce fichier (cocher les cases) dans la même PR.
7. **Ne pas faire confiance au « résolu » de la revue interne** : vérifier par test avant de cocher.

### 7.2 Étapes

**Étape 0 — Filet de sécurité (avant tout)**
- [ ] Faire une **sauvegarde complète** de la base et des buckets Supabase de production.
- [ ] Créer un projet Supabase **de test** et exécuter `schema.sql` : constater l'échec SCHEMA-01.
- [ ] Reproduire SYNC-01 avec deux navigateurs (profils distincts) et consigner le résultat.

**Étape 1 — Bloquants (sécurité & intégrité)**
- [ ] **SCHEMA-01** : ajouter `interventions.technicien_id` (+ index), rejouer sur base vierge, comparer avec la prod.
- [ ] **SEC-01** : supprimer `signatures_read` (ou passer en bucket privé + URLs signées). Test `curl` anon.
- [ ] **SEC-02 / SEC-11** : chemins `{intervention_id}/{id}.ext` + policies Storage par propriétaire ; migrer/renommer les objets existants ; supprimer l'objet à la suppression de la ligne.
- [ ] **SYNC-01** : retirer `pushAllLocal()` des chemins automatiques, persister la file, contrôle optimiste au push. Ajouter le test E2E du scénario A/B.
- [ ] **SEC-06** : dépôt privé, retrait des emails du SQL versionné, `.gitignore`, déploiement d'un dossier `dist/` restreint, retrait du bandeau « maquettes ».

**Étape 2 — Fiabilité**
- [ ] **NUM-01** : numérotation serveur + index unique ; MAJ PRD §5.2.
- [ ] **SYNC-02** : pagination, curseur `max(updated_at)` persisté, pull sans `data_url`, Realtime ciblé sur les 11 tables (ou au moins `rendezvous`).
- [ ] **SYNC-03** : compteur d'échecs, statut `en_erreur` visible, contrôle du nombre de lignes affectées dans `Supabase.remove`.
- [ ] **COH-05** : masquer « Contrat d'entretien annuel » pour le technicien (ou ouvrir l'insertion en RLS si c'est voulu ; **trancher avec le client**).
- [ ] **BP-01** : persistance du brouillon du wizard + bandeau de mise à jour + `navigator.storage.persist()`.
- [ ] **SEC-03** : trigger d'immutabilité de `created_by`, `with check`, RPC `link_appel`. Tester avec un compte technicien le cas « relier un appel du responsable ».

**Étape 3 — Gouvernance & sécurité durable**
- [ ] **COH-06 / IMP-01** : RPC `transition_dossier` (rôles + transitions) + journal d'audit.
- [ ] **SEC-07 / SEC-05** : `set_user_role` restreinte, rôle `developpeur` retiré en prod, rôle `en_attente` par défaut.
- [ ] **SEC-04 / SEC-09** : purge locale au logout, partition par utilisateur, repli de rôle = moindre privilège.
- [ ] **SEC-10 / SEC-12** : MFA managers, Redirect URLs, SMTP, CSP.
- [ ] **SEC-08 / IMP-04** : hash + horodatage + verrouillage des fiches signées (après avis juridique).
- [ ] **SEC-13 / SEC-14** : page de confidentialité, purge/rétention, sauvegardes planifiées + test de restauration.

**Étape 4 — Qualité durable**
- [ ] **BP-02** : lint + tests unitaires + E2E + tests RLS + GitHub Actions.
- [ ] **DB-01 / DB-02** : contraintes `CHECK`, FK manquante, migrations CLI.
- [ ] **BP-03 / BP-04 / BP-05 / BP-06 / BP-07 / BP-08** : modularisation progressive, SW automatisé, accessibilité, journal d'erreurs, dépendances, hygiène du dépôt.
- [ ] **COH-01…COH-11** : mise à jour du PRD (scission PRD / CHANGELOG / ARCHITECTURE), du README, archivage de `TACHES_A_FAIRE.md` et de la revue.

**Étape 5 — Produit**
- [ ] **IMP-11** : test terrain structuré (à faire **dès l'étape 1 terminée**, en parallèle de l'étape 2).
- [ ] **IMP-02, IMP-03, IMP-09, IMP-10**, puis le reste du tableau §6 selon retours terrain.

### 7.3 Définition de « terminé » d'un lot
- Correctif + test automatisé ou procédure de test manuelle décrite dans la PR.
- `schema.sql` rejoué avec succès sur base vierge (si SQL modifié).
- Documentation et checklist de ce fichier mises à jour.
- Aucune régression du fonctionnement **hors ligne** (scénario : mode avion → créer fiche → signer → reconnecter → vérifier sur un second appareil).

---

## 8. Annexe — Références de code utiles

| Sujet | Emplacement |
|---|---|
| Appel automatique de `pushAllLocal` | `app.js` ~2527, ~2479, ~2498 |
| Garde `isPending` du pull | `sync.js` `applyRemote` |
| `list()` sans pagination, `select("*")` | `supabase.js` `Supabase.list` |
| `cleanRow` (ne neutralise que les signatures) | `sync.js` `cleanRow` |
| Realtime sur 4 tables seulement | `sync.js` `initRealtime` |
| Numérotation locale | `idb.js` `nextNumero` (~275) ; `_meta` hors `SYNC_STORES` |
| Rechargement automatique du SW | `app.js` ~2543-2549 ; `sw.js` `skipWaiting` |
| Rôle par défaut `responsable` | `app.js` ~238-239 |
| Action de workflow sans contrôle de rôle | `app.js` ~2236-2252 (`action === "wf"`) |
| Proposition « Contrat » à tous | `app.js` ~703-717 (`openCreateSheet`) |
| Noms d'objets Storage prévisibles | `app.js` ~1749, ~1979 ; `supabase.js` `uploadPhoto/uploadDocument` |
| Policy signatures publique | `supabase/schema.sql` section STORAGE (`signatures_read`) |
| `technicien_id` absente de `interventions` | `supabase/schema.sql` §2 (table) vs. policies/triggers/backfill |
| Emails réels | `supabase/schema.sql` (bloc BACKFILL), `supabase/DEPLOYMENT.md` |