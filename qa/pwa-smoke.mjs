import {chromium} from 'playwright';
const BASE=process.env.SITE_URL||'https://psycho-666.github.io/digital-compass-site/';
function ok(v,m){if(!v)throw new Error(m)}
const manifestRes=await fetch(`${BASE}admin/manifest.webmanifest`);ok(manifestRes.ok,`manifest missing: ${manifestRes.status}`);const manifest=await manifestRes.json();ok(manifest.start_url==='./','manifest start_url must be admin root');ok(manifest.scope==='./','manifest scope must be admin root');ok(['standalone','fullscreen'].includes(manifest.display),'manifest display must be standalone/fullscreen');ok(Array.isArray(manifest.icons)&&manifest.icons.length>0,'manifest icon missing');
const swRes=await fetch(`${BASE}admin/sw.js`);ok(swRes.ok,`service worker missing: ${swRes.status}`);const sw=await swRes.text();ok(sw.includes("url.origin!==self.location.origin"),'service worker origin guard missing');ok(sw.includes("/functions/")&&sw.includes("/rest/")&&sw.includes("/auth/"),'service worker API/auth cache exclusions missing');
for(const asset of ['admin/pwa.js','admin/pwa.css']){const r=await fetch(`${BASE}${asset}`);ok(r.ok,`missing ${asset}: ${r.status}`)}
const browser=await chromium.launch({headless:true});
try{
 for(const [label,viewport] of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]){
   const context=await browser.newContext({viewport});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(`${BASE}admin/`,{waitUntil:'networkidle',timeout:30000});await page.waitForSelector('#loginForm',{timeout:10000});
   const link=await page.locator('link[rel="manifest"]').getAttribute('href');ok(link==='./manifest.webmanifest',`${label}: manifest link wrong`);
   await page.waitForFunction(()=>('serviceWorker' in navigator)&&navigator.serviceWorker.getRegistration().then(Boolean),null,{timeout:15000});
   const reg=await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();return r?{scope:r.scope,active:!!r.active}:null});ok(reg&&reg.active,`${label}: service worker not active`);ok(reg.scope.endsWith('/digital-compass-site/admin/'),`${label}: wrong SW scope ${reg?.scope}`);
   if(label==='desktop'){
     const cdp=await context.newCDPSession(page);await cdp.send('Page.enable');const appManifest=await cdp.send('Page.getAppManifest');ok((appManifest.errors||[]).length===0,`manifest errors: ${JSON.stringify(appManifest.errors)}`);const install=await cdp.send('Page.getInstallabilityErrors');ok((install.installabilityErrors||[]).length===0,`Chrome installability errors: ${JSON.stringify(install.installabilityErrors)}`);
   }
   const x=await page.evaluate(()=>[document.documentElement.scrollWidth,document.documentElement.clientWidth]);ok(x[0]<=x[1]+2,`${label}: horizontal overflow ${x[0]}>${x[1]}`);ok(errors.length===0,`${label}: runtime errors ${errors.join(' | ')}`);await context.close();console.log(`PASS PWA ${label}`)
 }
}finally{await browser.close()}
console.log('PASS manifest, installability and service-worker safety checks');