/**
 * Discord Webhook Notifier — free, rich embeds, no bot required
 *
 * Setup (3 minutes):
 *   1. Open Discord → go to a channel you want alerts in
 *   2. Channel Settings → Integrations → Webhooks → New Webhook
 *   3. Copy the Webhook URL
 *   4. Set DISCORD_WEBHOOK_URLS in env (comma-separated for multiple channels)
 *
 * Environment variables:
 *   DISCORD_WEBHOOK_URLS  — comma-separated webhook URLs
 *   DISCORD_MENTION_ROLE  — optional role ID to ping, e.g. "123456789"
 *   DISCORD_MENTION_USER  — optional user ID to ping, e.g. "987654321"
 */

import type { Notifier, NotifyResult } from "./types";
import type { ScoredArticle }          from "../lib/alert-scorer";

const COLOUR_MAP: Record<string, number> = {
  sanctions: 0xC0392B,   // red
  economics: 0x2471A3,   // blue
  religion:  0x1E8449,   // green
  occ:       0x935116,   // brown
  penalties: 0x1A5276,   // dark blue
  bis:       0x6C3483,   // purple
};

export class DiscordNotifier implements Notifier {
  id   = "discord";
  name = "Discord";

  isConfigured(): boolean {
    return !!process.env.DISCORD_WEBHOOK_URLS;
  }

  async send(articles: ScoredArticle[], appUrl: string): Promise<NotifyResult> {
    const webhooks = process.env.DISCORD_WEBHOOK_URLS!
      .split(",").map(s => s.trim()).filter(Boolean);

    const mentionRole = process.env.DISCORD_MENTION_ROLE;
    const mentionUser = process.env.DISCORD_MENTION_USER;
    const mention = mentionRole
      ? `<@&${mentionRole}>`
      : mentionUser
      ? `<@${mentionUser}>`
      : "";

    let sent = 0;

    for (const webhook of webhooks) {
      // Discord allows up to 10 embeds per message — batch them
      const embeds = articles.slice(0, 10).map(sa => {
        const { article, score } = sa;
        const emoji = score >= 90 ? "🚨" : score >= 80 ? "⚠️" : "📌";
        const colour = COLOUR_MAP[article.section] ?? 0x95A5A6;

        return {
          title:       `${emoji} ${article.headline}`.slice(0, 256),
          description: article.body[0]?.slice(0, 350) + (article.body[0]?.length > 350 ? "…" : ""),
          color:       colour,
          fields: [
            { name: "Section",  value: article.section.toUpperCase(), inline: true },
            { name: "Category", value: article.category,              inline: true },
            { name: "Region",   value: article.region,                inline: true },
            { name: "Score",    value: `${score}/100`,                inline: true },
            { name: "Impact",   value: article.impact.toUpperCase(),  inline: true },
            { name: "Source",   value: article.source,                inline: true },
          ],
          footer: { text: `Global Report Alert • ${article.date}` },
          url: appUrl || undefined,
        };
      });

      const body: Record<string, unknown> = { embeds };
      if (mention) body.content = `${mention} — ${articles.length} new alert${articles.length > 1 ? "s" : ""}`;

      try {
        const res = await fetch(webhook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (res.ok || res.status === 204) {
          sent++;
        } else {
          const err = await res.text();
          console.error(`[discord] Error ${res.status}: ${err.slice(0, 200)}`);
        }
      } catch (e) {
        console.error("[discord] Fetch error:", e);
      }
    }

    return {
      channel: this.name,
      success: sent > 0,
      recipients: sent,
      error: sent === 0 ? "No Discord webhooks delivered" : undefined,
    };
  }
}
