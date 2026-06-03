import type { StorageAdapter, Briefing, PlatformHealth, PlatformId } from "./types";
import { getTracker } from "./usage-tracker";

const HEALTH_TTL_MS = 60_000; // re-check health at most once per minute

export class StorageManager {
  private adapters: StorageAdapter[];
  private health: Map<PlatformId, PlatformHealth> = new Map();

  constructor(adapters: StorageAdapter[]) {
    this.adapters = adapters;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Load briefing — tries each adapter in order, skips over-limit or unhealthy ones.
   * Returns null only if every adapter fails.
   */
  async load(): Promise<Briefing | null> {
    const errors: string[] = [];

    for (const adapter of this.adapters) {
      if (this.isSkippable(adapter, "read")) {
        errors.push(`${adapter.name}: skipped (limit/unhealthy)`);
        continue;
      }
      try {
        const result = await adapter.load();
        this.markHealthy(adapter);
        return result;
      } catch (err) {
        const msg = String(err);
        console.error(`[storage] ${adapter.name} load failed: ${msg}`);
        this.markUnhealthy(adapter, msg);
        errors.push(`${adapter.name}: ${msg}`);
      }
    }

    console.error("[storage] All adapters failed to load:\n" + errors.join("\n"));
    return null;
  }

  /**
   * Save briefing — writes to ALL available adapters (for redundancy).
   * Logs but does not throw if some fail.
   */
  async save(briefing: Briefing): Promise<void> {
    const results = await Promise.allSettled(
      this.adapters
        .filter(a => !this.isSkippable(a, "write"))
        .map(async a => {
          await a.save(briefing);
          this.markHealthy(a);
          console.log(`[storage] Saved to ${a.name}`);
        })
    );

    const failures = results.filter(r => r.status === "rejected");
    failures.forEach((r, i) => {
      const adapter = this.adapters[i];
      const msg = (r as PromiseRejectedResult).reason?.message ?? String(r);
      console.error(`[storage] Failed to save to ${adapter?.name}: ${msg}`);
      if (adapter) this.markUnhealthy(adapter, msg);
    });

    if (failures.length === results.length) {
      throw new Error("All storage adapters failed to save briefing");
    }
  }

  /** Return current health of all adapters (for /api/health endpoint) */
  getHealth(): PlatformHealth[] {
    return this.adapters.map(a => {
      const h = this.health.get(a.id);
      const tracker = getTracker();
      return {
        id: a.id,
        healthy: h?.healthy ?? true,
        latencyMs: h?.latencyMs ?? 0,
        lastError: h?.lastError,
        dailyReads:  tracker.get(`${a.id}:read`),
        dailyWrites: tracker.get(`${a.id}:write`),
        dailyLimit:  a.dailyLimit,
        lastChecked: h?.lastChecked ?? 0,
      };
    });
  }

  // ── Internal helpers ───────────────────────────────────────────────────────

  private isSkippable(adapter: StorageAdapter, op: "read" | "write"): boolean {
    const tracker = getTracker();
    const h = this.health.get(adapter.id);

    // Skip if over daily limit
    const usageKey = `${adapter.id}:${op}`;
    if (tracker.isOverLimit(usageKey, adapter.dailyLimit)) return true;

    // Skip if recently unhealthy (but retry after TTL)
    if (h && !h.healthy) {
      const age = Date.now() - h.lastChecked;
      if (age < HEALTH_TTL_MS) return true;
    }

    return false;
  }

  private markHealthy(adapter: StorageAdapter): void {
    this.health.set(adapter.id, {
      id: adapter.id,
      healthy: true,
      latencyMs: 0,
      dailyReads: 0,
      dailyWrites: 0,
      dailyLimit: adapter.dailyLimit,
      lastChecked: Date.now(),
    });
  }

  private markUnhealthy(adapter: StorageAdapter, error: string): void {
    this.health.set(adapter.id, {
      id: adapter.id,
      healthy: false,
      latencyMs: 0,
      lastError: error,
      dailyReads: 0,
      dailyWrites: 0,
      dailyLimit: adapter.dailyLimit,
      lastChecked: Date.now(),
    });
  }
}

// ── Build storage manager from environment ────────────────────────────────────

export async function buildStorageManager(): Promise<StorageManager> {
  const adapters: StorageAdapter[] = [];

  // Vercel KV — available when deployed on Vercel
  if (process.env.KV_REST_API_URL || process.env.KV_URL) {
    const { VercelKVAdapter } = await import("../adapters/vercel-kv");
    adapters.push(new VercelKVAdapter());
    console.log("[storage] Registered: Vercel KV");
  }

  // Upstash Redis — available on any platform (Vercel, Railway, Cloudflare, etc.)
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    const { UpstashAdapter } = await import("../adapters/upstash");
    adapters.push(new UpstashAdapter());
    console.log("[storage] Registered: Upstash Redis");
  }

  // Memory fallback — always last
  const { MemoryAdapter } = await import("../adapters/memory");
  adapters.push(new MemoryAdapter());
  console.log("[storage] Registered: Memory (fallback)");

  if (adapters.length === 1) {
    console.warn("[storage] WARNING: Only in-memory storage available — data will be lost on restart");
  }

  return new StorageManager(adapters);
}
