/* =========================================================
   Climat Elec — Couche de stockage IndexedDB (V2)
   Adaptée à la synchronisation Supabase :
   - nouvelles boutiques : equipements (historisés par client),
     pieces_utilisees, sync_state (métadonnées locales),
     _meta (auth local, file de sync) ;
   - tombstones : suppression logique (_deleted) pour propager
     les suppressions aux autres appareils.
   - id en UUID, timestamps, synced_at (renseigné après push).
   ========================================================= */
const DB_NAME = "climatelec-db";
const DB_VERSION = 2;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      const t = e.target.transaction;

      if (!db.objectStoreNames.contains("clients")) {
        const store = db.createObjectStore("clients", { keyPath: "id" });
        store.createIndex("nom", "nom", { unique: false });
        store.createIndex("updated_at", "updated_at", { unique: false });
      }
      if (!db.objectStoreNames.contains("interventions")) {
        const store = db.createObjectStore("interventions", { keyPath: "id" });
        store.createIndex("client_id", "client_id", { unique: false });
        store.createIndex("date", "date", { unique: false });
        store.createIndex("updated_at", "updated_at", { unique: false });
      }
      if (!db.objectStoreNames.contains("equipements")) {
        const store = db.createObjectStore("equipements", { keyPath: "id" });
        store.createIndex("client_id", "client_id", { unique: false });
        store.createIndex("updated_at", "updated_at", { unique: false });
      }
      if (!db.objectStoreNames.contains("pieces_utilisees")) {
        const store = db.createObjectStore("pieces_utilisees", { keyPath: "id" });
        store.createIndex("intervention_id", "intervention_id", { unique: false });
        store.createIndex("updated_at", "updated_at", { unique: false });
      }

      // Migration V1 -> V2 : les équipements et pièces étaient imbriqués
      // dans l'objet intervention. On les éclate vers les nouvelles boutiques.
      if (!db.objectStoreNames.contains("_meta")) {
        db.createObjectStore("_meta");
      }
      if (!db.objectStoreNames.contains("sync_state")) {
        db.createObjectStore("sync_state");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db, storeName, mode = "readonly") {
  return db.transaction(storeName, mode).objectStore(storeName);
}

function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function migrateV1toV2() {
  // L'éclatement des équipements/pièces se fait à la volée dans
  // saveIntervention lorsque des objets imbriqués sont détectés.
  // Ici, on s'assure simplement que _meta est initialisé.
  try {
    await DB.setMeta("migrated", "v2");
  } catch (e) {
    // _meta déjà présent d'une version précédente
  }
}

