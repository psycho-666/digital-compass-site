import fs from "node:fs";
import { chromium } from "playwright";

const BRIDGE = "https://xnoalyxxrjyovivdeojo.supabase.co/functions/v1/github-social-discovery-bridge";
const TOKEN = process.env.OIDC_TOKEN;
const TASK_FILE = process.env.SOCIAL_DISCOVERY_TASK_FILE || "social-discovery-task.json";

if (!TOKEN) throw new Error("OIDC_TOKEN is required");

const claim = JSON.parse(fs.readFileSync(TASK_FILE, "utf8"));
const task = claim.task;
if (!task) {
  console.log("No Social Discovery task was claimed.");
  process.exit(0);
}

const ARABIC_DIGITS = new Map([..."٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹"].map((digit, index) => [digit, String(index % 10)]));
const BLOCKED_LANDING_HOSTS = new Set([
  "facebook.com", "www.facebook.com", "m.facebook.com", "l.facebook.com", "lm.facebook.com",
  "instagram.com", "www.instagram.com", "fb.com", "messenger.com", "www.messenger.com",
  "fbcdn.net", "scontent.xx.fbcdn.net",
]);

function latinDigits(value) {
  return String(value || "").replace(/[٠-٩۰-۹]/g, (digit) => ARABIC_DIGITS.get(digit) || digit);
}

function normalizeIraqMobile(value) {
  let digits = latinDigits(value).replace(/\D/g, "");
  if (digits.startsWith("00964")) digits = digits.slice(2);
  if (digits.length === 11 && (digits.startsWith("077") || digits.startsWith("078"))) {
    return `+964${digits.slice(1)}`;
  }
  if (digits.length === 13 && (digits.startsWith("96477") || digits.startsWith("96478"))) {
    return `+${digits}`;
  }
  return null;
}

function extractIraqPhone(value) {
  const clean = latinDigits(value);
  const pattern = /(?<!\d)(?:(?:\+?964|00964)[\s\-().]*)?(?:77|78)(?:[\s\-().]*\d){8,9}(?!\d)|(?<!\d)0(?:77|78)(?:[\s\-().]*\d){8}(?!\d)/g;
  for (const match of clean.matchAll(pattern)) {
    const normalized = normalizeIraqMobile(match[0]);
    if (normalized) return normalized;
  }
  return null;
}

function decodeJsonString(value) {
  if (!value) return null;
  try {
    return JSON.parse(`"${value}"`);
  } catch {
    return String(value).replaceAll("\\/", "/").replaceAll("\\n", " ").replaceAll("\\r", " ").replaceAll('\\"', '"').trim();
  }
}

function firstString(text, keys) {
  for (const key of keys) {
    const normal = new RegExp(`"${key}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`, "i");
    const escaped = new RegExp(`\\\\"${key}\\\\"\\s*:\\s*\\\\"((?:\\\\\\\\.|[^"\\\\])*)\\\\"`, "i");
    for (const pattern of [normal, escaped]) {
      const match = text.match(pattern);
      if (match) {
        const decoded = decodeJsonString(match[1]);
        if (decoded) return decoded.trim();
      }
    }
  }
  return null;
}

function nestedBodyText(text) {
  const patterns = [
    /"body"\s*:\s*\{[^{}]{0,500}?"text"\s*:\s*"((?:\\.|[^"\\])*)"/is,
    /\\"body\\"\s*:\s*\{[^{}]{0,500}?\\"text\\"\s*:\s*\\"((?:\\\\.|[^"\\])*)\\"/is,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const decoded = decodeJsonString(match[1]);
      if (decoded) return decoded.trim();
    }
  }
  return null;
}

function unwrapMetaRedirect(value) {
  try {
    const url = new URL(value);
    if (["l.facebook.com", "lm.facebook.com"].includes(url.hostname.toLowerCase())) {
      return url.searchParams.get("u") || value;
    }
  } catch {}
  return value;
}

