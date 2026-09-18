import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
const PROJECT_URL='https://xnoalyxxrjyovivdeojo.supabase.co';
const KEY='sb_publishable_oakIu8ywKQLibfDJUDYIVg_XsNNZi66';
const API=`${PROJECT_URL}/functions/v1/social-management-api`;
const supabase=createClient(PROJECT_URL,KEY,{auth:{persistSession:true,autoRefreshToken:true}});
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
let session=null,workspaces=[],data=null,health=null,tab='overview';
function toast(t){const e=$('#toast');e.textContent=t;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),2200)}
async function api(action,{method='GET',body,params={}}={}){const u=new URL(API);u.searchParams.set('action',action);Object.entries(params).forEach(([k,v])=>u.searchParams.set(k,v));const r=await fetch(u,{method,headers:{apikey:KEY,Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'request_failed');return d}
async function boot(){const s=await supabase.auth.getSession();session=s.data.session;if(!session){location.href='./';return}$('#app').classList.remove('hidden');await loadWorkspaces();$('#logoutBtn').onclick=async()=>{await supabase.auth.signOut();location.href='./'};$('#refreshBtn').onclick=()=>loadWorkspace();$('#workspaceSelect').onchange=()=>loadWorkspace();$('#tabs').onclick=e=>{const b=e.target.closest('button[data-tab]');if(!b)return;tab=b.dataset.tab;$$('#tabs button').forEach(x=>x.classList.toggle('active',x===b));render()}}
async function loadWorkspaces(){const d=await api('workspaces');workspaces=d.items||[];const sel=$('#workspaceSelect');sel.innerHTML='<option value="">اختر العميل</option>'+workspaces.map(w=>`<option value="${w.workspace_id}">${esc(w.company_name)}</option>`).join('');if(!workspaces.length){$('#emptyState').classList.remove('hidden');$('#workspaceView').classList.add('hidden');return}$('#emptyState').classList.add('hidden');$('#workspaceView').classList.remove('hidden');if(!sel.value)sel.value=String(workspaces[0].workspace_id);await loadWorkspace()}
async function loadWorkspace(){const id=Number($('#workspaceSelect').value);if(!id)return;const [w,h]=await Promise.all([api('workspace',{params:{id}}),api('operations_health').catch(()=>null)]);data=w;health=h;renderMetrics();render()}
function renderMetrics(){const s=data.summary||{};const items=[['Connected',s.connected_accounts],['Open inbox',s.open_inbox],['Content approvals',s.content_waiting_approval],['Scheduled',s.scheduled_posts],['Blocked jobs',health?.blocked_connection_jobs||0],['Failed jobs',health?.failed_execution_jobs||0]];$('#metrics').innerHTML=items.map(([l,v])=>'<div class="metric"><span class="label">'+esc(l)+'</span><strong>'+Number(v||0)+'</strong><div class="mini">LIVE</div></div>').join('')}
function render(){if(!data)return;({overview:renderOverview,strategy:renderStrategy,inbox:renderInbox,faq:renderFaq,content:renderContent,ads:renderAds,reports:renderReports,activity:renderActivity}[tab]||renderOverview)()}
function renderOverview(){
  const w=data.workspace||{},p=data.response_policy||{},g=data.guardrails||{},conns=data.connections||[],jobs=data.execution_jobs||[];
  const connected=conns.filter(x=>x.connection_status==='CONNECTED'&&x.authorized_by_client);
  const failed=jobs.filter(x=>x.status==='FAILED').length,blocked=jobs.filter(x=>x.status==='BLOCKED_CONNECTION').length;
  let connectionHtml=conns.length?conns.map(x=>line(x.platform,String(x.connection_status||'')+' · '+String(x.sync_status||'NO SYNC'))).join(''):line('الحسابات','NOT CONNECTED');
  let queueHtml=jobs.slice(0,8).map(x=>line(String(x.job_type)+' #'+x.id,x.status)).join('')||'<p class="muted">No jobs yet.</p>';
  $('#panel').innerHTML=
    '<div class="connectionBanner">'+(connected.length?'الحسابات المصرح بها متصلة ويمكن تشغيل النشر والردود وفق الموافقات.':'ما في حساب عميل متصل رسميًا بعد. التنفيذ الخارجي يبقى مقفول لحد إكمال OAuth وموافقة العميل.')+'</div>'+
    '<div class="panelGrid">'+
      '<div class="card"><h3>جاهزية مساحة العميل</h3>'+
        line('Workspace',w.workspace_status||'—')+
        line('Strategy',w.strategy_status||'—')+
        line('Client approval',w.client_approval_required?'REQUIRED':'OPTIONAL')+
        line('Response SLA',w.response_sla_minutes?String(w.response_sla_minutes)+' min':'NOT SET')+
        '<div class="readinessList"><span class="'+(connected.length?'ready':'notReady')+'">1. ربط الحسابات الرسمية</span><span class="'+(w.strategy_status==='APPROVED'?'ready':'notReady')+'">2. اعتماد الاستراتيجية</span><span class="'+((p.smart_memory_enabled||p.approved_library_enabled)?'ready':'notReady')+'">3. سياسة الردود</span><span class="'+(connected.length&&w.strategy_status==='APPROVED'?'ready':'notReady')+'">4. جاهز للتشغيل</span></div></div>'+
      '<div class="card"><h3>Connection health</h3>'+connectionHtml+'<div class="actionRow"><span class="muted">التوكنات والصلاحيات تبقى بالخلفية ولا تظهر بالواجهة.</span></div></div>'+
      '<div class="card"><h3>Reply policy</h3>'+
        line('Smart memory',p.smart_memory_enabled?'ON':'OFF')+
        line('Approved library',p.approved_library_enabled?'ON':'OFF')+
        line('Messages auto reply',p.messages_auto_reply_enabled?'ON':'OFF')+
        line('Comments auto reply',p.comments_auto_reply_enabled?'ON':'OFF')+
        line('Lookback',String(p.lookback_days||365)+' days')+
        '<div class="actionRow"><button data-toggle-auto="messages">Toggle messages</button><button data-toggle-auto="comments">Toggle comments</button></div></div>'+
      '<div class="card"><h3>Operations health</h3>'+
        line('Blocked connection jobs',blocked)+line('Failed execution jobs',failed)+line('Expired OAuth sessions',health?.expired_oauth_sessions||0)+line('Research backlog',health?.pending_research_requests||0)+'</div>'+
      '<div class="card"><h3>Ad guardrails</h3>'+line('Spend approval',g.require_owner_approval_for_spend?'REQUIRED':'OPTIONAL')+line('Auto pause',g.allow_auto_pause?'ON':'OFF')+line('Auto resume',g.allow_auto_resume?'ON':'OFF')+line('Targeting auto-change',g.allow_auto_targeting_change?'ON':'OFF')+'</div>'+
      '<div class="card"><h3>Execution queue</h3>'+queueHtml+'</div>'+
    '</div>';
  $$('[data-toggle-auto]').forEach(b=>b.onclick=()=>toggleAuto(b.dataset.toggleAuto))
}
function line(a,b){const c=['CONNECTED','ON','APPROVED','SUCCEEDED','ACTIVE'].includes(String(b))?'good':['ERROR','FAILED','REVOKED'].includes(String(b))?'bad':'warn';return `<div class="statusLine"><b>${esc(a)}</b><span class="pill2 ${c}">${esc(b)}</span></div>`}
async function toggleAuto(which){const p=data.response_policy||{};const body={workspace_id:data.workspace.id};body[which==='messages'?'messages_auto_reply_enabled':'comments_auto_reply_enabled']=!(which==='messages'?p.messages_auto_reply_enabled:p.comments_auto_reply_enabled);await api('update_response_policy',{method:'POST',body});toast('تم تحديث السياسة');await loadWorkspace()}
function pretty(v,fallback){try{return JSON.stringify(v??fallback,null,2)}catch{return JSON.stringify(fallback,null,2)}}
function parseJsonField(id,fallback){const raw=$(id).value.trim();if(!raw)return fallback;try{return JSON.parse(raw)}catch{throw new Error('INVALID_JSON:'+id)}}
function renderStrategy(){
  const w=data.workspace||{};
  $('#panel').innerHTML=
    '<div class="connectionBanner">هذه الإعدادات هي عقل إدارة الحساب. ما يصير تشغيل Workspace فعلي بدون Connection رسمي، والاستراتيجية تبقى منفصلة عن صلاحيات النشر.</div>'+
    '<div class="panelGrid">'+
      '<div class="card"><h3>Workspace controls</h3><div class="formGrid">'+
        '<label>Workspace status<select id="wsStatus"><option>PLANNING</option><option>ONBOARDING</option><option>ACTIVE</option><option>PAUSED</option><option>ENDED</option></select></label>'+
        '<label>Strategy status<select id="strategyStatus"><option>PENDING</option><option>DRAFT</option><option>READY_FOR_REVIEW</option><option>APPROVED</option><option>NEEDS_CHANGES</option></select></label>'+
        '<label>Response SLA (minutes)<input id="slaMinutes" type="number" min="1" max="10080" value="'+esc(w.response_sla_minutes||60)+'"></label>'+
        '<label class="checkLabel"><input id="clientApproval" type="checkbox" '+(w.client_approval_required?'checked':'')+'> يتطلب موافقة العميل قبل النشر</label>'+
        '<button id="saveStrategy" class="smallBtn primary">حفظ الإعدادات</button>'+
      '</div></div>'+
      '<div class="card"><h3>Brand voice & content pillars</h3><div class="formGrid">'+
        '<label class="full">Brand voice JSON<textarea id="brandVoice">'+esc(pretty(w.brand_voice,{}))+'</textarea></label>'+
        '<label class="full">Content pillars JSON<textarea id="contentPillars">'+esc(pretty(w.content_pillars,[]))+'</textarea></label>'+
        '<label class="full">Audience profiles JSON<textarea id="audienceProfiles">'+esc(pretty(w.audience_profiles,[]))+'</textarea></label>'+
      '</div></div>'+
      '<div class="card"><h3>Platform & publishing rules</h3><div class="formGrid">'+
        '<label class="full">Platform strategy JSON<textarea id="platformStrategy">'+esc(pretty(w.platform_strategy,{}))+'</textarea></label>'+
        '<label class="full">Publishing rules JSON<textarea id="publishingRules">'+esc(pretty(w.publishing_rules,{}))+'</textarea></label>'+
      '</div></div>'+
      '<div class="card"><h3>Moderation, escalation & KPIs</h3><div class="formGrid">'+
        '<label class="full">Moderation rules JSON<textarea id="moderationRules">'+esc(pretty(w.moderation_rules,{}))+'</textarea></label>'+
        '<label class="full">Escalation rules JSON<textarea id="escalationRules">'+esc(pretty(w.escalation_rules,{}))+'</textarea></label>'+
        '<label class="full">KPI targets JSON<textarea id="kpiTargets">'+esc(pretty(w.kpi_targets,{}))+'</textarea></label>'+
      '</div></div>'+
    '</div>';
  $('#wsStatus').value=w.workspace_status||'PLANNING';
  $('#strategyStatus').value=w.strategy_status||'PENDING';
  $('#saveStrategy').onclick=async()=>{
    try{
      const body={
        workspace_id:w.id,
        workspace_status:$('#wsStatus').value,
        strategy_status:$('#strategyStatus').value,
        response_sla_minutes:Number($('#slaMinutes').value||60),
        client_approval_required:$('#clientApproval').checked,
        brand_voice:parseJsonField('#brandVoice',{}),
        content_pillars:parseJsonField('#contentPillars',[]),
        audience_profiles:parseJsonField('#audienceProfiles',[]),
        platform_strategy:parseJsonField('#platformStrategy',{}),
        publishing_rules:parseJsonField('#publishingRules',{}),
        moderation_rules:parseJsonField('#moderationRules',{}),
        escalation_rules:parseJsonField('#escalationRules',{}),
        kpi_targets:parseJsonField('#kpiTargets',{})
      };
      await api('update_workspace_setup',{method:'POST',body});
      toast('تم حفظ استراتيجية وقواعد العميل');await loadWorkspace()
    }catch(e){toast(String(e.message||'').startsWith('INVALID_JSON')?'في حقل JSON غير صحيح':e.message==='connection_required_for_active_workspace'?'اربط حساب العميل قبل تحويل Workspace إلى ACTIVE':'تعذر حفظ الإعدادات')}
  }
}
function renderInbox(){const rows=data.inbox||[];$('#panel').innerHTML=`<div class="section"><div class="sectionHead"><h3>Inbox & Comments</h3><span>${rows.length}</span></div><div class="tableWrap"><table class="table"><thead><tr><th>المرسل</th><th>النوع</th><th>الرسالة</th><th>الطريقة</th><th>الثقة</th><th>الحالة</th><th></th></tr></thead><tbody>${rows.map(x=>`<tr><td>${esc(x.sender_name||'—')}</td><td>${esc(x.message_type||'MESSAGE')}</td><td class="messagePreview">${esc(x.message_text||'')}</td><td>${esc(x.chosen_method||x.response_method||'—')}</td><td class="confidence">${x.decision_confidence!=null?Math.round(Number(x.decision_confidence)*100)+'%':'—'}</td><td>${esc(x.response_status)}</td><td>${x.response_status==='PENDING'?`<button class="smallBtn primary" data-prepare="${x.id}">معالجة</button>`:''}</td></tr>`).join('')}</tbody></table></div></div>`;$$('[data-prepare]').forEach(b=>b.onclick=async()=>{await api('prepare_reply',{method:'POST',body:{inbox_item_id:Number(b.dataset.prepare)}});toast('تم تجهيز قرار الرد');await loadWorkspace()})}
function renderFaq(){const f=data.faq||[],lib=data.library||[];$('#panel').innerHTML=`<div class="panelGrid"><div class="card"><h3>FAQ inventory — آخر سنة</h3><p>يجمع الأسئلة المتكررة ويقرب الصيغ المتشابهة تلقائيًا.</p><div class="actionRow"><button id="rebuildFaq" class="smallBtn primary">إعادة الجرد</button></div>${f.slice(0,12).map(x=>line(`${x.canonical_question} ×${x.occurrence_count_365d}`,x.status)).join('')||'<p class="muted">لا يوجد Inventory بعد.</p>'}</div><div class="card"><h3>إضافة رد رسمي</h3><div class="formGrid"><label class="full">السؤال<input id="faqQ"></label><label class="full">الرد<textarea id="faqA"></textarea></label><label>الأولوية<input id="faqPriority" type="number" value="50"></label><button id="saveFaq" class="smallBtn primary">حفظ الرد</button></div></div></div><div class="section"><div class="sectionHead"><h3>Approved reply library</h3><span>${lib.length}</span></div>${lib.map(x=>`<div class="statusLine"><b>${esc(x.canonical_question)}</b><span class="muted">${esc(x.approved_response)}</span></div>`).join('')}</div>`;$('#rebuildFaq').onclick=async()=>{await api('rebuild_faq',{method:'POST',body:{workspace_id:data.workspace.id,days:365,min_occurrences:2}});toast('تم تحديث جرد FAQ');await loadWorkspace()};$('#saveFaq').onclick=async()=>{const q=$('#faqQ').value.trim(),a=$('#faqA').value.trim();if(!q||!a)return toast('أدخل السؤال والرد');await api('library_reply',{method:'POST',body:{workspace_id:data.workspace.id,question:q,response:a,priority:Number($('#faqPriority').value||50)}});toast('تم حفظ الرد الرسمي');await loadWorkspace()}}
function renderContent(){
  const items=data.content||[],jobs=data.design_jobs||[],publish=data.publish_jobs||[],approved=items.filter(x=>x.approval_status==='APPROVED');
  const conns=(data.connections||[]).filter(x=>x.connection_status==='CONNECTED'&&x.authorized_by_client);
  const lifecycle=[['Draft',items.filter(x=>x.approval_status==='DRAFT').length],['Review',items.filter(x=>x.approval_status==='READY_FOR_REVIEW').length],['Approved',approved.length],['Scheduled',publish.filter(x=>['SCHEDULED','WAITING_APPROVAL'].includes(x.status)).length]];
  const lifeHtml=lifecycle.map(x=>'<div><span>'+esc(x[0])+'</span><b>'+x[1]+'</b></div>').join('');
  const approvedOptions=approved.map(x=>'<option value="'+x.id+'">#'+x.id+' · '+esc(x.platform)+' · '+esc((x.caption||'').slice(0,60))+'</option>').join('');
  const rows=items.map(x=>{
    let a='<button class="smallBtn" data-design="'+x.id+'">Design</button>';
    if(x.approval_status==='DRAFT')a+='<button class="smallBtn primary" data-status="'+x.id+'" data-next="READY_FOR_REVIEW">إرسال للمراجعة</button>';
    if(x.approval_status==='READY_FOR_REVIEW')a+='<button class="smallBtn primary" data-status="'+x.id+'" data-next="APPROVED">اعتماد</button><button class="smallBtn" data-status="'+x.id+'" data-next="CHANGES_REQUESTED">تعديلات</button>';
    if(['CHANGES_REQUESTED','REJECTED'].includes(x.approval_status))a+='<button class="smallBtn" data-status="'+x.id+'" data-next="DRAFT">إرجاع Draft</button>';
    return '<tr><td>'+esc(x.platform)+'</td><td>'+esc(x.content_type)+'</td><td class="messagePreview">'+esc(x.caption||'—')+'</td><td>'+esc(x.approval_status)+'</td><td>'+esc(x.publishing_status)+'</td><td><div class="rowActions">'+a+'</div></td></tr>';
  }).join('');
  const pubRows=publish.map(x=>'<tr><td>#'+x.id+'</td><td>'+esc(x.platform)+'</td><td>'+esc(x.scheduled_at||'—')+'</td><td>'+esc(x.status)+'</td><td>'+(!['PUBLISHED','CANCELLED'].includes(x.status)?'<button class="smallBtn" data-cancel-publish="'+x.id+'">إلغاء</button>':'')+'</td></tr>').join('');
  $('#panel').innerHTML=
    '<div class="contentLifecycle">'+lifeHtml+'</div>'+
    '<div class="panelGrid">'+
      '<div class="card"><h3>إنشاء محتوى</h3><div class="formGrid">'+
        '<label>المنصة<select id="cPlatform"><option>INSTAGRAM</option><option>FACEBOOK</option><option>TIKTOK</option></select></label>'+
        '<label>النوع<select id="cType"><option>POST</option><option>STORY</option><option>REEL</option><option>CAROUSEL</option></select></label>'+
        '<label>Content pillar<input id="cPillar" placeholder="مثال: تثقيف"></label>'+
        '<label>Objective<input id="cObjective" placeholder="ENGAGEMENT / LEADS"></label>'+
        '<label class="full">Caption<textarea id="cCaption"></textarea></label>'+
        '<label class="full">Creative brief<textarea id="cBrief"></textarea></label>'+
        '<label>CTA<input id="cCta" placeholder="احجز الآن"></label>'+
        '<label>Hashtags<input id="cTags" placeholder="#brand #iraq"></label>'+
        '<button id="createContent" class="smallBtn primary">إنشاء Draft</button>'+
      '</div></div>'+
      '<div class="card"><h3>جدولة محتوى معتمد</h3><p>الجدولة ما تشتغل إلا إذا المحتوى APPROVED والحساب متصل رسميًا.</p><div class="formGrid">'+
        '<label class="full">المحتوى<select id="scheduleContent"><option value="">اختر محتوى معتمد</option>'+approvedOptions+'</select></label>'+
        '<label class="full">موعد النشر<input id="scheduleAt" type="datetime-local"></label>'+
        '<button id="scheduleBtn" class="smallBtn primary" '+(!approved.length||!conns.length?'disabled':'')+'>جدولة النشر</button>'+
      '</div>'+(!conns.length?'<div class="inlineAlert bad">لا يوجد Connection رسمي. أكمل OAuth أولًا.</div>':'')+
      '<hr class="soft"><h3>Design queue</h3>'+(jobs.slice(0,8).map(x=>line(String(x.job_type)+' #'+x.id,x.status)).join('')||'<p class="muted">No design jobs.</p>')+'</div>'+
    '</div>'+
    '<div class="section"><div class="sectionHead"><h3>Content calendar</h3><span>'+items.length+'</span></div><div class="tableWrap"><table class="table"><thead><tr><th>Platform</th><th>Type</th><th>Caption</th><th>Approval</th><th>Publishing</th><th>Actions</th></tr></thead><tbody>'+rows+'</tbody></table></div></div>'+
    '<div class="section"><div class="sectionHead"><h3>Publishing queue</h3><span>'+publish.length+'</span></div><div class="tableWrap"><table class="table"><thead><tr><th>ID</th><th>Platform</th><th>Scheduled</th><th>Status</th><th></th></tr></thead><tbody>'+pubRows+'</tbody></table></div></div>';
  $('#createContent').onclick=async()=>{
    const tags=$('#cTags').value.split(/\s+/).map(x=>x.trim()).filter(Boolean);
    await api('create_content',{method:'POST',body:{workspace_id:data.workspace.id,platform:$('#cPlatform').value,content_type:$('#cType').value,content_pillar:$('#cPillar').value.trim()||null,objective:$('#cObjective').value.trim()||null,caption:$('#cCaption').value,creative_brief:$('#cBrief').value,call_to_action:$('#cCta').value.trim()||null,hashtags:tags}});
    toast('تم إنشاء Draft');await loadWorkspace()
  };
  $$('[data-design]').forEach(b=>b.onclick=async()=>{await api('design_job',{method:'POST',body:{workspace_id:data.workspace.id,content_item_id:Number(b.dataset.design),job_type:'POST_DESIGN',brief:{source:'content_item'}}});toast('تمت إضافة Design Job');await loadWorkspace()});
  $$('[data-status]').forEach(b=>b.onclick=async()=>{await api('set_content_status',{method:'POST',body:{workspace_id:data.workspace.id,content_item_id:Number(b.dataset.status),status:b.dataset.next}});toast('تم تحديث حالة المحتوى');await loadWorkspace()});
  const sb=$('#scheduleBtn');if(sb)sb.onclick=async()=>{const cid=Number($('#scheduleContent').value),local=$('#scheduleAt').value;if(!cid||!local)return toast('اختر المحتوى والموعد');const item=items.find(x=>Number(x.id)===cid);await api('schedule_publish',{method:'POST',body:{workspace_id:data.workspace.id,content_item_id:cid,platform:item.platform,scheduled_at:new Date(local).toISOString()}});toast('تمت جدولة النشر');await loadWorkspace()};
  $$('[data-cancel-publish]').forEach(b=>b.onclick=async()=>{await api('cancel_publish',{method:'POST',body:{workspace_id:data.workspace.id,publish_job_id:Number(b.dataset.cancelPublish)}});toast('تم إلغاء الجدولة');await loadWorkspace()})
}
function renderAds(){const cs=data.campaigns||[],acts=data.ad_actions||[];$('#panel').innerHTML=`<div class="connectionBanner">إنشاء الحملة ممكن كـDraft الآن، لكن أي Create/Resume/Budget/Targeting/Spend Action يمر عبر Approval Gate قبل التنفيذ الفعلي.</div><div class="panelGrid"><div class="card"><h3>Campaign draft</h3><div class="formGrid"><label class="full">الاسم<input id="adName"></label><label>Platform<select id="adPlatform"><option>META</option><option>INSTAGRAM</option><option>TIKTOK</option></select></label><label>Objective<select id="adObjective"><option>LEADS</option><option>MESSAGES</option><option>SALES</option><option>AWARENESS</option></select></label><label>Daily budget<input id="adBudget" type="number" min="0" step="0.01"></label><label>Currency<input id="adCurrency" value="USD"></label><button id="createCampaign" class="smallBtn primary">Create draft</button></div></div><div class="card"><h3>Recent ad actions</h3>${acts.slice(0,12).map(x=>line(`${x.action_type} #${x.id}`,x.status)).join('')||'<p class="muted">No actions yet.</p>'}</div></div><div class="section"><div class="sectionHead"><h3>Campaigns</h3><span>${cs.length}</span></div><div class="tableWrap"><table class="table"><thead><tr><th>Name</th><th>Objective</th><th>Budget</th><th>Status</th><th></th></tr></thead><tbody>${cs.map(x=>`<tr><td>${esc(x.campaign_name)}</td><td>${esc(x.objective)}</td><td>${esc(x.daily_budget??'—')} ${esc(x.currency||'')}</td><td>${esc(x.status)}</td><td><button class="smallBtn" data-launch="${x.id}" data-budget="${x.daily_budget||0}">طلب تشغيل</button></td></tr>`).join('')}</tbody></table></div></div>`;$('#createCampaign').onclick=async()=>{const name=$('#adName').value.trim();if(!name)return toast('أدخل اسم الحملة');await api('create_campaign',{method:'POST',body:{workspace_id:data.workspace.id,platform:$('#adPlatform').value,campaign_name:name,objective:$('#adObjective').value,daily_budget:Number($('#adBudget').value||0),currency:$('#adCurrency').value}});toast('تم إنشاء Draft');await loadWorkspace()};$$('[data-launch]').forEach(b=>b.onclick=async()=>{await api('ad_action',{method:'POST',body:{workspace_id:data.workspace.id,campaign_id:Number(b.dataset.launch),action_type:'CREATE_CAMPAIGN',payload:{requested_status:'ACTIVE'},spend_delta:Number(b.dataset.budget||0),risk_level:'HIGH'}});toast('تم إنشاء Approval لتشغيل الحملة');await loadWorkspace()})}
function renderReports(){
  const reports=data.performance_reports||[];
  const rows=reports.map(r=>{
    const growth=(r.followers_start!=null&&r.followers_end!=null)?Number(r.followers_end)-Number(r.followers_start):null;
    return '<tr><td>'+esc(r.period_start)+' → '+esc(r.period_end)+'</td><td>'+esc(r.platform||'ALL')+'</td><td>'+esc(r.reach??'—')+'</td><td>'+esc(r.impressions??'—')+'</td><td>'+esc(r.engagements??'—')+'</td><td>'+esc(growth==null?'—':growth)+'</td><td>'+esc(r.messages??'—')+'</td><td>'+esc(r.leads??'—')+'</td><td>'+esc(r.spend??'—')+'</td></tr>';
  }).join('');
  $('#panel').innerHTML=
    '<div class="connectionBanner">التقارير هنا تعتمد على بيانات فعلية من الحسابات المتصلة. إذا ماكو Connection أو مزامنة، ما راح نعرض أرقام مصطنعة.</div>'+
    '<div class="section"><div class="sectionHead"><h3>Performance reports</h3><span>'+reports.length+'</span></div>'+
    (reports.length?'<div class="tableWrap"><table class="table"><thead><tr><th>Period</th><th>Platform</th><th>Reach</th><th>Impressions</th><th>Engagements</th><th>Follower Δ</th><th>Messages</th><th>Leads</th><th>Spend</th></tr></thead><tbody>'+rows+'</tbody></table></div>':'<div class="emptyMini"><b>لا توجد تقارير فعلية بعد.</b><span>تبدأ بعد ربط حساب العميل ومزامنة البيانات.</span></div>')+
    '</div>'
}
function renderActivity(){
  const ops=data.operation_log||[],jobs=data.execution_jobs||[],failed=jobs.filter(x=>['FAILED','BLOCKED_CONNECTION'].includes(x.status));
  const attention=failed.slice(0,12).map(x=>'<div class="statusLine"><b>'+esc(x.job_type)+' #'+x.id+'<small>'+esc(x.last_error||'')+'</small></b><span><span class="pill2 bad">'+esc(x.status)+'</span> <button class="smallBtn" data-retry="'+x.id+'">Retry</button></span></div>').join('')||'<p class="muted">No failed jobs.</p>';
  const jobRows=jobs.map(x=>'<tr><td>#'+x.id+'</td><td>'+esc(x.job_type)+'</td><td>'+esc(x.status)+'</td><td>'+Number(x.attempts||0)+'</td><td class="messagePreview">'+esc(x.last_error||'—')+'</td></tr>').join('');
  $('#panel').innerHTML=
    '<div class="panelGrid"><div class="card"><h3>System health</h3>'+
      line('Active connections',health?.active_connections||0)+line('Expired OAuth sessions',health?.expired_oauth_sessions||0)+line('Pending research',health?.pending_research_requests||0)+line('Failed jobs',health?.failed_execution_jobs||0)+line('Blocked jobs',health?.blocked_connection_jobs||0)+
    '</div><div class="card"><h3>Needs attention</h3>'+attention+'</div></div>'+
    '<div class="section"><div class="sectionHead"><h3>Execution jobs</h3><span>'+jobs.length+'</span></div><div class="tableWrap"><table class="table"><thead><tr><th>ID</th><th>Type</th><th>Status</th><th>Attempts</th><th>Error</th></tr></thead><tbody>'+jobRows+'</tbody></table></div></div>'+
    '<div class="section"><div class="sectionHead"><h3>Operation log</h3><span>'+ops.length+'</span></div>'+(ops.slice(0,40).map(x=>line(String(x.operation_type)+': '+String(x.action),x.status)).join('')||'<p class="muted">No operations yet.</p>')+'</div>';
  $$('[data-retry]').forEach(b=>b.onclick=async()=>{try{await api('retry_execution_job',{method:'POST',body:{workspace_id:data.workspace.id,execution_job_id:Number(b.dataset.retry)}});toast('تمت إعادة المهمة للطابور');await loadWorkspace()}catch(e){toast(e.message==='connection_required'?'اربط الحساب أولًا':'تعذر إعادة المهمة')}})
}
boot().catch(e=>{console.error(e);toast('تعذر تحميل إدارة الحسابات')});