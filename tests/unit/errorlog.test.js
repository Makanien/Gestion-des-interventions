import { describe, it, expect } from "vitest";
const { loadApp } = require("../helpers/load-app");

describe("ErrorLog (BP-06)", () => {
  it("consigne message, code et statut, du plus récent au plus ancien", () => {
    const app = loadApp({ scripts: ["errorlog.js"] });
    const ErrorLog = app.get("ErrorLog");
    ErrorLog.warn("Push échoué", { message: "permission denied", code: "42501", status: 403 });
    ErrorLog.error("Autre échec", new Error("boom"));
    const list = ErrorLog.list();
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({ level: "error", message: "Autre échec", cause: "boom" });
    expect(list[1]).toMatchObject({ level: "warn", message: "Push échoué", cause: "permission denied", code: "42501", status: 403 });
  });

  it("ne retient JAMAIS details / hint / corps (données client potentielles)", () => {
    const app = loadApp({ scripts: ["errorlog.js"] });
    const ErrorLog = app.get("ErrorLog");
    ErrorLog.warn("Doublon", {
      message: "duplicate key",
      code: "23505",
      details: "Key (email)=(marie.dupont@example.com) already exists.",
      hint: "client Marie Dupont",
    });
    const dump = JSON.stringify(ErrorLog.list()) + ErrorLog.toText();
    expect(dump).not.toContain("marie.dupont");
    expect(dump).not.toContain("Marie Dupont");
    expect(dump).toContain("23505");
  });

  it("plafonne à 50 entrées", () => {
    const app = loadApp({ scripts: ["errorlog.js"] });
    const ErrorLog = app.get("ErrorLog");
    for (let i = 0; i < 80; i++) ErrorLog.warn(`e${i}`);
    const list = ErrorLog.list();
    expect(list).toHaveLength(50);
    expect(list[0].message).toBe("e79");
    expect(list[49].message).toBe("e30");
  });

  it("tronque les messages démesurés", () => {
    const app = loadApp({ scripts: ["errorlog.js"] });
    const ErrorLog = app.get("ErrorLog");
    ErrorLog.warn("x".repeat(5000), new Error("y".repeat(5000)));
    const [e] = ErrorLog.list();
    expect(e.message.length).toBeLessThanOrEqual(200);
    expect(e.cause.length).toBeLessThanOrEqual(300);
  });

  it("persiste dans IndexedDB et se recharge après redémarrage", async () => {
    const app = loadApp({ scripts: ["errorlog.js", "idb.js"] });
    await app.get("DB").init();
    const ErrorLog = app.get("ErrorLog");
    ErrorLog.warn("avant redémarrage", new Error("réseau"));
    await app.flushTimers(); // vide la minuterie de sauvegarde différée

    // « Redémarrage » : nouveau contexte, MÊME base IndexedDB.
    const app2 = loadApp({ scripts: ["errorlog.js", "idb.js"], globals: { indexedDB: app.ctx.indexedDB } });
    await app2.get("DB").init();
    await app2.get("ErrorLog").init();
    expect(app2.get("ErrorLog").list()[0]).toMatchObject({ message: "avant redémarrage", cause: "réseau" });
  });

  it("clear() vide le journal", async () => {
    const app = loadApp({ scripts: ["errorlog.js", "idb.js"] });
    await app.get("DB").init();
    const ErrorLog = app.get("ErrorLog");
    ErrorLog.warn("a");
    await ErrorLog.clear();
    expect(ErrorLog.list()).toHaveLength(0);
  });
});
