Exit code: 0
Wall time: 0.5 seconds
Output:
export const dynamic = "force-dynamic";
/**
 * /api/monitor Ã¢â‚¬â€ hourly monitor endpoint
 * Fetches fresh news, scores articles, fires alerts via all configured channels.
 */

import { NextRequest, NextResponse }  from "next/server";
import { refreshBriefing, loadBriefing } from "@/src/lib/orchestrator";
import { scoreAll }                   from "@/src/lib/alert-scorer";
import { getNotifierManager }         from "@/src/notifiers/manager";
import { articleMatchesAlertTopic, alertSourceLabel, cleanAlertText } from "@/src/lib/alert-topic";
import { loadArticleLibrary } from "@/src/lib/article-library";
import { mergeMonitorArticles } from "@/src/lib/monitor-articles";
import { loadAlertSettings } from "@/src/lib/alert-settings";
import { acquireDistributedLock } from "@/src/lib/distributed-lock";

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

// Ã¢â€â‚¬Ã¢â€â‚¬ Redis helpers for alert deduplication Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
async function alertedKeys(keys: string[]): Promise<Set<string>> {
  const u = process.env.UPSTASH_REDIS_REST_URL;
  const t = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!u || !t || keys.length === 0) return new Set();
  try {
    const { Redis } = await import("@upstash/redis");
    const values = await new Redis({ url: u, token: t }).mget<unknown[]>(...keys.map(key => `alert:${key}`));
    return new Set(keys.filter((_, index) => !!values[index]));
  } catch {
    // A cooldown outage must not falsely mark anything delivered. Recipient
    // cooldowns in NotifierManager still prevent duplicates where available.
    return new Set();
  }
}

// Ã¢â€â‚¬Ã¢â€â‚¬ URL pre-flight check Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// Domains where HEAD checks are blocked at the network level (not domain trust).
// Government and major news domains are NOT skipped Ã¢â‚¬â€ we still HEAD-check their
// URLs so that AI-hallucinated paths on real domains (e.g. bis.doc.gov/fake)
// get caught as 404s. Only domains that actively block HEAD/GET from cloud IPs
// (causing false-negative drops) go here.
const HEAD_BLOCKED_DOMAINS = [
  "aljazeera.com",   // AJ blocks cloud-origin HEAD checks Ã¢â‚¬â€ returns 403/timeout
  "treasury.gov",    // ofac.treasury.gov / home.treasury.gov block Cloudflare IPs
                     // (the whole reason OFAC data is read from a GitHub cache) Ã¢â‚¬â€
                     // a HEAD from the CF Worker always fails, which would wrongly
                     // drop every OFAC alert now that unreachable alerts are dropped.
];

