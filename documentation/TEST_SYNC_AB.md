# Protocole de test A/B — SYNC-01 (écrasement silencieux)

> Objectif : vérifier les **critères d'acceptation** de SYNC-01 (cf.
> `Analyse application.md` §3) — « le conflit est détecté et signalé, aucune
> donnée n'est écrasée silencieusement ; relancer l'app sur un appareil sans
> modification locale ne produit **aucun** upsert ».
>
> Ce protocole manuel tient lieu de scénario E2E tant que l'infrastructure de
> tests (Playwright, BP-02) n'existe pas. S'appuie sur la **base de test**
> Supabase (env `development` de `config.js`), jamais sur la production.

## Montage (10 min)

| Rôle | Appareil A (le « hors ligne ») | Appareil B (le « en ligne ») |
|---|---|---|
| Compte | `responsable` | `technicien` |
| Technique | Chrome, profil « Régis » | Chrome, profil « Jérémy » (ou Firefox) |

1. `bash scripts/build-dist.sh` puis servir `dist/` : `npx serve dist` (ou `python3 -m http.server 8080 -d dist`).
2. Ouvrir deux **profils de navigateur distincts** sur `http://localhost:8080`
   (profils Chrome : `chrome://profile-picker`) — sinon IndexedDB est partagé et
   le test est invalide.
3. Se connecter A et B, laisser la première synchronisation achever
   (pastille « synchronisé » dans « Compte & synchro »).
4. Sur A, créer une fiche d'intervention « TST-A » chez un client test ;
   sur B, appuyer sur « Synchroniser maintenant », vérifier que la fiche
   apparaît.

## Cas 1 — conflit hors ligne (le scénario SYNC-01 historique)

5. Sur **A** : activer le **mode avion** (DevTools → Network → Offline est
   équivalent), modifier la fiche TST-A : changer la remarque client en
   « version A », quitter la fiche. `sync_queue` contient 1 élément
   (DevTools → Application → IndexedDB → `_meta`/`sync_queue`).
6. Sur **B** (en ligne) : ouvrir la même fiche, mettre la remarque à
   « version B », attendre la synchro automatique (~5 s, Realtime) puis
   vérifier sur le Dashboard Supabase que la table contient « version B ».
7. Sur **A** : **désactiver le mode avion** → synchro automatique.

**Attendu :**
- A ne pousse PAS sa version en écrasant B : un **conflit** est enregistré.
- « Compte & synchro » affiche l'élément en conflit avec les deux versions
  (base locale vs serveur, `remote_updated_at`) et propose
  « garder local » / « garder serveur ».
- La remarque côté serveur (vérifier sur B ou via le Dashboard Supabase,
  table `interventions`) reste **« version B »** tant que la résolution n'est
  pas tranchée.
- Après résolution « garder serveur », la copie A se réaligne ; après
  « garder local », la version A remplace B **et** l'événement conflit disparaît.

## Cas 2 — relance à vide (aucun upsert)

8. Sur **B**, sans toucher aux données : recharger la page (F5), ouvrir
   DevTools → **Réseau**, filtrer `supabase.co`, puis recharger à nouveau.

**Attendu :**
- Aucune requête `POST`/`PATCH` sur `/rest/v1/*` issue de la sync au
  démarrage (le Realtime peut émettre des GET ; le push conditionnel ne
  doit rien émettre : `sync_queue` vide, `initial_push_done` déjà posé).
- Idem après avoir quitté/réouvert l'app 3 fois de suite.

## Cas 3 — renvoi massif explicite (récupération)

9. Sur **A** : « Compte & synchro » → « Tout renvoyer » → confirmer
   l'avertissement.

**Attendu :** les données locales de A partent vers le serveur (écritures
visibles côté réseau), mais l'action a été précédée d'un avertissement
explicite « la version locale écrasera celle du serveur » — jamais déclenchée
automatiquement au lancement ni au retry.

## Traçabilité attendue (§7.3)

Consigner dans la PR : résultat réel de chaque cas (captures des écrans
Conflit / Réseau), modèles d'appareils, date. Tout écart = réouverture de
SYNC-01, pas de cochage de la case.
