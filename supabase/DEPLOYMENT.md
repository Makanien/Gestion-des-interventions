# Déploiement Supabase (V3) — Climat Elec

Ce document décrit la mise en place du backend Supabase nécessaire pour la V2
(multi-utilisateur synchronisé) et la V3 (planning, entretiens, workflow de
dossier, documents importés, photos, base pièces, contrats).

## 1. Prérequis

- Un projet Supabase actif (déjà connecté à votre compte GitHub).
- Le dépôt déployé sur la branche `dev` (V2 + V3).

## 2. Exécuter le schéma SQL

Dans le **Dashboard Supabase** (`https://supabase.com/dashboard`), ouvrez votre
projet, puis **SQL Editor → New query**. Collez et exécutez, **dans cet ordre** :

1. `supabase/schema.sql` — crée les tables V2, les RLS, les triggers et le Realtime.
2. `supabase/storage.sql` — crée les buckets `signatures`, `photos`, `documents` et leurs politiques.
3. `supabase/migrations/001_roles_rls.sql` — rôles + RLS par rôle (V2).
4. `supabase/migrations/002_v3.sql` — **nouvelles tables V3** (appels, rendezvous, mesures, photos, pieces, documents, contrats_entretien) + colonnes `interventions` + RLS par rôle.

Ces scripts sont **idempotents** (on peut les relancer sans risque).

### Ce que fait le schéma

| Objet | Rôle |
|---|---|
| `clients`, `interventions`, `equipements`, `pieces_utilisees` | Données métier (id UUID, `updated_at`, `deleted_at`) |
| `appels`, `rendezvous`, `mesures`, `photos`, `pieces`, `documents`, `contrats_entretien` | Données V3 (appel, planning, entretiens, photos, base pièces, PDF importés, contrats) |
| `profiles` | Nom affiché + rôle (`responsable` / `technicien` / `secretaire`) |
| Triggers `set_updated_at` / `set_created_by` / `set_updated_by` / `set_technicien_default` | Horodatage + propriétaire automatiques |
| Trigger `handle_new_user` | Création auto du profil à l'inscription |
| RLS | Accès restreint par rôle (aucune donnée publique) |
| `alter publication supabase_realtime` | Active le Realtime sur les tables |

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
- Désactivez l'inscription publique (ou restreignez à la liste des emails) —
  voir `migrations/README.md` §3.
- Vérifiez **Site URL** et **Redirect URLs** : ajoutez l'URL de déploiement
  (ex. `https://votre-app.netlify.app` et `http://localhost:8080` pour les tests).
- Le lien magique doit renvoyer vers l'app (le SDK utilise `emailRedirectTo`).

Créez les comptes via **Authentication → Users → Add user**, puis attribuez les
rôles via le backfill de `001_roles_rls.sql` ou `set_user_role()`.

## 5. Déploiement du frontend

Déployez le dossier (Netlify, GitHub Pages, Vercel…) comme pour la V1.
Le service worker (`sw.js`) embarque désormais le SDK Supabase en cache
(`vendor/supabase-js.min.js`) : l'app reste **offline-first** après la première
ouverture, et la synchronisation s'effectue automatiquement dès que le réseau
revient.

## 6. Migration V1 → V2 → V3

Les données existantes sont conservées telles quelles :
- Au premier lancement de la V3, `idb.js` migre le schéma IndexedDB
  (version 3) sans perdre les clients/interventions déjà saisis, et initialise
  le champ `statut_dossier` sur les fiches existantes.
- Après connexion à un compte, lancez **Compte & synchro → Synchroniser
  maintenant** : les données locales sont poussées vers Supabase.

## 7. Signature électronique

Les signatures tactiles sont :
1. Capturées sur le téléphone (canvas → PNG) ;
2. Stockées localement (dataURL) pour rester visibles hors ligne ;
3. Envoyées vers le bucket Storage `signatures` dès que le réseau est
   disponible (l'URL publique est alors enregistrée sur l'intervention) ;
4. Rendu dans le PDF généré et dans le détail de la fiche.

## 8. Photos & documents importés (V3)

- **Photos** (étape « Photos » des fiches) : stockées en dataURL dans la table
  `photos` (offline-first). Le bucket `photos` permet un upload Storage ultérieur.
- **Documents** (devis / facture importés en PDF) : stockés en base64 dans la
  table `documents`. Le bucket `documents` est prévu pour un upload Storage.
  Le PDF est produit par un **logiciel externe** : l'app ne génère ni devis ni
  facture chiffrée, elle les importe et les attache au dossier.
