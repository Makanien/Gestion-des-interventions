#!/usr/bin/env node
// =========================================================
// SEC-02 / SEC-11 — Migration des objets Storage historiques
//
// Contexte : les anciennes versions nommaient les objets à la racine des
// buckets `photos` / `documents` (`photo-<timestamp>-<i>.jpg`,
// `doc-<timestamp>-<type>.pdf`). Les policies Storage (PR #24) restreignent
// désormais le périmètre par le PREMIER SEGMENT du chemin = identifiant
// d'intervention : ces objets racine sont invisibles de l'app (RLS) et
// contournables ce jour uniquement côté admin.
//
// Ce script one-shot (Node >= 18, zéro dépendance) :
//   1. lit les lignes des tables `photos` / `documents`,
//   2. ignore celles déjà au nouveau format `{intervention_id}/{id}.ext`,
//   3. DÉPLACE l'objet vers `{intervention_id}/{id de la ligne}.ext`
//      (mapping stable ligne <-> objet : le nom = id de la ligne),
//   4. met à jour `fichier_url` sur la ligne,
//   5. liste à la fin les objets orphelins (racine + fiches supprimées)
//      pour décision humaine — rien n'est détruit automatiquement.
//
// Utilisation (clé service_role, NE JAMAIS la versionner) :
//   SUPABASE_URL=https://<projet>.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=<clé service_role (Dashboard → API)> \
//   node supabase/migrate_storage_to_id_paths.mjs            # dry-run
//   DRY_RUN=0 ... node supabase/migrate_storage_to_id_paths.mjs  # application
// ========================================================= */

const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const DRY_RUN = process.env.DRY_RUN !== "0";
const BUCKETS = ["photos", "documents"];
const DEFAULT_EXT = { photos: ".jpg", documents: ".pdf" };
const PAGE = 1000;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Variables requises : SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY (Dashboard → Settings → API).");
  process.exit(1);
}
if (/^sb_secret_/.test(SERVICE_KEY) === false && !SERVICE_KEY.startsWith("eyJ")) {
  console.error("La clé fournie ne ressemble pas à une service_role (JWT) ou sb_secret_. Abandon.");
  process.exit(1);
}

// En-têtes service_role ; `range` permet la pagination PostgREST (l'API
// limite à 1000 lignes/requête en l'absence d'en-tête Range).
function headers(range) {
  const h = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" };
  if (range != null) h.Range = `${range}-${range + PAGE - 1}`;
  return h;
}

async function restFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}${path}`, options);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} — ${body.slice(0, 300)}`);
  }
  return res.json().catch(() => ({}));
}

async function listRows(store) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE) {
    const page = await restFetch(
      `/rest/v1/${store}?select=id,intervention_id,fichier_url,deleted_at&order=id.asc&limit=${PAGE}`,
      { headers: headers(offset) }
    );
    rows.push(...page);
    if (!Array.isArray(page) || page.length < PAGE) break;
  }
  return rows;
}

async function storageList(bucket, prefix = "") {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${bucket}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ prefix, limit: 5000 }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`list ${bucket} → ${res.status} ${body.slice(0, 200)}`);
  }
  return res.json();
}

// API Storage : le corps attendu est { bucketId, sourceKey, destinationKey }
// (400 "required property 'sourceKey'" si on envoie sourceName/destinationPath).
async function storageMove(bucket, sourceName, destinationPath) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/move`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ bucketId: bucket, sourceKey: sourceName, destinationKey: destinationPath }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const isMissing = res.status === 404 || body.includes("not found") || body.includes("does not exist");
    if (isMissing) return { missing: true };
    throw new Error(`move ${bucket}/${sourceName} → ${res.status} ${body.slice(0, 200)}`);
  }
  return {};
}

async function patchFichierUrl(store, id, fichierUrl) {
  await restFetch(`/rest/v1/${store}?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: headers("return=minimal"),
    body: JSON.stringify({ fichier_url: fichierUrl }),
  });
}

// La source est absente : soit un lancement interrompu a déjà déplacé
// l'objet (reprise), soit l'objet n'existe vraiment pas. Si la destination
// existe déjà, on rattrape `fichier_url` ; sinon on signale.
async function storageObjectExists(bucket, path) {
  const dir = path.split("/").slice(0, -1).join("/") + "/";
  const name = path.split("/").pop();
  const items = await storageList(bucket, dir);
  return items.some((o) => o.name === name || o.name === path);
}

