#!/usr/bin/env node
// =========================================================
// Sauvegarde Supabase v2 — base (JSON + pg_dump optionnel), comptes auth,
// buckets Storage, manifeste et empreintes SHA-256.
//
// Node >= 18, zéro dépendance.
//
// CE QUE FAIT LE SCRIPT
//   1. Découvre les tables du schéma public via l'API (OpenAPI de PostgREST)
//      et exporte toutes les lignes (soft-supprimées incluses) en JSON,
//      avec contrôle du nombre de lignes lues contre le total serveur.
//   2. Exporte la liste des comptes auth (id, email, métadonnées, dates).
//      Les mots de passe (hash) ne sont PAS exportables par l'API.
//   3. Télécharge tous les buckets Storage (pagination + sous-dossiers),
//      vérifie la taille de chaque objet et calcule son SHA-256.
//   4. Optionnel (SUPABASE_DB_URL + pg_dump) : dump Postgres du schéma public
//      (restaurable avec pg_restore) et schéma réel, y compris policies,
//      triggers et fonctions, + schémas auth/storage en best-effort.
//   5. Écrit SAUVEGARDE.json (manifeste) et SHA256SUMS (vérifiable avec
//      `sha256sum -c SHA256SUMS`).
//
// UTILISATION (la clé ne doit JAMAIS être versionnée ni collée dans un chat)
//   export SUPABASE_URL="https://<projet>.supabase.co"
//   read -rs SUPABASE_SERVICE_ROLE_KEY && export SUPABASE_SERVICE_ROLE_KEY
//   export BACKUP_DIR="$HOME/backups-supabase/prod-$(date +%F)"   # hors dépôt
//   # optionnel : export SUPABASE_DB_URL="postgresql://postgres.<ref>:<mdp>@<hôte pooler>:5432/postgres"
//   # optionnel : export EXPECT_OBJECTS="photos=251,documents=1,signatures=53"
//   node backup_supabase.mjs
//
// Code de sortie : 0 = sauvegarde complète ; 1 = au moins une erreur
// (la sauvegarde est alors à considérer comme INCOMPLÈTE) ; 2 = mauvaise utilisation.
// =========================================================

import {
  mkdirSync, writeFileSync, existsSync, readdirSync, statSync, readFileSync,
} from "node:fs";
import { join, dirname, resolve, relative, sep } from "node:path";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { spawnSync } from "node:child_process";

