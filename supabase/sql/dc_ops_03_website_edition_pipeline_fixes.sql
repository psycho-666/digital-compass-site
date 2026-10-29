
-- Website Edition backend hardening and pipeline compatibility.
-- This file records the SQL applied to the dedicated Website Edition project.

DROP INDEX IF EXISTS public.opportunities_company_type_offer_unique;
CREATE UNIQUE INDEX IF NOT EXISTS opportunities_company_type_offer_active_unique
  ON public.opportunities (company_id, opportunity_type, (coalesce(recommended_offer,'')))
  WHERE status IN ('QUALIFIED','NEW','OPEN','DRAFT');
CREATE UNIQUE INDEX IF NOT EXISTS prototype_research_requests_opportunity_type_unique
  ON public.prototype_research_requests (opportunity_id,research_type);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='social_budget_envelopes_workspace_id_fkey') THEN
    ALTER TABLE public.social_budget_envelopes ADD CONSTRAINT social_budget_envelopes_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.social_management_workspaces(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='social_budget_envelopes_ad_account_id_fkey') THEN
    ALTER TABLE public.social_budget_envelopes ADD CONSTRAINT social_budget_envelopes_ad_account_id_fkey FOREIGN KEY (ad_account_id) REFERENCES public.social_ad_accounts(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='social_budget_allocations_workspace_id_fkey') THEN
    ALTER TABLE public.social_budget_allocations ADD CONSTRAINT social_budget_allocations_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.social_management_workspaces(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='social_budget_allocations_content_item_id_fkey') THEN
    ALTER TABLE public.social_budget_allocations ADD CONSTRAINT social_budget_allocations_content_item_id_fkey FOREIGN KEY (content_item_id) REFERENCES public.social_content_items(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='social_budget_allocations_campaign_id_fkey') THEN
    ALTER TABLE public.social_budget_allocations ADD CONSTRAINT social_budget_allocations_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.social_ad_campaigns(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='social_budget_allocations_envelope_id_fkey') THEN
    ALTER TABLE public.social_budget_allocations ADD CONSTRAINT social_budget_allocations_envelope_id_fkey FOREIGN KEY (envelope_id) REFERENCES public.social_budget_envelopes(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.seed_social_workspace_defaults()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.social_response_policies(workspace_id) values(new.id) on conflict do nothing;
  insert into public.social_ad_guardrails(workspace_id,currency) values(new.id,null) on conflict do nothing;
  return new;
end;
$function$
;

DROP TRIGGER IF EXISTS "trg_apply_approval_resolution" ON public."approval_requests";
CREATE TRIGGER trg_apply_approval_resolution AFTER UPDATE OF status ON public.approval_requests FOR EACH ROW EXECUTE FUNCTION apply_approval_resolution();

DROP TRIGGER IF EXISTS "trg_guard_social_ad_company_country" ON public."companies";
CREATE TRIGGER trg_guard_social_ad_company_country BEFORE INSERT OR UPDATE OF country, source_type ON public.companies FOR EACH ROW EXECUTE FUNCTION guard_social_ad_company_country();

DROP TRIGGER IF EXISTS "trg_calculate_social_audit_scores" ON public."social_audits";
CREATE TRIGGER trg_calculate_social_audit_scores BEFORE INSERT OR UPDATE OF status, profile_completeness_score, posting_consistency_score, content_quality_score, brand_consistency_score, engagement_health_score, conversion_path_score, local_relevance_score, response_readiness_score, evidence, has_recent_activity, has_public_ad_activity ON public.social_audits FOR EACH ROW EXECUTE FUNCTION calculate_social_audit_scores();

DROP TRIGGER IF EXISTS "trg_enqueue_social_research_on_review" ON public."social_audits";
CREATE TRIGGER trg_enqueue_social_research_on_review AFTER UPDATE OF status, updated_at ON public.social_audits FOR EACH ROW EXECUTE FUNCTION enqueue_social_research_on_review();

DROP TRIGGER IF EXISTS "trg_social_content_approval" ON public."social_content_items";
CREATE TRIGGER trg_social_content_approval AFTER INSERT OR UPDATE OF approval_status ON public.social_content_items FOR EACH ROW EXECUTE FUNCTION ensure_social_content_approval_notification();

DROP TRIGGER IF EXISTS "trg_guard_social_candidate_iraq_locality" ON public."social_discovery_candidates";
CREATE TRIGGER trg_guard_social_candidate_iraq_locality BEFORE INSERT OR UPDATE OF market_relevance_status, business_country_hint, local_relevance_evidence, advertiser_name, page_name ON public.social_discovery_candidates FOR EACH ROW EXECUTE FUNCTION guard_social_candidate_iraq_locality();

DROP TRIGGER IF EXISTS "trg_reconcile_social_market_relevance" ON public."social_discovery_candidates";
CREATE TRIGGER trg_reconcile_social_market_relevance AFTER INSERT OR UPDATE OF market_relevance_status, business_country_hint, social_profile_id ON public.social_discovery_candidates FOR EACH ROW EXECUTE FUNCTION reconcile_social_market_relevance();

DROP TRIGGER IF EXISTS "trg_sync_public_ad_observation_links" ON public."social_discovery_candidates";
CREATE TRIGGER trg_sync_public_ad_observation_links AFTER INSERT OR UPDATE OF company_id, social_profile_id ON public.social_discovery_candidates FOR EACH ROW EXECUTE FUNCTION sync_public_ad_observation_links();

DROP TRIGGER IF EXISTS "trg_sync_social_candidate_relevance_to_company" ON public."social_discovery_candidates";
CREATE TRIGGER trg_sync_social_candidate_relevance_to_company AFTER INSERT OR UPDATE OF market_relevance_status, business_country_hint, city_hint, sector_hint, company_id ON public.social_discovery_candidates FOR EACH ROW EXECUTE FUNCTION sync_social_candidate_relevance_to_company();

DROP TRIGGER IF EXISTS "trg_seed_social_workspace_defaults" ON public."social_management_workspaces";
CREATE TRIGGER trg_seed_social_workspace_defaults AFTER INSERT ON public.social_management_workspaces FOR EACH ROW EXECUTE FUNCTION seed_social_workspace_defaults();

DROP TRIGGER IF EXISTS "trg_queue_social_browser_worker" ON public."social_research_requests";
CREATE TRIGGER trg_queue_social_browser_worker AFTER INSERT ON public.social_research_requests FOR EACH ROW EXECUTE FUNCTION queue_social_browser_worker();

CREATE OR REPLACE VIEW public.social_management_inbox_view
WITH (security_invoker=true) AS
SELECT i.id,i.workspace_id,i.platform,i.external_thread_id,i.sender_name,i.sender_external_id,
 i.message_text,i.message_type,i.received_at,i.sentiment,i.intent,i.lead_signal,i.priority,
 i.response_draft,i.response_status,i.requires_human,i.escalation_reason,i.created_at,i.updated_at,
 i.external_message_id,i.external_parent_id,i.external_post_id,i.reply_external_id,i.conversation_context,
 i.response_method,i.response_confidence,i.response_sent_at,d.id AS decision_id,d.chosen_method,
 d.confidence AS decision_confidence,d.status AS decision_status,d.approval_request_id
FROM public.social_inbox_items i
LEFT JOIN LATERAL (
 SELECT x.id,x.chosen_method,x.confidence,x.status,x.approval_request_id
 FROM public.social_response_decisions x
 WHERE x.inbox_item_id=i.id
 ORDER BY x.created_at DESC,x.id DESC
 LIMIT 1
) d ON true;
REVOKE ALL PRIVILEGES ON public.social_management_inbox_view FROM anon,authenticated;
GRANT SELECT ON public.social_management_inbox_view TO service_role;

CREATE OR REPLACE FUNCTION public.social_ad_action_approval_gate()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF NEW.status IN ('APPROVED','QUEUED','RUNNING','EXECUTING','ACTIVE','COMPLETED') THEN
    RAISE EXCEPTION 'Paid advertising execution is disabled until Website Edition owner authorization and Meta credentials are configured';
  END IF;
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS trg_website_disable_social_ad_actions ON public.social_ad_actions;
CREATE TRIGGER trg_website_disable_social_ad_actions BEFORE INSERT OR UPDATE OF status ON public.social_ad_actions
FOR EACH ROW EXECUTE FUNCTION public.social_ad_action_approval_gate();

CREATE OR REPLACE FUNCTION public.social_publish_status_gate()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF NEW.status IN ('SCHEDULED','QUEUED','RUNNING','PUBLISHING','PUBLISHED') THEN
    RAISE EXCEPTION 'Public social publishing is disabled until Website Edition OAuth and explicit owner authorization are configured';
  END IF;
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS trg_website_disable_social_publish_jobs ON public.social_publish_jobs;
CREATE TRIGGER trg_website_disable_social_publish_jobs BEFORE INSERT OR UPDATE OF status ON public.social_publish_jobs
FOR EACH ROW EXECUTE FUNCTION public.social_publish_status_gate();

CREATE OR REPLACE FUNCTION public.guard_website_social_budget_activation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF coalesce(NEW.auto_spend_enabled,false) THEN
    RAISE EXCEPTION 'Automatic ad spend is disabled until explicit Website Edition owner authorization';
  END IF;
  IF NEW.status='ACTIVE' THEN
    RAISE EXCEPTION 'Budget envelope activation is disabled until explicit Website Edition owner authorization';
  END IF;
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS trg_website_disable_social_budget_activation ON public.social_budget_envelopes;
CREATE TRIGGER trg_website_disable_social_budget_activation BEFORE INSERT OR UPDATE OF status,auto_spend_enabled ON public.social_budget_envelopes
FOR EACH ROW EXECUTE FUNCTION public.guard_website_social_budget_activation();

CREATE OR REPLACE FUNCTION public.guard_website_social_campaign_execution()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF NEW.status IN ('APPROVED','SCHEDULED','ACTIVE','RUNNING','EXECUTING','COMPLETED') THEN
    RAISE EXCEPTION 'Paid campaign execution is disabled until explicit Website Edition owner authorization';
  END IF;
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS trg_website_disable_social_campaign_execution ON public.social_ad_campaigns;
CREATE TRIGGER trg_website_disable_social_campaign_execution BEFORE INSERT OR UPDATE OF status ON public.social_ad_campaigns
FOR EACH ROW EXECUTE FUNCTION public.guard_website_social_campaign_execution();

CREATE OR REPLACE FUNCTION public.refresh_prototype_sites()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_inserted integer := 0;
BEGIN
  WITH candidates AS (
    SELECT
      c.id AS company_id,
      o.id AS opportunity_id,
      o.prototype_level,
      cbp.id AS brand_profile_id,
      'p-' || substr(md5(random()::text || clock_timestamp()::text || o.id::text), 1, 24) AS slug,
      coalesce((SELECT max(ps2.version) + 1 FROM public.prototype_sites ps2
                WHERE ps2.company_id=c.id AND ps2.opportunity_id=o.id), 1) AS next_version
    FROM public.opportunities o
    JOIN public.companies c ON c.id=o.company_id
    JOIN LATERAL (
      SELECT pc.*
      FROM public.prototype_context pc
      WHERE pc.company_id=c.id AND pc.opportunity_id=o.id
        AND pc.validation_status='VALIDATED'
        AND jsonb_array_length(coalesce(pc.source_urls,'[]'::jsonb)) > 0
      ORDER BY pc.updated_at DESC, pc.id DESC
      LIMIT 1
    ) pc ON true
    JOIN LATERAL (
      SELECT b.*
      FROM public.client_brand_profiles b
      WHERE b.company_id=c.id AND b.opportunity_id=o.id
        AND b.brand_status IN ('PROPOSED','INFERRED','VALIDATED')
        AND coalesce(b.confidence_score,0) >= 60
      ORDER BY b.updated_at DESC, b.id DESC
      LIMIT 1
    ) cbp ON true
    WHERE o.status='QUALIFIED'
      AND o.prototype_level IN ('PREVIEW','PROTOTYPE')
      AND coalesce(o.chain_risk,false)=false
      AND c.country='Iraq'
      AND c.contactable=true
      AND (
        SELECT count(DISTINCT dr.reference_url)
        FROM public.design_reference_research dr
        WHERE dr.company_id=c.id AND dr.opportunity_id=o.id
          AND dr.reference_url ~* '^https?://'
      ) >= CASE WHEN o.prototype_level='PROTOTYPE' THEN 3 ELSE 2 END
      AND NOT EXISTS (
        SELECT 1 FROM public.prototype_sites ps
        WHERE ps.company_id=c.id AND ps.opportunity_id=o.id
          AND ps.generation_status IN ('QA_PENDING','PUBLISHED')
          AND ps.brand_gate_status IN ('READY','PROPOSED_ONLY')
      )
  )
  INSERT INTO public.prototype_sites (
    company_id, opportunity_id, prototype_level, slug, generation_status,
    public_url, generated_at, version, notes, brand_profile_id,
    brand_gate_status, visual_approval_status, quality_standard_version,
    created_at, updated_at
  )
  SELECT
    company_id, opportunity_id, prototype_level, slug, 'QA_PENDING',
    NULL, now(), next_version,
    'Concept preview queued for browser QA; no public URL until QA passes.',
    brand_profile_id,
    CASE
      WHEN brand_profile_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.client_brand_profiles b
        WHERE b.id = brand_profile_id AND b.brand_status IN ('VALIDATED','INFERRED')
          AND coalesce(b.confidence_score,0) >= 70
      ) THEN 'READY'
      WHEN brand_profile_id IS NOT NULL THEN 'PROPOSED_ONLY'
      ELSE 'PENDING'
    END,
    'PENDING', '2026-10-29', now(), now()
  FROM candidates;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.refresh_prototype_brand_gate(p_date date DEFAULT CURRENT_DATE)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare n integer;
