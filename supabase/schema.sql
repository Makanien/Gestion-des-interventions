-- =========================================================
-- Climat Elec — Schéma Supabase (V2)
-- À exécuter dans l'éditeur SQL du projet Supabase
-- (Dashboard > SQL Editor > New query), puis "Run".
-- =========================================================

-- ---------------------------------------------------------
-- EXTENSIONS
-- ---------------------------------------------------------
create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------
-- 1. TABLE clients
-- ---------------------------------------------------------
create table if not exists public.clients (
  id            uuid primary key default uuid_generate_v4(),
  nom           text not null default '',
  adresse       text not null default '',
  code_postal   text not null default '',
  ville         text not null default '',
  mail          text not null default '',
  tel           text not null default '',
  type_batiment text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  created_by    uuid references auth.users(id) on delete set null,
  updated_by    uuid references auth.users(id) on delete set null
);

-- ---------------------------------------------------------
-- 2. TABLE interventions
-- ---------------------------------------------------------
create table if not exists public.interventions (
  id                   uuid primary key default uuid_generate_v4(),
  client_id            uuid references public.clients(id) on delete set null,
  type_intervention    text not null default '',
  date                 date,
  heure_arrivee        text not null default '',
  heure_depart         text not null default '',
  forfait_deplacement  text not null default '',
  temps_intervention   text not null default '', -- calculé
  statut               text not null default 'terminee', -- 'terminee' | 'a_prevoir'
  descriptif_demande   text not null default '',
  action_realisee      text not null default '',
  devis_souhaite       boolean not null default false,
  devis_commentaire    text not null default '',
  technicien_nom       text not null default '',
  client_present       boolean not null default true,
  client_signature_nom text not null default '',
  client_signature_url text, -- image signature (Storage) — V2
  technicien_signature_url text, -- image signature technicien — V2
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  synced_at            timestamptz,
  deleted_at           timestamptz,
  created_by           uuid references auth.users(id) on delete set null,
  updated_by           uuid references auth.users(id) on delete set null
);
create index if not exists interventions_client_id_idx on public.interventions(client_id);
create index if not exists interventions_date_idx on public.interventions(date);

-- ---------------------------------------------------------
-- 3. TABLE equipements (historique réutilisable par client)
-- ---------------------------------------------------------
create table if not exists public.equipements (
  id             uuid primary key default uuid_generate_v4(),
  client_id      uuid references public.clients(id) on delete cascade,
  intitule       text not null default '',
  marque         text not null default '',
  modele         text not null default '',
  numero_serie   text not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  created_by     uuid references auth.users(id) on delete set null,
  updated_by     uuid references auth.users(id) on delete set null
);
create index if not exists equipements_client_id_idx on public.equipements(client_id);

-- ---------------------------------------------------------
-- 4. TABLE pieces_utilisees
-- ---------------------------------------------------------
create table if not exists public.pieces_utilisees (
  id              uuid primary key default uuid_generate_v4(),
  intervention_id uuid references public.interventions(id) on delete cascade,
  designation     text not null default '',
  reference       text not null default '',
  quantite        numeric not null default 1,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  created_by      uuid references auth.users(id) on delete set null,
  updated_by      uuid references auth.users(id) on delete set null
);
create index if not exists pieces_intervention_id_idx on public.pieces_utilisees(intervention_id);

-- ---------------------------------------------------------
-- 5. TABLE profiles (nom affiché du technicien)
-- ---------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  full_name    text not null default '',
  updated_at   timestamptz not null default now()
);

-- ---------------------------------------------------------
-- TRIGGERS : mise à jour automatique de updated_at
-- ---------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists clients_set_updated_at on public.clients;
create trigger clients_set_updated_at before update on public.clients
  for each row execute function public.set_updated_at();

drop trigger if exists interventions_set_updated_at on public.interventions;
create trigger interventions_set_updated_at before update on public.interventions
  for each row execute function public.set_updated_at();

drop trigger if exists equipements_set_updated_at on public.equipements;
create trigger equipements_set_updated_at before update on public.equipements
  for each row execute function public.set_updated_at();

drop trigger if exists pieces_set_updated_at on public.pieces_utilisees;
create trigger pieces_set_updated_at before update on public.pieces_utilisees
  for each row execute function public.set_updated_at();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------
-- PROFILES : création automatique à l'inscription
-- ---------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------
-- ROW LEVEL SECURITY
-- Stratégie : tous les techniciens authentifiés d'une même
-- équipe partagent les données. Les données ne sont accessibles
-- QU'aux utilisateurs connectés (jamais publiquement).
-- ---------------------------------------------------------
alter table public.clients          enable row level security;
alter table public.interventions    enable row level security;
alter table public.equipements      enable row level security;
alter table public.pieces_utilisees enable row level security;
alter table public.profiles         enable row level security;

-- clients
drop policy if exists clients_select on public.clients;
create policy clients_select on public.clients for select to authenticated using (true);
drop policy if exists clients_insert on public.clients;
create policy clients_insert on public.clients for insert to authenticated with check (true);
drop policy if exists clients_update on public.clients;
create policy clients_update on public.clients for update to authenticated using (true);
drop policy if exists clients_delete on public.clients;
create policy clients_delete on public.clients for delete to authenticated using (true);

-- interventions
drop policy if exists interventions_select on public.interventions;
create policy interventions_select on public.interventions for select to authenticated using (true);
drop policy if exists interventions_insert on public.interventions;
create policy interventions_insert on public.interventions for insert to authenticated with check (true);
drop policy if exists interventions_update on public.interventions;
create policy interventions_update on public.interventions for update to authenticated using (true);
drop policy if exists interventions_delete on public.interventions;
create policy interventions_delete on public.interventions for delete to authenticated using (true);

-- equipements
drop policy if exists equipements_select on public.equipements;
create policy equipements_select on public.equipements for select to authenticated using (true);
drop policy if exists equipements_insert on public.equipements;
create policy equipements_insert on public.equipements for insert to authenticated with check (true);
drop policy if exists equipements_update on public.equipements;
create policy equipements_update on public.equipements for update to authenticated using (true);
drop policy if exists equipements_delete on public.equipements;
create policy equipements_delete on public.equipements for delete to authenticated using (true);

-- pieces_utilisees
drop policy if exists pieces_select on public.pieces_utilisees;
create policy pieces_select on public.pieces_utilisees for select to authenticated using (true);
drop policy if exists pieces_insert on public.pieces_utilisees;
create policy pieces_insert on public.pieces_utilisees for insert to authenticated with check (true);
drop policy if exists pieces_update on public.pieces_utilisees;
create policy pieces_update on public.pieces_utilisees for update to authenticated using (true);
drop policy if exists pieces_delete on public.pieces_utilisees;
create policy pieces_delete on public.pieces_utilisees for delete to authenticated using (true);

-- profiles : un technicien lit tous les profils, ne modifie que le sien
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (true);
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated using (auth.uid() = id);

-- ---------------------------------------------------------
-- REALTIME
-- ---------------------------------------------------------
alter publication supabase_realtime add table public.clients;
alter publication supabase_realtime add table public.interventions;
alter publication supabase_realtime add table public.equipements;
alter publication supabase_realtime add table public.pieces_utilisees;
