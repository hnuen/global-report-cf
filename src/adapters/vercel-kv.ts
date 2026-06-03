// @vercel/kv is deprecated — this adapter now falls back to Upstash gracefully
// If you have Vercel KV env vars set, it will attempt to use the Upstash adapter underneath
import type { StorageAdapter, Briefing } from "../lib/types";
import { getTracker } from "../lib/usage-tracker";

export class VercelKVAdapter implements StorageAdapter {
  id = "vercel-kv" as const;
  name = "Vercel KV (via Upstash)";
  dailyLimit = 0;

  private key = "briefing_v1";

  private async getRedis() {
    const { Redis } = await import("@upstash/redis");
    // Vercel KV uses the same Upstash REST API under the hood
    const url   = process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.KV_REST_API_TOKEN  || process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) throw new Error("No KV/Upstash credentials configured");
    return new Redis({ url, token });
  }

  async load(): Promise<Briefing | null> {
    getTracker().increment("vercel-kv:read");
    try {
      const redis = await this.getRedis();
      const raw = await redis.get<string>(this.key);
      if (!raw) return null;
      return typeof raw === "string" ? JSON.parse(raw) : raw as Briefing;
    } catch (e) {
      throw new Error(`VercelKV.load failed: ${e}`);
    }
  }

  async save(briefing: Briefing): Promise<void> {
    getTracker().increment("vercel-kv:write");
    try {
      const redis = await this.getRedis();
      await redis.set(this.key, JSON.stringify(briefing));
    } catch (e) {
      throw new Error(`VercelKV.save failed: ${e}`);
    }
  }

  async ping(): Promise<number> {
    const start = Date.now();
    const redis = await this.getRedis();
    await redis.ping();
    return Date.now() - start;
  }
}
