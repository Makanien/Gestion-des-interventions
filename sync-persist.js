/* =========================================================
   Climat Elec — Persistance de l'état de synchronisation (SYNC-01 / SYNC-02)
   La file de sync, le curseur de pull et les conflits sont persistés dans
   IndexedDB (stores `sync_queue` / `sync_cursor`, cf. idb.js) pour survivre
   à un rechargement de l'application.
   ========================================================= */

const SyncStore = {
  // ---------- File de sync persistée ----------
  // Un élément = { store, id, base_updated_at } — `id` est la clé du store
  // IndexedDB (UUID de la ligne métier, unique).
  async loadQueue() {
    try {
      const rows = await DB.listRaw("sync_queue");
      return rows.filter((r) => r && r.store && r.id);
    } catch (e) {
      console.warn("Chargement file de sync échoué", e);
      return [];
    }
  },
  async saveQueue(queue) {
    try {
      // On purge le store puis on récrit la file entière (petite taille).
      const existing = await DB.listRaw("sync_queue");
      for (const r of existing) {
        await DB.deleteRaw("sync_queue", r.id);
      }
      for (const item of queue) await DB.putRaw("sync_queue", { ...item });
    } catch (e) {
      console.warn("Sauvegarde file de sync échouée", e);
    }
  },
  async enqueuePersisted(item) {
    try {
      await DB.putRaw("sync_queue", { ...item });
    } catch (e) {
      console.warn("enqueuePersisted échoué", e);
    }
  },
  async removePersisted(id) {
    try {
      await DB.deleteRaw("sync_queue", id);
    } catch (e) {
      console.warn("removePersisted échoué", e);
    }
  },

  // ---------- Curseur de pull + conflits (store sync_cursor, clé "key") ----------
  async loadCursor() {
    try {
      const r = await DB.getRaw("sync_cursor", "lastPulledAt");
      return r ? r.value : null;
    } catch (e) {
      console.warn("Chargement curseur échoué", e);
      return null;
    }
  },
  async saveCursor(iso) {
    try {
      await DB.putRaw("sync_cursor", { key: "lastPulledAt", value: iso });
    } catch (e) {
      console.warn("Sauvegarde curseur échouée", e);
    }
  },
  async loadConflicts() {
    try {
      const r = await DB.getRaw("sync_cursor", "conflicts");
      return r && Array.isArray(r.value) ? r.value : [];
    } catch (e) {
      console.warn("Chargement des conflits échoué", e);
      return [];
    }
  },
  async saveConflicts(list) {
    try {
      await DB.putRaw("sync_cursor", { key: "conflicts", value: list });
    } catch (e) {
      console.warn("Sauvegarde des conflits échouée", e);
    }
  },
};

window.SyncStore = SyncStore;
