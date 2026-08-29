import { chromium } from 'playwright';

const BASE=process.env.SITE_URL||'https://psycho-666.github.io/digital-compass-site/';
const PROJECT_URL='https://xnoalyxxrjyovivdeojo.supabase.co';
const PUBLISHABLE_KEY='sb_publishable_oakIu8ywKQLibfDJUDYIVg_XsNNZi66';
const cases=[
  {name:'clinic',slug:'p-03cc2c446542b3d6',arTitle:'عيادة المجر',enTitle:'Al-Majar Dental',arLocation:'ميسان',enLocation:'Maysan',wa:'964'},
  {name:'school',slug:'p-05dc26fcdd4abdb4',arTitle:'ثانوية الرحمن',enTitle:'Al-Rahman Private',arLocation:'النجف',enLocation:'Najaf',wa:'964'},
  {name:'auto',slug:'p-1b5339ffb7066b0f',arTitle:'ماجيك بينت',enTitle:'MAGIC PAINT',arLocation:'مصفح',enLocation:'Mussafah',wa:'971'}
];
function ok(v,msg){if(!v) throw new Error(msg)}
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
  page.on('console',m=>{if(m.type()==='error') errors.push(`console: ${m.text()}`)});
  page.on('response',r=>{try{const u=new URL(r.url()),b=new URL(BASE);if(u.origin===b.origin&&r.status()>=400) errors.push(`HTTP ${r.status()}: ${u.pathname}`)}catch{}});
  await page.goto(`${BASE}#${tc.slug}`,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForSelector('main',{timeout:15000});
  await page.waitForTimeout(1000);

  ok((await page.title()).includes(tc.arTitle),`${tc.name}/${label}: Arabic document title not localized`);
  let body=await text(page);
  ok(body.includes(tc.arLocation),`${tc.name}/${label}: Arabic location missing`);
  ok(!/اتجاه بصري مقترح|المظهر الهادئ|هذا التصميم|قالب ووردبريس/.test(body),`${tc.name}/${label}: internal design commentary leaked into customer experience`);
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
  ok((await text(page)).includes(tc.arLocation),`${tc.name}/${label}: Arabic location not restored after language round-trip`);

  const badAnchors=await page.locator('a').evaluateAll(as=>as.filter(a=>{const h=a.getAttribute('href');return !h||h==='#'||/^javascript:/i.test(h)}).map(a=>a.outerHTML));
  ok(badAnchors.length===0,`${tc.name}/${label}: invalid anchors: ${badAnchors.join(' | ')}`);
  const brokenVisibleImages=await page.locator('img').evaluateAll(imgs=>imgs.filter(i=>getComputedStyle(i).display!=='none'&&i.complete&&i.naturalWidth===0).map(i=>i.src));
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
  page.on('console',m=>{if(m.type()==='error') errors.push(`console: ${m.text()}`)});
  await page.goto(`${BASE}admin/`,{waitUntil:'networkidle',timeout:30000});
  await page.waitForSelector('#loginForm',{timeout:15000});
  ok(await page.locator('#authView').isVisible(),`admin/${label}: auth gate not visible`);
  ok(!(await page.locator('#appView').isVisible()),`admin/${label}: private dashboard visible without auth`);
  ok((await page.title()).includes('Control Center'),`admin/${label}: title missing`);
  await noHorizontalOverflow(page,`admin/${label}`);
  const logo=page.locator('.authArt img').first();
  ok(await logo.count(),`admin/${label}: Digital Compass logo missing`);
  ok(await logo.evaluate(i=>i.complete&&i.naturalWidth>0),`admin/${label}: Digital Compass logo failed to load`);
  await page.locator('.language button[data-lang="en"]').first().click();
  ok(await page.locator('html').getAttribute('dir')==='ltr',`admin/${label}: EN did not switch to LTR`);
  ok(errors.length===0,`admin/${label}: runtime errors: ${errors.join(' || ')}`);
  await context.close();
  console.log(`PASS admin ${label}`);
}

const browser=await chromium.launch({headless:true});
try{
  for(const tc of cases){
    await auditPrototype(browser,tc,{width:1440,height:1000},'desktop');
    await auditPrototype(browser,tc,{width:390,height:844},'mobile');
  }

  for(const [label,viewport] of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]){
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

  const unauthorized=await fetch(`${PROJECT_URL}/functions/v1/admin-api?action=summary`,{headers:{apikey:PUBLISHABLE_KEY}});
  ok([401,403].includes(unauthorized.status),`admin API accepted unauthenticated request: ${unauthorized.status}`);
  console.log('PASS admin API auth gate');

  const badBootstrap=await fetch(`${PROJECT_URL}/functions/v1/admin-bootstrap`,{method:'POST',headers:{apikey:PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({setup_code:'definitely-wrong',email:'qa-invalid@example.invalid',password:'NotARealPassword123!'})});
  ok(badBootstrap.status===403,`admin bootstrap accepted invalid setup code: ${badBootstrap.status}`);
  console.log('PASS admin bootstrap gate');
} finally {
  await browser.close();
}
