# Architecture — Climat Elec, fiches d'intervention

Document de référence **technique** (comment ça marche). Le *quoi* et le *pourquoi* métier sont dans [`PRD.md`](PRD.md) ;
les livraisons datées dans [`../CHANGELOG.md`](../CHANGELOG.md). Toute modification de la synchronisation, des droits
(RLS) ou du service worker met à jour ce fichier **dans la même PR**.

## 1. Vue d'ensemble

PWA **offline-first** sans framework ni étape de build pour le code applicatif : scripts classiques (pas de modules ES) qui partagent
une portée globale, servis tels quels depuis `dist/`.

| Fichier | Rôle |
| --- | --- |
| `index.html`, `style.css`, `manifest.json` | Coquille, charte, PWA |
| `utils.js` | `esc()`, tag de gabarit `html`, liste des intervenants (chargé en premier) |
| `errorlog.js` | Journal d'erreurs local (50 entrées, sans donnée client) |
| `idb.js` | Stockage local IndexedDB (`DB`), numérotation de repli, migrations locales |
| `supabase.js` | Client Supabase (Auth, CRUD, Storage, `upsertIfUnchanged`) |
| `sync.js`, `sync-persist.js` | Synchronisation bidirectionnelle ; file persistée dans IndexedDB |
| `js/*.js` (16 fichiers) | Code de l'interface, extrait d'`app.js` (BP-03) — voir ci-dessous |
| `app.js` | Point d'entrée : `init()` (démarrage, service worker) |
| `pdf.js`, `signature.js` | Génération PDF (jsPDF), signature tactile |
| `sw.js` | Service worker (cache hors ligne) |
| `config.js` | URL et clé publique des projets Supabase (dev / prod), infos « Confidentialité » |

**Modules `js/`** (chargés dans cet ordre, avant `app.js`) : `icons` · `statuts` (workflow) · `modeles-entretien` · `state` (état + brouillon de wizard) · `helpers` · `shell` (routeur, éléments communs) ·
`views-home` (accueil, planning, clients) · `views-appel-rdv` · `views-wizard` (saisie) · `presence` · `views-detail` (détail, workflow, documents) · `views-stats` · `views-contrat` · `nav-events` (délégation
des clics) · `auth` (connexion, données locales) · `views-compte` (compte & synchro, équipe, confidentialité). Ce sont des **scripts classiques à portée globale partagée** (pas de modules ES) : une fonction
d'un fichier est appelable depuis un autre, **à l'exécution** ; un fichier ne doit pas exécuter au chargement du code qui dépend d'un fichier chargé plus tard. Ajouter un module = l'ajouter à `index.html`
(avant `app.js`) **et** à `ASSETS` (`sw.js`) ; `scripts/build-dist.sh` copie `js/*.js`. ESLint lit les déclarations de tous les fichiers : un nom qu'aucun script ne déclare est une erreur. Le test
`tests/unit/boot.test.js` charge `index.html` et tous ses scripts dans jsdom et vérifie que 8 écrans s'affichent sans erreur.

Règle d'or : **toute écriture métier passe d'abord par IndexedDB, puis par la file de synchronisation** ; l'UI n'appelle jamais Supabase
directement pour les données métier.

## 2. Données locales (IndexedDB)

