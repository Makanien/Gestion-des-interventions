// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
const { loadApp } = require("../helpers/load-app");

function setup(markup) {
  document.body.innerHTML = markup;
  // utils.js est un script classique : on l'évalue dans le contexte jsdom courant.
  const app = loadApp({ scripts: ["utils.js"], globals: {} });
  return app.get("linkLabels");
}

describe("linkLabels() — noms accessibles (BP-05)", () => {
  it("relie un <label> orphelin au champ de son bloc .field", () => {
    const linkLabels = setup(`<div class="field"><label>Nom *</label><input id="a-nom" type="text"></div>`);
    linkLabels(document.body);
    expect(document.querySelector("label").htmlFor).toBe("a-nom");
    expect(document.getElementById("a-nom").labels[0].textContent).toBe("Nom *");
  });

  it("génère un id si le champ n'en a pas", () => {
    const linkLabels = setup(`<div class="field"><label>Ville</label><input type="text"></div>`);
    linkLabels(document.body);
    const input = document.querySelector("input");
    expect(input.id).toMatch(/^auto-field-\d+$/);
    expect(document.querySelector("label").htmlFor).toBe(input.id);
  });

  it("deux champs sous un seul label : le 2e reçoit un aria-label de repli", () => {
    const linkLabels = setup(
      `<div class="field"><label>Période</label><input id="d1" placeholder="Du"><input id="d2" placeholder="Au"></div>`,
    );
    linkLabels(document.body);
    expect(document.getElementById("d1").labels.length).toBe(1);
    expect(document.getElementById("d2").getAttribute("aria-label")).toBe("Au");
  });

  it("champ de recherche sans label : aria-label = placeholder", () => {
    const linkLabels = setup(`<input id="s" type="text" placeholder="Rechercher un client…">`);
    linkLabels(document.body);
    expect(document.getElementById("s").getAttribute("aria-label")).toBe("Rechercher un client…");
  });

  it("liste de filtre sans label : aria-label = première option", () => {
    const linkLabels = setup(`<select id="f" class="filter-select"><option>Tous les types</option><option>Dépannage</option></select>`);
    linkLabels(document.body);
    expect(document.getElementById("f").getAttribute("aria-label")).toBe("Tous les types");
  });

  it("ne touche pas un champ déjà étiqueté et reste idempotent", () => {
    const linkLabels = setup(`<label for="x">Déjà</label><input id="x"><input type="hidden" id="h">`);
    linkLabels(document.body);
    linkLabels(document.body);
    expect(document.getElementById("x").hasAttribute("aria-label")).toBe(false);
    expect(document.getElementById("h").hasAttribute("aria-label")).toBe(false);
    expect(document.querySelector("label").htmlFor).toBe("x");
  });
});
