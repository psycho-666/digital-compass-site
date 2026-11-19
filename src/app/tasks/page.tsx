import { AppShell } from "@/components/app-shell";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
export default async function TasksPage() {
 if (!isSupabaseConfigured()) return <AppShell title="المهام"><p className="muted-copy">أكمل إعداد اتصال قاعدة البيانات أولاً.</p></AppShell>;
 const supabase = await createClient();
 const {data,error} = await supabase.from("tasks").select("id,title,status,priority,due_at").order("due_at",{ascending:true}).limit(100);
 return <AppShell title="المهام"><div className="module-title"><div><h2>المهام والمتابعات</h2><p>قائمة الأعمال التي تحتاج إلى إجراء.</p></div></div><div className="data-panel"><table className="data-table"><thead><tr><th>المهمة</th><th>الأولوية</th><th>الحالة</th><th>تاريخ الاستحقاق</th></tr></thead><tbody>{error ? <tr><td className="empty-row" colSpan={4}>{error.message}</td></tr> : !data?.length ? <tr><td className="empty-row" colSpan={4}>لا توجد مهام حالياً.</td></tr> : data.map(t => <tr key={t.id}><td>{t.title}</td><td>{t.priority}</td><td>{t.status}</td><td>{t.due_at ? new Date(t.due_at).toLocaleString("en-GB") : "—"}</td></tr>)}</tbody></table></div></AppShell>;
}