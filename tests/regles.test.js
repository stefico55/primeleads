// Tests du moteur de règles CEE (cee/regles.js) : critères de recette du chantier « fiabilité ».
const test = require("node:test");
const assert = require("node:assert");
const CEE = require("../cee/regles.js");

const SET = { prixBas: 6.5, prixHaut: 8.7 };
const lead = (o, q) => Object.assign({ id: "1", siret: "12345678900011", entreprise: "TEST", cp: "69960", ville: "Corbas", naf: "25.62B", secteur: "Industrie", froid: false, score: 95, surface: 8000, hauteur: 10 }, o || {}, { q: q || {} });
const fiche = (r, f) => r.fiches.find(x => x.fiche === f);

test("zones climatiques : répartition officielle complète", () => {
  assert.strictEqual(CEE.zoneDe("69960"), "H1");
  assert.strictEqual(CEE.zoneDe("06000"), "H3", "Nice");
  assert.strictEqual(CEE.zoneDe("33000"), "H2", "Bordeaux");
  assert.strictEqual(CEE.zoneDe("20000"), "H3", "Ajaccio (2A)");
  assert.strictEqual(CEE.zoneDe("20200"), "H3", "Bastia (2B)");
  assert.strictEqual(CEE.zoneDe("75001"), "H1");
  assert.strictEqual(CEE.zoneDe("97400"), null, "outre-mer non paramétré");
  assert.strictEqual(CEE.zoneDe(""), null);
  const deps = Object.keys(CEE.ZONES);
  assert.strictEqual(deps.length, 96, "96 départements métropolitains");
});

test("recette 1 : critères inconnus → ni montant, ni statut « réuni », ni note sur 100", () => {
  const r = CEE.evaluer(lead(), SET);
  assert.strictEqual(r.kwhc, 0);
  assert.strictEqual(r.hi, 0);
  const e = CEE.eligibilite(r);
  assert.strictEqual(e.k, "wait");
  assert.doesNotMatch(JSON.stringify(e), /100|garanti/);
  const p = CEE.pertinence(lead(), r);
  assert.ok(p.v <= 100);
});

test("pertinence : les saisies de contact ne gonflent plus le score", () => {
  const l = lead({}, { tel: "0472770550", pch: "200", pel: "50" });
  const p = CEE.pertinence(l, CEE.evaluer(l, SET));
  assert.strictEqual(p.v, 95);
});

test("recette 3 : entrepôt confirmé → déstratification exclue (IND-BA-110 et BAT-TH-142)", () => {
  for (const [sect, f] of [["Industrie", "IND-BA-110"], ["Tertiaire", "BAT-TH-142"]]) {
    for (const act of ["logistique", "froid"]) {
      const r = CEE.evaluer(lead({ secteur: sect }, { activite: act, hsp: "10", chauffage: "convectif", pch: "300" }), SET);
      const d = fiche(r, f);
      assert.strictEqual(d.etat, "ko", f + " / " + act);
      assert.strictEqual(d.kwhc, 0);
      assert.match(d.msgs[0], /Exclu/);
      assert.strictEqual(d.excl.niveau, "certaine");
      assert.notStrictEqual(CEE.eligibilite(r).k, "ok");
    }
  }
});

test("recette 3 : entrepôt probable (NAF d'entreposage) → pas de chiffrage ni de recommandation positive", () => {
  const l = lead({ naf: "52.10B", secteur: "Tertiaire" }, { hsp: "10", chauffage: "convectif", pch: "300" });
  const r = CEE.evaluer(l, SET), d = fiche(r, "BAT-TH-142");
  assert.strictEqual(d.etat, "wait");
  assert.strictEqual(d.kwhc, 0);
  assert.strictEqual(d.excl.niveau, "probable");
  assert.strictEqual(CEE.eligibilite(r).k, "probx");
  assert.ok(CEE.pertinence(l, r).v < 95, "pertinence pénalisée");
  // l'activité confirmée « atelier » lève l'exclusion probable
  const r2 = CEE.evaluer(lead({ naf: "52.10B", secteur: "Tertiaire" }, { activite: "atelier", hsp: "10", chauffage: "convectif", pch: "300" }), SET);
  assert.strictEqual(fiche(r2, "BAT-TH-142").etat, "ok");
});

