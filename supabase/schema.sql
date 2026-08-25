-- =========================================================
-- Climat Elec — Schéma Supabase (V2 + V3) — FICHIER MAÎTRE UNIQUE
--
-- À exécuter dans l'éditeur SQL du projet Supabase
-- (Dashboard > SQL Editor > New query), puis "Run".
--
-- Ce fichier consolide l'ancienne suite de 5 scripts
-- (schema.sql, storage.sql, migrations/001_roles_rls.sql,
-- migrations/002_v3.sql, migrations/003_fix_rdv_visibilite.sql)
-- en un SEUL script représentant l'ÉTAT FINAL de la base.
--
-- Il est IDEMPOTENT : il peut être relancé sans erreur ni effet
-- de bord, sur une base neuve comme sur une base déjà migrée.
-- Il n'y a plus d'ordre d'exécution à respecter : un seul fichier.
--
-- Attention : ce fichier suppose que le rôle `anon` n'a AUCUN
-- privilège sur les tables (seul `authenticated` est servi).
-- La barrière d'accès reste l'inscription publique DÉSACTIVÉE
-- (Dashboard > Authentication > Sign In / Providers > Email).
-- =========================================================

-- ---------------------------------------------------------
-- EXTENSIONS
-- ---------------------------------------------------------
create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------
-- 1. TABLE clients (V2)
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
-- 2. TABLE interventions (V2 + colonnes V3)
-- ---------------------------------------------------------
create table if not exists public.interventions (
  id                   uuid primary key default uuid_generate_v4(),
  client_id            uuid references public.clients(id) on delete set null,
  type_intervention    text not null default '',
  date                 date,
  heure_arrivee        text not null default '',
  heure_depart         text not null default '',
  forfait_deplacement  text not null default '',
  temps_intervention   text not null default '', -- calculé par le frontend (heure_arrivee/heure_depart)
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

-- Colonnes V3 (idempotent pour les bases déjà migrées)
alter table public.interventions add column if not exists numero text not null default '';
alter table public.interventions add column if not exists statut_dossier text not null default 'a_valider';
alter table public.interventions add column if not exists type_entretien text not null default '';
alter table public.interventions add column if not exists type_entretien_detail text not null default '';
alter table public.interventions add column if not exists prochaine_intervention_prevue boolean not null default false;
alter table public.interventions add column if not exists annee_installation text not null default '';

create index if not exists interventions_statut_dossier_idx on public.interventions(statut_dossier);

-- ---------------------------------------------------------
-- 3. TABLE equipements (historique réutilisable par client)
-- ---------------------------------------------------------
create table if not exists public.equipements (
  id              uuid primary key default uuid_generate_v4(),
  client_id       uuid references public.clients(id) on delete cascade,
  intitule        text not null default '',
  marque          text not null default '',
  modele          text not null default '',
  numero_serie    text not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  created_by      uuid references auth.users(id) on delete set null,
  updated_by      uuid references auth.users(id) on delete set null
);
create index if not exists equipements_client_id_idx on public.equipements(client_id);

-- Idempotent pour les déploiements existants : la colonne peut manquer
-- sur une table déjà créée avant l'ajout. Doit précéder la création de
-- l'index ci-dessous (sinon l'index échoue en 42703 sur un projet existant).
alter table public.equipements add column if not exists intervention_id uuid references public.interventions(id) on delete set null;
create index if not exists equipements_intervention_id_idx on public.equipements(intervention_id);

-- ---------------------------------------------------------
-- 4. TABLE pieces_utilisees (V2)
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
-- 5. TABLE profiles (nom affiché + rôle)
-- ---------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  full_name    text not null default '',
  updated_at   timestamptz not null default now()
);

-- Rôle (V3) : enum responsable / technicien / secretaire
alter table public.profiles add column if not exists role text not null default 'technicien';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_role_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_role_check
      check (role in ('responsable', 'technicien', 'secretaire'));
  end if;
end $$;

