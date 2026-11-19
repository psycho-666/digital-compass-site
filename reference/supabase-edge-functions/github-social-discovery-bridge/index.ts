import { createRemoteJWKSet, jwtVerify } from "npm:jose@5.9.6";

const ISSUER = "https://token.actions.githubusercontent.com";
const AUDIENCE = "digital-compass-public-runner";
const REPOSITORY = "psycho-666/digital-compass-site";
const REF = "refs/heads/main";
const WORKFLOW = "psycho-666/digital-compass-site/.github/workflows/ops_worker.yml@refs/heads/main";
const JWKS = createRemoteJWKSet(new URL(`${ISSUER}/.well-known/jwks`));
const PROJECT_URL = Deno.env.get("SUPABASE_URL")!;
const SECRET_KEYS = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
const SECRET_KEY = SECRET_KEYS.default;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow, noarchive",
    },
  });
}

function now() {
  return new Date().toISOString();
}

function today() {
  return now().slice(0, 10);
}

function leaseUntil(minutes = 55) {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

function shortText(value: unknown, limit = 4000) {
  return String(value ?? "").slice(0, limit);
}

async function authenticate(req: Request) {
  const header = req.headers.get("authorization") || "";
  if (!header.startsWith("Bearer ")) throw new Error("missing_bearer");
  const { payload } = await jwtVerify(header.slice(7).trim(), JWKS, {
    issuer: ISSUER,
    audience: AUDIENCE,
    algorithms: ["RS256"],
  });
  if (payload.repository !== REPOSITORY || payload.ref !== REF || payload.workflow_ref !== WORKFLOW) {
    throw new Error("identity_not_allowed");
  }
  if (!["push", "schedule", "workflow_dispatch"].includes(String(payload.event_name || ""))) {
    throw new Error("event_not_allowed");
  }
  return payload;
}

async function rest(path: string, init: RequestInit = {}) {
  if (!SECRET_KEY) throw new Error("service_key_unavailable");
  const headers = new Headers(init.headers || {});
  headers.set("apikey", SECRET_KEY);
  headers.set("authorization", `Bearer ${SECRET_KEY}`);
  headers.set("content-type", "application/json");
  const response = await fetch(`${PROJECT_URL}/rest/v1/${path}`, { ...init, headers });
  const raw = await response.text();
  if (!response.ok) throw new Error(`rest_${response.status}_${raw.slice(0, 500)}`);
  return raw ? JSON.parse(raw) : null;
}

async function patch(table: string, filter: string, body: unknown, prefer = "return=minimal") {
  return await rest(`${table}?${filter}`, {
    method: "PATCH",
    headers: { Prefer: prefer },
    body: JSON.stringify(body),
  });
}

async function insert(table: string, body: unknown, prefer = "return=representation") {
  return await rest(table, {
    method: "POST",
    headers: { Prefer: prefer },
    body: JSON.stringify(body),
  });
}

async function rpc(name: string, body: unknown = {}) {
  return await rest(`rpc/${name}`, { method: "POST", body: JSON.stringify(body) });
}

async function claimCommand() {
  const rows = await rest(
    "automation_commands?status=eq.QUEUED&command_type=eq.SOCIAL_DISCOVERY" +
      "&select=id,attempt_count,max_attempts&order=requested_at.asc,id.asc&limit=1",
  ) || [];
  if (!rows.length) return null;
  const row = rows[0];
  const attempt = Number(row.attempt_count || 0) + 1;
  if (attempt > Number(row.max_attempts || 3)) {
    await patch("automation_commands", `id=eq.${row.id}&status=eq.QUEUED`, {
      status: "FAILED",
      completed_at: now(),
      error_message: "Maximum automatic attempts exceeded",
      lease_expires_at: null,
      last_heartbeat_at: now(),
    });
    return null;
  }
  const claimed = await patch(
    "automation_commands",
    `id=eq.${row.id}&status=eq.QUEUED`,
    {
      status: "RUNNING",
      started_at: now(),
      completed_at: null,
      error_message: null,
      attempt_count: attempt,
      lease_expires_at: leaseUntil(),
      last_heartbeat_at: now(),
    },
    "return=representation",
  ) || [];
  return claimed.length ? Number(row.id) : null;
}

async function finishCommand(commandId: number, status: "SUCCEEDED" | "FAILED", result: unknown, error: string | null) {
  if (!commandId) return;
  await patch("automation_commands", `id=eq.${commandId}&command_type=eq.SOCIAL_DISCOVERY&status=eq.RUNNING`, {
    status,
    completed_at: now(),
    result,
    error_message: error,
    lease_expires_at: null,
    last_heartbeat_at: now(),
  });
}

async function claimRequest() {
  const rows = await rest(
    "social_research_requests?status=eq.PENDING&request_type=eq.IRAQ_AD_DISCOVERY" +
      "&select=id,priority,payload,requested_at&order=requested_at.asc,id.asc&limit=1",
  ) || [];
  if (!rows.length) return null;
  const row = rows[0];
  const claimed = await patch(
    "social_research_requests",
    `id=eq.${row.id}&status=eq.PENDING`,
    { status: "RUNNING", started_at: now(), completed_at: null, error_message: null },
    "return=representation",
  ) || [];
  return claimed.length ? row : null;
}

async function claimDiscovery() {
  const commandId = await claimCommand();
  if (!commandId) return { ok: true, action: "claim_social_discovery", task: null, command_id: null };

  const request = await claimRequest();
  const queries = await rest(
    "social_discovery_queries?country=eq.Iraq&source=eq.META_AD_LIBRARY&enabled=eq.true" +
      "&select=id,query_text,query_type,priority,last_used_at,run_count,hit_count" +
      "&order=last_used_at.asc.nullsfirst,priority.desc,id.asc&limit=4",
  ) || [];

  if (!queries.length) {
    const message = "No enabled Meta Ad Library discovery queries.";
    if (request) {
      await patch("social_research_requests", `id=eq.${request.id}`, {
        status: "FAILED",
        completed_at: now(),
        error_message: message,
      });
    }
    await finishCommand(commandId, "FAILED", { processed: 0, worker: "OIDC_PUBLIC_SOCIAL_DISCOVERY_V1" }, message);
    return { ok: false, action: "claim_social_discovery", task: null, command_id: null, error: message };
  }

  const runRows = await insert("social_research_runs", {
    run_date: today(),
    country: "Iraq",
    run_type: request ? "REQUEST_PROCESSING" : "DAILY_AD_DISCOVERY",
    source: "META_AD_LIBRARY",
    status: "RUNNING",
    started_at: now(),
    queries_used: [],
  }) || [];
  const runId = Number(runRows[0]?.id || 0);
  if (!runId) throw new Error("social_discovery_run_not_created");

  return {
    ok: true,
    action: "claim_social_discovery",
    command_id: commandId,
    task: {
      command_id: commandId,
      run_id: runId,
      request_id: request ? Number(request.id) : null,
      queries,
      max_pages: 120,
      max_ads_per_page: 10,
    },
  };
}

function sanitizeResult(body: any) {
  const rawResults = Array.isArray(body.results) ? body.results.slice(0, 120) : [];
  const results = rawResults.map((item: any) => ({
    page_id: shortText(item.page_id, 80).replace(/\D/g, ""),
    page_name: shortText(item.page_name, 300) || null,
    query: shortText(item.query, 300) || null,
    query_id: Number(item.query_id) || null,
    profile_url: /^https?:\/\//i.test(String(item.profile_url || "")) ? shortText(item.profile_url, 1800) : null,
    ad_library_url: /^https?:\/\//i.test(String(item.ad_library_url || "")) ? shortText(item.ad_library_url, 1800) : null,
    landing_url: /^https?:\/\//i.test(String(item.landing_url || "")) ? shortText(item.landing_url, 1800) : null,
    phone: shortText(item.phone, 80) || null,
    whatsapp: /^https?:\/\//i.test(String(item.whatsapp || "")) ? shortText(item.whatsapp, 1800) : null,
    evidence_source: shortText(item.evidence_source, 80) || "PUBLIC_META_AD_LIBRARY",
    ads: (Array.isArray(item.ads) ? item.ads : []).slice(0, 10).map((ad: any) => ({
      external_ad_id: shortText(ad.external_ad_id, 80).replace(/\D/g, ""),
      creative_text: shortText(ad.creative_text, 3000) || null,
      call_to_action: shortText(ad.call_to_action, 250) || null,
      landing_url: /^https?:\/\//i.test(String(ad.landing_url || "")) ? shortText(ad.landing_url, 1800) : null,
      phone: shortText(ad.phone, 80) || null,
      whatsapp: /^https?:\/\//i.test(String(ad.whatsapp || "")) ? shortText(ad.whatsapp, 1800) : null,
    })).filter((ad: any) => ad.external_ad_id),
  })).filter((item: any) => /^\d{5,}$/.test(item.page_id));

  const queryStats = (Array.isArray(body.query_stats) ? body.query_stats : []).slice(0, 12).map((item: any) => ({
    query_id: Number(item.query_id) || null,
    query: shortText(item.query, 300),
    hits: Math.max(0, Math.min(500, Number(item.hits) || 0)),
    meta_responses: Math.max(0, Math.min(5000, Number(item.meta_responses) || 0)),
    candidate_responses: Math.max(0, Math.min(5000, Number(item.candidate_responses) || 0)),
    title: shortText(item.title, 300),
  })).filter((item: any) => item.query_id);

  const blockers = (Array.isArray(body.blockers) ? body.blockers : []).slice(0, 20).map((item: unknown) => shortText(item, 500));
  if (JSON.stringify({ results, queryStats, blockers }).length > 900_000) throw new Error("result_payload_too_large");
  return { results, queryStats, blockers };
}

async function completeDiscovery(body: any) {
  const commandId = Number(body.command_id);
  const runId = Number(body.run_id);
  const requestId = body.request_id ? Number(body.request_id) : null;
  if (!commandId || !runId) throw new Error("missing_completion_ids");
  const { results, queryStats, blockers } = sanitizeResult(body);
  const saved = await rpc("persist_social_discovery_results", {
    p_command_id: commandId,
    p_run_id: runId,
    p_request_id: requestId,
    p_results: results,
    p_query_stats: queryStats,
    p_blockers: blockers,
  });
  return { ok: true, action: "complete_social_discovery", result: saved };
}

async function failDiscovery(body: any) {
  const commandId = Number(body.command_id);
  const runId = Number(body.run_id);
  const requestId = body.request_id ? Number(body.request_id) : null;
  const message = shortText(body.error || "Public Social Discovery worker failed.", 4000);
  if (runId) {
    await patch("social_research_runs", `id=eq.${runId}&status=eq.RUNNING`, {
      status: "FAILED",
      completed_at: now(),
      notes: message,
    });
  }
  if (requestId) {
    await patch("social_research_requests", `id=eq.${requestId}&status=eq.RUNNING`, {
      status: "FAILED",
      completed_at: now(),
      error_message: message,
    });
  }
  if (commandId) {
    await finishCommand(commandId, "FAILED", { worker: "OIDC_PUBLIC_SOCIAL_DISCOVERY_V1" }, message);
  }
  return { ok: true, action: "fail_social_discovery" };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const identity = await authenticate(req);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");
    if (action === "probe") return json({ ok: true, repository: identity.repository, run_id: identity.run_id });
    if (action === "claim_social_discovery") return json(await claimDiscovery());
    if (action === "complete_social_discovery") return json(await completeDiscovery(body));
    if (action === "fail_social_discovery") return json(await failDiscovery(body));
    return json({ error: "action_not_supported" }, 400);
  } catch (error) {
    console.error("github-social-discovery-bridge failed", error);
    return json({ error: "unauthorized_or_invalid" }, 401);
  }
});