begin
  update public.prototype_sites ps
  set brand_profile_id = cbp.id,
      brand_gate_status = case
        when cbp.brand_status in ('VALIDATED','INFERRED') and coalesce(cbp.confidence_score,0) >= 70 then 'READY'
        when cbp.brand_status = 'PROPOSED' and coalesce(cbp.confidence_score,0) >= 60 then 'PROPOSED_ONLY'
        when cbp.brand_status = 'INSUFFICIENT_DATA' then 'BLOCKED'
        else 'PENDING'
      end,
      generation_status = case
        when cbp.brand_status in ('VALIDATED','INFERRED') and coalesce(cbp.confidence_score,0) >= 70 then ps.generation_status
        when cbp.brand_status = 'PROPOSED' and coalesce(cbp.confidence_score,0) >= 60 then ps.generation_status
        else 'NEEDS_BRAND_REVIEW'
      end,
      updated_at = now()
  from public.client_brand_profiles cbp
  join public.opportunities o on o.id = cbp.opportunity_id
  where ps.company_id = cbp.company_id
    and ps.opportunity_id = cbp.opportunity_id
    and o.source_shortlist_date = p_date;

  get diagnostics n = row_count;
  return n;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.is_outreach_sales_ready(p_outreach_id bigint)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.outreach x
    join public.opportunities o on o.id=x.opportunity_id
    join public.companies c on c.id=x.company_id
    where x.id=p_outreach_id
      and x.direction='OUTBOUND'
      and x.sequence_step=1
      and x.status in ('DRAFT','PENDING_APPROVAL','QUEUED')
      and o.status='QUALIFIED'
      and o.priority in ('VERY_HOT','HOT')
      and not coalesce(o.chain_risk,false)
      and not coalesce(o.requires_social_validation,false)
      and c.country='Iraq'
      and c.contactable=true
      and (
        (x.channel='EMAIL' and public.is_safe_outreach_email(x.recipient_address))
        or (x.channel in ('INSTAGRAM','FACEBOOK','LINKEDIN') and coalesce(x.recipient_address,'') ~* '^https?://')
        or (x.channel='WHATSAPP' and nullif(trim(coalesce(x.recipient_address,'')),'') is not null)
      )
      and length(trim(coalesce(x.message,'')))>=180
      and lower(coalesce(x.message,'')) !~ '(lorem ipsum|todo|placeholder|example\.com)'
      and exists (
        select 1 from public.prototype_context pc
        where pc.opportunity_id=o.id and pc.company_id=c.id and pc.validation_status='VALIDATED'
          and jsonb_array_length(coalesce(pc.source_urls,'[]'::jsonb))>0
      )
      and exists (
        select 1 from public.prototype_sites ps
        where ps.opportunity_id=o.id
          and ps.company_id=c.id
          and ps.generation_status='PUBLISHED'
          and ps.brand_gate_status='READY'
          and nullif(trim(coalesce(ps.public_url,'')),'') is not null
          and ps.visual_approval_status='APPROVED'
          and coalesce(ps.visual_score,0)>=9
          and exists (
            select 1 from public.prototype_qa_runs q
            where q.prototype_site_id=ps.id
              and q.status='PASSED'
              and coalesce(jsonb_array_length(coalesce(q.desktop_result->'errors','[]'::jsonb)),0)=0
              and coalesce(jsonb_array_length(coalesce(q.mobile_result->'errors','[]'::jsonb)),0)=0
          )
      )
      and not exists (
        select 1 from public.outreach z
        where z.id<>x.id
          and z.company_id=x.company_id
          and z.opportunity_id=x.opportunity_id
          and z.direction='OUTBOUND'
          and z.sequence_step=x.sequence_step
          and z.status in ('DRAFT','PENDING_APPROVAL','QUEUED','SENT','REPLIED')
      )
  );
$function$
;
