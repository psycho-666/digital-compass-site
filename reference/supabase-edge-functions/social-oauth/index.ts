const PROJECT_URL=Deno.env.get('SUPABASE_URL')!;
const SECRET_KEYS=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}');
const SECRET_KEY=SECRET_KEYS['default'];
const FRONTEND='https://psycho-666.github.io/digital-compass-site/admin/social-management.html';
const CALLBACK=`${PROJECT_URL}/functions/v1/social-oauth?action=callback`;
const WEBHOOK_CALLBACK=`${PROJECT_URL}/functions/v1/social-meta-webhook`;
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'apikey, authorization, content-type','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Cache-Control':'no-store'};
function json(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json; charset=utf-8','X-Robots-Tag':'noindex, nofollow, noarchive'}})}
function jwtSub(req:Request){try{const raw=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');const p=raw.split('.')[1];if(!p)return'';const s=p.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(p.length/4)*4,'=');return String(JSON.parse(atob(s)).sub||'')}catch{return''}}
async function rest(path:string,init:RequestInit={}){const h=new Headers(init.headers||{});h.set('apikey',SECRET_KEY);h.set('Authorization',`Bearer ${SECRET_KEY}`);if(init.body&&!h.has('Content-Type'))h.set('Content-Type','application/json');const r=await fetch(`${PROJECT_URL}/rest/v1/${path}`,{...init,headers:h});if(!r.ok)throw new Error(`REST_${r.status}:${await r.text()}`);return r}
async function rows(path:string){return await (await rest(path)).json()}
async function rpc(name:string,body:unknown={}){return await (await rest(`rpc/${name}`,{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(body)})).json()}
async function isAdmin(uid:string){if(!uid)return false;return (await rows(`admin_users?user_id=eq.${encodeURIComponent(uid)}&select=user_id&limit=1`)).length===1}
async function metaConfig(){const a=await rows('social_platform_configs?platform=eq.META&select=*&limit=1');return a[0]||null}
async function appSecret(){const x=await rpc('read_social_platform_secret',{p_platform:'META',p_secret_kind:'APP_SECRET'}).catch(()=>null);return Array.isArray(x)?x[0]:x}
async function webhookVerifyToken(){const x=await rpc('read_social_platform_secret',{p_platform:'META',p_secret_kind:'WEBHOOK_VERIFY_TOKEN'}).catch(()=>null);return Array.isArray(x)?x[0]:x}
function ready(c:any,secret:string|null){return Boolean(c?.enabled&&c?.config_status==='READY'&&c?.app_id&&c?.login_config_id&&c?.api_version&&secret)}
function randomState(){const b=new Uint8Array(24);crypto.getRandomValues(b);return Array.from(b,x=>x.toString(16).padStart(2,'0')).join('')}
function redirect(params:Record<string,string>){const u=new URL(FRONTEND);for(const [k,v] of Object.entries(params))u.searchParams.set(k,v);return Response.redirect(u.toString(),302)}
async function graphJson(url:string,init:RequestInit={}){const r=await fetch(url,init);const d=await r.json().catch(()=>({}));if(!r.ok||d?.error)throw new Error(`META_${d?.error?.code||r.status}:${d?.error?.message||'request_failed'}`);return d}
async function accountAssets(c:any,userToken:string){const fields='id,name,access_token,tasks,instagram_business_account{id,username,name}';const u=new URL(`${String(c.api_base_url||'https://graph.facebook.com').replace(/\/$/,'')}/${c.api_version}/me/accounts`);u.searchParams.set('fields',fields);u.searchParams.set('limit','100');u.searchParams.set('access_token',userToken);const d=await graphJson(u.toString());return Array.isArray(d.data)?d.data:[]}
async function specificPageAccess(c:any,userToken:string,pageId:string){
  const u=new URL(`${String(c.api_base_url||'https://graph.facebook.com').replace(/\/$/,'')}/${c.api_version}/${encodeURIComponent(pageId)}`);
  u.searchParams.set('fields','id,name,access_token');
  u.searchParams.set('access_token',userToken);
  const d=await graphJson(u.toString());
  return d?.id&&d?.access_token?{id:String(d.id),name:String(d.name||d.id),access_token:String(d.access_token)}:null;
}
async function permissions(c:any,userToken:string){const u=new URL(`${String(c.api_base_url||'https://graph.facebook.com').replace(/\/$/,'')}/${c.api_version}/me/permissions`);u.searchParams.set('access_token',userToken);const d=await graphJson(u.toString()).catch(()=>({data:[]}));return (d.data||[]).filter((x:any)=>x.status==='granted').map((x:any)=>String(x.permission))}
async function debugMetaToken(c:any,secret:string,token:string){
  const u=new URL(`${String(c.api_base_url||'https://graph.facebook.com').replace(/\/$/,'')}/${c.api_version}/debug_token`);
  u.searchParams.set('input_token',token);
  u.searchParams.set('access_token',`${c.app_id}|${secret}`);
  const d=await graphJson(u.toString());
  return d?.data||{};
}
async function pageIdentity(c:any,token:string,dbg:any={}){
  const base=String(c.api_base_url||'https://graph.facebook.com').replace(/\/$/,'');
  const profileId=String(dbg?.profile_id||'').trim();
  const candidates=[profileId,'me'].filter((v,i,a)=>v&&a.indexOf(v)===i);
  let page:any=null;
  let lastError:any=null;
  for(const id of candidates){
    try{
      const u=new URL(`${base}/${c.api_version}/${encodeURIComponent(id)}`);
      u.searchParams.set('fields','id,name');
      u.searchParams.set('access_token',token);
      const d=await graphJson(u.toString());
      if(d?.id){page={id:String(d.id),name:String(d.name||d.id)};break}
    }catch(e){lastError=e}
  }
  if(!page)throw lastError||new Error('page_identity_unavailable');
  try{
    const u=new URL(`${base}/${c.api_version}/${encodeURIComponent(page.id)}`);
    u.searchParams.set('fields','instagram_business_account{id,username,name}');
    u.searchParams.set('access_token',token);
    const d=await graphJson(u.toString());
    if(d?.instagram_business_account)page.instagram_business_account=d.instagram_business_account;
  }catch{}
  return page;
}
async function longLivedToken(c:any,secret:string,token:string){try{const u=new URL(`${String(c.api_base_url||'https://graph.facebook.com').replace(/\/$/,'')}/${c.api_version}/oauth/access_token`);u.searchParams.set('grant_type','fb_exchange_token');u.searchParams.set('client_id',String(c.app_id));u.searchParams.set('client_secret',secret);u.searchParams.set('fb_exchange_token',token);const d=await graphJson(u.toString());return {token:String(d.access_token||token),expires_in:Number(d.expires_in||0)}}catch{return {token,expires_in:0}}}
async function upsertConnection(workspace:any,platform:string,externalId:string,profileId:number|null,token:string,scopes:string[],expiresAt:string|null){const now=new Date().toISOString();const body={workspace_id:workspace.id,social_profile_id:profileId,platform,external_account_id:externalId,connection_status:'CONNECTED',granted_scopes:scopes,authorized_by_client:true,connected_at:now,expires_at:expiresAt,last_sync_at:null,sync_status:'READY',updated_at:now};const r=await rest('social_account_connections?on_conflict=workspace_id,platform,external_account_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(body)});const item=(await r.json())[0];if(!item?.id)throw new Error('connection_write_failed');await rpc('store_social_connection_token',{p_connection_id:item.id,p_token:token,p_expires_at:expiresAt});if(platform==='FACEBOOK'&&scopes.includes('pages_manage_metadata')){await rpc('store_social_connection_management_token',{p_connection_id:item.id,p_token:token,p_scopes:scopes,p_expires_at:expiresAt});}return item}

async function subscribePageWebhooks(c:any,pageId:string,token:string,scopesIn:any){
  const have=new Set(Array.isArray(scopesIn)?scopesIn.map(String):[]);
  if(!have.has('pages_manage_metadata')) return {ok:false,skipped:true,reason:'MISSING_SCOPE:pages_manage_metadata'};
  const base=String(c.api_base_url||'https://graph.facebook.com').replace(/\/$/,'');
  const version=String(c.api_version||'').replace(/^v?/,'v');
  const u=`${base}/${version}/${encodeURIComponent(pageId)}/subscribed_apps`;
  const desired=new Set(['feed','messages','messaging_postbacks']);
  try{
    const q=new URL(u);
    q.searchParams.set('access_token',token);
    const current=await graphJson(q.toString());
    for(const app of Array.isArray(current?.data)?current.data:[]){
      if(String(app?.id||'')===String(c.app_id)){
        for(const f of Array.isArray(app?.subscribed_fields)?app.subscribed_fields:[]) desired.add(String(f));
      }
    }
  }catch{}
  const fields=Array.from(desired);
  const body=new URLSearchParams({subscribed_fields:fields.join(','),access_token:token});
  const r=await fetch(u,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});
  const d=await r.json().catch(()=>({}));
  if(!r.ok||d?.error) return {ok:false,skipped:false,error:d?.error?.message||`HTTP_${r.status}`,code:d?.error?.code||r.status,fields};
  return {ok:Boolean(d?.success??true),skipped:false,fields};
}
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 const u=new URL(req.url),action=u.searchParams.get('action')||'status';
 try{
  if(action==='callback'&&req.method==='GET'){
    const state=String(u.searchParams.get('state')||''),code=String(u.searchParams.get('code')||''),err=String(u.searchParams.get('error')||'');
    if(!state)return redirect({oauth:'error',reason:'missing_state'});
    const ss=(await rows(`social_oauth_sessions?state_token=eq.${encodeURIComponent(state)}&select=*&limit=1`))[0];
    if(!ss||ss.status!=='PENDING'||new Date(ss.expires_at).getTime()<=Date.now())return redirect({oauth:'error',reason:'expired_session'});
    if(err||!code){await rest(`social_oauth_sessions?id=eq.${ss.id}`,{method:'PATCH',body:JSON.stringify({status:'FAILED',error_code:err||'oauth_denied',updated_at:new Date().toISOString()})});return redirect({oauth:'error',reason:err||'oauth_denied'});}
    const c=await metaConfig(),secret=await appSecret();if(!ready(c,secret))return redirect({oauth:'error',reason:'meta_not_configured'});
    const tu=new URL(`${String(c.api_base_url||'https://graph.facebook.com').replace(/\/$/,'')}/${c.api_version}/oauth/access_token`);tu.searchParams.set('client_id',String(c.app_id));tu.searchParams.set('client_secret',String(secret));tu.searchParams.set('redirect_uri',CALLBACK);tu.searchParams.set('code',code);
    const short=await graphJson(tu.toString());const ll=await longLivedToken(c,String(secret),String(short.access_token));const token=ll.token;const assets=await accountAssets(c,token);const safeAssets=assets.map((x:any)=>({page_id:String(x.id),page_name:String(x.name||x.id),tasks:Array.isArray(x.tasks)?x.tasks:[],instagram_business_account:x.instagram_business_account?{id:String(x.instagram_business_account.id),username:x.instagram_business_account.username||null,name:x.instagram_business_account.name||null}:null}));
    const exp=ll.expires_in>0?new Date(Date.now()+ll.expires_in*1000).toISOString():null;await rpc('store_social_oauth_token',{p_state:state,p_token:token,p_expires_at:exp});await rest(`social_oauth_sessions?id=eq.${ss.id}`,{method:'PATCH',body:JSON.stringify({status:'ASSET_SELECTION',assets:safeAssets,token_expires_at:exp,updated_at:new Date().toISOString()})});
    return redirect({oauth:'select',state,workspace:String(ss.workspace_id)});
  }
  const uid=jwtSub(req);if(!(await isAdmin(uid)))return json({error:'forbidden'},403);
  const c=await metaConfig(),secret=await appSecret();
  if(req.method==='GET'&&action==='status'){const webhookToken=await webhookVerifyToken();return json({platform:'META',ready:ready(c,secret),webhook_ready:Boolean(webhookToken),enabled:Boolean(c?.enabled),config_status:c?.config_status||'NOT_CONFIGURED',app_id_configured:Boolean(c?.app_id),app_secret_configured:Boolean(secret),login_config_id_configured:Boolean(c?.login_config_id),webhook_verify_token_configured:Boolean(webhookToken),api_version:c?.api_version||null,callback_url:CALLBACK,webhook_callback_url:WEBHOOK_CALLBACK,required_scopes:c?.required_scopes||[]})}
  if(req.method==='POST'&&action==='configure_webhook'){
    const b=await req.json(),webhookToken=String(b.webhook_verify_token||'').trim();
    if(webhookToken.length<16)return json({error:'webhook_verify_token_too_short'},400);
    await rpc('store_social_platform_secret',{p_platform:'META',p_secret_kind:'WEBHOOK_VERIFY_TOKEN',p_secret:webhookToken});
    const saved=await webhookVerifyToken();
    return json({ok:Boolean(saved),webhook_ready:Boolean(saved),webhook_callback_url:WEBHOOK_CALLBACK});
  }
  if(req.method==='POST'&&action==='configure_meta'){
    const b=await req.json(),appId=String(b.app_id||c?.app_id||'').trim(),appSecretValue=String(b.app_secret||'').trim(),apiVersion=String(b.api_version||c?.api_version||'').trim(),loginConfigId=String(b.login_config_id||c?.login_config_id||'').trim(),webhookToken=String(b.webhook_verify_token||'').trim();if(!/^\d+$/.test(appId)||!/^\d+$/.test(loginConfigId)||!/^v\d+\.\d+$/.test(apiVersion))return json({error:'invalid_meta_config'},400);
    if(appSecretValue)await rpc('store_social_platform_secret',{p_platform:'META',p_secret_kind:'APP_SECRET',p_secret:appSecretValue});
    if(webhookToken){if(webhookToken.length<16)return json({error:'webhook_verify_token_too_short'},400);await rpc('store_social_platform_secret',{p_platform:'META',p_secret_kind:'WEBHOOK_VERIFY_TOKEN',p_secret:webhookToken})}
    const sec=appSecretValue||await appSecret();if(!sec)return json({error:'app_secret_required'},400);
    await rest('social_platform_configs?platform=eq.META',{method:'PATCH',body:JSON.stringify({app_id:appId,login_config_id:loginConfigId,api_version:apiVersion,enabled:true,config_status:'READY',updated_at:new Date().toISOString()})});return json({ok:true,callback_url:CALLBACK,webhook_callback_url:WEBHOOK_CALLBACK,webhook_ready:Boolean(webhookToken||await webhookVerifyToken())});
  }

  if(req.method==='POST'&&action==='diagnose_webhook_subscriptions'){
    const b=await req.json(),wid=Number(b.workspace_id);
    if(!Number.isFinite(wid)||wid<=0)return json({error:'invalid_workspace'},400);
    const conns=await rows(`social_account_connections?workspace_id=eq.${wid}&platform=eq.FACEBOOK&connection_status=eq.CONNECTED&authorized_by_client=eq.true&select=id,external_account_id,granted_scopes,management_granted_scopes&order=id.asc`);
    const pages:any[]=[];
    for(const conn of conns){
      const primaryScopes=Array.isArray(conn.granted_scopes)?conn.granted_scopes.map(String):[];
      const managementScopes=Array.isArray(conn.management_granted_scopes)?conn.management_granted_scopes.map(String):[];
      let token:any=null,credential='NONE';
      if(managementScopes.includes('pages_manage_metadata')){
        const x=await rpc('read_social_connection_management_token',{p_connection_id:conn.id}).catch(()=>null);
        token=Array.isArray(x)?x[0]:x;if(token)credential='MANAGEMENT';
      }
      if(!token&&primaryScopes.includes('pages_manage_metadata')){
        const x=await rpc('read_social_connection_token',{p_connection_id:conn.id}).catch(()=>null);
        token=Array.isArray(x)?x[0]:x;if(token)credential='PRIMARY';
      }
      if(!token){pages.push({connection_id:conn.id,page_id:String(conn.external_account_id),readable:false,reason:'NO_READABLE_MANAGEMENT_TOKEN'});continue}
      const base0=String(c?.api_base_url||'https://graph.facebook.com');
      const base=base0.endsWith('/')?base0.slice(0,-1):base0;
      const version=String(c?.api_version||'').replace(/^v?/,'v');
      const q=new URL(`${base}/${version}/${encodeURIComponent(String(conn.external_account_id))}/subscribed_apps`);
      q.searchParams.set('access_token',String(token));
      try{
        const d=await graphJson(q.toString());
        const mine=(Array.isArray(d?.data)?d.data:[]).find((x:any)=>String(x?.id||'')===String(c?.app_id));
        pages.push({connection_id:conn.id,page_id:String(conn.external_account_id),readable:true,credential,app_subscribed:Boolean(mine),subscribed_fields:Array.isArray(mine?.subscribed_fields)?mine.subscribed_fields.map(String):[]});
      }catch(e){pages.push({connection_id:conn.id,page_id:String(conn.external_account_id),readable:false,credential,error:String(e instanceof Error?e.message:'META_READ_FAILED')})}
    }
    let app:any={checked:false};
    if(c?.app_id&&secret){
      const base0=String(c.api_base_url||'https://graph.facebook.com');
      const base=base0.endsWith('/')?base0.slice(0,-1):base0;
      const version=String(c.api_version||'').replace(/^v?/,'v');
      const q=new URL(`${base}/${version}/${encodeURIComponent(String(c.app_id))}/subscriptions`);
      q.searchParams.set('access_token',`${c.app_id}|${secret}`);
      try{const d=await graphJson(q.toString());app={checked:true,subscriptions:(Array.isArray(d?.data)?d.data:[]).map((x:any)=>({object:String(x?.object||''),fields:Array.isArray(x?.fields)?x.fields.map((f:any)=>String(f?.name||f)):[]}))};}
      catch(e){app={checked:true,readable:false,error:String(e instanceof Error?e.message:'META_APP_READ_FAILED')}}
    }
    return json({ok:true,app_id_configured:Boolean(c?.app_id),app,pages});
  }
  if(req.method==='POST'&&action==='subscribe_page_webhooks'){
    const b=await req.json(),wid=Number(b.workspace_id),connectionId=Number(b.connection_id||0);
    if(!Number.isFinite(wid)||wid<=0)return json({error:'invalid_workspace'},400);
    const q=connectionId
      ? `social_account_connections?id=eq.${connectionId}&workspace_id=eq.${wid}&platform=eq.FACEBOOK&connection_status=eq.CONNECTED&authorized_by_client=eq.true&select=*&limit=1`
      : `social_account_connections?workspace_id=eq.${wid}&platform=eq.FACEBOOK&connection_status=eq.CONNECTED&authorized_by_client=eq.true&select=*&order=connected_at.desc.nullslast,id.desc&limit=1`;
    const conn=(await rows(q))[0]||null;
    if(!conn)return json({error:'facebook_connection_not_found'},404);
    const primaryScopes=Array.isArray(conn.granted_scopes)?conn.granted_scopes.map(String):[];
    const managementScopes=Array.isArray(conn.management_granted_scopes)?conn.management_granted_scopes.map(String):[];
    let tok:any=null,scopesUsed:string[]=[],credential='PRIMARY';
    if(managementScopes.includes('pages_manage_metadata')){
      const x=await rpc('read_social_connection_management_token',{p_connection_id:conn.id}).catch(()=>null);
      tok=Array.isArray(x)?x[0]:x;scopesUsed=managementScopes;credential='MANAGEMENT';
    }
    if(!tok&&primaryScopes.includes('pages_manage_metadata')){
      const x=await rpc('read_social_connection_token',{p_connection_id:conn.id}).catch(()=>null);
      tok=Array.isArray(x)?x[0]:x;scopesUsed=primaryScopes;credential='PRIMARY';
    }
    if(!tok)return json({error:'missing_scope',required:['pages_manage_metadata']},409);
    let result=await subscribePageWebhooks(c,String(conn.external_account_id),String(tok),scopesUsed);
    let fallbackError:any=null;
    if(!result?.ok && credential==='MANAGEMENT' && primaryScopes.includes('pages_manage_metadata')){
      const primary=await rpc('read_social_connection_token',{p_connection_id:conn.id}).catch(()=>null);
      const primaryToken=Array.isArray(primary)?primary[0]:primary;
      if(primaryToken){
        const retry=await subscribePageWebhooks(c,String(conn.external_account_id),String(primaryToken),primaryScopes);
        if(retry?.ok){result=retry;credential='PRIMARY_FALLBACK';}
        else fallbackError=retry;
      }
    }
    if(!result?.ok)return json({error:'webhook_subscription_failed',details:result,primary_fallback_error:fallbackError},409);
    return json({ok:true,credential,subscription:result});
  }

  if(req.method==='POST'&&action==='uat_management_token'){
    const b=await req.json(),wid=Number(b.workspace_id),inputToken=String(b.management_access_token||'').trim();
    if(!Number.isFinite(wid)||wid<=0||inputToken.length<20)return json({error:'invalid_input'},400);
    if(!c?.app_id||!secret)return json({error:'meta_not_configured'},409);

    const conn=(await rows(`social_account_connections?workspace_id=eq.${wid}&platform=eq.FACEBOOK&connection_status=eq.CONNECTED&authorized_by_client=eq.true&select=*&order=connected_at.desc.nullslast,id.desc&limit=1`))[0]||null;
    if(!conn?.external_account_id)return json({error:'facebook_connection_not_found'},404);
    const targetPageId=String(conn.external_account_id);

    const dbg=await debugMetaToken(c,String(secret),inputToken).catch(()=>null);
    if(!dbg?.is_valid)return json({error:'invalid_management_token'},409);
    if(String(dbg.app_id||'')!==String(c.app_id))return json({error:'token_app_mismatch'},409);

    let effectiveToken='';
    let resolution='';
    let pageName=targetPageId;

    if(String(dbg?.type||'').toUpperCase()==='PAGE'&&String(dbg?.profile_id||'')===targetPageId){
      effectiveToken=inputToken;
      resolution='DIRECT_PAGE_TOKEN';
    }else{
      const assets=await accountAssets(c,inputToken).catch(()=>[]);
      const page=assets.find((x:any)=>String(x.id)===targetPageId);
      if(page?.access_token){
        effectiveToken=String(page.access_token);
        pageName=String(page.name||targetPageId);
        resolution='ME_ACCOUNTS';
      }
      if(!effectiveToken){
        const direct=await specificPageAccess(c,inputToken,targetPageId).catch(()=>null);
        if(direct?.access_token){
          effectiveToken=String(direct.access_token);
          pageName=String(direct.name||targetPageId);
          resolution='SPECIFIC_PAGE_ACCESS';
        }
      }
    }

    if(!effectiveToken){
      const granular=Array.isArray(dbg?.granular_scopes)?dbg.granular_scopes:[];
      const targetIds=[...new Set(granular.flatMap((x:any)=>Array.isArray(x?.target_ids)?x.target_ids.map(String):[]))];
      return json({
        error:'connected_page_not_available_in_token',
        page_id:targetPageId,
        diagnostic:{
          token_type:String(dbg?.type||'UNKNOWN'),
          scopes:Array.isArray(dbg?.scopes)?dbg.scopes.map(String):[],
          target_page_authorized:targetIds.includes(targetPageId),
          target_ids_count:targetIds.length
        }
      },409);
    }

    const effectiveDbg=await debugMetaToken(c,String(secret),effectiveToken).catch(()=>null);
    const scopeSet=new Set<string>();
    for(const s of Array.isArray(effectiveDbg?.scopes)?effectiveDbg.scopes:[])scopeSet.add(String(s));
    for(const s of await permissions(c,effectiveToken).catch(()=>[]))scopeSet.add(String(s));
    for(const s of await permissions(c,inputToken).catch(()=>[]))scopeSet.add(String(s));
    const scopes=Array.from(scopeSet);
    const expiresRaw=Number(effectiveDbg?.expires_at||dbg?.expires_at||0);
    const expiresAt=expiresRaw>0?new Date(expiresRaw*1000).toISOString():null;

    if(!scopes.includes('pages_manage_metadata')){
      return json({error:'missing_management_scope',required:['pages_manage_metadata'],granted_scopes:scopes},409);
    }

    await rpc('store_social_connection_management_token',{
      p_connection_id:conn.id,
      p_token:effectiveToken,
      p_scopes:scopes,
      p_expires_at:expiresAt
    });

    const subscription=await subscribePageWebhooks(c,targetPageId,effectiveToken,scopes)
      .catch((e:any)=>({ok:false,skipped:false,error:String(e?.message||e)}));

    if(!subscription?.ok){
      return json({
        error:'management_token_saved_but_webhook_subscription_failed',
        page:{id:targetPageId,name:pageName},
        granted_scopes:scopes,
        subscription
      },409);
    }

    await rest(`social_account_connections?id=eq.${conn.id}`,{
      method:'PATCH',
      headers:{Prefer:'return=minimal'},
      body:JSON.stringify({sync_status:'READY',updated_at:new Date().toISOString()})
    });

    return json({
      ok:true,
      mode:'UAT_MANAGEMENT_TOKEN',
      resolution,
      connection_id:conn.id,
      page:{id:targetPageId,name:pageName},
      granted_scopes:scopes,
      capabilities:{
        comments_reply:scopes.includes('pages_manage_engagement'),
        publishing:scopes.includes('pages_manage_posts'),
        page_read:scopes.includes('pages_read_engagement'),
        page_metadata:scopes.includes('pages_manage_metadata'),
        page_discovery:scopes.includes('pages_show_list'),
        insights:scopes.includes('read_insights')
      },
      webhook_subscription:subscription,
      expires_at:expiresAt
    });
  }

  if(req.method==='POST'&&action==='uat_page_token'){
    const b=await req.json(),wid=Number(b.workspace_id),inputToken=String(b.page_access_token||'').trim(),requestedPageId=String(b.page_id||'').trim();
    if(!Number.isFinite(wid)||inputToken.length<20)return json({error:'invalid_input'},400);
    const w=(await rows(`social_management_workspaces?id=eq.${wid}&select=id,company_id,workspace_status&limit=1`))[0];
    if(!w)return json({error:'workspace_not_found'},404);
    if(!c?.app_id||!secret)return json({error:'meta_not_configured'},409);

    const dbg=await debugMetaToken(c,String(secret),inputToken).catch(()=>null);
    if(!dbg?.is_valid)return json({error:'invalid_page_token'},409);
    if(String(dbg.app_id||'')!==String(c.app_id))return json({error:'token_app_mismatch'},409);

    let page:any=null;
    let effectiveToken=inputToken;
    let resolution='DIRECT';

    // 1) Direct page identity from profile_id / me.
    page=await pageIdentity(c,inputToken,dbg).catch(()=>null);

    // 2) Some Meta "Generate token" flows return a user/business token.
    // Resolve the real Page Access Token via /me/accounts.
    if(!page){
      const assets=await accountAssets(c,inputToken).catch(()=>[]);
      const candidates=requestedPageId?assets.filter((x:any)=>String(x.id)===requestedPageId):assets;
      if(!requestedPageId&&assets.length>1){
        return json({
          error:'page_selection_required',
          pages:assets.map((x:any)=>({id:String(x.id),name:String(x.name||x.id)}))
        },409);
      }
      const asset=candidates[0]||null;
      if(asset?.id&&asset?.access_token){
        page={id:String(asset.id),name:String(asset.name||asset.id),instagram_business_account:asset.instagram_business_account||null};
        effectiveToken=String(asset.access_token);
        resolution='ME_ACCOUNTS';
      }
    }

    if(!page?.id && String(dbg?.type||'').toUpperCase()==='PAGE' && dbg?.profile_id){
      page={id:String(dbg.profile_id),name:String(dbg.profile_id)};
      resolution='DEBUG_PROFILE_ID';
    }

    if(!page?.id)return json({
      error:'page_identity_unavailable',
      diagnostic:{
        token_type:String(dbg?.type||'UNKNOWN'),
        has_profile_id:Boolean(dbg?.profile_id),
        has_user_id:Boolean(dbg?.user_id),
        scopes_count:Array.isArray(dbg?.scopes)?dbg.scopes.length:0
      }
    },409);

    const effectiveDbg=effectiveToken===inputToken?dbg:await debugMetaToken(c,String(secret),effectiveToken).catch(()=>dbg);
    const scopes=Array.isArray(effectiveDbg?.scopes)?effectiveDbg.scopes.map((x:any)=>String(x)):[];
    const expiresAt=Number(effectiveDbg?.expires_at||dbg?.expires_at||0)>0?new Date(Number(effectiveDbg?.expires_at||dbg?.expires_at)*1000).toISOString():null;

    const fbProfile=(await rows(`social_profiles?company_id=eq.${w.company_id}&platform=eq.FACEBOOK&select=id&order=id.asc&limit=1`))[0]||null;
    const connected:any[]=[];
    connected.push(await upsertConnection(w,'FACEBOOK',String(page.id),fbProfile?.id||null,effectiveToken,scopes,expiresAt));

    if(page.instagram_business_account?.id){
      const igProfile=(await rows(`social_profiles?company_id=eq.${w.company_id}&platform=eq.INSTAGRAM&select=id&order=id.asc&limit=1`))[0]||null;
      connected.push(await upsertConnection(w,'INSTAGRAM',String(page.instagram_business_account.id),igProfile?.id||null,effectiveToken,scopes,expiresAt));
    }

    const webhookSubscription=await subscribePageWebhooks(c,String(page.id),effectiveToken,scopes).catch((e:any)=>({ok:false,skipped:false,error:String(e?.message||e)}));
    await rest(`social_management_workspaces?id=eq.${w.id}`,{method:'PATCH',body:JSON.stringify({workspace_status:'ACTIVE',updated_at:new Date().toISOString()})});
    return json({
      ok:true,
      mode:'UAT_PAGE_TOKEN',
      resolution,
      page:{id:String(page.id),name:String(page.name||page.id)},
      connected:connected.map(x=>({id:x.id,platform:x.platform,external_account_id:x.external_account_id,connection_status:x.connection_status})),
      webhook_subscription:webhookSubscription,
      expires_at:expiresAt
    });
  }
  if(req.method==='POST'&&action==='start'){
    const b=await req.json(),wid=Number(b.workspace_id);if(!Number.isFinite(wid))return json({error:'invalid_workspace'},400);const w=(await rows(`social_management_workspaces?id=eq.${wid}&select=id,company_id,workspace_status&limit=1`))[0];if(!w)return json({error:'workspace_not_found'},404);
    if(!ready(c,secret))return json({error:'meta_not_configured',setup:{callback_url:CALLBACK,app_id_configured:Boolean(c?.app_id),app_secret_configured:Boolean(secret),login_config_id_configured:Boolean(c?.login_config_id),api_version:c?.api_version||null,required_scopes:c?.required_scopes||[]}},409);
    const state=randomState();await rest('social_oauth_sessions',{method:'POST',body:JSON.stringify({state_token:state,workspace_id:wid,requested_by:uid,platform:'META',status:'PENDING',expires_at:new Date(Date.now()+20*60*1000).toISOString()})});
    const auth=new URL(`https://www.facebook.com/${c.api_version}/dialog/oauth`);
    const allowedScopes=new Set(['pages_show_list','pages_read_engagement','pages_manage_posts','pages_manage_metadata','pages_messaging','pages_manage_engagement']);
    const scopes=(Array.isArray(c.required_scopes)?c.required_scopes:[]).map(String).filter((scope:string)=>allowedScopes.has(scope));
    auth.searchParams.set('client_id',String(c.app_id));
    auth.searchParams.set('redirect_uri',CALLBACK);
    auth.searchParams.set('state',state);
    auth.searchParams.set('scope',scopes.join(','));
    auth.searchParams.set('response_type','code');
    auth.searchParams.set('auth_type','rerequest');
    return json({ok:true,authorization_url:auth.toString(),expires_in:1200});
  }
  if(req.method==='GET'&&action==='assets'){
    const state=String(u.searchParams.get('state')||'');const s=(await rows(`social_oauth_sessions?state_token=eq.${encodeURIComponent(state)}&requested_by=eq.${encodeURIComponent(uid)}&select=id,workspace_id,status,assets,expires_at,error_code&limit=1`))[0];if(!s)return json({error:'oauth_session_not_found'},404);if(new Date(s.expires_at).getTime()<=Date.now())return json({error:'oauth_session_expired'},410);return json({item:s});
  }
  if(req.method==='POST'&&action==='complete'){
    const b=await req.json(),state=String(b.state||'');
    const requested=Array.isArray(b.page_ids)?b.page_ids.map((x:any)=>String(x).trim()).filter(Boolean):[String(b.page_id||'').trim()].filter(Boolean);
    const pageIds=[...new Set(requested)];
    if(!state||!pageIds.length||pageIds.length>100)return json({error:'invalid_input',max_pages:100},400);
    const s=(await rows(`social_oauth_sessions?state_token=eq.${encodeURIComponent(state)}&requested_by=eq.${encodeURIComponent(uid)}&select=*&limit=1`))[0];
    if(!s||s.status!=='ASSET_SELECTION')return json({error:'oauth_session_not_ready'},409);
    if(new Date(s.expires_at).getTime()<=Date.now())return json({error:'oauth_session_expired'},410);
    const tokenRaw=await rpc('read_social_oauth_token',{p_state:state});
    const userToken=Array.isArray(tokenRaw)?tokenRaw[0]:tokenRaw;
    if(!userToken)return json({error:'oauth_token_missing'},409);
    const w=(await rows(`social_management_workspaces?id=eq.${s.workspace_id}&select=id,company_id,workspace_status&limit=1`))[0];
    if(!w)return json({error:'workspace_not_found'},404);
    const assets=await accountAssets(c,String(userToken));
    const selected=pageIds.map(id=>assets.find((x:any)=>String(x.id)===id)||null);
    const missing=pageIds.filter((id,i)=>!selected[i]?.access_token);
    if(missing.length)return json({error:'selected_pages_unavailable',page_ids:missing},404);
    const scopes=await permissions(c,String(userToken)),exp=s.token_expires_at||null;
    const fbProfile=(await rows(`social_profiles?company_id=eq.${w.company_id}&platform=eq.FACEBOOK&select=id&order=id.asc&limit=1`))[0]||null;
    const igProfile=(await rows(`social_profiles?company_id=eq.${w.company_id}&platform=eq.INSTAGRAM&select=id&order=id.asc&limit=1`))[0]||null;
    const connected:any[]=[],already:any[]=[],failures:any[]=[],webhookSubscriptions:any[]=[];
    for(const page of selected){
      const pageId=String(page.id);
      try{
        if(b.connect_facebook!==false){
          const existing=(await rows(`social_account_connections?workspace_id=eq.${w.id}&platform=eq.FACEBOOK&external_account_id=eq.${encodeURIComponent(pageId)}&select=id,platform,external_account_id,connection_status&limit=1`))[0];
          const refreshed=await upsertConnection(w,'FACEBOOK',pageId,fbProfile?.id||null,String(page.access_token),scopes,exp);
          if(existing)already.push({id:refreshed.id,platform:'FACEBOOK',external_account_id:pageId,refreshed:true});
          else connected.push(refreshed);
        }
        const ig=page.instagram_business_account;
        if(b.connect_instagram!==false&&ig?.id){
          const igId=String(ig.id);
          const existingIg=(await rows(`social_account_connections?workspace_id=eq.${w.id}&platform=eq.INSTAGRAM&external_account_id=eq.${encodeURIComponent(igId)}&select=id,platform,external_account_id,connection_status&limit=1`))[0];
          const refreshedIg=await upsertConnection(w,'INSTAGRAM',igId,igProfile?.id||null,String(page.access_token),scopes,exp);
          if(existingIg)already.push({id:refreshedIg.id,platform:'INSTAGRAM',external_account_id:igId,refreshed:true});
          else connected.push(refreshedIg);
        }
        const subscription=await subscribePageWebhooks(c,pageId,String(page.access_token),scopes)
          .catch((e:any)=>({ok:false,skipped:false,error:String(e?.message||e)}));
        webhookSubscriptions.push({page_id:pageId,page_name:String(page.name||pageId),...subscription});
      }catch(e){failures.push({page_id:pageId,reason:e instanceof Error?e.message:'connection_failed'})}
    }
    if(connected.length||already.length)await rest(`social_management_workspaces?id=eq.${w.id}`,{method:'PATCH',body:JSON.stringify({workspace_status:'ACTIVE',updated_at:new Date().toISOString()})});
    if(!failures.length)await rest(`social_oauth_sessions?id=eq.${s.id}`,{method:'PATCH',body:JSON.stringify({status:'COMPLETED',completed_at:new Date().toISOString(),updated_at:new Date().toISOString()})});
    return json({ok:failures.length===0,connected:connected.map(x=>({id:x.id,platform:x.platform,external_account_id:x.external_account_id,connection_status:x.connection_status})),already_connected:already,failures,selected_pages:pageIds.length,webhook_subscriptions:webhookSubscriptions});
  }
  return json({error:'not_found'},404);
 }catch(e){console.error(e);return json({error:'social_oauth_unavailable',detail:e instanceof Error?e.message:'unknown'},503)}
});