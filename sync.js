/* =========================================================
   Climat Elec — Couche de synchronisation (V2)
   Stratégie offline-first :
   - toutes les écritures passent d'abord par IndexedDB (locale) ;
   - une file de synchronisation pousse les changements vers Supabase
     dès que le réseau est disponible ;
   - le pull récupère les changements des autres appareils via supabase.js.
   - Gestion simple des conflits : "dernière écriture gagne" (updated_at).
   ========================================================= */

const SyncState = {
  running: false,
  lastPulledAt: null, // ISO
  queue: [],          // [{store, id}]
};

const SELF_CLIENT_FIELDS = ["created_at", "updated_at"];

// ---------------- File de synchronisation ----------------
function enqueueSync(store, id) {
  if (!Supabase.configured()) return;
  SyncState.queue = SyncState.queue.filter((q) => !(q.store === store && q.id === id));
  SyncState.queue.push({ store, id });
  scheduleSync();
}

let _syncTimer = null;
function scheduleSync() {
  if (_syncTimer) return;
  _syncTimer = setTimeout(() => {
    _syncTimer = null;
    runSync().catch((e) => console.warn("Sync échec", e));
  }, 400);
}

// ---------------- Pull : récupère les changements distants ----------------
async function pullChanges() {
  if (!Supabase.configured()) return;
  if (!navigator.onLine) throw new Error("navigator.offline");

  const since = SyncState.lastPulledAt;
  const stores = SYNC_STORES;

  for (const store of stores) {
    const rows = await Supabase.list(store, since || undefined);
    for (const row of rows) {
      await applyRemote(store, row);
    }
  }

  SyncState.lastPulledAt = new Date().toISOString();
}

async function applyRemote(store, remote) {
  const local = await DB.getRaw(store, remote.id);
  const isDeleted = !!remote.deleted_at;

  if (!local) {
    if (isDeleted) return; // déja absent, rien à faire
    await DB.putRaw(store, cleanRow(store, remote));
    return;
  }

  // Conflit : dernière écriture gagne (updated_at)
  const localTime = local.updated_at || local.created_at || "";
  const remoteTime = remote.updated_at || remote.created_at || "";
  if (remoteTime >= localTime || isDeleted) {
    if (isDeleted) {
      await DB.deleteRaw(store, remote.id);
    } else {
      await DB.putRaw(store, cleanRow(store, remote));
    }
  }
}

// ---------------- Push : envoie les changements locaux ----------------
async function pushChanges() {
  if (!Supabase.configured()) return;
  if (!navigator.onLine) return;

  const queue = [...SyncState.queue];
  SyncState.queue = [];

  for (const item of queue) {
    if (!navigator.onLine) throw new Error("navigator.offline");
    const record = await DB.getRecordForSync(item.store, item.id);
    if (!record) continue; // supprimé entre-temps

    if (record._deleted) {
      await Supabase.remove(item.store, item.id, record.updated_at);
    } else {
      await Supabase.upsert(item.store, cleanRow(item.store, record.payload));
    }
  }
}

// Nettoyage des champs purement locaux avant envoi.
function cleanRow(store, row) {
  const out = { ...row };
  delete out._deleted;
  delete out.client; // champ dénormalisé local (affichage)
  delete out.synced_at; // champ local (marque de sync), non présent côté SQL
  delete out.equipements; // tableaux imbriqués locaux (V1), désormais éclatés
  delete out.pieces;
  delete out.mesures; // tableaux imbriqués locaux (V3), stockés en tables filles
  delete out.photos;
  delete out.documents;
  delete out._brouillon;        // champs transitoires de brouillon
  delete out._client_sig_blob;  // Blob signature (non sérialisable / non stocké côté SQL)
  delete out._technicien_sig_blob;
  return out;
}

async function runSync() {
  if (SyncState.running) return;
  if (!Supabase.configured()) return;
  SyncState.running = true;
  try {
    if (navigator.onLine) {
      await pullChanges();
      await pushChanges();
    }
  } finally {
    SyncState.running = false;
  }
}

// Première synchronisation : met en file toutes les données locales
// (y compris celles créées avant la connexion) pour les pousser vers
// Supabase. S'appelle à la connexion pour rattraper l'historique local.
const SYNC_STORES = ["clients", "interventions", "equipements", "pieces_utilisees", "appels", "rendezvous", "mesures", "photos", "pieces", "documents", "contrats_entretien"];

async function pushAllLocal() {
  if (!Supabase.configured()) return;
  for (const store of SYNC_STORES) {
    const rows = await DB.listRaw(store);
    for (const row of rows) {
      enqueueSync(store, row.id);
    }
  }
}

// Écouteurs réseau : synchronisation automatique quand la connexion revient.
window.addEventListener("online", () => {
  runSync().catch((e) => console.warn("Sync échec", e));
});

// Realtime (optionnel) : re-pull à chaque changement distant.
function initRealtime() {
  const c = initSupabase();
  if (!c) return;
  try {
    ["clients", "interventions", "equipements", "pieces_utilisees"].forEach((store) => {
      c.channel(`realtime-${store}`).on(
        "postgres_changes",
        { event: "*", schema: "public", table: store },
        () => { runSync().catch((e) => console.warn("Sync échec", e)); }
      ).subscribe();
    });
  } catch (e) {
    console.warn("Realtime indisponible", e);
  }
}

window.Sync = { runSync, pullChanges, pushChanges, enqueueSync, initRealtime, scheduleSync, pushAllLocal, state: SyncState };
