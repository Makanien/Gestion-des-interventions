// DB-02 — supabase/migrations/*.sql est la SOURCE DE VÉRITÉ.
// supabase/schema.sql est un fichier GÉNÉRÉ (concaténation des migrations, dans l'ordre)
// qui reste collable tel quel dans le SQL Editor Supabase.
//   node scripts/build-schema.mjs           → régénère schema.sql
//   node scripts/build-schema.mjs --check   → échoue si schema.sql est périmé (CI)
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "supabase");
const dir = join(root, "migrations");
const files = readdirSync(dir)
  .filter((f) => /^\d{14}_[a-z0-9_]+\.sql$/.test(f))
  .sort();
if (!files.length) throw new Error("Aucune migration dans supabase/migrations/");

const header = `-- =========================================================
-- FICHIER GÉNÉRÉ — NE PAS ÉDITER À LA MAIN.
-- Source de vérité : supabase/migrations/*.sql (voir supabase/migrations/README.md).
-- Régénérer : npm run schema:build   |   Vérifier : npm run schema:check
-- Contenu : ${files.length} migration(s) concaténée(s), toutes idempotentes.
-- =========================================================
`;
const out =
  header +
  files
    .map(
      (f) =>
        `\n-- ---------------------------------------------------------\n-- MIGRATION ${f}\n-- ---------------------------------------------------------\n${readFileSync(join(dir, f), "utf8").trimEnd()}\n`,
    )
    .join("");

const target = join(root, "schema.sql");
if (process.argv.includes("--check")) {
  let current = "";
  try {
    current = readFileSync(target, "utf8");
  } catch {
    /* absent */
  }
  if (current !== out) {
    console.error("supabase/schema.sql est périmé : lancez `npm run schema:build` et commitez le résultat.");
    process.exit(1);
  }
  console.log(`schema.sql à jour (${files.length} migration(s)).`);
} else {
  writeFileSync(target, out);
  console.log(`schema.sql régénéré depuis ${files.length} migration(s).`);
}
