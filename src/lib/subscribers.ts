/**
 * Subscriber registry — lets the public register a phone number (for SMS or
 * WhatsApp) or a Telegram account to receive the same alerts that currently
 * go out via the static TELEGRAM_CHAT_IDS / ALERT_TO_NUMBERS env vars, gated
 * by a one-click email approval sent to the site owner.
 *
 * Storage: Upstash Redis (same instance everything else already uses).
 * Schema:
 *   subscriber:<id>            -> JSON Subscriber record
 *   subscriber_token:<token>   -> <id>            (approve/deny lookup)
 *   subscriber_telegram_link:<linkCode> -> <id>   (Telegram /start lookup)
 *   subscribers_index          -> Set<id>          (for listing/sending)
 *
 * No abstraction over storage-manager.ts here on purpose — that module is
 * built around a single "briefing" document with multi-backend failover.
 * Subscribers are many small independent records keyed by id/token, a
 * different access pattern, so this talks to Upstash directly (same as
 * notifiers/manager.ts's cooldown store already does).
 */

import { randomUUID, randomBytes } from "crypto";

export type SubscriberChannel = "telegram" | "whatsapp" | "sms" | "ntfy";

export type SubscriberStatus =
  | "pending_telegram_link"  // Telegram only: waiting for them to hit /start
  | "pending_approval"       // waiting on the site owner's email approval
  | "approved"
  | "denied"
  | "revoked";              // was approved, later revoked via the admin page

export interface Subscriber {
  id: string;
  channel: SubscriberChannel;
  name?: string;
  phone?: string;            // E.164, e.g. +14155551234 — whatsapp/sms only
  email?: string;            // subscriber's email — collected for all channels
  telegramChatId?: string;   // filled in once they /start the bot
  telegramLinkCode?: string; // random code embedded in the t.me deep link
  ntfyTopic?: string;        // server-generated random topic, emailed after approval
  sections?: string[];       // internal sections this subscriber wants alerts for
                             // (expanded from their chosen categories). Empty/
                             // undefined = all (legacy subs predate categories).
  sourceGroups?: string[];   // admin-selected publisher groups; empty/undefined = all
  minAlertScore?: number;    // per-subscriber delivery threshold, 0-100
  status: SubscriberStatus;
  token: string;             // unguessable — used in the approve/deny email links
  createdAt: number;
  approvedAt?: number;
}

function getRedisConfig(): { url: string; token: string } | null {
  const url   = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return { url, token };
}

async function getRedis() {
  const cfg = getRedisConfig();
  if (!cfg) throw new Error("No Redis configured (UPSTASH_REDIS_REST_URL/TOKEN missing)");
  const { Redis } = await import("@upstash/redis");
  return new Redis({ url: cfg.url, token: cfg.token });
}

function newToken(): string {
  return randomBytes(24).toString("base64url");
}

function newLinkCode(): string {
  return randomBytes(8).toString("hex");
}

// ── Create ──────────────────────────────────────────────────────────────────

/** Register a WhatsApp or SMS subscriber — goes straight to pending_approval. */
export async function createPhoneSubscriber(
  channel: "whatsapp" | "sms",
  phone: string,
  name?: string,
  email?: string,
  sections?: string[],
): Promise<Subscriber> {
  const redis = await getRedis();
  const sub: Subscriber = {
    id: randomUUID(),
    channel,
    phone,
    name,
    email,
    sections,
    status: "pending_approval",
    token: newToken(),
    createdAt: Date.now(),
  };
  await redis.set(`subscriber:${sub.id}`, JSON.stringify(sub));
  await redis.set(`subscriber_token:${sub.token}`, sub.id, { ex: 7 * 24 * 3600 });
  await redis.sadd("subscribers_index", sub.id);
  return sub;
}

/** Register an ntfy subscriber — generates a random topic server-side, emailed after approval. */
export async function createNtfySubscriber(
  name?: string,
  email?: string,
  sections?: string[],
): Promise<Subscriber> {
  const redis = await getRedis();
  // Generate a hard-to-guess topic — subscriber gets it emailed after approval
  const ntfyTopic = `gr-${randomBytes(10).toString("hex")}`;
  const sub: Subscriber = {
    id: randomUUID(),
    channel: "ntfy",
    ntfyTopic,
    name,
    email,
    sections,
    status: "pending_approval",
    token: newToken(),
    createdAt: Date.now(),
  };
  await redis.set(`subscriber:${sub.id}`, JSON.stringify(sub));
  await redis.set(`subscriber_token:${sub.token}`, sub.id, { ex: 7 * 24 * 3600 });
  await redis.sadd("subscribers_index", sub.id);
  return sub;
}

