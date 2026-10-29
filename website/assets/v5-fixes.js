/* V5 production fixes: bilingual locations, safe internal navigation, real tabs, international WhatsApp */
function v5CompanyKey(data){
  const id=Number(data?.company?.id||data?.company_id||0);
  if([4373,4499,4556].includes(id)) return id;
  const n=String(data?.company?.name||'').toLowerCase();
  if(n.includes('المجر')||n.includes('majar')) return 4373;
  if(n.includes('الرحمن')||n.includes('الياقوت')||n.includes('rahman')||n.includes('yaqout')) return 4499;
  if(n.includes('magic paint')) return 4556;
  return 0;
}

const V5_LOCATION_TEXT={
  4373:{ar:'ميسان / المجر الكبير / شارع الأطباء',en:'Maysan / Al-Majar Al-Kabir / Doctors Street'},
  4499:{ar:'النجف / شارع الكوفة–النجف / قرب مرقد ميثم التمار',en:'Najaf / Kufa–Najaf Street / near Maytham Al-Tammar shrine'},
  4556:{ar:'مصفح، أبوظبي، الإمارات العربية المتحدة',en:'Mussafah, Abu Dhabi, UAE'}
};
const V5_NAME_TEXT={
  4373:{ar:'عيادة المجر للأسنان والتجميل',en:'Al-Majar Dental & Aesthetic Clinic'},
  4499:{ar:'ثانوية الرحمن الأهلية للبنين وثانوية الياقوت الأهلية للبنات',en:'Al-Rahman Private Secondary School for Boys & Al-Yaqout Private Secondary School for Girls'},
  4556:{ar:'ماجيك بينت للسيارات',en:'MAGIC PAINT Automobile'}
};

function v5Name(data){
  const k=v5CompanyKey(data);
  return V5_NAME_TEXT[k]?.[LANG]||data?.company?.name||'';
}
function v5Details(data){
  const c=data?.company||{},x=data?.context||{},k=v5CompanyKey(data);
  return {
    phone:x.contact_phone||c.phone||'',
    email:x.contact_email||c.general_email||'',
    address:V5_LOCATION_TEXT[k]?.[LANG]||x.address_text||c.city||c.country||''
  };
}
function v5IntlPhone(data){
  const d=v5Details(data),k=v5CompanyKey(data);
  let p=String(d.phone||'').replace(/\D/g,'');
  if(p.startsWith('00')) p=p.slice(2);
  if(p.startsWith('964')||p.startsWith('971')) return p;
  if(p.startsWith('0')){
    if(k===4373||k===4499) return '964'+p.slice(1);
    if(k===4556) return '971'+p.slice(1);
  }
  return p;
}
function v5IntlTel(data){const p=v5IntlPhone(data);return p?`+${p}`:''}

function actions(data){
  const d=v5Details(data),intl=v5IntlPhone(data),telNo=v5IntlTel(data);
  const a=[];
  if(d.phone){
    a.push(`<a class="primaryBtn" href="tel:${esc(telNo||d.phone)}">${t('اتصل الآن','Call now')}</a>`);
    if(intl) a.push(`<a class="ghostBtn" href="https://wa.me/${esc(intl)}" target="_blank" rel="nofollow noopener">WhatsApp</a>`);
  }else if(d.email){
    a.push(`<a class="primaryBtn" href="mailto:${esc(d.email)}">${t('تواصل معنا','Contact')}</a>`);
  }
  return a.join('');
}

const __v5ClinicPage=clinicPage;
const __v5SchoolPage=schoolPage;
const __v5AutoPage=autoPage;
clinicPage=function(data){
  return __v5ClinicPage(data)
    .replaceAll('AL-MAJAR · MAYSAN',t('المجر الكبير · ميسان','AL-MAJAR · MAYSAN'))
    .replaceAll('SMILE CARE',t('العناية بالابتسامة','SMILE CARE'))
    .replaceAll('DENTAL · AESTHETICS',t('أسنان · تجميل','DENTAL · AESTHETICS'));
};
schoolPage=function(data){
  return __v5SchoolPage(data)
    .replaceAll('NAJAF · IRAQ',t('النجف · العراق','NAJAF · IRAQ'));
};
autoPage=function(data){
  return __v5AutoPage(data)
    .replaceAll('MUSSAFAH · ABU DHABI',t('مصفح · أبوظبي','MUSSAFAH · ABU DHABI'))
    .replaceAll('AUTO REPAIR · PAINT · BODYWORK',t('إصلاح · صبغ · هيكل','AUTO REPAIR · PAINT · BODYWORK'));
};

function v5ScrollToId(id){
  const el=document.getElementById(id);
  if(!el) return false;
  el.scrollIntoView({behavior:'smooth',block:'start'});
  return true;
}

