/**
 * FinCEN Press-Releases Auto-Sync
 *
 * Fetches https://www.fincen.gov/news/press-releases, parses enforcement
 * action headlines, and stores NEW records in Redis so the FinCEN penalties
 * table stays current without code changes.  Only ADDS new records — the
 * static FINCEN_PENALTIES array is never modified.
 *
 * Storage (Upstash Redis):
 *   "app:fincen-extra:v1"  — JSON array of FinCENPenalty[]
 *   "app:fincen-sync:ts"   — ISO timestamp of last successful fetch
 *
 * Sync cadence: at most once per 24 h (checked by maybeSyncFinCEN).
 * Wire into the cron handler alongside maybeSyncPenalties (OFAC).
 */

import type { FinCENPenalty } from "./fincen-penalties";

// ── Constants ─────────────────────────────────────────────────────────────────

const ENFORCEMENT_ACTIONS_URL = "https://www.fincen.gov/news/enforcement-actions";
const FINCEN_EXTRA_KEY   = "app:fincen-extra:v1";
const FINCEN_SYNC_TS     = "app:fincen-enforcement-sync:ts";
const EXTRA_TTL          = 365 * 24 * 3600;      // 1 year (seconds)
const SYNC_INTERVAL      = 24 * 60 * 60 * 1000;  // 24 h (ms)

// Headlines containing any of these patterns are treated as penalty actions
const PENALTY_PATTERNS = [
  /\bassesses?\b/i,
  /\bcivil money penalty\b/i,
  /\bpenalty against\b/i,
  /\bpenalty of\b/i,
  /\bimposes?\s+(?:a\s+)?\$[\d,.]+/i,
  /\bfines?\s+\S/i,
];

// ── Upstash helpers (mirrors penalties-fetcher.ts) ────────────────────────────

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

interface ParsedRelease {
  slug: string;       // URL path segment — used as stable dedup key
  url: string;        // full absolute URL
  headline: string;   // link text, stripped of HTML tags
  date: string;       // "YYYY-MM-DD" if found, else "YYYY-01-01"
  year: number;
  matterNumber?: string;
  institutionType?: string;
}

/** Parse FinCEN's authoritative enforcement-actions table directly. */
export function parseEnforcementActionsPage(html: string): ParsedRelease[] {
  const releases: ParsedRelease[] = [];
  const rowRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let row: RegExpExecArray | null;
  while ((row = rowRe.exec(html)) !== null) {
    const cells = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)]
      .map(match => match[1].replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim());
    if (cells.length < 3) continue;
    const link = row[1].match(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
    const dateMatch = cells.join(" | ").match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
    const matter = cells.join(" | ").match(/\b(20\d{2}-[A-Za-z0-9-]+)\b/);
    if (!link || !dateMatch || !matter) continue;
    const href = link[1].startsWith("http") ? link[1] : `https://www.fincen.gov${link[1]}`;
    const headline = link[2].replace(/<[^>]+>/g, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();
    const [, month, day, yearText] = dateMatch;
    releases.push({
      slug: matter[1].toLowerCase(),
      url: href,
      headline,
      date: `${yearText}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`,
      year: Number(yearText),
      matterNumber: matter[1],
      institutionType: cells[cells.length - 1] || "Financial Institution",
    });
  }
  return releases;
}

/**
 * Parse the Drupal-rendered press-releases listing page.
 *
 * Drupal renders article links as:
 *   <a href="/news/news-releases/[slug]">[headline]</a>
 *
 * Dates appear nearby in a <span> or <time> element, e.g.:
 *   <time datetime="2025-12-09T...">December 9, 2025</time>
 *   <span class="date-display-single">December 9, 2025</span>
 *   <span>Jun 9, 2026</span>
 *
 * We do a single linear pass tracking the most-recently-seen date so it
 * can be attributed to the next link found.
 */
