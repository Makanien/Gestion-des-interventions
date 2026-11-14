# Migrations Supabase (DB-02)

`supabase/migrations/*.sql` est la **source de vérité** du schéma. `supabase/schema.sql` en est la
concaténation générée (collable dans le SQL Editor) : ne jamais l'éditer à la main.

## Ajouter une évolution

1. `supabase migration new nom_explicite` (ou créer `AAAAMMJJHHMMSS_nom.sql` à la main).
2. Écrire du SQL **idempotent** (`create … if not exists`, `drop policy if exists`, `create or replace`).
3. `npm run schema:build` puis commiter la migration **et** `schema.sql`.
4. Ajouter/adapter un test dans `supabase/tests/` si une policy ou un trigger change.
5. La CI rejoue tout sur une base vierge (`db-replay`) et vérifie que `schema.sql` est à jour.

## Baseline sur le projet existant (une seule fois)

La migration `20261101000000_baseline.sql` reprend le schéma déjà déployé. Pour que le CLI ne la
rejoue pas inutilement sur dev/prod : `supabase migration repair --status applied 20261101000000`.
(La rejouer reste sans danger : elle est idempotente.)

## Tester en local

- Avec Docker : `supabase start && supabase db reset && supabase test db`.
- Sans Docker : voir `supabase/tests/run-local.sh` (PostgreSQL nu + shim `supabase/local/supabase_shim.sql`, qui n'est PAS dans `supabase/tests/` car `supabase test db` y exécute tous les fichiers).
