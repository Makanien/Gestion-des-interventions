// BP-03 — Test de DÉMARRAGE : charge index.html et TOUS ses scripts, dans l'ordre, dans un navigateur simulé (jsdom).
// Garantit que le découpage d'app.js en js/*.js n'a cassé ni l'ordre de chargement ni une dépendance au chargement,
// et que l'application affiche un écran sans erreur JavaScript.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { JSDOM } from "jsdom";
const { IDBFactory, IDBKeyRange } = require("fake-indexeddb");

const ROOT = path.resolve(__dirname, "..", "..");
const indexHtml = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const scripts = [...indexHtml.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);

async function boot(hash = "") {
  const dom = new JSDOM(indexHtml.replace(/<script[^>]*><\/script>/g, ""), {
    url: "http://localhost/" + hash,
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  const w = dom.window;
  const ctx = dom.getInternalVMContext();
  const errors = [];
  w.addEventListener("error", (e) => errors.push(e.message));
  w.indexedDB = new IDBFactory();
  w.IDBKeyRange = IDBKeyRange;
  w.matchMedia = w.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  w.scrollTo = () => {};
  w.HTMLCanvasElement.prototype.getContext = () => null;
  w.console = { log() {}, info() {}, warn() {}, error: (...a) => errors.push(a.map(String).join(" ")) };
  for (const src of scripts) {
    if (src.startsWith("vendor/")) continue; // jsPDF / supabase-js : non nécessaires pour le démarrage hors Supabase
    // Exécution « script classique » : les const/let de haut niveau rejoignent la portée globale partagée
    // (un `eval` les isolerait fichier par fichier et ne reproduirait pas le navigateur).
    new vm.Script(fs.readFileSync(path.join(ROOT, src), "utf8"), { filename: src }).runInContext(ctx);
  }
  // L'écran « Chargement… » d'index.html doit être REMPLACÉ par un vrai écran de l'application.
  for (let i = 0; i < 60 && /Chargement/.test(w.document.querySelector("#app").textContent); i++)
    await new Promise((r) => setTimeout(r, 50));
  return { w, ctx, errors };
}

describe("démarrage de l'application (tous les scripts de index.html)", () => {
  it("index.html référence les 16 modules js/ avant app.js, dans l'ordre", () => {
    const js = scripts.filter((s) => s.startsWith("js/"));
    expect(js).toHaveLength(16);
    expect(scripts.indexOf("app.js")).toBeGreaterThan(scripts.lastIndexOf(js[js.length - 1]));
    expect(scripts.indexOf("js/icons.js")).toBeLessThan(scripts.indexOf("js/views-compte.js"));
  });

  it("chaque script référencé existe sur disque et figure dans la liste du service worker", () => {
    const sw = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");
    for (const s of scripts) {
      expect(fs.existsSync(path.join(ROOT, s)), s).toBe(true);
      expect(sw, `${s} absent de ASSETS`).toContain(`"./${s}"`);
    }
  });

  it("l'application démarre, affiche un écran et n'émet aucune erreur", async () => {
    const { w, errors } = await boot();
    const app = w.document.querySelector("#app");
    expect(app.textContent).not.toMatch(/Chargement/);
    expect(app.querySelectorAll("button, input, a").length).toBeGreaterThan(0); // un écran interactif (accueil ou connexion)
    expect(errors).toEqual([]);
  });

  it.each(["", "#/clients", "#/stats", "#/account", "#/appel", "#/new/1", "#/rdv", "#/privacy"])(
    "l'écran « %s » s'affiche sans erreur",
    async (hash) => {
      const { w, errors } = await boot(hash);
      expect(w.document.querySelector("#app").textContent).not.toMatch(/Chargement/);
      expect(errors).toEqual([]);
    },
  );

  it("les symboles principaux de chaque module sont disponibles dans la portée globale", async () => {
    const { ctx } = await boot();
    for (const name of [
      "ICONS",
      "setApp",
      "route",
      "renderAccount",
      "planningHTML",
      "renderClientDetail",
      "openCreateSheet",
      "saveAppelFromDraft",
      "init",
      "isManager",
    ]) {
      expect(vm.runInContext(`typeof ${name}`, ctx), name).not.toBe("undefined");
    }
  });
});