-- ---------------------------------------------------------
-- 6. TABLE appels (V3, US-01)
-- ---------------------------------------------------------
create table if not exists public.appels (
  id                uuid primary key default uuid_generate_v4(),
  nom               text not null default '',
  adresse           text not null default '',
  code_postal       text not null default '',
  ville             text not null default '',
  tel               text not null default '',
  mail              text not null default '',
  motif             text not null default '',
  type_batiment     text not null default '',
  type_intervention text not null default '',
  action_sortie     text not null default 'sans_suite', -- 'rdv' | 'intervention' | 'sans_suite'
  client_id         uuid references public.clients(id) on delete set null,
  rendezvous_id     uuid, -- renseigné si un RDV est créé
  intervention_id   uuid references public.interventions(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  created_by        uuid references auth.users(id) on delete set null,
  updated_by        uuid references auth.users(id) on delete set null
);

-- ---------------------------------------------------------
-- 7. TABLE rendezvous (V3, US-02, planning)
-- ---------------------------------------------------------
create table if not exists public.rendezvous (
  id            uuid primary key default uuid_generate_v4(),
  technicien_id uuid references auth.users(id) on delete set null,
  intervenant   text not null default '', -- nom affiché (Jérémy / Régis)
  date          date,
  heure_debut   text not null default '',
  heure_fin     text not null default '',
  type          text not null default '', -- 'depannage' | 'entretien' | 'rdv_devis'
  client_id     uuid references public.clients(id) on delete set null,
  appel_id      uuid references public.appels(id) on delete set null,
  note          text not null default '',
  statut        text not null default 'planifie',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  created_by    uuid references auth.users(id) on delete set null,
  updated_by    uuid references auth.users(id) on delete set null
);
create index if not exists rendezvous_date_idx on public.rendezvous(date);
create index if not exists rendezvous_technicien_id_idx on public.rendezvous(technicien_id);

-- ---------------------------------------------------------
-- 8. TABLE mesures (V3, US-19, fiches d'entretien)
-- ---------------------------------------------------------
create table if not exists public.mesures (
  id              uuid primary key default uuid_generate_v4(),
  intervention_id uuid references public.interventions(id) on delete cascade,
  type_entretien  text not null default '',
  code            text not null default '',
  libelle         text not null default '',
  valeur          text not null default '',
  unite           text not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  created_by      uuid references auth.users(id) on delete set null,
  updated_by      uuid references auth.users(id) on delete set null
);
create index if not exists mesures_intervention_id_idx on public.mesures(intervention_id);

-- ---------------------------------------------------------
-- 9. TABLE photos (V3, US-21)
-- ---------------------------------------------------------
create table if not exists public.photos (
  id              uuid primary key default uuid_generate_v4(),
  intervention_id uuid references public.interventions(id) on delete cascade,
  data_url        text not null default '',   -- image (dataURL) offline-first
  fichier_url     text not null default '',   -- URL Storage publique si uploadée
  legende         text not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  created_by      uuid references auth.users(id) on delete set null,
  updated_by      uuid references auth.users(id) on delete set null
);
create index if not exists photos_intervention_id_idx on public.photos(intervention_id);

-- ---------------------------------------------------------
-- 10. TABLE pieces (base pièces, V3, US-23 — désignation seule)
-- ---------------------------------------------------------
create table if not exists public.pieces (
  id              uuid primary key default uuid_generate_v4(),
  designation     text not null default '',
  -- Champs réservés pour une extension ultérieure (porte non fermée) :
  -- reference, prix, disponibilite_par_technicien
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  created_by      uuid references auth.users(id) on delete set null,
  updated_by      uuid references auth.users(id) on delete set null
);
create index if not exists pieces_designation_idx on public.pieces(designation);

-- ---------------------------------------------------------
-- 11. TABLE documents (devis / facture / contrat importés, V3, US-07·09)
-- ---------------------------------------------------------
create table if not exists public.documents (
  id              uuid primary key default uuid_generate_v4(),
  intervention_id uuid references public.interventions(id) on delete cascade,
  type            text not null default '', -- 'devis' | 'facture' | 'contrat_entretien'
  nom             text not null default '',
  data_url        text not null default '',   -- PDF en base64 (offline-first)
  fichier_url     text not null default '',   -- URL Storage si uploadé
  numero_externe  text not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  created_by      uuid references auth.users(id) on delete set null,
  updated_by      uuid references auth.users(id) on delete set null
);
create index if not exists documents_intervention_id_idx on public.documents(intervention_id);

-- ---------------------------------------------------------
-- 12. TABLE contrats_entretien (V3, US-24)
-- ---------------------------------------------------------
create table if not exists public.contrats_entretien (
  id                     uuid primary key default uuid_generate_v4(),
  client_id              uuid references public.clients(id) on delete set null,
  nb_passages            text not null default '',
  tarification_zone_km   text not null default '',
  conditions_generales   text not null default '',
  signe_client           text not null default '',
  signe_technicien       text not null default '',
  client_signature_url   text,
  technicien_signature_url text,
  numero                 text not null default '',
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  deleted_at             timestamptz,
  created_by             uuid references auth.users(id) on delete set null,
  updated_by             uuid references auth.users(id) on delete set null
);
create index if not exists contrats_client_id_idx on public.contrats_entretien(client_id);

-- ---------------------------------------------------------
-- FONCTIONS
-- ---------------------------------------------------------

-- updated_at automatique (toutes tables)
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Création automatique du profil à l'inscription.
-- `security definer` avec `set search_path` figé (pratique S4 de la revue).
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- Rôle courant / manager (rôle par défaut : technicien)
create or replace function public.current_role()
returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'technicien');
$$;

create or replace function public.is_manager()
returns boolean
language sql stable security definer set search_path = public as $$
  select public.current_role() in ('responsable', 'secretaire');
$$;

-- Changement de rôle réservé aux managers (responsable / secretaire).
-- Accepte un utilisateur sans profil existant (création au besoin).
create or replace function public.set_user_role(target uuid, new_role text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_manager() then
    raise exception 'Réservé aux gestionnaires (responsable ou secrétaire)';
  end if;
  if new_role not in ('responsable', 'technicien', 'secretaire') then
    raise exception 'Rôle invalide';
  end if;
  insert into public.profiles (id, role)
  values (target, new_role)
  on conflict (id) do update set role = excluded.role;
end;
$$;

revoke all on function public.set_user_role(uuid, text) from public;
grant execute on function public.set_user_role(uuid, text) to authenticated;

-- Renseignement automatique created_by / updated_by / technicien_id
-- (défaut = utilisateur courant). Sans cela, un technicien ne verrait
-- AUCUNE fiche : le frontend actuel ne renseigne jamais ces colonnes.
create or replace function public.set_created_by()
returns trigger language plpgsql as $$
begin
  new.created_by = coalesce(new.created_by, auth.uid());
  new.updated_by = coalesce(new.updated_by, auth.uid());
  return new;
end;
$$;

create or replace function public.set_updated_by()
returns trigger language plpgsql as $$
begin
  new.updated_by = auth.uid();
  return new;
end;
$$;

create or replace function public.set_technicien_default()
returns trigger language plpgsql as $$
begin
  new.technicien_id = coalesce(new.technicien_id, auth.uid());
  return new;
end;
$$;

-- Anti-élévation de rôle : un utilisateur peut modifier son full_name,
-- mais pas son rôle. La garde `auth.uid() is not null` laisse passer les
-- contextes d'administration sans session (migration, SQL editor, service role).
create or replace function public.prevent_role_escalation()
returns trigger language plpgsql as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_manager() then
    new.role = old.role;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------
-- TRIGGERS
-- ---------------------------------------------------------

-- updated_at (12 tables)
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
drop trigger if exists appels_set_updated_at on public.appels;
create trigger appels_set_updated_at before update on public.appels
  for each row execute function public.set_updated_at();
drop trigger if exists rendezvous_set_updated_at on public.rendezvous;
create trigger rendezvous_set_updated_at before update on public.rendezvous
  for each row execute function public.set_updated_at();
drop trigger if exists mesures_set_updated_at on public.mesures;
create trigger mesures_set_updated_at before update on public.mesures
  for each row execute function public.set_updated_at();
drop trigger if exists photos_set_updated_at on public.photos;
create trigger photos_set_updated_at before update on public.photos
  for each row execute function public.set_updated_at();
drop trigger if exists pieces_set_updated_at on public.pieces;
create trigger pieces_set_updated_at before update on public.pieces
  for each row execute function public.set_updated_at();
drop trigger if exists documents_set_updated_at on public.documents;
create trigger documents_set_updated_at before update on public.documents
  for each row execute function public.set_updated_at();
drop trigger if exists contrats_set_updated_at on public.contrats_entretien;
create trigger contrats_set_updated_at before update on public.contrats_entretien
  for each row execute function public.set_updated_at();

-- created_by / updated_by
drop trigger if exists clients_set_created_by on public.clients;
create trigger clients_set_created_by before insert on public.clients
  for each row execute function public.set_created_by();
drop trigger if exists clients_set_updated_by on public.clients;
create trigger clients_set_updated_by before update on public.clients
  for each row execute function public.set_updated_by();
drop trigger if exists interventions_set_created_by on public.interventions;
create trigger interventions_set_created_by before insert on public.interventions
  for each row execute function public.set_created_by();
drop trigger if exists interventions_set_updated_by on public.interventions;
create trigger interventions_set_updated_by before update on public.interventions
  for each row execute function public.set_updated_by();
drop trigger if exists equipements_set_created_by on public.equipements;
create trigger equipements_set_created_by before insert on public.equipements
  for each row execute function public.set_created_by();
drop trigger if exists equipements_set_updated_by on public.equipements;
create trigger equipements_set_updated_by before update on public.equipements
  for each row execute function public.set_updated_by();
drop trigger if exists pieces_set_created_by on public.pieces_utilisees;
create trigger pieces_set_created_by before insert on public.pieces_utilisees
  for each row execute function public.set_created_by();
drop trigger if exists pieces_set_updated_by on public.pieces_utilisees;
create trigger pieces_set_updated_by before update on public.pieces_utilisees
  for each row execute function public.set_updated_by();

do $$
declare t text;
begin
  foreach t in array array['appels','rendezvous','mesures','photos','pieces','documents','contrats_entretien']
  loop
    execute format('drop trigger if exists %I_set_created_by on public.%I', t, t);
    execute format('create trigger %I_set_created_by before insert on public.%I for each row execute function public.set_created_by()', t, t);
    execute format('drop trigger if exists %I_set_updated_by on public.%I', t, t);
    execute format('create trigger %I_set_updated_by before update on public.%I for each row execute function public.set_updated_by()', t, t);
  end loop;
end $$;

-- technicien_id par défaut = utilisateur courant (planning par technicien)
drop trigger if exists interventions_set_technicien on public.interventions;
create trigger interventions_set_technicien before insert on public.interventions
  for each row execute function public.set_technicien_default();
drop trigger if exists rendezvous_set_technicien on public.rendezvous;
create trigger rendezvous_set_technicien before insert on public.rendezvous
  for each row execute function public.set_technicien_default();

-- Anti-élévation de rôle
drop trigger if exists profiles_prevent_role_escalation on public.profiles;
create trigger profiles_prevent_role_escalation
  before update on public.profiles
  for each row execute function public.prevent_role_escalation();

-- Profil automatique à l'inscription
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------
-- STORAGE (buckets + politiques)
-- ---------------------------------------------------------

-- Buckets : signatures (public pour le PDF), photos et documents (privés).
insert into storage.buckets (id, name, public)
values
  ('signatures', 'signatures', true),
  ('photos', 'photos', false),
  ('documents', 'documents', false)
on conflict (id) do nothing;

-- signatures : lecture publique (URL directe dans le PDF), écriture authentifiée.
-- Choix assumé (point S2 de la revue `synchro-supabase`) : le bucket reste public
-- pour permettre l'URL directe dans le PDF et l'affichage hors ligne. L'exposition
-- est limitée par des NOMS D'OBJETS NON DEVINABLES (UUID) : l'app ne génère plus de
-- noms prédictibles (`Date.now()`) et utilise `uuid()` / l'id de la ligne. Risque
-- résiduel : quiconque possède l'URL exacte peut lire l'image — accepté (le PDF signé
-- est destiné au client de toute façon).
drop policy if exists signatures_read on storage.objects;
create policy signatures_read on storage.objects
  for select using (bucket_id = 'signatures');

drop policy if exists signatures_insert on storage.objects;
create policy signatures_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'signatures');

drop policy if exists signatures_update on storage.objects;
create policy signatures_update on storage.objects
  for update to authenticated using (bucket_id = 'signatures');

drop policy if exists signatures_delete on storage.objects;
create policy signatures_delete on storage.objects
  for delete to authenticated using (bucket_id = 'signatures');

-- photos : privées, lecture & écriture authentifiées.
drop policy if exists photos_read on storage.objects;
create policy photos_read on storage.objects
  for select to authenticated using (bucket_id = 'photos');

drop policy if exists photos_insert on storage.objects;
create policy photos_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'photos');

