alter table public.social_discovery_candidates
 add column if not exists profile_completeness_score numeric,
 add column if not exists posting_consistency_score numeric,
 add column if not exists content_quality_score numeric,
 add column if not exists engagement_health_score numeric,
 add column if not exists conversion_path_score numeric,
 add column if not exists response_readiness_score numeric,
 add column if not exists followers_count bigint,
 add column if not exists posts_per_month numeric,
 add column if not exists engagement_rate numeric,
 add column if not exists audit_summary text,
 add column if not exists strengths text[] not null default '{}',
 add column if not exists weaknesses text[] not null default '{}',
 add column if not exists recommended_services text[] not null default '{}',
 add column if not exists audit_evidence jsonb not null default '{}'::jsonb,
 add column if not exists audited_at timestamptz;
create index if not exists social_discovery_audit_queue_idx on public.social_discovery_candidates(audit_status,last_seen_at desc);
create or replace function public.claim_social_discovery_audits(p_limit integer default 30)
returns setof public.social_discovery_candidates language plpgsql security definer set search_path='public','pg_temp'
as $$ begin return query with picked as (select id from public.social_discovery_candidates where audit_status='PENDING' and profile_url is not null order by active_ads_count desc,last_seen_at desc,id for update skip locked limit greatest(1,least(coalesce(p_limit,30),50))) update public.social_discovery_candidates c set audit_status='RUNNING',updated_at=now() from picked where c.id=picked.id returning c.*; end; $$;
revoke all on function public.claim_social_discovery_audits(integer) from public;
grant execute on function public.claim_social_discovery_audits(integer) to service_role;