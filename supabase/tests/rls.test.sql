-- =========================================================
-- BP-02 — Tests RLS / workflow / rôles (pgTAP).
-- Un compte par rôle ; l'identité est posée via request.jwt.claim.sub (comme PostgREST).
-- Exécution : `supabase test db` (CLI) ou `supabase/tests/run-local.sh` (Postgres nu + shim).
-- =========================================================
begin;
create extension if not exists pgtap;
select plan(31);

-- ---- Comptes de test (le trigger on_auth_user_created crée un profil `en_attente`) ----
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'resp@test.local',  '{"full_name":"Resp"}'),
  ('00000000-0000-0000-0000-0000000000a2', 'tech1@test.local', '{"full_name":"Tech Un"}'),
  ('00000000-0000-0000-0000-0000000000a3', 'tech2@test.local', '{"full_name":"Tech Deux"}'),
  ('00000000-0000-0000-0000-0000000000a4', 'secr@test.local',  '{"full_name":"Secretaire"}'),
  ('00000000-0000-0000-0000-0000000000a5', 'wait@test.local',  '{"full_name":"Attente"}');
-- Hors session (auth.uid() null) : pas de contrôle d'escalade, on pose les rôles.
update public.profiles set role = 'responsable' where id = '00000000-0000-0000-0000-0000000000a1';
update public.profiles set role = 'technicien'  where id in ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a3');
update public.profiles set role = 'secretaire'  where id = '00000000-0000-0000-0000-0000000000a4';

insert into public.clients (id, nom) values ('00000000-0000-0000-0000-00000000c001', 'Client test');
insert into public.interventions (id, client_id, created_by, technicien_id, statut_dossier) values
  ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a2', 'a_valider'),
  ('00000000-0000-0000-0000-00000000f002', '00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000a3', 'brouillon');

-- ================= Visiteur anonyme =================
set local role anon;
select is((select count(*)::int from public.clients), 0, 'anon : ne voit aucun client');
select is((select count(*)::int from public.interventions), 0, 'anon : ne voit aucune intervention');
reset role;

-- ================= Compte en attente (SEC-05) =================
set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-0000000000a5';
select is((select count(*)::int from public.clients), 0, 'en_attente : ne voit aucun client');
select throws_ok($$insert into public.clients (nom) values ('Intrus')$$, '42501', null, 'en_attente : ne peut pas créer de client');
select is((select count(*)::int from public.interventions), 0, 'en_attente : ne voit aucune intervention');
reset role;

-- ================= Technicien =================
set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-0000000000a2';
select is((select count(*)::int from public.clients), 1, 'technicien : voit les clients (base partagée)');
select is((select count(*)::int from public.interventions), 1, 'technicien : ne voit que SA fiche');
select is((select id::text from public.interventions), '00000000-0000-0000-0000-00000000f001', 'technicien : c''est bien la sienne');
select is_empty($$update public.interventions set descriptif_demande = 'piratage' where id = '00000000-0000-0000-0000-00000000f002' returning 1$$,
  'technicien : ne peut pas modifier la fiche d''un collègue');
select lives_ok($$update public.interventions set descriptif_demande = 'ok' where id = '00000000-0000-0000-0000-00000000f001'$$, 'technicien : modifie sa propre fiche');
select throws_ok(
  $$insert into public.interventions (client_id, technicien_id) values ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-0000000000a3')$$,
  '42501', null, 'technicien : ne peut pas affecter une fiche à un autre technicien');
select throws_ok($$update public.interventions set statut_dossier = 'a_facturer' where id = '00000000-0000-0000-0000-00000000f001'$$,
  '42501', null, 'workflow : un technicien ne peut pas valider (a_valider → a_facturer)');
select throws_ok($$update public.profiles set role = 'responsable' where id = '00000000-0000-0000-0000-0000000000a2'$$,
  '42501', null, 'SEC : un technicien ne peut pas s''auto-promouvoir par UPDATE direct');
select throws_ok($$select public.set_user_role('00000000-0000-0000-0000-0000000000a2', 'responsable')$$,
  '42501', null, 'SEC : set_user_role est réservé au responsable');
select throws_ok($$insert into public.contrats_entretien (client_id) values ('00000000-0000-0000-0000-00000000c001')$$,
  '42501', null, 'contrats : un technicien ne peut pas en créer');
reset role;

-- ================= Secrétaire (manager) =================
set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-0000000000a4';
select is((select count(*)::int from public.interventions), 2, 'secrétaire (manager) : voit toutes les fiches');
select lives_ok($$insert into public.contrats_entretien (client_id) values ('00000000-0000-0000-0000-00000000c001')$$, 'contrats : un manager peut en créer');
select lives_ok($$update public.interventions set statut_dossier = 'a_facturer' where id = '00000000-0000-0000-0000-00000000f001'$$, 'workflow : un manager valide');
select is(
  (select valide_par::text from public.interventions where id = '00000000-0000-0000-0000-00000000f001'),
  '00000000-0000-0000-0000-0000000000a4', 'workflow : valide_par posé par le SERVEUR (pas par le client)');
select throws_ok($$update public.interventions set statut_dossier = 'a_valider' where id = '00000000-0000-0000-0000-00000000f001'$$,
  '23514', null, 'workflow : dévalidation sans motif refusée');
select lives_ok($$update public.interventions set statut_dossier = 'a_valider', motif_retour = 'Pièce manquante' where id = '00000000-0000-0000-0000-00000000f001'$$,
  'workflow : dévalidation avec motif acceptée');
select is((select valide_par from public.interventions where id = '00000000-0000-0000-0000-00000000f001'), null, 'workflow : la trace de validation est effacée');
select throws_ok($$update public.interventions set statut_dossier = 'termine' where id = '00000000-0000-0000-0000-00000000f001'$$,
  '42501', null, 'workflow : a_valider → termine (saut d''étape) refusé');
reset role;

-- ================= Responsable =================
set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-0000000000a1';
select lives_ok($$select public.set_user_role('00000000-0000-0000-0000-0000000000a5', 'technicien')$$, 'responsable : peut valider un compte en attente');
select is((select role from public.profiles where id = '00000000-0000-0000-0000-0000000000a5'), 'technicien', 'responsable : le rôle a bien changé');
select is((select count(*)::int from public.role_events where target_id = '00000000-0000-0000-0000-0000000000a5'), 1, 'SEC-07 : le changement est journalisé');
select throws_ok($$select public.set_user_role('00000000-0000-0000-0000-0000000000a5', 'developpeur')$$,
  '22023', null, 'SEC : le rôle developpeur n''est pas attribuable depuis l''application');
select throws_ok($$select public.set_user_role('00000000-0000-0000-0000-0000000000a1', 'technicien')$$,
  '22023', null, 'SEC : impossible de retirer le dernier responsable');
select throws_ok($$update public.role_events set new_role = 'x'$$, null, null, 'SEC-07 : role_events est en ajout seul (UPDATE refusé)');
reset role;

-- ================= Journal des dossiers =================
select cmp_ok((select count(*)::int from public.dossier_events where intervention_id = '00000000-0000-0000-0000-00000000f001'), '>=', 3,
  'dossier_events : les transitions sont tracées');
select throws_ok($$delete from public.dossier_events$$, null, null, 'dossier_events : en ajout seul (DELETE refusé)');

select * from finish();
rollback;