function usableLanding(value) {
  if (!value) return null;
  try {
    const clean = unwrapMetaRedirect(String(value).replaceAll("\\/", "/").trim());
    const parsed = new URL(clean);
    const host = parsed.hostname.toLowerCase();
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    if (BLOCKED_LANDING_HOSTS.has(host) || host.endsWith(".fbcdn.net")) return null;
    return clean.slice(0, 1800);
  } catch {
    return null;
  }
}

function extractLanding(text) {
  for (const key of ["landing_page_url", "link_url", "website_url", "destination_url", "cta_url", "link_destination"]) {
    const value = usableLanding(firstString(text, [key]));
    if (value) return value;
  }
  for (const match of text.replaceAll("\\/", "/").matchAll(/https?:\/\/[^\s"<>]{5,1800}/g)) {
    const value = usableLanding(match[0].replace(/[\\,.;)\]}]+$/, ""));
    if (value && (value.includes("wa.me/") || value.includes("whatsapp.com/"))) return value;
  }
  return null;
}

function extractWhatsApp(text) {
  const clean = String(text || "").replaceAll("\\/", "/");
  for (const pattern of [
    /https?:\/\/wa\.me\/(?:message\/)?[A-Za-z0-9+._/?=&%-]+/i,
    /https?:\/\/(?:api\.)?whatsapp\.com\/[A-Za-z0-9+._/?=&%-]+/i,
  ]) {
    const match = clean.match(pattern);
    if (match) return match[0].slice(0, 1800);
  }
  const phone = extractIraqPhone(clean);
  return phone ? `https://wa.me/${phone.slice(1)}` : null;
}

function extractAdDetails(text) {
  const creative = firstString(text, ["ad_creative_body", "primary_text", "message", "body_text", "text"]) || nestedBodyText(text);
  const cta = firstString(text, ["cta_text", "call_to_action", "cta_type"]);
  const landing = extractLanding(text);
  const searchable = [creative, text.slice(0, 6000), landing].filter(Boolean).join(" ");
  const phone = extractIraqPhone(searchable);
  const whatsapp = extractWhatsApp(searchable);
  return {
    creative_text: creative ? creative.replace(/\s+/g, " ").trim().slice(0, 3000) : null,
    call_to_action: cta ? cta.replace(/\s+/g, " ").trim().slice(0, 250) : null,
    landing_url: landing,
    phone,
    whatsapp,
  };
}

function normalizeJsonish(text) {
  return String(text || "").replaceAll('\\"', '"').replaceAll("\\/", "/");
}

function mergeFound(target, incoming) {
  for (const [pageId, item] of incoming) {
    if (!target.has(pageId)) {
      target.set(pageId, item);
      continue;
    }
    const current = target.get(pageId);
    if (!current.page_name && item.page_name) current.page_name = item.page_name;
    if (!current.landing_url && item.landing_url) current.landing_url = item.landing_url;
    if (!current.phone && item.phone) current.phone = item.phone;
    if (!current.whatsapp && item.whatsapp) current.whatsapp = item.whatsapp;
    if (current.evidence_source !== item.evidence_source) current.evidence_source = "DOM+NETWORK";
    for (const [adId, details] of item.ads || []) {
      const existing = current.ads.get(adId) || {};
      current.ads.set(adId, Object.fromEntries(Object.entries({ ...existing, ...details }).filter(([, value]) => value)));
    }
  }
}

