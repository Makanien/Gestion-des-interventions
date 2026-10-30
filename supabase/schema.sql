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
-- DB-02 (SEC-06) : le bloc BACKFILL attribuant les rôles aux adresses
-- réelles ne se trouve plus ici mais dans `supabase/seed.local.sql`
-- (fichier NON versionné, cf. .gitignore). Sur une base vierge :
-- exécuter ce script PUIS seed.local.sql après création des comptes.
--
-- DB-01 : les identités des tables sont attribuées par gen_random_uuid()
-- (natif PostgreSQL 13+, chaque projet Supabase le dispose) ; plus aucune
-- dépendance à l'extension uuid-ossp. Les contraintes d'intégrité
-- (CHECK / FK) sont posées en NOT VALID — tolérance des valeurs
-- historiques — cf. section 13.
--
-- Attention : ce fichier suppose que le rôle `anon` n'a AUCUN
-- privilège sur les tables (seul `authenticated` est servi).
-- La barrière d'accès reste l'inscription publique DÉSACTIVÉE
-- (Dashboard > Authentication > Sign In / Providers > Email).
-- =========================================================

-- ---------------------------------------------------------
-- EXTENSIONS
-- Aucune extension nécessaire : gen_random_uuid() est natif
-- (DB-01). Une base déjà migrée qui aurait encore uuid-ossp
-- installée le garde : sans effet, les défauts des tables
-- existantes sont re-normalisés en section 13.
-- ---------------------------------------------------------

