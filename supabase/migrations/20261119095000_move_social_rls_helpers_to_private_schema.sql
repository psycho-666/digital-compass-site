create or replace function private.is_social_staff()
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active=true); $$;
create or replace function private.is_social_owner()
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active=true and p.role in ('owner','admin')); $$;

revoke all on schema private from anon;
grant usage on schema private to authenticated, service_role;
revoke all on function private.is_social_staff() from public, anon;
revoke all on function private.is_social_owner() from public, anon;
grant execute on function private.is_social_staff() to authenticated, service_role;
grant execute on function private.is_social_owner() to authenticated, service_role;

drop policy if exists profiles_read_self_or_admin on public.profiles;
create policy profiles_read_self_or_admin on public.profiles
for select using (id=(select auth.uid()) or private.is_social_owner());
drop policy if exists profiles_update_admin_only on public.profiles;
create policy profiles_update_admin_only on public.profiles
for update using (private.is_social_owner()) with check (private.is_social_owner());

do $$
declare t text;
begin
 foreach t in array array['clients','leads','social_accounts','inbox_threads','inbox_items','content_posts','services','client_services','payments','tasks','client_knowledge','client_faqs','platform_integrations','webhook_events','automation_rules','automation_runs','activity_logs'] loop
  execute format('drop policy if exists social_staff_access on public.%I',t);
  execute format('create policy social_staff_access on public.%I for all using (private.is_social_staff()) with check (private.is_social_staff())',t);
 end loop;
end $$;

drop function if exists public.is_social_staff();
drop function if exists public.is_social_owner();
