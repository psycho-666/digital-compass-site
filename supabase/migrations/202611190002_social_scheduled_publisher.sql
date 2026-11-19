select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'social-publisher-cron-secret', 'Private trigger secret for scheduled social post publisher');

create or replace function public.social_cron_secret_matches(candidate text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select coalesce(candidate <> '' and exists (
    select 1 from vault.decrypted_secrets
    where name = 'social-publisher-cron-secret' and decrypted_secret = candidate
  ), false);
$$;
revoke all on function public.social_cron_secret_matches(text) from public, anon, authenticated;
grant execute on function public.social_cron_secret_matches(text) to service_role;

create or replace function public.claim_due_social_posts(batch_size integer default 10)
returns setof public.scheduled_posts language plpgsql security definer set search_path = ''
as $$
begin
  return query
  with due as (
    select id from public.scheduled_posts
    where status = 'scheduled' and scheduled_for is not null and scheduled_for <= now()
    order by scheduled_for asc for update skip locked
    limit greatest(1, least(coalesce(batch_size, 10), 25))
  )
  update public.scheduled_posts p set status = 'publishing'
  from due where p.id = due.id returning p.*;
end;
$$;
revoke all on function public.claim_due_social_posts(integer) from public, anon, authenticated;
grant execute on function public.claim_due_social_posts(integer) to service_role;

select cron.schedule(
  'digital-compass-social-publisher',
  '* * * * *',
  $job$
    select net.http_post(
      url := 'https://xnoalyxxrjyovivdeojo.supabase.co/functions/v1/social-publisher',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', 'sb_publishable_oakIu8ywKQLibfDJUDYIVg_XsNNZi66',
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'social-publisher-cron-secret')
      ),
      body := '{"source":"pg_cron"}'::jsonb,
      timeout_milliseconds := 10000
    );
  $job$
);
