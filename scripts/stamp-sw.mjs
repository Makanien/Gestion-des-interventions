// BP-04 — Estampille CACHE_VERSION dans dist/sw.js avec l'empreinte du contenu de dist/,
// et vérifie que la liste ASSETS correspond exactement aux fichiers livrés.
//   node scripts/stamp-sw.mjs [dossier=dist]
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const dist = resolve(process.argv[2] || "dist");
const swPath = join(dist, "sw.js");
const sw = readFileSync(swPath, "utf8");

const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const files = walk(dist)
  .map((f) => relative(dist, f).split("\\").join("/"))
  .filter((f) => f !== "sw.js" && f !== "_headers")
  .sort();

// 1. Cohérence ASSETS ⇄ dist/
const block = sw.match(/const ASSETS = \[([\s\S]*?)\];/);
if (!block) throw new Error("Liste ASSETS introuvable dans sw.js");
const assets = [...block[1].matchAll(/"\.\/([^"]*)"/g)].map((m) => m[1]).filter((a) => a !== "");
const missing = assets.filter((a) => !files.includes(a));
const unlisted = files.filter((f) => !assets.includes(f));
if (missing.length) {
  console.error(`ERREUR sw.js : fichier(s) listé(s) dans ASSETS mais absents de dist/ : ${missing.join(", ")}`);
  process.exit(1);
}
if (unlisted.length) {
  console.error(`ERREUR sw.js : fichier(s) livré(s) mais absents de ASSETS (non disponibles hors ligne) : ${unlisted.join(", ")}`);
  process.exit(1);
}

// 2. Empreinte du contenu (noms + octets) — change dès qu'un fichier change.
const hash = createHash("sha256");
for (const f of files)
  hash
    .update(f)
    .update("\0")
    .update(readFileSync(join(dist, f)))
    .update("\0");
const version = `climatelec-${hash.digest("hex").slice(0, 12)}`;

const stamped = sw.replace(/const CACHE_VERSION = "[^"]*";[^\n]*/, `const CACHE_VERSION = "${version}";`);
if (stamped === sw) throw new Error("CACHE_VERSION introuvable dans sw.js");
writeFileSync(swPath, stamped);
console.log(`sw.js : CACHE_VERSION = ${version} (${files.length} fichiers précachés)`);
