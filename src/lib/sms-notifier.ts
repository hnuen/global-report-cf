/**
 * SMS Notifier — sends alerts via Twilio
 *
 * Required environment variables:
 *   TWILIO_ACCOUNT_SID   — from console.twilio.com
 *   TWILIO_AUTH_TOKEN    — from console.twilio.com
 *   TWILIO_FROM_NUMBER   — your Twilio phone number, e.g. +14155551234
 *   ALERT_TO_NUMBERS     — comma-separated recipient numbers, e.g. +14155559999,+447700900000
 *
 * Optional:
 *   ALERT_MAX_PER_RUN    — max SMS sent per cron run (default 3, prevents spam)
 *   ALERT_COOLDOWN_MINUTES — ignore same headline for N minutes (default 360 = 6h)
 */

import type { ScoredArticle } from "./alert-scorer";
import { buildAlertKey }      from "./alert-scorer";

export interface SMSResult {
  to: string;
  sid?: string;
  error?: string;
  success: boolean;
}

export interface AlertRunResult {
  sent: number;
  skipped: number;
  errors: string[];
  messages: SMSResult[];
}

// ── Message formatter ─────────────────────────────────────────────────────────

function formatSMS(sa: ScoredArticle, appUrl: string): string {
  const { article, score } = sa;
  const emoji = score >= 90 ? "🚨" : score >= 80 ? "⚠️" : "📌";
  const section = article.section.toUpperCase();

  // SMS hard limit: 160 chars per segment — keep under 320 (2 segments max)
  const headline = article.headline.length > 120
    ? article.headline.slice(0, 117) + "…"
    : article.headline;

  return [
    `${emoji} GLOBAL REPORT ALERT`,
    `[${section}] ${article.category} | ${article.region}`,
    headline,
    `Score: ${score}/100`,
    appUrl ? `${appUrl}/api/news` : "",
  ].filter(Boolean).join("\n");
}

// ── Twilio API call ───────────────────────────────────────────────────────────

async function sendViaTwilio(to: string, body: string): Promise<SMSResult> {
  const sid   = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from  = process.env.TWILIO_FROM_NUMBER;

  if (!sid || !token || !from) {
    return { to, success: false, error: "Twilio credentials not configured" };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const auth = btoa(`${sid}:${token}`);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
    });

    const data = await res.json() as { sid?: string; message?: string; code?: number };

    if (res.ok && data.sid) {
      console.log(`[sms] Sent to ${to}: ${data.sid}`);
      return { to, sid: data.sid, success: true };
    } else {
      const err = `Twilio error ${res.status}: ${data.message ?? JSON.stringify(data)}`;
      console.error(`[sms] ${err}`);
      return { to, success: false, error: err };
    }
  } catch (e) {
    return { to, success: false, error: String(e) };
  }
}

// ── Cooldown tracking via KV ──────────────────────────────────────────────────
// We store a simple JSON map { alertKey: timestampMs } in the same KV store.

const COOLDOWN_KV_KEY = "alert_cooldowns_v1";

async function loadCooldowns(): Promise<Record<string, number>> {
  try {
    // Try Upstash first, then Vercel KV
    if (process.env.UPSTASH_REDIS_REST_URL) {
      const { Redis } = await import("@upstash/redis");
      const redis = new Redis({
        url:   process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      });
      const raw = await redis.get<string>(COOLDOWN_KV_KEY);
      if (raw) return typeof raw === "string" ? JSON.parse(raw) : raw as Record<string, number>;
    } else if (process.env.KV_REST_API_URL) {
      const { Redis } = await import("@upstash/redis");
      const redis = new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN! });
      const raw = await redis.get<string>(COOLDOWN_KV_KEY);
      if (raw) return typeof raw === "string" ? JSON.parse(raw) : raw as Record<string, number>;
    }
  } catch (e) {
    console.warn("[sms] Could not load cooldowns:", e);
  }
  return {};
}

async function saveCooldowns(cooldowns: Record<string, number>): Promise<void> {
  try {
    const payload = JSON.stringify(cooldowns);
    const url   = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
    if (url && token) {
      const { Redis } = await import("@upstash/redis");
      const redis = new Redis({ url, token });
      await redis.set(COOLDOWN_KV_KEY, payload);
    }
  } catch (e) {
    console.warn("[sms] Could not save cooldowns:", e);
  }
}

// ── Main alert runner ─────────────────────────────────────────────────────────

export async function sendAlerts(
  scored: ScoredArticle[],
  appUrl = ""
): Promise<AlertRunResult> {
  const result: AlertRunResult = { sent: 0, skipped: 0, errors: [], messages: [] };

  const toNumbers = (process.env.ALERT_TO_NUMBERS ?? "")
    .split(",").map(n => n.trim()).filter(Boolean);

  if (toNumbers.length === 0) {
    result.errors.push("ALERT_TO_NUMBERS not configured — no recipients");
    return result;
  }

  const maxPerRun   = Number(process.env.ALERT_MAX_PER_RUN      ?? 3);
  const cooldownMs  = Number(process.env.ALERT_COOLDOWN_MINUTES ?? 360) * 60 * 1000;
  const now         = Date.now();

  const cooldowns    = await loadCooldowns();
  const toAlert      = scored.filter(s => s.shouldAlert);
  let sentThisRun    = 0;

  for (const sa of toAlert) {
    if (sentThisRun >= maxPerRun) {
      result.skipped++;
      continue;
    }

    const key = buildAlertKey(sa.article);
    const lastSent = cooldowns[key] ?? 0;

    if (now - lastSent < cooldownMs) {
      console.log(`[sms] Cooldown active for "${sa.article.headline.slice(0, 40)}…" — skipping`);
      result.skipped++;
      continue;
    }

    const body = formatSMS(sa, appUrl);

    for (const to of toNumbers) {
      const res = await sendViaTwilio(to, body);
      result.messages.push(res);
      if (!res.success) result.errors.push(res.error ?? "unknown error");
    }

    // Mark as alerted
    cooldowns[key] = now;
    sentThisRun++;
    result.sent++;
  }

  if (sentThisRun > 0) await saveCooldowns(cooldowns);
  return result;
}
