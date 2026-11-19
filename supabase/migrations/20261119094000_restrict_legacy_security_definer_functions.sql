do $$
declare r record;
begin
 for r in
  select p.oid::regprocedure as signature
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prosecdef
    and p.proname not in ('is_social_staff','is_social_owner')
 loop
  execute format('revoke execute on function %s from public, anon, authenticated',r.signature);
 end loop;
end $$;
revoke execute on function public.handle_social_user_created() from public, anon, authenticated;
