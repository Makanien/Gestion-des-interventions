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
      « dernière écriture gagne » silencieux ;
    - les échecs de push sont plafonnés (SYNC-03) : une erreur permanente
      (refus RLS 403, contrainte 409/422…) ou un élément trop souvent
      retenté quitte la file et apparaît dans « Compte & synchro » avec son
      motif — plus de re-push inutile en boucle ni d'erreur générique.
    ========================================================= */

const SyncState = {
  running: false,
  lastPulledAt: null, // ISO — curseur de pull (horloge serveur), persisté
  queue: [],          // [{store, id, base_updated_at, attempts}]
  conflicts: [],      // [{store, id, base_updated_at, remote_updated_at, at}]
  failures: [],       // SYNC-03 : [{store, id, base_updated_at, attempts, reason, status, at}]
  realtimeStarted: false,
  realtimeChannels: [], // SYNC-04 : canaux créés, fermés à la déconnexion
};

// SYNC-03 : au-delà de N tentatives (erreurs transitoires : réseau, 5xx…),
// l'élément sort de la file — il devient visible dans « Compte & synchro »
// avec l'action « Réessayer ». Les erreurs permanentes sortent dès la 1re.
const MAX_SYNC_ATTEMPTS = 5;

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
  // SYNC-03 : une écriture locale fraîche rend l'élément à nouveau poussable
  // — il quitte la « boîte aux lettres des échecs ».
  if (SyncState.failures.some((f) => f.store === store && f.id === id)) {
    SyncState.failures = SyncState.failures.filter((f) => !(f.store === store && f.id === id));
    SyncStore?.saveFailures(SyncState.failures);
  }
  updatePendingUI();
  scheduleSync();
}

