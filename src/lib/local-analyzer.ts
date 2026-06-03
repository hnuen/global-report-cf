/**
 * Local Analysis Engine
 * Extracts structured intelligence from scraped official sources
 * without using any LLM. Uses pattern matching, NLP heuristics,
 * and a knowledge base of known entities.
 */

import type { Article, Section } from "./types";
import type { OfficialSource } from "./official-sources";

// ── Entity knowledge base ────────────────────────────────────────────────────

const SANCTIONS_PROGRAMS: Record<string, string> = {
  iran: "Iran", irgc: "Iran", "economic fury": "Iran", adani: "Iran",
  "shadow fleet": "Iran", "strait of hormuz": "Iran", "lpg": "Iran",
  russia: "Russia", rosneft: "Russia", lukoil: "Russia", gazprom: "Russia",
  ukraine: "Russia", crimea: "Russia",
  cuba: "Cuba", gaesa: "Cuba",
  venezuela: "Venezuela", maduro: "Venezuela", "narco": "Venezuela",
  dprk: "DPRK", "north korea": "DPRK", "lazarus": "DPRK", "kim ung": "DPRK",
  hizballah: "Middle East", hezbollah: "Middle East", lebanon: "Middle East",
  hamas: "Middle East", "gaza": "Middle East",
  sinaloa: "Mexico / SEA", cartel: "Mexico / SEA", fentanyl: "Mexico / SEA",
  china: "China / Hong Kong", "hong kong": "China / Hong Kong", smic: "China / Hong Kong",
  huawei: "China / Hong Kong", mofcom: "China / Hong Kong",
  myanmar: "SEA", burma: "SEA", indonesia: "SEA",
  india: "India", pakistan: "India", dgft: "India",
  sudan: "MEA", syria: "MEA", yemen: "MEA", libya: "MEA",
  israel: "Middle East", jordan: "Middle East",
};

const IMPACT_KEYWORDS: Record<string, string> = {
  high: "designat|sanction|penalty|penalt|enforcement|criminal|guilty|plea|billion|million|blocked|seized|arrested|indicted|egregious|major|significant|consent order|formal agreement|civil money",
  medium: "updated|amended|revised|renewed|extended|guidance|advisory|notice|warning|proposed rule|rulemaking",
  low: "reminder|faq|technical|clarif|correction|minor|terminated|termination",
};

const AMOUNT_PATTERN = /\$[\d,]+(?:\.\d+)?(?:\s*(?:million|billion|M|B|K))?/gi;
const DATE_PATTERN = /(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{4}/gi;
const ENTITY_PATTERN = /(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,4})|(?:[A-Z]{2,}(?:\s+[A-Z]{2,})*)/g;

// ── Section classifier ───────────────────────────────────────────────────────

function classifySection(text: string, sourceName: string): Section {
  const t = text.toLowerCase();
  if (sourceName.includes("OCC") || t.includes("comptroller") || t.includes("consent order") || t.includes("national bank")) return "occ";
  if (sourceName.includes("FinCEN") || sourceName.includes("CFPB") || sourceName.includes("Penalties") || t.includes("bsa") || t.includes("aml") || t.includes("civil penalt") || t.includes("enforcement action") && t.includes("bank")) return "penalties";
  if (sourceName.includes("BIS") || sourceName.includes("Export") || sourceName.includes("MOFCOM") || sourceName.includes("Wassenaar") || t.includes("export control") || t.includes("entity list") || t.includes("ear ") || t.includes("dual-use")) return "bis";
  if (sourceName.includes("Fed") || t.includes("federal reserve") || t.includes("interest rate") || t.includes("inflation") || t.includes("gdp") || t.includes("monetary policy") || t.includes("central bank") || t.includes("ecb")) return "economics";
  if (t.includes("pope") || t.includes("vatican") || t.includes("church") || t.includes("religion") || t.includes("faith") || t.includes("interfaith") || t.includes("muslim") || t.includes("christian") || t.includes("jewish")) return "religion";
  return "sanctions";
}

// ── Region detector ──────────────────────────────────────────────────────────

function detectRegion(text: string, sourceName: string): string {
  const t = text.toLowerCase();
  for (const [keyword, region] of Object.entries(SANCTIONS_PROGRAMS)) {
    if (t.includes(keyword)) return region;
  }
  if (sourceName.includes("EU") || t.includes("european union") || t.includes("brussels")) return "EU / Europe";
  if (sourceName.includes("UK") || t.includes("united kingdom") || t.includes("ofsi") || t.includes("british")) return "UK";
  if (t.includes("india") || t.includes("indian")) return "India";
  if (t.includes("indonesia")) return "Indonesia / SEA";
  if (sourceName.includes("Al Jazeera") || t.includes("gulf") || t.includes("middle east") || t.includes("arab")) return "Middle East";
  if (t.includes("africa") || t.includes("nigeria") || t.includes("kenya")) return "MEA";
  if (t.includes("southeast asia") || t.includes("asean")) return "SEA";
  return "Global";
}

