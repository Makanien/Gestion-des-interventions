# Climat Elec — Fiches d'intervention (V3)

Application web installable sur smartphone (PWA), fonctionnant **offline-first**.
Les données sont stockées **localement** (IndexedDB) et **synchronisées vers
Supabase** dès que la connexion est disponible (multi-utilisateur, comptes par
technicien).

La **V3** ajoute : prise de contact & planification (appel client, rendez-vous,
planning par technicien), fiches d'entretien dédiées (Air/Eau-Sol/Eau, Air/Air,
Chaudière bois + CERFA n°15497 + contrat d'entretien), workflow de dossier
(Brouillon → À valider → À facturer → Terminé), photos, mode brouillon,
numérotation des documents, base pièces et statistiques. Elle est complétée par
une couche **gouvernance et sécurité** : validation des comptes par le
responsable, journal d'audit, données locales protégées, outils RGPD.

## Contenu du dossier

```
index.html         page principale
style.css           styles / charte graphique
app.js              logique de l'application (écrans, formulaires)
idb.js              couche de stockage IndexedDB (locale, offline)
supabase.js         client Supabase (Auth, CRUD, Storage)
sync.js             synchronisation bidirectionnelle (pull/push)
signature.js        signature électronique tactile
pdf.js              génération du PDF de fiche d'intervention
config.js           URL + clé anon du projet Supabase (à renseigner) + infos de la page Confidentialité
sw.js               service worker (mise en cache offline)
manifest.json       configuration PWA (icône, nom, couleurs)
icons/              icônes de l'application
vendor/jspdf.umd.min.js   librairie PDF embarquée (offline)
vendor/supabase-js.min.js SDK Supabase embarqué (offline)
supabase/           schémas SQL + migrations + guide de déploiement backend
                    (+ sauvegarde, purge de conservation RGPD)
scripts/            build-dist.sh : copie de déploiement + en-têtes HTTP (_headers)
documentation/      sauvegarde, RGPD, procédures de test
```

## ⚠️ Important : une PWA a besoin d'être servie en HTTPS (ou en local)

Un navigateur n'installera l'application (icône sur l'écran d'accueil + fonctionnement
hors ligne) que si les fichiers sont servis via **HTTPS**, ou en local via `localhost`.
Ouvrir directement `index.html` depuis l'explorateur de fichiers (`file://...`) ne
permettra pas l'installation ni le mode hors ligne.

### Option la plus simple : héberger gratuitement en HTTPS

⚠️ **SEC-06** : commencer par construire le dossier restreint
`bash scripts/build-dist.sh`, puis ne déployer **que `dist/`**. Déployer le
dépôt entier exposerait la documentation interne, la maquette, le schéma SQL
et le PRD.

1. **Netlify Drop** (le plus rapide, sans compte) : aller sur https://app.netlify.com/drop
   et glisser-déposer **le dossier `dist/`** généré par `scripts/build-dist.sh`.
   Un lien HTTPS est généré immédiatement.
2. **GitHub Pages** : publier **le contenu de `dist/`** — sur un compte gratuit,
   Pages ne fonctionne que depuis un dépôt PUBLIC : créer un mini-dépôt public
   dédié (ex. `climatelec-site`) ne contenant que `dist/` (`git subtree push`
   ou copie manuelle), le dépôt du code source restant privé. Un dépôt privé + Pages
   exige GitHub Pro.
3. Toute autre solution d'hébergement statique HTTPS convient (Vercel, OVH, etc.),
   en ne servant que `dist/`.

