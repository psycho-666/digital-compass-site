import { createRemoteJWKSet, jwtVerify } from "npm:jose@5.9.6";

const ISSUER = "https://token.actions.githubusercontent.com";
const AUDIENCE = "digital-compass-public-runner";
const ALLOWED_REPOSITORY = "psycho-666/digital-compass-site";
const ALLOWED_REF = "refs/heads/main";
const ALLOWED_WORKFLOW = "psycho-666/digital-compass-site/.github/workflows/ops_worker.yml@refs/heads/main";
const JWKS = createRemoteJWKSet(new URL("https://token.actions.githubusercontent.com/.well-known/jwks"));
const PROJECT_URL = Deno.env.get("SUPABASE_URL")!;
const SECRET_KEYS = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
const SECRET_KEY = SECRET_KEYS["default"];
const SITE_BASE = "https://psycho-666.github.io/digital-compass-site/";

const SECTOR_DIRECTIONS: Record<string, any> = {
  health:{primary:'#16324F',secondary:'#EAF4F4',accent:'#2A9D8F',bg:'#F8FBFB',text:'#10212E',style:'calm clinical editorial',direction:'Clear trust-first healthcare layout with restrained visual hierarchy, contact-first conversion and evidence-safe service presentation.'},
  art:{primary:'#181512',secondary:'#F2EBDD',accent:'#A14B2A',bg:'#FAF7F0',text:'#181512',style:'gallery editorial',direction:'Portfolio-led arts direction with generous whitespace, strong work framing and minimal editorial navigation.'},
  beauty:{primary:'#3B243A',secondary:'#F5E9EF',accent:'#B7688E',bg:'#FCF8FA',text:'#241923',style:'premium beauty editorial',direction:'Premium visual-first beauty direction with elegant spacing, service discovery and direct booking/contact emphasis.'},
  food:{primary:'#3C2B23',secondary:'#F6EFE5',accent:'#B56A3A',bg:'#FFF9F2',text:'#2D211B',style:'warm hospitality',direction:'Warm menu/experience-led direction with strong product imagery zones, location clarity and order/contact conversion.'},
  retail:{primary:'#20242B',secondary:'#F2F4F7',accent:'#C8862D',bg:'#FAFBFC',text:'#1B2026',style:'modern retail',direction:'Product/category-led retail direction with clear browsing hierarchy, promotion areas and fast contact/order actions.'},
  industrial:{primary:'#203247',secondary:'#E9EEF3',accent:'#D17A22',bg:'#F7F9FB',text:'#17212C',style:'industrial systems',direction:'Capability-led industrial direction with structured service blocks, technical confidence and quote/contact conversion.'},
  tech:{primary:'#172B4D',secondary:'#EAF2FA',accent:'#2274A5',bg:'#F8FBFE',text:'#13243B',style:'clear technology',direction:'Modern technology direction with product/value hierarchy, concise proof zones and low-friction enquiry paths.'},
  transport:{primary:'#163B5C',secondary:'#EAF3F7',accent:'#2E7D6E',bg:'#F8FBFC',text:'#142B3B',style:'reliable mobility',direction:'Reliability-first transport direction with route/service clarity, availability cues and direct booking/contact flow.'},
  hospitality:{primary:'#282522',secondary:'#F0EADF',accent:'#A67C3D',bg:'#FBF8F2',text:'#211F1D',style:'refined hospitality',direction:'Experience-led hospitality direction with strong atmosphere, location, room/service discovery and booking emphasis.'},
  default:{primary:'#243447',secondary:'#EDF1F4',accent:'#4E718C',bg:'#FAFBFC',text:'#18242F',style:'modern business editorial',direction:'Clear modern business direction built around verified offer context, contactability and concise conversion paths.'},
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: {"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-robots-tag":"noindex, nofollow, noarchive"} });
}
function now(){ return new Date().toISOString(); }
function leaseUntil(minutes=55){ return new Date(Date.now()+minutes*60*1000).toISOString(); }
function safeText(v:any,max=1200){ return String(v ?? '').slice(0,max); }
function safeUrl(v:any){ const s=String(v||'').trim(); return /^https?:\/\//i.test(s) ? s.slice(0,1800) : null; }
function uniq<T>(xs:T[]){ return [...new Set(xs)]; }
function sectorMode(sector:any){
  const s=String(sector||'').toLowerCase();
  if(['clinic','dental','health','medical','laboratory','eye','vision','doctor'].some(x=>s.includes(x))) return 'health';
  if(['art','gallery','creative','photo'].some(x=>s.includes(x))) return 'art';
  if(['beauty','salon','barber','spa','cosmetic'].some(x=>s.includes(x))) return 'beauty';
  if(['restaurant','cafe','coffee','food','bakery','roastery'].some(x=>s.includes(x))) return 'food';
  if(['shop','store','mall','retail','shopping','clothing','mobile_phone'].some(x=>s.includes(x))) return 'retail';
  if(['industrial','metal','factory','manufactur','hardware'].some(x=>s.includes(x))) return 'industrial';
  if(['telecom','technology','software','internet','it_'].some(x=>s.includes(x))) return 'tech';
  if(['transport','taxi','logistic','delivery','auto'].some(x=>s.includes(x))) return 'transport';
  if(['hotel','resort','hospitality'].some(x=>s.includes(x))) return 'hospitality';
  return 'default';
}
function catalogModes(sector:any){ const s=String(sector||'').toLowerCase(); const out=[sectorMode(s)]; if(['auto','automotive','repair','garage','car'].some(x=>s.includes(x))) out.unshift('automotive'); return uniq(out); }

async function authenticate(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) throw new Error("missing_bearer");
  const token = auth.slice(7).trim();
  const { payload } = await jwtVerify(token, JWKS, {issuer:ISSUER,audience:AUDIENCE,algorithms:["RS256"]});
  if (payload.repository !== ALLOWED_REPOSITORY) throw new Error("repo_not_allowed");
  if (payload.ref !== ALLOWED_REF) throw new Error("ref_not_allowed");
  if (payload.workflow_ref !== ALLOWED_WORKFLOW) throw new Error("workflow_not_allowed");
  const eventName = String(payload.event_name || "");
  if (!["push","schedule","workflow_dispatch"].includes(eventName)) throw new Error("event_not_allowed");
  return payload;
}
async function rest(path:string, init:RequestInit={}){
  if(!SECRET_KEY) throw new Error('service_key_unavailable');
  const headers=new Headers(init.headers||{}); headers.set('apikey',SECRET_KEY); headers.set('Authorization',`Bearer ${SECRET_KEY}`); headers.set('Content-Type','application/json');
  const r=await fetch(`${PROJECT_URL}/rest/v1/${path}`,{...init,headers}); const text=await r.text(); if(!r.ok) throw new Error(`rest_${r.status}_${text.slice(0,300)}`); return text?JSON.parse(text):null;
}
async function rpc(name:string,body:any={}){ return await rest(`rpc/${name}`,{method:'POST',body:JSON.stringify(body)}); }
async function one(table:string,filter:string){ const rows=await rest(`${table}?${filter}&limit=1`)||[]; return rows[0]||null; }
async function patch(table:string,filter:string,body:any,prefer='return=minimal'){ return await rest(`${table}?${filter}`,{method:'PATCH',headers:{Prefer:prefer},body:JSON.stringify(body)}); }
async function insert(table:string,body:any,prefer='return=representation'){ return await rest(table,{method:'POST',headers:{Prefer:prefer},body:JSON.stringify(body)}); }

