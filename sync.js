/* =========================================================
   Climat Elec — Couche de synchronisation (V2)
   Stratégie offline-first :
   - toutes les écritures passent d'abord par IndexedDB (locale) ;
   - une file de synchronisation pousse les changements vers Supabase
     dès que le réseau est disponible ; la file (et le curseur de pull)
     est persistée dans IndexedDB via sync-persist.js (SYNC-01, SYNC-02) ;
   - le pull récupère les changements des autres appareils via supabase.js,
     paginé, trié de façon stable, sans les binaires lourds, avec un
     curseur dérivé des horodatages serveur reçus (SYNC-02) ;
   - le push se fait en contrôle optimiste (SYNC-01) : une copie locale ne
     peut plus écraser une version serveur plus récente que la version de
     base vue au moment de la mise en file — les conflits sont signalés
     dans « Compte & synchro » (résolution explicite) au lieu d'un
     « dernière écriture gagne » silencieux.
   ========================================================= */

const SyncState = {
  running: false,
  lastPulledAt: null, // ISO — curseur de pull (horloge serveur), persisté
  queue: [],          // [{store, id, base_updated_at}]
  conflicts: [],      // [{store, id, base_updated_at, remote_updated_at, at}]
  realtimeStarted: false,
};

// Pagination du pull (SYNC-02) : PostgREST/Supabase limite à 1000 lignes par
// requête — on tire par pages avec un tri stable (updated_at, id).
const PULL_PAGE = 500;
// Recouvrement du curseur (SYNC-02) : on re-tire les 60 dernières secondes
// du serveur, par sécurité face aux mouvements concurrents.
const PULL_OVERLAP_MS = 60000;

function maxISO(a, b) {
  if (!a) return b || null;
  if (!b) return a || null;
  return b > a ? b : a;
}

// ---------------- File de synchronisation ----------------
// SYNC-01 : chaque élément emporte sa « version de base » (base_updated_at =
// dernier horodatage serveur connu de la copie locale avant modification ;
// `synced_at` renseigné au pull C4/D5/applyRemote, et après chaque push).
// File d'attente persistée : elle survit au rechargement de l'application.
function enqueueSync(store, id, base = null) {
  if (!Supabase.configured()) return;
  SyncState.queue = SyncState.queue.filter((q) => !(q.store === store && q.id === id));
  const item = { store, id, base_updated_at: base || null };
  SyncState.queue.push(item);
  SyncStore?.enqueuePersisted(item);
  updatePendingUI();
  scheduleSync();
}

// Restaure la file, le curseur et les conflits persistés (app.js : après
// DB.init()). Sans cela, un rechargement perdait tout ce qui n'a pas encore
// pu être poussé — c'était la raison d'être de pushAllLocal à chaque lancement.
async function initPersisted() {
  if (typeof SyncStore === "undefined") return;
  try {
    const [queue, cursor, conflicts] = await Promise.all([
      SyncStore.loadQueue(),
      SyncStore.loadCursor(),
      SyncStore.loadConflicts(),
    ]);
    if (SyncState.queue.length === 0 && queue.length) SyncState.queue = queue;
    if (SyncState.lastPulledAt === null && cursor) SyncState.lastPulledAt = cursor;
    if (SyncState.conflicts.length === 0 && conflicts.length) SyncState.conflicts = conflicts;
  } catch (e) {
    console.warn("Restauration de l'état de synchronisation échouée", e);
  }
  updatePendingUI();
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
  let maxSeen = null; // max(updated_at) reçu — horloge SERVEUR (SYNC-02)

  for (const store of SYNC_STORES) {
    // SYNC-02 : pagination par pages stables ; plus de troncature silencieuse
    // à 1000 lignes (photos/documents/mesures atteignent ce volume vite).
    let from = 0;
    let rows = await Supabase.list(store, { since, from, limit: PULL_PAGE });
    while (rows.length > 0) {
      for (const row of rows) {
        await applyRemote(store, row);
        if (row.updated_at) maxSeen = maxISO(maxSeen, row.updated_at);
      }
      if (rows.length < PULL_PAGE) break;
      from += PULL_PAGE;
      rows = await Supabase.list(store, { since, from, limit: PULL_PAGE });
    }
  }

  // SYNC-02 : le curseur avance d'après les données reçues (horloge serveur),
  // avec un léger recouvrement — plus de dépendance à l'horloge du téléphone
  // (un téléphone en avance ne « saute » plus des modifications).
  const next = maxSeen ? new Date(new Date(maxSeen).getTime() - PULL_OVERLAP_MS).toISOString() : since;
  SyncState.lastPulledAt = next;
  SyncStore?.saveCursor(next);

  // SYNC-02 : les data_url (photos/documents) ne sont plus tirés en masse —
  // on complète les binaires manquants depuis Storage, à la demande.
  await healPulledBinaries();
}

