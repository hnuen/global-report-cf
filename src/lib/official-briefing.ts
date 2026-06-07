// v5 - fix Fed filter expanded
function isConcatenated(text: string): boolean {
  return (text.match(/•/g) || []).length > 2;
}

// Convert any date string to YYYY-MM-DD for consistent sorting
// Today's date as YYYY-MM-DD in US Eastern Time (America/New_York — handles EST/EDT
// automatically). Used as the fallback "publish date" for articles when no real
// date can be extracted, so the displayed default reflects the Eastern-time day
// rather than the UTC day (which can be a day ahead late in the evening ET).
export function todayInEastern(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find(p => p.type === t)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function toISODate(d: string): string {
  if (!d || d === "Ongoing") return d;
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d; // already ISO
  const M: Record<string,string> = {
    january:"01",february:"02",march:"03",april:"04",may:"05",june:"06",
    july:"07",august:"08",september:"09",october:"10",november:"11",december:"12"
  };
  // "Month DD, YYYY"
  const mdy = d.match(/^(\w+)\s+(\d{1,2}),?\s+(\d{4})$/i);
  if (mdy && M[mdy[1].toLowerCase()])
    return `${mdy[3]}-${M[mdy[1].toLowerCase()]}-${mdy[2].padStart(2,"0")}`;
  // "Month YYYY"
  const my = d.match(/^(\w+)\s+(\d{4})$/i);
  if (my && M[my[1].toLowerCase()])
    return `${my[2]}-${M[my[1].toLowerCase()]}-01`;
  // Try native parse
  try {
    const dt = new Date(d);
    if (!isNaN(dt.getTime()))
      return dt.toISOString().slice(0,10);
  } catch {}
  return d;
}

/**
 * Official Briefing Builder
 *
 * When all LLM providers fail, this builds a basic briefing
 * directly from the scraped official government sources.
 * No AI needed — just raw headlines from real websites.
 */

import type { Briefing, Article, Section } from "./types";
import type { OfficialSource } from "./official-sources";

// Map source names to sections
const SOURCE_SECTION_MAP: Record<string, Section> = {
  "OFAC Recent Actions":              "sanctions",
  "OFAC General Licenses":            "sanctions",
  "U.S. Treasury — News":             "sanctions",
  "U.S. Department of State — News":  "sanctions",
  "UK Sanctions List":                "sanctions",
  "UK Government — Latest News":      "sanctions",
  "UK HM Treasury — News":            "sanctions",
  "UK OFSI — Financial Sanctions":    "sanctions",
  "EU External Action — Sanctions":   "sanctions",
  "EU Sanctions Map — Latest":        "sanctions",
  "Google News — Sanctions":          "sanctions",
  "Google News — EU Sanctions":       "sanctions",
  "UN Security Council Sanctions":    "sanctions",
  "UN News — Latest":                 "sanctions",
  "Federal Reserve News":             "economics",
  "Federal Reserve — Press Releases":  "economics",
  "Federal Reserve Enforcement Actions": "penalties",
  "Google News — BIS Export Controls":"bis",
  "BIS Press Releases":               "bis",
  "OCC Enforcement Actions 2026":     "occ",
  "FinCEN Enforcement Actions":                  "penalties",
  "FinCEN News Releases":                        "penalties",
  "OFAC Civil Penalties & Enforcement":          "penalties",
  "CFPB Enforcement Actions":                    "penalties",
  "EU Sanctions Enforcement":                    "penalties",
  "UK Financial Sanctions Penalties":            "penalties",
  "Fines & Fees Justice Center":                 "penalties",
  "Al Jazeera — Latest News":                    "sanctions",
  "EU Commission — Latest News":                 "economics",
  "OFAC Iran Sanctions":                         "sanctions",
  "OFAC Russia Sanctions":                       "sanctions",
  "OFAC Cuba Sanctions":                         "sanctions",
  "OFAC Venezuela Sanctions":                    "sanctions",
  "OFAC Counter Terrorism":                      "sanctions",
  "OFAC Counter Narcotics":                      "sanctions",
  // Country / Geographic Programs
  "OFAC — Afghanistan":                          "sanctions",
  "OFAC — Balkans":                              "sanctions",
  "OFAC — Belarus":                              "sanctions",
  "OFAC — Burma (Myanmar)":                      "sanctions",
  "OFAC — Central African Republic":             "sanctions",
  "OFAC — Cuba":                                 "sanctions",
  "OFAC — DRC":                                  "sanctions",
  "OFAC — Ethiopia":                             "sanctions",
  "OFAC — Hong Kong":                            "sanctions",
  "OFAC — Iran":                                 "sanctions",
  "OFAC — Iraq":                                 "sanctions",
  "OFAC — Lebanon":                              "sanctions",
  "OFAC — Libya":                                "sanctions",
  "OFAC — Mali":                                 "sanctions",
  "OFAC — Nicaragua":                            "sanctions",
  "OFAC — North Korea (DPRK)":                   "sanctions",
  "OFAC — Russia (Harmful Foreign Activities)":  "sanctions",
  "OFAC — Russia (Ukraine-Related)":             "sanctions",
  "OFAC — Somalia":                              "sanctions",
  "OFAC — South Sudan":                          "sanctions",
  "OFAC — Sudan & Darfur":                       "sanctions",
  "OFAC — Venezuela":                            "sanctions",
  "OFAC — Yemen":                                "sanctions",
  "OFAC — PAARSS (Syria Residual)":              "sanctions",
  // Thematic Programs
  "OFAC — Counter Terrorism (SDGT)":             "sanctions",
  "OFAC — Counter Narcotics":                    "sanctions",
  "OFAC — Non-Proliferation":                    "sanctions",
  "OFAC — Cyber-Related":                        "sanctions",
  "OFAC — Global Magnitsky":                     "sanctions",
  "OFAC — Magnitsky":                            "sanctions",
  "OFAC — Transnational Criminal Orgs":          "sanctions",
  "OFAC — CAATSA":                               "sanctions",
  "OFAC — Chinese Military Companies":           "sanctions",
  "OFAC — Hostages & Wrongfully Detained":       "sanctions",
  "OFAC — ICC-Related":                          "sanctions",
  "OFAC — Foreign Election Interference":        "sanctions",
  "OFAC — Rough Diamond Trade Controls":         "sanctions",
  "OFAC — General Licenses":                     "sanctions",
  "OFAC — Recent Actions":                       "sanctions",
};

const SOURCE_CATEGORY_MAP: Record<string, string> = {
  "OFAC Recent Actions":              "OFAC",
  "OFAC General Licenses":            "OFAC General Licence",
  "U.S. Treasury — News":             "U.S. Treasury",
  "U.S. Department of State — News":  "State Department",
  "UK Sanctions List":                "UK Sanctions",
  "UK Government — Latest News":      "UK Government",
  "UK OFSI — Financial Sanctions":    "UK OFSI",
  "EU External Action — Sanctions":   "EU Sanctions",
  "Google News — Sanctions":          "News Roundup",
  "Google News — EU Sanctions":       "EU Sanctions News",
  "UN Security Council Sanctions":    "UN Sanctions",
  "UN News — Latest":                 "UN",
  "Federal Reserve News":             "Federal Reserve",
  "Google News — BIS Export Controls":"BIS / Export Controls",
  "BIS Press Releases":               "BIS",
  "OCC Enforcement Actions 2026":     "OCC Enforcement",
  "FinCEN News Releases":                        "FinCEN",
  "OFAC Civil Penalties & Enforcement":          "OFAC Civil Penalties",
  "Federal Reserve Enforcement Actions":         "Federal Reserve",
  "CFPB Enforcement Actions":                    "CFPB",
  "EU Sanctions Enforcement":                    "EU Enforcement",
  "UK Financial Sanctions Penalties":            "UK OFSI Penalties",
  "Fines & Fees Justice Center":                 "Fines & Fees",
  "Al Jazeera — Latest News":                    "Al Jazeera",
  "EU Commission — Latest News":                 "EU Commission",
  "OFAC Iran Sanctions":                         "OFAC / Iran",
  "OFAC Russia Sanctions":                       "OFAC / Russia",
  "OFAC Cuba Sanctions":                         "OFAC / Cuba",
  "OFAC Venezuela Sanctions":                    "OFAC / Venezuela",
  "OFAC Counter Terrorism":                      "OFAC / CT",
  "OFAC Counter Narcotics":                      "OFAC / Narcotics",
  // Country Programs
  "OFAC — Afghanistan":                          "OFAC / Afghanistan",
  "OFAC — Balkans":                              "OFAC / Balkans",
  "OFAC — Belarus":                              "OFAC / Belarus",
  "OFAC — Burma (Myanmar)":                      "OFAC / Burma",
  "OFAC — Central African Republic":             "OFAC / CAR",
  "OFAC — Cuba":                                 "OFAC / Cuba",
  "OFAC — DRC":                                  "OFAC / DRC",
  "OFAC — Ethiopia":                             "OFAC / Ethiopia",
  "OFAC — Hong Kong":                            "OFAC / Hong Kong",
  "OFAC — Iran":                                 "OFAC / Iran",
  "OFAC — Iraq":                                 "OFAC / Iraq",
  "OFAC — Lebanon":                              "OFAC / Lebanon",
  "OFAC — Libya":                                "OFAC / Libya",
  "OFAC — Mali":                                 "OFAC / Mali",
  "OFAC — Nicaragua":                            "OFAC / Nicaragua",
  "OFAC — North Korea (DPRK)":                   "OFAC / DPRK",
  "OFAC — Russia (Harmful Foreign Activities)":  "OFAC / Russia",
  "OFAC — Russia (Ukraine-Related)":             "OFAC / Ukraine-Russia",
  "OFAC — Somalia":                              "OFAC / Somalia",
  "OFAC — South Sudan":                          "OFAC / South Sudan",
  "OFAC — Sudan & Darfur":                       "OFAC / Sudan",
  "OFAC — Venezuela":                            "OFAC / Venezuela",
  "OFAC — Yemen":                                "OFAC / Yemen",
  "OFAC — PAARSS (Syria Residual)":              "OFAC / PAARSS",
  // Thematic Programs
  "OFAC — Counter Terrorism (SDGT)":             "SDGT",
  "OFAC — Counter Narcotics":                    "OFAC / Narcotics",
  "OFAC — Non-Proliferation":                    "OFAC / Non-Proliferation",
  "OFAC — Cyber-Related":                        "OFAC / Cyber",
  "OFAC — Global Magnitsky":                     "Global Magnitsky",
  "OFAC — Magnitsky":                            "Magnitsky",
  "OFAC — Transnational Criminal Orgs":          "OFAC / TCO",
  "OFAC — CAATSA":                               "CAATSA",
  "OFAC — Chinese Military Companies":           "OFAC / China Military",
  "OFAC — Hostages & Wrongfully Detained":       "OFAC / Hostages",
  "OFAC — ICC-Related":                          "OFAC / ICC",
  "OFAC — Foreign Election Interference":        "OFAC / Election",
  "OFAC — Rough Diamond Trade Controls":         "OFAC / Diamonds",
  "OFAC — General Licenses":                     "OFAC General Licence",
  "OFAC — Recent Actions":                       "OFAC",
};

let articleId = 1000;

// Friendly short source labels
const SOURCE_DISPLAY_NAMES: Record<string, string> = {
  "OFAC Sanctions List Updates":         "OFAC",
  "OFAC Recent Actions":                 "OFAC",
  "OFAC Press Releases":                 "OFAC",
  "OFAC Enforcement Actions":            "OFAC",
  "OFAC Civil Penalties":                "OFAC",
  "OFAC General Licenses":               "OFAC",
  "U.S. Treasury — Press Releases":      "U.S. Treasury",
  "U.S. Treasury — News":                "U.S. Treasury",
  "OFAC — Iran":                         "OFAC / Iran",
  "OFAC — Russia (Harmful Foreign Activities)": "OFAC / Russia",
  "OFAC — North Korea (DPRK)":           "OFAC / DPRK",
  "OFAC — Cuba":                         "OFAC / Cuba",
  "OFAC — Venezuela":                    "OFAC / Venezuela",
  "OFAC — Counter Terrorism (SDGT)":     "OFAC / CT",
  "OFAC — Counter Narcotics":            "OFAC / Narcotics",
  "EU Council — Sanctions RSS":          "EU Council",
  "EU Council — Press Releases":         "EU Council",
  "UK OFSI — Financial Sanctions":       "UK OFSI",
  "UK Sanctions RSS":                    "UK Sanctions",
  "UN SC Sanctions Committees":          "UN Security Council",
  "State Dept — Iran Sanctions":         "State Dept",
  "State Dept — DPRK Sanctions":         "State Dept",
  "BIS Press Releases":                  "BIS",
  "OCC Enforcement Actions 2026":        "OCC",
  "FinCEN News Releases":                "FinCEN",
  "Federal Reserve Enforcement Actions": "Federal Reserve",
};

// Extract real date from bullet text or content (e.g. "March 20, 2026" or "20260320")
function extractDateFromContent(content: string): string | null {
  // Match "Month DD, YYYY" pattern
  const longDate = content.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(20\d{2})\b/);
  if (longDate) return `${longDate[1]} ${longDate[2]}, ${longDate[3]}`;
  // Match OFAC dated URL like /recent-actions/20260521
  const dateUrl = content.match(/recent-actions\/(202\d{5})/);
  if (dateUrl) {
    const d = dateUrl[1];
    const months = ["","January","February","March","April","May","June","July","August","September","October","November","December"];
    const mo = parseInt(d.slice(4,6));
    const dy = parseInt(d.slice(6,8));
    const yr = d.slice(0,4);
    if (mo >= 1 && mo <= 12) return `${months[mo]} ${dy}, ${yr}`;
  }
  return null;
}

