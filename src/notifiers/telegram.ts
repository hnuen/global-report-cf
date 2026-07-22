/**
 * Telegram Bot Notifier — completely free, no limits
 *
 * Setup (5 minutes):
 *   1. Open Telegram → search @BotFather → send /newbot
 *   2. Follow prompts → BotFather gives you a BOT_TOKEN
 *   3. Open your new bot → send it any message (e.g. "hello")
 *   4. Visit: https://api.telegram.org/bot<BOT_TOKEN>/getUpdates
 *      Copy the "id" from result[0].message.chat.id — that's your CHAT_ID
 *   5. For group alerts: add bot to a group, send a message, repeat step 4
 *
 * Environment variables:
 *   TELEGRAM_BOT_TOKEN   — from BotFather, e.g. 123456:ABC-DEF...
 *   TELEGRAM_CHAT_IDS    — comma-separated chat/user IDs, e.g. 123456789,-987654321
 *   TELEGRAM_DIGEST_MODE — "true" = one message per run instead of one per article
 */

import type { Notifier, NotifyResult } from "./types";
import type { ScoredArticle }          from "../lib/alert-scorer";
import { formatAlert, formatDigest }   from "./format";
import { listApprovedByChannel }       from "../lib/subscribers";
import { mergeRecipients, articlesForSections } from "../lib/alert-categories";

export class TelegramNotifier implements Notifier {
  id   = "telegram";
  name = "Telegram Bot";

  isConfigured(): boolean {
    // TELEGRAM_CHAT_IDS is no longer required on its own — the public
    // /subscribe registration flow can supply chat IDs dynamically via
    // Redis (see listApprovedByChannel below), so a bot token alone is
    // enough to be "configured." Static TELEGRAM_CHAT_IDS still works and
    // is merged in at send time.
    return !!process.env.TELEGRAM_BOT_TOKEN;
  }

  async send(articles: ScoredArticle[], appUrl: string): Promise<NotifyResult> {
    const token = process.env.TELEGRAM_BOT_TOKEN!;
    const staticChatIds = (process.env.TELEGRAM_CHAT_IDS ?? "")
      .split(",").map(s => s.trim()).filter(Boolean);
    // Dynamic recipients from the public registration flow (app/subscribe),
    // approved one-by-one via the site owner's email. Failure here (e.g.
    // Redis unreachable) must not block the static-list send, hence the catch.
    const approved = await listApprovedByChannel("telegram").catch(() => []);
    const dynamic = approved
      .filter(s => !!s.telegramChatId)
      .map(s => ({ to: s.telegramChatId as string, sections: s.sections }));
    // Each recipient carries the sections they subscribed to (env-var chat IDs
    // get everything). Merge + dedupe, then send each only their categories.
    const recipients = mergeRecipients(staticChatIds, dynamic);
    const digest  = process.env.TELEGRAM_DIGEST_MODE === "true";

    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    let sent = 0;

    for (const recipient of recipients) {
      const mine = articlesForSections(articles, recipient.sections);
      if (mine.length === 0) continue; // nothing in this recipient's categories
      const chatId = recipient.to;
      const messages: string[] = digest
        ? [formatDigest(mine, appUrl).markdown]
        : mine.map(a => formatAlert(a, appUrl).markdown);
      for (const text of messages) {
        try {
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id:    chatId,
              text,
              parse_mode: "Markdown",
              disable_web_page_preview: false,
            }),
          });
          const data = await res.json() as { ok: boolean; description?: string };
          if (data.ok) {
            sent++;
          } else {
            console.error(`[telegram] chat ${chatId}: ${data.description}`);
          }
        } catch (e) {
          console.error(`[telegram] chat ${chatId} error:`, e);
        }
      }
    }

    return {
      channel: this.name,
      success: sent > 0,
      recipients: sent,
      error: sent === 0 ? "No messages delivered" : undefined,
    };
  }
}
