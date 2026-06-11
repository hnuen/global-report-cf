/**
 * OFAC Penalties Auto-Sync
 *
 * Fetches the OFAC "Additional Select Settlement Agreements" page, parses new
 * entries, and stores them in Redis so the penalties table stays current without
 * code changes.  Only ADDS new records — existing static PENALTIES are never
 * modified.
 *
 * Storage : Upstash Redis
 *   "app:penalties-extra:v1"  — JSON array of ExtraPenaltyRecord[]
 *   "app:penalties-sync:ts"   — ISO timestamp of last successful fetch
 *
 * Sync cadence : at most once per 24 h (checked by maybeSyncPenalties).
 *   Wire into the existing cron handler so it runs automatically.
 */

import type { PenaltyRecord } from "./penalties-data";

// ── Constants ─────────────────────────────────────────────────────────────────

const SETTLEMENT_PAGE =
  "https://ofac.treasury.gov/civil-penalties-and-enforcement-information" +
  "/2019-enforcement-information/additional-select-settlement-agreements";

const EXTRA_KEY     = "app:penalties-extra:v1";
const SYNC_TS_KEY   = "app:penalties-sync:ts";
const EXTRA_TTL     = 365 * 24 * 3600;   // 1 year
const SYNC_INTERVAL = 24 * 60 * 60 * 1000; // 24 h in ms

// ── Upstash helpers (mirrors article-library.ts pattern) ─────────────────────

function upstashUrl()   { return process.env.UPSTASH_REDIS_REST_URL  ?? ""; }
function upstashToken() { return process.env.UPSTASH_REDIS_REST_TOKEN ?? ""; }

async function redisGet(key: string): Promise<string | null> {
  const url = upstashUrl(), token = upstashToken();
  if (!url || !token) return null;
  try {
    const res = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json() as { result: string | null };
    return data.result ?? null;
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
    });
  } catch { /* non-fatal */ }
}

// ── HTML Parser ───────────────────────────────────────────────────────────────

interface ParsedEntry {
  institution: string;
  year: number;
  date: string;
  sourceUrl: string;
  mediaId: string;   // numeric ID from /media/XXXXX/
  isFinding: boolean; // "Finding of Violation" — no monetary amount
}

/**
 * Extract institution name from the full link text, e.g.:
 *  "Settlement Agreement between … OFAC and Binance Holdings, Ltd."
 *  "Binance Holdings, Ltd. has received a Finding of Violation"
 *  "Binance Holdings, Ltd. Settles Potential Civil Liability"
 */
function extractInstitution(linkText: string): string {
  const t = linkText.trim().replace(/\s+/g, " ");

  // "Settlement Agreement … and INSTITUTION[.|\n|$]"
  const andMatch = t.match(
    /Settlement Agreements?\s+between\s+.+?\s+and\s+(.+?)(?:\.\s*$|$)/i
  );
  if (andMatch) return andMatch[1].replace(/\.$/, "").trim();

  // "INSTITUTION has received a Finding of Violation"
  const fovMatch = t.match(/^(.+?)\s+has received a Finding of Violation/i);
  if (fovMatch) return fovMatch[1].trim();

  // "INSTITUTION Receives a Finding of Violation"
  const fovMatch2 = t.match(/^(.+?)\s+Receives a Finding of Violation/i);
  if (fovMatch2) return fovMatch2[1].trim();

  // "INSTITUTION Settles Potential Civil Liability"
  const settlesMatch = t.match(/^(.+?)\s+Settles Potential/i);
  if (settlesMatch) return settlesMatch[1].trim();

  // Fallback: first 80 chars
  return t.slice(0, 80);
}

/**
 * Extract date from the PDF filename hint in the title attribute, e.g.:
 *   title="20231121_binance_settlement.pdf"  → "2023-11-21"
 *   title="12112013_rbs_settle.pdf"          → "2013-12-11" (MMDDYYYY)
 *   title="scb_settlement.pdf"               → YYYY-01-01 (year only)
 */