function isHeadBlocked(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    if (HEAD_BLOCKED_DOMAINS.some(d => host === d || host.endsWith("." + d))) return true;
    // Government / intergovernmental domains are authoritative and several
    // block cloud-origin requests. A HEAD failure from the CF Worker is a
    // false negative, not evidence the notice is fake Ã¢â‚¬â€ never drop these.
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
  // All other domains Ã¢â‚¬â€ including .gov Ã¢â‚¬â€ are checked so fake paths are caught.
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
 * Previously this only STRIPPED the broken URL and still sent the alert Ã¢â‚¬â€
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

async function runMonitor(topic?: string, force = false, backfillHours?: number) {
  const appUrl = process.env.APP_URL ?? "";
  const alertSettings = await loadAlertSettings();
  const maxAlertsPerRun = alertSettings.maxAlertsPerRun;

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
  const scoringSettings = {
    ...alertSettings,
    threshold: 0,
    maxAgeHours: backfillHours ?? alertSettings.maxAgeHours,
  };
  const scored = scoreAll(monitorArticles, scoringSettings);
  // A topic is a hard alert filter, not merely a hint to the refresh provider.
  // This prevents a DHS/UFLPA dispatch from paging unrelated Treasury/BIS news.
  const candidates = scored.filter(s =>
    s.shouldAlert && articleMatchesAlertTopic(s.article, topic)
  );
  // Internal notifiers use per-recipient cooldowns. Verify every candidate so
  // a failed recipient can retry without being suppressed by another channel.
  // 3. Deduplicate
  const { buildAlertKey } = await import("@/src/lib/alert-scorer");
  const forceSend = force;
  // Bound URL checks and notification work. This is a Cloudflare Worker, so
  // an unbounded candidate set can consume the invocation's subrequest budget
  // before Telegram/ntfy are called. Keep a wider verification pool, then
  // deliver at most the configured batch size.
  const candidatePool = candidates.slice(0, Math.max(maxAlertsPerRun * 3, maxAlertsPerRun));
  const verifiedCandidates = candidatePool.length > 0 ? await verifyAlertUrls(candidatePool) : [];
  const keys = verifiedCandidates.map(s => buildAlertKey(s.article));
  const alreadyAlerted = forceSend ? new Set<string>() : await alertedKeys(keys);
  const blockedKeys = keys.filter(key => alreadyAlerted.has(key));
  const newAlerts = verifiedCandidates
    .filter(s => !alreadyAlerted.has(buildAlertKey(s.article)))
    .slice(0, maxAlertsPerRun);

  console.log(`[monitor] ${monitorArticles.length} articles - ${candidates.length} above threshold - ${newAlerts.length} new - ${blockedKeys.length} cooldown blocked${forceSend?" (FORCED)":""}`);

  // 4a. Pre-flight URL check - DROP alerts with missing/unreachable sourceUrls
  const verifiedAlerts = newAlerts;
  const droppedNoLink = candidatePool.length - verifiedCandidates.length;
  if (droppedNoLink > 0) {
    console.warn(`[monitor] dropped ${droppedNoLink} alert(s) lacking a working source link`);
  }

  // 4. Fire notifications only for new, link-verified alerts
  const manager = getNotifierManager();
  // Internal recipient channels have their own per-recipient cooldowns. They
  // must see verified candidates even if the workflow's global ntfy fallback
  // already delivered an item; otherwise a successful ntfy send suppresses a
  // Telegram subscriber who has not received it.
  const notifyResult = verifiedCandidates.length > 0
    ? await manager.notify(verifiedCandidates, appUrl, alertSettings.threshold, maxAlertsPerRun)
    : { sent: 0, skipped: 0, channels: [], results: [], totalAlerts: 0, deliveredAlertKeys: [] };

  // 5. Start cooldown only for articles a notification channel actually
  // delivered. Failed attempts remain eligible for the next monitor run.
  // The global cooldown is reserved for the workflow's external ntfy send and
  // is recorded by /api/monitor/delivered. Internal channels persist their
  // own per-recipient cooldowns in NotifierManager.

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
    backfillHours: backfillHours ?? null,
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
  let lock: Awaited<ReturnType<typeof acquireDistributedLock>> = null;
  try {
    lock = await acquireDistributedLock("monitor-delivery-lock", 180);
    if (!lock) {
      return NextResponse.json(
        { error: "Another monitor run is already active" },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    }
    const body = await req.json().catch(() => ({})) as { topic?: unknown; force?: unknown; backfillHours?: unknown };
    const topic = typeof body.topic === "string" ? body.topic.trim().slice(0, 200) : undefined;
    const force = body.force === true;
    let backfillHours: number | undefined;
    if (body.backfillHours !== undefined) {
      const parsed = Number(body.backfillHours);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 168) {
        return NextResponse.json({ error: "backfillHours must be a whole number from 1 to 168" }, { status: 400 });
      }
      backfillHours = parsed;
    }
    return NextResponse.json(await runMonitor(topic, force, backfillHours));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  } finally {
    await lock?.release().catch(error => console.warn("[monitor] lock release failed:", String(error).slice(0, 100)));
  }
}


