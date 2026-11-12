-- Digital Compass Builder: isolated multi-tenant site/page persistence.
-- Additive only: does not modify existing social-media or legacy website tables.
create table public.builder_workspaces (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 name text not null check (char_length(name) between 1 and 120), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.builder_workspace_members (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.builder_workspaces(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade, role text not null default 'owner' check (role in ('owner','admin','editor','viewer')),
 created_at timestamptz not null default now(), unique (workspace_id,user_id)
);
create table public.builder_sites (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.builder_workspaces(id) on delete cascade,
 name text not null check (char_length(name) between 1 and 120), slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
 default_locale text not null default 'ar' check (default_locale in ('ar','en')), created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.builder_pages (
 id uuid primary key default gen_random_uuid(), site_id uuid not null references public.builder_sites(id) on delete cascade,
 title text not null default 'صفحة جديدة' check (char_length(title) between 1 and 180),
 slug text not null check (slug ~ '^[a-z0-9][a-z0-9-]{0,62}$'), locale text not null default 'ar' check (locale in ('ar','en')),
 is_home boolean not null default false, sort_order integer not null default 0, created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(), unique (site_id,slug,locale)
);
create table public.builder_page_versions (
 id uuid primary key default gen_random_uuid(), page_id uuid not null references public.builder_pages(id) on delete cascade,
 version_no integer not null check (version_no > 0), status text not null default 'draft' check (status in ('draft','published')),
 document jsonb not null default '{"schemaVersion":1,"locale":"ar","title":"صفحة جديدة","blocks":[]}'::jsonb check (jsonb_typeof(document)='object'),
 created_by uuid not null references auth.users(id), created_at timestamptz not null default now(), unique (page_id,version_no)
);
create index builder_workspace_members_user_idx on public.builder_workspace_members(user_id,workspace_id);
create index builder_sites_workspace_idx on public.builder_sites(workspace_id);
create index builder_pages_site_idx on public.builder_pages(site_id,sort_order);
create index builder_page_versions_page_idx on public.builder_page_versions(page_id,version_no desc);
alter table public.builder_workspaces enable row level security;
alter table public.builder_workspace_members enable row level security;
alter table public.builder_sites enable row level security;
alter table public.builder_pages enable row level security;
alter table public.builder_page_versions enable row level security;
create policy "builder_workspaces_select_member" on public.builder_workspaces for select to authenticated using (owner_id=(select auth.uid()) or exists(select 1 from public.builder_workspace_members m where m.workspace_id=id and m.user_id=(select auth.uid())));
create policy "builder_workspaces_insert_owner" on public.builder_workspaces for insert to authenticated with check (owner_id=(select auth.uid()));
create policy "builder_workspaces_update_owner" on public.builder_workspaces for update to authenticated using (owner_id=(select auth.uid())) with check (owner_id=(select auth.uid()));
create policy "builder_workspaces_delete_owner" on public.builder_workspaces for delete to authenticated using (owner_id=(select auth.uid()));
create policy "builder_members_select_self" on public.builder_workspace_members for select to authenticated using (user_id=(select auth.uid()));
create policy "builder_members_insert_workspace_owner" on public.builder_workspace_members for insert to authenticated with check (exists(select 1 from public.builder_workspaces w where w.id=workspace_id and w.owner_id=(select auth.uid())));
create policy "builder_members_update_workspace_owner" on public.builder_workspace_members for update to authenticated using (exists(select 1 from public.builder_workspaces w where w.id=workspace_id and w.owner_id=(select auth.uid()))) with check (exists(select 1 from public.builder_workspaces w where w.id=workspace_id and w.owner_id=(select auth.uid())));
create policy "builder_members_delete_workspace_owner" on public.builder_workspace_members for delete to authenticated using (exists(select 1 from public.builder_workspaces w where w.id=workspace_id and w.owner_id=(select auth.uid())));
create policy "builder_sites_select_member" on public.builder_sites for select to authenticated using (exists(select 1 from public.builder_workspace_members m where m.workspace_id=workspace_id and m.user_id=(select auth.uid())));
create policy "builder_sites_insert_editor" on public.builder_sites for insert to authenticated with check (created_by=(select auth.uid()) and exists(select 1 from public.builder_workspace_members m where m.workspace_id=workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','editor')));
create policy "builder_sites_update_editor" on public.builder_sites for update to authenticated using (exists(select 1 from public.builder_workspace_members m where m.workspace_id=workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','editor'))) with check (exists(select 1 from public.builder_workspace_members m where m.workspace_id=workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','editor')));
create policy "builder_sites_delete_admin" on public.builder_sites for delete to authenticated using (exists(select 1 from public.builder_workspace_members m where m.workspace_id=workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')));
create policy "builder_pages_select_member" on public.builder_pages for select to authenticated using (exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=site_id and m.user_id=(select auth.uid())));
create policy "builder_pages_insert_editor" on public.builder_pages for insert to authenticated with check (exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=site_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','editor')));
create policy "builder_pages_update_editor" on public.builder_pages for update to authenticated using (exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=site_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','editor'))) with check (exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=site_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','editor')));
create policy "builder_pages_delete_admin" on public.builder_pages for delete to authenticated using (exists(select 1 from public.builder_sites s join public.builder_workspace_members m on m.workspace_id=s.workspace_id where s.id=site_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')));
create policy "builder_versions_select_member" on public.builder_page_versions for select to authenticated using (exists(select 1 from public.builder_pages p join public.builder_sites s on s.id=p.site_id join public.builder_workspace_members m on m.workspace_id=s.workspace_id where p.id=page_id and m.user_id=(select auth.uid())));
create policy "builder_versions_insert_editor" on public.builder_page_versions for insert to authenticated with check (created_by=(select auth.uid()) and exists(select 1 from public.builder_pages p join public.builder_sites s on s.id=p.site_id join public.builder_workspace_members m on m.workspace_id=s.workspace_id where p.id=page_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','editor')));
grant select,insert,update,delete on public.builder_workspaces to authenticated;
grant select,insert,update,delete on public.builder_workspace_members to authenticated;
grant select,insert,update,delete on public.builder_sites to authenticated;
grant select,insert,update,delete on public.builder_pages to authenticated;
grant select,insert on public.builder_page_versions to authenticated;