drop policy if exists photos_update on storage.objects;
create policy photos_update on storage.objects
  for update to authenticated using (bucket_id = 'photos');

drop policy if exists photos_delete on storage.objects;
create policy photos_delete on storage.objects
  for delete to authenticated using (bucket_id = 'photos');

-- documents : privés (devis/factures/contrats), lecture & écriture authentifiées.
drop policy if exists documents_read on storage.objects;
create policy documents_read on storage.objects
  for select to authenticated using (bucket_id = 'documents');

drop policy if exists documents_insert on storage.objects;
create policy documents_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'documents');

drop policy if exists documents_update on storage.objects;
create policy documents_update on storage.objects
  for update to authenticated using (bucket_id = 'documents');

drop policy if exists documents_delete on storage.objects;
create policy documents_delete on storage.objects
  for delete to authenticated using (bucket_id = 'documents');

-- ---------------------------------------------------------
-- ROW LEVEL SECURITY
-- Stratégie : données partagées au sein de l'équipe, jamais publiques.
-- clients / equipements / pieces (base pièces) : base partagée (lecture
-- conservée à tout `authenticated`) — la vraie barrière = inscription
-- publique désactivée. interventions / pieces_utilisees / rendezvous /
-- mesures / photos / documents / contrats : périmètre par rôle.
-- ---------------------------------------------------------
alter table public.clients          enable row level security;
alter table public.interventions    enable row level security;
alter table public.equipements      enable row level security;
alter table public.pieces_utilisees enable row level security;
alter table public.profiles         enable row level security;
alter table public.appels           enable row level security;
alter table public.rendezvous       enable row level security;
alter table public.mesures          enable row level security;
alter table public.photos           enable row level security;
alter table public.pieces           enable row level security;
alter table public.documents        enable row level security;
alter table public.contrats_entretien enable row level security;

