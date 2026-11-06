"use client";
import {useEffect,useState,type FormEvent,type CSSProperties} from "react";
import {useRouter} from "next/navigation";
import Link from "next/link";
import {createClient} from "@/lib/supabase/client";
import {LanguageSwitch,useLocale} from "@/components/locale-provider";
type Project={id:string;name:string;slug:string;default_locale:string;client_id:string|null;created_at:string};
type Client={id:string;name:string;business_type:string;contact_name:string;phone:string;email:string;notes:string};
const field:CSSProperties={width:"100%",boxSizing:"border-box",border:"1px solid #ddd5e2",borderRadius:9,padding:"10px 11px",marginTop:5,background:"#fff",color:"#241b2b"};
const panel:CSSProperties={background:"#fff",padding:22,borderRadius:18,boxShadow:"0 8px 28px #21142a0c",display:"grid",gap:12};
const primary:CSSProperties={border:0,borderRadius:10,padding:13,background:"#5d326b",color:"#fff",fontWeight:700,cursor:"pointer"};
const secondary:CSSProperties={textDecoration:"none",padding:"9px 12px",borderRadius:9,background:"#f1edf3",color:"#51365c",fontSize:13,fontWeight:700,border:0,cursor:"pointer"};
const slug=(s:string)=>{const base=s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,42)||"client";return base+"-"+crypto.randomUUID().replaceAll("-","").slice(0,8);};
export default function ProjectsPage(){
 const router=useRouter(),{locale}=useLocale(),ar=locale==="ar";
 const [workspace,setWorkspace]=useState(""),[projects,setProjects]=useState<Project[]>([]),[clients,setClients]=useState<Client[]>([]);
 const [name,setName]=useState(""),[businessType,setBusinessType]=useState(""),[contactName,setContactName]=useState(""),[phone,setPhone]=useState(""),[email,setEmail]=useState(""),[notes,setNotes]=useState("");
 const [selectedClient,setSelectedClient]=useState(""),[editing,setEditing]=useState(""),[edit,setEdit]=useState<Client|null>(null);
 const [published,setPublished]=useState<string[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 async function load(){
  setLoading(true);
  try{
   const db=createClient(),{data:{user},error:auth}=await db.auth.getUser();if(auth||!user){router.push("/login");return;}
   const {data:w,error:we}=await db.from("builder_workspaces").select("id").eq("owner_id",user.id).maybeSingle();if(we)throw we;
   if(!w){setWorkspace("");setProjects([]);setClients([]);setPublished([]);return;}setWorkspace(w.id);
   const [s,c]=await Promise.all([db.from("builder_sites").select("id,name,slug,default_locale,client_id,created_at").eq("workspace_id",w.id).order("created_at",{ascending:false}),db.from("builder_clients").select("id,name,business_type,contact_name,phone,email,notes").eq("workspace_id",w.id).order("created_at",{ascending:false})]);
   if(s.error)throw s.error;if(c.error)throw c.error;setProjects(s.data??[]);setClients(c.data??[]);
   const ids=(s.data??[]).map(x=>x.id);if(!ids.length){setPublished([]);return;}
   const {data:p,error:pe}=await db.from("builder_pages").select("id,site_id").in("site_id",ids);if(pe)throw pe;
   const pageIds=(p??[]).map(x=>x.id);if(!pageIds.length){setPublished([]);return;}
   const {data:v,error:ve}=await db.from("builder_page_versions").select("page_id").eq("status","published").in("page_id",pageIds);if(ve)throw ve;
   const live=new Set((v??[]).map(x=>x.page_id));setPublished([...new Set((p??[]).filter(x=>live.has(x.id)).map(x=>x.site_id))]);
  }catch(e){setMessage(e instanceof Error?e.message:"Could not load client websites.");}finally{setLoading(false);}
 }
 useEffect(()=>{void load();},[]);
 async function createProject(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!name.trim())return;setBusy(true);setMessage("");
  try{const db=createClient(),{data:{user},error:ae}=await db.auth.getUser();if(ae||!user){router.push("/login");return;}
   let wid=workspace;if(!wid){const {data:w,error}=await db.from("builder_workspaces").insert({owner_id:user.id,name:ar?"إدارة مواقع العملاء":"Client websites"}).select("id").single();if(error)throw error;wid=w.id;setWorkspace(wid);const m=await db.from("builder_workspace_members").upsert({workspace_id:wid,user_id:user.id,role:"owner"},{onConflict:"workspace_id,user_id"});if(m.error)throw m.error;}
   const {data:c,error:ce}=await db.from("builder_clients").insert({workspace_id:wid,name:name.trim(),business_type:businessType.trim(),contact_name:contactName.trim(),phone:phone.trim(),email:email.trim(),notes:notes.trim()}).select("id").single();if(ce)throw ce;
   const {data:s,error:se}=await db.from("builder_sites").insert({workspace_id:wid,client_id:c.id,name:name.trim(),slug:slug(name),default_locale:locale,created_by:user.id}).select("id").single();
   if(se){await db.from("builder_clients").delete().eq("id",c.id);throw se;}router.push("/editor?site="+s.id);
  }catch(e){setMessage(e instanceof Error?e.message:"Could not create client website.");}finally{setBusy(false);}
 }
 async function addSite(e:FormEvent<HTMLFormElement>){
  e.preventDefault();const c=clients.find(x=>x.id===selectedClient);if(!c||!workspace)return;setBusy(true);
  try{const db=createClient(),{data:{user},error:ae}=await db.auth.getUser();if(ae||!user){router.push("/login");return;}
   const {data:s,error}=await db.from("builder_sites").insert({workspace_id:workspace,client_id:c.id,name:c.name,slug:slug(c.name),default_locale:locale,created_by:user.id}).select("id").single();if(error)throw error;router.push("/editor?site="+s.id);
  }catch(e){setMessage(e instanceof Error?e.message:"Could not add website.");}finally{setBusy(false);}
 }
 async function saveClient(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!edit||!workspace)return;setBusy(true);
  try{const {error}=await createClient().from("builder_clients").update({name:edit.name.trim(),business_type:edit.business_type,contact_name:edit.contact_name,phone:edit.phone,email:edit.email,notes:edit.notes,updated_at:new Date().toISOString()}).eq("id",edit.id).eq("workspace_id",workspace);if(error)throw error;setEditing("");setEdit(null);await load();setMessage(ar?"تم تحديث بيانات الزبون.":"Client updated.");}
  catch(e){setMessage(e instanceof Error?e.message:"Could not update client.");}finally{setBusy(false);}
 }
 return <main style={{minHeight:"100vh",background:"#f5f3f7",color:"#241b2b",padding:28,fontFamily:"Arial,sans-serif"}} dir={ar?"rtl":"ltr"}>
  <header style={{maxWidth:1120,margin:"0 auto 32px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:16,flexWrap:"wrap"}}><div><Link href="/" style={{color:"#63366f",textDecoration:"none"}}>← {ar?"البوصلة الرقمية":"Digital Compass"}</Link><h1 style={{fontSize:32,margin:"14px 0 4px"}}>{ar?"إدارة مواقع الزبائن":"Client websites"}</h1><p style={{margin:0,color:"#716879"}}>{ar?"إدارة زبائنك ومواقعهم من حسابك الإداري فقط.":"Manage clients and their websites from your private admin workspace."}</p></div><LanguageSwitch/></header>
  <div style={{maxWidth:1120,margin:"0 auto",display:"grid",gridTemplateColumns:"minmax(280px,360px) 1fr",gap:22,alignItems:"start"}}>
   <div style={{display:"grid",gap:18}}>
    <form onSubmit={createProject} style={panel}><h2 style={heading}>{ar?"إضافة زبون وموقع جديد":"Add a client website"}</h2>
     <label>{ar?"اسم الزبون / النشاط التجاري *":"Client / business name *"}<input required maxLength={160} value={name} onChange={e=>setName(e.target.value)} style={field}/></label>
     <label>{ar?"نوع النشاط":"Business type"}<input maxLength={120} value={businessType} onChange={e=>setBusinessType(e.target.value)} style={field}/></label>
     <label>{ar?"اسم جهة الاتصال":"Contact name"}<input maxLength={160} value={contactName} onChange={e=>setContactName(e.target.value)} style={field}/></label>
     <label>{ar?"الهاتف":"Phone"}<input maxLength={40} value={phone} onChange={e=>setPhone(e.target.value)} style={field}/></label>
     <label>{ar?"البريد الإلكتروني":"Email"}<input type="email" maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} style={field}/></label>
     <label>{ar?"ملاحظات":"Notes"}<textarea maxLength={2000} rows={3} value={notes} onChange={e=>setNotes(e.target.value)} style={field}/></label>
     <button disabled={busy||!name.trim()} style={primary}>{ar?"إنشاء الزبون وفتح المحرر":"Create client & open editor"}</button>
    </form>
    {clients.length>0&&<form onSubmit={addSite} style={panel}><h2 style={heading}>{ar?"إضافة موقع لزبون موجود":"Add a site to an existing client"}</h2><select required value={selectedClient} onChange={e=>setSelectedClient(e.target.value)} style={field}><option value="">{ar?"اختر الزبون":"Select client"}</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><button disabled={busy||!selectedClient} style={primary}>{ar?"إنشاء موقع جديد":"Create another website"}</button></form>}
   </div>
   <section style={panel}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><h2 style={heading}>{ar?"الزبائن والمواقع":"Clients & websites"}</h2><span>{projects.length} {ar?"موقع":"sites"}</span></div>
    {loading?<p>{ar?"جارٍ التحميل…":"Loading…"}</p>:clients.length===0?<p>{ar?"لا يوجد زبائن بعد.":"No clients yet."}</p>:clients.map(c=><article key={c.id} style={{border:"1px solid #ece7ef",borderRadius:14,padding:16,display:"grid",gap:10}}>
     <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap"}}><div><strong>{c.name}</strong><p style={{margin:"5px 0",color:"#716879"}}>{c.business_type||"—"} · {c.phone||c.email}</p></div><button type="button" style={secondary} onClick={()=>{setEditing(editing===c.id?"":c.id);setEdit({...c});}}>{ar?"تعديل بيانات الزبون":"Edit client"}</button></div>
     {editing===c.id&&edit&&<form onSubmit={saveClient} style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:9}}>{(["name","business_type","contact_name","phone","email","notes"] as const).map(k=><label key={k}>{({name:ar?"الاسم":"Name",business_type:ar?"النشاط":"Business type",contact_name:ar?"جهة الاتصال":"Contact",phone:ar?"الهاتف":"Phone",email:ar?"البريد":"Email",notes:ar?"ملاحظات":"Notes"})[k]}{k==="notes"?<textarea rows={2} value={edit[k]} onChange={e=>setEdit({...edit,[k]:e.target.value})} style={field}/>:<input value={edit[k]} onChange={e=>setEdit({...edit,[k]:e.target.value})} style={field}/>}</label>)}<button disabled={busy||!edit.name.trim()} style={primary}>{ar?"حفظ التعديلات":"Save changes"}</button></form>}
     {projects.filter(s=>s.client_id===c.id).map(s=><div key={s.id} style={{background:"#faf9fb",borderRadius:10,padding:12,display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}><div><strong>{s.name}</strong><p style={{margin:"4px 0",fontSize:12,color:"#716879"}}>{s.slug}</p><small style={{color:published.includes(s.id)?"#18794e":"#8a641c"}}>{published.includes(s.id)?(ar?"منشور":"Published"):(ar?"مسودة / غير منشور":"Draft / unpublished")}</small></div><div style={{display:"flex",gap:8}}><Link href={"/editor?site="+s.id} style={primary}>{ar?"تحرير":"Edit"}</Link><Link href={"/sites/"+s.slug+"/"+s.default_locale+"/home"} target="_blank" style={secondary}>{ar?"معاينة":"Preview"}</Link></div></div>)}
    </article>)}
    {message&&<p role="status" style={{color:"#a33"}}>{message}</p>}
   </section>
  </div><style>{'@media(max-width:760px){main>div{grid-template-columns:1fr!important}}label{display:grid;gap:6px;font-size:13px;font-weight:600;color:#514658}input,textarea,select{font:inherit}'}</style>
 </main>;
}
const heading:CSSProperties={margin:"0 0 4px",fontSize:20};
