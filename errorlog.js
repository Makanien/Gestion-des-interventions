/* =========================================================
   Climat Elec — Journal d'erreurs local (BP-06)
   Remplace les console.warn/error « jetés » : chaque appel garde son
   comportement console MAIS est aussi consigné (50 dernières entrées) dans
   IndexedDB (`_meta`, clé « error_log ») et affiché dans « Compte & synchro ».

   Confidentialité : on ne retient que le message, le code et le statut — jamais
   `details` / `hint` / corps de requête (qui peuvent contenir des valeurs
   clients). Rien n'est envoyé hors de l'appareil.
   ========================================================= */
const ErrorLog = (() => {
  const MAX = 50;
  const KEY = "error_log";
  let entries = [];
  let saveTimer = null;

  function describe(err) {
    if (err === null || err === undefined) return {};
    if (typeof err === "string") return { cause: err.slice(0, 300) };
    const out = {};
    const msg = err.message || (typeof err === "object" ? "" : String(err));
    if (msg) out.cause = String(msg).slice(0, 300);
    if (err.code) out.code = String(err.code).slice(0, 40);
    if (err.status || err.statusCode) out.status = Number(err.status || err.statusCode) || undefined;
    return out;
  }

  function persist() {
    if (saveTimer) return;
    saveTimer = setTimeout(async () => {
      saveTimer = null;
      try {
        if (typeof DB !== "undefined" && DB._db) await DB.setMeta(KEY, entries.slice(-MAX));
      } catch (_) {
        /* le journal ne doit jamais provoquer d'erreur lui-même */
      }
    }, 500);
  }

  function record(level, args) {
    const [first, ...rest] = args;
    const detail = rest.length ? describe(rest[0]) : typeof first === "string" ? {} : describe(first);
    const message = typeof first === "string" ? first : detail.cause || "Erreur";
    entries.push({ at: new Date().toISOString(), level, message: String(message).slice(0, 200), ...detail });
    if (entries.length > MAX) entries = entries.slice(-MAX);
    persist();
  }

  const api = {
    warn(...args) {
      console.warn(...args);
      record("warn", args);
    },
    error(...args) {
      console.error(...args);
      record("error", args);
    },
    // Recharge le journal persisté (à appeler après DB.init()).
    async init() {
      try {
        const saved = await DB.getMeta(KEY);
        if (Array.isArray(saved)) entries = [...saved, ...entries].slice(-MAX);
      } catch (_) {
        /* idem */
      }
    },
    list() {
      return entries.slice().reverse(); // plus récent d'abord
    },
    async clear() {
      entries = [];
      try {
        if (DB._db) await DB.setMeta(KEY, []);
      } catch (_) {
        /* idem */
      }
    },
    // Texte à copier / envoyer au support (sans donnée client).
    toText() {
      return entries
        .slice()
        .reverse()
        .map(
          (e) =>
            `${e.at} [${e.level}] ${e.message}${e.cause ? " — " + e.cause : ""}${e.code ? " (" + e.code + ")" : ""}${e.status ? " HTTP " + e.status : ""}`,
        )
        .join("\n");
    },
  };

  // Erreurs non interceptées (navigateur uniquement).
  if (typeof window !== "undefined" && window.addEventListener) {
    window.addEventListener("error", (ev) => record("error", [`Erreur non interceptée : ${ev.message || "?"}`]));
    window.addEventListener("unhandledrejection", (ev) => record("error", ["Promesse rejetée non gérée", ev.reason]));
  }
  return api;
})();

if (typeof module !== "undefined" && module.exports) module.exports = { ErrorLog };