-- clients : base partagée de l'équipe
drop policy if exists clients_select on public.clients;
create policy clients_select on public.clients for select to authenticated using (true);
drop policy if exists clients_insert on public.clients;
create policy clients_insert on public.clients for insert to authenticated with check (true);
drop policy if exists clients_update on public.clients;
create policy clients_update on public.clients for update to authenticated using (true);
drop policy if exists clients_delete on public.clients;
create policy clients_delete on public.clients for delete to authenticated using (true);

-- interventions : manager = tout ; technicien = ses fiches.
drop policy if exists interventions_select on public.interventions;
create policy interventions_select on public.interventions
  for select to authenticated
  using (
    public.is_manager()
    or created_by = auth.uid()
    or technicien_id = auth.uid()
  );

drop policy if exists interventions_insert on public.interventions;
create policy interventions_insert on public.interventions
  for insert to authenticated
  with check (
    public.is_manager()
    or (technicien_id is null or technicien_id = auth.uid())
  );

drop policy if exists interventions_update on public.interventions;
create policy interventions_update on public.interventions
  for update to authenticated
  using (
    public.is_manager()
    or created_by = auth.uid()
    or technicien_id = auth.uid()
  );

drop policy if exists interventions_delete on public.interventions;
create policy interventions_delete on public.interventions
  for delete to authenticated
  using (public.is_manager() or created_by = auth.uid());

