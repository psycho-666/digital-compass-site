create or replace function public.social_health_check()
returns jsonb language sql stable set search_path=public
as $$ select jsonb_build_object('ok',true,'service','digital-compass-social'); $$;
revoke all on function public.social_health_check() from public;
grant execute on function public.social_health_check() to anon, authenticated, service_role;