async function claimStageCommand(type:string){
  const rows=await rest(`automation_commands?status=eq.QUEUED&command_type=eq.${encodeURIComponent(type)}&select=id,command_type,requested_at,attempt_count,max_attempts&order=requested_at.asc,id.asc&limit=1`)||[];
  if(!rows.length) return null;
  const c=rows[0],attempt=Number(c.attempt_count||0)+1;
  if(attempt>Number(c.max_attempts||3)){await patch('automation_commands',`id=eq.${c.id}&status=eq.QUEUED`,{status:'FAILED',completed_at:now(),error_message:'Maximum automatic attempts exceeded',lease_expires_at:null,last_heartbeat_at:now()});return null}
  const updated=await patch('automation_commands',`id=eq.${c.id}&status=eq.QUEUED`,{status:'RUNNING',started_at:now(),error_message:null,attempt_count:attempt,lease_expires_at:leaseUntil(),last_heartbeat_at:now()},'return=representation')||[];
  return updated.length?Number(c.id):null;
}
async function finishStageCommand(id:number,type:string,status:string,result:any,error_message:any=null){
  if(!Number.isInteger(id)||!['SUCCEEDED','FAILED'].includes(status)) throw new Error('invalid_command_completion');
  const rows=await rest(`automation_commands?id=eq.${id}&command_type=eq.${encodeURIComponent(type)}&status=eq.RUNNING&select=id&limit=1`)||[];
  if(!rows.length) throw new Error('command_not_claimed');
  await patch('automation_commands',`id=eq.${id}`,{status,completed_at:now(),result:boundedObject(result),error_message:error_message?safeText(error_message,4000):null,lease_expires_at:null,last_heartbeat_at:now()});
}

