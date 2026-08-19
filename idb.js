/* =========================================================
   Climat Elec — Couche de stockage IndexedDB (V3)
   Adaptée à la synchronisation Supabase :
   - boutiques métier : clients, interventions, equipements,
     pieces_utilisees (V2), + appels, rendezvous, mesures,
     photos, pieces (base pièces), documents, contrats_entretien (V3) ;
   - _meta (auth local, compteurs de numérotation, file de sync) ;
   - tombstones : suppression logique (_deleted) pour propager
     les suppressions aux autres appareils.
   - id en UUID, timestamps, synced_at (renseigné après push).
   ========================================================= */
const DB_NAME = "climatelec-db";
const DB_VERSION = 3;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      const t = e.target.transaction;

      const ensure = (name, keyPath, indexes = []) => {
        if (!db.objectStoreNames.contains(name)) {
          const store = db.createObjectStore(name, { keyPath });
          indexes.forEach(([ix, key, opts]) => store.createIndex(ix, key, opts || {}));
        }
      };

      ensure("clients", "id", [["nom", "nom"], ["updated_at", "updated_at"]]);
      ensure("interventions", "id", [["client_id", "client_id"], ["date", "date"], ["updated_at", "updated_at"], ["statut_dossier", "statut_dossier"]]);
      ensure("equipements", "id", [["client_id", "client_id"], ["updated_at", "updated_at"]]);
      ensure("pieces_utilisees", "id", [["intervention_id", "intervention_id"], ["updated_at", "updated_at"]]);

      // ---- V3 : nouvelles boutiques ----
      ensure("appels", "id", [["updated_at", "updated_at"]]);
      ensure("rendezvous", "id", [["date", "date"], ["technicien_id", "technicien_id"], ["updated_at", "updated_at"]]);
      ensure("mesures", "id", [["intervention_id", "intervention_id"]]);
      ensure("photos", "id", [["intervention_id", "intervention_id"]]);
      ensure("pieces", "id", [["designation", "designation"]]);            // base pièces (désignation seule)
      ensure("documents", "id", [["intervention_id", "intervention_id"], ["type", "type"]]);
      ensure("contrats_entretien", "id", [["client_id", "client_id"], ["updated_at", "updated_at"]]);

      if (!db.objectStoreNames.contains("_meta")) db.createObjectStore("_meta");
      if (!db.objectStoreNames.contains("sync_state")) db.createObjectStore("sync_state");
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
  try {
    const done = await DB.getMeta("migrated_v2_split");
    if (done === "done") return;

    const interventions = await DB.listRaw("interventions");
    for (const itv of interventions) {
      const equipements = itv.equipements || [];
      const pieces = itv.pieces || [];
      let changed = false;

      if (Array.isArray(equipements) && equipements.length) {
        for (const eq of equipements) {
          const now = new Date().toISOString();
          await DB.putRaw("equipements", {
            ...eq,
            id: eq.id || uuid(),
            intervention_id: itv.id,
            created_at: eq.created_at || now,
            updated_at: eq.updated_at || now,
          });
        }
        delete itv.equipements;
        changed = true;
      }

      if (Array.isArray(pieces) && pieces.length) {
        for (const p of pieces) {
          const now = new Date().toISOString();
          await DB.putRaw("pieces_utilisees", {
            ...p,
            id: p.id || uuid(),
            intervention_id: itv.id,
            created_at: p.created_at || now,
            updated_at: p.updated_at || now,
          });
        }
        delete itv.pieces;
        changed = true;
      }

      if (changed) await DB.putRaw("interventions", itv);
    }

    await DB.setMeta("migrated_v2_split", "done");
  } catch (e) {
    console.warn("migrateV1toV2 ignoré", e);
  }
  try {
    await DB.setMeta("migrated", "v2");
  } catch (e) {
    // _meta déjà présent d'une version précédente
  }
}

