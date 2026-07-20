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
 *   ALERT_MAX_AGE_HOURS     if set, switches the recency gate back to a rolling
 *                           hours window (legacy behaviour) instead of the
 *                           default "today only" calendar-day check. Default:
 *                           unset — only news dated today (America/New_York)
 *                           is alert-eligible. Independent of score — stops
 *                           old cached articles (e.g. a penalty from weeks
 *                           ago) from ever qualifying, even on a fresh
 *                           cooldown. Changed 2026-06-27: a 48h rolling
 *                           window let days-old backlogged articles (the live
 *                           OFAC scraper often discovers a penalty well after
 *                           its own listed date) re-qualify once a delayed
 *                           monitor run finally caught up, bursting out a
 *                           multi-day backlog of alerts at once instead of
 *                           same-day news only.
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
// undefined → default "today only" calendar-day gate (see header comment).
// Set ALERT_MAX_AGE_HOURS to opt back into the old rolling-hours behaviour.
const ALERT_MAX_AGE_HOURS: number | undefined =
  process.env.ALERT_MAX_AGE_HOURS !== undefined ? Number(process.env.ALERT_MAX_AGE_HOURS) : undefined;

const MONTH_NUM: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

/** Extract a {y,m,d} calendar date from the date-string formats this codebase's
 *  feeds actually use (ISO "2026-06-27...", "June 27, 2026", "06/27/2026").
 *  Returns null if the string doesn't match any of them — deliberately
 *  conservative, since callers treat "can't parse" as "can't confirm it's
 *  today" under the default gate. */
function parseCalendarDate(trimmed: string): { y: string; m: string; d: string } | null {
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (m) return { y: m[1], m: m[2], d: m[3] };

  m = /^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/.exec(trimmed);
  if (m) {
    const mo = MONTH_NUM[m[1].toLowerCase()];
    if (mo) return { y: m[3], m: String(mo).padStart(2, "0"), d: m[2].padStart(2, "0") };
  }

  m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
  if (m) return { y: m[3], m: m[1], d: m[2] };

  return null;
}

/** Today's calendar date in America/New_York — matches the timezone
 *  convention used elsewhere in this project (e.g. sync-programs-library.mjs). */
function todayNY(): { y: string; m: string; d: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? "";
  return { y: get("year"), m: get("month"), d: get("day") };
}

