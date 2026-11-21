create or replace function public.claim_social_discovery_audits(p_limit integer default 30)
returns setof public.social_discovery_candidates language plpgsql security definer set search_path='public','pg_temp'
as $$
begin
 update public.social_discovery_candidates set audit_status='PENDING',updated_at=now()
 where audit_status='RUNNING' and updated_at < now()-interval '45 minutes';
 update public.social_discovery_candidates set audit_status='PENDING',updated_at=now()
 where audit_status='NEEDS_REVIEW' and coalesce(audit_evidence->>'audit_version','') <> '2';
 return query with picked as (
  select id from public.social_discovery_candidates where audit_status='PENDING' and profile_url is not null
  order by active_ads_count desc,last_seen_at desc,id for update skip locked
  limit greatest(1,least(coalesce(p_limit,30),50))
 ) update public.social_discovery_candidates c set audit_status='RUNNING',updated_at=now()
 from picked where c.id=picked.id returning c.*;
end;
$$;