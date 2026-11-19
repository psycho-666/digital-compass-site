import Link from "next/link";
import { Activity, BarChart3, CalendarDays, ClipboardList, LayoutDashboard, MessageCircle, Settings2, Users, UserRoundSearch, WandSparkles } from "lucide-react";

const links = [
  { href: "/", label: "الرئيسية", icon: LayoutDashboard },
  { href: "/clients", label: "العملاء", icon: Users },
  { href: "/leads", label: "العملاء المحتملون", icon: UserRoundSearch },
  { href: "/inbox", label: "الرسائل والتعليقات", icon: MessageCircle },
  { href: "/content", label: "إدارة المحتوى", icon: CalendarDays },
  { href: "/reports", label: "التقارير", icon: BarChart3 },
  { href: "/automations", label: "الأتمتة", icon: WandSparkles },
  { href: "/settings", label: "الإعدادات", icon: Settings2 }
];

export function AppShell({ children, title = "لوحة الإدارة" }: { children: React.ReactNode; title?: string }) {
  return <div className="app-shell">
    <aside className="sidebar">
      <Link href="/" className="brand"><span className="brand-mark">DC</span><span><b>Digital Compass</b><small>البوصلة الرقمية</small></span></Link>
      <div className="sidebar-label">مساحة العمل</div>
      <nav>{links.map(({href,label,icon:Icon}) => <Link className="nav-link" href={href} key={href}><Icon size={18}/><span>{label}</span></Link>)}</nav>
      <div className="sidebar-bottom"><Activity size={16}/><span>Social Edition</span><span className="status-dot"/></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div><span className="eyebrow">DIGITAL COMPASS / SOCIAL</span><h1>{title}</h1></div><div className="topbar-right"><span className="online-pill"><i/> النظام جاهز</span><form action="/auth/signout" method="post"><button className="ghost-button" type="submit">تسجيل الخروج</button></form></div></header>
      <div className="page-content">{children}</div>
    </main>
  </div>;
}