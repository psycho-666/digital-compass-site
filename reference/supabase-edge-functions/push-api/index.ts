const PROJECT_URL=Deno.env.get('SUPABASE_URL')!;
const SECRET_KEYS=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}');
const SECRET_KEY=SECRET_KEYS['default'];
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'apikey, authorization, content-type','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Cache-Control':'no-store'};
function json(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json; charset=utf-8','X-Robots-Tag':'noindex, nofollow, noarchive'}})}
function jwtSub(req:Request){try{const raw=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');const p=raw.split('.')[1];if(!p)return'';const s=p.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(p.length/4)*4,'=');return String(JSON.parse(atob(s)).sub||'')}catch{return''}}
async function rest(path:string,init:RequestInit={}){const h=new Headers(init.headers||{});h.set('apikey',SECRET_KEY);h.set('Authorization',`Bearer ${SECRET_KEY}`);if(init.body)h.set('Content-Type','application/json');const r=await fetch(`${PROJECT_URL}/rest/v1/${path}`,{...init,headers:h});if(!r.ok)throw new Error(`${path}:${r.status}:${(await r.text()).slice(0,300)}`);return r}
async function rows(path:string){return await (await rest(path)).json()}
async function isAdmin(uid:string){if(!uid)return false;return (await rows(`admin_users?user_id=eq.${encodeURIComponent(uid)}&select=user_id&limit=1`)).length===1}
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 const uid=jwtSub(req);if(!(await isAdmin(uid)))return json({error:'forbidden'},403);
 try{
  const u=new URL(req.url),action=u.searchParams.get('action')||'config';
  if(req.method==='GET'&&action==='config'){
    const a=await rows('app_settings?setting_key=eq.web_push&select=setting_value&limit=1');const cfg=a[0]?.setting_value||{};
    return json({enabled:cfg.enabled===true,public_key:cfg.vapid_public_key||null,severities:cfg.severities||[]});
  }
  if(req.method==='GET'&&action==='status'){
    const items=await rows(`push_subscriptions?user_id=eq.${encodeURIComponent(uid)}&enabled=eq.true&select=id,device_label,user_agent,last_success_at,last_error,last_error_at,created_at&order=created_at.desc`);
    return json({items});
  }
  if(req.method==='POST'&&action==='subscribe'){
    const b=await req.json();const endpoint=String(b?.endpoint||'').trim(),p256dh=String(b?.keys?.p256dh||'').trim(),auth=String(b?.keys?.auth||'').trim();
    if(!endpoint.startsWith('https://')||!p256dh||!auth)return json({error:'invalid_subscription'},400);
    const body={user_id:uid,endpoint,p256dh,auth,user_agent:String(b.user_agent||req.headers.get('user-agent')||'').slice(0,500),device_label:String(b.device_label||'Digital Compass device').slice(0,120),enabled:true,last_error:null,last_error_at:null,updated_at:new Date().toISOString()};
    const r=await rest('push_subscriptions?on_conflict=endpoint',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(body)});return json({ok:true,item:(await r.json())[0]||null},201);
  }
  if(req.method==='POST'&&action==='unsubscribe'){
    const b=await req.json();const endpoint=String(b?.endpoint||'').trim();if(!endpoint)return json({error:'invalid_subscription'},400);
    await rest(`push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}&user_id=eq.${encodeURIComponent(uid)}`,{method:'PATCH',body:JSON.stringify({enabled:false,updated_at:new Date().toISOString()})});return json({ok:true});
  }
  return json({error:'not_found'},404);
 }catch(e){console.error(e);return json({error:'push_api_unavailable'},503)}
});