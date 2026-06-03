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
 */

import type { Notifier, NotifyResult } from "./types";
import type { ScoredArticle }          from "../lib/alert-scorer";
import { formatAlert }                 from "./format";

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

export class NtfyNotifier implements Notifier {
  id   = "ntfy";
  name = "Ntfy.sh";

  isConfigured(): boolean {
    return !!process.env.NTFY_TOPIC;
  }

  async send(articles: ScoredArticle[], appUrl: string): Promise<NotifyResult> {
    const topic  = process.env.NTFY_TOPIC!;
    const server = (process.env.NTFY_SERVER ?? "https://ntfy.sh").replace(/\/$/, "");
    const token  = process.env.NTFY_TOKEN;
    const url    = `${server}/${topic}`;

    let sent = 0;

    for (const sa of articles) {
      const { subject, plain, emoji } = formatAlert(sa, appUrl);
      const priority = ntfyPriority(sa.score);

      const headers: Record<string, string> = {
        "Title":    subject.slice(0, 250),
        "Priority": priority,
        "Tags":     `${emoji.replace(/\s/g, "")},${sa.article.section}`,
        "Content-Type": "text/plain",
      };

      if (appUrl)  headers["Click"] = appUrl;
      if (token)   headers["Authorization"] = `Bearer ${token}`;

      try {
        const res = await fetch(url, {
          method: "POST",
          headers,
          body: plain,
        });
        if (res.ok) {
          sent++;
        } else {
          const err = await res.text();
          console.error(`[ntfy] Error ${res.status}: ${err}`);
        }
      } catch (e) {
        console.error("[ntfy] Fetch error:", e);
      }
    }

    return {
      channel: this.name,
      success: sent > 0,
      recipients: sent,
      error: sent === 0 ? "No messages delivered to ntfy" : undefined,
    };
  }
}
