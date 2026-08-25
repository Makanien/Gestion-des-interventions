# Déploiement Supabase (V3) — Climat Elec

Ce document décrit la mise en place du backend Supabase nécessaire pour la V2
(multi-utilisateur synchronisé) et la V3 (planning, entretiens, workflow de
dossier, documents importés, photos, base pièces, contrats).

> Le schéma est désormais **un fichier unique** : `supabase/schema.sql` contient
> l'état final complet (tables V2 + V3, rôles, RLS, Storage, Realtime, backfill).
> Il est **idempotent** : exécutable sur une base neuve comme sur une base déjà
> migrée, relançable sans erreur ni effet de bord. Il n'y a plus d'ordre de
> scripts à respecter.

## 1. Prérequis

- Un projet Supabase actif (déjà connecté à votre compte GitHub).
- Le dépôt déployé sur la branche `dev` (V2 + V3).

## 2. Exécuter le schéma SQL

Dans le **Dashboard Supabase** (`https://supabase.com/dashboard`), ouvrez votre
projet, puis **SQL Editor → New query**. Collez le contenu de
`supabase/schema.sql` et exécutez.

### Ce que fait le schéma

| Objet | Rôle |
|---|---|
| `clients`, `interventions`, `equipements`, `pieces_utilisees` | Données métier (id UUID, `updated_at`, `deleted_at`) |
| `appels`, `rendezvous`, `mesures`, `photos`, `pieces`, `documents`, `contrats_entretien` | Données V3 (appel, planning, entretiens, photos, base pièces, PDF importés, contrats) |
| `profiles` | Nom affiché + rôle (`responsable` / `technicien` / `secretaire`) |
| Triggers `set_updated_at` / `set_created_by` / `set_updated_by` / `set_technicien_default` | Horodatage + propriétaire automatiques |
| Trigger `handle_new_user` | Création auto du profil à l'inscription |
| Buckets Storage `signatures`, `photos`, `documents` + politiques | Signatures (public pour le PDF) / photos / documents (privés) |
| RLS par rôle | `responsable` & `secretaire` → toute l'équipe ; `technicien` → ses fiches et son planning |
| `alter publication supabase_realtime` | Active le Realtime sur les tables |

> ⚠️ Le rôle `anon` n'obtient **aucun** privilège : la clé anon est inutile sans
> session. La barrière d'accès est l'inscription publique **désactivée** (§4).

## 3. Configuration des clés

Copiez l'URL du projet et la clé **anon / publishable** (publique) dans
`config.js` à la racine :

```js
window.SUPABASE_CONFIG = {
  url: "https://VOTRE-PROJET.supabase.co",
  anonKey: "sb_publishable_...",
};
```

> ⚠️ N'exposez **jamais** la clé `service_role` (secret) dans le frontend.
> Seule la clé `anon` (ou `publishable`) doit y figurer : elle est verrouillée
> par les RLS.

Où trouver la clé : **Dashboard → Project Settings → API** → section
*Publishable keys* (ou *anon key*).

## 4. Authentification

Dans **Authentication → Sign In / Providers** :

- Activez **Email** (lien magique + mot de passe).
- **Désactivez l'inscription publique** (« Enable new signups » off, ou « Allow
  only listed emails ») — indispensable : sans cela, n'importe qui pourrait
  créer un compte et devenir un `technicien` qui voit « ses » données.
- Vérifiez **Site URL** et **Redirect URLs** : ajoutez l'URL de déploiement
  (ex. `https://votre-app.netlify.app` et `http://localhost:8080` pour les tests).
- Le lien magique doit renvoyer vers l'app (le SDK utilise `emailRedirectTo`).

Créez les 3 comptes via **Authentication → Users → Add user** :

| Email | Rôle cible |
|---|---|
| `regis.chanteux@gmail.com` | `responsable` |
| `jgardaisclimatelec@gmail.com` | `technicien` |
| `contactdsolutions49@gmail.com` | `secretaire` |

> Le rôle ne se règle **pas** à la création du compte : il est attribué par le
> backfill du schéma (fin de `schema.sql`) ou via `set_user_role()`. La ligne
> `profiles` est créée automatiquement à la première connexion (trigger
> `handle_new_user`). Si le backfill doit répartir l'historique entre Régis et
> Jérémy plutôt que « tout au responsable », ajustez la requête dans le bloc
> `BACKFILL` avant exécution.

### Alternative : attribuer un rôle à un compte déjà créé

```sql
-- En SQL editor (sans session) ou via l'API en tant que manager :
select public.set_user_role('<uuid-du-compte>', 'secretaire');
```

## 5. Vérifications

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

Test fonctionnel : connectez-vous avec le compte **technicien** — il ne doit
voir que les interventions dont `technicien_id` ou `created_by` est son
identifiant, et son planning. Le compte **responsable** / **secretaire** doit
tout voir.

## 6. Déploiement du frontend

Déployez le dossier (Netlify, GitHub Pages, Vercel…) comme pour la V1.
Le service worker (`sw.js`) embarque désormais le SDK Supabase en cache
(`vendor/supabase-js.min.js`) : l'app reste **offline-first** après la première
ouverture, et la synchronisation s'effectue automatiquement dès que le réseau
revient.

## 7. Migration V1 → V2 → V3

Les données existantes sont conservées telles quelles :
- Au premier lancement de la V3, `idb.js` migre le schéma IndexedDB
  (version 3) sans perdre les clients/interventions déjà saisis, et initialise
  le champ `statut_dossier` sur les fiches existantes.
- Après connexion à un compte, lancez **Compte & synchro → Synchroniser
  maintenant** : les données locales sont poussées vers Supabase.

## 8. Signature électronique

Les signatures tactiles sont :
1. Capturées sur le téléphone (canvas → PNG) ;
2. Stockées localement (dataURL) pour rester visibles hors ligne ;
3. Envoyées vers le bucket Storage `signatures` dès que le réseau est
   disponible (l'URL publique est alors enregistrée sur l'intervention) ;
4. Rendu dans le PDF généré et dans le détail de la fiche.

Le bucket `signatures` est **public en lecture** par choix assumé (URL directe
dans le PDF + affichage hors ligne) ; l'exposition est limitée par des noms
d'objets non devinables (UUID).

## 9. Photos & documents importés (V3)

- **Photos** (étape « Photos » des fiches) : stockées en dataURL dans la table
  `photos` (offline-first). Le bucket `photos` permet un upload Storage ultérieur.
- **Documents** (devis / facture importés en PDF) : stockés en base64 dans la
  table `documents`. Le bucket `documents` est prévu pour un upload Storage.
  Le PDF est produit par un **logiciel externe** : l'app ne génère ni devis ni
  facture chiffrée, elle les importe et les attache au dossier.

## 10. Retour arrière (rollback)

En cas de problème, retour au modèle « tout partagé » (en **conservant** la
désactivation de l'inscription publique) :

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
