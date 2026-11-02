import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import "./submissions.css";

export const dynamic="force-dynamic";

export default async function SubmissionsPage({searchParams}:{searchParams:Promise<{lang?:string}>}){
  const {lang}=await searchParams;const ar=lang!=="en";const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");
  const {data:workspace,error:workspaceError}=await supabase.from("builder_workspaces").select("id").eq("owner_id",user.id).maybeSingle();
  if(workspaceError||!workspace)redirect("/editor");
  const {data:site,error:siteError}=await supabase.from("builder_sites").select("id,name").eq("workspace_id",workspace.id).maybeSingle();
  if(siteError||!site)redirect("/editor");
  const {data:submissions,error}=await supabase.from("builder_form_submissions").select("id,page_id,form_kind,name,email,phone,message,preferred_date,preferred_time,party_size,created_at").eq("site_id",site.id).order("created_at",{ascending:false}).limit(100);
  const pageIds=[...new Set((submissions??[]).map(item=>item.page_id))];
  const {data:pages}=pageIds.length?await supabase.from("builder_pages").select("id,title,locale").in("id",pageIds):{data:[]};
  const pageMap=new Map((pages??[]).map(page=>[page.id,page]));
  return <main className="submissions-page" dir={ar?"rtl":"ltr"} lang={ar?"ar":"en"}>
    <header><a href={"/editor"}>{ar?"← العودة إلى المحرر":"← Back to editor"}</a><div><span>{site.name}</span><h1>{ar?"طلبات العملاء":"Customer submissions"}</h1><p>{ar?"آخر 100 طلب وصل عبر نماذج الموقع.":"The latest 100 requests received through your website forms."}</p></div><strong>{(submissions??[]).length}</strong></header>
    {error?<p className="submissions-error">{ar?"تعذر تحميل الطلبات. تحقق من صلاحيات مساحة العمل.":"Could not load submissions. Check workspace permissions."}</p>:
    !submissions?.length?<section className="submissions-empty"><h2>{ar?"لا توجد طلبات حتى الآن":"No submissions yet"}</h2><p>{ar?"ستظهر هنا الرسائل وطلبات الحجز التي يرسلها زوار موقعك بعد نشر النموذج.":"Messages and reservation requests will appear here after visitors submit a published form."}</p></section>:
    <div className="submissions-table-wrap"><table><thead><tr><th>{ar?"النوع":"Type"}</th><th>{ar?"العميل":"Customer"}</th><th>{ar?"التواصل":"Contact"}</th><th>{ar?"التفاصيل":"Details"}</th><th>{ar?"الصفحة":"Page"}</th><th>{ar?"تاريخ الوصول":"Received"}</th></tr></thead><tbody>{submissions.map(item=>{const page=pageMap.get(item.page_id);return <tr key={item.id}><td><span className={"submission-kind "+item.form_kind}>{item.form_kind==="reservation"?(ar?"حجز":"Reservation"):(ar?"تواصل":"Contact")}</span></td><td><strong>{item.name}</strong></td><td>{item.email&&<a href={"mailto:"+item.email}>{item.email}</a>}{item.phone&&<a href={"tel:"+item.phone}>{item.phone}</a>}</td><td><p>{item.message}</p>{item.form_kind==="reservation"&&<small>{ar?"موعد مقترح: ":"Preferred: "}{item.preferred_date} {item.preferred_time} · {item.party_size} {ar?"أشخاص":"people"}</small>}</td><td>{page?.title??"—"} <small>{page?.locale?.toUpperCase()??""}</small></td><td>{new Date(item.created_at).toLocaleString(ar?"ar-IQ":"en-US",{dateStyle:"medium",timeStyle:"short"})}</td></tr>})}</tbody></table></div>}
  </main>;
}
