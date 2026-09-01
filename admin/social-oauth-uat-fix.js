import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';

const PROJECT_URL='https://xnoalyxxrjyovivdeojo.supabase.co';
const KEY='sb_publishable_oakIu8ywKQLibfDJUDYIVg_XsNNZi66';
const API=`${PROJECT_URL}/functions/v1/social-oauth`;
const supabase=createClient(PROJECT_URL,KEY,{auth:{persistSession:true,autoRefreshToken:true}});

// User Access Token login compatibility shim. Keep this file separate until the
// social-oauth Edge Function is folded back to the same parameter set.
// Meta documents override_default_response_type for Business Integration System User
// token configurations. The core backend currently returns that legacy parameter, so
// strip only that parameter before navigation while preserving the server-created state,
// config_id, response_type=code, redirect URI and callback flow.
document.addEventListener('click',async event=>{
  const target=event.target instanceof Element?event.target.closest('#dcMetaConnectBtn'):null;
  if(!target)return;
  const workspaceId=Number(document.querySelector('#workspaceSelect')?.value||0);
  if(!workspaceId)return; // Let the normal UI show its "choose client" message.

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  target.disabled=true;

  try{
    const {data}=await supabase.auth.getSession();
    const session=data.session;
    if(!session)throw new Error('NO_SESSION');
    const url=new URL(API);
    url.searchParams.set('action','start');
    const response=await fetch(url,{method:'POST',headers:{apikey:KEY,Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({workspace_id:workspaceId}),cache:'no-store'});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok||!payload.authorization_url)throw new Error(payload.error||`HTTP_${response.status}`);

    const authUrl=new URL(payload.authorization_url);
    authUrl.searchParams.delete('override_default_response_type');
    location.href=authUrl.toString();
  }catch(error){
    console.error('Meta OAuth start failed',error);
    alert('تعذر بدء ربط Meta. ارجع للصفحة وأعد المحاولة، وإذا تكرر الخطأ أرسل لقطة شاشة.');
    target.disabled=false;
  }
},true);
