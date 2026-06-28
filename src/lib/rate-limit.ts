/**
 * Lightweight per-key rate limiter for public, unauthenticated endpoints
 * (currently just app/api/contact) — backed by the same Upstash Redis
 * instance everything else uses. Fails OPEN (allows the request) if Redis
 * isn't configured or errors, same philosophy as subscribers.ts's listing
 * functions: a missing backing store degrades a feature, it doesn't 500 the
 * whole route.
 */

function getRedisConfig(): { url: string; token: string } | null {
  const url   = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return { url, token };
}

/**
 * Returns true if the request under `key` is allowed (under the limit),
 * false if it should be rejected. Atomically increments a counter with a
 * sliding expiry window via Redis INCR + EXPIRE-if-new.
 */
export async function checkRateLimit(
  key: string,
  max: number,
  windowSeconds: number
): Promise<boolean> {
  const cfg = getRedisConfig();
  if (!cfg) return true; // no Redis configured — don't block on a missing optional feature

  try {
    const { Redis } = await import("@upstash/redis");
    const redis = new Redis({ url: cfg.url, token: cfg.token });
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, windowSeconds);
    }
    return count <= max;
  } catch (e) {
    console.warn("[rate-limit] check failed (failing open):", String(e).slice(0, 100));
    return true;
  }
}

/** Best-effort client IP from Cloudflare/standard proxy headers. */
export function getClientIp(req: Request): string {
  const headers = req.headers;
  return (
    headers.get("cf-connecting-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get("x-real-ip") ??
    "unknown"
  );
}
