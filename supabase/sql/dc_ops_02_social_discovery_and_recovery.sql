-- DC-OPS-02: leased automation commands and zero-secret Social Discovery persistence.

alter table public.automation_commands
  add column if not exists attempt_count integer not null default 0,
  add column if not exists max_attempts integer not null default 3,
  add column if not exists lease_expires_at timestamptz,
  add column if not exists last_heartbeat_at timestamptz;

create index if not exists automation_commands_recovery_idx
  on public.automation_commands (lease_expires_at, id)
  where status = 'RUNNING';

create or replace function public.enqueue_system_automation_command(p_command_type text)
returns bigint
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  out_id bigint;
begin
  if p_command_type not in (
    'SOCIAL_DISCOVERY', 'SOCIAL_AUDIT', 'SOCIAL_ENRICHMENT',
    'PROTOTYPE_RESEARCH', 'PROTOTYPE_QA'
  ) then
    raise exception 'Unsupported scheduled automation command: %', p_command_type;
  end if;

  if exists (
    select 1
    from public.automation_commands
    where command_type = p_command_type
      and status in ('QUEUED', 'RUNNING')
  ) then
    return null;
  end if;

  insert into public.automation_commands(command_type, status, payload, requested_at)
  values (
    p_command_type,
    'QUEUED',
    jsonb_build_object('source', 'SUPABASE_PG_CRON', 'scheduled_at', now()),
    now()
  )
  returning id into out_id;

  return out_id;
end;
$$;

revoke all on function public.enqueue_system_automation_command(text) from public;
grant execute on function public.enqueue_system_automation_command(text) to service_role;

