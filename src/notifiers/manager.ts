/**
 * NotifierManager
 *
 * Manages all notification channels with:
 *  - Automatic failover: if channel 1 fails, tries channel 2, 3, etc.
 *  - Configurable strategy: "first-success" or "all" (send to all configured channels)
 *  - Deduplication: tracks sent article keys to avoid repeat alerts (with cooldown)
 *  - Per-run limit: caps total alerts per cron run to prevent spam
 *
 * Channel priority order (configured via NOTIFIER_ORDER env var):
 *   Default: telegram,ntfy,discord,email-sms,twilio
 *   Example: NOTIFIER_ORDER=ntfy,telegram,discord
 *
 * Strategy (NOTIFIER_STRATEGY env var):
 *   "first-success" â€” send via first working channel, stop (default)
 *   "all"           â€” send via ALL configured channels simultaneously
 */

import type { Notifier, NotifyResult } from "./types";
import type { ScoredArticle }          from "../lib/alert-scorer";
import { buildAlertKey }               from "../lib/alert-scorer";
import { TelegramNotifier }            from "./telegram";
import { NtfyNotifier }                from "./ntfy";
import { DiscordNotifier }             from "./discord";
import { EmailSMSNotifier }            from "./email-sms";
import { TwilioNotifier }              from "./twilio";
import { WhatsAppNotifier }            from "./whatsapp";
import { listApprovedByChannel, type SubscriberChannel } from "../lib/subscribers";

// Maps a notifier's `id` to the subscriber channel it can serve dynamic,
// self-registered recipients for (app/subscribe). Channels not in this map
// (ntfy, discord, email-sms) only ever serve the site owner's static env-var
// recipient lists.
const SUBSCRIBER_CHANNEL_BY_NOTIFIER_ID: Record<string, SubscriberChannel> = {
  telegram: "telegram",
  twilio:   "sms",
  whatsapp: "whatsapp",
  ntfy:     "ntfy",
};

// â”€â”€ Cooldown store (in-memory + persisted to KV) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const COOLDOWN_KEY = "alert_cooldowns_v2";
let _cooldowns: Record<string, number> = {};
let _cooldownsLoaded = false;

async function loadCooldowns(): Promise<Record<string, number>> {
  if (_cooldownsLoaded) return _cooldowns;
  try {
    const url   = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
    if (url && token) {
      const { Redis } = await import("@upstash/redis");
      const redis = new Redis({ url, token });
      const raw = await redis.get<string>(COOLDOWN_KEY);
      if (raw) _cooldowns = typeof raw === "string" ? JSON.parse(raw) : raw as Record<string, number>;
    }
  } catch (e) {
    console.warn("[notifier] Could not load cooldowns:", e);
  }
  _cooldownsLoaded = true;
  return _cooldowns;
}

async function saveCooldowns(c: Record<string, number>): Promise<void> {
  _cooldowns = c;
  try {
    const payload = JSON.stringify(c);
    const url   = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
    if (url && token) {
      const { Redis } = await import("@upstash/redis");
      const redis = new Redis({ url, token });
      await redis.set(COOLDOWN_KEY, payload);
    }
  } catch (e) {
    console.warn("[notifier] Could not save cooldowns:", e);
  }
}

// â”€â”€ Manager â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface AlertRunSummary {
  totalAlerts: number;
  sent: number;
  skipped: number;
  results: NotifyResult[];
  channels: string[];
  deliveredAlertKeys: string[];
}

export class NotifierManager {
  private all: Notifier[];

  constructor() {
    this.all = [
      new TelegramNotifier(),
      new NtfyNotifier(),
      new DiscordNotifier(),
      new EmailSMSNotifier(),
      new TwilioNotifier(),
      new WhatsAppNotifier(),
    ];
  }

  private enabledIds(): string[] {
    return (process.env.NOTIFIER_ENABLED ?? "telegram,ntfy")
      .split(",").map(id => id.trim()).filter(Boolean);
  }

