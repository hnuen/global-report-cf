import { Redis } from "@upstash/redis";

export async function acquireDistributedLock(key: string, ttlSeconds: number): Promise<{ release: () => Promise<void> } | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  const redis = new Redis({ url, token });
  const owner = crypto.randomUUID();
  const acquired = await redis.set(key, owner, { nx: true, ex: ttlSeconds });
  if (acquired !== "OK") return null;
  return { release: async () => { await redis.eval("if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end", [key], [owner]); } };
}

