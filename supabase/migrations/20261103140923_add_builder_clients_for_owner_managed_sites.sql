-- Add client records to the owner-managed website portfolio.

create table public.builder_clients (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.builder_workspaces(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  business_type text not null default '' check (char_length(business_type) <= 120),
  contact_name text not null default '' check (char_length(contact_name) <= 160),
  phone text not null default '' check (char_length(phone) <= 40),
  email text not null default '' check (char_length(email) <= 254),
  notes text not null default '' check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id)
);
create index builder_clients_workspace_idx on public.builder_clients(workspace_id, created_at desc);
alter table public.builder_clients enable row level security;
create policy "builder_clients_owner_select" on public.builder_clients
  for select to authenticated
  using (exists (select 1 from public.builder_workspaces w where w.id=builder_clients.workspace_id and w.owner_id=(select auth.uid())));
create policy "builder_clients_owner_insert" on public.builder_clients
  for insert to authenticated
  with check (exists (select 1 from public.builder_workspaces w where w.id=builder_clients.workspace_id and w.owner_id=(select auth.uid())));
create policy "builder_clients_owner_update" on public.builder_clients
  for update to authenticated
  using (exists (select 1 from public.builder_workspaces w where w.id=builder_clients.workspace_id and w.owner_id=(select auth.uid())))
  with check (exists (select 1 from public.builder_workspaces w where w.id=builder_clients.workspace_id and w.owner_id=(select auth.uid())));
create policy "builder_clients_owner_delete" on public.builder_clients
  for delete to authenticated
  using (exists (select 1 from public.builder_workspaces w where w.id=builder_clients.workspace_id and w.owner_id=(select auth.uid())));
grant select, insert, update, delete on public.builder_clients to authenticated;
alter table public.builder_sites add column client_id uuid;
alter table public.builder_sites add constraint builder_sites_client_same_workspace_fk
  foreign key (client_id, workspace_id) references public.builder_clients(id, workspace_id) on delete set null (client_id);
create index builder_sites_client_idx on public.builder_sites(client_id);
