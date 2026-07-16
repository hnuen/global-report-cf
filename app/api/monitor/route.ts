export const dynamic = "force-dynamic";
/**
 * /api/monitor — hourly monitor endpoint
 * Fetches fresh news, scores articles, fires alerts via all configured channels.
 */

import { NextRequest, NextResponse }  from "next/server";
import { refreshBriefing, loadBriefing } from "@/src/lib/orchestrator";
import { scoreAll }                   from "@/src/lib/alert-scorer";
import { getNotifierManager }         from "@/src/notifiers/manager";

export const maxDuration = 120;

function isAuthorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return (
    req.headers.get("authorization") === `Bearer ${secret}` ||
    req.headers.get("x-cron-secret") === secret
  );
}

// ── Redis helpers for alert deduplication ─────────────────────────────────────
async function wasAlerted(key: string): Promise<boolean> {
  const u = process.env.UPSTASH_REDIS_REST_URL;
  const t = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!u || !t) return false;
  try {
    const r = await fetch(`${u}/get/${encodeURIComponent("alert:"+key)}`,
      { headers: { Authorization: `Bearer ${t}` } });
    const d = await r.json();
    return !!d.result;
  } catch { return false; }
}

async function markAlerted(key: string, cooldownMinutes: number): Promise<void> {
  const u = process.env.UPSTASH_REDIS_REST_URL;
  const t = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!u || !t) return;
  try {
    await fetch(`${u}/set/${encodeURIComponent("alert:"+key)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
      body: JSON.stringify({ value: "1", ex: cooldownMinutes * 60 }),
    });
  } catch {}
}

// ── URL pre-flight check ──────────────────────────────────────────────────────
// Domains where HEAD checks are blocked at the network level (not domain trust).
// Government and major news domains are NOT skipped — we still HEAD-check their
// URLs so that AI-hallucinated paths on real domains (e.g. bis.doc.gov/fake)
// get caught as 404s. Only domains that actively block HEAD/GET from cloud IPs
// (causing false-negative drops) go here.
const HEAD_BLOCKED_DOMAINS = [
  "aljazeera.com",   // AJ blocks cloud-origin HEAD checks — returns 403/timeout
];

function isHeadBlocked(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return HEAD_BLOCKED_DOMAINS.some(d => host === d || host.endsWith("." + d));
  } catch { return false; }
}

/** HEAD-check a URL; returns true if reachable (2xx/3xx), false on 4xx/error */
async function isUrlReachable(url: string): Promise<boolean> {
  if (!url || url === "#") return false;
  // Skip check only for domains that block cloud-origin requests (not domain trust).
  // All other domains — including .gov — are checked so fake paths are caught.
  if (isHeadBlocked(url)) return true;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; GlobalReportBot/1.0)" },
      redirect: "follow",
    });
    clearTimeout(timer);
    return res.status < 400;
  } catch { return false; }
}

/** Strip broken sourceUrls from alert candidates in-place */
async function verifyAlertUrls(alerts: import("@/src/lib/alert-scorer").ScoredArticle[]): Promise<void> {
  await Promise.all(alerts.map(async sa => {
    const url = sa.article.sourceUrl;
    if (!url || url === "#") return;
    const ok = await isUrlReachable(url);
    if (!ok) {
      console.warn(`[monitor] sourceUrl 404/unreachable - stripping: ${url.slice(0, 80)}`);
      sa.article.sourceUrl = undefined;
    }
  }));
}

async function runMonitor(topic?: string, force = false) {
  const appUrl = process.env.APP_URL ?? "";
  const cooldownMinutes = Number(process.env.ALERT_COOLDOWN_MINUTES ?? 10080);
  const maxAlertsPerRun = Number(process.env.ALERT_MAX_PER_RUN ?? 3);

  // 1. Load existing briefing from Redis
  let briefing;
  let usedProvider = "cached";
  if (topic) {
    const result = await refreshBriefing(topic);
    briefing = result.briefing;
    usedProvider = result.usedProvider;
  } else {
    const { loadBriefing } = await import("@/src/lib/orchestrator");
    briefing = await loadBriefing();
    if (!briefing) {
      const result = await refreshBriefing("breaking sanctions enforcement OFAC FinCEN BIS today");
      briefing = result.briefing;
      usedProvider = result.usedProvider;
    }
  }

  // 2. Score all articles
  const scored = scoreAll(briefing.articles);
  const candidates = scored.filter(s => s.shouldAlert);

  // 3. Deduplicate
  const { buildAlertKey } = await import("@/src/lib/alert-scorer");
  const forceSend = force;
  const newAlerts = [];
  const blockedKeys: string[] = [];
  for (const s of candidates) {
    const key = buildAlertKey(s.article);
    const already = forceSend ? false : await wasAlerted(key);
    if (!already) {
      newAlerts.push(s);
    } else {
      blockedKeys.push(key);
    }
    if (newAlerts.length >= maxAlertsPerRun) break;
  }

  console.log(`[monitor] ${briefing.articles.length} articles - ${candidates.length} above threshold - ${newAlerts.length} new - ${blockedKeys.length} cooldown blocked${forceSend?" (FORCED)":""}`);

  // 4a. Pre-flight URL check - strip 404/unreachable sourceUrls before alerting
  if (newAlerts.length > 0) await verifyAlertUrls(newAlerts);

  // 4. Fire notifications only for new alerts
  const manager = getNotifierManager();
  const notifyResult = newAlerts.length > 0
    ? await manager.notify(newAlerts, appUrl)
    : { sent: 0, skipped: 0, channels: [], results: [], totalAlerts: 0 };

  // 5. Mark alerted articles in Redis with cooldown TTL
  for (const s of newAlerts) {
    await markAlerted(buildAlertKey(s.article), cooldownMinutes);
  }

  return {
    ok:           true,
    articles:     briefing.articles.length,
    alerting:     newAlerts.length,
    notified:     notifyResult.sent,
    skipped:      notifyResult.skipped,
    channels:     notifyResult.channels,
    channelResults: notifyResult.results.map(r => ({
      channel: r.channel, success: r.success, error: r.error,
    })),
    usedProvider,
    forceSend,
    cooldownBlocked: blockedKeys.length,
    blockedKeys,
    alertedArticles: newAlerts.map(s => ({
      score:     s.score,
      section:   s.article.section,
      category:  s.article.category,
      region:    s.article.region,
      sourceUrl: s.article.sourceUrl?.slice(0, 200),
      source:    s.article.source,
      headline:  s.article.headline,
      body:      s.article.body?.slice(0, 2),
      reasons:   s.reasons,
    })),
    topScored: scored.slice(0, 5).map(s => ({
      score:       s.score,
      shouldAlert: s.shouldAlert,
      section:     s.article.section,
      sourceUrl:   s.article.sourceUrl?.slice(0, 60),
      headline:    s.article.headline?.slice(0, 80),
      reasons:     s.reasons,
    })),
  };
}

export async function GET(req: NextRequest) {
  try   { return NextResponse.json(await runMonitor()); }
  catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as { topic?: string; force?: boolean };
    return NextResponse.json(await runMonitor(body.topic, body.force ?? false));
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}
