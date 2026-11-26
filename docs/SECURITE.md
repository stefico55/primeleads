# Sécurité et travail en équipe : état des lieux (26/11/2026)

Lecture du code et de `supabase/schema.sql`. Rien n'a été modifié en base, aucun secret n'a été touché, rien n'est déployé.

## Ce qui tient

- **Cloisonnement des organisations** : RLS activée sur toutes les tables ; lecture et écriture filtrées par `mes_orgs()` (SECURITY DEFINER, sans récursion).
- **File d'enrichissement serveur** (`api/lot.js`) : jeton de l'utilisateur et RLS, pas de clé service.
- **Réglages** modifiables par les seuls administrateurs.

## Corrigé dans cette branche (code applicatif, sans migration)

| Problème | Risque | Correction |
| --- | --- | --- |
| « Ne plus appeler » supprimait la fiche en base, et la liste d'opposition (`reglages`) n'était enregistrée que pour un administrateur. | Un commercial retirait une société, puis une recherche suivante la réimportait et elle pouvait être rappelée. Le journal d'appel était perdu. | La fiche est archivée (`data.stop` : date, auteur), plus supprimée. Elle quitte les listes mais reste en base. Elle bloque toute réimportation pour tous les membres et garde son journal. |
| Journal sans auteur stable | Attribution fragile si deux commerciaux portent le même nom | Chaque entrée porte `by` (nom) et `uid` (index du commercial) |

## À traiter (proposé, non appliqué)

Script prêt à relire : `supabase/propositions/001_equipe_audit_opposition.sql`. Il ne fait que des ajouts : aucune suppression ni réécriture de données.

1. **Suppression ouverte à tous** : la politique `bat_ecriture` (`for all`) laisse tout membre supprimer n'importe quelle fiche de l'organisation. La synchronisation supprime aussi en base toute fiche absente de l'état local.
   - Proposition : suppression réservée aux administrateurs.
   - Avec l'archivage ci-dessus, un commercial n'a plus besoin de supprimer.
2. **Aucun audit** : la table `activites` existe mais n'est pas utilisée.
   - Proposition : une table `audit` remplie par un déclencheur. Elle enregistre les créations et les changements de statut, ainsi qu'une copie complète en cas de suppression.
   - Les administrateurs peuvent la lire, personne ne peut la modifier.
3. **Oppositions** : les stocker dans une table `oppositions` (par SIRET) que tout membre peut alimenter, plutôt que dans `reglages`.
4. **Écritures concurrentes** : la synchronisation envoie la fiche entière et la dernière écriture gagne. Si deux commerciaux modifient la même fiche, l'un efface l'autre sans alerte.
   - Proposition : verrou optimiste sur `updated_at`, à brancher côté client avant de l'activer en base.
5. **Fonctions publiques sans session** : `api/enrichir.js` et `api/bdnb.js` répondent sans authentification. `enrichir` consomme le quota Brave.
   - Proposition : exiger le jeton de session, comme `api/lot.js`.
   - Point à vérifier d'abord : le mode démo, qui fonctionne sans compte.
6. **Schéma versionné en retard** : `schema.sql` ne contient pas la colonne `ref` ni l'index unique `(org_id, ref)` que l'application utilise. Le point 0 du script les ajoute (`if not exists`).
7. **Limite de chargement** : `clLoad` lit au plus 5 000 fiches. Au-delà, les fiches suivantes ne s'affichent pas.
   - Risque aggravé : une fiche non chargée peut être considérée comme absente lors d'une synchronisation.
   - À paginer avant d'atteindre ce volume.
8. **Conservation des données** : aucune règle. C'est une décision à prendre avec PACLIM (durées, purge des fiches « Perdu » ou « Pas intéressé »). Une purge supprime des données réelles et demande un accord explicite.
9. **Protection Vercel** : elle est désactivée pendant la démo et doit être réactivée à la fin.

## Environnement de test

- **Local, sans réseau** : `npm test` couvre le moteur CEE, les indicateurs et un parcours complet de l'interface en mode démo (Playwright, API publiques simulées par `tests/fixtures`).
- **Prévisualisation** : chaque branche poussée obtient un aperçu Vercel. Les aperçus n'ont pas la clé Brave, donc l'enrichissement web y est limité. Ils pointent sur la même base Supabase que la production : pour tester sans risque, utiliser le mode démo.
- **Recommandé** : une branche Supabase (ou un projet de préproduction) branchée sur les aperçus, avec ses propres variables d'environnement. Le script `supabase/propositions/` s'y teste avant la production.
