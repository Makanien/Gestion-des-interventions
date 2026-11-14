import { describe, it, expect, beforeEach, vi } from "vitest";
const { loadApp } = require("../helpers/load-app");

let app, DB;
beforeEach(async () => {
  app = loadApp();
  DB = app.get("DB");
  await DB.init();
});

describe("numérotation locale de repli (mode hors Supabase)", () => {
  it("incrémente par préfixe, avec zéros de tête, sur l'année courante", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-14T10:00:00Z"));
    try {
      expect(await DB.nextNumero("FIC")).toBe("FIC-2026-001");
      expect(await DB.nextNumero("FIC")).toBe("FIC-2026-002");
      expect(await DB.nextNumero("ENT")).toBe("ENT-2026-001"); // compteur indépendant
      expect(await DB.nextNumero("CTR")).toBe("CTR-2026-001");
    } finally {
      vi.useRealTimers();
    }
  });

  it("repart à 001 au changement d'année", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date("2026-12-31T10:00:00Z"));
      await DB.nextNumero("FIC");
      await DB.nextNumero("FIC");
      vi.setSystemTime(new Date("2027-01-02T10:00:00Z"));
      expect(await DB.nextNumero("FIC")).toBe("FIC-2027-001");
    } finally {
      vi.useRealTimers();
    }
  });

  it("le compteur survit à une réouverture de la base", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-05-01T10:00:00Z"));
    try {
      await DB.nextNumero("FIC");
      const app2 = loadApp({ globals: { indexedDB: app.ctx.indexedDB } });
      await app2.get("DB").init();
      expect(await app2.get("DB").nextNumero("FIC")).toBe("FIC-2026-002");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("normalizeStatut() — workflow 4 statuts", () => {
  it.each([
    ["validee", "a_facturer"],
    ["facture_importee", "a_facturer"],
    ["facture_a_verifier", "a_facturer"],
    ["facture_verifiee", "termine"],
    ["a_envoyer", "termine"],
    ["cloturee", "termine"],
  ])("ancien statut %s → %s", (from, to) => {
    expect(DB.normalizeStatut(from)).toBe(to);
  });
  it.each(["brouillon", "a_valider", "a_facturer", "termine"])("%s déjà normal : inchangé", (s) => {
    expect(DB.normalizeStatut(s)).toBe(s);
  });
  it("laisse intactes les valeurs vides ou inconnues", () => {
    expect(DB.normalizeStatut(null)).toBe(null);
    expect(DB.normalizeStatut(undefined)).toBe(undefined);
    expect(DB.normalizeStatut("")).toBe("");
    expect(DB.normalizeStatut("inconnu_xyz")).toBe("inconnu_xyz");
  });
});

describe("clients : persistance, tri et suppression logique", () => {
  it("saveClient attribue id et horodatages, listClients trie par nom (fr)", async () => {
    await DB.saveClient({ nom: "Zimmer" });
    await DB.saveClient({ nom: "Éric Martin" });
    await DB.saveClient({ nom: "Bernard" });
    const names = (await DB.listClients()).map((c) => c.nom);
    expect(names).toEqual(["Bernard", "Éric Martin", "Zimmer"]);
    const [c] = await DB.listClients();
    expect(c.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(c.created_at).toBeTruthy();
    expect(c.updated_at).toBeTruthy();
    expect(c.synced_at).toBeNull();
  });

  it("deleteClient laisse un tombstone : invisible en liste, présent en brut", async () => {
    const c = await DB.saveClient({ nom: "À supprimer" });
    await DB.deleteClient(c.id);
    expect(await DB.listClients()).toHaveLength(0);
    expect(await DB.getClient(c.id)).toBeNull();
    const raw = await DB.getRaw("clients", c.id);
    expect(raw._deleted).toBe(true);
    expect(raw.deleted_at).toBeTruthy(); // nécessaire pour propager la suppression au serveur
  });

  it("findOrCreateClientByName est insensible à la casse et ne crée pas de doublon", async () => {
    const a = await DB.findOrCreateClientByName({ nom: "Dupont" });
    const b = await DB.findOrCreateClientByName({ nom: "  dupont " });
    expect(b.id).toBe(a.id);
    expect(await DB.listClients()).toHaveLength(1);
    expect(await DB.findOrCreateClientByName({ nom: "   " })).toBeNull();
  });
});

describe("_meta", () => {
  it("setMeta / getMeta, valeur absente → null", async () => {
    expect(await DB.getMeta("absent")).toBeNull();
    await DB.setMeta("k", { a: 1 });
    expect(await DB.getMeta("k")).toEqual({ a: 1 });
  });
});

describe("migration des anciens statuts au démarrage", () => {
  it("normalise les statuts V3 des fiches existantes, une seule fois", async () => {
    await DB.putRaw("interventions", { id: "i1", statut_dossier: "cloturee", updated_at: "2026-01-01T00:00:00Z" });
    await DB.putRaw("interventions", { id: "i2", statut_dossier: "brouillon", updated_at: "2026-01-01T00:00:00Z" });
    await DB.setMeta("migrated_workflow_4", null); // force le rejeu
    const app2 = loadApp({ globals: { indexedDB: app.ctx.indexedDB } });
    await app2.get("DB").init();
    const db2 = app2.get("DB");
    expect((await db2.getRaw("interventions", "i1")).statut_dossier).toBe("termine");
    expect((await db2.getRaw("interventions", "i2")).statut_dossier).toBe("brouillon");
    // Ne touche ni updated_at ni synced_at (pas de tempête de push — cf. commentaire idb.js)
    expect((await db2.getRaw("interventions", "i1")).updated_at).toBe("2026-01-01T00:00:00Z");
  });
});
