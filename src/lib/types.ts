// ── Briefing data types ───────────────────────────────────────────────────────

export type Section = "sanctions" | "economics" | "religion" | "occ" | "penalties" | "bis";
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
}

export interface WatchItem  { entity: string; type: string; note: string; }
export interface KeyFigure  { label: string;  value: string; }
export interface SidebarSection { watchlist: WatchItem[]; keyFigures: KeyFigure[]; }

export interface Briefing {
  lastUpdated: string;
  articles: Article[];
  sidebar: Record<Section, SidebarSection>;
}

// ── Platform health / failover types ─────────────────────────────────────────

export type PlatformId = "vercel-kv" | "upstash" | "cloudflare-kv" | "memory";

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
