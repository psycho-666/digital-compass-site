import {isIP} from "node:net";
import {NextRequest,NextResponse} from "next/server";
import {createClient as createSupabaseClient} from "@supabase/supabase-js";

export const runtime="nodejs";

export async function POST(request:NextRequest){
  try{
    const rawBody=await request.text();
    if(rawBody.length>16_384)return NextResponse.json({error:"Request is too large."},{status:413});
    const body=JSON.parse(rawBody);
    const text=(value:unknown,max:number)=>typeof value==="string"?value.trim().slice(0,max):"";
    const siteSlug=text(body.siteSlug,100),pageSlug=text(body.pageSlug,100),locale=text(body.locale,2),formKind=text(body.formKind,20);
    const name=text(body.name,120),email=text(body.email,254),phone=text(body.phone,40),message=text(body.message,4000);
    const preferredDate=text(body.preferredDate,10),preferredTime=text(body.preferredTime,5);
    const partySize=Number.isInteger(body.partySize)?body.partySize:null;
    const website=text(body.website,200),elapsedMs=Number.isFinite(body.elapsedMs)?Math.max(0,Math.min(600_000,Math.floor(body.elapsedMs))):0;
    if(!siteSlug||!pageSlug||!(locale==="ar"||locale==="en")||!(formKind==="contact"||formKind==="reservation")||!name||!message||(!email&&!phone)|| (email&&!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) || (formKind==="reservation"&&(!preferredDate||!preferredTime||!partySize||partySize<1||partySize>30))){
      return NextResponse.json({error:"Please check the form fields and try again."},{status:400});
    }
    // Prefer headers set by the hosting/proxy layer. Do not trust arbitrary
    // X-Forwarded-For values supplied by a visitor for rate-limit identity.
    const ip=request.headers.get("cf-connecting-ip")
      ??request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim()
      ??request.headers.get("x-real-ip")
      ??"";
    if(!ip||isIP(ip)===0)return NextResponse.json({error:"Form submission is temporarily unavailable."},{status:503});
    const supabaseUrl=process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
    if(!supabaseUrl||!serviceRoleKey)return NextResponse.json({error:"Form submission is not configured yet."},{status:503});
    const supabase=createSupabaseClient(supabaseUrl,serviceRoleKey,{auth:{autoRefreshToken:false,persistSession:false}});
    const {data,error}=await supabase.rpc("submit_builder_form",{
      p_site_slug:siteSlug,p_page_slug:pageSlug,p_locale:locale,p_form_kind:formKind,
      p_name:name,p_email:email||null,p_phone:phone||null,p_message:message,
      p_preferred_date:preferredDate||null,p_preferred_time:preferredTime||null,p_party_size:partySize,
      p_honeypot:website,p_elapsed_ms:elapsedMs,p_ip_address:ip
    });
    if(error){
      const message=error.message??"";
      if(message.includes("form_not_published"))return NextResponse.json({error:"This form is not available."},{status:404});
      if(message.includes("spam_detected"))return NextResponse.json({error:"Please wait a moment and try again."},{status:400});
      return NextResponse.json({error:"We could not send your message. Please try again later."},{status:400});
    }
    if(!data)return NextResponse.json({error:"Too many submissions. Please try again in 15 minutes."},{status:429});
    return NextResponse.json({ok:true},{status:200});
  }catch{
    return NextResponse.json({error:"Invalid request. Please try again."},{status:400});
  }
}
