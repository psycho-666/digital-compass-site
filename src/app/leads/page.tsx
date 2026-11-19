import { AppShell } from "@/components/app-shell";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
export default async function LeadsPage() {
 if (!isSupabaseConfigured()) return <AppShell title="العملاء المحتملون"><p className="muted-copy">أكمل إعداد اتصال قاعدة البيانات أولاً.</p></AppShell>;
 const supabase = await createClient();
 const {data,error} = await supabase.from("leads").select("id,business_name,industry,city,stage,audit_score,next_followup_at,created_at").order("created_at",{ascending:false}).limit(100);
 return <AppShell title="العملاء المحتملون">
  <div className="module-title"><div><h2>إدارة الفرص والعملاء المحتملين</h2><p>متابعة مراحل الاكتشاف والتأهيل والتواصل والتحويل.</p></div><span className="tag">{(data?.length||0).toLocaleString("en-US")} فرصة</span></div>
  <div className="data-panel"><table className="data-table"><thead><tr><th>النشاط التجاري</th><th>القطاع</th><th>المدينة</th><th>المرحلة</th><th>نتيجة التدقيق</th><th>المتابعة</th></tr></thead><tbody>
  {error ? <tr><td className="empty-row" colSpan={6}>تعذر تحميل الفرص: {error.message}</td></tr> : !data?.length ? <tr><td className="empty-row" colSpan={6}>لا توجد فرص مسجلة.</td></tr> : data.map(l => <tr key={l.id}><td><b>{l.business_name}</b></td><td>{l.industry||"—"}</td><td>{l.city||"—"}</td><td><span className="tag">{l.stage}</span></td><td>{l.audit_score??"—"}</td><td>{l.next_followup_at ? new Date(l.next_followup_at).toLocaleDateString("en-GB") : "—"}</td></tr>)}
  </tbody></table></div>
 </AppShell>;
}