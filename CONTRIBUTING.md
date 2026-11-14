# Contribuer

Application **offline-first** de saisie d'interventions. Lire d'abord [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) (synchronisation, droits, service worker).

## Mise en route

```bash
npm ci                       # outils de dev uniquement : l'application n'a aucune dépendance npm
npm run lint && npm run format && npm test
bash supabase/tests/run-local.sh   # base PostgreSQL + tests RLS (voir supabase/migrations/README.md)
npm run build                # produit dist/ (seul dossier à déployer)
npm run test:e2e             # nécessite la build ; installe Chromium : npx playwright install chromium
```

## Règles

1. **Jamais de commit direct sur `main` ni `dev`** : une branche par lot, une PR relue, la CI verte.
2. **Nouveau fichier de code** : script classique dans `js/` ; l'ajouter à `index.html` (avant `app.js`, ordre = ordre de chargement) **et** à `ASSETS`. Ne pas exécuter au chargement du code qui dépend d'un fichier chargé plus tard.
2. **Service worker** : la version du cache est **estampillée à la build** (ne rien incrémenter à la main). Si vous **ajoutez ou renommez un fichier servi**, mettez à jour `ASSETS` (`sw.js`),
   `scripts/build-dist.sh` et, pour un script, `index.html` — la build échoue sinon.
3. **SQL** : `supabase/migrations/` est la source de vérité. Nouvelle évolution = nouveau fichier horodaté, **idempotent**, puis `npm run schema:build` (commiter aussi `schema.sql`).
   Toute policy ou tout trigger modifié s'accompagne d'un test dans `supabase/tests/`. Jamais d'e-mail ni de donnée réelle dans le dépôt (`supabase/seed.local.sql` reste non versionné).
4. **Échappement** : toute donnée utilisateur interpolée dans du HTML passe par `esc()` ; dans le code neuf ou remanié, préférer le tag `html` (échappe par défaut). Jamais de `eval`
   ni de gestionnaire inline (CSP `script-src 'self'`).
5. **Offline-first** : toute écriture métier passe d'abord par IndexedDB puis par la file de synchronisation ; l'UI n'appelle pas Supabase directement.
6. **Pas d'échec silencieux** : jamais de `catch {}` vide ; utiliser `ErrorLog.warn/error` (journal local, sans donnée client).
7. **Synchronisation** : toute modification de `sync.js`, `sync-persist.js` ou `idb.js` exige les tests `tests/unit/` au vert (ils couvrent le scénario A/B de conflit).
8. **Dépendances embarquées** : voir `vendor/VERSIONS.md` (procédure de mise à jour, empreintes vérifiées par `npm run vendor:check`).
9. **Documentation dans la même PR** : `CHANGELOG.md` (toujours), `docs/PRD.md` si le comportement attendu change, `docs/ARCHITECTURE.md` si la synchro, les droits ou le service worker changent,
   README si l'installation ou l'exploitation change, et cocher les cases de `Analyse application.md`.
10. **Ne pas cocher « résolu » sans test** qui le prouve.

## Style

Prettier (`.prettierrc.json`) s'applique au code neuf (tests, scripts, configurations). Le code historique est listé dans `.prettierignore` et sera formaté au fil des refontes (BP-03) :
retirer un fichier de cette liste = le reformater dans un commit dédié, sans autre modification.
