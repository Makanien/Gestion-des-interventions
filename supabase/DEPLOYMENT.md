# Déploiement Supabase (V2) — Climat Elec

Ce document décrit la mise en place du backend Supabase nécessire pour la V2
(multi-utilisateur synchronisé).

## 1. Prérequis

- Un projet Supabase actif (déjà connecté à votre compte GitHub).
- Le dépôt déployé sur la branche `synchro-supabase`.

## 2. Exécuter le schéma SQL

Dans le **Dashboard Supabase** (`https://supabase.com/dashboard`), ouvrez votre
projet, puis **SQL Editor → New query**. Collez et exécutez, **dans cet ordre** :

1. `supabase/schema.sql` — crée les tables, les RLS, les triggers et le Realtime.
2. `supabase/storage.sql` — crée le bucket `signatures` et ses politiques.

Ces scripts sont **idempotents** (on peut les relancer sans risque).

### Ce que fait le schéma

| Objet | Rôle |
|---|---|
| `clients`, `interventions`, `equipements`, `pieces_utilisees` | Données métier (id UUID, `updated_at`, `deleted_at`) |
| `profiles` | Nom affiché du technicien (`full_name`) |
| Triggers `set_updated_at` | Mise à jour automatique du timestamp |
| Trigger `handle_new_user` | Création auto du profil à l'inscription |
| RLS | Accès restreint aux utilisateurs `authenticated` (aucune donnée publique) |
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
- Vérifiez **Site URL** et **Redirect URLs** : ajoutez l'URL de déploiement
  (ex. `https://votre-app.netlify.app` et `http://localhost:8080` pour les tests).
- Le lien magique doit renvoyer vers l'app (le SDK utilise `emailRedirectTo`).

Créez les comptes techniciens via **Authentication → Users → Add user**.

## 5. Déploiement du frontend

Déployez le dossier (Netlify, GitHub Pages, Vercel…) comme pour la V1.
Le service worker (`sw.js`) embarque désormais le SDK Supabase en cache
(`vendor/supabase-js.min.js`) : l'app reste **offline-first** après la première
ouverture, et la synchronisation s'effectue automatiquement dès que le réseau
revient.

## 6. Migration V1 → V2

Les données V1 (IndexedDB) existantes sont conservées telles quelles :
- Au premier lancement de la V2, `idb.js` migre le schéma IndexedDB
  (version 2) sans perdre les clients/interventions déjà saisis.
- Après connexion à un compte, lancez **Compte & synchro → Synchroniser
  maintenant** : les données locales sont poussées vers Supabase.

## 7. Signature électronique

Les signatures tactiles sont :
1. Capturées sur le téléphone (canvas → PNG) ;
2. Stockées localement (dataURL) pour rester visibles hors ligne ;
3. Envoyées vers le bucket Storage `signatures` dès que le réseau est
   disponible (l'URL publique est alors enregistrée sur l'intervention) ;
4. Rendu dans le PDF généré et dans le détail de la fiche.
