const PROJECT_URL=Deno.env.get('SUPABASE_URL')!;
const SECRET_KEYS=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}');
const SECRET_KEY=SECRET_KEYS['default'];
const ALLOWED_ORIGIN='https://psycho-666.github.io';
function cors(req:Request){const o=req.headers.get('origin')||'';return {'Access-Control-Allow-Origin':o===ALLOWED_ORIGIN?o:ALLOWED_ORIGIN,'Access-Control-Allow-Headers':'apikey, authorization, content-type','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Cache-Control':'no-store','Vary':'Origin'}}
function json(req:Request,body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{...cors(req),'Content-Type':'application/json; charset=utf-8','X-Robots-Tag':'noindex, nofollow, noarchive'}})}
function jwtSub(req:Request){try{const raw=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');const p=raw.split('.')[1];if(!p)return'';const s=p.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(p.length/4)*4,'=');return String(JSON.parse(atob(s)).sub||'')}catch{return''}}
async function rest(path:string,init:RequestInit={}){const h=new Headers(init.headers||{});h.set('apikey',SECRET_KEY);h.set('Authorization',`Bearer ${SECRET_KEY}`);if(init.body)h.set('Content-Type','application/json');const r=await fetch(`${PROJECT_URL}/rest/v1/${path}`,{...init,headers:h});if(!r.ok)throw new Error(`${path}:${r.status}`);return r}
async function rows(path:string){return await (await rest(path)).json()}
async function count(path:string){const r=await rest(path,{headers:{Prefer:'count=exact',Range:'0-0'}});return Number((r.headers.get('content-range')||'/0').split('/')[1]||0)}
Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors(req)});
  const origin=req.headers.get('origin')||'';if(origin!==ALLOWED_ORIGIN)return json(req,{error:'forbidden'},403);
  const uid=jwtSub(req);if(!uid)return json(req,{error:'forbidden'},403);
  try{
    const admins=await rows(`admin_users?user_id=eq.${encodeURIComponent(uid)}&select=user_id&limit=1`);
    if(!admins.length)return json(req,{error:'forbidden'},403);
    const u=new URL(req.url),action=u.searchParams.get('action')||'';
    if(req.method==='GET'&&action==='social_prequalifications'){
      const limit=Math.min(Math.max(Number(u.searchParams.get('limit')||50),1),100);
      const [total,high,items]=await Promise.all([
        count('social_management_prequalifications?select=id&status=not.in.(REJECTED,EXPIRED)'),
        count('social_management_prequalifications?select=id&status=not.in.(REJECTED,EXPIRED)&confidence_score=gte.90'),
        rows(`iraq_social_prequalification_pipeline?status=not.in.(REJECTED,EXPIRED)&select=*&order=confidence_score.desc,prequalification_date.desc,prequalification_id.desc&limit=${limit}`)
      ]);
      return json(req,{total,high_confidence:high,items});
    }
    if(req.method==='GET'&&action==='social_prequalification_detail'){
      const companyId=Number(u.searchParams.get('company_id'));if(!Number.isFinite(companyId))return json(req,{error:'invalid_id'},400);
      const pre=(await rows(`social_management_prequalifications?company_id=eq.${companyId}&status=not.in.(REJECTED,EXPIRED)&select=*&order=prequalification_date.desc,id.desc&limit=1`))[0];
      if(!pre)return json(req,{error:'not_found'},404);
      const [company,candidate]=await Promise.all([
        rows(`companies?id=eq.${pre.company_id}&select=id,name,city,sector,phone,whatsapp,general_email&limit=1`),
        rows(`social_discovery_candidates?id=eq.${pre.source_candidate_id}&select=id,profile_url,ad_library_url,landing_url,phone,whatsapp,city_hint,sector_hint,local_relevance_evidence&limit=1`)
      ]);
      return json(req,{...pre,company_name:company[0]?.name||null,city:company[0]?.city||null,sector:company[0]?.sector||null,company_phone:company[0]?.phone||null,company_whatsapp:company[0]?.whatsapp||null,...(candidate[0]||{})});
    }
    if(req.method==='POST'&&action==='set_username'){
      const b=await req.json();const username=String(b.username||'').trim();
      if(username.length<3||username.length>40||/\s/.test(username))return json(req,{error:'invalid_username'},400);
      const key=username.toLowerCase();const dup=await rows(`admin_users?username_key=eq.${encodeURIComponent(key)}&user_id=neq.${encodeURIComponent(uid)}&select=user_id&limit=1`);
      if(dup.length)return json(req,{error:'username_taken'},409);
      const r=await rest(`admin_users?user_id=eq.${encodeURIComponent(uid)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({username})});
      const out=await r.json();return json(req,{ok:true,username:out[0]?.username||username});
    }
    if(req.method==='POST'&&action==='mark_credentials'){
      const current=await rows(`admin_users?user_id=eq.${encodeURIComponent(uid)}&select=username&limit=1`);
      if(!current[0]?.username)return json(req,{error:'username_required'},409);
      await rest(`admin_users?user_id=eq.${encodeURIComponent(uid)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({credentials_configured_at:new Date().toISOString()})});
      return json(req,{ok:true});
    }
    return json(req,{error:'not_found'},404);
  }catch(e){console.error(e);return json(req,{error:'admin_browser_api_unavailable'},503)}
});