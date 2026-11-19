import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const PROJECT_URL=Deno.env.get('SUPABASE_URL')!;
const SECRET_KEYS=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}');
const SECRET_KEY=SECRET_KEYS['default'];
const ALLOWED_ORIGIN='https://psycho-666.github.io';
const admin=createClient(PROJECT_URL,SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
function cors(req:Request){const o=req.headers.get('origin')||'';return {'Access-Control-Allow-Origin':o===ALLOWED_ORIGIN?o:ALLOWED_ORIGIN,'Access-Control-Allow-Headers':'apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Cache-Control':'no-store','Vary':'Origin'}}
function json(req:Request,body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{...cors(req),'Content-Type':'application/json; charset=utf-8','X-Robots-Tag':'noindex, nofollow, noarchive'}})}
Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors(req)});
  if(req.method!=='POST')return json(req,{error:'method_not_allowed'},405);
  const origin=req.headers.get('origin')||'';
  if(origin!==ALLOWED_ORIGIN)return json(req,{error:'forbidden'},403);
  try{
    const b=await req.json();
    const username=String(b.username||'').trim();
    const password=String(b.password||'');
    if(username.length<3||username.length>40||password.length<1||password.length>512)return json(req,{error:'invalid_credentials'},401);
    const forwarded=req.headers.get('x-forwarded-for')||req.headers.get('cf-connecting-ip')||req.headers.get('x-real-ip')||'';
    const r=await fetch(`${PROJECT_URL}/rest/v1/rpc/resolve_admin_login_email`,{
      method:'POST',
      headers:{apikey:SECRET_KEY,Authorization:`Bearer ${SECRET_KEY}`,'Content-Type':'application/json',...(forwarded?{'x-forwarded-for':forwarded}:{})},
      body:JSON.stringify({p_username:username,p_password:password})
    });
    if(!r.ok)return json(req,{error:'invalid_credentials'},401);
    const email=await r.json().catch(()=>null);
    if(typeof email!=='string'||!email.includes('@'))return json(req,{error:'invalid_credentials'},401);
    const {data,error}=await admin.auth.admin.generateLink({type:'magiclink',email});
    const tokenHash=String(data?.properties?.hashed_token||'');
    if(error||!tokenHash){console.error('generate_link_failed',error);return json(req,{error:'session_issue_failed'},503)}
    return json(req,{ok:true,token_hash:tokenHash});
  }catch(e){console.error('admin_login_resolver',e);return json(req,{error:'invalid_credentials'},401)}
});