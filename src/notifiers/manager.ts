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
 *   "first-success" — send via first working channel, stop (default)
 *   "all"           — send via ALL configured channels simultaneously
 */

import type { Notifier, NotifyResult } from "./types";
import type { ScoredArticle }          from "../lib/alert-scorer";
import { buildAlertKey }               from "../lib/alert-scorer";
import { TelegramNotifier }            from "./telegram";
import { NtfyNotifier }                from "./ntfy";
import { DiscordNotifier }             from "./discord";
import { EmailSMSNotifier }            from "./email-sms";
import { TwilioNotifier }              from "./twilio";

// ── Cooldown store (in-memory + persisted to KV) ──────────────────────────────

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

// ── Manager ───────────────────────────────────────────────────────────────────

export interface AlertRunSummary {
  totalAlerts: number;
  sent: number;
  skipped: number;
  results: NotifyResult[];
  channels: string[];
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
    ];
  }

  /** Returns only the notifiers that are actually configured */
  private configured(): Notifier[] {
    const orderEnv = process.env.NOTIFIER_ORDER ?? "";
    const order    = orderEnv
      ? orderEnv.split(",").map(s => s.trim()).filter(Boolean)
      : ["telegram","ntfy","discord","email-sms","twilio"];

    const sorted = [
      ...order.map(id => this.all.find(n => n.id === id)).filter(Boolean) as Notifier[],
      ...this.all.filter(n => !order.includes(n.id)),
    ];

    return sorted.filter(n => n.isConfigured());
  }

  /**
   * Main entry point — called by /api/monitor
   * Applies cooldown, limits, and failover strategy.
   */
  async notify(scored: ScoredArticle[], appUrl = ""): Promise<AlertRunSummary> {
    const summary: AlertRunSummary = {
      totalAlerts: scored.length,
      sent: 0,
      skipped: 0,
      results: [],
      channels: [],
    };

    const channels   = this.configured();
    const strategy   = process.env.NOTIFIER_STRATEGY ?? "first-success";
    const maxPerRun  = Number(process.env.ALERT_MAX_PER_RUN ?? 3);
    const cooldownMs = Number(process.env.ALERT_COOLDOWN_MINUTES ?? 360) * 60 * 1000;
    const now        = Date.now();

    if (channels.length === 0) {
      console.warn("[notifier] No channels configured — set at least one notifier env var");
      return summary;
    }

    // Apply cooldown filter
    const cooldowns = await loadCooldowns();
    const toSend: ScoredArticle[] = [];

    for (const sa of scored) {
      if (toSend.length >= maxPerRun) {
        summary.skipped++;
        continue;
      }
      const key = buildAlertKey(sa.article);
      if (now - (cooldowns[key] ?? 0) < cooldownMs) {
        console.log(`[notifier] Cooldown: "${sa.article.headline.slice(0, 50)}…"`);
        summary.skipped++;
        continue;
      }
      toSend.push(sa);
    }

    if (toSend.length === 0) {
      console.log("[notifier] All articles on cooldown or over limit");
      return summary;
    }

    // Send via channels
    if (strategy === "all") {
      // Send to ALL configured channels in parallel
      const results = await Promise.allSettled(
        channels.map(ch => ch.send(toSend, appUrl))
      );
      results.forEach((r, i) => {
        const result = r.status === "fulfilled"
          ? r.value
          : { channel: channels[i].name, success: false, recipients: 0, error: String((r as PromiseRejectedResult).reason) };
        summary.results.push(result);
        if (result.success) summary.channels.push(result.channel);
      });
    } else {
      // "first-success" — try channels in order, stop at first success
      for (const ch of channels) {
        try {
          console.log(`[notifier] Trying: ${ch.name}`);
          const result = await ch.send(toSend, appUrl);
          summary.results.push(result);
          if (result.success) {
            console.log(`[notifier] ✅ Delivered via ${ch.name}`);
            summary.channels.push(ch.name);
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
    }

    // Mark alerts as sent (update cooldowns)
    const delivered = summary.channels.length > 0;
    if (delivered) {
      toSend.forEach(sa => {
        cooldowns[buildAlertKey(sa.article)] = now;
      });
      await saveCooldowns(cooldowns);
      summary.sent = toSend.length;
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
    return this.all.map(n => ({
      id: n.id, name: n.name, configured: n.isConfigured(),
    }));
  }
}

// Singleton
let _manager: NotifierManager | null = null;
export function getNotifierManager(): NotifierManager {
  if (!_manager) _manager = new NotifierManager();
  return _manager;
}
