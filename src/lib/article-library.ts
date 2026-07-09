/**
 * Article Library
 *
 * A Redis-backed store of enriched articles that persists across refreshes.
 * After each refresh, newly-enriched articles (with real Gemini briefs) are
 * merged in.  The orchestrator loads the library at startup and uses it for
 * historical display, so the app shows accumulated articles across all sections
 * for up to 6 months.
 *
 * Storage: Upstash Redis, key "app:article-library:v1", TTL 180 days.
 * Size cap: 50 articles per section (300 total across 6 sections).
 */

import type { Article } from "./types";

const LIBRARY_KEY     = "app:article-library:v1";
const LIBRARY_TTL     = 180 * 24 * 3600; // 6 months in seconds
const MAX_PER_SECTION = 150;             // cap per section (~6 months at OFAC publish frequency)
const SIX_MONTHS_MS   = 180 * 24 * 60 * 60 * 1000;

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

async function redisSet(key: string, value: string, ttl: number): Promise<void> {
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

// ── Generic brief cache (fix brief-generator.ts which used broken StorageManager.get) ──

const BRIEF_PREFIX = "brief:v1:";
const BRIEF_TTL    = 30 * 24 * 3600; // 30 days

function briefHashUrl(url: string): string {
  let h = 0;
  for (let i = 0; i < url.length; i++) h = ((h << 5) - h + url.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

export async function getCachedBrief(url: string): Promise<string | null> {
  return redisGet(BRIEF_PREFIX + briefHashUrl(url));
}

export async function setCachedBrief(url: string, brief: string): Promise<void> {
  await redisSet(BRIEF_PREFIX + briefHashUrl(url), brief, BRIEF_TTL);
}

// ── Article library ──────────────────────────────────────────────────────────

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

/** True if the article's date is within the 6-month retention window */
function isWithinRetention(article: Article): boolean {
  const t = Date.parse(article.date || "");
  if (isNaN(t)) return true; // undated articles — keep
  return Date.now() - t <= SIX_MONTHS_MS;
}

export async function loadArticleLibrary(): Promise<Article[]> {
  try {
    const raw = await redisGet(LIBRARY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

export async function saveArticlesToLibrary(newArticles: Article[]): Promise<void> {
  // Accept real-brief OR government-source articles (gov sources are always authoritative)
  const GOV_SOURCES = ["OFAC","FinCEN","BIS","OCC","Federal Reserve","OFSI","EU Council","EU Commission","U.S. Treasury","Federal Register","UN Security"];
  const candidates = newArticles.filter(a =>
    hasRealBrief(a) || GOV_SOURCES.some(s => (a.source ?? "").includes(s))
  );
  if (candidates.length === 0) return;

  // Load existing library
  const existing = await loadArticleLibrary();

  // Merge: build map by headline key, prefer longer/better briefs
  const map = new Map<string, Article>();
  for (const a of existing) map.set(headlineKey(a.headline), a);
  for (const a of candidates) {
    const key = headlineKey(a.headline);
    const prev = map.get(key);
    if (!prev || (a.body[0] || "").length > (prev.body[0] || "").length) {
      map.set(key, a);
    }
  }

  // Apply 6-month retention filter
  const retained = [...map.values()].filter(isWithinRetention);

  // Cap at MAX_PER_SECTION per section — sort newest first within each section
  const SECTIONS = ["sanctions","economics","regions","occ","penalties","bis"] as const;
  const bySection = new Map<string, Article[]>();
  for (const a of retained) {
    const sec = a.section ?? "sanctions";
    const list = bySection.get(sec) ?? [];
    list.push(a);
    bySection.set(sec, list);
  }
  const merged: Article[] = [];
  for (const sec of SECTIONS) {
    const list = (bySection.get(sec) ?? [])
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
      .slice(0, MAX_PER_SECTION);
    merged.push(...list);
  }
  // Also keep articles from sections not in the standard list
  for (const [sec, list] of bySection) {
    if (!(SECTIONS as readonly string[]).includes(sec)) {
      merged.push(...list.slice(0, MAX_PER_SECTION));
    }
  }

  await redisSet(LIBRARY_KEY, JSON.stringify(merged), LIBRARY_TTL);
  console.log(`[article-library] Saved ${merged.length} articles total (${candidates.length} new/updated)`);
}
