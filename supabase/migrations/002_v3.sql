-- =========================================================
-- Climat Elec — Migration V3 : nouvelles tables + colonnes
-- Fichier : 002_v3.sql
-- À exécuter APRÈS schema.sql, storage.sql et 001_roles_rls.sql.
-- Idempotent : peut être relancé sans erreur.
--
-- Ce qu'il fait :
--   1. Ajoute les colonnes V3 sur interventions (numero,
--      statut_dossier, type_entretien, type_entretien_detail,
--      prochaine_intervention_prevue, annee_installation).
--   2. Crée les tables V3 : appels, rendezvous, mesures, photos,
--      pieces (base pièces), documents, contrats_entretien.
--   3. Renseigne automatiquement created_by / updated_by /
--      technicien_id (défaut = utilisateur courant), comme 001.
--   4. Met en place les RLS par rôle sur les nouvelles tables.
--   5. GRANT + Realtime.
-- =========================================================

-- ---------------------------------------------------------
-- 1. COLONNES V3 sur interventions
-- ---------------------------------------------------------
alter table public.interventions
  add column if not exists numero text not null default '';
alter table public.interventions
  add column if not exists statut_dossier text not null default 'a_valider';
alter table public.interventions
  add column if not exists type_entretien text not null default '';
alter table public.interventions
  add column if not exists type_entretien_detail text not null default '';
alter table public.interventions
  add column if not exists prochaine_intervention_prevue boolean not null default false;
alter table public.interventions
  add column if not exists annee_installation text not null default '';

create index if not exists interventions_statut_dossier_idx on public.interventions(statut_dossier);

-- ---------------------------------------------------------
-- 2. TABLE appels (US-01)
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
-- 3. TABLE rendezvous (US-02, planning)
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
-- 4. TABLE mesures (US-19, fiches d'entretien)
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
-- 5. TABLE photos (US-21)
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
-- 6. TABLE pieces (base pièces, US-23 — désignation seule)
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
-- 7. TABLE documents (devis / facture / contrat importés, US-07·09)
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
-- 8. TABLE contrats_entretien (US-24)
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
-- 9. TRIGGERS updated_at + created_by/updated_by + technicien
-- ---------------------------------------------------------
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

-- created_by / updated_by (fonctions définies dans 001_roles_rls.sql)
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

-- technicien_id par défaut = utilisateur courant (planning par technicien).
-- La fonction set_technicien_default() est définie dans 001_roles_rls.sql.
drop trigger if exists rendezvous_set_technicien on public.rendezvous;
create trigger rendezvous_set_technicien before insert on public.rendezvous
  for each row execute function public.set_technicien_default();

-- ---------------------------------------------------------
-- 10. ROW LEVEL SECURITY
-- ---------------------------------------------------------
alter table public.appels              enable row level security;
alter table public.rendezvous          enable row level security;
alter table public.mesures             enable row level security;
alter table public.photos              enable row level security;
alter table public.pieces              enable row level security;
alter table public.documents           enable row level security;
alter table public.contrats_entretien  enable row level security;

-- appels : managers voient tout, technicien ses propres appels.
drop policy if exists appels_select on public.appels;
create policy appels_select on public.appels for select to authenticated
  using (public.is_manager() or created_by = auth.uid());
drop policy if exists appels_insert on public.appels;
create policy appels_insert on public.appels for insert to authenticated with check (true);
drop policy if exists appels_update on public.appels;
create policy appels_update on public.appels for update to authenticated
  using (public.is_manager() or created_by = auth.uid());
drop policy if exists appels_delete on public.appels;
create policy appels_delete on public.appels for delete to authenticated
  using (public.is_manager() or created_by = auth.uid());

-- rendezvous : managers voient tout, technicien son planning.
drop policy if exists rendezvous_select on public.rendezvous;
create policy rendezvous_select on public.rendezvous for select to authenticated
  using (public.is_manager() or created_by = auth.uid() or technicien_id = auth.uid());
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
-- 11. GRANT
-- ---------------------------------------------------------
grant select, insert, update, delete on public.appels             to authenticated;
grant select, insert, update, delete on public.rendezvous         to authenticated;
grant select, insert, update, delete on public.mesures            to authenticated;
grant select, insert, update, delete on public.photos             to authenticated;
grant select, insert, update, delete on public.pieces             to authenticated;
grant select, insert, update, delete on public.documents          to authenticated;
grant select, insert, update, delete on public.contrats_entretien to authenticated;

-- ---------------------------------------------------------
-- 12. REALTIME
-- ---------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['appels','rendezvous','mesures','photos','pieces','documents','contrats_entretien']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
