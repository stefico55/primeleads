-- PrimeLeads : schéma multi-organisations (une base, isolation par organisation)

create table public.organisations (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  created_at timestamptz not null default now()
);

create table public.membres (
  user_id uuid not null references auth.users(id) on delete cascade,
  org_id uuid not null references public.organisations(id) on delete cascade,
  nom text not null,
  role text not null default 'commercial' check (role in ('commercial','admin')),
  created_at timestamptz not null default now(),
  primary key (user_id, org_id)
);

create table public.batiments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  data jsonb not null,                 -- fiche bâtiment telle que l'app la manipule
  statut text not null default 'new',
  owner_id uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
create index on public.batiments (org_id);

create table public.activites (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organisations(id) on delete cascade,
  batiment_id uuid not null references public.batiments(id) on delete cascade,
  par uuid references auth.users(id),
  par_nom text not null,
  kind text not null default 'note',
  txt text not null,
  t timestamptz not null default now()
);
create index on public.activites (org_id, batiment_id);

create table public.reglages (
  org_id uuid primary key references public.organisations(id) on delete cascade,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Organisations de l'utilisateur connecté (SECURITY DEFINER pour éviter la récursion RLS)
create or replace function public.mes_orgs() returns setof uuid
language sql stable security definer set search_path = public as
$$ select org_id from public.membres where user_id = auth.uid() $$;

create or replace function public.suis_admin(o uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select exists(select 1 from public.membres where user_id = auth.uid() and org_id = o and role = 'admin') $$;

alter table public.organisations enable row level security;
alter table public.membres enable row level security;
alter table public.batiments enable row level security;
alter table public.activites enable row level security;
alter table public.reglages enable row level security;

create policy org_lecture on public.organisations for select to authenticated
  using (id in (select public.mes_orgs()));
create policy membres_lecture on public.membres for select to authenticated
  using (org_id in (select public.mes_orgs()));
create policy membres_admin on public.membres for all to authenticated
  using (public.suis_admin(org_id)) with check (public.suis_admin(org_id));

create policy bat_lecture on public.batiments for select to authenticated
  using (org_id in (select public.mes_orgs()));
create policy bat_ecriture on public.batiments for all to authenticated
  using (org_id in (select public.mes_orgs())) with check (org_id in (select public.mes_orgs()));

create policy act_lecture on public.activites for select to authenticated
  using (org_id in (select public.mes_orgs()));
create policy act_ajout on public.activites for insert to authenticated
  with check (org_id in (select public.mes_orgs()));

create policy reg_lecture on public.reglages for select to authenticated
  using (org_id in (select public.mes_orgs()));
create policy reg_admin on public.reglages for all to authenticated
  using (public.suis_admin(org_id)) with check (public.suis_admin(org_id));
