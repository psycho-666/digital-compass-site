import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PROJECT_URL='https://xnoalyxxrjyovivdeojo.supabase.co';
const PUBLISHABLE_KEY='sb_publishable_oakIu8ywKQLibfDJUDYIVg_XsNNZi66';
const supabase=createClient(PROJECT_URL,PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const fmt=n=>new Intl.NumberFormat('ar-IQ').format(Number(n||0));

function badge(text,cls=''){return `<span class="pill ${cls}">${esc(text)}</span>`}
function list(v){return Array.isArray(v)?v:[]}
function ensureSection(){
  if($('#prequalSection'))return;
  const anchor=[...document.querySelectorAll('.section')].find(x=>x.querySelector('#socialRows'));
  const section=document.createElement('div');
  section.id='prequalSection';section.className='section';
  section.innerHTML=`<div class="sectionHead"><div><h3>Ad-led Prequalified</h3><p style="margin:6px 0 0;color:var(--muted,#9f95ad);font-size:13px">تأهيل قائم على هوية عراقية مؤكدة + إعلان عام فعّال. هذا ليس Full Audit، وPosting / Content / Engagement تبقى غير مقاسة حتى يتوفر دليل عام أو صلاحية عميل.</p></div><span id="prequalCount">0</span></div><div id="prequalSummary" class="metrics" style="margin:14px 0 18px"></div><div class="tableWrap"><table class="table"><thead><tr><th>النشاط</th><th>المنصة</th><th>Confidence</th><th>الدليل</th><th>غير مقاس</th><th>الحالة</th></tr></thead><tbody id="prequalRows"><tr><td colspan="6">تحميل…</td></tr></tbody></table></div>`;
  if(anchor)anchor.parentNode.insertBefore(section,anchor);else $('.content')?.appendChild(section);
}

async function load(){
  ensureSection();
  const {data:{session}}=await supabase.auth.getSession();
  if(!session)return;
  const {data,error}=await supabase.rpc('admin_social_prequalifications',{p_limit:50});
  if(error){console.error(error);$('#prequalRows').innerHTML='<tr><td colspan="6">تعذر تحميل Prequalification.</td></tr>';return}
  const d=data||{},items=d.items||[];
  $('#prequalCount').textContent=fmt(d.total||0);
  $('#prequalSummary').innerHTML=`<div class="metric"><span class="label">Prequalified</span><strong>${fmt(d.total||0)}</strong><div class="mini">AD-LED</div></div><div class="metric"><span class="label">High confidence ≥90</span><strong>${fmt(d.high_confidence||0)}</strong><div class="mini">VERIFIED EVIDENCE</div></div>`;
  $('#prequalRows').innerHTML=items.map(x=>`<tr class="prequalRow" data-prequal-company="${x.company_id}"><td><strong>${esc(x.business_name||x.company_name||'—')}</strong><br><span>${esc(x.city||'')} · ${esc(x.sector||'')}</span></td><td>${esc(x.primary_platform||'—')}</td><td><strong>${fmt(x.confidence_score)}</strong>/100</td><td>${badge('LOCAL ID','good')} ${badge('ACTIVE ADS','good')}<br><span style="font-size:12px">Ad ${fmt(x.direct_ad_signal_score)} · Local ${fmt(x.local_signal_score)}</span></td><td>${list(x.unmeasured_dimensions).map(v=>badge(v,'warn')).join(' ')||'—'}</td><td>${badge(x.status||'PREQUALIFIED','warn')}<br><span style="font-size:12px">${esc(x.recommended_next_action||'')}</span></td></tr>`).join('')||'<tr><td colspan="6">لا توجد نتائج مؤهلة بعد.</td></tr>';
  document.querySelectorAll('[data-prequal-company]').forEach(r=>r.onclick=()=>openDetail(Number(r.dataset.prequalCompany)));
}

async function openDetail(companyId){
  const drawer=$('#drawer'),box=$('#drawerContent');if(!drawer||!box)return;
  drawer.classList.remove('hidden');drawer.setAttribute('aria-hidden','false');box.innerHTML='<div class="empty">تحميل Prequalification…</div>';
  const {data,error}=await supabase.rpc('admin_social_prequalification_detail',{p_company_id:companyId});
  if(error||!data||!Object.keys(data).length){box.innerHTML='<div class="empty">تعذر تحميل التفاصيل.</div>';return}
  const x=data,e=x.evidence||{},lr=x.local_relevance_evidence||{};
  const signals=list(lr.signals).slice(0,12);
  box.innerHTML=`<span class="eyebrow">AD-LED PREQUALIFICATION</span><h2 class="drawerTitle">${esc(x.business_name||x.company_name||'—')}</h2><div class="drawerMeta">${esc(x.city||'')} · ${esc(x.sector||'')} · ${esc(x.primary_platform||'')}</div><div class="detailGrid"><div class="detailBox"><b>Confidence</b><span>${fmt(x.confidence_score)}/100</span></div><div class="detailBox"><b>Direct ad signal</b><span>${fmt(x.direct_ad_signal_score)}/100</span></div><div class="detailBox"><b>Local signal</b><span>${fmt(x.local_signal_score)}/100</span></div><div class="detailBox"><b>Status</b><span>${esc(x.status)}</span></div></div><div class="drawerSection"><h3>ما تم إثباته</h3><div class="miniList">${list(x.measured_dimensions).map(v=>`<div class="miniRow"><p>✓ ${esc(v)}</p></div>`).join('')}</div></div><div class="drawerSection"><h3>غير مقاس — لا يُفترض تلقائيًا</h3><div class="miniList">${list(x.unmeasured_dimensions).map(v=>`<div class="miniRow"><p>— ${esc(v)}</p></div>`).join('')}</div></div><div class="drawerSection"><h3>الأدلة</h3><div class="miniList"><div class="miniRow"><p>${esc(x.evidence_summary||'')}</p></div>${signals.map(s=>`<div class="miniRow"><b>${esc(s.signal||'signal')}</b><p>${esc(typeof s.value==='object'?JSON.stringify(s.value):s.value||'')}</p></div>`).join('')}${x.profile_url?`<div class="miniRow"><a class="link" href="${esc(x.profile_url)}" target="_blank" rel="noopener">فتح الصفحة ↗</a></div>`:''}${x.ad_library_url?`<div class="miniRow"><a class="link" href="${esc(x.ad_library_url)}" target="_blank" rel="noopener">فتح Ad Library ↗</a></div>`:''}${x.landing_url?`<div class="miniRow"><a class="link" href="${esc(x.landing_url)}" target="_blank" rel="noopener">فتح Landing ↗</a></div>`:''}</div></div><div class="drawerSection"><h3>الخطوة التالية</h3><div class="miniRow"><p>${esc(x.recommended_next_action||'ENRICH_AD_LED_PREQUALIFICATION')}</p></div></div>`;
}

setTimeout(load,350);
$('#refreshBtn')?.addEventListener('click',()=>setTimeout(load,150));