  /** Returns only explicitly enabled notifiers that are configured. */
  private configured(): Notifier[] {
    const enabled = this.enabledIds();
    const orderEnv = process.env.NOTIFIER_ORDER ?? "";
    const order    = orderEnv
      ? orderEnv.split(",").map(s => s.trim()).filter(Boolean)
      : ["telegram","ntfy","discord","email-sms","twilio","whatsapp"];

    const sorted = [
      ...order.map(id => this.all.find(n => n.id === id)).filter(Boolean) as Notifier[],
      ...this.all.filter(n => !order.includes(n.id)),
    ];

    return sorted.filter(n => enabled.includes(n.id) && n.isConfigured());
  }

  /**
   * Main entry point â€” called by /api/monitor
   * Applies cooldown, limits, and failover strategy.
   */
  async notify(scored: ScoredArticle[], appUrl = "", defaultMinScore = 65, maxPerRun = 5): Promise<AlertRunSummary> {
    const summary: AlertRunSummary = {
      totalAlerts: scored.length,
      sent: 0,
      skipped: 0,
      results: [],
      channels: [],
      deliveredAlertKeys: [],
    };

    const channels   = this.configured();
    const strategy   = process.env.NOTIFIER_STRATEGY ?? "all";
    // Default raised from 360 (6h) to 10080 (7 days) â€” kept in sync with the
    // same env var's default in app/api/monitor/route.ts. See the comment
    // there: a short cooldown let the same old cached article re-alert every
    // few hours indefinitely.
    const cooldownMs = Number(process.env.ALERT_COOLDOWN_MINUTES ?? 10080) * 60 * 1000;
    const now        = Date.now();

    if (channels.length === 0) {
      console.warn("[notifier] No channels configured â€” set at least one notifier env var");
      return summary;
    }

    // Recipient-capable channels apply cooldowns inside each notifier, after
    // the recipient's own score/source preferences have been evaluated.
    const cooldowns = await loadCooldowns();
    const toSend: ScoredArticle[] = [...scored];
    if (toSend.length === 0) {
      console.log("[notifier] All articles on cooldown or over limit");
      return summary;
    }

    const articlesForChannel = (channel: Notifier) => {
      if (SUBSCRIBER_CHANNEL_BY_NOTIFIER_ID[channel.id]) return toSend;
      return toSend
        .filter(article => article.score >= defaultMinScore)
        .filter(article => now - (cooldowns[`static:${buildAlertKey(article.article)}`] ?? 0) >= cooldownMs)
        .slice(0, maxPerRun);
    };
    const deliveredKeys = new Set<string>();
    const notifyOptions = {
      defaultMinScore,
      maxAlertsPerRun: maxPerRun,
      shouldSend: (notifierId: string, recipient: string, alertKey: string) =>
        now - (cooldowns[`recipient:${notifierId}:${recipient}:${alertKey}`] ?? 0) >= cooldownMs,
    };
    const recordDeliveries = (result: NotifyResult, channel: Notifier) => {
      if (result.deliveries?.length) {
        for (const delivery of result.deliveries) {
          for (const key of delivery.alertKeys) {
            cooldowns[`recipient:${channel.id}:${delivery.recipient}:${key}`] = now;
            deliveredKeys.add(key);
          }
        }
        return;
      }
      if (result.success) {
        for (const article of articlesForChannel(channel)) {
          const key = buildAlertKey(article.article);
          cooldowns[`static:${key}`] = now;
          deliveredKeys.add(key);
        }
      }
    };

    // Send via channels
    if (strategy === "all") {
      // Send to ALL configured channels in parallel
      const results = await Promise.allSettled(
        channels.map(ch => ch.send(articlesForChannel(ch), appUrl, notifyOptions))
      );
      results.forEach((r, i) => {
        const result = r.status === "fulfilled"
          ? r.value
          : { channel: channels[i].name, success: false, recipients: 0, error: String((r as PromiseRejectedResult).reason) };
        summary.results.push(result);
        if (result.success) {
          summary.channels.push(result.channel);
          recordDeliveries(result, channels[i]);
        }
      });
    } else {
      // "first-success" was designed for redundant fallback delivery to the
      // SAME person (the site owner) across multiple methods â€” stop once
      // one works. But telegram/twilio/whatsapp can now also carry
      // dynamically self-registered subscribers (app/subscribe) who are
      // genuinely different people, not fallback paths for each other. If
      // those channels were left in the ordinary fallback chain, the chain
      // would stop at e.g. Telegram and silently never reach a WhatsApp- or
      // SMS-only subscriber. So: any channel with at least one approved
      // dynamic subscriber is always sent to, separate from the fallback
      // chain among the rest.
      const dynamicChannelFlags = await Promise.all(
        channels.map(async ch => {
          const subChannel = SUBSCRIBER_CHANNEL_BY_NOTIFIER_ID[ch.id];
          if (!subChannel) return false;
          const approved = await listApprovedByChannel(subChannel).catch(() => []);
          return approved.length > 0;
        })
      );
      const alwaysSendChannels = channels.filter((_, i) => dynamicChannelFlags[i]);
      const fallbackChannels   = channels.filter((_, i) => !dynamicChannelFlags[i]);

      for (const ch of fallbackChannels) {
        try {
          console.log(`[notifier] Trying: ${ch.name}`);
          const result = await ch.send(articlesForChannel(ch), appUrl, notifyOptions);
          summary.results.push(result);
          if (result.success) {
            console.log(`[notifier] âœ… Delivered via ${ch.name}`);
            summary.channels.push(ch.name);
            recordDeliveries(result, ch);
            break;
          } else {
            console.warn(`[notifier] ${ch.name} returned failure: ${result.error}`);
          }
        } catch (e) {
          console.error(`[notifier] ${ch.name} threw:`, e);
          summary.results.push({
            channel: ch.name, success: false, recipients: 0, error: String(e),
          });
        }
      }

      for (const ch of alwaysSendChannels) {
        try {
          console.log(`[notifier] Sending to subscriber channel: ${ch.name}`);
          const result = await ch.send(articlesForChannel(ch), appUrl, notifyOptions);
          summary.results.push(result);
          if (result.success) {
            summary.channels.push(ch.name);
            recordDeliveries(result, ch);
          } else {
            console.warn(`[notifier] ${ch.name} returned failure: ${result.error}`);
          }
        } catch (e) {
          console.error(`[notifier] ${ch.name} threw:`, e);
          summary.results.push({
            channel: ch.name, success: false, recipients: 0, error: String(e),
          });
        }
      }
    }

    // Mark alerts as sent (update cooldowns)
    const delivered = summary.channels.length > 0;
    if (delivered) {
      deliveredKeys.forEach(key => summary.deliveredAlertKeys.push(key));
      await saveCooldowns(cooldowns);
      summary.sent = deliveredKeys.size;
    }

    // Clean up old cooldown entries (older than 7 days)
    const cutoff = now - 7 * 24 * 60 * 60 * 1000;
    Object.keys(cooldowns).forEach(k => {
      if (cooldowns[k] < cutoff) delete cooldowns[k];
    });

    return summary;
  }

  /** List which channels are configured (for /api/health) */
  status(): { id: string; name: string; configured: boolean }[] {
    const enabled = this.enabledIds();
    return this.all.map(n => ({
      id: n.id, name: n.name, configured: enabled.includes(n.id) && n.isConfigured(),
    }));
  }
}

// Singleton
let _manager: NotifierManager | null = null;
export function getNotifierManager(): NotifierManager {
  if (!_manager) _manager = new NotifierManager();
  return _manager;
}