// SYNC-02 : Storage est la source de vérité des binaires. Une ligne photo /
// document tirée depuis SQL n'a plus de data_url ; on la rapplique depuis
// Storage (URL signée) dès que le réseau le permet. Sans data_url et hors
// ligne, la ligne reste « squelettique » et sera complétée au prochain pull.
// Une fois récupéré, le binaire est gardé localement (aucun trafic supplémentaire
// aux pulls suivants).
async function healPulledBinaries() {
  if (!navigator.onLine) return;
  for (const store of ["photos", "documents"]) {
    const rows = await DB.listRaw(store).catch(() => []);
    for (const row of rows) {
      if (!navigator.onLine) return; // le reste attend le prochain pull
      if (row._deleted || row.data_url || !row.fichier_url) continue;
      await fillBinaryUrl(store, row.id);
    }
  }
}

async function fillBinaryUrl(store, id) {
  try {
    const row = await DB.getRaw(store, id);
    if (!row || row._deleted || row.data_url || !row.fichier_url) return;
    const dataUrl = await Supabase.getBinaryDataUrl(store, row.fichier_url);
    // Écriture côté pull : re-enqueuer la ligne serait inutile (le serveur a
    // déjà ce binaire dans Storage et la colonne SQL n'est plus volontairement
    // lue en masse).
    await DB.putRaw(store, { ...row, data_url: dataUrl });
  } catch (e) {
    console.warn(`Binaire ${store}/${id} non récupéré (retenté plus tard)`, e);
  }
}

async function applyRemote(store, remote) {
  const local = await DB.getRaw(store, remote.id);
  const isDeleted = !!remote.deleted_at;

  if (!local) {
    if (isDeleted) return; // déja absent, rien à faire
    const row = cleanRow(store, remote);
    // SYNC-01 : la copie locale répliquée emporte la version serveur vue
    // (base pour un éventuel futur push conditionnel).
    row.synced_at = remote.updated_at || null;
    await DB.putRaw(store, row);
    if (store === "photos" || store === "documents") fillBinaryUrl(store, remote.id);
    return;
  }

  // C8 : une modification locale pas encore poussée (toujours dans la file de
  // sync, ex. saisie faite hors ligne) doit l'emporter localement — le conflit
  // éventuel est tranché au PUSH (contrôle optimiste), plus silencieusement
  // pendant le pull.
  const isPending = SyncState.queue.some((q) => q.store === store && q.id === remote.id);
  if (isPending) return;

  // Une version distante plus ancienne que la copie locale n'est jamais
  // appliquée (« dernière écriture gagne », comparaison updated_at).
  const localTime = local.updated_at || local.created_at || "";
  const remoteTime = remote.updated_at || remote.created_at || "";
  if (remoteTime >= localTime || isDeleted) {
    if (isDeleted) {
      await DB.deleteRaw(store, remote.id);
    } else {
      const merged = mergeRemote(store, local, remote);
      merged.synced_at = remote.updated_at || null;
      await DB.putRaw(store, merged);
      if (store === "photos" || store === "documents") fillBinaryUrl(store, remote.id);
    }
  }
}

