const PROJECT_URL=Deno.env.get('SUPABASE_URL')!;
const SECRET_KEYS=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}');
const SECRET_KEY=SECRET_KEYS['default'];
const cors={'Access-Control-Allow-Origin':'https://psycho-666.github.io','Access-Control-Allow-Headers':'apikey, authorization, content-type','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Cache-Control':'no-store'};
const PERMISSIONS=new Set(['dashboard.view','leads.view','leads.manage','social.view','social.manage','social_management.view','social_management.manage','prototypes.view','outreach.view','outreach.manage','automation.view','automation.run','settings.view','settings.manage','users.manage']);
function json(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json; charset=utf-8','X-Robots-Tag':'noindex, nofollow, noarchive'}})}
function jwtSub(req:Request){try{const raw=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');const p=raw.split('.')[1];if(!p)return'';const s=p.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(p.length/4)*4,'=');return String(JSON.parse(atob(s)).sub||'')}catch{return''}}
async function rest(path:string,init:RequestInit={}){const h=new Headers(init.headers||{});h.set('apikey',SECRET_KEY);h.set('Authorization',`Bearer ${SECRET_KEY}`);if(init.body)h.set('Content-Type','application/json');const r=await fetch(`${PROJECT_URL}/rest/v1/${path}`,{...init,headers:h});const t=await r.text();if(!r.ok)throw new Error(`rest_${r.status}_${t.slice(0,240)}`);return t?JSON.parse(t):null}
async function profile(uid:string){const xs=await rest(`admin_users?user_id=eq.${encodeURIComponent(uid)}&select=user_id,email,username,display_name,role,permissions,is_active,created_at,last_login_at,credentials_configured_at,updated_at&limit=1`)||[];return xs[0]||null}
function perms(p:any){return Array.isArray(p?.permissions)?p.permissions.map(String):[]}
function has(p:any,key:string){return !!p&&p.is_active===true&&(p.role==='OWNER'||perms(p).includes('*')||perms(p).includes(key))}
function sanitizePermissions(v:any){return [...new Set((Array.isArray(v)?v:[]).map(String).filter(x=>PERMISSIONS.has(x)))]}
function usernameKey(v:any){return String(v||'').trim().toLowerCase()}
function validUsername(v:string){return v.length>=3&&v.length<=40&&!/\s/.test(v)&&/^[A-Za-z0-9_.-]+$/.test(v)}
function cleanName(v:any){return String(v||'').trim().slice(0,120)}
async function authCreate(email:string,password:string){const r=await fetch(`${PROJECT_URL}/auth/v1/admin/users`,{method:'POST',headers:{apikey:SECRET_KEY,Authorization:`Bearer ${SECRET_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({email,password,email_confirm:true})});const t=await r.text();if(!r.ok)throw new Error(`auth_create_${r.status}_${t.slice(0,200)}`);return JSON.parse(t)}
async function authUpdate(id:string,body:any){const r=await fetch(`${PROJECT_URL}/auth/v1/admin/users/${encodeURIComponent(id)}`,{method:'PUT',headers:{apikey:SECRET_KEY,Authorization:`Bearer ${SECRET_KEY}`,'Content-Type':'application/json'},body:JSON.stringify(body)});const t=await r.text();if(!r.ok)throw new Error(`auth_update_${r.status}_${t.slice(0,200)}`);return t?JSON.parse(t):null}
async function authDelete(id:string){await fetch(`${PROJECT_URL}/auth/v1/admin/users/${encodeURIComponent(id)}`,{method:'DELETE',headers:{apikey:SECRET_KEY,Authorization:`Bearer ${SECRET_KEY}`}}).catch(()=>null)}
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 const uid=jwtSub(req);if(!uid)return json({error:'unauthorized'},401);
 try{
  const me=await profile(uid);if(!me||me.is_active!==true)return json({error:'forbidden'},403);
  const u=new URL(req.url),action=u.searchParams.get('action')||'current';
  if(req.method==='GET'&&action==='current')return json({user:me,permissions_catalog:[...PERMISSIONS]});
  if(!has(me,'users.manage'))return json({error:'permission_denied'},403);
  if(req.method==='GET'&&action==='list'){
    const items=await rest('admin_users?select=user_id,email,username,display_name,role,permissions,is_active,created_at,last_login_at,credentials_configured_at,updated_at&order=created_at.asc')||[];
    return json({items});
  }
  if(req.method==='POST'&&action==='create'){
    const b=await req.json();const username=String(b.username||'').trim(),key=usernameKey(username),password=String(b.password||''),display=cleanName(b.display_name)||username,role=['ADMIN','USER'].includes(String(b.role||''))?String(b.role):'USER',permissions=sanitizePermissions(b.permissions);
    if(!validUsername(username))return json({error:'invalid_username'},400);
    if(password.length<8||password.length>128)return json({error:'weak_password'},400);
    const existing=await rest(`admin_users?username_key=eq.${encodeURIComponent(key)}&select=user_id&limit=1`)||[];if(existing.length)return json({error:'username_exists'},409);
    const email=`${crypto.randomUUID()}@login.digital-compass.invalid`;
    let au:any=null;
    try{au=await authCreate(email,password);const userId=String(au.id||au.user?.id||'');if(!userId)throw new Error('auth_id_missing');
      const row=await rest('admin_users',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({user_id:userId,email,username,display_name:display,role,permissions,is_active:true,credentials_configured_at:new Date().toISOString(),created_by:uid,updated_at:new Date().toISOString()})});
      return json({ok:true,user:row?.[0]||null},201);
    }catch(e){const id=String(au?.id||au?.user?.id||'');if(id)await authDelete(id);throw e}
  }
  if(req.method==='POST'&&action==='update'){
    const b=await req.json(),id=String(b.user_id||'');if(!/^[0-9a-f-]{36}$/i.test(id))return json({error:'invalid_user'},400);
    const target=await profile(id);if(!target)return json({error:'not_found'},404);if(target.role==='OWNER'&&me.role!=='OWNER')return json({error:'owner_protected'},403);
    const patch:any={updated_at:new Date().toISOString()};
    if('display_name'in b)patch.display_name=cleanName(b.display_name)||target.username;
    if('username'in b){const un=String(b.username||'').trim();if(!validUsername(un))return json({error:'invalid_username'},400);patch.username=un}
    if('role'in b&&target.role!=='OWNER')patch.role=['ADMIN','USER'].includes(String(b.role))?String(b.role):target.role;
    if('permissions'in b&&target.role!=='OWNER')patch.permissions=sanitizePermissions(b.permissions);
    if('is_active'in b&&target.role!=='OWNER')patch.is_active=Boolean(b.is_active);
    const rows=await rest(`admin_users?user_id=eq.${encodeURIComponent(id)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(patch)});
    return json({ok:true,user:rows?.[0]||null});
  }
  if(req.method==='POST'&&action==='password'){
    const b=await req.json(),id=String(b.user_id||''),password=String(b.password||'');if(!/^[0-9a-f-]{36}$/i.test(id))return json({error:'invalid_user'},400);if(password.length<8||password.length>128)return json({error:'weak_password'},400);
    const target=await profile(id);if(!target)return json({error:'not_found'},404);if(target.role==='OWNER'&&me.role!=='OWNER')return json({error:'owner_protected'},403);
    await authUpdate(id,{password});await rest(`admin_users?user_id=eq.${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({credentials_configured_at:new Date().toISOString(),updated_at:new Date().toISOString()})});return json({ok:true});
  }
  return json({error:'not_found'},404);
 }catch(e){console.error(e);return json({error:'user_admin_unavailable'},503)}
});