/**
 * Visitor analytics — online presence, visit counters, and geo aggregation.
 *
 * Backend-flexible, matching the app's "always runs" storage design: it uses
 * Cloudflare D1 (the current primary, binding ALERT_DB) when available, and
 * falls back to Upstash Redis when D1 isn't bound but Upstash env vars are set.
 * If neither is available it no-ops. Every call fails soft — analytics never
 * throws into a page or API response.
 *
 * Bounded by construction on both backends:
 *   - presence is trimmed to the last PRESENCE_WINDOW_MS on every heartbeat,
 *   - a per-visitor session marker dedupes the 30s beats into one "visit",
 *   - daily counters / per-day uniques / per-day city tallies are pruned to
 *     their retention window (opportunistically on D1, via TTL on Upstash).
 *
 * D1 tables: see migrations/0002_analytics.sql.
 */
import type { D1Database } from "@cloudflare/workers-types";

const PRESENCE_WINDOW_MS = 60_000;             // "online" = a beat within the last 60s
const SESSION_TTL_S      = 30 * 60;            // one "visit" per visitor per 30 min
const RETAIN_DAYS        = 400;                // ~13 months of daily counters/uniques
const CITY_RETAIN_DAYS   = 90;                 // 90 days of per-day city detail
const CLEANUP_PROB       = 0.03;              // ~3% of D1 heartbeats prune old rows

export interface GeoHint {
  country?: string | null; // ISO-3166 alpha-2, e.g. "US"
  city?: string | null;
  region?: string | null;
}

export interface AnalyticsReport {
  online: number;
  visitsTotal: number;
  daily: { date: string; visits: number; uniques: number }[];
  countries: { code: string; visits: number }[];
  cities: { code: string; city: string; visits: number }[];
  backend: string;
  generatedAt: string;
}

// ── shared helpers ───────────────────────────────────────────────────────────

function utcDate(ts = Date.now()): string {
  return new Date(ts).toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

/** Sanitize a visitor id to a short, safe token (defend against junk/injection). */
export function cleanVid(raw: unknown): string {
  const s = typeof raw === "string" ? raw : "";
  const v = s.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
  return v.length >= 8 ? v : "";
}

function normCountry(c?: string | null): string {
  return (c || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2);
}
function normCity(c?: string | null): string {
  return (c || "").replace(/[|]/g, " ").trim().slice(0, 48);
}

// ── backend selection ────────────────────────────────────────────────────────

async function d1(): Promise<D1Database | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = await getCloudflareContext({ async: true });
    const db = (env as any)?.ALERT_DB as D1Database | undefined;
    return db ?? null;
  } catch { return null; }
}

