-- =========================================================
-- Climat Elec — Migration : visibilité des rendez-vous par technicien
-- Fichier : 003_fix_rdv_visibilite.sql
-- À exécuter APRÈS 002_v3.sql. Idempotent.
--
-- Problème corrigé :
--   L'affectation d'un rendez-vous se fait par le texte `intervenant`
--   ("Jérémy", "Régis", "Delphine"), mais la RLS ne contrôle que
--   `technicien_id` (uuid). Le trigger rendezvous_set_technicien
--   initialise technicien_id avec le créateur : un RDV créé par le
--   responsable pour "Jérémy" garde donc technicien_id = responsable,
--   et Jérémy ne le reçoit jamais (le pull est filtré par la RLS).
--
-- Corrections :
--   1. Backfill : rattache technicien_id au profil dont le nom
--      correspond à l'intervenant du RDV (données existantes).
--   2. RLS select élargie : le technicien voit son planning via
--      technicien_id OU le nom d'intervenant ; les RDV non affectés
--      (intervenant vide) restent visibles par toute l'équipe.
-- =========================================================

-- ---------------------------------------------------------
-- 1. Backfill technicien_id depuis intervenant
-- ---------------------------------------------------------
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

-- ---------------------------------------------------------
-- 2. RLS select : planning du technicien
--    (technicien_id, nom d'intervenant, ou RDV non affecté)
-- ---------------------------------------------------------
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
