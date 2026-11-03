"use client";
import {useEffect,useState,type FormEvent,type CSSProperties} from "react";
import {useRouter} from "next/navigation";
import Link from "next/link";
import {createClient} from "@/lib/supabase/client";
import {LanguageSwitch,useLocale} from "@/components/locale-provider";

type Project={id:string;name:string;slug:string;default_locale:string;client_id:string|null;created_at:string};
type Client={id:string;name:string;business_type:string;phone:string;email:string};
export default function ProjectsPage(){
 const router=useRouter(),{locale}=useLocale(),ar=locale==="ar";
 const [projects,setProjects]=useState<Project[]>([]),[clients,setClients]=useState<Record<string,Client>>({});
 const [name,setName]=useState(""),[businessType,setBusinessType]=useState(""),[phone,setPhone]=useState(""),[email,setEmail]=useState(""),[notes,setNotes]=useState("");
 const [loading,setLoading]=useState(true),[creating,setCreating]=useState(false),[message,setMessage]=useState("");
 async function load(){
  setLoading(true);
  try{
   const supabase=createClient();const {data:{user},error:authError}=await supabase.auth.getUser();
   if(authError||!user){router.push("/login");return;}
   const {data:workspace,error:workspaceError}=await supabase.from("builder_workspaces").select("id").eq("owner_id",user.id).maybeSingle();
   if(workspaceError)throw workspaceError;if(!workspace){setProjects([]);return;}
   const {data:siteRows,error:siteError}=await supabase.from("builder_sites").select("id,name,slug,default_locale,client_id,created_at").eq("workspace_id",workspace.id).order("created_at",{ascending:false});
   if(siteError)throw siteError;setProjects(siteRows??[]);
   const clientIds=(siteRows??[]).map(site=>site.client_id).filter((id):id is string=>Boolean(id));
   if(clientIds.length){const {data:rows,error}=await supabase.from("builder_clients").select("id,name,business_type,phone,email").in("id",clientIds);if(error)throw error;setClients(Object.fromEntries((rows??[]).map(client=>[client.id,client])));}
  }catch(error){setMessage(error instanceof Error?error.message:(ar?"تعذر تحميل المشاريع.":"Could not load projects."));}
  finally{setLoading(false);}
 }
 useEffect(()=>{void load();},[]);
 async function createProject(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(!name.trim())return;setCreating(true);setMessage("");
  try{
   const supabase=createClient();const {data:{user},error:authError}=await supabase.auth.getUser();if(authError||!user){router.push("/login");return;}
   const {data:existingWorkspace,error:workspaceError}=await supabase.from("builder_workspaces").select("id").eq("owner_id",user.id).maybeSingle();
   if(workspaceError)throw workspaceError;let workspace=existingWorkspace;
   if(!workspace){const created=await supabase.from("builder_workspaces").insert({owner_id:user.id,name:ar?"إدارة مواقع العملاء":"Client websites"}).select("id").single();if(created.error)throw created.error;workspace=created.data;}
   const member=await supabase.from("builder_workspace_members").upsert({workspace_id:workspace.id,user_id:user.id,role:"owner"},{onConflict:"workspace_id,user_id"});if(member.error)throw member.error;
   const client=await supabase.from("builder_clients").insert({workspace_id:workspace.id,name:name.trim(),business_type:businessType.trim(),phone:phone.trim(),email:email.trim(),notes:notes.trim()}).select("id").single();
   if(client.error)throw client.error;
   const base=name.toLowerCase().normalize("NFKD").replace(/[\\u0300-\\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,42)||"client";
   const slug=base+"-"+crypto.randomUUID().replaceAll("-","").slice(0,8);
   const site=await supabase.from("builder_sites").insert({workspace_id:workspace.id,client_id:client.data.id,name:name.trim(),slug,default_locale:locale,created_by:user.id}).select("id").single();
   if(site.error){await supabase.from("builder_clients").delete().eq("id",client.data.id);throw site.error;}
   router.push("/editor?site="+site.data.id);
  }catch(error){setMessage(error instanceof Error?error.message:(ar?"تعذر إنشاء موقع الزبون.":"Could not create client website."));}
  finally{setCreating(false);}
 }
 return <main style={{minHeight:"100vh",background:"#f5f3f7",color:"#241b2b",padding:"28px",fontFamily:"Arial,sans-serif"}} dir={ar?"rtl":"ltr"}>
  <header style={{maxWidth:1120,margin:"0 auto 32px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:16,flexWrap:"wrap"}}>
   <div><Link href="/" style={{color:"#63366f",textDecoration:"none"}}>← {ar?"البوصلة الرقمية":"Digital Compass"}</Link><h1 style={{fontSize:32,margin:"14px 0 4px"}}>{ar?"إدارة مواقع الزبائن":"Client websites"}</h1><p style={{margin:0,color:"#716879"}}>{ar?"كل زبون وموقعه بمكان واحد — الإدارة والتحرير إلك وحدك.":"One private workspace to manage every client and their websites."}</p></div><LanguageSwitch/>
  </header>
  <div style={{maxWidth:1120,margin:"0 auto",display:"grid",gridTemplateColumns:"minmax(280px,360px) 1fr",gap:22,alignItems:"start"}}>
   <form onSubmit={createProject} style={{background:"#fff",padding:22,borderRadius:18,boxShadow:"0 8px 28px #21142a0c",display:"grid",gap:12}}>
    <h2 style={{margin:"0 0 4px",fontSize:20}}>{ar?"إضافة زبون وموقع جديد":"Add a client website"}</h2>
    <label>{ar?"اسم الزبون / النشاط التجاري *":"Client / business name *"}<input required value={name} onChange={e=>setName(e.target.value)} placeholder={ar?"مثلاً: شركة النور":"e.g. Al Noor Company"} style={field}/></label>
    <label>{ar?"نوع النشاط":"Business type"}<input value={businessType} onChange={e=>setBusinessType(e.target.value)} placeholder={ar?"مطعم، عيادة، شركة...":"Restaurant, clinic, company..."} style={field}/></label>
    <label>{ar?"رقم الهاتف":"Phone"}<input value={phone} onChange={e=>setPhone(e.target.value)} style={field}/></label>
    <label>{ar?"البريد الإلكتروني":"Email"}<input type="email" value={email} onChange={e=>setEmail(e.target.value)} style={field}/></label>
    <label>{ar?"ملاحظات داخلية":"Internal notes"}<textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3} style={field}/></label>
    <button disabled={creating||!name.trim()} style={{border:0,borderRadius:10,padding:13,background:"#5d326b",color:"#fff",fontWeight:700,cursor:"pointer"}}>{creating?(ar?"جارٍ الإنشاء…":"Creating…"):(ar?"إنشاء ملف الزبون وفتح المحرر":"Create client & open editor")}</button>
    {message&&<p role="status" style={{color:"#a33",margin:0}}>{message}</p>}
   </form>
   <section style={{background:"#fff",padding:22,borderRadius:18,boxShadow:"0 8px 28px #21142a0c"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}><h2 style={{margin:"0 0 16px",fontSize:20}}>{ar?"المواقع الحالية":"Your websites"}</h2><span style={{color:"#766b7b"}}>{projects.length} {ar?"موقع":"sites"}</span></div>
    {loading?<p>{ar?"جارٍ التحميل…":"Loading…"}</p>:projects.length===0?<p style={{color:"#716879"}}>{ar?"ما عندك مواقع حالياً. أضف أول زبون من النموذج.":"No websites yet. Add your first client using the form."}</p>:<div style={{display:"grid",gap:12}}>{projects.map(project=>{const client=project.client_id?clients[project.client_id]:undefined;return <article key={project.id} style={{border:"1px solid #ece7ef",borderRadius:14,padding:16,display:"flex",justifyContent:"space-between",gap:14,alignItems:"center",flexWrap:"wrap"}}>
      <div><strong style={{fontSize:17}}>{client?.name??project.name}</strong><p style={{margin:"5px 0",color:"#716879"}}>{client?.business_type|| (ar?"موقع إلكتروني":"Website")} · {project.slug}</p><small style={{color:"#887e8d"}}>{client?.phone||client?.email||""}</small></div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}><Link href={"/editor?site="+project.id} style={action}>{ar?"فتح المحرر":"Edit website"}</Link><Link href={"/sites/"+project.slug+"/"+project.default_locale+"/home"} target="_blank" style={{...action,background:"#f1edf3",color:"#51365c"}}>{ar?"معاينة":"Preview"}</Link></div>
     </article>})}</div>}
   </section>
  </div>
  <style>{'@media(max-width:760px){main>div{grid-template-columns:1fr!important} } label{display:grid;gap:6px;font-size:13px;font-weight:600;color:#514658} input,textarea{font:inherit}'}</style>
 </main>;
}
const field:CSSProperties={width:"100%",boxSizing:"border-box",border:"1px solid #ddd5e2",borderRadius:9,padding:"10px 11px",marginTop:5,background:"#fff",color:"#241b2b"};
const action:React.CSSProperties={textDecoration:"none",padding:"9px 12px",borderRadius:9,background:"#5d326b",color:"#fff",fontSize:13,fontWeight:700};
