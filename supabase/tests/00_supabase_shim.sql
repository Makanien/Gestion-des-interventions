-- =========================================================
-- Shim minimal de l'environnement Supabase, pour rejouer le schéma sur un
-- PostgreSQL « nu » (CI jetable, poste de dev sans Docker). NE SERT PAS en
-- production ni sur un projet Supabase : là, ces objets existent déjà.
--
-- Reproduit uniquement ce dont schema.sql dépend :
--   rôles anon / authenticated / service_role, schéma auth (users, uid()),
--   schéma storage (buckets, objects, foldername), publication supabase_realtime.
-- L'identité de l'appelant est lue dans le réglage `request.jwt.claim.sub`
-- (comme PostgREST) : `set local "request.jwt.claim.sub" = '<uuid>'`.
-- =========================================================
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to anon, authenticated, service_role;

create schema if not exists storage;
create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text,
  owner uuid,
  created_at timestamptz not null default now()
);
alter table storage.objects enable row level security;
create or replace function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;
grant usage on schema storage to anon, authenticated, service_role;
grant select, insert, update, delete on storage.objects to authenticated, anon;
grant select on storage.buckets to authenticated, anon;

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

-- Supabase accorde par défaut tous les droits aux rôles API sur le schéma public ;
-- c'est la RLS (et non les GRANT) qui restreint l'accès. On reproduit ce défaut.
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
