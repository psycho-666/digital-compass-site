import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const PROJECT_URL='https://xnoalyxxrjyovivdeojo.supabase.co';
const PUBLISHABLE_KEY='sb_publishable_oakIu8ywKQLibfDJUDYIVg_XsNNZi66';
const API=`${PROJECT_URL}/functions/v1/assistant-api`;
const supabase=createClient(PROJECT_URL,PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
let conversationId=localStorage.getItem('dc_assistant_conversation')||'';
let knownUnread=Number(localStorage.getItem('dc_known_unread')||0);
let pollTimer=null;
const $=s=>document.querySelector(s);const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
async function session(){return (await supabase.auth.getSession()).data.session}
async function api(action,{method='GET',body,params={}}={}){const s=await session();if(!s)throw new Error('NO_SESSION');const u=new URL(API);u.searchParams.set('action',action);Object.entries(params).forEach(([k,v])=>u.searchParams.set(k,String(v)));const r=await fetch(u,{method,headers:{apikey:PUBLISHABLE_KEY,Authorization:`Bearer ${s.access_token}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||`HTTP_${r.status}`);return d}
function inject(){if($('#dcAssistantFab'))return;document.body.insertAdjacentHTML('beforeend',`
<button id="dcAssistantFab" class="dcAssistantFab hidden"><i></i><span>مساعد البوصلة</span></button>
<section id="dcAssistantPanel" class="dcPanel dcAssistantPanel hidden" aria-label="Digital Compass Assistant">
 <div class="dcPanelHead"><div><span>DIGITAL COMPASS</span><h3>المساعد الذكي</h3></div><button class="dcClose" data-close-assistant>×</button></div>
 <div class="dcAssistantIntro"><strong>احكي معي بشكل طبيعي.</strong><p>شغّل المراحل، اسأل عن الحالة، غيّر الإعدادات، أو اطلب تعديل جديد. الإجراءات الحساسة تتحول لموافقة قبل التنفيذ.</p></div>
 <div id="dcChatMessages" class="dcChatMessages"><div class="dcMsg assistant">جاهز. مثال: «وين وصلنا؟»، «شغّل Social Audit»، «30 بدون موقع و20 مع موقع»، أو «شو مطلوب مني أوافق عليه؟».</div></div>
 <div class="dcQuick"><button data-quick="وين وصلنا؟">الحالة</button><button data-quick="شو مطلوب مني أوافق عليه؟">الموافقات</button><button data-quick="شغّل Social Audit">Social Audit</button><button data-quick="شغّل العملية كاملة">Full Pipeline</button></div>
 <form id="dcChatForm" class="dcChatForm"><textarea id="dcChatInput" rows="2" placeholder="اكتب طلبك..."></textarea><button type="submit">➜</button></form>
</section>
<section id="dcNotifyPanel" class="dcPanel hidden" aria-label="Notifications">
 <div class="dcPanelHead"><div><span>ACTION CENTER</span><h3>التنبيهات والموافقات</h3></div><button class="dcClose" data-close-notify>×</button></div>
 <div class="dcPanelTabs"><button class="active" data-notify-tab="approvals">الموافقات</button><button data-notify-tab="notifications">التنبيهات</button></div>
 <div id="dcBrowserNotice" class="dcBrowserNotice">تقدر تفعل تنبيهات المتصفح من <button id="dcEnableBrowser">هنا</button>.</div>
 <div id="dcNotifyBody" class="dcPanelBody"></div>
</section>`);
 const top=document.querySelector('.topActions');if(top&&!$('#dcNotifyBtn'))top.insertAdjacentHTML('afterbegin','<button id="dcNotifyBtn" class="dcNotifyBtn" title="Notifications">🔔<span id="dcNotifyBadge" class="dcNotifyBadge hidden">0</span></button>');
 bind();
}
function bind(){
 $('#dcAssistantFab').onclick=()=>toggle('#dcAssistantPanel');$('#dcNotifyBtn')?.addEventListener('click',()=>{toggle('#dcNotifyPanel');loadState(true)});
 document.querySelector('[data-close-assistant]').onclick=()=>$('#dcAssistantPanel').classList.add('hidden');document.querySelector('[data-close-notify]').onclick=()=>$('#dcNotifyPanel').classList.add('hidden');
 $('#dcChatForm').addEventListener('submit',async e=>{e.preventDefault();const input=$('#dcChatInput');const text=input.value.trim();if(!text)return;input.value='';await send(text)});
 document.querySelectorAll('[data-quick]').forEach(b=>b.onclick=()=>send(b.dataset.quick));
 document.querySelectorAll('[data-notify-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-notify-tab]').forEach(x=>x.classList.toggle('active',x===b));loadState(true)});
 $('#dcEnableBrowser').onclick=async()=>{if(!('Notification'in window))return;if(Notification.permission==='default')await Notification.requestPermission();renderBrowserNotice()};
}
function toggle(sel){const el=$(sel),other=sel==='#dcAssistantPanel'?$('#dcNotifyPanel'):$('#dcAssistantPanel');other?.classList.add('hidden');el.classList.toggle('hidden')}
function addMsg(role,text){const box=$('#dcChatMessages');box.insertAdjacentHTML('beforeend',`<div class="dcMsg ${role}">${esc(text)}</div>`);box.scrollTop=box.scrollHeight}
async function send(text){addMsg('user',text);$('#dcChatForm button').disabled=true;try{const d=await api('message',{method:'POST',body:{conversation_id:conversationId||null,content:text}});conversationId=d.conversation_id;localStorage.setItem('dc_assistant_conversation',conversationId);addMsg('assistant',d.message?.content||d.result?.text||'تم.');await loadState(false)}catch(e){addMsg('assistant','تعذر تنفيذ الطلب الآن. جرّب مرة ثانية أو افتح سجل الأتمتة إذا كان الطلب متعلقًا بمرحلة تشغيل.')}finally{$('#dcChatForm button').disabled=false}}
function renderBrowserNotice(){const el=$('#dcBrowserNotice');if(!el)return;if(!('Notification'in window)){el.textContent='المتصفح لا يدعم التنبيهات.';return}if(Notification.permission==='granted')el.textContent='تنبيهات المتصفح مفعّلة أثناء عمل Control Center.';else if(Notification.permission==='denied')el.textContent='تنبيهات المتصفح محجوبة من إعدادات المتصفح.'}
function formatTime(v){try{return new Intl.DateTimeFormat('ar-IQ',{dateStyle:'short',timeStyle:'short'}).format(new Date(v))}catch{return''}}
function approvalsHtml(items){if(!items?.length)return '<div class="dcEmpty">ما عندك أي موافقة معلّقة حاليًا.</div>';return items.map(x=>`<article class="dcApproval ${x.risk_level==='CRITICAL'?'critical':''}"><div class="dcApprovalTop"><div><h4>${esc(x.title)}</h4><p>${esc(x.description||'')}</p></div><span class="dcRisk">${esc(x.risk_level)}</span></div><div class="dcApprovalActions"><button class="dcApprove" data-approve="${x.id}">موافق</button><button class="dcReject" data-reject="${x.id}">رفض</button></div></article>`).join('')}
function notificationsHtml(items){if(!items?.length)return '<div class="dcEmpty">ما في تنبيهات بعد.</div>';return items.map(x=>`<article class="dcNotification ${x.is_read?'':'unread'}" data-notification="${x.id}"><h4>${esc(x.title)}</h4><p>${esc(x.body||'')}</p><time>${formatTime(x.created_at)}</time></article>`).join('')}
async function loadState(render=false){try{const d=await api('state',{params:conversationId?{conversation_id:conversationId}:{}});const badge=$('#dcNotifyBadge');badge.textContent=d.unread_count||0;badge.classList.toggle('hidden',!(d.unread_count>0));if(d.unread_count>knownUnread&&'Notification'in window&&Notification.permission==='granted'){const newest=(d.notifications||[]).find(x=>!x.is_read);if(newest)new Notification(newest.title,{body:newest.body||'مطلوب إجراء منك'});}knownUnread=d.unread_count||0;localStorage.setItem('dc_known_unread',knownUnread);
 if(render&&!$('#dcNotifyPanel').classList.contains('hidden')){const tab=document.querySelector('[data-notify-tab].active')?.dataset.notifyTab||'approvals';$('#dcNotifyBody').innerHTML=tab==='approvals'?approvalsHtml(d.approvals):notificationsHtml(d.notifications);bindNotificationRows()}
 if(d.messages?.length&&$('#dcChatMessages').children.length<=1){$('#dcChatMessages').innerHTML='';d.messages.forEach(m=>addMsg(m.role==='USER'?'user':'assistant',m.content))}
 return d}catch{return null}}
function bindNotificationRows(){document.querySelectorAll('[data-approve]').forEach(b=>b.onclick=()=>resolve(Number(b.dataset.approve),'APPROVED'));document.querySelectorAll('[data-reject]').forEach(b=>b.onclick=()=>resolve(Number(b.dataset.reject),'REJECTED'));document.querySelectorAll('[data-notification]').forEach(x=>x.onclick=async()=>{if(!x.classList.contains('unread'))return;try{await api('read_notification',{method:'POST',body:{id:Number(x.dataset.notification)}});x.classList.remove('unread');await loadState(false)}catch{}})}
async function resolve(id,decision){try{await api('resolve_approval',{method:'POST',body:{id,decision}});await loadState(true)}catch{alert('تعذر تحديث الموافقة الآن.')}}
async function boot(){inject();renderBrowserNotice();const s=await session();if(s){$('#dcAssistantFab').classList.remove('hidden');await loadState(false);pollTimer=setInterval(()=>loadState(false),15000)}supabase.auth.onAuthStateChange((_e,sess)=>{if(sess){$('#dcAssistantFab')?.classList.remove('hidden');loadState(false);if(!pollTimer)pollTimer=setInterval(()=>loadState(false),15000)}else{$('#dcAssistantFab')?.classList.add('hidden');clearInterval(pollTimer);pollTimer=null}})}
boot();