function boundedObject(value:unknown){ if(!value||typeof value!=='object') return {}; const raw=JSON.stringify(value); if(raw.length>30000) throw new Error('result_too_large'); return value; }

async function claimPrototypeQa(identity:any){
  const commandId=await claimStageCommand('PROTOTYPE_QA');
  if(!commandId) return {ok:true,action:'claim_prototype_qa',tasks:[],command_id:null};
  const sites=await rest("prototype_sites?generation_status=in.(QA_PENDING,PUBLISHED)&select=id,slug,generation_status,generated_at&order=generated_at.asc.nullslast,id.asc&limit=100")||[];
  const passed=await rest("prototype_qa_runs?status=eq.PASSED&select=prototype_site_id&limit=1000")||[];
  const running=await rest("prototype_qa_runs?status=eq.RUNNING&select=prototype_site_id,started_at&limit=1000")||[];
  const passedIds=new Set(passed.map((x:any)=>Number(x.prototype_site_id)));
  const recentRunningIds=new Set(running.filter((x:any)=>{const t=Date.parse(String(x.started_at||''));return Number.isFinite(t)&&Date.now()-t<45*60*1000;}).map((x:any)=>Number(x.prototype_site_id)));
  const candidates=sites.filter((s:any)=>{const id=Number(s.id);if(recentRunningIds.has(id))return false;return s.generation_status==='QA_PENDING'||!passedIds.has(id);}).slice(0,8);
  const tasks=[];
  for(const site of candidates){
    const runUrl=`https://github.com/${ALLOWED_REPOSITORY}/actions/runs/${identity.run_id}`;
    const rows=await insert('prototype_qa_runs',{prototype_site_id:site.id,slug:site.slug,status:'RUNNING',started_at:now(),workflow_run_url:runUrl})||[];
    if(rows.length) tasks.push({qa_run_id:rows[0].id,site_id:site.id,slug:site.slug,site_base:SITE_BASE});
  }
  if(commandId && tasks.length===0) await finishStageCommand(commandId,'PROTOTYPE_QA','SUCCEEDED',{processed:0,note:'No QA tasks pending.'});
  return {ok:true,action:'claim_prototype_qa',tasks,command_id:tasks.length?commandId:null};
}
async function completePrototypeQa(body:any){
  const qaRunId=Number(body.qa_run_id),siteId=Number(body.site_id),status=String(body.status||'');
  if(!Number.isInteger(qaRunId)||!Number.isInteger(siteId)||!['PASSED','FAILED'].includes(status)) throw new Error('invalid_completion');
  const runs=await rest(`prototype_qa_runs?id=eq.${qaRunId}&prototype_site_id=eq.${siteId}&status=eq.RUNNING&select=id,prototype_site_id,slug&limit=1`)||[]; if(!runs.length) throw new Error('qa_run_not_claimed');
  const errors=Array.isArray(body.errors)?body.errors.slice(0,50).map((x:any)=>safeText(x,1200)):[]; const desktop=boundedObject(body.desktop_result),mobile=boundedObject(body.mobile_result),completed=now();
  await patch('prototype_qa_runs',`id=eq.${qaRunId}`,{status,completed_at:completed,desktop_result:desktop,mobile_result:mobile,errors});
  if(status==='PASSED'){
    const canonical=`${SITE_BASE}#${runs[0].slug}`;
    await patch('prototype_sites',`id=eq.${siteId}`,{generation_status:'PUBLISHED',public_url:canonical,published_at:completed,updated_at:completed,notes:'Browser QA passed on desktop and mobile via the secretless OIDC public runner.'});
  }else{
    await patch('prototype_sites',`id=eq.${siteId}`,{generation_status:'QA_FAILED',public_url:null,published_at:null,updated_at:completed,notes:'Publication blocked because browser QA failed on the secretless OIDC public runner. Review prototype_qa_runs for exact errors.'});
  }
  return {ok:true,action:'complete_prototype_qa',status,qa_run_id:qaRunId,site_id:siteId};
}

