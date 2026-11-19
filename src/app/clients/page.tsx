import { AppShell } from "@/components/app-shell";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
export default async function ClientsPage() {
 if (!isSupabaseConfigured()) return <AppShell title="العملاء"><p className="muted-copy">أكمل إعداد اتصال قاعدة البيانات أولاً.</p></AppShell>;
 const supabase = await createClient();
 const {data,error} = await supabase.from("clients").select("id,business_name,industry,country,city,status,monthly_fee,currency,created_at").order("created_at",{ascending:false}).limit(100);
 return <AppShell title="العملاء">
  <div className="module-title"><div><h2>إدارة العملاء</h2><p>ملفات العملاء والخدمات والاشتراكات.</p></div><span className="tag">{(data?.length||0).toLocaleString("en-US")} عميل</span></div>
  <div className="data-panel"><table className="data-table"><thead><tr><th>اسم النشاط</th><th>القطاع</th><th>الموقع</th><th>الحالة</th><th>الأجر الشهري</th></tr></thead><tbody>
  {error ? <tr><td className="empty-row" colSpan={5}>تعذر تحميل العملاء: {error.message}</td></tr> : !data?.length ? <tr><td className="empty-row" colSpan={5}>لا يوجد عملاء بعد. أضف أول عميل للبدء.</td></tr> : data.map(c => <tr key={c.id}><td><b>{c.business_name}</b></td><td>{c.industry||"—"}</td><td>{[c.city,c.country].filter(Boolean).join("، ")||"—"}</td><td><span className="tag">{c.status}</span></td><td>{Number(c.monthly_fee).toLocaleString("en-US")} {c.currency}</td></tr>)}
  </tbody></table></div>
 </AppShell>;
}