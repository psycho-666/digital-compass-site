const BASE=process.env.SITE_URL||'https://psycho-666.github.io/digital-compass-site/';
const PROJECT_URL='https://xnoalyxxrjyovivdeojo.supabase.co';
const KEY='sb_publishable_oakIu8ywKQLibfDJUDYIVg_XsNNZi66';
function ok(v,msg){if(!v)throw new Error(msg)}
const adminHtml=await (await fetch(`${BASE}admin/`)).text();ok(!adminHtml.includes('src="./push-ui.js"'),'admin/: push-ui.js should be lazy-loaded after authentication');
const adminJs=await (await fetch(`${BASE}admin/admin.js`)).text();ok(adminJs.includes("import('./push-ui.js')"),'admin/: admin.js does not lazy-load push-ui.js after authentication');
for(const page of ['admin/social.html','admin/social-management.html']){
  const r=await fetch(`${BASE}${page}`);ok(r.ok,`${page}: HTTP ${r.status}`);const html=await r.text();ok(html.includes('src="./push-ui.js"'),`${page}: push-ui.js not loaded`);
}
const pushUi=await fetch(`${BASE}admin/push-ui.js`);ok(pushUi.ok,`push-ui.js missing: ${pushUi.status}`);const pushText=await pushUi.text();ok(pushText.includes('pushManager.subscribe'),`push-ui.js: subscription flow missing`);ok(pushText.includes('/functions/v1/push-api'),`push-ui.js: protected push-api integration missing`);
const sw=await fetch(`${BASE}admin/sw.js`,{cache:'no-store'});ok(sw.ok,`service worker missing: ${sw.status}`);const swText=await sw.text();ok(swText.includes("addEventListener('push'"),`service worker: push handler missing`);ok(swText.includes("addEventListener('notificationclick'"),`service worker: notification click handler missing`);ok(swText.includes("url.pathname.includes('/functions/')"),`service worker: API cache exclusion missing`);ok(swText.includes("url.pathname.includes('/auth/')"),`service worker: auth cache exclusion missing`);
const unauthApi=await fetch(`${PROJECT_URL}/functions/v1/push-api?action=config`,{headers:{apikey:KEY}});ok([401,403].includes(unauthApi.status),`push-api accepted unauthenticated request: ${unauthApi.status}`);
const unauthDispatch=await fetch(`${PROJECT_URL}/functions/v1/push-dispatch`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});ok(unauthDispatch.status===403,`push-dispatch accepted request without internal key: ${unauthDispatch.status}`);
console.log('PASS Digital Compass Web Push production QA');