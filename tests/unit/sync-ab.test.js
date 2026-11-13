// Scénario SYNC-01 « A/B » : deux appareils, un serveur partagé.
// Vérifie qu'une copie locale périmée ne peut plus écraser silencieusement le serveur.
import { describe, it, expect, beforeEach } from "vitest";
const { loadApp } = require("../helpers/load-app");
const { createFakeServer } = require("../helpers/fake-server");

const SCRIPTS = ["utils.js", "errorlog.js", "idb.js", "sync-persist.js", "sync.js"];

async function device(server) {
  const app = loadApp({ scripts: SCRIPTS, supabaseConfigured: true, globals: { toast: () => {} } });
  Object.assign(app.ctx.Supabase, server.client());
  await app.get("DB").init();
  return { app, DB: app.get("DB"), Sync: app.ctx.Sync, state: app.get("SyncState") };
}

let server, A, B;
beforeEach(async () => {
  server = createFakeServer();
  A = await device(server);
  B = await device(server);
});

describe("push d'une création locale", () => {
  it("envoie la ligne, aligne updated_at/synced_at sur l'horloge serveur, vide la file", async () => {
    const c = await A.DB.saveClient({ nom: "Dupont" });
    expect(A.state.queue).toHaveLength(1);
    await A.Sync.pushChanges();
    const remote = server.row("clients", c.id);
    expect(remote.nom).toBe("Dupont");
    const local = await A.DB.getRaw("clients", c.id);
    expect(local.updated_at).toBe(remote.updated_at);
    expect(local.synced_at).toBe(remote.updated_at);
    expect(A.state.queue).toHaveLength(0);
  });

  it("ne pousse pas les champs locaux (synced_at, _deleted)", async () => {
    const c = await A.DB.saveClient({ nom: "X" });
    await A.Sync.pushChanges();
    const remote = server.row("clients", c.id);
    expect(remote).not.toHaveProperty("synced_at");
    expect(remote).not.toHaveProperty("_deleted");
  });
});

describe("SYNC-01 — contrôle optimiste", () => {
  it("une modification concurrente côté serveur déclenche un CONFLIT, pas un écrasement", async () => {
    // 1. A crée et synchronise ; B reçoit la même version (simulée).
    const c = await A.DB.saveClient({ nom: "Dupont", ville: "Chazé" });
    await A.Sync.pushChanges();
    const v1 = server.row("clients", c.id);

    // 2. B modifie et pousse AVANT A (B avait v1 comme base).
    server.serverWrite("clients", { id: c.id, ville: "Angers" });
    const v2 = server.row("clients", c.id);
    expect(v2.updated_at).not.toBe(v1.updated_at);

    // 3. A (hors ligne jusque-là, base = v1) modifie son téléphone et se reconnecte.
    await A.DB.saveClient({ ...(await A.DB.getRaw("clients", c.id)), telephone: "0102030405" });
    await A.Sync.pushChanges();

    // Le serveur N'A PAS été écrasé…
    expect(server.row("clients", c.id).ville).toBe("Angers");
    expect(server.row("clients", c.id).telephone).toBeUndefined();
    // … le conflit est enregistré, la copie locale intacte, plus de retry infini.
    expect(A.state.conflicts).toHaveLength(1);
    expect(A.state.conflicts[0]).toMatchObject({
      store: "clients",
      id: c.id,
      base_updated_at: v1.updated_at,
      remote_updated_at: v2.updated_at,
    });
    expect((await A.DB.getRaw("clients", c.id)).telephone).toBe("0102030405");
    expect(A.state.queue).toHaveLength(0);
  });

  it("« Garder ma version » renvoie la copie locale avec la version serveur comme base", async () => {
    const c = await A.DB.saveClient({ nom: "Dupont" });
    await A.Sync.pushChanges();
    server.serverWrite("clients", { id: c.id, ville: "Angers" });
    await A.DB.saveClient({ ...(await A.DB.getRaw("clients", c.id)), telephone: "0102030405" });
    await A.Sync.pushChanges();
    expect(A.state.conflicts).toHaveLength(1);

    await A.Sync.resolveConflict("clients", c.id, true);
    expect(A.state.conflicts).toHaveLength(0);
    expect(server.row("clients", c.id).telephone).toBe("0102030405");
  });

  it("« Garder la version serveur » remplace la copie locale par celle du serveur", async () => {
    const c = await A.DB.saveClient({ nom: "Dupont" });
    await A.Sync.pushChanges();
    server.serverWrite("clients", { id: c.id, ville: "Angers" });
    await A.DB.saveClient({ ...(await A.DB.getRaw("clients", c.id)), telephone: "0102030405" });
    await A.Sync.pushChanges();

    await A.Sync.resolveConflict("clients", c.id, false);
    const local = await A.DB.getRaw("clients", c.id);
    expect(local.ville).toBe("Angers");
    expect(local.telephone).toBeUndefined();
    expect(A.state.conflicts).toHaveLength(0);
  });

  it("deux modifications locales successives gardent la PREMIÈRE version de base", async () => {
    const c = await A.DB.saveClient({ nom: "Dupont" });
    await A.Sync.pushChanges();
    const base = server.row("clients", c.id).updated_at;
    await A.DB.saveClient({ ...(await A.DB.getRaw("clients", c.id)), ville: "1" });
    await A.DB.saveClient({ ...(await A.DB.getRaw("clients", c.id)), ville: "2" });
    expect(A.state.queue).toHaveLength(1);
    expect(A.state.queue[0].base_updated_at).toBe(base);
  });
});

