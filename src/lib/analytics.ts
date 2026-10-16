/**
 * Visitor analytics — online presence, visit counters, and geo aggregation.
 *
 * Backed by the same Upstash Redis instance as everything else, via the direct
 * REST /pipeline API (not the SDK) — the CF-Workers-safe pattern already used by
 * article-library.ts. Every key here is bounded or TTL'd so this can never grow
 * without limit (see the 2026-10 Upstash memory audit for why that matters):
 *
 *   presence:z                 Sorted set, member=visitorId score=timestamp.
 *                              Trimmed to the last PRESENCE_WINDOW_MS on every
 *                              heartbeat, so it only ever holds people online now.
 *   sess:<vid>                 Per-visitor session marker, TTL SESSION_TTL_S.
 *                              Its absence = a new visit (dedupes the 30s beats).
 *   stats:visits:total         All-time visit counter (INCR; one tiny integer).
 *   stats:visits:<YYYY-MM-DD>  Per-day visit counter, TTL RETAIN_S (~13 months).
 *   stats:uv:<YYYY-MM-DD>      Per-day unique visitors (HyperLogLog, ~12 KB max),
 *                              TTL RETAIN_S.
 *   stats:geo:country         All-time country tally (hash, <=~250 fields).
 *   stats:geo:city:<date>     Per-day city tally (hash), TTL CITY_RETAIN_S (90d),
 *                              so city data is bounded by day and self-expires.
 *
 * Fails soft everywhere: if Redis isn't configured or a call throws, analytics
 * degrade silently rather than breaking the page or an API response.
 */

const PRESENCE_WINDOW_MS = 60_000;      // a visitor counts as "online" for 60s after a beat
const SESSION_TTL_S      = 30 * 60;     // 30 min — one "visit" per visitor per 30 min
const RETAIN_S           = 400 * 24 * 60 * 60; // ~13 months of daily counters
const CITY_RETAIN_S      = 90 * 24 * 60 * 60;  // 90 days of per-day city detail
const GEO_COUNTRY_KEY    = "stats:geo:country";

function cfg(): { url: string; token: string } | null {
  const url   = process.env.UPSTASH_REDIS_REST_URL  || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return { url, token };
}

