import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const APP_ID = "1460593969264285";
const GRAPH = "v24.0";
const SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_metadata",
  "pages_manage_posts",
  "pages_manage_engagement",
  "pages_messaging",
  "instagram_basic",
  "instagram_manage_comments",
  "instagram_manage_messages",
  "instagram_content_publish"
].join(",");

const FRONTEND_ORIGIN = "https://digital-compass-social.pages.dev";
function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const allowed = origin === FRONTEND_ORIGIN ||
    /^https:\/\/[a-z0-9-]+\.digital-compass-social\.pages\.dev$/.test(origin);
  return {
    "Access-Control-Allow-Origin": allowed ? origin : FRONTEND_ORIGIN,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin"
  };
}

function b64url(input: Uint8Array): string {
  let binary = "";
  for (const byte of input) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
function unb64url(input: string): Uint8Array {
  const normalized = input.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}
async function signState(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload))));
}
async function verifyState(state: string, secret: string): Promise<{ user_id: string; exp: number } | null> {
  const [payload, signature] = state.split(".");
  if (!payload || !signature) return null;
  const expected = await signState(payload, secret);
  if (expected.length !== signature.length) return null;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  if (mismatch !== 0) return null;
  try {
    const data = JSON.parse(new TextDecoder().decode(unb64url(payload)));
    if (!data.user_id || data.exp < Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch { return null; }
}
function json(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders(req), "content-type": "application/json" } });
}
async function graphGet(path: string, params: Record<string, string>) {
  const url = new URL("https://graph.facebook.com/" + GRAPH + "/" + path.replace(/^\/+/, ""));
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok || data.error) throw new Error(data.error?.message ?? "Meta API request failed");
  return data;
}
async function graphPost(path: string, params: Record<string, string>) {
  const url = new URL("https://graph.facebook.com/" + GRAPH + "/" + path.replace(/^\/+/, ""));
  const body = new URLSearchParams(params);
  const response = await fetch(url, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body });
  const data = await response.json();
  if (!response.ok || data.error) throw new Error(data.error?.message ?? "Meta API request failed");
  return data;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  const appSecret = Deno.env.get("META_APP_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const frontendUrl = FRONTEND_ORIGIN;
  const url = new URL(req.url);
  const isCallback = req.method === "GET" && url.searchParams.get("action") === "callback";
  const missingConfig = [
    ["META_APP_SECRET", appSecret],
    ["SUPABASE_URL", supabaseUrl],
    ...(isCallback ? [["SUPABASE_SERVICE_ROLE_KEY", serviceKey]] : [])
  ].filter((item) => !item[1]).map((item) => item[0]);
  if (missingConfig.length) return json(req, { error: "Missing server configuration", missing: missingConfig }, 500);

  const redirectUri = supabaseUrl + "/functions/v1/social-oauth?action=callback";

  try {
    if (isCallback) {
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state") ?? "";
      const stateData = await verifyState(state, appSecret);
      if (!code || !stateData) return Response.redirect(frontendUrl + "/?meta=error&reason=invalid_state", 302);

      // The service-role client is only needed after Meta returns the OAuth callback.
      // Do not initialize it during the initial browser request.
      const admin = createClient(supabaseUrl, serviceKey!, { auth: { persistSession: false, autoRefreshToken: false } });

      const shortToken = await graphGet("oauth/access_token", {
        client_id: APP_ID, client_secret: appSecret, redirect_uri: redirectUri, code
      });
      const longToken = await graphGet("oauth/access_token", {
        grant_type: "fb_exchange_token", client_id: APP_ID, client_secret: appSecret, fb_exchange_token: shortToken.access_token
      });
      const userToken = longToken.access_token ?? shortToken.access_token;
      const expiresIn = Number(longToken.expires_in ?? shortToken.expires_in ?? 0);
      const accountData = await graphGet("me/accounts", {
        fields: "id,name,access_token,picture,instagram_business_account{id,username}",
        access_token: userToken
      });
      const pages = Array.isArray(accountData.data) ? accountData.data : [];
      let saved = 0;
      let webhookFailures = 0;
      for (const page of pages) {
        const pageToken = page.access_token;
        if (!page.id || !pageToken) continue;
        const { data: pageRow, error: pageError } = await admin.from("connected_pages").upsert({
          user_id: stateData.user_id, platform: "facebook", external_page_id: String(page.id),
          page_name: page.name ?? "Facebook Page", page_picture_url: page.picture?.data?.url ?? null, is_active: true
        }, { onConflict: "user_id,platform,external_page_id" }).select("id").single();
        if (pageError) throw pageError;
        const tokenExpiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;
        const { error: credentialError } = await admin.schema("private").from("page_credentials").upsert({
          page_id: pageRow.id, user_id: stateData.user_id, access_token: pageToken, token_expires_at: tokenExpiresAt, updated_at: new Date().toISOString()
        });
        if (credentialError) throw credentialError;
        try {
          await graphPost(page.id + "/subscribed_apps", { subscribed_fields: "feed,messages,messaging_postbacks", access_token: pageToken });
        } catch (error) {
          webhookFailures++;
          console.error("Page webhook subscription failed for", page.id, error);
        }
        saved++;
        const ig = page.instagram_business_account;
        if (ig?.id) {
          const { data: igRow, error: igError } = await admin.from("connected_pages").upsert({
            user_id: stateData.user_id, platform: "instagram", external_page_id: String(ig.id),
            page_name: ig.username ?? page.name ?? "Instagram account", page_picture_url: null, is_active: true
          }, { onConflict: "user_id,platform,external_page_id" }).select("id").single();
          if (igError) throw igError;
          const { error: igCredentialError } = await admin.schema("private").from("page_credentials").upsert({
            page_id: igRow.id, user_id: stateData.user_id, access_token: pageToken, token_expires_at: tokenExpiresAt, updated_at: new Date().toISOString()
          });
          if (igCredentialError) throw igCredentialError;
          saved++;
        }
      }
      const resultUrl = new URL(frontendUrl + "/");
      resultUrl.searchParams.set("meta", "connected");
      resultUrl.searchParams.set("pages", String(saved));
      resultUrl.searchParams.set("webhook_failures", String(webhookFailures));
      return Response.redirect(resultUrl.toString(), 302);
    }

    if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json(req, { error: "Authentication required" }, 401);
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } }, auth: { persistSession: false, autoRefreshToken: false }
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json(req, { error: "Invalid session" }, 401);

    const body = await req.json().catch(() => ({}));
    if (body.action !== "start") return json(req, { error: "Unsupported action" }, 400);
    const statePayload = b64url(new TextEncoder().encode(JSON.stringify({
      user_id: userData.user.id, exp: Math.floor(Date.now() / 1000) + 600, nonce: crypto.randomUUID()
    })));
    const state = statePayload + "." + await signState(statePayload, appSecret);
    const oauthUrl = new URL("https://www.facebook.com/" + GRAPH + "/dialog/oauth");
    oauthUrl.searchParams.set("client_id", APP_ID);
    oauthUrl.searchParams.set("redirect_uri", redirectUri);
    oauthUrl.searchParams.set("state", state);
    oauthUrl.searchParams.set("response_type", "code");
    oauthUrl.searchParams.set("scope", SCOPES);
    return json(req, { url: oauthUrl.toString() });
  } catch (error) {
    console.error("social-oauth error", error);
    return json(req, { error: error instanceof Error ? error.message : "OAuth failed" }, 500);
  }
});