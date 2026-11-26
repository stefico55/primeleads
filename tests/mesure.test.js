// Tests des issues d'appel et des indicateurs (cee/mesure.js) : aucun chiffre sans donnée saisie.
const test = require("node:test");
const assert = require("node:assert");
const MES = require("../cee/mesure.js");

const ev = (o, by, t, x) => Object.assign({ t: t || "2026-11-20T10:00:00Z", by: by || "Léa", txt: o, k: "appel", o }, x || {});
const L = (id, journal, o) => Object.assign({ id, cp: "69960", journal }, o || {});

test("aucune issue saisie : zéro partout et aucun taux", () => {
  const s = MES.stats([L("1", []), L("2", [{ t: "2026-11-20T10:00:00Z", by: "Léa", txt: "Appel effectué", k: "appel" }])]);
  assert.strictEqual(s.total.appeles, 0);
  assert.strictEqual(s.total.tJoignable, null);
  assert.strictEqual(s.total.tRdv, null);
  assert.strictEqual(s.total.tGagne, null);
  assert.strictEqual(s.prep.mediane, null);
  assert.strictEqual(s.nonStructures, 1, "l'ancienne entrée libre est signalée, pas comptée");
});

test("entonnoir : tentatives, conversations, visites, devis, gains, comptés par fiche", () => {
  const leads = [
    L("1", [ev("repondeur"), ev("joint"), ev("crit_ok", "Léa", null, { crit: "hsp" }), ev("rdv"), ev("visite"), ev("devis"), ev("gagne")]),
    L("2", [ev("bad", "Marc")]),
    L("3", [ev("barrage", "Marc"), ev("joint", "Marc"), ev("perdu", "Marc")]),
    L("4", [])
  ];
  const s = MES.stats(leads, { op: l => (l.id === "2" ? "IND-BA-110" : "BAT-TH-142"), zone: () => "69 · H1" });
  const T = s.total;
  assert.strictEqual(T.appeles, 3);
  assert.strictEqual(T.tentatives, 5);
  assert.strictEqual(T.joints, 2);
  assert.strictEqual(T.tJoignable, 66.7);
  assert.strictEqual(T.rdv, 1);
  assert.strictEqual(T.tRdv, 50);
  assert.strictEqual(T.visites, 1);
  assert.strictEqual(T.devis, 1);
  assert.strictEqual(T.tDevis, 100);
  assert.strictEqual(T.gagnes, 1);
  assert.strictEqual(T.perdus, 1);
  assert.strictEqual(T.tGagne, 50);
  assert.strictEqual(T.critOk, 1);
  const lea = s.parCommercial.find(x => x.k === "Léa"), marc = s.parCommercial.find(x => x.k === "Marc");
  assert.strictEqual(lea.appeles, 1);
  assert.strictEqual(marc.appeles, 2);
  assert.strictEqual(marc.joints, 1);
  assert.strictEqual(s.parOperation.find(x => x.k === "IND-BA-110").appeles, 1);
  assert.strictEqual(s.parZone[0].appeles, 3);
});

test("période : les issues antérieures sont exclues", () => {
  const s = MES.stats([L("1", [ev("joint", "Léa", "2026-01-01T10:00:00Z"), ev("rdv", "Léa", "2026-11-25T10:00:00Z")])], { depuis: "2026-11-01T00:00:00Z" });
  assert.strictEqual(s.total.rdv, 1);
  assert.strictEqual(s.total.joints, 1, "la visite planifiée prouve une conversation dans la période");
  const s2 = MES.stats([L("1", [ev("joint", "Léa", "2026-01-01T10:00:00Z")])], { depuis: "2026-11-01T00:00:00Z" });
  assert.strictEqual(s2.total.appeles, 0);
});

test("temps de préparation : médiane des durées mesurées seulement", () => {
  const s = MES.stats([L("1", [ev("joint", "Léa", null, { prep: 120 }), ev("bad", "Léa", null, { prep: 300 }), ev("repondeur", "Léa", null, { prep: 60 })])]);
  assert.deepStrictEqual(s.prep, { n: 3, mediane: 120 });
});

test("chaque issue a un libellé et une étape", () => {
  for (const [k, v] of Object.entries(MES.ISSUES)) assert.ok(v.t && v.e, k);
  for (const k of ["bad", "standard", "joint", "crit_ok", "crit_ko", "rappel", "rdv", "visite", "devis", "gagne", "perdu"]) assert.ok(MES.ISSUES[k], k);
});
