# Climat Elec — Fiches d'intervention (V1)

Application web installable sur smartphone (PWA), fonctionnant **100 % hors ligne**.
Toutes les données (clients, interventions) sont stockées **localement sur l'appareil** via IndexedDB.

## Contenu du dossier

```
index.html         page principale
style.css           styles / charte graphique
app.js              logique de l'application (écrans, formulaires)
idb.js              couche de stockage IndexedDB
pdf.js               génération du PDF de fiche d'intervention
sw.js                service worker (mise en cache offline)
manifest.json        configuration PWA (icône, nom, couleurs)
icons/                icônes de l'application
vendor/jspdf.umd.min.js   librairie PDF embarquée (aucune dépendance internet)
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

### Tester en local sur ordinateur (avant déploiement)

Depuis ce dossier, avec Python déjà installé :

```bash
python3 -m http.server 8080
```

Puis ouvrir `http://localhost:8080` dans le navigateur (le mode PWA/offline fonctionne
aussi en `localhost`, c'est une exception acceptée par les navigateurs).

## Fonctionnement

- **Nouvelle intervention** : bouton `+` en bas à droite de l'écran d'accueil → parcours
  guidé en 5 étapes (Client → Intervention → Équipement/Demande → Action/Pièces → Devis/Signature).
- **Client existant** : commencer à taper le nom dans l'étape 1, une liste de
  suggestions apparaît automatiquement (auto-remplissage de la fiche).
- **PDF** : depuis le détail d'une fiche, bouton « Générer et partager le PDF ». Sur
  mobile, le menu de partage natif s'ouvre (email, WhatsApp, AirDrop…). Sur ordinateur,
  le PDF est téléchargé directement.
- **Sauvegarde manuelle** : icône ⬇ en haut à droite de l'écran d'accueil, exporte
  toutes les données (clients + interventions) en un fichier `.json`, à conserver en cas
  de changement de téléphone (la V1 n'a pas de synchronisation automatique — prévue en V2).

## Limites connues de cette V1 (volontaires, voir le PRD)

- 1 seul technicien / 1 seul appareil, données non synchronisées entre appareils.
- Pas de signature électronique tactile (nom saisi au clavier) — prévue en V2.
- Pas d'historique des équipements par client — prévu en V2.
- Envoi du PDF au client : manuel (pas d'email automatique).

## Mise à jour de l'application

Après toute modification des fichiers, incrémenter `CACHE_VERSION` dans `sw.js`
(ex. `climatelec-v2`) pour que les téléphones déjà installés récupèrent la nouvelle
version au prochain lancement avec réseau disponible.