// V2 -> V3 : ajoute statut_dossier par défaut sur l'existant.
async function migrateV2toV3() {
  try {
    const done = await DB.getMeta("migrated_v3_status");
    if (done === "done") return;
    const interventions = await DB.listRaw("interventions");
    for (const itv of interventions) {
      if (!itv.statut_dossier) {
        itv.statut_dossier = itv.statut === "terminee" ? "validee" : "a_valider";
        await DB.putRaw("interventions", itv);
      }
    }
    await DB.setMeta("migrated_v3_status", "done");
  } catch (e) {
    console.warn("migrateV2toV3 ignoré", e);
  }
}

const DB = {
  _db: null,
  async init() {
    this._db = await openDB();
    await migrateV1toV2();
    await migrateV2toV3();
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
  async getRecordForSync(store, id) {
    const row = await this.getRaw(store, id);
    if (!row) return null;
    const { _deleted, ...payload } = row;
    return { payload, updated_at: row.updated_at, _deleted: !!_deleted };
  },

  // ---------- Numérotation (référence unique) ----------
  // Format : PREFIX-AAAA-NNN (ex. FIC-2026-001, ENT-2026-001).
  async nextNumero(prefix = "FIC") {
    const year = new Date().getFullYear();
    const key = `numero_${prefix}_${year}`;
    const current = (await this.getMeta(key)) || 0;
    const next = current + 1;
    await this.setMeta(key, next);
    return `${prefix}-${year}-${String(next).padStart(3, "0")}`;
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
  // Retrouve un client par nom (insensible à la casse) ou le crée.
  async findOrCreateClientByName(client) {
    const nom = (client.nom || "").trim();
    if (!nom) return null;
    const existing = (await this.listClients()).find((c) => (c.nom || "").toLowerCase() === nom.toLowerCase());
    if (existing) return existing;
    return this.saveClient(client);
  },

  // ---------- Interventions ----------
  async listInterventions() {
    const rows = await this.listRaw("interventions");
    return rows.filter((i) => !i._deleted).sort((a, b) => (b.updated_at || b.created_at || "").localeCompare(a.updated_at || a.created_at || ""));
  },
  async getIntervention(id) {
    const i = await this.getRaw("interventions", id);
    if (!i || i._deleted) return null;
    i.equipements = await this.listEquipementsForIntervention(id);
    i.pieces = await this.listPiecesForIntervention(id);
    i.mesures = await this.listMesuresForIntervention(id);
    i.photos = await this.listPhotosForIntervention(id);
    i.documents = await this.listDocumentsForIntervention(id);
    if (!i.client) i.client = await this.getClient(i.client_id).then((c) => (c ? { nom: c.nom, ville: c.ville } : null));
    return i;
  },
  async saveIntervention(itv, { keepStatus = true } = {}) {
    const now = new Date().toISOString();
    const isNew = !itv.id;
    const asBrouillon = !!itv._brouillon;
    if (isNew) {
      itv.id = uuid();
      itv.created_at = now;
      if (!itv.numero) itv.numero = await this.nextNumero(itv.type_entretien ? "ENT" : "FIC");
    }
    itv.updated_at = now;
    itv.synced_at = null;

    // Statut dossier par défaut à la création (sauf brouillon explicite).
    if (isNew && !itv.statut_dossier) {
      itv.statut_dossier = asBrouillon ? "brouillon" : "a_valider";
    }

    // Extrait les tableaux imbriqués avant d'écrire l'intervention.
    const equipements = itv.equipements || [];
    const pieces = itv.pieces || [];
    const mesures = itv.mesures || [];
    const photos = itv.photos || [];
    const documents = itv.documents || [];
    delete itv.equipements;
    delete itv.pieces;
    delete itv.mesures;
    delete itv.photos;
    delete itv.documents;
    delete itv._brouillon;          // champs transitoires : non persistés
    delete itv._client_sig_blob;
    delete itv._technicien_sig_blob;

    await this.putRaw("interventions", itv);

    // Parent d'abord, enfants ensuite (contrainte de clé étrangère).
    if (Supabase?.configured()) Sync.enqueueSync("interventions", itv.id);

    // Écrit les enfants avec l'id de l'intervention.
    await this.replaceEquipements(itv.id, equipements);
    await this.replacePieces(itv.id, pieces);
    await this.replaceMesures(itv.id, mesures);
    await this.replacePhotos(itv.id, photos);
    if (documents.length) await this.replaceDocuments(itv.id, documents);

    // Réattache `client` dénormalisé pour l'affichage rapide.
    const saved = await this.getIntervention(itv.id);
    return saved;
  },
  async deleteIntervention(id) {
    const i = await this.getRaw("interventions", id);
    if (!i) return true;
    i._deleted = true;
    i.deleted_at = new Date().toISOString();
    i.updated_at = i.deleted_at;
    await this.putRaw("interventions", i);
    for (const eq of await this.listEquipementsForIntervention(id)) await this.deleteRaw("equipements", eq.id);
    for (const p of await this.listPiecesForIntervention(id)) await this.deleteRaw("pieces_utilisees", p.id);
    for (const m of await this.listMesuresForIntervention(id)) await this.deleteRaw("mesures", m.id);
    for (const ph of await this.listPhotosForIntervention(id)) await this.deleteRaw("photos", ph.id);
    for (const doc of await this.listDocumentsForIntervention(id)) await this.deleteRaw("documents", doc.id);
    if (Supabase?.configured()) Sync.enqueueSync("interventions", id);
    return true;
  },
  // Transition de statut dossier (simple raccourci qui conserve tout le reste).
  async setStatutDossier(id, statut) {
    const i = await this.getRaw("interventions", id);
    if (!i) return null;
    i.statut_dossier = statut;
    i.updated_at = new Date().toISOString();
    i.synced_at = null;
    await this.putRaw("interventions", i);
    if (Supabase?.configured()) Sync.enqueueSync("interventions", id);
    return this.getIntervention(id);
  },

  // ---------- Équipements (historisés par client) ----------
  async listEquipementsForIntervention(interventionId) {
    const rows = await this.listRaw("equipements");
    return rows.filter((e) => !e._deleted && e.intervention_id === interventionId);
  },
  async listEquipementsForClient(clientId) {
    const rows = await this.listRaw("equipements");
    return rows.filter((e) => !e._deleted && e.client_id === clientId && !e.intervention_id);
  },
  async replaceEquipements(interventionId, list) {
    const existing = await this.listRaw("equipements");
    for (const e of existing.filter((x) => x.intervention_id === interventionId)) {
      await this.deleteRaw("equipements", e.id);
    }
    for (const eq of list) {
      const now = new Date().toISOString();
      const row = { ...eq, id: eq.id || uuid(), intervention_id: interventionId, created_at: now, updated_at: now };
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

  // ---------- Base pièces (V3 — désignation seule) ----------
  async listPiecesBase() {
    const rows = await this.listRaw("pieces");
    return rows.filter((p) => !p._deleted).sort((a, b) => (a.designation || "").localeCompare(b.designation || "", "fr"));
  },
  async savePieceBase(designation) {
    const d = (designation || "").trim();
    if (!d) return null;
    const existing = await this.listPiecesBase();
    const found = existing.find((p) => p.designation.toLowerCase() === d.toLowerCase());
    if (found) return found;
    const now = new Date().toISOString();
    const row = { id: uuid(), designation: d, created_at: now, updated_at: now };
    await this.putRaw("pieces", row);
    if (Supabase?.configured()) Sync.enqueueSync("pieces", row.id);
    return row;
  },
  async deletePieceBase(id) {
    const p = await this.getRaw("pieces", id);
    if (!p) return true;
    p._deleted = true;
    p.deleted_at = new Date().toISOString();
    p.updated_at = p.deleted_at;
    await this.putRaw("pieces", p);
    if (Supabase?.configured()) Sync.enqueueSync("pieces", id);
    return true;
  },

  // ---------- Mesures (fiches d'entretien) ----------
  async listMesuresForIntervention(interventionId) {
    const rows = await this.listRaw("mesures");
    return rows.filter((m) => !m._deleted && m.intervention_id === interventionId);
  },
  async replaceMesures(interventionId, list) {
    const existing = await this.listRaw("mesures");
    for (const m of existing.filter((x) => x.intervention_id === interventionId)) {
      await this.deleteRaw("mesures", m.id);
    }
    for (const m of list) {
      const now = new Date().toISOString();
      const row = { ...m, id: m.id || uuid(), intervention_id: interventionId, created_at: now, updated_at: now };
      await this.putRaw("mesures", row);
      if (Supabase?.configured()) Sync.enqueueSync("mesures", row.id);
    }
  },

  // ---------- Photos (V3) ----------
  async listPhotosForIntervention(interventionId) {
    const rows = await this.listRaw("photos");
    return rows.filter((p) => !p._deleted && p.intervention_id === interventionId);
  },
  async replacePhotos(interventionId, list) {
    const existing = await this.listRaw("photos");
    for (const p of existing.filter((x) => x.intervention_id === interventionId)) {
      await this.deleteRaw("photos", p.id);
    }
    for (const p of list) {
      const now = new Date().toISOString();
      const row = { ...p, id: p.id || uuid(), intervention_id: interventionId, created_at: now, updated_at: now };
      await this.putRaw("photos", row);
      if (Supabase?.configured()) Sync.enqueueSync("photos", row.id);
    }
  },

  // ---------- Documents (devis / facture / contrat importés) ----------
  async listDocumentsForIntervention(interventionId) {
    const rows = await this.listRaw("documents");
    return rows.filter((d) => !d._deleted && d.intervention_id === interventionId);
  },
  async replaceDocuments(interventionId, list) {
    const existing = await this.listRaw("documents");
    for (const d of existing.filter((x) => x.intervention_id === interventionId)) {
      await this.deleteRaw("documents", d.id);
    }
    for (const d of list) {
      const now = new Date().toISOString();
      const row = { ...d, id: d.id || uuid(), intervention_id: interventionId, created_at: now, updated_at: now };
      await this.putRaw("documents", row);
      if (Supabase?.configured()) Sync.enqueueSync("documents", row.id);
    }
  },
  async addDocument(interventionId, doc) {
    const now = new Date().toISOString();
    const row = { ...doc, id: doc.id || uuid(), intervention_id: interventionId, created_at: now, updated_at: now };
    await this.putRaw("documents", row);
    if (Supabase?.configured()) Sync.enqueueSync("documents", row.id);
    return row;
  },
  async deleteDocument(id) {
    const d = await this.getRaw("documents", id);
    if (!d) return true;
    d._deleted = true;
    d.deleted_at = new Date().toISOString();
    d.updated_at = d.deleted_at;
    await this.putRaw("documents", d);
    if (Supabase?.configured()) Sync.enqueueSync("documents", id);
    return true;
  },

  // ---------- Appels (V3 — US-01) ----------
  async listAppels() {
    const rows = await this.listRaw("appels");
    return rows.filter((a) => !a._deleted).sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  },
  async saveAppel(appel) {
    const now = new Date().toISOString();
    if (!appel.id) {
      appel.id = uuid();
      appel.created_at = now;
    }
    appel.updated_at = now;
    appel.synced_at = null;
    await this.putRaw("appels", appel);
    if (Supabase?.configured()) Sync.enqueueSync("appels", appel.id);
    return appel;
  },
  async deleteAppel(id) {
    const a = await this.getRaw("appels", id);
    if (!a) return true;
    a._deleted = true;
    a.deleted_at = new Date().toISOString();
    a.updated_at = a.deleted_at;
    await this.putRaw("appels", a);
    if (Supabase?.configured()) Sync.enqueueSync("appels", id);
    return true;
  },

  // ---------- Rendez-vous (V3 — US-02) ----------
  async listRendezvous() {
    const rows = await this.listRaw("rendezvous");
    return rows.filter((r) => !r._deleted).sort((a, b) => (a.date || "").localeCompare(b.date || "") || (a.heure_debut || "").localeCompare(b.heure_debut || ""));
  },
  async saveRendezvous(rdv) {
    const now = new Date().toISOString();
    if (!rdv.id) {
      rdv.id = uuid();
      rdv.created_at = now;
    }
    rdv.updated_at = now;
    rdv.synced_at = null;
    await this.putRaw("rendezvous", rdv);
    if (Supabase?.configured()) Sync.enqueueSync("rendezvous", rdv.id);
    return rdv;
  },
  async deleteRendezvous(id) {
    const r = await this.getRaw("rendezvous", id);
    if (!r) return true;
    r._deleted = true;
    r.deleted_at = new Date().toISOString();
    r.updated_at = r.deleted_at;
    await this.putRaw("rendezvous", r);
    if (Supabase?.configured()) Sync.enqueueSync("rendezvous", id);
    return true;
  },

  // ---------- Contrats d'entretien (V3 — US-24) ----------
  async listContrats() {
    const rows = await this.listRaw("contrats_entretien");
    return rows.filter((c) => !c._deleted).sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  },
  async saveContrat(contrat) {
    const now = new Date().toISOString();
    if (!contrat.id) {
      contrat.id = uuid();
      contrat.created_at = now;
    }
    contrat.updated_at = now;
    contrat.synced_at = null;
    await this.putRaw("contrats_entretien", contrat);
    if (Supabase?.configured()) Sync.enqueueSync("contrats_entretien", contrat.id);
    return contrat;
  },
  async deleteContrat(id) {
    const c = await this.getRaw("contrats_entretien", id);
    if (!c) return true;
    c._deleted = true;
    c.deleted_at = new Date().toISOString();
    c.updated_at = c.deleted_at;
    await this.putRaw("contrats_entretien", c);
    if (Supabase?.configured()) Sync.enqueueSync("contrats_entretien", id);
    return true;
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
    const [clients, interventions, equipements, pieces, appels, rendezvous, mesures, photos, piecesBase, documents, contrats] = await Promise.all([
      this.listClients(),
      this.listInterventions(),
      this.listRaw("equipements"),
      this.listRaw("pieces_utilisees"),
      this.listAppels(),
      this.listRendezvous(),
      this.listRaw("mesures"),
      this.listRaw("photos"),
      this.listPiecesBase(),
      this.listRaw("documents"),
      this.listContrats(),
    ]);
    return {
      exported_at: new Date().toISOString(),
      app: "climat-elec-interventions",
      version: 3,
      clients,
      interventions,
      equipements,
      pieces_utilisees: pieces,
      appels,
      rendezvous,
      mesures,
      photos,
      pieces: piecesBase,
      documents,
      contrats_entretien: contrats,
    };
  },
  async importAll(data) {
    (data.clients || []).forEach((c) => this.putRaw("clients", c));
    (data.interventions || []).forEach((i) => this.putRaw("interventions", i));
    (data.equipements || []).forEach((e) => this.putRaw("equipements", e));
    (data.pieces_utilisees || []).forEach((p) => this.putRaw("pieces_utilisees", p));
    (data.appels || []).forEach((a) => this.putRaw("appels", a));
    (data.rendezvous || []).forEach((r) => this.putRaw("rendezvous", r));
    (data.mesures || []).forEach((m) => this.putRaw("mesures", m));
    (data.photos || []).forEach((p) => this.putRaw("photos", p));
    (data.pieces || []).forEach((p) => this.putRaw("pieces", p));
    (data.documents || []).forEach((d) => this.putRaw("documents", d));
    (data.contrats_entretien || []).forEach((c) => this.putRaw("contrats_entretien", c));
    return true;
  },
};

window.DB = DB;
window.uuid = uuid;
