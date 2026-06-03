/**
 * UsageTracker
 * Counts daily reads, writes, and LLM calls per platform.
 * Resets at midnight UTC. Persisted to a lightweight JSON string
 * so it survives process restarts (written alongside the briefing).
 */

interface DayBucket {
  date: string;           // "YYYY-MM-DD"
  counts: Record<string, number>;
}

export class UsageTracker {
  private bucket: DayBucket;

  constructor(serialised?: string) {
    const today = utcDate();
    if (serialised) {
      try {
        const parsed: DayBucket = JSON.parse(serialised);
        this.bucket = parsed.date === today ? parsed : { date: today, counts: {} };
        return;
      } catch { /* fall through */ }
    }
    this.bucket = { date: today, counts: {} };
  }

  /** Increment a counter key (e.g. "vercel-kv:read", "anthropic:llm") */
  increment(key: string, by = 1): void {
    this.rolloverIfNewDay();
    this.bucket.counts[key] = (this.bucket.counts[key] ?? 0) + by;
  }

  get(key: string): number {
    this.rolloverIfNewDay();
    return this.bucket.counts[key] ?? 0;
  }

  /** True if key is over its limit. limit=0 means unlimited. */
  isOverLimit(key: string, limit: number): boolean {
    if (limit === 0) return false;
    return this.get(key) >= limit;
  }

  serialise(): string {
    return JSON.stringify(this.bucket);
  }

  private rolloverIfNewDay(): void {
    const today = utcDate();
    if (this.bucket.date !== today) {
      this.bucket = { date: today, counts: {} };
    }
  }
}

function utcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

// Singleton — shared across the process
let _tracker: UsageTracker | null = null;

export function getTracker(serialised?: string): UsageTracker {
  if (!_tracker) _tracker = new UsageTracker(serialised);
  return _tracker;
}

export function resetTrackerForTest(): void {
  _tracker = null;
}
