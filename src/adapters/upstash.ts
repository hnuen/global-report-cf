import type { StorageAdapter, Briefing } from "../lib/types";
import { getTracker } from "../lib/usage-tracker";

export class UpstashAdapter implements StorageAdapter {
  id = "upstash" as const;
  name = "Upstash Redis";
  dailyLimit = 10_000; // free tier limit

  private key = "briefing_v7"; // v2: removed bad OFAC/State Dept sources

  private async getRedis() {
    const { Redis } = await import("@upstash/redis");
    return new Redis({
      url:   process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }

  async load(): Promise<Briefing | null> {
    const tracker = getTracker();
    tracker.increment("upstash:read");
    try {
      const redis = await this.getRedis();
      const raw = await redis.get<string>(this.key);
      if (!raw) return null;
      return typeof raw === "string" ? JSON.parse(raw) : raw as Briefing;
    } catch (e) {
      throw new Error(`Upstash.load failed: ${e}`);
    }
  }

  async save(briefing: Briefing): Promise<void> {
    const tracker = getTracker();
    tracker.increment("upstash:write");
    try {
      const redis = await this.getRedis();
      await redis.set(this.key, JSON.stringify(briefing));
    } catch (e) {
      throw new Error(`Upstash.save failed: ${e}`);
    }
  }

  async ping(): Promise<number> {
    const start = Date.now();
    const redis = await this.getRedis();
    await redis.ping();
    return Date.now() - start;
  }
}
