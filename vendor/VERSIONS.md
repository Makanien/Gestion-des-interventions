# Dépendances embarquées (`vendor/`)

Ces fichiers sont servis tels quels (aucun CDN à l'exécution, CSP `script-src 'self'`).
Les versions sont **épinglées aussi dans `package.json`** (devDependencies) : c'est ce qui permet à
Dependabot d'ouvrir une PR dès qu'une nouvelle version ou un avis de sécurité apparaît.
`npm run vendor:check` (exécuté en CI) vérifie que les empreintes ci-dessous correspondent aux fichiers.

| Fichier | Paquet | Version | SHA-256 | Source |
| --- | --- | --- | --- | --- |
| `jspdf.umd.min.js` | jspdf | 4.2.1 | `e6551fcdc32f09d6853b2c5126d18d01d9447e0da618a41a11ebeee0f6c20d54` | `node_modules/jspdf/dist/jspdf.umd.min.js` (identique octet pour octet au paquet npm) |
| `supabase-js.min.js` | @supabase/supabase-js | 2.112.3 | `cf529fe8980cbe6f2dd3e3930ecf96352ed3d3d71233b6760e4f927f89b94b9f` | `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.3/dist/umd/supabase.js` (jsDelivr minifie à la volée : non reproductible depuis npm — l'empreinte ci-dessus fait foi) |

`pdf-lib` n'est plus embarqué (retiré, non maintenu depuis 2021).

## Mettre à jour une dépendance

1. Accepter la PR Dependabot (ou `npm i -D --save-exact <paquet>@<version>`).
2. **jsPDF** : `cp node_modules/jspdf/dist/jspdf.umd.min.js vendor/`.
   **supabase-js** : télécharger la même version depuis jsDelivr (URL ci-dessus), enregistrer sous `vendor/supabase-js.min.js`.
3. Mettre à jour la version et l'empreinte (`sha256sum vendor/*.js`) dans le tableau ci-dessus.
4. `npm run vendor:check && npm test && npm run build`, puis tester l'export PDF et la connexion avant de fusionner.
