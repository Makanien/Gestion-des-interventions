# PRD — Application de gestion des fiches d'intervention
## Climat Elec (Chazé-sur-Argos)

**Version du document :** 1.10
**Date :** 19/08/2026
**Auteur :** Rédigé avec Claude, sur la base des échanges avec le porteur de projet

---

## 1. Contexte et objectifs

Climat Elec est une entreprise artisanale spécialisée en géothermie, climatisation, pompe à chaleur et chaudière bois/granulés, basée à Chazé-sur-Argos (49). Aujourd'hui, les fiches d'intervention sont remplies **au format papier** sur le terrain (voir modèle fourni), avec ressaisie manuelle ensuite.

### Objectifs du projet
- Remplacer la fiche papier par une application **utilisable sur smartphone, y compris sans connexion internet** (intervention en sous-sol, zone rurale mal couverte, etc.).
- Réduire le temps de saisie grâce à une **base clients réutilisable** (auto-remplissage à partir de l'historique).
- Générer une **fiche PDF fidèle au document actuel**, exportable et envoyable manuellement au client.
- Préparer, sans repartir de zéro, une **évolution vers un usage à 2 techniciens avec données synchronisées**.
- **(Nouveau — 16/08/2026)** Couvrir la **prise de contact et la planification** (appel client, création de rendez-vous, planning par technicien) avec synchronisation Google Agenda — objectif confirmé par le client, mais dont le contenu précis et la date d'intégration restent à définir (voir §3.2). Ceci lève le non-objectif "Planning / prise de rendez-vous" de la version précédente du PRD.

### Non-objectifs (explicitement hors périmètre)
- Génération de devis / factures : réalisée par un **logiciel externe**. L'application ne fait qu'**importer le PDF** produit et l'attacher au dossier (cf. §3.3). La case « devis souhaité » reste une simple indication.
- Envoi automatique d'email au client : reporté — l'envoi reste manuel via le partage natif du téléphone.
- Synchronisation Google Agenda : reportée — fonctionnement à clarifier (cf. §11).
- Gestion de stock de pièces détachées : seule une base « désignation » de pièces est prévue (cf. §3.3).

---

## 2. Utilisateurs cibles

| Profil | Description | Besoin principal |
|---|---|---|
| Technicien terrain (Jérémy) | Utilise l'appli sur son téléphone pendant l'intervention, souvent sans réseau | Saisie rapide, fiable, hors ligne ; ne voit que son propre planning et ses propres tâches |
| Responsable (Régis) | Intervient aussi sur le terrain, mais a aussi besoin d'une vue globale | Vue sur l'ensemble des interventions et du planning de toute l'équipe, avec filtres |
| **(Nouveau) Secrétaire (Delphine)** | Gère la partie administrative et la facturation | Compte utilisateur à part entière ; valide la génération des factures ; vue équipe comme Régis |
| Client final | Reçoit la fiche | Reçoit un PDF clair et professionnel (envoi manuel par le technicien) |

> **Terminologie des rôles (Supabase / RLS) :** les trois comptes internes correspondent à l'enum `profiles.role` — `responsable` (Régis), `technicien` (Jérémy), `secretaire` (Delphine). Le **responsable** et la **secrétaire** voient toute l'équipe (`is_manager()`), le **technicien** ne voit que ses propres interventions et son planning. Voir `supabase/migrations/001_roles_rls.sql`.

---

## 3. Découpage en versions

> **État d'implémentation (19/08/2026) :** La **V1 (MVP)** et la **V2** sont **implémentées et mergées** (branche `synchro-supabase` fusionnée dans `dev`). La **V3** est désormais **spécifiée et arbitrée** (cf. **§3.3**) ; son développement n'est pas commencé. Le détail de ce qui est réellement livré figure au **§3.1** (V2) et au **§3.3** (V3).

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

### V3 — Définition (arbitrée)
Le contenu de la V3, arbitré le 19/08/2026, est détaillé au **§3.3**. En résumé : prise de contact & planification (sans Google Agenda), fiches d'entretien dédiées + CERFA + contrat d'entretien, workflow validation/facturation avec **import PDF** (le devis/facture reste produit par un logiciel externe), statistiques, mode brouillon et numérotation des documents.

### Au-delà de V3 (reporté, non planifié)
- Synchronisation Google Agenda (US-14) — fonctionnement à clarifier (cf. §11).
- Envoi automatique du PDF par email au client — envoi manuel conservé pour l'instant.

---

## 3.1 Liste des modifications livrées (V2 — branche `synchro-supabase`, mergée)

Récapitulatif des changements fonctionnels et techniques effectivement développés, correspondant au passage de la V1 (prototype PWA monoposte) vers la V2 (multi-utilisateur synchronisé + signatures électroniques).

### Authentification & compte utilisateur
- **Connexion par lien magique** (email OTP) ou **email + mot de passe** (écran `#/login`).
- **Restoration de session** au chargement + écoute des changements d'auth (`onAuthStateChange`).
- **Bouton de connexion dans la barre de titre** : icône utilisateur (`👤`) quand déconnecté, icône utilisateur **avec coche** (`👤✓`) quand connecté — remplace l'icône unique indifférenciée.
- **Nom de l'utilisateur connecté affiché dans la barre de titre** à la place de « Climat Elec » : priorité `full_name` (profil), sinon e-mail, sinon « Mon compte » ; « Climat Elec » reste affiché quand personne n'est connecté.
- **Écran « Compte & synchro »** (`#/account`) : affichage du profil, édition du **nom affiché** (`full_name`), bouton de connexion/déconnexion, état de la synchronisation, export des données locales.

### Synchronisation multi-appareil (Supabase)
- **Offline-first** : écriture locale en premier (IndexedDB), puis **file de synchronisation** vers Supabase.
- **`pushAllLocal`** : envoi de l'ensemble des données locales en attente **à la connexion** (sign-in).
- **Soft-delete** propagé via `deleted_at` au lieu d'une suppression définitive.
- **Realtime** : publication des tables `clients`, `interventions`, `equipements`, `pieces_utilisees` (idempotente).
- **Nettoyage des champs locaux** avant upsert (les champs purement locaux ne sont pas envoyés à Supabase).
- **Schéma BDD Supabase** (`supabase/schema.sql`) : tables `clients`, `interventions`, `equipements`, `pieces_utilisees`, `profiles` ; triggers `updated_at` ; RLS + GRANT pour le rôle `authenticated` ; création automatique du profil à l'inscription (`handle_new_user`).
- **Migration V1 → V2** : éclatement des `equipements` et `pieces` imbriquées (auparavant stockées dans l'objet intervention) en tables séparées ; ajout de la colonne `intervention_id` sur `equipements`.

### Signatures électroniques (V2)
- **Signature tactile** client et technicien (modale de dessin) générant une image.
- **Upload des signatures vers Supabase Storage** (bucket `signatures`) + URL publique stockée sur la fiche.
- Fallback local (dataURL) si hors ligne ou si le storage n'est pas configuré.

### Divers / technique
- **PWA** : mécanisme de mise à jour du service worker (`updatefound`).
- **Bandeau temporaire** de navigation vers les maquettes (à retirer après validation client).
- Toutes les icônes et styles associés sont dans `style.css` (`--ce-*` design tokens).

---

## 3.2 Nouvelles demandes client — Planning, appel, entretiens dédiés (16/08/2026)

> **Statut : arbitrées le 19/08/2026 → intégrées en V3.** Les éléments ci-dessous documentent les demandes du client (échange du 16/08/2026, fichier Excel `Application.xlsx` + fiches papier d'entretien fournies). Elles sont désormais **intégrées à la V3** (cf. **§3.3**), **à l'exception** de la synchronisation Google Agenda (§3.2.3) qui est **reportée** (fonctionnement à clarifier, cf. §11) et de l'envoi automatique d'email qui reste manuel.

### 3.2.1 Compte utilisateur Delphine — US-16
Delphine (secrétaire) aura un **compte utilisateur à part entière**, au même titre que Régis et Jérémy. Elle gère la partie administrative et la facturation, et doit pouvoir **valider la génération des factures**. Côté visualisation (planning, accueil), elle a les mêmes droits que Régis : vue sur toute l'équipe.

### 3.2.2 Écran d'accueil = Planning — US-17
L'écran d'accueil de l'application devient le **planning journalier**, avec une ligne par intervenant/type :
- **Jérémy** : ne voit que **son propre planning**, triable par type d'intervention (Dépannage, Entretien).
- **Régis et Delphine** : voient le planning de **toute l'équipe**, triable par intervenant ou par type d'intervention (Dépannage, Entretien, Rdv devis).

À côté du planning, un écran **"Accueil" (liste des tâches)** reprend la logique de l'épopée 2 (US-03 · US-04) :
- **Jérémy** : ne voit que ses propres lignes ; tri par type (Dépannage, Entretien, Garantie).
- **Régis et Delphine** : voient toutes les lignes ; tri par intervenant ou par type (Dépannage, Entretien, Garantie).
- Dans les deux cas, si possible, les tâches déjà réalisées sont masquées par défaut mais restent accessibles via le tri/filtre (ne pas les supprimer de la liste, juste les sortir de la vue par défaut).

### 3.2.3 Synchronisation Google Agenda (bidirectionnelle) — US-14
Demande confirmée par le client mais **reportée hors V3** (le fonctionnement souhaité — calendrier unique vs par technicien, source de vérité, conflits — reste à clarifier, cf. §11). Correspond à l'US-14 du backlog §10 :
- Un rendez-vous créé dans l'application doit apparaître dans Google Agenda.
- Un événement créé dans Google Agenda (formation, congé…) doit apparaître dans le planning de l'application.
- Le mapping des champs, la gestion des conflits d'édition et le sens de la source de vérité restent à définir lors du cadrage détaillé de cette fonctionnalité.

### 3.2.4 Bouton "+" — point d'entrée unique de création — US-18
Un bouton d'action flottant propose la création de :
1. Nouvel appel
2. Nouvelle intervention
3. Nouvel entretien Air/Eau - Sol/Eau
4. Nouvel entretien Air/Air
5. Nouvel entretien Chaudière bois

### 3.2.5 Écran "Nouvel appel" — US-01
Nouvel écran (n'existe pas en V1), utilisé par Régis/Delphine pour enregistrer le contexte d'un appel client avant de créer le rendez-vous ou l'intervention (US-01 du backlog) :

| Champ | Détail | Obligatoire |
|---|---|---|
| Nom du client | recherche dans la base existante ou saisie libre | Oui |
| Adresse | | Oui |
| Code postal | | Oui |
| Ville | | Oui |
| Téléphone | | Oui |
| Mail | | Oui |
| Motif de l'appel | texte libre | Oui |
| Type de bâtiment | liste fermée : Professionnel / - de 2 ans / + de 2 ans | Oui |
| Type d'intervention | liste fermée : Devis, Dépannage, Garantie, Entretien, Diagnostic | Oui |

Trois actions possibles en sortie d'écran :
- **Créer le rendez-vous** → ajoute un événement au planning (et, à terme, à Google Agenda).
- **Créer l'intervention** → **saute directement dans le flux "Nouvelle intervention"**, avec les champs déjà saisis (nom, adresse, CP, ville, tél, mail, type de bâtiment) repris en pré-remplissage. Le technicien continue alors le parcours normal (équipement, descriptif, etc.).
- **Enregistrer sans planifier** → conserve la fiche d'appel sans action de suite immédiate.

> Ce nouvel écran répond en même temps à l'un des points ouverts du §11 (V1.5) : le champ "Type de bâtiment" est désormais une **liste fermée à 3 valeurs** (Professionnel / - de 2 ans / + de 2 ans), et non un texte libre.

### 3.2.6 Évolutions du formulaire "Nouvelle intervention" — US-21 · US-22
- **Liste "Type d'intervention" modifiée** (US-22) : retrait de "Entretien" et "Rendez-vous" (qui ont désormais leurs propres flux dédiés, cf. §3.2.4 et §3.2.7) ; ajout de "Garantie". Liste cible : Dépannage, Garantie, Diagnostic.
- **Statut de l'intervention** (US-22) ("Intervention terminée avec succès" / "Nouvelle intervention à prévoir") affiché en résumé dès l'étape 5/5, avant validation finale.
- **Ajout d'une étape "Photos"** (US-21) avec légende par photo, insérée avant l'étape 5/5. Ceci répond au point ouvert du §11 (V1.5) sur la prise de photos ; impacte le choix de stockage (cf. §6.1, IndexedDB déjà anticipé pour cet usage).
- Le bug remonté initialement ("le bouton retour efface les données déjà saisies") a été vérifié : il ne semble plus présent dans la version actuelle (V2). Aucune action requise pour l'instant ; à re-tester lors des essais terrain (étape 4 de la roadmap, §9).

### 3.2.7 Fiches d'entretien dédiées par type d'équipement — US-19
Trois nouveaux flux de création (accessibles depuis le bouton "+"), chacun démarrant par un écran d'identification client identique à "Nouvelle intervention" (nom, adresse, CP, ville, tél, mail, type de bâtiment obligatoires), suivi d'un champ "Type d'entretien" spécifique, puis d'une **fiche d'entretien dédiée** dont le contenu (mesures) diffère de la fiche d'intervention générique. Contenu détaillé fourni par le client via les fiches papier existantes :

**a) Entretien Air/Eau - Sol/Eau (PAC géothermie / aérothermie)**
- Type d'entretien : Air/Eau ou Sol/Eau
- Équipement : année d'installation + jusqu'à 3 lignes (intitulé, marque, modèle, n° série)
- Mesures — Groupe extérieur : tension d'alimentation, ampérage de fonctionnement, tension intercommunication, pression fluide frigo, type de fluide, charge d'usine, débit eau primaire, T° entrée/sortie d'air groupe extérieur
- Mesures — Autre : T° eau aller/retour (primaire + secondaires 1 et 2), débits eau secondaires, pression d'eau, T° d'air extérieur, nettoyage et état des filtres (tamis, boue), disconnecteur, mitigeur ECS, sécurité anti-gel, aquastat de sécurité, nettoyage/état visuel groupe extérieur et unité intérieure, resserrage des bornes électriques, vannes d'équilibrage, émetteurs zones 1 et 2
- Remarque/Observation (texte libre)
- Pièces utilisées (désignation, référence, quantité — lignes dynamiques)
- Devis souhaité (case + commentaire)
- Signatures technicien / client (comme la fiche générique V1)

**b) Entretien Air/Air (PAC air/air, mono ou multi-split)**
- Type d'entretien : Air/Air
- Équipement : année d'installation + jusqu'à 5 lignes (1 unité extérieure + jusqu'à 4 unités intérieures — intitulé, marque, modèle, n° série)
- Mesures : tension d'alimentation, ampérage, tension intercommunication, resserrage des bornes, T° d'échange groupe extérieur + jusqu'à 4 unités intérieures, T° d'air extérieur, nettoyage/état des filtres intérieurs, nettoyage pompe de relevage, pression et type de fluide frigo, charge usine, GWP fluide, nettoyage/état visuel groupe extérieur et unités intérieures
- Remarque/Observation, pièces utilisées, devis souhaité, signatures — identique au modèle (a)

**c) Entretien Chaudière bois**
- Type d'entretien : Granulés, Bûches ou Pellets
- Équipement : année d'installation + jusqu'à 3 lignes (intitulé, marque, modèle, n° série)
- Champ supplémentaire par rapport aux autres fiches : **"Prochaine intervention prévue"** (en plus de "Nouvelle intervention à prévoir")
- Mesures : tension d'alimentation, resserrage des bornes, vannes d'équilibrage, émetteurs zones 1/2, T° d'air extérieur, nettoyage/état filtres et filtre à boue, pression eau, disconnecteur, mitigeur ECS, étalonnage et test remplissage granulés, nettoyage et état du WOS (échangeur), nettoyage creuset/cendrier/sonde lambda/chambre de combustion/chaudière/silo interne, test de combustion, test clapet coupe-feu, test bougie d'allumage, état visuel chaudière et silo interne
- Remarque/Observation, pièces utilisées (5 lignes), devis souhaité, signatures — identique au modèle (a)

> **Point technique :** ces 3 fiches partagent une structure commune (client / intervention / équipement / mesures / remarque / pièces / devis / signatures) mais un bloc "Mesures" propre à chaque type d'équipement. Le modèle de données (§5) devra prévoir une table `Mesure` typée par entretien plutôt que des colonnes fixes, pour rester extensible.

### 3.2.8 Duplication d'une fiche — US-20
Demande client : pouvoir **dupliquer une intervention et/ou un entretien** existant (utile pour les entretiens annuels récurrents chez un même client). À intégrer au CRUD existant (§4.1) : un bouton "Dupliquer" en plus de "Modifier" et "Supprimer" sur le détail d'une fiche, qui pré-remplit un nouveau formulaire à partir de la fiche source (client + équipement repris, date/mesures à ressaisir).

### 3.2.9 Base de données pièces — arbitrée — US-23
Demande d'une base de données pièces pour l'auto-complétion de la désignation (en plus de la base clients déjà prévue en V1). **Arbitré (19/08/2026) :** base **« désignation seule »**, alimentée par **saisie manuelle** pour l'instant. La référence, le prix, la disponibilité par technicien et un éventuel import initial restent **possibles ultérieurement** (porte non fermée, cf. §11).

### 3.2.10 Découvertes annexes — arbitrées — US-24 · US-25
En examinant les fiches papier fournies, deux documents supplémentaires sont apparus, qui ne faisaient pas partie de la demande initiale. **Arbitrés (19/08/2026) → intégrés en V3 :**
- **Contrat d'entretien annuel** (US-24) (choix du nombre de passages, tarification par zone/km, conditions générales, signatures) — **digitalisé** en V3 (PDF généré).
- **CERFA n°15497 (fluides frigorigènes)** (US-25) — déclaration réglementaire obligatoire pour les interventions sur PAC (contrôle d'étanchéité, quantités de fluide manipulées, déchets ADR/RID), prévue par le code de l'environnement (art. R.543-79 et R.543-82). **Intégré** aux fiches d'entretien PAC (Air/Eau-Sol/Eau et Air/Air), avec un formulaire tenant sur **une seule page** (document officiel).

---

## 3.3 V3 — Définition (arbitrée le 19/08/2026)

> **Statut : arbitré.** Les décisions ci-dessous ont été prises le 19/08/2026 avec le porteur de projet. Elles intègrent en V3 : toutes les user stories du backlog §10 (épopées 1 à 5 + transverses), les nouvelles demandes §3.2 (US-16 → US-25) et les pistes V3, **à l'exception** des éléments explicitement reportés (§3.3.6).

### 3.3.1 Prise de contact & planification (épopée 1)
- **Écran « Nouvel appel »** (US-01, §3.2.5) : enregistrement du contexte d'un appel client, avec 3 actions de sortie (créer le RDV / créer l'intervention avec pré-remplissage / enregistrer sans planifier).
- **Planning = écran d'accueil** (US-17, §3.2.2) : planning journalier par intervenant, triable par type (Dépannage, Entretien, Rdv devis) ; Jérémy ne voit que son planning, Régis/Delphine voient toute l'équipe.
- **Compte Delphine** (US-16) : compte à part entière, mêmes droits de vue que Régis, valide la facturation.
- **Bouton « + »** (US-18) : point d'entrée unique (appel, intervention, 3 types d'entretien).
- **Sans synchronisation Google Agenda** (US-14 reporté, cf. §11).

### 3.3.2 Intervention terrain (évolutions)
- Fiches d'entretien dédiées (US-19, §3.2.7) : Air/Eau-Sol/Eau, Air/Air, Chaudière bois.
- Duplication d'une fiche (US-20, §3.2.8).
- Étape « Photos avec légende » (US-21, §3.2.6).
- Liste type d'intervention modifiée (US-22) : Dépannage, Garantie, Diagnostic.
- Base de données pièces (US-23, §3.2.9) : **désignation seule**, saisie manuelle ; import ultérieur possible.
- **CERFA n°15497** (US-25, §3.2.10) : intégré aux fiches PAC Air/Eau-Sol/Eau et Air/Air, formulaire sur **une seule page** (document officiel).
- **Contrat d'entretien annuel** (US-24, §3.2.10) : digitalisé (nombre de passages, tarification par zone/km, conditions générales, signatures, PDF).
- **Mode brouillon** : reprendre une fiche non terminée plus tard — fiche générique + les 3 fiches d'entretien.
- **Numérotation** : référence unique séquentielle sur tous les documents (fiches, dossier).

### 3.3.3 Validation & facturation (épopées 3-4-5) — sans génération de documents
> **Décision clé :** le devis et la facture sont réalisés par un **logiciel externe**. L'application ne fait qu'**importer le PDF** produit (sélecteur de fichiers ou scan caméra) et l'**attacher au dossier**. Elle ne génère ni devis, ni facture chiffrée.
- **Validation des fiches** (US-05) : Régis valide chaque fiche terminée.
- **Devis** (US-06/US-07) : indication « devis nécessaire » + import du PDF de devis, **sans jamais bloquer la facturation**.
- **Facturation** (US-09/US-10/US-11) : marquage « à facturer » → import du PDF de facture → vérification → fusion avec la fiche pour constituer le dossier final.
- **Envoi & clôture** (US-12) : **envoi manuel** (partage natif du téléphone) — l'envoi automatique par email est reporté.
- **Statuts** (US-13) : workflow complet ci-dessous.
- **Classement automatique par statut** (US-15) : remplace le classement manuel OneDrive (tri/filtres par statut dans l'appli).

### 3.3.4 Workflow de statuts d'un dossier (US-13)
```
Brouillon → À valider → Validée → À facturer → Facture importée → Facture à vérifier → Facture vérifiée → À envoyer → Clôturée
                          └──────────────────── (Devis PDF attaché en parallèle, sans blocage) ────────────────────┘
```
- **Brouillon** : fiche non terminée, reprise plus tard.
- **À valider** : fiche terminée, en attente de validation par Régis.
- **Validée** : fiche complète et correcte.
- **À facturer** : validée, prête pour la facturation (logiciel externe).
- **Facture importée** : le PDF de facture produit par le logiciel externe a été attaché au dossier.
- **Facture à vérifier** : en attente de vérification de la facture par Régis (US-10).
- **Facture vérifiée** : facture vérifiée et fusionnée avec la fiche (US-11) — dossier final prêt à envoyer.
- **À envoyer** : dossier complet (fiche + facture), en attente d'envoi au client (US-12).
- **Clôturée** : envoyée manuellement au client.
- Le **devis** est un document attaché en parallèle (statut « devis nécessaire » tant qu'il n'est pas importé), sans bloquer la facturation.

### 3.3.5 Statistiques
- **Tableau de bord simple** : nombre d'interventions/mois, répartition par type, par technicien, par client.

### 3.3.6 Reporté hors V3 (à recadrer)
- **Synchronisation Google Agenda** (US-14) : le fonctionnement souhaité n'est pas clair ; reportée (cf. §11).
- **Envoi automatique d'email** : envoi manuel conservé.
- **Génération de devis/factures** : faite par un logiciel externe (import PDF uniquement) — pas de chiffrage dans l'appli.

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
9. **Signatures** : nom technicien (pré-rempli si un seul technicien) + nom client, avec case "présent/absent" (signature tactile disponible en V2).
10. **Validation** → génération automatique du PDF reprenant la mise en page actuelle + sauvegarde locale de la fiche.
11. **Modification** : depuis le détail d'une fiche, bouton « Modifier » (icône stylo) → reprise du parcours 2 à 9 pré-rempli, pour corriger ou compléter une fiche existante (CRUD complet) — la fiche est mise à jour en place, sans doublon.
12. **Partage** du PDF via le menu de partage natif du téléphone (aucun envoi automatique).

### 4.1 Détail des champs texte libre

Les champs texte libre suivants bénéficient d'améliorations ergonomiques :

| Étape | Champ | Comportement |
|---|---|---|
| 3 | Descriptif de la demande | Zone de texte sans poignée de redimensionnement, hauteur automatique |
| 4 | Action réalisée | Zone de texte sans poignée de redimensionnement, hauteur automatique |
| 5 | Commentaire devis | Zone de texte sans poignée de redimensionnement, hauteur automatique |

**Nettoyage automatique** : à l'enregistrement de chaque étape, les champs texte libre sont automatiquement nettoyés :
- Suppression des espaces en début et fin de texte
- Suppression des espaces en fin de chaque ligne
- Réduction des lignes vides consécutives à une seule ligne vide (les sauts de paragraphe simples sont conservés)

> **Gestion des fiches (CRUD) :** le parcours ci-dessus permet la **C**réation (étapes 1-10), la **L**ecture (liste à l'accueil + détail), la **M**odification (étape 11) et la **S**uppression (bouton corbeille sur le détail) des fiches d'intervention.

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

### 5.2 Modèle de données V3 (Supabase) — extensions

La V3 s'appuie sur le schéma Supabase existant (§3.1) et ajoute les tables/colonnes suivantes :

```
Appel {
  id: uuid
  nom, adresse, code_postal, ville, tel, mail
  motif: text
  type_batiment: "professionnel" | "moins_2_ans" | "plus_2_ans"
  type_intervention: "devis" | "depannage" | "garantie" | "entretien" | "diagnostic"
  action_sortie: "rdv" | "intervention" | "sans_suite"
  client_id: uuid, rendezvous_id: uuid, intervention_id: uuid (liens créés en sortie d'écran)
  created_at, updated_at
}

RendezVous {
  id: uuid
  technicien_id: uuid (référence profiles)
  date, heure_debut, heure_fin
  type: "depannage" | "entretien" | "rdv_devis"
  client_id, appel_id (optionnels)
  statut
  created_at, updated_at
}

Intervention (extensions V3) {
  + numero: string (référence unique séquentielle)
  + statut: "brouillon" | "a_valider" | "validee" | "a_facturer" | "facture_importee" | "facture_a_verifier" | "facture_verifiee" | "a_envoyer" | "cloturee"
  + type_intervention (restreint): "depannage" | "garantie" | "diagnostic"
  + type_entretien (fiches dédiées): "air_eau" | "sol_eau" | "air_air" | "granules" | "buches" | "pellets"
  + prochaine_intervention_prevue: bool (fiche chaudière bois)
}

Mesure {
  id: uuid
  fiche_id: uuid
  type_entretien: string
  code, libelle, valeur, unite
}

Photo {
  id: uuid
  intervention_id: uuid
  url (Supabase Storage), legende
}

Piece {  // base pièces : désignation seule pour l'instant
  id: uuid
  designation: string
  // reference, prix, disponibilite_par_technicien : réservés pour un import ultérieur (porte non fermée)
  created_at, updated_at
}

Document {
  id: uuid
  intervention_id: uuid (dossier)
  type: "devis" | "facture" | "contrat_entretien"
  fichier_url (PDF, Supabase Storage)
  numero_externe (numéro du document source)
  created_at, updated_at
}

ContratEntretien {
  id: uuid
  client_id: uuid
  nb_passages, tarification_zone_km, conditions_generales
  signe_client, signe_technicien
  pdf_url
  created_at, updated_at
}
```

> **Numérotation :** un compteur par type de document (fiche d'intervention/entretien, dossier) génère les références uniques (ex. `FIC-2026-001`). Le format exact reste à valider (§11).
>
> **CERFA n°15497 :** le formulaire est intégré aux fiches d'entretien PAC avec ses champs réglementaires (contrôle d'étanchéité, quantités de fluide, déchets ADR/RID), sur une seule page ; les données sont stockées dans le bloc `Mesure` / des colonnes dédiées.
>
> **Mode brouillon :** le statut `brouillon` (§3.3.4) permet de sauvegarder une fiche non terminée et de la reprendre ; appliqué à la fiche générique et aux 3 fiches d'entretien.

---

## 6. Architecture technique

### 6.1 V1 — PWA autonome
- **Frontend** : HTML/CSS/JS natif (pas de framework lourd, pour rester léger et rapide à charger).
- **Stockage** : `IndexedDB` (choisi dès la V1 pour anticiper la migration vers Supabase en V2 et gérer plus de marge si des photos sont ajoutées plus tard).
- **PWA** :
  - `manifest.json` (icône, nom, couleurs aux couleurs de Climat Elec, mode standalone).
  - `service worker` pour mise en cache des assets (HTML/CSS/JS/logo) → fonctionnement 100 % hors ligne, y compris au premier lancement après installation.
   - Mise à jour automatique des clients installés via `updatefound` + `skipWaiting()` + `clients.claim()`, avec incrémentation manuelle de `CACHE_VERSION` dans `sw.js` à chaque déploiement. L'enregistrement est fait avec `updateViaCache: "none"` (jamais de `sw.js` servi depuis le cache HTTP) et une vérification forcée `reg.update()` est déclenchée au chargement, au retour de focus et à la remise au premier plan (`visibilitychange`) pour ne pas attendre la vérification périodique du navigateur (~24 h).
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
| 1. Cadrage | Ce PRD | Terminé |
| 2. Maquette / prototype V1 | Écrans principaux (liste, fiche client, fiche intervention, export PDF) | Terminé |
| 3. Développement V1 | PWA complète, testée hors ligne sur téléphone réel | Terminé |
| 4. Mise en usage réel | Tests terrain par le technicien, ajustements | À faire |
| 5. Développement V2 | Intégration Supabase, comptes, synchronisation, signature électronique | Terminé (mergé dans `dev`) |
| 6. Historique équipements par client | Ajout à la fiche équipement | Terminé |
| 7. Spécification V3 | Cadrage des fonctionnalités V3 (ce PRD, §3.3) | Terminé (19/08/2026) |
| 8. Développement V3 | Planning/appel, fiches entretien + CERFA + contrat, workflow validation/facturation (import PDF), statistiques, brouillon, numérotation | À faire |
| 9. Recadrage Google Agenda | Clarifier le fonctionnement de la synchronisation (reportée hors V3) | À faire |

> Le contenu de la V3 est **arbitré** (cf. §3.3) ; les seuls points reportés sont la synchronisation Google Agenda (US-14) et l'envoi automatique d'email.

---

## 10. Backlog de user stories — pistes d'évolution possibles

> **Statut : arbitrées le 19/08/2026.** Les user stories ci-dessous sont issues de la modélisation complète du processus métier (appel client → RDV → fiche terrain → validation → devis → facturation → envoi), réalisée avec les 3 personnes concernées (Régis, Jérémy, Delphine). Elles ont été **arbitrées et intégrées à la V3** (cf. §3.3), à l'exception de l'US-14 (Google Agenda, reportée). Les stories US-01, US-02 et US-14 (épopée 1) sont détaillées au §3.2 ; les nouvelles demandes US-16 → US-25 y sont aussi détaillées et intégrées en V3.

Légende de couverture :
- 🟢 **Déjà couvert** par l'application (V1/V2)
- 🔵 **Intégré en V3** (arbitré le 19/08/2026, cf. §3.3)
- ⚪ **Reporté / à recadrer** (hors V3 pour l'instant)

### Épopée 1 — Prise de contact & planification
*Acteur principal : Régis (Responsable)*

| ID | User story | Statut |
|---|---|---|
| US-01 | En tant que responsable, je veux enregistrer les informations d'un client qui appelle, afin de disposer de son contexte avant l'intervention. | 🔵 V3 |
| US-02 | En tant que responsable, je veux créer un rendez-vous pour le technicien, afin de planifier son passage chez le client. | 🔵 V3 |
| US-14 | En tant que responsable, je veux que ce rendez-vous soit synchronisé avec Google Agenda, afin de ne pas gérer deux calendriers en parallèle. | ⚪ Reportée |

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
| US-05 | En tant que responsable, je veux recevoir et valider chaque fiche d'intervention terminée, afin de m'assurer qu'elle est complète et correcte avant de lancer la facturation. | 🔵 V3 |
| US-06 | En tant que responsable, je veux indiquer si l'intervention nécessite en plus un devis pour des travaux complémentaires, afin de déclencher sa réalisation **sans jamais bloquer la facturation de l'intervention elle-même**. | 🔵 V3 |
| US-07 | En tant que responsable, je veux réaliser un devis pour les travaux complémentaires identifiés, afin de le transmettre au client indépendamment de la facturation de l'intervention en cours. *(V3 : devis produit par un logiciel externe, PDF importé et attaché au dossier.)* | 🔵 V3 |
| US-08 | En tant que responsable, je veux que toute fiche validée parte automatiquement vers la facturation, qu'un devis complémentaire soit généré ou non en parallèle, afin qu'aucune intervention réalisée ne reste facturée en retard à cause d'un devis en attente. | 🔵 V3 |

> *Rappel important issu de la modélisation : facturation de l'intervention et devis complémentaire sont deux actions **parallèles**, pas deux chemins exclusifs — la facturation ne doit jamais être conditionnée à la présence ou non d'un devis.*

### Épopée 4 — Facturation
*Acteurs : Delphine (Secrétaire) & Régis (Responsable)*

| ID | User story | Statut |
|---|---|---|
| US-09 | En tant que secrétaire, je veux créer une facture à partir d'une fiche marquée "à facturer", afin de générer le document à transmettre au client. *(V3 : facture produite par un logiciel externe, PDF importé et attaché au dossier.)* | 🔵 V3 |
| US-10 | En tant que responsable, je veux vérifier une facture avant son envoi, afin de m'assurer qu'elle correspond bien à l'intervention réalisée. | 🔵 V3 |
| US-11 | En tant que responsable, je veux fusionner la facture vérifiée avec la fiche d'intervention correspondante, afin de constituer le dossier final complet à envoyer. | 🔵 V3 |

### Épopée 5 — Envoi & clôture
*Acteur principal : Delphine (Secrétaire)*

| ID | User story | Statut |
|---|---|---|
| US-12 | En tant que secrétaire, je veux envoyer la facture accompagnée de la fiche d'intervention au client, afin de clôturer le dossier. *(V3 : envoi manuel via le partage natif du téléphone.)* | 🔵 V3 |

### Transverses — Statuts & outils
*Tous acteurs*

| ID | User story | Statut |
|---|---|---|
| US-13 | En tant qu'utilisateur (Régis, Delphine ou Jérémy), je veux voir en un coup d'œil le statut d'un dossier (terminée / à facturer / à vérifier / à envoyer), afin de savoir qui doit agir ensuite sans avoir à demander aux autres. | 🔵 V3 |
| US-15 | En tant qu'utilisateur, je veux que les documents (fiches, devis, factures) soient classés automatiquement selon leur statut, afin de remplacer le classement manuel actuel par dossiers sur OneDrive. | 🔵 V3 |

### Récapitulatif de couverture

| Épopée | Nb. stories | Statut |
|---|---|---|
| 1. Prise de contact & planification | 3 | 2 en V3 · 1 reportée (US-14) |
| 2. Intervention terrain | 2 | 2 / 2 couvertes (V1/V2) |
| 3. Validation & devis | 4 | 4 en V3 |
| 4. Facturation | 3 | 3 en V3 (import PDF) |
| 5. Envoi & clôture | 1 | 1 en V3 (envoi manuel) |
| Transverses | 2 | 2 en V3 |
| **Total** | **15** | **12 en V3 · 2 couvertes · 1 reportée** |

**Prochaine étape :** ce backlog est désormais **arbitré** (cf. §3.3). Le détail complet (schéma du processus, vue visuelle) est disponible dans le document `Modelisation_interventions_Climat_elec.drawio` ; les nouvelles demandes du 16/08 sont détaillées au §3.2 (US-16 → US-25).

---

## 11. Points ouverts / à trancher plus tard

Les points ci-dessous ont été tranchés le 19/08/2026 et intégrés en V3 (cf. §3.3) : photos avec légende, type de bâtiment (liste fermée), mode brouillon (toutes les fiches), numérotation des documents, base pièces (désignation seule), contrat d'entretien annuel (digitalisé), CERFA n°15497 (intégré, une seule page).

Points restant ouverts (hors V3) :
- **Synchronisation Google Agenda (US-14)** — **reportée hors V3** : le fonctionnement souhaité n'est pas clair. À clarifier ultérieurement : calendrier unique vs par technicien, source de vérité (appli vs Google), mapping des champs, gestion des conflits d'édition.
- **Envoi automatique d'email au client** — reporté : envoi manuel conservé (partage natif).
- **Génération de devis/factures dans l'application** — non retenue : réalisée par un logiciel externe, l'appli importe le PDF. À reconsidérer éventuellement plus tard.
- **Extension de la base pièces** — désignation seule pour l'instant ; référence/prix, disponibilité par technicien et import initial restent possibles ultérieurement (porte non fermée).
- **Format exact de la numérotation** — à valider (proposition : préfixe type + année + séquence, ex. `FIC-2026-001`).
- **Faut-il interfacer ou remplacer les outils existants (Google Agenda, OneDrive) ?** — OneDrive remplacé par le classement par statut dans l'appli (§3.3) ; Google Agenda en suspens (ci-dessus).

---

## 12. Critères de succès

- Le technicien peut créer, consulter, **modifier** et supprimer une fiche d'intervention **sans aucune connexion réseau**, du début à la fin.
- Le temps de saisie d'une intervention pour un client déjà connu est **réduit d'au moins 50 %** grâce à l'auto-remplissage.
- Le PDF généré est visuellement fidèle à la fiche papier actuelle.
- Aucune perte de données lors du passage de la V1 (local) à la V2 (Supabase).
- (V3) Les 3 fiches d'entretien dédiées couvrent les types d'équipement avec leur bloc de mesures spécifique, et le CERFA n°15497 tient sur une seule page.
- (V3) Un dossier est suivi de bout en bout (brouillon → clôturée) avec import PDF du devis/facture produit par le logiciel externe.
- (V3) Le classement automatique par statut remplace le classement manuel OneDrive.