/**
 * Register a Telegram subscriber — they don't have a chat_id yet (a bot
 * can't message a phone number, only a chat_id obtained after the user
 * messages the bot first). Returns the record plus the link code to embed
 * in a https://t.me/<bot_username>?start=<linkCode> deep link. The admin
 * approval email is NOT sent yet — see linkTelegramChat() below, which
 * fires it once the chat_id is actually known.
 */
export async function createTelegramSubscriber(name?: string, email?: string, sections?: string[]): Promise<Subscriber> {
  const redis = await getRedis();
  const linkCode = newLinkCode();
  const sub: Subscriber = {
    id: randomUUID(),
    channel: "telegram",
    name,
    email,
    sections,
    telegramLinkCode: linkCode,
    status: "pending_telegram_link",
    token: newToken(),
    createdAt: Date.now(),
  };
  await redis.set(`subscriber:${sub.id}`, JSON.stringify(sub));
  await redis.set(`subscriber_token:${sub.token}`, sub.id, { ex: 7 * 24 * 3600 });
  await redis.set(`subscriber_telegram_link:${linkCode}`, sub.id, { ex: 24 * 3600 });
  await redis.sadd("subscribers_index", sub.id);
  return sub;
}

// ── Lookup ──────────────────────────────────────────────────────────────────

export async function getSubscriber(id: string): Promise<Subscriber | null> {
  const redis = await getRedis();
  const raw = await redis.get<string>(`subscriber:${id}`);
  if (!raw) return null;
  return typeof raw === "string" ? JSON.parse(raw) : (raw as unknown as Subscriber);
}

export async function getSubscriberByToken(token: string): Promise<Subscriber | null> {
  const redis = await getRedis();
  const id = await redis.get<string>(`subscriber_token:${token}`);
  if (!id) return null;
  return getSubscriber(id);
}

export async function getSubscriberByTelegramLinkCode(linkCode: string): Promise<Subscriber | null> {
  const redis = await getRedis();
  const id = await redis.get<string>(`subscriber_telegram_link:${linkCode}`);
  if (!id) return null;
  return getSubscriber(id);
}

async function saveSubscriber(sub: Subscriber): Promise<void> {
  const redis = await getRedis();
  await redis.set(`subscriber:${sub.id}`, JSON.stringify(sub));
}

// ── State transitions ───────────────────────────────────────────────────────

/**
 * Called by the Telegram webhook when a registrant sends /start <linkCode>.
 * Fills in their chat_id and moves them from pending_telegram_link to
 * pending_approval. Returns null if the link code doesn't match any
 * registration (expired, already used, or someone messaging the bot
 * unprompted).
 */
export async function linkTelegramChat(linkCode: string, chatId: string): Promise<Subscriber | null> {
  const sub = await getSubscriberByTelegramLinkCode(linkCode);
  if (!sub || sub.status !== "pending_telegram_link") return null;
  sub.telegramChatId = chatId;
  sub.status = "pending_approval";
  await saveSubscriber(sub);
  return sub;
}

/** Returns null if the token doesn't match a pending record (already acted on, or invalid). */
export async function approveSubscriber(token: string): Promise<Subscriber | null> {
  const redis = await getRedis();
  const claimed = await redis.set(`subscriber_token_claim:${token}`, "1", { nx: true, ex: 60 });
  if (claimed !== "OK") return null;
  const sub = await getSubscriberByToken(token);
  if (!sub || sub.status !== "pending_approval") {
    await redis.del(`subscriber_token_claim:${token}`);
    return null;
  }
  sub.status = "approved";
  sub.approvedAt = Date.now();
  await saveSubscriber(sub);
  await redis.del(`subscriber_token:${token}`);
  await redis.del(`subscriber_token_claim:${token}`);
  return sub;
}