// Restaure la file, le curseur, les conflits et les échecs persistés
// (app.js : après DB.init()). Sans cela, un rechargement perdait tout ce qui
// n'a pas encore pu être poussé — c'était la raison d'être de pushAllLocal
// à chaque lancement.
async function initPersisted() {
  if (typeof SyncStore === "undefined") return;
  try {
    const [queue, cursor, conflicts, failures] = await Promise.all([
      SyncStore.loadQueue(),
      SyncStore.loadCursor(),
      SyncStore.loadConflicts(),
      SyncStore.loadFailures(),
    ]);
    if (SyncState.queue.length === 0 && queue.length) SyncState.queue = queue;
    if (SyncState.lastPulledAt === null && cursor) SyncState.lastPulledAt = cursor;
    if (SyncState.conflicts.length === 0 && conflicts.length) SyncState.conflicts = conflicts;
    if (SyncState.failures.length === 0 && failures.length) SyncState.failures = failures;
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
  let applied = 0;    // modifications locales effectives (pour rafraîchir l'écran)
  const failed = [];  // stores dont le pull a échoué (table absente, réseau…)

  for (const store of SYNC_STORES) {
    // SYNC-02 : pagination par pages stables ; plus de troncature silencieuse
    // à 1000 lignes (photos/documents/mesures atteignent ce volume vite).
    // Chaque store est isolé : l'échec d'UNE table (ex. schéma en avance de
    // phase sur la base) ne doit ni bloquer les suivants, ni empêcher le
    // rafraîchissement de l'écran ni la réconciliation de périmètre.
    let from = 0;
    try {
      let rows = await Supabase.list(store, { since, from, limit: PULL_PAGE });
      while (rows.length > 0) {
        for (const row of rows) {
          if (await applyRemote(store, row)) applied++;
          if (row.updated_at) maxSeen = maxISO(maxSeen, row.updated_at);
        }
        if (rows.length < PULL_PAGE) break;
        from += PULL_PAGE;
        rows = await Supabase.list(store, { since, from, limit: PULL_PAGE });
      }
    } catch (e) {
      failed.push(`${store} (${e && e.message ? e.message : e})`);
      console.warn(`Pull partiel — ${store} ignoré pour ce cycle`, e);
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
  await reconcileHiddenRows();
  if (applied > 0) {
    // Une modification venue d'un autre appareil a été appliquée :
    // l'écran courant doit refléter la nouvelle donnée, sans rechargement.
    notifyRemoteDataChanged();
  }
  // L'erreur est relancée APRÈS le rafraîchissement/réconciliation, pour que
  // les automatismes (retry, bandeau d'attente) voient l'échec persistant.
  if (failed.length) throw new Error(`Pull partiel : ${failed.join(", ")}`);
  return applied;
}

// Réconciliation de périmètre : une ligne qui QUITTE le périmètre RLS de
// l'utilisateur connecté (RDV ou fiche réaffecté(e) à un autre technicien)
// n'arrive jamais par le pull — la requête filtrée par RLS ne la renvoie
// plus — et son Realtime ne livre pas de version visible. Sans ceci, la
// copie locale devient un « fantôme » qui s'affiche encore comme
// affecté(e) à l'utilisateur alors que le serveur l'a donnée à quelqu'un
// d'autre (même un rafraîchissement n'y remédiait pas).
//
// Le pull liste donc les ids ACTUELLEMENT visibles côté serveur (RLS) :
// toute ligne locale active absente de cette liste a quitté le périmètre →
// retirée localement. Le serveur garde la ligne : si elle revient dans le
// périmètre (ré-affectation retour), le pull standard la ramène.
// Les lignes jamais poussées (file de sync) ou en erreur (SYNC-03) sont
// épargnées, comme dans applyRemote.
const RECONCILE_STORES = ["rendezvous", "interventions"];
const RECONCILE_PAGE = 1000; // limite PostgREST par requête
const RECONCILE_MAX_PAGES = 5;

// Miroir d'`isManager()` (app.js) : les managers voient tout — la sonde
// de périmètre ne leur apporte rien et leur périmètre peut être volumineux.
function canSeeEverything() {
  if (typeof state === "undefined" || !state.auth) return true; // pas de session → pas de sonde
  return ["responsable", "secretaire", "developpeur"].includes(state.auth?.profile?.role || "");
}

async function reconcileHiddenRows() {
  if (!navigator.onLine || canSeeEverything()) return;
  for (const store of RECONCILE_STORES) {
    try {
      const visible = new Set();
      let from = 0;
      let budgetExceeded = false;
      for (;;) {
        const ids = await Supabase.listIds(store, from, RECONCILE_PAGE);
        for (const id of ids) visible.add(id);
        if (ids.length < RECONCILE_PAGE) break;
        from += RECONCILE_PAGE;
        if (from >= RECONCILE_PAGE * RECONCILE_MAX_PAGES) { visible.clear(); budgetExceeded = true; break; } // périmètre hors budget : on ne conclut rien
      }
      if (budgetExceeded) continue;
      const locals = await DB.listRaw(store);
      let removed = false;
      for (const row of locals) {
        if (row._deleted || visible.has(row.id)) continue;
        if (SyncState.queue.some((q) => q.store === store && q.id === row.id)) continue; // jamais poussée : pas une réaffectation
        if (SyncState.failures.some((f) => f.store === store && f.id === row.id)) continue; // en erreur explicite : résolution utilisateur
        await DB.deleteRaw(store, row.id);
        removed = true;
      }
      if (removed) notifyRemoteDataChanged();
    } catch (e) {
      console.warn(`Réconciliation du périmètre ignorée (${store})`, e); // réseau : retentée au prochain pull
    }
  }
}

// UI : quand une modification distante vient d'être appliquée localement
// (Realtime ou pull), prévient l'écran courant — app.js re-rend alors la
// vue affichée (avec ses propres garde-fous : jamais pendant une saisie).
// Sans cela, la donnée arrivait bien sur l'appareil mais l'écran restait
// figé sur l'ancienne version jusqu'à rechargement de l'application.
let _remoteUiTimer = null;
function notifyRemoteDataChanged() {
  if (typeof window.onRemoteDataChanged !== "function") return;
  clearTimeout(_remoteUiTimer);
  _remoteUiTimer = setTimeout(() => {
    try { window.onRemoteDataChanged(); } catch (e) {
      console.warn("Rafraîchissement automatique de l'écran échoué", e);
    }
  }, 800);
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
      if (row._deleted || row.data_url) continue; // repli lecture selon fillBinaryUrl (sans fichier_url, contenu SQL)
      await fillBinaryUrl(store, row.id);
    }
  }
}

async function fillBinaryUrl(store, id) {
  try {
    const row = await DB.getRaw(store, id);
    if (!row || row._deleted || row.data_url) return;
    if (row.fichier_url) {
      const dataUrl = await Supabase.getBinaryDataUrl(store, row.fichier_url);
      // Écriture côté pull : re-enqueuer la ligne serait inutile (le serveur a
      // déjà ce binaire dans Storage et la colonne SQL n'est plus volontairement
      // lue en masse).
      await DB.putRaw(store, { ...row, data_url: dataUrl });
      return;
    }
    // Repli (SYNC-02, complément du 30/10) : sans fichier_url, Storage ne
    // peut pas reconstituer — mais le contenu existe côté serveur si la
    // ligne a été poussée depuis un appareil qui conservait son dataURL
    // (cleanRow ne neutralise que les signatures). Lecture unitaire une fois
    // pour toutes ; le versement à Storage est fait par l'appareil
    // d'origine (uploadPendingBinaries) ou le script de migration.
    if (!navigator.onLine) return;
    const full = await Supabase.get(store, id);
    const dataUrl = full && !full.deleted_at ? full.data_url : null;
    if (dataUrl) await DB.putRaw(store, { ...row, data_url: dataUrl });
  } catch (e) {
    console.warn(`Binaire ${store}/${id} non récupéré (retenté plus tard)`, e);
  }
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
    if (isDeleted) return false; // déja absent, rien à faire
    const row = cleanRow(store, remote);
    // SYNC-01 : la copie locale répliquée emporte la version serveur vue
    // (base pour un éventuel futur push conditionnel).
    row.synced_at = remote.updated_at || null;
    await DB.putRaw(store, row);
    if (store === "photos" || store === "documents") fillBinaryUrl(store, remote.id);
    return true;
  }

  // C8 : une modification locale pas encore poussée (toujours dans la file de
  // sync, ex. saisie faite hors ligne) doit l'emporter localement — le conflit
  // éventuel est tranché au PUSH (contrôle optimiste), plus silencieusement
  // pendant le pull.
  const isPending = SyncState.queue.some((q) => q.store === store && q.id === remote.id);
  // SYNC-03 : un élément « en erreur » (modification locale refusée par le
  // serveur) reste aussi protégé du pull — l'écraser serait perdre une
  // modification jamais poussée ; l'utilisateur tranche (Réessayer / Retirer).
  const hasFailure = SyncState.failures.some((f) => f.store === store && f.id === remote.id);
  if (isPending || hasFailure) return false;

  // Une version distante plus ancienne que la copie locale n'est jamais
  // appliquée (« dernière écriture gagne », comparaison updated_at).
  const localTime = local.updated_at || local.created_at || "";
  const remoteTime = remote.updated_at || remote.created_at || "";
  // Rien ne change localement si c'est la version serveur exacte déjà
  // obtenue (re-pull du recouvrement du curseur, doublon Realtime) — évite
  // de réécrire en boucle et de rafraîchir l'écran à chaque pull.
  if (!isDeleted && !local._deleted && local.updated_at === remoteTime && local.synced_at === remoteTime) return false;
  if (remoteTime >= localTime || isDeleted) {
    if (isDeleted) {
      await DB.deleteRaw(store, remote.id);
    } else {
      const merged = mergeRemote(store, local, remote);
      merged.synced_at = remote.updated_at || null;
      await DB.putRaw(store, merged);
      if (store === "photos" || store === "documents") fillBinaryUrl(store, remote.id);
    }
    return true;
  }
  return false;
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

// C4 (complément photos/documents) : même mécanisme que les signatures —
// une ligne photo/document poussée dont l'objet Storage n'existe pas encore
// (upload au moment de l'enregistrement en échec, création hors ligne sans
// nouvel enregistrement…) laisse fichier_url vide : les AUTRES appareils ne
// peuvent plus reconstituer l'affichage (le pull ne tire plus les data_url).
// L'appareil qui détient la copie locale (data_url) crée donc l'objet
// manquant au prochain cycle de sync, puis re-pousse la ligne — un refus RLS
// définitif (autre périmètre) arrête les tentatives pour cette ligne.
const BINARY_UPLOAD_BAIL = new Set(); // "store/id"
async function uploadPendingBinaries() {
  if (!Supabase.configured() || !navigator.onLine) return;
  for (const store of ["photos", "documents"]) {
    const rows = await DB.listRaw(store).catch(() => []);
    for (const row of rows) {
      if (row._deleted || row.deleted_at) continue;
      if (row.fichier_url || !row.data_url || !row.intervention_id) continue;
      if (BINARY_UPLOAD_BAIL.has(`${store}/${row.id}`)) continue;
      try {
        const upload = store === "photos" ? Supabase.uploadPhoto : Supabase.uploadDocument;
        row.fichier_url = await upload(row.intervention_id, row.data_url);
        await DB.putRaw(store, row);
        enqueueSync(store, row.id, row.synced_at || null);
      } catch (e) {
        const m = String(e?.message || e);
        if (e?.status === 403 || m.includes("403") || m.includes("42501") || m.includes("row level security")) {
          BINARY_UPLOAD_BAIL.add(`${store}/${row.id}`); // refus permanent
          console.warn(`Upload ${store}/${row.id} refusé (RLS) — abandon pour cette session`, e);
        } else {
          console.warn(`Upload différé ${store}/${row.id} vers Storage échoué (retenté au prochain cycle)`, e);
        }
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
            // NUM-01 : le serveur pose la référence (trigger `set_numero_*`)
            // si la ligne en était dépourvue — on rapatrie ce numéro sans
            // remettre la ligne en file (la copie locale vient d'être alignée).
            if (serverRow.numero && !localRow.numero) aligned.numero = serverRow.numero;
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
      // file et on poursuit, avec cause loggée.
      const reason = err && err.message ? err.message : String(err);
      // SYNC-03 : compteur de tentatives par élément. Une erreur permanente
      // (refus RLS 403, contrainte 409/422…) sort immédiatement de la file ;
      // sinon après MAX_SYNC_ATTEMPTS tentatives. L'élément apparaît alors
      // dans « Compte & synchro » avec son motif — plus de retry infini
      // toutes les 5-30 s avec un message générique.
      item.attempts = (item.attempts || 0) + 1;
      const permanent = permanentSyncError(err);
      console.error(`Push échoué — ${item.store}/${item.id} : ${reason}${permanent ? " (permanent)" : ""}`);
      if (permanent || item.attempts >= MAX_SYNC_ATTEMPTS) {
        await registerFailure(item, reason, permanent);
        SyncStore?.removePersisted(item.id);
        continue;
      }
      if (!firstError) firstError = { store: item.store, id: item.id, reason };
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

// SYNC-03 : classification d'une erreur de push. « Permanente » = re-renvoyer
// la même requête n'a aucune chance de réussir (RLS 403, doublon 409, payload
// 422, contrainte SQL…) → l'élément sort de la file dès le 1er échec.
// Transitoire (réseau coupé, JWT expiré, 5xx…) → retenté, dans la limite de
// MAX_SYNC_ATTEMPTS.
const PERMANENT_SYNC_MATCHERS = new Set([
  "401", "403", "409", "422",           // statuts HTTP permanents
  "42501",                              // violation de policy RLS
  "23502", "23503", "23505", "23514",   // contraintes : not null / FK / unique / check
  "23001", "22001", "22003", "22P02",   // intégrité / valeur hors bornes / syntaxe
  "42P01", "42703", "42883",            // table / colonne / fonction inconnue
]);
function permanentSyncError(err) {
  if (!err) return false;
  const code = String(err.code || "");
  const status = String(err.status || err.statusCode || "");
  const msg = String(err.message || "").toLowerCase();
  if (PERMANENT_SYNC_MATCHERS.has(status) || PERMANENT_SYNC_MATCHERS.has(code)) return true;
  // Requête PostgREST rejetée (sauf PGRST301 = JWT expiré, qui se retente).
  if (code.startsWith("PGRST") && code !== "PGRST301") return true;
  if (/row-level security|refus rls|permission denied|violates|insufficient privilege|duplicate key|invalid input syntax/.test(msg)) return true;
  return false;
}

// SYNC-03 : « boîte aux lettres des échecs » — élément refusé par le serveur
// (RLS, contrainte…) ou trop souvent retenté. Persisté, visible dans
// « Compte & synchro », avec résolution explicite : Réessayer ou Retirer de
// la file. La copie locale n'est JAMAIS touchée (aucune perte de données).
async function registerFailure(item, reason, permanent) {
  const entry = {
    store: item.store,
    id: item.id,
    base_updated_at: item.base_updated_at || null,
    attempts: item.attempts || 0,
    reason: String(reason || "Erreur inconnue").slice(0, 300),
    status: permanent ? "permanent" : "limite_tentatives",
    at: new Date().toISOString(),
  };
  SyncState.failures = SyncState.failures.filter((f) => !(f.store === item.store && f.id === item.id));
  SyncState.failures.push(entry);
  if (SyncState.failures.length > 100) SyncState.failures = SyncState.failures.slice(-100);
  SyncStore?.saveFailures(SyncState.failures);
  console.warn(`Sync : élément passé en erreur — ${item.store}/${item.id} (${entry.status}) : ${entry.reason}`);
  updatePendingUI();
}

// SYNC-03 : action utilisateur « Réessayer » — remet l'élément en file
// (avec sa version de base) et lance une synchronisation immédiate.
async function retryFailed(store, id) {
  const f = SyncState.failures.find((x) => x.store === store && x.id === id);
  if (!f) return;
  SyncState.failures = SyncState.failures.filter((x) => !(x.store === store && x.id === id));
  SyncStore?.saveFailures(SyncState.failures);
  enqueueSync(store, id, f.base_updated_at || null);
  await runSync();
}

// SYNC-03 : action utilisateur « Retirer de la file » — abandon explicite :
// l'élément ne repartira plus automatiquement (la copie locale reste sur
// l'appareil). Jamais appelé automatiquement.
function discardFailed(store, id) {
  SyncState.queue = SyncState.queue.filter((q) => !(q.store === store && q.id === id));
  SyncState.failures = SyncState.failures.filter((f) => !(f.store === store && f.id === id));
  SyncStore?.removePersisted(id);
  SyncStore?.saveQueue(SyncState.queue);
  SyncStore?.saveFailures(SyncState.failures);
  updatePendingUI();
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
    state.sync.errors = SyncState.failures.length; // SYNC-03
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
      await uploadPendingBinaries();
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

async function pushAllLocal(force = false) {
  if (!Supabase.configured()) return;
  for (const store of SYNC_STORES) {
    const rows = await DB.listRaw(store);
    for (const row of rows) {
      // SYNC-03 : sans `force` (migration initiale), ne jamais re-pousser une
      // ligne qui n'a pas été modifiée localement depuis sa dernière
      // synchronisation (`synced_at` renseigné au pull et après chaque push
      // ; remis à null par toute écriture locale). Sinon, des copies non
      // modifiées (ex. rendez-vous de l'équipe que le technicien ne peut pas
      // modifier) repartaient en erreur 403 à chaque synchro (cas (b)).
      // Une tombstone (suppression locale) est toujours poussée.
      const sansModifLocale = !row._deleted && row.synced_at && row.synced_at >= (row.updated_at || "");
      if (!force && sansModifLocale) continue;
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
    SyncState.realtimeChannels = [];
    SYNC_STORES.forEach((store) => {
      const ch = c.channel(`realtime-${store}`).on(
        "postgres_changes",
        { event: "*", schema: "public", table: store },
        (payload) => {
          // Le payload apporte la ligne complète (INSERT/UPDATE) ou l'ancien
          // id (DELETE) : application directe en local.
          try {
            if (payload.eventType === "DELETE" && payload.old && payload.old.id) {
              DB.deleteRaw(store, payload.old.id)
                .then(() => notifyRemoteDataChanged())
                .catch((e) => console.warn("Realtime delete échoué", e));
            } else if (payload.eventType === "UPDATE" && payload.old && payload.old.id
                       && (!payload.new || !payload.new.id)) {
              // UPDATE sans version visible : la ligne a QUITTÉ le périmètre
              // RLS de cet utilisateur (réaffectée à quelqu'un d'autre).
              // On retire la copie locale — sauf si une modification locale
              // est en attente / en erreur (aucune perte silencieuse).
              const id = payload.old.id;
              const pending = SyncState.queue.some((q) => q.store === store && q.id === id)
                || SyncState.failures.some((f) => f.store === store && f.id === id);
              if (!pending) {
                DB.deleteRaw(store, id)
                  .then(() => notifyRemoteDataChanged())
                  .catch((e) => console.warn("Realtime retrait de périmètre échoué", e));
              }
            } else if (payload.new && payload.new.id) {
              applyRemote(store, payload.new)
                .then((applied) => { if (applied) notifyRemoteDataChanged(); })
                .catch((e) => console.warn("Realtime apply échoué", e));
            }
          } catch (e) {
            console.warn("Realtime : événement non traité", e);
          }
        }
      ).subscribe();
      SyncState.realtimeChannels.push(ch);
    });
  } catch (e) {
    SyncState.realtimeStarted = false;
    console.warn("Realtime indisponible", e);
  }
}

// SYNC-04 : arrêt propre du Realtime à la déconnexion. Les canaux Supabase
// n'étaient jamais fermés (removeChannel) et `realtimeStarted` n'était jamais
// remis à false : après déconnexion/reconnexion (ou changement de compte),
// les événements du compte précédent continuaient d'être reçus (et appliqués
// localement), et un second abonnement se superposait au premier.
async function stopRealtime() {
  if (typeof Supabase === "undefined") return;
  const c = initSupabase();
  const channels = SyncState.realtimeChannels || [];
  SyncState.realtimeChannels = [];
  SyncState.realtimeStarted = false;
  if (!c) return;
  await Promise.all(
    channels.map((ch) =>
      c.removeChannel(ch).catch((e) => console.warn("Retrait du canal Realtime échoué", e))
    )
  );
}

window.Sync = { runSync, pullChanges, pushChanges, enqueueSync, initRealtime, stopRealtime, scheduleSync, initPersisted, initialPushIfNeeded, pushAllLocal, resolveConflict, retryFailed, discardFailed, uploadPendingSignatures, uploadPendingBinaries, notifyRemoteDataChanged, state: SyncState };
