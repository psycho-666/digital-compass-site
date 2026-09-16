import { chromium } from 'playwright';
import fs from 'node:fs';

const BRIDGE='https://xnoalyxxrjyovivdeojo.supabase.co/functions/v1/github-worker-bridge';
const TOKEN=process.env.OIDC_TOKEN||'';
const TASK_FILE=process.env.QA_TASK_FILE||'qa-tasks.json';
if(!TOKEN) throw new Error('OIDC_TOKEN missing');
const payload=JSON.parse(fs.readFileSync(TASK_FILE,'utf8'));
const tasks=Array.isArray(payload.tasks)?payload.tasks:[];

async function bridge(body){
  const r=await fetch(BRIDGE,{method:'POST',headers:{Authorization:`Bearer ${TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const text=await r.text(); let data={}; try{data=JSON.parse(text)}catch{}
  if(!r.ok) throw new Error(`Bridge HTTP ${r.status}: ${text.slice(0,500)}`);
  return data;
}

async function checkViewport(browser,task,width,height,label){
  const siteBase=String(task.site_base||'https://psycho-666.github.io/digital-compass-site/');
  const context=await browser.newContext({viewport:{width,height}});
  const page=await context.newPage();
  const runtimeErrors=[]; const sameOriginHttpErrors=[];
  page.on('pageerror',exc=>runtimeErrors.push(`pageerror: ${exc}`));
  page.on('console',msg=>{if(msg.type()==='error')runtimeErrors.push(`console: ${msg.text()}`)});
  page.on('response',response=>{try{if(response.url().startsWith(siteBase)&&response.status()>=400)sameOriginHttpErrors.push(`HTTP ${response.status()}: ${response.url()}`)}catch{}});
  const url=`${siteBase}#${task.slug}`;
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForSelector('main',{timeout:20000});
  await page.waitForTimeout(1200);
  const result=await page.evaluate(()=>{
    const root=document.documentElement; const body=(document.body?.innerText||'').trim();
    const badAnchors=[...document.querySelectorAll('a')].filter(a=>{const h=a.getAttribute('href');return !h||h==='#'||/^javascript:/i.test(h)}).map(a=>a.outerHTML.slice(0,220));
    const brokenImages=[...document.querySelectorAll('img')].filter(i=>getComputedStyle(i).display!=='none'&&i.complete&&i.naturalWidth===0).map(i=>i.src);
    const main=document.querySelector('main'); const visibleMain=!!main&&getComputedStyle(main).display!=='none';
    return {title:document.title||'',dir:root.getAttribute('dir')||'',lang:root.getAttribute('lang')||'',textLength:body.length,scrollWidth:root.scrollWidth,clientWidth:root.clientWidth,badAnchors,brokenImages,visibleMain,hasInternalLeak:/prototype_context|design_reference_research|client_brand_profiles|automation_commands|TODO|lorem ipsum|undefined\s*$|اتجاه بصري مقترح|المظهر الهادئ|هذا التصميم|قالب ووردبريس/im.test(body)};
  });
  const errors=[];
  if(!result.visibleMain)errors.push('main content is not visible');
  if(result.textLength<250)errors.push(`client-facing content too short (${result.textLength} chars)`);
  if(!result.title.trim())errors.push('document title is empty');
  if(result.scrollWidth>result.clientWidth+2)errors.push(`horizontal overflow ${result.scrollWidth}>${result.clientWidth}`);
  if(result.badAnchors.length)errors.push('invalid anchors: '+result.badAnchors.slice(0,5).join(' | '));
  if(result.brokenImages.length)errors.push('broken visible images: '+result.brokenImages.slice(0,5).join(', '));
  if(result.hasInternalLeak)errors.push('internal implementation/design commentary leaked into client-facing page');
  errors.push(...runtimeErrors,...sameOriginHttpErrors);
  const en=page.getByRole('button',{name:'EN'});
  if(await en.count()){
    const before=await page.locator('body').innerText(); await en.first().click(); await page.waitForTimeout(300); const after=await page.locator('body').innerText();
    if(await page.locator('html').getAttribute('dir')!=='ltr')errors.push('English language switch did not set LTR');
    if(before===after)errors.push('English language switch did not change content');
    const ar=page.getByRole('button',{name:'العربية'}); if(await ar.count()){await ar.first().click();await page.waitForTimeout(250);if(await page.locator('html').getAttribute('dir')!=='rtl')errors.push('Arabic language switch did not restore RTL')}
  }else errors.push('English language toggle is missing');
  const tel=page.locator('a[href^="tel:"]'); if(await tel.count()){const href=await tel.first().getAttribute('href')||'';if(!href.startsWith('tel:+'))errors.push('telephone link is not in international format')}
  const wa=page.locator('a[href*="wa.me/"]'); if(await wa.count()){const href=await wa.first().getAttribute('href')||'';const tail=href.split('wa.me/',2)[1]?.split('?',1)[0]||'';if(!/^\d+$/.test(tail))errors.push('WhatsApp link is not normalized to digits-only international format')}
  await context.close();
  return {label,url,title:result.title,text_length:result.textLength,scroll_width:result.scrollWidth,client_width:result.clientWidth,errors};
}

const browser=await chromium.launch({headless:true}); const results=[];
try{
  for(const task of tasks){
    let desktop={label:'desktop',errors:[]},mobile={label:'mobile',errors:[]},errors=[];
    try{desktop=await checkViewport(browser,task,1440,1000,'desktop');mobile=await checkViewport(browser,task,390,844,'mobile');errors=[...desktop.errors,...mobile.errors]}
    catch(e){errors=[String(e).slice(0,1500)];desktop={label:'desktop',errors};mobile={label:'mobile',errors:[]}}
    const status=errors.length?'FAILED':'PASSED';
    await bridge({action:'complete_prototype_qa',qa_run_id:task.qa_run_id,site_id:task.site_id,status,desktop_result:desktop,mobile_result:mobile,errors});
    results.push({site_id:task.site_id,slug:task.slug,status,errors:errors.slice(0,8)});
  }
}finally{await browser.close()}
console.log(JSON.stringify({processed:tasks.length,results}));
if(results.some(r=>r.status==='FAILED')) throw new Error('One or more prototypes failed browser QA');