export function isRecentEnough(dateStr: string, maxAgeHours: number | undefined = ALERT_MAX_AGE_HOURS): boolean {
  // Treat missing/empty date as NOT recent — "we don't know when this was published"
  // is not a reason to alert.  OFAC cache entries with no scraped date would otherwise
  // pass the recency gate (empty string is falsy) and fire alerts every cooldown cycle.
  if (!dateStr) return false;
  const trimmed = dateStr.trim();

  // Some sources (e.g. Federal Register notices scraped from program pages)
  // only ever capture a bare 4-digit year, never a full date. That can never
  // resolve to "today" under the default gate; under an explicit hours
  // override, fall back to "is it at least the current year."
  if (/^\d{4}$/.test(trimmed)) {
    if (maxAgeHours === undefined) return false;
    return Number(trimmed) === new Date().getFullYear();
  }

  if (maxAgeHours === undefined) {
    // Default: today only, calendar-day match in America/New_York — not a
    // rolling window, so it can't be fooled by time-of-day edge cases.
    const parsed = parseCalendarDate(trimmed);
    if (!parsed) return false; // can't confirm it's today — don't alert
    const today = todayNY();
    return parsed.y === today.y && parsed.m === today.m && parsed.d === today.d;
  }

  // Explicit rolling-hours override (legacy behaviour).
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
    // FinCEN — deliberately NOT bare "fincen.gov": that domain also hosts
    // proposed rules, press releases, and guidance notices, which were
    // wrongly force-scored 100 and alerted as "enforcement". FinCEN items now
    // only force-100 when the text actually signals enforcement or a FINAL
    // rule — see the fincenActionable check below.
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

  // ── Regulatory event classification ─────────────────────────────────────────
  // Distinguishes actionable events (enforcement, finalized rules) from
  // non-events (proposals, guidance, comment requests). Used both to decide
  // whether FinCEN items force-100, and as a cross-source alert gate below.
  const ENFORCEMENT_PATTERN = /\bassess(?:es|ed|ment)?\b|\bcivil money penalty\b|\bconsent order\b|\bpenalt(?:y|ies)\b|\bimposes?\s+(?:a\s+)?\$?[\d,.]+|\bfine[sd]?\b|\benforcement action\b|\bsettlement\b|\bdisgorge/i;
  const FINAL_RULE_PATTERN  = /\bfinal rule\b|\binterim final rule\b|\bissues?\s+(?:a\s+)?final rule\b|\badopts?\s+(?:a\s+)?final rule\b/i;
  const REG_NONEVENT_PATTERN = /\bpropose[sd]?\b|\bproposed rule\b|\bnotice of proposed rulemaking\b|\bnprm\b|\brequest for comment\b|\bseeks?\s+(?:public\s+)?comment\b|\brequest for information\b|\badvance notice\b|\bissues?\s+guidance\b|\bguidance to\b|\bfact sheet\b/i;

  const looksEnforcement = ENFORCEMENT_PATTERN.test(searchText);
  const looksFinalRule   = FINAL_RULE_PATTERN.test(searchText);
  // FinCEN force-100 ONLY when the item is real enforcement or a final rule.
  const fincenActionable = !!article.sourceUrl?.includes("fincen.gov") && (looksEnforcement || looksFinalRule);

  if (GOV_SOURCES_100.some(s => article.sourceUrl?.includes(s)) || isCuratedOfficialSource || fincenActionable) {
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

  // 9. "No news" / non-event guard — independent of score, same pattern as
  // the recency gate. Gemini is prompted to write 3-4 articles per section
  // even when there's no genuine new development, which produces filler
  // like "Federal Register Shows No New Entity List Additions" — a
  // non-event that still scores 100 (forced by the federalregister.gov
  // GOV_SOURCES_100 rule above) and, because LLM phrasing isn't identical
  // run to run, evades the sourceUrl/headline dedup key — so it re-alerts
  // on every Gemini call that touches that section instead of once. Catch
  // it by content rather than relying on the prompt alone (reported
  // 2026-06-28: this exact BIS filler was firing daily).
  const NO_NEWS_PATTERN = /\bno new\b|\bshows no\b|\breports? no\b|\bno additions?\b|\bno changes?\b|\bnothing new\b|\bremains? unchanged\b|\bdid not add\b|\bno entries (?:were |have been )?added\b|\bno updates? (?:were |have been )?(?:made|reported)\b|\bno actions? (?:were |have been )?(?:taken|reported)\b/i;
  const isNoNewsFiller = NO_NEWS_PATTERN.test(searchText);
  if (isNoNewsFiller) reasons.push(`non-event / "no news" content — never alerts regardless of score`);

  // 9b. Regulatory non-event gate — proposed rules, guidance, and comment
  //     requests are not enforcement and should not page anyone, even from a
  //     .gov domain (this is what fired the June/July FinCEN false positives:
  //     "Propose Rule to Implement GENIUS Act CIP", "Issues Guidance to Help
  //     ... Eliminate Fraud"). Actual enforcement and FINALIZED rules still
  //     alert — the user opted to keep those. See REG_NONEVENT_PATTERN above.
  const isRegulatoryNonEvent =
    REG_NONEVENT_PATTERN.test(searchText) && !looksEnforcement && !looksFinalRule;
  if (isRegulatoryNonEvent) {
    reasons.push("regulatory proposal/guidance (not enforcement or a final rule) — never alerts");
  }

  // 10. AI-generated article gate — Gemini can hallucinate URLs that look
  //     real but return 404s.  Any article produced by the LLM path is
  //     display-only; only verified RSS/scrape articles should trigger alerts.
  const isAiGenerated = !!(article as any).aiGenerated;
  if (isAiGenerated) reasons.push("AI-generated article — display only, never alerts");

  // 11. Trusted-source gate — an alert must carry a direct link to an
  //     official government or well-known media domain. This is the backstop
  //     for the hallucinated-alert problem: even if an LLM article slips
  //     past the aiGenerated flag (e.g. a pipeline that forgets to set it),
  //     an article with no sourceUrl, or a sourceUrl on some unknown domain,
  //     never reaches a phone. Reachability (404s on real domains) is
  //     checked separately in /api/monitor before sending.
  const hasTrustedSource = isTrustedAlertUrl(article.sourceUrl);
  if (!hasTrustedSource) {
    reasons.push(
      article.sourceUrl
        ? `sourceUrl domain not on trusted gov/media list — never alerts (${article.sourceUrl.slice(0, 80)})`
        : "no sourceUrl — alerts require a direct link to a gov/major-media source"
    );
  }

  const shouldAlert = sectionOk && score >= threshold && recentEnough && !isNoNewsFiller && !isRegulatoryNonEvent && !isAiGenerated && hasTrustedSource;

  return { article, score, reasons, shouldAlert };
}

// ── Trusted alert sources ──────────────────────────────────────────────────────
// Well-known media outlets whose links may appear via the RSS/Google News
// feeds. Extend without redeploying via ALERT_TRUSTED_DOMAINS (comma-separated).
const TRUSTED_MEDIA_DOMAINS = [
  "reuters.com", "apnews.com", "bbc.com", "bbc.co.uk", "aljazeera.com",
  "bloomberg.com", "ft.com", "wsj.com", "nytimes.com", "washingtonpost.com",
  "theguardian.com", "cnbc.com", "cnn.com", "politico.com", "axios.com",
  "economist.com",
  "news.google.com", // Google News RSS item links — redirect to the real outlet
];

/** True if the URL's host is an official gov/intergov domain or a well-known media outlet. */
export function isTrustedAlertUrl(url?: string): boolean {
  if (!url || url === "#") return false;
  let host: string;
  try {
    host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch { return false; }

  // Official government / intergovernmental domains
  if (
    host.endsWith(".gov") ||                                  // treasury.gov, occ.gov, state.gov, war.gov, …
    host === "gov.uk" || host.endsWith(".gov.uk") ||          // UK OFSI et al.
    host === "europa.eu" || host.endsWith(".europa.eu") ||    // EU Commission
    host === "un.org" || host.endsWith(".un.org") ||          // UN press
    host.endsWith(".mil")
  ) return true;

  const extra = (process.env.ALERT_TRUSTED_DOMAINS ?? "")
    .split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  return [...TRUSTED_MEDIA_DOMAINS, ...extra].some(d => host === d || host.endsWith("." + d));
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
