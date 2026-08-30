import { chromium } from 'playwright';
import { spawnSync } from 'node:child_process';
const BASE=process.env.SITE_URL||'https://psycho-666.github.io/digital-compass-site/';
const PROJECT_URL='https://xnoalyxxrjyovivdeojo.supabase.co';
const PUBLISHABLE_KEY='sb_publishable_oakIu8ywKQLibfDJUDYIVg_XsNNZi66';
function ok(v,msg){if(!v)throw new Error(msg)}
for(const path of ['admin/assistant-ui.js','admin/assistant-ui.css']){const r=await fetch(`${BASE}${path}`);ok(r.ok,`assistant asset missing ${path}: ${r.status}`)}
const syntax=spawnSync(process.execPath,['--check','admin/assistant-ui.js'],{encoding:'utf8'});ok(syntax.status===0,`assistant-ui.js syntax error: ${syntax.stderr||syntax.stdout}`);
const adminHtml=await (await fetch(`${BASE}admin/`)).text();ok(adminHtml.includes('assistant-ui.css'),'admin page does not load assistant-ui.css');ok(!adminHtml.includes('src="./assistant-ui.js"'),'admin page should not eagerly load assistant-ui.js');
const adminJs=await (await fetch(`${BASE}admin/admin.js`)).text();ok(adminJs.includes("import('./assistant-ui.js')"),'admin core does not lazy-load assistant-ui.js after authentication');
const socialHtml=await (await fetch(`${BASE}admin/social.html`)).text();ok(socialHtml.includes('assistant-ui.js'),'social page does not load assistant-ui.js');ok(socialHtml.includes('assistant-ui.css'),'social page does not load assistant-ui.css');
const browser=await chromium.launch({headless:true});
try{
 for(const [label,viewport] of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]){
  const context=await browser.newContext({viewport});const page=await context.newPage();const errors=[];const assistantRequests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});page.on('request',r=>{if(r.url().includes('/admin/assistant-ui.js'))assistantRequests.push(r.url())});
  await page.goto(`${BASE}admin/`,{waitUntil:'networkidle',timeout:30000});
  ok(await page.locator('#dcAssistantFab').count()===0,`assistant/${label}: assistant injected before authentication`);ok(await page.locator('#dcAssistantPanel').count()===0,`assistant/${label}: assistant panel injected before authentication`);ok(await page.locator('#dcNotifyPanel').count()===0,`assistant/${label}: notification panel injected before authentication`);ok(assistantRequests.length===0,`assistant/${label}: assistant asset loaded before authentication`);ok(errors.length===0,`assistant/${label}: runtime errors ${errors.join(' || ')}`);await context.close();console.log(`PASS assistant lazy auth gate ${label}`)
 }
}finally{await browser.close()}
const unauthorized=await fetch(`${PROJECT_URL}/functions/v1/assistant-api?action=state`,{headers:{apikey:PUBLISHABLE_KEY}});ok([401,403].includes(unauthorized.status),`assistant API accepted unauthenticated request: ${unauthorized.status}`);
const unauthorizedMessage=await fetch(`${PROJECT_URL}/functions/v1/assistant-api?action=message`,{method:'POST',headers:{apikey:PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({content:'status'})});ok([401,403].includes(unauthorizedMessage.status),`assistant message API accepted unauthenticated request: ${unauthorizedMessage.status}`);
console.log('PASS assistant API auth gates');