create or replace function public.persist_social_discovery_results(
  p_command_id bigint,
  p_run_id bigint,
  p_request_id bigint default null,
  p_results jsonb default '[]'::jsonb,
  p_query_stats jsonb default '[]'::jsonb,
  p_blockers jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  item jsonb;
  ad jsonb;
  query_stat jsonb;
  candidate_id bigint;
  old_evidence jsonb;
  capped_evidence jsonb;
  observation jsonb;
  created_count integer := 0;
  updated_count integer := 0;
  advertiser_count integer := 0;
  ad_count integer := 0;
  materialized jsonb := '[]'::jsonb;
  outcome text;
  note text;
begin
  if not exists (
    select 1 from public.automation_commands
    where id = p_command_id and command_type = 'SOCIAL_DISCOVERY' and status = 'RUNNING'
  ) then
    raise exception 'Social Discovery command is not claimed';
  end if;

  if not exists (
    select 1 from public.social_research_runs
    where id = p_run_id and status = 'RUNNING'
  ) then
    raise exception 'Social Discovery run is not active';
  end if;

  for item in
    select value
    from jsonb_array_elements(coalesce(p_results, '[]'::jsonb))
    limit 120
  loop
    if coalesce(item->>'page_id', '') !~ '^\d{5,}$' then
      continue;
    end if;

    advertiser_count := advertiser_count + 1;
    candidate_id := null;
    old_evidence := '[]'::jsonb;

    select c.id, c.evidence
      into candidate_id, old_evidence
    from public.social_discovery_candidates c
    where c.discovery_source = 'META_AD_LIBRARY'
      and c.platform = 'FACEBOOK'
      and c.page_id_external = item->>'page_id'
    order by c.id
    limit 1;

    observation := jsonb_build_object(
      'type', 'ACTIVE_META_AD_LIBRARY_PAGE',
      'query', item->>'query',
      'query_id', item->'query_id',
      'source_url', item->>'ad_library_url',
      'observed_at', now(),
      'country_filter', 'IQ',
      'extraction', item->>'evidence_source',
      'ad_archive_ids', coalesce(
        (select jsonb_agg(a->>'external_ad_id') from jsonb_array_elements(coalesce(item->'ads', '[]'::jsonb)) a),
        '[]'::jsonb
      )
    );

    select coalesce(jsonb_agg(value order by ordinality), '[]'::jsonb)
      into capped_evidence
    from (
      select value, ordinality
      from jsonb_array_elements(coalesce(old_evidence, '[]'::jsonb) || jsonb_build_array(observation))
        with ordinality as evidence_item(value, ordinality)
      order by ordinality desc
      limit 20
    ) recent;

    if candidate_id is null then
      insert into public.social_discovery_candidates (
        country, platform, advertiser_name, page_name, page_id_external,
        profile_url, ad_library_url, landing_url, phone, whatsapp,
        discovery_source, discovery_query, discovery_method,
        has_active_public_ads, public_ad_count_observed,
        first_seen_at, last_seen_at, evidence, audit_requested, updated_at
      ) values (
        'Iraq', 'FACEBOOK', nullif(item->>'page_name', ''), nullif(item->>'page_name', ''), item->>'page_id',
        nullif(item->>'profile_url', ''), nullif(item->>'ad_library_url', ''), nullif(item->>'landing_url', ''),
        nullif(item->>'phone', ''), nullif(item->>'whatsapp', ''),
        'META_AD_LIBRARY', nullif(item->>'query', ''), 'AD_FIRST', true,
        greatest(1, jsonb_array_length(coalesce(item->'ads', '[]'::jsonb))),
        now(), now(), capped_evidence, true, now()
      )
      returning id into candidate_id;
      created_count := created_count + 1;
    else
      update public.social_discovery_candidates
      set advertiser_name = coalesce(nullif(item->>'page_name', ''), advertiser_name),
          page_name = coalesce(nullif(item->>'page_name', ''), page_name),
          profile_url = coalesce(nullif(item->>'profile_url', ''), profile_url),
          ad_library_url = coalesce(nullif(item->>'ad_library_url', ''), ad_library_url),
          landing_url = coalesce(nullif(item->>'landing_url', ''), landing_url),
          phone = coalesce(nullif(item->>'phone', ''), phone),
          whatsapp = coalesce(nullif(item->>'whatsapp', ''), whatsapp),
          discovery_query = coalesce(nullif(item->>'query', ''), discovery_query),
          has_active_public_ads = true,
          public_ad_count_observed = greatest(public_ad_count_observed, greatest(1, jsonb_array_length(coalesce(item->'ads', '[]'::jsonb)))),
          last_seen_at = now(),
          evidence = capped_evidence,
          audit_requested = true,
          updated_at = now()
      where id = candidate_id;
      updated_count := updated_count + 1;
    end if;

    for ad in
      select value
      from jsonb_array_elements(coalesce(item->'ads', '[]'::jsonb))
      limit 10
    loop
      if coalesce(ad->>'external_ad_id', '') !~ '^\d{5,}$' then
        continue;
      end if;

      insert into public.public_ad_observations (
        discovery_candidate_id, platform, library_source, external_ad_id,
        advertiser_name, ad_url, creative_text, call_to_action, landing_url,
        first_seen_at, last_seen_at, is_active, visible_regions,
        public_metadata, observed_at
      ) values (
        candidate_id, 'FACEBOOK', 'META_AD_LIBRARY', ad->>'external_ad_id',
        nullif(item->>'page_name', ''),
        'https://www.facebook.com/ads/library/?id=' || (ad->>'external_ad_id'),
        nullif(ad->>'creative_text', ''), nullif(ad->>'call_to_action', ''), nullif(ad->>'landing_url', ''),
        now(), now(), true, '["Iraq"]'::jsonb,
        jsonb_strip_nulls(jsonb_build_object(
          'query', item->>'query',
          'query_id', item->'query_id',
          'page_id', item->>'page_id',
          'extraction', item->>'evidence_source',
          'signal_extraction_version', 3,
          'iraq_phone', ad->>'phone',
          'whatsapp', ad->>'whatsapp'
        )),
        now()
      )
      on conflict (platform, library_source, external_ad_id)
      do update set
        discovery_candidate_id = excluded.discovery_candidate_id,
        advertiser_name = coalesce(excluded.advertiser_name, public_ad_observations.advertiser_name),
        ad_url = excluded.ad_url,
        creative_text = coalesce(excluded.creative_text, public_ad_observations.creative_text),
        call_to_action = coalesce(excluded.call_to_action, public_ad_observations.call_to_action),
        landing_url = coalesce(excluded.landing_url, public_ad_observations.landing_url),
        last_seen_at = now(),
        is_active = true,
        visible_regions = excluded.visible_regions,
        public_metadata = public_ad_observations.public_metadata || excluded.public_metadata,
        observed_at = now();
      ad_count := ad_count + 1;
    end loop;
  end loop;

  for query_stat in
    select value
    from jsonb_array_elements(coalesce(p_query_stats, '[]'::jsonb))
    limit 12
  loop
    update public.social_discovery_queries
    set last_used_at = now(),
        run_count = run_count + 1,
        last_hit_count = greatest(0, least(500, coalesce((query_stat->>'hits')::integer, 0))),
        hit_count = hit_count + greatest(0, least(500, coalesce((query_stat->>'hits')::integer, 0))),
        updated_at = now()
    where id = (query_stat->>'query_id')::bigint;
  end loop;

  select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb)
    into materialized
  from public.materialize_social_discovery_candidates() m;

  outcome := case when advertiser_count > 0 then 'SUCCEEDED' else 'PARTIAL' end;
  note := case
    when advertiser_count = 0 then 'Meta loaded but no advertiser page IDs were extractable; retained as PARTIAL for a later retry.'
    when jsonb_array_length(coalesce(p_blockers, '[]'::jsonb)) > 0 then left(p_blockers::text, 1500)
    else null
  end;

  update public.social_research_runs
  set status = outcome,
      advertisers_found = advertiser_count,
      candidates_created = created_count,
      candidates_updated = updated_count,
      queries_used = coalesce(p_query_stats, '[]'::jsonb),
      completed_at = now(),
      notes = note
  where id = p_run_id and status = 'RUNNING';

  if p_request_id is not null then
    update public.social_research_requests
    set status = outcome,
        completed_at = now(),
        result = jsonb_build_object(
          'advertisers_found', advertiser_count,
          'created', created_count,
          'updated', updated_count,
          'ads_observed', ad_count,
          'queries', coalesce(p_query_stats, '[]'::jsonb),
          'materialized', materialized,
          'blockers', coalesce(p_blockers, '[]'::jsonb),
          'worker', 'OIDC_PUBLIC_SOCIAL_DISCOVERY_V1'
        ),
        error_message = case when outcome = 'PARTIAL' then note else null end
    where id = p_request_id and status = 'RUNNING';
  end if;

  update public.automation_commands
  set status = 'SUCCEEDED',
      completed_at = now(),
      result = jsonb_build_object(
        'outcome', outcome,
        'advertisers_found', advertiser_count,
        'created', created_count,
        'updated', updated_count,
        'ads_observed', ad_count,
        'blockers', jsonb_array_length(coalesce(p_blockers, '[]'::jsonb)),
        'materialized', materialized,
        'worker', 'OIDC_PUBLIC_SOCIAL_DISCOVERY_V1'
      ),
      error_message = null,
      lease_expires_at = null,
      last_heartbeat_at = now()
  where id = p_command_id and command_type = 'SOCIAL_DISCOVERY' and status = 'RUNNING';

  return jsonb_build_object(
    'outcome', outcome,
    'advertisers_found', advertiser_count,
    'created', created_count,
    'updated', updated_count,
    'ads_observed', ad_count,
    'materialized', materialized
  );
end;
$$;

revoke all on function public.persist_social_discovery_results(bigint, bigint, bigint, jsonb, jsonb, jsonb) from public;
grant execute on function public.persist_social_discovery_results(bigint, bigint, bigint, jsonb, jsonb, jsonb) to service_role;

do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job
  from cron.job
  where jobname = 'digital-compass-social-discovery'
  limit 1;

  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;

  perform cron.schedule(
    'digital-compass-social-discovery',
    '59 5 * * *',
    $cron$select public.enqueue_system_automation_command('SOCIAL_DISCOVERY');$cron$
  );
end;
$$;