async function claimPrototypeResearch(){
  const commandId=await claimStageCommand('PROTOTYPE_RESEARCH');
  if(!commandId) return {ok:true,action:'claim_prototype_research',tasks:[],command_id:null};
  const reqs=await rpc('claim_prototype_research_requests',{p_limit:3})||[];
  const tasks=[];
  for(const req of reqs){
    const company=await one('companies',`id=eq.${req.company_id}&select=*`); const opportunity=await one('opportunities',`id=eq.${req.opportunity_id}&select=*`);
    if(!company||!opportunity){ await patch('prototype_research_requests',`id=eq.${req.id}`,{status:'PARTIAL',completed_at:now(),updated_at:now(),error_message:'company/opportunity missing'}); continue; }
    const modes=catalogModes(company.sector); const catalogs:any[]=[];
    for(const mode of modes){ const rows=await rest(`design_reference_catalog?sector_mode=eq.${encodeURIComponent(mode)}&active=eq.true&validation_status=eq.VALIDATED&select=id,sector_mode,reference_name,reference_url,market,reference_type,pattern_ideas,relevance_score&order=relevance_score.desc,id.asc&limit=6`)||[]; catalogs.push(...rows); }
    tasks.push({request:req,company,opportunity,catalog_references:catalogs.slice(0,10)});
  }
  if(commandId && tasks.length===0) await finishStageCommand(commandId,'PROTOTYPE_RESEARCH','SUCCEEDED',{processed:0,note:'No prototype research tasks pending.'});
  return {ok:true,action:'claim_prototype_research',tasks,command_id:tasks.length?commandId:null};
}

async function upsertBy(table:string,filter:string,body:any){ const x=await rest(`${table}?${filter}&select=id&limit=1`)||[]; if(x.length){ await patch(table,`id=eq.${x[0].id}`,body); return x[0].id; } const rows=await insert(table,body)||[]; return rows[0]?.id||null; }
function sanitizeRefs(value:any){
  if(!Array.isArray(value)) return [];
  const out:any[]=[]; const hosts=new Set<string>();
  for(const r of value.slice(0,8)){
    const url=safeUrl(r?.url); if(!url) continue; let host=''; try{host=new URL(url).hostname.toLowerCase();}catch{continue;} if(!host||hosts.has(host)) continue; hosts.add(host);
    const ideas=Array.isArray(r?.pattern_ideas)?r.pattern_ideas.slice(0,14).map((x:any)=>safeText(x,100)).filter(Boolean):[];
    out.push({url,title:safeText(r?.title||host,220),market:safeText(r?.market,120)||null,reference_type:safeText(r?.reference_type||'LIVE_PEER_RESEARCH',80),pattern_ideas:ideas,relevance_score:Math.max(50,Math.min(100,Number(r?.relevance_score||80))),catalog_id:Number.isInteger(Number(r?.catalog_id))?Number(r.catalog_id):null});
    if(out.length>=5) break;
  }
  return out;
}
async function completePrototypeResearch(body:any){
  const requestId=Number(body.request_id); if(!Number.isInteger(requestId)) throw new Error('invalid_request');
  const req=await one('prototype_research_requests',`id=eq.${requestId}&status=eq.RUNNING&select=*`); if(!req) throw new Error('research_request_not_claimed');
  const company=await one('companies',`id=eq.${req.company_id}&select=*`); const opp=await one('opportunities',`id=eq.${req.opportunity_id}&select=*`); if(!company||!opp) throw new Error('company_or_opportunity_missing');
  const score=Math.max(0,Math.min(100,Number(body.validation_score||0))); const required=opp.prototype_level==='PROTOTYPE'?3:2; const sources=uniq((Array.isArray(body.sources)?body.sources:[]).map(safeUrl).filter(Boolean)).slice(0,8); const refs=sanitizeRefs(body.references); const mode=SECTOR_DIRECTIONS[String(body.mode||'')]?String(body.mode):sectorMode(company.sector);
  if(body.error || score<required || refs.length<2){ const reason=safeText(body.error || (score<required?'Insufficient public evidence for safe client-facing prototype generation.':'Fewer than two usable design references were found; publication is blocked by the reference gate.'),1200); await patch('prototype_research_requests',`id=eq.${requestId}`,{status:'PARTIAL',completed_at:now(),updated_at:now(),result:{validation_score:score,required,mode,sources,references:refs.map((r:any)=>r.url)},error_message:reason}); return {ok:true,status:'PARTIAL',request_id:requestId,error:reason}; }
  const summaryAr=`${company.name} — نشاط مُدرج علنًا ضمن قطاع ${company.sector||'business'} في ${company.country||''}.`; const summaryEn=`${company.name} — a publicly listed ${String(company.sector||'business').replaceAll('_',' ')} business in ${company.country||''}.`;
  const address=[company.city,company.country].filter(Boolean).join(' / ');
  const context={company_id:company.id,opportunity_id:opp.id,validated_summary:JSON.stringify({ar:summaryAr,en:summaryEn}),services:[],address_text:JSON.stringify({ar:address,en:address}),contact_phone:company.phone||null,contact_email:company.general_email||null,instagram_url:company.instagram_url||null,facebook_url:company.facebook_url||null,source_urls:sources,validation_status:'VALIDATED',validated_at:now(),updated_at:now()};
  await upsertBy('prototype_context',`company_id=eq.${company.id}&opportunity_id=eq.${opp.id}`,context);
  const d=SECTOR_DIRECTIONS[mode]||SECTOR_DIRECTIONS.default; const social=Boolean(company.instagram_url||company.facebook_url||company.linkedin_url);
  const brand={company_id:company.id,opportunity_id:opp.id,brand_status:'PROPOSED',identity_source:social?'SOCIAL_MEDIA':'PROPOSED',primary_color:d.primary,secondary_color:d.secondary,accent_color:d.accent,background_color:d.bg,text_color:d.text,heading_font_family:'Alexandria',body_font_family:'IBM Plex Sans Arabic',visual_style:d.style,tone_of_voice:'clear, credible, direct',audience_notes:'Direction inferred from sector context only; no audience demographics are asserted without evidence.',design_direction:d.direction,confidence_score:65,is_official_identity:false,evidence:sources.slice(0,6).map((u:any)=>({type:'public_source',url:u})),notes:'Proposed brand direction for concept use only; not presented as the client official identity.',updated_at:now()};
  await upsertBy('client_brand_profiles',`company_id=eq.${company.id}&opportunity_id=eq.${opp.id}`,brand);
  for(const [i,r] of refs.entries()){
    const refBody={company_id:company.id,opportunity_id:opp.id,sector:company.sector||'business',reference_name:r.title,reference_url:r.url,market:r.market||company.country,reference_type:r.reference_type,extracted_ideas:r.pattern_ideas,originality_rule:'Use generic information architecture and interaction patterns only. Never copy protected text, client branding, imagery, or a distinctive page composition.',relevance_score:r.relevance_score||Math.max(65,90-i*5),researched_at:now()};
    await upsertBy('design_reference_research',`company_id=eq.${company.id}&reference_url=eq.${encodeURIComponent(r.url)}`,refBody);
    if(r.catalog_id) await patch('design_reference_catalog',`id=eq.${r.catalog_id}`,{validation_status:'VALIDATED',active:true,last_validated_at:now(),updated_at:now()});
  }
  await patch('opportunities',`id=eq.${opp.id}`,{recommended_next_action:opp.prototype_level==='PROTOTYPE'?'GENERATE_PROTOTYPE':'GENERATE_PREVIEW',updated_at:now()});
  await rpc('refresh_prototype_sites',{});
  const sites=await rest(`prototype_sites?company_id=eq.${company.id}&opportunity_id=eq.${opp.id}&select=id,slug,public_url,prototype_level,brand_gate_status,generation_status&order=id.desc&limit=1`)||[]; if(!sites.length) throw new Error('prototype_not_generated');
  const result={validation_score:score,mode,sources,references:refs.map((r:any)=>r.url),prototype:sites[0],worker:'OIDC_PUBLIC_RESEARCH_V1'};
  await patch('prototype_research_requests',`id=eq.${requestId}`,{status:'SUCCEEDED',completed_at:now(),updated_at:now(),result,error_message:null});
  return {ok:true,status:'SUCCEEDED',request_id:requestId,prototype:sites[0]};
}

