import { describe, it, expect } from "vitest";
const { loadApp } = require("../helpers/load-app");

const app = loadApp({ scripts: ["utils.js", "errorlog.js", "idb.js", "sync-persist.js", "sync.js"] });
const cleanRow = app.get("cleanRow");
const mergeRemote = app.get("mergeRemote");
const permanentSyncError = app.get("permanentSyncError");
const maxISO = app.get("maxISO");

describe("cleanRow() — nettoyage avant push", () => {
  it("retire les champs purement locaux", () => {
    const out = cleanRow("interventions", {
      id: "1",
      numero: "FIC-1",
      statut_dossier: "a_valider",
      _deleted: false,
      client: { nom: "x" },
      synced_at: "2026-01-01T00:00:00Z",
      equipements: [],
      pieces: [],
      mesures: [],
      photos: [],
      documents: [],
      _brouillon: true,
      _client_sig_blob: {},
      _technicien_sig_blob: {},
    });
    for (const k of [
      "_deleted",
      "client",
      "synced_at",
      "equipements",
      "pieces",
      "mesures",
      "photos",
      "documents",
      "_brouillon",
      "_client_sig_blob",
      "_technicien_sig_blob",
    ]) {
      expect(out).not.toHaveProperty(k);
    }
    expect(out.id).toBe("1");
  });

  it("ne pousse jamais un dataURL de signature (P4) mais garde une URL Storage", () => {
    const out = cleanRow("interventions", {
      id: "1",
      client_signature_url: "data:image/png;base64,AAAA",
      technicien_signature_url: "https://x.supabase.co/storage/v1/object/public/signatures/sig-tech-1.png",
    });
    expect(out.client_signature_url).toBeNull();
    expect(out.technicien_signature_url).toContain("sig-tech-1.png");
  });

  it("normalise les colonnes NOT NULL côté SQL (numero, statut_dossier, temps_intervention)", () => {
    const out = cleanRow("interventions", { id: "1", numero: null, statut_dossier: undefined, temps_intervention: null });
    expect(out.numero).toBe("");
    expect(out.statut_dossier).toBe("a_valider");
    expect(out.temps_intervention).toBe("");
  });

  it("convertit un ancien statut de dossier avant le push (CHECK serveur)", () => {
    expect(cleanRow("interventions", { id: "1", statut_dossier: "cloturee" }).statut_dossier).toBe("termine");
  });

  it("conserve les colonnes de traçabilité du workflow", () => {
    const row = {
      id: "1",
      statut_dossier: "a_facturer",
      motif_retour: "m",
      valide_par: "u",
      valide_le: "d",
      facture_par: "u2",
      facture_le: "d2",
    };
    expect(cleanRow("interventions", row)).toMatchObject(row);
  });

  it("n'applique les règles d'intervention qu'aux interventions", () => {
    const out = cleanRow("clients", { id: "1", nom: "Dupont" });
    expect(out).toEqual({ id: "1", nom: "Dupont" });
  });

  it("ne mute pas la ligne d'origine", () => {
    const row = { id: "1", synced_at: "x", client_signature_url: "data:abc" };
    cleanRow("interventions", row);
    expect(row.synced_at).toBe("x");
    expect(row.client_signature_url).toBe("data:abc");
  });
});

describe("mergeRemote() — préservation des binaires locaux", () => {
  it("garde la signature locale (dataURL) quand le serveur n'en a pas encore", () => {
    const merged = mergeRemote(
      "interventions",
      { client_signature_url: "data:image/png;base64,LOCAL" },
      { id: "1", client_signature_url: null },
    );
    expect(merged.client_signature_url).toBe("data:image/png;base64,LOCAL");
  });
  it("laisse la signature serveur gagner quand elle existe", () => {
    const merged = mergeRemote(
      "interventions",
      { client_signature_url: "data:LOCAL" },
      { id: "1", client_signature_url: "https://x/sig.png" },
    );
    expect(merged.client_signature_url).toBe("https://x/sig.png");
  });
  it("préserve data_url local des photos / documents tirés sans binaire (SYNC-02)", () => {
    expect(mergeRemote("photos", { data_url: "data:LOCAL" }, { id: "p" }).data_url).toBe("data:LOCAL");
    expect(mergeRemote("documents", { data_url: "data:LOCAL" }, { id: "d" }).data_url).toBe("data:LOCAL");
  });
  it("ne touche pas aux autres tables", () => {
    expect(mergeRemote("clients", { data_url: "data:LOCAL" }, { id: "c" })).not.toHaveProperty("data_url");
  });
});

describe("permanentSyncError() — classification SYNC-03", () => {
  it.each([
    [{ status: 403 }, true],
    [{ status: 409 }, true],
    [{ status: 422 }, true],
    [{ code: "42501" }, true],
    [{ code: "23505" }, true],
    [{ code: "23514" }, true],
    [{ code: "PGRST116" }, true],
    [{ message: "new row violates row-level security policy" }, true],
    [{ message: "duplicate key value violates unique constraint" }, true],
    [{ code: "PGRST301" }, false], // JWT expiré : se retente
    [{ status: 500 }, false],
    [{ status: 503 }, false],
    [{ message: "Failed to fetch" }, false],
    [null, false],
  ])("%j → permanente = %s", (err, expected) => {
    expect(permanentSyncError(err)).toBe(expected);
  });
});

describe("maxISO()", () => {
  it("renvoie le plus récent, tolère les valeurs vides", () => {
    expect(maxISO("2026-01-01T00:00:00Z", "2026-02-01T00:00:00Z")).toBe("2026-02-01T00:00:00Z");
    expect(maxISO("2026-03-01T00:00:00Z", "2026-02-01T00:00:00Z")).toBe("2026-03-01T00:00:00Z");
    expect(maxISO(null, "2026-02-01T00:00:00Z")).toBe("2026-02-01T00:00:00Z");
    expect(maxISO("2026-02-01T00:00:00Z", null)).toBe("2026-02-01T00:00:00Z");
    expect(maxISO(null, null)).toBeNull();
  });
});
