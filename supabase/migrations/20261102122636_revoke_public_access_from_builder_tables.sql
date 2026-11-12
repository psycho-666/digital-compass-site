-- Do not rely on default privileges for newly-created public tables.
revoke all privileges on table
 public.builder_workspaces, public.builder_workspace_members, public.builder_sites,
 public.builder_pages, public.builder_page_versions
from anon, PUBLIC;
grant select, insert, update, delete on public.builder_workspaces to authenticated;
grant select, insert, update, delete on public.builder_workspace_members to authenticated;
grant select, insert, update, delete on public.builder_sites to authenticated;
grant select, insert, update, delete on public.builder_pages to authenticated;
grant select, insert on public.builder_page_versions to authenticated;
