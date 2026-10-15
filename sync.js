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
  // Workflow 4 statuts : normalise un éventuel ancien statut au pull/Realtime
  // (le serveur est normalement déjà migré par le bloc SQL P1 ; garde-fou
  // pour compatibilité avec des écritures hors ligne en retard).
  if (store === "interventions" && remote?.statut_dossier) {
    remote = { ...remote, statut_dossier: DB.normalizeStatut(remote.statut_dossier) };
  }
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
// Workflow 4 statuts (P2.6) : détection d'un refus de transition par le
// trigger serveur (errcode 42501 / HTTP 403). Restreint au store
// `interventions` : sur les autres tables, 42501 reste un simple échec RLS
// traité par le chemin de retry normal.
function isTransitionRefusee(store, err) {
  if (!err || store !== "interventions") return false;
  const msg = err.message || "";
  return (
    err.code === "42501" ||
    err.status === 403 ||
    msg.includes("Transition de statut non autorisée")
  );
}

// Ré-aligne une ligne locale sur le serveur après refus : la modification
// locale entrante a été rejetée, la version serveur fait foi (même si son
// `updated_at` est antérieur à l'horloge locale). Pull ciblé de LA ligne via
// `Supabase.get` — un pull générique (`pullChanges`) sauterait la ligne :
// non pending mais plus récente localement, elle serait écartée par la règle
// « dernière écriture gagne ».
async function realignAfterRefus(store, id) {
  try {
    if (!Supabase.configured() || !navigator.onLine) return;
    const remote = await Supabase.get(store, id);
    if (!remote) return;
    if (remote.statut_dossier) remote.statut_dossier = DB.normalizeStatut(remote.statut_dossier);
    const local = await DB.getRaw(store, id);
    if (local) await DB.putRaw(store, mergeRemote(store, local, remote));
    // Rafraîchit l'écran courant (la fiche ré-alignée peut y être affichée).
    if (typeof route === "function") await route();
  } catch (e) {
    console.warn("Réalignement après refus échoué", e);
  }
}

async function pushChanges() {
  if (!Supabase.configured()) return;
  if (!navigator.onLine) return;

  const queue = [...SyncState.queue];
  SyncState.queue = [];

  const pending = [];
  let firstError = null;

  for (const item of queue) {
    if (!navigator.onLine) { pending.push(item); continue; }
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
        // D5 : on renseigne en plus `synced_at` (même horloge serveur) — marque
        // « dernière synchronisation réussie » de la ligne, prévue dès V1.
        const serverRow = await Supabase.upsert(item.store, cleanRow(item.store, record.payload));
        if (serverRow?.updated_at) {
          const localRow = await DB.getRaw(item.store, item.id);
          if (localRow) {
            await DB.putRaw(item.store, { ...localRow, updated_at: serverRow.updated_at, synced_at: serverRow.updated_at });
          }
        }
      }
    } catch (err) {
      // Workflow 4 statuts (P2.6) : transition refusée par le serveur
      // (42501 — ex. technicien hors ligne dont l'état local est périmé).
      // On ne boucle PAS en retry : on retire l'élément de la file (pas de
      // remise dans `pending`), on prévient l'utilisateur et on ré-aligne la
      // ligne locale sur la version serveur (qui fait foi).
      if (isTransitionRefusee(item.store, err)) {
        console.warn(`Changement de statut refusé — ${item.store}/${item.id} : ${err?.message || err}`);
        toast("Changement de statut refusé — fiche resynchronisée", true);
        realignAfterRefus(item.store, item.id);
        continue;
      }
      // Un échec isolé (réseau transitoire, RLS, contrainte, payload trop gros…)
      // ne bloque plus le reste de la file : on remet SEULEMENT cet élément en
      // file et on poursuit. Auparavant, un seul élément « empoisonné » gelait
      // tous les suivants et la cause réelle était avalée — on la logge ici.
      const reason = err && err.message ? err.message : String(err);
      if (!firstError) firstError = { store: item.store, id: item.id, reason };
      console.error(`Push échoué — ${item.store}/${item.id} : ${reason}`);
      pending.push(item);
    }
  }

  SyncState.queue = [...pending, ...SyncState.queue];
  updatePendingUI();
  if (pending.length > 0) {
    const detail = firstError ? ` — premier échec : ${firstError.store}/${firstError.id} (${firstError.reason})` : "";
    throw new Error(`Push partiel : ${pending.length} élément(s) remis en file${detail}`);
  }
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
  delete out.synced_at; // marque locale « dernière sync » (renseignée après push, D5) — on ne pousse pas la copie locale
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
  // Workflow 4 statuts : normalise un ancien statut avant le push. Des
  // téléphones équipés de l'ancien service worker ou des données hors ligne
  // peuvent encore porter des statuts V3 ; sans normalisation, la contrainte
  // CHECK serveur bloquerait l'upsert complet de la ligne.
  // NB : les colonnes de traçabilité ajoutées au workflow (motif_retour,
  // valide_par/valide_le, facture_par/facture_le) NE SONT PAS retirées —
  // elles doivent partir vers Supabase.
  if (store === "interventions") {
    out.statut_dossier = DB.normalizeStatut(out.statut_dossier);
  }
  // D4 : `temps_intervention` (calculé à partir des heures) est une colonne
  // text not null : les lignes antérieures au calcul n'ont pas le champ.
  if (store === "interventions" && (out.temps_intervention === null || out.temps_intervention === undefined)) {
    out.temps_intervention = "";
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
