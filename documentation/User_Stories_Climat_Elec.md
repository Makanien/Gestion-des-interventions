# User Stories — Processus d'intervention Climat Elec

**Source :** modélisation du processus (drawio) — Appel client → RDV → Fiche terrain → Validation → Devis → Facturation → Envoi.
**Périmètre :** l'ensemble du processus, tous acteurs confondus (Régis, Jérémy, Delphine).

Légende de couverture :
- 🟢 **Déjà couvert** par l'application V1 (prototype PWA existant)
- ⚪ **À développer** (V2 / V3 — hors périmètre de l'application actuelle)

---

## Épopée 1 — Prise de contact & planification
*Acteur principal : Régis (Responsable)*

**US-01** — ⚪ En tant que responsable, je veux enregistrer les informations d'un client qui appelle, afin de disposer de son contexte avant l'intervention.

**US-02** — ⚪ En tant que responsable, je veux créer un rendez-vous pour le technicien, afin de planifier son passage chez le client.

**US-14** — ⚪ En tant que responsable, je veux que ce rendez-vous soit synchronisé avec Google Agenda, afin de ne pas gérer deux calendriers en parallèle.

---

## Épopée 2 — Intervention terrain
*Acteur principal : Jérémy (Technicien)*

**US-03** — 🟢 En tant que technicien, je veux créer une fiche d'intervention chez le client, afin de documenter la demande et l'action réalisée.

**US-04** — 🟢 En tant que technicien, je veux faire signer la fiche par le client à la fin de l'intervention, afin de valider formellement la prestation réalisée.
> *(V1 : nom saisi au clavier. Signature tactile prévue en V2.)*

---

## Épopée 3 — Validation & devis
*Acteur principal : Régis (Responsable)*

**US-05** — ⚪ En tant que responsable, je veux recevoir et valider chaque fiche d'intervention terminée, afin de m'assurer qu'elle est complète et correcte avant de lancer la facturation.

**US-06** — ⚪ En tant que responsable, je veux indiquer si l'intervention nécessite en plus un devis pour des travaux complémentaires, afin de déclencher sa réalisation sans jamais bloquer la facturation de l'intervention elle-même.
> *(Important : la facturation de l'intervention est systématique, que ce devis complémentaire soit nécessaire ou non — ce ne sont pas deux chemins exclusifs mais deux actions en parallèle. V1 : la case "devis souhaité" est déjà saisie par le technicien sur le terrain — mais son traitement côté responsable n'est pas encore dans l'appli.)*

**US-07** — ⚪ En tant que responsable, je veux réaliser un devis pour les travaux complémentaires identifiés, afin de le transmettre au client indépendamment de la facturation de l'intervention en cours.

**US-08** — ⚪ En tant que responsable, je veux que toute fiche validée parte automatiquement vers la facturation, qu'un devis complémentaire soit généré ou non en parallèle, afin qu'aucune intervention réalisée ne reste facturée en retard à cause d'un devis en attente.

---

## Épopée 4 — Facturation
*Acteurs : Delphine (Secrétaire) & Régis (Responsable)*

**US-09** — ⚪ En tant que secrétaire, je veux créer une facture à partir d'une fiche marquée "à facturer", afin de générer le document à transmettre au client.

**US-10** — ⚪ En tant que responsable, je veux vérifier une facture avant son envoi, afin de m'assurer qu'elle correspond bien à l'intervention réalisée.

**US-11** — ⚪ En tant que responsable, je veux fusionner la facture vérifiée avec la fiche d'intervention correspondante, afin de constituer le dossier final complet à envoyer.

---

## Épopée 5 — Envoi & clôture
*Acteur principal : Delphine (Secrétaire)*

**US-12** — ⚪ En tant que secrétaire, je veux envoyer la facture accompagnée de la fiche d'intervention au client, afin de clôturer le dossier.

---

## Transverses — Statuts & outils
*Tous acteurs*

**US-13** — ⚪ En tant qu'utilisateur (Régis, Delphine ou Jérémy), je veux voir en un coup d'œil le statut d'un dossier (terminée / à facturer / à vérifier / à envoyer), afin de savoir qui doit agir ensuite sans avoir à demander aux autres.

**US-15** — ⚪ En tant qu'utilisateur, je veux que les documents (fiches, devis, factures) soient classés automatiquement selon leur statut, afin de remplacer le classement manuel actuel par dossiers sur OneDrive.

---

## Récapitulatif de couverture

| Épopée | Nb. stories | Couvertes par l'appli V1 |
|---|---|---|
| 1. Prise de contact & planification | 3 | 0 / 3 |
| 2. Intervention terrain | 2 | 2 / 2 |
| 3. Validation & devis | 4 | 0 / 4 |
| 4. Facturation | 3 | 0 / 3 |
| 5. Envoi & clôture | 1 | 0 / 1 |
| Transverses | 2 | 0 / 2 |
| **Total** | **15** | **2 / 15** |

L'application V1 actuelle couvre uniquement l'épopée « Intervention terrain » (création de la fiche + signature simplifiée). Tout le reste du processus — prise de RDV, validation, devis, facturation, envoi, statuts partagés — reste aujourd'hui géré manuellement (téléphone, Google Agenda, dossiers OneDrive) et constitue le périmètre naturel des prochaines versions.
