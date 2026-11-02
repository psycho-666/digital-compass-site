"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
type Section={id:number,type:"hero"|"text"|"features",title:string,body:string};
const starter:Section[]=[{id:1,type:"hero",title:"عنوان موقعك يبدأ هنا",body:"اكتب وصفاً قصيراً لنشاطك واجذب زوارك."},{id:2,type:"text",title:"من نحن",body:"عرّف الزوار بخدماتك وقصتك."},{id:3,type:"features",title:"خدماتنا",body:"الخدمة الأولى • الخدمة الثانية • الخدمة الثالثة"}];
export default function EditorPage(){
 const router=useRouter();
 const [sections,setSections]=useState(starter),[selected,setSelected]=useState(1),[siteName,setSiteName]=useState("موقعي الجديد"),[preview,setPreview]=useState("desktop"),[saving,setSaving]=useState(false),[message,setMessage]=useState("");
 const active=sections.find(s=>s.id===selected);
 const update=(key:"title"|"body",value:string)=>setSections(old=>old.map(s=>s.id===selected?{...s,[key]:value}:s));
 const add=(type:Section["type"])=>{const id=Math.max(0,...sections.map(s=>s.id))+1;setSections([...sections,{id,type,title:type==="hero"?"عنوان رئيسي":"قسم جديد",body:"اكتب المحتوى هنا..."}]);setSelected(id)};
 async function save(){
  setSaving(true);setMessage("");
  try{
   const supabase=createClient();const {data:{user},error:authError}=await supabase.auth.getUser();
   if(authError||!user){router.push("/login");return;}
   let {data:workspace,error}=await supabase.from("builder_workspaces").select("id").eq("owner_id",user.id).maybeSingle();
   if(error)throw error;
   if(!workspace){
    const created=await supabase.from("builder_workspaces").insert({owner_id:user.id,name:"مساحة العمل الرئيسية"}).select("id").single();
    if(created.error)throw created.error;workspace=created.data;
    const member=await supabase.from("builder_workspace_members").insert({workspace_id:workspace.id,user_id:user.id,role:"owner"});
    if(member.error)throw member.error;
   }
   const slug="my-first-site";
   let {data:site,error:siteError}=await supabase.from("builder_sites").select("id").eq("workspace_id",workspace.id).eq("slug",slug).maybeSingle();
   if(siteError)throw siteError;
   if(!site){const created=await supabase.from("builder_sites").insert({workspace_id:workspace.id,name:siteName,slug,default_locale:"ar",created_by:user.id}).select("id").single();if(created.error)throw created.error;site=created.data;}
   else {const renamed=await supabase.from("builder_sites").update({name:siteName}).eq("id",site.id);if(renamed.error)throw renamed.error;}
   let {data:page,error:pageError}=await supabase.from("builder_pages").select("id").eq("site_id",site.id).eq("slug","home").eq("locale","ar").maybeSingle();
   if(pageError)throw pageError;
   if(!page){const created=await supabase.from("builder_pages").insert({site_id:site.id,title:siteName,slug:"home",locale:"ar",is_home:true}).select("id").single();if(created.error)throw created.error;page=created.data;}
   const latest=await supabase.from("builder_page_versions").select("version_no").eq("page_id",page.id).order("version_no",{ascending:false}).limit(1);
   if(latest.error)throw latest.error;
   const version=(latest.data?.[0]?.version_no??0)+1;
   const document={schemaVersion:1,locale:"ar",title:siteName,blocks:sections.map(({id,type,title,body})=>({id:String(id),type,props:{title,body}}))};
   const saved=await supabase.from("builder_page_versions").insert({page_id:page.id,version_no:version,status:"draft",document,created_by:user.id});
   if(saved.error)throw saved.error;
   setMessage("تم حفظ نسخة رقم "+version+" بنجاح.");
  }catch(err){setMessage(err instanceof Error?err.message:"تعذر حفظ الموقع.");}
  finally{setSaving(false);}
 }
 return <main className="editor"><header className="editorbar"><a href="/">← البوصلة الرقمية</a><input aria-label="اسم الموقع" value={siteName} onChange={e=>setSiteName(e.target.value)}/><span className="draft">مسودة</span><button className="savebutton" disabled={saving} onClick={save}>{saving?"جارٍ الحفظ…":"حفظ الموقع"}</button></header>
 <div className="editorlayout"><aside className="tools"><h3>أضف قسماً</h3><button onClick={()=>add("hero")}>＋ قسم رئيسي</button><button onClick={()=>add("text")}>＋ نص ومحتوى</button><button onClick={()=>add("features")}>＋ الخدمات</button><hr/><h3>أقسام الصفحة</h3>{sections.map(s=><button className={selected===s.id?"chosen":""} key={s.id} onClick={()=>setSelected(s.id)}>{s.title||"قسم بدون عنوان"}</button>)}</aside>
 <section className="canvas"><div className="canvashead"><strong>معاينة الموقع</strong><div><button className={preview==="desktop"?"chosen":""} onClick={()=>setPreview("desktop")}>كمبيوتر</button><button className={preview==="mobile"?"chosen":""} onClick={()=>setPreview("mobile")}>موبايل</button></div></div><div className={"sitepreview "+preview}><nav>{siteName}<span>الرئيسية　 خدماتنا　 تواصل</span></nav>{sections.map(s=><article key={s.id} className={"previewsection "+s.type+(s.id===selected?" active":"")} onClick={()=>setSelected(s.id)}><h1>{s.title}</h1><p>{s.body}</p>{s.type==="hero"&&<button>تواصل معنا</button>}</article>)}<footer>© {siteName}</footer></div>{message&&<p className="savemessage" role="status">{message}</p>}</section>
 <aside className="properties"><h3>خصائص القسم</h3>{active?<><label>العنوان</label><input value={active.title} onChange={e=>update("title",e.target.value)}/><label>المحتوى</label><textarea rows={6} value={active.body} onChange={e=>update("body",e.target.value)}/><label>نوع القسم</label><div className="typepill">{active.type==="hero"?"رئيسي":active.type==="text"?"نص":"خدمات"}</div><button className="danger" onClick={()=>{setSections(old=>old.filter(s=>s.id!==selected));setSelected(sections.find(s=>s.id!==selected)?.id||0)}}>حذف القسم</button></>:<p>اختر قسماً لتعديل خصائصه.</p>}</aside></div></main>
}