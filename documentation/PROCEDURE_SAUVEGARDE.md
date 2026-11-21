# Procédure de sauvegarde Supabase — Climat Elec

- **Destination :** exploitant (exécutant : Régis / équipe interne)
- **Script :** [`supabase/backup_supabase.mjs`](../supabase/backup_supabase.mjs) — version 2 (Node ≥ 18, zéro dépendance)
- **Dernière sauvegarde :** 2026-11-22 — complète (13 tables, 4 comptes, 251 / 53 / 1 objets, `pg_dump` ok)
- **Dernier test de restauration :** ⚠️ **jamais effectué** — à faire (voir §7)

> **Plan Supabase gratuit : aucune sauvegarde automatique n'existe.**
> Cette procédure manuelle est la seule protection des données. Une sauvegarde
> jamais restaurée ne prouve rien : le test de restauration (§7) est un critère
> bloquant avant la mise en production.

---

## 1. Quand faire une sauvegarde ?

| Déclencheur | Obligatoire ? |
|---|---|
| **Avant TOUTE opération sur la base de production** (re-jouage de `schema.sql`, migration, nettoyage Storage, script SQL) | ✅ **OBLIGATOIRE** |
| Hebdomadaire (rythme conseillé : lundi) | Oui |
| Avant chaque déploiement de nouvelle version du site | Recommandé |
| Avant tout réglage dans le Dashboard Supabase | Recommandé |

## 2. Ce que contient une sauvegarde

| Élément | Fichier / dossier | Remarque |
|---|---|---|
| Données de toutes les tables du schéma `public` (lignes soft-supprimées incluses) | `tables/<table>.json` | Liste **découverte automatiquement** : les nouvelles tables sont incluses sans modifier le script |
| Comptes auth (id, email, métadonnées, dates) | `auth-users.json` | **Sans mots de passe** (non exportables) ; indispensable pour retrouver les UUID référencés par les tables |
| Photos, documents, signatures | `storage/<bucket>/…` | Orphelins inclus tant qu'ils ne sont pas purgés |
| Configuration des buckets | `storage-buckets.json` | |
| Dump PostgreSQL du schéma `public` (restaurable avec `pg_restore`) | `database-public.dump` | Si `SUPABASE_DB_URL` est défini |
| Schéma réel : tables, policies, triggers, fonctions | `schema-public.sql` | Si `SUPABASE_DB_URL` est défini |
| Schémas gérés `auth` et `storage` (policies Storage, triggers) | `schema-supabase-gere.sql` | Best-effort : un échec n'est qu'un avertissement |
| Manifeste (horodatage, décomptes, empreintes par objet, erreurs) | `SAUVEGARDE.json` | |
| Empreintes SHA-256 de tous les fichiers | `SHA256SUMS` | |

## 3. Prérequis

- **Node ≥ 18** (`node --version`) ;
- **`pg_dump` (client PostgreSQL) de version ≥ celle du serveur** (`pg_dump --version`).
  Version du serveur : `select version();` dans le SQL Editor. Sous Debian/Ubuntu :
  `sudo apt install postgresql-client` ; si la version est trop ancienne, installer
  le client depuis le dépôt officiel PGDG (postgresql.org/download/linux) ;
- La **clé `service_role`** (Dashboard → Settings → API Keys). Elle est **secrète** :
  jamais dans un fichier versionné, un email, un ticket ou un message ;
- Le **mot de passe de la base** et la chaîne **Session pooler** (Dashboard → bouton *Connect*).
  Éviter les caractères spéciaux (`@ / # : ?`) dans le mot de passe, sinon les encoder
  dans l'URL (`@` → `%40`) ;
- Un dossier de destination **HORS du dépôt git**. Le script refuse d'écrire dans un dépôt.

## 4. Procédure (≈ 3 minutes)

### 4.1 Préparer les variables

Dans le terminal (rien n'est écrit dans l'historique pour les secrets saisis avec `read -rs`) :

```bash
export SUPABASE_URL="https://gegsynegpfacgwgwxivs.supabase.co"
read -rs SUPABASE_SERVICE_ROLE_KEY && export SUPABASE_SERVICE_ROLE_KEY   # coller la clé, Entrée
read -rs SUPABASE_DB_URL && export SUPABASE_DB_URL                       # coller la chaîne pooler complète, Entrée
export BACKUP_DIR="$HOME/backups-supabase/prod-$(date +%Y-%m-%d-%H%M)"
export EXPECT_OBJECTS="photos=251,documents=1,signatures=53"             # optionnel, à mettre à jour (voir §5)
```

> `SUPABASE_DB_URL` a la forme
> `postgresql://postgres.gegsynegpfacgwgwxivs:<MOT_DE_PASSE>@aws-1-eu-west-1.pooler.supabase.com:5432/postgres`.
> Ne jamais l'écrire en clair dans un fichier du dépôt.
>
> `BACKUP_DIR` doit être **nouveau** : le script refuse d'écraser un dossier existant.
> Sans `SUPABASE_DB_URL`, la sauvegarde reste possible mais le schéma réel, les policies
> et les triggers ne sont **pas** sauvegardés (avertissement affiché).

### 4.2 Lancer la sauvegarde

```bash
cd ~/dev/Gestion-des-interventions
node supabase/backup_supabase.mjs
```

### 4.3 Lire le résultat

La sortie suit 4 étapes (tables, comptes auth, Storage, dump PostgreSQL) puis une ligne finale :