function extFrom(path, bucket) {
  const m = /\.[A-Za-z0-9]{1,6}$/.exec(path);
  return m ? m[0] : DEFAULT_EXT[bucket];
}

// Le chemin est-il déjà au nouveau format {intervention_id}/{...} ? Un chemin
// racine sans "/" est un ancien nom. `storage.foldername()` côté SQL prend le
// segment avant le 1er "/" ; le script reproduit exactement ce comportement.
function isFirstSegmentIntervention(path, interventionId) {
  const first = String(path).split("/")[0];
  return first === interventionId;
}

function extractPath(fichierUrl, bucket) {
  let p = String(fichierUrl || "");
  if (!p) return "";
  const marker = `/object/${bucket}/`;
  if (p.includes("://") && p.includes(marker)) p = p.split(marker).pop();
  else if (p.includes("://")) return "";
  while (p.startsWith("/")) p = p.slice(1);
  return p;
}

(async () => {
  console.log(`SUPABASE_URL=${SUPABASE_URL}   DRY_RUN=${DRY_RUN ? "oui" : "NON — application réelle"}`);
  const report = { moved: 0, updated: 0, missing: 0, skipped: 0, deletedRows: 0, badUrls: 0 };
  const orphans = [];

  for (const bucket of BUCKETS) {
    const rows = await listRows(bucket);
    console.log(`\n== ${bucket} : ${rows.length} ligne(s) ==`);
    for (const row of rows) {
      const path = extractPath(row.fichier_url, bucket);
      if (!row.fichier_url) { report.skipped++; continue; }
      if (!path) { report.badUrls++; console.warn(`  ? URL non mappable : ligne ${row.id} (${row.fichier_url})`); continue; }
      if (row.deleted_at) {
        // Ligne soft-supprimée : l'objet correspondant devient orphelin candidat
        // — destruction volontaire (RGPD/purge) laissée à une action délibérée.
        report.deletedRows++;
        orphans.push(`LIGNE SUPPRIMÉE ${bucket}/${path}`);
        continue;
      }
      if (isFirstSegmentIntervention(path, row.intervention_id)) { report.skipped++; continue; }
      const destination = `${row.intervention_id}/${row.id}${extFrom(path, bucket)}`;
      if (DRY_RUN) {
        console.log(`  [dry-run] move ${path} → ${destination}`);
      } else {
        const res = await storageMove(bucket, path, destination);
        if (res.missing) {
          if (await storageObjectExists(bucket, destination)) {
            await patchFichierUrl(bucket, row.id, destination);
            console.log(`  ✓ (déjà déplacé, reprise) ${destination} (+ fichier_url rattrapée)`);
            report.updated++;
          } else {
            report.missing++;
            console.warn(`  ! objet absent : ${bucket}/${path}`);
          }
          continue;
        }
        await patchFichierUrl(bucket, row.id, destination);
        console.log(`  ✓ ${path} → ${destination} (+ fichier_url mise à jour)`);
      }
      report.moved++;
      report.updated++;
    }
  }

  // Objets racine restants sans ligne connue (orphelins) — inventaire seul.
  // Les entrées de DOSSIER renvoyées par l'API list ont `id: null` : ne pas
  // les compter comme orphelins (faux positifs = dossiers {intervention_id}).
  // Dédupe avec les objets déjà signalés via les lignes soft-supprimées.
  const declared = new Set(orphans.map((o) => o.split(" ")[1]));
  for (const bucket of BUCKETS) {
    const roots = (await storageList(bucket)).filter(
      (o) => !String(o.name).includes("/") && o.id != null
    );
    for (const o of roots) {
      const label = `ORPHELIN ${bucket}/${o.name}`;
      if (!declared.has(`${bucket}/${o.name}`)) orphans.push(label);
    }
  }

  console.log(`\n=== Bilan ===`);
  console.log(`déplacements ${report.moved} · fichier_url mises à jour ${report.updated} · déjà format id ${report.skipped} · objets absents ${report.missing} · URL non mappables ${report.badUrls} · lignes soft-supprimées ${report.deletedRows}`);
  if (orphans.length) {
    console.log(`\n${orphans.length} objet(s) orphelin(s) à détruire délibérément (Dashboard Storage ou curl service) :`);
    orphans.forEach((o) => console.log(`  - ${o}`));
  }
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
