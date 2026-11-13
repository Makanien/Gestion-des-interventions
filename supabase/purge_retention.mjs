#!/usr/bin/env node
// =========================================================
// SEC-13 — Purge de conservation (lignes « supprimées » depuis longtemps)
//
// Appelle la fonction SQL `purge_soft_deleted` puis supprime les objets
// Storage (photos, documents, signatures) qu'elle a listés : le SQL ne peut
// pas supprimer les fichiers eux-mêmes.
//
// SIMULATION PAR DÉFAUT : sans --apply, rien n'est supprimé, le script affiche
// ce qui le serait. FAIRE UNE SAUVEGARDE AVANT (backup_supabase.mjs).
//
//   SUPABASE_URL=https://<projet>.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=<clé service_role> \
//   RETENTION_DAYS=1095 \
//   node supabase/purge_retention.mjs            # simulation
//   … node supabase/purge_retention.mjs --apply  # suppression réelle
//
// RETENTION_DAYS est OBLIGATOIRE : la durée de conservation est une décision
// de l'exploitant (à faire valider, cf. documentation/RGPD_CONSERVATION.md).
// Minimum accepté par la fonction : 30 jours.
// =========================================================

import { writeFileSync } from "node:fs";

const SUPA_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const DAYS = Number(process.env.RETENTION_DAYS);
const APPLY = process.argv.includes("--apply");

if (!SUPA_URL || !KEY) {
  console.error("Variables requises : SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
if (!Number.isInteger(DAYS) || DAYS < 30) {
  console.error("RETENTION_DAYS obligatoire (entier >= 30), ex. RETENTION_DAYS=1095.");
  process.exit(1);
}

const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

const res = await fetch(`${SUPA_URL}/rest/v1/rpc/purge_soft_deleted`, {
  method: "POST",
  headers,
  body: JSON.stringify({ p_retention: `${DAYS} days`, p_dry_run: !APPLY }),
});
if (!res.ok) {
  console.error(`purge_soft_deleted a échoué : HTTP ${res.status} ${await res.text()}`);
  process.exit(1);
}
const out = await res.json();

console.log(APPLY ? "PURGE RÉELLE effectuée en base." : "SIMULATION (rien n'a été supprimé).");
console.log(`Rétention : ${DAYS} jours`);
console.table(out.counts);

const objects = out.storage || [];
console.log(`Objets Storage concernés : ${objects.length}`);
if (!APPLY) {
  for (const o of objects.slice(0, 20)) console.log(`  ${o.bucket}/${o.path}`);
  if (objects.length > 20) console.log(`  … (+${objects.length - 20})`);
  console.log("Relancer avec --apply pour supprimer.");
  process.exit(0);
}

// La liste n'est plus récupérable une fois les lignes supprimées : on la garde
// sur disque AVANT de supprimer les fichiers (reprise possible en cas d'échec).
const listFile = `purge-storage-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
writeFileSync(listFile, JSON.stringify(objects, null, 2));
console.log(`Liste des objets enregistrée : ${listFile}`);

// Suppression par lots, par bucket.
const byBucket = {};
for (const o of objects) (byBucket[o.bucket] ||= []).push(o.path);
let failed = 0;
for (const [bucket, paths] of Object.entries(byBucket)) {
  for (let i = 0; i < paths.length; i += 100) {
    const batch = paths.slice(i, i + 100);
    const r = await fetch(`${SUPA_URL}/storage/v1/object/${bucket}`, {
      method: "DELETE",
      headers,
      body: JSON.stringify({ prefixes: batch }),
    });
    if (!r.ok) {
      failed += batch.length;
      console.error(`  ${bucket} : échec du lot (HTTP ${r.status}) ${await r.text()}`);
    } else {
      console.log(`  ${bucket} : ${batch.length} objet(s) supprimé(s) (les absents sont ignorés)`);
    }
  }
}
if (failed) {
  console.error(`${failed} objet(s) non supprimé(s) : relancer ou supprimer à la main.`);
  process.exit(2);
}
