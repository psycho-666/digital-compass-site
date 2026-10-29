import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SECRET_KEYS = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || SECRET_KEYS["default"] || "";
const db = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow, noarchive"
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers });
}
function safeText(v: unknown, max = 5000) {
  return String(v ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max);
}
function safeUrl(v: unknown) {
  try {
    const u = new URL(String(v ?? ""));
    return ["http:", "https:"].includes(u.protocol) ? u.href : "";
  } catch { return ""; }
}
function arr(v: unknown) { return Array.isArray(v) ? v : []; }

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "GET") return json({ error: "method_not_allowed" }, 405);
  if (!db) return json({ error: "preview_backend_not_configured" }, 503);
  const url = new URL(req.url);
  const slug = safeText(url.searchParams.get("slug"), 40);
  if (!/^p-[a-z0-9]{8,30}$/i.test(slug)) return json({ error: "preview_not_found" }, 404);

  const { data: site, error: siteError } = await db
    .from("prototype_sites")
    .select("id,company_id,opportunity_id,prototype_level,slug,generation_status,brand_gate_status,brand_profile_id")
    .eq("slug", slug)
    .in("generation_status", ["QA_PENDING", "PUBLISHED"])
    .in("brand_gate_status", ["READY", "PROPOSED_ONLY"])
    .maybeSingle();
  if (siteError || !site) return json({ error: "preview_not_found" }, 404);

  const [{ data: company }, { data: context }, { data: brand }, { data: assets }, { data: refs }] = await Promise.all([
    db.from("companies")
      .select("id,name,country,city,sector,website_url,instagram_url,facebook_url,linkedin_url,phone,whatsapp,general_email,contactable")
      .eq("id", site.company_id).maybeSingle(),
    db.from("prototype_context")
      .select("company_id,opportunity_id,validated_summary,services,address_text,contact_phone,contact_email,instagram_url,facebook_url,validation_status")
      .eq("company_id", site.company_id).eq("opportunity_id", site.opportunity_id)
      .eq("validation_status", "VALIDATED").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    site.brand_profile_id
      ? db.from("client_brand_profiles")
          .select("id,logo_url,primary_color,secondary_color,accent_color,background_color,text_color,heading_font_family,body_font_family,visual_style,tone_of_voice,audience_notes,design_direction,brand_status,identity_source,is_official_identity")
          .eq("id", site.brand_profile_id).maybeSingle()
      : Promise.resolve({ data: null }),
    db.from("client_brand_assets")
      .select("id,source_type,source_url,usable_for_prototype")
      .eq("company_id", site.company_id).eq("is_public", true).eq("is_verified", true).eq("usable_for_prototype", true).limit(8),
    db.from("design_reference_research")
      .select("reference_name,reference_url,reference_type,market,extracted_ideas,relevance_score")
      .eq("company_id", site.company_id).eq("opportunity_id", site.opportunity_id)
      .order("relevance_score", { ascending: false }).limit(8)
  ]);

  if (!company || company.country !== "Iraq" || company.contactable !== true || !context || !brand) {
    return json({ error: "preview_not_ready" }, 404);
  }

  const result = {
    prototype_level: safeText(site.prototype_level, 30),
    company: {
      id: Number(company.id),
      name: safeText(company.name, 200),
      country: safeText(company.country, 100),
      city: safeText(company.city, 150),
      sector: safeText(company.sector, 150),
      website_url: safeUrl(company.website_url),
      instagram_url: safeUrl(company.instagram_url),
      facebook_url: safeUrl(company.facebook_url),
      linkedin_url: safeUrl(company.linkedin_url),
      phone: safeText(company.phone, 80),
      whatsapp: safeText(company.whatsapp, 80),
      general_email: safeText(company.general_email, 180)
    },
    context: {
      validated_summary: safeText(context.validated_summary, 3000),
      services: arr(context.services).map((x) => safeText(x, 160)).filter(Boolean).slice(0, 12),
      address_text: safeText(context.address_text, 400),
      contact_phone: safeText(context.contact_phone, 80),
      contact_email: safeText(context.contact_email, 180),
      instagram_url: safeUrl(context.instagram_url),
      facebook_url: safeUrl(context.facebook_url)
    },
    client_brand: {
      logo_url: safeUrl(brand.logo_url),
      primary_color: safeText(brand.primary_color, 20),
      secondary_color: safeText(brand.secondary_color, 20),
      accent_color: safeText(brand.accent_color, 20),
      background_color: safeText(brand.background_color, 20),
      text_color: safeText(brand.text_color, 20),
      heading_font_family: safeText(brand.heading_font_family, 80),
      body_font_family: safeText(brand.body_font_family, 80),
      visual_style: safeText(brand.visual_style, 160),
      tone_of_voice: safeText(brand.tone_of_voice, 160),
      design_direction: safeText(brand.design_direction, 1000),
      brand_status: safeText(brand.brand_status, 40),
      identity_source: safeText(brand.identity_source, 40),
      is_official_identity: Boolean(brand.is_official_identity)
    },
    brand_assets: arr(assets).map((a: any) => ({
      source_type: safeText(a.source_type, 60),
      source_url: safeUrl(a.source_url),
      usable_for_prototype: a.usable_for_prototype === true
    })).filter((a: any) => a.source_url).slice(0, 8),
    design_references: arr(refs).map((r: any) => ({
      reference_name: safeText(r.reference_name, 200),
      reference_url: safeUrl(r.reference_url),
      reference_type: safeText(r.reference_type, 60),
      market: safeText(r.market, 100),
      extracted_ideas: r.extracted_ideas && typeof r.extracted_ideas === "object" ? r.extracted_ideas : {},
      relevance_score: Number(r.relevance_score || 0)
    })).filter((r: any) => r.reference_url).slice(0, 8)
  };
  return json(result);
});
