// « Lint » minimal : vérifie la syntaxe des scripts inline d'index.html et des fonctions api/ (sans dépendance).
const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
let n = 0, bad = 0;
for (const m of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)) {
  n++;
  try { new vm.Script(m[1], { filename: "index.html#script" + n }) } catch (e) { bad++; console.error("index.html script " + n + " : " + e.message) }
}
for (const f of fs.readdirSync(path.join(root, "api")).concat(["../cee/regles.js"])) {
  const p = path.join(root, "api", f);
  try { new vm.Script(fs.readFileSync(p, "utf8").replace(/^#!.*/, ""), { filename: p }) } catch (e) { bad++; console.error(p + " : " + e.message) }
}
console.log(n + " scripts inline et fonctions api/ vérifiés" + (bad ? ", " + bad + " en erreur" : ", syntaxe correcte"));
process.exit(bad ? 1 : 0);
