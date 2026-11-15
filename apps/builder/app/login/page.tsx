"use client";
import {useState,type FormEvent} from "react";
import {useRouter} from "next/navigation";
import Link from "next/link";
import {createClient} from "@/lib/supabase/client";
import {LanguageSwitch,useLocale} from "@/components/locale-provider";

type Mode="login"|"signup"|"magic"|"phone"|"admin";
const ADMIN_EMAIL="admin@digitalcompass.local";

export default function LoginPage(){
 const router=useRouter(),{locale}=useLocale(),ar=locale==="ar";
 const [mode,setMode]=useState<Mode>("login"),[email,setEmail]=useState(""),[phone,setPhone]=useState(""),[otp,setOtp]=useState(""),[phoneSent,setPhoneSent]=useState(false),[username,setUsername]=useState("admin"),[password,setPassword]=useState(""),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[success,setSuccess]=useState(false);
 const t=(a:string,e:string)=>ar?a:e;
 function changeMode(next:Mode){setMode(next);setMessage("");setSuccess(false);setPhoneSent(false);setOtp("");}
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();setBusy(true);setMessage("");setSuccess(false);
  try{
   const supabase=createClient();
   if(mode==="magic"){
    const {error}=await supabase.auth.signInWithOtp({email:email.trim(),options:{shouldCreateUser:false,emailRedirectTo:window.location.origin+"/auth/callback?next=/editor"}});
    if(error)throw error;
    setSuccess(true);setMessage(t("أرسلنا رابط الدخول إلى بريدك الإلكتروني. افحص الوارد والرسائل غير المرغوب بها.","A sign-in link has been sent. Check your inbox and spam folder."));return;
   }
   if(mode==="phone"){
    if(!phoneSent){
     const {error}=await supabase.auth.signInWithOtp({phone:phone.trim(),options:{channel:"sms"}});
     if(error)throw error;
     setPhoneSent(true);setSuccess(true);setMessage(t("أرسلنا رمز التحقق إلى هاتفك. أدخل الرمز لإكمال الدخول.","A verification code was sent to your phone. Enter it to finish signing in."));return;
    }
    const {error}=await supabase.auth.verifyOtp({phone:phone.trim(),token:otp.trim(),type:"sms"});
    if(error)throw error;
   }else if(mode==="admin"){
    if(username.trim().toLowerCase()!=="admin")throw new Error(t("اسم المدير هو admin.","Administrator username must be admin."));
    const {error}=await supabase.auth.signInWithPassword({email:ADMIN_EMAIL,password});
    if(error)throw new Error(t("بيانات دخول المدير غير صحيحة أو الحساب غير مهيأ.","Administrator credentials are incorrect or the account is not configured."));
    const {data:{user},error:userError}=await supabase.auth.getUser();
    if(userError||user?.app_metadata?.role!=="admin"){
     await supabase.auth.signOut();
     throw new Error(t("هذا الحساب غير مخوّل كمدير. يجب تعيين role=admin للحساب من إعدادات Supabase Auth.","This account is not authorized as an administrator. Set role=admin in Supabase Auth app metadata."));
    }
   }else if(mode==="signup"){
    const {data,error}=await supabase.auth.signUp({email:email.trim(),password,options:{emailRedirectTo:window.location.origin+"/auth/callback?next=/editor"}});
    if(error)throw error;
    if(!data.session){setSuccess(true);setMessage(t("تم إنشاء الحساب. أكّد بريدك الإلكتروني من الرسالة التي وصلتك، ثم سجّل الدخول.","Account created. Confirm your email using the message we sent, then sign in."));return;}
   }else{
    const {error}=await supabase.auth.signInWithPassword({email:email.trim(),password});
    if(error)throw error;
   }
   router.replace("/editor");router.refresh();
  }catch(err){setMessage(err instanceof Error?err.message:t("تعذر إكمال العملية. حاول مرة أخرى.","Unable to complete the request. Please try again."));}
  finally{setBusy(false);}
 }
 async function google(){
  setBusy(true);setMessage("");
  try{const supabase=createClient();const {error}=await supabase.auth.signInWithOAuth({provider:"google",options:{redirectTo:window.location.origin+"/auth/callback?next=/editor"}});if(error)throw error;}
  catch(err){setMessage(err instanceof Error?err.message:t("تعذر بدء تسجيل Google.","Could not start Google sign-in."));setBusy(false);}
 }
 async function resetPassword(){
  if(!email.trim()){setMessage(t("أدخل بريدك الإلكتروني أولاً.","Enter your email address first."));return;}
  setBusy(true);setMessage("");
  try{const {error}=await createClient().auth.resetPasswordForEmail(email.trim(),{redirectTo:window.location.origin+"/auth/callback?next=/auth/update-password"});if(error)throw error;setSuccess(true);setMessage(t("إذا كان البريد مسجلاً، سيصلك رابط إعادة تعيين كلمة المرور.","If the email is registered, a password-reset link will arrive shortly."));}
  catch(err){setMessage(err instanceof Error?err.message:t("تعذر إرسال الرابط.","Could not send the link."));}
  finally{setBusy(false);}
 }
 const heading=mode==="signup"?t("إنشاء حساب جديد","Create account"):mode==="magic"?t("الدخول برابط البريد","Sign in with email link"):mode==="phone"?t("الدخول برقم الهاتف","Sign in with phone"):mode==="admin"?t("دخول المدير","Administrator sign in"):t("تسجيل الدخول","Sign in");
 return <main className="authshell"><form className="authcard" onSubmit={submit}>
  <div className="auth-top"><Link href="/" className="authbrand">◈ Digital Compass</Link><LanguageSwitch/></div>
  <div className="auth-intro"><span className="auth-kicker">{t("منصة إنشاء المواقع","WEBSITE BUILDER")}</span><h1>{heading}</h1><p>{t("أنشئ مواقع عملائك وأدرها من مساحة واحدة.","Create and manage your clients’ websites from one workspace.")}</p></div>
  <div className="auth-methods" role="group" aria-label={t("طرق الدخول","Sign-in methods")}>
   <button type="button" className={mode==="login"?"method active":"method"} onClick={()=>changeMode("login")}>{t("كلمة المرور","Password")}</button>
   <button type="button" className={mode==="magic"?"method active":"method"} onClick={()=>changeMode("magic")}>{t("رابط البريد","Email link")}</button>
   <button type="button" className={mode==="phone"?"method active":"method"} onClick={()=>changeMode("phone")}>{t("الهاتف","Phone")}</button>
   <button type="button" className={mode==="admin"?"method active":"method"} onClick={()=>changeMode("admin")}>{t("المدير","Admin")}</button>
  </div>
  {mode==="admin"?<><label htmlFor="admin-user">{t("اسم المستخدم","Username")}</label><input id="admin-user" value={username} onChange={e=>setUsername(e.target.value)} autoComplete="username" required/><label htmlFor="admin-password">{t("كلمة المرور","Password")}</label><input id="admin-password" type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required/></>:mode==="phone"?<><label htmlFor="auth-phone">{t("رقم الهاتف مع رمز الدولة","Phone number with country code")}</label><input id="auth-phone" type="tel" required placeholder="+9647XXXXXXXXX" value={phone} onChange={e=>setPhone(e.target.value)} autoComplete="tel"/>{phoneSent&&<><label htmlFor="auth-otp">{t("رمز التحقق","Verification code")}</label><input id="auth-otp" inputMode="numeric" autoComplete="one-time-code" required value={otp} onChange={e=>setOtp(e.target.value)} placeholder="123456"/></>}</>:<><label htmlFor="auth-email">{t("البريد الإلكتروني","Email address")}</label><input id="auth-email" type="email" required value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email"/>{mode!=="magic"&&<><label htmlFor="auth-password">{t("كلمة المرور","Password")}</label><input id="auth-password" type="password" required minLength={mode==="signup"?8:1} value={password} onChange={e=>setPassword(e.target.value)} autoComplete={mode==="signup"?"new-password":"current-password"}/></>}</>}
  <button className="auth-submit" disabled={busy}>{busy?t("يرجى الانتظار…","Please wait…"):mode==="signup"?t("إنشاء الحساب","Create account"):mode==="magic"?t("إرسال رابط الدخول","Send sign-in link"):mode==="phone"?(phoneSent?t("تأكيد الرمز والدخول","Verify code & sign in"):t("إرسال رمز التحقق","Send verification code")):t("دخول","Sign in")}</button>
  {mode==="login"&&<div className="auth-inline"><button type="button" className="text-action" onClick={resetPassword} disabled={busy}>{t("نسيت كلمة المرور؟","Forgot password?")}</button><button type="button" className="text-action" onClick={()=>changeMode("signup")}>{t("إنشاء حساب","Create account")}</button></div>}
  {mode==="signup"&&<button type="button" className="text-action centered" onClick={()=>changeMode("login")}>{t("لديك حساب؟ سجّل الدخول","Already have an account? Sign in")}</button>}
  {mode!=="admin"&&<><div className="auth-divider"><span>{t("أو تابع باستخدام","OR CONTINUE WITH")}</span></div><button type="button" className="google-button" onClick={google} disabled={busy}><span className="google-mark">G</span>{t("المتابعة باستخدام Google","Continue with Google")}</button></>}
  {message&&<p className={success?"auth-message success":"auth-message"} role="status">{message}</p>}
  {mode==="admin"&&<p className="auth-foot">{t("يتطلب حساب المدير صلاحية role=admin في بيانات الحساب داخل Supabase Auth.","The administrator account must have role=admin in Supabase Auth app metadata.")}</p>}
 </form></main>;
}
