import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const GRAPH = "v24.0";
const FRONTEND_ORIGIN = Deno.env.get("FRONTEND_URL") ?? "http://127.0.0.1:5173";
const corsHeaders = {
  "Access-Control-Allow-Origin": FRONTEND_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "content-type": "application/json" } });
}
async function graphPost(path: string, token: string, body: Record<string, unknown>) {
  const response = await fetch("https://graph.facebook.com/" + GRAPH + "/" + path.replace(/^\/+/, "") + "?access_token=" + encodeURIComponent(token), {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok || data.error) throw new Error(data.error?.message ?? "Meta API request failed");
  return data;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) return json({ error: "Server configuration is incomplete" }, 500);
  const authorization = req.headers.get("Authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return json({ error: "Authentication required" }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) return json({ error: "Invalid session" }, 401);
  const userId = authData.user.id;
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  try {
    const body = await req.json();
    if (body.action === "send_message") {
      const conversationId = String(body.conversation_id ?? "");
      const message = String(body.message ?? "").trim();
      if (!conversationId || !message || message.length > 2000) return json({ error: "A valid conversation and message are required" }, 400);
      const { data: conversation, error: conversationError } = await admin.from("conversations").select("id,user_id,page_id,platform_conversation_id").eq("id", conversationId).eq("user_id", userId).maybeSingle();
      if (conversationError) throw conversationError;
      if (!conversation) return json({ error: "Conversation not found" }, 404);
      const { data: credential, error: credentialError } = await admin.schema("private").from("page_credentials").select("access_token").eq("page_id", conversation.page_id).eq("user_id", userId).maybeSingle();
      if (credentialError) throw credentialError;
      if (!credential?.access_token) return json({ error: "The page token is missing. Reconnect the Meta account." }, 409);
      const result = await graphPost("me/messages", credential.access_token, {
        recipient: { id: conversation.platform_conversation_id }, message: { text: message }, messaging_type: "RESPONSE"
      });
      const externalId = String(result.message_id ?? "");
      const { error: insertError } = await admin.from("messages").insert({
        user_id: userId, conversation_id: conversation.id, external_message_id: externalId || null,
        direction: "outbound", body: message, sent_at: new Date().toISOString(), delivery_status: "sent"
      });
      if (insertError) throw insertError;
      await admin.from("conversations").update({ last_message: message, last_message_at: new Date().toISOString(), unread_count: 0 }).eq("id", conversation.id);
      return json({ sent: true, message_id: externalId });
    }

    if (body.action === "reply_comment") {
      const commentId = String(body.comment_id ?? "");
      const reply = String(body.reply ?? "").trim();
      if (!commentId || !reply || reply.length > 2000) return json({ error: "A valid comment and reply are required" }, 400);
      const { data: comment, error: commentError } = await admin.from("comments").select("id,user_id,page_id,external_comment_id").eq("id", commentId).eq("user_id", userId).maybeSingle();
      if (commentError) throw commentError;
      if (!comment) return json({ error: "Comment not found" }, 404);
      const { data: credential, error: credentialError } = await admin.schema("private").from("page_credentials").select("access_token").eq("page_id", comment.page_id).eq("user_id", userId).maybeSingle();
      if (credentialError) throw credentialError;
      if (!credential?.access_token) return json({ error: "The page token is missing. Reconnect the Meta account." }, 409);
      await graphPost(comment.external_comment_id + "/comments", credential.access_token, { message: reply });
      const { error: updateError } = await admin.from("comments").update({
        reply_text: reply, replied_at: new Date().toISOString(), status: "replied"
      }).eq("id", comment.id).eq("user_id", userId);
      if (updateError) throw updateError;
      return json({ replied: true });
    }

    return json({ error: "Unsupported action" }, 400);
  } catch (error) {
    console.error("social-management-api error", error);
    return json({ error: error instanceof Error ? error.message : "Request failed" }, 500);
  }
});