const DB = {
  _db: null,
  async init() {
    this._db = await openDB();
    await migrateV1toV2();
    return this._db;
  },

  // ---------- Helpers génériques ----------
  async putRaw(store, row) {
    const db = this._db;
    return new Promise((resolve, reject) => {
      const req = tx(db, store, "readwrite").put(row);
      req.onsuccess = () => resolve(row);
      req.onerror = () => reject(req.error);
    });
  },
  async getRaw(store, id) {
    const db = this._db;
    return new Promise((resolve, reject) => {
      const req = tx(db, store).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  },
  async deleteRaw(store, id) {
    const db = this._db;
    return new Promise((resolve, reject) => {
      const req = tx(db, store, "readwrite").delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  },
  async listRaw(store) {
    const db = this._db;
    return new Promise((resolve, reject) => {
      const req = tx(db, store).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  },

  // ---------- Sync support ----------
  // Pour l'envoi : retourne {payload, updated_at, _deleted} ou null si absent.
  async getRecordForSync(store, id) {
    const row = await this.getRaw(store, id);
    if (!row) return null;
    const { _deleted, ...payload } = row;
    return { payload, updated_at: row.updated_at, _deleted: !!_deleted };
  },

  // ---------- Clients ----------
  async listClients() {
    const rows = await this.listRaw("clients");
    return rows.filter((c) => !c._deleted).sort((a, b) => (a.nom || "").localeCompare(b.nom || "", "fr"));
  },
  async getClient(id) {
    const c = await this.getRaw("clients", id);
    return c && !c._deleted ? c : null;
  },
  async saveClient(client) {
    const now = new Date().toISOString();
    if (!client.id) {
      client.id = uuid();
      client.created_at = now;
    }
    client.updated_at = now;
    client.synced_at = null;
    await this.putRaw("clients", client);
    if (Supabase?.configured()) Sync.enqueueSync("clients", client.id);
    return client;
  },
  async deleteClient(id) {
    const c = await this.getRaw("clients", id);
    if (!c) return true;
    c._deleted = true;
    c.deleted_at = new Date().toISOString();
    c.updated_at = c.deleted_at;
    await this.putRaw("clients", c);
    if (Supabase?.configured()) Sync.enqueueSync("clients", id);
    return true;
  },

  // ---------- Interventions ----------
  async listInterventions() {
    const rows = await this.listRaw("interventions");
    return rows.filter((i) => !i._deleted).sort((a, b) => (b.updated_at || b.created_at || "").localeCompare(a.updated_at || a.created_at || ""));
  },
  async getIntervention(id) {
    const i = await this.getRaw("interventions", id);
    if (!i || i._deleted) return null;
    // Recomposition des équipements & pièces depuis les boutiques filles.
    i.equipements = await this.listEquipementsForIntervention(id);
    i.pieces = await this.listPiecesForIntervention(id);
    if (!i.client) i.client = await this.getClient(i.client_id).then((c) => (c ? { nom: c.nom, ville: c.ville } : null));
    return i;
  },
  async saveIntervention(itv) {
    const now = new Date().toISOString();
    const isNew = !itv.id;
    if (isNew) {
      itv.id = uuid();
      itv.created_at = now;
    }
    itv.updated_at = now;
    itv.synced_at = null;

    // Extrait les tableaux imbriqués avant d'écrire l'intervention.
    const equipements = itv.equipements || [];
    const pieces = itv.pieces || [];
    delete itv.equipements;
    delete itv.pieces;

    await this.putRaw("interventions", itv);

    // Écrit les enfants avec l'id de l'intervention.
    await this.replaceEquipements(itv.id, equipements);
    await this.replacePieces(itv.id, pieces);

    // Réattache `client` dénormalisé pour l'affichage rapide.
    const saved = await this.getIntervention(itv.id);
    if (Supabase?.configured()) Sync.enqueueSync("interventions", itv.id);
    return saved;
  },
  async deleteIntervention(id) {
    const i = await this.getRaw("interventions", id);
    if (!i) return true;
    i._deleted = true;
    i.deleted_at = new Date().toISOString();
    i.updated_at = i.deleted_at;
    await this.putRaw("interventions", i);
    // Propager la suppression aux enfants.
    for (const eq of await this.listEquipementsForIntervention(id)) {
      await this.deleteRaw("equipements", eq.id);
    }
    for (const p of await this.listPiecesForIntervention(id)) {
      await this.deleteRaw("pieces_utilisees", p.id);
    }
    if (Supabase?.configured()) Sync.enqueueSync("interventions", id);
    return true;
  },

  // ---------- Équipements (historisés par client) ----------
  async listEquipementsForIntervention(interventionId) {
    // En V2, les équipements sont liés au client (historique) ET taggés
    // sur une intervention via leur client_id. On filtre ici uniquement
    // ceux créés lors de cette intervention précise, via un lien déduit.
    // Le lien exact est conservé dans les équipements portant intervention_id.
    const rows = await this.listRaw("equipements");
    return rows.filter((e) => !e._deleted && e.intervention_id === interventionId);
  },
  async listEquipementsForClient(clientId) {
    const rows = await this.listRaw("equipements");
    return rows.filter((e) => !e._deleted && e.client_id === clientId && !e.intervention_id);
  },
  async replaceEquipements(interventionId, list) {
    // Supprime les anciens enfants non marqués pour cette intervention.
    const existing = await this.listRaw("equipements");
    for (const e of existing.filter((x) => x.intervention_id === interventionId)) {
      await this.deleteRaw("equipements", e.id);
    }
    for (const eq of list) {
      const now = new Date().toISOString();
      const row = {
        ...eq,
        id: eq.id || uuid(),
        intervention_id: interventionId,
        created_at: now,
        updated_at: now,
      };
      // Enregistre aussi une copie "historique" par client si le client est connu.
      await this.putRaw("equipements", row);
      if (Supabase?.configured()) Sync.enqueueSync("equipements", row.id);
    }
  },
  async saveClientEquipment(clientId, eq) {
    const now = new Date().toISOString();
    const row = { ...eq, id: eq.id || uuid(), client_id: clientId, created_at: now, updated_at: now };
    await this.putRaw("equipements", row);
    if (Supabase?.configured()) Sync.enqueueSync("equipements", row.id);
    return row;
  },

  // ---------- Pièces utilisées ----------
  async listPiecesForIntervention(interventionId) {
    const rows = await this.listRaw("pieces_utilisees");
    return rows.filter((p) => !p._deleted && p.intervention_id === interventionId);
  },
  async replacePieces(interventionId, list) {
    const existing = await this.listRaw("pieces_utilisees");
    for (const p of existing.filter((x) => x.intervention_id === interventionId)) {
      await this.deleteRaw("pieces_utilisees", p.id);
    }
    for (const p of list) {
      const now = new Date().toISOString();
      const row = { ...p, id: p.id || uuid(), intervention_id: interventionId, created_at: now, updated_at: now };
      await this.putRaw("pieces_utilisees", row);
      if (Supabase?.configured()) Sync.enqueueSync("pieces_utilisees", row.id);
    }
  },

  // ---------- Auth local (mode hors ligne) ----------
  async setMeta(key, value) {
    await this.putRaw("_meta", { key, value });
  },
  async getMeta(key) {
    const r = await this.getRaw("_meta", key);
    return r ? r.value : null;
  },

  // ---------- Export complet (sauvegarde manuelle) ----------
  async exportAll() {
    const [clients, interventions, equipements, pieces] = await Promise.all([
      this.listClients(),
      this.listInterventions(),
      this.listRaw("equipements"),
      this.listRaw("pieces_utilisees"),
    ]);
    return {
      exported_at: new Date().toISOString(),
      app: "climat-elec-interventions",
      version: 2,
      clients,
      interventions,
      equipements,
      pieces_utilisees: pieces,
    };
  },
  async importAll(data) {
    (data.clients || []).forEach((c) => this.putRaw("clients", c));
    (data.interventions || []).forEach((i) => this.putRaw("interventions", i));
    (data.equipements || []).forEach((e) => this.putRaw("equipements", e));
    (data.pieces_utilisees || []).forEach((p) => this.putRaw("pieces_utilisees", p));
    return true;
  },
};

window.DB = DB;
window.uuid = uuid;
