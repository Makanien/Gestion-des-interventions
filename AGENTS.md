# Consignes pour les agents de développement

Les règles de travail complètes sont dans [`CONTRIBUTING.md`](CONTRIBUTING.md) — **les lire avant toute modification**. L'essentiel :

- Travailler sur une **nouvelle branche** ; ne jamais committer sur `main`/`dev`.
- Avant de proposer le travail : `npm run lint && npm run format && npm test && npm run schema:check && npm run vendor:check && npm run build`
  (et `bash supabase/tests/run-local.sh` si le SQL a changé).
- Architecture : [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). Spécification : [`docs/PRD.md`](docs/PRD.md). Suivi : `Analyse application.md` (cocher les cases dans la PR).
- Offline-first : écrire en IndexedDB puis dans la file de sync. Échapper tout HTML (`esc()` / tag `html`). Pas de `catch` vide : `ErrorLog`.
- SQL : migrations idempotentes dans `supabase/migrations/`, `schema.sql` généré, test pgTAP pour toute policy/trigger.
- Ne déployer que `dist/`. Ne jamais écrire de clé `service_role` ni de donnée réelle dans le dépôt.
- Si un test ou une vérification n'a pas pu être exécuté (réseau, navigateur), **le dire explicitement** dans la PR au lieu de cocher la tâche.
