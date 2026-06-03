import type { StorageAdapter, Briefing } from "../lib/types";

// In-memory store — used as last-resort fallback when all persistent stores fail.
// Data is lost on process restart but keeps the app running.

let _cached: Briefing | null = null;

export class MemoryAdapter implements StorageAdapter {
  id = "memory" as const;
  name = "In-Memory (fallback)";
  dailyLimit = 0; // unlimited — it's just RAM

  async load(): Promise<Briefing | null> {
    return _cached;
  }

  async save(briefing: Briefing): Promise<void> {
    _cached = briefing;
  }

  async ping(): Promise<number> {
    return 0; // always instant
  }
}
