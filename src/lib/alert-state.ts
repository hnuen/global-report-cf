import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { D1Database } from "@cloudflare/workers-types";

type SetOptions = { ex?: number; nx?: boolean };

async function d1(): Promise<D1Database | null> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return env.ALERT_DB ?? null;
  } catch {
    return null;
  }
}

async function redis() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  const { Redis } = await import("@upstash/redis");
  return new Redis({ url, token });
}

export async function alertStateBackend(): Promise<"d1" | "redis" | "none"> {
  return await d1() ? "d1" : await redis() ? "redis" : "none";
}

export async function alertStateGet(key: string): Promise<string | null> {
  const db = await d1();
  if (db) {
    const now = Math.floor(Date.now() / 1000);
    const row = await db.prepare(
      "SELECT value FROM alert_state WHERE key = ?1 AND (expires_at IS NULL OR expires_at > ?2)",
    ).bind(key, now).first<{ value: string }>();
    return row?.value ?? null;
  }
  const fallback = await redis();
  if (!fallback) return null;
  const value = await fallback.get<unknown>(key);
  if (value === null || value === undefined) return null;
  return typeof value === "string" ? value : JSON.stringify(value);
}

export async function alertStateMGet(keys: string[]): Promise<(string | null)[]> {
  if (keys.length === 0) return [];
  const db = await d1();
  if (db) {
    const now = Math.floor(Date.now() / 1000);
    const rows = await db.batch(keys.map(key => db.prepare(
      "SELECT value FROM alert_state WHERE key = ?1 AND (expires_at IS NULL OR expires_at > ?2)",
    ).bind(key, now)));
    return rows.map(result => (result.results[0] as { value?: string } | undefined)?.value ?? null);
  }
  const fallback = await redis();
  if (!fallback) return keys.map(() => null);
  const values = await fallback.mget<unknown[]>(...keys);
  return values.map(value => value == null ? null : typeof value === "string" ? value : JSON.stringify(value));
}

export async function alertStateSet(key: string, value: string, options: SetOptions = {}): Promise<boolean> {
  const db = await d1();
  if (db) {
    const expiresAt = options.ex ? Math.floor(Date.now() / 1000) + options.ex : null;
    const statement = options.nx
      ? db.prepare("INSERT INTO alert_state (key, value, expires_at) VALUES (?1, ?2, ?3) ON CONFLICT(key) DO UPDATE SET value = excluded.value, expires_at = excluded.expires_at WHERE alert_state.expires_at IS NOT NULL AND alert_state.expires_at <= ?4")
          .bind(key, value, expiresAt, Math.floor(Date.now() / 1000))
      : db.prepare("INSERT INTO alert_state (key, value, expires_at) VALUES (?1, ?2, ?3) ON CONFLICT(key) DO UPDATE SET value = excluded.value, expires_at = excluded.expires_at")
          .bind(key, value, expiresAt);
    const result = await statement.run();
    return (result.meta.changes ?? 0) > 0;
  }
  const fallback = await redis();
  if (!fallback) throw new Error("Alert state storage is not configured");
  const result = options.nx && options.ex
    ? await fallback.set(key, value, { nx: true, ex: options.ex })
    : options.nx
      ? await fallback.set(key, value, { nx: true })
      : options.ex
        ? await fallback.set(key, value, { ex: options.ex })
        : await fallback.set(key, value);
  return result === "OK";
}

export async function alertStateDelete(key: string): Promise<void> {
  const db = await d1();
  if (db) {
    await db.prepare("DELETE FROM alert_state WHERE key = ?1").bind(key).run();
    return;
  }
  await (await redis())?.del(key);
}

export async function alertStateDeleteIfValue(key: string, value: string): Promise<void> {
  const db = await d1();
  if (db) {
    await db.prepare("DELETE FROM alert_state WHERE key = ?1 AND value = ?2").bind(key, value).run();
    return;
  }
  const fallback = await redis();
  if (!fallback) return;
  await fallback.eval(
    "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
    [key],
    [value],
  );
}

export async function alertStateIncrement(key: string, windowSeconds: number): Promise<number> {
  const db = await d1();
  if (db) {
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + windowSeconds;
    const row = await db.prepare(
      "INSERT INTO alert_state (key, value, expires_at) VALUES (?1, '1', ?2) " +
      "ON CONFLICT(key) DO UPDATE SET " +
      "value = CASE WHEN alert_state.expires_at IS NULL OR alert_state.expires_at <= ?3 THEN '1' ELSE CAST(CAST(alert_state.value AS INTEGER) + 1 AS TEXT) END, " +
      "expires_at = CASE WHEN alert_state.expires_at IS NULL OR alert_state.expires_at <= ?3 THEN ?2 ELSE alert_state.expires_at END " +
      "RETURNING value",
    ).bind(key, expiresAt, now).first<{ value: string }>();
    return Number(row?.value ?? 1);
  }
  const fallback = await redis();
  if (!fallback) throw new Error("Alert state storage is not configured");
  const count = await fallback.incr(key);
  if (count === 1) await fallback.expire(key, windowSeconds);
  return count;
}

export async function alertStateSetAdd(setKey: string, member: string): Promise<void> {
  const db = await d1();
  if (db) {
    await db.prepare("INSERT OR IGNORE INTO alert_set_members (set_key, member) VALUES (?1, ?2)").bind(setKey, member).run();
    return;
  }
  await (await redis())?.sadd(setKey, member);
}

export async function alertStateSetRemove(setKey: string, member: string): Promise<void> {
  const db = await d1();
  if (db) {
    await db.prepare("DELETE FROM alert_set_members WHERE set_key = ?1 AND member = ?2").bind(setKey, member).run();
    return;
  }
  await (await redis())?.srem(setKey, member);
}

export async function alertStateSetMembers(setKey: string): Promise<string[]> {
  const db = await d1();
  if (db) {
    const result = await db.prepare("SELECT member FROM alert_set_members WHERE set_key = ?1").bind(setKey).all<{ member: string }>();
    return result.results.map(row => row.member);
  }
  return await (await redis())?.smembers(setKey) ?? [];
}