Deno.serve(async(req:Request)=>{
  if(req.method!=='POST') return json({error:'method_not_allowed'},405);
  try{
    const identity=await authenticate(req); const body=await req.json().catch(()=>({})); const action=String(body.action||'');
    if(action==='probe') return json({ok:true,action,repository:identity.repository,ref:identity.ref,workflow_ref:identity.workflow_ref,event_name:identity.event_name,run_id:identity.run_id});
    if(action==='claim_prototype_qa') return json(await claimPrototypeQa(identity));
    if(action==='complete_prototype_qa') return json(await completePrototypeQa(body));
    if(action==='claim_prototype_research') return json(await claimPrototypeResearch());
    if(action==='complete_prototype_research') return json(await completePrototypeResearch(body));
    if(action==='finish_stage_command'){
      const type=String(body.command_type||''); if(!['PROTOTYPE_RESEARCH','PROTOTYPE_QA'].includes(type)) throw new Error('command_type_not_allowed');
      await finishStageCommand(Number(body.command_id),type,String(body.status||'SUCCEEDED'),body.result||{},body.error_message||null); return json({ok:true,action,command_id:Number(body.command_id),command_type:type});
    }
    return json({error:'action_not_supported'},400);
  }catch(err){ console.error('github-worker-bridge request failed',err); return json({error:'unauthorized_or_invalid'},401); }
});
