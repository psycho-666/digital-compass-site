import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return new Response(JSON.stringify({error:"Method not allowed"}),{status:405,headers:{...cors,"Content-Type":"application/json"}});
 const token=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
 const url=Deno.env.get("SUPABASE_URL")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,key=Deno.env.get("OPENAI_API_KEY");
 if(!token)return new Response(JSON.stringify({error:"Authentication required"}),{status:401,headers:{...cors,"Content-Type":"application/json"}});
 if(!key)return new Response(JSON.stringify({error:"AI image provider is not configured. Add OPENAI_API_KEY to Supabase Edge Function secrets."}),{status:503,headers:{...cors,"Content-Type":"application/json"}});
 const admin=createClient(url,service,{auth:{persistSession:false}});
 const {data:auth,error:authError}=await admin.auth.getUser(token);
 if(authError||!auth.user)return new Response(JSON.stringify({error:"Invalid session"}),{status:401,headers:{...cors,"Content-Type":"application/json"}});
 try{
  const b=await req.json(),brief=String(b.brief||"").trim().slice(0,1800),audience=String(b.audience||"").slice(0,300),tone=String(b.tone||"").slice(0,120),colors=String(b.brandColors||"").slice(0,120),platform=String(b.platform||"Instagram / Facebook").slice(0,50);
  if(brief.length<12)return new Response(JSON.stringify({error:"Please provide a more detailed post brief."}),{status:400,headers:{...cors,"Content-Type":"application/json"}});
  const directions=["Premium editorial composition, clear visual hierarchy and elegant whitespace.","Bold campaign composition with dynamic geometry and energetic visual contrast.","Minimal luxury composition, refined grid and sophisticated lighting."];
  const designs=await Promise.all(directions.map(async(direction,index)=>{
   const prompt=["Create a polished ready-to-publish social media post graphic.", "Platform: "+platform+". Square 1:1 composition.", "Post brief: "+brief, "Target audience: "+(audience||"local customers"), "Brand tone: "+(tone||"modern and professional"), "Brand colors: "+(colors||"choose a professional harmonious palette"), direction, "Commercial art direction, readable accurate typography, no invented logos or watermarks."].join("\n");
   const response=await fetch("https://api.openai.com/v1/images/generations",{method:"POST",headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({model:"gpt-image-1",prompt,size:"1024x1024",quality:"medium",n:1,output_format:"png"})});
   const payload=await response.json();if(!response.ok)throw new Error(payload?.error?.message||"Image generation failed");
   const encoded=payload?.data?.[0]?.b64_json;if(!encoded)throw new Error("No image data returned");
   const bytes=Uint8Array.from(atob(encoded),(c)=>c.charCodeAt(0)),path=auth.user.id+"/generated/"+crypto.randomUUID()+".png";
   const {error:uploadError}=await admin.storage.from("social-media").upload(path,bytes,{contentType:"image/png",upsert:false});if(uploadError)throw uploadError;
   const {data:signed,error:signedError}=await admin.storage.from("social-media").createSignedUrl(path,3600);if(signedError||!signed?.signedUrl)throw signedError||new Error("Preview URL unavailable");
   return {id:index+1,path,url:signed.signedUrl};
  }));
  return new Response(JSON.stringify({designs}),{status:200,headers:{...cors,"Content-Type":"application/json"}});
 }catch(e){return new Response(JSON.stringify({error:e instanceof Error?e.message:"Design generation failed"}),{status:500,headers:{...cors,"Content-Type":"application/json"}})}
});