import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { ArrowUpLeft, MessageCircle, Users, UserRoundSearch, CalendarCheck, CircleAlert, ClipboardList } from "lucide-react";

async function countRows(supabase: Awaited<ReturnType<typeof createClient>>, table: string) {
  const { count, error } = await supabase.from(table).select("id", { count: "exact", head: true });
  return error ? 0 : count ?? 0;
}

export default async function DashboardPage() {
  if (!isSupabaseConfigured()) return <main className="setup-screen"><div className="setup-card"><span className="brand-mark">DC</span><h1>Digital Compass</h1><p>أضف متغيرات Supabase في إعدادات بيئة التشغيل لإكمال التهيئة.</p><code>NEXT_PUBLIC_SUPABASE_URL</code><code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code></div></main>;
  const supabase = await createClient();
  const [clients, leads, inbox, posts, tasks] = await Promise.all([
    countRows(supabase,"clients"), countRows(supabase,"leads"), countRows(supabase,"inbox_items"),
    countRows(supabase,"content_posts"), countRows(supabase,"tasks")
  ]);
  const cards = [
    {label:"العملاء",value:clients,icon:Users,tone:"purple"},
    {label:"العملاء المحتملون",value:leads,icon:UserRoundSearch,tone:"blue"},
    {label:"الرسائل والتعليقات",value:inbox,icon:MessageCircle,tone:"orange"},
    {label:"منشورات المحتوى",value:posts,icon:CalendarCheck,tone:"green"}
  ];
  return <AppShell title="نظرة عامة">
    <section className="welcome-row"><div><div className="eyebrow">مساحة عملك الرقمية</div><h2>أهلاً بك في البوصلة الرقمية</h2><p>إدارة العملاء والحسابات والمحتوى والتواصل من مكان واحد.</p></div><Link href="/leads" className="primary-button">إضافة عميل محتمل <ArrowUpLeft size={17}/></Link></section>
    <section className="stats-grid">{cards.map(({label,value,icon:Icon,tone})=><article className="stat-card" key={label}><div className={"stat-icon "+tone}><Icon size={20}/></div><div className="stat-label">{label}</div><div className="stat-value">{value.toLocaleString("en-US")}</div><span className="stat-foot">البيانات الحالية</span></article>)}</section>
    <section className="dashboard-grid">
      <article className="panel"><div className="panel-heading"><div><h3>المهام القادمة</h3><p>متابعة الأعمال التي تحتاج إلى إجراء</p></div><Link href="/tasks">عرض الكل <ArrowUpLeft size={15}/></Link></div>
        {tasks===0?<div className="empty-state"><div className="empty-icon"><ClipboardList size={22}/></div><b>لا توجد مهام حالياً</b><span>ستظهر هنا المهام ومواعيد المتابعة.</span></div>:<div className="metric-line"><b>{tasks.toLocaleString("en-US")}</b><span>مهمة مسجلة</span></div>}
      </article>
      <article className="panel"><div className="panel-heading"><div><h3>حالة النظام</h3><p>الاتصالات والتكاملات الأساسية</p></div><span className="online-pill"><i/> متصل</span></div>
        <div className="integration-row"><span className="integration-logo">f</span><div><b>Facebook / Meta</b><small>يلزم إعادة ربط الصفحة بعد إعادة التهيئة</small></div><span className="warning-text"><CircleAlert size={15}/> غير مربوط</span></div>
        <div className="integration-row"><span className="integration-logo ai">AI</span><div><b>مساعد الذكاء الاصطناعي</b><small>يتم تفعيل مزود الذكاء الاصطناعي من الإعدادات</small></div><span className="muted">غير مهيأ</span></div>
      </article>
    </section>
    <section className="quick-grid"><Link href="/clients" className="quick-card"><Users/><b>إدارة العملاء</b><span>ملفات العملاء والخدمات</span></Link><Link href="/inbox" className="quick-card"><MessageCircle/><b>صندوق الوارد</b><span>الرسائل والتعليقات</span></Link><Link href="/content" className="quick-card"><CalendarCheck/><b>جدولة المحتوى</b><span>المسودات والمنشورات</span></Link></section>
  </AppShell>;
}