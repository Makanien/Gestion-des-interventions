# Climat Elec — Fiches d'intervention (V3)

Application web installable sur smartphone (PWA), fonctionnant **offline-first**.
Les données sont stockées **localement** (IndexedDB) et **synchronisées vers
Supabase** dès que la connexion est disponible (multi-utilisateur, comptes par
technicien).

La **V3** ajoute : prise de contact & planification (appel client, rendez-vous,
planning par technicien), fiches d'entretien dédiées (Air/Eau-Sol/Eau, Air/Air,
Chaudière bois + CERFA n°15497 + contrat d'entretien), workflow de dossier
(validation → facturation avec import PDF du devis/facture), photos, mode
brouillon, numérotation des documents, base pièces et statistiques.

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
config.js           URL + clé anon du projet Supabase (à renseigner)
sw.js               service worker (mise en cache offline)
manifest.json       configuration PWA (icône, nom, couleurs)
icons/              icônes de l'application
vendor/jspdf.umd.min.js   librairie PDF embarquée (offline)
vendor/supabase-js.min.js SDK Supabase embarqué (offline)
supabase/           schémas SQL + migrations + guide de déploiement backend
```

## ⚠️ Important : une PWA a besoin d'être servie en HTTPS (ou en local)

Un navigateur n'installera l'application (icône sur l'écran d'accueil + fonctionnement
hors ligne) que si les fichiers sont servis via **HTTPS**, ou en local via `localhost`.
Ouvrir directement `index.html` depuis l'explorateur de fichiers (`file://...`) ne
permettra pas l'installation ni le mode hors ligne.

### Option la plus simple : héberger gratuitement en HTTPS

1. **Netlify Drop** (le plus rapide, sans compte) : aller sur https://app.netlify.com/drop
   et glisser-déposer ce dossier entier. Un lien HTTPS est généré immédiatement.
2. **GitHub Pages** : créer un dépôt, y pousser ce dossier, activer "Pages" dans les
   paramètres du dépôt (branche principale, dossier racine).
3. Toute autre solution d'hébergement statique HTTPS convient (Vercel, OVH, etc.).

Une fois le lien HTTPS obtenu, ouvre-le sur le smartphone du technicien avec Chrome
(Android) ou Safari (iPhone), puis :
- **Android / Chrome** : menu ⋮ → « Ajouter à l'écran d'accueil » (ou bandeau d'installation automatique).
- **iPhone / Safari** : bouton de partage → « Sur l'écran d'accueil ».

L'icône Climat Elec apparaît alors sur l'écran d'accueil, et l'application s'ouvre en
plein écran comme une application native, **même sans connexion** après la première ouverture.

## ⚙️ Configuration Supabase (V2/V3)

1. Renseigner `config.js` avec l'URL du projet et la clé anon/publishable.
2. Exécuter dans le SQL Editor, **dans cet ordre** :
   - `supabase/schema.sql`
   - `supabase/storage.sql`
   - `supabase/migrations/001_roles_rls.sql`
   - `supabase/migrations/002_v3.sql` (nouvelles tables V3)
3. Voir `supabase/DEPLOYMENT.md` pour le détail complet (Auth, migration, signatures).

### Tester en local sur ordinateur (avant déploiement)

Depuis ce dossier, avec Python déjà installé :

```bash
python3 -m http.server 8080
```

Puis ouvrir `http://localhost:8080` dans le navigateur (le mode PWA/offline fonctionne
aussi en `localhost`, c'est une exception acceptée par les navigateurs).

## Fonctionnement

- **Accueil = Planning** (V3) : onglets Planning / Tâches / Dossiers. Jérémy ne
  voit que son planning ; Régis et Delphine voient toute l'équipe.
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
- **Workflow de dossier** (V3) : Brouillon → À valider → Validée → À facturer →
  Facture importée → À vérifier → Vérifiée → À envoyer → Clôturée. Le devis et la
  facture (produits par un logiciel externe) sont **importés en PDF** et attachés
  au dossier.
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

## Mise à jour de l'application

Après toute modification des fichiers, incrémenter `CACHE_VERSION` dans `sw.js`
(ex. `climatelec-v6`) pour que les téléphones déjà installés récupèrent la nouvelle
version au prochain lancement avec réseau disponible. Un mécanisme `updatefound`
dans `app.js` recharge automatiquement la page dès qu'une nouvelle version du
service worker est détectée et installée.
