# Changelog — Climat Elec, fiches d'intervention

Journal des livraisons, du plus récent au plus ancien. Le PRD ([`docs/PRD.md`](docs/PRD.md)) ne décrit que la cible ;
l'architecture est dans [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). Ce fichier est mis à jour **dans chaque PR**
(règle de contribution : voir [`CONTRIBUTING.md`](CONTRIBUTING.md)).

## [Non publié] — modifier un client, rendez-vous direct (15/11/2026)

### Ajouté
- **Modifier un client** : bouton « Modifier le client » (crayon) sur la fiche client → écran `#/client-edit/<id>` (nom, adresse, code postal, ville, téléphone, mail, type de bâtiment). Le nom est obligatoire, le mail est vérifié, et un nom déjà porté par un autre client est refusé (les recherches « par nom » fusionneraient sinon deux clients). Un type de bâtiment hors liste (ancienne valeur) est conservé. Le client est synchronisé comme les autres données, avec contrôle de conflit (SYNC-01). Les fiches et PDF lisent le client par son identifiant : la correction s'applique partout.
- **Nouveau rendez-vous direct** : entrée « Nouveau rendez-vous » dans le menu « + » (plus besoin de passer par un appel). Champ **Client** avec suggestion des clients existants ; un nom reconnu (casse ignorée) rattache le RDV au client existant, un nom inconnu crée un client minimal (à compléter ensuite via *Modifier le client*). Depuis un appel, le client reste celui de l'appel.
- **Coordonnées du client dans le rendez-vous** (création) : adresse, code postal, ville, téléphone, mail. Pour un client **existant** (choisi dans la liste, ou issu de l'appel), elles se remplissent pour **vérification** et toute correction est enregistrée sur sa fiche (la fiche n'est réécrite que si une coordonnée a réellement changé) ; pour un **nouveau** client, elles sont à renseigner et servent à créer sa fiche. Le mail est vérifié avant toute écriture. Passer d'un client existant à un nouveau nom vide les champs repris automatiquement, jamais ceux modifiés à la main. Non proposé à la modification d'un rendez-vous existant.
- `flashToast()` : un message de confirmation affiché juste avant un changement d'écran apparaît désormais sur l'écran d'arrivée (il était effacé par le rendu suivant). Utilisé par ces deux écrans.
- 11 tests jsdom (`tests/unit/client-rdv.test.js`) qui exécutent l'application réelle.

### Modifié
- Le bandeau « Actualiser » (mise à jour de l'application) est aussi proposé, au lieu d'un rechargement immédiat, pendant l'édition d'un client ou d'un rendez-vous.
- Édition d'un rendez-vous : le client est rappelé en tête du formulaire.

## [Non publié] — BP-03 : découpage d'`app.js` (14/11/2026)

### Modifié
- `app.js` (4 060 lignes) est réparti en **16 modules `js/*.js`** + un `app.js` réduit au point d'entrée (99 lignes). Découpage **purement mécanique**, sans changement de comportement : la concaténation des modules redonne exactement l'ancien fichier (vérifié), et 8 écrans sont rendus à l'identique (comparés à l'ancien `app.js`).
- ESLint lit désormais les déclarations de haut niveau de **tous** les scripts (plus de liste de globales à maintenir à la main).
- `index.html`, `sw.js` (`ASSETS`) et `scripts/build-dist.sh` référencent les nouveaux fichiers.

### Ajouté
- `tests/unit/boot.test.js` : démarrage complet de l'application dans jsdom (ordre de chargement, 8 écrans sans erreur).

## [Non publié, fusionné] — étape 4 « Qualité durable » (14/11/2026)

### Ajouté
- **Tests** (BP-02) : 77 tests unitaires Vitest (numérotation de repli, statuts, `cleanRow`/`mergeRemote`, classification des erreurs de synchro, **scénario A/B de SYNC-01** avec deux appareils et un faux serveur partagé), 31 tests **RLS/workflow pgTAP** (un compte par rôle), tests E2E Playwright « fumée » (démarrage, service worker, rechargement hors ligne).
- **CI GitHub Actions** (`.github/workflows/ci.yml`) : lint, format, tests, `schema:check`, `vendor:check`, build, rejeu x2 des migrations + pgTAP, E2E ; workflow `supabase-db-reset.yml` (CLI, base locale jetable).
- **Migrations Supabase horodatées** (DB-02) : `supabase/migrations/` = source de vérité ; `supabase/schema.sql` est désormais **généré** (`npm run schema:build`). `config.toml`, `seed.sql` (vide, sans donnée réelle).
- **Journal d'erreurs local** (BP-06) : 50 dernières erreurs (sans donnée client) consultables et copiables dans *Compte & synchro*.
- `utils.js` (BP-03) : `esc()` et gabarit « html » (tag de gabarit) qui échappe par défaut ; liste des intervenants issue de `profiles`.
- `vendor/VERSIONS.md` + `npm run vendor:check` + Dependabot (BP-07).
- `CONTRIBUTING.md`, `AGENTS.md`, `LICENSE`, `docs/ARCHITECTURE.md` (BP-08, COH-11).

