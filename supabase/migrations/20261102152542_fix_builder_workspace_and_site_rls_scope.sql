-- Fix correlated-column qualification so membership checks are scoped to the outer workspace/site.
drop policy if exists "builder_workspaces_select_member" on public.builder_workspaces;
create policy "builder_workspaces_select_member"
on public.builder_workspaces
for select
to authenticated
using (
  builder_workspaces.owner_id=(select auth.uid())
  or exists (
    select 1
    from public.builder_workspace_members m
    where m.workspace_id=builder_workspaces.id
      and m.user_id=(select auth.uid())
  )
);

drop policy if exists "builder_sites_select_member" on public.builder_sites;
create policy "builder_sites_select_member"
on public.builder_sites
for select
to authenticated
using (
  exists (
    select 1
    from public.builder_workspace_members m
    where m.workspace_id=builder_sites.workspace_id
      and m.user_id=(select auth.uid())
  )
);

drop policy if exists "builder_sites_insert_editor" on public.builder_sites;
create policy "builder_sites_insert_editor"
on public.builder_sites
for insert
to authenticated
with check (
  builder_sites.created_by=(select auth.uid())
  and exists (
    select 1
    from public.builder_workspace_members m
    where m.workspace_id=builder_sites.workspace_id
      and m.user_id=(select auth.uid())
      and m.role in ('owner','admin','editor')
  )
);

drop policy if exists "builder_sites_update_editor" on public.builder_sites;
create policy "builder_sites_update_editor"
on public.builder_sites
for update
to authenticated
using (
  exists (
    select 1
    from public.builder_workspace_members m
    where m.workspace_id=builder_sites.workspace_id
      and m.user_id=(select auth.uid())
      and m.role in ('owner','admin','editor')
  )
)
with check (
  exists (
    select 1
    from public.builder_workspace_members m
    where m.workspace_id=builder_sites.workspace_id
      and m.user_id=(select auth.uid())
      and m.role in ('owner','admin','editor')
  )
);

drop policy if exists "builder_sites_delete_admin" on public.builder_sites;
create policy "builder_sites_delete_admin"
on public.builder_sites
for delete
to authenticated
using (
  exists (
    select 1
    from public.builder_workspace_members m
    where m.workspace_id=builder_sites.workspace_id
      and m.user_id=(select auth.uid())
      and m.role in ('owner','admin')
  )
);
