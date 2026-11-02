"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
import {createClient} from "@/lib/supabase/client";
import {LanguageSwitch,useLocale} from "@/components/locale-provider";
type Section={id:number,type:"hero"|"text"|"features",title:string,body:string};
const starter=(ar:boolean):Section[]=>[{id:1,type:"hero",title:ar?"عنوان موقعك يبدأ هنا":"Your headline starts here",body:ar?"اكتب وصفاً قصيراً لنشاطك واجذب زوارك.":"Describe your business and welcome your visitors."},{id:2,type:"text",title:ar?"من نحن":"About us",body:ar?"عرّف الزوار بخدماتك وقصتك.":"Tell visitors about your story and what you do."},{id:3,type:"features",title:ar?"خدماتنا":"Our services",body:ar?"الخدمة الأولى • الخدمة الثانية • الخدمة الثالثة":"Service one • Service two • Service three"}];
export default function EditorPage(){
 const router=useRouter(),{locale}=useLocale(),ar=locale==="ar";
 const [sections,setSections]=useState<Section[]>(()=>starter(true)),[selected,setSelected]=useState(1),[siteName,setSiteName]=useState("موقعي الجديد"),[preview,setPreview]=useState("desktop"),[saving,setSaving]=useState(false),[message,setMessage]=useState("");
 const active=sections.find(s=>s.id===selected);
 const update=(key:"title"|"body",value:string)=>setSections(old=>old.map(s=>s.id===selected?{...s,[key]:value}:s));
 const add=(type:Section["type"])=>{const id=Math.max(0,...sections.map(s=>s.id))+1;setSections([...sections,{id,type,title:type==="hero"?(ar?"عنوان رئيسي":"Main headline"):(ar?"قسم جديد":"New section"),body:ar?"اكتب المحتوى هنا...":"Write your content here..."}]);setSelected(id)};
 async function save(){
  setSaving(true);setMessage("");
  try{
   const supabase=createClient();const {data:{user},error:authError}=await supabase.auth.getUser();
   if(authError||!user){router.push("/login");return;}
   let {data:workspace,error}=await supabase.from("builder_workspaces").select("id").eq("owner_id",user.id).maybeSingle();
   if(error)throw error;
   if(!workspace){const created=await supabase.from("builder_workspaces").insert({owner_id:user.id,name:ar?"مساحة العمل الرئيسية":"Main workspace"}).select("id").single();if(created.error)throw created.error;workspace=created.data;}
   const member=await supabase.from("builder_workspace_members").upsert({workspace_id:workspace.id,user_id:user.id,role:"owner"},{onConflict:"workspace_id,user_id"});if(member.error)throw member.error;
   const slug="my-first-site";
   let {data:site,error:siteError}=await supabase.from("builder_sites").select("id").eq("workspace_id",workspace.id).eq("slug",slug).maybeSingle();if(siteError)throw siteError;
   if(!site){const created=await supabase.from("builder_sites").insert({workspace_id:workspace.id,name:siteName,slug,default_locale:locale,created_by:user.id}).select("id").single();if(created.error)throw created.error;site=created.data;}
   else {const renamed=await supabase.from("builder_sites").update({name:siteName,default_locale:locale}).eq("id",site.id);if(renamed.error)throw renamed.error;}
   let {data:page,error:pageError}=await supabase.from("builder_pages").select("id").eq("site_id",site.id).eq("slug","home").eq("locale",locale).maybeSingle();if(pageError)throw pageError;
   if(!page){const created=await supabase.from("builder_pages").insert({site_id:site.id,title:siteName,slug:"home",locale,is_home:true}).select("id").single();if(created.error)throw created.error;page=created.data;}
   const latest=await supabase.from("builder_page_versions").select("version_no").eq("page_id",page.id).order("version_no",{ascending:false}).limit(1);if(latest.error)throw latest.error;
   const version=(latest.data?.[0]?.version_no??0)+1;
   const document={schemaVersion:1,locale,title:siteName,blocks:sections.map(({id,type,title,body})=>({id:String(id),type,props:{title,body}}))};
   const saved=await supabase.from("builder_page_versions").insert({page_id:page.id,version_no:version,status:"draft",document,created_by:user.id});if(saved.error)throw saved.error;
   setMessage(ar?"تم حفظ النسخة رقم "+version+" بنجاح.":"Version "+version+" saved successfully.");
  }catch(err){setMessage(err instanceof Error?err.message:(ar?"تعذر حفظ الموقع.":"Could not save the website."));}
  finally{setSaving(false);}
 }
 return <main className="editor"><header className="editorbar"><a href="/">{ar?"← البوصلة الرقمية":"Digital Compass →"}</a><input aria-label={ar?"اسم الموقع":"Website name"} value={siteName} onChange={e=>setSiteName(e.target.value)}/><span className="draft">{ar?"مسودة":"Draft"}</span><LanguageSwitch/><button className="savebutton" disabled={saving} onClick={save}>{saving?(ar?"جارٍ الحفظ…":"Saving…"):(ar?"حفظ الموقع":"Save website")}</button></header>
 <div className="editorlayout"><aside className="tools"><h3>{ar?"أضف قسماً":"Add a section"}</h3><button onClick={()=>add("hero")}>＋ {ar?"قسم رئيسي":"Hero section"}</button><button onClick={()=>add("text")}>＋ {ar?"نص ومحتوى":"Text & content"}</button><button onClick={()=>add("features")}>＋ {ar?"الخدمات":"Services"}</button><hr/><h3>{ar?"أقسام الصفحة":"Page sections"}</h3>{sections.map(s=><button className={selected===s.id?"chosen":""} key={s.id} onClick={()=>setSelected(s.id)}>{s.title|| (ar?"قسم بدون عنوان":"Untitled section")}</button>)}</aside>
 <section className="canvas"><div className="canvashead"><strong>{ar?"معاينة الموقع":"Website preview"}</strong><div><button className={preview==="desktop"?"chosen":""} onClick={()=>setPreview("desktop")}>{ar?"كمبيوتر":"Desktop"}</button><button className={preview==="mobile"?"chosen":""} onClick={()=>setPreview("mobile")}>{ar?"موبايل":"Mobile"}</button></div></div><div className={"sitepreview "+preview} dir={locale==="ar"?"rtl":"ltr"}><nav>{siteName}<span>{ar?"الرئيسية　 خدماتنا　 تواصل":"Home　 Services　 Contact"}</span></nav>{sections.map(s=><article key={s.id} className={"previewsection "+s.type+(s.id===selected?" active":"")} onClick={()=>setSelected(s.id)}><h1>{s.title}</h1><p>{s.body}</p>{s.type==="hero"&&<button>{ar?"تواصل معنا":"Contact us"}</button>}</article>)}<footer>© {siteName}</footer></div>{message&&<p className="savemessage" role="status">{message}</p>}</section>
 <aside className="properties"><h3>{ar?"خصائص القسم":"Section settings"}</h3>{active?<><label>{ar?"العنوان":"Title"}</label><input value={active.title} onChange={e=>update("title",e.target.value)}/><label>{ar?"المحتوى":"Content"}</label><textarea rows={6} value={active.body} onChange={e=>update("body",e.target.value)}/><label>{ar?"نوع القسم":"Section type"}</label><div className="typepill">{active.type==="hero"?(ar?"رئيسي":"Hero"):active.type==="text"?(ar?"نص":"Text"):(ar?"خدمات":"Services")}</div><button className="danger" onClick={()=>{setSections(old=>old.filter(s=>s.id!==selected));setSelected(sections.find(s=>s.id!==selected)?.id||0)}}>{ar?"حذف القسم":"Delete section"}</button></>:<p>{ar?"اختر قسماً لتعديل خصائصه.":"Select a section to edit its settings."}</p>}</aside></div></main>
}
