/**
 * Article Library
 *
 * A Redis-backed store of enriched articles that persists across refreshes.
 * After each refresh, newly-enriched articles (with real Gemini briefs) are
 * merged in.  The orchestrator loads the library at startup and uses it for
 * historical display, so the app shows accumulated articles across all sections
 * indefinitely.
 *
 * Storage: Upstash Redis — per-section keys "app:article-library:v2:{section}"
 *   (one key per section: sanctions, economics, regions, occ, penalties, bis).
 *   No TTL. Splitting across keys keeps each key well under Upstash's 1 MB
 *   per-key limit regardless of how many articles accumulate.
 *   Auto-migrates from legacy "app:article-library:v1" on first load.
 */

import type { Article } from "./types";

const LEGACY_KEY = "app:article-library:v1";
const KEY_PREFIX = "app:article-library:v2:";
const SECTIONS   = ["sanctions","economics","regions","occ","penalties","bis"] as const;

function sectionKey(sec: string): string {
  return `${KEY_PREFIX}${sec}`;
}

// ── Upstash REST helpers (direct — StorageManager only exposes load/save Briefing) ──

function upstashUrl()   { return process.env.UPSTASH_REDIS_REST_URL  ?? ""; }
function upstashToken() { return process.env.UPSTASH_REDIS_REST_TOKEN ?? ""; }

async function redisGet(key: string): Promise<string | null> {
  const url = upstashUrl(); const token = upstashToken();
  if (!url || !token) return null;
  try {
    const res = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.result ?? null;
  } catch { return null; }
}

async function redisSet(key: string, value: string): Promise<void> {
  const url = upstashUrl(); const token = upstashToken();
  if (!url || !token) return;
  try {
    await fetch(`${url}/set/${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
    });
  } catch { /* non-fatal */ }
}

/**
 * Batch GET multiple keys in a single Upstash pipeline request (1 subrequest).
 * Replaces N individual GETs to stay within CF Workers' 50-subrequest limit.
 */
async function redisMGet(keys: string[]): Promise<(string | null)[]> {
  const url = upstashUrl(); const token = upstashToken();
  if (!url || !token) return keys.map(() => null);
  try {
    const commands = keys.map(k => ["GET", k]);
    const res = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(commands),
    });
    if (!res.ok) return keys.map(() => null);
    const data: { result: string | null }[] = await res.json();
    return data.map(r => r.result ?? null);
  } catch { return keys.map(() => null); }
}

/**
 * Batch SET multiple key/value pairs in a single Upstash pipeline request (1 subrequest).
 */
async function redisMSet(pairs: { key: string; value: string }[]): Promise<void> {
  const url = upstashUrl(); const token = upstashToken();
  if (!url || !token || pairs.length === 0) return;
  try {
    const commands = pairs.map(({ key, value }) => ["SET", key, value]);
    await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(commands),
    });
  } catch { /* non-fatal */ }
}

async function redisGetArticles(key: string): Promise<Article[]> {
  try {
    const raw = await redisGet(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

// ── Generic brief cache (fix brief-generator.ts which used broken StorageManager.get) ──

const BRIEF_PREFIX = "brief:v1:";
const BRIEF_TTL    = 30 * 24 * 3600; // 30 days

function briefHashUrl(url: string): string {
  let h = 0;
  for (let i = 0; i < url.length; i++) h = ((h << 5) - h + url.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

async function redisSetTtl(key: string, value: string, ttl: number): Promise<void> {
  const url = upstashUrl(); const token = upstashToken();
  if (!url || !token) return;
  try {
    await fetch(`${url}/set/${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ value, ex: ttl }),
    });
  } catch { /* non-fatal */ }
}

export async function getCachedBrief(url: string): Promise<string | null> {
  return redisGet(BRIEF_PREFIX + briefHashUrl(url));
}

export async function setCachedBrief(url: string, brief: string): Promise<void> {
  await redisSetTtl(BRIEF_PREFIX + briefHashUrl(url), brief, BRIEF_TTL);
}

// ── Article library ────────────────────────────────────────────────────────────────────────────

