export const dynamic = "force-dynamic";
/**
 * /api/monitor — hourly monitor endpoint
 * Fetches fresh news, scores articles, fires alerts via all configured channels.
 */

import { NextRequest, NextResponse }  from "next/server";
import { refreshBriefing, loadBriefing } from "@/src/lib/orchestrator";
import { scoreAll }                   from "@/src/lib/alert-scorer";
import { getNotifierManager }         from "@/src/notifiers/manager";
import { applySuccessfulDeliveryCooldowns } from "@/src/lib/alert-delivery";
import { articleMatchesAlertTopic, alertSourceLabel, cleanAlertText } from "@/src/lib/alert-topic";
import { loadArticleLibrary } from "@/src/lib/article-library";
import { mergeMonitorArticles } from "@/src/lib/monitor-articles";

export const maxDuration = 120;

function isAuthorised(req: NextRequest): boolean {
  // FAIL CLOSED: this endpoint fires real SMS/Telegram/WhatsApp alerts, so an
  // unset CRON_SECRET must mean "nobody is authorized", not "everybody is".
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
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
  "treasury.gov",    // ofac.treasury.gov / home.treasury.gov block Cloudflare IPs
                     // (the whole reason OFAC data is read from a GitHub cache) —
                     // a HEAD from the CF Worker always fails, which would wrongly
                     // drop every OFAC alert now that unreachable alerts are dropped.
];

function isHeadBlocked(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    if (HEAD_BLOCKED_DOMAINS.some(d => host === d || host.endsWith("." + d))) return true;
    // Government / intergovernmental domains are authoritative and several
    // block cloud-origin requests. A HEAD failure from the CF Worker is a
    // false negative, not evidence the notice is fake — never drop these.
    // (LLM-hallucinated gov URLs are already excluded upstream: aiGenerated
    // articles never alert, per alert-scorer.ts.)
    return (
      host.endsWith(".gov") || host === "gov.uk" || host.endsWith(".gov.uk") ||
      host === "europa.eu" || host.endsWith(".europa.eu") ||
      host === "un.org" || host.endsWith(".un.org") || host.endsWith(".mil")
    );
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

/**
 * DROP alert candidates whose sourceUrl is missing or unreachable.
 * Previously this only STRIPPED the broken URL and still sent the alert —
 * which is exactly how hallucinated articles reached subscribers as alerts
 * with no link to a government or media source. An alert we can't back with
 * a working, trusted link should not be sent at all: the article stays
 * visible on the site, it just never pages anyone.
 */
async function verifyAlertUrls(
  alerts: import("@/src/lib/alert-scorer").ScoredArticle[]
): Promise<import("@/src/lib/alert-scorer").ScoredArticle[]> {
  const results = await Promise.all(alerts.map(async sa => {
    const url = sa.article.sourceUrl;
    if (!url || url === "#") {
      console.warn(`[monitor] no sourceUrl - dropping alert: "${sa.article.headline?.slice(0, 80)}"`);
      return null;
    }
    const ok = await isUrlReachable(url);
    if (!ok) {
      console.warn(`[monitor] sourceUrl 404/unreachable - dropping alert: ${url.slice(0, 80)}`);
      return null;
    }
    return sa;
  }));
  return results.filter((sa): sa is import("@/src/lib/alert-scorer").ScoredArticle => sa !== null);
}

async function runMonitor(topic?: string, force = false) {
  const appUrl = process.env.APP_URL ?? "";
  const cooldownMinutes = Number(process.env.ALERT_COOLDOWN_MINUTES ?? 10080);
  const maxAlertsPerRun = Number(process.env.ALERT_MAX_PER_RUN ?? 5);

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

  // 2. Score the same article union shown by /api/news. Previously the web
  // page merged the persistent library while monitoring only inspected the
  // briefing, so current DHS/UFLPA articles could be visible but never alert.
  const libraryArticles = await loadArticleLibrary().catch(() => []);
  const monitorArticles = mergeMonitorArticles(briefing.articles, libraryArticles);
  const scored = scoreAll(monitorArticles);
  // A topic is a hard alert filter, not merely a hint to the refresh provider.
  // This prevents a DHS/UFLPA dispatch from paging unrelated Treasury/BIS news.
  const candidates = scored.filter(s =>
    s.shouldAlert && articleMatchesAlertTopic(s.article, topic)
  );

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

  console.log(`[monitor] ${monitorArticles.length} articles - ${candidates.length} above threshold - ${newAlerts.length} new - ${blockedKeys.length} cooldown blocked${forceSend?" (FORCED)":""}`);

  // 4a. Pre-flight URL check - DROP alerts with missing/unreachable sourceUrls
  const verifiedAlerts = newAlerts.length > 0 ? await verifyAlertUrls(newAlerts) : [];
  const droppedNoLink = newAlerts.length - verifiedAlerts.length;
  if (droppedNoLink > 0) {
    console.warn(`[monitor] dropped ${droppedNoLink} alert(s) lacking a working source link`);
  }

  // 4. Fire notifications only for new, link-verified alerts
  const manager = getNotifierManager();
  const notifyResult = verifiedAlerts.length > 0
    ? await manager.notify(verifiedAlerts, appUrl)
    : { sent: 0, skipped: 0, channels: [], results: [], totalAlerts: 0, deliveredAlertKeys: [] };

  // 5. Start cooldown only for articles a notification channel actually
  // delivered. Failed attempts remain eligible for the next monitor run.
  await applySuccessfulDeliveryCooldowns(
    notifyResult.deliveredAlertKeys,
    cooldownMinutes,
    markAlerted,
  );

  return {
    ok:           true,
    articles:     monitorArticles.length,
    alerting:     verifiedAlerts.length,
    droppedNoLink,
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
    alertedArticles: verifiedAlerts.map(s => ({
      score:     s.score,
      section:   s.article.section,
      category:  alertSourceLabel(s.article),
      region:    s.article.region,
      sourceUrl: s.article.sourceUrl?.slice(0, 200),
      source:    alertSourceLabel(s.article),
      headline:  cleanAlertText(s.article.headline),
      body:      s.article.body?.slice(0, 2).map(cleanAlertText),
      alertKey:  buildAlertKey(s.article),
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

export async function POST(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json().catch(() => ({})) as { topic?: string; force?: boolean };
    return NextResponse.json(await runMonitor(body.topic, body.force ?? false));
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}


