"use client";
import {useState,type FormEvent} from "react";
import {useRouter} from "next/navigation";
import {createClient} from "@/lib/supabase/client";
import {useLocale} from "@/components/locale-provider";
export default function UpdatePasswordPage(){
 const router=useRouter(),{locale}=useLocale(),ar=locale==="ar";
 const [password,setPassword]=useState(""),[confirm,setConfirm]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setMessage("");if(password.length<8){setMessage(ar?"كلمة المرور يجب أن تكون 8 أحرف على الأقل.":"Password must be at least 8 characters.");return;}if(password!==confirm){setMessage(ar?"كلمتا المرور غير متطابقتين.":"Passwords do not match.");return;}setBusy(true);try{const {error}=await createClient().auth.updateUser({password});if(error)throw error;router.replace("/editor");router.refresh();}catch(err){setMessage(err instanceof Error?err.message:(ar?"تعذر تحديث كلمة المرور.":"Could not update password."));}finally{setBusy(false);}}
 return <main className="authshell"><form className="authcard" onSubmit={submit}><span className="auth-kicker">DIGITAL COMPASS</span><h1>{ar?"تعيين كلمة مرور جديدة":"Set a new password"}</h1><label>{ar?"كلمة المرور الجديدة":"New password"}</label><input type="password" minLength={8} required value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password"/><label>{ar?"تأكيد كلمة المرور":"Confirm password"}</label><input type="password" minLength={8} required value={confirm} onChange={e=>setConfirm(e.target.value)} autoComplete="new-password"/><button className="auth-submit" disabled={busy}>{busy?(ar?"جارٍ الحفظ…":"Saving…"):(ar?"حفظ كلمة المرور":"Save password")}</button>{message&&<p role="status" className="auth-message">{message}</p>}</form></main>;
}
