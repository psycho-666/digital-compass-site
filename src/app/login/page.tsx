"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [error,setError] = useState("");
  const [loading,setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.replace("/"); router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تسجيل الدخول.");
    } finally { setLoading(false); }
  }

  return <main className="login-screen"><section className="login-card">
    <div className="login-brand"><span className="brand-mark">DC</span><div><b>Digital Compass</b><small>البوصلة الرقمية</small></div></div>
    <div className="eyebrow">SOCIAL MEDIA WORKSPACE</div><h1>تسجيل الدخول</h1><p>سجّل الدخول للوصول إلى مساحة إدارة الأعمال.</p>
    <form onSubmit={submit} className="login-form"><label>البريد الإلكتروني<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="username" placeholder="name@example.com"/></label><label>كلمة المرور<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password" placeholder="••••••••"/></label>
    {error&&<div className="form-error">{error}</div>}<button className="primary-button full" disabled={loading}>{loading?"جارٍ تسجيل الدخول...":"دخول إلى المنصة"}</button></form>
    <small className="login-foot">وصول مخصص لفريق Digital Compass</small>
  </section></main>;
}