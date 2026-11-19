import { AppShell } from "@/components/app-shell";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
export default async function InboxPage() {
 if (!isSupabaseConfigured()) return <AppShell title="الرسائل والتعليقات"><p className="muted-copy">أكمل إعداد اتصال قاعدة البيانات أولاً.</p></AppShell>;
 const supabase = await createClient();
 const {data,error} = await supabase.from("inbox_items").select("id,platform,item_type,sender_name,body,status,reply_status,received_at").order("received_at",{ascending:false}).limit(100);
 return <AppShell title="الرسائل والتعليقات">
  <div className="module-title"><div><h2>صندوق الوارد الموحد</h2><p>رسائل العملاء وتعليقاتهم من الحسابات المرتبطة.</p></div><span className="tag">{(data?.length||0).toLocaleString("en-US")} تفاعل</span></div>
  <div className="data-panel"><table className="data-table"><thead><tr><th>المنصة</th><th>النوع</th><th>المرسل</th><th>المحتوى</th><th>الحالة</th><th>التاريخ</th></tr></thead><tbody>
  {error ? <tr><td className="empty-row" colSpan={6}>تعذر تحميل صندوق الوارد: {error.message}</td></tr> : !data?.length ? <tr><td className="empty-row" colSpan={6}>لا توجد رسائل أو تعليقات حتى الآن.</td></tr> : data.map(i => <tr key={i.id}><td>{i.platform}</td><td><span className="tag">{i.item_type}</span></td><td>{i.sender_name||"غير معروف"}</td><td>{i.body.slice(0,110)}</td><td>{i.status} / {i.reply_status}</td><td>{new Date(i.received_at).toLocaleString("en-GB")}</td></tr>)}
  </tbody></table></div>
 </AppShell>;
}