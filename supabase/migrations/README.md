# Procédure de migration — Rôles & RLS (`001_roles_rls.sql`)

Ce document décrit, pas à pas, la mise en place des **rôles utilisateurs** et du
durcissement des **RLS** (Row Level Security) décrits dans le PRD §2 et §3.2
(US-16 · US-17), en complément de `supabase/DEPLOYMENT.md`.

> **Objectif :** passer du modèle actuel « tout utilisateur authentifié voit
> tout » (`using (true)`) à un modèle par rôle :
> - `responsable` (Régis) et `secretaire` (Delphine) → voient toute l'équipe ;
> - `technicien` (Jérémy) → ne voit que ses propres interventions et son planning.

---

## 1. Résumé de ce que fait la migration

| Étape | Contenu |
|---|---|
| Colonnes | `profiles.role` (enum `responsable` / `technicien` / `secretaire`) + `interventions.technicien_id` |
| Fonctions | `current_role()`, `is_manager()`, `set_user_role()` |
| Triggers | Remplissage auto de `created_by` / `updated_by` / `technicien_id` + anti-élévation de rôle |
| RLS | Remplace les politiques `using (true)` par des politiques par rôle |
| Backfill | Attribution des rôles et du propriétaire sur les données existantes |

> ⚠️ **Point critique :** le frontend actuel (`idb.js`, `sync.js`) ne renseigne
> **jamais** `created_by` / `technicien_id`. Sans les triggers de la migration,
> un technicien ne verrait **aucune** fiche une fois les RLS appliquées. Les
> triggers comblent ce manque côté serveur (défaut = utilisateur courant).

---

## 2. Prérequis

1. Un projet Supabase actif, avec `schema.sql` **déjà exécuté** (tables V2 en place).
2. Être connecté au **Dashboard Supabase** du projet.
3. Les 3 comptes à créer (emails réels à substituer) :
   - `regis@…` → Responsable
   - `jeremy@…` → Technicien
   - `delphine@…` → Secrétaire

---

## 3. Étape 1 — Désactiver l'inscription publique

Cette étape est **indispensable** : sans elle, n'importe qui pourrait créer un
compte et devenir un `technicien` qui voit « ses » données.

**Dashboard → Authentication → Sign In / Providers → Email** :

- Désactivez **« Enable new signups »** (ou, selon l'interface, **Allow only
  listed emails** en renseignant les 3 emails ci-dessus).

---

## 4. Étape 2 — Créer les 3 comptes

**Dashboard → Authentication → Users → Add user**, trois fois :

| Email | Rôle cible |
|---|---|
| `regis@…` | `responsable` |
| `jeremy@…` | `technicien` |
| `delphine@…` | `secretaire` |

> Le rôle ne se règle **pas** à la création du compte : il sera attribué au
> backfill (étape 5) ou via `set_user_role()` après la première connexion.
> La ligne `profiles` est créée automatiquement à la première connexion
> (trigger `handle_new_user`).

---

## 5. Étape 3 — Exécuter la migration SQL

**Dashboard → SQL Editor → New query**, puis collez et exécutez le fichier :

```
supabase/migrations/001_roles_rls.sql
```

Le script est **idempotent** (relançable sans erreur).

> Ordre global recommandé si tout est à (re)faire : `schema.sql` →
> `storage.sql` → `migrations/001_roles_rls.sql`.

---

## 6. Étape 4 — Backfill des rôles et de l'existant

La fin du script contient un bloc `DO $$ … $$` de backfill. Avant de l'exécuter,
**remplacez les emails d'exemple** par les vrais :

```sql
select id into v_responsable from auth.users where email = 'regis@exemple.fr';
select id into v_technicien  from auth.users where email = 'jeremy@exemple.fr';
select id into v_secretaire  from auth.users where email = 'delphine@exemple.fr';
```

Ce bloc :

