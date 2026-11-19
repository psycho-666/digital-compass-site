import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return json({ error: "Publisher is not configured" }, 500);
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const candidate = req.headers.get("x-cron-secret") ?? "";
  if (!candidate) return json({ error: "Unauthorized" }, 401);
  const { data: allowed, error: authError } = await admin.rpc("social_cron_secret_matches", { candidate });
  if (authError || allowed !== true) return json({ error: "Unauthorized" }, 401);
  const { data: posts, error } = await admin.rpc("claim_due_social_posts", { batch_size: 10 });
  if (error) return json({ error: error.message }, 500);
  const results = [];
  for (const post of posts ?? []) {
    try {
      const { data: page, error: pageError } = await admin.from("connected_pages").select("id,platform,external_page_id,is_active").eq("id", post.page_id).eq("user_id", post.user_id).maybeSingle();
      if (pageError) throw pageError;
      if (!page || !page.is_active) throw new Error("Connected page is inactive or missing");
      if (page.platform !== "facebook") throw new Error("Instagram publishing is not supported by this text-only publisher yet");
      if ((post.media_urls ?? []).length > 1) throw new Error("Multiple-photo publishing is not supported yet");
      const { data: credential, error: credentialError } = await admin.schema("private").from("page_credentials").select("access_token").eq("page_id", page.id).eq("user_id", post.user_id).maybeSingle();
      if (credentialError) throw credentialError;
      if (!credential?.access_token) throw new Error("Page token missing; reconnect Meta");
      let media = (post.media_urls ?? [])[0] as string | undefined;
      if ((post.media_urls ?? []).length > 1) throw new Error("Multiple-media publishing is not supported yet");
      if (media?.startsWith("storage://")) {
        const objectPath = media.slice("storage://".length);
        const { data: signed, error: signedError } = await admin.storage.from("social-media").createSignedUrl(objectPath, 1800);
        if (signedError || !signed?.signedUrl) throw new Error(signedError?.message ?? "Could not create media download URL");
        media = signed.signedUrl;
      }
      const isVideo = Boolean(media && /\\.(mp4|mov)$/i.test(media.split("?")[0]));
      const endpoint = !media ? page.external_page_id + "/feed" : isVideo ? page.external_page_id + "/videos" : page.external_page_id + "/photos";
      const form = new URLSearchParams({ access_token: credential.access_token });
      if (media) { form.set(isVideo ? "file_url" : "url", media); form.set(isVideo ? "description" : "caption", post.caption ?? ""); }
      else { if (!post.caption) throw new Error("Post caption is empty"); form.set("message", post.caption); }
      const response = await fetch("https://graph.facebook.com/v24.0/" + endpoint, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: form });
      const result = await response.json();
      if (!response.ok || result.error) throw new Error(result.error?.message ?? "Meta publishing failed");
      const { error: updateError } = await admin.from("scheduled_posts").update({ status: "published", published_at: new Date().toISOString(), platform_post_id: String(result.id ?? result.post_id ?? "") }).eq("id", post.id).eq("status", "publishing");
      if (updateError) throw updateError;
      results.push({ id: post.id, status: "published" });
    } catch (e) {
      const reason = e instanceof Error ? e.message : "Publishing failed";
      await admin.from("scheduled_posts").update({ status: "failed" }).eq("id", post.id).eq("status", "publishing");
      results.push({ id: post.id, status: "failed", reason });
    }
  }
  return json({ processed: results.length, results });
});