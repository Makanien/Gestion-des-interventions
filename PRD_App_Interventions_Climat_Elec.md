# PRD — Application de gestion des fiches d'intervention
## Climat Elec (Chazé-sur-Argos)

**Version du document :** 1.2
**Date :** 10/08/2026
**Auteur :** Rédigé avec Claude, sur la base des échanges avec le porteur de projet

---

## 1. Contexte et objectifs

Climat Elec est une entreprise artisanale spécialisée en géothermie, climatisation, pompe à chaleur et chaudière bois/granulés, basée à Chazé-sur-Argos (49). Aujourd'hui, les fiches d'intervention sont remplies **au format papier** sur le terrain (voir modèle fourni), avec ressaisie manuelle ensuite.

### Objectifs du projet
- Remplacer la fiche papier par une application **utilisable sur smartphone, y compris sans connexion internet** (intervention en sous-sol, zone rurale mal couverte, etc.).
- Réduire le temps de saisie grâce à une **base clients réutilisable** (auto-remplissage à partir de l'historique).
- Générer une **fiche PDF fidèle au document actuel**, exportable et envoyable manuellement au client.
- Préparer, sans repartir de zéro, une **évolution vers un usage à 2 techniciens avec données synchronisées**.

### Non-objectifs (explicitement hors périmètre pour l'instant)
- Facturation / devis chiffrés (le champ "le client souhaite-t-il un devis" reste une simple case à cocher, sans génération de devis).
- Envoi automatique d'email au client (prévu manuel dans un premier temps).
- Gestion de stock de pièces détachées.
- Planning / prise de rendez-vous.

---

## 2. Utilisateurs cibles

| Profil | Description | Besoin principal |
|---|---|---|
| Technicien terrain | Utilise l'appli sur son téléphone pendant l'intervention, souvent sans réseau | Saisie rapide, fiable, hors ligne |
| Gérant (à terme, 2ᵉ utilisateur) | Peut aussi intervenir sur le terrain ou consulter l'historique | Vue sur l'ensemble des interventions de l'équipe |
| Client final | Reçoit la fiche | Reçoit un PDF clair et professionnel (envoi manuel par le technicien) |

---

## 3. Découpage en versions

### V1 — MVP (cible immédiate)
- **1 seul technicien**, usage mono-appareil.
- **100 % hors ligne** : HTML/CSS/JS + `localStorage`, packagé en PWA installable sur l'écran d'accueil du téléphone.
- Base clients locale, réutilisable (auto-remplissage).
- Génération de PDF de la fiche, à la fin de l'intervention, **partage/export manuel** (WhatsApp, email, AirDrop… via le partage natif du téléphone).
- Pas de signature électronique (juste nom du technicien / nom du client en texte, comme aujourd'hui potentiellement à la main sur le PDF imprimé si besoin).
- Architecture pensée dès le départ pour permettre une migration V2 sans réécriture (voir §7).

### V2 — Multi-utilisateur synchronisé
- 2 techniciens (extensible), chacun avec son compte.
- Synchronisation des données via **Supabase** (Postgres + Auth + Realtime).
- Fonctionnement toujours **offline-first** : saisie possible sans réseau, synchronisation automatique dès que la connexion revient.
- Ajout de la **signature électronique** tactile (client + technicien) sur la fiche.
- Historique des équipements par client (équipement déjà installé, réutilisable à chaque nouvelle visite).

### V3 et au-delà (pistes, non détaillées ici)
- Envoi automatique du PDF par email au client.
- Statistiques (nombre d'interventions/mois, types d'équipements les plus fréquents...).
- Génération de devis simples.

---

## 4. Parcours utilisateur (V1)

1. **Accueil** : liste des interventions récentes + bouton "Nouvelle intervention".
2. **Sélection ou création du client** :
   - Recherche dans la base clients existante (nom, ville) → auto-remplissage nom/adresse/CP/ville/mail/tél/type de bâtiment.
   - Ou création d'une nouvelle fiche client si premier passage.
3. **Saisie de l'intervention** :
   - Type d'intervention, date (pré-remplie à aujourd'hui), heure d'arrivée/départ (calcul auto du temps d'intervention), forfait déplacement (oui/non).
   - Statut : "Intervention terminée avec succès" / "Nouvelle intervention à prévoir".
