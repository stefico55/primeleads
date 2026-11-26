// Issues d'appel structurées et indicateurs de prospection.
// Règle : aucun chiffre n'est inventé. Chaque indicateur vient des issues saisies par les commerciaux
// (journal des fiches), porte son effectif (n) et vaut null quand le dénominateur est nul.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.MES = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // e : étape. tentative = un appel passé ; joint = conversation avec un interlocuteur ;
  // qualif = critère confirmé ou exclu ; suite = étape commerciale ; statut = statut de la fiche qui en découle.
  const ISSUES = {
    bad: { t: "Mauvais numéro", e: "tentative", statut: "bad" },
    repondeur: { t: "Répondeur", e: "tentative", statut: "rappel" },
    barrage: { t: "Barrage standard", e: "tentative", statut: "rappel" },
    standard: { t: "Standard joint, nom ou ligne directe obtenus", e: "tentative" },
    joint: { t: "Interlocuteur trouvé", e: "joint" },
    crit_ok: { t: "Critère confirmé", e: "qualif" },
    crit_ko: { t: "Critère exclu", e: "qualif" },
    rappel: { t: "Rappel à date", e: "suite", statut: "rappel" },
    mail: { t: "E-mail envoyé", e: "suite", statut: "email" },
    rdv: { t: "Visite technique planifiée", e: "suite", statut: "rdv" },
    visite: { t: "Visite technique réalisée", e: "suite", statut: "visite" },
    devis: { t: "Devis envoyé", e: "suite", statut: "devis" },
    gagne: { t: "Chantier gagné", e: "suite", statut: "gagne" },
    perdu: { t: "Perdu", e: "suite", statut: "perdu" },
    no: { t: "Pas intéressé", e: "suite", statut: "no" },
    stop: { t: "Ne plus appeler", e: "suite" }
  };
  // Une conversation a eu lieu si l'interlocuteur a été trouvé, ou si l'échange a produit une qualification ou une suite.
  const CONV = new Set(["joint", "crit_ok", "crit_ko", "rdv", "visite", "devis", "gagne", "perdu", "no"]);
  const TENT = new Set(["bad", "repondeur", "barrage", "standard", "joint"]);

  const CRITERES = [
    ["activite", "Activité du local"], ["hsp", "Hauteur sous plafond"], ["chauffage", "Mode de chauffage"],
    ["consigne", "Local clos chauffé à 15 °C ou plus"], ["froid", "Groupe froid"], ["pch", "Puissance de chauffage"],
    ["proprio", "Statut d'occupation"], ["decideur", "Décideur identifié"], ["autre", "Autre"]
  ];

  const issuesDe = l => (l.journal || []).filter(j => j && j.o && ISSUES[j.o]);
  const taux = (a, b) => (b ? Math.round((1000 * a) / b) / 10 : null);

  // Agrège un ensemble de fiches : effectifs par fiche (une fiche compte une fois par étape atteinte).
  function bloc(leads, filtreEntree) {
    const f = filtreEntree || (() => true);
    const o = { fiches: leads.length, appeles: 0, tentatives: 0, joints: 0, critOk: 0, critKo: 0, rdv: 0, visites: 0, devis: 0, gagnes: 0, perdus: 0 };
    for (const l of leads) {
      const E = issuesDe(l).filter(f);
      if (!E.length) continue;
      const has = k => E.some(j => j.o === k);
      const nt = E.filter(j => TENT.has(j.o)).length;
      o.tentatives += nt;
      if (nt || E.some(j => CONV.has(j.o))) o.appeles++;
      if (E.some(j => CONV.has(j.o))) o.joints++;
      if (has("crit_ok")) o.critOk++;
      if (has("crit_ko")) o.critKo++;
      if (has("rdv") || has("visite")) o.rdv++;
      if (has("visite")) o.visites++;
      if (has("devis")) o.devis++;
      if (has("gagne")) o.gagnes++;
      if (has("perdu")) o.perdus++;
    }
    o.tJoignable = taux(o.joints, o.appeles);
    o.tRdv = taux(o.rdv, o.joints);
    o.tDevis = taux(o.devis, o.visites);
    o.tGagne = taux(o.gagnes, o.gagnes + o.perdus);
    return o;
  }

  function mediane(v) {
    if (!v.length) return null;
    const s = v.slice().sort((a, b) => a - b), m = s.length >> 1;
    return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
  }

  // opt.op(l) → opération principale ; opt.zone(l) → zone ; opt.depuis → date ISO minimale.
  function stats(leads, opt) {
    opt = opt || {};
    const depuis = opt.depuis ? Date.parse(opt.depuis) : 0;
    const f = j => !depuis || Date.parse(j.t) >= depuis;
    const grp = (keyFn) => {
      const m = new Map();
      for (const l of leads) { const k = keyFn(l) || "Non renseigné"; if (!m.has(k)) m.set(k, []); m.get(k).push(l) }
      return [...m.entries()].map(([k, L]) => Object.assign({ k }, bloc(L, f))).filter(x => x.appeles).sort((a, b) => b.appeles - a.appeles);
    };
    // Par commercial : chaque issue est attribuée à son auteur.
    const auteurs = new Set();
    leads.forEach(l => issuesDe(l).filter(f).forEach(j => auteurs.add(j.by || "Inconnu")));
    const parCommercial = [...auteurs].map(a => Object.assign({ k: a }, bloc(leads, j => f(j) && (j.by || "Inconnu") === a))).sort((x, y) => y.appeles - x.appeles);
    const preps = [];
    leads.forEach(l => issuesDe(l).filter(f).forEach(j => { if (+j.prep > 0) preps.push(+j.prep) }));
    const nonStructures = leads.reduce((a, l) => a + (l.journal || []).filter(j => j && j.k === "appel" && !j.o && f(j)).length, 0);
    return {
      total: bloc(leads, f),
      parOperation: opt.op ? grp(opt.op) : [],
      parZone: opt.zone ? grp(opt.zone) : [],
      parCommercial,
      prep: { n: preps.length, mediane: mediane(preps) },
      nonStructures
    };
  }

  return { ISSUES, CRITERES, CONV, TENT, issuesDe, bloc, stats, taux, mediane };
});