### Modifié
- **Service worker** (BP-04) : `CACHE_VERSION` **estampillé à la build** (empreinte du contenu, plus d'incrément manuel) ; réseau d'abord (3 s) pour la navigation, `index.html` et `config.js` ; **liste blanche** `ASSETS` (plus de mise en cache dynamique) ; la build vérifie que `ASSETS` = fichiers livrés.
- Zoom autorisé (retrait de `maximum-scale=1`, WCAG 1.4.4) (BP-05).
- Le choix « Non affecté » d'un rendez-vous enregistre désormais une valeur **vide** (il enregistrait le texte « Non affecté »).

### Corrigé
- `Supabase.get` était défini deux fois (`supabase.js`) ; `catch` qui ne faisait que relancer (`sync.js`) ; `catch` muets remplacés par une trace dans le journal.
- `scripts/build-dist.sh` ne copiait pas `sw.js` dans `dist/` ; `assets/logo.png` (non référencé) n'est plus livré.

## Historique du PRD (numéros de version du document)

**Changelog 1.31 (05/11/2026) :** **gouvernance et sécurité — étape 3** (§2, §3.3.4, §3.4 « Gouvernance et sécurité — étape 3 », §8, §11) : rôle **`en_attente`** par défaut pour tout nouveau compte (aucun accès aux données) et écran « Équipe & rôles » pour le valider (SEC-05/SEC-07) ; **journal d'audit** des changements de statut et de rôle (`dossier_events`, `role_events`, en ajout seul) avec historique dans la fiche (IMP-01) ; **données locales** rattachées à un seul compte, purge à la déconnexion, repli de rôle au moindre privilège (SEC-04/SEC-09) ; **RGPD** : page « Confidentialité », outils de purge, d'export et d'anonymisation (SEC-13) ; **CSP** resserrée et en-têtes HTTP générés au build (SEC-12) ; **nouvelle transition « À facturer → À valider »** avec motif obligatoire (§3.3.4).

**Changelog 1.30 (01/11/2026) :** **fiabilité — étape 2** (§3.4 « Fiabilité — étape 2 », §8, §11) : **brouillon du wizard persistant** (la saisie survit à la fermeture de l'application, BP-01), **bandeau de mise à jour** sans rechargement pendant une saisie, **stockage persistant** demandé au navigateur, bouton « contrat » masqué (COH-05), **appels** : trigger de limitation des colonnes modifiables (SEC-03), **signatures** : envoi sans `upsert`, désormais compatible avec la sécurité du bucket (une signature est figée).

**Changelog 1.29 (01/11/2026) :** **édition concurrente d'une fiche — détection, signalement, avertissement** (§3.3.4, §3.4 « Édition concurrente », §6.2, §8, §11). Une modification enregistrée hors ligne ou en même temps qu'une autre n'écrase plus silencieusement la version distante (version de base = version vue à l'**ouverture du formulaire**, SYNC-01) ; un **conflit** est signalé par un **bandeau d'alerte** cliquable et se résout dans « Compte & synchro » ; un **avertissement de présence non bloquant** (PRES-01) prévient qu'un autre utilisateur modifie la même fiche ; un enregistrement est **refusé** si la fiche n'est plus un brouillon. La mention « dernière écriture gagne » (§6.2) est **abandonnée**.

**Changelog 1.28 (13/10/2026) :** **simplification du workflow de dossier** — les 9 statuts (Brouillon → … → Clôturée) sont ramenés à **4** : **Brouillon → À valider → À facturer → Terminé** (§3.3.3-§3.3.4). Validation par **Régis ou Delphine** ; renvoi en brouillon avec **motif libre** ; **Terminé** réouvrable par **Régis seul** ; plus d'import de facture ni de fusion fiche + facture (seule la **génération du PDF de la fiche** est conservée) ; US-10 et US-11 abandonnées. Impacts : §1, §2, §3.2.15, §3.3, §3.4, §5.2, §9, §10, §11, §12.

**Changelog 1.27 (09/10/2026) :** intégration des **arbitrages du classeur « Application 20261009.xlsx »** (analyse : `documentation/Application 20261009 analyse retours.md`) — « Type d'intervention » à 5 valeurs, page 3/6 Équipement + Descriptif obligatoire (champs équipements obligatoires), fiches Chaudière bois et Air/Air alignées sur les feuilles 09/10 (types, pages 4-5), GWP du fluide rétabli (confirmation client conservée), « Page ok » précisée (complétude à la validation), Tableau de bord (drill-down + tris Nom/CP/Ville, valables pour le technicien dans son périmètre), bouton « + » (« Entretien installation solaire » préparé, l'entrée « Contrat d'entretien annuel » retirée du menu), unités affichées avant le champ de saisie (tous formulaires). Développement : points 15 → 20 de `TACHES_A_FAIRE.md`.


## V3 — Liste des modifications livrées (historique détaillé)

> Récapitulatif des changements fonctionnels et techniques effectivement développés depuis l'arbitrage du 19/08/2026, livrés sur la branche `application-v3` (commits des 20, 21 et 22/08/2026). Ils matérialisent la définition V3 du §3.3.

### Backend / schéma de données (V3)
- **Schéma consolidé (`supabase/schema.sql`, 24/08/2026)** : depuis cette date, tous les scripts SQL sont fusionnés dans un **fichier maître unique et idempotent** (état final V2 + V3, exécutable en une étape). Il contient les colonnes V3 sur `interventions` (`numero`, `statut_dossier`, `type_entretien`, `type_entretien_detail`, `prochaine_intervention_prevue`, `annee_installation`) + les tables `appels`, `rendezvous`, `mesures`, `photos`, `pieces` (base pièces), `documents`, `contrats_entretien`, avec index, triggers (`updated_at`, `created_by`/`updated_by`, `set_technicien_default`), Storage (buckets + politiques), RLS par rôle, GRANT et Realtime. Les anciens scripts (`storage.sql`, `migrations/001`/`002`/`003`) sont supprimés (historique conservé dans git).
- **Visibilité des rendez-vous par technicien** : la politique `rendezvous_select` du fichier maître reprend la version corrigée — le technicien voit son planning via `technicien_id` **ou** le nom d'intervenant ; les RDV non affectés (intervenant vide) restent visibles par toute l'équipe (voir §3.4 « Correction — Visibilité des rendez-vous »).
- **RBAC étendu aux nouvelles tables** : les politiques RLS suivent le modèle des tables V2 — les managers (Régis, Delphine) voient tout, le technicien (Jérémy) ne voit que ses données (`mesures`, `photos`, `documents` héritent du périmètre de leur intervention).
- **Storage élargi** : buckets `photos` et `documents` (privés, lecture/écriture authentifiées) en plus du bucket public `signatures`.
- **Backfill de migration V1→V2→V3** (`idb.js`) : éclatement équipements/pièces, ajout du `statut_dossier` par défaut sur l'existant, attribution d'un `numero` manquant (`FIC`/`ENT`) pour satisfaire la contrainte NOT NULL Supabase.

### Prise de contact & planification (US-01 · US-02 · US-16 · US-17 · US-18)
- **Accueil = Planning** : 3 onglets — **Planning** (rendez-vous groupés par jour, filtrés par intervenant pour le technicien), **Tâches** (fiches terrain, masquage des tâches réalisées par défaut, recherche), **Dossiers** (classement par statut du workflow + bloc « Appels »).
- **Annuaire clients (nouveau — 08/10/2026, à faire valider)** : un 4e onglet **Clients** à l'accueil — liste alphabétique des clients avec recherche (nom, ville, téléphone, CP) et compteur de dossiers par client ; **un clic sur un client** ouvre sa **fiche client** (`#/client/:id`) : coordonnées, **équipements connus** et **liste des dossiers du client** (fiches d'intervention/entretien triées par date décroissante, avec statut du workflow, référence et indicateur devis) ; **un clic sur un dossier** ouvre le détail de la fiche existant (`#/detail/:id`). Les **équipements connus** fusionnent l'historique client (copies sans fiche) et les équipements de **toutes les fiches** du client, dédupliqués (intitulé + marque + modèle + n° de série) — couvre les équipements non historisés (sans n° de série ou fiches antérieures à la V2). Aucun changement de schéma (tables `clients` / `interventions` existantes, jointure `client_id`).
- **Filtres Planning & Tâches** : tri des rendez-vous et des tâches par **type** (Dépannage / Garantie / Diagnostic / Entretiens) et par **intervenant** (manager uniquement), combinés à la recherche ; boutons de rendez-vous cliquables vers l'édition.
- **Bouton « + »** (US-18) : point d'entrée unique — Nouvel appel, Nouvelle intervention, Entretien Air/Eau-Sol/Eau, Air/Air, Chaudière bois, Contrat d'entretien annuel.
- **Écran « Nouvel appel »** (US-01) : recherche client avec auto-remplissage, motif, type de bâtiment, type d'intervention ; 3 actions de sortie — « Créer le rendez-vous → », « Créer l'intervention → » (pré-remplissage du flux), « Enregistrer sans planifier ».
- **Rendez-vous** (US-02) : **CRUD complet** — création (date, heures, type, intervenant, note) pré-remplie depuis un appel, édition d'un rendez-vous existant (`#/rdv/:id`) et suppression depuis la barre de titre ; pas de synchronisation Google Agenda (reportée).
- **Édition / suppression des appels** : ouverture d'un appel existant en mode édition, mise à jour et suppression depuis la barre de titre.
- **Gestion des rôles** (US-16) : `profiles.role` (responsable / technicien / secretaire / developpeur), fonctions `current_role()` / `is_manager()` / `set_user_role()`, anti-élévation de rôle, remplissage auto de `created_by` / `updated_by` / `technicien_id`.