4. **Équipement(s)** : 1 à 3 lignes (intitulé, marque, modèle, N° série) — saisie libre en V1 (pas encore d'historique par client, cf. §3 V2).
5. **Descriptif de la demande** (texte libre).
6. **Action réalisée** (texte libre).
7. **Pièces utilisées** : lignes dynamiques (désignation, référence, quantité) — ajout/suppression de lignes à la volée.
8. **Devis souhaité ?** : case à cocher + zone de commentaire libre.
9. **Signatures** : nom technicien (pré-rempli si un seul technicien) + nom client, avec case "présent/absent" (signature tactile reportée en V2).
10. **Validation** → génération automatique du PDF reprenant la mise en page actuelle + sauvegarde locale de la fiche.
11. **Partage** du PDF via le menu de partage natif du téléphone (aucun envoi automatique).

---

## 5. Modèle de données (V1, `localStorage`)

Stocké en local sous forme de collections JSON, avec identifiants uniques (UUID) pour faciliter la synchronisation en V2.

```
Client {
  id: uuid
  nom, adresse, code_postal, ville, mail, tel
  type_batiment
  created_at, updated_at
}

Intervention {
  id: uuid
  client_id: uuid (référence)
  type_intervention
  date
  heure_arrivee, heure_depart
  forfait_deplacement: bool
  temps_intervention (calculé)
  statut: "terminee" | "a_prevoir"
  descriptif_demande: text
  action_realisee: text
  devis_souhaite: bool
  devis_commentaire: text
  technicien_nom
  client_present: bool
  client_signature_nom (V1 = texte, V2 = image signature)
  created_at, updated_at, synced_at (V2)
}

Equipement {
  id: uuid
  intervention_id: uuid
  intitule, marque, modele, numero_serie
}

PieceUtilisee {
  id: uuid
  intervention_id: uuid
  designation, reference, quantite
}
```

> Le champ `synced_at` est prévu dès la V1 (même s'il reste toujours `null`) pour ne pas avoir à modifier le schéma lors du passage à Supabase.

---

## 6. Architecture technique

### 6.1 V1 — PWA autonome
- **Frontend** : HTML/CSS/JS natif (pas de framework lourd, pour rester léger et rapide à charger).
- **Stockage** : `IndexedDB` (choisi dès la V1 pour anticiper la migration vers Supabase en V2 et gérer plus de marge si des photos sont ajoutées plus tard).
- **PWA** :
  - `manifest.json` (icône, nom, couleurs aux couleurs de Climat Elec, mode standalone).
  - `service worker` pour mise en cache des assets (HTML/CSS/JS/logo) → fonctionnement 100 % hors ligne, y compris au premier lancement après installation.
  - Mise à jour automatique des clients installés via `updatefound` + `skipWaiting()` + `clients.claim()`, avec incrémentation manuelle de `CACHE_VERSION` dans `sw.js` à chaque déploiement.
  - Installable sur l'écran d'accueil (Android et iOS).
- **Génération PDF** : librairie JS côté client (ex. jsPDF ou équivalent), pas besoin de serveur.

### 6.2 V2 — Synchronisation multi-utilisateur (Supabase)
- **Backend** : Supabase (Postgres managé + Auth + Realtime + Storage pour d'éventuelles photos).
- **Authentification** : compte par technicien (email/mot de passe ou lien magique).
- **Stratégie offline-first** :
  - Toutes les écritures se font d'abord en local (IndexedDB).
  - Une file de synchronisation envoie les changements à Supabase dès que le réseau est disponible.
  - Gestion simple des conflits (dernière écriture gagne, avec horodatage `updated_at`) — suffisant vu le volume attendu (2 techniciens, peu de risque de modification simultanée de la même fiche).
- **Migration V1 → V2** : script d'import des données `localStorage`/IndexedDB existantes vers Supabase, pour ne rien perdre de l'historique déjà saisi.

---

## 7. Design / charte graphique

À reprendre du site institutionnel et de la fiche papier actuelle :
- **Logo** Climat Elec (dégradé bleu/orange caractéristique) en en-tête.
- **Palette** : bleu-gris foncé pour les textes/titres, touches orangées pour les accents (boutons, statuts), fond clair.
- **Typographie** : sobre, lisible en extérieur / plein soleil (contrastes marqués, tailles de police généreuses pour un usage tactile sur chantier).
- **Mise en page du PDF exporté** : reprendre fidèlement la structure de la fiche actuelle (sections Client / Intervention / Équipement / Descriptif / Action réalisée / Pièces utilisées / Signatures) pour que les clients retrouvent un document familier.

---

## 8. Exigences non-fonctionnelles

| Exigence | Détail |
|---|---|
| Fonctionnement hors ligne | Obligatoire dès la V1, y compris pour créer une fiche client et générer le PDF |
| Compatibilité | Smartphone Android et iOS (PWA installable), utilisation au doigt sans zoom nécessaire |
| Performance | Chargement quasi instantané (assets mis en cache), pas de dépendance réseau pour l'usage courant |
| Sécurité / RGPD | Données clients (nom, adresse, mail, tél) stockées localement en V1 ; en V2, hébergement Supabase avec accès restreint aux comptes techniciens ; prévoir une mention de confidentialité simple |
| Sauvegarde | En V1, les données ne vivent que sur l'appareil : à prévoir un export/sauvegarde manuel (ex. bouton "exporter toutes les données" en JSON) pour éviter une perte totale en cas de changement de téléphone, en attendant la V2 |
| Accessibilité | Boutons larges, formulaires en plusieurs étapes plutôt qu'un long formulaire unique, pour limiter les erreurs de saisie sur petit écran |

---

## 9. Roadmap proposée

| Étape | Contenu | Statut |
|---|---|---|
| 1. Cadrage | Ce PRD | En cours |
| 2. Maquette / prototype V1 | Écrans principaux (liste, fiche client, fiche intervention, export PDF) | À faire |
| 3. Développement V1 | PWA complète, testée hors ligne sur téléphone réel | À faire |
| 4. Mise en usage réel | Tests terrain par le technicien, ajustements | À faire |
| 5. Développement V2 | Intégration Supabase, comptes, synchronisation, signature électronique | Plus tard |
| 6. Historique équipements par client | Ajout à la fiche équipement | V2 |

> Le contenu détaillé des versions V2/V3 ci-dessus reste indicatif : le backlog de user stories du **§10** couvre un périmètre plus large (RDV, validation, devis, facturation) et devra être arbitré pour préciser ce que ces étapes contiennent réellement.

---

## 10. Backlog de user stories — pistes d'évolution possibles

> **⚠️ Statut : propositions non arbitrées.** Les user stories ci-dessous sont issues de la modélisation complète du processus métier (appel client → RDV → fiche terrain → validation → devis → facturation → envoi), réalisée avec les 3 personnes concernées (Régis, Jérémy, Delphine). **Elles ne constituent pas un engagement de développement** : il s'agit d'un inventaire des évolutions envisageables, à arbitrer et prioriser collectivement pour construire le contenu de la prochaine version. Aucune de ces stories n'est donc à considérer comme actée tant qu'elle n'a pas été explicitement sélectionnée.

Légende de couverture :
- 🟢 **Déjà couvert** par l'application V1 (prototype PWA existant)
- ⚪ **Piste d'évolution** (non développée, à arbitrer)

### Épopée 1 — Prise de contact & planification
*Acteur principal : Régis (Responsable)*

| ID | User story | Statut |
|---|---|---|
| US-01 | En tant que responsable, je veux enregistrer les informations d'un client qui appelle, afin de disposer de son contexte avant l'intervention. | ⚪ |
| US-02 | En tant que responsable, je veux créer un rendez-vous pour le technicien, afin de planifier son passage chez le client. | ⚪ |
| US-14 | En tant que responsable, je veux que ce rendez-vous soit synchronisé avec Google Agenda, afin de ne pas gérer deux calendriers en parallèle. | ⚪ |

### Épopée 2 — Intervention terrain
*Acteur principal : Jérémy (Technicien)*

| ID | User story | Statut |
|---|---|---|
| US-03 | En tant que technicien, je veux créer une fiche d'intervention chez le client, afin de documenter la demande et l'action réalisée. | 🟢 |
| US-04 | En tant que technicien, je veux faire signer la fiche par le client à la fin de l'intervention, afin de valider formellement la prestation réalisée. *(V1 : nom saisi au clavier ; signature tactile = US candidate V2, cf. §3)* | 🟢 |

### Épopée 3 — Validation & devis
*Acteur principal : Régis (Responsable)*

| ID | User story | Statut |
|---|---|---|
| US-05 | En tant que responsable, je veux recevoir et valider chaque fiche d'intervention terminée, afin de m'assurer qu'elle est complète et correcte avant de lancer la facturation. | ⚪ |
| US-06 | En tant que responsable, je veux indiquer si l'intervention nécessite en plus un devis pour des travaux complémentaires, afin de déclencher sa réalisation **sans jamais bloquer la facturation de l'intervention elle-même**. | ⚪ |
| US-07 | En tant que responsable, je veux réaliser un devis pour les travaux complémentaires identifiés, afin de le transmettre au client indépendamment de la facturation de l'intervention en cours. | ⚪ |
| US-08 | En tant que responsable, je veux que toute fiche validée parte automatiquement vers la facturation, qu'un devis complémentaire soit généré ou non en parallèle, afin qu'aucune intervention réalisée ne reste facturée en retard à cause d'un devis en attente. | ⚪ |

> *Rappel important issu de la modélisation : facturation de l'intervention et devis complémentaire sont deux actions **parallèles**, pas deux chemins exclusifs — la facturation ne doit jamais être conditionnée à la présence ou non d'un devis.*

### Épopée 4 — Facturation
*Acteurs : Delphine (Secrétaire) & Régis (Responsable)*

| ID | User story | Statut |
|---|---|---|
| US-09 | En tant que secrétaire, je veux créer une facture à partir d'une fiche marquée "à facturer", afin de générer le document à transmettre au client. | ⚪ |
| US-10 | En tant que responsable, je veux vérifier une facture avant son envoi, afin de m'assurer qu'elle correspond bien à l'intervention réalisée. | ⚪ |
| US-11 | En tant que responsable, je veux fusionner la facture vérifiée avec la fiche d'intervention correspondante, afin de constituer le dossier final complet à envoyer. | ⚪ |

### Épopée 5 — Envoi & clôture
*Acteur principal : Delphine (Secrétaire)*

| ID | User story | Statut |
|---|---|---|
| US-12 | En tant que secrétaire, je veux envoyer la facture accompagnée de la fiche d'intervention au client, afin de clôturer le dossier. | ⚪ |

### Transverses — Statuts & outils
*Tous acteurs*

| ID | User story | Statut |
|---|---|---|
| US-13 | En tant qu'utilisateur (Régis, Delphine ou Jérémy), je veux voir en un coup d'œil le statut d'un dossier (terminée / à facturer / à vérifier / à envoyer), afin de savoir qui doit agir ensuite sans avoir à demander aux autres. | ⚪ |
| US-15 | En tant qu'utilisateur, je veux que les documents (fiches, devis, factures) soient classés automatiquement selon leur statut, afin de remplacer le classement manuel actuel par dossiers sur OneDrive. | ⚪ |

### Récapitulatif de couverture

| Épopée | Nb. stories | Couvertes par l'appli V1 |
|---|---|---|
| 1. Prise de contact & planification | 3 | 0 / 3 |
| 2. Intervention terrain | 2 | 2 / 2 |
| 3. Validation & devis | 4 | 0 / 4 |
| 4. Facturation | 3 | 0 / 3 |
| 5. Envoi & clôture | 1 | 0 / 1 |
| Transverses | 2 | 0 / 2 |
| **Total** | **15** | **2 / 15** |

**Prochaine étape :** ce backlog doit être revu et arbitré (par exemple par un vote de priorisation ou une session de cadrage dédiée) pour sélectionner une ou plusieurs stories à intégrer au contenu de la prochaine version développée. Le détail complet (schéma du processus, vue visuelle) est disponible dans les documents `Modelisation_interventions_Climat_elec.drawio` et `User_Stories_Climat_Elec.md`.

---

## 11. Points ouverts / à trancher plus tard

- Faut-il prévoir des **photos** (avant/après intervention, plaque signalétique de l'équipement) ? Cela impacterait le choix de stockage (IndexedDB/Storage) dès la V1.
- Faut-il un **mode "brouillon"** permettant de reprendre une fiche non terminée plus tard (coupure d'intervention) ?
- Le champ "Type de Bâtiment" de la fiche actuelle : liste fermée (maison/appartement/local commercial...) ou texte libre ?
- Faut-il conserver un **compteur/numérotation** des fiches d'intervention (référence unique visible sur le PDF) ?
- **Nouveau (issu du backlog §10) :** parmi les 13 stories non couvertes, lesquelles prioriser pour la prochaine version ? Le périmètre couvre potentiellement plusieurs outils déjà en place (Google Agenda, OneDrive) — faut-il les remplacer ou s'y interfacer ?

---

## 12. Critères de succès

- Le technicien peut créer et finaliser une fiche complète **sans aucune connexion réseau**, du début à la fin.
- Le temps de saisie d'une intervention pour un client déjà connu est **réduit d'au moins 50 %** grâce à l'auto-remplissage.
- Le PDF généré est visuellement fidèle à la fiche papier actuelle.
- Aucune perte de données lors du passage de la V1 (local) à la V2 (Supabase).