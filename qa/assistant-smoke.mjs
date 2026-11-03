import {chromium} from 'playwright';
import {spawnSync} from 'node:child_process';
const BASE=process.env.SITE_URL||'https://psycho-666.github.io/digital-compass-site/';
const PROJECT_URL='https://xnoalyxxrjyovivdeojo.supabase.co';
const PUBLISHABLE_KEY='sb_publishable_oakIu8ywKQLibfDJUDYIVg_XsNNZi66';
function ok(v,msg){if(!v)throw new Error(msg)}
for(const path of ['admin/assistant-ui.js','admin/assistant-ui.css']){const r=await fetch(BASE+path);ok(r.ok,'assistant asset missing '+path+': '+r.status)}
const syntax=spawnSync(process.execPath,['--check','admin/assistant-ui.js'],{encoding:'utf8'});ok(syntax.status===0,'assistant-ui.js syntax error: '+(syntax.stderr||syntax.stdout));
const socialHtml=await(await fetch(BASE+'admin/social-v2.html')).text();
ok(!socialHtml.includes('assistant-ui.js'),'Social V2 should not inject legacy assistant before its own authenticated integration');
const browser=await chromium.launch({headless:true});
try{
 for(const [label,viewport] of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]){
  const context=await browser.newContext({viewport});const page=await context.newPage();const errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('/admin/assistant-ui.js'))requests.push(r.url())});
  await page.goto(BASE+'admin/social-v2.html',{waitUntil:'networkidle',timeout:30000});
  ok(page.url().includes('/admin/access.html'), 'assistant/'+label+': Social V2 did not route directly to secure login');
  ok(await page.locator('#dcAssistantFab').count()===0,'assistant/'+label+': legacy assistant injected into Social V2');
  ok(requests.length===0,'assistant/'+label+': legacy assistant loaded into Social V2');
  ok(errors.length===0,'assistant/'+label+': runtime errors '+errors.join(' | '));
  await context.close();console.log('PASS Social V2 assistant isolation '+label);
 }
}finally{await browser.close()}
const unauthorized=await fetch(PROJECT_URL+'/functions/v1/assistant-api?action=state',{headers:{apikey:PUBLISHABLE_KEY}});
ok([401,403].includes(unauthorized.status),'assistant API accepted unauthenticated request: '+unauthorized.status);
const unauthorizedMessage=await fetch(PROJECT_URL+'/functions/v1/assistant-api?action=message',{method:'POST',headers:{apikey:PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({content:'status'})});
ok([401,403].includes(unauthorizedMessage.status),'assistant message API accepted unauthenticated request: '+unauthorizedMessage.status);
console.log('PASS assistant API auth gates');