const env = process.env;
const SUPA_URL = (env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
const KEY = (env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const DB_URL = (env.SUPABASE_DB_URL || "").trim();
const PAGE = 1000;
const CONCURRENCY = 1;

// Tables que l'application utilise (d'après la documentation du projet).
// Si l'une manque côté serveur, c'est une ERREUR : la sauvegarde serait incomplète.
const REQUIRED_TABLES = [
  "clients", "interventions", "equipements", "pieces_utilisees",
  "appels", "rendezvous", "mesures", "photos", "pieces",
  "documents", "contrats_entretien", "profiles",
];
// Utilisées seulement si la découverte automatique échoue. Les noms exacts
// sont à confirmer ; une table absente (404) devient un simple avertissement.
const FALLBACK_EXTRA_TABLES = [
  "dossier_events", "role_events", "numero_counteurs", "numero_compteurs",
];
const EXPECTED_BUCKETS = ["photos", "documents", "signatures"];

const warnings = [];
const errors = [];
const warn = (m) => { warnings.push(m); console.warn(`  ⚠ ${m}`); };
const fail = (m) => { errors.push(m); console.error(`  ✗ ${m}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const kio = (n) => `${(n / 1024).toFixed(0)} kio`.padStart(10);
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const enc = encodeURIComponent;

// ---------- Validation de l'entrée ----------
function usage(msg) {
  console.error(msg);
  console.error("Variables requises : SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY (Dashboard → Settings → API Keys).");
  process.exit(2);
}
if (!SUPA_URL || !KEY) usage("Variables manquantes.");
if (!/^https?:\/\/[^/]+$/.test(SUPA_URL)) usage("SUPABASE_URL invalide (attendu : https://<projet>.supabase.co).");

const isJwt = KEY.startsWith("eyJ");
const isSecret = KEY.startsWith("sb_secret_");
if (!isJwt && !isSecret) usage("La clé ne ressemble ni à une clé service_role (JWT) ni à une clé sb_secret_.");
if (isJwt) {
  // Une clé anon ne déclenche aucune erreur : la RLS renvoie simplement 0 ligne.
  // On refuse donc explicitement tout JWT dont le rôle n'est pas service_role.
  try {
    const payload = JSON.parse(Buffer.from(KEY.split(".")[1], "base64url").toString("utf8"));
    if (payload.role !== "service_role") usage(`Cette clé a le rôle "${payload.role}", pas "service_role" : la sauvegarde serait vide. Abandon.`);
  } catch {
    usage("Impossible de lire le contenu de la clé JWT. Abandon.");
  }
}

const REF = SUPA_URL.match(/^https?:\/\/([^.:/]+)/)?.[1] || "projet";
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
let rawDir = (env.BACKUP_DIR || "").trim();
if (rawDir.startsWith("~")) rawDir = join(homedir(), rawDir.slice(1));
const BACKUP_DIR = resolve(rawDir || join(homedir(), "backups-supabase", `${REF}-${stamp}`));

function insideGitRepo(dir) {
  let d = dirname(dir);
  for (;;) {
    if (existsSync(join(d, ".git"))) return true;
    const p = dirname(d);
    if (p === d) return false;
    d = p;
  }
}
if (insideGitRepo(BACKUP_DIR) && env.ALLOW_IN_REPO !== "1") {
  usage(`${BACKUP_DIR} est dans un dépôt git : les données clients risqueraient d'être versionnées. Choisissez un dossier hors dépôt (ou ALLOW_IN_REPO=1 en connaissance de cause).`);
}
if (existsSync(BACKUP_DIR)) usage(`${BACKUP_DIR} existe déjà — une sauvegarde = un dossier vierge.`);

// ---------- HTTP ----------
const authHeaders = () => ({ apikey: KEY, ...(isJwt ? { Authorization: `Bearer ${KEY}` } : {}) });

async function http(path, opts = {}, tries = 6) {
  let last;
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(`${SUPA_URL}${path}`, { ...opts, headers: { ...authHeaders(), ...(opts.headers || {}) } });
      if ((res.status === 429 || res.status >= 500) && i < tries) {
        last = new Error(`HTTP ${res.status}`);
        await sleep(1000 * 2 ** i);
        continue;
      }
      return res;
    } catch (e) {
      last = e;
      if (i < tries) await sleep(1000 * 2 ** i);
    }
  }
  throw last;
}

async function httpJson(path, opts = {}) {
  const res = await http(path, opts);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} ${body.slice(0, 200)}`.trim());
  }
  return res.json();
}

async function pool(items, n, fn) {
  let i = 0;
  const workers = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) await fn(items[i++]);
  });
  await Promise.all(workers);
}

// ---------- Écriture ----------
function writeSecure(file, data) {
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  writeFileSync(file, data, { mode: 0o600 });
}

// ---------- 1. Tables ----------
async function discoverTables() {
  try {
    const spec = await httpJson("/rest/v1/", { headers: { Accept: "application/openapi+json, application/json" } });
    const paths = Object.keys(spec.paths || {}).filter((p) => p !== "/" && !p.startsWith("/rpc/"));
    const defs = spec.definitions || spec.components?.schemas || {};
    const tables = paths.map((p) => p.slice(1)).sort().map((name) => {
      const props = defs[name]?.properties || {};
      const pk = Object.entries(props)
        .filter(([, v]) => /<pk[\s/>]/.test(String(v?.description || "")))
        .map(([k]) => k);
      return { name, pk };
    });
    if (!tables.length) throw new Error("aucune table dans le schéma OpenAPI");
    return { tables, discovered: true };
  } catch (e) {
    warn(`Découverte automatique des tables impossible (${String(e).slice(0, 120)}) — liste de secours utilisée.`);
    const tables = [...REQUIRED_TABLES, ...FALLBACK_EXTRA_TABLES].map((name) => ({ name, pk: name === "profiles" ? ["id"] : ["id"], optional: FALLBACK_EXTRA_TABLES.includes(name) }));
    return { tables, discovered: false };
  }
}

async function dumpTable({ name, pk }) {
  const order = pk.length ? `&order=${pk.map((c) => `${enc(c)}.asc`).join(",")}` : "";
  if (!pk.length) warn(`Table ${name} : pas de clé primaire détectée, pagination sans tri stable (vue ou table sans PK ?).`);
  const rows = [];
  let total = null;
  for (let offset = 0; ; offset += PAGE) {
    const res = await http(`/rest/v1/${enc(name)}?select=*${order}&limit=${PAGE}&offset=${offset}`, { headers: { Prefer: "count=exact" } });
    if (res.status === 416) break; // décalage au-delà de la fin
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const err = new Error(`${res.status} ${res.statusText} ${body.slice(0, 200)}`.trim());
      err.status = res.status;
      throw err;
    }
    if (offset === 0) {
      const m = (res.headers.get("content-range") || "").match(/\/(\d+)$/);
      total = m ? Number(m[1]) : null;
    }
    const page = await res.json();
    if (!Array.isArray(page)) throw new Error("réponse inattendue (pas un tableau)");
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  if (total !== null && rows.length !== total) {
    throw new Error(`écart de comptage : ${rows.length} ligne(s) lue(s) pour ${total} attendue(s) — des écritures ont eu lieu pendant la sauvegarde ? Relancer.`);
  }
  return { rows, total };
}

// ---------- 2. Comptes auth ----------
async function dumpAuthUsers() {
  const users = [];
  for (let page = 1; ; page++) {
    const json = await httpJson(`/auth/v1/admin/users?page=${page}&per_page=${PAGE}`);
    const batch = Array.isArray(json) ? json : json.users || [];
    users.push(...batch);
    if (batch.length < PAGE) break;
  }
  return users;
}

// ---------- 3. Storage ----------
async function listFolder(bucket, prefix) {
  const out = [];
  for (let offset = 0; ; offset += PAGE) {
    const items = await httpJson(`/storage/v1/object/list/${enc(bucket)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prefix, limit: PAGE, offset, sortBy: { column: "name", order: "asc" } }),
    });
    if (!Array.isArray(items)) throw new Error(`liste inattendue pour ${bucket}/${prefix}`);
    out.push(...items);
    if (items.length < PAGE) break;
  }
  return out;
}

