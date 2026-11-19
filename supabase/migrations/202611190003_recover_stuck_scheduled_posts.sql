alter table public.scheduled_posts
  add column if not exists publishing_started_at timestamptz,
  add column if not exists last_error text;

create or replace function public.claim_due_social_posts(batch_size integer default 10)
returns setof public.scheduled_posts
language plpgsql
security definer
set search_path = ''
as $function$
begin
  update public.scheduled_posts
  set status = 'scheduled', publishing_started_at = null,
      last_error = coalesce(last_error, 'Recovered after an interrupted publishing attempt')
  where status = 'publishing'
    and publishing_started_at < now() - interval '20 minutes';

  return query
  with due as (
    select id
    from public.scheduled_posts
    where status = 'scheduled' and scheduled_for is not null and scheduled_for <= now()
    order by scheduled_for asc
    for update skip locked
    limit greatest(1, least(coalesce(batch_size, 10), 25))
  )
  update public.scheduled_posts p
  set status = 'publishing', publishing_started_at = now(), last_error = null
  from due
  where p.id = due.id
  returning p.*;
end;
$function$;

revoke all on function public.claim_due_social_posts(integer) from public, anon, authenticated;
grant execute on function public.claim_due_social_posts(integer) to service_role;