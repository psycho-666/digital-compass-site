import { createClient } from "npm:@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});
const allowed=new Set(["facebook.com","www.facebook.com","m.facebook.com","instagram.com","www.instagram.com","tiktok.com","www.tiktok.com","linkedin.com","www.linkedin.com","youtube.com","www.youtube.com","x.com","www.x.com","twitter.com","www.twitter.com"]);
const clamp=(n:number)=>Math.max(0,Math.min(100,Math.round(n)));
const uniq=(a:string[])=>[...new Set(a.filter(Boolean))];
function safeUrl(raw:string){const u=new URL(raw);if(u.protocol!=="https:"||!allowed.has(u.hostname.toLowerCase())||u.username||u.password)throw new Error("unsupported_or_unsafe_profile_url");return u.toString()}
function attr(tag:string,name:string){const re=new RegExp(name+'="([^"]*)"',"i");return tag.match(re)?.[1]||""}
function meta(html:string,key:string){for(const tag of html.matchAll(/<meta\b[^>]*>/gi)){const t=tag[0];if((attr(t,"property")||attr(t,"name")).toLowerCase()===key.toLowerCase())return attr(t,"content").replace(/&amp;/g,"&").replace(/&quot;/g,'"').slice(0,2000)}return ""}
function visible(html:string){return html.replace(/<[^>]*>/g," ").replace(/&nbsp;/g," ").replace(/&amp;/g,"&").replace(/\s+/g," ").trim().slice(0,16000)}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return json({error:"method_not_allowed"},405);
 const auth=req.headers.get("Authorization")||"";if(!auth.startsWith("Bearer "))return json({error:"authentication_required"},401);
 const sb=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_ANON_KEY")!,{global:{headers:{Authorization:auth}}});
 try{
  const token=auth.slice(7);const {data:ad,error:ae}=await sb.auth.getUser(token);if(ae||!ad.user)return json({error:"invalid_session"},401);
  const body=await req.json();const id=String(body.prospect_id||"");if(!/^[0-9a-f-]{36}$/i.test(id))return json({error:"invalid_prospect_id"},400);
  const {data:p,error:pe}=await sb.from("prospects").select("*").eq("id",id).eq("user_id",ad.user.id).maybeSingle();if(pe)throw pe;if(!p)return json({error:"prospect_not_found"},404);
  let title="",description="",txt="",fetchStatus="not_attempted",evidenceUrl:string|null=null;
  if(p.account_url){try{const target=safeUrl(String(p.account_url));const res=await fetch(target,{headers:{"User-Agent":"Mozilla/5.0 (compatible; DigitalCompassAudit/1.0)","Accept":"text/html,application/xhtml+xml"},redirect:"manual",signal:AbortSignal.timeout(12000)});fetchStatus=String(res.status);if(res.status>=200&&res.status<300){const html=(await res.text()).slice(0,1200000);title=meta(html,"og:title")||meta(html,"twitter:title");description=meta(html,"og:description")||meta(html,"description")||meta(html,"twitter:description");txt=visible(html);evidenceUrl=target}else if(res.status>=300&&res.status<400)fetchStatus="redirect_blocked"}catch(e){fetchStatus=e instanceof Error?e.message.slice(0,120):"fetch_failed"}}
  const bio=description||String(p.bio||"");const name=title||String(p.business_name||"");const combined=(name+" "+bio+" "+txt).toLowerCase();
  const contact=Boolean(p.contact_info||/whatsapp|wa\.me|\+?964|07[578]\d{8}/i.test(combined));const website=Boolean(p.website_url||/https?:\/\//i.test(txt));const cta=/contact|message|whatsapp|call|book|order|راسل|اتصل|احجز|اطلب|واتساب/i.test(combined);
  const profile=clamp([Boolean(name),Boolean(bio),contact,website,Boolean(p.location)].filter(Boolean).length*20);
  const posting=p.posts_per_month==null?null:clamp(Number(p.posts_per_month)*6);const engagement=p.engagement_rate==null?null:clamp(Number(p.engagement_rate)*15);
  const conversion=clamp((cta?45:0)+(contact?35:0)+(website?20:0));const audience=p.followers_count==null?null:clamp(Math.log10(Number(p.followers_count)+1)*18);
  const vals=[profile,posting,engagement,conversion,audience].filter((v):v is number=>v!==null);const health=clamp(vals.reduce((a,b)=>a+b,0)/Math.max(1,vals.length));const need=100-health;const qualification=clamp(need*.55+(contact?20:0)+(Number(p.followers_count||0)>500?15:5)+(p.industry?10:0));
  const strengths:string[]=[],weaknesses:string[]=[],recommendations:string[]=[];
  if(profile>=80)strengths.push("Public profile information is reasonably complete");else{weaknesses.push("Public profile information is incomplete");recommendations.push("Improve bio, business location and contact links")}
  if(posting===null)weaknesses.push("Posting frequency could not be verified");else if(posting<55){weaknesses.push("Posting frequency appears low");recommendations.push("Create a consistent weekly content calendar")}else strengths.push("Posting frequency is at a workable level");
  if(engagement===null)weaknesses.push("Engagement rate was not supplied or publicly verified");else if(engagement<45){weaknesses.push("Engagement rate needs improvement");recommendations.push("Improve creative hooks and community interaction")}else strengths.push("Engagement rate is at a workable level");
  if(conversion<60){weaknesses.push("Public conversion/contact path is weak or unclear");recommendations.push("Add a direct WhatsApp/contact action and a clear offer")}else strengths.push("A visible contact or conversion path was detected");
  if(!recommendations.length)recommendations.push("Maintain current activity and review performance monthly");
  const services=uniq([...(profile<80?["Profile and brand optimization"]:[]),...(posting===null||posting<55?["Content planning and publishing"]:[]),...(engagement===null||engagement<45?["Engagement and community management"]:[]),...(conversion<60?["Lead generation and WhatsApp conversion"]:[])]);
  const criteria={profile_completeness:profile,posting_consistency:posting,engagement_health:engagement,conversion_path:conversion,audience_size:audience,public_fetch_status:fetchStatus,public_fetch_succeeded:Boolean(evidenceUrl),public_title:title||null,public_description:description||null,evidence_url:evidenceUrl,observed_at:new Date().toISOString(),limitations:"Public pages may hide metrics or require login. Unavailable metrics are not treated as verified."};
  const {error:ue}=await sb.from("prospects").update({bio:bio||p.bio,health_score:health,development_need_score:need,qualification_score:qualification,recommended_services:services,weaknesses,opportunities:recommendations,next_action:recommendations[0],updated_at:new Date().toISOString()}).eq("id",id).eq("user_id",ad.user.id);if(ue)throw ue;
  const {error:ie}=await sb.from("social_audits").insert({user_id:ad.user.id,prospect_id:id,audit_type:"public_profile",health_score:health,development_need_score:need,qualification_score:qualification,criteria,strengths,weaknesses,recommendations,summary:"Automated public-profile assessment. Supplied metrics and retrievable public metadata are used; hidden metrics remain unverified."});if(ie)throw ie;
  return json({ok:true,prospect_id:id,health_score:health,development_need_score:need,qualification_score:qualification,strengths,weaknesses,recommendations,public_fetch_status:fetchStatus,public_fetch_succeeded:Boolean(evidenceUrl)});
 }catch(e){return json({error:e instanceof Error?e.message:"audit_failed"},400)}
});