describe("SYNC-03 — erreurs permanentes et transitoires", () => {
  it("une erreur permanente (RLS 42501) sort de la file dès le 1er échec et reste visible", async () => {
    const c = await A.DB.saveClient({ nom: "Refusé" });
    server.failNext(Object.assign(new Error("new row violates row-level security policy"), { code: "42501", status: 403 }));
    await A.Sync.pushChanges();
    expect(A.state.queue).toHaveLength(0);
    expect(A.state.failures).toHaveLength(1);
    expect(A.state.failures[0]).toMatchObject({ store: "clients", id: c.id, status: "permanent" });
    expect((await A.DB.getRaw("clients", c.id)).nom).toBe("Refusé"); // aucune perte locale
  });

  it("une erreur transitoire remet l'élément en file puis l'abandonne après MAX_SYNC_ATTEMPTS", async () => {
    const c = await A.DB.saveClient({ nom: "Réseau" });
    const max = A.app.get("MAX_SYNC_ATTEMPTS");
    for (let i = 1; i < max; i++) {
      server.failNext(new Error("Failed to fetch"));
      await expect(A.Sync.pushChanges()).rejects.toThrow(/Push partiel/);
      expect(A.state.queue).toHaveLength(1);
      expect(A.state.failures).toHaveLength(0);
    }
    server.failNext(new Error("Failed to fetch"));
    await A.Sync.pushChanges(); // dernière tentative : sort de la file sans lever d'erreur
    expect(A.state.queue).toHaveLength(0);
    expect(A.state.failures[0]).toMatchObject({ id: c.id, status: "limite_tentatives" });
  });

  it("« Réessayer » remet l'élément en file et le synchronise", async () => {
    const c = await A.DB.saveClient({ nom: "Réessai" });
    server.failNext(Object.assign(new Error("permission denied"), { code: "42501" }));
    await A.Sync.pushChanges();
    expect(A.state.failures).toHaveLength(1);
    await A.Sync.retryFailed("clients", c.id);
    expect(A.state.failures).toHaveLength(0);
    expect(server.row("clients", c.id)?.nom).toBe("Réessai");
  });

  it("« Ne plus synchroniser » retire l'élément sans toucher à la copie locale", async () => {
    const c = await A.DB.saveClient({ nom: "Abandon" });
    server.failNext(Object.assign(new Error("denied"), { code: "42501" }));
    await A.Sync.pushChanges();
    A.Sync.discardFailed("clients", c.id);
    expect(A.state.failures).toHaveLength(0);
    expect(A.state.queue).toHaveLength(0);
    expect((await A.DB.getRaw("clients", c.id)).nom).toBe("Abandon");
  });
});

describe("pull : propagation entre appareils (scénario A → B)", () => {
  it("B reçoit la création de A, sans la renvoyer au serveur", async () => {
    const c = await A.DB.saveClient({ nom: "Dupont" });
    await A.Sync.pushChanges();
    await B.Sync.pullChanges();
    const onB = await B.DB.getRaw("clients", c.id);
    expect(onB.nom).toBe("Dupont");
    expect(onB.synced_at).toBe(server.row("clients", c.id).updated_at);
    expect(B.state.queue).toHaveLength(0); // un pull n'enfile rien
  });

  it("le curseur avance d'après l'horloge SERVEUR, avec recouvrement de 60 s", async () => {
    const c = await A.DB.saveClient({ nom: "Dupont" });
    await A.Sync.pushChanges();
    await B.Sync.pullChanges();
    const last = server.row("clients", c.id).updated_at;
    expect(B.state.lastPulledAt).toBe(new Date(Date.parse(last) - 60000).toISOString());
  });

  it("le tombstone distant supprime la copie visible sur B", async () => {
    const c = await A.DB.saveClient({ nom: "À supprimer" });
    await A.Sync.pushChanges();
    await B.Sync.pullChanges();
    expect(await B.DB.listClients()).toHaveLength(1);
    await A.DB.deleteClient(c.id);
    await A.Sync.pushChanges();
    await B.Sync.pullChanges();
    expect(await B.DB.listClients()).toHaveLength(0);
  });

  it("un pull ne REMPLACE pas une modification locale non synchronisée", async () => {
    const c = await A.DB.saveClient({ nom: "Dupont" });
    await A.Sync.pushChanges();
    await B.Sync.pullChanges();
    // B modifie localement (hors ligne, en file) pendant que A pousse une autre version.
    await B.DB.saveClient({ ...(await B.DB.getRaw("clients", c.id)), telephone: "0600000000" });
    await A.DB.saveClient({ ...(await A.DB.getRaw("clients", c.id)), ville: "Angers" });
    await A.Sync.pushChanges();
    await B.Sync.pullChanges();
    expect((await B.DB.getRaw("clients", c.id)).telephone).toBe("0600000000");
  });

  it("pagine au-delà d'une page (PULL_PAGE)", async () => {
    const page = A.app.get("PULL_PAGE");
    for (let i = 0; i < page + 25; i++) server.serverWrite("clients", { id: `c-${String(i).padStart(4, "0")}`, nom: `Client ${i}` });
    await B.Sync.pullChanges();
    expect(await B.DB.listClients()).toHaveLength(page + 25);
  });
});

describe("suppression logique propagée", () => {
  it("deleteClient pousse un tombstone (deleted_at côté serveur)", async () => {
    const c = await A.DB.saveClient({ nom: "À supprimer" });
    await A.Sync.pushChanges();
    await A.DB.deleteClient(c.id);
    await A.Sync.pushChanges();
    expect(server.row("clients", c.id).deleted_at).toBeTruthy();
  });
});
