import { AppShell } from "@/components/app-shell";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
export default async function ContentPage() {
 if (!isSupabaseConfigured()) return <AppShell title="إدارة المحتوى"><p className="muted-copy">أكمل إعداد اتصال قاعدة البيانات أولاً.</p></AppShell>;
 const supabase = await createClient();
 const {data,error} = await supabase.from("content_posts").select("id,title,platform,status,scheduled_at,created_at").order("created_at",{ascending:false}).limit(100);
 return <AppShell title="إدارة المحتوى">
  <div className="module-title"><div><h2>مكتبة المحتوى والجدولة</h2><p>إدارة المسودات والموافقات والمنشورات المجدولة.</p></div><span className="tag">{(data?.length||0).toLocaleString("en-US")} منشور</span></div>
  <div className="data-panel"><table className="data-table"><thead><tr><th>العنوان</th><th>المنصة</th><th>الحالة</th><th>موعد النشر</th></tr></thead><tbody>
  {error ? <tr><td className="empty-row" colSpan={4}>تعذر تحميل المحتوى: {error.message}</td></tr> : !data?.length ? <tr><td className="empty-row" colSpan={4}>لا توجد منشورات بعد.</td></tr> : data.map(p => <tr key={p.id}><td>{p.title||"منشور بلا عنوان"}</td><td>{p.platform||"—"}</td><td><span className="tag">{p.status}</span></td><td>{p.scheduled_at ? new Date(p.scheduled_at).toLocaleString("en-GB") : "—"}</td></tr>)}
  </tbody></table></div>
 </AppShell>;
}