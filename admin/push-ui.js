import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
const PROJECT_URL='https://xnoalyxxrjyovivdeojo.supabase.co';
const KEY='sb_publishable_oakIu8ywKQLibfDJUDYIVg_XsNNZi66';
const API=`${PROJECT_URL}/functions/v1/push-api`;
const supabase=createClient(PROJECT_URL,KEY,{auth:{persistSession:true,autoRefreshToken:true}});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function b64ToBytes(v){const p='='.repeat((4-v.length%4)%4);const s=(v+p).replace(/-/g,'+').replace(/_/g,'/');const raw=atob(s);return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)))}
async function session(){return (await supabase.auth.getSession()).data.session}
async function api(action,{method='GET',body}={}){const s=await session();if(!s)throw new Error('NO_SESSION');const u=new URL(API);u.searchParams.set('action',action);const r=await fetch(u,{method,headers:{apikey:KEY,Authorization:`Bearer ${s.access_token}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||`HTTP_${r.status}`);return d}
function notice(text){const el=document.querySelector('#dcBrowserNotice');if(el)el.textContent=text}
async function serialize(sub){const j=sub.toJSON();return {endpoint:sub.endpoint,keys:{p256dh:j.keys?.p256dh||'',auth:j.keys?.auth||''},user_agent:navigator.userAgent,device_label:[navigator.platform||'',/Mobi|Android/i.test(navigator.userAgent)?'Mobile':'Desktop'].filter(Boolean).join(' · ')}}
async function enablePush(){
 if(!('serviceWorker'in navigator)||!('PushManager'in window)||!('Notification'in window)){notice('هذا الجهاز لا يدعم Web Push.');return}
 const perm=await Notification.requestPermission();if(perm!=='granted'){notice('التنبيهات غير مفعّلة من إعدادات الجهاز/المتصفح.');return}
 notice('جاري ربط هذا الجهاز بالتنبيهات...');
 const cfg=await api('config');if(!cfg.enabled||!cfg.public_key)throw new Error('PUSH_DISABLED');
 const reg=await navigator.serviceWorker.ready;let sub=await reg.pushManager.getSubscription();
 if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64ToBytes(cfg.public_key)});
 await api('subscribe',{method:'POST',body:await serialize(sub)});notice('تنبيهات Digital Compass مفعّلة على هذا الجهاز حتى لو التطبيق مسكّر.');
}
async function syncExisting(){
 if(!('serviceWorker'in navigator)||!('PushManager'in window)||Notification.permission!=='granted')return;
 const s=await session();if(!s)return;const reg=await navigator.serviceWorker.ready;const sub=await reg.pushManager.getSubscription();if(sub){try{await api('subscribe',{method:'POST',body:await serialize(sub)});notice('Push Notifications مفعّلة على هذا الجهاز.')}catch{}}
}
document.addEventListener('click',e=>{const t=e.target.closest?.('#dcEnableBrowser');if(!t)return;e.preventDefault();e.stopImmediatePropagation();enablePush().catch(()=>notice('تعذر تفعيل Push الآن. جرّب مرة ثانية.'))},true);
(async()=>{for(let i=0;i<40&&!document.querySelector('#dcBrowserNotice');i++)await sleep(100);await syncExisting()})();