-- equipements : base partagée de l'équipe
drop policy if exists equipements_select on public.equipements;
create policy equipements_select on public.equipements for select to authenticated using (true);
drop policy if exists equipements_insert on public.equipements;
create policy equipements_insert on public.equipements for insert to authenticated with check (true);
drop policy if exists equipements_update on public.equipements;
create policy equipements_update on public.equipements for update to authenticated using (true);
drop policy if exists equipements_delete on public.equipements;
create policy equipements_delete on public.equipements for delete to authenticated using (true);

-- pieces_utilisees : héritent du périmètre de leur intervention.
drop policy if exists pieces_select on public.pieces_utilisees;
create policy pieces_select on public.pieces_utilisees
  for select to authenticated
  using (exists (
    select 1 from public.interventions i
    where i.id = intervention_id
      and (public.is_manager() or i.created_by = auth.uid() or i.technicien_id = auth.uid())
  ));

drop policy if exists pieces_insert on public.pieces_utilisees;
create policy pieces_insert on public.pieces_utilisees
  for insert to authenticated
  with check (exists (
    select 1 from public.interventions i
    where i.id = intervention_id
      and (public.is_manager() or i.created_by = auth.uid() or i.technicien_id = auth.uid())
  ));

drop policy if exists pieces_update on public.pieces_utilisees;
create policy pieces_update on public.pieces_utilisees
  for update to authenticated
  using (exists (
    select 1 from public.interventions i
    where i.id = intervention_id
      and (public.is_manager() or i.created_by = auth.uid() or i.technicien_id = auth.uid())
  ));