export async function denySubscriber(token: string): Promise<Subscriber | null> {
  const redis = await getRedis();
  const claimed = await redis.set(`subscriber_token_claim:${token}`, "1", { nx: true, ex: 60 });
  if (claimed !== "OK") return null;
  const sub = await getSubscriberByToken(token);
  if (!sub || sub.status !== "pending_approval") {
    await redis.del(`subscriber_token_claim:${token}`);
    return null;
  }
  sub.status = "denied";
  await saveSubscriber(sub);
  await redis.del(`subscriber_token:${token}`);
  await redis.del(`subscriber_token_claim:${token}`);
  return sub;
}

/**
 * Revokes a previously-approved subscriber — used by the admin page
 * (app/admin/subscribers) when the site owner wants to stop alerts to
 * someone who was already approved. Only valid from "approved"; returns
 * null if the id doesn't exist or isn't currently approved (e.g. already
 * revoked, or never approved in the first place).
 */
export async function revokeSubscriber(id: string): Promise<Subscriber | null> {
  const sub = await getSubscriber(id);
  if (!sub || sub.status !== "approved") return null;
  sub.status = "revoked";
  await saveSubscriber(sub);
  return sub;
}

/**
 * Admin override of which sections a subscriber is authorised to receive.
 * `sections` are internal section values (already expanded from categories by
 * the caller). Returns the updated record, or null if the id doesn't exist.
 */
export async function updateSubscriberSections(id: string, sections: string[]): Promise<Subscriber | null> {
  const sub = await getSubscriber(id);
  if (!sub) return null;
  sub.sections = sections;
  await saveSubscriber(sub);
  return sub;
}

/** Admin-only delivery policy. Mandatory alert safety gates are evaluated before this filter. */
export async function updateSubscriberAlertPolicy(
  id: string,
  policy: { sections: string[]; sourceGroups: string[]; minAlertScore: number },
): Promise<Subscriber | null> {
  const sub = await getSubscriber(id);
  if (!sub) return null;
  sub.sections = policy.sections;
  sub.sourceGroups = policy.sourceGroups;
  sub.minAlertScore = policy.minAlertScore;
  await saveSubscriber(sub);
  return sub;
}

/**
 * Permanently deletes a subscriber record — used by the admin page to clean
 * up test/duplicate/junk registrations (e.g. denied or stuck pending_approval
 * rows) that revoke() can't touch since it only works on "approved" records.
 * Unlike revoke, this removes the record entirely rather than changing its
 * status, so it's irreversible. Returns false if the id doesn't exist.
 */
export async function deleteSubscriber(id: string): Promise<boolean> {
  const sub = await getSubscriber(id);
  if (!sub) return false;
  const redis = await getRedis();
  await redis.del(`subscriber:${id}`);
  await redis.del(`subscriber_token:${sub.token}`);
  if (sub.telegramLinkCode) {
    await redis.del(`subscriber_telegram_link:${sub.telegramLinkCode}`);
  }
  await redis.srem("subscribers_index", id);
  return true;
}

// ── Listing (used by notifiers at send time, and by the admin page) ────────

export async function listApprovedByChannel(channel: SubscriberChannel): Promise<Subscriber[]> {
  const cfg = getRedisConfig();
  if (!cfg) return []; // no Redis configured — dynamic subscribers simply unavailable
  try {
    const redis = await getRedis();
    const ids = await redis.smembers("subscribers_index");
    if (!ids || ids.length === 0) return [];
    const all = await Promise.all(ids.map(id => getSubscriber(id)));
    return all.filter((s): s is Subscriber => !!s && s.channel === channel && s.status === "approved");
  } catch (e) {
    console.warn("[subscribers] listApprovedByChannel failed (non-fatal):", String(e).slice(0, 100));
    return [];
  }
}

/** All subscribers regardless of status, newest first — for the admin page. */
export async function listAllSubscribers(): Promise<Subscriber[]> {
  const cfg = getRedisConfig();
  if (!cfg) return [];
  try {
    const redis = await getRedis();
    const ids = await redis.smembers("subscribers_index");
    if (!ids || ids.length === 0) return [];
    const all = await Promise.all(ids.map(id => getSubscriber(id)));
    return all
      .filter((s): s is Subscriber => !!s)
      .sort((a, b) => b.createdAt - a.createdAt);
  } catch (e) {
    console.warn("[subscribers] listAllSubscribers failed (non-fatal):", String(e).slice(0, 100));
    return [];
  }
}
