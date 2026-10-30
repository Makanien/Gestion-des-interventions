/* =========================================================
   Climat Elec — Couche Supabase (V2)
   Client SDK + méthodes d'accès Auth / CRUD / Storage.
   L'accès est restreint par les RLS côté serveur (voir schema.sql).
   ========================================================= */

let SB = null; // instance du client Supabase

function initSupabase() {
  const cfg = window.SUPABASE_CONFIG;
  if (!cfg || !cfg.url || cfg.url.includes("VOTRE-PROJET")) {
    console.warn("Supabase non configuré (config.js non renseigné).");
    return null;
  }
  if (!window.supabase) {
    console.warn("SDK Supabase introuvable (supabase.js non chargé).");
    return null;
  }
  if (!SB) {
    SB = window.supabase.createClient(cfg.url, cfg.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // Clé de stockage distincte par environnement pour éviter que la
        // session de dev (localhost) ne se propage à la base de prod.
        storageKey: "climatelec-auth-" + (cfg.env || "production"),
      },
    });
  }
  return SB;
}

// SYNC-02 : les binaires (photos.data_url / documents.data_url, base64) ne
// sont plus tirés en masse — Storage est la source de vérité ; le contenu
// complet est récupéré à la demande via getBinaryDataUrl().
const LIGHT_COLUMNS = {
  photos: "id, intervention_id, fichier_url, legende, created_at, updated_at, deleted_at, created_by, updated_by",
  documents: "id, intervention_id, type, nom, fichier_url, numero_externe, created_at, updated_at, deleted_at, created_by, updated_by",
};
const PULL_PAGE_SIZE = 500; // SYNC-02 : PostgREST/Supabase tronque à 1000 lignes par requête