drop policy if exists pieces_delete on public.pieces_utilisees;
create policy pieces_delete on public.pieces_utilisees
  for delete to authenticated
  using (exists (
    select 1 from public.interventions i
    where i.id = intervention_id
      and (public.is_manager() or i.created_by = auth.uid() or i.technicien_id = auth.uid())
  ));

-- profiles : lecture partagée (noms), écriture restreinte.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated using (true);

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert to authenticated
  with check (auth.uid() = id and role = 'technicien');

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated using (auth.uid() = id);

-- appels : managers voient tout, technicien ses propres appels.
-- `appels_update` est ouvert à tous les authentifiés (comme l'insert) : c'est ce
-- qui permet au technicien de RELIER une fiche / un RDV à un appel enregistré
-- par le responsable (cycle de vie de l'appel — `rendezvous_id`/`intervention_id`,
-- arbitré le 25/08/2026). La lecture reste restreinte (managers ou créateur).
drop policy if exists appels_select on public.appels;
create policy appels_select on public.appels for select to authenticated
  using (public.is_manager() or created_by = auth.uid());
drop policy if exists appels_insert on public.appels;
create policy appels_insert on public.appels for insert to authenticated with check (true);
drop policy if exists appels_update on public.appels;
create policy appels_update on public.appels for update to authenticated
  using (true);
drop policy if exists appels_delete on public.appels;
create policy appels_delete on public.appels for delete to authenticated
  using (public.is_manager() or created_by = auth.uid());

-- rendezvous : managers voient tout, technicien son planning.
-- La visibilité du technicien passe par technicien_id OU le nom
-- d'intervenant ; les RDV non affectés (intervenant vide) restent
-- visibles par toute l'équipe.
drop policy if exists rendezvous_select on public.rendezvous;
create policy rendezvous_select on public.rendezvous for select to authenticated
  using (
    public.is_manager()
    or created_by = auth.uid()
    or technicien_id = auth.uid()
    or intervenant is null or intervenant = ''
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.full_name is not null and p.full_name <> ''
        and (p.full_name = public.rendezvous.intervenant
             or split_part(p.full_name, ' ', 1) = public.rendezvous.intervenant)
    )
  );
