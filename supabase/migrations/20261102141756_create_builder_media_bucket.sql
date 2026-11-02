insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values (
  'builder-media',
  'builder-media',
  false,
  10485760,
  array['image/jpeg','image/png','image/webp','image/gif']::text[]
)
on conflict (id) do nothing;

create policy "builder_media_read_workspace_member"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'builder-media'
  and exists (
    select 1
    from public.builder_workspace_members m
    where m.workspace_id::text = (storage.foldername(name))[1]
      and m.user_id = (select auth.uid())
      and m.role in ('owner','admin','editor','viewer')
  )
);

create policy "builder_media_upload_workspace_editor"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'builder-media'
  and exists (
    select 1
    from public.builder_workspace_members m
    where m.workspace_id::text = (storage.foldername(name))[1]
      and m.user_id = (select auth.uid())
      and m.role in ('owner','admin','editor')
  )
);

create policy "builder_media_update_workspace_editor"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'builder-media'
  and exists (
    select 1
    from public.builder_workspace_members m
    where m.workspace_id::text = (storage.foldername(name))[1]
      and m.user_id = (select auth.uid())
      and m.role in ('owner','admin','editor')
  )
)
with check (
  bucket_id = 'builder-media'
  and exists (
    select 1
    from public.builder_workspace_members m
    where m.workspace_id::text = (storage.foldername(name))[1]
      and m.user_id = (select auth.uid())
      and m.role in ('owner','admin','editor')
  )
);

create policy "builder_media_delete_workspace_editor"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'builder-media'
  and exists (
    select 1
    from public.builder_workspace_members m
    where m.workspace_id::text = (storage.foldername(name))[1]
      and m.user_id = (select auth.uid())
      and m.role in ('owner','admin','editor')
  )
);