// BP-07 — Vérifie que vendor/VERSIONS.md décrit fidèlement les fichiers embarqués et que
// les versions épinglées dans package.json sont les mêmes (sinon Dependabot suivrait une version fantôme).
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const doc = readFileSync(join(root, "vendor", "VERSIONS.md"), "utf8");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const rows = [...doc.matchAll(/^\| `([^`]+)` \| ([^|]+?) \| ([^|]+?) \| `([0-9a-f]{64})` \|/gm)];
if (!rows.length) throw new Error("Tableau introuvable dans vendor/VERSIONS.md");

let failed = false;
const fail = (msg) => {
  console.error(`ERREUR vendor : ${msg}`);
  failed = true;
};
for (const [, file, name, version, sha] of rows) {
  const path = join(root, "vendor", file);
  if (!existsSync(path)) {
    fail(`${file} documenté mais absent`);
    continue;
  }
  const actual = createHash("sha256").update(readFileSync(path)).digest("hex");
  if (actual !== sha) fail(`${file} : empreinte ${actual} ≠ documentée ${sha}`);
  const pinned = pkg.devDependencies?.[name.trim()];
  if (pinned !== version.trim()) fail(`${name.trim()} : package.json = ${pinned}, VERSIONS.md = ${version.trim()}`);
}
if (!failed) console.log(`vendor : ${rows.length} fichier(s) conforme(s) à VERSIONS.md.`);
process.exit(failed ? 1 : 0);
