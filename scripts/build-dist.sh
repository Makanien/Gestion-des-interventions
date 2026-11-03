#!/usr/bin/env bash
# =========================================================
# SEC-06 — Construit `dist/`, le dossier minimal déployable.
#
# Le dépôt contient des éléments qui ne doivent JAMAIS être servis
# publiquement (documentation interne, maquettes, PRD, schema SQL, fichiers
# d'analyse). Déployer le dépôt entier expose tout cela : passer par ce
# script et ne servir que `dist/`.
#
#   ./scripts/build-dist.sh          → construit ./dist
#
# Déployer le contenu de `dist/` uniquement (Netlify Drop, GitHub Pages…).
# =========================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DIST="$ROOT/dist"

rm -rf "$DIST"
mkdir -p "$DIST/assets" "$DIST/icons" "$DIST/vendor"

for f in \
  index.html style.css manifest.json logo-data.js config.js \
  app.js supabase.js sync.js sync-persist.js idb.js pdf.js signature.js
do
  cp "$ROOT/$f" "$DIST/$f"
done

cp "$ROOT"/assets/*.png "$DIST/assets/"
cp "$ROOT"/icons/* "$DIST/icons/"
cp "$ROOT"/vendor/*.js "$DIST/vendor/"

# ---------------------------------------------------------
# SEC-12 — En-têtes HTTP (Netlify : fichier `_headers`).
# La CSP de index.html (<meta>) ne peut pas porter `frame-ancestors`, ni les
# en-têtes X-Content-Type-Options / Permissions-Policy : on les pose ici. L'hôte
# Supabase de production est LU dans config.js (jamais saisi à la main). En-tête
# et <meta> se cumulent (le plus restrictif gagne) : la production n'autorise
# donc que son propre projet. Le fichier s'applique aussi à sw.js (le service
# worker relaie les GET Supabase). Autre hébergeur : reporter ces en-têtes dans
# sa configuration ; sans en-têtes (GitHub Pages), seule la CSP <meta> s'applique.
# ---------------------------------------------------------
PROD_URL="$(node -e '
  global.window = {}; global.location = { search: "", hostname: "prod.invalid" };
  global.localStorage = { getItem: () => null }; console.info = () => {};
  require(process.argv[1]);
  process.stdout.write(window.SUPABASE_ENVS.production.url || "");
' "$ROOT/config.js")"
case "$PROD_URL" in
  https://*.supabase.co) ;;
  *) echo "ERREUR : URL de production introuvable dans config.js ($PROD_URL)." >&2; exit 1 ;;
esac
PROD_HOST="${PROD_URL#https://}"
# Cohérence : l'hôte de production doit figurer dans la CSP <meta> de index.html.
if ! grep -q "https://${PROD_HOST}" "$ROOT/index.html" || ! grep -q "wss://${PROD_HOST}" "$ROOT/index.html"; then
  echo "ERREUR : ${PROD_HOST} (config.js) absent de la CSP de index.html (connect-src/img-src)." >&2
  exit 1
fi

cat > "$DIST/_headers" <<EOF
/*
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://${PROD_HOST}; connect-src 'self' data: blob: https://${PROD_HOST} wss://${PROD_HOST}; font-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(self), microphone=(), geolocation=(), payment=(), usb=()
  Strict-Transport-Security: max-age=31536000
/sw.js
  Cache-Control: no-cache
EOF

echo "dist/ prêt : $(find "$DIST" -type f | wc -l) fichier(s)."
echo "⚠️  SEC-06 — ne déployer que le contenu de dist/, jamais le dépôt entier."
