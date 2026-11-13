// BP-02 — Faux serveur Supabase en mémoire, partagé par plusieurs « appareils ».
// Reproduit les deux comportements qui comptent pour la synchro :
//  - `updated_at` posé par le SERVEUR à chaque écriture (trigger set_updated_at) ;
//  - mise à jour conditionnelle `where updated_at = base` (upsertIfUnchanged).
function createFakeServer() {
  let clock = Date.parse("2026-11-01T08:00:00.000Z");
  const tables = new Map(); // store -> Map(id -> row)
  const tick = () => new Date((clock += 1000)).toISOString();
  const table = (s) => (tables.has(s) ? tables.get(s) : tables.set(s, new Map()).get(s));
  const failures = { next: null }; // erreur à lever au prochain appel

  const maybeFail = () => {
    if (failures.next) {
      const e = failures.next;
      failures.next = null;
      throw e;
    }
  };

  const api = {
    // Côté test
    rows: (store) => [...table(store).values()],
    row: (store, id) => table(store).get(id) || null,
    failNext: (err) => (failures.next = err),
    // Écriture directe « d'un autre appareil » (hors file de sync) :
    serverWrite(store, row) {
      const saved = { ...table(store).get(row.id), ...row, updated_at: tick() };
      table(store).set(row.id, saved);
      return saved;
    },
    // Interface Supabase attendue par sync.js
    client(extra = {}) {
      return {
        configured: () => true,
        async upsert(store, row) {
          maybeFail();
          const saved = { ...table(store).get(row.id), ...row, updated_at: tick() };
          table(store).set(row.id, saved);
          return { ...saved };
        },
        async upsertIfUnchanged(store, row, base) {
          maybeFail();
          const current = table(store).get(row.id);
          if (!current) return { row: await this.upsert(store, row), conflict: false, remote: null };
          if (current.updated_at !== base) return { row: null, conflict: true, remote: { ...current } };
          const saved = { ...current, ...row, updated_at: tick() };
          table(store).set(row.id, saved);
          return { row: { ...saved }, conflict: false, remote: null };
        },
        async remove(store, id) {
          maybeFail();
          const current = table(store).get(id);
          if (current) table(store).set(id, { ...current, deleted_at: tick() });
        },
        // Pull paginé : tri stable (updated_at, id), filtre `updated_at >= since`.
        async list(store, { since, from = 0, limit = 500 } = {}) {
          maybeFail();
          const rows = [...table(store).values()]
            .filter((r) => !since || r.updated_at >= since)
            .sort((a, b) => (a.updated_at < b.updated_at ? -1 : a.updated_at > b.updated_at ? 1 : a.id < b.id ? -1 : 1));
          return rows.slice(from, from + limit).map((r) => ({ ...r }));
        },
        async listIds(store, from = 0, limit = 1000) {
          return [...table(store).keys()].slice(from, from + limit);
        },
        async get(store, id) {
          const r = table(store).get(id);
          return r ? { ...r } : null;
        },
        ...extra,
      };
    },
  };
  return api;
}

module.exports = { createFakeServer };