Une fois le lien HTTPS obtenu, ouvre-le sur le smartphone du technicien avec Chrome
(Android) ou Safari (iPhone), puis :
- **Android / Chrome** : menu ⋮ → « Ajouter à l'écran d'accueil » (ou bandeau d'installation automatique).
- **iPhone / Safari** : bouton de partage → « Sur l'écran d'accueil ».

L'icône Climat Elec apparaît alors sur l'écran d'accueil, et l'application s'ouvre en
plein écran comme une application native, **même sans connexion** après la première ouverture.

## ⚙️ Configuration Supabase (V2/V3)

1. Renseigner `config.js` avec l'URL du projet et la clé anon/publishable.
2. Exécuter dans le SQL Editor : `supabase/schema.sql` — fichier maître unique
   (tables V2 + V3, RLS par rôle, Storage, Realtime), idempotent.
3. Voir `supabase/DEPLOYMENT.md` pour le détail complet (Auth, migration, signatures,
   **checklist des réglages du Dashboard** : inscription publique, Redirect URLs, SMTP, MFA).
4. Renseigner la page « Confidentialité » dans `config.js` (`PRIVACY_INFO` : exploitant,
   contact, durée de conservation) — les durées sont à valider (`documentation/RGPD_CONSERVATION.md`).

### Comptes et rôles

- Tout **nouveau compte** arrive avec le rôle **`en_attente`** : il n'accède à aucune
  donnée (écran « Compte en attente »). Le **responsable** lui attribue un rôle dans
  *Compte & synchro → Équipe & rôles* ; la personne appuie ensuite sur « Réessayer ».
- Rôles : `responsable` et `secretaire` (vue équipe, validation, facturation),
  `technicien` (son périmètre). Seul le responsable peut rouvrir un dossier terminé et
  changer les rôles. Le rôle `developpeur` n'est **pas** attribuable depuis l'application
  (création et retrait en SQL, voir `supabase/DEPLOYMENT.md`).
- Depuis le SQL Editor, modifier directement `public.profiles.role` ; la fonction
  `set_user_role` n'y est pas utilisable (aucune session).

### Déploiement (build)

```bash
bash scripts/build-dist.sh   # produit dist/ et dist/_headers (CSP, nosniff, HSTS…)
```

Le script lit l'hôte Supabase de production dans `config.js` et échoue s'il est
absent de la CSP de `index.html`. Les en-têtes `_headers` sont pris en charge par
Netlify ; sur un autre hébergeur, les reporter dans sa configuration (sans en-têtes,
seule la CSP `<meta>` s'applique).

### Tester en local sur ordinateur (avant déploiement)

Depuis ce dossier, avec Python déjà installé :

```bash
python3 -m http.server 3000
```

Puis ouvrir `http://localhost:3000` dans le navigateur (le mode PWA/offline fonctionne
aussi en `localhost`, c'est une exception acceptée par les navigateurs).

## Fonctionnement

- **Accueil** : onglets Tableau de bord / Planning / Tâches / Clients. Jérémy ne
  voit que son périmètre ; Régis et Delphine voient toute l'équipe.
- **Bouton `+`** (V3) : point d'entrée unique — nouvel appel, nouvelle
  intervention, entretien Air/Eau-Sol/Eau, Air/Air, Chaudière bois, contrat
  d'entretien annuel.
- **Nouvel appel** (V3) : enregistre le contexte d'un appel client, puis crée un
  rendez-vous, une intervention (pré-remplie) ou conserve la fiche sans planifier.
- **Nouvelle intervention** : parcours guidé (Client → Intervention → Équipement
  → Action/Pièces → Photos → Devis/Signature). Type resserré : Dépannage,
  Garantie, Diagnostic.
- **Fiches d'entretien dédiées** (V3) : mesures propres à chaque équipement,
  CERFA n°15497 sur une seule page (PAC), « Prochaine intervention prévue »
  (chaudière bois).
- **Client existant** : auto-remplissage depuis l'historique. **Pièces** : la
  désignation est auto-complétée depuis la base pièces.
- **Signature électronique** (V2) : signature tactile au doigt (client + technicien).
- **Workflow de dossier** (4 statuts — 13/10/2026) : Brouillon → À valider →
  À facturer → Terminé ; le devis peut être joint en PDF, la facture reste dans le
  logiciel externe. Renvoi en brouillon (motif libre), réouverture d'un dossier terminé
  (responsable seul) et retour « À facturer → À valider » (motif obligatoire). Les
  transitions sont imposées par le serveur et **journalisées** : la fiche affiche son
  « Historique du dossier » (en ligne).
- **Numérotation** (V3) : référence unique `FIC-AAAA-NNN` / `ENT-AAAA-NNN`.
- **Mode brouillon** (V3) : enregistre une fiche non terminée pour la reprendre.
- **Duplication** (V3) : bouton « Dupliquer » sur le détail (utile pour les
  entretiens annuels récurrents).
- **Statistiques** (V3) : interventions/mois, par type, par technicien, par statut.
- **Synchronisation** (V2/V3) : offline-first, données partagées entre appareils.
- **PDF** : depuis le détail d'une fiche, « Générer et partager le PDF » (email,
  WhatsApp, AirDrop… via le partage natif). Le PDF reprend les mesures, photos et
  le CERFA.
- **Sauvegarde manuelle** : icône ⬇ (ou écran « Compte & synchro »), exporte
  toutes les données en un fichier `.json`.

## Données sur l'appareil et confidentialité

- Les données sont copiées **en clair** dans IndexedDB pour le hors-ligne :
  **activez le verrouillage de l'écran** du téléphone.
- Les données locales appartiennent à **un seul compte** : un autre compte qui se
  connecte sur l'appareil n'en hérite pas (purge si rien n'est en attente, sinon
  connexion refusée jusqu'à la synchronisation).
- **Déconnexion** : option « Effacer les données de cet appareil » (*Compte & synchro*),
  activée par défaut pour les managers. L'application tente d'abord de synchroniser et
  prévient si des éléments ne sont pas encore envoyés (ils seraient perdus).
- **Rôle inconnu = aucun accès** : si le profil ne peut pas être chargé, l'application
  n'affiche pas les données ; hors ligne, elle utilise le dernier rôle connu (30 jours).
- **RGPD** : page « Confidentialité » (Compte) ; outils du responsable pour purger les
  données supprimées depuis longtemps, exporter ou anonymiser un client
  (`documentation/RGPD_CONSERVATION.md`). Aucune durée de conservation n'est fixée par
  défaut : décision de l'exploitant.

## Mise à jour de l'application

Après toute modification des fichiers, incrémenter `CACHE_VERSION` dans `sw.js`
(ex. `climatelec-v6`) pour que les téléphones déjà installés récupèrent la nouvelle
version au prochain lancement avec réseau disponible. Un mécanisme `updatefound`
dans `app.js` recharge la page dès qu'une nouvelle version du service worker est
installée, **sauf pendant la saisie d'un formulaire** : un bandeau « Actualiser » est
alors proposé. Si une ancienne version persiste, recharger deux fois ou vider les
données du site.
