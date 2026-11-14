#!/usr/bin/env bash
# Rejoue schema (migrations) + tests pgTAP sur un PostgreSQL « nu » avec le shim Supabase.
# Prérequis : un PostgreSQL ≥ 15 joignable (variables PG* standard), l'extension pgTAP et pg_prove.
#   PGUSER=postgres PGHOST=localhost supabase/tests/run-local.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
DB="${CE_TEST_DB:-ce_test}"
psql -v ON_ERROR_STOP=1 -q -d postgres -c "drop database if exists ${DB}" -c "create database ${DB}"
psql -v ON_ERROR_STOP=1 -q -d "$DB" -f supabase/tests/00_supabase_shim.sql
# Rejeu x2 : le schéma doit être idempotent (DB-02).
for pass in 1 2; do
  for f in supabase/migrations/*.sql; do psql -v ON_ERROR_STOP=1 -q -d "$DB" -f "$f" >/dev/null; done
  echo "rejeu des migrations #$pass : OK"
done
# `schema.sql` (fichier généré) doit aussi se rejouer sans erreur.
psql -v ON_ERROR_STOP=1 -q -d "$DB" -f supabase/schema.sql >/dev/null && echo "rejeu de schema.sql : OK"
psql -v ON_ERROR_STOP=1 -q -d "$DB" -c "create extension if not exists pgtap"
pg_prove -d "$DB" supabase/tests/*.test.sql
