-- =========================================================
-- Climat Elec — Migration RLS par rôle + affectation technicien
-- Fichier : 001_roles_rls.sql
-- À exécuter après schema.sql (et avant tout usage en prod).
-- Idempotent : peut être relancé sans erreur.
--
-- Ce qu'il fait :
--   1. Ajoute `profiles.role` (enum responsable / technicien / secretaire)
--      et `interventions.technicien_id` (technicien affecté).
--   2. Ajoute les fonctions d'aide current_role() / is_manager() et
--      set_user_role() (changement de rôle réservé aux managers).
--   3. Renseigne automatiquement created_by / updated_by / technicien_id
--      (défaut = utilisateur courant). Sans cela, un technicien ne verrait
--      AUCUNE fiche : le frontend actuel ne renseigne jamais ces colonnes.
--   4. Empêche l'auto-élévation de rôle (trigger sur profiles).
--   5. Remplace les RLS "using (true)" par des politiques par rôle.
--   6. Backfill des données existantes (rôles + propriétaire).
--
-- PRÉREQUIS (Dashboard) : désactiver l'inscription publique
--   Authentication > Sign In / Providers > Email
--   (désactiver "Enable new signups" ou restreindre à une liste d'emails).
-- =========================================================

-- ---------------------------------------------------------
-- 1. COLONNES
-- ---------------------------------------------------------
alter table public.profiles
  add column if not exists role text not null default 'technicien';

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

alter table public.interventions
  add column if not exists technicien_id uuid references auth.users(id) on delete set null;

create index if not exists interventions_technicien_id_idx
  on public.interventions(technicien_id);

-- ---------------------------------------------------------
-- 2. FONCTIONS D'AIDE
-- ---------------------------------------------------------
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

-- ---------------------------------------------------------
-- 3. RENSEIGNEMENT AUTOMATIQUE created_by / updated_by / technicien_id
-- ---------------------------------------------------------
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
drop trigger if exists interventions_set_technicien on public.interventions;
create trigger interventions_set_technicien before insert on public.interventions
  for each row execute function public.set_technicien_default();

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

-- ---------------------------------------------------------
-- 4. ANTI-ÉLÉVATION DE RÔLE (profiles)
-- Un utilisateur peut modifier son full_name, mais pas son rôle.
-- La garde `auth.uid() is not null` laisse passer les contextes
-- d'administration sans session (migration, SQL editor, service role).
-- ---------------------------------------------------------
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

drop trigger if exists profiles_prevent_role_escalation on public.profiles;
create trigger profiles_prevent_role_escalation
  before update on public.profiles
  for each row execute function public.prevent_role_escalation();

-- ---------------------------------------------------------
-- 5. ROW LEVEL SECURITY (remplace les "using (true)")
-- ---------------------------------------------------------

-- clients / equipements : base partagée de l'équipe (lecture conservée).
-- La vraie barrière = inscription publique désactivée (voir en-tête).

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

-- ---------------------------------------------------------
-- 6. BACKFILL (à adapter aux emails réels)
-- ---------------------------------------------------------
-- Exécutez ce bloc après avoir créé les 3 comptes dans le Dashboard
-- (idéalement après leur première connexion, pour que la ligne profiles
-- existe ; sinon set_user_role() peut aussi créer la ligne à la demande).
do $$
declare
  v_responsable uuid;
  v_technicien  uuid;
  v_secretaire  uuid;
begin
  select id into v_responsable from auth.users where email = 'regis@exemple.fr';
  select id into v_technicien  from auth.users where email = 'jeremy@exemple.fr';
  select id into v_secretaire  from auth.users where email = 'delphine@exemple.fr';

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
