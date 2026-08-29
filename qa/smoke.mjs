import { chromium } from 'playwright';

const BASE=process.env.SITE_URL||'https://psycho-666.github.io/digital-compass-site/';
const cases=[
  {name:'clinic',slug:'p-03cc2c446542b3d6',arTitle:'عيادة المجر',enTitle:'Al-Majar Dental',arLocation:'ميسان',enLocation:'Maysan',wa:'964'},
  {name:'school',slug:'p-05dc26fcdd4abdb4',arTitle:'ثانوية الرحمن',enTitle:'Al-Rahman Private',arLocation:'النجف',enLocation:'Najaf',wa:'964'},
  {name:'auto',slug:'p-1b5339ffb7066b0f',arTitle:'ماجيك بينت',enTitle:'MAGIC PAINT',arLocation:'مصفح',enLocation:'Mussafah',wa:'971'}
];
function ok(v,msg){if(!v) throw new Error(msg)}
async function visibleText(page){return await page.locator('body').innerText()}

const browser=await chromium.launch({headless:true});
try{
  for(const tc of cases){
    const context=await browser.newContext();
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',e=>errors.push(`pageerror: ${e.message}`));
    page.on('console',m=>{if(m.type()==='error') errors.push(`console: ${m.text()}`)});
    page.on('response',r=>{try{const u=new URL(r.url());const b=new URL(BASE);if(u.origin===b.origin&&r.status()>=400) errors.push(`HTTP ${r.status()}: ${u.pathname}`)}catch{}});
    await page.goto(`${BASE}#${tc.slug}`,{waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForSelector('main',{timeout:15000});
    await page.waitForTimeout(1200);

    ok((await page.title()).includes(tc.arTitle),`${tc.name}: Arabic document title not localized: ${await page.title()}`);
    let text=await visibleText(page);
    ok(text.includes(tc.arLocation),`${tc.name}: Arabic location missing`);
    const wa=page.locator('a[href*="wa.me/"]').first();
    ok(await wa.count(),`${tc.name}: WhatsApp link missing`);
    ok((await wa.getAttribute('href')).includes(`wa.me/${tc.wa}`),`${tc.name}: WhatsApp is not internationalized correctly`);

    await page.getByRole('button',{name:'EN'}).click();
    await page.waitForTimeout(250);
    ok((await page.title()).includes(tc.enTitle),`${tc.name}: English document title not localized: ${await page.title()}`);
    text=await visibleText(page);
    ok(text.includes(tc.enLocation),`${tc.name}: English location missing`);

    const badAnchors=await page.locator('a').evaluateAll(as=>as.filter(a=>{const h=a.getAttribute('href');return !h||h==='#'||/^javascript:/i.test(h)}).map(a=>a.outerHTML));
    ok(badAnchors.length===0,`${tc.name}: invalid anchors: ${badAnchors.join(' | ')}`);

    const brokenVisibleImages=await page.locator('img').evaluateAll(imgs=>imgs.filter(i=>getComputedStyle(i).display!=='none'&&i.complete&&i.naturalWidth===0).map(i=>i.src));
    ok(brokenVisibleImages.length===0,`${tc.name}: broken visible images: ${brokenVisibleImages.join(', ')}`);

    if(tc.name==='school'){
      const tabs=page.locator('.s5Tab');
      ok(await tabs.count()===2,'school: expected two interactive school tabs');
      await tabs.nth(1).click();
      ok(await tabs.nth(1).getAttribute('aria-selected')==='true','school: second tab did not activate');
      ok((await page.locator('.s5TabDetail').innerText()).includes('Al-Yaqout'),'school: tab panel did not update');
      const before=page.url();
      await page.locator('.s5Contents a[href="#s5follow"]').click();
      await page.waitForTimeout(350);
      ok(page.url()===before,'school: internal navigation corrupted prototype slug');
    }

    const clickServices=page.locator('.v5ClickableService');
    if(await clickServices.count()){
      ok(await clickServices.first().getAttribute('role')==='button',`${tc.name}: service interaction missing role`);
      ok((await clickServices.first().getAttribute('tabindex'))==='0',`${tc.name}: service interaction not keyboard accessible`);
    }

    ok(errors.length===0,`${tc.name}: runtime errors: ${errors.join(' || ')}`);
    await context.close();
    console.log(`PASS ${tc.name}`);
  }

  const context=await browser.newContext();
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForSelector('#dc-method',{timeout:15000});
  const before=page.url();
  await page.locator('a[href="#dc-method"]').click();
  await page.waitForTimeout(350);
  ok(page.url()===before,'Digital Compass: internal navigation changed routing hash');
  ok(errors.length===0,`Digital Compass runtime errors: ${errors.join(' || ')}`);
  await context.close();
  console.log('PASS Digital Compass');
} finally {
  await browser.close();
}
