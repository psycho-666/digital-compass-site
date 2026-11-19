const PROJECT_URL=Deno.env.get('SUPABASE_URL')!;
const SECRET_KEYS=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}');
const SECRET_KEY=SECRET_KEYS['default'];
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type, x-dc-internal-key','Access-Control-Allow-Methods':'POST, OPTIONS','Cache-Control':'no-store'};
function json(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json; charset=utf-8','X-Robots-Tag':'noindex, nofollow, noarchive'}})}
async function rest(path:string,init:RequestInit={}){const h=new Headers(init.headers||{});h.set('apikey',SECRET_KEY);h.set('Authorization',`Bearer ${SECRET_KEY}`);if(init.body&&!h.has('Content-Type'))h.set('Content-Type','application/json');const r=await fetch(`${PROJECT_URL}/rest/v1/${path}`,{...init,headers:h});if(!r.ok)throw new Error(`REST ${path}: ${r.status} ${await r.text()}`);return r}
async function rows(path:string){return await (await rest(path)).json()}
async function rpc(name:string,body:unknown){return await (await rest(`rpc/${name}`,{method:'POST',body:JSON.stringify(body)})).json()}
async function authorized(req:Request){const supplied=req.headers.get('x-dc-internal-key')||'';if(!supplied)return false;const expected=await rpc('read_social_platform_secret',{p_platform:'META',p_secret_kind:'EXECUTION_KEY'}).catch(()=>null);return typeof expected==='string'&&expected.length>=32&&supplied===expected}
function scopes(v:any){return new Set(Array.isArray(v)?v.map(String):[])}
function mediaList(v:any){if(!Array.isArray(v))return[];return v.map((x:any)=>typeof x==='string'?{url:x,type:'IMAGE'}:{url:x?.url||x?.source_url||x?.public_url,type:String(x?.type||x?.media_type||'IMAGE').toUpperCase()}).filter((x:any)=>/^https:\/\//i.test(x.url))}
function form(data:Record<string,any>){const f=new URLSearchParams();for(const [k,v] of Object.entries(data)){if(v===undefined||v===null)continue;f.set(k,typeof v==='object'?JSON.stringify(v):String(v))}return f}
async function graph(config:any,path:string,token:string,method='POST',data:Record<string,any>={}){const base=String(config.api_base_url||'https://graph.facebook.com').replace(/\/$/,'');const version=String(config.api_version||'').replace(/^v?/,'v');if(!config.enabled||config.config_status!=='READY'||!config.api_version)throw new Error('PLATFORM_CONFIG_NOT_READY');const url=`${base}/${version}/${path.replace(/^\//,'')}`;const body=form({...data,access_token:token});const r=await fetch(url,{method,headers:{'Content-Type':'application/x-www-form-urlencoded'},body:method==='GET'?undefined:body});const out=await r.json().catch(()=>({raw:null}));if(!r.ok||out?.error)throw new Error(`META_${out?.error?.code||r.status}: ${out?.error?.message||'request_failed'}`);return out}
function requireScope(conn:any,needed:string[]){const have=scopes(conn.granted_scopes);if(!needed.some(s=>have.has(s)))throw new Error(`MISSING_SCOPE:${needed.join('|')}`)}
async function sendReply(config:any,conn:any,p:any,token:string){const platform=String(conn.platform||p.platform||'').toUpperCase(),kind=String(p.message_type||'MESSAGE').toUpperCase(),text=String(p.reply_text||'').trim();if(!text)throw new Error('EMPTY_REPLY');if(kind==='COMMENT'){const cid=String(p.comment_external_id||'');if(!cid)throw new Error('MISSING_COMMENT_ID');if(platform==='INSTAGRAM'){requireScope(conn,['instagram_business_manage_comments']);return await graph(config,`${encodeURIComponent(cid)}/replies`,token,'POST',{message:text})}requireScope(conn,['pages_manage_engagement']);return await graph(config,`${encodeURIComponent(cid)}/comments`,token,'POST',{message:text})}const rid=String(p.recipient_external_id||'');if(!rid)throw new Error('MISSING_RECIPIENT_ID');if(platform==='INSTAGRAM')requireScope(conn,['instagram_business_manage_messages']);else requireScope(conn,['pages_messaging']);const data:any={recipient:{id:rid},message:{text}};if(platform!=='INSTAGRAM')data.messaging_type='RESPONSE';return await graph(config,`${encodeURIComponent(conn.external_account_id)}/messages`,token,'POST',data)}
async function publishInstagram(config:any,conn:any,p:any,token:string){requireScope(conn,['instagram_business_content_publish']);const list=mediaList(p.media_refs);if(!list.length)throw new Error('INSTAGRAM_PUBLIC_MEDIA_URL_REQUIRED');const acct=encodeURIComponent(conn.external_account_id),type=String(p.content_type||'POST').toUpperCase(),caption=String(p.caption||'');let creation:any;if(type==='CAROUSEL'&&list.length>1){const children=[];for(const m of list.slice(0,10)){const d:any={is_carousel_item:true};if(/VIDEO|REEL/.test(m.type)){d.media_type='VIDEO';d.video_url=m.url}else d.image_url=m.url;const child=await graph(config,`${acct}/media`,token,'POST',d);children.push(child.id)}creation=await graph(config,`${acct}/media`,token,'POST',{media_type:'CAROUSEL',children:children.join(','),caption})}else{const m=list[0],d:any={caption};if(type==='REEL'||/VIDEO|REEL/.test(m.type)){d.media_type='REELS';d.video_url=m.url}else if(type==='STORY'){d.media_type='STORIES';if(/VIDEO/.test(m.type))d.video_url=m.url;else d.image_url=m.url}else d.image_url=m.url;creation=await graph(config,`${acct}/media`,token,'POST',d)}if(!creation?.id)throw new Error('MEDIA_CONTAINER_NOT_CREATED');return await graph(config,`${acct}/media_publish`,token,'POST',{creation_id:creation.id})}
async function publishFacebook(config:any,conn:any,p:any,token:string){requireScope(conn,['pages_manage_posts']);const acct=encodeURIComponent(conn.external_account_id),caption=String(p.caption||''),list=mediaList(p.media_refs),type=String(p.content_type||'POST').toUpperCase();if(!list.length)return await graph(config,`${acct}/feed`,token,'POST',{message:caption});const m=list[0];if(type==='REEL'||/VIDEO|REEL/.test(m.type))return await graph(config,`${acct}/videos`,token,'POST',{file_url:m.url,description:caption});if(type==='STORY')throw new Error('FACEBOOK_STORY_REQUIRES_PLATFORM_SPECIFIC_ASSET_FLOW');const attached:any[]=[];for(const media of list.slice(0,10)){if(/VIDEO|REEL/.test(media.type))throw new Error('FACEBOOK_MIXED_MEDIA_REQUIRES_PLATFORM_SPECIFIC_FLOW');const uploaded=await graph(config,`${acct}/photos`,token,'POST',{url:media.url,published:false});if(!uploaded?.id)throw new Error('FACEBOOK_UNPUBLISHED_PHOTO_NOT_CREATED');attached.push({media_fbid:String(uploaded.id)})}return await graph(config,`${acct}/feed`,token,'POST',{message:caption,attached_media:attached})}
async function publishContent(config:any,conn:any,p:any,token:string){const platform=String(conn.platform||p.platform||'').toUpperCase();if(platform==='INSTAGRAM')return await publishInstagram(config,conn,p,token);if(platform==='FACEBOOK'||platform==='META')return await publishFacebook(config,conn,p,token);throw new Error(`UNSUPPORTED_PUBLISH_PLATFORM:${platform}`)}
async function deletePublishedContent(config:any,conn:any,p:any,token:string){requireScope(conn,['pages_manage_posts']);const targets=[String(p.external_post_id||''),String(p.external_photo_id||'')].filter((v,i,a)=>v&&a.indexOf(v)===i);if(!targets.length)throw new Error('MISSING_EXTERNAL_POST_ID');let last:any=null;for(const target of targets){try{const result=await graph(config,encodeURIComponent(target),token,'DELETE');return {...(result||{}),deleted_id:target}}catch(e){last=e}}throw last||new Error('DELETE_CONTENT_FAILED')}
async function executeAd(config:any,conn:any,p:any,token:string){requireScope(conn,['ads_management']);const action=String(p.action_type||'').toUpperCase(),proposed=p.proposed||{},campaignExternal=String(p.external_campaign_id||'');if(action==='CREATE_CAMPAIGN'){const adacct=String(p.external_ad_account_id||'').replace(/^act_/,'');if(!adacct)throw new Error('MISSING_AD_ACCOUNT_ID');const d:any={name:p.campaign_name||'Digital Compass Campaign',objective:p.objective,status:'PAUSED',special_ad_categories:proposed.special_ad_categories||[]};return await graph(config,`act_${encodeURIComponent(adacct)}/campaigns`,token,'POST',d)}if(action==='PAUSE'||action==='RESUME'){if(!campaignExternal)throw new Error('MISSING_EXTERNAL_CAMPAIGN_ID');return await graph(config,encodeURIComponent(campaignExternal),token,'POST',{status:action==='PAUSE'?'PAUSED':'ACTIVE'})}if(action==='BUDGET_CHANGE'){const target=String(proposed.external_adset_id||campaignExternal||'');if(!target)throw new Error('MISSING_BUDGET_TARGET_ID');const d:any={};if(proposed.daily_budget!=null)d.daily_budget=proposed.daily_budget;if(proposed.lifetime_budget!=null)d.lifetime_budget=proposed.lifetime_budget;if(!Object.keys(d).length)throw new Error('MISSING_BUDGET_VALUE');return await graph(config,encodeURIComponent(target),token,'POST',d)}if(action==='TARGETING_CHANGE'){const adset=String(proposed.external_adset_id||'');if(!adset)throw new Error('MISSING_ADSET_ID');if(!proposed.targeting)throw new Error('MISSING_TARGETING');return await graph(config,encodeURIComponent(adset),token,'POST',{targeting:proposed.targeting})}throw new Error(`UNSUPPORTED_AD_ACTION:${action}`)}
async function finishJob(job:any,status:string,result:any={},error:string|null=null){await rest(`social_execution_jobs?id=eq.${job.id}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status,external_result:result||{},last_error:error,completed_at:['SUCCEEDED','FAILED','CANCELLED'].includes(status)?new Date().toISOString():null,updated_at:new Date().toISOString()})});if(status==='SUCCEEDED'){if(job.job_type==='SEND_REPLY')await rest(`social_inbox_items?id=eq.${encodeURIComponent(job.entity_id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({response_status:'SENT',reply_external_id:String(result?.message_id||result?.id||''),response_sent_at:new Date().toISOString(),updated_at:new Date().toISOString()})});if(job.job_type==='PUBLISH_CONTENT'){const source=await rows(`social_publish_jobs?id=eq.${encodeURIComponent(job.entity_id)}&select=id,content_item_id&limit=1`);await rest(`social_publish_jobs?id=eq.${encodeURIComponent(job.entity_id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:'PUBLISHED',external_post_id:String(result?.id||result?.post_id||''),published_at:new Date().toISOString(),updated_at:new Date().toISOString()})});if(source[0]?.content_item_id)await rest(`social_content_items?id=eq.${source[0].content_item_id}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({publishing_status:'PUBLISHED',external_post_id:String(result?.id||result?.post_id||''),updated_at:new Date().toISOString()})})}if(job.job_type==='EXECUTE_AD_ACTION')await rest(`social_ad_actions?id=eq.${encodeURIComponent(job.entity_id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:'EXECUTED',external_result:result||{},executed_at:new Date().toISOString(),updated_at:new Date().toISOString()})})}if(status==='FAILED'&&job.job_type==='PUBLISH_CONTENT')await rest(`social_publish_jobs?id=eq.${encodeURIComponent(job.entity_id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:'FAILED',error_message:error,updated_at:new Date().toISOString()})});if(status==='FAILED'&&job.job_type==='EXECUTE_AD_ACTION')await rest(`social_ad_actions?id=eq.${encodeURIComponent(job.entity_id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:'FAILED',error_message:error,updated_at:new Date().toISOString()})})}
async function selectCredential(conn:any,job:any){
  const platform=String(conn.platform||'').toUpperCase();
  const primaryScopes=Array.isArray(conn.granted_scopes)?conn.granted_scopes.map(String):[];
  const managementScopes=Array.isArray(conn.management_granted_scopes)?conn.management_granted_scopes.map(String):[];
  let required:string|null=null;

  if(platform==='FACEBOOK'||platform==='META'){
    if(job.job_type==='SEND_REPLY'&&String(job.payload?.message_type||'MESSAGE').toUpperCase()==='COMMENT')required='pages_manage_engagement';
    else if(job.job_type==='PUBLISH_CONTENT'||job.job_type==='DELETE_CONTENT')required='pages_manage_posts';
    else if(job.job_type==='EXECUTE_AD_ACTION')required='ads_management';
    else if(job.job_type==='SEND_REPLY')required='pages_messaging';
  }

  const managementUsable=required&&managementScopes.includes(required)&&conn.management_token_reference;
  const managementExpired=Boolean(conn.management_expires_at&&new Date(conn.management_expires_at).getTime()<=Date.now());
  if(managementUsable&&!managementExpired){
    const x=await rpc('read_social_connection_management_token',{p_connection_id:conn.id}).catch(()=>null);
    const token=Array.isArray(x)?x[0]:x;
    if(token)return {token:String(token),scopes:managementScopes,kind:'MANAGEMENT'};
  }

  if(conn.expires_at&&new Date(conn.expires_at).getTime()<=Date.now())throw new Error('CONNECTION_TOKEN_EXPIRED');
  const x=await rpc('read_social_connection_token',{p_connection_id:conn.id}).catch(()=>null);
  const token=Array.isArray(x)?x[0]:x;
  if(!token)throw new Error('CONNECTION_TOKEN_MISSING');
  return {token:String(token),scopes:primaryScopes,kind:'PRIMARY'};
}

async function processOne(job:any,config:any){
  let conn:any=null;
  try{
    if(!job.connection_id)throw new Error('CONNECTION_REQUIRED');
    const cs=await rows(`social_account_connections?id=eq.${job.connection_id}&select=*&limit=1`);
    conn=cs[0];
    if(!conn||conn.connection_status!=='CONNECTED'||!conn.authorized_by_client)throw new Error('CONNECTION_NOT_AUTHORIZED');
    if(!conn.external_account_id)throw new Error('MISSING_EXTERNAL_ACCOUNT_ID');
    if(!config?.enabled||config?.config_status!=='READY'||!config?.api_version)throw new Error('PLATFORM_CONFIG_NOT_READY');

    const cred=await selectCredential(conn,job);
    const execConn={...conn,granted_scopes:cred.scopes};

    await rest(`social_execution_jobs?id=eq.${job.id}&status=in.(QUEUED,BLOCKED_CONNECTION)&select=id`,{
      method:'PATCH',
      headers:{Prefer:'return=minimal'},
      body:JSON.stringify({
        status:'RUNNING',
        started_at:new Date().toISOString(),
        attempts:Number(job.attempts||0)+1,
        updated_at:new Date().toISOString()
      })
    });

    let result:any;
    if(job.job_type==='SEND_REPLY')result=await sendReply(config,execConn,job.payload||{},cred.token);
    else if(job.job_type==='PUBLISH_CONTENT')result=await publishContent(config,execConn,job.payload||{},cred.token);
    else if(job.job_type==='DELETE_CONTENT')result=await deletePublishedContent(config,execConn,job.payload||{},cred.token);
    else if(job.job_type==='EXECUTE_AD_ACTION')result=await executeAd(config,execConn,job.payload||{},cred.token);
    else throw new Error(`UNSUPPORTED_JOB_TYPE:${job.job_type}`);

    const safeResult={...(result||{}),credential_kind:cred.kind};
    await finishJob(job,'SUCCEEDED',safeResult,null);
    await rest(`social_account_connections?id=eq.${conn.id}`,{
      method:'PATCH',
      headers:{Prefer:'return=minimal'},
      body:JSON.stringify({last_sync_at:new Date().toISOString(),sync_status:'OK',updated_at:new Date().toISOString()})
    });
    return {id:job.id,status:'SUCCEEDED',credential_kind:cred.kind};
  }catch(e){
    const msg=e instanceof Error?e.message:String(e);
    const blocked=/CONNECTION_|MANAGEMENT_TOKEN_|PLATFORM_CONFIG_NOT_READY|MISSING_SCOPE/.test(msg);
    await finishJob(job,blocked?'BLOCKED_CONNECTION':'FAILED',{},msg);
    if(conn?.id)await rest(`social_account_connections?id=eq.${conn.id}`,{
      method:'PATCH',
      headers:{Prefer:'return=minimal'},
      body:JSON.stringify({sync_status:blocked?'BLOCKED':'ERROR',updated_at:new Date().toISOString()})
    }).catch(()=>{});
    return {id:job.id,status:blocked?'BLOCKED_CONNECTION':'FAILED',error:msg};
  }
}
Deno.serve(async(req:Request)=>{if(req.method==='OPTIONS')return new Response('ok',{headers:cors});if(req.method!=='POST')return json({error:'method_not_allowed'},405);try{if(!(await authorized(req)))return json({error:'forbidden'},403);const config=(await rows('social_platform_configs?platform=eq.META&select=*&limit=1'))[0]||null;const body=await req.json().catch(()=>({}));const limit=Math.min(Math.max(Number(body.limit||10),1),25);const jobs=await rows(`social_execution_jobs?status=in.(QUEUED,BLOCKED_CONNECTION)&scheduled_at=lte.${encodeURIComponent(new Date().toISOString())}&select=*&order=scheduled_at.asc,id.asc&limit=${limit}`);const results=[];for(const job of jobs)results.push(await processOne(job,config));return json({ok:true,processed:results.length,results,platform_ready:Boolean(config?.enabled&&config?.config_status==='READY'&&config?.api_version)})}catch(e){console.error(e);return json({error:'execution_worker_unavailable'},503)}});