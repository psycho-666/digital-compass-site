-- Enforce one default builder workspace per account.
create unique index if not exists builder_workspaces_owner_unique on public.builder_workspaces(owner_id);
