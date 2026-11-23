import { createClient } from "npm:@supabase/supabase-js@2";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
});
const clean = (v: unknown, max = 500) => String(v ?? "").replace(/[<>]/g, "").trim().slice(0, max);
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const authorization = req.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) return json({ error: "authentication_required" }, 401);
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anon) return json({ error: "supabase_environment_missing" }, 500);
  const sb = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
  try {
    const token = authorization.slice(7);
    const { data: authData, error: authError } = await sb.auth.getUser(token);
    if (authError || !authData.user) return json({ error: "invalid_session" }, 401);
    const body = await req.json();
    const prospectId = clean(body.prospect_id, 64);
    const language = "ar";
    if (!/^[0-9a-f-]{36}$/i.test(prospectId)) return json({ error: "invalid_prospect_id" }, 400);
    const { data: p, error: prospectError } = await sb.from("prospects").select("*")
      .eq("id", prospectId).eq("user_id", authData.user.id).maybeSingle();
    if (prospectError) throw prospectError;
    if (!p) return json({ error: "prospect_not_found" }, 404);

    const business = clean(p.business_name, 120) || (language === "ar" ? "نشاطكم" : "your business");
    const industry = clean(p.industry, 100);
    const location = clean(p.location, 100);
    const services = Array.isArray(p.recommended_services) ? p.recommended_services.slice(0, 4).map((x: unknown) => clean(x, 100)).filter(Boolean) : [];
    const weaknesses = Array.isArray(p.weaknesses) ? p.weaknesses.slice(0, 2).map((x: unknown) => clean(x, 140)).filter(Boolean) : [];
    const opportunities = Array.isArray(p.opportunities) ? p.opportunities.slice(0, 2).map((x: unknown) => clean(x, 140)).filter(Boolean) : [];
    const focus = services[0] || (language === "ar" ? "تحسين الحضور الرقمي" : "improving your digital presence");
    const observation = weaknesses[0] || opportunities[0] || (language === "ar" ? "تطوير المحتوى والتواصل مع الجمهور" : "strengthening content and audience engagement");
    const message = language === "ar"
      ? `مرحباً، فريق ${business} 🌟\nاطلعنا على حضوركم الرقمي في مجال ${industry || "نشاطكم"}${location ? " في " + location : ""}، وظهرت لنا فرصة عملية للعمل على ${observation}.\nنستطيع مساعدتكم من خلال ${focus}، بخطة تناسب طبيعة نشاطكم وأهدافكم.\nهل يناسبكم أن نرسل لكم تصوراً مختصراً لما يمكن تحسينه؟`
      : `Hello, ${business} team 🌟\nWe reviewed the public-facing digital presence of your ${industry || "business"}${location ? " in " + location : ""} and identified an opportunity around ${observation}.\nDigital Compass can help with ${focus}, with a plan tailored to your business goals.\nWould it be useful if we shared a short improvement outline?`;

    const contact = clean(p.contact_info, 300);
    const emailMatch = contact.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    const phoneMatch = contact.match(/(?:\+?964|0)\s?7[0-9\s-]{8,12}/);
    let channel = "manual";
    let status = "blocked";
    let reason = language === "ar" ? "لا توجد قناة إرسال آلية مرتبطة بهذا العميل حالياً." : "No automated sending channel is connected for this prospect.";
    let consentStatus = "unknown";
    if (emailMatch) {
      channel = "email";
      reason = language === "ar"
        ? "تم العثور على بريد إلكتروني، لكن مزود إرسال البريد غير مربوط. لم يتم إرسال شيء."
        : "An email address was found, but no email delivery provider is connected. Nothing was sent.";
    } else if (phoneMatch) {
      channel = "whatsapp";
      reason = language === "ar"
        ? "تم العثور على رقم هاتف، لكن WhatsApp Business Cloud API وموافقة المستلم غير متوفرين. رابط واتساب لا يُعد إرسالاً آلياً."
        : "A phone number was found, but WhatsApp Business Cloud API and recipient opt-in are not configured. A WhatsApp link is not automated delivery.";
    } else if (["facebook", "instagram"].includes(String(p.platform).toLowerCase())) {
      channel = String(p.platform).toLowerCase() === "instagram" ? "instagram" : "messenger";
      reason = language === "ar"
        ? "لا توجد محادثة واردة قائمة أو موافقة تواصل موثقة لهذا العميل. قيود Meta تمنع بدء رسالة تسويقية باردة."
        : "There is no existing inbound conversation or recorded opt-in for this prospect. Meta does not permit unsolicited cold marketing messages.";
    }

    const { data: outreach, error: insertError } = await sb.from("prospect_outreach").insert({
      user_id: authData.user.id, prospect_id: prospectId, channel, status, language, message,
      eligibility_reason: reason, consent_status: consentStatus,
      result: { blockers: [reason], has_email: Boolean(emailMatch), has_phone: Boolean(phoneMatch), generated_by: "prospect-outreach-generate" },
      generated_at: new Date().toISOString(), updated_at: new Date().toISOString()
    }).select("*").single();
    if (insertError) throw insertError;
    await sb.from("prospect_activities").insert({
      user_id: authData.user.id, prospect_id: prospectId, activity_type: "outreach_generated",
      details: language === "ar" ? "تم توليد مسودة تواصل مخصصة. حالة الإرسال: " + status + ". " + reason : "Personalized outreach draft generated. Delivery status: " + status + ". " + reason
    });
    return json({ ok: true, outreach });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "outreach_generation_failed" }, 400);
  }
});