function upstashCfg(): { url: string; token: string } | null {
  const url   = process.env.UPSTASH_REDIS_REST_URL  || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

// ── D1 implementation ────────────────────────────────────────────────────────

async function d1Heartbeat(db: D1Database, v: string, geo: GeoHint): Promise<number> {
  const nowMs = Date.now();
  const nowS  = Math.floor(nowMs / 1000);
  const date  = utcDate(nowMs);

  await db.batch([
    db.prepare("INSERT INTO analytics_presence(vid,seen_at) VALUES(?1,?2) ON CONFLICT(vid) DO UPDATE SET seen_at=excluded.seen_at").bind(v, nowMs),
    db.prepare("DELETE FROM analytics_presence WHERE seen_at < ?1").bind(nowMs - PRESENCE_WINDOW_MS),
    db.prepare("DELETE FROM analytics_session WHERE expires_at < ?1").bind(nowS),
  ]);

  const onlineRow = await db.prepare("SELECT COUNT(*) AS n FROM analytics_presence").first<{ n: number }>();
  const online = Number(onlineRow?.n) || 0;

  const ins = await db.prepare(
    "INSERT INTO analytics_session(vid,expires_at) VALUES(?1,?2) ON CONFLICT(vid) DO NOTHING",
  ).bind(v, nowS + SESSION_TTL_S).run();
  const newVisit = Number((ins as any)?.meta?.changes ?? 0) > 0;

  if (newVisit) {
    const country = normCountry(geo.country);
    const city    = normCity(geo.city);
    const stmts = [
      db.prepare("INSERT INTO analytics_visit(day,visits) VALUES('all',1) ON CONFLICT(day) DO UPDATE SET visits=visits+1"),
      db.prepare("INSERT INTO analytics_visit(day,visits) VALUES(?1,1) ON CONFLICT(day) DO UPDATE SET visits=visits+1").bind(date),
      db.prepare("INSERT INTO analytics_unique(day,vid) VALUES(?1,?2) ON CONFLICT(day,vid) DO NOTHING").bind(date, v),
    ];
    if (country) stmts.push(db.prepare("INSERT INTO analytics_geo(scope,name,visits) VALUES('country',?1,1) ON CONFLICT(scope,name) DO UPDATE SET visits=visits+1").bind(country));
    if (country && city) stmts.push(db.prepare("INSERT INTO analytics_geo(scope,name,visits) VALUES(?1,?2,1) ON CONFLICT(scope,name) DO UPDATE SET visits=visits+1").bind(`city:${date}`, `${country}|${city}`));
    await db.batch(stmts);
  }

  if (Math.random() < CLEANUP_PROB) await d1Cleanup(db, nowMs);
  return online;
}

async function d1Cleanup(db: D1Database, nowMs: number): Promise<void> {
  const dayCut  = utcDate(nowMs - RETAIN_DAYS * 86_400_000);
  const cityCut = `city:${utcDate(nowMs - CITY_RETAIN_DAYS * 86_400_000)}`;
  try {
    await db.batch([
      db.prepare("DELETE FROM analytics_unique WHERE day < ?1").bind(dayCut),
      db.prepare("DELETE FROM analytics_visit WHERE day <> 'all' AND day < ?1").bind(dayCut),
      db.prepare("DELETE FROM analytics_geo WHERE scope LIKE 'city:%' AND scope < ?1").bind(cityCut),
    ]);
  } catch { /* non-fatal */ }
}

async function d1Online(db: D1Database): Promise<number> {
  const now = Date.now();
  await db.prepare("DELETE FROM analytics_presence WHERE seen_at < ?1").bind(now - PRESENCE_WINDOW_MS).run();
  const row = await db.prepare("SELECT COUNT(*) AS n FROM analytics_presence").first<{ n: number }>();
  return Number(row?.n) || 0;
}

function placeholders(n: number, start = 1): string {
  return Array.from({ length: n }, (_, i) => `?${start + i}`).join(",");
}

async function d1Report(db: D1Database, days: number): Promise<AnalyticsReport> {
  const now = Date.now();
  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i--) dates.push(utcDate(now - i * 86_400_000));

  const online = await d1Online(db);

  const totalRow = await db.prepare("SELECT visits FROM analytics_visit WHERE day='all'").first<{ visits: number }>();
  const visitsTotal = Number(totalRow?.visits) || 0;

  const visitRows = (await db.prepare(
    `SELECT day, visits FROM analytics_visit WHERE day IN (${placeholders(dates.length)})`,
  ).bind(...dates).all<{ day: string; visits: number }>()).results ?? [];
  const uniqRows = (await db.prepare(
    `SELECT day, COUNT(*) AS n FROM analytics_unique WHERE day IN (${placeholders(dates.length)}) GROUP BY day`,
  ).bind(...dates).all<{ day: string; n: number }>()).results ?? [];
  const vMap = new Map(visitRows.map(r => [r.day, Number(r.visits) || 0]));
  const uMap = new Map(uniqRows.map(r => [r.day, Number(r.n) || 0]));
  const daily = dates.map(date => ({ date, visits: vMap.get(date) ?? 0, uniques: uMap.get(date) ?? 0 }));

  const countryRows = (await db.prepare(
    "SELECT name, visits FROM analytics_geo WHERE scope='country' ORDER BY visits DESC",
  ).all<{ name: string; visits: number }>()).results ?? [];
  const countries = countryRows.map(r => ({ code: r.name, visits: Number(r.visits) || 0 })).filter(c => c.visits > 0);

  const cityScopes = dates.slice(-Math.min(dates.length, CITY_RETAIN_DAYS)).map(d => `city:${d}`);
  let cities: { code: string; city: string; visits: number }[] = [];
  if (cityScopes.length) {
    const cityRows = (await db.prepare(
      `SELECT name, SUM(visits) AS v FROM analytics_geo WHERE scope IN (${placeholders(cityScopes.length)}) GROUP BY name ORDER BY v DESC LIMIT 100`,
    ).bind(...cityScopes).all<{ name: string; v: number }>()).results ?? [];
    cities = cityRows.map(r => {
      const [code, ...rest] = String(r.name).split("|");
      return { code, city: rest.join("|"), visits: Number(r.v) || 0 };
    }).filter(c => c.visits > 0);
  }

  return { online, visitsTotal, daily, countries, cities, backend: "cloudflare-d1", generatedAt: new Date(now).toISOString() };
}

