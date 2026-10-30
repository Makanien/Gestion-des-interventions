# Procédure de sauvegarde Supabase — Climat Elec

- **Destination :** exploitant (exécutant : Régis / équipe interne)
- **Script :** [`supabase/backup_supabase.mjs`](../supabase/backup_supabase.mjs) (Node ≥ 18, zéro dépendance)
- **Dernier test :** à compléter à la première exécution

---

## 1. Quand faire une sauvegarde ?

| Déclencheur | Obligatoire ? |
|---|---|
| **Avant TOUTE opération sur la base de production** (re-jouage de `schema.sql`, migration Storage, script SQL) | ✅ **OBLIGATOIRE** (Étape 0 du plan d'action) |
| Hebdomadaire (rythme conseillé : lundi) | Oui |
| Avant chaque déploiement de nouvelle version du site | Recommandé |
| Avant tout test/réglage dans le Dashboard Supabase | Recommandé |

## 2. Prérequis

- Node ≥ 18 (`node --version`) ;
- La **clé `service_role`** du projet (Dashboard Supabase → Settings → API). Elle est
  **secrète** : ne la collez **jamais** dans un fichier versionné, un email ou un ticket ;
- Un dossier de destination **HORS du dépôt git** (mêmes règles que SEC-06),
  ex. `~/sauvegardes/`.

## 3. Procédure (≈ 2 minutes)

### 3.1 Préparer les variables

Dans un terminal — remplacez `<clé service_role>` par la valeur du Dashboard
(mot de passe DB de `schema.sql` ou `seed.local.sql` : *pas nécessaire ici*).

```bash
export SUPABASE_URL="https://gegsynegpfacgwgwxivs.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="<clé service_role>"
export BACKUP_DIR="$HOME/sauvegardes/supabase-prod-$(date +%Y-%m-%d-%H%M)"
mkdir -p "$HOME/sauvegardes"
```

> ⚠️ `BACKUP_DIR` doit être **nouveau** : le script refuse d'écraser un dossier existant.

### 3.2 Lancer la sauvegarde (depuis le dossier du projet)

```bash
cd ~/dev/Gestion-des-interventions
node supabase/backup_supabase.mjs
```

### 3.3 Vérifier le résultat

La sortie doit afficher :

```
  table clients            NN ligne(s)   ### kio
  ... (12 tables)
  bucket photos            NN objet(s)   ### kio
  bucket documents         NN objet(s)   ### kio
  bucket signatures        NN objet(s)   ### kio

=== Sauvegarde complète → /home/makanien/sauvegardes/supabase-prod-… ===
```

Contrôles :

1. **`Sauvegarde complète`** — si « PARTIELLE » : lire l'erreur de la table/bucket,
   la corriger, RELANCER dans un dossier vierge ;
2. Les 12 tables sont présentes, avec des chiffres cohérents
   (repère courant : `photos` ≈ 50 lignes, `interventions` plusieurs dizaines) ;
3. `Supabase` contient les 3 buckets avec des objets ;
4. `SAUVEGARDE.json` est présent (empreinte : horodatage + décomptes).

### 3.4 Mettre en sécurité (double copie)

1. **Local** : `~/sauvegardes/…` (hors dépôt git — jamais committer) ;
2. **Deuxième support** : copier le dossier sur un disque externe et/ou un
   cloud **privé** (l'objectif : survivre à une panne de portable).

Rétention conseillée : garder ~8 semaines glissantes (8 sauvegardes),
purger les plus anciennes à chaque exécution.

## 4. Journal des sauvegardes (à tenir à jour)

| Date | Dossier / Support | État | Signé par |
|---|---|---|---|
| | | | |
| | | | |

## 5. Limites connues du script (assumées)

- **Schéma non dupliqué** : sa vérité versionnée reste `supabase/schema.sql`
  (re-jouable sur base neuve, idempotent) ;
- **Comptes auth** (emails / mots de passe) non exportables via l'API :
  à recréer sur un projet neuf (`seed.local.sql` local pour les rôles + réinit.
  des mots de passe) ;
- La restauration complète (replay `schema.sql` + réimport JSON + recopie
  Storage) reste **à écrire/tester** — c'est le « test de restauration »
  d'**IMP-09** ; en attendant, toute restauration passe par moi/le développeur.

## 6. Restauration express (aide-mémoire)

1. Projet Supabase vierge → Dashboard → SQL Editor → rejouer `schema.sql` ;
2. Créer les comptes auth (emails du `seed.local.sql`), exécuter `seed.local.sql` ;
3. Réimporter les données JSON (upsert par lots via l'API REST / `service_role`) ;
4. Recopier le contenu `storage/…` dans les buckets du nouveau projet ;
5. Tester : connexion de chaque compte, une fiche complète avec photos,
   synchronisation 2 appareils.

---

*Liens : plan d'action `Analyse application.md` §7 (Étape 0 / IMP-09) ;
script `supabase/backup_supabase.mjs` ; `supabase/DEPLOYMENT.md` pour
l'environnement.*