/** Run a batch of Redis commands in one REST round-trip. Returns results, or null on failure. */
async function pipeline(commands: (string | number)[][]): Promise<any[] | null> {
  const c = cfg();
  if (!c || commands.length === 0) return null;
  try {
    const res = await fetch(`${c.url}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${c.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(commands.map(cmd => cmd.map(String))),
    });
    if (!res.ok) return null;
    const data = await res.json() as { result: any }[];
    return data.map(d => d.result);
  } catch { return null; }
}

function utcDate(ts = Date.now()): string {
  return new Date(ts).toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

/** Sanitize a visitor id to a short, safe token (defend against junk/injection in keys). */
export function cleanVid(raw: unknown): string {
  const s = typeof raw === "string" ? raw : "";
  const v = s.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
  return v.length >= 8 ? v : "";
}

export interface GeoHint {
  country?: string | null; // ISO-3166 alpha-2, e.g. "US"
  city?: string | null;
  region?: string | null;
}

/**
 * Record a heartbeat from a visitor. Updates presence, and — only once per
 * SESSION_TTL_S per visitor — counts the visit and tallies geography.
 * Returns the current number of visitors online (best-effort; 0 on failure).
 */
export async function heartbeat(vid: string, geo: GeoHint): Promise<{ online: number }> {
  const v = cleanVid(vid);
  if (!v) return { online: 0 };
  const now = Date.now();

  // Pipeline 1: presence upsert + trim + count + claim a session slot.
  const r1 = await pipeline([
    ["ZADD", "presence:z", now, v],
    ["ZREMRANGEBYSCORE", "presence:z", 0, now - PRESENCE_WINDOW_MS],
    ["ZCARD", "presence:z"],
    ["EXPIRE", "presence:z", 300],               // safety net: whole set self-expires if traffic stops
    ["SET", `sess:${v}`, "1", "NX", "EX", SESSION_TTL_S],
  ]);
  if (!r1) return { online: 0 };

  const online    = Number(r1[2]) || 0;
  const newVisit  = r1[4] === "OK" || r1[4] === "ok"; // SET NX returns OK only when it set the key

  if (newVisit) {
    const date = utcDate(now);
    const cmds: (string | number)[][] = [
      ["INCR", "stats:visits:total"],
      ["INCR", `stats:visits:${date}`],
      ["EXPIRE", `stats:visits:${date}`, RETAIN_S],
      ["PFADD", `stats:uv:${date}`, v],
      ["EXPIRE", `stats:uv:${date}`, RETAIN_S],
    ];
    const country = (geo.country || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2);
    if (country) cmds.push(["HINCRBY", GEO_COUNTRY_KEY, country, 1]);
    const city = (geo.city || "").replace(/[|]/g, " ").trim().slice(0, 48);
    if (country && city) {
      const field = `${country}|${city}`;
      cmds.push(["HINCRBY", `stats:geo:city:${date}`, field, 1]);
      cmds.push(["EXPIRE", `stats:geo:city:${date}`, CITY_RETAIN_S]);
    }
    await pipeline(cmds); // fire-and-forget correctness: failure just drops one tally
  }

  return { online };
}

/** Current online count only (public badge / GET). */
export async function onlineCount(): Promise<number> {
  const now = Date.now();
  const r = await pipeline([
    ["ZREMRANGEBYSCORE", "presence:z", 0, now - PRESENCE_WINDOW_MS],
    ["ZCARD", "presence:z"],
  ]);
  return r ? (Number(r[1]) || 0) : 0;
}

export interface AnalyticsReport {
  online: number;
  visitsTotal: number;
  daily: { date: string; visits: number; uniques: number }[];
  countries: { code: string; visits: number }[];
  cities: { code: string; city: string; visits: number }[];
  generatedAt: string;
}

/** Full report for the admin dashboard: totals, a daily series, and geo breakdowns. */
export async function getReport(days = 30): Promise<AnalyticsReport> {
  const now = Date.now();
  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i--) dates.push(utcDate(now - i * 86_400_000));

  // One pipeline for the scalar/series/country data.
  const base: (string | number)[][] = [
    ["ZREMRANGEBYSCORE", "presence:z", 0, now - PRESENCE_WINDOW_MS],
    ["ZCARD", "presence:z"],
    ["GET", "stats:visits:total"],
    ["HGETALL", GEO_COUNTRY_KEY],
  ];
  for (const d of dates) base.push(["GET", `stats:visits:${d}`]);
  for (const d of dates) base.push(["PFCOUNT", `stats:uv:${d}`]);
  const r = await pipeline(base);

  const empty: AnalyticsReport = {
    online: 0, visitsTotal: 0, daily: [], countries: [], cities: [],
    generatedAt: new Date(now).toISOString(),
  };
  if (!r) return empty;

  const online      = Number(r[1]) || 0;
  const visitsTotal = Number(r[2]) || 0;
  const countryFlat = r[3] as any; // HGETALL -> {code:count} (object) or [k,v,...] (array)
  const visitsArr   = r.slice(4, 4 + dates.length).map(x => Number(x) || 0);
  const uvArr       = r.slice(4 + dates.length, 4 + 2 * dates.length).map(x => Number(x) || 0);

  const daily = dates.map((date, i) => ({ date, visits: visitsArr[i], uniques: uvArr[i] }));

  const countries = hashToPairs(countryFlat)
    .map(([code, n]) => ({ code, visits: Number(n) || 0 }))
    .filter(c => c.visits > 0)
    .sort((a, b) => b.visits - a.visits);

  // Cities: sum the last min(days,CITY_RETAIN) per-day hashes.
  const cityDays = dates.slice(-Math.min(dates.length, 90));
  const rc = await pipeline(cityDays.map(d => ["HGETALL", `stats:geo:city:${d}`]));
  const cityTotals = new Map<string, number>();
  if (rc) {
    for (const flat of rc) {
      for (const [field, n] of hashToPairs(flat)) {
        cityTotals.set(field, (cityTotals.get(field) || 0) + (Number(n) || 0));
      }
    }
  }
  const cities = Array.from(cityTotals.entries())
    .map(([field, visits]) => {
      const [code, ...rest] = field.split("|");
      return { code, city: rest.join("|"), visits };
    })
    .filter(c => c.visits > 0)
    .sort((a, b) => b.visits - a.visits)
    .slice(0, 100);

  return { online, visitsTotal, daily, countries, cities, generatedAt: new Date(now).toISOString() };
}

/** Normalize Upstash HGETALL (array form [k,v,k,v] or object form) to [key,value] pairs. */
function hashToPairs(flat: any): [string, any][] {
  if (!flat) return [];
  if (Array.isArray(flat)) {
    const out: [string, any][] = [];
    for (let i = 0; i + 1 < flat.length; i += 2) out.push([String(flat[i]), flat[i + 1]]);
    return out;
  }
  if (typeof flat === "object") return Object.entries(flat);
  return [];
}