test("déstratification : montant officiel et estimation conditionnelle tant que la consigne n'est pas confirmée", () => {
  const q = { activite: "atelier", hsp: "8", chauffage: "convectif", pch: "100" };
  const r = CEE.evaluer(lead({}, q), SET), d = fiche(r, "IND-BA-110");
  assert.strictEqual(d.kwhc, 720000, "7 200 kWhc/kW en H1");
  assert.strictEqual(CEE.eligibilite(r).k, "cond");
  const r2 = CEE.evaluer(lead({}, Object.assign({ consigne: "oui" }, q)), SET);
  assert.strictEqual(CEE.eligibilite(r2).k, "ok");
  assert.match(CEE.eligibilite(r2).d, /aucune prime n'est acquise/);
  const r3 = CEE.evaluer(lead({ cp: "06200", secteur: "Tertiaire" }, Object.assign({ consigne: "oui" }, q)), SET);
  assert.strictEqual(fiche(r3, "BAT-TH-142").kwhc, 460000, "4 600 kWhc/kW en H3 (Nice)");
  const r4 = CEE.evaluer(lead({}, Object.assign({}, q, { consigne: "non" })), SET);
  assert.strictEqual(fiche(r4, "IND-BA-110").etat, "ko");
  const r5 = CEE.evaluer(lead({}, Object.assign({}, q, { hsp: "4" })), SET);
  assert.strictEqual(fiche(r5, "IND-BA-110").etat, "ko");
});

test("HP flottante : groupe froid probable → à confirmer, jamais chiffré", () => {
  const l = lead({ froid: true, secteur: "Tertiaire" }, { pel: "50", cond: "air", usage: "refrig" });
  const r = CEE.evaluer(l, SET), h = fiche(r, "BAT-TH-134");
  assert.strictEqual(CEE.froidStatut(l), "probable");
  assert.strictEqual(h.etat, "wait");
  assert.match(h.msgs[0], /probable/);
  const r2 = CEE.evaluer(lead({ froid: true, secteur: "Tertiaire" }, { froid: "oui", pel: "50", cond: "air", usage: "refrig" }), SET);
  assert.strictEqual(fiche(r2, "BAT-TH-134").kwhc, 955000, "19 100 × 50 kW en H1");
  const r3 = CEE.evaluer(lead({ froid: true }, { froid: "oui", pel: "10", cond: "eau" }), SET);
  assert.strictEqual(fiche(r3, "IND-UT-116").kwhc, 117000);
});

test("PAC : basse température en résidentiel exige Etas ≥ 126 %", () => {
  const base = { pacP: "100", pacEtas: "120", pacLog: "40", pacChauf: "200", pacUsage: "ch" };
  const r = CEE.evaluer(lead({ secteur: "Résidentiel" }, Object.assign({}, base)), SET);
  assert.match(fiche(r, "BAR-TH-179").msgs.join(), /basse ou moyenne/);
  const r2 = CEE.evaluer(lead({ secteur: "Résidentiel" }, Object.assign({ pacTemp: "bt" }, base)), SET);
  assert.strictEqual(fiche(r2, "BAR-TH-179").etat, "ko");
  const r3 = CEE.evaluer(lead({ secteur: "Résidentiel" }, Object.assign({}, base, { pacUsage: "ecs" })), SET);
  assert.strictEqual(fiche(r3, "BAR-TH-179").kwhc, 146000 * 40, "chauffage + ECS : réputée moyenne/haute température");
});

test("chaque fiche porte version, date d'effet, source et durée de vie officielles", () => {
  for (const [k, b] of Object.entries(CEE.FICHES)) {
    assert.match(b.version, /^A\d+\.\d+$/, k);
    assert.match(b.pdf, /^https:\/\/www\.ecologie\.gouv\.fr\//, k);
    assert.ok(b.dvc > 0 && b.relu, k);
  }
  assert.strictEqual(CEE.FICHES["BAT-TH-142"].effet, "2025-08-01");
  assert.strictEqual(CEE.FICHES["IND-BA-110"].effet, "2025-08-01");
  assert.strictEqual(CEE.FICHES["BAT-TH-163"].dvc, 22);
  const r = CEE.evaluer(lead(), SET);
  r.fiches.forEach(f => assert.ok(f.regle && f.regle.version && f.regle.pdf));
});

test("rôles : un commissaire aux comptes n'est jamais un décideur", () => {
  assert.strictEqual(CEE.roleDirigeant("Commissaire aux comptes suppléant"), "controle");
  assert.strictEqual(CEE.roleDirigeant("Commissaire aux comptes titulaire"), "controle");
  assert.strictEqual(CEE.roleDirigeant("Président de SAS"), "legal");
  assert.strictEqual(CEE.roleDirigeant("Gérant"), "legal");
  assert.strictEqual(CEE.roleDirigeant("Autre"), "autre");
  assert.strictEqual(CEE.roleDirigeant("Autre", "Ernst & Young Audit"), "controle", "cabinet d'audit (STEF)");
});

test("contacts : numéro partagé ou sans preuve jamais « vérifié »", () => {
  const leads = [
    { siret: "42037022300034", entreprise: "COULEURS PRIMEURS", q: { tel: "04 72 77 05 50" } },
    { siret: "31554738000024", entreprise: "GE FRUITS", q: {}, enr: { ct: { tels: ["+33 4 72 77 05 50"] } } },
    { siret: "42037022300099", entreprise: "COULEURS PRIMEURS", q: { tel: "0472770550" } }
  ];
  const sh = CEE.telsPartages(leads);
  assert.deepStrictEqual(sh.get("0472770550"), ["COULEURS PRIMEURS", "GE FRUITS"]);
  assert.strictEqual(CEE.statutContact({ v: "0472770550", preuve: "siren", url: "https://x.fr", partage: true }).k, "partage");
  assert.strictEqual(CEE.statutContact({ v: "0472770550" }).k, "non_verifie");
  assert.strictEqual(CEE.statutContact({ v: "0472770550", preuve: "siren" }).k, "non_verifie", "preuve sans URL traçable");
  assert.strictEqual(CEE.statutContact({ v: "0472770550", preuve: "siren", url: "https://x.fr/mentions" }).k, "verifie");
});

test("fiabilité : bâtiment voisin présenté comme probable, jamais confirmé", () => {
  const f = CEE.fiabilite(lead({ bd: { m: "proche", d: "2026-11-23" } }));
  const bat = f.items.find(x => x.k === "bat"), h = f.items.find(x => x.k === "hsp");
  assert.strictEqual(bat.etat, "probable");
  assert.strictEqual(h.etat, "probable");
  assert.match(bat.src, /proximité/);
  const f2 = CEE.fiabilite(lead({ froid: true }));
  assert.strictEqual(f2.items.find(x => x.k === "froid").etat, "probable");
});

test("formulations interdites", () => {
  for (const s of ["pour garantir le versement de la prime", "Prime garantie", "éligibilité 100/100", "prime acquise"]) assert.ok(CEE.promesseInterdite(s), s);
  for (const s of ["Fourchette indicative de prime CEE", "sous réserve de la visite technique"]) assert.ok(!CEE.promesseInterdite(s), s);
});