drop policy if exists rendezvous_insert on public.rendezvous;
create policy rendezvous_insert on public.rendezvous for insert to authenticated
  with check (public.is_manager() or (technicien_id is null or technicien_id = auth.uid()));
drop policy if exists rendezvous_update on public.rendezvous;
create policy rendezvous_update on public.rendezvous for update to authenticated
  using (public.is_manager() or created_by = auth.uid() or technicien_id = auth.uid());
drop policy if exists rendezvous_delete on public.rendezvous;
create policy rendezvous_delete on public.rendezvous for delete to authenticated
  using (public.is_manager() or created_by = auth.uid());

-- mesures / photos / documents : héritent du périmètre de leur intervention.
do $$
declare t text;
begin
  foreach t in array array['mesures','photos','documents']
  loop
    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format($f$ create policy %I_select on public.%I for select to authenticated
      using (exists (select 1 from public.interventions i where i.id = intervention_id
        and (public.is_manager() or i.created_by = auth.uid() or i.technicien_id = auth.uid()))) $f$, t, t);
    execute format('drop policy if exists %I_insert on public.%I', t, t);
    execute format($f$ create policy %I_insert on public.%I for insert to authenticated
      with check (exists (select 1 from public.interventions i where i.id = intervention_id
        and (public.is_manager() or i.created_by = auth.uid() or i.technicien_id = auth.uid()))) $f$, t, t);
    execute format('drop policy if exists %I_update on public.%I', t, t);
    execute format($f$ create policy %I_update on public.%I for update to authenticated
      using (exists (select 1 from public.interventions i where i.id = intervention_id
        and (public.is_manager() or i.created_by = auth.uid() or i.technicien_id = auth.uid()))) $f$, t, t);
    execute format('drop policy if exists %I_delete on public.%I', t, t);
    execute format($f$ create policy %I_delete on public.%I for delete to authenticated
      using (exists (select 1 from public.interventions i where i.id = intervention_id
        and (public.is_manager() or i.created_by = auth.uid() or i.technicien_id = auth.uid()))) $f$, t, t);
  end loop;
end $$;

-- pieces (base pièces) : catalogue partagé par l'équipe, comme clients / equipements.
-- Insertion et sélection sont déjà ouvertes à tout utilisateur authentifié ;
-- la politique update doit l'être aussi : le sync client re-pousse les lignes
-- du catalogue (upsert = ON CONFLICT DO UPDATE) quel que soit le créateur, sinon
-- un technicien recevrait un 403 RLS et la file de synchronisation resterait bloquée.
drop policy if exists pieces_select on public.pieces;
create policy pieces_select on public.pieces for select to authenticated using (true);
drop policy if exists pieces_insert on public.pieces;
create policy pieces_insert on public.pieces for insert to authenticated with check (true);
drop policy if exists pieces_update on public.pieces;
create policy pieces_update on public.pieces for update to authenticated using (true);
drop policy if exists pieces_delete on public.pieces;
create policy pieces_delete on public.pieces for delete to authenticated using (true);

-- contrats_entretien : accès réservé aux managers ou au propriétaire.
drop policy if exists contrats_select on public.contrats_entretien;
create policy contrats_select on public.contrats_entretien for select to authenticated
  using (public.is_manager() or created_by = auth.uid());
drop policy if exists contrats_insert on public.contrats_entretien;
create policy contrats_insert on public.contrats_entretien for insert to authenticated
  with check (public.is_manager());
drop policy if exists contrats_update on public.contrats_entretien;
create policy contrats_update on public.contrats_entretien for update to authenticated
  using (public.is_manager() or created_by = auth.uid());
