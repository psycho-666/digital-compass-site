import { createRemoteJWKSet, jwtVerify } from "npm:jose@5.9.6";

const ISSUER='https://token.actions.githubusercontent.com';
const AUDIENCE='digital-compass-public-runner';
const REPOSITORY='psycho-666/digital-compass-site';
const REF='refs/heads/main';
const WORKFLOW='psycho-666/digital-compass-site/.github/workflows/ops_worker.yml@refs/heads/main';
const JWKS=createRemoteJWKSet(new URL('https://token.actions.githubusercontent.com/.well-known/jwks'));
const PROJECT_URL=Deno.env.get('SUPABASE_URL')!;
const SECRET_KEYS=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}');
const SECRET_KEY=SECRET_KEYS['default'];
const RELEASE='2026-07-22.0';
const SUPPORTED:any={
  'Iraq':{country:'Iraq',country_code:'IQ',bbox:[38.7,29.0,48.8,37.5]},
  'Saudi Arabia':{country:'Saudi Arabia',country_code:'SA',bbox:[34.4,16.3,55.7,32.2]},
  'United Arab Emirates':{country:'United Arab Emirates',country_code:'AE',bbox:[51.4,22.5,56.6,26.4]}
};
const ALIASES:any={'UAE':'United Arab Emirates','Saudi':'Saudi Arabia','KSA':'Saudi Arabia'};

