function getRedisConfig(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

export async function checkRateLimit(
  key: string,
  max: number,
  windowSeconds: number,
  options: { failClosed?: boolean } = {},
): Promise<boolean> {
  const cfg = getRedisConfig();
  if (!cfg) return !options.failClosed;

  try {
    const { Redis } = await import("@upstash/redis");
    const redis = new Redis({ url: cfg.url, token: cfg.token });
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, windowSeconds);
    return count <= max;
  } catch (error) {
    console.warn(`[rate-limit] check failed (${options.failClosed ? "failing closed" : "failing open"}):`, String(error).slice(0, 100));
    return !options.failClosed;
  }
}

/** Cloudflare overwrites this header at the trusted edge; ignore spoofable forwarded headers. */
export function getClientIp(req: Request): string {
  return req.headers.get("cf-connecting-ip") ?? "unknown";
}
