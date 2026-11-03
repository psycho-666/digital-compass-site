import {chromium} from 'playwright';
const BASE=process.env.SITE_URL||'https://psycho-666.github.io/digital-compass-site/';
function ok(v,m){if(!v)throw new Error(m)}
for(const asset of ['admin/social-v2.html','admin/social-v2.css','admin/social-v2.js']){
 const r=await fetch(BASE+asset);ok(r.ok,'missing '+asset+': '+r.status);
 const body=await r.text();
 if(asset.endsWith('.html'))for(const t of ['مركز إدارة السوشيال ميديا','workspace','social-v2.js','الرسائل والتعليقات'])ok(body.includes(t),'social v2 html missing '+t);
 if(asset.endsWith('.js'))for(const t of ["social-management-api","workspaces","workspace","getSession","inbox","content","suggest_reply","data-suggest","create_content","data-create-draft"])ok(body.includes(t),'social v2 js missing '+t);
 if(asset.endsWith('.css'))for(const t of ['@media(max-width:850px)','.metrics','.rail'])ok(body.includes(t),'social v2 responsive style missing '+t);
}
const browser=await chromium.launch({headless:true});
try{
 for(const [label,viewport] of [['desktop',{width:1440,height:950}],['mobile',{width:390,height:844}]]){
  const c=await browser.newContext({viewport});const p=await c.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(BASE+'admin/social-v2.html',{waitUntil:'domcontentloaded',timeout:30000});await p.waitForTimeout(1200);
  ok(!p.url().includes('social-v2.html'),label+': unauthenticated user was not redirected');
  ok(errors.length===0,label+': runtime errors '+errors.join(' | '));
  await c.close();console.log('PASS social v2 unauthenticated gate '+label);
 }
}finally{await browser.close()}
console.log('PASS social v2 assets and responsive shell');