/**
 * Ntfy.sh Notifier — free, open source push notifications
 *
 * No account needed. Works on iPhone (via ntfy app), Android, and desktop.
 *
 * Setup (2 minutes):
 *   1. Install the ntfy app on your phone: https://ntfy.sh
 *   2. Choose a unique topic name (like "globalreport-yourname-2026")
 *      — topic is public by default, so make it hard to guess
 *   3. Subscribe to your topic in the app
 *   4. Set NTFY_TOPIC=your-topic-name in env vars
 *
 * For private topics (recommended):
 *   - Self-host ntfy on a free Fly.io or Railway instance
 *   - OR use ntfy.sh with access tokens (free tier available)
 *   - Set NTFY_TOKEN=your_access_token if using auth
 *
 * Environment variables:
 *   NTFY_TOPIC    — your topic name, e.g. "globalreport-abc123"
 *   NTFY_SERVER   — optional, default "https://ntfy.sh"
 *   NTFY_TOKEN    — optional, for authenticated/private topics
 *
 * Fix (2026-07-10): Added User-Agent header and retry logic to resolve
 *   HTTP 522 errors when running on Cloudflare Workers. ntfy.sh is also
 *   Cloudflare-hosted; CF-to-CF fetches without a User-Agent can be
 *   dropped at the edge. Retries cover transient 5xx failures.
 */

import type { Notifier, NotifyResult } from "./types";
import type { ScoredArticle }          from "../lib/alert-scorer";
import { formatAlert }                 from "./format";
import { listApprovedByChannel }       from "../lib/subscribers";
import { mergeRecipients }             from "../lib/alert-categories";
import { articlesForSubscriber }       from "../lib/alert-sources";

const PRIORITY_MAP: Record<number, string> = {
  90: "urgent",
  80: "high",
  70: "default",
  0:  "low",
};

function ntfyPriority(score: number): string {
  for (const [threshold, priority] of Object.entries(PRIORITY_MAP).sort((a, b) => +b[0] - +a[0])) {
    if (score >= Number(threshold)) return priority;
  }
  return "default";
}

/** Fetch with up to `maxRetries` attempts on 5xx or network errors. */
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  maxRetries = 3,
  timeoutMs  = 12_000,
): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (attempt > 0) {
      // exponential back-off: 500 ms, 1000 ms, …
      await new Promise(r => setTimeout(r, 500 * attempt));
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timer);
      // Don't retry 4xx — those are permanent failures (bad topic, auth, etc.)
      if (res.ok || (res.status >= 400 && res.status < 500)) return res;
      lastErr = new Error(`HTTP ${res.status} for topic ${url}: ${await res.text()}`);
      console.warn(`[ntfy] attempt ${attempt + 1}/${maxRetries} got ${res.status} — retrying`);
    } catch (e) {
      clearTimeout(timer);
      lastErr = e;
      console.warn(`[ntfy] attempt ${attempt + 1}/${maxRetries} network error — retrying`, e);
    }
  }
  throw lastErr;
}

export class NtfyNotifier implements Notifier {
  id   = "ntfy";
  name = "Ntfy.sh";

  isConfigured(): boolean {
    return !!process.env.NTFY_TOPIC || !!(process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL);
  }

  async send(articles: ScoredArticle[], appUrl: string, options = { defaultMinScore: 65, maxAlertsPerRun: 5 }): Promise<NotifyResult> {
    const topic  = process.env.NTFY_TOPIC ?? "";
    const server = (process.env.NTFY_SERVER ?? "https://ntfy.sh").replace(/\/$/, "");
    const token  = process.env.NTFY_TOKEN;
    const approved = await listApprovedByChannel("ntfy").catch(() => []);
    const dynamic = approved.filter(s => !!s.ntfyTopic).map(s => ({
      to: s.ntfyTopic as string, sections: s.sections, sourceGroups: s.sourceGroups, minAlertScore: s.minAlertScore,
    }));
    const recipients = mergeRecipients(topic ? [topic] : [], dynamic, options.defaultMinScore);

    let sent = 0;
    const errors: string[] = [];

    for (const recipient of recipients) {
      const mine = articlesForSubscriber(articles, recipient).slice(0, options.maxAlertsPerRun);
      for (const sa of mine) {
      const url = `${server}/${recipient.to}`;
      const { subject, plain, emoji } = formatAlert(sa, appUrl);
      const priority = ntfyPriority(sa.score);

      const headers: Record<string, string> = {
        // User-Agent is required when calling ntfy.sh from Cloudflare Workers.
        // Without it, both ends are Cloudflare-hosted and CF drops the connection (522).
        "User-Agent":   "GlobalReport-Notifier/1.0",
        "Title":        subject.slice(0, 250),
        "Priority":     priority,
        "Tags":         `${emoji.replace(/\s/g, "")},${sa.article.section}`,
        "Content-Type": "text/plain",
      };

      if (appUrl) headers["Click"]         = appUrl;
      if (token)  headers["Authorization"] = `Bearer ${token}`;

      try {
        const res = await fetchWithRetry(url, { method: "POST", headers, body: plain });
        if (res.ok) {
          sent++;
        } else {
          const err = `HTTP ${res.status} for topic ${recipient.to}: ${await res.text()}`;
          console.error(`[ntfy] Error: ${err}`);
          errors.push(err);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[ntfy] Failed after retries:", msg);
        errors.push(msg);
      }
      }
    }

    return {
      channel:    this.name,
      success:    sent > 0,
      recipients: sent,
      error:      sent === 0 ? (errors[0] ?? "No messages delivered to ntfy") : undefined,
    };
  }
}
