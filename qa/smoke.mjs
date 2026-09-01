import { chromium } from 'playwright';

const BASE=process.env.SITE_URL||'https://psycho-666.github.io/digital-compass-site/';
const PROJECT_URL='https://xnoalyxxrjyovivdeojo.supabase.co';
const PUBLISHABLE_KEY='sb_publishable_oakIu8ywKQLibfDJUDYIVg_XsNNZi66';
const cases=[
  {name:'clinic',slug:'p-03cc2c446542b3d6',arTitle:'عيادة المجر',enTitle:'Al-Majar Dental',arLocation:'ميسان',enLocation:'Maysan',wa:'964'},
  {name:'school',slug:'p-05dc26fcdd4abdb4',arTitle:'ثانوية الرحمن',enTitle:'Al-Rahman Private',arLocation:'النجف',enLocation:'Najaf',wa:'964'},
  {name:'auto',slug:'p-1b5339ffb7066b0f',arTitle:'ماجيك بينت',enTitle:'MAGIC PAINT',arLocation:'مصفح',enLocation:'Mussafah',wa:'971'}
];

function ok(v,msg){if(!v)throw new Error(msg)}
async function text(page){return await page.locator('body').innerText()}
async function noHorizontalOverflow(page,label){
  const m=await page.evaluate(()=>({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth}));
  ok(m.sw<=m.cw+2,`${label}: horizontal overflow ${m.sw}px > ${m.cw}px`);
}

async function auditPrototype(browser,tc,viewport,label){
  const context=await browser.newContext({viewport});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(`pageerror: ${e.message}`));
  page.on('console',m=>{if(m.type()==='error')errors.push(`console: ${m.text()}`)});
  page.on('response',r=>{
    try{
      const u=new URL(r.url()),b=new URL(BASE);
      if(u.origin===b.origin&&r.status()>=400)errors.push(`HTTP ${r.status()}: ${u.pathname}`);
    }catch{}
  });

  await page.goto(`${BASE}#${tc.slug}`,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForSelector('main',{timeout:15000});
  await page.waitForTimeout(1000);

  ok((await page.title()).includes(tc.arTitle),`${tc.name}/${label}: Arabic document title not localized`);
  let body=await text(page);
  ok(body.includes(tc.arLocation),`${tc.name}/${label}: Arabic location missing`);
  ok(!/اتجاه بصري مقترح|المظهر الهادئ|هذا التصميم|قالب ووردبريس/.test(body),`${tc.name}/${label}: internal design commentary leaked`);
  ok(await page.locator('html').getAttribute('dir')==='rtl',`${tc.name}/${label}: Arabic direction is not RTL`);

  const wa=page.locator('a[href*="wa.me/"]').first();
  ok(await wa.count(),`${tc.name}/${label}: WhatsApp link missing`);
  ok((await wa.getAttribute('href')).includes(`wa.me/${tc.wa}`),`${tc.name}/${label}: WhatsApp international format is wrong`);
  const tel=page.locator('a[href^="tel:"]').first();
  ok(await tel.count(),`${tc.name}/${label}: phone link missing`);
  ok((await tel.getAttribute('href')).startsWith(`tel:+${tc.wa}`),`${tc.name}/${label}: tel link is not internationalized`);

  await noHorizontalOverflow(page,`${tc.name}/${label}/ar`);
  await page.getByRole('button',{name:'EN'}).click();
  await page.waitForTimeout(250);
  ok((await page.title()).includes(tc.enTitle),`${tc.name}/${label}: English document title not localized`);
  body=await text(page);
  ok(body.includes(tc.enLocation),`${tc.name}/${label}: English location missing`);
  ok(await page.locator('html').getAttribute('dir')==='ltr',`${tc.name}/${label}: English direction is not LTR`);
  await noHorizontalOverflow(page,`${tc.name}/${label}/en`);

  await page.getByRole('button',{name:'العربية'}).click();
  await page.waitForTimeout(200);
  ok((await page.title()).includes(tc.arTitle),`${tc.name}/${label}: switching back to Arabic failed`);
  ok((await text(page)).includes(tc.arLocation),`${tc.name}/${label}: Arabic location not restored`);

  const badAnchors=await page.locator('a').evaluateAll(as=>as.filter(a=>{
    const h=a.getAttribute('href');
    return !h||h==='#'||/^javascript:/i.test(h);
  }).map(a=>a.outerHTML));
  ok(badAnchors.length===0,`${tc.name}/${label}: invalid anchors: ${badAnchors.join(' | ')}`);

  const brokenVisibleImages=await page.locator('img').evaluateAll(imgs=>imgs.filter(i=>
    getComputedStyle(i).display!=='none'&&i.complete&&i.naturalWidth===0
  ).map(i=>i.src));
  ok(brokenVisibleImages.length===0,`${tc.name}/${label}: broken visible images: ${brokenVisibleImages.join(', ')}`);

  if(tc.name==='school'){
    const tabs=page.locator('.s5Tab');
    ok(await tabs.count()===2,`school/${label}: expected two school tabs`);
    await tabs.nth(1).click();
    ok(await tabs.nth(1).getAttribute('aria-selected')==='true',`school/${label}: second tab did not activate`);
    ok((await page.locator('.s5TabDetail').innerText()).includes('ثانوية الياقوت'),`school/${label}: Arabic tab content did not update`);
    const before=page.url();
    await page.locator('.s5Contents a[href="#s5follow"]').click();
    await page.waitForTimeout(250);
    ok(page.url()===before,`school/${label}: internal navigation corrupted prototype slug`);
  }

  const services=page.locator('.v5ClickableService');
  if(await services.count()){
    ok(await services.first().getAttribute('role')==='button',`${tc.name}/${label}: service interaction missing role`);
    ok((await services.first().getAttribute('tabindex'))==='0',`${tc.name}/${label}: service interaction not keyboard accessible`);
  }

  ok(errors.length===0,`${tc.name}/${label}: runtime errors: ${errors.join(' || ')}`);
  await context.close();
  console.log(`PASS ${tc.name} ${label}`);
}

