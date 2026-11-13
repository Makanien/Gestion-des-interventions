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

if (typeof module !== "undefined" && module.exports) {
  module.exports = { esc, html, Html, SafeHtml, intervenantsFromProfiles, INTERVENANTS_REPLI };
}