function json(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-robots-tag':'noindex, nofollow, noarchive'}})}
function now(){return new Date().toISOString()}
function leaseUntil(minutes=55){return new Date(Date.now()+minutes*60*1000).toISOString()}
function today(){return new Date().toISOString().slice(0,10)}
function text(v:any,n=2000){return String(v??'').slice(0,n)}
function bounded(v:any,max=30000){if(!v||typeof v!=='object')return {};const s=JSON.stringify(v);if(s.length>max)throw new Error('object_too_large');return v}

async function auth(req:Request){
  const h=req.headers.get('authorization')||'';if(!h.startsWith('Bearer '))throw new Error('missing_bearer');
  const {payload}=await jwtVerify(h.slice(7).trim(),JWKS,{issuer:ISSUER,audience:AUDIENCE,algorithms:['RS256']});
  if(payload.repository!==REPOSITORY||payload.ref!==REF||payload.workflow_ref!==WORKFLOW)throw new Error('identity_not_allowed');
  if(!['push','schedule','workflow_dispatch'].includes(String(payload.event_name||'')))throw new Error('event_not_allowed');
  return payload;
}
async function rest(path:string,init:RequestInit={}){
  if(!SECRET_KEY)throw new Error('service_key_unavailable');
  const h=new Headers(init.headers||{});h.set('apikey',SECRET_KEY);h.set('authorization',`Bearer ${SECRET_KEY}`);h.set('content-type','application/json');
  const r=await fetch(`${PROJECT_URL}/rest/v1/${path}`,{...init,headers:h});const t=await r.text();if(!r.ok)throw new Error(`rest_${r.status}_${t.slice(0,500)}`);return t?JSON.parse(t):null;
}
async function rpc(name:string,body:any={}){return await rest(`rpc/${name}`,{method:'POST',body:JSON.stringify(body)})}
async function patch(table:string,filter:string,body:any,prefer='return=minimal'){return await rest(`${table}?${filter}`,{method:'PATCH',headers:{Prefer:prefer},body:JSON.stringify(body)})}
async function insert(table:string,body:any,prefer='return=representation',query=''){return await rest(`${table}${query?`?${query}`:''}`,{method:'POST',headers:{Prefer:prefer},body:JSON.stringify(body)})}
async function one(table:string,filter:string){const rows=await rest(`${table}?${filter}&limit=1`)||[];return rows[0]||null}

async function claimCommand(type:string){
  const rows=await rest(`automation_commands?status=eq.QUEUED&command_type=eq.${encodeURIComponent(type)}&select=id,requested_at,attempt_count,max_attempts&order=requested_at.asc,id.asc&limit=1`)||[];
  if(!rows.length)return null;const row=rows[0],id=Number(row.id),attempt=Number(row.attempt_count||0)+1;
  if(attempt>Number(row.max_attempts||3)){await patch('automation_commands',`id=eq.${id}&status=eq.QUEUED`,{status:'FAILED',completed_at:now(),error_message:'Maximum automatic attempts exceeded',lease_expires_at:null,last_heartbeat_at:now()});return null}
  const claimed=await patch('automation_commands',`id=eq.${id}&status=eq.QUEUED`,{status:'RUNNING',started_at:now(),completed_at:null,error_message:null,attempt_count:attempt,lease_expires_at:leaseUntil(),last_heartbeat_at:now(),result:{claimed_by:'OIDC_PUBLIC_CORE_V2',attempt}},'return=representation')||[];
  return claimed.length?id:null;
}
async function commandIsRunning(id:number,type:string){return !!(await one('automation_commands',`id=eq.${id}&command_type=eq.${encodeURIComponent(type)}&status=eq.RUNNING&select=id`))}
async function finishCommand(id:number,type:string,status:string,result:any,error:any=null){
  if(!id||!['SUCCEEDED','FAILED'].includes(status)||!(await commandIsRunning(id,type)))throw new Error('command_not_claimed');
  await patch('automation_commands',`id=eq.${id}`,{status,completed_at:now(),result:bounded(result),error_message:error?text(error,4000):null,lease_expires_at:null,last_heartbeat_at:now()});
}

async function recoverStaleCommands(){
  const rows=await rest(`automation_commands?status=eq.RUNNING&lease_expires_at=lt.${encodeURIComponent(now())}&select=id,command_type,attempt_count,max_attempts,lease_expires_at&order=lease_expires_at.asc,id.asc&limit=50`)||[];
  let requeued=0,failed=0;
  for(const row of rows){const id=Number(row.id),attempt=Number(row.attempt_count||0),max=Number(row.max_attempts||3);if(attempt>=max){await patch('automation_commands',`id=eq.${id}&status=eq.RUNNING`,{status:'FAILED',completed_at:now(),lease_expires_at:null,last_heartbeat_at:now(),error_message:`Automatic recovery exhausted after ${attempt} attempt(s)`});failed++}else{await patch('automation_commands',`id=eq.${id}&status=eq.RUNNING`,{status:'QUEUED',started_at:null,completed_at:null,lease_expires_at:null,last_heartbeat_at:now(),error_message:`Recovered expired worker lease after attempt ${attempt}`});requeued++}}
  const dependentRecovery=await rpc('recover_stale_automation_work',{});
  return {ok:true,action:'recover_stale_commands',scanned:rows.length,requeued,failed,dependent_recovery:dependentRecovery};
}

async function enabledMarkets(){
  const row=await one('app_settings','setting_key=eq.markets&select=setting_value');
  let requested=Array.isArray(row?.setting_value)?row.setting_value.map((x:any)=>ALIASES[String(x).trim()]||String(x).trim()).filter(Boolean):['Iraq'];
  if(!requested.length)requested=['Iraq'];
  const bad=requested.filter((x:string)=>!SUPPORTED[x]);if(bad.length)throw new Error(`unsupported_markets_${bad.join('_')}`);
  return requested.map((x:string)=>SUPPORTED[x]);
}
async function claimDiscovery(){
  const commandId=await claimCommand('DISCOVERY');if(!commandId)return {ok:true,action:'claim_discovery',command_id:null,task:null};
  const markets=await enabledMarkets();
  const rows=await insert('discovery_runs',{source_name:'overture_places',market:markets.map((x:any)=>x.country).join(', '),status:'RUNNING',started_at:now(),scanned_count:0,inserted_count:0,duplicate_count:0,rejected_count:0,metadata:{release:RELEASE,markets:markets.map((x:any)=>x.country),settings_source:'app_settings.markets',worker:'OIDC_PUBLIC_DISCOVERY_V1'}})||[];
  const runId=Number(rows[0]?.id||0);if(!runId){await finishCommand(commandId,'DISCOVERY','FAILED',{worker:'OIDC_PUBLIC_DISCOVERY_V1'},'Failed to create discovery run');throw new Error('discovery_run_create_failed')}
  return {ok:true,action:'claim_discovery',command_id:commandId,task:{run_id:runId,release:RELEASE,markets,max_per_market:1500,min_confidence:0.55}};
}
function cleanCompany(r:any){
  const out:any={};
  const fields=['name','country','city','sector','website_url','has_website','instagram_url','facebook_url','linkedin_url','phone','general_email','source_type','source_external_id','source_confidence','operating_status','latitude','longitude','activity_status','status','fingerprint','discovery_score'];
  for(const k of fields)if(r?.[k]!==undefined)out[k]=r[k];
  if(!out.name||!out.fingerprint)throw new Error('invalid_company_row');
  out.name=text(out.name,500);out.fingerprint=text(out.fingerprint,128);out.country=text(out.country,120)||null;out.city=out.city?text(out.city,300):null;out.sector=out.sector?text(out.sector,500):null;
  for(const k of ['website_url','instagram_url','facebook_url','linkedin_url'])if(out[k])out[k]=text(out[k],2000);
  if(out.phone)out.phone=text(out.phone,120);if(out.general_email)out.general_email=text(out.general_email,320);
  out.source_type='overture_places';out.activity_status='active_candidate';out.status='NEW';
  return out;
}
async function submitDiscoveryBatch(body:any){
  const commandId=Number(body.command_id),runId=Number(body.run_id);if(!(await commandIsRunning(commandId,'DISCOVERY')))throw new Error('command_not_claimed');
  const run=await one('discovery_runs',`id=eq.${runId}&status=eq.RUNNING&select=id`);if(!run)throw new Error('run_not_active');
  const rows=Array.isArray(body.rows)?body.rows.slice(0,250).map(cleanCompany):[];if(!rows.length)return {ok:true,accepted:0};
  await insert('companies',rows,'resolution=merge-duplicates,return=minimal','on_conflict=fingerprint');
  return {ok:true,accepted:rows.length};
}
async function finishDiscovery(body:any){
  const commandId=Number(body.command_id),runId=Number(body.run_id),status=String(body.status||'SUCCEEDED');if(!['SUCCEEDED','FAILED'].includes(status))throw new Error('bad_status');
  const scanned=Math.max(0,Number(body.scanned||0)),upserted=Math.max(0,Number(body.upserted||0));const meta=bounded(body.metadata||{});
  await patch('discovery_runs',`id=eq.${runId}&status=eq.RUNNING`,{status,finished_at:now(),scanned_count:scanned,inserted_count:upserted,error_message:body.error_message?text(body.error_message,4000):null,metadata:{...meta,worker:'OIDC_PUBLIC_DISCOVERY_V1'}});
  await finishCommand(commandId,'DISCOVERY',status,{scanned,upserted,run_id:runId,worker:'OIDC_PUBLIC_DISCOVERY_V1',metadata:meta},body.error_message||null);
  return {ok:true,status,scanned,upserted,run_id:runId};
}

async function claimDeepAudit(){
  const commandId=await claimCommand('AUDIT');if(!commandId)return {ok:true,action:'claim_deep_audit',command_id:null,tasks:[]};
  const list=await rest(`lead_shortlists?shortlist_date=eq.${today()}&status=eq.SELECTED&select=company_id,opportunity_track,pre_audit_score,status,global_rank&order=global_rank.asc.nullslast,company_id.asc&limit=250`)||[];
  if(!list.length){await finishCommand(commandId,'AUDIT','SUCCEEDED',{processed:0,note:'No shortlist found for today.',worker:'OIDC_PUBLIC_DEEP_AUDIT_V1'});return {ok:true,action:'claim_deep_audit',command_id:null,tasks:[]};}
  const ids=list.map((x:any)=>Number(x.company_id)).filter(Number.isFinite);if(!ids.length){await finishCommand(commandId,'AUDIT','SUCCEEDED',{processed:0,note:'Shortlist had no valid company ids.',worker:'OIDC_PUBLIC_DEEP_AUDIT_V1'});return {ok:true,action:'claim_deep_audit',command_id:null,tasks:[]};}
  const companies=await rest(`companies?id=in.(${ids.join(',')})&select=id,name,country,city,sector,website_url,has_website,instagram_url,facebook_url,linkedin_url,phone,whatsapp,general_email,contactable&limit=250`)||[];
  const by=new Map(companies.map((x:any)=>[Number(x.id),x]));const tasks=[];
  for(const item of list){const company=by.get(Number(item.company_id));if(company)tasks.push({shortlist:item,company});}
  if(!tasks.length){await finishCommand(commandId,'AUDIT','SUCCEEDED',{processed:0,note:'No matching companies found.',worker:'OIDC_PUBLIC_DEEP_AUDIT_V1'});return {ok:true,action:'claim_deep_audit',command_id:null,tasks:[]};}
  return {ok:true,action:'claim_deep_audit',command_id:commandId,tasks};
}
function cleanAudit(a:any){
  const allowed=['company_id','shortlist_date','audit_type','audited_url','status','http_status','page_title','meta_description','has_ssl','has_mobile_viewport','has_clear_cta','has_contact_form','has_whatsapp','has_phone_link','has_email_link','has_booking','has_social_proof','social_channels_count','audit_score','findings','error_message','started_at','finished_at'];const out:any={};
  for(const k of allowed)if(a?.[k]!==undefined)out[k]=a[k];
  if(!Number.isFinite(Number(out.company_id)))throw new Error('bad_company_id');out.company_id=Number(out.company_id);out.shortlist_date=today();
  if(!['WEBSITE','NO_WEBSITE'].includes(String(out.audit_type)))throw new Error('bad_audit_type');
  out.status=text(out.status,60)||'FAILED';out.findings=bounded(out.findings||{});if(out.error_message)out.error_message=text(out.error_message,1200);if(out.page_title)out.page_title=text(out.page_title,500);if(out.meta_description)out.meta_description=text(out.meta_description,1200);if(out.audited_url)out.audited_url=text(out.audited_url,2000);
  return out;
}
async function completeDeepAudit(body:any){
  const commandId=Number(body.command_id);if(!(await commandIsRunning(commandId,'AUDIT')))throw new Error('command_not_claimed');const a=cleanAudit(body.audit);
  await insert('audits',[a],'resolution=merge-duplicates,return=minimal','on_conflict=shortlist_date,company_id,audit_type');
  const shortlistStatus=a.status==='COMPLETED'?'AUDITED':a.status;
  await patch('lead_shortlists',`shortlist_date=eq.${today()}&company_id=eq.${a.company_id}`,{status:shortlistStatus});
  return {ok:true,company_id:a.company_id,status:a.status,audit_score:a.audit_score??null};
}
async function finishDeepAudit(body:any){
  const commandId=Number(body.command_id),status=String(body.status||'SUCCEEDED');if(!['SUCCEEDED','FAILED'].includes(status))throw new Error('bad_status');
  const result={processed:Math.max(0,Number(body.processed||0)),completed:Math.max(0,Number(body.completed||0)),non_completed:Math.max(0,Number(body.non_completed||0)),failures:Math.max(0,Number(body.failures||0)),worker:'OIDC_PUBLIC_DEEP_AUDIT_V1'};
  await finishCommand(commandId,'AUDIT',status,result,body.error_message||null);return {ok:true,status,...result};
}

Deno.serve(async(req:Request)=>{
  if(req.method!=='POST')return json({error:'method_not_allowed'},405);
  try{const identity=await auth(req);const body=await req.json().catch(()=>({}));const action=String(body.action||'');
    if(action==='probe')return json({ok:true,repository:identity.repository,run_id:identity.run_id});
    if(action==='recover_stale_commands')return json(await recoverStaleCommands());
    if(action==='claim_discovery')return json(await claimDiscovery());
    if(action==='submit_discovery_batch')return json(await submitDiscoveryBatch(body));
    if(action==='finish_discovery')return json(await finishDiscovery(body));
    if(action==='claim_deep_audit')return json(await claimDeepAudit());
    if(action==='complete_deep_audit')return json(await completeDeepAudit(body));
    if(action==='finish_deep_audit')return json(await finishDeepAudit(body));
    return json({error:'action_not_supported'},400);
  }catch(e){console.error('github-core-worker-bridge failed',e);return json({error:'unauthorized_or_invalid'},401);}
});
