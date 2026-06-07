/**
 * UpstashAdapter — direct REST implementation (no SDK).
 *
 * Uses native fetch() with the Upstash REST API directly, matching the same
 * pattern as article-cache.ts. Avoids the @upstash/redis SDK which can fail
 * in Cloudflare Workers when the subrequest budget is partially consumed.
 */
import type { StorageAdapter, Briefing } from "../lib/types";
import { getTracker } from "../lib/usage-tracker";

const KEY = "briefing_v7";

export class UpstashAdapter implements StorageAdapter {
  id = "upstash" as const;
  name = "Upstash Redis";
  dailyLimit = 10_000;

  private get url()   { return process.env.UPSTASH_REDIS_REST_URL  ?? ""; }
  private get token() { return process.env.UPSTASH_REDIS_REST_TOKEN ?? ""; }

  private async restGet<T>(key: string): Promise<T | null> {
    if (!this.url || !this.token) throw new Error("Upstash env vars not set");
    const res = await fetch(`${this.url}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${this.token}` },
    });
    if (!res.ok) throw new Error(`Upstash GET ${res.status}: ${await res.text()}`);
    const data = await res.json() as { result: string | null };
    if (!data.result) return null;
    return JSON.parse(data.result) as T;
  }

  private async restSet(key: string, value: string): Promise<void> {
    if (!this.url || !this.token) throw new Error("Upstash env vars not set");
    // Use pipeline for atomic SET (single subrequest)
    const