// P4 : un dataURL de signature (capturé hors ligne) reste local tant qu'aucune
// URL Storage n'existe côté serveur. On le préserve lors du pull pour ne pas
// perdre l'affichage de la signature hors ligne (le remote a alors un null).
// SYNC-02 : idem pour photos/documents — le pull distant n'appelle plus les
// data_url ; la copie locale (si elle existe) est préservée.
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
  if ((store === "photos" || store === "documents") && !cleaned.data_url && local.data_url) {
    cleaned.data_url = local.data_url;
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
        enqueueSync(store, row.id, row.synced_at || null);
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
  let firstError = null;

  for (const item of queue) {
    if (!navigator.onLine) { pending.push(item); continue; }
    try {
      const record = await DB.getRecordForSync(item.store, item.id);
      if (!record) { SyncStore?.removePersisted(item.id); continue; } // supprimé entre-temps

      if (record._deleted) {
        await Supabase.remove(item.store, item.id, record.updated_at);
      } else {
        // C8 : l'écriture côté serveur pose `updated_at` par le trigger
        // `set_updated_at` (horloge serveur). On aligne la copie locale sur
        // cette valeur : la résolution de conflits compare alors deux
        // horodatages de la même horloge, au lieu d'un horodatage d'horloge
        // mobile contre un horodatage serveur. D5 : on renseigne en plus
        // `synced_at` (même horloge serveur) — marque « dernière
        // synchronisation réussie ».
        const payload = cleanRow(item.store, record.payload);
        let serverRow = null;

        if (item.base_updated_at) {
          // SYNC-01 : le push ne peut plus écraser une version serveur plus
          // récente que la version de base vue à la mise en file (contrôle
          // optimiste — équivalent client de `update ... where updated_at = base`).
          const res = await Supabase.upsertIfUnchanged(item.store, payload, item.base_updated_at);
          if (res.conflict) {
            await registerConflict(item, res.remote);
            continue; // ni écrasement ni infini-retry : résolution explicite
          }
          serverRow = res.row;
        } else {
          // Ligne jamais connue du serveur (création locale, ou copie locale
          // sans historique de sync) — upsert standard.
          serverRow = await Supabase.upsert(item.store, payload);
        }

        if (serverRow?.updated_at) {
          const localRow = await DB.getRaw(item.store, item.id);
          if (localRow) {
            const aligned = { ...localRow, updated_at: serverRow.updated_at, synced_at: serverRow.updated_at };
            await DB.putRaw(item.store, aligned);
            // Un push réussi signifie que la copie locale est de nouveau
            // alignée sur le serveur : les conflits enregistrés pour cette
            // ligne sont obsolètes, on les retire.
            if (SyncState.conflicts.some((cf) => cf.store === item.store && cf.id === item.id)) {
              SyncState.conflicts = SyncState.conflicts.filter((cf) => !(cf.store === item.store && cf.id === item.id));
              SyncStore?.saveConflicts(SyncState.conflicts);
              updatePendingUI();
            }
          }
        }
      }
    } catch (err) {
      // Un échec isolé (réseau transitoire, RLS, contrainte, payload trop gros…)
      // ne bloque plus le reste de la file : on remet SEULEMENT cet élément en
      // file et on poursuit, avec cause loggée.
      const reason = err && err.message ? err.message : String(err);
      if (!firstError) firstError = { store: item.store, id: item.id, reason };
      console.error(`Push échoué — ${item.store}/${item.id} : ${reason}`);
      pending.push(item);
    }
  }

  SyncState.queue = [...pending, ...SyncState.queue];
  SyncStore?.saveQueue(SyncState.queue);
  updatePendingUI();
  if (pending.length > 0) {
    const detail = firstError ? ` — premier échec : ${firstError.store}/${firstError.id} (${firstError.reason})` : "";
    throw new Error(`Push partiel : ${pending.length} élément(s) remis en file${detail}`);
  }
}

// SYNC-01 : un conflit est enregistré (persisté) et signalé en UI — le haut
// de pile de la file ne réessaie plus à l'infini ( SYNC-03) : l'utilisateur
// tranche depuis « Compte & synchro ». La copie locale n'est PAS écrasée.
async function registerConflict(item, remote) {
  const entry = {
    store: item.store,
    id: item.id,
    base_updated_at: item.base_updated_at || null,
    remote_updated_at: (remote && remote.updated_at) || "",
    at: new Date().toISOString(),
  };
  SyncState.conflicts = SyncState.conflicts.filter((cf) => !(cf.store === item.store && cf.id === item.id));
  SyncState.conflicts.push(entry);
  if (SyncState.conflicts.length > 100) SyncState.conflicts = SyncState.conflicts.slice(-100);
  SyncStore?.saveConflicts(SyncState.conflicts);
  console.warn(`Conflit de synchronisation — ${item.store}/${item.id} (serveur plus récent : ${entry.remote_updated_at || "version inconnue"})`);
  updatePendingUI();
}

