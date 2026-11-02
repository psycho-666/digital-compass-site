"use client";

import {useState} from "react";

type FormKind="contact"|"reservation";
type Props={siteSlug:string;pageSlug:string;locale:"ar"|"en";formKind:FormKind;description:string};

export function BuilderPublicForm({siteSlug,pageSlug,locale,formKind,description}:Props){
  const ar=locale==="ar";
  const [submitting,setSubmitting]=useState(false);
  const [status,setStatus]=useState("");
  const [startedAt]=useState(()=>Date.now());
  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(submitting)return;
    const form=event.currentTarget;
    const values=new FormData(form);
    setSubmitting(true);setStatus("");
    try{
      const response=await fetch("/api/builder/forms",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({
        siteSlug,pageSlug,locale,formKind,
        name:String(values.get("name")??""),
        email:String(values.get("email")??""),
        phone:String(values.get("phone")??""),
        message:String(values.get("message")??""),
        preferredDate:String(values.get("preferredDate")??""),
        preferredTime:String(values.get("preferredTime")??""),
        partySize:Number(values.get("partySize")??0)||null,
        website:String(values.get("website")??""),
        elapsedMs:Date.now()-startedAt
      })});
      const result=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(result.error??(ar?"تعذر إرسال النموذج. حاول لاحقاً.":"Could not submit the form. Please try again."));
      form.reset();
      setStatus(ar?"وصلتنا رسالتك بنجاح. سنتواصل معك قريباً.":"Your message has been received. We will be in touch soon.");
    }catch(error){setStatus(error instanceof Error?error.message:(ar?"حدث خطأ أثناء الإرسال.":"Something went wrong while submitting."));}
    finally{setSubmitting(false);}
  }
  return <form className="published-form" dir={ar?"rtl":"ltr"} onSubmit={submit}>
    <p>{description}</p>
    <label>{ar?"الاسم":"Name"}<input name="name" required maxLength={120} autoComplete="name"/></label>
    <label>{ar?"البريد الإلكتروني":"Email"}<input name="email" type="email" maxLength={254} autoComplete="email"/></label>
    <label>{ar?"رقم الهاتف":"Phone"}<input name="phone" type="tel" maxLength={40} autoComplete="tel"/></label>
    {formKind==="reservation"&&<div className="published-form-row">
      <label>{ar?"تاريخ الحجز":"Preferred date"}<input name="preferredDate" type="date" required/></label>
      <label>{ar?"الوقت":"Preferred time"}<input name="preferredTime" type="time" required/></label>
      <label>{ar?"عدد الأشخاص":"Party size"}<input name="partySize" type="number" min={1} max={30} defaultValue={2} required/></label>
    </div>}
    <label>{ar?(formKind==="reservation"?"تفاصيل إضافية":"رسالتك"):(formKind==="reservation"?"Additional details":"Your message")}<textarea name="message" rows={4} required maxLength={4000}/></label>
    <label className="published-form-honeypot" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off"/></label>
    <button type="submit" disabled={submitting}>{submitting?(ar?"جارٍ الإرسال…":"Sending…"):(formKind==="reservation"?(ar?"إرسال طلب الحجز":"Send reservation request"):(ar?"إرسال الرسالة":"Send message"))}</button>
    {status&&<p className="published-form-status" role="status" aria-live="polite">{status}</p>}
    <small>{ar?"يُرجى إدخال البريد الإلكتروني أو رقم الهاتف على الأقل. طلب الحجز لا يُعد مؤكداً حتى نتواصل معك.":"Please provide at least an email address or phone number. A reservation is not confirmed until we contact you."}</small>
  </form>;
}
