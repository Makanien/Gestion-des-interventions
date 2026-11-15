// Modifier un client + créer directement un rendez-vous (menu « + »).
// Exécute l'application RÉELLE (tous les scripts de index.html) dans jsdom, sans Supabase.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { JSDOM } from "jsdom";
const { IDBFactory, IDBKeyRange } = require("fake-indexeddb");

const ROOT = path.resolve(__dirname, "..", "..");
const indexHtml = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const scripts = [...indexHtml.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]).filter((s) => !s.startsWith("vendor/"));

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, label, tries = 80) {
  for (let i = 0; i < tries; i++) {
    if (await fn()) return;
    await wait(25);
  }
  throw new Error("Délai dépassé : " + label);
}

async function boot() {
  const dom = new JSDOM(indexHtml.replace(/<script[^>]*><\/script>/g, ""), {
    url: "http://localhost/",
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  const w = dom.window;
  const ctx = dom.getInternalVMContext();
  const errors = [];
  w.indexedDB = new IDBFactory();
  w.IDBKeyRange = IDBKeyRange;
  w.scrollTo = () => {};
  w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  w.HTMLCanvasElement.prototype.getContext = () => null;
  w.console = { log() {}, info() {}, warn() {}, error: (...a) => errors.push(a.join(" ")) };
  w.addEventListener("error", (e) => errors.push(e.message));
  for (const src of scripts) new vm.Script(fs.readFileSync(path.join(ROOT, src), "utf8"), { filename: src }).runInContext(ctx);
  await until(() => !/Chargement/.test(w.document.querySelector("#app").textContent), "démarrage");
  const run = (code) => vm.runInContext(code, ctx);
  const $ = (sel) => w.document.querySelector(sel);
  const go = async (hash, ready) => {
    w.location.hash = hash;
    await until(ready, `écran ${hash}`);
  };
  const type = (sel, value) => {
    $(sel).value = value;
  };
  const toastText = () => $("#toast")?.textContent || "";
  return { w, run, $, go, type, toastText, errors };
}

describe("modifier un client", () => {
  async function withClient(extra = {}) {
    const app = await boot();
    const c = await app.run(
      `DB.saveClient(${JSON.stringify({ nom: "Dupont", adresse: "1 rue A", code_postal: "49500", ville: "Segré", tel: "0102030405", mail: "a@b.fr", type_batiment: "+ de 2 ans", ...extra })})`,
    );
    return { app, id: c.id };
  }

  it("la fiche client propose un bouton « Modifier le client »", async () => {
    const { app, id } = await withClient();
    await app.go(`#/client/${id}`, () => app.$("h1")?.textContent === "Dupont");
    const btn = app.$('[data-nav="client-edit"]');
    expect(btn).not.toBeNull();
    expect(btn.getAttribute("aria-label")).toBe("Modifier le client");
    btn.click();
    await until(() => app.$("#ce-nom"), "formulaire d'édition");
    expect(app.w.location.hash).toBe(`#/client-edit/${id}`);
  });

  it("préremplit le formulaire et enregistre les modifications (puis revient à la fiche)", async () => {
    const { app, id } = await withClient();
    await app.go(`#/client-edit/${id}`, () => app.$("#ce-nom"));
    expect(app.$("#ce-nom").value).toBe("Dupont");
    expect(app.$("#ce-cp").value).toBe("49500");
    expect(app.$("#ce-bat").value).toBe("+ de 2 ans");
    app.type("#ce-tel", "0699999999");
    app.type("#ce-ville", "  Chazé-sur-Argos ");
    app.$("#btn-save-client").click();
    await until(() => app.w.location.hash === `#/client/${id}`, "retour à la fiche");
    const saved = await app.run(`DB.getRaw("clients", ${JSON.stringify(id)})`);
    expect(saved).toMatchObject({ id, nom: "Dupont", tel: "0699999999", ville: "Chazé-sur-Argos", adresse: "1 rue A" });
    expect(saved.created_at).toBeTruthy(); // le même client est mis à jour, pas dupliqué
    expect(await app.run("DB.listClients().then((l) => l.length)")).toBe(1);
    await until(() => /Client modifié/.test(app.toastText()), "message de confirmation sur la fiche");
    expect(app.errors).toEqual([]);
  });

  it("refuse un nom vide, un mail invalide et un nom déjà pris — sans rien enregistrer", async () => {
    const { app, id } = await withClient();
    await app.run(`DB.saveClient({ nom: "Martin" })`);
    await app.go(`#/client-edit/${id}`, () => app.$("#ce-nom"));
    const before = await app.run(`DB.getRaw("clients", ${JSON.stringify(id)})`);

    app.type("#ce-nom", "   ");
    app.$("#btn-save-client").click();
    await until(() => /obligatoire/.test(app.toastText()), "nom vide");

    app.type("#ce-nom", "Dupont");
    app.type("#ce-mail", "pas-un-mail");
    app.$("#btn-save-client").click();
    await until(() => /invalide/.test(app.toastText()), "mail invalide");

    app.type("#ce-mail", "a@b.fr");
    app.type("#ce-nom", "  martin ");
    app.$("#btn-save-client").click();
    await until(() => /déjà ce nom/.test(app.toastText()), "doublon de nom");

    expect(app.w.location.hash).toBe(`#/client-edit/${id}`);
    expect(await app.run(`DB.getRaw("clients", ${JSON.stringify(id)})`)).toEqual(before);
  });

  it("conserve un type de bâtiment hors liste (ancienne valeur)", async () => {
    const { app, id } = await withClient({ type_batiment: "Ancien type" });
    await app.go(`#/client-edit/${id}`, () => app.$("#ce-nom"));
    expect(app.$("#ce-bat").value).toBe("Ancien type");
    app.type("#ce-tel", "0600000000");
    app.$("#btn-save-client").click();
    await until(() => app.w.location.hash === `#/client/${id}`, "retour");
    expect((await app.run(`DB.getRaw("clients", ${JSON.stringify(id)})`)).type_batiment).toBe("Ancien type");
  });

  it("un client inexistant renvoie à la liste des clients", async () => {
    const app = await boot();
    await app.go("#/client-edit/inconnu", () => app.w.location.hash === "#/clients" || app.w.location.hash === "#/");
  });
});

describe("créer directement un rendez-vous", () => {
  it("le menu « + » propose « Nouveau rendez-vous » et ouvre le formulaire", async () => {
    const app = await boot();
    await until(() => app.$("#fab-plus"), "bouton +");
    app.$("#fab-plus").click();
    await until(() => app.$('[data-create="rdv"]'), "menu de création");
    expect(app.$('[data-create="rdv"]').textContent).toContain("Nouveau rendez-vous");
    app.$('[data-create="rdv"]').click();
    await until(() => app.$("#r-client"), "formulaire de rendez-vous");
    expect(app.w.location.hash).toBe("#/rdv");
  });

  it("refuse l'enregistrement sans client", async () => {
    const app = await boot();
    await app.go("#/rdv", () => app.$("#r-client"));
    app.$("#btn-save-rdv").click();
    await until(() => /Indiquez le client/.test(app.toastText()), "client obligatoire");
    expect(await app.run("DB.listRendezvous().then((l) => l.length)")).toBe(0);
  });

  it("rattache le rendez-vous à un client EXISTANT (casse ignorée) sans créer de doublon", async () => {
    const app = await boot();
    const c = await app.run(`DB.saveClient({ nom: "Dupont", ville: "Segré" })`);
    await app.go("#/rdv", () => app.$("#r-client"));
    expect([...app.$("#r-clients-list").options].map((o) => o.value)).toContain("Dupont"); // suggestion
    app.type("#r-client", "  dupont ");
    app.type("#r-date", "2026-12-01");
    app.type("#r-note", "Panne pompe à chaleur");
    app.$("#btn-save-rdv").click();
    await until(async () => (await app.run("DB.listRendezvous().then((l) => l.length)")) === 1, "rendez-vous enregistré");
    const [rdv] = await app.run("DB.listRendezvous()");
    expect(rdv).toMatchObject({ client_id: c.id, date: "2026-12-01", note: "Panne pompe à chaleur" });
    expect(await app.run("DB.listClients().then((l) => l.length)")).toBe(1);
    expect(app.errors).toEqual([]);
  });

  it("crée un client minimal pour un nom inconnu et le signale", async () => {
    const app = await boot();
    await app.go("#/rdv", () => app.$("#r-client"));
    app.type("#r-client", "Nouveau Prospect");
    app.$("#btn-save-rdv").click();
    await until(async () => (await app.run("DB.listRendezvous().then((l) => l.length)")) === 1, "rendez-vous enregistré");
    const clients = await app.run("DB.listClients()");
    expect(clients.map((c) => c.nom)).toEqual(["Nouveau Prospect"]);
    const [rdv] = await app.run("DB.listRendezvous()");
    expect(rdv.client_id).toBe(clients[0].id);
    expect(app.toastText()).toMatch(/nouveau client créé/);
  });

  it("depuis un appel, le client reste celui de l'appel (pas de champ de saisie)", async () => {
    const app = await boot();
    const c = await app.run(`DB.saveClient({ nom: "Durand" })`);
    app.run(`state.rdvPrefill = { client_id: ${JSON.stringify(c.id)}, nom: "Durand", note: "Fuite" }`);
    await app.go("#/rdv", () => app.$("#r-date"));
    expect(app.$("#r-client")).toBeNull();
    expect(app.$(".note.blue").textContent).toContain("Durand");
  });

  it("à la modification, le client du rendez-vous est rappelé (non modifiable)", async () => {
    const app = await boot();
    const c = await app.run(`DB.saveClient({ nom: "Durand" })`);
    const rdv = await app.run(
      `DB.saveRendezvous({ client_id: ${JSON.stringify(c.id)}, date: "2026-12-02", heure_debut: "09:00", heure_fin: "10:00", type: "depannage", intervenant: "" })`,
    );
    await app.go(`#/rdv/${rdv.id}`, () => app.$("#r-date"));
    expect(app.$("#r-client")).toBeNull();
    expect(app.$(".note.blue").textContent).toContain("Durand");
  });
});

describe("rendez-vous : coordonnées du client", () => {
  const FULL = { nom: "Dupont", adresse: "1 rue A", code_postal: "49500", ville: "Segré", tel: "0102030405", mail: "a@b.fr" };
  const input = (app, sel, value) => {
    app.type(sel, value);
    app.$(sel).dispatchEvent(new app.w.Event("input", { bubbles: true }));
  };
  const nbRdv = (app) => app.run("DB.listRendezvous().then((l) => l.length)");
  const rdvSaved = (app) => until(async () => (await nbRdv(app)) === 1, "rendez-vous enregistré");

  it("un client EXISTANT : ses coordonnées se remplissent pour vérification", async () => {
    const app = await boot();
    await app.run(`DB.saveClient(${JSON.stringify(FULL)})`);
    await app.go("#/rdv", () => app.$("#r-client"));
    expect(app.$("#r-adresse").value).toBe(""); // rien tant qu'aucun client n'est désigné
    input(app, "#r-client", "dupont");
    expect(app.$("#r-adresse").value).toBe("1 rue A");
    expect(app.$("#r-cp").value).toBe("49500");
    expect(app.$("#r-ville").value).toBe("Segré");
    expect(app.$("#r-tel").value).toBe("0102030405");
    expect(app.$("#r-mail").value).toBe("a@b.fr");
    expect(app.$("#r-coords-hint").textContent).toMatch(/Client existant/);
  });

  it("une correction faite dans le rendez-vous est enregistrée sur le client (sans doublon)", async () => {
    const app = await boot();
    const c = await app.run(`DB.saveClient(${JSON.stringify(FULL)})`);
    await app.go("#/rdv", () => app.$("#r-client"));
    input(app, "#r-client", "Dupont");
    app.type("#r-tel", "0699999999");
    app.type("#r-ville", "Chazé-sur-Argos");
    app.$("#btn-save-rdv").click();
    await rdvSaved(app);
    const saved = await app.run(`DB.getRaw("clients", ${JSON.stringify(c.id)})`);
    expect(saved).toMatchObject({
      id: c.id,
      nom: "Dupont",
      tel: "0699999999",
      ville: "Chazé-sur-Argos",
      adresse: "1 rue A",
      mail: "a@b.fr",
    });
    expect(await app.run("DB.listClients().then((l) => l.length)")).toBe(1);
    const [rdv] = await app.run("DB.listRendezvous()");
    expect(rdv.client_id).toBe(c.id);
    await until(() => /coordonnées du client mises à jour/.test(app.toastText()), "message");
  });

  it("coordonnées inchangées : la fiche du client n'est pas réécrite", async () => {
    const app = await boot();
    const c = await app.run(`DB.saveClient(${JSON.stringify(FULL)})`);
    const before = await app.run(`DB.getRaw("clients", ${JSON.stringify(c.id)})`);
    await app.go("#/rdv", () => app.$("#r-client"));
    input(app, "#r-client", "Dupont");
    app.$("#btn-save-rdv").click();
    await rdvSaved(app);
    expect(await app.run(`DB.getRaw("clients", ${JSON.stringify(c.id)})`)).toEqual(before);
  });

  it("un NOUVEAU client est créé avec les coordonnées saisies", async () => {
    const app = await boot();
    await app.go("#/rdv", () => app.$("#r-client"));
    input(app, "#r-client", "Nouveau Prospect");
    expect(app.$("#r-coords-hint").textContent).toMatch(/Nouveau client/);
    app.type("#r-adresse", "5 place B");
    app.type("#r-cp", "35000");
    app.type("#r-ville", "Rennes");
    app.type("#r-tel", "0611223344");
    app.type("#r-mail", "prospect@example.fr");
    app.$("#btn-save-rdv").click();
    await rdvSaved(app);
    const [c] = await app.run("DB.listClients()");
    expect(c).toMatchObject({
      nom: "Nouveau Prospect",
      adresse: "5 place B",
      code_postal: "35000",
      ville: "Rennes",
      tel: "0611223344",
      mail: "prospect@example.fr",
    });
    const [rdv] = await app.run("DB.listRendezvous()");
    expect(rdv.client_id).toBe(c.id);
  });

  it("passer d'un client existant à un nouveau nom vide les champs repris, pas ceux modifiés à la main", async () => {
    const app = await boot();
    await app.run(`DB.saveClient(${JSON.stringify(FULL)})`);
    await app.go("#/rdv", () => app.$("#r-client"));
    input(app, "#r-client", "Dupont");
    app.type("#r-tel", "0600000000"); // modifié à la main
    input(app, "#r-client", "Dupont Père et Fils"); // nom différent → plus de correspondance
    expect(app.$("#r-adresse").value).toBe("");
    expect(app.$("#r-ville").value).toBe("");
    expect(app.$("#r-mail").value).toBe("");
    expect(app.$("#r-tel").value).toBe("0600000000"); // conservé
  });

  it("un mail invalide bloque l'enregistrement, sans rien écrire", async () => {
    const app = await boot();
    const c = await app.run(`DB.saveClient(${JSON.stringify(FULL)})`);
    const before = await app.run(`DB.getRaw("clients", ${JSON.stringify(c.id)})`);
    await app.go("#/rdv", () => app.$("#r-client"));
    input(app, "#r-client", "Dupont");
    app.type("#r-mail", "pas-un-mail");
    app.$("#btn-save-rdv").click();
    await until(() => /Adresse mail invalide/.test(app.toastText()), "mail invalide");
    expect(await nbRdv(app)).toBe(0);
    expect(await app.run(`DB.getRaw("clients", ${JSON.stringify(c.id)})`)).toEqual(before);
  });

  it("depuis un appel : les coordonnées du client de l'appel sont affichées et corrigeables", async () => {
    const app = await boot();
    const c = await app.run(`DB.saveClient(${JSON.stringify(FULL)})`);
    app.run(`state.rdvPrefill = { client_id: ${JSON.stringify(c.id)}, nom: "Dupont", note: "Fuite" }`);
    await app.go("#/rdv", () => app.$("#r-date"));
    expect(app.$("#r-client")).toBeNull();
    expect(app.$("#r-adresse").value).toBe("1 rue A");
    expect(app.$("#r-mail").value).toBe("a@b.fr");
    app.type("#r-cp", "49000");
    app.$("#btn-save-rdv").click();
    await rdvSaved(app);
    expect((await app.run(`DB.getRaw("clients", ${JSON.stringify(c.id)})`)).code_postal).toBe("49000");
  });

  it("à la modification d'un rendez-vous, le bloc de coordonnées n'est pas proposé", async () => {
    const app = await boot();
    const c = await app.run(`DB.saveClient(${JSON.stringify(FULL)})`);
    const rdv = await app.run(
      `DB.saveRendezvous({ client_id: ${JSON.stringify(c.id)}, date: "2026-12-02", type: "depannage", intervenant: "" })`,
    );
    await app.go(`#/rdv/${rdv.id}`, () => app.$("#r-date"));
    expect(app.$("#r-adresse")).toBeNull();
  });
});
