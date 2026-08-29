import {chromium} from 'playwright';
const BASE=process.env.SITE_URL||'https://psycho-666.github.io/digital-compass-site/';
const API='https://xnoalyxxrjyovivdeojo.supabase.co/functions/v1/prototype-data';
const cases=[
 {name:'arts',slug:'p-198c2c30ec2d81c4',mode:'mode-arts',ar:'تابو للفنون',en:'Taboo Arts is publicly listed as an art gallery in Iraq',phone:'9647724140668',forbidden:['Shawaka Gallery','Dijla Art Gallery','Bayt Akitu']},
 {name:'eye',slug:'p-62f2ee4b03ad9243',mode:'mode-health',ar:'عيادة الدكتور احمد فائق نوري',en:'Ophthalmology clinic in Ad Diwaniyah',phone:'9647839025033',arLocation:'الديوانية',enLocation:'Ad Diwaniyah',forbidden:['Iris Vision Center','Warid Eye Clinic','TRUQ Clinic Website Pattern']}
];
function ok(v,m){if(!v)throw new Error(m)}
const browser=await chromium.launch({headless:true});
try{
 for(const tc of cases){
   const api=await fetch(`${API}?slug=${tc.slug}`,{headers:{Accept:'application/json'}});ok(api.ok,`${tc.name}: prototype-data ${api.status}`);const data=await api.json();ok(data.prototype_level==='PREVIEW',`${tc.name}: wrong level`);ok(data.brand_gate_status==='PROPOSED_ONLY',`${tc.name}: wrong brand gate`);ok(Array.isArray(data.design_references)&&data.design_references.length>=3,`${tc.name}: design references missing from data API`);ok(Array.isArray(data.context?.services)&&data.context.services.length===0,`${tc.name}: unsupported services appeared in context`);
   for(const [label,viewport] of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]){
     const context=await browser.newContext({viewport});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
     await page.goto(`${BASE}#${tc.slug}`,{waitUntil:'domcontentloaded',timeout:30000});await page.waitForSelector('main.adaptive',{timeout:15000});await page.waitForTimeout(600);
     const main=page.locator('main.adaptive');ok(await main.count()===1,`${tc.name}/${label}: adaptive renderer missing`);ok((await main.getAttribute('class')).includes(tc.mode),`${tc.name}/${label}: wrong sector mode`);ok(await page.locator('main.proto.clinic,main.proto.school,main.proto.auto').count()===0,`${tc.name}/${label}: legacy sector layout leaked`);
     let body=await page.locator('body').innerText();ok(body.includes(tc.ar),`${tc.name}/${label}: Arabic identity missing`);if(tc.arLocation)ok(body.includes(tc.arLocation),`${tc.name}/${label}: Arabic location missing`);for(const f of tc.forbidden)ok(!body.includes(f),`${tc.name}/${label}: reference name leaked: ${f}`);ok(!/اتجاه بصري مقترح|المظهر الهادئ|هذا التصميم|قالب ووردبريس|proposed high-performance digital direction/i.test(body),`${tc.name}/${label}: internal design commentary leaked`);
     const tel=page.locator('a[href^="tel:"]').first();ok(await tel.count(),`${tc.name}/${label}: tel link missing`);ok((await tel.getAttribute('href')).replace(/\D/g,'').startsWith(tc.phone),`${tc.name}/${label}: tel link wrong`);ok((await page.locator('meta[name="robots"]').getAttribute('content')).includes('noindex'),`${tc.name}/${label}: prototype must be noindex`);ok(await page.locator('.apCards').count()===0,`${tc.name}/${label}: service cards rendered despite empty verified services`);
     const en=page.getByRole('button',{name:'EN'});ok(await en.count(),`${tc.name}/${label}: EN toggle missing`);await en.click();await page.waitForTimeout(150);body=await page.locator('body').innerText();ok(body.includes(tc.en),`${tc.name}/${label}: English validated summary missing`);if(tc.enLocation)ok(body.includes(tc.enLocation),`${tc.name}/${label}: English location missing`);ok(await page.locator('html').getAttribute('dir')==='ltr',`${tc.name}/${label}: English direction not LTR`);
     const bad=await page.locator('a').evaluateAll(as=>as.filter(a=>{const h=a.getAttribute('href');return !h||h==='#'||/^javascript:/i.test(h)}).length);ok(bad===0,`${tc.name}/${label}: invalid anchors present`);const dim=await page.evaluate(()=>[document.documentElement.scrollWidth,document.documentElement.clientWidth]);ok(dim[0]<=dim[1]+2,`${tc.name}/${label}: overflow ${dim[0]}>${dim[1]}`);ok(errors.length===0,`${tc.name}/${label}: runtime errors ${errors.join(' | ')}`);await context.close();console.log(`PASS adaptive ${tc.name} ${label}`)
   }
 }
}finally{await browser.close()}
console.log('PASS adaptive reference-driven previews');