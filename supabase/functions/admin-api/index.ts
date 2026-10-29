import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SECRET_KEYS = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || SECRET_KEYS["default"] || "";
const PUBLIC_KEY = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "sb_publishable_wu91lmCcA_VguNRZ8dxpsg_T8U5wD89";
const db = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;
const authClient = SUPABASE_URL && PUBLIC_KEY
  ? createClient(SUPABASE_URL, PUBLIC_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store"
};
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: cors }); }
function cleanText(v: unknown, max = 1000) { return String(v ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max); }
function int(v: unknown, fallback = 0) { const n = Number(v); return Number.isInteger(n) ? n : fallback; }
function limitValue(v: unknown, fallback = 50) { return Math.min(100, Math.max(1, int(v, fallback))); }
function bearer(req: Request) { return (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim(); }
function isOwner(profile: any) { return ["OWNER", "ADMIN"].includes(String(profile?.role || "").toUpperCase()); }
async function requireAdmin(req: Request) {
  if (!db || !authClient) throw { status: 503, error: "backend_not_configured" };
  const token = bearer(req);
  if (!token) throw { status: 401, error: "missing_session" };
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData?.user) throw { status: 401, error: "invalid_session" };
  const { data: profile, error } = await db.from("admin_users")
    .select("user_id,email,role,permissions,is_active,display_name,username")
    .eq("user_id", authData.user.id).maybeSingle();
  if (error) throw { status: 500, error: "admin_profile_lookup_failed" };
  if (!profile || profile.is_active !== true) throw { status: 403, error: "admin_access_required" };
  return { user: authData.user, profile };
}
async function countRows(table: string, apply?: (q: any) => any) {
  let q = db!.from(table).select("id", { count: "exact", head: true });
  if (apply) q = apply(q);
  const { count, error } = await q;
  if (error) throw new Error("count_failed:" + table);
  return Number(count || 0);
}
function today() { return new Date().toISOString().slice(0, 10); }
async function summary() {
  const d = today();
  const [companies,candidates,shortlists,audits,opportunities,prototypes,drafts,approved,recent] = await Promise.all([
    countRows("companies"),
    countRows("companies", q => q.eq("filter_status","UNREVIEWED")),
    countRows("lead_shortlists", q => q.eq("shortlist_date",d)),
    countRows("audits", q => q.eq("status","COMPLETED")),
    countRows("opportunities", q => q.eq("status","QUALIFIED")),
    countRows("prototype_sites", q => q.eq("generation_status","PUBLISHED")),
    countRows("outreach", q => q.in("status",["DRAFT","PENDING_APPROVAL"])),
    countRows("outreach", q => q.eq("approved_for_send",true)),
    db!.from("automation_commands").select("id,command_type,status,requested_at,started_at,completed_at,error_message,result,attempt_count").order("requested_at",{ascending:false}).limit(8)
  ]);
  if (recent.error) throw new Error("recent_commands_failed");
  return { metrics:{companies,candidates,shortlists,audits,opportunities,prototypes,drafts,approved}, recent_commands:recent.data||[], recent:recent.data||[] };
}
async function leads() {
  const { data, error } = await db!.from("lead_shortlists")
    .select("id,shortlist_date,company_id,country,selection_bucket,market_rank,global_rank,pre_audit_score,website_opportunity,recommended_next_step,status,opportunity_track,companies(id,name,country,city,sector,website_url,phone,whatsapp,general_email,contactable)")
    .order("shortlist_date",{ascending:false}).order("global_rank",{ascending:true,nullsFirst:false}).limit(200);
  if (error) throw new Error("leads_query_failed");
  return { items:data||[] };
}
async function prototypes() {
  const { data, error } = await db!.from("prototype_sites")
    .select("id,company_id,opportunity_id,prototype_level,slug,generation_status,public_url,generated_at,published_at,version,notes,brand_profile_id,brand_gate_status,visual_approval_status,visual_score,visual_approved_at,visual_approval_notes,quality_standard_version,companies(id,name,country,city,sector),opportunities(id,title,opportunity_type,status,priority)")
    .order("created_at",{ascending:false}).limit(200);
  if (error) throw new Error("prototypes_query_failed");
  return { items:data||[] };
}
async function outreach() {
  const { data, error } = await db!.from("outreach")
    .select("id,company_id,contact_id,opportunity_id,channel,direction,sequence_step,subject,message,status,scheduled_at,sent_at,replied_at,created_at,updated_at,language,recipient_address,personalization_reason,preview_url,approved_for_send,companies(id,name,country,city,sector),opportunities(id,title,opportunity_type,status)")
    .order("created_at",{ascending:false}).limit(200);
  if (error) throw new Error("outreach_query_failed");
  return { items:data||[] };
}
async function commands() {
  const { data, error } = await db!.from("automation_commands")
    .select("id,command_type,status,payload,requested_by,requested_at,started_at,completed_at,result,error_message,attempt_count,max_attempts,lease_expires_at,last_heartbeat_at")
    .order("requested_at",{ascending:false}).limit(200);
  if (error) throw new Error("commands_query_failed");
  return { items:data||[] };
}
async function settings() {
  const { data, error } = await db!.from("app_settings").select("setting_key,setting_value,description,updated_at,updated_by").order("setting_key");
  if (error) throw new Error("settings_query_failed");
  const existing = new Set((data||[]).map((x:any)=>x.setting_key));
  const defaults = [
    {setting_key:"markets",setting_value:["Iraq"],description:"Markets used by discovery."},
    {setting_key:"daily_shortlist",setting_value:{total:100,no_website:70,has_website:30,country_min_no_website:50,country_min_has_website:20},description:"Daily shortlist targets."},
    {setting_key:"scoring",setting_value:{no_website_bonus:20},description:"Lead scoring controls."},
    {setting_key:"prototype_thresholds",setting_value:{none_below:35,audit_only_min:45,preview_min:60,prototype_min:75},description:"Prototype qualification thresholds."},
    {setting_key:"outreach",setting_value:{sending_enabled:false,requires_owner_approval:true,stop_on_opt_out:true},description:"Outreach safety controls."}
  ];
  return { items:[...(data||[]),...defaults.filter(x=>!existing.has(x.setting_key))] };
}
async function metricDetail(key: string, limit: number) {
  const map: Record<string,{table:string,select:string,apply?:(q:any)=>any}> = {
    companies:{table:"companies",select:"id,name,country,city,sector,website_url,status,filter_status,lead_score,contactable"},
    candidates:{table:"companies",select:"id,name,country,city,sector,website_url,status,filter_status,lead_score,contactable",apply:q=>q.eq("filter_status","UNREVIEWED")},
    shortlists:{table:"lead_shortlists",select:"id,shortlist_date,company_id,country,selection_bucket,global_rank,pre_audit_score,status,opportunity_track,companies(name,city,sector)",apply:q=>q.order("shortlist_date",{ascending:false})},
    audits:{table:"audits",select:"id,company_id,shortlist_date,audit_type,status,audited_url,audit_score,finished_at,error_message,companies(name,city,sector)",apply:q=>q.eq("status","COMPLETED")},
    opportunities:{table:"opportunities",select:"id,company_id,opportunity_type,title,status,priority,opportunity_score,prototype_level,recommended_offer,estimated_price_min,estimated_price_max,currency,companies(name,city,sector)",apply:q=>q.eq("status","QUALIFIED")},
    prototypes:{table:"prototype_sites",select:"id,company_id,prototype_level,generation_status,public_url,version,brand_gate_status,visual_approval_status,visual_score,companies(name,city,sector)",apply:q=>q.eq("generation_status","PUBLISHED")},
    drafts:{table:"outreach",select:"id,company_id,channel,recipient_address,subject,status,approved_for_send,created_at,companies(name,city,sector)",apply:q=>q.in("status",["DRAFT","PENDING_APPROVAL"])},
    approved:{table:"outreach",select:"id,company_id,channel,recipient_address,subject,status,approved_for_send,created_at,companies(name,city,sector)",apply:q=>q.eq("approved_for_send",true)}
  };
  const m=map[key]; if(!m) throw {status:400,error:"invalid_metric"};
  let q=db!.from(m.table).select(m.select);
  if(m.apply) q=m.apply(q);
  if(key==="shortlists") q=q.order("global_rank",{ascending:true,nullsFirst:false});
  else q=q.order("id",{ascending:false});
  const {data,error}=await q.limit(limit);
  if(error) throw new Error("metric_detail_failed");
  return {items:data||[]};
}
async function leadDetail(id: number) {
  if(!Number.isInteger(id)||id<1) throw {status:400,error:"invalid_lead_id"};
  const [{data:company,error:ce},{data:opps,error:oe},{data:auditsData,error:ae},{data:protoData,error:pe},{data:outreachData,error:re}] = await Promise.all([
    db!.from("companies").select("id,name,country,city,sector,description,website_url,has_website,instagram_url,facebook_url,linkedin_url,google_maps_url,phone,whatsapp,general_email,contactable,status,filter_status,lead_score,lead_tier,notes").eq("id",id).maybeSingle(),
    db!.from("opportunities").select("id,company_id,opportunity_type,title,problem,evidence,evidence_url,business_impact,proposed_solution,recommended_offer,opportunity_score,priority,prototype_level,estimated_price_min,estimated_price_max,currency,status,source_audit_id,source_shortlist_date,qualification_reason,recommended_next_action,chain_risk").eq("company_id",id).order("opportunity_score",{ascending:false}),
    db!.from("audits").select("id,company_id,shortlist_date,audit_type,audited_url,status,http_status,page_title,meta_description,has_ssl,has_mobile_viewport,has_clear_cta,has_contact_form,has_whatsapp,has_phone_link,has_email_link,has_booking,has_social_proof,social_channels_count,audit_score,findings,error_message,started_at,finished_at").eq("company_id",id).order("created_at",{ascending:false}).limit(30),
    db!.from("prototype_sites").select("id,company_id,opportunity_id,prototype_level,slug,generation_status,public_url,generated_at,published_at,version,notes,brand_gate_status,visual_approval_status,visual_score,visual_approved_at,visual_approval_notes,quality_standard_version").eq("company_id",id).order("created_at",{ascending:false}).limit(30),
    db!.from("outreach").select("id,company_id,opportunity_id,channel,direction,sequence_step,subject,message,status,scheduled_at,sent_at,replied_at,created_at,language,recipient_address,personalization_reason,approved_for_send").eq("company_id",id).order("created_at",{ascending:false}).limit(30)
  ]);
  if(ce||!company) throw {status:404,error:"lead_not_found"};
  if(oe||ae||pe||re) throw new Error("lead_detail_query_failed");
  return {company,opportunities:opps||[],audits:auditsData||[],prototypes:protoData||[],outreach:outreachData||[]};
}
async function handle(req: Request) {
  const {user,profile}=await requireAdmin(req);
  const url=new URL(req.url);
  const action=cleanText(url.searchParams.get("action"),80);
  const method=req.method.toUpperCase();
  const body=method==="POST" ? await req.json().catch(()=>({})) : {};
  const writable=["command","cancel_command","update_opportunity_offer","approve_outreach","update_outreach","update_setting","approve_prototype"];
  if(writable.includes(action)&&!isOwner(profile)) throw {status:403,error:"owner_or_admin_required"};
  if(action==="current_user"||action==="current") return {user:{id:user.id,email:user.email,role:profile.role,permissions:profile.permissions,display_name:profile.display_name||profile.username||user.email}};
  if(method==="GET"){
    if(action==="summary") return await summary();
    if(action==="leads") return await leads();
    if(action==="prototypes") return await prototypes();
    if(action==="outreach") return await outreach();
    if(action==="commands") return await commands();
    if(action==="settings") return await settings();
    if(action==="metric_detail") return await metricDetail(cleanText(url.searchParams.get("key"),60),limitValue(url.searchParams.get("limit"),50));
    if(action==="lead_detail") return await leadDetail(int(url.searchParams.get("id")));
    throw {status:400,error:"unsupported_action"};
  }
  if(method!=="POST") throw {status:405,error:"method_not_allowed"};
  if(action==="command"){
    const requestedType=cleanText(body.command_type,60).toUpperCase();
    const allowed=new Set(["DISCOVERY","SHORTLIST","AUDIT","QUALIFY","BRAND_PREP","PROTOTYPES","OUTREACH_DRAFTS","FULL_PIPELINE","PROTOTYPE_RESEARCH","PROTOTYPE_QA"]);
    if(!allowed.has(requestedType)) throw {status:400,error:"invalid_command_type"};
    const type=requestedType==="FULL_PIPELINE"?"DISCOVERY":requestedType;
    const {data:existing,error:ee}=await db!.from("automation_commands").select("id,status").eq("command_type",type).in("status",["QUEUED","RUNNING"]).limit(1);
    if(ee) throw new Error("command_check_failed");
    if(existing?.length) throw {status:409,error:"already_pending"};
    const payload={requested_from:"website_admin",requested_pipeline:requestedType,requested_stage:requestedType===type?null:requestedType};
    const {data,error}=await db!.from("automation_commands").insert({command_type:type,status:"QUEUED",payload,requested_by:user.id}).select("id,command_type,status,requested_at").single();
    if(error) throw new Error("command_queue_failed");
    return {ok:true,requested_type:requestedType,command:data};
  }
  if(action==="cancel_command"){
    const id=int(body.id);
    const {data,error}=await db!.from("automation_commands").update({status:"CANCELLED",completed_at:new Date().toISOString(),error_message:"Cancelled by administrator",lease_expires_at:null}).eq("id",id).eq("status","QUEUED").select("id,status").maybeSingle();
    if(error) throw new Error("cancel_failed");
    if(!data) throw {status:409,error:"command_not_queued"};
    return {ok:true,command:data};
  }
  if(action==="update_opportunity_offer"){
    const id=int(body.id), min=body.estimated_price_min==null||body.estimated_price_min===""?null:Number(body.estimated_price_min), max=body.estimated_price_max==null||body.estimated_price_max===""?null:Number(body.estimated_price_max);
    if(!Number.isInteger(id)||id<1||[min,max].some(v=>v!==null&&(!Number.isFinite(v)||v<0))||(min!==null&&max!==null&&min>max)) throw {status:400,error:"invalid_pricing"};
    const patch={recommended_offer:cleanText(body.recommended_offer,500),estimated_price_min:min,estimated_price_max:max,currency:cleanText(body.currency||"USD",3).toUpperCase()||"USD",updated_at:new Date().toISOString()};
    const {data,error}=await db!.from("opportunities").update(patch).eq("id",id).select("id,recommended_offer,estimated_price_min,estimated_price_max,currency").maybeSingle();
    if(error) throw new Error("pricing_update_failed");
    if(!data) throw {status:404,error:"opportunity_not_found"};
    return {ok:true,opportunity:data};
  }
  if(action==="approve_prototype"){
    const id=int(body.id), approved=body.approved===true, score=int(body.visual_score);
    if(!Number.isInteger(id)||id<1) throw {status:400,error:"invalid_prototype_id"};
    if(approved && (body.reviewed_desktop_mobile!==true||score<9||score>10)) throw {status:400,error:"visual_review_required"};
    const {data:site,error:se}=await db!.from("prototype_sites").select("id,generation_status,brand_gate_status").eq("id",id).maybeSingle();
    if(se||!site) throw {status:404,error:"prototype_not_found"};
    if(approved){
      if(site.generation_status!=="PUBLISHED"||!["READY","PROPOSED_ONLY"].includes(site.brand_gate_status)) throw {status:409,error:"prototype_not_ready"};
      const {data:qa,error:qe}=await db!.from("prototype_qa_runs").select("id,status,desktop_result,mobile_result,errors").eq("prototype_site_id",id).eq("status","PASSED").order("completed_at",{ascending:false}).limit(1).maybeSingle();
      if(qe||!qa) throw {status:409,error:"prototype_qa_required"};
      if(Array.isArray(qa.errors)&&qa.errors.length>0) throw {status:409,error:"prototype_qa_has_errors"};
    }
    const patch=approved?{visual_approval_status:"APPROVED",visual_score:score,visual_approved_at:new Date().toISOString(),visual_approval_notes:cleanText(body.notes||"Reviewed by owner after desktop/mobile QA.",1000),updated_at:new Date().toISOString()}:{visual_approval_status:"PENDING",visual_score:null,visual_approved_at:null,visual_approval_notes:cleanText(body.notes||"",1000),updated_at:new Date().toISOString()};
    const {data,error}=await db!.from("prototype_sites").update(patch).eq("id",id).select("id,visual_approval_status,visual_score,visual_approved_at").single();
    if(error) throw new Error("prototype_approval_update_failed");
    return {ok:true,prototype:data};
  }
  if(action==="approve_outreach"){
    const id=int(body.id), approved=body.approved===true;
    if(!Number.isInteger(id)||id<1) throw {status:400,error:"invalid_outreach_id"};
    if(approved){
      const {data:ready,error:ge}=await db!.rpc("is_outreach_sales_ready",{p_outreach_id:id});
      if(ge) throw new Error("outreach_gate_check_failed");
      if(ready!==true) throw {status:409,error:"approval_gate_not_passed"};
    }
    const {data,error}=await db!.from("outreach").update({approved_for_send:approved,status:approved?"PENDING_APPROVAL":"DRAFT",updated_at:new Date().toISOString()}).eq("id",id).in("status",["DRAFT","PENDING_APPROVAL","QUEUED"]).select("id,status,approved_for_send").maybeSingle();
    if(error) throw new Error("outreach_approval_update_failed");
    if(!data) throw {status:409,error:"outreach_not_editable"};
    return {ok:true,outreach:data};
  }
  if(action==="update_outreach"){
    const id=int(body.id);
    if(!Number.isInteger(id)||id<1) throw {status:400,error:"invalid_outreach_id"};
    const patch={recipient_address:cleanText(body.recipient_address,320),subject:cleanText(body.subject,500),message:cleanText(body.message,6000),channel:cleanText(body.channel,40).toUpperCase(),language:cleanText(body.language,12).toLowerCase(),approved_for_send:false,status:"DRAFT",updated_at:new Date().toISOString()};
    const {data,error}=await db!.from("outreach").update(patch).eq("id",id).in("status",["DRAFT","PENDING_APPROVAL","QUEUED"]).select("id,status,approved_for_send").maybeSingle();
    if(error) throw new Error("outreach_update_failed");
    if(!data) throw {status:409,error:"outreach_not_editable"};
    return {ok:true,outreach:data};
  }
  if(action==="update_setting"){
    const key=cleanText(body.key,80), value=body.value;
    const allowed=new Set(["markets","daily_shortlist","scoring","prototype_thresholds","outreach"]);
    if(!allowed.has(key)||value===undefined) throw {status:400,error:"invalid_setting"};
    if(key==="markets"&&(!Array.isArray(value)||value.length<1||value.length>20||value.some((x:any)=>typeof x!=="string"||x.trim().length>80))) throw {status:400,error:"invalid_markets"};
    if(key==="outreach"&&(!value||typeof value!=="object"||Array.isArray(value))) throw {status:400,error:"invalid_outreach_setting"};
    if(["daily_shortlist","scoring","prototype_thresholds"].includes(key)&&(!value||typeof value!=="object"||Array.isArray(value))) throw {status:400,error:"invalid_setting_value"};
    if(key==="outreach") value.requires_owner_approval=true;
    const {data,error}=await db!.from("app_settings").upsert({setting_key:key,setting_value:value,updated_at:new Date().toISOString(),updated_by:user.id},{onConflict:"setting_key"}).select("setting_key,setting_value,updated_at").single();
    if(error) throw new Error("setting_update_failed");
    return {ok:true,setting:data};
  }
  throw {status:400,error:"unsupported_action"};
}

Deno.serve(async (req: Request) => {
  if(req.method==="OPTIONS") return new Response(null,{status:204,headers:cors});
  try { return json(await handle(req)); }
  catch(e:any) { const status=Number(e?.status)||500; return json({error:cleanText(e?.error||e?.message||"internal_error",240)},status); }
});
