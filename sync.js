/* =========================================================
   Climat Elec — Couche de synchronisation (V2)
   Stratégie offline-first :
   - toutes les écritures passent d'abord par IndexedDB (locale) ;
   - une file de synchronisation pousse les changements vers Supabase
     dès que le réseau est disponible ;
   - le pull récupère les changements des autres appareils via supabase.js.
   - Gestion simple des conflits : "dernière écriture gagne" (updated_at).
     L'horodatage comparé est celui de l'horloge serveur : à chaque push,
     l'upsert retourne la valeur posée par le trigger `set_updated_at` et la
     copie locale est alignée dessus (C8). Les modifications locales pas encore
     poussées (encore dans la file) l'emportent toujours localement, pour ne
     jamais perdre une saisie hors ligne avant son envoi.
   ========================================================= */

const SyncState = {
  running: false,
  lastPulledAt: null, // ISO
  queue: [],          // [{store, id}]
  realtimeStarted: false,
};

// ---------------- File de synchronisation ----------------
function enqueueSync(store, id) {
  if (!Supabase.configured()) return;
  SyncState.queue = SyncState.queue.filter((q) => !(q.store === store && q.id === id));
  SyncState.queue.push({ store, id });
  updatePendingUI();
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

  // C8 : une modification locale pas encore poussée (toujours dans la file de
  // sync, ex. saisie faite hors ligne) doit l'emporter localement. Son
  // horodatage suit l'horloge du mobile et n'est pas comparable à l'horloge
  // serveur avant alignement au push : l'écraser pendant le pull ferait perdre
  // la saisie de l'utilisateur.
  const isPending = SyncState.queue.some((q) => q.store === store && q.id === remote.id);
  if (isPending) return;

  // Conflit : dernière écriture gagne (updated_at)

  const localTime = local.updated_at || local.created_at || "";
  const remoteTime = remote.updated_at || remote.created_at || "";
  if (remoteTime >= localTime || isDeleted) {
    if (isDeleted) {
      await DB.deleteRaw(store, remote.id);
    } else {
      await DB.putRaw(store, mergeRemote(store, local, remote));
    }
  }
}

// P4 : un dataURL de signature (capturé hors ligne) reste local tant qu'aucune
// URL Storage n'existe côté serveur. On le préserve lors du pull pour ne pas
// perdre l'affichage de la signature hors ligne (le remote a alors un null).
function mergeRemote(store, local, remote) {
  const cleaned = cleanRow(store, remote);
  if (store === "interventions" || store === "contrats_entretien") {
    if (!cleaned.client_signature_url && local.client_signature_url && local.client_signature_url.startsWith("data:")) {
      cleaned.client_signature_url = local.client_signature_url;
    }
    if (!cleaned.technicien_signature_url && local.technicien_signature_url && local.technicien_signature_url.startsWith("data:")) {
      cleaned.technicien_signature_url = local.technicien_signature_url;
    }
  }
  return cleaned;
}

// C4 : upload différé des signatures capturées hors ligne.
// Tant que le réseau est indisponible, la signature reste un dataURL local
// (persisté dans client_signature_url / technicien_signature_url). Dès que la
// connexion revient, on convertit le dataURL en Blob, on l'upload vers Storage
// et on remplace le dataURL par l'URL publique, puis on remet la ligne en file
// pour la pousser. Fonctionne aussi après rechargement (le dataURL persiste).
async function uploadPendingSignatures() {
  if (!Supabase.configured() || !navigator.onLine) return;
  for (const store of ["interventions", "contrats_entretien"]) {
    const rows = await DB.listRaw(store);
    for (const row of rows) {
      if (row._deleted) continue;
      let changed = false;
      if (row.client_signature_url && row.client_signature_url.startsWith("data:")) {
        try {
          const blob = await (await fetch(row.client_signature_url)).blob();
          row.client_signature_url = await Supabase.uploadSignature(`sig-client-${row.id}`, blob);
          delete row._client_sig_blob;
          changed = true;
        } catch (e) { console.warn("Upload différé signature client échoué", e); }
      }
      if (row.technicien_signature_url && row.technicien_signature_url.startsWith("data:")) {
        try {
          const blob = await (await fetch(row.technicien_signature_url)).blob();
          row.technicien_signature_url = await Supabase.uploadSignature(`sig-tech-${row.id}`, blob);
          delete row._technicien_sig_blob;
          changed = true;
        } catch (e) { console.warn("Upload différé signature technicien échoué", e); }
      }
      if (changed) {
        await DB.putRaw(store, row);
        enqueueSync(store, row.id);
      }
    }
  }
}

