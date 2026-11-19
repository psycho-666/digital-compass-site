import webpush from 'npm:web-push@3.6.7';
const PROJECT_URL=Deno.env.get('SUPABASE_URL')!;
const SECRET_KEYS=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}');
const SECRET_KEY=SECRET_KEYS['default'];
function json(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow, noarchive'}})}
async function rest(path:string,init:RequestInit={}){const h=new Headers(init.headers||{});h.set('apikey',SECRET_KEY);h.set('Authorization',`Bearer ${SECRET_KEY}`);if(init.body)h.set('Content-Type','application/json');const r=await fetch(`${PROJECT_URL}/rest/v1/${path}`,{...init,headers:h});if(!r.ok)throw new Error(`${path}:${r.status}:${(await r.text()).slice(0,300)}`);return r}
async function rows(path:string){return await (await rest(path)).json()}
async function rpc(name:string,body:unknown={}){return await (await rest(`rpc/${name}`,{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(body)})).json()}
async function secret(name:string){const r=await rpc('get_dc_vault_secret',{p_name:name});return Array.isArray(r)?String(r[0]||''):String(r||'')}
Deno.serve(async(req:Request)=>{
 if(req.method!=='POST')return json({error:'method_not_allowed'},405);
 try{
  const supplied=req.headers.get('x-dc-internal-key')||'';const expected=await secret('dc_push_internal_key');
  if(!expected||supplied!==expected)return json({error:'forbidden'},403);
  const settingsRows=await rows('app_settings?setting_key=eq.web_push&select=setting_value&limit=1');const cfg=settingsRows[0]?.setting_value||{};
  if(cfg.enabled!==true)return json({ok:true,disabled:true});
  const publicKey=String(cfg.vapid_public_key||'');const privateKey=await secret('dc_push_vapid_private');if(!publicKey||!privateKey)throw new Error('vapid_not_configured');
  webpush.setVapidDetails('https://psycho-666.github.io/digital-compass-site/',publicKey,privateKey);
  const severities=(cfg.severities||['ACTION_REQUIRED','CRITICAL','ERROR']).map((x:string)=>String(x));const sevFilter=severities.map((x:string)=>`"${x.replaceAll('"','')}"`).join(',');
  const notifications=await rows(`notifications?external_notified_at=is.null&severity=in.(${encodeURIComponent(sevFilter)})&select=id,title,body,severity,action_path,approval_request_id,created_at&order=created_at.asc&limit=20`);
  const subs=await rows('push_subscriptions?enabled=eq.true&select=id,user_id,endpoint,p256dh,auth&order=id.asc');
  if(!subs.length)return json({ok:true,notifications_waiting:notifications.length,subscriptions:0,sent:0});
  let sent=0,disabled=0,failed=0;
  for(const n of notifications){
    let delivered=false;
    const payload=JSON.stringify({title:n.title,body:n.body||'مطلوب إجراء منك',severity:n.severity,notification_id:n.id,approval_request_id:n.approval_request_id||null,action_path:n.action_path||'./'});
    for(const s of subs){
      try{
        await webpush.sendNotification({endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}},payload,{TTL:3600,urgency:n.severity==='CRITICAL'?'high':'normal'});
        delivered=true;sent++;
        await rest(`push_subscriptions?id=eq.${s.id}`,{method:'PATCH',body:JSON.stringify({last_success_at:new Date().toISOString(),last_error:null,last_error_at:null,updated_at:new Date().toISOString()})});
      }catch(e){
        const code=Number((e as any)?.statusCode||0);failed++;
        if(code===404||code===410){disabled++;await rest(`push_subscriptions?id=eq.${s.id}`,{method:'PATCH',body:JSON.stringify({enabled:false,last_error:`HTTP ${code}`,last_error_at:new Date().toISOString(),updated_at:new Date().toISOString()})});}
        else await rest(`push_subscriptions?id=eq.${s.id}`,{method:'PATCH',body:JSON.stringify({last_error:String((e as Error)?.message||e).slice(0,500),last_error_at:new Date().toISOString(),updated_at:new Date().toISOString()})});
      }
    }
    if(delivered)await rest(`notifications?id=eq.${n.id}`,{method:'PATCH',body:JSON.stringify({external_notified_at:new Date().toISOString()})});
  }
  return json({ok:true,notifications:notifications.length,subscriptions:subs.length,sent,failed,disabled});
 }catch(e){console.error(e);return json({error:'push_dispatch_unavailable',detail:String((e as Error)?.message||e).slice(0,300)},503)}
});