-- ---------------------------------------------------------
-- 1. TABLE clients (V2)
-- ---------------------------------------------------------
create table if not exists public.clients (
  id            uuid primary key default gen_random_uuid(),
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
  id                   uuid primary key default gen_random_uuid(),
  client_id            uuid references public.clients(id) on delete set null,
  type_intervention    text not null default '',
  date                 date,
  heure_arrivee        text not null default '', -- HH:MM (input type=time, DB-01 §13b)
  heure_depart         text not null default '', -- HH:MM (input type=time, DB-01 §13b)
  forfait_deplacement  text not null default '',
  temps_intervention   text not null default '', -- « 1h30 » calculé par le frontend (heure_arrivee/heure_depart)
  statut               text not null default 'a_prevoir', -- 'a_prevoir' | 'terminee' | 'terminee_suite' (COH-02 : aligné PRD §5.1 + app.js:1774)
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
alter table public.interventions add column if not exists statut_dossier text not null default 'brouillon';
alter table public.interventions add column if not exists type_entretien text not null default '';
alter table public.interventions add column if not exists type_entretien_detail text not null default '';
alter table public.interventions add column if not exists prochaine_intervention_prevue boolean not null default false;
alter table public.interventions add column if not exists annee_installation text not null default '';
-- Technicien affecté (uuid auth.users) : manquant dans la table V2, mais
-- référencé par le trigger workflow, set_technicien_default et les RLS.
alter table public.interventions add column if not exists technicien_id uuid references auth.users(id) on delete set null;
create index if not exists interventions_technicien_id_idx on public.interventions(technicien_id);
-- Fin d'intervention commune (§3.2.14, arb. 6.9) : case « Page ok » — attestation
-- que toutes les informations obligatoires sont renseignées (contrôle à la validation).
alter table public.interventions add column if not exists page_ok boolean not null default false;

create index if not exists interventions_statut_dossier_idx on public.interventions(statut_dossier);

-- ---------------------------------------------------------
-- 2bis. WORKFLOW 4 STATUTS (13/10/2026)
-- Brouillon → À valider → À facturer → Terminé.
-- 6 transitions autorisées (contrôlées par trigger, cf. infra) :
--   (création) → brouillon          créateur/technicien affecté ou manager
--   brouillon  → a_valider          créateur/technicien affecté ou manager (soumission)
--   a_valider  → brouillon          manager (renvoi + motif libre)
--   a_valider  → a_facturer         manager (validation de la fiche)
--   a_facturer → termine            manager (marquage facturé)
--   termine    → brouillon          responsable uniquement (rouverture + motif libre)
-- Les anciens statuts V3 sont normalisés à l'écriture :
--   validee, facture_importee, facture_a_verifier → a_facturer
--   facture_verifiee, a_envoyer, cloturee         → termine
-- Bloc IDEMPOTENT : relançable sans erreur ni effet de bord.
-- ---------------------------------------------------------

-- P1.1 — Colonnes de traçabilité ( même type que created_by, uuid )
alter table public.interventions add column if not exists motif_retour text;
alter table public.interventions add column if not exists valide_par  uuid;
alter table public.interventions add column if not exists valide_le   timestamptz;
alter table public.interventions add column if not exists facture_par uuid;
alter table public.interventions add column if not exists facture_le  timestamptz;

-- Nouveaux dossiers démarrent toujours en brouillon (§0 du plan d'action) ;
-- `set default` est idempotent et s'applique aussi aux bases déjà migrées.
alter table public.interventions alter column statut_dossier set default 'brouillon';

-- P1.2 — Fonction de normalisation (réutilisée par le trigger et le backfill)
create or replace function public.normalize_statut_dossier(s text)
returns text
language sql
immutable
as $$
  select case s
    when 'validee'            then 'a_facturer'
    when 'facture_importee'   then 'a_facturer'
    when 'facture_a_verifier' then 'a_facturer'
    when 'facture_verifiee'   then 'termine'
    when 'a_envoyer'          then 'termine'
    when 'cloturee'           then 'termine'
    else s
  end
$$;

-- Wrapper plpgsql requis : les fonctions `language sql` ne peuvent pas
-- servir de fonction de trigger (pas d'accès à TG_NEW).
create or replace function public.normalize_statut_dossier_trigger()
returns trigger
language plpgsql
as $$
begin
  new.statut_dossier = public.normalize_statut_dossier(new.statut_dossier);
  return new;
end;
$$;

-- P1.3 — Trigger de normalisation AVANT INSERT OR UPDATE.
-- Nommé `interventions_10_normalize_statut` : les triggers d'une même
-- table s'exécutent par ordre alphabétique, il passe donc AVANT le
-- trigger de contrôle `interventions_20_enforce_statut`.
drop trigger if exists interventions_10_normalize_statut on public.interventions;
create trigger interventions_10_normalize_statut
  before insert or update on public.interventions
  for each row execute function public.normalize_statut_dossier_trigger();

-- P1.4 — Backfill idempotent des anciennes valeurs (AVANT la contrainte CHECK).
-- Le trigger `updated_at` existant fera re-télécharger ces lignes aux clients :
-- comportement souhaité.
update public.interventions
   set statut_dossier = public.normalize_statut_dossier(statut_dossier)
 where statut_dossier in ('validee','facture_importee','facture_a_verifier',
                          'facture_verifiee','a_envoyer','cloturee');

-- P1.5 — Contrainte CHECK, APRES le backfill (sinon les anciennes valeurs
-- bloqueraient la création de la contrainte sur une base non migrée).
alter table public.interventions drop constraint if exists interventions_statut_dossier_check;
alter table public.interventions add constraint interventions_statut_dossier_check
  check (statut_dossier in ('brouillon','a_valider','a_facturer','termine'));

-- P1.6 — Contrôle des transitions autorisées (BEFORE UPDATE).
-- `security definer` + search_path figé (pratique S4 de la revue) pour
-- appeler is_manager()/current_role() sans crainte du search_path.
create or replace function public.enforce_statut_dossier_workflow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- SQL Editor / migrations / service_role : pas de session, pas de contrôle.
  if auth.uid() is null then
    return new;
  end if;

  -- Les upserts de synchro renvoient la ligne entière : si le statut ne
  -- change pas, ce n'est pas une transition, on ne contrôle rien.
  if new.statut_dossier is not distinct from old.statut_dossier then
    return new;
  end if;

  -- Horodatage serveur : validation (a_valider → a_facturer).
  if old.statut_dossier = 'a_valider' and new.statut_dossier = 'a_facturer' then
    if not public.is_manager() then
      raise exception 'Transition de statut non autorisée : % → % (rôle %)',
        old.statut_dossier, new.statut_dossier, public.current_role()
        using errcode = '42501';
    end if;
    new.valide_par = auth.uid();
    new.valide_le  = now();
    return new;
  end if;

  -- Horodatage serveur : facturation (a_facturer → termine).
  if old.statut_dossier = 'a_facturer' and new.statut_dossier = 'termine' then
    if not public.is_manager() then
      raise exception 'Transition de statut non autorisée : % → % (rôle %)',
        old.statut_dossier, new.statut_dossier, public.current_role()
        using errcode = '42501';
    end if;
    new.facture_par = auth.uid();
    new.facture_le  = now();
    return new;
  end if;

  -- Retour au brouillon : renvoi (depuis a_valider, manager) ou rouverture
  -- (depuis termine, responsable uniquement — developpeur toléré pour tests).
  if new.statut_dossier = 'brouillon' then
    if old.statut_dossier = 'a_valider' and not public.is_manager() then
      raise exception 'Transition de statut non autorisée : % → % (rôle %)',
        old.statut_dossier, new.statut_dossier, public.current_role()
        using errcode = '42501';
    elsif old.statut_dossier = 'termine'
      and public.current_role() not in ('responsable', 'developpeur') then
      raise exception 'Transition de statut non autorisée : % → % (rôle %)',
        old.statut_dossier, new.statut_dossier, public.current_role()
        using errcode = '42501';
    elsif old.statut_dossier not in ('a_valider', 'termine') then
      raise exception 'Transition de statut non autorisée : % → % (rôle %)',
        old.statut_dossier, new.statut_dossier, public.current_role()
        using errcode = '42501';
    end if;
    new.valide_par  = null;
    new.valide_le   = null;
    new.facture_par = null;
    new.facture_le  = null;
    return new;
  end if;

  -- Soumission (brouillon → a_valider) : créateur, technicien affecté ou manager.
  if old.statut_dossier = 'brouillon' and new.statut_dossier = 'a_valider' then
    if not (old.created_by = auth.uid()
            or old.technicien_id = auth.uid()
            or public.is_manager()) then
      raise exception 'Transition de statut non autorisée : % → % (rôle %)',
        old.statut_dossier, new.statut_dossier, public.current_role()
        using errcode = '42501';
    end if;
    return new;
  end if;

  -- Toute autre transition est refusée.
  raise exception 'Transition de statut non autorisée : % → % (rôle %)',
    old.statut_dossier, new.statut_dossier, public.current_role()
    using errcode = '42501';
end;
$$;

drop trigger if exists interventions_20_enforce_statut on public.interventions;
create trigger interventions_20_enforce_statut
  before update on public.interventions
  for each row execute function public.enforce_statut_dossier_workflow();

-- ---------------------------------------------------------
-- 3. TABLE equipements (historique réutilisable par client)
-- ---------------------------------------------------------
create table if not exists public.equipements (
  id              uuid primary key default gen_random_uuid(),
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
  id              uuid primary key default gen_random_uuid(),
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

-- Rôle (V3) : enum responsable / technicien / secretaire / developpeur
alter table public.profiles add column if not exists role text not null default 'technicien';

-- Contrainte recréée pour accepter le nouveau rôle `developpeur`
-- (drop + create : idempotent sur une base déjà migrée).
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('responsable', 'technicien', 'secretaire', 'developpeur'));

-- ---------------------------------------------------------
-- 6. TABLE appels (V3, US-01)
-- ---------------------------------------------------------
create table if not exists public.appels (
  id                uuid primary key default gen_random_uuid(),
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
  id            uuid primary key default gen_random_uuid(),
  technicien_id uuid references auth.users(id) on delete set null,
  intervenant   text not null default '', -- nom affiché (Jérémy / Régis)
  date          date,
  heure_debut   text not null default '',
  heure_fin     text not null default '',
  type          text not null default '', -- 'depannage' | 'entretien' | 'rdv_devis'
  client_id     uuid references public.clients(id) on delete set null,
  appel_id      uuid references public.appels(id) on delete set null,
  intervention_id uuid references public.interventions(id) on delete set null, -- fiche créée depuis ce RDV (anti-doublon)
  note          text not null default '',
  statut        text not null default 'planifie',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  created_by    uuid references auth.users(id) on delete set null,
  updated_by    uuid references auth.users(id) on delete set null
);
alter table public.rendezvous add column if not exists intervention_id uuid references public.interventions(id) on delete set null;
create index if not exists rendezvous_date_idx on public.rendezvous(date);
create index if not exists rendezvous_technicien_id_idx on public.rendezvous(technicien_id);

-- ---------------------------------------------------------
-- 8. TABLE mesures (V3, US-19, fiches d'entretien)
-- ---------------------------------------------------------
create table if not exists public.mesures (
  id              uuid primary key default gen_random_uuid(),
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
  id              uuid primary key default gen_random_uuid(),
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
  id              uuid primary key default gen_random_uuid(),
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
  id              uuid primary key default gen_random_uuid(),
  intervention_id uuid references public.interventions(id) on delete cascade,
  type            text not null default '', -- 'devis' | 'contrat_entretien' — 'facture' obsolète (workflow 4 statuts), lignes existantes conservées
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
  id                     uuid primary key default gen_random_uuid(),
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
-- 12bis. NUMÉROTATION SERVEUR (NUM-01)
-- La référence `PREFIX-AAAA-NNN` (FIC-…, ENT-…, CTR-…) est attribuée par le
-- SERVEUR à la première synchronisation au lieu d'un compteur local par
-- appareil (deux appareils produisaient le même numéro — COH-01/NUM-01).
--   - compteur par (prefix, année) dans `numero_counteurs` ;
--   - attribué uniquement si `numero` est vide (les références historiques
--     déjà posées par l'ancienne numérotation locale sont conservées) ;
--   - index unique PARTIEL sur `numero <> ''` : garantie d'unicité définitive
--     même face à deux pushs concurrents ;
--   - année = année de la date de la fiche (contrats : année d'attribution).
-- Le client affiche « n° à la synchronisation » tant que le numéro est vide,
-- et rapatrie le numéro posé (retour de l'upsert, sync.js).
-- Bloc IDEMPOTENT : relançable sans erreur ni effet de bord.
-- ---------------------------------------------------------

create table if not exists public.numero_counteurs (
  prefix  text not null,
  annee   int  not null,
  dernier int  not null default 0,
  primary key (prefix, annee)
);
alter table public.numero_counteurs enable row level security;
-- Aucune policy : table interne, lue/écrite uniquement par les fonctions
-- `security definer` ci-dessous (invisibles et inaccessibles aux sessions).

-- Dédoublonnage AVANT la pose des index uniques : l'ancienne numérotation
-- locale a pu produire le même numéro sur deux lignes (jamais contrôlé).
-- Les doublons sont renommés avec un suffixe numérique (-2, -3… selon leur
-- rang), le premier conservant la référence d'origine. Idempotent : après la
-- première passe il n'existe plus de doublon, l'update ne touche donc aucune
-- ligne ; ensuite, les index uniques garantissent qu'aucun nouveau doublon
-- ne peut apparaître (les pushs concurrents échouent en 409, traités par
-- SYNC-03 comme erreur permanente visible).
do $$
declare r record;
begin
  for r in
    select 'interventions' as t
    union all select 'contrats_entretien'
  loop
    execute format($f$
      update public.%I d
      set numero = d.numero || '-' || x.rn
      from (
        select id, row_number() over (partition by numero order by created_at, id) rn
        from public.%I
        where numero <> ''
      ) x
      where d.id = x.id and x.rn > 1
    $f$, r.t, r.t);
  end loop;
end $$;

-- Index uniques partiels : `numero` vide = référence pas encore attribuée.
create unique index if not exists interventions_numero_uniq
  on public.interventions(numero)
  where numero is not null and numero <> '';
create unique index if not exists contrats_numero_uniq
  on public.contrats_entretien(numero)
  where numero is not null and numero <> '';

-- Compteur partagé par (prefix, année), protégé par un verrou consultatif
-- transactionnel pour sérialiser deux sessions concurrentes.
create or replace function public.alloc_numero(p_prefix text, p_annee int, p_table text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max  int;
  v_next int;
begin
  insert into public.numero_counteurs (prefix, annee, dernier)
    values (p_prefix, p_annee, 0)
    on conflict (prefix, annee) do nothing;
  perform pg_advisory_xact_lock(hashtext('numero_counteurs:' || p_prefix || ':' || p_annee));
  -- reprend le max des références déjà présentes (historique des compteurs
  -- locaux par appareil) pour ne jamais réattribuer un numéro existant
  execute format(
    'select coalesce(max(substring(i.numero from ''(\d+)$'')::int), 0)
       from public.%I i where i.numero like %L',
    p_table, p_prefix || '-' || p_annee::text || '-%'
  ) into v_max;
  update public.numero_counteurs
    set dernier = greatest(dernier, v_max) + 1
    where prefix = p_prefix and annee = p_annee
    returning dernier into v_next;
  return v_next;
end $$;

create or replace function public.set_numero_intervention()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text;
  v_annee  int;
  v_next   int;
begin
  if new.numero is not null and new.numero <> '' then
    return new; -- référence historique conservée telle quelle
  end if;
  v_prefix := case when coalesce(new.type_entretien, '') <> '' then 'ENT' else 'FIC' end;
  v_annee  := coalesce(extract(year from new."date")::int, extract(year from current_date)::int);
  v_next   := public.alloc_numero(v_prefix, v_annee, 'interventions');
  new.numero := v_prefix || '-' || v_annee::text || '-' || lpad(v_next::text, 3, '0');
  return new;
end $$;

create or replace function public.set_numero_contrat()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_annee int;
  v_next  int;
begin
  if new.numero is not null and new.numero <> '' then
    return new;
  end if;
  v_annee := extract(year from current_date)::int;
  v_next  := public.alloc_numero('CTR', v_annee, 'contrats_entretien');
  new.numero := 'CTR-' || v_annee::text || '-' || lpad(v_next::text, 3, '0');
  return new;
end $$;

drop trigger if exists interventions_set_numero on public.interventions;
create trigger interventions_set_numero
  before insert or update on public.interventions
  for each row execute function public.set_numero_intervention();

drop trigger if exists contrats_set_numero on public.contrats_entretien;
create trigger contrats_set_numero
  before insert or update on public.contrats_entretien
  for each row execute function public.set_numero_contrat();

-- ---------------------------------------------------------
-- 13. INTÉGRITÉ (DB-01) — contraintes CHECK, FK, index de synchro
-- Tout est idempotent (drop if exists + add) et posé en `not valid`
-- : les lignes historiques atypiques ne BLOQUENT PAS la pose de la
-- contrainte (tolérance historique). Les écritures nouvelles sont
-- systématiquement validées (23514 CHECK / 23503 FK → SYNC-03 les
-- classe en erreur visible « Compte & synchro »). Un nettoyage
-- ciblé puis `alter table … validate constraint …` pourront être
-- effectués manuellement plus tard pour verrouiller l'existant.
--
-- Valeurs = littéraux réellement écrits par app.js :
--   statut            : app.js:1774-1775, 2168-2170 (segmented UI)
--   type_entretien    : ENTRETIEN_META (app.js:294+), clé machine
--   rendezvous.type   : selects app.js:776/1411-1412
--   action_sortie     : app.js:1338/1461/1470/1479/1490
--   documents.type    : importDocument('devis') ; « facture » = lignes
--                       historiques conservées (PRD §5.2 du 13/10)
--   nb_passages       : select app.js:2817 ('1'..'4') + défaut ''
--       reste LIBRE (libellés d'affichage, non énumérables côté SQL
--       en l'état) : interventions.type_intervention (« Dépannage »,
--       « Sur devis »…), type_entretien_detail (liste client à venir),
--       temps_intervention (« 1h30 », calculé), tarification_zone_km
--       (« Z2 — 25 € »).
-- ---------------------------------------------------------

-- Défauts re-normalisés sur les bases déjà migrées : les
-- littéraux des `create table if not exists` ne s'appliquent qu'aux
-- bases neuves ; ce bloc aligne aussi la production.
do $$
declare t text;
begin
  foreach t in array array['clients','interventions','equipements','pieces_utilisees',
    'appels','rendezvous','mesures','photos','pieces','documents','contrats_entretien'] loop
    execute format('alter table public.%I alter column id set default gen_random_uuid()', t);
  end loop;
end $$;
-- Défaut aligné sur l'usage réel (COH-02) : nouvelle fiche = « À effectuer ».
alter table public.interventions alter column statut set default 'a_prevoir';

-- 13a. Énumérations
alter table public.interventions drop constraint if exists interventions_statut_check;
alter table public.interventions add constraint interventions_statut_check
  check (statut in ('a_prevoir','terminee','terminee_suite')) not valid;

alter table public.interventions drop constraint if exists interventions_type_entretien_check;
alter table public.interventions add constraint interventions_type_entretien_check
  check (type_entretien in ('','air_eau','air_air','chaudiere','solaire')) not valid;

alter table public.mesures drop constraint if exists mesures_type_entretien_check;
alter table public.mesures add constraint mesures_type_entretien_check
  check (type_entretien in ('','air_eau','air_air','chaudiere','solaire')) not valid;

alter table public.rendezvous drop constraint if exists rendezvous_type_check;
alter table public.rendezvous add constraint rendezvous_type_check
  check (type in ('depannage','entretien','rdv_devis')) not valid;

alter table public.rendezvous drop constraint if exists rendezvous_statut_check;
alter table public.rendezvous add constraint rendezvous_statut_check
  check (statut in ('planifie')) not valid;

alter table public.appels drop constraint if exists appels_action_sortie_check;
alter table public.appels add constraint appels_action_sortie_check
  check (action_sortie in ('rdv','intervention','sans_suite')) not valid;

alter table public.documents drop constraint if exists documents_type_check;
alter table public.documents add constraint documents_type_check
  check (type in ('','devis','contrat_entretien','facture')) not valid;

alter table public.contrats_entretien drop constraint if exists contrats_nb_passages_check;
alter table public.contrats_entretien add constraint contrats_nb_passages_check
  check (nb_passages in ('','1','2','3','4')) not valid;

-- 13b. Formats horaires (input type=time → « HH:MM » ; vide accepté)
alter table public.interventions drop constraint if exists interventions_heure_arrivee_check;
alter table public.interventions add constraint interventions_heure_arrivee_check
  check (heure_arrivee ~ '^[0-9]{2}:[0-9]{2}$' or heure_arrivee = '') not valid;
alter table public.interventions drop constraint if exists interventions_heure_depart_check;
alter table public.interventions add constraint interventions_heure_depart_check
  check (heure_depart ~ '^[0-9]{2}:[0-9]{2}$' or heure_depart = '') not valid;
alter table public.rendezvous drop constraint if exists rendezvous_heure_debut_check;
alter table public.rendezvous add constraint rendezvous_heure_debut_check
  check (heure_debut ~ '^[0-9]{2}:[0-9]{2}$' or heure_debut = '') not valid;
alter table public.rendezvous drop constraint if exists rendezvous_heure_fin_check;
alter table public.rendezvous add constraint rendezvous_heure_fin_check
  check (heure_fin ~ '^[0-9]{2}:[0-9]{2}$' or heure_fin = '') not valid;

-- 13c. Clé étrangère manquante (COH-03) — `not valid` : les références
-- orphelines historiques (RDV supprimé) ne bloquent pas la pose ; les
-- suppressions futures remettent la colonne à NULL (même choix que
-- rendezvous.appel_id). Un push référence un RDV inexistant = 23503.
alter table public.appels drop constraint if exists appels_rendezvous_id_fkey;
alter table public.appels add constraint appels_rendezvous_id_fkey
  foreign key (rendezvous_id) references public.rendezvous(id) on delete set null not valid;

-- 13d. Index de tirage delta (SYNC-02 : gte(updated_at, since)) sur les
-- 11 tables de SYNC_STORES sync.js. Attention aux deux tables « pieces »
-- : noms d'index distincts.
create index if not exists clients_updated_at_idx            on public.clients(updated_at);
create index if not exists interventions_updated_at_idx      on public.interventions(updated_at);
create index if not exists equipements_updated_at_idx        on public.equipements(updated_at);
create index if not exists pieces_utilisees_updated_at_idx   on public.pieces_utilisees(updated_at);
create index if not exists appels_updated_at_idx             on public.appels(updated_at);
create index if not exists rendezvous_updated_at_idx         on public.rendezvous(updated_at);
create index if not exists mesures_updated_at_idx            on public.mesures(updated_at);
create index if not exists photos_updated_at_idx             on public.photos(updated_at);
create index if not exists pieces_updated_at_idx             on public.pieces(updated_at);
create index if not exists documents_updated_at_idx          on public.documents(updated_at);
create index if not exists contrats_updated_at_idx           on public.contrats_entretien(updated_at);

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
  select public.current_role() in ('responsable', 'secretaire', 'developpeur');
$$;

-- Changement de rôle (SEC-07) : réservé au RESPONSABLE. Un secrétaire ou un
-- développeur ne peut ni promouvoir un compte en responsable, ni créer un
-- développeur. Accepte un utilisateur sans profil existant (création au besoin).
create or replace function public.set_user_role(target uuid, new_role text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.current_role() <> 'responsable' then
    raise exception 'Réservé au responsable';
  end if;
  if new_role not in ('responsable', 'technicien', 'secretaire', 'developpeur') then
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

-- SEC-03 : le propriétaire d'une ligne (created_by) est immuable. Sans ce
-- garde-fou, un utilisateur pouvait transférer ou « cacher » une fiche en
-- modifiant created_by. Seul le rôle postgres/service (auth.uid() null, p. ex.
-- migrations) peut le modifier.
create or replace function public.prevent_created_by_change()
returns trigger language plpgsql as $$
begin
  if new.created_by is distinct from old.created_by and auth.uid() is not null then
    raise exception 'created_by est immuable';
  end if;
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['clients','interventions','equipements','pieces_utilisees',
    'appels','rendezvous','mesures','photos','pieces','documents','contrats_entretien'] loop
    execute format('drop trigger if exists %I_prevent_created_by_change on public.%I', t, t);
    execute format('create trigger %I_prevent_created_by_change before update on public.%I for each row execute function public.prevent_created_by_change()', t, t);
  end loop;
end $$;

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

-- signatures (SEC-01) : bucket public — les URLs publiques restent servies
-- directement (affichage et PDF). AUCUNE policy `select` : l'énumération via
-- l'API `list()` avec la clé anon est impossible. Les noms d'objets sont des
-- UUID (non devinables). Le bucket public sert les objets par URL sans policy.
drop policy if exists signatures_read on storage.objects;

drop policy if exists signatures_insert on storage.objects;
create policy signatures_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'signatures');

-- Une signature est figée : pas de remplacement ni de suppression par un
-- non-manager (SEC-08 : le remplacement silencieux d'une preuve est exclu).
drop policy if exists signatures_update on storage.objects;
drop policy if exists signatures_delete on storage.objects;
create policy signatures_delete on storage.objects
  for delete to authenticated using (bucket_id = 'signatures' and public.is_manager());

-- photos & documents (SEC-02 / SEC-11) : privés. Les objets sont nommés
-- `{intervention_id}/{uuid}.ext` ; le périmètre suit la règle de la table
-- liée (manager, ou créateur / technicien affecté de l'intervention).
-- Le premier segment du chemin = identifiant de l'intervention.
create or replace function public.can_access_intervention_object(object_name text)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.interventions i
    where i.id::text = (storage.foldername(object_name))[1]
      and (public.is_manager() or i.created_by = auth.uid() or i.technicien_id = auth.uid())
  );
$$;
revoke all on function public.can_access_intervention_object(text) from public;
grant execute on function public.can_access_intervention_object(text) to authenticated;

drop policy if exists photos_read on storage.objects;
create policy photos_read on storage.objects
  for select to authenticated
  using (bucket_id = 'photos' and public.can_access_intervention_object(name));

drop policy if exists photos_insert on storage.objects;
create policy photos_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos' and public.can_access_intervention_object(name));

drop policy if exists photos_update on storage.objects;
create policy photos_update on storage.objects
  for update to authenticated
  using (bucket_id = 'photos' and public.is_manager())
  with check (bucket_id = 'photos' and public.is_manager());

drop policy if exists photos_delete on storage.objects;
create policy photos_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos' and public.can_access_intervention_object(name));

drop policy if exists documents_read on storage.objects;
create policy documents_read on storage.objects
  for select to authenticated
  using (bucket_id = 'documents' and public.can_access_intervention_object(name));

drop policy if exists documents_insert on storage.objects;
create policy documents_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documents' and public.can_access_intervention_object(name));

-- Factures / devis : modification réservée aux managers (pas de remplacement
-- silencieux d'un justificatif par un technicien).
drop policy if exists documents_update on storage.objects;
create policy documents_update on storage.objects
  for update to authenticated
  using (bucket_id = 'documents' and public.is_manager())
  with check (bucket_id = 'documents' and public.is_manager());

drop policy if exists documents_delete on storage.objects;
create policy documents_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'documents' and public.is_manager());

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
  )
  with check (
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
-- SYNC-04 : la visibilité du technicien repose UNIQUEMENT sur `technicien_id`
-- (affecté à la création par l'app via `resolveTechId`, aligné sur l'historique
-- par le backfill de fin de script) — JAMAIS sur le nom `intervenant` : le nom
-- affiché est modifiable par l'utilisateur (updateProfile), il ne doit servir
-- ni à la sécurité ni au périmètre RLS. Les RDV non affectés (intervenant
-- vide et technicien_id absent) restent visibles par toute l'équipe.
-- Pour un RDV affecté (technicien_id posé, intervenant non renseigné ou
-- renommé), le technicien concerné reste visible.
drop policy if exists rendezvous_select on public.rendezvous;
create policy rendezvous_select on public.rendezvous for select to authenticated
  using (
    public.is_manager()
    or created_by = auth.uid()
    or technicien_id = auth.uid()
    or (intervenant is null or intervenant = '')
  );
-- RDV affectés : `technicien_id = auth.uid()` ci-dessus suffit — pas de
-- clause de repli sur `full_name` (voir SYNC-04).
drop policy if exists rendezvous_insert on public.rendezvous;
create policy rendezvous_insert on public.rendezvous for insert to authenticated
  with check (public.is_manager() or (technicien_id is null or technicien_id = auth.uid()));
drop policy if exists rendezvous_update on public.rendezvous;
create policy rendezvous_update on public.rendezvous for update to authenticated
  using (public.is_manager() or created_by = auth.uid() or technicien_id = auth.uid())
  with check (public.is_manager() or created_by = auth.uid() or technicien_id = auth.uid());
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

-- service_role : utilisé par les scripts exploitant (ex. migration Storage
-- SEC-02/11) et le backfill. Supabase l'accorde par défaut via ALTER DEFAULT
-- PRIVILEGES ; sur une base créée AVANT ce réglage (prod), les tables
-- existantes n'ont aucun privilège pour ce rôle (42501 au /rest/v1).
-- GRANT explicite, idempotent, indépendant des default privileges.
grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;

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
-- BACKFILL DES RÔLES — SORTI DU FICHIER VERSIONNÉ (SEC-06 / DB-02)
-- Le bloc d'attribution des rôles par email (données personnelles
-- réelles) vit désormais dans `supabase/seed.local.sql`, fichier NON
-- versionné (listé dans .gitignore). Ne JAMAIS remettre d'emails
-- réels dans ce fichier. Sur une base vierge : exécuter ce script
-- d'abord, puis `seed.local.sql` après la création des comptes dans
-- le Dashboard (idéalement après leur première connexion, pour que
-- la ligne profiles existe ; sinon set_user_role() peut aussi créer
-- la ligne à la demande).
-- ---------------------------------------------------------

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
