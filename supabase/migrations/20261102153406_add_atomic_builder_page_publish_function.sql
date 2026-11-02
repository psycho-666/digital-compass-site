create or replace function public.publish_builder_page_version(p_version_id uuid)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_page_id uuid;
begin
  select page_id
    into v_page_id
  from public.builder_page_versions
  where id = p_version_id;

  if v_page_id is null then
    raise exception 'Page version not found or access denied';
  end if;

  update public.builder_page_versions
  set status = 'draft'
  where page_id = v_page_id
    and status = 'published';

  update public.builder_page_versions
  set status = 'published'
  where id = p_version_id;

  if not found then
    raise exception 'Could not publish the selected page version';
  end if;
end;
$$;

revoke all on function public.publish_builder_page_version(uuid) from public, anon;
grant execute on function public.publish_builder_page_version(uuid) to authenticated;