// Extract direct article URL from bullet ||| separator or dated OFAC URL pattern
function extractDirectUrl(bulletUrl: string, sourceUrl: string, text: string): string {
  // Resolve relative hrefs (e.g. /news/enforcement-actions/case-name) to absolute
  if (bulletUrl && bulletUrl.startsWith("/")) {
    try {
      const base = new URL(sourceUrl);
      bulletUrl = `${base.protocol}//${base.host}${bulletUrl}`;
    } catch {}
  }
  // If bullet has a specific URL that isn't just the source index page
  if (bulletUrl && bulletUrl !== sourceUrl && bulletUrl.startsWith("http") && bulletUrl.length > 10) {
    return bulletUrl;
  }
  // Try to extract dated OFAC URL from text
  const dated = text.match(/ofac\.treasury\.gov\/recent-actions\/(20\d{6})/);
  if (dated) return `https://ofac.treasury.gov/recent-actions/${dated[1]}`;
  // Try Treasury press release sb#### pattern
  const sb = text.match(/home\.treasury\.gov\/news\/press-releases\/(sb\d+)/);
  if (sb) return `https://home.treasury.gov/news/press-releases/${sb[1]}`;
  return sourceUrl;
}

function buildArticleFromSource(source: OfficialSource): Article | null {
  if (!source.content || source.content.length < 50) return null;

  const isTreasuryPR2 = source.name.startsWith("Treasury Press Release ");
  const section = SOURCE_SECTION_MAP[source.name] ?? "sanctions";
  const isGoogleNews = source.url?.includes("news.google.com");
  const isOfficial = (source as any).official === true || !isGoogleNews;
  const category = SOURCE_CATEGORY_MAP[source.name] ?? source.name;
  const displaySource = SOURCE_DISPLAY_NAMES[source.name] ||
    (isTreasuryPR2 ? "U.S. Treasury" : source.name
      .replace("OFAC Sanctions List Updates", "OFAC")
      .replace("U.S. Treasury — OFAC Sanctions", "U.S. Treasury / OFAC")
      .replace("U.S. Treasury — Press Releases", "U.S. Treasury")
      .replace("U.S. Treasury — Enforcement", "U.S. Treasury")
      .replace(/^U\.S\. Treasury — /, "U.S. Treasury / ")
      .replace(/^Google News — /, "")
      .replace(/^OFAC — /, "OFAC / "));

  // Default/fallback date — Eastern Time day (matches the "lastUpdated" timestamp
  // below, which is also shown in America/New_York).
  const today = todayInEastern();

  // Extract bullet points (headlines from official sites)
  const rawBulletLines = source.content
    .split("\n")
    .map(l => l.trim())
    .filter(l => l.startsWith("•") && l.length > 25)
    .map(l => l.replace(/^•\s*/, "").trim())
    .filter(l => l.length > 15)
    .slice(0, 10);

  if (rawBulletLines.length === 0) return null;

  const isFedReserve = source.name.toLowerCase().includes("federal reserve");
  const NAV_PATTERNS = [
    /^https?:\/\//i, /^\/[a-z]/,
    /^additional sanctions/i, /^sanctions programs/i,
    /^civil penalties and enforcement information$/i,
    /^consolidated sanctions list/i, /^non-sdn/i,
    /^frequently asked/i, /^skip to/i, /^here.s how/i,
    /^an official website/i, /^secure .gov/i,
    /^important information/i, /^reminder:/i,
    /^the value of fincen/i, /^answers to frequently/i,
    /^federal register/i, /^pdf download/i,
    // Fed Reserve — only keep enforcement actions, skip everything else
    ...(isFedReserve ? [
      /^minutes of/i, /^speech/i, /^testimony/i, /^research/i,
      /^working paper/i, /^feds? note/i, /^discount rate/i,
      /^open market/i, /^agencies publish resolution/i,
      /^takes oath/i, /^federal open market/i,
      /^regulation\s/i, /^request for comment/i,
      /^federal reserve board and other/i, /^agencies finalize/i,
      /^federal reserve board releases/i,
      /^agencies issue/i, /^agencies publish/i,
      /^supervisory/i, /^monetary policy/i,
      /^kevin warsh/i, /^chair powell/i, /^vice chair/i,
      /^federal reserve board proposes/i,
      /^final rule/i, /^interim final rule/i,
      /^notice of proposed/i, /^annual report/i,
    ] : []),
  ];

  // Parse bullets — format: text ||| url ||| DATE:pubDate brief
  const parsedBullets = rawBulletLines.map(b => {
    const parts = b.split(" ||| ");
    const text = parts[0].trim();
    const url = parts[1]?.trim() || "";
    const rest = parts.slice(2).join(" ||| ").trim();
    // Extract DATE: prefix if present
    const dateMatch = rest.match(/^DATE:([^|]{0,50}?)\s*(\|\|\||$)/);
    const pubDate = dateMatch?.[1]?.trim() || "";
    const brief = rest.replace(/^DATE:[^|]*\|\|\|?\s*/, "").replace(/^DATE:[^\s]*/,"").trim();
    return { text, url, brief, pubDate };
  });

  const cleanBullets = parsedBullets
    .filter(b => b.text.length > 20 && b.text.length < 300)
    .filter(b => !NAV_PATTERNS.some(p => p.test(b.text)))
    .filter(b => !isConcatenated(b.text))
    .slice(0, 8);

  if (cleanBullets.length === 0) return null;

  // Each clean bullet becomes its own article with correct date and direct link
  const articles: Article[] = [];

  for (const bullet of cleanBullets) {
    const headline = bullet.text.slice(0, 200);

    // Use pubDate from RSS first (most accurate), then fall back to content extraction
    const extractedDate = (bullet as any).pubDate ||
      extractDateFromContent(bullet.url + " " + bullet.text + " " + source.content.slice(0, 500));
    const articleDate = toISODate(extractedDate || today);

    // Use the article URL from the RSS item, not the feed URL
    const directUrl = bullet.url && bullet.url.startsWith("http") && !bullet.url.includes("/feeds/") && !bullet.url.includes("/rss")
      ? bullet.url
      : extractDirectUrl(bullet.url, source.url, bullet.url + " " + bullet.text);

    // Build brief body
    let brief = bullet.brief;
    if (!brief || brief.length < 10) {
      const hl = headline.toLowerCase();
      if (hl.includes("designat") || hl.includes("sanction")) brief = "New designations or sanctions measures issued.";
      else if (hl.includes("general license")) brief = "General license issued or amended.";
      else if (hl.includes("removal") || hl.includes("delisting")) brief = "Sanctions removal or delisting action.";
      else if (hl.includes("advisory") || hl.includes("alert")) brief = "Regulatory guidance or advisory notice published.";
      else if (hl.includes("penalty") || hl.includes("settlement")) brief = "Financial penalty or enforcement settlement.";
      else if (hl.includes("non-prolif") || hl.includes("proliferat")) brief = "Non-proliferation designation or action.";
      else brief = `Official action published by ${displaySource}.`;
    }

    // Detect region from headline keywords
    const regionFromHeadline = detectRegionFromContent(headline);
    const region = regionFromHeadline !== "Global" ? regionFromHeadline : detectRegion(source.name);

    articles.push({
      id: articleId++,
      section,
      category,
      region,
      impact: "medium",
      date: articleDate,
      headline,
      body: [brief],
      source: displaySource,
      sourceUrl: directUrl,
    });
  }

  // Return first article; caller handles multiple via buildAllFromSource
  return articles[0] ?? null;
}