async function auditAdmin(browser,viewport,label){
  const context=await browser.newContext({viewport});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(`pageerror: ${e.message}`));
  page.on('console',m=>{if(m.type()==='error')errors.push(`console: ${m.text()}`)});

  await page.goto(`${BASE}admin/`,{waitUntil:'networkidle',timeout:30000});
  await page.waitForSelector('.secureAccessButton',{state:'visible',timeout:15000});

  ok(await page.locator('#authView').isVisible(),`admin/${label}: auth gate not visible`);
  ok(!(await page.locator('#appView').isVisible()),`admin/${label}: private dashboard visible without auth`);
  ok((await page.title()).includes('Control Center'),`admin/${label}: title missing`);
  ok(!(await page.locator('#loginForm').isVisible()),`admin/${label}: obsolete embedded login form is visible`);
  ok(!(await page.locator('#setupForm').isVisible()),`admin/${label}: legacy bootstrap form is visible`);
  ok(await page.locator('.secureAccessButton').getAttribute('href')==='./access.html',`admin/${label}: owner access link is wrong`);
  ok(await page.locator('.secureAccessMeta a').getAttribute('href')==='./credentials.html',`admin/${label}: credential setup link is wrong`);

  await noHorizontalOverflow(page,`admin/${label}`);
  const logo=page.locator('.authArt img').first();
  ok(await logo.count(),`admin/${label}: Digital Compass logo missing`);
  ok(await logo.evaluate(i=>i.complete&&i.naturalWidth>0),`admin/${label}: Digital Compass logo failed to load`);

  await page.locator('.language button[data-lang="en"]').first().click();
  ok(await page.locator('html').getAttribute('dir')==='ltr',`admin/${label}: EN did not switch to LTR`);

  await page.locator('.secureAccessButton').click();
  await page.waitForURL(/\/admin\/access\.html(?:[?#].*)?$/,{timeout:10000});
  await page.waitForSelector('#accessForm',{state:'visible',timeout:10000});
  ok(await page.locator('#username[autocomplete="username"]').isVisible(),`owner-access/${label}: username field missing`);
  ok(await page.locator('#password[type="password"]').isVisible(),`owner-access/${label}: password field missing`);
  ok(await page.locator('#send').isVisible(),`owner-access/${label}: sign-in button missing`);
  await noHorizontalOverflow(page,`owner-access/${label}`);

  await page.locator('.lang button[data-lang="en"]').click();
  ok(await page.locator('html').getAttribute('dir')==='ltr',`owner-access/${label}: EN did not switch to LTR`);
  await page.locator('.lang button[data-lang="ar"]').click();
  ok(await page.locator('html').getAttribute('dir')==='rtl',`owner-access/${label}: Arabic did not switch back to RTL`);

  ok(errors.length===0,`admin/${label}: runtime errors: ${errors.join(' || ')}`);
  await context.close();
  console.log(`PASS admin username-password ${label}`);
}

async function auditSocialAuthGate(browser,viewport,label){
  const htmlResponse=await fetch(`${BASE}admin/social.html`);
  ok(htmlResponse.ok,`social/${label}: missing social.html: ${htmlResponse.status}`);
  const html=await htmlResponse.text();
  ok(html.includes('id="discoverAdvertisersBtn"'),`social/${label}: advertiser discovery control missing`);
  ok(html.includes('id="manualSocialForm"'),`social/${label}: manual social form missing`);
  ok(html.includes('AUDIT_AND_MANAGE'),`social/${label}: manual management mode missing`);

  for(const path of ['admin/social.css','admin/social.js']){
    const r=await fetch(`${BASE}${path}`);
    ok(r.ok,`social/${label}: missing asset ${path}: ${r.status}`);
  }

  const context=await browser.newContext({viewport});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(`pageerror: ${e.message}`));

  await page.goto(`${BASE}admin/social.html`,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForTimeout(1500);
  ok(page.url().startsWith(`${BASE}admin/`),`social/${label}: unexpected redirect target ${page.url()}`);
  ok(!page.url().includes('social.html'),`social/${label}: unauthenticated social dashboard did not redirect to auth gate`);
  await page.waitForSelector('.secureAccessButton',{state:'visible',timeout:10000});
  ok(!(await page.locator('#loginForm').isVisible()),`social/${label}: redirect exposed obsolete embedded login`);
  await noHorizontalOverflow(page,`social-auth/${label}`);
  ok(errors.length===0,`social/${label}: runtime errors: ${errors.join(' || ')}`);

  await context.close();
  console.log(`PASS social auth gate ${label}`);
}

const browser=await chromium.launch({headless:true});
try{
  for(const tc of cases){
    await auditPrototype(browser,tc,{width:1440,height:1000},'desktop');
    await auditPrototype(browser,tc,{width:390,height:844},'mobile');
  }

  for(const [label,viewport] of [
    ['desktop',{width:1440,height:1000}],
    ['mobile',{width:390,height:844}]
  ]){
    const context=await browser.newContext({viewport});
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForSelector('#dc-method',{timeout:15000});
    await noHorizontalOverflow(page,`Digital Compass/${label}`);
    const before=page.url();
    await page.locator('a[href="#dc-method"]').click();
    await page.waitForTimeout(250);
    ok(page.url()===before,`Digital Compass/${label}: internal navigation changed routing hash`);
    await page.getByRole('button',{name:'EN'}).click();
    ok(await page.locator('html').getAttribute('dir')==='ltr',`Digital Compass/${label}: EN did not switch to LTR`);
    ok(errors.length===0,`Digital Compass/${label}: runtime errors: ${errors.join(' || ')}`);
    await context.close();
    console.log(`PASS Digital Compass ${label}`);
  }

  await auditAdmin(browser,{width:1440,height:1000},'desktop');
  await auditAdmin(browser,{width:390,height:844},'mobile');
  await auditSocialAuthGate(browser,{width:1440,height:1000},'desktop');
  await auditSocialAuthGate(browser,{width:390,height:844},'mobile');

  const access=await fetch(`${BASE}admin/access.html`);ok(access.ok,'owner access page missing');const accessHtml=await access.text();
  ok(accessHtml.includes("resolve_admin_login_email"),'owner access username resolver missing');
  ok(accessHtml.includes('signInWithPassword'),'owner access Supabase password signin missing');
  ok(!accessHtml.includes('signInWithOtp'),'daily owner access still contains magic-link signin');
  const credentials=await fetch(`${BASE}admin/credentials.html`);ok(credentials.ok,'credentials setup page missing');const credentialsHtml=await credentials.text();
  ok(credentialsHtml.includes('set_current_admin_username'),'credentials setup username RPC missing');
  ok(credentialsHtml.includes('updateUser({password})'),'credentials setup password update missing');
  const recovery=await fetch(`${BASE}admin/email-login.html`);ok(recovery.ok,'email recovery/setup page missing');const recoveryHtml=await recovery.text();
  ok(recoveryHtml.includes('signInWithOtp'),'email setup fallback no longer provides owner verification');
  ok(recoveryHtml.includes('next=credentials.html')||recoveryHtml.includes("credentials.html"),'email setup fallback does not return to credential setup');
  console.log('PASS owner credential auth assets');

  const unauthorized=await fetch(`${PROJECT_URL}/functions/v1/admin-api?action=summary`,{headers:{apikey:PUBLISHABLE_KEY}});
  ok([401,403].includes(unauthorized.status),`admin API accepted unauthenticated request: ${unauthorized.status}`);

  const unauthorizedManual=await fetch(`${PROJECT_URL}/functions/v1/admin-api?action=manual_social`,{
    method:'POST',
    headers:{apikey:PUBLISHABLE_KEY,'Content-Type':'application/json'},
    body:'{}'
  });
  ok([401,403].includes(unauthorizedManual.status),`manual social API accepted unauthenticated request: ${unauthorizedManual.status}`);
  console.log('PASS admin API auth gates');

  const invalidCredentialLookup=await fetch(`${PROJECT_URL}/rest/v1/rpc/resolve_admin_login_email`,{
    method:'POST',
    headers:{apikey:PUBLISHABLE_KEY,'Content-Type':'application/json'},
    body:JSON.stringify({p_username:'definitely-invalid-qa-user',p_password:'DefinitelyWrong-QA-Password-123!'})
  });
  ok(invalidCredentialLookup.ok,`credential resolver unavailable: ${invalidCredentialLookup.status}`);
  ok((await invalidCredentialLookup.json())===null,'credential resolver disclosed an account for invalid credentials');
  console.log('PASS credential resolver invalid-login gate');

  const badBootstrap=await fetch(`${PROJECT_URL}/functions/v1/admin-bootstrap`,{
    method:'POST',
    headers:{apikey:PUBLISHABLE_KEY,'Content-Type':'application/json'},
    body:JSON.stringify({setup_code:'definitely-wrong',email:'qa-invalid@example.invalid',password:'NotARealPassword123!'})
  });
  ok([403,409].includes(badBootstrap.status),`admin bootstrap did not reject invalid or closed setup state: ${badBootstrap.status}`);
  console.log('PASS admin bootstrap gate');
} finally {
  await browser.close();
}
