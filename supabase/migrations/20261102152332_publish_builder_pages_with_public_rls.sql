-- Publish only explicitly approved page versions; keep all drafts private.
create policy "builder_versions_update_editor"
on public.builder_page_versions
for update
to authenticated
using (
  exists (
    select 1
    from public.builder_pages p
    join public.builder_sites s on s.id=p.site_id
    join public.builder_workspace_members m on m.workspace_id=s.workspace_id
    where p.id=page_id
      and m.user_id=(select auth.uid())
      and m.role in ('owner','admin','editor')
  )
)
with check (
  exists (
    select 1
    from public.builder_pages p
    join public.builder_sites s on s.id=p.site_id
    join public.builder_workspace_members m on m.workspace_id=s.workspace_id
    where p.id=page_id
      and m.user_id=(select auth.uid())
      and m.role in ('owner','admin','editor')
  )
);

create policy "builder_sites_public_published_only"
on public.builder_sites
for select
to anon
using (
  exists (
    select 1
    from public.builder_pages p
    join public.builder_page_versions v on v.page_id=p.id
    where p.site_id=builder_sites.id
      and v.status='published'
  )
);

create policy "builder_pages_public_published_only"
on public.builder_pages
for select
to anon
using (
  exists (
    select 1 from public.builder_page_versions v
    where v.page_id=builder_pages.id and v.status='published'
  )
);

create policy "builder_versions_public_published_only"
on public.builder_page_versions
for select
to anon
using (status='published');

grant select on public.builder_sites,public.builder_pages,public.builder_page_versions to anon;
grant update on public.builder_page_versions to authenticated;

create index if not exists builder_published_versions_latest_idx
on public.builder_page_versions(page_id,version_no desc)
where status='published';
