create policy "builder_media_read_published_page_images"
on storage.objects
for select
to anon
using (
  bucket_id='builder-media'
  and exists (
    select 1
    from public.builder_page_versions v
    join public.builder_pages p on p.id=v.page_id
    where v.status='published'
      and v.document @> jsonb_build_object(
        'blocks',
        jsonb_build_array(
          jsonb_build_object(
            'props',
            jsonb_build_object('imagePath',name)
          )
        )
      )
  )
);
