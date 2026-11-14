/* =========================================================
   Climat Elec — Utilitaires partagés (BP-03)
   Premier module extrait d'app.js. Chargé AVANT tous les autres scripts.

   - esc(s)      : échappement HTML (sécurité = discipline : toute donnée
                   utilisateur interpolée dans un gabarit passe par là) ;
   - html`…`     : tag de gabarit qui échappe PAR DÉFAUT chaque valeur
                   interpolée. Seuls les fragments produits par html`…` ou
                   marqués par Html.raw() ne sont pas ré-échappés. À préférer
                   aux gabarits `…${esc(x)}…` dans tout code nouveau ou remanié.
   ========================================================= */
function esc(s) {
  return (s ?? "").toString().replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

// Fragment HTML déjà sûr : n'est jamais ré-échappé.
class SafeHtml {
  constructor(str) {
    this.str = String(str);
  }
  toString() {
    return this.str;
  }
}

function htmlValue(v) {
  if (v instanceof SafeHtml) return v.str;
  if (Array.isArray(v)) return v.map(htmlValue).join("");
  if (v === false || v === null || v === undefined) return ""; // `${cond && html`…`}`
  return esc(v);
}

// html`<b>${nom}</b>` → SafeHtml ; `${[a, b]}` concatène (chaque item échappé).
function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) out += htmlValue(values[i]) + strings[i + 1];
  return new SafeHtml(out);
}
// Marque une chaîne comme déjà sûre (ex. icône SVG interne). Jamais pour une donnée saisie.
const Html = { raw: (s) => new SafeHtml(s), SafeHtml };

// Liste des intervenants proposés dans les formulaires (BP-03). Source = table
// `profiles` (cache local alimenté à la connexion) ; repli sur la liste historique
// tant qu'aucun profil n'est connu (mode hors Supabase / premier lancement).
const INTERVENANTS_REPLI = ["Jérémy", "Régis", "Delphine"];
function intervenantsFromProfiles(profiles) {
  const names = (profiles || [])
    .filter((p) => p && p.full_name && p.role !== "en_attente" && p.role !== "developpeur")
    .map((p) => String(p.full_name).trim())
    .filter(Boolean);
  const uniq = [...new Set(names)].sort((a, b) => a.localeCompare(b, "fr"));
  return uniq.length ? uniq : INTERVENANTS_REPLI.slice();
}

// BP-05 — Accessibilité : les gabarits écrivent `<label>Nom</label><input id="…">` sans attribut `for`,
// donc un lecteur d'écran n'annonce pas le nom du champ. `linkLabels` relie chaque <label> orphelin au
// champ de son bloc (.field) et, à défaut, donne au champ un nom accessible (placeholder, title ou
// première option d'une liste). Idempotent ; appelé automatiquement après chaque rendu (voir startLabelLinker).
let labelSeq = 0;
function linkLabels(root) {
  const controls = root.querySelectorAll("input:not([type=hidden]), select, textarea");
  for (const c of controls) {
    if (c.getAttribute("aria-label") || c.getAttribute("aria-labelledby")) continue;
    if (c.labels && c.labels.length) continue; // déjà étiqueté (for= ou label englobant)
    const holder = c.closest(".field") || c.parentElement;
    const label = holder && holder.querySelector("label:not([for])");
    if (label && !label.querySelector("input, select, textarea")) {
      if (!c.id) c.id = `auto-field-${++labelSeq}`;
      label.htmlFor = c.id;
      continue;
    }
    const name =
      c.getAttribute("placeholder") || c.getAttribute("title") || (c.tagName === "SELECT" && c.options[0] ? c.options[0].text : "");
    if (name && name.trim()) c.setAttribute("aria-label", name.trim());
  }
}
function startLabelLinker(doc = document) {
  let queued = false;
  const run = () => {
    queued = false;
    linkLabels(doc.body);
  };
  new MutationObserver(() => {
    if (!queued) {
      queued = true;
      queueMicrotask(run);
    }
  }).observe(doc.body, { childList: true, subtree: true });
  run();
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { esc, html, Html, SafeHtml, intervenantsFromProfiles, INTERVENANTS_REPLI, linkLabels, startLabelLinker };
}
