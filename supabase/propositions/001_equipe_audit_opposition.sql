-- ============================================================================
-- PROPOSITION — NON APPLIQUÉE. À relire puis exécuter d'abord sur une branche
-- Supabase ou un projet de préproduction, jamais directement en production.
-- Aucune donnée n'est supprimée ni réécrite par ce script (ajouts seulement).
-- Voir docs/SECURITE.md pour le contexte de chaque point.
-- ============================================================================

begin;

-- 0. Aligner le schéma versionné sur la production : l'application écrit
--    batiments.ref (identifiant de fiche) et fait un upsert sur (org_id, ref).
alter table public.batiments add column if not exists ref text;
create unique index if not exists batiments_org_ref on public.batiments (org_id, ref);

-- 1. Suppression réservée aux administrateurs.
--    Aujourd'hui « bat_ecriture » (for all) permet à tout membre de supprimer
--    n'importe quelle fiche de son organisation.
drop policy if exists bat_ecriture on public.batiments;
create policy bat_ajout on public.batiments for insert to authenticated
  with check (org_id in (select public.mes_orgs()));
create policy bat_maj on public.batiments for update to authenticated
  using (org_id in (select public.mes_orgs())) with check (org_id in (select public.mes_orgs()));
create policy bat_suppression on public.batiments for delete to authenticated
  using (public.suis_admin(org_id));

-- 2. Journal d'audit en écriture seule (aucune mise à jour ni suppression
--    possible par l'application) : qui a créé, modifié ou supprimé quoi, quand.
create table if not exists public.audit (
  id bigint generated always as identity primary key,
  org_id uuid not null,
  tbl text not null,
  ref text,
  action text not null check (action in ('insert','update','delete')),
  par uuid default auth.uid(),
  t timestamptz not null default now(),
  statut_avant text,
  statut_apres text,
  avant jsonb   -- copie complète seulement pour les suppressions
);
create index if not exists audit_org_t on public.audit (org_id, t desc);
alter table public.audit enable row level security;
create policy audit_lecture on public.audit for select to authenticated
  using (public.suis_admin(org_id));

create or replace function public.audit_batiments() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    insert into public.audit(org_id, tbl, ref, action, statut_avant, avant)
    values (old.org_id, 'batiments', old.ref, 'delete', old.statut, old.data);
    return old;
  elsif tg_op = 'UPDATE' then
    insert into public.audit(org_id, tbl, ref, action, statut_avant, statut_apres)
    values (new.org_id, 'batiments', new.ref, 'update', old.statut, new.statut);
    return new;
  else
    insert into public.audit(org_id, tbl, ref, action, statut_apres)
    values (new.org_id, 'batiments', new.ref, 'insert', new.statut);
    return new;
  end if;
end $$;
drop trigger if exists trg_audit_batiments on public.batiments;
create trigger trg_audit_batiments after insert or update or delete on public.batiments
  for each row execute function public.audit_batiments();

-- 3. Oppositions à la prospection, partagées par l'organisation et
--    enregistrables par tout membre (aujourd'hui la liste vit dans « reglages »,
--    que seuls les administrateurs peuvent écrire).
create table if not exists public.oppositions (
  org_id uuid not null references public.organisations(id) on delete cascade,
  siret text not null,
  siren text generated always as (left(siret, 9)) stored,
  motif text,
  par uuid default auth.uid(),
  par_nom text,
  t timestamptz not null default now(),
  primary key (org_id, siret)
);
alter table public.oppositions enable row level security;
create policy opp_lecture on public.oppositions for select to authenticated
  using (org_id in (select public.mes_orgs()));
create policy opp_ajout on public.oppositions for insert to authenticated
  with check (org_id in (select public.mes_orgs()));
create policy opp_retrait on public.oppositions for delete to authenticated
  using (public.suis_admin(org_id));

-- 4. Concurrence : refuser une mise à jour faite sur une version périmée
--    (deux commerciaux sur la même fiche). L'application devra envoyer
--    « updated_at » lu au chargement ; à brancher côté client avant d'activer.
-- create or replace function public.verrou_optimiste() ... (à écrire avec le client)

commit;

-- Conservation (à décider avec PACLIM, non scripté ici) : par exemple purge
-- annuelle des fiches « Pas intéressé » ou « Perdu » sans activité depuis
-- 3 ans, journal d'audit conservé 1 an. Une purge est une suppression de
-- données réelles : elle demande une décision explicite.
