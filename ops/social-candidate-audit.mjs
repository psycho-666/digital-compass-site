import fs from "node:fs";
import { chromium } from "playwright";
const FILE=process.env.SOCIAL_AUDIT_TASK_FILE||"social-audit-tasks.json";
let TOKEN=process.env.OIDC_TOKEN||"";
const BRIDGE="https://xnoalyxxrjyovivdeojo.supabase.co/functions/v1/github-social-discovery-bridge";
const out=(k,v)=>{if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,`${k}=${v}\n`)};
const n100=v=>Math.max(0,Math.min(100,Math.round(v)));
const uniq=a=>[...new Set(a.filter(Boolean))];
function digits(s){return String(s||"").replace(/[٠-٩۰-۹]/g,c=>"٠١٢٣٤٥٦٧٨٩".indexOf(c)>=0?String("٠١٢٣٤٥٦٧٨٩".indexOf(c)):"0123456789".indexOf(c)>=0?c:c)}
function parseCount(s){let x=digits(String(s||"").replace(/,/g,"")).trim().toLowerCase(),m=1;if(/[kك]/.test(x)){m=1000;x=x.replace(/[kك]/g,"")}else if(/[mم]/.test(x)){m=1000000;x=x.replace(/[mم]/g,"")}const v=Number(x.replace(/[^0-9.]/g,""));return Number.isFinite(v)?Math.round(v*m):null}
function isWhatsAppHost(value){try{return ["wa.me","www.wa.me","api.whatsapp.com","www.whatsapp.com","whatsapp.com"].includes(new URL(String(value)).hostname.toLowerCase())}catch{return false}}
function isWhatsAppLink(value){try{const u=new URL(String(value));const h=u.hostname.toLowerCase();if(h==="wa.me"||h==="www.wa.me")return u.pathname.replace(/\\D/g,"").length>=8;if(h==="api.whatsapp.com"||h==="www.whatsapp.com"||h==="whatsapp.com")return (u.searchParams.get("phone")||"").replace(/\\D/g,"").length>=8;return false}catch{return false}}
function parseEngagement(text){let total=0,found=0;const patterns=[/([\d,.]+\s*[kKmM]?)\s*(?:comments?|reactions?|likes?|shares?)/gi,/([\d,.]+\s*[kKmM]?)\s*(?:تعليق|تعليقات|تفاعل|تفاعلات|إعجاب|إعجابات|مشاركة|مشاركات)/gi];for(const re of patterns)for(const m of String(text||"").matchAll(re)){const n=parseCount(m[1]);if(n!==null){total+=n;found++}}return found?total:null}
function median(a){if(!a.length)return null;const b=[...a].sort((x,y)=>x-y);return b[Math.floor(b.length/2)]}
async function meta(page,key){for(const sel of [`meta[property="${key}"]`,`meta[name="${key}"]`]){try{const v=await page.locator(sel).first().getAttribute("content",{timeout:700});if(v)return v}catch{}}return""}
async function links(page){try{return uniq(await page.locator("a[href]").evaluateAll(as=>as.slice(0,250).map(a=>a.href).filter(x=>/^https?:/i.test(x)))).slice(0,120)}catch{return[]}}
async function posts(page){const out=[];try{const arts=page.locator('[role="article"]'),count=Math.min(await arts.count(),12);for(let i=0;i<count;i++){const a=arts.nth(i);try{const text=(await a.innerText({timeout:1200})).trim();if(text.length<25)continue;let date=null;const t=a.locator("time[datetime]").first();if(await t.count())date=await t.getAttribute("datetime");const engagement=parseEngagement(text);out.push({text:text.slice(0,1200),date,media:(await a.locator("img").count()+await a.locator("video").count())>0,engagement})}catch{}}}catch{}return out}
async function snapshot(page,url){const s={title:"",description:"",body:"",links:[],posts:[],blocked:false,error:null};try{await page.goto(url,{waitUntil:"domcontentloaded",timeout:30000});for(const label of ["Allow all cookies","Decline optional cookies","Only allow essential cookies","Close","Not now","رفض ملفات تعريف الارتباط","إغلاق"]){try{const b=page.getByRole("button",{name:label,exact:false}).first();if(await b.isVisible({timeout:300}))await b.click({timeout:600})}catch{}}await page.waitForTimeout(1800);s.title=await page.title();s.description=(await meta(page,"og:description"))||(await meta(page,"description"));s.body=(await page.locator("body").innerText({timeout:3500}).catch(()=>"")).slice(0,18000);s.links=await links(page);for(let i=0;i<3;i++){await page.mouse.wheel(0,1500);await page.waitForTimeout(450)}s.posts=await posts(page);const low=(s.title+" "+s.body.slice(0,1800)).toLowerCase();s.blocked=["log in to facebook","login • instagram","you must log in","تسجيل الدخول"].some(x=>low.includes(x))&&!s.posts.length}catch(e){s.error=String(e).slice(0,500)}return s}
function contacts(text,allLinks){const phoneMatches=digits(text).match(/(?:\+?964|00964|0)?\s*7[0-9](?:[\s().-]?\d){8}/g)||[];const phones=uniq(phoneMatches.map(x=>{let d=digits(x).replace(/\D/g,"");if(d.startsWith("00964"))d=d.slice(2);if(d.startsWith("964"))return"+"+d;if(d.startsWith("0"))return"+964"+d.slice(1);if(/^7\d{9}$/.test(d))return"+964"+d;return null})).slice(0,4);const emails=uniq(text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)||[]).slice(0,4);const wa=allLinks.filter(isWhatsAppLink).slice(0,3);const web=allLinks.filter(x=>{try{const h=new URL(x).hostname.toLowerCase();return !/(facebook|instagram|fbcdn|messenger|meta\.com|threads\.net|whatsapp|wa\.me)/.test(h)}catch{return false}}).slice(0,5);return{phones,emails,wa,web}}
function scorePosting(ps){const dates=ps.map(p=>p.date?new Date(p.date):null).filter(d=>d&&!Number.isNaN(d.getTime())).sort((a,b)=>b-a);if(dates.length<3)return null;const age=Math.max(1,Math.ceil((Date.now()-dates.at(-1).getTime())/86400000)),monthly=Math.min(30,dates.length*30/age);return monthly>=16?95:monthly>=12?88:monthly>=8?78:monthly>=4?65:monthly>=2?48:30}
function scoreContent(ps){if(ps.length<3)return null;const avg=ps.reduce((s,p)=>s+Math.min(500,p.text.length),0)/ps.length,media=ps.filter(p=>p.media).length/ps.length,unique=new Set(ps.map(p=>p.text.toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g," ").slice(0,90))).size/ps.length;return n100(25+Math.min(30,avg/9)+media*25+unique*20)}
function scoreEngagement(ps,followers){const vals=ps.map(p=>p.engagement).filter(v=>v!==null);if(vals.length<3)return null;const m=median(vals);if(followers>0){const rate=m/followers*100;return rate>=5?95:rate>=3?85:rate>=1.5?75:rate>=.5?60:rate>0?45:25}return m>=1000?90:m>=300?80:m>=100?70:m>=30?60:m>=10?50:m>=3?40:30}
async function refreshToken(){try{const payload=JSON.parse(Buffer.from(TOKEN.split(".")[1],"base64url").toString("utf8"));if(payload.exp*1000>Date.now()+60000)return}catch{}const u=process.env.ACTIONS_ID_TOKEN_REQUEST_URL,k=process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;if(!u||!k)throw Error("Cannot refresh GitHub OIDC token for long audit batch");const r=await fetch(u+"&audience=digital-compass-public-runner",{headers:{authorization:"Bearer "+k}});if(!r.ok)throw Error("OIDC token refresh failed: "+r.status);const j=await r.json();TOKEN=j.value}
async function bridge(body){await refreshToken();const r=await fetch(BRIDGE,{method:"POST",headers:{authorization:`Bearer ${TOKEN}`,"content-type":"application/json"},body:JSON.stringify(body)});const t=await r.text();if(!r.ok)throw Error(`bridge_${r.status}_${t.slice(0,500)}`);return JSON.parse(t)}
async function audit(page,candidate){
 const url=candidate.profile_url||`https://www.facebook.com/${candidate.page_id_external}`;
 const snap=await snapshot(page,url);
 const adRows=Array.isArray(candidate.ads)?candidate.ads:[];
 const adText=adRows.map(a=>[a.creative_text,a.call_to_action,a.phone,a.whatsapp,a.landing_url].filter(Boolean).join(" ")).filter(Boolean);
 let landingSnap={title:"",description:"",body:"",links:[],posts:[],blocked:false,error:null};
 const landingRaw=String(candidate.landing_url||"");
 const landing=isWhatsAppHost(landingRaw)?"":landingRaw;
 if(/^https?:\/\//i.test(landing)&&!/(facebook\.com|instagram\.com|fbcdn\.net|messenger\.com|whatsapp\.com|wa\.me)/i.test(landing))landingSnap=await snapshot(page,landing);
 const text=[snap.title,snap.description,snap.body,landingSnap.title,landingSnap.description,landingSnap.body,...adText].join(" ");
 const adLinks=adRows.flatMap(a=>[a.whatsapp,a.landing_url]).filter(Boolean);
 const allLinks=uniq([...snap.links,...landingSnap.links,landing,candidate.whatsapp,...adLinks].filter(Boolean));
 const c=contacts(text,allLinks);
 const adPhones=adRows.map(a=>a.phone).filter(Boolean);
 if(candidate.phone||adPhones.length)c.phones=uniq([String(candidate.phone||""),...adPhones.map(String),...c.phones]).slice(0,4);
 if(candidate.whatsapp&&isWhatsAppLink(candidate.whatsapp))c.wa=uniq([String(candidate.whatsapp),...c.wa]).slice(0,3);
 if(candidate.landing_url&&!isWhatsAppHost(candidate.landing_url))c.web=uniq([String(candidate.landing_url),...c.web]).slice(0,5);
 const rawName=String(candidate.page_name||snap.title.replace(/\s*[|·-]\s*(Facebook|Instagram).*$/i,"").trim());
 const name=/^(facebook|instagram|log in|login|home)$/i.test(rawName)?"":rawName.slice(0,300);
 const followerMatch=digits(text).match(/([\d,.]+\s*[kKmM]?)\s*(?:followers|متابعون|متابع|متابعين)/i);
 const followers=followerMatch?parseCount(followerMatch[1]):null;
 const dated=snap.posts.filter(p=>p.date&&!Number.isNaN(new Date(p.date).getTime()));
 const age=dated.length?Math.max(1,Math.ceil((Date.now()-Math.min(...dated.map(p=>new Date(p.date).getTime())))/86400000)):null;
 const postsPerMonth=dated.length>=3&&age?Math.round(dated.length*30/age*10)/10:null;
 const local=/(iraq|العراق|baghdad|بغداد|najaf|النجف|basra|البصرة|karbala|كربلاء|erbil|أربيل)/i.test(text)||c.phones.some(p=>p.includes("964"));
 const bio=snap.description||landingSnap.description||"";
 const profile=n100([!!name,!!bio,!!(c.phones.length||c.emails.length),!!(c.web.length||c.wa.length),local].filter(Boolean).length*20);
 const posting=scorePosting(snap.posts);
 const organicContent=scoreContent(snap.posts);
 const adContent=adText.length>=2?n100(25+Math.min(30,adText.reduce((a,b)=>a+Math.min(500,b.length),0)/adText.length/9)+Math.min(25,adRows.filter(a=>a.call_to_action).length/adText.length*25)+Math.min(20,new Set(adText.map(x=>x.toLowerCase().slice(0,100))).size/adText.length*20)):null;
 const content=organicContent!==null?organicContent:adContent;
 const engagement=scoreEngagement(snap.posts,followers||0);
 const cta=/(whatsapp|contact us|message us|call now|book now|order now|احجز|اطلب|واتساب|اتصل|راسلنا|راسل الآن)/i.test(text)||c.wa.length>0||adRows.some(a=>a.call_to_action);
 const conversion=n100((cta?40:0)+(c.wa.length?25:0)+(c.web.length?20:0)+((c.phones.length||c.emails.length)?15:0));
 const response=n100((c.wa.length?40:0)+(c.phones.length?25:0)+(c.emails.length?20:0)+(cta?15:0));
 const parts=[profile,posting,content,engagement,conversion,response].filter(v=>v!==null);
 const health=parts.length>=2?n100(parts.reduce((a,b)=>a+b,0)/parts.length):null;
 const need=health===null?null:100-health;
 const adSignal=candidate.active_ads_count>0?90:20;
 const contactability=(c.phones.length||c.wa.length||c.emails.length)?100:0;
 const qualification=need===null?null:n100(need*.5+adSignal*.25+contactability*.15+(local?10:0));
 const strengths=[],weaknesses=[],services=[];
 if(profile>=80)strengths.push("Public business profile and contact details are reasonably complete");else{weaknesses.push("Public profile details need completion");services.push("Profile and brand optimization")}
 if(posting===null){weaknesses.push("Recent organic posting frequency is not publicly verifiable; manual review required")}else if(posting<60){weaknesses.push("Recent organic posting frequency appears low");services.push("Content planning and publishing")}else strengths.push("Recent posting activity is visible");
 if(content===null){weaknesses.push("Public creative content evidence is unavailable; manual review required")}else if(content<60){weaknesses.push("Public creative content quality appears weak");services.push("Creative content production")}else strengths.push(organicContent!==null?"Recent organic content was assessed":"Active ad creatives were assessed");
 if(engagement===null){weaknesses.push("Public engagement metrics are hidden or unavailable; no low score assumed")}else if(engagement<50){weaknesses.push("Measured public engagement appears weak");services.push("Engagement and community management")}else strengths.push("Public engagement metrics are within a workable range")
 if(conversion<60){weaknesses.push("The contact or conversion path is incomplete");services.push("WhatsApp lead generation and conversion")}else strengths.push("A contact or conversion route was detected");
 if(response<60){weaknesses.push("Contact and response readiness needs improvement");services.push("Inbox and customer response management")}
 if(candidate.active_ads_count>0)strengths.push("Active advertising was observed in Meta Ad Library");
 if(!services.length)services.push("Growth strategy and performance monitoring");
 const profileAccessible=!!(snap.title||snap.description||snap.body.length>80)&&!snap.blocked;
 const landingAccessible=!!(landingSnap.title||landingSnap.description||landingSnap.body.length>80);
 const accessible=profileAccessible||landingAccessible;
 const hasSubstantiveAdEvidence=adText.some(t=>t.replace(/\s+/g," ").trim().length>=80)&&(c.phones.length>0||c.wa.length>0||c.web.length>0||c.emails.length>0||adRows.some(a=>!!a.call_to_action));
 const hasIraqiContactAndActiveAd=Number(candidate.active_ads_count||0)>0&&(c.phones.some(p=>String(p).startsWith("+964"))||c.wa.some(u=>String(u).includes("964")));
 const hasDirectBusinessIdentity=!!(name||c.phones.length||c.wa.length||c.emails.length);\n const status=(((accessible||hasSubstantiveAdEvidence)&&parts.length>=3)&&hasDirectBusinessIdentity)||hasIraqiContactAndActiveAd?"COMPLETED":"NEEDS_REVIEW";
 const evidence={audit_version:"4",observed_at:new Date().toISOString(),profile_url:url,page_title:snap.title,meta_description:snap.description,page_blocked:snap.blocked,profile_fetch_error:snap.error,landing_url:landing||null,landing_title:landingSnap.title,landing_accessible:landingAccessible,posts_observed:snap.posts.length,dated_posts_observed:dated.length,engagement_posts_observed:snap.posts.filter(p=>p.engagement!==null).length,followers_count:followers,contact_evidence:c,active_ads_count:candidate.active_ads_count,ad_creatives_observed:adText.length,ad_creatives_sample:adText.slice(0,5),limitations:"Facebook may hide profile posts and engagement metrics when logged out. Public ad creatives and landing-page details are used as separate evidence. Missing metrics remain unscored.",posts_sample:snap.posts.slice(0,8)};
 return{candidate_id:candidate.id,status,health_score:health,development_need_score:need,qualification_score:qualification,profile_completeness_score:profile,posting_consistency_score:posting,content_quality_score:content,engagement_health_score:engagement,conversion_path_score:conversion,response_readiness_score:response,followers_count:followers,posts_per_month:postsPerMonth,engagement_rate:engagement!==null&&followers?Math.round((median(snap.posts.map(p=>p.engagement).filter(v=>v!==null))||0)/followers*10000)/100:null,page_name:name||null,phone:c.phones[0]||null,whatsapp:c.wa[0]||null,landing_url:c.web[0]||landing||null,strengths,weaknesses,recommended_services:uniq(services),audit_summary:status==="COMPLETED"?(hasIraqiContactAndActiveAd&&!accessible?"Profile access was limited, but active advertising and an Iraqi contact channel were verified. Scores use available advertising/contact evidence; hidden profile metrics remain unverified.":"Public profile and advertising audit completed. Scores combine visible profile, ad creative and landing-page evidence; hidden metrics remain unverified."):"Partial public audit. Profile access or visible evidence was insufficient for a complete assessment.",audit_evidence:evidence}
}
if(!TOKEN)throw Error("OIDC_TOKEN missing");const doc=JSON.parse(fs.readFileSync(FILE,"utf8")),tasks=Array.isArray(doc.tasks)?doc.tasks:[];const browser=await chromium.launch({headless:true});const context=await browser.newContext({locale:"ar-IQ",viewport:{width:1365,height:1000},userAgent:"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"});const page=await context.newPage();let completed=0,review=0,failed=0;const results=[];try{for(const task of tasks){const candidate=task.candidate;try{const result=await audit(page,candidate);await bridge({action:"complete_social_audit",...result});if(result.status==="COMPLETED")completed++;else review++;results.push({id:candidate.id,status:result.status,health:result.health_score,need:result.development_need_score})}catch(e){failed++;results.push({id:candidate?.id,status:"FAILED",error:String(e).slice(0,300)});try{await bridge({action:"complete_social_audit",candidate_id:candidate.id,status:"FAILED",audit_summary:String(e).slice(0,500),audit_evidence:{worker_error:String(e).slice(0,500)}})}catch{}}await page.goto("about:blank").catch(()=>{})}}finally{await browser.close()}console.log(JSON.stringify({processed:tasks.length,completed,needs_review:review,failed,results},null,2));out("processed",tasks.length);out("completed",completed);out("needs_review",review);out("failed",failed);