function extractDate(titleAttr: string, year: number): string {
  if (!titleAttr) return `${year}-01-01`;

  // YYYYMMDD prefix
  const ymd = titleAttr.match(/^(\d{4})(\d{2})(\d{2})[_-]/);
  if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`;

  // MMDDYYYY prefix (older filenames)
  const mdy = titleAttr.match(/^(\d{2})(\d{2})(\d{4})[_-]/);
  if (mdy) return `${mdy[3]}-${mdy[1]}-${mdy[2]}`;

  return `${year}-01-01`;
}

function parsePage(html: string): ParsedEntry[] {
  const entries: ParsedEntry[] = [];
  let currentYear = 0;

  // Split by <h3> / <h4> year headers and <li> items
  // Year headers look like: <h3>2025 Information</h3>  or  <h3><strong>2025 Information</strong></h3>
  // Links look like: <a href="https://ofac.treasury.gov/media/XXXXX/download?inline" title="filename.pdf">text</a>

  const yearHeaderRe = /<h[34][^>]*>\s*(?:<[^>]+>)?\s*(\d{4})\s+Information/gi;
  const linkRe = /<a\s+href="(https:\/\/ofac\.treasury\.gov\/media\/(\d+)\/download\?inline)"(?:\s+title="([^"]*)")?\s*>([\s\S]*?)<\/a>/gi;

  // Process the HTML in order, tracking current year section
  let pos = 0;
  const combined = [...html.matchAll(yearHeaderRe), ...html.matchAll(linkRe)];

  // Re-do in a single linear pass
  const tokens: Array<
    | { type: "year"; year: number; index: number }
    | { type: "link"; url: string; mediaId: string; title: string; text: string; index: number }
  > = [];

  let m: RegExpExecArray | null;
  const yRe = /<h[34][^>]*>\s*(?:<[^>]+>)?\s*(\d{4})\s+Information/gi;
  while ((m = yRe.exec(html)) !== null) {
    tokens.push({ type: "year", year: parseInt(m[1]), index: m.index });
  }
  const lRe = /<a\s+href="(https:\/\/ofac\.treasury\.gov\/media\/(\d+)\/download\?inline)"(?:\s+title="([^"]*)")?\s*>([\s\S]*?)<\/a>/gi;
  while ((m = lRe.exec(html)) !== null) {
    tokens.push({ type: "link", url: m[1], mediaId: m[2], title: m[3] ?? "", text: m[4], index: m.index });
  }

  tokens.sort((a, b) => a.index - b.index);

  for (const token of tokens) {
    if (token.type === "year") {
      currentYear = token.year;
    } else if (token.type === "link" && currentYear > 0) {
      const rawText = token.text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      const institution = extractInstitution(rawText);
      const isFinding = /Finding of Violation/i.test(rawText);
      const date = extractDate(token.title, currentYear);
      entries.push({
        institution,
        year: currentYear,
        date,
        sourceUrl: token.url,
        mediaId: token.mediaId,
        isFinding,
      });
    }
  }

  return entries;
}

// ── Deduplication ─────────────────────────────────────────────────────────────

/** Build a set of all sourceUrls already in the static PENALTIES array */
export function buildExistingUrlSet(penalties: PenaltyRecord[]): Set<string> {
  return new Set(penalties.map(p => p.sourceUrl));
}

/** Build a set of all mediaIds already known (static + Redis extra) */
function mediaIdFromUrl(url: string): string {
  const m = url.match(/\/media\/(\d+)\//);
  return m ? m[1] : "";
}

// ── Convert ParsedEntry → PenaltyRecord ───────────────────────────────────────

function toRecord(entry: ParsedEntry): PenaltyRecord {
  return {
    id:           `ofac-media-${entry.mediaId}`,
    year:         entry.year,
    date:         entry.date,
    institution:  entry.institution,
    type:         "Corp",          // default; unknown until manually enriched
    regulator:    "OFAC",
    program:      "Sanctions",     // default
    amount:       0,
    amountDisplay: entry.isFinding ? "Finding of Violation" : "See document",
    currency:     "USD",
    violation:    entry.isFinding
      ? "Finding of Violation — see settlement document for full details"
      : "Settlement agreement — see source document for penalty amount and details",
    jurisdiction: "US",
    sourceUrl:    entry.sourceUrl,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Load extra (auto-fetched) penalty records from Redis */
export async function loadExtraPenalties(): Promise<PenaltyRecord[]> {
  const raw = await redisGet(EXTRA_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw) as PenaltyRecord[]; } catch { return []; }
}

/**
 * Fetch OFAC settlement page and persist any entries whose media ID is not
 * already present in the static PENALTIES array or in the Redis extra store.
 * Returns the number of new records added.
 */
export async function fetchAndSyncPenalties(
  existingPenalties: PenaltyRecord[]
): Promise<{ added: number; total: number }> {
  console.log("[penalties-fetcher] Fetching OFAC settlement page...");

  let html: string;
  try {
    const res = await fetch(SETTLEMENT_PAGE, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; GlobalReportBot/1.0)" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    html = await res.text();
  } catch (e) {
    console.log("[penalties-fetcher] Fetch failed:", String(e).slice(0, 80));
    return { added: 0, total: 0 };
  }

  const parsed = parsePage(html);
  console.log(`[penalties-fetcher] Parsed ${parsed.length} entries from page`);

  // Build known mediaId set from static array + existing extra records
  const existingExtra = await loadExtraPenalties();
  const knownMediaIds = new Set<string>([
    ...existingPenalties.map(p => mediaIdFromUrl(p.sourceUrl)),
    ...existingExtra.map(p => mediaIdFromUrl(p.sourceUrl)),
  ]);

  const newEntries = parsed
    .filter(e => e.mediaId && !knownMediaIds.has(e.mediaId))
    .map(toRecord);

  if (newEntries.length > 0) {
    const merged = [...existingExtra, ...newEntries];
    await redisSet(EXTRA_KEY, JSON.stringify(merged), EXTRA_TTL);
    console.log(`[penalties-fetcher] Added ${newEntries.length} new records. Extra total: ${merged.length}`);
  } else {
    console.log("[penalties-fetcher] No new records found");
  }

  // Update sync timestamp
  await redisSet(SYNC_TS_KEY, new Date().toISOString(), EXTRA_TTL);

  return { added: newEntries.length, total: parsed.length };
}

/**
 * Run sync only if > 24 h since last run (avoids hammering OFAC on every cron).
 * Safe to call on every cron invocation.
 */
export async function maybeSyncPenalties(
  existingPenalties: PenaltyRecord[]
): Promise<{ ran: boolean; added: number }> {
  const lastRun = await redisGet(SYNC_TS_KEY);
  if (lastRun) {
    const elapsed = Date.now() - new Date(lastRun).getTime();
    if (elapsed < SYNC_INTERVAL) {
      console.log(`[penalties-fetcher] Skipped — last run ${Math.round(elapsed / 3600000)}h ago`);
      return { ran: false, added: 0 };
    }
  }
  const { added } = await fetchAndSyncPenalties(existingPenalties);
  return { ran: true, added };
}
