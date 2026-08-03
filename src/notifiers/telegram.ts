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

import type { Notifier, NotifyResult, NotifyOptions } from "./types";
import { buildAlertKey, type ScoredArticle } from "../lib/alert-scorer";
import { formatAlert, formatDigest }   from "./format";
import { listApprovedByChannel }       from "../lib/subscribers";
import { mergeRecipients } from "../lib/alert-categories";
import { articlesForSubscriber } from "../lib/alert-sources";

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

  async send(articles: ScoredArticle[], appUrl: string, options: NotifyOptions = { defaultMinScore: 65, maxAlertsPerRun: 5 }): Promise<NotifyResult> {
    const token = process.env.TELEGRAM_BOT_TOKEN!;
    const staticChatIds = (process.env.TELEGRAM_CHAT_IDS ?? "")
      .split(",").map(s => s.trim()).filter(Boolean);
    // Dynamic recipients from the public registration flow (app/subscribe),
    // approved one-by-one via the site owner's email. Failure here (e.g.
    // Redis unreachable) must not block the static-list send, hence the catch.
    const approved = await listApprovedByChannel("telegram").catch(() => []);
    const dynamic = approved
      .filter(s => !!s.telegramChatId)
      .map(s => ({ to: s.telegramChatId as string, sections: s.sections, sourceGroups: s.sourceGroups, minAlertScore: s.minAlertScore }));
    // Each recipient carries the sections they subscribed to (env-var chat IDs
    // get everything). Merge + dedupe, then send each only their categories.
    const recipients = mergeRecipients(staticChatIds, dynamic, options.defaultMinScore);
    const digest  = process.env.TELEGRAM_DIGEST_MODE === "true";

    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    let sent = 0;
    const errors: string[] = [];
    const deliveries: { recipient: string; alertKeys: string[] }[] = [];

    if (recipients.length === 0) {
      return {
        channel: this.name,
        success: false,
        recipients: 0,
        error: "No Telegram recipients — set TELEGRAM_CHAT_IDS or link an approved subscriber",
      };
    }

    for (const recipient of recipients) {
      const mine = articlesForSubscriber(articles, recipient)
        .filter(article => options.shouldSend?.(this.id, recipient.to, buildAlertKey(article.article)) ?? true)
        .slice(0, options.maxAlertsPerRun);
      if (mine.length === 0) continue; // nothing in this recipient's categories
      const chatId = recipient.to;
      const messages: string[] = digest
        ? [formatDigest(mine, appUrl).markdown]
        : mine.map(a => formatAlert(a, appUrl).markdown);
      const deliveredKeys: string[] = [];
      for (let messageIndex = 0; messageIndex < messages.length; messageIndex++) {
        const text = messages[messageIndex];
        try {
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id:    chatId,
              text,
              // Telegram's legacy Markdown parser rejects ordinary news text
              // containing unmatched formatting characters. Plain text keeps
              // URLs clickable and prevents one headline from blocking delivery.
              disable_web_page_preview: false,
            }),
          });
          const data = await res.json() as { ok: boolean; description?: string };
          if (data.ok) {
            sent++;
            if (digest) deliveredKeys.push(...mine.map(article => buildAlertKey(article.article)));
            else deliveredKeys.push(buildAlertKey(mine[messageIndex].article));
          } else {
            console.error(`[telegram] chat ${chatId}: ${data.description}`);
            errors.push(data.description ?? `Telegram rejected chat ${chatId}`);
          }
        } catch (e) {
          console.error(`[telegram] chat ${chatId} error:`, e);
          errors.push(String(e));
        }
      }
      if (deliveredKeys.length > 0) deliveries.push({ recipient: chatId, alertKeys: deliveredKeys });
    }

    return {
      channel: this.name,
      success: sent > 0,
      recipients: sent,
      deliveries,
      error: sent === 0 ? (errors[0] ?? "No messages delivered") : undefined,
    };
  }
}