function v5WireInternalNavigation(){
  document.addEventListener('click',e=>{
    const a=e.target.closest('a[href^="#"]');
    if(!a) return;
    const id=(a.getAttribute('href')||'').slice(1);
    if(!id||/^p-[a-z0-9]{8,30}$/i.test(id)) return;
    if(document.getElementById(id)){
      e.preventDefault();
      e.stopPropagation();
      v5ScrollToId(id);
    }
  },true);
}

function v5WireSchoolTabs(){
  const tabs=[...document.querySelectorAll('.s5Tab')];
  if(!tabs.length) return;
  const wrap=tabs[0].parentElement;
  wrap.setAttribute('role','tablist');
  wrap.setAttribute('aria-label',t('اختيار المدرسة','Choose school'));
  let panel=wrap.parentElement.querySelector('.s5TabDetail');
  if(!panel){
    panel=document.createElement('div');
    panel.className='s5TabDetail';
    panel.setAttribute('role','tabpanel');
    wrap.insertAdjacentElement('afterend',panel);
  }
  const info=[
    {title:t('ثانوية الرحمن الأهلية للبنين','Al-Rahman Private Secondary School for Boys'),body:t('للاستفسار عن التسجيل والمعلومات الدراسية، تواصل مباشرة مع المدرسة.','For admissions and school information, contact the school directly.')},
    {title:t('ثانوية الياقوت الأهلية للبنات','Al-Yaqout Private Secondary School for Girls'),body:t('للاستفسار عن التسجيل والمعلومات الدراسية، تواصل مباشرة مع المدرسة.','For admissions and school information, contact the school directly.')}
  ];
  function activate(i,focus=false){
    tabs.forEach((tab,j)=>{
      tab.classList.toggle('active',j===i);
      tab.setAttribute('role','tab');
      tab.setAttribute('aria-selected',j===i?'true':'false');
      tab.tabIndex=j===i?0:-1;
    });
    panel.innerHTML=`<div><span class="s5TabKicker">0${i+1}</span><h3>${esc(info[i].title)}</h3><p>${esc(info[i].body)}</p></div><div class="actions">${actions(CURRENT)}</div>`;
    if(focus) tabs[i].focus();
  }
  tabs.forEach((tab,i)=>{
    tab.tabIndex=0;
    tab.addEventListener('click',()=>activate(i));
    tab.addEventListener('keydown',e=>{
      if(e.key==='Enter'||e.key===' '){e.preventDefault();activate(i)}
      if(e.key==='ArrowLeft'||e.key==='ArrowRight'){
        e.preventDefault();
        const delta=e.key==='ArrowRight'?1:-1;
        activate((i+delta+tabs.length)%tabs.length,true);
      }
    });
  });
  activate(0);
}

function v5WireContents(){
  const links=[...document.querySelectorAll('.s5Contents a[href^="#"]')];
  if(!links.length) return;
  links.forEach(a=>a.setAttribute('role','button'));
  const sections=links.map(a=>document.getElementById(a.getAttribute('href').slice(1))).filter(Boolean);
  if(!sections.length) return;
  const io=new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        links.forEach(a=>a.classList.toggle('active',a.getAttribute('href')==='#'+entry.target.id));
      }
    });
  },{rootMargin:'-35% 0px -55% 0px',threshold:0});
  sections.forEach(s=>io.observe(s));
}

function v5OpenServiceEnquiry(el){
  if(!CURRENT) return;
  const intl=v5IntlPhone(CURRENT); if(!intl) return;
  const service=el.querySelector('h3')?.textContent?.trim()||'';
  const msg=LANG==='ar'?`مرحباً، أود الاستفسار عن خدمة ${service}.`:`Hello, I would like to ask about ${service}.`;
  window.open(`https://wa.me/${intl}?text=${encodeURIComponent(msg)}`,'_blank','noopener');
}
function v5WireServiceInteractions(){
  document.querySelectorAll('.c5Treatment,.a5Service').forEach(el=>{
    el.classList.add('v5ClickableService');
    el.setAttribute('role','button');
    el.tabIndex=0;
    el.addEventListener('click',()=>v5OpenServiceEnquiry(el));
    el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();v5OpenServiceEnquiry(el)}});
  });
}

function v5ProductionWire(){
  v5WireSchoolTabs();
  v5WireContents();
  v5WireServiceInteractions();
}

v5WireInternalNavigation();
const __renderCurrentProduction=renderCurrent;
renderCurrent=function(){
  __renderCurrentProduction();
  requestAnimationFrame(v5ProductionWire);
};

window.addEventListener('load',()=>{
  setTimeout(()=>{if(CURRENT||!location.hash) renderCurrent()},250);
  setTimeout(()=>{if(CURRENT) renderCurrent()},900);
});
