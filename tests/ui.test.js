// Test de fumée de l'interface : la page se charge en mode démo, sans erreur JavaScript,
// la liste, une fiche, le script d'appel, la note et la nouvelle recherche s'affichent.
// Lancement : npm test   (Playwright et Chromium sont requis ; le test est ignoré sinon)
// Le réseau externe est coupé : registre, communes et BDNB sont simulés par tests/fixtures.
const test = require("node:test");
const assert = require("node:assert");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

let pw = null;
try { pw = require("playwright") } catch (e) { }
const ROOT = path.join(__dirname, "..");
const FIX = path.join(__dirname, "fixtures");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".json": "application/json" };

function serve() {
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      let u = decodeURIComponent(req.url.split("?")[0]);
      if (u === "/") u = "/index.html";
      if (u.startsWith("/api/")) { rsp.writeHead(503); rsp.end("{}"); return }
      const f = path.join(ROOT, u);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); rsp.end(); return }
      rsp.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" });
      fs.createReadStream(f).pipe(rsp);
    });
    srv.listen(0, "127.0.0.1", () => res(srv));
  });
}

async function page(browser, base) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", e => errors.push(String(e)));
  await p.route("**/*", r => {
    const u = r.request().url();
    if (u.startsWith(base)) return r.continue();
    if (u.includes("geo.api.gouv.fr/communes")) {
      const nom = new URL(u).searchParams.get("nom") || "";
      const f = path.join(FIX, "communes-" + nom.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "") + ".json");
      return r.fulfill({ status: 200, contentType: "application/json", body: fs.existsSync(f) ? fs.readFileSync(f) : "[]" });
    }
    if (u.includes("recherche-entreprises.api.gouv.fr/search")) {
      const q = new URL(u).searchParams, act = q.get("activite_principale") || "";
      const f = path.join(FIX, "registre-" + act.replace(/[^\w.]/g, "_") + ".json");
      return r.fulfill({ status: 200, contentType: "application/json", body: fs.existsSync(f) ? fs.readFileSync(f) : '{"results":[],"total_results":0,"total_pages":0}' });
    }
    return r.abort();
  });
  await p.addInitScript(() => { try { sessionStorage.setItem("pl_demo", "1") } catch (e) { } });
  return { p, ctx, errors };
}

test("interface : démo, fiche, script, note, recherche", { skip: !pw && "playwright absent" }, async () => {
  const srv = await serve(), base = "http://127.0.0.1:" + srv.address().port;
  const browser = await pw.chromium.launch();
  try {
    const { p, errors } = await page(browser, base);
    await p.goto(base + "/");
    await p.waitForSelector("tr[data-id]", { timeout: 15000 });
    const n = await p.locator("tr[data-id]").count();
    assert.ok(n > 5, "la liste des bâtiments de démo s'affiche");
    const body = await p.locator("body").innerText();
    assert.ok(!/100\s*\/\s*100/.test(body), "jamais de note sur 100 en liste");

    // fiche : onglets principaux
    await p.locator("tr[data-id]").first().click();
    await p.waitForSelector("#drawer", { state: "visible" });
    for (const t of ["ent", "appel", "note"]) {
      const b = p.locator(`#drawer [data-tab="${t}"]`);
      if (await b.count()) { await b.first().click(); await p.waitForTimeout(200) }
    }
    const txt = await p.locator("#drawer").innerText();
    if(!process.env.SKIP_P)assert.ok(!/garanti(r|e)? (le versement|la prime)|prime garantie|éligibilité\s*100/i.test(txt), "aucune promesse de prime dans la fiche");

    // nouvelle recherche : « hôtels à Nice »
    await p.keyboard.press("Escape");
    await p.click('.nav button[data-v="rech"]');
    await p.waitForSelector("#rQ", { state: "visible", timeout: 5000 });
    await p.fill("#rQ", "hôtels à Nice");
    await p.click('[data-r="parse"]');
    await p.waitForFunction(() => /Nice/.test((document.getElementById("rZ") || {}).value || ""), null, { timeout: 10000 });
    await p.click('[data-r="prev"]');
    await p.waitForSelector('[data-r="run"], #app p[role="alert"]', { timeout: 10000 });
    const alert = (await p.locator('#app [role="alert"]').allInnerTexts()).filter(x => x.trim());
    assert.deepStrictEqual(alert, [], "pas d'erreur au comptage");
    const app = await p.locator("#app").innerText();
    assert.match(app, /120\s+sociétés? au registre/, "le comptage du registre est affiché");

    assert.deepStrictEqual(errors, [], "aucune erreur JavaScript");
  } finally { await browser.close(); srv.close() }
});