// ── Upstash implementation (fallback) ────────────────────────────────────────

async function redis(cfg: { url: string; token: string }, commands: (string | number)[][]): Promise<any[] | null> {
  if (commands.length === 0) return null;
  try {
    const res = await fetch(`${cfg.url}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(commands.map(c => c.map(String))),
    });
    if (!res.ok) return null;
    const data = await res.json() as { result: any }[];
    return data.map(d => d.result);
  } catch { return null; }
}

const RETAIN_S = RETAIN_DAYS * 86_400;
const CITY_RETAIN_S = CITY_RETAIN_DAYS * 86_400;

async function upHeartbeat(cfg: { url: string; token: string }, v: string, geo: GeoHint): Promise<number> {
  const now = Date.now();
  const r1 = await redis(cfg, [
    ["ZADD", "presence:z", now, v],
    ["ZREMRANGEBYSCORE", "presence:z", 0, now - PRESENCE_WINDOW_MS],
    ["ZCARD", "presence:z"],
    ["EXPIRE", "presence:z", 300],
    ["SET", `sess:${v}`, "1", "NX", "EX", SESSION_TTL_S],
  ]);
  if (!r1) return 0;
  const online = Number(r1[2]) || 0;
  if (r1[4] === "OK" || r1[4] === "ok") {
    const date = utcDate(now);
    const cmds: (string | number)[][] = [
      ["INCR", "stats:visits:total"],
      ["INCR", `stats:visits:${date}`],
      ["EXPIRE", `stats:visits:${date}`, RETAIN_S],
      ["PFADD", `stats:uv:${date}`, v],
      ["EXPIRE", `stats:uv:${date}`, RETAIN_S],
    ];
    const country = normCountry(geo.country);
    if (country) cmds.push(["HINCRBY", "stats:geo:country", country, 1]);
    const city = normCity(geo.city);
    if (country && city) {
      cmds.push(["HINCRBY", `stats:geo:city:${date}`, `${country}|${city}`, 1]);
      cmds.push(["EXPIRE", `stats:geo:city:${date}`, CITY_RETAIN_S]);
    }
    await redis(cfg, cmds);
  }
  return online;
}

async function upOnline(cfg: { url: string; token: string }): Promise<number> {
  const now = Date.now();
  const r = await redis(cfg, [
    ["ZREMRANGEBYSCORE", "presence:z", 0, now - PRESENCE_WINDOW_MS],
    ["ZCARD", "presence:z"],
  ]);
  return r ? (Number(r[1]) || 0) : 0;
}

function hashPairs(flat: any): [string, any][] {
  if (!flat) return [];
  if (Array.isArray(flat)) {
    const out: [string, any][] = [];
    for (let i = 0; i + 1 < flat.length; i += 2) out.push([String(flat[i]), flat[i + 1]]);
    return out;
  }
  if (typeof flat === "object") return Object.entries(flat);
  return [];
}

async function upReport(cfg: { url: string; token: string }, days: number): Promise<AnalyticsReport> {
  const now = Date.now();
  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i--) dates.push(utcDate(now - i * 86_400_000));
  const base: (string | number)[][] = [
    ["ZREMRANGEBYSCORE", "presence:z", 0, now - PRESENCE_WINDOW_MS],
    ["ZCARD", "presence:z"],
    ["GET", "stats:visits:total"],
    ["HGETALL", "stats:geo:country"],
  ];
  for (const d of dates) base.push(["GET", `stats:visits:${d}`]);
  for (const d of dates) base.push(["PFCOUNT", `stats:uv:${d}`]);
  const r = await redis(cfg, base);
  const empty: AnalyticsReport = { online: 0, visitsTotal: 0, daily: [], countries: [], cities: [], backend: "upstash", generatedAt: new Date(now).toISOString() };
  if (!r) return empty;

  const online = Number(r[1]) || 0;
  const visitsTotal = Number(r[2]) || 0;
  const visitsArr = r.slice(4, 4 + dates.length).map(x => Number(x) || 0);
  const uvArr = r.slice(4 + dates.length, 4 + 2 * dates.length).map(x => Number(x) || 0);
  const daily = dates.map((date, i) => ({ date, visits: visitsArr[i], uniques: uvArr[i] }));
  const countries = hashPairs(r[3]).map(([code, n]) => ({ code, visits: Number(n) || 0 })).filter(c => c.visits > 0).sort((a, b) => b.visits - a.visits);

  const cityDays = dates.slice(-Math.min(dates.length, CITY_RETAIN_DAYS));
  const rc = await redis(cfg, cityDays.map(d => ["HGETALL", `stats:geo:city:${d}`]));
  const totals = new Map<string, number>();
  if (rc) for (const flat of rc) for (const [f, n] of hashPairs(flat)) totals.set(f, (totals.get(f) || 0) + (Number(n) || 0));
  const cities = Array.from(totals.entries()).map(([f, visits]) => {
    const [code, ...rest] = f.split("|");
    return { code, city: rest.join("|"), visits };
  }).filter(c => c.visits > 0).sort((a, b) => b.visits - a.visits).slice(0, 100);

  return { online, visitsTotal, daily, countries, cities, backend: "upstash", generatedAt: new Date(now).toISOString() };
}

// ── public API (backend-flexible, fail-soft) ─────────────────────────────────

/** Heartbeat: record presence + count a visit once per session + tally geo. Returns online count. */
export async function heartbeat(vid: string, geo: GeoHint): Promise<{ online: number }> {
  const v = cleanVid(vid);
  if (!v) return { online: 0 };
  try {
    const db = await d1();
    if (db) return { online: await d1Heartbeat(db, v, geo) };
    const cfg = upstashCfg();
    if (cfg) return { online: await upHeartbeat(cfg, v, geo) };
  } catch { /* fail soft */ }
  return { online: 0 };
}

/** Current online count only (public badge / GET). */
export async function onlineCount(): Promise<number> {
  try {
    const db = await d1();
    if (db) return await d1Online(db);
    const cfg = upstashCfg();
    if (cfg) return await upOnline(cfg);
  } catch { /* fail soft */ }
  return 0;
}

/** Full report for the admin dashboard. */
export async function getReport(days = 30): Promise<AnalyticsReport> {
  try {
    const db = await d1();
    if (db) return await d1Report(db, days);
    const cfg = upstashCfg();
    if (cfg) return await upReport(cfg, days);
  } catch { /* fail soft */ }
  return { online: 0, visitsTotal: 0, daily: [], countries: [], cities: [], backend: "none", generatedAt: new Date().toISOString() };
}
