#!/usr/bin/env node
// =========================================================
// ÉTAPE 0 / IMP-09 — Sauvegarde complète Supabase (base + buckets)
//
// Exporte SANS CLI ni pg_dump (Node >= 18, zéro dépendance) :
//   1. les DONNÉES des 11 tables métier + profiles en JSON (piggyback
//      sur l'API REST, service_role contourne la RLS) ;
//   2. le TÉLÉCHARGEMENT intégral de chaque bucket Storage
//      (photos / documents / signatures), sous-dossiers inclus ;
//   3. un METADATA avec horodatage et décomptes (contrôle d'intégrité).
//
// LIMITES (assumées, à connaître) :
//   - le SCHÉMA (tables, policies, fonctions) n'est pas dupliqué :
//     sa source de vérité versionnée reste supabase/schema.sql
//     (re-jouable sur base neuve) ;
//   - les COMPTES auth (emails/mots de passe) ne sont pas exportables
//     via l'API : à recréer (seed.local.sql côté exploitant + réinit. mdp).
//
// Utilisation (clé service_role, NE JAMAIS la versionner) :
//   SUPABASE_URL=https://<projet>.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=<clé service_role> \
//   BACKUP_DIR=~/backups/supabase-2026-10-30 \
//   node supabase/backup_supabase.mjs
// ========================================================= */

import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";

const SUPA_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const REF = SUPA_URL.match(/https:\/\/([^.]+)\./)?.[1] || "projet";
const BACKUP_DIR = process.env.BACKUP_DIR || `${REF}-sauvegarde-${new Date().toISOString().slice(0, 10)}`;
const TABLES = [
  "clients", "interventions", "equipements", "pieces_utilisees",
  "appels", "rendezvous", "mesures", "photos", "pieces", "documents", "contrats_entretien", "profiles",
];
const BUCKETS = ["photos", "documents", "signatures"];
const PAGE = 1000;

if (!SUPA_URL || !SERVICE_KEY) {
  console.error("Variables requises : SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY (Dashboard → Settings → API).");
  process.exit(1);
}
if (/^sb_secret_/.test(SERVICE_KEY) === false && !SERVICE_KEY.startsWith("eyJ")) {
  console.error("La clé fournie ne ressemble pas à une service_role (JWT) ou sb_secret_. Abandon.");
  process.exit(1);
}
if (existsSync(BACKUP_DIR)) {
  console.error(`Dossier ${BACKUP_DIR} existe déjà — changez BACKUP_DIR (une sauvegarde = un dossier vierge).`);
  process.exit(1);
}
const kio = (n) => `${(n / 1024).toFixed(0)} kio`.padStart(9);

function headers(extra = {}) {
  return { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json", ...extra };
}

async function restGet(path) {
  const res = await fetch(`${SUPA_URL}${path}`, { headers: headers() });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} — ${body.slice(0, 200)}`);
  }
  return res.json().catch(() => ({}));
}

async function listRows(table) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE) {
    const page = await restGet(`/rest/v1/${table}?select=*&order=id.asc&limit=${PAGE}&offset=${offset}`);
    rows.push(...page);
    if (!Array.isArray(page) || page.length < PAGE) break;
  }
  return rows;
}

async function storageList(bucket, prefix = "") {
  const res = await fetch(`${SUPA_URL}/storage/v1/object/list/${bucket}`, {
    method: "POST", headers: headers(), body: JSON.stringify({ prefix, limit: 1000, sortBy: { column: "name", order: "asc" } }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`list ${bucket}/${prefix} → ${res.status} ${body.slice(0, 160)}`);
  }
  return res.json();
}

async function downloadObject(bucket, path) {
  const res = await fetch(`${SUPA_URL}/storage/v1/object/${bucket}/${path}`, { headers: headers() });
  if (!res.ok) throw new Error(`GET ${bucket}/${path} → ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// Collecte récursive : dossiers (id null) → sous-liste ; fichiers → chemin
async function collectObjects(bucket, prefix = "", acc = []) {
  const items = await storageList(bucket, prefix);
  for (const it of Array.isArray(items) ? items : []) {
    const p = `${prefix}${it.name}`;
    if (it.id == null) { // dossier — recurse (prefix relatif)
      await collectObjects(bucket, `${p}/`, acc);
    } else acc.push(p);
  }
  return acc;
}

(async () => {
  console.log(`Sauvegarde ${REF} → ${BACKUP_DIR}`);
  mkdirSync(BACKUP_DIR, { recursive: true });
  const summary = { at: new Date().toISOString(), project: REF, tables: {}, buckets: {} };

  // 1. Tables (données brutes, JSON indenté — restaurable via upsert REST)
  for (const table of TABLES) {
    try {
      const rows = await listRows(table);
      const file = join(BACKUP_DIR, `table-${table}.json`);
      writeFileSync(file, JSON.stringify({ table, count: rows.length, dumped_at: summary.at, rows }, null, 1));
      const size = rows.reduce((n, r) => n + JSON.stringify(r).length, 0);
      summary.tables[table] = rows.length;
      console.log(`  table ${table.padEnd(18)} ${String(rows.length).padStart(5)} ligne(s)  ${kio(size)}`);
    } catch (e) {
      summary.tables[table] = { erreur: String(e) };
      console.error(`  table ${table.padEnd(18)} ERREUR ${String(e).slice(0, 120)}`);
    }
  }

  // 2. Buckets
  for (const bucket of BUCKETS) {
    try {
      const objects = await collectObjects(bucket);
      let n = 0, bytes = 0;
      for (const path of objects) {
        const data = await downloadObject(bucket, path);
        const dest = join(BACKUP_DIR, "storage", bucket, path);
        mkdirSync(dirname(dest), { recursive: true });
        writeFileSync(dest, data);
        n++; bytes += data.length;
      }
      summary.buckets[bucket] = { objets: n, kio: Math.round(bytes / 1024) };
      console.log(`  bucket ${bucket.padEnd(11)} ${String(n).padStart(5)} objet(s)  ${kio(bytes)}`);
    } catch (e) {
      summary.buckets[bucket] = { erreur: String(e) };
      console.error(`  bucket ${bucket.padEnd(11)} ERREUR ${String(e).slice(0, 120)}`);
    }
  }

  // 3. Métadonnées
  writeFileSync(join(BACKUP_DIR, "SAUVEGARDE.json"), JSON.stringify(summary, null, 2));
  const okTables = Object.values(summary.tables).every((v) => typeof v === "number");
  const okBuckets = Object.values(summary.buckets).every((v) => typeof v === "number" || !v.erreur);
  console.log(`\n=== Sauvegarde ${okTables && okBuckets ? "complète" : "PARTIELLE (erreurs ci-dessus)"} → ${BACKUP_DIR} ===`);
  console.log("À conserver HORS du dépôt (disque externe / cloud privé) ; restauration : schema.sql + réimport JSON + re-copie storage.");
  process.exit(okTables && okBuckets ? 0 : 1);
})();