function extractFromText(raw, query, queryId, source = "NETWORK") {
  const text = normalizeJsonish(raw);
  const found = new Map();
  const patterns = [
    /"page_id"\s*:\s*"?(\d{5,})"?/g,
    /"pageID"\s*:\s*"?(\d{5,})"?/g,
    /"pageId"\s*:\s*"?(\d{5,})"?/g,
    /view_all_page_id(?:=|%3D)(\d{5,})/g,
  ];
  const positions = [];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) positions.push([match.index || 0, match[1]]);
  }
  for (const [position, pageId] of positions.slice(0, 500)) {
    const pageWindow = text.slice(Math.max(0, position - 5000), Math.min(text.length, position + 5000));
    const nameMatch = pageWindow.match(/"page_(?:name|Name)"\s*:\s*"([^"\\]{2,180})"/i) || pageWindow.match(/"pageName"\s*:\s*"([^"\\]{2,180})"/i);
    const item = found.get(pageId) || {
      page_id: pageId,
      page_name: nameMatch?.[1]?.trim() || null,
      query,
      query_id: queryId,
      evidence_source: source,
      ads: new Map(),
    };
    for (const adMatch of pageWindow.matchAll(/"ad_archive_id"\s*:\s*"?(\d{5,})"?/g)) {
      if (item.ads.size >= 10 && !item.ads.has(adMatch[1])) continue;
      const adPosition = adMatch.index || 0;
      const adWindow = pageWindow.slice(Math.max(0, adPosition - 2600), Math.min(pageWindow.length, adPosition + 3600));
      item.ads.set(adMatch[1], extractAdDetails(adWindow));
    }
    found.set(pageId, item);
  }
  return found;
}

async function dismissCookieDialogs(page) {
  for (const label of [
    "Allow all cookies", "Decline optional cookies", "Only allow essential cookies", "Close",
    "السماح بكل ملفات تعريف الارتباط", "رفض ملفات تعريف الارتباط الاختيارية", "إغلاق",
  ]) {
    try {
      const button = page.getByRole("button", { name: label, exact: false }).first();
      if (await button.isVisible({ timeout: 500 })) {
        await button.click({ timeout: 1500 });
        await page.waitForTimeout(400);
      }
    } catch {}
  }
}

async function extractDom(page, query, queryId) {
  const found = new Map();
  try {
    const anchors = page.locator('a[href*="view_all_page_id="]');
    const count = Math.min(await anchors.count(), 300);
    for (let index = 0; index < count; index++) {
      const anchor = anchors.nth(index);
      const href = await anchor.getAttribute("href") || "";
      const pageId = href.match(/view_all_page_id=(\d+)/)?.[1];
      if (!pageId) continue;
      const name = ((await anchor.innerText({ timeout: 1000 }).catch(() => "")) || (await anchor.getAttribute("aria-label")) || "").trim();
      found.set(pageId, { page_id: pageId, page_name: name || null, query, query_id: queryId, evidence_source: "DOM", ads: new Map() });
    }
  } catch {}
  mergeFound(found, extractFromText(await page.content(), query, queryId, "DOM_HTML"));
  return found;
}

function finalizeItem(item) {
  const ads = [...item.ads.entries()].slice(0, 10).map(([externalAdId, details]) => ({
    external_ad_id: externalAdId,
    ...details,
  }));
  for (const ad of ads) {
    item.landing_url ||= ad.landing_url;
    item.phone ||= ad.phone;
    item.whatsapp ||= ad.whatsapp;
  }
  return {
    page_id: item.page_id,
    page_name: item.page_name,
    query: item.query,
    query_id: item.query_id,
    profile_url: `https://www.facebook.com/${item.page_id}`,
    ad_library_url: `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=IQ&search_type=page&view_all_page_id=${item.page_id}`,
    landing_url: item.landing_url || null,
    phone: item.phone || null,
    whatsapp: item.whatsapp || null,
    evidence_source: item.evidence_source,
    ads,
  };
}