drop policy if exists contrats_delete on public.contrats_entretien;
create policy contrats_delete on public.contrats_entretien for delete to authenticated
  using (public.is_manager() or created_by = auth.uid());

-- ---------------------------------------------------------
-- PRIVILÈGES (GRANT)
-- Sans ces GRANT, les requêtes du frontend échouent en 42501
-- "permission denied" même si les RLS sont en place (RLS seul
-- renvoie 0 ligne sans erreur ; le GRANT gouverne l'accès au rôle).
-- Le rôle `anon` n'obtient AUCUN privilège : la clé anon est inutile
-- sans session (points S1/S3 de la revue).
-- ---------------------------------------------------------
grant usage on schema public to authenticated;

grant select, insert, update, delete on public.clients             to authenticated;
grant select, insert, update, delete on public.interventions       to authenticated;
grant select, insert, update, delete on public.equipements         to authenticated;
grant select, insert, update, delete on public.pieces_utilisees    to authenticated;
grant select on public.profiles to authenticated;
grant insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.appels              to authenticated;
grant select, insert, update, delete on public.rendezvous          to authenticated;
grant select, insert, update, delete on public.mesures             to authenticated;
grant select, insert, update, delete on public.photos              to authenticated;
grant select, insert, update, delete on public.pieces              to authenticated;
grant select, insert, update, delete on public.documents           to authenticated;
grant select, insert, update, delete on public.contrats_entretien  to authenticated;

-- ---------------------------------------------------------
-- REALTIME
-- Idempotent : n'ajoute que les tables qui ne sont pas déjà membres
-- de la publication (évite l'erreur 42710 en cas de relance du script).
-- ---------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'clients','interventions','equipements','pieces_utilisees',
    'appels','rendezvous','mesures','photos','pieces','documents','contrats_entretien'
  ]
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------
-- BACKFILL (à adapter aux emails réels)
-- Exécutez ce bloc après avoir créé les 3 comptes dans le Dashboard
-- (idéalement après leur première connexion, pour que la ligne profiles
-- existe ; sinon set_user_role() peut aussi créer la ligne à la demande).
-- ---------------------------------------------------------
do $$
declare
  v_responsable uuid;
  v_technicien  uuid;
  v_secretaire  uuid;
begin
  select id into v_responsable from auth.users where email = 'regis.chanteux@gmail.com';
  select id into v_technicien  from auth.users where email = 'jgardaisclimatelec@gmail.com';
  select id into v_secretaire  from auth.users where email = 'contactdsolutions49@gmail.com';

  -- Rôles (si la ligne profiles existe déjà)
  update public.profiles set role = 'responsable' where id = v_responsable;
  update public.profiles set role = 'technicien'  where id = v_technicien;
  update public.profiles set role = 'secretaire' where id = v_secretaire;

  -- Lien auteur/technicien sur l'existant. Avant cette migration,
  -- created_by / technicien_id n'étaient jamais renseignés (null).
  -- On rattache l'existant au responsable (qui voit tout de toute façon).
  -- Si l'historique doit être réparti entre Régis et Jérémy, ajustez
  -- la requête (ex. selon technicien_nom) avant exécution.
  update public.interventions
    set created_by    = coalesce(created_by, v_responsable),
        technicien_id = coalesce(technicien_id, v_responsable)
    where created_by is null;
end $$;

-- Rendez-vous : rattache technicien_id au profil dont le nom correspond
-- à l'intervenant du RDV (données existantes). L'affectation se fait par
-- le texte `intervenant` ("Jérémy", "Régis", "Delphine") mais la RLS ne
-- contrôle que `technicien_id` (uuid) : ce backfill aligne les deux.
update public.rendezvous r
set technicien_id = sub.id,
    updated_at    = now()
from (
  select id, full_name
  from public.profiles
  where full_name is not null and full_name <> ''
) sub
where r.intervenant is not null and r.intervenant <> ''
  and (r.intervenant = sub.full_name or r.intervenant = split_part(sub.full_name, ' ', 1))
  and r.technicien_id is distinct from sub.id;