async function collectObjects(bucket, prefix = "", acc = []) {
  for (const it of await listFolder(bucket, prefix)) {
    const p = `${prefix}${it.name}`;
    if (it.id == null) await collectObjects(bucket, `${p}/`, acc); // dossier
    else acc.push({ path: p, size: it.metadata?.size ?? null });
  }
  return acc;
}

async function downloadObject(bucket, path) {
  await sleep(250); // anti-429 : espacement des téléchargements
  const url = `/storage/v1/object/${enc(bucket)}/${path.split("/").map(enc).join("/")}`;
  const res = await http(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// ---------- 4. pg_dump (optionnel) ----------
function pgDump(dir) {
  const container = (env.SUPABASE_DB_CONTAINER || "").trim();
  // Mode self-hosted : pg_dump tourne DANS le conteneur (le port 5432 n'est
  // pas exposé à l'hôte), la sortie est capturée en stdout côté hôte.
  if (container) {
    let password = (env.SUPABASE_DB_PASSWORD || "").trim();
    if (!password) {
      try {
        const line = readFileSync(join(homedir(), "supabase", ".env"), "utf8").split(/\r?\n/).find((l) => l.startsWith("POSTGRES_PASSWORD="));
        if (line) password = line.slice("POSTGRES_PASSWORD=".length).trim();
      } catch { /* ignore */ }
    }
    const dbUser = env.SUPABASE_DB_USER || "postgres";
    const dbName = env.SUPABASE_DB_NAME || "postgres";
    const ver = spawnSync("docker", ["exec", container, "pg_dump", "--version"], { encoding: "utf8" });
    if (ver.error || ver.status !== 0) {
      fail(`pg_dump (conteneur ${container}) indisponible : ${(ver.stderr || ver.error?.message || "").trim().slice(0, 200)}`);
      return { statut: "erreur" };
    }
    const run = (name, args, strict) => {
      const r = spawnSync("docker", ["exec", "-e", `PGPASSWORD=${password}`, container, "pg_dump", "-U", dbUser, "-d", dbName, ...args], { encoding: "buffer", maxBuffer: 1024 * 1024 * 512 });
      if (r.status !== 0) {
        (strict ? fail : warn)(`pg_dump ${name} : ${(r.stderr || "").toString().trim().slice(0, 300)}`);
        return false;
      }
      writeFileSync(join(dir, name), r.stdout);
      return true;
    };
    const a = run("database-public.dump", ["-Fc", "--schema=public", "--no-owner", "--no-privileges"], true);
    const b = run("schema-public.sql", ["--schema-only", "--schema=public", "--no-owner", "--no-privileges"], true);
    const c = run("schema-supabase-gere.sql", ["--schema-only", "--schema=auth", "--schema=storage", "--no-owner", "--no-privileges"], false);
    return { statut: a && b ? "ok" : "erreur", database_public: a, schema_public: b, schema_auth_storage: c, version: ver.stdout.trim(), mode: "docker" };
  }
  // Mode cloud / distant : SUPABASE_DB_URL
  let u;
  try { u = new URL(DB_URL); } catch { fail("SUPABASE_DB_URL invalide (ou définir SUPABASE_DB_CONTAINER pour le self-hosted)."); return { statut: "erreur" }; }
  const ver = spawnSync("pg_dump", ["--version"], { encoding: "utf8" });
  if (ver.error || ver.status !== 0) {
    fail("pg_dump est introuvable alors que SUPABASE_DB_URL est défini (installer le client PostgreSQL, version >= celle du serveur).");
    return { statut: "erreur" };
  }
  const penv = { ...process.env, PGPASSWORD: decodeURIComponent(u.password), PGSSLMODE: env.PGSSLMODE || "require" };
  const base = ["-h", u.hostname, "-p", u.port || "5432", "-U", decodeURIComponent(u.username), "-d", u.pathname.slice(1) || "postgres"];
  const run = (name, args, strict) => {
    const r = spawnSync("pg_dump", [...base, ...args, "-f", join(dir, name)], { env: penv, encoding: "utf8" });
    if (r.status !== 0) {
      (strict ? fail : warn)(`pg_dump ${name} : ${(r.stderr || "").trim().slice(0, 300)}`);
      return false;
    }
    return true;
  };
  const a = run("database-public.dump", ["-Fc", "--schema=public", "--no-owner", "--no-privileges"], true);
  const b = run("schema-public.sql", ["--schema-only", "--schema=public", "--no-owner", "--no-privileges"], true);
  const c = run("schema-supabase-gere.sql", ["--schema-only", "--schema=auth", "--schema=storage", "--no-owner", "--no-privileges"], false);
  return { statut: a && b ? "ok" : "erreur", database_public: a, schema_public: b, schema_auth_storage: c, version: ver.stdout.trim() };
}

// ---------- Empreintes ----------
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

// ---------- Programme principal ----------
(async () => {
  console.log(`Sauvegarde du projet ${REF} → ${BACKUP_DIR}`);
  mkdirSync(BACKUP_DIR, { recursive: true, mode: 0o700 });
  const manifest = {
    version: 2, at: new Date().toISOString(), project: REF, node: process.version,
    tables: {}, auth_users: null, buckets: {}, bucket_config: null, pg_dump: null,
    warnings, errors, ok: false,
  };

  // 1. Tables
  console.log("\n[1/4] Tables");
  const { tables, discovered } = await discoverTables();
  if (discovered) {
    const found = new Set(tables.map((t) => t.name));
    for (const t of REQUIRED_TABLES) if (!found.has(t)) fail(`Table attendue absente côté serveur : ${t}`);
    const extra = tables.map((t) => t.name).filter((n) => !REQUIRED_TABLES.includes(n));
    if (extra.length) console.log(`  (tables supplémentaires découvertes et sauvegardées : ${extra.join(", ")})`);
  }
  for (const t of tables) {
    try {
      const { rows, total } = await dumpTable(t);
      const file = join(BACKUP_DIR, "tables", `${t.name}.json`);
      writeSecure(file, JSON.stringify({ table: t.name, count: rows.length, primary_key: t.pk, dumped_at: manifest.at, rows }, null, 1));
      manifest.tables[t.name] = { lignes: rows.length, total_serveur: total, cle_primaire: t.pk };
      console.log(`  ${t.name.padEnd(22)} ${String(rows.length).padStart(6)} ligne(s)`);
    } catch (e) {
      if (t.optional && e.status === 404) {
        warn(`Table optionnelle absente : ${t.name}`);
      } else {
        manifest.tables[t.name] = { erreur: String(e) };
        fail(`Table ${t.name} : ${String(e).slice(0, 200)}`);
      }
    }
  }
  if (Object.values(manifest.tables).every((v) => v.lignes === 0)) {
    warn("Toutes les tables sont vides : clé incorrecte, mauvais projet, ou base vraiment vide ? Vérifier avant de s'y fier.");
  }

  // 2. Comptes auth
  console.log("\n[2/4] Comptes auth");
  try {
    const users = await dumpAuthUsers();
    writeSecure(join(BACKUP_DIR, "auth-users.json"), JSON.stringify({ count: users.length, dumped_at: manifest.at, users }, null, 1));
    manifest.auth_users = users.length;
    console.log(`  ${users.length} compte(s) (sans mots de passe : à réinitialiser après restauration)`);
  } catch (e) {
    fail(`Comptes auth : ${String(e).slice(0, 200)}`);
  }

  // 3. Storage
  console.log("\n[3/4] Storage");
  let bucketNames = EXPECTED_BUCKETS;
  try {
    const cfg = await httpJson("/storage/v1/bucket");
    writeSecure(join(BACKUP_DIR, "storage-buckets.json"), JSON.stringify(cfg, null, 1));
    manifest.bucket_config = cfg.length;
    bucketNames = cfg.map((b) => b.name || b.id);
    for (const b of EXPECTED_BUCKETS) if (!bucketNames.includes(b)) fail(`Bucket attendu absent : ${b}`);
  } catch (e) {
    warn(`Liste des buckets indisponible (${String(e).slice(0, 120)}) — buckets attendus utilisés.`);
  }
  for (const bucket of bucketNames) {
    try {
      const objects = await collectObjects(bucket);
      const files = [];
      let bytes = 0, echecs = 0;
      await pool(objects, CONCURRENCY, async (o) => {
        try {
          if (o.path.split("/").includes("..")) throw new Error("chemin suspect");
          const data = await downloadObject(bucket, o.path);
          if (o.size !== null && data.length !== Number(o.size)) throw new Error(`taille ${data.length} ≠ ${o.size} annoncée`);
          writeSecure(join(BACKUP_DIR, "storage", bucket, ...o.path.split("/")), data);
          files.push({ chemin: o.path, octets: data.length, sha256: sha256(data) });
          bytes += data.length;
        } catch (e) {
          echecs++;
          fail(`Objet ${bucket}/${o.path} : ${String(e).slice(0, 160)}`);
        }
      });
      files.sort((x, y) => (x.chemin < y.chemin ? -1 : 1));
      manifest.buckets[bucket] = { objets: files.length, annonces: objects.length, octets: bytes, echecs, fichiers: files };
      console.log(`  ${bucket.padEnd(12)} ${String(files.length).padStart(5)}/${objects.length} objet(s) ${kio(bytes)}${echecs ? "  ÉCHECS: " + echecs : ""}`);
    } catch (e) {
      manifest.buckets[bucket] = { erreur: String(e) };
      fail(`Bucket ${bucket} : ${String(e).slice(0, 200)}`);
    }
  }
  // Contrôle optionnel contre des chiffres connus : EXPECT_OBJECTS="photos=251,documents=1"
  for (const part of (env.EXPECT_OBJECTS || "").split(",").map((s) => s.trim()).filter(Boolean)) {
    const [b, n] = part.split("=");
    const got = manifest.buckets[b]?.objets;
    if (got !== Number(n)) fail(`Contrôle EXPECT_OBJECTS : ${b} = ${got ?? "?"} objet(s), ${n} attendu(s).`);
  }

  // 4. pg_dump
  console.log("\n[4/4] Dump PostgreSQL");
  if (DB_URL) {
    manifest.pg_dump = pgDump(BACKUP_DIR);
    console.log(`  pg_dump : ${manifest.pg_dump.statut}`);
  } else {
    manifest.pg_dump = { statut: "non_execute" };
    warn("SUPABASE_DB_URL non défini : schéma réel, policies, triggers et fonctions NON sauvegardés (seul supabase/schema.sql versionné les décrit).");
  }

  // Manifeste + empreintes
  manifest.ok = errors.length === 0;
  writeSecure(join(BACKUP_DIR, "SAUVEGARDE.json"), JSON.stringify(manifest, null, 2));
  const lines = walk(BACKUP_DIR)
    .filter((p) => !p.endsWith(`${sep}SHA256SUMS`))
    .sort()
    .map((p) => `${sha256(readFileSync(p))}  ${relative(BACKUP_DIR, p).split(sep).join("/")}`);
  writeSecure(join(BACKUP_DIR, "SHA256SUMS"), lines.join("\n") + "\n");

  console.log(`\n=== Sauvegarde ${manifest.ok ? "COMPLÈTE" : "INCOMPLÈTE"} — ${errors.length} erreur(s), ${warnings.length} avertissement(s) → ${BACKUP_DIR} ===`);
  console.log("Vérification d'intégrité : cd \"" + BACKUP_DIR + "\" && sha256sum -c SHA256SUMS");
  console.log("Ce dossier contient des données clients en clair : copie chiffrée hors du poste, jamais dans le dépôt.");
  process.exitCode = manifest.ok ? 0 : 1;
})().catch((e) => {
  console.error(`Erreur fatale : ${e?.stack || e}`);
  process.exit(1);
});