// SYNC-01 (et IMP-03 simplifié) : résolution explicite d'un conflit. L'élément
// n'est jamais re-poussé automatiquement (pas de retry infini) : l'utilisateur
// tranche.
// - keepLocal  : renvoyer la version locale (base = version serveur vue) ;
// - keepRemote : réappliquer la version serveur localement (la modification
//   locale non poussée est supprimée — c'est explicitement demandé).
async function resolveConflict(store, id, keepLocal) {
  const idx = SyncState.conflicts.findIndex((cf) => cf.store === store && cf.id === id);
  if (idx === -1) return;
  const cf = SyncState.conflicts[idx];
  try {
    if (keepLocal) {
      enqueueSync(store, id, cf.remote_updated_at || null);
      await runSync();
    } else {
      const remote = await Supabase.get(store, id);
      if (remote) {
        const row = cleanRow(store, remote);
        row.synced_at = remote.updated_at || null;
        await DB.putRaw(store, row);
        if (store === "photos" || store === "documents") fillBinaryUrl(store, id);
      } else {
        await DB.deleteRaw(store, id); // supprimée distante : aligner localement
      }
    }
    SyncState.conflicts = SyncState.conflicts.filter((c2) => !(c2.store === store && c2.id === id));
    SyncStore?.saveConflicts(SyncState.conflicts);
    updatePendingUI();
  } catch (e) {
    console.error("Résolution de conflit échouée", e);
    throw e;
  }
}

function updatePendingUI() {
  if (typeof state !== "undefined" && state.sync) {
    state.sync.pending = SyncState.queue.length;
    state.sync.conflicts = SyncState.conflicts.length;
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
// Supabase.
// SYNC-01 : cette migration initiale ne s'exécute PLUS à chaque démarrage /
// retry / bouton « Synchroniser », mais une seule fois (marqueur
// `_meta.initial_push_done`) — pour rattraper l'historique local créé avant
// la connexion. Le reste du temps, seules les lignes réellement modifiées
// localement sont poussées : les données locales ne ré-écrasent plus le
// serveur au lancement. Un renvoi massif reste possible via l'action
// « Tout renvoyer » explicite (Compte & synchro).
const SYNC_STORES = ["clients", "interventions", "equipements", "pieces_utilisees", "appels", "rendezvous", "mesures", "photos", "pieces", "documents", "contrats_entretien"];

async function pushAllLocal() {
  if (!Supabase.configured()) return;
  for (const store of SYNC_STORES) {
    const rows = await DB.listRaw(store);
    for (const row of rows) {
      enqueueSync(store, row.id, row.synced_at || null);
    }
  }
}

// SYNC-01 : la migration initiale (historique local créé avant connexion) est
// bornée par un marqueur — plus aucun pushAllLocal automatique.
async function initialPushIfNeeded() {
  if (!Supabase.configured()) return;
  let done = null;
  try { done = await DB.getMeta("initial_push_done"); } catch (e) { /* _meta indisponible */ }
  if (done === "done") return;
  await pushAllLocal();
  try { await DB.setMeta("initial_push_done", "done"); } catch (e) { /* non bloquant */ }
}

// Écouteurs réseau : synchronisation automatique quand la connexion revient.
window.addEventListener("online", () => {
  runSync().catch((e) => console.warn("Sync échec", e));
});

// Realtime (optionnel) : l'événement reçu est APPLIQUÉ localement, au lieu de
// relancer un pull complet des 11 tables (SYNC-02 ; COH-10 : toutes les
// tables tirées sont écoutées, et non plus seulement 4).
function initRealtime() {
  if (SyncState.realtimeStarted) return;
  const c = initSupabase();
  if (!c) return;
  SyncState.realtimeStarted = true;
  try {
    SYNC_STORES.forEach((store) => {
      c.channel(`realtime-${store}`).on(
        "postgres_changes",
        { event: "*", schema: "public", table: store },
        (payload) => {
          // Le payload apporte la ligne complète (INSERT/UPDATE) ou l'ancien
          // id (DELETE) : application directe en local.
          try {
            if (payload && payload.eventType === "DELETE" && payload.old && payload.old.id) {
              DB.deleteRaw(store, payload.old.id).catch((e) => console.warn("Realtime delete échoué", e));
            } else if (payload && payload.new && payload.new.id) {
              applyRemote(store, payload.new).catch((e) => console.warn("Realtime apply échoué", e));
            }
          } catch (e) {
            console.warn("Realtime : événement non traité", e);
          }
        }
      ).subscribe();
    });
  } catch (e) {
    SyncState.realtimeStarted = false;
    console.warn("Realtime indisponible", e);
  }
}

window.Sync = { runSync, pullChanges, pushChanges, enqueueSync, initRealtime, scheduleSync, initPersisted, initialPushIfNeeded, pushAllLocal, resolveConflict, uploadPendingSignatures, state: SyncState };
