import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { D1Database } from "@cloudflare/workers-types";
import type { Briefing, StorageAdapter } from "../lib/types";
import { getTracker } from "../lib/usage-tracker";

const KEY = "briefing:live:v1";

async function database(): Promise<D1Database> {
  const { env } = await getCloudflareContext({ async: true });
  if (!env.ALERT_DB) throw new Error("ALERT_DB binding is unavailable");
  return env.ALERT_DB;
}

export class D1Adapter implements StorageAdapter {
  id = "cloudflare-d1" as const;
  name = "Cloudflare D1";
  dailyLimit = 0;

  async load(): Promise<Briefing | null> {
    getTracker().increment("cloudflare-d1:read");
    const db = await database();
    const now = Math.floor(Date.now() / 1000);
    const row = await db.prepare(
      "SELECT value FROM alert_state WHERE key = ?1 AND (expires_at IS NULL OR expires_at > ?2)",
    ).bind(KEY, now).first<{ value: string }>();
    return row?.value ? JSON.parse(row.value) as Briefing : null;
  }

  async save(briefing: Briefing): Promise<void> {
    getTracker().increment("cloudflare-d1:write");
    const db = await database();
    await db.prepare(
      "INSERT INTO alert_state (key, value, expires_at) VALUES (?1, ?2, NULL) " +
      "ON CONFLICT(key) DO UPDATE SET value = excluded.value, expires_at = NULL",
    ).bind(KEY, JSON.stringify(briefing)).run();
  }

  async ping(): Promise<number> {
    const start = Date.now();
    await (await database()).prepare("SELECT 1").first();
    return Date.now() - start;
  }
}
