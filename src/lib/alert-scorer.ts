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
 *   ALERT_COOLDOWN_MINUTES  minimum minutes between SMS for same headline, default 360
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
  const GOV_SOURCES_100 = [
    "ofac.treasury.gov/recent-actions",
    "www.fincen.gov/news/enforcement-actions",
    "www.bis.gov/news-updates",
    "www.gov.uk/government/collections/enforcement-of-financial-sanctions",
  ];
  const EU_COMMISSION = "ec.europa.eu/commission/presscorner";
  const EU_KEYWORDS = ["sanction","fine","penalty","enforcement","designation","restrictive measure","freeze","asset","cartel","antitrust"];
  const isEuCommission = article.sourceUrl?.includes(EU_COMMISSION);
  const euHasKeyword = EU_KEYWORDS.some(k => searchText.includes(k));

  if (GOV_SOURCES_100.some(s => article.sourceUrl?.includes(s))) {
    score = 100;
    reasons.push(`Official enforcement source (100): ${article.sourceUrl}`);
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
  const shouldAlert = sectionOk && score >= threshold;

  return { article, score, reasons, shouldAlert };
}

export function scoreAll(articles: Article[]): ScoredArticle[] {
  return articles
    .map(scoreArticle)
    .sort((a, b) => b.score - a.score);
}

// ── Deduplication — track what we've already alerted on ───────────────────────

export function buildAlertKey(article: Article): string {
  // Stable key: first 60 chars of headline (normalised)
  return article.headline
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .trim()
    .slice(0, 60);
}
