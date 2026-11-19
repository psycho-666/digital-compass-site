const PROJECT_URL=Deno.env.get('SUPABASE_URL')!;
const SECRET_KEYS=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}');
const SECRET_KEY=SECRET_KEYS['default'];
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'apikey, authorization, content-type','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Cache-Control':'no-store'};
function json(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json; charset=utf-8','X-Robots-Tag':'noindex, nofollow, noarchive'}})}
function jwtSub(req:Request){try{const raw=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');const p=raw.split('.')[1];if(!p)return'';const s=p.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(p.length/4)*4,'=');return String(JSON.parse(atob(s)).sub||'')}catch{return''}}
async function rest(path:string,init:RequestInit={}){const h=new Headers(init.headers||{});h.set('apikey',SECRET_KEY);h.set('Authorization',`Bearer ${SECRET_KEY}`);if(init.body)h.set('Content-Type','application/json');const r=await fetch(`${PROJECT_URL}/rest/v1/${path}`,{...init,headers:h});if(!r.ok){const t=await r.text();console.error(path,r.status,t);throw new Error(`${path}:${r.status}`)}return r}
async function rows(path:string){return await (await rest(path)).json()}
async function rpc(name:string,body:unknown={}){return await (await rest(`rpc/${name}`,{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(body)})).json()}
async function adminProfile(uid:string){const xs=uid?await rows(`admin_users?user_id=eq.${encodeURIComponent(uid)}&select=user_id,role,permissions,is_active&limit=1`):[];return xs[0]||null}
function perms(p:any){return Array.isArray(p?.permissions)?p.permissions.map(String):[]}
function has(p:any,key:string){return !!p&&p.is_active===true&&(p.role==='OWNER'||perms(p).includes('*')||perms(p).includes(key))}
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 const uid=jwtSub(req),me=await adminProfile(uid);if(!me||me.is_active!==true)return json({error:'forbidden'},403);
 if(req.method==='GET'&&!has(me,'social_management.view')&&!has(me,'social_management.manage'))return json({error:'permission_denied'},403);
 if(req.method==='POST'&&!has(me,'social_management.manage'))return json({error:'permission_denied'},403);
 try{
  const u=new URL(req.url),action=u.searchParams.get('action')||'workspaces';
  if(req.method==='GET'&&action==='workspaces')return json({items:await rows('social_client_management_summary?select=*&order=updated_at.desc')});
  if(req.method==='GET'&&action==='workspace'){
   const id=Number(u.searchParams.get('id'));if(!Number.isFinite(id))return json({error:'invalid_workspace'},400);
   const [summary,workspace,connections,inbox,faq,library,content,design,publish,campaigns,audiences,adActions,guardrails,policy,ops,jobs,envelopes,allocations,reports]=await Promise.all([
    rows(`social_client_management_summary?workspace_id=eq.${id}&select=*&limit=1`),rows(`social_management_workspaces?id=eq.${id}&select=*&limit=1`),rows(`social_account_connections?workspace_id=eq.${id}&select=*&order=platform.asc`),rows(`social_management_inbox_view?workspace_id=eq.${id}&select=*&order=received_at.desc.nullslast,created_at.desc&limit=100`),rows(`social_faq_clusters?workspace_id=eq.${id}&select=*&order=occurrence_count_365d.desc,last_seen_at.desc.nullslast&limit=100`),rows(`social_response_library?workspace_id=eq.${id}&select=*&order=priority.desc,updated_at.desc&limit=100`),rows(`social_content_items?workspace_id=eq.${id}&select=*&order=scheduled_at.asc.nullslast,created_at.desc&limit=100`),rows(`social_design_jobs?workspace_id=eq.${id}&select=*&order=created_at.desc&limit=100`),rows(`social_publish_jobs?workspace_id=eq.${id}&select=*&order=scheduled_at.asc&limit=100`),rows(`social_ad_campaigns?workspace_id=eq.${id}&select=*&order=updated_at.desc&limit=100`),rows(`social_audiences?workspace_id=eq.${id}&select=*&order=updated_at.desc&limit=100`),rows(`social_ad_actions?workspace_id=eq.${id}&select=*&order=created_at.desc&limit=100`),rows(`social_ad_guardrails?workspace_id=eq.${id}&select=*&limit=1`),rows(`social_response_policies?workspace_id=eq.${id}&select=*&limit=1`),rows(`social_operation_log?workspace_id=eq.${id}&select=*&order=created_at.desc&limit=100`),rows(`social_execution_jobs?workspace_id=eq.${id}&select=*&order=created_at.desc&limit=100`),rows(`social_budget_envelopes?workspace_id=eq.${id}&select=*&order=created_at.desc&limit=100`),rows(`social_budget_allocations?workspace_id=eq.${id}&select=*&order=created_at.desc&limit=300`),rows(`social_performance_reports?workspace_id=eq.${id}&select=*&order=period_end.desc,generated_at.desc&limit=24`)]);
   if(!workspace.length)return json({error:'not_found'},404);const profileIds=[...new Set(connections.map((x:any)=>Number(x.social_profile_id)).filter((x:number)=>Number.isSafeInteger(x)&&x>0))];if(profileIds.length){const profiles=await rows(`social_profiles?id=in.(${profileIds.join(',')})&select=id,display_name,handle,profile_url,profile_id_external`);const byId=new Map(profiles.map((x:any)=>[Number(x.id),x]));for(const conn of connections){const profile=byId.get(Number(conn.social_profile_id));if(profile){conn.display_name=profile.display_name||profile.handle||profile.profile_url||null;conn.profile_url=profile.profile_url||null;}}}return json({summary:summary[0]||null,workspace:workspace[0],connections,inbox,faq,library,content,design_jobs:design,publish_jobs:publish,campaigns,audiences,ad_actions:adActions,guardrails:guardrails[0]||null,response_policy:policy[0]||null,operation_log:ops,execution_jobs:jobs,budget_envelopes:envelopes,budget_allocations:allocations,performance_reports:reports});
  }
  if(req.method==='POST'&&action==='suggest_reply'){const b=await req.json(),wid=Number(b.workspace_id),text=String(b.text||'').trim(),type=String(b.message_type||'MESSAGE').toUpperCase();if(!Number.isFinite(wid)||!text)return json({error:'invalid_input'},400);return json({items:await rpc('suggest_social_reply',{p_workspace_id:wid,p_text:text,p_message_type:type})})}
  if(req.method==='POST'&&action==='prepare_reply'){const b=await req.json(),id=Number(b.inbox_item_id);if(!Number.isFinite(id))return json({error:'invalid_input'},400);return json({items:await rpc('prepare_social_response',{p_inbox_item_id:id})})}
  if(req.method==='POST'&&action==='rebuild_faq'){const b=await req.json(),wid=Number(b.workspace_id);if(!Number.isFinite(wid))return json({error:'invalid_input'},400);return json({items:await rpc('rebuild_social_faq_inventory',{p_workspace_id:wid,p_days:Number(b.days||365),p_min_occurrences:Number(b.min_occurrences||2),p_similarity:Number(b.similarity||0.62)})})}
  if(req.method==='POST'&&action==='library_reply'){const b=await req.json(),wid=Number(b.workspace_id),q=String(b.question||'').trim(),answer=String(b.response||'').trim();if(!Number.isFinite(wid)||!q||!answer)return json({error:'invalid_input'},400);const norm=await rpc('normalize_social_text',{p_text:q});const r=await rest('social_response_library',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({workspace_id:wid,title:String(b.title||q).slice(0,180),canonical_question:q,normalized_question:Array.isArray(norm)?norm[0]:norm,approved_response:answer,keywords:b.keywords||[],applicable_platforms:b.platforms||[],applicable_message_types:b.message_types||['MESSAGE','COMMENT'],priority:Number(b.priority||50),is_active:true,approved_by:uid,approved_at:new Date().toISOString()})});return json({ok:true,item:(await r.json())[0]},201)}
  if(req.method==='POST'&&action==='update_response_policy'){const b=await req.json(),wid=Number(b.workspace_id);if(!Number.isFinite(wid))return json({error:'invalid_input'},400);const allowed=['smart_memory_enabled','approved_library_enabled','messages_auto_reply_enabled','comments_auto_reply_enabled','lookback_days','library_min_similarity','memory_min_similarity','auto_send_min_confidence','require_approval_below_confidence','human_escalation_intents','blocked_topics','max_retrieval_results','learn_only_from_approved','learn_only_from_sent'];const patch:any={updated_at:new Date().toISOString(),updated_by:uid,expose_automation_disclosure:false,external_reply_identity:'PAGE'};for(const k of allowed)if(k in b)patch[k]=b[k];const r=await rest(`social_response_policies?workspace_id=eq.${wid}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(patch)});return json({ok:true,item:(await r.json())[0]||null})}

  if(req.method==='GET'&&action==='permissions_readiness'){
    const wid=Number(u.searchParams.get('workspace_id')||0);
    if(!Number.isFinite(wid)||wid<=0)return json({error:'invalid_workspace'},400);
    const conns=await rows(`social_account_connections?workspace_id=eq.${wid}&select=id,platform,external_account_id,connection_status,authorized_by_client,granted_scopes,management_granted_scopes,management_connected_at,management_expires_at,sync_status&order=id.asc`);
    const capabilities=(c:any)=>{
      const primary=new Set(Array.isArray(c.granted_scopes)?c.granted_scopes.map(String):[]);
      const management=new Set(Array.isArray(c.management_granted_scopes)?c.management_granted_scopes.map(String):[]);
      const have=(s:string)=>primary.has(s)||management.has(s);
      const source=(s:string)=>management.has(s)?'MANAGEMENT':primary.has(s)?'PRIMARY':null;
      const cap=(s:string)=>({ready:have(s),required:[s],source:source(s)});
      const p=String(c.platform||'').toUpperCase();
      if(p==='FACEBOOK'||p==='META')return {
        messenger_reply:cap('pages_messaging'),
        comments_reply:cap('pages_manage_engagement'),
        publishing:cap('pages_manage_posts'),
        insights:cap('read_insights'),
        page_read:cap('pages_read_engagement'),
        page_metadata:cap('pages_manage_metadata'),
        page_discovery:cap('pages_show_list'),
        ads_read:cap('ads_read'),
        ads_manage:cap('ads_management')
      };
      if(p==='INSTAGRAM')return {
        comments_reply:{ready:have('instagram_business_manage_comments')||have('instagram_manage_comments'),required:['instagram_business_manage_comments']},
        messages_reply:{ready:have('instagram_business_manage_messages')||have('instagram_manage_messages'),required:['instagram_business_manage_messages']},
        publishing:{ready:have('instagram_business_content_publish')||have('instagram_content_publish'),required:['instagram_business_content_publish']},
        insights:{ready:have('instagram_business_manage_insights')||have('instagram_manage_insights'),required:['instagram_business_manage_insights']}
      };
      return {};
    };
    return json({workspace_id:wid,connections:conns.map((c:any)=>({...c,capabilities:capabilities(c)}))});
  }
  if(req.method==='GET'&&action==='operations_health'){
    const [expiredOauth,pendingResearch,failedJobs,blockedJobs,activeConnections]=await Promise.all([
      rows('social_oauth_sessions?status=in.(PENDING,ASSET_SELECTION)&expires_at=lt.'+encodeURIComponent(new Date().toISOString())+'&select=id'),
      rows('social_research_requests?status=eq.PENDING&select=id'),
      rows('social_execution_jobs?status=eq.FAILED&select=id'),
      rows('social_execution_jobs?status=eq.BLOCKED_CONNECTION&select=id'),
      rows('social_account_connections?connection_status=eq.CONNECTED&authorized_by_client=eq.true&select=id')
    ]);
    return json({expired_oauth_sessions:expiredOauth.length,pending_research_requests:pendingResearch.length,failed_execution_jobs:failedJobs.length,blocked_connection_jobs:blockedJobs.length,active_connections:activeConnections.length});
  }
  if(req.method==='POST'&&action==='set_content_status'){
    const b=await req.json(),wid=Number(b.workspace_id),cid=Number(b.content_item_id),status=String(b.status||'').toUpperCase();
    const allowed=['DRAFT','READY_FOR_REVIEW','APPROVED','CHANGES_REQUESTED','REJECTED'];
    if(!Number.isFinite(wid)||!Number.isFinite(cid)||!allowed.includes(status))return json({error:'invalid_input'},400);
    const existing=(await rows(`social_content_items?id=eq.${cid}&workspace_id=eq.${wid}&select=id,workspace_id,approval_status&limit=1`))[0];
    if(!existing)return json({error:'content_not_found'},404);
    const rr=await rest(`social_content_items?id=eq.${cid}&workspace_id=eq.${wid}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({approval_status:status,updated_at:new Date().toISOString()})});
    const item=(await rr.json())[0]||null;
    if(status==='APPROVED'){
      await rest(`approval_requests?entity_type=eq.SOCIAL_CONTENT&entity_id=eq.${cid}&action_type=eq.APPROVE_SOCIAL_CONTENT&status=eq.PENDING`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:'APPROVED',resolved_by:uid,resolved_at:new Date().toISOString(),resolution_note:'Approved from Social Management workspace',updated_at:new Date().toISOString()})});
      await rest(`social_publish_jobs?workspace_id=eq.${wid}&content_item_id=eq.${cid}&status=eq.WAITING_APPROVAL`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:'SCHEDULED',updated_at:new Date().toISOString()})});
    }else if(status==='CHANGES_REQUESTED'||status==='REJECTED'){
      await rest(`approval_requests?entity_type=eq.SOCIAL_CONTENT&entity_id=eq.${cid}&action_type=eq.APPROVE_SOCIAL_CONTENT&status=eq.PENDING`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:'REJECTED',resolved_by:uid,resolved_at:new Date().toISOString(),resolution_note:status,updated_at:new Date().toISOString()})});
    }
    return json({ok:true,item});
  }
  if(req.method==='POST'&&action==='cancel_publish'){
    const b=await req.json(),wid=Number(b.workspace_id),pid=Number(b.publish_job_id);
    if(!Number.isFinite(wid)||!Number.isFinite(pid))return json({error:'invalid_input'},400);
    const job=(await rows(`social_publish_jobs?id=eq.${pid}&workspace_id=eq.${wid}&select=*&limit=1`))[0];
    if(!job)return json({error:'publish_job_not_found'},404);
    if(['PUBLISHED','CANCELLED'].includes(String(job.status)))return json({error:'publish_job_not_cancellable'},409);
    await rest(`social_publish_jobs?id=eq.${pid}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:'CANCELLED',updated_at:new Date().toISOString()})});
    await rest(`social_execution_jobs?workspace_id=eq.${wid}&entity_type=eq.social_publish_job&entity_id=eq.${pid}&status=in.(QUEUED,BLOCKED_CONNECTION)`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:'CANCELLED',completed_at:new Date().toISOString(),updated_at:new Date().toISOString()})});
    await rest(`social_content_items?id=eq.${job.content_item_id}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({publishing_status:'CANCELLED',updated_at:new Date().toISOString()})});
    return json({ok:true});
  }
  if(req.method==='POST'&&action==='retry_execution_job'){
    const b=await req.json(),wid=Number(b.workspace_id),jid=Number(b.execution_job_id);
    if(!Number.isFinite(wid)||!Number.isFinite(jid))return json({error:'invalid_input'},400);
    const job=(await rows(`social_execution_jobs?id=eq.${jid}&workspace_id=eq.${wid}&select=*&limit=1`))[0];
    if(!job)return json({error:'execution_job_not_found'},404);
    if(!['FAILED','BLOCKED_CONNECTION'].includes(String(job.status)))return json({error:'execution_job_not_retryable'},409);
    let conn=null;
    if(job.connection_id)conn=(await rows(`social_account_connections?id=eq.${job.connection_id}&workspace_id=eq.${wid}&connection_status=eq.CONNECTED&authorized_by_client=eq.true&select=id&limit=1`))[0]||null;
    if(!conn)return json({error:'connection_required'},409);
    const rr=await rest(`social_execution_jobs?id=eq.${jid}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({status:'QUEUED',scheduled_at:new Date().toISOString(),started_at:null,completed_at:null,last_error:null,updated_at:new Date().toISOString()})});
    return json({ok:true,item:(await rr.json())[0]||null});
  }

  if(req.method==='POST'&&action==='update_workspace_setup'){
    const b=await req.json(),wid=Number(b.workspace_id);
    if(!Number.isFinite(wid))return json({error:'invalid_input'},400);
    const current=(await rows(`social_management_workspaces?id=eq.${wid}&select=*&limit=1`))[0];
    if(!current)return json({error:'workspace_not_found'},404);
    const patch:any={updated_at:new Date().toISOString()};
    const wsAllowed=['PLANNING','ONBOARDING','ACTIVE','PAUSED','ENDED'];
    const strategyAllowed=['PENDING','DRAFT','READY_FOR_REVIEW','APPROVED','NEEDS_CHANGES'];
    if('workspace_status' in b){
      const v=String(b.workspace_status||'').toUpperCase();
      if(!wsAllowed.includes(v))return json({error:'invalid_workspace_status'},400);
      if(v==='ACTIVE'){
        const cx=await rows(`social_account_connections?workspace_id=eq.${wid}&connection_status=eq.CONNECTED&authorized_by_client=eq.true&select=id&limit=1`);
        if(!cx.length)return json({error:'connection_required_for_active_workspace'},409);
      }
      patch.workspace_status=v;
    }
    if('strategy_status' in b){
      const v=String(b.strategy_status||'').toUpperCase();
      if(!strategyAllowed.includes(v))return json({error:'invalid_strategy_status'},400);
      patch.strategy_status=v;
    }
    const jsonFields=['brand_voice','audience_profiles','content_pillars','platform_strategy','publishing_rules','moderation_rules','escalation_rules','kpi_targets'];
    for(const k of jsonFields)if(k in b)patch[k]=b[k];
    if('response_sla_minutes' in b){
      const n=Number(b.response_sla_minutes);
      if(!Number.isFinite(n)||n<1||n>10080)return json({error:'invalid_response_sla'},400);
      patch.response_sla_minutes=Math.round(n);
    }
    if('client_approval_required' in b)patch.client_approval_required=Boolean(b.client_approval_required);
    const r=await rest(`social_management_workspaces?id=eq.${wid}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(patch)});
    return json({ok:true,item:(await r.json())[0]||null});
  }
  if(req.method==='POST'&&action==='create_content'){const b=await req.json(),wid=Number(b.workspace_id);if(!Number.isFinite(wid)||!b.platform||!b.content_type)return json({error:'invalid_input'},400);const r=await rest('social_content_items',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({workspace_id:wid,platform:String(b.platform),content_type:String(b.content_type),content_pillar:b.content_pillar||null,objective:b.objective||null,language:b.language||'ar',caption:b.caption||null,creative_brief:b.creative_brief||null,media_refs:b.media_refs||[],hashtags:b.hashtags||[],call_to_action:b.call_to_action||null,scheduled_at:b.scheduled_at||null,approval_status:'DRAFT',publishing_status:'NOT_SCHEDULED'})});return json({ok:true,item:(await r.json())[0]},201)}
  if(req.method==='POST'&&action==='design_job'){const b=await req.json(),wid=Number(b.workspace_id),cid=Number(b.content_item_id);if(!Number.isFinite(wid)||!Number.isFinite(cid)||!b.job_type)return json({error:'invalid_input'},400);const r=await rest('social_design_jobs',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({workspace_id:wid,content_item_id:cid,job_type:String(b.job_type),brief:b.brief||{},status:'QUEUED'})});return json({ok:true,item:(await r.json())[0]},201)}
  if(req.method==='POST'&&action==='schedule_publish'){const b=await req.json(),wid=Number(b.workspace_id),cid=Number(b.content_item_id),platform=String(b.platform||'').toUpperCase();if(!Number.isFinite(wid)||!Number.isFinite(cid)||!platform||!b.scheduled_at)return json({error:'invalid_input'},400);const content=(await rows(`social_content_items?id=eq.${cid}&workspace_id=eq.${wid}&select=*&limit=1`))[0];if(!content)return json({error:'content_not_found'},404);if(String(content.approval_status)!=='APPROVED')return json({error:'content_not_approved'},409);let connection:any=null;if(b.connection_id){connection=(await rows(`social_account_connections?id=eq.${Number(b.connection_id)}&workspace_id=eq.${wid}&platform=eq.${encodeURIComponent(platform)}&connection_status=eq.CONNECTED&authorized_by_client=eq.true&select=*&limit=1`))[0]||null}else{connection=(await rows(`social_account_connections?workspace_id=eq.${wid}&platform=eq.${encodeURIComponent(platform)}&connection_status=eq.CONNECTED&authorized_by_client=eq.true&select=*&order=connected_at.desc.nullslast,id.desc&limit=1`))[0]||null}if(!connection)return json({error:'connection_required'},409);const have=new Set([...(Array.isArray(connection.granted_scopes)?connection.granted_scopes.map(String):[]),...(Array.isArray(connection.management_granted_scopes)?connection.management_granted_scopes.map(String):[])]);if(platform==='FACEBOOK'&&!have.has('pages_manage_posts'))return json({error:'missing_publish_scope',required:['pages_manage_posts']},409);if(platform==='INSTAGRAM'&&!have.has('instagram_business_content_publish')&&!have.has('instagram_content_publish'))return json({error:'missing_publish_scope',required:['instagram_business_content_publish']},409);const r=await rest('social_publish_jobs',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({workspace_id:wid,content_item_id:cid,connection_id:connection.id,platform,scheduled_at:b.scheduled_at,status:'SCHEDULED'})});const item=(await r.json())[0];await rest(`social_content_items?id=eq.${cid}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({scheduled_at:b.scheduled_at,publishing_status:item?.status==='SCHEDULED'?'QUEUED':'NOT_SCHEDULED',updated_at:new Date().toISOString()})});return json({ok:true,item},201)}
  if(req.method==='POST'&&action==='create_campaign'){const b=await req.json(),wid=Number(b.workspace_id);if(!Number.isFinite(wid)||!b.platform||!b.campaign_name||!b.objective)return json({error:'invalid_input'},400);const r=await rest('social_ad_campaigns',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({workspace_id:wid,ad_account_id:b.ad_account_id||null,platform:String(b.platform),campaign_name:String(b.campaign_name),objective:String(b.objective),status:'DRAFT',daily_budget:b.daily_budget??null,lifetime_budget:b.lifetime_budget??null,currency:b.currency||null,start_at:b.start_at||null,end_at:b.end_at||null,audience_ids:b.audience_ids||[],targeting_strategy:b.targeting_strategy||{},placements:b.placements||[],creative_refs:b.creative_refs||[],optimization_goal:b.optimization_goal||null,bid_strategy:b.bid_strategy||null})});return json({ok:true,item:(await r.json())[0]},201)}
  if(req.method==='POST'&&action==='create_budget_envelope'){const b=await req.json(),wid=Number(b.workspace_id),budget=Number(b.total_budget),start=new Date(b.start_at),end=new Date(b.end_at);if(!Number.isFinite(wid)||!Number.isFinite(budget)||budget<=0||!b.currency||!b.scope_type||Number.isNaN(start.getTime())||Number.isNaN(end.getTime())||end<=start)return json({error:'invalid_input'},400);const rules={objective:b.objective||'ENGAGEMENT',targeting_strategy:b.targeting_strategy||{},placements:b.placements||[],optimization_goal:b.optimization_goal||null};const r=await rest('social_budget_envelopes',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({workspace_id:wid,ad_account_id:b.ad_account_id||null,name:String(b.name||'Budget envelope').slice(0,180),scope_type:String(b.scope_type),scope_entity_id:b.scope_entity_id?String(b.scope_entity_id):null,currency:String(b.currency),total_budget:budget,start_at:start.toISOString(),end_at:end.toISOString(),allocation_strategy:String(b.allocation_strategy||'EVEN'),min_per_post:Number(b.min_per_post||0),max_per_post:b.max_per_post==null||b.max_per_post===''?null:Number(b.max_per_post),performance_rebalance_enabled:Boolean(b.performance_rebalance_enabled),rebalance_interval_hours:Number(b.rebalance_interval_hours||24),auto_spend_enabled:false,status:'DRAFT',owner_authorized:false,client_authorized:Boolean(b.client_authorized),rules})});return json({ok:true,item:(await r.json())[0]},201)}
  if(req.method==='POST'&&action==='activate_budget_envelope'){const b=await req.json(),id=Number(b.envelope_id);if(!Number.isFinite(id))return json({error:'invalid_input'},400);const item=await rpc('activate_social_budget_envelope',{p_envelope_id:id,p_authorized_by:uid});return json({ok:true,item:Array.isArray(item)?item[0]||item:item})}
  if(req.method==='POST'&&action==='allocate_budget_envelope'){const b=await req.json(),id=Number(b.envelope_id);if(!Number.isFinite(id))return json({error:'invalid_input'},400);return json({ok:true,items:await rpc('allocate_social_budget_envelope',{p_envelope_id:id})})}
  if(req.method==='POST'&&action==='ad_action'){const b=await req.json(),wid=Number(b.workspace_id),cid=Number(b.campaign_id);if(!Number.isFinite(wid)||!Number.isFinite(cid)||!b.action_type)return json({error:'invalid_input'},400);const r=await rest('social_ad_actions',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({workspace_id:wid,campaign_id:cid,action_type:String(b.action_type),proposed_payload:b.payload||{},spend_delta:Number(b.spend_delta||0),risk_level:b.risk_level||'MEDIUM',budget_envelope_id:b.budget_envelope_id||null})});return json({ok:true,item:(await r.json())[0]},201)}
  return json({error:'not_found'},404);
 }catch(e){console.error(e);return json({error:'social_management_api_unavailable'},503)}
});