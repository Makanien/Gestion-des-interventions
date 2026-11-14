// BP-02 — ESLint (config « flat »). Les fichiers de l'application sont des
// scripts classiques (pas de modules ES) qui partagent des globales : on les
// déclare ici pour que `no-undef` reste utile.
const js = require("@eslint/js");
const globals = require("globals");
const fs = require("node:fs");
const path = require("node:path");
const espree = require("espree");

// BP-03 — l'application est répartie en scripts classiques (racine + js/) qui partagent UNE portée globale.
// Plutôt que de lister à la main les centaines d'identifiants partagés, on lit les déclarations de haut niveau
// de chaque fichier : `no-undef` signale ainsi toute référence à un nom qu'AUCUN script ne déclare.
function topLevelNames(file) {
  const names = {};
  const ast = espree.parse(fs.readFileSync(file, "utf8"), { ecmaVersion: 2022, sourceType: "script" });
  for (const node of ast.body) {
    if ((node.type === "FunctionDeclaration" || node.type === "ClassDeclaration") && node.id) names[node.id.name] = "writable";
    if (node.type === "VariableDeclaration")
      for (const d of node.declarations) if (d.id.type === "Identifier") names[d.id.name] = "writable";
  }
  return names;
}
const ROOT = __dirname;
const appFiles = [
  ...fs.readdirSync(ROOT).filter((f) => f.endsWith(".js") && !["eslint.config.js", "sw.js", "logo-data.js"].includes(f)),
  ...fs.readdirSync(path.join(ROOT, "js")).map((f) => `js/${f}`),
].filter((f) => !f.startsWith("vitest") && !f.startsWith("playwright"));
const sharedGlobals = Object.assign({}, ...appFiles.map((f) => topLevelNames(path.join(ROOT, f))));

const appGlobals = {
  DB: "readonly",
  uuid: "readonly",
  Supabase: "readonly",
  initSupabase: "readonly",
  Sync: "readonly",
  SyncStore: "readonly",
  signatureModal: "readonly",
  blobToDataURL: "readonly",
  jspdf: "readonly",
  LOGO_DATA: "readonly",
  ErrorLog: "readonly",
  Html: "readonly",
  html: "readonly",
  SafeHtml: "readonly",
  intervenantsFromProfiles: "readonly",
  startLabelLinker: "readonly",
  linkLabels: "readonly",
  // Déclarées par les scripts de l'application (sharing entre fichiers) :
  openDB: "writable",
  tx: "writable",
  SB: "writable",
  SyncState: "writable",
  SYNC_STORES: "writable",
  esc: "writable",
  cleanRow: "writable",
  mergeRemote: "writable",
  // Définies dans app.js / pdf.js et utilisées par les autres scripts (même portée globale) :
  state: "writable",
  route: "writable",
  toast: "writable",
  updateOfflinePill: "writable",
  ICONS: "writable",
  ENTRETIEN_META: "writable",
  computeDuration: "writable",
  downloadInterventionPDF: "writable",
  downloadContratPDF: "writable",
};

module.exports = [
  { ignores: ["vendor/**", "dist/**", "node_modules/**", "logo-data.js", "Archives/**", "documentation/**", "photo orpheline/**"] },
  js.configs.recommended,
  {
    files: ["*.js", "js/*.js"],
    ignores: ["eslint.config.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: { ...globals.browser, ...sharedGlobals, ...appGlobals, module: "readonly" },
    },
    rules: {
      "no-unused-vars": ["warn", { args: "none", caughtErrors: "none", vars: "local" }], // vars "local" : un nom de haut niveau est souvent utilisé par un AUTRE fichier
      "no-empty": ["warn", { allowEmptyCatch: false }],
      "no-redeclare": "off", // les scripts partagent des déclarations de haut niveau
      "no-undef": "error",
    },
  },
  {
    files: ["sw.js"],
    languageOptions: { globals: { ...globals.serviceworker } },
  },
  {
    files: ["eslint.config.js", "tests/helpers/**/*.js", "scripts/**/*.mjs", "supabase/**/*.mjs"],
    languageOptions: { ecmaVersion: 2022, sourceType: "commonjs", globals: { ...globals.node } },
    rules: { "no-unused-vars": ["warn", { args: "none", caughtErrors: "none" }] },
  },
  {
    files: ["scripts/**/*.mjs", "supabase/**/*.mjs", "vitest.config.mjs", "playwright.config.mjs"],
    languageOptions: { ecmaVersion: 2022, sourceType: "module", globals: { ...globals.node } },
  },
  // Tests Vitest : syntaxe ESM (import) ; ils chargent les scripts classiques via tests/helpers/load-app.js.
  {
    files: ["tests/unit/**/*.js", "tests/e2e/**/*.js"],
    languageOptions: { ecmaVersion: 2022, sourceType: "module", globals: { ...globals.node, ...globals.browser, caches: "readonly" } },
  },
];
