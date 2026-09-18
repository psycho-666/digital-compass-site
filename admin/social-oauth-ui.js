import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
const PROJECT_URL='https://xnoalyxxrjyovivdeojo.supabase.co';
const KEY='sb_publishable_oakIu8ywKQLibfDJUDYIVg_XsNNZi66';
const API=`${PROJECT_URL}/functions/v1/social-oauth`;
const supabase=createClient(PROJECT_URL,KEY,{auth:{persistSession:true,autoRefreshToken:true}});
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
let currentSession=null;
async function session(){if(currentSession)return currentSession;currentSession=(await supabase.auth.getSession()).data.session;return currentSession}
async function api(action,{method='GET',body,params={}}={}){const s=await session();if(!s)throw new Error('NO_SESSION');const u=new URL(API);u.searchParams.set('action',action);Object.entries(params).forEach(([k,v])=>u.searchParams.set(k,String(v)));const r=await fetch(u,{method,headers:{apikey:KEY,Authorization:`Bearer ${s.access_token}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,cache:'no-store'});const d=await r.json().catch(()=>({}));if(!r.ok){const e=new Error(d.error||`HTTP_${r.status}`);e.data=d;throw e}return d}
function styles(){if($('#dcOauthStyles'))return;document.head.insertAdjacentHTML('beforeend',`<style id="dcOauthStyles">.dcOauthBtn{border:1px solid rgba(255,255,255,.14);background:#fff;color:#251834;border-radius:10px;padding:10px 13px;font-weight:800;cursor:pointer}.dcOauthBtn:disabled{opacity:.55;cursor:wait}.dcOauthOverlay{position:fixed;z-index:400;inset:0;background:rgba(5,3,8,.72);backdrop-filter:blur(10px);display:grid;place-items:center;padding:18px}.dcOauthModal{width:min(680px,100%);max-height:min(820px,calc(100vh - 36px));overflow:auto;background:#17101f;border:1px solid rgba(255,255,255,.14);border-radius:22px;padding:24px;box-shadow:0 30px 100px rgba(0,0,0,.55)}.dcOauthHead{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:18px}.dcOauthHead h2{margin:4px 0 0;font:700 22px Alexandria,sans-serif}.dcOauthHead p{margin:7px 0 0;color:#a99db0;font-size:12px;line-height:1.75}.dcOauthClose{border:0;background:transparent;color:#fff;font-size:28px;cursor:pointer}.dcOauthNotice{border:1px solid rgba(239,203,128,.25);background:rgba(239,203,128,.06);border-radius:12px;padding:12px;color:#e8c77f;font-size:11px;line-height:1.8;margin:12px 0}.dcOauthGood{border-color:rgba(157,231,187,.24);background:rgba(157,231,187,.06);color:#9de7bb}.dcOauthForm{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px}.dcOauthForm label{display:grid;gap:6px;color:#a99db0;font-size:11px}.dcOauthForm label.full{grid-column:1/-1}.dcOauthForm input{width:100%;background:#100b16;color:#fff;border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:11px}.dcOauthActions{display:flex;gap:9px;flex-wrap:wrap;margin-top:18px}.dcOauthActions button{border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:10px 13px;background:#21162b;color:#fff;cursor:pointer}.dcOauthActions .primary{background:#fff;color:#251834;font-weight:800}.dcAsset{border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:14px;margin:9px 0;background:rgba(255,255,255,.025);display:flex;align-items:center;justify-content:space-between;gap:14px}.dcAsset b{display:block;font-size:13px}.dcAsset small{color:#a99db0;line-height:1.6}.dcAsset button{border:0;border-radius:9px;background:#fff;color:#251834;font-weight:800;padding:9px 12px;cursor:pointer}.dcOauthCode{direction:ltr;text-align:left;word-break:break-all;background:#0f0a15;border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:10px;color:#cdbce6;font:500 10px/1.7 Manrope,sans-serif}.dcOauthStatus{font-size:11px;color:#a99db0;margin-top:10px;min-height:18px}@media(max-width:700px){.dcOauthForm{grid-template-columns:1fr}.dcOauthForm label.full{grid-column:auto}.dcAsset{align-items:flex-start;flex-direction:column}.dcAsset button{width:100%}}</style>`)}
function close(){document.querySelector('.dcOauthOverlay')?.remove()}
function modal(html){close();document.body.insertAdjacentHTML('beforeend',`<div class="dcOauthOverlay"><section class="dcOauthModal"><div class="dcOauthHead"><div><span class="eyebrow">META / OAUTH</span><h2>ربط حساب العميل</h2><p>الربط الرسمي مع Facebook وInstagram Business، بدون تخزين التوكن في المتصفح.</p></div><button class="dcOauthClose" aria-label="Close">×</button></div>${html}</section></div>`);$('.dcOauthClose').onclick=close;$('.dcOauthOverlay').addEventListener('click',e=>{if(e.target.classList.contains('dcOauthOverlay'))close()})}
function statusText(el,text,good=false){if(!el)return;el.textContent=text;el.style.color=good?'#9de7bb':'#e8c77f'}
async function showSetup(){
  modal('<div class="dcOauthNotice">إعداد Meta مرة واحدة للنظام. بما أن OAuth الأساسي جاهز، نخزن Webhook Verify Token بشكل مستقل ثم نكمل إعداد Webhooks داخل Meta Developer.</div><div id="dcOauthSetupInfo"></div><div class="dcOauthForm"><label class="full">Webhook Verify Token<div style="display:flex;gap:8px;flex-wrap:wrap"><input id="dcMetaWebhookToken" type="text" autocomplete="off" placeholder="اضغط توليد Verify Token"><button type="button" id="dcCopyWebhookToken">نسخ</button></div><div id="dcWebhookTokenPreview" class="dcOauthCode" style="display:none;direction:ltr;text-align:left;word-break:break-all;margin-top:8px"></div></label></div><div class="dcOauthActions"><button id="dcGenerateWebhook">توليد Verify Token جديد</button><button class="primary" id="dcSaveWebhook">حفظ Webhook Token فقط</button><button id="dcRefreshMeta">فحص الإعداد</button><button id="dcShowAdvanced">إعدادات OAuth المتقدمة</button></div><div id="dcAdvancedMeta" style="display:none;margin-top:16px"><div class="dcOauthForm"><label>Meta App ID<input id="dcMetaAppId" inputmode="numeric" placeholder="123456789..."></label><label>Graph API Version<input id="dcMetaApiVersion" placeholder="vXX.X"></label><label class="full">Login Configuration ID<input id="dcMetaLoginConfigId" inputmode="numeric" placeholder="Facebook Login for Business config ID"></label><label class="full">Meta App Secret<input id="dcMetaAppSecret" type="password" autocomplete="off" placeholder="يُحفظ بشكل آمن ولا يظهر لاحقاً"></label></div><div class="dcOauthActions"><button id="dcSaveMeta">حفظ إعدادات OAuth المتقدمة</button></div></div><div id="dcOauthSetupStatus" class="dcOauthStatus"></div>');
  const info=$('#dcOauthSetupInfo'),statusEl=$('#dcOauthSetupStatus');
  async function refresh(){
    try{
      const s=await api('status');
      const full=s.ready&&s.webhook_ready;
      info.innerHTML='<div class="dcOauthNotice '+(full?'dcOauthGood':'')+'"><b>'+(full?'✓ Meta OAuth + Webhook جاهزين':s.ready?'OAuth جاهز · Webhook ناقص':'الإعداد ناقص')+'</b><br>App ID: '+(s.app_id_configured?'موجود':'غير موجود')+' · App Secret: '+(s.app_secret_configured?'محفوظ':'غير موجود')+' · Login Config: '+(s.login_config_id_configured?'موجود':'غير موجود')+' · Webhook Token: '+(s.webhook_verify_token_configured?'محفوظ':'غير موجود')+' · API: '+esc(s.api_version||'غير محدد')+'</div><p class="muted">Valid OAuth Redirect URI:</p><div class="dcOauthCode">'+esc(s.callback_url)+'</div><p class="muted">Meta Webhook Callback URL:</p><div class="dcOauthCode">'+esc(s.webhook_callback_url||'')+'</div><p class="muted">الصلاحيات المطلوبة: '+esc((s.required_scopes||[]).join(', '))+'</p>';
      if(full)statusText(statusEl,'الإعداد الداخلي جاهز للربط والاستقبال الحقيقي.',true);
      else if(s.ready)statusText(statusEl,'OAuth جاهز. المطلوب الآن فقط حفظ Webhook Verify Token.');
    }catch(e){statusText(statusEl,'تعذر فحص إعداد Meta الآن.')}
  }
  await refresh();
  $('#dcRefreshMeta').onclick=refresh;
  $('#dcShowAdvanced').onclick=e=>{e.preventDefault();const box=$('#dcAdvancedMeta');box.style.display=box.style.display==='none'?'block':'none'};
  $('#dcGenerateWebhook').onclick=async e=>{e.preventDefault();const bytes=new Uint8Array(24);crypto.getRandomValues(bytes);const token=Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');const input=$('#dcMetaWebhookToken'),preview=$('#dcWebhookTokenPreview');input.value=token;preview.textContent=token;preview.style.display='block';try{await navigator.clipboard.writeText(token);statusText(statusEl,'تم توليد Verify Token جديد ونسخه للحافظة. احتفظ فيه لاستخدامه داخل Meta Webhooks.',true)}catch{statusText(statusEl,'تم توليد Verify Token جديد. انسخه من الحقل أو المربع الظاهر تحته.')}};
  $('#dcCopyWebhookToken').onclick=async e=>{e.preventDefault();const token=$('#dcMetaWebhookToken').value;if(!token)return statusText(statusEl,'ولّد Verify Token أولاً.');try{await navigator.clipboard.writeText(token);statusText(statusEl,'تم نسخ Verify Token للحافظة.',true)}catch{const input=$('#dcMetaWebhookToken');input.focus();input.select();statusText(statusEl,'تم تحديد التوكن. اختر نسخ من المتصفح.')}};
  $('#dcSaveWebhook').onclick=async()=>{
    const b=$('#dcSaveWebhook'),token=$('#dcMetaWebhookToken').value.trim();
    if(token.length<16)return statusText(statusEl,'ولّد Verify Token جديد أولاً.');
    b.disabled=true;statusText(statusEl,'جاري حفظ Webhook Token فقط…');
    try{
      const r=await api('configure_webhook',{method:'POST',body:{webhook_verify_token:token}});
      if(!r.webhook_ready)throw new Error('webhook_save_failed');
      statusText(statusEl,'تم حفظ Webhook Token بنجاح. الآن استخدم نفس القيمة داخل Meta Webhooks.',true);
      await refresh()
    }catch(e){
      statusText(statusEl,'تعذر حفظ Webhook Token: '+esc(e.message||'unknown'))
    }finally{b.disabled=false}
  };
  $('#dcSaveMeta').onclick=async()=>{
    const b=$('#dcSaveMeta');b.disabled=true;statusText(statusEl,'جاري حفظ إعدادات OAuth المتقدمة…');
    try{
      await api('configure_meta',{method:'POST',body:{
        app_id:$('#dcMetaAppId').value.trim(),
        app_secret:$('#dcMetaAppSecret').value.trim(),
        api_version:$('#dcMetaApiVersion').value.trim(),
        login_config_id:$('#dcMetaLoginConfigId').value.trim()
      }});
      $('#dcMetaAppSecret').value='';
      statusText(statusEl,'تم حفظ إعدادات OAuth المتقدمة.',true);await refresh()
    }catch(e){
      statusText(statusEl,'تعذر حفظ إعدادات OAuth: '+esc(e.message||'unknown'))
    }finally{b.disabled=false}
  }
}
async function showUatTokenConnect(){
  const wid=Number($('#workspaceSelect')?.value);
  if(!wid){modal('<div class="dcOauthNotice">اختر العميل أولاً من القائمة أعلى الصفحة.</div>');return}
  modal('<div class="dcOauthNotice">UAT فقط — استخدم التوكن من Meta Messenger Setup. النظام يتأكد منه، ويستخرج Page Access Token الحقيقي إذا كان التوكن من نوع User/Business، ثم يخزنه في Vault. لا ترسل التوكن في المحادثة.</div><div class="dcOauthForm"><label class="full">Meta Access Token<textarea id="dcUatPageToken" autocomplete="off" style="min-height:110px;direction:ltr;text-align:left" placeholder="الصق التوكن هنا"></textarea></label></div><div class="dcOauthActions"><button class="primary" id="dcConnectUatToken">تحقق واربط</button></div><div id="dcUatPages"></div><div id="dcUatStatus" class="dcOauthStatus"></div>');
  const btn=$('#dcConnectUatToken'),statusEl=$('#dcUatStatus'),pagesBox=$('#dcUatPages');

  async function connect(pageId=''){
    const token=$('#dcUatPageToken').value.trim();
    if(token.length<20)return statusText(statusEl,'الصق التوكن أولاً.');
    btn.disabled=true;statusText(statusEl,'جاري التحقق من التوكن والبحث عن الصفحة…');
    try{
      const r=await api('uat_page_token',{method:'POST',body:{workspace_id:wid,page_access_token:token,page_id:pageId||undefined}});
      $('#dcUatPageToken').value='';
      pagesBox.innerHTML='';
      statusText(statusEl,'تم ربط صفحة الاختبار بنجاح: '+(r.page?.name||r.page?.id||'Page')+' · '+(r.resolution||''),true);
      setTimeout(()=>location.reload(),900)
    }catch(e){
      if(e.message==='page_selection_required'&&Array.isArray(e.data?.pages)){
        pagesBox.innerHTML='<div class="dcOauthNotice">Meta رجّع أكثر من صفحة. اختر الصفحة المطلوبة:</div>'+e.data.pages.map(p=>'<article class="dcAsset"><div><b>'+esc(p.name)+'</b><small>Page ID: '+esc(p.id)+'</small></div><button data-uat-page="'+esc(p.id)+'">اختيار</button></article>').join('');
        pagesBox.querySelectorAll('[data-uat-page]').forEach(x=>x.onclick=()=>connect(x.dataset.uatPage));
        statusText(statusEl,'اختر صفحة واحدة للربط.');
      }else if(e.message==='page_identity_unavailable'){
        const d=e.data?.diagnostic||{};
        statusText(statusEl,'تعذر تحديد الصفحة. نوع التوكن: '+(d.token_type||'UNKNOWN')+' · profile_id: '+(d.has_profile_id?'نعم':'لا')+' · user_id: '+(d.has_user_id?'نعم':'لا')+' · scopes: '+Number(d.scopes_count||0));
      }else{
        const m=e.message==='invalid_page_token'?'التوكن غير صالح أو منتهي.':e.message==='token_app_mismatch'?'التوكن تابع لتطبيق Meta مختلف.':e.message;
        statusText(statusEl,'تعذر الربط: '+m)
      }
    }finally{btn.disabled=false}
  }
  btn.onclick=()=>connect();
}
async function startConnect(){const wid=Number($('#workspaceSelect')?.value);if(!wid){modal('<div class="dcOauthNotice">اختر العميل أولاً من القائمة أعلى الصفحة.</div>');return}const btn=$('#dcMetaConnectBtn');if(btn)btn.disabled=true;try{const s=await api('status');if(!s.ready||!s.webhook_ready){await showSetup();return}const d=await api('start',{method:'POST',body:{workspace_id:wid}});if(!d.authorization_url)throw new Error('missing_authorization_url');location.href=d.authorization_url}catch(e){if(e.message==='meta_not_configured')await showSetup();else modal(`<div class="dcOauthNotice">تعذر بدء ربط Meta: ${esc(e.message)}</div>`)}finally{if(btn)btn.disabled=false}}
async function showAssets(state){modal('<div class="dcOauthNotice dcOauthGood">✓ تمت موافقة Meta. اختر صفحة العميل التي تريد ربطها بهذا Workspace.</div><div id="dcAssets"><p class="muted">جاري تحميل الصفحات المسموح بها…</p></div><div id="dcAssetStatus" class="dcOauthStatus"></div>');const box=$('#dcAssets'),statusEl=$('#dcAssetStatus');try{const d=await api('assets',{params:{state}}),items=d.item?.assets||[];if(!items.length){box.innerHTML='<div class="dcOauthNotice">Meta لم يرجع أي Page متاح لهذا الحساب. تأكد أن الشخص الذي سجل الدخول عنده صلاحية على صفحة العميل وأن الصلاحيات المطلوبة مفعّلة في Meta App.</div>';return}box.innerHTML=items.map(x=>`<article class="dcAsset"><div><b>${esc(x.page_name)}</b><small>Facebook Page ID: ${esc(x.page_id)}${x.instagram_business_account?`<br>Instagram: @${esc(x.instagram_business_account.username||x.instagram_business_account.id)}`:'<br>لا يوجد Instagram Business مربوط بهذه الصفحة'}</small></div><button data-page-id="${esc(x.page_id)}">ربط هذه الصفحة</button></article>`).join('');box.querySelectorAll('[data-page-id]').forEach(b=>b.onclick=async()=>{b.disabled=true;statusText(statusEl,'جاري حفظ الاتصال والتوكن بشكل آمن…');try{const r=await api('complete',{method:'POST',body:{state,page_id:b.dataset.pageId,connect_facebook:true,connect_instagram:true}});statusText(statusEl,`تم الربط بنجاح: ${(r.connected||[]).map(x=>x.platform).join(' + ')}`,true);setTimeout(()=>{const u=new URL(location.href);u.searchParams.delete('oauth');u.searchParams.delete('state');u.searchParams.delete('workspace');history.replaceState(null,'',u);location.reload()},900)}catch(e){statusText(statusEl,`تعذر إكمال الربط: ${e.message}`);b.disabled=false}})}catch(e){box.innerHTML=`<div class="dcOauthNotice">تعذر تحميل صفحات Meta: ${esc(e.message)}</div>`}}
async function handleReturn(){const u=new URL(location.href),mode=u.searchParams.get('oauth'),state=u.searchParams.get('state');if(mode==='select'&&state){await showAssets(state);return}if(mode==='error'){modal(`<div class="dcOauthNotice">Meta OAuth لم يكتمل. السبب: ${esc(u.searchParams.get('reason')||'unknown')}</div>`);u.searchParams.delete('oauth');u.searchParams.delete('reason');history.replaceState(null,'',u)}}
async function inject(){styles();for(let i=0;i<50&&!$('#workspaceSelect');i++)await new Promise(r=>setTimeout(r,100));const actions=document.querySelector('.topActions');if(actions&&!$('#dcMetaConnectBtn'))actions.insertAdjacentHTML('afterbegin','<button id="dcUatTokenBtn" class="dcOauthBtn" type="button">ربط صفحة اختبار (UAT)</button><button id="dcMetaConnectBtn" class="dcOauthBtn" type="button">ربط Facebook / Instagram</button>');$('#dcMetaConnectBtn')?.addEventListener('click',startConnect);$('#dcUatTokenBtn')?.addEventListener('click',showUatTokenConnect);await handleReturn()}
supabase.auth.onAuthStateChange((_e,s)=>{currentSession=s||null});inject().catch(console.error);