// NUM-01 : les tables numérotées côté serveur (trigger `set_numero_*`)
// renvoient la référence posée lors du push — sans la demander, l'app ignore
// l'attribution jusqu'au pull suivant. Colonnes limitées aux seules tables
// concernées : `numero` n'existe pas ailleurs (PostgREST renverrait une erreur).
function returnCols(store) {
  return (store === "interventions" || store === "contrats_entretien")
    ? "id, updated_at, numero"
    : "id, updated_at";
}
// Identifiant non devinable pour les objets Storage (SEC-11). `uuid()` est
// défini dans idb.js ; repli sur crypto.getRandomValues si indisponible.
function uuidV4() {
  if (typeof uuid === "function") return uuid();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

const Supabase = {
  configured() {
    return !!initSupabase();
  },
  // ---------------- Auth ----------------
  getSession() {
    const c = initSupabase();
    if (!c) return null;
    return c.auth.getSession();
  },
  onAuthChange(cb) {
    const c = initSupabase();
    if (!c) return () => {};
    return c.auth.onAuthStateChange((event, session) => cb(event, session));
  },
  async signInWithMagicLink(email) {
    const c = initSupabase();
    const { error } = await c.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + window.location.pathname },
    });
    if (error) throw error;
  },
  async signInWithPassword(email, password) {
    const c = initSupabase();
    const { data, error } = await c.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },
  async signOut() {
    const c = initSupabase();
    const { error } = await c.auth.signOut();
    if (error) throw error;
  },
  async currentUser() {
    const c = initSupabase();
    const { data } = await c.auth.getUser();
    return data?.user || null;
  },
  async getProfile(id) {
    const c = initSupabase();
    const { data, error } = await c.from("profiles").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data;
  },
  async updateProfile(full_name) {
    const c = initSupabase();
    const { data } = await c.auth.getUser();
    const user = data?.user;
    if (!user) throw new Error("Non authentifié");
    const { error } = await c.from("profiles").upsert({ id: user.id, full_name, updated_at: new Date().toISOString() });
    if (error) throw error;
  },
  async listProfiles() {
    const c = initSupabase();
    const { data, error } = await c.from("profiles").select("id, full_name");
    if (error) throw error;
    return data || [];
  },

  // ---------------- Collections CRUD ----------------
  // Chaque méthode renvoie les lignes "propres" (sans les métadonnées
  // exposées comme created_by/updated_by, pour un mapping 1:1 avec l'IDB).

  // Pagination via .range()+ tri stable (updated_at, id). Appelé page par
  // page par sync.js : { since, from, limit }.
  async list(store, { since, from = 0, limit = PULL_PAGE_SIZE } = {}) {
    const c = initSupabase();
    let q = c.from(store).select(LIGHT_COLUMNS[store] || "*");
    if (since) q = q.gte("updated_at", since);
    q = q.order("updated_at", { ascending: true }).order("id", { ascending: true });
    q = q.range(from, from + limit - 1);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  },

  // Workflow 4 statuts (P2.6) : lecture d'une ligne unique, pour ré-aligner
  // localement une fiche dont une transition a été refusée par le serveur.
  async get(store, id) {
    const c = initSupabase();
    const { data, error } = await c.from(store).select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data || null;
  },

  // Réconciliation de périmètre (sync.js) : liste paginée des SEULS ids
  // visibles par l'utilisateur connecté (RLS). Utilisée pour détecter les
  // lignes qui ont QUITTÉ le périmètre (réaffectation à un autre
  // technicien) : elles n'apparaissent plus dans le pull filtré par RLS.
  async listIds(store, from = 0, limit = 1000) {
    const c = initSupabase();
    const { data, error } = await c
      .from(store)
      .select("id")
      .order("updated_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + limit - 1);
    if (error) throw error;
    return (data || []).map((r) => r.id);
  },

  async upsert(store, row) {
    const c = initSupabase();
    // C8 : on demande le retour de la ligne écrite pour récupérer `updated_at`
    // tel que posé par le trigger serveur `set_updated_at` — l'horloge du
    // serveur est la référence pour la résolution de conflits. On ne sélectionne
    // que les petites colonnes : les lignes `photos` / `documents` contiennent
    // un `data_url` volumineux qu'il serait coûteux de renvoyer à chaque push.
    const { data, error } = await c.from(store).upsert(row).select(returnCols(store));
    if (error) throw error;
    return (data && data[0]) || null;
  },

  // SYNC-01 : contrôle optimiste au push. On ne pose la copie locale que si la
  // version serveur est toujours celle de base (`base_updated` — vue au moment
  // de la mise en file) : un `update ... where updated_at = base` retourne 0
  // ligne (sans erreur) si le serveur a évolué entre-temps. On relit alors la
  // ligne distante pour laisser le haut niveau trancher le conflit sans
  // écraser quoi que ce soit.
  async upsertIfUnchanged(store, row, baseUpdated) {
    const c = initSupabase();
    const payload = { ...row };
    delete payload.updated_at; // le trigger serveur `set_updated_at` fait foi
    const { data, error } = await c
      .from(store)
      .update(payload)
      .eq("id", row.id)
      .eq("updated_at", baseUpdated)
      .select(returnCols(store));
    if (error) throw error;
    if (data && data.length === 1) return { row: data[0], conflict: false, remote: null };
    // 0 ligne affectée : la ligne a changé côté serveur (conflit), ou n'existe
    // plus / n'est pas visible (suppression distante, RLS). On relit pour trancher.
    const { data: remote, error: err2 } = await c.from(store).select("*").eq("id", row.id).maybeSingle();
    if (err2) throw err2;
    if (!remote) {
      // Absente du serveur : rien à écraser → recréation par upsert standard.
      const created = await this.upsert(store, row);
      return { row: created, conflict: false, remote: null };
    }
    return { row: null, conflict: true, remote };
  },

  async get(store, id) {
    const c = initSupabase();
    const { data, error } = await c.from(store).select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data || null;
  },

  // SYNC-02 : récupère le binaire stocké dans Storage (bucket privé) et le
  // renvoie en dataURL, pour compléter localement une ligne tirée sans
  // data_url (self-healing hors ligne du pull).
  async getBinaryDataUrl(bucket, path) {
    const c = initSupabase();
    const { data, error } = await c.storage.from(bucket).createSignedUrl(path, 60);
    if (error) throw error;
    const res = await fetch(data.signedUrl);
    if (!res.ok) throw new Error(`Téléchargement Storage ${bucket}/${path} : HTTP ${res.status}`);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(r.error || new Error("Lecture du binaire échouée"));
      r.readAsDataURL(blob);
    });
  },

  async remove(store, id, updated_at) {
    const c = initSupabase();
    // Soft-delete : on marque deleted_at, plutôt qu'une suppression
    // définitive, pour que la synchronisation puisse propager la
    // suppression aux autres appareils sans perte.
    // SYNC-03 : un UPDATE bloqué par la RLS renvoie 0 ligne SANS ERREUR.
    // Sans vérification du nombre de lignes affectées, l'élément serait
    // considéré synchronisé à tort (suppression jamais propagée aux autres
    // appareils). On teste d'abord l'existence côté serveur : une ligne
    // jamais poussée n'a rien à supprimer (succès).
    const stamp = updated_at || new Date().toISOString();
    const { data: existing, error: errSel } = await c.from(store).select("id").eq("id", id).maybeSingle();
    if (errSel) throw errSel;
    if (!existing) return false;
    const { data, error } = await c.from(store).update({ deleted_at: stamp, updated_at: stamp }).eq("id", id).select("id");
    if (error) throw error;
    if (!data || data.length === 0) {
      throw new Error(`Suppression non appliquée (refus RLS ou ligne non modifiable) — ${store}/${id.slice(0, 8)}…`);
    }
    return true;
  },

  async rpc(name, params = {}) {
    const c = initSupabase();
    const { data, error } = await c.rpc(name, params);
    if (error) throw error;
    return data;
  },

  // ---------------- Storage (signatures) ----------------
  async uploadSignature(id, blob) {
    const c = initSupabase();
    const path = `${id}.png`;
    const { error } = await c.storage.from("signatures").upload(path, blob, {
      contentType: "image/png",
      upsert: true,
    });
    if (error) throw error;
    return c.storage.from("signatures").getPublicUrl(path).data.publicUrl;
  },

  // D2 : nettoyage des anciennes signatures. Accepte soit l'id d'upload
  // ("sig-client-123"), soit l'URL publique complète stockée dans
  // *_signature_url : on extrait le nom de l'objet après "/signatures/".
  async removeSignature(urlOrId) {
    const c = initSupabase();
    let path = String(urlOrId || "");
    if (path.includes("/signatures/")) path = path.split("/signatures/").pop();
    if (!path) return;
    if (!path.endsWith(".png")) path = `${path}.png`;
    const { error } = await c.storage.from("signatures").remove([path]);
    if (error) console.warn("Suppression ancienne signature échouée", error);
  },

  // ---------------- Storage (photos & documents — buckets privés V3) ----------------
  // Les buckets "photos" et "documents" sont privés : on conserve le chemin
  // de l'objet dans fichier_url (les données restent lisibles en local via
  // le dataURL/base64, ce qui préserve le mode offline-first).
  // SEC-02 / SEC-11 : chemin `{intervention_id}/{uuid}.ext` — le premier segment
  // identifie l'intervention, ce qui permet à la policy Storage de restreindre
  // la lecture au même périmètre que la table `photos`.
  async uploadPhoto(interventionId, dataUrl) {
    const c = initSupabase();
    const blob = await (await fetch(dataUrl)).blob();
    const path = `${interventionId}/${uuidV4()}.jpg`;
    const { error } = await c.storage.from("photos").upload(path, blob, {
      contentType: "image/jpeg",
      upsert: true,
    });
    if (error) throw error;
    return path;
  },

  async uploadDocument(interventionId, dataUrl) {
    const c = initSupabase();
    const blob = await (await fetch(dataUrl)).blob();
    const path = `${interventionId}/${uuidV4()}.pdf`;
    const { error } = await c.storage.from("documents").upload(path, blob, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (error) throw error;
    return path;
  },
};

window.Supabase = Supabase;
window.initSupabase = initSupabase;
