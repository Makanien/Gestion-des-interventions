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
        storageKey: "climatelec-auth",
      },
    });
  }
  return SB;
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

  // ---------------- Collections CRUD ----------------
  // Chaque méthode renvoie les lignes "propres" (sans les métadonnées
  // exposées comme created_by/updated_by, pour un mapping 1:1 avec l'IDB).

  async list(store, sinceISO) {
    const c = initSupabase();
    let q = c.from(store).select("*");
    if (sinceISO) q = q.gte("updated_at", sinceISO);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  },

  async upsert(store, row) {
    const c = initSupabase();
    const { error } = await c.from(store).upsert(row);
    if (error) throw error;
  },

  async remove(store, id, updated_at) {
    const c = initSupabase();
    // Soft-delete : on marque deleted_at, plutôt qu'une suppression
    // définitive, pour que la synchronisation puisse propager la
    // suppression aux autres appareils sans perte.
    const { error } = await c.from(store).update({ deleted_at: updated_at || new Date().toISOString(), updated_at: updated_at || new Date().toISOString() }).eq("id", id);
    if (error) throw error;
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

  async removeSignature(id) {
    const c = initSupabase();
    await c.storage.from("signatures").remove([`${id}.png`]);
  },

  // ---------------- Storage (photos & documents — buckets privés V3) ----------------
  // Les buckets "photos" et "documents" sont privés : on conserve le chemin
  // de l'objet dans fichier_url (les données restent lisibles en local via
  // le dataURL/base64, ce qui préserve le mode offline-first).
  async uploadPhoto(id, dataUrl) {
    const c = initSupabase();
    const blob = await (await fetch(dataUrl)).blob();
    const path = `${id}.jpg`;
    const { error } = await c.storage.from("photos").upload(path, blob, {
      contentType: "image/jpeg",
      upsert: true,
    });
    if (error) throw error;
    return path;
  },

  async uploadDocument(id, dataUrl) {
    const c = initSupabase();
    const blob = await (await fetch(dataUrl)).blob();
    const path = `${id}.pdf`;
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
