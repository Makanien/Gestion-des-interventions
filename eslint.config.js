// BP-02 — ESLint (config « flat »). Les fichiers de l'application sont des
// scripts classiques (pas de modules ES) qui partagent des globales : on les
// déclare ici pour que `no-undef` reste utile.
const js = require("@eslint/js");
const globals = require("globals");

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
    files: ["*.js"],
    ignores: ["eslint.config.js"],
    languageOptions: { ecmaVersion: 2022, sourceType: "script", globals: { ...globals.browser, ...appGlobals, module: "readonly" } },
    rules: {
      "no-unused-vars": ["warn", { args: "none", caughtErrors: "none" }],
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
