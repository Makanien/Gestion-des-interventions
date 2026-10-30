#!/usr/bin/env node
// =========================================================
// SEC-02 / SYNC-02 — Migration des binaires base64 vers Storage
//
// Contexte : l'historique des photos/documents (flux V2) est stocké
// en base64 dans la colonne `data_url`, sans objet Storage
// (`fichier_url` vide). Depuis SYNC-02, le pull ne tire plus les
// data_url : ces lignes restent « squelettiques » sur tout appareil
// autre que celui d'origine — les photos n'apparaissent plus.
//
// Ce script one-shot (Node >= 18, zéro dépendance) :
//   1. lit les lignes `photos` / `documents` encore sans fichier_url,
//   2. ignore les lignes déjà pourvues (reprise possible),
//   3. CRÉE l'objet Storage `{intervention_id}/{id de la ligne}.ext`
//      depuis le base64 de `data_url` (bucket correspondant au store),
//   4. met à jour `fichier_url` sur la ligne,
//   5. CONSERVE `data_url` en base (compatibilité de l'app déployée
//      qui tire encore la colonne ; purge ultérieure possible).
//
// Utilisation (clé service_role, NE JAMAIS la versionner) :
//   SUPABASE_URL=https://<projet>.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=<clé service_role> \
//   node supabase/migrate_dataurl_to_storage.mjs              # dry-run
//   DRY_RUN=0 ... node supabase/migrate_dataurl_to_storage.mjs # application
// ========================================================= */

const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const DRY_RUN = process.env.DRY_RUN !== "0";
const STORES = ["photos", "documents"];
const BUCKET = { photos: "photos", documents: "documents" };
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

function headers(extra = {}) {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function restFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}${path}`, options);
  if (!res.ok && res.status !== 409) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} — ${body.slice(0, 300)}`);
  }
  return { ok: res.ok, status: res.status, json: await res.json().catch(() => ({})) };
}

async function listRows(store) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE) {
    const { ok, json } = await restFetch(
      `/rest/v1/${store}?select=id,intervention_id,fichier_url,data_url,deleted_at&order=id.asc&limit=${PAGE}`,
      { headers: headers({ Range: `${offset}-${offset + PAGE - 1}` }) }
    );
    if (!ok) throw new Error(`list ${store} → ${JSON.stringify(json).slice(0, 200)}`);
    rows.push(...json);
    if (!Array.isArray(json) || json.length < PAGE) break;
  }
  return rows;
}

// dataURL "data:image/png;base64,AAAA…" → { mime, buffer } ou null
function parseDataUrl(dataUrl) {
  const m = /^data:([^;,]+);base64,(.+)$/s.exec(String(dataUrl || ""));
  if (!m) return null;
  return { mime: m[1], buffer: Buffer.from(m[2], "base64") };
}

// [SEC-02] Chemin récent : le 1er segment doit être l'intervention_id.
function expectedExt(mime, store) {
  if (/png/i.test(mime)) return ".png";
  if (/jpeg|jpg/i.test(mime)) return ".jpg";
  if (/pdf/i.test(mime)) return ".pdf";
  return DEFAULT_EXT[store];
}

async function uploadObject(store, id, interventionId, mime, buffer) {
  const path = `${interventionId}/${id}${expectedExt(mime, store)}`;
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET[store]}/${path}`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": mime,
    },
    body: buffer,
  });
  const body = await res.text().catch(() => "");
  if (!res.ok && res.status !== 409) {
    throw new Error(`upload photos/${path} → ${res.status} ${body.slice(0, 200)}`);
  }
  return { path, existed: res.status === 409 };
}

async function patchFichierUrl(store, id, fichierUrl) {
  await restFetch(`/rest/v1/${store}?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: headers({ Prefer: "return=minimal" }),
    body: JSON.stringify({ fichier_url: fichierUrl }),
  });
}

(async () => {
  console.log(`SUPABASE_URL=${SUPABASE_URL}   DRY_RUN=${DRY_RUN ? "oui" : "NON — application réelle"}`);
  const report = { uploaded: 0, patched: 0, skipped: 0, noIntervention: 0, badDataUrl: 0, conflicts: 0 };
  const unmigrable = [];

  for (const store of STORES) {
    const rows = await listRows(store);
    console.log(`\n== ${store} : ${rows.length} ligne(s) ==`);
    for (const row of rows) {
      if (row.deleted_at) { report.skipped++; continue; }
      if (row.fichier_url) { report.skipped++; continue; } // déjà pourvu
      if (!row.data_url) { report.badDataUrl++; continue; }
      if (!row.intervention_id) {
        report.noIntervention++;
        unmigrable.push(`${store}/${row.id} : intervention_id null`);
        continue;
      }
      const parsed = parseDataUrl(row.data_url);
      if (!parsed) {
        report.badDataUrl++;
        unmigrable.push(`${store}/${row.id} : data_url non reconnu`);
        continue;
      }
      const path = `${row.intervention_id}/${row.id}${expectedExt(parsed.mime, store)}`;
      const bucketName = BUCKET[store];
      if (DRY_RUN) {
        console.log(`  [dry-run] create ${bucketName}/${path} (${(parsed.buffer.length / 1024).toFixed(0)} kio)`);
      } else {
        const res = await uploadObject(store, row.id, row.intervention_id, parsed.mime, parsed.buffer);
        if (res.existed) { report.conflicts++; console.warn(`  ? existait déjà : ${bucketName}/${res.path} — fichier_url rattachée`); }
        else { report.uploaded++; console.log(`  ✓ ${bucketName}/${res.path} créé (${(parsed.buffer.length / 1024).toFixed(0)} kio)`); }
        await patchFichierUrl(store, row.id, res.path);
        report.patched++;
      }
    }
  }

  console.log(`\n=== Bilan ===`);
  console.log(`objets créés ${report.uploaded} · existaient déjà ${report.conflicts} · fichier_url mise à jour ${report.patched} · déjà pourvues ${report.skipped} · data_url illisibles ${report.badDataUrl} · intervention_id null ${report.noIntervention}`);
  if (unmigrable.length) {
    console.log(`\n${unmigrable.length} ligne(s) à traiter à la main :`);
    unmigrable.forEach((u) => console.log(`  - ${u}`));
  }
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
