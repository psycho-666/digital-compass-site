import {chromium} from 'playwright';
const BASE=process.env.SITE_URL||'https://psycho-666.github.io/digital-compass-site/';
function ok(v,m){if(!v)throw new Error(m)}
const manifestRes=await fetch(`${BASE}admin/manifest.webmanifest`);ok(manifestRes.ok,`manifest missing: ${manifestRes.status}`);const manifest=await manifestRes.json();ok(manifest.start_url==='./','manifest start_url must be admin root');ok(manifest.scope==='./','manifest scope must be admin root');ok(['standalone','fullscreen'].includes(manifest.display),'manifest display must be standalone/fullscreen');ok(Array.isArray(manifest.icons)&&manifest.icons.length>0,'manifest icon missing');
const swRes=await fetch(`${BASE}admin/sw.js`);ok(swRes.ok,`service worker missing: ${swRes.status}`);const sw=await swRes.text();ok(sw.includes("url.origin!==self.location.origin"),'service worker origin guard missing');ok(sw.includes("/functions/")&&sw.includes("/rest/")&&sw.includes("/auth/"),'service worker API/auth cache exclusions missing');ok(sw.includes("dc-admin-shell-v8"),'service worker cache version not updated');ok(sw.includes('FRESH_ASSETS'),'fresh asset policy missing');ok(!sw.includes("'./view-router.js'"),'obsolete view router should not be pre-cached');
for(const asset of ['admin/pwa.js','admin/pwa.css']){const r=await fetch(`${BASE}${asset}`);ok(r.ok,`missing ${asset}: ${r.status}`)}
const browser=await chromium.launch({headless:true});
try{
 for(const [label,viewport] of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]){
   const context=await browser.newContext({viewport});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(`${BASE}admin/`,{waitUntil:'networkidle',timeout:30000});await page.waitForURL(/\/admin\/access\.html(?:[?#].*)?$/,{timeout:15000});await page.waitForSelector('#accessForm',{state:'visible',timeout:10000});
   ok(await page.locator('#username').isVisible(),`${label}: secure username login missing`);ok(await page.locator('#password').isVisible(),`${label}: secure password login missing`);
   const indexHtml=await(await fetch(`${BASE}admin/index.html`)).text();ok(indexHtml.includes('rel="manifest"')&&indexHtml.includes('./manifest.webmanifest'),`${label}: admin manifest link missing`);
   const pwaScript=await(await fetch(`${BASE}admin/pwa.js`)).text();ok(pwaScript.includes("navigator.serviceWorker.register('./sw.js'"),`${label}: PWA registration code missing`);
   
   const x=await page.evaluate(()=>[document.documentElement.scrollWidth,document.documentElement.clientWidth]);ok(x[0]<=x[1]+2,`${label}: horizontal overflow ${x[0]}>${x[1]}`);ok(errors.length===0,`${label}: runtime errors ${errors.join(' | ')}`);await context.close();console.log(`PASS PWA ${label}`)
 }
}finally{await browser.close()}
console.log('PASS manifest, passwordless access, installability and service-worker safety checks');