// ── Briefing data types ───────────────────────────────────────────────────────

export type Section = "sanctions" | "economics" | "regions" | "occ" | "penalties" | "bis";
export type Impact  = "high" | "medium" | "low";

export interface Article {
  id: number;
  section: Section;
  category: string;
  region: string;
  impact: Impact;
  date: string;
  headline: string;
  body: string[];        // array of paragraphs
  source: string;
  sourceUrl: string;
  // Set to true for articles produced by the Gemini/LLM path.
  // These are display-only and must never trigger push/Telegram alerts because
  // the LLM can hallucinate plausible-looking URLs that are 404s on real sites.
  aiGenerated?: boolean;
}

export interface WatchItem  { entity: string; type: string; note: string; }
export interface KeyFigure  { label: string;  value: string; }
export interface SidebarSection { watchlist: WatchItem[]; keyFigures: KeyFigure[]; }

export interface Briefing {
  lastUpdated: string;
  // ISO-8601 UTC instant the briefing was actually stamped, set alongside
  // `lastUpdated` by every producer (gemini-provider.ts, official-briefing.ts,
  // local-analyzer.ts, background-refresh route, refresh-briefing.mjs). The
  // free-form `lastUpdated` string is built independently by each of those
  // paths in whatever timezone/format that path happened to use (some UTC,
  // some America/New_York) — which is why the displayed banner used to
  // visibly change format/timezone depending on which path last wrote the
  // briefing. This field is the single unambiguous source of truth the
  // client formats in the *viewer's own* local timezone via
  // toLocaleString() — correct for any visitor, not just one hardcoded zone.
  // Optional for backward compatibility with already-cached briefings saved
  // before this field existed.
  lastUpdatedIso?: string;
  articles: Article[];
  sidebar: Record<Section, SidebarSection>;
}

// ── Platform health / failover types ─────────────────────────────────────────

export type PlatformId = "upstash" | "cloudflare-kv" | "memory";

export interface PlatformHealth {
  id: PlatformId;
  healthy: boolean;
  latencyMs: number;
  lastError?: string;
  dailyReads: number;
  dailyWrites: number;
  dailyLimit: number;       // 0 = unlimited
  lastChecked: number;      // Unix ms
}

export interface StorageAdapter {
  id: PlatformId;
  name: string;
  dailyLimit: number;
  load(): Promise<Briefing | null>;
  save(briefing: Briefing): Promise<void>;
  ping(): Promise<number>;  // returns latency ms, throws on failure
}

export interface LLMProvider {
  id: string;
  name: string;
  dailyLimit: number;        // requests per day, 0 = unlimited
  fetch(topic?: string, officialContext?: string): Promise<Briefing>;
}
