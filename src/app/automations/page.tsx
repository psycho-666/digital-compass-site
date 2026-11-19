import { AppShell } from "@/components/app-shell";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
export default async function AutomationsPage() {
 if (!isSupabaseConfigured()) return <AppShell title="الأتمتة"><p className="muted-copy">أكمل إعداد اتصال قاعدة البيانات أولاً.</p></AppShell>;
 const supabase = await createClient();
 const {data,error} = await supabase.from("automation_rules").select("id,name,trigger_type,is_enabled,created_at").order("created_at",{ascending:false});
 return <AppShell title="الأتمتة"><div className="module-title"><div><h2>مركز الأتمتة</h2><p>قواعد العمل وسجل التشغيل.</p></div></div><div className="data-panel"><table className="data-table"><thead><tr><th>القاعدة</th><th>المحفز</th><th>الحالة</th></tr></thead><tbody>{error ? <tr><td className="empty-row" colSpan={3}>{error.message}</td></tr> : !data?.length ? <tr><td className="empty-row" colSpan={3}>لا توجد قواعد أتمتة بعد.</td></tr> : data.map(x => <tr key={x.id}><td>{x.name}</td><td>{x.trigger_type}</td><td><span className="tag">{x.is_enabled ? "مفعّلة" : "متوقفة"}</span></td></tr>)}</tbody></table></div></AppShell>;
}