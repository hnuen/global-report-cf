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

async function runMonitor(topic?: string, force = false) {
  const appUrl = process.env.APP_URL ?? "";
  // Default raised from 360 (6h) to 10080 (7 days): this TTL is the only thing
  // standing between "this article already alerted" and "alert it again" —
  // since the cached penalty/program feeds keep old entries in the article
  // pool indefinitely (not just newly-published ones), a 6h window meant the
  // same old article re-qualified and re-sent every few hours, forever. See
  // alert-scorer.ts's isRecentEnough() for the companion age gate on score.
  const cooldownMinutes = Number(process.env.ALERT_COOLDOWN_MINUTES ?? 10080);
  const maxAlertsPerRun = Number(process.env.ALERT_MAX_PER_RUN ?? 3);

  // 1. Load existing briefing from Redis — no re-fetch needed
  //    Only do a full refresh if explicitly requested via topic
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

  // 2. Score all articles — lower threshold for OFAC/sanctions to ensure alerts fire
  const scored = scoreAll(briefing.articles);
  const candidates = scored.filter(s => s.shouldAlert);

  // 3. Deduplicate — skip articles already alerted within cooldown window
  //    Pass force=true in body to bypass cooldown (for testing)
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

  console.log(`[monitor] ${briefing.articles.length} articles — ${candidates.length} above threshold — ${newAlerts.length} new — ${blockedKeys.length} cooldown blocked${forceSend?" (FORCED)":""}`);

  // 4. Fire notifications only for new alerts
  const manager = getNotifierManager();
  const notifyResult = newAlerts.length > 0
    ? await manager.notify(newAlerts, appUrl)
    : { sent: 0, skipped: 0, channels: [], results: [], totalAlerts: 0 };

  // 5. Mark alerted articles in Redis with cooldown TTL
  for (const s of newAlerts) {
    await markAlerted(buildAlertKey(s.article), cooldownMinutes);
  }

  const alerting = newAlerts;

  return {
    ok:           true,
    articles:     briefing.articles.length,
    alerting:     alerting.length,
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
    const body = await req.json().catch(() => ({})) as { topic?: string };
    return NextResponse.json(await runMonitor(body.topic));
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}