### Intervention terrain (US-19 · US-20 · US-21 · US-22 · US-23 · US-24 · US-25)
- **3 fiches d'entretien dédiées** (US-19) : flux guidés Air/Eau-Sol/Eau, Air/Air, Chaudière bois, avec bloc « Mesures » propre à chaque équipement (défini dans `ENTRETIEN_META`), année d'installation, nombre de lignes d'équipement limité par type (3 ou 5), champ « Prochaine intervention prévue » pour la chaudière bois.
- **CERFA n°15497** (US-25) : bloc réglementaire (contrôle d'étanchéité, quantité/type de fluide, déchets ADR/RID, n° attestation) intégré aux fiches PAC, sur une seule page.
- **Contrat d'entretien annuel digitalisé** (US-24) : création depuis le bouton « + », **signatures tactiles client et technicien** (prévisualisation, upload vers le bucket `signatures`), **génération et partage du PDF du contrat** (`generateContratPDF`, logo, blocs Client / Objet / Prestations / Conditions générales / Signatures), **liste** (`#/contrats`) et **détail** (`#/detail-contrat/:id`) des contrats, édition et suppression, numérotation `CTR-AAAA-NNN`.
- **Photos avec légende** (US-21) : étape dédiée dans le wizard, redimensionnement côté client (dataURL), stockage dans la table `photos` **et upload effectif vers le bucket privé `photos`** à la finalisation de la fiche (le dataURL local est conservé pour l'affichage hors ligne, `fichier_url` référence l'objet Storage).
- **Réutilisation de l'historique équipements** : à l'étape « Équipement » du wizard, proposition d'un bouton « Reprendre l'équipement enregistré » qui alimente le brouillon depuis l'historique du client (`listEquipementsForClient`).
- **Type d'intervention resserré** (US-22) : Dépannage, Garantie, Diagnostic ; statut à 3 valeurs « À effectuer » (défaut) / « Effectuée » / « Effectuée, suite à prévoir » affiché au récapitulatif final.
- **Base pièces** (US-23) : table `pieces` (désignation seule), auto-complétion de la désignation dans les lignes de pièces, création à la volée, synchronisée.
- **Duplication d'une fiche** (US-20) : bouton « Dupliquer » sur le détail (intervention ou entretien), reprise du client et des équipements.

### Workflow de dossier (US-05 · US-06 · US-08 · US-09 · US-10 · US-11 · US-12 · US-13 · US-15)
- **Statuts de dossier** (US-13) : *livré* : 9 statuts (Brouillon → À valider → Validée → À facturer → Facture importée → Facture à vérifier → Facture vérifiée → À envoyer → Clôturée), avec **icônes et couleurs dynamiques** par statut et boutons de transition selon l'état courant. **Remplacé le 13/10/2026 par 4 statuts** (cf. ci-dessous).
- **Import PDF devis** (US-07) *(l'import de facture, US-09, est supprimé depuis le 13/10/2026)* : sélecteur de fichiers (ou scan caméra), stockage en base64 dans `documents` (table + bucket privé), **upload du PDF vers le bucket `documents`** (`fichier_url`) tout en conservant le dataURL local pour l'affichage hors ligne, consultation et suppression des documents depuis le détail. Le devis est attaché en parallèle **sans jamais bloquer le workflow**.
- ~~**Dossier final fusionné**~~ *(supprimé le 13/10/2026 — voir « Simplification du workflow de dossier » ci-dessous)* : génération d'un PDF fusionnant la fiche d'intervention et la facture importée (`pdf-lib`).
- **Brouillon** : sauvegarde d'une fiche non terminée (statut `brouillon`), reprise ultérieure, retour possible en brouillon depuis « À valider ».

### Simplification du workflow de dossier (13/10/2026 — livrée)
- **Passage de 9 à 4 statuts** : Brouillon → À valider → À facturer → Terminé (§3.3.4). Mise à jour des icônes/couleurs, des boutons de transition par rôle, du Tableau de bord (groupes de statut, drill-down) et des filtres de l'onglet Dossiers.
- **Retrait** de l'import de facture, de la génération du « dossier final » fusionné (`pdf-lib`, bouton « Générer le dossier final ») et des transitions de vérification. La génération du **PDF de la fiche** (`pdf.js`) est conservée.
- **Nouvelles actions** : « Renvoyer en brouillon » (motif libre) depuis À valider, « Marquer comme facturé » depuis À facturer, « Rouvrir » depuis Terminé (Régis seul, motif libre).
- **Migration** (`supabase/schema.sql` + backfill `idb.js`) : `validee`/`a_facturer`/`facture_importee`/`facture_a_verifier` → `a_facturer` ; `facture_verifiee`/`a_envoyer`/`cloturee` → `termine` ; `brouillon` et `a_valider` inchangés. Mise à jour de la contrainte/enum Supabase et incrément de `CACHE_VERSION` dans `sw.js`.
- **Numérotation** : référence unique `PREFIX-AAAA-NNN` (FIC / ENT / CTR) attribuée par le **serveur** à la première synchronisation (compteur par type/année + index unique partiel sur `numero`, trigger `set_numero_*`) — corrige NUM-01 (compteur local par appareil : doublons garantis à 2 techniciens) ; affichage « n° à la synchronisation » tant que la référence n'est pas attribuée ; hors Supabase (mode V1), repli sur le compteur local.
- **Statistiques** (US transverse) : total, par mois (6 derniers), par type, par technicien, par statut **et par client** (tri décroissant).

### Synchronisation & robustesse
- **File de synchronisation étendue** aux nouvelles boutiques V3 (`appels`, `rendezvous`, `mesures`, `photos`, `pieces`, `documents`, `contrats_entretien`) ; nettoyage des champs purement locaux avant upsert et normalisation des `NULL` (`numero`, `statut_dossier`) pour PostgREST.
- **Propagation des suppressions d'enfants (23/08/2026)** : la suppression d'un équipement, d'une pièce utilisée, d'une mesure, d'une photo ou d'un document lors de l'édition d'une fiche est désormais **soft-deletée et propagée aux autres appareils** (`DB.replaceChildren` — tombstone `_deleted`/`deleted_at` + mise en file, push en `Supabase.remove`, nettoyage au pull suivant). Corrige la « résurrection » des lignes supprimées au prochain pull (point C2 de la revue `synchro-supabase`). **Étendu à la suppression complète d'une fiche (point C5)** : `deleteIntervention` soft-delete désormais **tous** les enfants de la fiche via `DB.replaceChildren(…, [])` et les met en file de sync — le soft-delete du parent n'étant qu'un `update` côté serveur (aucune cascade), cela évite de laisser des orphelins dans la base. L'historique équipements du client (`client_id`, sans `intervention_id`) est préservé.
- **Historisation équipements sans collision (point C3)** : `saveClientEquipment` génère **toujours un `id` neuf** pour la copie d'historique d'un équipement (au lieu de réutiliser celui de la ligne liée à la fiche) et **détache `intervention_id`** ainsi que les champs purement locaux (`_deleted`/`deleted_at`/`synced_at`). En édition, une fiche avec un nouvel n° de série ne voit plus son équipement écrasé/disparaître de la fiche, et la copie reste bien visible dans l'historique du client (`listEquipementsForClient`, filtre `!intervention_id`).
- **Horodatages alignés sur l'horloge serveur (point C8 de la revue `synchro-supabase`)** : la résolution de conflit « dernière écriture gagne » compare désormais des horodatages **d'une horloge unique (serveur)** au lieu d'un horodatage d'horloge de mobile contre un horodatage serveur. `Supabase.upsert` retourne la ligne écrite (`select("id, updated_at")`), `updated_at` étant posé par le trigger serveur `set_updated_at` ; `pushChanges` **aligne la copie locale** sur cette valeur à chaque push. Une modification locale pas encore poussée (encore dans la file de synchronisation) **l'emporte en outre localement** pendant le pull (`applyRemote` — garde `isPending`) : une saisie faite hors ligne n'est jamais écrasée avant son envoi, quelle que soit la dérive de l'horloge du mobile.
- **Nouvelle tentative automatique** (`scheduleSyncRetry`) : backoff exponentiel (5 s → 30 s max) après un échec réseau, avec indicateur UI du nombre de changements en attente.
- **Push robuste** : les éléments non envoyés (coupure réseau en cours de push) sont **remis en file** au lieu d'être perdus jusqu'au prochain sign-in.
- **Enrichissement des listes** : `listInterventions` complète automatiquement `client.nom`/`client.ville` (jointure locale avec la table `clients`).
- **Anti-réinitialisation Realtime** : une seule initialisation par session (`initRealtime`).
- **Upload différé des signatures hors ligne** : les signatures capturées sans réseau (dataURL local) sont automatiquement ré-uploadées vers le bucket `signatures` au retour de la connexion, puis re-synchronisées (`uploadPendingSignatures`, cf. §3.1). **Idem photos/documents** : objet Storage créé au prochain cycle par l'appareil détenant la copie (`uploadPendingBinaries`), réparation d'affichage sur les autres appareils (repli lecture data_url — cf. §3.1, complément 30/10/2026).

### Gouvernance et sécurité — étape 3 (05/11/2026)

- **Rôle `en_attente` (SEC-05)** : défaut de tout nouveau compte et de l'absence de profil (l'ancien défaut implicite `technicien` est supprimé). Une fonction `is_member()` conditionne l'accès aux tables partagées (clients, équipements, pièces, appels, rendez-vous, création de fiches, signatures) : la désactivation de l'inscription publique n'est plus la seule barrière. Les comptes existants sans profil sont repris comme `technicien` au déploiement.
- **Équipe & rôles (SEC-07)** : écran réservé au responsable (*Compte & synchro*), qui appelle la RPC `set_user_role`. Celle-ci refuse le rôle `developpeur`, protège le dernier responsable et journalise dans `role_events`. Un trou a été fermé : un manager pouvait s'attribuer `responsable` par un simple `UPDATE` de son profil ; le rôle ne change plus que via la RPC ou depuis le SQL Editor.
- **Écran sans rôle actif (SEC-09)** : un compte `en_attente`, ou dont le profil n'a pas pu être chargé, voit un écran dédié (Réessayer / Compte) et n'ouvre ni synchronisation ni Realtime. Le rôle est résolu dans l'ordre : profil serveur, dernier rôle connu sur l'appareil (30 jours), sinon « inconnu » = aucun accès. Hors connexion, un manager garde son interface grâce au rôle mis en cache ; le serveur reste l'autorité.
- **Journal d'audit (COH-06 / IMP-01)** : `dossier_events` (changements de statut) et `role_events` (changements de rôle), alimentés par triggers, **en ajout seul** (ni `UPDATE` ni `DELETE`), lisibles dans le périmètre de la fiche (resp. par le responsable). L'**application** des rôles et des transitions reste portée par le trigger `enforce_statut_dossier_workflow` et non par une RPC `transition_dossier` : l'application est offline-first, une transition faite hors ligne est rejouée par la synchronisation, ce qu'une RPC ne pourrait pas porter. Un contrôle miroir côté application (`canTransition`) donne un message immédiat.
- **Données locales (SEC-04)** : un marqueur de propriétaire (`ce_local_owner`) empêche un autre compte d'hériter des données de l'appareil (purge si rien n'est en attente, sinon connexion refusée) ; **purge à la déconnexion** (activée par défaut pour les managers, bascule dans *Compte & synchro*), après tentative de synchronisation et avertissement si des éléments ne sont pas envoyés ; brouillon d'appel et nom du technicien effacés ; rappel d'activer le verrouillage de l'écran. Un installé antérieur adopte au premier compte connecté les données déjà présentes. **Pas de verrouillage applicatif par PIN/biométrie** : il ne protégerait pas des données lisibles dans IndexedDB.
- **Confidentialité et RGPD (SEC-13)** : page « Confidentialité » (Compte), alimentée par `PRIVACY_INFO` de `config.js` ; fonctions SQL `purge_soft_deleted` (simulation par défaut, rétention minimale 30 jours), `export_client_data`, `anonymize_client`, réservées au responsable ; `supabase/purge_retention.mjs` supprime ensuite les objets Storage listés. **Aucune durée de conservation n'est fixée par l'application** : décision et validation juridique de l'exploitant (`documentation/RGPD_CONSERVATION.md`).
- **CSP et en-têtes (SEC-12)** : la CSP de `index.html` liste les hôtes Supabase (plus de `*.supabase.co`) ; `scripts/build-dist.sh` génère `dist/_headers` (CSP limitée au projet de production lu dans `config.js`, `frame-ancestors`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS) et échoue si `config.js` et `index.html` sont incohérents.
- **Workflow** : transition « À facturer → À valider » (motif obligatoire, managers), cf. §3.3.4.
- **Vérifié** : `schema.sql` rejoué à vide puis sans vidage sur un PostgreSQL 16 jetable ; en SQL avec plusieurs identités : compte `en_attente` sans accès, auto-élévation refusée, rôle `developpeur` non attribuable, dernier responsable protégé, transitions autorisées et refusées par rôle, journaux en ajout seul, purge (simulation, cascade, client encore référencé), export et anonymisation. Côté application, tests manuels : compte `en_attente` bloqué (un contournement par l'accueil après connexion a été corrigé), transition « À facturer → À valider ». **À tester** : purge à la déconnexion, changement de compte sur un appareil, mode avion avec un manager, version de production avec en-têtes HTTP.

### Fiabilité — étape 2 (01/11/2026)

- **Brouillon du wizard persistant (BP-01)** : la saisie d'une fiche (nouvelle ou en modification) est conservée dans le stockage local (`_meta`, clé `ce_wizard_draft`) **à chaque saisie** (avec un court délai), au changement d'étape, au passage en arrière-plan (`visibilitychange`) et à la fermeture (`pagehide`). Au redémarrage, un bandeau propose **Reprendre** (retour à l'étape et aux champs saisis) ou **Ignorer**. Le brouillon est supprimé à « Enregistrer le brouillon », à « Soumettre pour validation » et à l'annulation. Il conserve aussi la **version serveur vue à l'ouverture** (§3.3.4, SYNC-01). **Les signatures dessinées et les photos prises avant l'enregistrement sont également restaurées** (confirmé sur appareil le 01/11/2026).
- **Mise à jour de l'application (service worker)** : une nouvelle version n'est pas appliquée par un rechargement pendant la saisie d'un formulaire ; un bandeau l'indique. L'application demande au navigateur un **stockage persistant** (`navigator.storage.persist()`) pour limiter l'éviction des données locales.
- **COH-05** : le code mort du bouton « contrat » (ancien flux retiré du menu « + ») est supprimé ; l'écran du contrat reste accessible comme décidé (§11).
- **SEC-03 — appels** : un trigger (`appels_restrict_update`) limite, pour un utilisateur qui n'est ni responsable ni créateur de l'appel, les colonnes modifiables à `intervention_id`, `rendezvous_id`, `action_sortie` et aux champs de traçabilité ; l'immutabilité de `created_by` reste portée par `prevent_created_by_change`. Une restriction par `with check (new… old…)` dans la policy est **impossible** (`NEW`/`OLD` n'existent que dans un trigger). Une RPC de liaison (`link_appel`) a été essayée puis **abandonnée** : appelée juste après l'enregistrement local, l'intervention n'existe pas encore sur le serveur (clé étrangère) ; le lien appel → intervention part avec la synchronisation normale. **Limite** : un technicien ne peut pas relier un appel créé par le responsable (il ne le reçoit pas ; la lecture des appels reste restreinte).
- **Signatures (SEC-01/SEC-08)** : le bucket `signatures` n'a ni lecture ni modification publique (une signature est figée). L'envoi en `upsert` (`INSERT … ON CONFLICT DO UPDATE`) était **toujours refusé** par la sécurité, même pour un nouvel objet, ce qui bloquait l'envoi différé des signatures. L'envoi se fait désormais en insertion simple ; si l'objet existe déjà (relance après coupure), il est **conservé** et son URL réutilisée.
- **Vérifié** : `schema.sql` rejoué deux fois sans erreur sur une base vierge et sur une base déjà en version précédente (suppression de `link_appel`) ; parcours appel → intervention (brouillon puis soumission) validé avec deux comptes ; envoi de signature validé (plus d'erreur, fichier présent). **Confirmé sur appareil le 01/11/2026** : reprise du brouillon après fermeture de l'application, et absence de rechargement pendant une saisie lors d'une mise à jour. **Reste à confirmer (test reporté)** : deux appareils hors ligne (numéros distincts, aucune ligne perdue ou dupliquée, éléments refusés par le serveur mis de côté).

### Édition concurrente d'une fiche — détection, signalement, avertissement (01/11/2026)

Constat de test (deux comptes, même fiche, hors ligne ou non) : la modification du second à enregistrer **écrasait silencieusement** celle du premier, sans aucun signalement visible.

- **Cause — SYNC-01** : la version de base de l'envoi était lue dans la copie locale **au moment de l'enregistrement**. Or cette copie avance seule (temps réel, synchronisation) pendant que le formulaire reste ouvert avec les anciennes valeurs : la base devenait la version de l'autre utilisateur et le contrôle ne voyait aucun écart. **Correctif** : à l'ouverture d'une fiche en modification, le brouillon retient la version serveur vue (`_base_updated_at`, `loadDraftFromIntervention`) ; `saveIntervention` l'utilise en priorité. La file de synchronisation (`enqueueSync`) **conserve la base d'origine** quand une fiche est ré-enregistrée avant envoi, ou quand un conflit est en cours ; la résolution « Garder ma version » fournit explicitement sa base (`authoritative`). Limité aux **fiches d'intervention** ; clients, appels et rendez-vous restent à traiter (§11).
- **Bandeau de conflit** : le bandeau de synchronisation (`updateOfflinePill`) affiche « N conflit(s) à résoudre » en alerte, prioritaire sur « changements à synchroniser », cliquable vers « Compte & synchro » (auparavant, un conflit n'apparaissait que sur cet écran).
- **Consigne de résolution** : sur « Compte & synchro », rappel que le choix ne fusionne rien et qu'il faut noter ce qu'on souhaite conserver.
- **Présence d'édition — PRES-01** (`supabase/schema.sql`) : table `fiche_presence` (sans accès direct, RLS sans policy) et fonctions `touch_fiche_presence` / `release_fiche_presence` (`security definer`, visibilité identique à `interventions_select`, ménage des présences de plus d'un jour). Côté application : `startPresence` / `stopPresence` / `renderPresenceBanner` (`app.js`), battement toutes les 60 s, libération à la sortie du formulaire et à `pagehide`.
- **Garde « plus un brouillon »** (`ensureStillDraft`) : « Enregistrer le brouillon » et « Soumettre pour validation » vérifient que la copie locale est encore un brouillon.
- **Vérifié** : `schema.sql` rejoué deux fois sans erreur sur une base vierge ; fonctions de présence testées en SQL (autre utilisateur visible, utilisateur sans accès non servi, lecture directe de la table refusée, libération, présence périmée ignorée) ; logique de la file, du bandeau, de la présence et de la garde testée par scripts ; scénario deux comptes rejoué à la main (conflit signalé, rien d'écrasé). **Reste à confirmer sur appareils** : avertissement de présence entre deux comptes réels.

### Correction — Visibilité des rendez-vous par technicien (22/08/2026)

Suite à un retour terrain (le technicien Jérémy ne voyait pas dans son planning un rendez-vous qui lui était affecté), le mécanisme d'affectation des rendez-vous (US-02 · US-17) a été corrigé :

- **Cause :** l'affectation d'un rendez-vous se faisait uniquement par le texte `intervenant` ("Jérémy", "Régis", "Delphine") alors que la RLS serveur ne contrôle que `technicien_id` (uuid). Le trigger `rendezvous_set_technicien` initialisait `technicien_id` avec le **créateur** du RDV : un rendez-vous créé par le responsable pour Jérémy restait donc invisible pour Jérémy (jamais reçu en synchronisation, car filtré par la politique `rendezvous_select`).
- **Côté client (`app.js`, `supabase.js`)** : `technicien_id` est désormais renseigné à partir de l'intervenant sélectionné (`resolveTechId()` — résolution du nom vers l'uuid du profil via la liste de l'équipe chargée à l'authentification) ; le filtre du planning privilégie `technicien_id = utilisateur connecté` ; le calcul du prénom (correspondance « Jérémy » ↔ « Jérémy Gardais ») est corrigé (premier mot du `full_name` au lieu du dernier).
- **Côté serveur (`supabase/schema.sql`)** : backfill des rendez-vous existants (`technicien_id` rattaché au profil dont le nom correspond à l'intervenant, bloc `BACKFILL`) et politique `rendezvous_select` élargie — le technicien voit son planning via `technicien_id` **ou** le nom d'intervenant ; les RDV non affectés (intervenant vide) restent visibles par toute l'équipe.

### Statut d'intervention & brouillons dans les tâches (24/08/2026)

Suite aux retours d'usage, le statut d'intervention et la gestion des brouillons ont été affinés :

- **Statut d'intervention à 3 valeurs** : « À effectuer » (`a_prevoir`, **nouveau défaut** des nouvelles interventions), « Effectuée » (`terminee`), « Effectuée, suite à prévoir » (`terminee_suite`). Le choix se fait à l'étape « Intervention » du wizard et s'affiche au récapitulatif, sur le détail de la fiche et dans le PDF généré.
- **Onglet Tâches aligné sur le statut d'intervention** : les fiches « Effectuée » sont masquées par défaut (mais restent accessibles via la recherche et les filtres) ; les fiches « À effectuer » et « Effectuée, suite à prévoir » restent dans la liste, la seconde rappelant qu'une suite est à planifier.
- **Brouillons visibles dans les tâches** : le filtre de l'onglet Tâches, qui ne regardait que le statut d'intervention, prend désormais aussi en compte `statut_dossier === "brouillon"` — un brouillon ne disparaît plus de la liste.
- **Enregistrement du brouillon à toutes les étapes** : le bouton « Enregistrer le brouillon » du pied de page du wizard est présent à **chaque étape** (et plus seulement à la première), ce qui permet de sauvegarder une fiche partiellement remplie sans la valider, puis de la reprendre plus tard — les données sont bien persistées (IndexedDB + synchronisation) et récupérables via l'onglet Dossiers, la recherche, ou le bouton Modifier du détail.

### Divers
- **PDF de fiche enrichi** : intégration des mesures, du CERFA et des photos dans le PDF généré.
- **PWA** : service worker mis à jour (`CACHE_VERSION` incrémentée, cache de `pdf-lib.min.js`), mécanisme `updatefound` conservé.
- **Performance (points P1/P2 de la revue `synchro-supabase`)** : les lectures des enfants d'une fiche (équipements, pièces utilisées, mesures, photos, documents) et `replaceChildren` passent par les **index IndexedDB** (`intervention_id`, `client_id`) via un helper `listByIndex` — suppression des scans complets de table (`getAll()` + filtre en mémoire). Index `intervention_id` créé sur `equipements` (bump `DB_VERSION` 3 → 4, migration automatique via `ensureIndex` sans perte de données). En complément, `getIntervention` est réécrite en **une seule transaction readonly** (multi-get : intervention + client + 5 collections d'enfants par index) — le N+1 structurel est éliminé.
- **Factorisation des listes (point D8 de la revue `synchro-supabase`)** : le motif « lecture complète + filtre des supprimés » répété dans toutes les fonctions de liste est centralisé dans deux helpers `DB.listActive` / `DB.listActiveByIndex` (`idb.js`) — une seule définition du filtre de tombstone `_deleted`, utilisée par toutes les listes (clients, interventions, équipements, pièces, mesures, photos, documents, appels, rendez-vous, contrats, base pièces) et l'export.
- **Temps d'intervention renseigné (point D4 de la revue `synchro-supabase`)** : le champ `temps_intervention` est désormais calculé à partir des heures d'arrivée/départ à la saisie (calcul auto déjà annoncé au §4, réutilise la même fonction que le PDF), persisté localement et synchronisé — il ne restait qu'une colonne vide déclarée dans le schéma.

### Correction — Persistance du brouillon « Nouvel appel » (25/08/2026)

Suite à un retour terrain : lors de la saisie d'un nouvel appel, réduire le navigateur (ou passer à une autre application) puis revenir sur la page déclenchait une synchronisation (rafraîchissement de session Supabase au retour sur l'onglet, ou rechargement complet de la page via la mise à jour du service worker / le réveil du navigateur) qui **effaçait le contenu des champs** déjà saisis.

- **Cause :** le brouillon « Nouvel appel » (`state.appelDraft`) ne vivait qu'en mémoire et n'était relu depuis le DOM qu'à l'enregistrement. Tout re-rendu de la page (`route()` remettait le brouillon à `null` sur `#/appel`) ou tout rechargement réinitialisait donc le formulaire à vide.
- **Correctif (`app.js`)** : le brouillon est désormais **synchronisé depuis le DOM à chaque saisie** (`syncAppelDraft` — champs texte + sélecteurs) et **persisté dans `localStorage`** (clé `ce_appel_draft`). `renderAppel` le restaure automatiquement au re-rendu ou après rechargement ; les brouillons issus d'une édition abandonnée (portant un `id`) ne sont pas rechargés dans un « Nouvel appel ». Le brouillon est effacé après enregistrement réussi et au clic sur « + » pour repartir sur un formulaire vierge.
- **Périmètre :** écran « Nouvel appel » (US-01). Le même principe de sauvegarde de la saisie pourrait être étendu au wizard d'intervention/entretien si le besoin se confirme sur le terrain.

### Cycle de vie de l'appel & RDV → intervention (25/08/2026)

Suite à l'arbitrage UX du 25/08/2026 (§3.2.5, §3.3.1, §5.2), le cycle de vie de l'appel est implémenté :

- **Reliage des appels** : un RDV créé depuis un appel renseigne `rendezvous.appel_id` et `appels.rendezvous_id` ; une fiche créée depuis un appel (bouton « Créer l'intervention → ») ou depuis un RDV renseigne `appels.intervention_id` (`linkAppelToRdv`, `linkAppelToIntervention`, `rdvToIntervention` dans `app.js`).
- **Masquage des appels traités** : le bloc « Appels » de l'onglet Dossiers ne montre plus que les appels en attente (sans `rendezvous_id` ni `intervention_id`), étiquetés « **À traiter** » (l'étiquette « Sans suite », jugée ambiguë, est abandonnée). Plus aucune suppression manuelle nécessaire dans le flux normal.
- **RDV → intervention** : bouton « **Créer l'intervention →** » sur le détail d'un rendez-vous — la fiche s'ouvre pré-remplie avec le client, le motif (note) et la date du RDV ; si le RDV est issu d'un appel, le lien est reporté sur la fiche.
- **Anti-doublon RDV → fiche** : dès qu'une fiche est créée depuis un RDV (validation **ou** brouillon), `rendezvous.intervention_id` est renseigné (`linkRdvToIntervention`) ; le bouton du RDV devient alors « **Reprendre la fiche** » (brouillon) ou « **Voir la fiche** », ce qui empêche de créer une seconde fiche par erreur. La suppression de la fiche délie le RDV (`unlinkRdvFromIntervention`), qui repasse à « Créer l'intervention → ».
- **Dé-lien** : bouton « Détacher de l'appel d'origine » sur un RDV lié ; la suppression d'un RDV ou d'une fiche détache automatiquement l'appel lié (qui revient « À traiter ») (`unlinkAppelFromRdv`, `unlinkAppelFromIntervention`).
- **Pré-remplissage enrichi** : le motif de l'appel est reporté dans le descriptif de la fiche créée depuis un appel.
- **`appels_update` élargi** (`supabase/schema.sql`) : la politique de mise à jour passe à `using (true)` (comme l'insert) afin que le technicien puisse relier une fiche/un RDV à un appel enregistré par le responsable ; la lecture reste restreinte (managers ou créateur).

### Pré-remplissage des signatures à la création d'une fiche (25/08/2026)

Suite à une demande terrain, les champs de signature sont **pré-remplis automatiquement** lors de la création d'une fiche d'intervention, pour éviter toute ressaisie :

- **Signature client** : le champ « Nom du client (signature) » est pré-rempli avec le **nom/prénom du client** sélectionné ou saisi (reprise depuis le RDV, l'appel, l'auto-complétion de la base clients ou la saisie libre du wizard). Le champ suit ensuite le nom du client tant qu'il n'a pas été **personnalisé manuellement** sur l'écran de signature (`captureClientFields` dans `app.js`).
- **Technicien** : le champ « Nom du technicien » est pré-rempli avec le **nom/prénom du technicien affecté au rendez-vous** à l'origine de la fiche — résolution via `technicien_id` (profil) sinon via le prénom affiché (`intervenant`), complété en nom complet par `resolveTechFullName` (équipe chargée à l'authentification). **À défaut** (fiche créée directement, depuis un appel, ou RDV sans intervenant), le champ est pré-rempli avec la **personne qui crée la fiche** : dernier technicien utilisé (`ce_technicien_nom`) sinon `full_name` du profil connecté (`emptyDraft` dans `app.js`).
- **Fiches créées depuis un appel** : le nom du client est également reporté dans le champ signature (`saveAppelFromDraft`).
- Le pré-remplissage est **modifiable** à tout moment : il ne s'agit que d'une valeur initiale, l'utilisateur reste libre de la corriger sur l'écran « Devis & signature ».

---


## V2 — synchronisation Supabase (liste des modifications livrées)

Récapitulatif des changements fonctionnels et techniques effectivement développés, correspondant au passage de la V1 (prototype PWA monoposte) vers la V2 (multi-utilisateur synchronisé + signatures électroniques).

### Authentification & compte utilisateur
- **Connexion par lien magique** (email OTP) ou **email + mot de passe** (écran `#/login`).
- **Restoration de session** au chargement + écoute des changements d'auth (`onAuthStateChange`).
- **Bouton de connexion dans la barre de titre** : icône utilisateur (`👤`) quand déconnecté, icône utilisateur **avec coche** (`👤✓`) quand connecté — remplace l'icône unique indifférenciée.
- **Nom de l'utilisateur connecté affiché dans la barre de titre** à la place de « Climat Elec » : priorité `full_name` (profil), sinon e-mail, sinon « Mon compte » ; « Climat Elec » reste affiché quand personne n'est connecté.
- **Écran « Compte & synchro »** (`#/account`) : affichage du profil, édition du **nom affiché** (`full_name`), bouton de connexion/déconnexion, état de la synchronisation, export **et import** des données locales (sauvegarde/restauration JSON ; les données restaurées rejoignent la file de synchronisation).

### Synchronisation multi-appareil (Supabase)
- **Offline-first** : écriture locale en premier (IndexedDB), puis **file de synchronisation** vers Supabase.
- **`pushAllLocal`** : envoi de l'ensemble des données locales en attente **à la connexion** (sign-in).
- **Soft-delete** propagé via `deleted_at` au lieu d'une suppression définitive.
- **Realtime** : publication des tables `clients`, `interventions`, `equipements`, `pieces_utilisees` (idempotente).
- **Nettoyage des champs locaux** avant upsert (les champs purement locaux ne sont pas envoyés à Supabase).
- **Schéma BDD Supabase** (`supabase/schema.sql`) : tables `clients`, `interventions`, `equipements`, `pieces_utilisees`, `profiles` ; triggers `updated_at` ; RLS + GRANT pour le rôle `authenticated` ; création automatique du profil à l'inscription (`handle_new_user`).
- **Migration V1 → V2** : éclatement des `equipements` et `pieces` imbriquées (auparavant stockées dans l'objet intervention) en tables séparées ; ajout de la colonne `intervention_id` sur `equipements`.

### Signatures électroniques (V2)
- **Signature tactile** client et technicien (modale de dessin) générant une image.
- **Upload des signatures vers Supabase Storage** (bucket `signatures`) + URL publique stockée sur la fiche.
- Fallback local (dataURL) si hors ligne ou si le storage n'est pas configuré.
- **Upload différé des signatures hors ligne** : une signature capturée sans réseau reste un dataURL local (persisté sur la fiche) ; dès que la connexion revient, elle est automatiquement convertie en image, uploadée vers le bucket `signatures` et remplacée par l'URL publique, puis re-synchronisée (`uploadPendingSignatures` dans `sync.js`). Fonctionne aussi après rechargement de la page.
- **Rattrapage Storage des photos/documents (complément SYNC-02, 30/10/2026)** : une photo/document ajouté sur une fiche mais dont l'objet Storage n'a pas pu être créé au moment de l'enregistrement (hors ligne, échec ponctuel) est **créé automatiquement au prochain cycle de sync** par l'appareil qui détient la copie locale (data_url), puis la ligne est re-poussée (`uploadPendingBinaries`) ; les autres appareils reconstituent l'affichage depuis Storage (URL signée) — ou, à défaut d'objet Storage, par **lecture unitaire du data_url en base** (`Supabase.get`, repli de `fillBinaryUrl`). Les scripts one-shot (`migrate_storage_to_id_paths.mjs`, `migrate_dataurl_to_storage.mjs`) couvrent l'historique serveur.
- **Nettoyage des anciennes signatures** : une re-signature sur une fiche ou un contrat déjà signé (en ligne) supprime l'ancien fichier du bucket `signatures` (`removeSignature`) pour ne pas laisser d'orphelins dans le Storage.
- **Posture de sécurité du bucket `signatures` (point S2 de la revue `synchro-supabase`, 24/08/2026)** : le bucket reste **public par choix assumé** — l'URL directe est nécessaire au PDF partagé et à l'affichage hors ligne. L'exposition est limitée par des **noms d'objets non devinables (UUID)** : les uploads directs utilisent `uuid()` (et non plus des horodatages prédictibles) et l'upload différé l'`id` de la fiche ; le risque résiduel (lecture par quiconque possède l'URL exacte) est documenté dans `supabase/schema.sql` (section Storage).

### Divers / technique
- **PWA** : mécanisme de mise à jour du service worker (`updatefound`).
- **Bandeau temporaire** de navigation vers les maquettes (à retirer après validation client).
- Toutes les icônes et styles associés sont dans `style.css` (`--ce-*` design tokens).

---