Une base `DB` avec un store par table synchronisée (`SYNC_STORES` : `clients`, `interventions`, `equipements`, `pieces_utilisees`, `appels`, `rendezvous`,
`mesures`, `photos`, `pieces`, `documents`, `contrats_entretien`), plus : `sync_queue` (file persistée), `_meta` (curseurs, marqueurs, compteurs de repli, journal
d'erreurs, propriétaire des données locales). Suppression = **tombstone** (`_deleted` + `deleted_at`), jamais un `delete` : c'est ce qui permet de propager la
suppression au serveur. Les listes de l'UI filtrent les tombstones.

Les données locales appartiennent à **un seul compte** (purge à la déconnexion ou au changement de compte si rien n'est en attente).

## 3. Synchronisation (`sync.js`)

**Envoi (push).** Chaque écriture locale ajoute un élément à la file (`enqueueSync`). Pour une ligne déjà synchronisée, l'élément mémorise `base_updated_at` =
version serveur **vue à l'ouverture du formulaire** ; deux modifications successives gardent la **première** base. Le push utilise `upsertIfUnchanged` : mise à
jour **conditionnelle** `where updated_at = base`. Si le serveur a changé entre-temps, **rien n'est écrasé** : un **conflit** est enregistré (bandeau + *Compte & synchro*),
la copie locale reste intacte, et l'utilisateur choisit « Garder ma version » (renvoi avec la version serveur comme nouvelle base) ou « Garder la version serveur ».
La règle « dernière écriture gagne » n'existe plus.

**Erreurs.** Une erreur **permanente** (RLS `42501`, contrainte `23505`/`23514`, `PGRST116`, HTTP 403/409/422…) sort de la file dès le premier échec et reste visible
(« Réessayer » / « Ne plus synchroniser »). Une erreur **transitoire** (réseau, 5xx) remet l'élément en file jusqu'à `MAX_SYNC_ATTEMPTS`. Aucune copie locale n'est
jamais détruite par un échec de synchro.

**Réception (pull).** Lecture paginée (`PULL_PAGE`) triée par `(updated_at, id)`, curseur `lastPulledAt` calé sur l'**horloge serveur** avec 60 s de recouvrement.
Un pull n'enfile rien et **ne remplace pas** une modification locale en attente. `mergeRemote` conserve les binaires locaux (signatures `data:` et `data_url` de
photos/documents) tant que le serveur n'en a pas. Une réconciliation de périmètre retire les lignes qui ont quitté la visibilité RLS de l'utilisateur.

**Temps réel.** Canal Realtime sur **chacune des 11 tables** ; l'événement reçu est appliqué directement en local (pas de pull complet).

**Premier lancement.** `initialPushIfNeeded()` n'envoie l'existant local qu'une fois (marqueur `_meta.initial_push_done`) ; il n'y a plus de « push de tout » automatique.

**Binaires.** Photos et documents : `data_url` en local, objet dans un bucket Storage **privé** côté serveur (`fichier_url` = chemin). Signatures : bucket `signatures`
public (URL dans le PDF), noms d'objets non devinables.

Tests : `tests/unit/sync-*.test.js` rejouent ces comportements (dont le scénario A/B) contre un faux serveur ; ne pas modifier `sync.js` sans les exécuter.

## 4. Numérotation

Référence `PREFIX-AAAA-NNN` (`FIC`, `ENT`, `CTR`) **attribuée par le serveur** à la première synchronisation : fonction `alloc_numero` (compteur par type/année, verrou
consultatif, reprise du maximum existant) appelée par les triggers `set_numero_*` ; index unique partiel sur `numero`. Hors ligne, la fiche n'a pas encore de numéro
définitif ; `DB.nextNumero()` (compteur local) ne sert que de **repli** quand Supabase n'est pas configuré.

## 5. Sécurité et droits (RLS)

Source : `supabase/migrations/` (rejouées par la CI, vérifiées par `supabase/tests/rls.test.sql`).

- **Rôles** (`profiles.role`) : `en_attente` (défaut de tout nouveau compte, **aucun accès**), `technicien`, `secretaire`, `responsable`, `developpeur` (non attribuable
  depuis l'application). `is_member()` = tout rôle sauf `en_attente` ; `is_manager()` = `responsable`, `secretaire`, `developpeur`.
- Changement de rôle **uniquement** via `set_user_role` (réservé au responsable, journalisé dans `role_events`, jamais le dernier responsable) ; un `UPDATE` direct de
  `profiles.role` est refusé par trigger.
- **Visibilité** : tables partagées (clients, équipements, pièces) = membres ; `interventions`, `appels`, `contrats_entretien` = managers + créateur (+ technicien affecté
  pour les interventions) ; rendez-vous = managers, créateur, technicien concerné, et — pour les membres — les rendez-vous **non affectés**. Création de contrat réservée aux managers.
- **Workflow de dossier** (`statut_dossier`) imposé par le trigger `enforce_statut_dossier_workflow` (tous chemins, y compris une transition rejouée hors ligne) :
  `brouillon → a_valider` (créateur, technicien affecté ou manager) ; `a_valider → a_facturer` et `a_facturer → termine` (managers, `valide_*`/`facture_*` posés **par le
  serveur**) ; `a_facturer → a_valider` (manager, **motif obligatoire**) ; renvoi en brouillon (manager) ; réouverture d'un dossier terminé (responsable seul). Toute autre
  transition est refusée. Chaque transition est tracée dans `dossier_events` ; `role_events` et `dossier_events` sont **en ajout seul**.
- **Storage** : `photos` et `documents` privés (accès selon `can_access_intervention_object`) ; `signatures` public, insertion contrôlée.
- **RGPD** : fonctions du responsable `purge_soft_deleted`, `export_client_data`, `anonymize_client` (voir `documentation/RGPD_CONSERVATION.md`).
- **Client** : CSP stricte (`script-src 'self'`) — pas de `eval` ni de gestionnaire inline ; `dist/_headers` généré par la build ; l'UI n'est qu'une commodité, **la RLS est la
  seule barrière**.

## 6. Service worker et déploiement

- La build (`npm run build` → `scripts/build-dist.sh`) produit `dist/` (**seul dossier à déployer**, jamais le dépôt entier) et `dist/_headers`.
- `scripts/stamp-sw.mjs` calcule l'empreinte du contenu de `dist/` et l'écrit dans `CACHE_VERSION` ; il **échoue** si `ASSETS` (dans `sw.js`) ne correspond pas exactement aux
  fichiers livrés. **Ajouter un fichier servi = l'ajouter à `ASSETS`** (et à `scripts/build-dist.sh` ; `index.html` pour un script).
- Stratégie : précache des `ASSETS` ; **réseau d'abord** (3 s) pour la navigation, `index.html` et `config.js` ; **cache d'abord** pour le reste ; rien hors liste blanche n'est mis
  en cache ; les requêtes d'autres origines (Supabase) ne sont jamais interceptées.
- Mise à jour : `updatefound` → rechargement, **sauf pendant une saisie** (bandeau « Actualiser »).

## 7. Base de données et migrations

`supabase/migrations/*.sql` = source de vérité (SQL **idempotent**) ; `supabase/schema.sql` est **généré** (`npm run schema:build`) et reste collable dans le SQL Editor.
Procédure complète : `supabase/migrations/README.md`. La CI rejoue les migrations deux fois sur une base vierge, vérifie `schema.sql` et exécute les tests pgTAP.

## 8. Qualité

`npm run lint` · `npm run format` · `npm test` (unitaires) · `npm run test:e2e` (nécessite `npm run build`) · `bash supabase/tests/run-local.sh` (base + RLS) ·
`npm run schema:check` · `npm run vendor:check`. Détail et conventions : [`../CONTRIBUTING.md`](../CONTRIBUTING.md).