- **`Sauvegarde COMPLÈTE — 0 erreur(s)`** : exploitable ;
- **`Sauvegarde INCOMPLÈTE`** (code de sortie 1) : lire les lignes `✗`, corriger la cause,
  puis **relancer dans un dossier vierge**. Ne jamais compter sur une sauvegarde incomplète.

Le script refuse de démarrer si : la clé n'est pas une `service_role` (une clé `anon` donnerait
une sauvegarde vide), le dossier existe déjà, ou le dossier est dans un dépôt git.

### 4.4 Vérifier

1. **Intégrité des fichiers** : `cd "$BACKUP_DIR" && sha256sum -c SHA256SUMS | grep -v ': OK'`
   → aucune ligne affichée = tout est intact (sous macOS : `shasum -a 256 -c SHA256SUMS`) ;
2. **Fichiers du schéma présents** : `database-public.dump`, `schema-public.sql`
   (et idéalement `schema-supabase-gere.sql`) ;
3. **Cohérence des chiffres** : comparer `SAUVEGARDE.json` aux comptages SQL
   (`select count(*) from public.<table>;`) et aux objets Storage ;
4. **Aucun avertissement inexpliqué.**

### 4.5 Mettre en sécurité (double copie)

1. **Local** : `~/backups-supabase/…`, hors dépôt git — **jamais committer** ;
2. **Deuxième support** : disque externe et/ou cloud **privé**, pour survivre à la panne d'un portable ;
3. Le dossier contient des **données clients en clair** : chiffrer la copie hors poste, par exemple
   `tar -czf - prod-AAAA-MM-JJ-HHMM | gpg -c > prod-AAAA-MM-JJ-HHMM.tar.gz.gpg`
   (conserver la phrase de passe dans un gestionnaire de mots de passe, sinon la sauvegarde est perdue) ;
4. **Fermer le terminal** : la clé `service_role` et le mot de passe de la base y restent en mémoire.

Rétention conseillée : ~8 sauvegardes hebdomadaires glissantes ; purger les plus anciennes.

## 5. Repères de cohérence (à mettre à jour)

Ces chiffres évoluent : utiliser ceux de la **dernière sauvegarde validée** (journal §6) comme
point de comparaison, et mettre à jour `EXPECT_OBJECTS`. Un écart légitime est possible si des
photos ont été ajoutées depuis ; un écart inexpliqué est à investiguer avant de s'y fier.

Au 2026-11-22 :

| Élément | Valeur |
|---|---|
| Tables sauvegardées | 13 (dont `numero_counteurs`) |
| Comptes auth | 4 |
| Storage | `photos` 251 · `signatures` 53 · `documents` 1 |
| Photos en base | 167 lignes (146 actives + 21 supprimées) |
| Objets Storage sans ligne active (« orphelins ») | 105 — à nettoyer après validation de la restauration |

## 6. Journal des sauvegardes (à tenir à jour)

| Date | Dossier / Support | État | Signé par |
|---|---|---|---|
| 2026-11-22 | BmaxAlex `/home/alex/backups-supabase/prod-2026-11-22` | Complète, script v2, `pg_dump` ok (13 tables, 4 comptes, 251/53/1 objets) | Alex |
| | | | |

## 7. Restauration — NON ENCORE TESTÉE

Les fichiers JSON ne se réimportent **pas** tels quels : les triggers (`set_updated_at`, workflow
des dossiers, restrictions sur `appels`) modifient ou rejettent des lignes. La voie de restauration
prévue est donc le dump PostgreSQL. **Toutes les étapes ci-dessous sont à valider** sur un projet
Supabase de test vierge, puis à consigner ici :

1. Créer un projet Supabase vierge (jamais sur la production) ;
2. Recréer les comptes auth. Les UUID doivent être **identiques** à ceux de `auth-users.json`, car
   `profiles` et les colonnes `created_by` / `technicien_id` les référencent. *Point à vérifier :*
   la possibilité de créer un compte avec un UUID imposé (API Admin) ; sinon prévoir un remappage ;
3. Restaurer le schéma et les données : `pg_restore --no-owner --no-privileges -d "<URL du projet de test>" database-public.dump`
   (puis comparer les policies et triggers avec `schema-public.sql`) ;
4. Recréer les buckets (`storage-buckets.json`) et leurs policies, puis recopier `storage/<bucket>/…` ;
5. Contrôler : comptes de lignes identiques, connexion de chaque rôle, une fiche complète avec photos
   et signature, synchronisation sur 2 appareils, numérotation (`numero_counteurs`) cohérente.

Critère de réussite : toutes les vérifications du point 5 passent. Noter la date, la durée et les
écueils rencontrés dans le journal §6.

## 8. Limites connues du script (assumées)

- **Les mots de passe des comptes ne sont pas exportables** : à réinitialiser après restauration ;
- **Le dump PostgreSQL ne couvre que le schéma `public`** ; `auth` et `storage` sont sauvegardés
  en schéma seul (best-effort), sans leurs données ;
- **Écritures pendant la sauvegarde** : un écart entre les lignes lues et le total serveur fait
  échouer la sauvegarde ; relancer, de préférence quand l'équipe n'utilise pas l'application ;
- **Plan gratuit** : pas de point de restauration à la seconde, pas de sauvegarde quotidienne
  automatique, et mise en pause possible du projet en cas d'inactivité. Le passage au plan Pro
  (sauvegardes quotidiennes, 7 jours) reste recommandé pour la production ; le Storage resterait
  à sauvegarder avec ce script.

---

*Liens : plan d'action `Analyse application.md` §7 (Étape 0 / IMP-09, SEC-14) ;
script `supabase/backup_supabase.mjs` ; `supabase/DEPLOYMENT.md` pour l'environnement.*