1. Attribue les rôles (`responsable` / `technicien` / `secretaire`) si la ligne
   `profiles` existe déjà (sinon la ligne est créée à la première connexion,
   avec le rôle par défaut `technicien` — à corriger ensuite via
   `set_user_role()`).
2. Rattache les interventions existantes (`created_by`, `technicien_id`) au
   **responsable**, qui voit tout de toute façon.

> 💡 **Répartition de l'historique :** si les anciennes fiches doivent être
> réparties entre Régis et Jérémy, ajustez la requête (ex. selon `technicien_nom`)
> **avant** exécution. Le script part du principe « tout au responsable ».

### Alternative : attribuer un rôle à un compte déjà créé

```sql
-- En SQL editor (sans session) ou via l'API en tant que manager :
select public.set_user_role('<uuid-du-compte>', 'secretaire');
```

---

## 7. Étape 5 — Vérifications

Exécutez ces requêtes dans le SQL Editor pour contrôler le résultat :

```sql
-- 1. Rôles attribués
select p.full_name, p.role, u.email
from public.profiles p
join auth.users u on u.id = p.id
order by p.role;

-- 2. Aucune intervention orpheline (doit renvoyer 0)
select count(*) as interventions_orphelines
from public.interventions
where created_by is null or technicien_id is null;

-- 3. Politiques RLS actives
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
order by tablename, cmd;
```

Test fonctionnel final : connectez-vous avec le compte **Jérémy**
(`technicien`). Il ne doit voir **que** les interventions dont `technicien_id`
ou `created_by` est égal à son identifiant. Le compte **Régis** ou **Delphine**
doit, lui, tout voir.

---

## 8. Retour arrière (rollback)

Si la migration pose problème, réexécutez l'ancien modèle « tout partagé »
(en conservant la désactivation de l'inscription publique) :

```sql
-- interventions
drop policy if exists interventions_select on public.interventions;
create policy interventions_select on public.interventions for select to authenticated using (true);
drop policy if exists interventions_insert on public.interventions;
create policy interventions_insert on public.interventions for insert to authenticated with check (true);
drop policy if exists interventions_update on public.interventions;
create policy interventions_update on public.interventions for update to authenticated using (true);
drop policy if exists interventions_delete on public.interventions;
create policy interventions_delete on public.interventions for delete to authenticated using (true);

-- pieces_utilisees
drop policy if exists pieces_select on public.pieces_utilisees;
create policy pieces_select on public.pieces_utilisees for select to authenticated using (true);
drop policy if exists pieces_insert on public.pieces_utilisees;
create policy pieces_insert on public.pieces_utilisees for insert to authenticated with check (true);
drop policy if exists pieces_update on public.pieces_utilisees;
create policy pieces_update on public.pieces_utilisees for update to authenticated using (true);
drop policy if exists pieces_delete on public.pieces_utilisees;
create policy pieces_delete on public.pieces_utilisees for delete to authenticated using (true);

-- profiles (retour à l'écriture libre du profil)
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert to authenticated with check (auth.uid() = id);
```

Les colonnes, fonctions et triggers ajoutés peuvent rester en place : ils sont
inoffensifs si l'on revient au modèle « tout partagé ».

---

## 9. Points d'attention (hors périmètre de cette migration)

- **Bucket `signatures` public en lecture** (`storage.sql`) : les signatures
  sont accessibles par URL directe (point S2 de la revue de code). Le passage
  en bucket privé est une décision **séparée**, à arbitrer (impact sur la
  génération du PDF côté client).
- **Nouvelles tables à venir** (appels, rendez-vous, mesures, photos, base
  pièces — PRD §3.2) : chacune devra naître **avec** ses RLS par rôle, sur le
  même modèle que `interventions` / `pieces_utilisees`.
- **`created_by` / `technicien_id` côté frontend** : à terme, le frontend
  devrait renseigner lui-même ces champs (notamment `technicien_id` lors de la
  planification par le responsable). Les triggers ne sont qu'un filet de
  sécurité, pas un substitut à la saisie métier.
