/**
 * Article Cache — Redis-backed rolling store of recently seen articles.
 *
 * Automatically accumulates articles from every successful refresh.
 * When a live source returns no articles (site blocked, no new actions today),
 * the cache provides recently-seen articles from that source as a fallback —
 * much fresher than the hardcoded historical entries.
 *
 * Redis key : "article_cache_v1"
 * Capacity  : 500 articles, newest first
 * TTL       : 45 days (auto-expires if no refreshes occur)
 */

import type { Article } from "./types";

const CACHE_KEY = "article_cache_v1";
const MAX_ARTICLES = 500;
const CACHE_TTL_SECONDS = 45 * 24 * 60 * 60; // 45 days

type CachePayload = { articles: Article[]; savedAt: string };

// ── Minimal direct Upstash REST client ────────────────────────────────────────
// Avoids importing UpstashAdapter (which registers usage-tracking + adapters
// we don't need here). Two subrequests total: one GET on load, one SET on save.

async function redisGet<T>(key: string): Promise<T | null> {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    const res = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json() as { result: string | null };
    if (!data.result) return null;
    return JSON.parse(data.result) as T;
  } catch {
    return null;
  }
}

async function redisSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return;
  // Upstash pipeline: SET key value EX ttl
  await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify([["SET", key, JSON.stringify(value), "EX", ttlSeconds]]),
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Load all cached articles from Redis. Returns [] on any error. */
export async function loadArticleCache(): Promise<Article[]> {
  try {
    const payload = await redisGet<CachePayload>(CACHE_KEY);
    return payload?.articles ?? [];
  } catch {
    return [];
  }
}

/**
 * Merge fresh articles into the rolling cache and persist to Redis.
 * Deduplicates by (headline + source). Keeps at most MAX_ARTICLES, newest first.
 * Non-fatal — all errors are caught and logged.
 */
export async function mergeIntoCache(newArticles: Article[]): Promise<void> {
  try {
    const existing = await loadArticleCache();

    // Merge: headline prefix + source as dedup key; prefer newer date
    const map = new Map<string, Article>();
    for (const a of [...existing, ...newArticles]) {
      const key = `${a.headline.slice(0, 80).toLowerCase()}|||${a.source}`;
      const prev = map.get(key);
      if (!prev || (a.date ?? "") >= (prev.date ?? "")) {
        map.set(key, a);
      }
    }

    const merged = Array.from(map.values())
      .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
      .slice(0, MAX_ARTICLES);

    await redisSet(CACHE_KEY, { articles: merged, savedAt: new Date().toISOString() }, CACHE_TTL_SECONDS);
    console.log(`[article-cache] Merged ${newArticles.length} → ${merged.length} total cached`);
  } catch (e) {
    console.log("[article-cache] merge failed (non-fatal):", String(e).slice(0, 120));
  }
}

/**
 * Synchronous lookup in a pre-loaded cache array.
 * Call loadArticleCache() once at the start of refreshBriefing, then
 * pass the result here for each source you want to backfill.
 */
export function getCachedBySource(
  cached: Article[],
  sourceKeyword: string,
  limit: number,
  excludeIds: Set<number>
): Article[] {
  return cached
    .filter(a => a.source.includes(sourceKeyword) && !excludeIds.has(a.id))
    .slice(0, limit);
}