function parsePressReleasesPage(html: string): ParsedRelease[] {
  const releases: ParsedRelease[] = [];

  // Token types: date | link
  type DateToken = { type: "date"; date: string; year: number; index: number };
  type LinkToken = { type: "link"; slug: string; url: string; headline: string; index: number };
  const tokens: Array<DateToken | LinkToken> = [];

  // ── Date tokens ──────────────────────────────────────────────────────────
  // <time datetime="2025-12-09...">
  const timeRe = /<time[^>]+datetime="(\d{4}-\d{2}-\d{2})[^"]*"/gi;
  let m: RegExpExecArray | null;
  while ((m = timeRe.exec(html)) !== null) {
    const [y, mo, d] = m[1].split("-").map(Number);
    tokens.push({ type: "date", date: m[1], year: y, index: m.index });
  }

  // Month-name dates like "June 9, 2026" or "Dec 9, 2025"
  const monthRe = /\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),\s+(\d{4})\b/gi;
  const MONTHS: Record<string, string> = {
    january:"01", february:"02", march:"03", april:"04", may:"05", june:"06",
    july:"07", august:"08", september:"09", october:"10", november:"11", december:"12",
    jan:"01", feb:"02", mar:"03", apr:"04", jun:"06", jul:"07",
    aug:"08", sep:"09", oct:"10", nov:"11", dec:"12",
  };
  while ((m = monthRe.exec(html)) !== null) {
    const mo = MONTHS[m[1].toLowerCase()] ?? "01";
    const d  = m[2].padStart(2, "0");
    const yr = Number(m[3]);
    const date = `${yr}-${mo}-${d}`;
    tokens.push({ type: "date", date, year: yr, index: m.index });
  }

  // ── Link tokens ───────────────────────────────────────────────────────────
  // Links to /news/news-releases/[slug]
  const linkRe = /<a\s[^>]*href="(\/news\/news-releases\/([^"?#]+))"[^>]*>([\s\S]*?)<\/a>/gi;
  while ((m = linkRe.exec(html)) !== null) {
    const headline = m[3].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    tokens.push({
      type: "link",
      slug: m[2],
      url: `https://www.fincen.gov${m[1]}`,
      headline,
      index: m.index,
    });
  }

  // ── Linear pass ───────────────────────────────────────────────────────────
  tokens.sort((a, b) => a.index - b.index);

  let lastDate = "";
  let lastYear = new Date().getFullYear();

  for (const token of tokens) {
    if (token.type === "date") {
      lastDate = token.date;
      lastYear = token.year;
    } else {
      // Only keep penalty-related headlines
      if (!PENALTY_PATTERNS.some(re => re.test(token.headline))) continue;
      releases.push({
        slug: token.slug,
        url: token.url,
        headline: token.headline,
        date: lastDate || `${lastYear}-01-01`,
        year: lastYear,
      });
    }
  }

  return releases;
}

// ── Amount + Institution Extraction ──────────────────────────────────────────

/**
 * Parse dollar amount from FinCEN headline.
 * Examples: "$3.5 Million", "$80,000,000", "$37 Million", "$650,000"
 */
function parseAmount(headline: string): { amount: number; display: string } {
  // "$X.X Billion"
  const billion = headline.match(/\$\s*([\d,.]+)\s*Billion/i);
  if (billion) {
    const n = parseFloat(billion[1].replace(/,/g, ""));
    return { amount: Math.round(n * 1_000_000_000), display: `$${n}B` };
  }
  // "$X.X Million"
  const million = headline.match(/\$\s*([\d,.]+)\s*Million/i);
  if (million) {
    const n = parseFloat(million[1].replace(/,/g, ""));
    if (n >= 1000) return { amount: Math.round(n * 1_000), display: `$${Math.round(n/1000)}M` };
    return { amount: Math.round(n * 1_000_000), display: `$${n}M` };
  }
  // "$X,XXX,XXX" or "$XXX,XXX" (bare number with commas)
  const bare = headline.match(/\$([\d]{1,3}(?:,\d{3})+)/);
  if (bare) {
    const n = parseInt(bare[1].replace(/,/g, ""), 10);
    if (n >= 1_000_000) return { amount: n, display: `$${(n/1_000_000).toFixed(n%1_000_000===0?0:1)}M` };
    if (n >= 1_000)     return { amount: n, display: `$${(n/1_000).toFixed(0)}K` };
    return { amount: n, display: `$${n}` };
  }
  return { amount: 0, display: "See press release" };
}

/**
 * Extract institution name from FinCEN headline.
 * Common patterns:
 *   "FinCEN Assesses $X Penalty Against [INST] for …"
 *   "FinCEN Announces … Civil Money Penalty Against [INST]"
 *   "FinCEN Fines [INST] $X for …"
 *   "FinCEN [verb] [INST] for …"
 */
function parseInstitution(headline: string): string {
  const matter = headline.match(/^In the Matter of\s+(.+)$/i);
  if (matter) return matter[1].trim().replace(/[.,]+$/, "");

  // "Against [INST] for …" or "Against [INST]$"
  const against = headline.match(/\bAgainst\s+(.+?)(?:\s+for\b|\s+related\b|\s*$)/i);
  if (against) return against[1].trim().replace(/[.,]+$/, "");

  // "FinCEN Fines [INST] $X"
  const fines = headline.match(/^FinCEN\s+Fines?\s+(.+?)\s+\$/i);
  if (fines) return fines[1].trim();

  // Fallback: strip "FinCEN [verb] " prefix and take up to 60 chars
  const stripped = headline.replace(/^FinCEN\s+\w+\s+/i, "");
  return stripped.slice(0, 60).replace(/[.,]+$/, "").trim();
}

/**
 * Guess institution type from headline keywords.
 */
function guessType(headline: string): string {
  const h = headline.toLowerCase();
  if (/crypto|virtual\s*currency|digital\s*asset|bitcoin|exchange/.test(h)) return "MSB/Crypto";
  if (/casino|gaming/.test(h))        return "Casino";
  if (/bank\b/.test(h))               return "Bank";
  if (/securities|broker/.test(h))    return "Securities";
  if (/insurance/.test(h))            return "Insurance";
  if (/money\s*service|msb/.test(h))  return "MSB";
  return "Financial Institution";
}

