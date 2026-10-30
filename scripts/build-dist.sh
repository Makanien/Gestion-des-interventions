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

echo "dist/ prêt : $(find "$DIST" -type f | wc -l) fichier(s)."
echo "⚠️  SEC-06 — ne déployer que le contenu de dist/, jamais le dépôt entier."
