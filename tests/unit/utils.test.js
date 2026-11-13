import { describe, it, expect } from "vitest";
const { loadApp } = require("../helpers/load-app");

const app = loadApp({ scripts: ["utils.js"] });
const esc = app.get("esc");
const html = app.get("html");
const Html = app.get("Html");
const intervenantsFromProfiles = app.get("intervenantsFromProfiles");

describe("esc()", () => {
  it("échappe les 5 caractères sensibles", () => {
    expect(esc(`<img src=x onerror="a('b')">&`)).toBe("&lt;img src=x onerror=&quot;a(&#39;b&#39;)&quot;&gt;&amp;");
  });
  it("tolère null / undefined / nombres", () => {
    expect(esc(null)).toBe("");
    expect(esc(undefined)).toBe("");
    expect(esc(0)).toBe("0");
  });
});

describe("html`…`", () => {
  it("échappe par défaut les valeurs interpolées", () => {
    expect(String(html`<b>${"<script>alert(1)</script>"}</b>`)).toBe("<b>&lt;script&gt;alert(1)&lt;/script&gt;</b>");
  });
  it("n'échappe pas deux fois un fragment html`…` imbriqué", () => {
    const inner = html`<i>${"a&b"}</i>`;
    expect(String(html`<p>${inner}</p>`)).toBe("<p><i>a&amp;b</i></p>");
  });
  it("concatène les tableaux en échappant chaque élément", () => {
    const items = ["<a>", html`<li>x</li>`];
    expect(String(html`<ul>${items}</ul>`)).toBe("<ul>&lt;a&gt;<li>x</li></ul>");
  });
  it("ignore false / null / undefined (rendu conditionnel)", () => {
    expect(String(html`[${false}${null}${undefined}]`)).toBe("[]");
  });
  it("Html.raw marque un fragment déjà sûr", () => {
    expect(String(html`${Html.raw("<svg/>")}`)).toBe("<svg/>");
  });
  it("une chaîne ordinaire ressemblant à du HTML reste échappée", () => {
    expect(String(html`${"<svg/>"}`)).toBe("&lt;svg/&gt;");
  });
});

describe("intervenantsFromProfiles()", () => {
  it("repli sur la liste historique sans profil", () => {
    expect(Array.from(intervenantsFromProfiles([]))).toEqual(["Jérémy", "Régis", "Delphine"]);
    expect(Array.from(intervenantsFromProfiles(null))).toEqual(["Jérémy", "Régis", "Delphine"]);
  });
  it("exclut en_attente et developpeur, dédoublonne, trie", () => {
    const profiles = [
      { full_name: "Zoé", role: "technicien" },
      { full_name: "Alice", role: "responsable" },
      { full_name: "Alice", role: "technicien" },
      { full_name: "Bob", role: "en_attente" },
      { full_name: "Dev", role: "developpeur" },
      { full_name: "", role: "technicien" },
    ];
    expect(Array.from(intervenantsFromProfiles(profiles))).toEqual(["Alice", "Zoé"]);
  });
});
