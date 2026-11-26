/* PrimeLeads : moteur de règles CEE.
 * Déterministe, versionné et testable (node --test). Aucune décision d'éligibilité ni aucun calcul de prime n'est confié à une IA.
 * Chargé tel quel par index.html (window.CEE) et par les tests Node (require).
 *
 * Chaque fiche porte sa version, sa date d'effet, le PDF officiel et la date à laquelle les montants ont été relus.
 * Source : https://www.ecologie.gouv.fr/politiques-publiques/operations-standardisees-deconomies-denergie
 */
(function (root, factory) {
  const M = factory();
  if (typeof module === "object" && module.exports) module.exports = M;
  else root.CEE = M;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const CATALOGUE = "https://www.ecologie.gouv.fr/politiques-publiques/operations-standardisees-deconomies-denergie";
  const DOC = "https://www.ecologie.gouv.fr/sites/default/files/documents/";
  const RELU = "2026-11-26"; // date de relecture des montants et conditions contre les PDF officiels

  /* ---------- Fiches paramétrées ---------- */
  const FICHES = {
    "BAT-TH-142": {
      nom: "Déstratification d'air (tertiaire)", secteur: "Tertiaire", famille: "destrat",
      version: "A71.4", effet: "2025-08-01", fin: "opérations engagées avant le 01/08/2030", dvc: 15, relu: RELU,
      pdf: DOC + "BAT-TH-142%20vA71-4%20%C3%A0%20compter%20du%2001-08-2025.pdf",
      H1: { conv: 3900, rad: 1400 }, H2: { conv: 4500, rad: 1600 }, H3: { conv: 4600, rad: 1600 },
      unite: "kWh cumac par kW de chauffage du local",
      cond: ["Bâtiment tertiaire existant, France métropolitaine", "Local complètement clos, hauteur sous plafond ou sous faîtage ≥ 5 m",
        "Consigne de chauffage ≥ 15 °C lorsque le local est occupé", "Exclus depuis le 01/08/2025 : entrepôts logistiques, réserves, entrepôts et locaux de stockage",
        "Brasseurs d'air plafonniers non éligibles", "Note de dimensionnement et calepinage par un professionnel ou bureau d'études qualifié",
        "Chauffages convectif et radiatif cumulables"]
    },
    "IND-BA-110": {
      nom: "Déstratification d'air (industrie)", secteur: "Industrie", famille: "destrat",
      version: "A71.4", effet: "2025-08-01", fin: "opérations engagées avant le 01/08/2030", dvc: 15, relu: RELU,
      pdf: DOC + "IND-BA-110%20vA71-4%20%C3%A0%20compter%20du%2001-08-2025.pdf",
      H1: { conv: 7200, rad: 2500 }, H2: { conv: 8000, rad: 2800 }, H3: { conv: 8500, rad: 3000 },
      unite: "kWh cumac par kW de chauffage du local",
      cond: ["Bâtiment industriel existant, France métropolitaine", "Local industriel complètement clos, hauteur sous plafond ou sous faîtage ≥ 5 m",
        "Consigne de chauffage ≥ 15 °C lorsque le local est occupé", "Exclus depuis le 01/08/2025 : entrepôts logistiques, réserves, entrepôts et locaux de stockage",
        "Brasseurs d'air plafonniers non éligibles", "Note de dimensionnement et calepinage par un professionnel ou bureau d'études qualifié",
        "Chauffages convectif et radiatif cumulables"]
    },
    "BAT-TH-134": {
      nom: "Régulation HP flottante (tertiaire)", secteur: "Tertiaire", famille: "hp",
      version: "A22.1", effet: null, fin: null, dvc: 14, relu: RELU,
      pdf: DOC + "BAT-TH-134%20vA22-1.pdf",
      usages: {
        refrig: { H1: { air: 19100, eau: 13400 }, H2: { air: 17000, eau: 12800 }, H3: { air: 16400, eau: 10500 } },
        confort: { H1: { air: 2000, eau: 670 }, H2: { air: 1800, eau: 480 }, H3: { air: 1600, eau: 290 } },
        datacenter: { H1: { air: 22800, eau: 14500 }, H2: { air: 20500, eau: 13900 }, H3: { air: 20200, eau: 11300 } }
      },
      unite: "kWh cumac par kW électrique du groupe froid",
      cond: ["Bâtiment tertiaire en France métropolitaine", "Puissance électrique nominale du groupe (plaque signalétique, hors compresseurs de secours)",
        "Étude technique préalable obligatoire, établie par un professionnel ou un bureau d'études", "Bâtiments neufs CE1 exclus pour la climatisation de confort"]
    },
    "IND-UT-116": {
      nom: "Régulation HP flottante (industrie)", secteur: "Industrie", famille: "hp",
      version: "A14.1", effet: null, fin: null, dvc: 14, relu: RELU,
      pdf: DOC + "IND-UT-116%20vA14-1.pdf",
      H1: { air: 14300, eau: 11700 }, H2: { air: 14300, eau: 11700 }, H3: { air: 13500, eau: 10400 },
      unite: "kWh cumac par kW électrique du groupe froid",
      cond: ["Site industriel", "Puissance électrique nominale du groupe (plaque signalétique)", "Mise en place par un professionnel"]
    },
    "BAT-TH-163": {
      nom: "Pompe à chaleur air/eau (tertiaire)", secteur: "Tertiaire", famille: "pac",
      version: "A81.2", effet: "2026-04-30", fin: "opérations engagées jusqu'au 31/12/2030", dvc: 22, relu: RELU,
      pdf: DOC + "BAT-TH-163%20vA81-2%20%C3%A0%20compter%20du%2030-04-2026.pdf",
      unite: "kWh cumac par m² chauffé",
      etas: [[111, { H1: 1100, H2: 900, H3: 600 }], [126, { H1: 1200, H2: 1000, H3: 700 }], [175, { H1: 1300, H2: 1000, H3: 700 }]],
      cop: [[3.4, { H1: 1100, H2: 900, H3: 600 }], [4.5, { H1: 1200, H2: 1000, H3: 700 }]],
      fac: { hotel: 0.7, sante: 1.1, enseignement: 0.8, bureaux: 1.2, commerce: 0.9, autre: 0.7 },
      cond: ["Bâtiment tertiaire existant", "PAC de 400 kW ou moins : Etas ≥ 111 % (moyenne ou haute température) ou ≥ 126 % (basse température)",
        "PAC de plus de 400 kW : COP ≥ 3,4 à 35 °C (EN 14511-2)", "Étude préalable de dimensionnement datée et signée, remise dès l'engagement",
        "Chauffage seul, ou chauffage et eau chaude : une PAC dédiée à l'eau chaude seule est exclue"]
    },
    "BAR-TH-179": {
      nom: "Pompe à chaleur collective air/eau (résidentiel)", secteur: "Résidentiel", famille: "pac",
      version: "A81.2", effet: "2026-04-30", fin: "opérations engagées jusqu'au 31/12/2030", dvc: 22, relu: RELU,
      pdf: DOC + "BAR-TH-179%20vA81-2%20%C3%A0%20compter%20du%2030-04-2026.pdf",
      unite: "kWh cumac par appartement chauffé",
      etas: [[111, { ch: { H1: 100000, H2: 84000, H3: 60000 }, ecs: { H1: 146000, H2: 127000, H3: 100000 } }],
        [126, { ch: { H1: 107000, H2: 89000, H3: 64000 }, ecs: { H1: 155000, H2: 135000, H3: 107000 } }],
        [150, { ch: { H1: 112000, H2: 93000, H3: 67000 }, ecs: { H1: 163000, H2: 142000, H3: 112000 } }],
        [175, { ch: { H1: 115000, H2: 96000, H3: 69000 }, ecs: { H1: 167000, H2: 146000, H3: 115000 } }],
        [190, { ch: { H1: 117000, H2: 97000, H3: 70000 }, ecs: { H1: 170000, H2: 148000, H3: 117000 } }]],
      cond: ["Résidentiel collectif existant", "PAC air/eau de 400 kW ou moins, pour un chauffage collectif",
        "Etas ≥ 111 % (moyenne ou haute température) ou ≥ 126 % (basse température)", "Professionnel titulaire d'un signe de qualité (RGE)",
        "Une PAC dédiée à l'eau chaude seule est exclue", "Non cumulable avec BAR-TH-169 si la PAC fait chauffage et eau chaude"]
    }
  };

  /* ---------- Zones climatiques ---------- */
  // Répartition officielle des départements par zone climatique (fichier du ministère, relu le 26/11/2026).
  const ZONES_SRC = DOC + "La%20r%C3%A9partition%20des%20d%C3%A9partements%20par%20zone%20climatique.pdf";
  const ZL = {
    H1: "01 02 03 05 08 10 14 15 19 21 23 25 27 28 38 39 42 43 45 51 52 54 55 57 58 59 60 61 62 63 67 68 69 70 71 73 74 75 76 77 78 80 87 88 89 90 91 92 93 94 95",
    H2: "04 07 09 12 16 17 18 22 24 26 29 31 32 33 35 36 37 40 41 44 46 47 48 49 50 53 56 64 65 72 79 81 82 84 85 86",
    H3: "06 11 13 2A 2B 30 34 66 83"
  };
  const ZONES = {};
  for (const z in ZL) ZL[z].split(" ").forEach(d => { ZONES[d] = z });

  // Département à partir d'un code postal (Corse : 200-201 = 2A, 202-206 = 2B ; outre-mer : 3 chiffres).
  function depDe(cp) {
    const c = String(cp || "").trim();
    if (!/^\d{5}$/.test(c)) return "";
    if (c.startsWith("97") || c.startsWith("98")) return c.slice(0, 3);
    if (c.startsWith("20")) return +c.slice(0, 3) < 202 ? "2A" : "2B";
    return c.slice(0, 2);
  }
  function zoneDe(cp) { return ZONES[depDe(cp)] || null }

  /* ---------- Faits sur le prospect ---------- */
  const secteur = l => (l.q && l.q.secteur) || l.secteur;
  const Q = l => l.q || {};
  // Groupe froid : confirmé à l'appel, exclu, probable (déduit de l'activité), ou inconnu.
  function froidStatut(l) {
    const q = Q(l);
    if (q.froid === "oui") return "confirme";
    if (q.froid === "non") return "exclu";
    return l.froid ? "probable" : "inconnu";
  }
  const froidP = l => { const s = froidStatut(l); return s === "confirme" || s === "probable" };

  // Activités principales (NAF) dont le local est le plus souvent un entrepôt ou un local de stockage.
  const NAF_STOCKAGE = {
    "52.10A": "Entreposage et stockage frigorifique", "52.10B": "Entreposage et stockage non frigorifique",
    "52.21Z": "Services auxiliaires des transports terrestres", "52.24A": "Manutention portuaire", "52.24B": "Manutention non portuaire",
    "52.29A": "Messagerie, fret express", "52.29B": "Affrètement et organisation des transports",
    "49.41A": "Transports routiers de fret interurbains", "49.41B": "Transports routiers de fret de proximité", "49.41C": "Location de camions avec chauffeur",
    "53.20Z": "Autres activités de poste et de courrier"
  };
  const ACT_STOCKAGE = { logistique: "Entrepôt logistique ou stockage", froid: "Entrepôt frigorifique" };
  // Exclusion « entrepôts, réserves et locaux de stockage » (BAT-TH-142 et IND-BA-110, depuis le 01/08/2025).
  function stockage(l) {
    const q = Q(l);
    if (ACT_STOCKAGE[q.activite]) return { niveau: "certaine", motif: ACT_STOCKAGE[q.activite] + " (confirmé à l'appel)" };
    if (q.activite) return null; // activité du local confirmée et différente : pas d'exclusion
    const n = NAF_STOCKAGE[l.naf];
    if (n) return { niveau: "probable", motif: "activité principale « " + n + " » (NAF " + l.naf + ") : le local est probablement un entrepôt" };
    return null;
  }

  const tier = (T, v) => { let r = null; for (const [m, x] of T) if (v >= m) r = x; return r };
  const regle = f => { const b = FICHES[f]; return { fiche: f, version: b.version, effet: b.effet, pdf: b.pdf, relu: b.relu } };
  const fr = (f, extra) => Object.assign({ fiche: f, nom: FICHES[f].nom, etat: "wait", msgs: [], reserves: [], excl: null, kwhc: 0, regle: regle(f) }, extra || {});
  const zoneMsg = l => depDe(l.cp).length === 3 ? "Outre-mer : zone climatique non paramétrée, pas de chiffrage" : "Zone climatique inconnue (code postal manquant ou invalide)";

  function pacFiche(l, res) {
    const z = zoneDe(l.cp), q = Q(l), f = res ? "BAR-TH-179" : "BAT-TH-163", b = FICHES[f], p = fr(f);
    const P = Number(q.pacP || 0), S = Number(q.surfChauffee || 0), ch = Number(q.pacChauf || 0), N = Number(q.pacLog || 0), E = Number(q.pacEtas || 0), C = Number(q.pacCop || 0);
    const ko = m => { p.etat = "ko"; p.msgs.push(m); return p };
    if (res && P > 400) return ko("PAC de plus de 400 kW : hors BAR-TH-179");
    const big = !res && P > 400;
    if (!P) p.msgs.push("Puissance de la PAC à demander");
    if (!z) p.msgs.push(zoneMsg(l));
    if (big) {
      if (!C) p.msgs.push("COP à 35 °C de la PAC à demander"); else if (C < 3.4) return ko("COP inférieur à 3,4 : non éligible");
    } else {
      // Chauffage et eau chaude : PAC réputée moyenne ou haute température (Etas ≥ 111 % suffit).
      const mt = res && q.pacUsage === "ecs";
      if (!E) p.msgs.push("Etas de la PAC à demander");
      else if (E < 111) return ko("Etas inférieur à 111 % : non éligible");
      else if (E < 126 && !mt) {
        if (!q.pacTemp) p.msgs.push("Application basse ou moyenne/haute température ?");
        else if (q.pacTemp === "bt") return ko("Basse température : Etas ≥ 126 % requis");
      }
    }
    if (res) { if (!N) p.msgs.push("Nombre d'appartements chauffés à demander"); if (!q.pacUsage) p.msgs.push("Chauffage seul ou chauffage et eau chaude ?") }
    else { if (!S) p.msgs.push("Surface chauffée par la PAC à demander"); if (!q.activite) p.msgs.push("Activité du local à confirmer") }
    if (!ch) p.msgs.push("Puissance utile de la chaufferie après travaux à demander");
    if (p.msgs.length) return p;
    const R = P < 0.4 * ch ? P / ch : 1;
    let k;
    if (res) k = tier(b.etas, E)[q.pacUsage][z] * N * R;
    else { const rate = (big ? tier(b.cop, C) : tier(b.etas, E))[z], fac = b.fac[q.activite] ?? b.fac.autre; k = rate * S * fac * R }
    p.kwhc = Math.round(k); p.etat = "ok";
    p.reserves.push("Étude préalable de dimensionnement à établir");
    return p;
  }

  function destrat(l, ind) {
    const z = zoneDe(l.cp), q = Q(l), f = ind ? "IND-BA-110" : "BAT-TH-142", b = FICHES[f], d = fr(f), h = Number(q.hsp || 0), st = stockage(l);
    const ko = m => { d.etat = "ko"; d.msgs.push(m); return d };
    if (st && st.niveau === "certaine") { d.excl = st; return ko("Exclu par la fiche " + f + " v. " + b.version + " depuis le 01/08/2025 : " + st.motif) }
    if (q.hsp && h < 5) return ko("Hauteur sous plafond < 5 m");
    if (q.chauffage === "aucun") return ko("Local non chauffé");
    if (q.consigne === "non") return ko("Consigne de chauffage inférieure à 15 °C ou local non clos");
    if (st) { d.excl = st; d.msgs.push("Exclusion probable : " + st.motif + ". Si c'est un entrepôt, une réserve ou un local de stockage, la fiche ne s'applique pas") }
    if (!q.activite) d.msgs.push("Activité du local à confirmer (entrepôts et stockage exclus)");
    if (!q.hsp) d.msgs.push("Hauteur sous plafond à confirmer");
    if (!q.chauffage) d.msgs.push("Type de chauffage à demander");
    if (!q.pch) d.msgs.push("Puissance du chauffage à demander");
    if (!z) d.msgs.push(zoneMsg(l));
    if (d.msgs.length) return d;
    d.kwhc = b[z][q.chauffage === "radiatif" ? "rad" : "conv"] * Number(q.pch); d.etat = "ok";
    if (q.consigne !== "oui") d.reserves.push("Local clos et chauffé à 15 °C ou plus quand il est occupé : à confirmer");
    d.reserves.push("Note de dimensionnement et calepinage à établir");
    return d;
  }

  function hp(l, ind) {
    const z = zoneDe(l.cp), q = Q(l), f = ind ? "IND-UT-116" : "BAT-TH-134", b = FICHES[f], p = fr(f), fs = froidStatut(l);
    if (fs === "probable") p.msgs.push("Groupe froid probable d'après l'activité : à confirmer");
    if (!q.pel) p.msgs.push("Puissance électrique du groupe à demander");
    if (!q.cond) p.msgs.push("Condensation à air ou à eau ?");
    if (!ind && !q.usage) p.msgs.push("Usage du froid à préciser");
    if (!z) p.msgs.push(zoneMsg(l));
    if (p.msgs.length) return p;
    p.kwhc = (ind ? b[z] : b.usages[q.usage][z])[q.cond] * Number(q.pel); p.etat = "ok";
    if (!ind && q.usage === "confort") p.reserves.push("Bâtiment neuf CE1 exclu pour la climatisation de confort : à vérifier");
    if (!ind) p.reserves.push("Étude technique préalable à établir");
    return p;
  }

  // Évaluation complète d'un prospect. settings : {prixBas, prixHaut} en € par MWh cumac.
  function evaluer(l, settings) {
    const s = settings || {}, sect = secteur(l), z = zoneDe(l.cp), out = [], ind = sect === "Industrie";
    if (sect === "Résidentiel") out.push(pacFiche(l, true));
    else {
      out.push(destrat(l, ind));
      if (froidP(l)) out.push(hp(l, ind));
      if (Q(l).pac === "oui") {
        if (ind) out.push(fr("BAT-TH-163", { etat: "ko", msgs: ["BAT-TH-163 concerne le tertiaire : pas de fiche PAC retenue pour ce site industriel"] }));
        else out.push(pacFiche(l, false));
      }
    }
    const k = out.reduce((a, f) => a + (f.etat === "ok" ? f.kwhc || 0 : 0), 0);
    return { fiches: out, kwhc: k, lo: k / 1000 * (s.prixBas || 0), hi: k / 1000 * (s.prixHaut || 0), zone: z, conditionnel: out.some(f => f.etat === "ok" && f.reserves.length) };
  }

  /* ---------- Trois indicateurs distincts ---------- */
  // 1. Éligibilité CEE : un statut, jamais une note sur 100.
  function eligibilite(r) {
    const F = r.fiches || [], ok = F.filter(f => f.etat === "ok"), wait = F.filter(f => f.etat === "wait"), probx = wait.filter(f => f.excl);
    const manq = wait.reduce((a, f) => a + f.msgs.length, 0);
    if (!F.length) return { k: "aucune", t: "Aucune fiche identifiée", d: "Aucune opération paramétrée ne correspond à ce site." };
    if (ok.length && wait.length === probx.length && ok.every(f => !f.reserves.some(x => /à confirmer|à vérifier/.test(x))))
      return { k: "ok", t: "Critères déclarés réunis", d: "Selon les informations recueillies. À valider par la visite technique et le dossier : aucune prime n'est acquise avant." };
    if (ok.length) return { k: "cond", t: "Estimation conditionnelle", d: "Chiffrage possible sous réserve des conditions encore à confirmer." };
    if (wait.length > probx.length) return { k: "wait", t: "À qualifier", d: manq + " information" + (manq > 1 ? "s" : "") + " à recueillir avant tout chiffrage." };
    if (probx.length) return { k: "probx", t: "Exclusion probable", d: probx[0].excl.motif + "." };
    return { k: "ko", t: "Non éligible en l'état", d: F.map(f => f.msgs[0]).filter(Boolean).join(" · ") };
  }

  // 2. Pertinence commerciale : intérêt du site (taille, énergie, activité). Ne dit rien de l'éligibilité.
  function pertinence(l, r) {
    let s = Number(l.score) || 0;
    const det = [["Profil du site (surface, hauteur, DPE, activité)", s]];
    const q = Q(l), add = (t, v) => { s += v; det.push([t, v]) };
    if (q.statutOcc === "proprio") add("Propriétaire occupant (décide des travaux)", 8);
    const F = (r && r.fiches) || [], hasOther = F.some(f => f.etat !== "ko" && !f.excl && !/BA-110|TH-142/.test(f.fiche));
    const dx = F.find(f => /BA-110|TH-142/.test(f.fiche));
    if (dx && dx.excl && !hasOther) add(dx.excl.niveau === "certaine" ? "Déstratification exclue (stockage), pas d'autre opération" : "Déstratification probablement exclue (stockage)", dx.excl.niveau === "certaine" ? -30 : -15);
    if (q.froid === "non" && l.froid) add("Pas de groupe froid (confirmé)", -10);
    return { v: Math.max(0, Math.min(100, Math.round(s))), det };
  }

  // 3. Fiabilité des données : chaque donnée clé est confirmée, déduite, probable ou manquante, avec sa source.
  function fiabilite(l) {
    const q = Q(l), qd = l.qd || {}, bd = l.bd || {}, it = [];
    const by = k => qd[k] ? { date: qd[k].t, par: qd[k].by } : {};
    const put = (k, t, etat, v, src, extra) => it.push(Object.assign({ k, t, etat, v: v == null ? "" : String(v), src: src || "" }, extra || {}));
    const bdSrc = bd.m === "proche" ? "BDNB, bâtiment voisin rattaché par proximité" : bd.m && bd.m !== "aucun" ? "BDNB (" + bd.m + ")" : "Fichier initial";
    const bdD = bd.d ? { date: bd.d } : {};
    const appel = k => Object.assign({ par: undefined }, by(k));
    q.activite ? put("activite", "Activité du local", "confirme", q.activite, "Saisie commerciale", appel("activite"))
      : l.naf ? put("activite", "Activité du local", "deduit", "NAF " + l.naf, "Registre (activité principale de la société, pas du local)") : put("activite", "Activité du local", "manquant");
    q.hsp ? put("hsp", "Hauteur sous plafond", "confirme", q.hsp + " m", "Saisie commerciale", appel("hsp"))
      : +l.hauteur ? put("hsp", "Hauteur sous plafond", bd.m === "proche" ? "probable" : "deduit", l.hauteur + " m (hauteur du bâtiment)", bdSrc + (l.fiab_h ? ", fiabilité " + String(l.fiab_h).toLowerCase() : ""), bdD) : put("hsp", "Hauteur sous plafond", "manquant");
    q.surfChauffee ? put("surf", "Surface chauffée", "confirme", q.surfChauffee + " m²", "Saisie commerciale", appel("surfChauffee"))
      : +l.surface ? put("surf", "Surface chauffée", bd.m === "proche" ? "probable" : "deduit", l.surface + " m² (emprise au sol)", bdSrc, bdD) : put("surf", "Surface chauffée", "manquant");
    q.chauffage ? put("chauffage", "Type de chauffage", "confirme", q.chauffage, "Saisie commerciale", appel("chauffage"))
      : l.chauffage && l.chauffage !== "inconnu" ? put("chauffage", "Énergie de chauffage", "deduit", l.chauffage, bdSrc + " (DPE)", bdD) : put("chauffage", "Type de chauffage", "manquant");
    q.pch ? put("pch", "Puissance de chauffage", "confirme", q.pch + " kW", "Saisie commerciale", appel("pch")) : put("pch", "Puissance de chauffage", "manquant");
    const fs = froidStatut(l);
    put("froid", "Groupe froid", fs === "confirme" ? "confirme" : fs === "exclu" ? "confirme" : fs === "probable" ? "probable" : "manquant",
      fs === "confirme" ? "oui" : fs === "exclu" ? "non" : fs === "probable" ? "probable" : "", fs === "probable" ? "Déduit de l'activité (NAF " + (l.naf || "?") + ")" : fs === "inconnu" ? "" : "Saisie commerciale", fs === "probable" ? {} : appel("froid"));
    if (fs === "confirme") q.pel ? put("pel", "Puissance du groupe froid", "confirme", q.pel + " kW", "Saisie commerciale", appel("pel")) : put("pel", "Puissance du groupe froid", "manquant");
    const z = zoneDe(l.cp);
    z ? put("zone", "Zone climatique", "confirme", z, "Code postal " + l.cp + " et répartition officielle") : put("zone", "Zone climatique", "manquant", "", zoneMsg(l));
    !l.bd ? put("bat", "Rattachement au bâtiment", l.surface ? "deduit" : "manquant", l.surface ? "fichier initial" : "", "Fichier initial PACLIM")
      : bd.m === "aucun" ? put("bat", "Rattachement au bâtiment", "manquant", "", "Aucun bâtiment BDNB trouvé")
        : put("bat", "Rattachement au bâtiment", bd.m === "proche" ? "probable" : "deduit", bd.m === "proche" ? "bâtiment voisin" : "par " + bd.m, bdSrc, bdD);
    q.contact ? put("contact", "Interlocuteur", q.contactSrc === "RNE" ? "deduit" : "confirme", q.contact + (q.fonction ? " (" + q.fonction + ")" : ""), q.contactSrc === "RNE" ? "Registre : mandataire légal, pas forcément le décideur travaux" : "Saisie commerciale", appel("contact"))
      : put("contact", "Interlocuteur", "manquant");
    const n = { confirme: 0, deduit: 0, probable: 0, manquant: 0 };
    it.forEach(x => n[x.etat]++);
    return { items: it, n, total: it.length };
  }

  /* ---------- Rôles des personnes au registre ---------- */
  // Mandataire légal (peut engager la société) / organe de contrôle (jamais décideur commercial) / autre.
  function roleDirigeant(qualite) {
    const s = String(qualite || "").toLowerCase();
    if (/commissaire aux comptes|auditeur|conseil de surveillance|censeur|contr[ôo]leur/.test(s)) return "controle";
    if (/pr[ée]sident|directeur g[ée]n[ée]ral|g[ée]rant|directoire|administrateur|repr[ée]sentant|pouvoir/.test(s)) return "legal";
    return "autre";
  }

  /* ---------- Contacts : statut, preuve, doublons ---------- */
  const telNorm = t => { let d = String(t || "").replace(/[^\d+]/g, ""); if (d.startsWith("+33")) d = "0" + d.slice(3); if (d.startsWith("0033")) d = "0" + d.slice(4); return /^0\d{9}$/.test(d) ? d : "" };
  // Statut d'un numéro ou d'un e-mail. « verifie » exige une preuve traçable (page officielle du SIREN) et qu'il ne soit pas partagé.
  function statutContact(c) {
    if (!c || !c.v) return { k: "absent", t: "Absent" };
    if (c.invalide) return { k: "invalide", t: "Invalide" };
    if (c.partage) return { k: "partage", t: "Partagé avec d'autres sociétés" };
    if (c.saisi) return { k: "saisi", t: c.direct ? "Ligne directe (saisie)" : "Saisi par un commercial" };
    if (c.preuve === "siren" && c.url) return { k: "verifie", t: "Vérifié (SIREN sur la page source)" };
    if (c.url) return { k: "probable", t: "Probable (trouvé sur le web)" };
    return { k: "non_verifie", t: "Non vérifié" };
  }
  // Numéros présents sur des fiches de sociétés différentes (SIREN distincts).
  function telsPartages(leads) {
    const m = new Map();
    (leads || []).forEach(l => {
      const siren = String(l.siret || l.id || "").slice(0, 9), tels = new Set();
      const q = l.q || {}, ct = l.enr && l.enr.ct;
      [q.tel].concat(ct ? (ct.tels && ct.tels.length ? ct.tels : [ct.tel]) : []).forEach(t => { const n = telNorm(t); if (n) tels.add(n) });
      tels.forEach(n => { if (!m.has(n)) m.set(n, new Map()); m.get(n).set(siren, l.entreprise || siren) });
    });
    const out = new Map();
    m.forEach((v, n) => { if (v.size > 1) out.set(n, [...v.values()]) });
    return out;
  }

  /* ---------- Formulations interdites ---------- */
  // Aucune promesse de prime avant vérification et dossier validé.
  const PROMESSE = /prime (garantie|assur[ée]e|acquise|certaine)|garanti(r|e|t)? (le versement|la prime|votre prime)|100 ?% (financ|pris en charge|gratuit)|z[ée]ro reste [àa] charge garanti|[ée]ligibilit[ée] (garantie|100\/100|certaine)/i;
  const promesseInterdite = txt => PROMESSE.test(String(txt || "").normalize("NFC"));

  return {
    CATALOGUE, ZONES_SRC, RELU, FICHES, ZONES, NAF_STOCKAGE, ACT_STOCKAGE,
    depDe, zoneDe, secteur, froidStatut, froidP, stockage, evaluer, pacFiche, eligibilite, pertinence, fiabilite,
    roleDirigeant, telNorm, statutContact, telsPartages, promesseInterdite
  };
});
