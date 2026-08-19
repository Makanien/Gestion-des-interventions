-- =========================================================
-- Climat Elec — Storage buckets (signatures, photos, documents)
-- À exécuter après schema.sql.
-- =========================================================

-- Buckets : signatures (V2, public pour le PDF), photos et documents (V3, privés).
insert into storage.buckets (id, name, public)
values
  ('signatures', 'signatures', true),
  ('photos', 'photos', false),
  ('documents', 'documents', false)
on conflict (id) do nothing;

-- signatures : lecture publique (URL directe dans le PDF), écriture authentifiée.
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
