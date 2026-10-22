-- =========================================================
-- Climat Elec — Jeu de données de test : 10 clients fictifs
-- Projet de DÉVELOPPEMENT uniquement (savraokgxykcgpddzrib).
-- À exécuter dans le SQL Editor du projet Supabase dev.
-- Idempotent : on conflict do nothing (IDs fixes, réutilisable).
-- Source : documentation/client fictifs.md
-- =========================================================

insert into public.clients (id, nom, adresse, code_postal, ville, mail, tel, type_batiment) values
  ('c1000000-0000-4000-8000-000000000001', 'Dubois Thomas',   '14 rue de la République',   '75011', 'Paris',      'thomas.dubois@example.fr',   '06 12 34 56 78', ''),
  ('c1000000-0000-4000-8000-000000000002', 'Lambert Sophie',  '8 avenue Jean Jaurès',      '69007', 'Lyon',       'sophie.lambert@example.fr',  '06 23 45 67 89', ''),
  ('c1000000-0000-4000-8000-000000000003', 'Moreau Lucas',    '27 boulevard Victor Hugo',  '31000', 'Toulouse',   'lucas.moreau@example.fr',    '06 34 56 78 90', ''),
  ('c1000000-0000-4000-8000-000000000004', 'Bernard Camille', '5 rue de la Paix',          '44000', 'Nantes',     'camille.bernard@example.fr', '06 45 67 89 01', ''),
  ('c1000000-0000-4000-8000-000000000005', 'Petit Alexandre', '42 rue Nationale',          '59000', 'Lille',      'alexandre.petit@example.fr', '06 56 78 90 12', ''),
  ('c1000000-0000-4000-8000-000000000006', 'Roux Emma',       '19 rue de la Gare',         '33000', 'Bordeaux',   'emma.roux@example.fr',       '06 67 89 01 23', ''),
  ('c1000000-0000-4000-8000-000000000007', 'Fournier Maxime', '31 avenue de France',       '67000', 'Strasbourg', 'maxime.fournier@example.fr', '06 78 90 12 34', ''),
  ('c1000000-0000-4000-8000-000000000008', 'Girard Julie',    '6 rue Saint-Ferréol',       '13001', 'Marseille',  'julie.girard@example.fr',    '06 89 01 23 45', ''),
  ('c1000000-0000-4000-8000-000000000009', 'Mercier Antoine', '15 boulevard Gambetta',     '06000', 'Nice',       'antoine.mercier@example.fr', '07 12 34 56 78', ''),
  ('c1000000-0000-4000-8000-000000000010', 'Bonnet Chloé',    '22 rue de Bretagne',        '35000', 'Rennes',     'chloe.bonnet@example.fr',    '07 23 45 67 89', '')
on conflict (id) do nothing;
