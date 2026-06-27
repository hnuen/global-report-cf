/**
 * AlertScorer
 *
 * Scores each article 0-100 and decides whether it warrants an SMS alert.
 * Rules are configurable via environment variables so you can tune
 * sensitivity without redeploying.
 *
 * Environment variables (all optional — sensible defaults built in):
 *   ALERT_SCORE_THRESHOLD   number 0-100, default 75
 *   ALERT_KEYWORDS          comma-separated list added on top of built-ins
 *   ALERT_SECTIONS          comma-separated sections to watch, default "all"
 *   ALERT_COOLDOWN_MINUTES  minimum minutes before the same article (by sourceUrl)
 *                           can alert again, default 10080 (7 days). This is
 *                           dedup, not a "remind me later" snooze — official
 *                           source articles (OFAC, Treasury, FR, etc.) are
 *                           force-scored 100 below regardless of age, and the
 *                           cached penalty/program feeds always carry the last
 *                           ~10 entries (not just newly-published ones), so a
 *                           short cooldown previously caused the same old
 *                           penalty to re-alert every few hours indefinitely.
 *   ALERT_MAX_AGE_HOURS     max age (by the article's own reported date) for it
 *                           to be alert-eligible at all, default 48. Independent
 *                           of score — stops old cached articles (e.g. a
 *                           penalty from weeks ago) from ever qualifying, even
 *                           on a fresh cooldown.
 */

import type { Article } from "./types";

export interface ScoredArticle {
  article: Article;
  score: number;
  reasons: string[];
  shouldAlert: boolean;
}

// ── Built-in keyword weights ───────────────────────────────────────────────────
// Each entry: [keyword, score_boost, human_reason]
const KEYWORD_RULES: [string, number, string][] = [
  // Highest urgency — action required
  ["SDN",               20, "SDN designation"],
  ["OFAC",              15, "OFAC action"],
  ["designated",        12, "new designation"],
  ["designates",        12, "new designation"],
  ["designation",       12, "new designation"],
  ["Treasury targets",  20, "Treasury targets action"],
  ["Treasury disrupts", 20, "Treasury disrupts action"],
  ["treasury sanctions",18, "Treasury sanctions action"],
  ["entity list",       18, "Entity List addition"],
  ["consent order",     15, "OCC consent order"],
  ["prohibition order", 15, "prohibition order"],
  ["enforcement",       10, "enforcement action"],
  ["penalty",           12, "financial penalty"],
  ["fine",              10, "regulatory fine"],
  ["settlement",        10, "settlement"],
  ["FinCEN",            12, "FinCEN action"],
  ["BIS",               10, "BIS action"],
  ["general license",   15, "General License issued/expiring"],
  ["expires",           18, "deadline expiring soon"],
  ["wind-down",         15, "wind-down deadline"],
  ["seizure",           18, "asset/vessel seizure"],
  ["arrest",            18, "arrest"],
  ["indicted",          20, "criminal indictment"],
  ["sanctioned",        12, "sanctions action"],
  ["blocked",           10, "blocked entity"],
  ["narco",             15, "narcotics trafficking"],
  ["cartel",            15, "cartel designation"],
  ["fentanyl",          18, "fentanyl trafficking"],
  ["terrorist",         18, "terrorism designation"],
  ["hizballah",         18, "Hizballah designation"],
  ["hamas",             18, "Hamas designation"],
  ["iran sanctions",    20, "Iran sanctions action"],
  ["russia sanctions",  20, "Russia sanctions action"],
  ["sinaloa",           18, "Sinaloa Cartel"],
  ["price cap",         15, "oil price cap action"],

  // High-tension geopolitical
  ["strait of hormuz",  20, "Strait of Hormuz"],
  ["nuclear",           18, "nuclear development"],
  ["missile",           15, "missile activity"],
  ["attack",            15, "attack"],
  ["war",               12, "conflict"],
  ["invasion",          15, "military invasion"],
  ["airstrike",         18, "airstrike"],
  ["explosion",         15, "explosion"],
  ["assassination",     20, "assassination"],

  // Major economic signals
  ["federal reserve",   10, "Fed action"],
  ["interest rate",     10, "interest rate change"],
  ["recession",         15, "recession signal"],
  ["default",           18, "debt default"],
  ["collapse",          18, "market/institution collapse"],
  ["bankruptcy",        15, "bankruptcy"],
  ["emergency",         15, "emergency declaration"],

  // Crypto/evasion
  ["garantex",          15, "Garantex/successor activity"],
  ["grinex",            15, "Grinex activity"],
  ["crypto evasion",    12, "crypto evasion"],
  ["privacy coin",      10, "privacy coin activity"],
];

