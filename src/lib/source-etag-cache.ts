/**
 * source-etag-cache.ts
 *
 * HTTP conditional-request support for official source fetches.
 *
 * On each fetch we store the response's ETag / Last-Modified header in Redis
 * (one key, all sources, loaded/saved once per invocation).
 * On the NEXT fetch we send If-None-Match / If-Modified-Since — if nothing
 * changed the server returns 304 with no body, saving bandwidth + processing.
 *
 * Redis key : "source:etag:v1"
 * TTL       : 7 days (entries auto-expire if a source is removed from rotation)
 */

const ETAG_KEY = "source:etag:v1";
const ETAG_TTL = 7 * 24 * 3600; // seconds

interface ETagEntry {
  etag?: string;
  lastModified?: string;
  fetchedAt: string;
}

export type ETagStore = Record<string, ETagEntry>; // key = url hash

// ── Tiny URL hash (same pattern as brief-generator.ts) ───────────────────
function urlHash(url: string): string {
  let h = 0;
  for (let i = 0; i < url.length; i++) h = ((h << 5) - h + url.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

// ── Upstash REST helpers ──────────────────────────────────────────────────
function upstashUrl()   { return process.env.UPSTASH_REDIS_REST_URL  ?? ""; }
function upstashToken() { return process.env.UPSTASH_REDIS_REST_TOKEN ?? ""; }

async function redisGet(key: string): Promise<string | null> {
  const url = upstashUrl(), token = upstashToken();
  if (!url || !token) return null;
  try {
    const res = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    return (await res.json()).result ?? null;
  } catch { return null; }
}

async function redisSet(key: string, value: string, ttl: number): Promise<void> {
  const url = upstashUrl(), token = upstashToken();
  if (!url || !token) return;
  try {
    await fetch(`${url}/set/${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ value, ex: ttl }),
      signal: AbortSignal.timeout(3000),
    });
  } catch { /* non-fatal */ }
}

// ── Public API ────────────────────────────────────────────────────────────

/** Load the full ETag store from Redis (call once at start of fetchOfficialSources). */
export async function loadETagStore(): Promise<ETagStore> {
  try {
    const raw = await redisGet(ETAG_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** Persist the updated store back to Redis (call once after all fetches). */
export async function flushETagStore(store: ETagStore): Promise<void> {
  try {
    await redisSet(ETAG_KEY, JSON.stringify(store), ETAG_TTL);
    const count = Object.keys(store).length;
    console.log(`[etag-cache] Flushed ${count} entries`);
  } catch { /* non-fatal */ }
}

/**
 * Return conditional request headers for a URL based on the cached store.
 * Returns an empty object if we have no cached headers for this URL.
 */
export function getConditionalHeaders(url: string, store: ETagStore): Record<string, string> {
  const entry = store[urlHash(url)];
  if (!entry) return {};
  const headers: Record<string, string> = {};
  if (entry.etag)         headers["If-None-Match"]     = entry.etag;
  if (entry.lastModified) headers["If-Modified-Since"] = entry.lastModified;
  return headers;
}

/**
 * Extract and record ETag / Last-Modified from a successful (200) response.
 * Mutates `store` in place — call flushETagStore() when done to persist.
 */
export function recordETagResponse(url: string, res: Response, store: ETagStore): void {
  const etag         = res.headers.get("etag")          ?? undefined;
  const lastModified = res.headers.get("last-modified") ?? undefined;
  if (!etag && !lastModified) return; // server doesn't support conditional requests
  store[urlHash(url)] = { etag, lastModified, fetchedAt: new Date().toISOString() };
}
