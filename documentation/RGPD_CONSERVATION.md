# RGPD — registre simplifié, conservation et outils (SEC-13)

> **Ce document décrit les outils techniques et l'état des traitements. Il ne fixe pas les durées
> de conservation légales et n'a pas été validé juridiquement.** Les points marqués
> « À VALIDER » sont des décisions de l'exploitant, à prendre avec un conseil juridique.

## 1. Registre simplifié des traitements

| Traitement | Données | Finalité | Où | Accès | Durée |
|---|---|---|---|---|---|
| Fiches clients | nom, adresse, téléphone, e-mail | gestion des interventions et RDV | Supabase + copie IndexedDB de chaque appareil | membres actifs (RLS) | À VALIDER |
| Interventions | historique, mesures, pièces, photos, signatures, devis/factures importés | suivi, preuve de passage, facturation | Supabase (tables + Storage) + copie locale | technicien concerné + managers | À VALIDER (fiches d'intervention / fluides frigorigènes : obligations légales de conservation à confirmer) |
| Appels et rendez-vous | coordonnées de l'appelant | planification | Supabase + copie locale | membres actifs | À VALIDER |
| Comptes de l'équipe | nom, e-mail, rôle | authentification, droits | Supabase Auth + `profiles` | responsable | durée de la relation de travail (à valider) |
| Journaux | `dossier_events`, `role_events` (qui, quoi, quand) | traçabilité | Supabase | responsable / périmètre de la fiche | À VALIDER |

Sous-traitant : Supabase (hébergement base et fichiers). Région d'hébergement, contrat de
sous-traitance (DPA) et transferts hors UE : À VÉRIFIER dans le Dashboard et le contrat.

## 2. Outils fournis

Tous réservés au **responsable** (ou SQL Editor / `service_role`), non exécutables par `anon`.

- **Purge de conservation** — `public.purge_soft_deleted(p_retention interval, p_dry_run boolean default true)`.
  Supprime définitivement les lignes « supprimées » depuis plus de la durée donnée (minimum 30 jours).
  **Simulation par défaut.** Un client n'est purgé que s'il n'est plus référencé. Les enfants d'une fiche
  purgée partent avec elle. Les objets Storage (photos, documents, signatures) ne peuvent pas être
  supprimés en SQL : la fonction les liste, `supabase/purge_retention.mjs` les supprime.
  ```
  SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… RETENTION_DAYS=<durée validée> node supabase/purge_retention.mjs          # simulation
  SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… RETENTION_DAYS=<durée validée> node supabase/purge_retention.mjs --apply  # réel
  ```
  **Faire une sauvegarde avant `--apply`** (`supabase/backup_supabase.mjs`). Aucune planification automatique.
- **Export d'un client** — `select public.export_client_data('<uuid>');` (JSON, sans binaires).
- **Effacement d'un client** — `select public.anonymize_client('<uuid>');` efface l'identité et les
  coordonnées (fiche client, appels, nom du signataire) et conserve les fiches techniques.
  Non traité : les **images de signature** dans Storage — À VALIDER avec le conseil juridique.

## 3. Données sur les appareils

IndexedDB contient une copie en clair des données. Protections : marqueur de propriétaire des
données locales (un autre compte n'en hérite pas), purge à la déconnexion (par défaut pour les
managers), rappel d'activer le verrouillage de l'écran. Pas de verrouillage applicatif par PIN.

## 4. Page de confidentialité

Compte → Confidentialité. Les champs `exploitant`, `contact`, `conservation` se renseignent dans
`config.js` (`PRIVACY_INFO`) ; vides, la page l'indique.

## 5. Reste à faire

- Décider et documenter les durées de conservation, puis renseigner `PRIVACY_INFO`.
- Sauvegardes planifiées et test de restauration (SEC-14) : voir `documentation/PROCEDURE_SAUVEGARDE.md`.