// ── Impact weight ──────────────────────────────────────────────────────────────
const IMPACT_SCORES: Record<string, number> = {
  high:   30,
  medium: 15,
  low:     5,
};

// ── Category weight ────────────────────────────────────────────────────────────
const CATEGORY_BOOSTS: Record<string, number> = {
  "OFAC":             10,
  "Enforcement":      10,
  "Designations":     10,
  "Consent Order":    10,
  "Prohibition Order":10,
  "FinCEN":           10,
  "Entity List":      10,
  "AML / BSA":         8,
};

// ── Recency gate ──────────────────────────────────────────────────────────────
// GOV_SOURCES_100 below force-scores ANY official .gov sourceUrl to 100
// regardless of how old the underlying article is, and the cached penalty/
// program feeds (ofac-github-cache.ts) always carry the last ~10 entries on
// every run, not just newly-published ones. Without an independent recency
// check, a months-old OFAC penalty scores exactly as "urgent" as one from
// this morning and re-qualifies as an alert candidate on every single hourly
// monitor run. This gate is checked separately from score so it can't be
// bypassed by a high score.
const ALERT_MAX_AGE_HOURS = Number(process.env.ALERT_MAX_AGE_HOURS ?? 48);

export function isRecentEnough(dateStr: string, maxAgeHours = ALERT_MAX_AGE_HOURS): boolean {
  if (!dateStr) return true; // can't verify staleness — don't block on missing data
  const trimmed = dateStr.trim();
  // Some sources (e.g. Federal Register notices scraped from program pages)
  // only ever capture a bare 4-digit year, never a full date — Date.parse on
  // just "2026" isn't reliably interpretable as "this is recent." Best we can
  // do without a real date is: only treat the current year as potentially recent.
  if (/^\d{4}$/.test(trimmed)) {
    return Number(trimmed) === new Date().getFullYear();
  }
  const t = Date.parse(trimmed);
  if (isNaN(t)) return true; // unparseable — don't block, just can't filter on it
  const ageMs = Date.now() - t;
  const FUTURE_SLOP_MS = 24 * 60 * 60 * 1000; // tolerate clock/timezone skew
  if (ageMs < -FUTURE_SLOP_MS) return false; // implausibly far in the future — bad data, don't alert
  return ageMs <= maxAgeHours * 60 * 60 * 1000;
}

// ── Scorer ─────────────────────────────────────────────────────────────────────

