import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const PROJECT_URL='https://xnoalyxxrjyovivdeojo.supabase.co';
const PUBLISHABLE_KEY='sb_publishable_oakIu8ywKQLibfDJUDYIVg_XsNNZi66';
const API=`${PROJECT_URL}/functions/v1/assistant-api`;
const supabase=createClient(PROJECT_URL,PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
let conversationId=localStorage.getItem('dc_assistant_conversation')||'';
let knownUnread=Number(localStorage.getItem('dc_known_unread')||0);
let pollTimer=null;
let currentSession=null;
let lastState=null;
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
async function session(){if(currentSession)return currentSession;currentSession=(await supabase.auth.getSession()).data.session;return currentSession}
async function api(action,{method='GET',body,params={}}={}){const s=await session();if(!s)throw new Error('NO_SESSION');const u=new URL(API);u.searchParams.set('action',action);Object.entries(params).forEach(([k,v])=>u.searchParams.set(k,String(v)));const r=await fetch(u,{method,headers:{apikey:PUBLISHABLE_KEY,Authorization:`Bearer ${s.access_token}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||`HTTP_${r.status}`);return d}
function inject(){if($('#dcAssistantFab'))return;document.body.insertAdjacentHTML('beforeend',`
<button id="dcAssistantFab" class="dcAssistantFab hidden"><i></i><span>مساعد البوصلة</span></button>
<section id="dcAssistantPanel" class="dcPanel dcAssistantPanel hidden" aria-label="Digital Compass Assistant">
 <div class="dcPanelHead"><div><span>DIGITAL COMPASS</span><h3>المساعد التشغيلي</h3></div><button class="dcClose" data-close-assistant>×</button></div>
 <div class="dcAssistantIntro"><strong>اسأل عن النظام أو اطلب إجراءً واضحاً.</strong><p>المساعد الحالي متخصص بتشغيل البوصلة وقراءة حالتها. الإجراءات الحساسة تبقى خاضعة للموافقة.</p></div>
 <div id="dcChatMessages" class="dcChatMessages"><div class="dcMsg assistant">جاهز. اسأل عن الحالة، الموافقات، الأسعار، المسودات أو اطلب تشغيل مرحلة محددة.</div></div>
 <div class="dcQuick"><button data-quick="وين وصلنا؟">الحالة</button><button data-quick="شو مطلوب مني أوافق عليه؟">الموافقات</button><button data-quick="شغّل Social Audit">Social Audit</button><button data-quick="شغّل العملية كاملة">Full Pipeline</button></div>
 <form id="dcChatForm" class="dcChatForm"><textarea id="dcChatInput" rows="2" placeholder="اكتب طلبك..."></textarea><button type="submit">➜</button></form>
</section>
<section id="dcNotifyPanel" class="dcPanel hidden" aria-label="Notifications">
 <div class="dcPanelHead"><div><span>ACTION CENTER</span><h3>التنبيهات والموافقات</h3></div><button class="dcClose" data-close-notify>×</button></div>
 <div class="dcPanelTabs"><button data-notify-tab="notifications">التنبيهات <b data-notify-count>0</b></button><button data-notify-tab="approvals">الموافقات <b data-approval-count>0</b></button></div>
 <div class="dcActionToolbar"><span id="dcActionSummary">جارِ التحديث...</span><button id="dcMarkAllRead" type="button">قراءة كل التنبيهات</button></div>
 <div id="dcBrowserNotice" class="dcBrowserNotice">تقدر تفعل تنبيهات المتصفح من <button id="dcEnableBrowser">هنا</button>.</div>
 <div id="dcNotifyBody" class="dcPanelBody"><div class="dcEmpty">جارِ تحميل مركز الإجراءات...</div></div>
</section>`);
 const top=document.querySelector('.topActions');if(top&&!$('#dcNotifyBtn'))top.insertAdjacentHTML('afterbegin','<button id="dcNotifyBtn" class="dcNotifyBtn" title="التنبيهات والموافقات">🔔<span id="dcNotifyBadge" class="dcNotifyBadge hidden">0</span></button>');
 bind();
}
function bind(){
 $('#dcAssistantFab').onclick=async()=>{toggle('#dcAssistantPanel');if(!$('#dcAssistantPanel').classList.contains('hidden'))await loadState(false)};
 $('#dcNotifyBtn')?.addEventListener('click',async()=>{toggle('#dcNotifyPanel');if(!$('#dcNotifyPanel').classList.contains('hidden')){showNotifyLoading();await loadState(true,true)}});
 $('[data-close-assistant]').onclick=()=>$('#dcAssistantPanel').classList.add('hidden');
 $('[data-close-notify]').onclick=()=>$('#dcNotifyPanel').classList.add('hidden');
 $('#dcChatForm').addEventListener('submit',async e=>{e.preventDefault();const input=$('#dcChatInput'),text=input.value.trim();if(!text)return;input.value='';await send(text)});
 document.querySelectorAll('[data-quick]').forEach(b=>b.onclick=()=>send(b.dataset.quick));
 document.querySelectorAll('[data-notify-tab]').forEach(b=>b.onclick=()=>{selectTab(b.dataset.notifyTab);renderCurrentState()});
 $('#dcMarkAllRead').onclick=markAllRead;
 $('#dcEnableBrowser').onclick=async()=>{if(!('Notification'in window))return;if(Notification.permission==='default')await Notification.requestPermission();renderBrowserNotice()};
}
function toggle(sel){const el=$(sel),other=sel==='#dcAssistantPanel'?$('#dcNotifyPanel'):$('#dcAssistantPanel');other?.classList.add('hidden');el.classList.toggle('hidden')}
function selectTab(name){document.querySelectorAll('[data-notify-tab]').forEach(x=>x.classList.toggle('active',x.dataset.notifyTab===name))}
function addMsg(role,text){const box=$('#dcChatMessages');box.insertAdjacentHTML('beforeend',`<div class="dcMsg ${role}">${esc(text)}</div>`);box.scrollTop=box.scrollHeight}
async function send(text){addMsg('user',text);$('#dcChatForm button').disabled=true;try{const d=await api('message',{method:'POST',body:{conversation_id:conversationId||null,content:text}});conversationId=d.conversation_id;localStorage.setItem('dc_assistant_conversation',conversationId);addMsg('assistant',d.message?.content||d.result?.text||'تم.');await loadState(false,false)}catch{addMsg('assistant','تعذر تنفيذ الطلب الآن.')}finally{$('#dcChatForm button').disabled=false}}
function renderBrowserNotice(){const el=$('#dcBrowserNotice');if(!el)return;if(!('Notification'in window)){el.textContent='المتصفح لا يدعم التنبيهات.';return}if(Notification.permission==='granted')el.textContent='تنبيهات المتصفح مفعّلة.';else if(Notification.permission==='denied')el.textContent='تنبيهات المتصفح محجوبة من إعدادات المتصفح.'}
function formatTime(v){try{return new Intl.DateTimeFormat('ar-IQ',{dateStyle:'short',timeStyle:'short'}).format(new Date(v))}catch{return''}}
function riskLabel(v){return ({LOW:'منخفض',MEDIUM:'متوسط',HIGH:'مرتفع',CRITICAL:'حساس'})[String(v||'').toUpperCase()]||v||''}
function approvalType(x){const a=String(x.action_type||'');if(a==='APPROVE_OUTREACH')return 'رسالة تواصل';if(a==='APPROVE_SOCIAL_CONTENT')return 'محتوى سوشيال';if(a==='APPROVE_SOCIAL_REPLY')return 'رد على عميل';if(a==='ENABLE_OUTREACH')return 'تفعيل الإرسال';if(String(x.entity_type||'').toLowerCase()==='social_ad_action')return 'إجراء إعلاني';return 'إجراء يحتاج قرارك'}
function approvalsHtml(items){if(!items?.length)return '<div class="dcEmpty"><strong>لا توجد موافقات معلّقة</strong><br>أي إجراء جديد يحتاج قرارك سيظهر هنا مع التفاصيل قبل التنفيذ.</div>';return items.map(x=>`<article class="dcApproval ${x.risk_level==='CRITICAL'?'critical':''}"><div class="dcApprovalMeta"><span>${esc(approvalType(x))}</span><time>${formatTime(x.requested_at||x.created_at)}</time></div><div class="dcApprovalTop"><div><h4>${esc(x.title)}</h4><p>${esc(x.description||'')}</p></div><span class="dcRisk">${esc(riskLabel(x.risk_level))}</span></div><div class="dcApprovalActions"><button class="dcApprove" data-approve="${x.id}">موافق وتنفيذ</button><button class="dcReject" data-reject="${x.id}">رفض</button></div></article>`).join('')}
function notificationsHtml(items){if(!items?.length)return '<div class="dcEmpty"><strong>ما في تنبيهات حالياً</strong><br>الجرس سيظهر فقط عند وجود حدث جديد يحتاج انتباهك.</div>';return items.map(x=>`<article class="dcNotification ${x.is_read?'':'unread'}" data-notification="${x.id}"><div class="dcNotificationTop"><h4>${esc(x.title)}</h4>${x.is_read?'':'<span>جديد</span>'}</div><p>${esc(x.body||'')}</p><time>${formatTime(x.created_at)}</time>${x.is_read?'':'<small>اضغط لاعتباره مقروءاً</small>'}</article>`).join('')}
function showNotifyLoading(){const body=$('#dcNotifyBody');if(body)body.innerHTML='<div class="dcEmpty">جارِ تحديث التنبيهات والموافقات...</div>'}
function updateCounters(d){const unread=Number(d?.unread_count||0),pending=Number(d?.pending_approvals??d?.approvals?.length||0),attention=Number(d?.attention_count??(unread+pending));const badge=$('#dcNotifyBadge');badge.textContent=attention>99?'99+':attention;badge.classList.toggle('hidden',attention<=0);const n=$('[data-notify-count]'),a=$('[data-approval-count]');if(n)n.textContent=unread;if(a)a.textContent=pending;const summary=$('#dcActionSummary');if(summary)summary.textContent=attention?`${pending} موافقة معلّقة • ${unread} تنبيه غير مقروء`:'لا يوجد شيء يحتاج انتباهك الآن';const mark=$('#dcMarkAllRead');if(mark)mark.disabled=unread===0}
function renderCurrentState(){if(!lastState)return;let tab=document.querySelector('[data-notify-tab].active')?.dataset.notifyTab;if(!tab){tab=lastState.pending_approvals>0?'approvals':'notifications';selectTab(tab)}$('#dcNotifyBody').innerHTML=tab==='approvals'?approvalsHtml(lastState.approvals):notificationsHtml(lastState.notifications);bindNotificationRows()}
async function loadState(render=false,autoTab=false){try{const d=await api('state',{params:conversationId?{conversation_id:conversationId}:{}});lastState=d;updateCounters(d);if(d.unread_count>knownUnread&&'Notification'in window&&Notification.permission==='granted'){const newest=(d.notifications||[]).find(x=>!x.is_read);if(newest)new Notification(newest.title,{body:newest.body||'مطلوب إجراء منك'})}knownUnread=d.unread_count||0;localStorage.setItem('dc_known_unread',knownUnread);
 if(render&&!$('#dcNotifyPanel').classList.contains('hidden')){if(autoTab){if((d.approvals||[]).length)selectTab('approvals');else selectTab('notifications')}renderCurrentState()}
 if(d.messages?.length&&$('#dcChatMessages').children.length<=1){$('#dcChatMessages').innerHTML='';d.messages.forEach(m=>addMsg(m.role==='USER'?'user':'assistant',m.content))}return d}catch(e){if(render&&!$('#dcNotifyPanel').classList.contains('hidden'))$('#dcNotifyBody').innerHTML='<div class="dcEmpty dcError"><strong>تعذر تحميل مركز الإجراءات</strong><br>جرّب التحديث مرة ثانية. إذا استمرت المشكلة فلن نخفيها خلف شاشة فارغة.</div>';return null}}
function bindNotificationRows(){document.querySelectorAll('[data-approve]').forEach(b=>b.onclick=()=>resolve(Number(b.dataset.approve),'APPROVED',b));document.querySelectorAll('[data-reject]').forEach(b=>b.onclick=()=>resolve(Number(b.dataset.reject),'REJECTED',b));document.querySelectorAll('[data-notification]').forEach(x=>x.onclick=async()=>{if(!x.classList.contains('unread'))return;try{await api('read_notification',{method:'POST',body:{id:Number(x.dataset.notification)}});await loadState(true,false)}catch{}})}
async function markAllRead(){const b=$('#dcMarkAllRead');if(b)b.disabled=true;try{await api('mark_all_read',{method:'POST'});await loadState(true,false)}catch{if(b)b.disabled=false}}
async function resolve(id,decision,button){const card=button?.closest('.dcApproval');card?.classList.add('loading');try{await api('resolve_approval',{method:'POST',body:{id,decision}});await loadState(true,true)}catch(e){card?.classList.remove('loading');const body=$('#dcNotifyBody');if(body)body.insertAdjacentHTML('afterbegin','<div class="dcInlineError">تعذر تحديث هذه الموافقة. لم يتم اعتبارها منفذة.</div>')}}
function startPolling(){clearInterval(pollTimer);pollTimer=setInterval(()=>{if(document.visibilityState==='visible')loadState(false,false)},60000)}
async function boot(){inject();renderBrowserNotice();const s=await session();if(s){$('#dcAssistantFab').classList.remove('hidden');await loadState(false,false);startPolling()}supabase.auth.onAuthStateChange((_e,sess)=>{currentSession=sess||null;if(sess){$('#dcAssistantFab')?.classList.remove('hidden');loadState(false,false);startPolling()}else{$('#dcAssistantFab')?.classList.add('hidden');clearInterval(pollTimer);pollTimer=null}});document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&currentSession)loadState(false,false)})}
boot();