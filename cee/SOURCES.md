# Règles CEE paramétrées dans PrimeLeads

Toutes les décisions d'éligibilité et tous les montants viennent de `cee/regles.js`, un code déterministe testé par `npm test`. Aucun modèle génératif ne tranche l'éligibilité ni ne calcule une prime.

Catalogue officiel : <https://www.ecologie.gouv.fr/politiques-publiques/operations-standardisees-deconomies-denergie>

## Fiches (montants et conditions relus le 26/11/2026 contre les PDF officiels)

| Fiche | Version | En vigueur depuis | Durée de vie | Ce qui est vérifié par le moteur |
| --- | --- | --- | --- | --- |
| BAT-TH-142 Déstratification (tertiaire) | A71.4 | 01/08/2025 (opérations engagées avant le 01/08/2030) | 15 ans | Exclusion entrepôts, réserves et stockage ; hauteur ≥ 5 m ; local chauffé ; consigne ≥ 15 °C (réserve tant que non confirmée) ; montant par kW selon zone et chauffage convectif ou radiatif |
| IND-BA-110 Déstratification (industrie) | A71.4 | 01/08/2025 (opérations engagées avant le 01/08/2030) | 15 ans | Idem |
| BAT-TH-134 HP flottante (tertiaire) | A22.1 | non indiquée | 14 ans | Groupe froid confirmé, puissance plaque, condensation air ou eau, usage (réfrigération, confort, datacenter) ; réserve CE1 pour la climatisation de confort |
| IND-UT-116 HP flottante (industrie) | A14.1 | non indiquée | 14 ans | Groupe froid confirmé, puissance plaque, condensation |
| BAT-TH-163 PAC air/eau (tertiaire) | A81.2 | 30/04/2026 (jusqu'au 31/12/2030) | 22 ans | Etas ou COP selon la puissance, basse température, facteur sectoriel, facteur R |
| BAR-TH-179 PAC collective air/eau (résidentiel) | A81.2 | 30/04/2026 (jusqu'au 31/12/2030) | 22 ans | Etas, basse température (sauf chauffage + eau chaude, réputée moyenne/haute température), nombre d'appartements, facteur R |

Zones climatiques : fichier officiel « La répartition des départements par zone climatique » (96 départements métropolitains ; Corse en H3).

## Exclusion des entrepôts (BAT-TH-142 et IND-BA-110)

- **Certaine** quand le commercial confirme « Entrepôt logistique / stockage » ou « Entrepôt frigorifique » : la fiche est exclue, aucun montant, aucune recommandation.
- **Probable** quand l'activité principale de la société relève de l'entreposage, de la manutention, du fret ou de la messagerie (NAF 52.10A/B, 52.21Z, 52.24A/B, 52.29A/B, 49.41A/B/C, 53.20Z) et que l'activité du local n'est pas encore confirmée : pas de chiffrage, statut « Exclusion probable », avertissement dans le script d'appel.
- Une activité du local confirmée et différente (atelier, bureaux…) lève l'exclusion probable.

## Ce qui n'est pas paramétré (signalé plutôt qu'inventé)

- Outre-mer : pas de zone climatique, donc pas de chiffrage.
- Bonifications, programmes « Coup de pouce » et précarité.
- Les annexes « Partie A à compter du 01/07/2026 » (attestations sur l'honneur) n'ont pas été relues : elles ne changent pas les montants.
- Fiches hors des six ci-dessus (LED et gonflage ont été volontairement retirées).
- Le prix du MWh cumac (Réglages) et les coûts de travaux de la note sont des hypothèses commerciales, pas des règles.