const GENERIC_BRIEFS = [
  "new designations or sanctions measures issued",
  "general license issued or amended",
  "sanctions removal or delisting action",
  "regulatory guidance or advisory notice",
  "official action — see source link",
  "official action published by",
  "treasury action targeting",
  "treasury department sanctions",
  "see source link for full details",
];

function hasRealBrief(article: Article): boolean {
  const b = (article.body[0] || "").toLowerCase();
  if (b.length < 50) return false;
  return !GENERIC_BRIEFS.some(g => b.includes(g));
}

function headlineKey(headline: string): string {
  return headline.slice(0, 80).toLowerCase().replace(/\s+/g, " ").trim();
}

export async function loadArticleLibrary(): Promise<Article[]> {
  // Batch-load all section keys in ONE pipeline request (saves 5 subrequests vs
  // 6 individual GETs — critical for CF Workers' 50-subrequest-per-invocation limit).
  const keys = SECTIONS.map(sectionKey);
  const raws = await redisMGet(keys);
  const results = raws.map(raw => {
    try {
      if (!raw) return [] as Article[];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as Article[]) : [];
    } catch { return [] as Article[]; }
  });
  const all = results.flat();

  // Auto-migrate from legacy v1 key if v2 is empty
  if (all.length === 0) {
    const legacy = await redisGetArticles(LEGACY_KEY);
    if (legacy.length > 0) {
      console.log(`[article-library] Migrating ${legacy.length} articles from v1 → v2 per-section keys`);
      await saveArticlesToLibrary(legacy);
      return legacy;
    }
  }
  return all;
}

export async function saveArticlesToLibrary(newArticles: Article[]): Promise<void> {
  // Accept real-brief OR government-source articles (gov sources are always authoritative)
  const GOV_SOURCES = ["OFAC","FinCEN","BIS","OCC","Federal Reserve","OFSI","EU Council","EU Commission","U.S. Treasury","Federal Register","UN Security"];
  const candidates = newArticles.filter(a =>
    hasRealBrief(a) || GOV_SOURCES.some(s => (a.source ?? "").includes(s))
  );
  if (candidates.length === 0) return;

  // Group candidates by section
  const candidatesBySection = new Map<string, Article[]>();
  for (const a of candidates) {
    const sec = a.section ?? "sanctions";
    const list = candidatesBySection.get(sec) ?? [];
    list.push(a);
    candidatesBySection.set(sec, list);
  }

  // Determine all sections that need updating (standard + any extras in candidates)
  const allSections = new Set<string>([...SECTIONS, ...candidatesBySection.keys()]);

  // Batch-load existing articles for all affected sections in ONE pipeline request.
  const affectedSections = [...allSections].filter(sec => (candidatesBySection.get(sec) ?? []).length > 0);
  const existingRaws = await redisMGet(affectedSections.map(sectionKey));
  const existingBySec = new Map<string, Article[]>();
  affectedSections.forEach((sec, i) => {
    try {
      const raw = existingRaws[i];
      const parsed = raw ? JSON.parse(raw) : [];
      existingBySec.set(sec, Array.isArray(parsed) ? parsed : []);
    } catch { existingBySec.set(sec, []); }
  });

  // Merge each section
  const toSave: { key: string; value: string }[] = [];
  for (const sec of affectedSections) {
    const newForSec = candidatesBySection.get(sec) ?? [];
    const existing  = existingBySec.get(sec) ?? [];
    const map = new Map<string, Article>();
    for (const a of existing) map.set(headlineKey(a.headline), a);
    for (const a of newForSec) {
      const k = headlineKey(a.headline);
      const prev = map.get(k);
      if (!prev || (a.body[0] || "").length > (prev.body[0] || "").length) map.set(k, a);
    }
    const merged = [...map.values()].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    toSave.push({ key: sectionKey(sec), value: JSON.stringify(merged) });
    console.log(`[article-library] Section "${sec}": ${merged.length} articles to save`);
  }

  // Batch-save all sections in ONE pipeline request (saves N-1 subrequests).
  await redisMSet(toSave);
  console.log(`[article-library] Saved ${candidates.length} new/updated articles`);
}
