import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = { "content-type": "application/json" };
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders });
}
function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function verifySignature(rawBody: string, signature: string | null, secret: string): Promise<boolean> {
  if (!signature?.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = toHex(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody))));
  const supplied = signature.slice(7).toLowerCase();
  if (digest.length !== supplied.length) return false;
  let mismatch = 0;
  for (let i = 0; i < digest.length; i++) mismatch |= digest.charCodeAt(i) ^ supplied.charCodeAt(i);
  return mismatch === 0;
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const verifyToken = Deno.env.get("META_WEBHOOK_VERIFY_TOKEN");
  const appSecret = Deno.env.get("META_APP_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && verifyToken && token === verifyToken && challenge) {
      return new Response(challenge, { status: 200, headers: { "content-type": "text/plain" } });
    }
    return new Response("Forbidden", { status: 403 });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!appSecret || !supabaseUrl || !serviceKey) return json({ error: "Webhook is not configured" }, 500);

  const rawBody = await req.text();
  const valid = await verifySignature(rawBody, req.headers.get("x-hub-signature-256"), appSecret);
  if (!valid) return json({ error: "Invalid webhook signature" }, 401);

  let payload: any;
  try { payload = JSON.parse(rawBody); } catch { return json({ error: "Invalid JSON" }, 400); }
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  try {
    for (const entry of payload.entry ?? []) {
      const externalPageId = String(entry.id ?? "");
      if (!externalPageId) continue;
      const { data: pageRows, error: pageError } = await admin.from("connected_pages").select("id,user_id,platform").eq("external_page_id", externalPageId).eq("is_active", true);
      if (pageError) throw pageError;
      for (const page of pageRows ?? []) {
        for (const change of entry.changes ?? []) {
          const value = change.value ?? {};
          const isComment = value.item === "comment" || change.field === "comments";
          if (!isComment || (value.verb && value.verb !== "add")) continue;
          const externalCommentId = String(value.comment_id ?? value.id ?? "");
          const body = String(value.message ?? value.text ?? "");
          if (!externalCommentId || !body) continue;
          const { error } = await admin.from("comments").upsert({
            user_id: page.user_id, page_id: page.id, external_comment_id: externalCommentId,
            post_external_id: value.post_id ? String(value.post_id) : null,
            author_name: value.from?.name ?? value.username ?? "Social user",
            body, commented_at: value.created_time ? new Date(Number(value.created_time) * 1000).toISOString() : new Date().toISOString(),
            status: "unanswered"
          }, { onConflict: "page_id,external_comment_id", ignoreDuplicates: true });
          if (error) throw error;
        }

        for (const event of entry.messaging ?? []) {
          if (event.message?.is_echo) continue;
          const senderId = String(event.sender?.id ?? "");
          const messageId = String(event.message?.mid ?? "");
          const messageBody = String(event.message?.text ?? "");
          if (!senderId || !messageId || !messageBody) continue;
          const { data: conversation, error: conversationError } = await admin.from("conversations").upsert({
            user_id: page.user_id, page_id: page.id, platform_conversation_id: senderId,
            participant_name: senderId, last_message: messageBody,
            last_message_at: event.timestamp ? new Date(Number(event.timestamp)).toISOString() : new Date().toISOString(),
            status: "open"
          }, { onConflict: "page_id,platform_conversation_id" }).select("id").single();
          if (conversationError) throw conversationError;
          const { error: messageError } = await admin.from("messages").upsert({
            user_id: page.user_id, conversation_id: conversation.id, external_message_id: messageId,
            direction: "inbound", body: messageBody,
            sent_at: event.timestamp ? new Date(Number(event.timestamp)).toISOString() : new Date().toISOString(),
            delivery_status: "received"
          }, { onConflict: "external_message_id", ignoreDuplicates: true });
          if (messageError) throw messageError;
          await admin.from("conversations").update({ unread_count: 1 }).eq("id", conversation.id);
        }
      }
    }
    return json({ received: true });
  } catch (error) {
    console.error("social-meta-webhook processing error", error);
    return json({ error: "Webhook processing failed" }, 500);
  }
});