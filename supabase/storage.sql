-- =========================================================
-- Climat Elec — Storage buckets (signatures)
-- À exécuter après schema.sql.
-- =========================================================
insert into storage.buckets (id, name, public)
values ('signatures', 'signatures', true)
on conflict (id) do nothing;

-- Les signatures sont publiques en lecture (URL directe dans le PDF),
-- mais seuls les utilisateurs connectés peuvent écrire.
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