// ── Impact scorer ────────────────────────────────────────────────────────────

function scoreImpact(text: string): "high" | "medium" | "low" {
  const t = text.toLowerCase();
  if (new RegExp(IMPACT_KEYWORDS.high, "i").test(t)) return "high";
  if (new RegExp(IMPACT_KEYWORDS.medium, "i").test(t)) return "medium";
  return "low";
}

// ── Extract monetary amounts ─────────────────────────────────────────────────

function extractAmounts(text: string): string[] {
  const matches: string[] = (text.match(AMOUNT_PATTERN) as string[]) || [];
  return [...new Set(matches)].slice(0, 3);
}

// ── Extract key entities (org names, person names) ───────────────────────────

function extractEntities(text: string): string[] {
  const entities: string[] = [];
  // Named entities — capitalized multi-word phrases
  const matches: string[] = text.match(/[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){1,4}/g) || [];
  const filtered = matches
    .filter(e => e.length > 5 && e.length < 60)
    .filter(e => !["The", "This", "These", "That", "Those", "United States", "Department", "Office", "Federal"].includes(e))
    .slice(0, 5);
  return [...new Set(filtered)];
}

// ── Build article from a single text block ───────────────────────────────────

let articleId = 5000;

function buildAnalyzedArticle(text: string, source: OfficialSource, url: string): Article | null {
  if (text.length < 40) return null;

  const section = classifySection(text, source.name);
  const region = detectRegion(text, source.name);
  const impact = scoreImpact(text);
  const amounts = extractAmounts(text);
  const entities = extractEntities(text);

  // Build headline — first sentence or first 150 chars
  const sentences = text.split(/[.!?]\s+/);
  let headline = sentences[0]?.trim() || text.slice(0, 150);
  if (headline.length > 160) headline = headline.slice(0, 157) + "...";

  // Build body — remaining sentences + extracted facts
  const bodyParts: string[] = [];

  if (sentences.length > 1) {
    bodyParts.push(sentences.slice(1, 3).join(". ").trim());
  }

  // Add extracted facts as a structured summary
  const facts: string[] = [];
  if (amounts.length > 0) facts.push(`Amounts mentioned: ${amounts.join(", ")}`);
  if (entities.length > 0) facts.push(`Key entities: ${entities.join(", ")}`);

  const dateMatches = text.match(DATE_PATTERN);
  if (dateMatches?.length) facts.push(`Date references: ${[...new Set(dateMatches)].slice(0,2).join(", ")}`);

  if (facts.length > 0) bodyParts.push(facts.join(" · "));

  if (bodyParts.length === 0) {
    bodyParts.push(`Published by ${source.name}. See source link for full details.`);
  }

  const today = new Date().toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric"
  });

  return {
    id: articleId++,
    section,
    category: source.name.replace("Google News — ", "").replace(" — ", " / "),
    region,
    impact,
    date: today,
    headline,
    body: bodyParts.filter(b => b.length > 10),
    source: source.name,
    sourceUrl: url || source.url,
  };
}

// ── Main analyzer ────────────────────────────────────────────────────────────

export function analyzeOfficialSources(sources: OfficialSource[]): Article[] {
  const articles: Article[] = [];
  const seen = new Set<string>();

  for (const source of sources) {
    if (!source.content || source.content.length < 50) continue;

    // Split content into individual items (bullets or paragraphs)
    const items = source.content
      .split("\n")
      .map(l => l.trim())
      .filter(l => l.length > 40)
      .map(l => l.replace(/^[•\-*]\s*/, "").trim())
      // Strip ||| url parts
      .map(l => l.split(" ||| ")[0].trim())
      .filter(l => l.length > 30);

    // Deduplicate by first 60 chars
    for (const item of items) {
      const key = item.slice(0, 60).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      // Extract URL if present
      const urlMatch = source.content.match(new RegExp(item.slice(0, 30).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ".*?\\|\\|\\|\\s*(https?://[^\\s\\n]+)"));
      const url = urlMatch?.[1] || source.url;

      const article = buildAnalyzedArticle(item, source, url);
      if (article) articles.push(article);

      if (articles.length >= 60) break;
    }
    if (articles.length >= 60) break;
  }

  return articles;
}

// ── Build full briefing without LLM ─────────────────────────────────────────

import type { Briefing } from "./types";

export function buildAnalyzedBriefing(sources: OfficialSource[]): Briefing {
  const articles = analyzeOfficialSources(sources);

  const now = new Date().toLocaleString("en-US", {
    month: "long", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZoneName: "short",
  });

  const emptySidebar = { watchlist: [], keyFigures: [] };

  return {
    lastUpdated: `${now} — Local analysis (all LLMs unavailable)`,
    articles,
    sidebar: {
      sanctions: emptySidebar,
      economics: emptySidebar,
      religion: emptySidebar,
      occ: emptySidebar,
      penalties: emptySidebar,
      bis: emptySidebar,
    },
  };
}
