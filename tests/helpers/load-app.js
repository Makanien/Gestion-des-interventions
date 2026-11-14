// BP-02 — Charge les scripts « classiques » de l'application (sans modules ES)
// dans un contexte `vm` isolé, avec une IndexedDB factice neuve à chaque appel.
// Les `const`/`function` de haut niveau restent accessibles via `ctx.get("nom")`.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { IDBFactory, IDBKeyRange } = require("fake-indexeddb");

const ROOT = path.resolve(__dirname, "..", "..");

function loadApp({ scripts = ["utils.js", "errorlog.js", "idb.js"], supabaseConfigured = false, globals = {} } = {}) {
  const timers = [];
  const sandbox = {
    console: { log() {}, info() {}, warn() {}, error() {} }, // silence les ErrorLog.* des tests
    indexedDB: new IDBFactory(),
    IDBKeyRange,
    crypto: globalThis.crypto,
    structuredClone,
    navigator: { onLine: true },
    // Les minuteries de l'application (scheduleSync, ErrorLog…) sont capturées :
    // un test les déclenche explicitement via `flushTimers()`.
    setTimeout: (fn) => timers.push(fn) && timers.length,
    clearTimeout() {},
    Promise,
    Set,
    Map,
    Array,
    Object,
    JSON,
    Error,
    ...globals,
  };
  // `Date` suit toujours celui du processus de test : vi.useFakeTimers() / setSystemTime() l'atteignent.
  Object.defineProperty(sandbox, "Date", { get: () => globalThis.Date, configurable: true });
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  // Dépendances que l'application trouve normalement dans le navigateur :
  const calls = { enqueued: [] };
  sandbox.Supabase = {
    configured: () => supabaseConfigured,
  };
  sandbox.window.addEventListener = () => {};
  sandbox.updateOfflinePill = () => {};
  sandbox.state = { sync: {} };

  const ctx = vm.createContext(sandbox);
  for (const file of scripts) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), ctx, { filename: file });
  }
  return {
    ctx: sandbox,
    calls,
    /** Valeur d'un identifiant de haut niveau (const / function) du contexte. */
    get: (name) => vm.runInContext(name, ctx),
    run: (code) => vm.runInContext(code, ctx),
    flushTimers: async () => {
      while (timers.length) await timers.shift()();
    },
  };
}

module.exports = { loadApp, ROOT };