// ---------------- Push : envoie les changements locaux ----------------
// Ne retire de la file que les éléments réellement envoyés : si le réseau
// coupe en plein push, le reste est remis en file pour une tentative suivante
// (au lieu d'être perdu jusqu'au prochain sign-in).
async function pushChanges() {
  if (!Supabase.configured()) return;
  if (!navigator.onLine) return;

  const queue = [...SyncState.queue];
  SyncState.queue = [];

  const pending = [];
  let stopped = false;

  for (const item of queue) {
    if (stopped) { pending.push(item); continue; }
    if (!navigator.onLine) { stopped = true; pending.push(item); continue; }
    try {
      const record = await DB.getRecordForSync(item.store, item.id);
      if (!record) continue; // supprimé entre-temps

      if (record._deleted) {
        await Supabase.remove(item.store, item.id, record.updated_at);
      } else {
        // C8 : l'upsert retourne la ligne telle qu'écrite côté serveur, avec
        // `updated_at` posé par le trigger `set_updated_at` (horloge serveur).
        // On aligne la copie locale sur cette valeur : la résolution de conflits
        // au pull suivant compare alors deux horodatages de la même horloge, au
        // lieu d'un horodatage d'horloge mobile contre un horodatage serveur.
        const serverRow = await Supabase.upsert(item.store, cleanRow(item.store, record.payload));
        if (serverRow?.updated_at) {
          const localRow = await DB.getRaw(item.store, item.id);
          if (localRow) {
            await DB.putRaw(item.store, { ...localRow, updated_at: serverRow.updated_at });
          }
        }
      }
    } catch (err) {
      stopped = true;
      pending.push(item);
    }
  }

  SyncState.queue = [...pending, ...SyncState.queue];
  updatePendingUI();
  if (pending.length > 0) throw new Error(`Push partiel : ${pending.length} élément(s) remis en file`);
}

function updatePendingUI() {
  if (typeof state !== "undefined" && state.sync) {
    state.sync.pending = SyncState.queue.length;
    if (typeof updateOfflinePill === "function") updateOfflinePill();
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
  // P4 : ne jamais pousser un dataURL base64 (signature capturée hors ligne)
  // vers SQL — la colonne ne doit contenir qu'une URL Storage. Le dataURL
  // reste en local pour l'affichage, et sera remplacé par l'URL Storage dès
  // que l'upload différé aboutira (C4).
  if (out.client_signature_url && out.client_signature_url.startsWith("data:")) out.client_signature_url = null;
  if (out.technicien_signature_url && out.technicien_signature_url.startsWith("data:")) out.technicien_signature_url = null;
  // Les colonnes text not null côté SQL n'acceptent pas un null explicite
  // (PostgREST insère NULL au lieu du défaut ''). On normalise ici.
  if ((store === "interventions" || store === "contrats_entretien") && (out.numero === null || out.numero === undefined)) {
    out.numero = "";
  }
  if (store === "interventions" && (out.statut_dossier === null || out.statut_dossier === undefined)) {
    out.statut_dossier = "a_valider";
  }
  return out;
}

async function runSync() {
  if (SyncState.running) return;
  if (!Supabase.configured()) return;
  SyncState.running = true;
  try {
    if (navigator.onLine) {
      await uploadPendingSignatures();
      await pullChanges();
      await pushChanges();
    }
  } catch (e) {
    // Ne bloque pas la synchronisation : un échec réseau transitoire
    // sera retenté automatiquement (événement "online" ou prochain enqueue).
    throw e;
  } finally {
    SyncState.running = false;
    updatePendingUI();
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
  if (SyncState.realtimeStarted) return;
  const c = initSupabase();
  if (!c) return;
  SyncState.realtimeStarted = true;
  try {
    ["clients", "interventions", "equipements", "pieces_utilisees"].forEach((store) => {
      c.channel(`realtime-${store}`).on(
        "postgres_changes",
        { event: "*", schema: "public", table: store },
        () => { runSync().catch((e) => console.warn("Sync échec", e)); }
      ).subscribe();
    });
  } catch (e) {
    SyncState.realtimeStarted = false;
    console.warn("Realtime indisponible", e);
  }
}

window.Sync = { runSync, pullChanges, pushChanges, enqueueSync, initRealtime, scheduleSync, pushAllLocal, uploadPendingSignatures, state: SyncState };