// ── Convert ParsedRelease → FinCENPenalty ─────────────────────────────────────

let _autoIdCounter = 0;

function toFinCENRecord(release: ParsedRelease, existingCount: number): FinCENPenalty {
  const { amount, display } = parseAmount(release.headline);
  const institution = parseInstitution(release.headline);
  const seq = String(existingCount + ++_autoIdCounter).padStart(2, "0");
  return {
    id:                  release.matterNumber ? `F${release.matterNumber}` : `F${release.year}-auto-${seq}`,
    date:                release.date,
    year:                release.year,
    institution,
    institutionType:     release.institutionType || guessType(release.headline),
    penalty:             amount,
    penaltyDisplay:      display,
    agencies:            ["FinCEN"],
    violation:           "BSA/AML violation — see press release for full details",
    program:             "BSA / AML",
    voluntaryDisclosure: false,
    egregious:           false,
    sourceUrl:           release.url,
  };
}

// ── Deduplication helpers ─────────────────────────────────────────────────────

function slugFromUrl(url: string): string {
  const m = url.match(/\/news\/(?:news-releases|press-releases)\/([^/?#]+)/);
  return m ? m[1] : "";
}

function normalizeInst(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 30);
}

interface KnownSet {
  slugs: Set<string>;
  nameYear: Set<string>;
}

function buildKnownSet(records: FinCENPenalty[]): KnownSet {
  const slugs   = new Set<string>();
  const nameYear = new Set<string>();
  for (const r of records) {
    const s = slugFromUrl(r.sourceUrl);
    if (s) slugs.add(s);
    nameYear.add(`${normalizeInst(r.institution)}:${r.year}`);
  }
  return { slugs, nameYear };
}

function isNewRelease(release: ParsedRelease, known: KnownSet): boolean {
  if (known.slugs.has(release.slug)) return false;
  const inst = normalizeInst(parseInstitution(release.headline));
  if (known.nameYear.has(`${inst}:${release.year}`)) return false;
  return true;
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Load auto-synced FinCEN records from Redis. */
export async function loadExtraFinCEN(): Promise<FinCENPenalty[]> {
  const raw = await redisGet(FINCEN_EXTRA_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as FinCENPenalty[] : [];
  } catch { return []; }
}

/**
 * Fetch the authoritative FinCEN enforcement-actions table and persist entries not
 * already present in the static FINCEN_PENALTIES array or Redis extra store.
 */
export async function fetchAndSyncFinCEN(
  existingPenalties: FinCENPenalty[]
): Promise<{ added: number; total: number }> {
  console.log("[fincen-fetcher] Fetching FinCEN enforcement-actions table...");

  let html: string;
  try {
    const res = await fetch(ENFORCEMENT_ACTIONS_URL, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; GlobalReportBot/1.0)" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    html = await res.text();
  } catch (e) {
    console.log("[fincen-fetcher] Fetch failed:", String(e).slice(0, 80));
    return { added: 0, total: 0 };
  }

  const parsed = parseEnforcementActionsPage(html);
  console.log(`[fincen-fetcher] Parsed ${parsed.length} enforcement entries from table`);

  // Build known set from static array + current Redis extras
  const existingExtra = await loadExtraFinCEN();
  const known = buildKnownSet([...existingPenalties, ...existingExtra]);

  const newEntries = parsed
    .filter(r => isNewRelease(r, known))
    .map((r, i) => toFinCENRecord(r, existingExtra.length + i));

  if (newEntries.length > 0) {
    // Reset counter after use
    _autoIdCounter = 0;
    const merged = [...existingExtra, ...newEntries];
    await redisSet(FINCEN_EXTRA_KEY, JSON.stringify(merged), EXTRA_TTL);
    console.log(`[fincen-fetcher] Added ${newEntries.length} new records. Extra total: ${merged.length}`);
  } else {
    _autoIdCounter = 0;
    console.log("[fincen-fetcher] No new records found");
  }

  await redisSet(FINCEN_SYNC_TS, new Date().toISOString(), EXTRA_TTL);

  return { added: newEntries.length, total: parsed.length };
}

/**
 * Run sync only if > 24 h since last run.
 * Safe to call on every cron invocation.
 */
export async function maybeSyncFinCEN(
  existingPenalties: FinCENPenalty[]
): Promise<{ ran: boolean; added: number }> {
  const lastRun = await redisGet(FINCEN_SYNC_TS);
  if (lastRun) {
    const elapsed = Date.now() - new Date(lastRun).getTime();
    if (elapsed < SYNC_INTERVAL) {
      console.log(`[fincen-fetcher] Skipped — last run ${Math.round(elapsed / 3600000)}h ago`);
      return { ran: false, added: 0 };
    }
  }
  const { added } = await fetchAndSyncFinCEN(existingPenalties);
  return { ran: true, added };
}