async function bridge(body) {
  const response = await fetch(BRIDGE, {
    method: "POST",
    headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(`bridge_${response.status}_${raw.slice(0, 700)}`);
  return raw ? JSON.parse(raw) : null;
}

const results = new Map();
const queryStats = [];
const blockers = [];
let browser;

try {
  browser = await chromium.launch({ headless: true, args: ["--disable-blink-features=AutomationControlled"] });
  const context = await browser.newContext({
    locale: "en-US",
    viewport: { width: 1440, height: 1200 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();
  let active = null;

  page.on("response", async (response) => {
    const state = active;
    if (!state) return;
    const url = response.url().toLowerCase();
    if (!url.includes("facebook.com") || !(url.includes("graphql") || url.includes("ads/library") || url.includes("ajax"))) return;
    try {
      const body = await response.text();
      if (active !== state) return;
      state.metaResponses++;
      const extracted = extractFromText(body, state.query, state.queryId, "META_NETWORK");
      if (extracted.size) state.candidateResponses++;
      mergeFound(state.network, extracted);
    } catch {}
  });

  for (const query of task.queries || []) {
    const term = String(query.query_text || "").trim();
    const state = { query: term, queryId: Number(query.id), network: new Map(), metaResponses: 0, candidateResponses: 0 };
    active = state;
    const url = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=IQ&media_type=all&search_type=keyword_unordered&q=${encodeURIComponent(term)}`;
    try {
      console.log(`Meta Ad Library query: ${term}`);
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await dismissCookieDialogs(page);
      await page.waitForTimeout(7_000);
      for (let index = 0; index < 5; index++) {
        await page.mouse.wheel(0, 1800);
        await page.waitForTimeout(1300);
      }
      const combined = new Map();
      mergeFound(combined, state.network);
      mergeFound(combined, await extractDom(page, term, Number(query.id)));
      const title = await page.title();
      let hits = 0;
      for (const item of combined.values()) {
        if (results.size >= Number(task.max_pages || 120)) break;
        const finalized = finalizeItem(item);
        if (results.has(finalized.page_id)) {
          const current = results.get(finalized.page_id);
          const merged = new Map((current.ads || []).map((ad) => [ad.external_ad_id, ad]));
          for (const ad of finalized.ads) merged.set(ad.external_ad_id, { ...(merged.get(ad.external_ad_id) || {}), ...ad });
          current.ads = [...merged.values()].slice(0, 10);
          current.page_name ||= finalized.page_name;
          current.landing_url ||= finalized.landing_url;
          current.phone ||= finalized.phone;
          current.whatsapp ||= finalized.whatsapp;
          continue;
        }
        results.set(finalized.page_id, finalized);
        hits++;
      }
      queryStats.push({
        query_id: Number(query.id), query: term, hits,
        meta_responses: state.metaResponses, candidate_responses: state.candidateResponses, title,
      });
      console.log(`Query ${JSON.stringify(term)}: ${hits} unique advertiser pages`);
    } catch (error) {
      const message = `${term}: ${error?.name || "Error"}: ${String(error?.message || error).slice(0, 350)}`;
      blockers.push(message);
      queryStats.push({ query_id: Number(query.id), query: term, hits: 0, meta_responses: state.metaResponses, candidate_responses: state.candidateResponses, title: "" });
      console.error(message);
    } finally {
      active = null;
    }
  }

  const completion = await bridge({
    action: "complete_social_discovery",
    command_id: Number(task.command_id),
    run_id: Number(task.run_id),
    request_id: task.request_id ? Number(task.request_id) : null,
    results: [...results.values()],
    query_stats: queryStats,
    blockers,
  });
  console.log(JSON.stringify(completion));
  if (process.env.GITHUB_OUTPUT) {
    const outcome = results.size ? "SUCCEEDED" : "PARTIAL";
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `pages=${results.size}\nblockers=${blockers.length}\noutcome=${outcome}\n`);
  }
} catch (error) {
  const message = `${error?.name || "Error"}: ${String(error?.message || error).slice(0, 3500)}`;
  try {
    await bridge({
      action: "fail_social_discovery",
      command_id: Number(task.command_id),
      run_id: Number(task.run_id),
      request_id: task.request_id ? Number(task.request_id) : null,
      error: message,
    });
  } catch (finishError) {
    console.error("Failed to record Social Discovery failure:", finishError);
  }
  throw error;
} finally {
  if (browser) await browser.close().catch(() => {});
}