// Build multiple articles from one source (one per bullet)
export function buildAllFromSource(source: OfficialSource): Article[] {
  if (!source.content || source.content.length < 50) return [];

  const section = SOURCE_SECTION_MAP[source.name] ?? "sanctions";
  const category = SOURCE_CATEGORY_MAP[source.name] ?? source.name;
  const displaySource = SOURCE_DISPLAY_NAMES[source.name] ||
    (source.name.startsWith("Treasury Press Release ") ? "U.S. Treasury" : source.name
      .replace("OFAC Sanctions List Updates", "OFAC")
      .replace("U.S. Treasury — OFAC Sanctions", "U.S. Treasury / OFAC")
      .replace(/^U\.S\. Treasury — /, "U.S. Treasury / ")
      .replace(/^Google News — /, "")
      .replace(/^OFAC — /, "OFAC / "));

  // Default/fallback date — Eastern Time day (matches the "lastUpdated" timestamp
  // below, which is also shown in America/New_York).
  const today = todayInEastern();

  const rawBulletLines = source.content
    .split("\n")
    .map(l => l.trim())
    .filter(l => l.startsWith("•") && l.length > 25)
    .map(l => l.replace(/^•\s*/, "").trim())
    .filter(l => l.length > 15)
    .slice(0, 15);

  const NAV_PATTERNS = [
    /^https?:\/\//i, /^\/[a-z]/,
    /^additional sanctions/i, /^sanctions programs/i,
    /^civil penalties and enforcement information$/i,
    /^consolidated sanctions list/i, /^non-sdn/i,
    /^frequently asked/i, /^skip to/i,
    /^an official website/i, /^secure .gov/i,
    /^important information/i, /^federal register/i,
  ];

  const parsedBullets = rawBulletLines.map(b => {
    const parts = b.split(" ||| ");
    const rest = parts.slice(2).join(" ||| ").trim();
    const dateMatch = rest.match(/^DATE:([^|]{0,50}?)\s*(\|\|\||$)/);
    const pubDate = dateMatch?.[1]?.trim() || "";
    const brief = rest.replace(/^DATE:[^\s|]*\s*(\|\|\|)?\s*/, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return { text: parts[0].trim(), url: parts[1]?.trim() || "", brief, pubDate };
  }).filter(b =>
    b.text.length > 20 && b.text.length < 300 &&
    !NAV_PATTERNS.some(p => p.test(b.text)) &&
    !isConcatenated(b.text)
  );

  return parsedBullets.map(bullet => {
    const headline = bullet.text.slice(0, 200);
    const articleDate = toISODate(bullet.pubDate || extractDateFromContent(bullet.url + " " + bullet.text + " " + source.content.slice(0, 300)) || today);
    const directUrl = bullet.url && bullet.url.startsWith("http") && !bullet.url.includes("/feeds/") && !bullet.url.endsWith(".xml") && !bullet.url.includes("news.google.com")
      ? bullet.url
      : extractDirectUrl(bullet.url, source.url, bullet.url + " " + bullet.text);

    let brief = bullet.brief;
    if (!brief || brief.length < 10) {
      const hl = headline.toLowerCase();
      if (hl.includes("designat") || hl.includes("sanction")) brief = "New designations or sanctions measures issued.";
      else if (hl.includes("general license")) brief = "General license issued or amended.";
      else if (hl.includes("removal") || hl.includes("delisting")) brief = "Sanctions removal or delisting action.";
      else if (hl.includes("advisory") || hl.includes("alert")) brief = "Regulatory guidance or advisory notice published.";
      else if (hl.includes("non-prolif") || hl.includes("proliferat")) brief = "Non-proliferation designation or action.";
      else brief = `Official action published by ${displaySource}.`;
    }

    const regionFromHeadline = detectRegionFromContent(headline);
    const region = regionFromHeadline !== "Global" ? regionFromHeadline : detectRegion(source.name);

    return {
      id: articleId++,
      section,
      category,
      region,
      impact: "medium" as const,
      date: articleDate,
      headline,
      body: [brief],
      source: displaySource,
      sourceUrl: directUrl,
    };
  });
}

// Base URLs for resolving relative links per source domain
const SOURCE_BASE_URLS: Record<string, string> = {
  "U.S. Treasury — Press Releases":     "https://home.treasury.gov",
  "U.S. Treasury — News RSS":            "https://home.treasury.gov",
  "U.S. Treasury — Press Releases RSS":  "https://home.treasury.gov",
  "OFAC RSS Feed":                       "https://ofac.treasury.gov",
  "OFAC Sanctions List Updates":         "https://ofac.treasury.gov",
  "OFAC Press Releases":                 "https://ofac.treasury.gov",
  "OFAC Enforcement Actions":            "https://ofac.treasury.gov",
  "OFAC General Licenses":              "https://ofac.treasury.gov",
  "OFAC Civil Penalties":               "https://ofac.treasury.gov",
  "OFAC Civil Penalties 2026":          "https://ofac.treasury.gov",
  "OFAC Civil Penalties 2025":          "https://ofac.treasury.gov",
  "OFAC Civil Penalties & Enforcement": "https://ofac.treasury.gov",
  "OCC Enforcement Actions 2026":       "https://www.occ.gov",
  "Federal Reserve — Press Releases":   "https://www.federalreserve.gov",
  "Federal Reserve News":               "https://www.federalreserve.gov",
  "Federal Reserve Enforcement Actions":"https://www.federalreserve.gov",
  "BIS Press Releases":                          "https://www.bis.gov",
  "BIS Export Enforcement":                     "https://www.bis.gov",
  "China MOFCOM — Export Controls":             "http://english.mofcom.gov.cn",
  "China MOFCOM — Trade News":                  "http://english.mofcom.gov.cn",
  "EU Dual-Use Export Controls":                "https://policy.trade.ec.europa.eu",
  "Wassenaar Arrangement News":                 "https://www.wassenaar.org",
  "SIPRI Export Controls":                      "https://www.sipri.org",
  "UK Strategic Export Controls":               "https://www.gov.uk",
  "India DGFT — Trade Notices":               "https://www.dgft.gov.in",
  "India MEA — Press Releases":               "https://www.mea.gov.in",
  "Global Sanctions — India":                 "https://globalsanctions.com",
  "U.S. State Department — News":       "https://www.state.gov",
  "FinCEN Enforcement Actions":         "https://www.fincen.gov",
  "FinCEN News Releases":               "https://www.fincen.gov",
  "CFPB Enforcement Actions":           "https://www.consumerfinance.gov",
  "EU Council — Sanctions RSS":          "https://www.consilium.europa.eu",
  "EU Council — Russia Sanctions":       "https://www.consilium.europa.eu",
  "EU Council — Iran Sanctions":         "https://www.consilium.europa.eu",
  "EU Council — Press Releases":         "https://www.consilium.europa.eu",
  "UK OFSI — Financial Sanctions":       "https://www.gov.uk",
  "UK OFSI — Enforcement Penalties":     "https://www.gov.uk",
  "UK Sanctions RSS":                    "https://www.gov.uk",
  "UK Foreign Office — Sanctions":       "https://www.gov.uk",
  "State Dept — Iran Sanctions":         "https://www.state.gov",
  "State Dept — Venezuela Sanctions":    "https://www.state.gov",
  "OFAC DPRK Sanctions":                 "https://ofac.treasury.gov",
  "State Dept — DPRK Sanctions":         "https://www.state.gov",
  "UN SC Sanctions Committees":          "https://www.un.org",
  // All OFAC program pages
  "OFAC — Afghanistan":                  "https://ofac.treasury.gov",
  "OFAC — Balkans":                      "https://ofac.treasury.gov",
  "OFAC — Belarus":                      "https://ofac.treasury.gov",
  "OFAC — Burma (Myanmar)":              "https://ofac.treasury.gov",
  "OFAC — Central African Republic":     "https://ofac.treasury.gov",
  "OFAC — Cuba":                         "https://ofac.treasury.gov",
  "OFAC — DRC":                          "https://ofac.treasury.gov",
  "OFAC — Ethiopia":                     "https://ofac.treasury.gov",
  "OFAC — Hong Kong":                    "https://ofac.treasury.gov",
  "OFAC — Iran":                         "https://ofac.treasury.gov",
  "OFAC — Iraq":                         "https://ofac.treasury.gov",
  "OFAC — Lebanon":                      "https://ofac.treasury.gov",
  "OFAC — Libya":                        "https://ofac.treasury.gov",
  "OFAC — Mali":                         "https://ofac.treasury.gov",
  "OFAC — Nicaragua":                    "https://ofac.treasury.gov",
  "OFAC — North Korea (DPRK)":           "https://ofac.treasury.gov",
  "OFAC — Russia (Harmful Foreign Activities)": "https://ofac.treasury.gov",
  "OFAC — Russia (Ukraine-Related)":     "https://ofac.treasury.gov",
  "OFAC — Somalia":                      "https://ofac.treasury.gov",
  "OFAC — South Sudan":                  "https://ofac.treasury.gov",
  "OFAC — Sudan & Darfur":               "https://ofac.treasury.gov",
  "OFAC — Venezuela":                    "https://ofac.treasury.gov",
  "OFAC — Yemen":                        "https://ofac.treasury.gov",
  "OFAC — PAARSS (Syria Residual)":      "https://ofac.treasury.gov",
  "OFAC — Counter Terrorism (SDGT)":     "https://ofac.treasury.gov",
  "OFAC — Counter Narcotics":            "https://ofac.treasury.gov",
  "OFAC — Non-Proliferation":            "https://ofac.treasury.gov",
  "OFAC — Cyber-Related":                "https://ofac.treasury.gov",
  "OFAC — Global Magnitsky":             "https://ofac.treasury.gov",
  "OFAC — Magnitsky":                    "https://ofac.treasury.gov",
  "OFAC — Transnational Criminal Orgs":  "https://ofac.treasury.gov",
  "OFAC — CAATSA":                       "https://ofac.treasury.gov",
  "OFAC — Chinese Military Companies":   "https://ofac.treasury.gov",
  "OFAC — Hostages & Wrongfully Detained": "https://ofac.treasury.gov",
  "OFAC — ICC-Related":                  "https://ofac.treasury.gov",
  "OFAC — Foreign Election Interference": "https://ofac.treasury.gov",
  "OFAC — Rough Diamond Trade Controls": "https://ofac.treasury.gov",
  "OFAC — General Licenses":             "https://ofac.treasury.gov",
  "OFAC — Recent Actions":               "https://ofac.treasury.gov",
  "EU Commission — Latest News":        "https://commission.europa.eu",
  "EU External Action — Sanctions":     "https://www.eeas.europa.eu",
  "UK Government — Latest News":        "https://www.gov.uk",
  "UK HM Treasury — News":             "https://www.gov.uk",
  "UK Financial Sanctions Penalties":   "https://www.gov.uk",
  "UN News — Latest":                   "https://news.un.org",
  "Al Jazeera — Latest News":           "https://www.aljazeera.com",
};

// Detect region from article content (for Treasury press releases)
function detectRegionFromContent(text: string): string {
  const t = text.toLowerCase();
  if (t.includes("iran") || t.includes("irgc") || t.includes("economic fury")) return "Iran";
  if (t.includes("russia") || t.includes("ukraine") || t.includes("rosneft") || t.includes("lukoil")) return "Russia";
  if (t.includes("cuba") || t.includes("gaesa") || t.includes("cubans")) return "Cuba";
  if (t.includes("venezuela") || t.includes("maduro") || t.includes("chavez")) return "Venezuela";
  if (t.includes("dprk") || t.includes("north korea") || t.includes("kim")) return "DPRK";
  if (t.includes("hizballah") || t.includes("hezbollah") || t.includes("lebano")) return "Middle East";
  if (t.includes("sinaloa") || t.includes("cartel") || t.includes("fentanyl")) return "Mexico / SEA";
  if (t.includes("china") || t.includes("hong kong") || t.includes("prc")) return "China / Hong Kong";
  if (t.includes("myanmar") || t.includes("burma") || t.includes("southeast asia")) return "SEA";
  if (t.includes("europe") || t.includes("eu sanctions")) return "EU / Europe";
  return "United States";
}

// Detect region from source name
function detectRegion(sourceName: string): string {
  if (sourceName.includes("EU Council") || sourceName.includes("EU Commission") || sourceName.includes("Europa") || sourceName.includes("EU External")) return "EU / Europe";
  if (sourceName.includes("UK") || sourceName.includes("OFSI") || sourceName.includes("HM Treasury") || sourceName.includes("UK Foreign")) return "UK";
  if (sourceName.includes("UN SC") || sourceName.includes("United Nations")) return "Global";
  // Country programs
  if (sourceName.includes("— Iran") || sourceName.includes("Iran Sanctions")) return "Iran";
  if (sourceName.includes("— Russia") || sourceName.includes("Russia Sanctions") || sourceName.includes("Ukraine-Russia")) return "Russia";
  if (sourceName.includes("— Cuba")) return "Cuba";
  if (sourceName.includes("— Venezuela")) return "Venezuela";
  if (sourceName.includes("— North Korea") || sourceName.includes("DPRK")) return "DPRK";
  if (sourceName.includes("— Hong Kong") || sourceName.includes("Chinese Military") || sourceName.includes("CAATSA")) return "China / HK";
  if (sourceName.includes("— Lebanon") || sourceName.includes("— Iraq") || sourceName.includes("— Libya") ||
      sourceName.includes("— Yemen") || sourceName.includes("— Sudan") || sourceName.includes("— Somalia") ||
      sourceName.includes("— Mali") || sourceName.includes("— DRC") || sourceName.includes("— CAR") ||
      sourceName.includes("— South Sudan") || sourceName.includes("PAARSS")) return "MEA";
  if (sourceName.includes("— Balkans") || sourceName.includes("— Belarus")) return "EU / Europe";
  if (sourceName.includes("— Burma")) return "SEA";
  if (sourceName.includes("— Nicaragua")) return "Global";
  if (sourceName.includes("— Afghanistan")) return "MEA";
  if (sourceName.includes("— Ethiopia")) return "MEA";
  // Thematic programs
  if (sourceName.includes("Counter Terrorism") || sourceName.includes("SDGT")) return "Global";
  if (sourceName.includes("Counter Narcotics") || sourceName.includes("Transnational Criminal")) return "Global";
  if (sourceName.includes("Non-Proliferation")) return "Global";
  if (sourceName.includes("Cyber")) return "Global";
  if (sourceName.includes("Magnitsky")) return "Global";
  if (sourceName.includes("Election Interference")) return "Global";
  if (sourceName.includes("Hostages")) return "Global";
  if (sourceName.includes("ICC")) return "Global";
  if (sourceName.includes("Rough Diamond")) return "MEA";
  if (sourceName.includes("UN") || sourceName.includes("United Nations")) return "Global";
  if (sourceName.includes("Al Jazeera")) return "Global";
  if (sourceName.includes("Google News — EU")) return "EU / Europe";
  if (sourceName.includes("Google News — BIS")) return "United States / China";
  if (sourceName.includes("China MOFCOM")) return "China / Hong Kong";
  if (sourceName.includes("Google News — China Export")) return "China / Hong Kong";
  if (sourceName.includes("Wassenaar")) return "Global";
  if (sourceName.includes("SIPRI")) return "Global";
  if (sourceName.includes("EU Dual-Use")) return "EU / Europe";
  if (sourceName.includes("UK Strategic Export")) return "UK";
  if (sourceName.includes("Google News — Global Sanctions")) return "Global";
  if (sourceName.includes("Google News — Iran")) return "Iran";
  if (sourceName.includes("Google News — Russia")) return "Russia";
  if (sourceName.includes("Google News — Cuba")) return "Cuba";
  if (sourceName.includes("Google News — Venezuela")) return "Venezuela";
  if (sourceName.includes("Google News — China")) return "China / Hong Kong";
  if (sourceName.includes("Google News — DPRK")) return "DPRK";
  if (sourceName.includes("Google News — Middle East")) return "Middle East";
  if (sourceName.includes("Google News — Southeast")) return "SEA";
  if (sourceName.includes("India DGFT") || sourceName.includes("India MEA") || sourceName.includes("India Sanctions") || sourceName.includes("India Pakistan") || sourceName.includes("Google News — India")) return "India";
  if (sourceName.includes("Indonesia")) return "Indonesia / SEA";
  if (sourceName.includes("Global Sanctions — India")) return "India";
  if (sourceName.includes("Iran")) return "Iran";
  if (sourceName.includes("Russia")) return "Russia";
  if (sourceName.includes("Cuba")) return "Cuba";
  if (sourceName.includes("Venezuela")) return "Venezuela";
  if (sourceName.includes("Counter Terror")) return "Middle East";
  if (sourceName.includes("Counter Narco") || sourceName.includes("Sinaloa")) return "Mexico / SEA";
  if (sourceName.includes("OCC") || sourceName.includes("FinCEN") || sourceName.includes("Federal Reserve")
    || sourceName.includes("CFPB") || sourceName.includes("State Department") || sourceName.includes("Treasury")
    || sourceName.includes("OFAC") || sourceName.includes("BIS")) return "United States";
  return "Global";
}

function buildArticlesFromSource(source: OfficialSource): Article[] {
  if (!source.content || source.content.length < 50) return [];

  // Dynamic OFAC date sources (e.g. "OFAC Actions May 25")
  const isOFACDate = source.name.startsWith("OFAC Actions ");
  // Dynamic Treasury press release sources (e.g. "Treasury Press Release SB0505")
  const isTreasuryPR = source.name.startsWith("Treasury Press Release ");

  // Filter Treasury PRs — only keep sanctions-related content
  // Skip bond auctions, borrowing estimates, refunding statements, TIC data etc.
  if (isTreasuryPR) {
    const c = source.content.toLowerCase();
    const SANCTIONS_KEYWORDS = [
      "sanction","designat","ofac","blocked person","sdn","specially designated",
      "general license","enforcement","penalties","arms","weapons","proliferat",
      "terror","cartel","narco","fentanyl","money laundering","iran","russia",
      "north korea","dprk","cuba","venezuela","hizballah","hezbollah","hamas",
      "isis","isil","al-qaeda","wagner","sinaloa","export control","bis",
    ];
    const NON_SANCTIONS_KEYWORDS = [
      "treasury note","treasury bond","auction","refunding","marketable borrowing",
      "quarterly refunding","tbac","treasury borrowing advisory","tic data",
      "interest rate","yield curve","debt management","bill auction","coupon",
      "savings bond","i bond","tips","floating rate","currency swap",
      "financial literacy","freedom250",
    ];
    const hasSanctions = SANCTIONS_KEYWORDS.some(k => c.includes(k));
    const hasNonSanctions = NON_SANCTIONS_KEYWORDS.some(k => c.includes(k));
    // Skip if clearly non-sanctions OR if has no sanctions keywords at all
    if (hasNonSanctions && !hasSanctions) return [];
    if (!hasSanctions) return [];
  }

  const section = SOURCE_SECTION_MAP[source.name] ?? "sanctions";
  const category = SOURCE_CATEGORY_MAP[source.name] ?? (isOFACDate ? "OFAC" : isTreasuryPR ? "U.S. Treasury" : source.name);
  const baseUrl = SOURCE_BASE_URLS[source.name] || (isOFACDate ? "https://ofac.treasury.gov" : isTreasuryPR ? "https://home.treasury.gov" : "");
  const region = (isOFACDate || isTreasuryPR) ? detectRegionFromContent(source.content) : detectRegion(source.name);
  // Default/fallback date — Eastern Time day (matches the "lastUpdated" timestamp
  // below, which is also shown in America/New_York).
  const today = todayInEastern();

  const NAV_PATTERNS = [
    /^https?:\/\//i, /^\/[a-z]/,
    /^additional sanctions/i, /^sanctions programs/i,
    /^civil penalties and enforcement information$/i,
    /^consolidated sanctions list/i, /^non-sdn/i,
    /^frequently asked/i, /^skip to/i, /^here.s how/i,
    /^an official website/i, /^secure .gov/i,
    /^important information/i, /^reminder:/i,
    /^the value of fincen/i, /^answers to frequently/i,
    /^federal register/i, /^pdf download/i,
    /^rss/i, /^share/i, /^print/i,
    /^filter by/i, /^browse ofac/i, /^selected general licenses issued/i,
    /^sanctions list updates/i, /^ofac related press releases/i,
    /sanctions list updates.*filter/i,
  ];
  // Also reject headlines that are just bullet concatenations (contain multiple •)
  const isConcatenated = (text: string) => (text.match(/•/g) || []).length > 2;

  // Extract bullets from content
  const rawBullets = source.content
    .split("\n")
    .map(l => l.trim())
    .filter(l => l.startsWith("•") && l.length > 25)
    .map(l => l.replace(/^•\s*/, "").trim());

  // Parse text ||| url ||| description, resolving relative URLs
  const parsed: Array<{text:string;url:string;pubDate?:string;hasDirectLink?:boolean}> = rawBullets
    .map(b => {
      const parts = b.split(" ||| ");
      const rest3 = parts.slice(2).join(" ||| ").trim();
      const dateMatch3 = rest3.match(/^DATE:([^|]{0,50}?)\s*(\|\|\||$)/);
      const rssDate3 = dateMatch3?.[1]?.trim() || "";
      // Strip "DATE:..." AND the following " ||| " separator — leaving only the brief text.
      // (A bare /^DATE:[^\s]*/ replace leaves a stray "|||" prefix on desc, which then
      // leaks into the article body as visible "||| <raw text>" artifacts.)
      const desc = rest3.replace(/^DATE:[^\s|]*\s*(\|\|\|)?\s*/, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      let url = parts[1]?.trim() || source.url;
      if (url.includes("/feeds/") || url.endsWith(".xml") || url.includes("news.google.com")) url = source.url;
      // Resolve relative URLs
      if (url.startsWith("/") && baseUrl) url = baseUrl + url;
      // Store description back in text field with separator for article builder
      const textWithDesc: string = desc.length > 20 ? `${parts[0].trim()} ||| ${desc}` : parts[0].trim();
      return { text: textWithDesc, url, pubDate: rssDate3 };
    })
    .filter(b => b.text.length > 30)
    .filter(b => !NAV_PATTERNS.some(p => p.test(b.text)))
    .slice(0, 10);

  if (parsed.length === 0) return [];

  // Friendly short source label
  const displaySource = SOURCE_DISPLAY_NAMES[source.name] ||
    (isTreasuryPR ? "U.S. Treasury" : source.name
      .replace("OFAC Sanctions List Updates", "OFAC")
      .replace("U.S. Treasury — OFAC Sanctions", "U.S. Treasury / OFAC")
      .replace(/^U\.S\. Treasury — /, "U.S. Treasury / ")
      .replace(/^Google News — /, "")
      .replace(/^OFAC — /, "OFAC / "));

  // Create one article per bullet — body shows description if available (RSS), else directs to source
  return parsed.map((item) => {
    // RSS items have format: "headline ||| url ||| description"
    const parts2 = item.text.split(" ||| ");
    const headline = parts2[0].slice(0, 180);
    const description = parts2[1] || "";

    // Extract real date — try multiple sources
    const months = ["","January","February","March","April","May","June","July","August","September","October","November","December"];
    // Prefer the actual RSS/feed-supplied publish date (pubDate/published/updated/dc:date)
    // over "today" — this was previously parsed and then discarded, causing every
    // article to be stamped with the fetch date instead of its real publish date.
    let articleDateRaw = today;
    if (item.pubDate) {
      const parsedPub = new Date(item.pubDate);
      if (!isNaN(parsedPub.getTime())) articleDateRaw = item.pubDate;
    }
    // 1. From dated OFAC URL e.g. /recent-actions/20260527 — most precise when present,
    //    so it takes priority even over a parsed pubDate.
    const dateFromUrl = item.url.match(/recent-actions\/(202\d)(\d{2})(\d{2})/);
    if (dateFromUrl) {
      const mo = parseInt(dateFromUrl[2]);
      const dy = parseInt(dateFromUrl[3]);
      if (mo >= 1 && mo <= 12) articleDateRaw = `${months[mo]} ${dy}, ${parseInt(dateFromUrl[1])}`;
    }
    // 2. From source URL (for date-specific pages the source itself has the date)
    const dateFromSource = source.url.match(/recent-actions\/(202\d)(\d{2})(\d{2})/);
    if (dateFromSource && articleDateRaw === today) {
      const mo = parseInt(dateFromSource[2]);
      const dy = parseInt(dateFromSource[3]);
      if (mo >= 1 && mo <= 12) articleDateRaw = `${months[mo]} ${dy}, ${parseInt(dateFromSource[1])}`;
    }
    // 3. From "Release Date" field in content
    const releaseDateMatch = source.content.match(/Release Date[^\n]*?\n([^\n]{5,30})/);
    if (releaseDateMatch && articleDateRaw === today) {
      const parsed = new Date(releaseDateMatch[1].trim());
      if (!isNaN(parsed.getTime())) articleDateRaw = releaseDateMatch[1].trim();
    }
    // 4. From date pattern anywhere near top of content
    const topContent = source.content.slice(0, 500);
    const dateInTop = topContent.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(20\d{2})\b/);
    if (dateInTop && articleDateRaw === today) articleDateRaw = `${dateInTop[1]} ${dateInTop[2]}, ${dateInTop[3]}`;
    const articleDate = toISODate(articleDateRaw);

    // Build body — use description if available, otherwise generate a contextual brief
    let body: string[];
    if (description.length > 20) {
      body = [description];
    } else {
      const hl = headline.toLowerCase();
      let context = "";
      if (hl.includes("designat") || hl.includes("sanction")) context = "New designations or sanctions measures issued.";
      else if (hl.includes("penalty") || hl.includes("settlement") || hl.includes("fine")) context = "Financial penalty or enforcement settlement.";
      else if (hl.includes("general license") || hl.includes("licence")) context = "OFAC general license issued or amended.";
      else if (hl.includes("advisory") || hl.includes("alert") || hl.includes("guidance")) context = "Regulatory guidance or advisory notice published.";
      else if (hl.includes("removal") || hl.includes("delisting")) context = "Sanctions removal or delisting action.";
      else if (hl.includes("export") || hl.includes("entity list") || hl.includes("bis")) context = "Export control measures or Entity List update.";
      else context = "Official action — see source link for full details.";
      body = [context];
    }

    // Detect region per-headline for better accuracy
    const hlRegion = detectRegionFromContent(headline);
    const articleRegion = hlRegion !== "Global" ? hlRegion : region;

    return {
      id: articleId++,
      section,
      category,
      region: articleRegion,
      impact: "medium" as const,
      date: articleDate,
      headline,
      body,
      source: displaySource,
      // Use item URL if specific, else fall back to source URL (dated page)
      sourceUrl: item.url && item.url !== source.url ? item.url : source.url,
    };
  });
}

export function buildBriefingFromSources(sources: OfficialSource[]): Briefing {
  const articles: Article[] = [];
  const successful = sources.filter(s => s.content.length > 50);

  for (const source of successful) {
    const sourceArticles = buildArticlesFromSource(source);
    articles.push(...sourceArticles);
    if (articles.length >= 40) break; // cap total
  }

  // Fallback: if no articles extracted, use old method
  if (articles.length === 0) {
    for (const source of successful) {
      const article = buildArticleFromSource(source);
      if (article) articles.push(article);
    }
  }

  const now = new Date().toLocaleString("en-US", {
    month: "long", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZoneName: "short",
    timeZone: "America/New_York",
  });

  const emptySidebar = { watchlist: [], keyFigures: [] };

  return {
    lastUpdated: `${now} — Official government sources`,
    articles,
    sidebar: {
      sanctions:  emptySidebar,
      economics:  emptySidebar,
      religion:   emptySidebar,
      occ:        emptySidebar,
      penalties:  emptySidebar,
      bis:        emptySidebar,
    },
  };
}