export function scoreArticle(article: Article): ScoredArticle {
  const reasons: string[] = [];
  let score = 0;

  // 1. Impact
  const impactScore = IMPACT_SCORES[article.impact] ?? 0;
  if (impactScore > 0) {
    score += impactScore;
    reasons.push(`${article.impact} impact (+${impactScore})`);
  }

  // 2. Category boost
  const catBoost = CATEGORY_BOOSTS[article.category] ?? 0;
  if (catBoost > 0) {
    score += catBoost;
    reasons.push(`${article.category} category (+${catBoost})`);
  }

  // 3. Built-in keyword matches (search headline + first paragraph)
  const searchText = [
    article.headline,
    article.body[0] ?? "",
    article.category,
    article.region,
  ].join(" ").toLowerCase();

  const matchedKeywords = new Set<string>();
  for (const [kw, boost, label] of KEYWORD_RULES) {
    if (!matchedKeywords.has(kw) && searchText.includes(kw.toLowerCase())) {
      score += boost;
      reasons.push(`"${label}" (+${boost})`);
      matchedKeywords.add(kw);
    }
  }

  // 4. Custom keywords from env
  const customKWs = (process.env.ALERT_KEYWORDS ?? "")
    .split(",").map(k => k.trim().toLowerCase()).filter(Boolean);
  for (const kw of customKWs) {
    if (searchText.includes(kw)) {
      score += 15;
      reasons.push(`custom keyword "${kw}" (+15)`);
    }
  }

  // Cap at 100
  score = Math.min(100, score);

  // 5. Section filter
  const watchSections = (process.env.ALERT_SECTIONS ?? "all")
    .split(",").map(s => s.trim().toLowerCase());
  const sectionOk = watchSections.includes("all") || watchSections.includes(article.section);

  // 6. Authoritative gov enforcement sources = always 100
  // All official government enforcement/sanctions source domains → force score 100
  const GOV_SOURCES_100 = [
    // OFAC / Treasury — match any treasury.gov URL (press releases, policy pages, OFAC actions)
    "ofac.treasury.gov",
    "home.treasury.gov",
    "treasury.gov",
    // Federal Register
    "federalregister.gov",
    // FinCEN enforcement
    "fincen.gov",
    // OCC enforcement
    "occ.gov/news-events",
    // Federal Reserve enforcement
    "federalreserve.gov/supervisionreg",
    "federalreserve.gov/apps/enforcementactions",
    // BIS export enforcement
    "bis.gov",
    // UK OFSI — match both publications page and org page
    "gov.uk/government/publications/ofsi",
    "gov.uk/government/collections",
    "gov.uk/government/organisations/office-of-financial-sanctions",
    // U.S. State Dept sanctions
    "state.gov/",
  ];
  const EU_COMMISSION = "ec.europa.eu/commission/presscorner";
  const EU_KEYWORDS = ["sanction","fine","penalty","enforcement","designation","restrictive measure","freeze","asset","cartel","antitrust"];
  const isEuCommission = article.sourceUrl?.includes(EU_COMMISSION);
  const euHasKeyword = EU_KEYWORDS.some(k => searchText.includes(k));
  // UK OFSI / EU Commission / UN / OCC articles injected from the GitHub OFAC
  // cache (ofac-github-cache.ts converters) carry their own real gov.uk /
  // ec.europa.eu / press.un.org / occ.gov URLs, but those URLs don't always
  // match the narrow path patterns in GOV_SOURCES_100 above (e.g. a notice
  // lives at gov.uk/government/news/..., not .../publications/ofsi). Trust
  // the source label directly instead — it's already curated/official by
  // construction (each one passed through its own keyword filter in
  // refresh-briefing.mjs before ever landing in this cache).
  //
  // Deliberately NOT included here: "BBC News", "Al Jazeera", "World News"
  // (regions), and "Federal Reserve — Press Releases" — these are general
  // news/press feeds, not enforcement-specific, and force-scoring them to
  // 100 would reintroduce the alert-noise problem the user originally
  // reported. They still alert normally via keyword/impact scoring below.
  // BIS Federal Register items are already covered by the "federalregister.gov"
  // entry in GOV_SOURCES_100, so no special case is needed for those either.
  const isCuratedOfficialSource = article.source === "UK OFSI" || article.source === "EU Commission" ||
    article.source === "United Nations — Press Releases" || article.source === "OCC News Releases";

  if (GOV_SOURCES_100.some(s => article.sourceUrl?.includes(s)) || isCuratedOfficialSource) {
    score = 100;
    reasons.push(`Official enforcement source (100): ${article.source} — ${article.sourceUrl}`);
  } else if (isEuCommission && euHasKeyword) {
    score = 100;
    reasons.push("EU Commission press corner — sanctions/fines keyword match (100)");
  }
  // Section boost — sanctions articles get extra weight
  else if (article.section === "sanctions") {
    score = Math.min(100, score + 10);
    reasons.push("sanctions section (+10)");
  }

  // 7. Threshold check
  const threshold = Number(process.env.ALERT_SCORE_THRESHOLD ?? 65);
  // 8. Recency check — independent of score, see isRecentEnough() above.
  const recentEnough = isRecentEnough(article.date);
  if (!recentEnough) reasons.push(`too old to alert (date: "${article.date}")`);
  const shouldAlert = sectionOk && score >= threshold && recentEnough;

  return { article, score, reasons, shouldAlert };
}

export function scoreAll(articles: Article[]): ScoredArticle[] {
  return articles
    .map(scoreArticle)
    .sort((a, b) => b.score - a.score);
}

// ── Deduplication — track what we've already alerted on ───────────────────────

export function buildAlertKey(article: Article): string {
  // Prefer sourceUrl: it's the actual link to the official action/PDF/notice
  // and never changes between runs. The previous headline-only key broke
  // dedup for Gemini-enriched articles, whose headline wording can shift
  // slightly run-to-run (paraphrasing) for the *same* underlying article —
  // a different key meant the cooldown/already-alerted check never matched,
  // so the same news could resend under a "new" key. sourceUrl doesn't have
  // that problem for official sources, which is exactly the class of article
  // that was duplicating.
  if (article.sourceUrl) {
    return article.sourceUrl.toLowerCase().trim().replace(/\/+$/, "").slice(0, 200);
  }
  // Fallback for articles with no sourceUrl: first 60 chars of headline (normalised)
  return article.headline
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .trim()
    .slice(0, 60);
}
