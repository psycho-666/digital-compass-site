insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('social-media','social-media',false,104857600,array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/quicktime'])
on conflict (id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "Social media upload own folder" on storage.objects;
create policy "Social media upload own folder" on storage.objects for insert to authenticated
with check (bucket_id='social-media' and (storage.foldername(name))[1]=(select auth.uid()::text));

drop policy if exists "Social media read own folder" on storage.objects;
create policy "Social media read own folder" on storage.objects for select to authenticated
using (bucket_id='social-media' and (storage.foldername(name))[1]=(select auth.uid()::text));

drop policy if exists "Social media delete own folder" on storage.objects;
create policy "Social media delete own folder" on storage.objects for delete to authenticated
using (bucket_id='social-media' and (storage.foldername(name))[1]=(select auth.uid()::text));