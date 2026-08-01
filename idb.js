/* =========================================================
   Climat Elec — Couche de stockage IndexedDB
   Schéma pensé pour permettre une synchro Supabase en V2
   (id en UUID, timestamps, synced_at réservé mais inutilisé en V1)
   ========================================================= */
const DB_NAME = "climatelec-db";
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("clients")) {
        const store = db.createObjectStore("clients", { keyPath: "id" });
        store.createIndex("nom", "nom", { unique: false });
      }
      if (!db.objectStoreNames.contains("interventions")) {
        const store = db.createObjectStore("interventions", { keyPath: "id" });
        store.createIndex("client_id", "client_id", { unique: false });
        store.createIndex("date", "date", { unique: false });
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

const DB = {
  _db: null,
  async init() {
    this._db = await openDB();
    return this._db;
  },

  // ---------- Clients ----------
  async listClients() {
    const db = this._db;
    return new Promise((resolve, reject) => {
      const store = tx(db, "clients");
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result.sort((a, b) => a.nom.localeCompare(b.nom, "fr")));
      req.onerror = () => reject(req.error);
    });
  },
  async getClient(id) {
    const db = this._db;
    return new Promise((resolve, reject) => {
      const req = tx(db, "clients").get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  },
  async saveClient(client) {
    const db = this._db;
    const now = new Date().toISOString();
    if (!client.id) {
      client.id = uuid();
      client.created_at = now;
    }
    client.updated_at = now;
    client.synced_at = null;
    return new Promise((resolve, reject) => {
      const req = tx(db, "clients", "readwrite").put(client);
      req.onsuccess = () => resolve(client);
      req.onerror = () => reject(req.error);
    });
  },

  // ---------- Interventions ----------
  async listInterventions() {
    const db = this._db;
    return new Promise((resolve, reject) => {
      const req = tx(db, "interventions").getAll();
      req.onsuccess = () => {
        const rows = req.result.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
        resolve(rows);
      };
      req.onerror = () => reject(req.error);
    });
  },
  async getIntervention(id) {
    const db = this._db;
    return new Promise((resolve, reject) => {
      const req = tx(db, "interventions").get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  },
  async saveIntervention(itv) {
    const db = this._db;
    const now = new Date().toISOString();
    if (!itv.id) {
      itv.id = uuid();
      itv.created_at = now;
    }
    itv.updated_at = now;
    itv.synced_at = null;
    return new Promise((resolve, reject) => {
      const req = tx(db, "interventions", "readwrite").put(itv);
      req.onsuccess = () => resolve(itv);
      req.onerror = () => reject(req.error);
    });
  },
  async deleteIntervention(id) {
    const db = this._db;
    return new Promise((resolve, reject) => {
      const req = tx(db, "interventions", "readwrite").delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  },

  // ---------- Export complet (sauvegarde manuelle) ----------
  async exportAll() {
    const [clients, interventions] = await Promise.all([this.listClients(), this.listInterventions()]);
    return {
      exported_at: new Date().toISOString(),
      app: "climat-elec-interventions",
      version: 1,
      clients,
      interventions,
    };
  },
  async importAll(data) {
    const db = this._db;
    const cStore = tx(db, "clients", "readwrite");
    const iStore = tx(db, "interventions", "readwrite");
    (data.clients || []).forEach((c) => cStore.put(c));
    (data.interventions || []).forEach((i) => iStore.put(i));
    return true;
  },
};

window.DB = DB;
window.uuid = uuid;
