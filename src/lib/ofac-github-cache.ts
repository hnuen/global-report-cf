/**
 * ofac-github-cache.ts
 *
 * Reads the OFAC data cache committed by GitHub Actions to data/ofac-cache.json.
 * CF Workers can't reach ofac.treasury.gov directly (IP blocked), but
 * raw.githubusercontent.com is accessible.
 *
 * GitHub Actions scrapes and commits fresh data on every scheduled run.
 * Structure: { updatedAt, recentActions[], civilPenalties[], programs: { [slug]: ProgramData } }
 */

import type { Article } from "./types";

// ── Interfaces ─────────────────────────────────────────────────────────────

interface ProgramEO {
  number: string;
  title: string;
  date: string;
  url: string;
}
interface ProgramFRNotice {
  citation: string;
  description: string;
  year: string;
  glNumbers: string[];
}
interface ProgramGL {
  number: string;
  title: string;
  date: string;
  url: string;
}
export interface ProgramData {
  name: string;
  url: string;
  lastUpdated: string;
  executiveOrders: ProgramEO[];
  frNotices: ProgramFRNotice[];
  generalLicenses: ProgramGL[];
}

interface OfacRecentAction {
  url: string;
  code: string;
  title: string;
  date: string;
}

interface OfacCivilPenalty {
  date: string;    // "MM/DD/YYYY"
  name: string;
  count: string;
  amount: string;
  pdfUrl: string;
}

export interface OfacCache {
  updatedAt: string;
  recentActions: OfacRecentAction[];
  civilPenalties: OfacCivilPenalty[];
  programs?: Record<string, ProgramData>;
  /** @deprecated replaced by programs */
  russiaSanctions?: {
    executiveOrders: ProgramEO[];
    frNotices: ProgramFRNotice[];
    generalLicenses: ProgramGL[];
  };
}

// ── Cache fetch ─────────────────────────────────────────────────────────────

const CACHE_URL = process.env.OFAC_CACHE_URL ||
  "https://raw.githubusercontent.com/hnuen/global-report-cf/main/data/ofac-cache.json";

let _cached: { data: OfacCache; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000; // re-fetch at most once per 10 min

export async function fetchOfacCache(): Promise<OfacCache | null> {
  if (_cached && Date.now() - _cached.fetchedAt < CACHE_TTL_MS) {
    return _cached.data;
  }
  try {
    const res = await fetch(`${CACHE_URL}?t=${Date.now()}`, {
      signal: AbortSignal.timeout(8000),
      headers: { "Cache-Control": "no-cache" },
    });
    if (!res.ok) {
      console.warn(`[ofac-cache] fetch failed: HTTP ${res.status}`);
      return null;
    }
    const data = await res.json() as OfacCache;
    _cached = { data, fetchedAt: Date.now() };
    const progCount = Object.keys(data.programs ?? {}).length;
    console.log(`[ofac-cache] Loaded: ${data.recentActions.length} recent-actions, ${data.civilPenalties.length} penalties, ${progCount} programs (updated ${data.updatedAt})`);
    return data;
  } catch (e) {
    console.warn(`[ofac-cache] fetch error: ${String(e).slice(0, 100)}`);
    return null;
  }
}

// ── Article converters ───────────────────────────────────────────────────────

/** Convert OFAC cache → Article[] for the sanctions section */
export function recentActionsToArticles(actions: OfacRecentAction[], startId = 9000): Article[] {
  return actions.slice(0, 15).map((entry, i) => ({
    id: startId + i,
    section: "sanctions" as const,
    category: "OFAC",
    region: "United States",
    impact: "high" as const,
    date: entry.date || "",
    headline: entry.title,
    body: [
      `OFAC published a new action on ${entry.date || "an unspecified date"}: "${entry.title}". Full details are available at the official OFAC website.`,
    ],
    source: "OFAC Recent Actions",
    sourceUrl: entry.url,
  }));
}

/** Convert OFAC cache → Article[] for the penalties section */
export function civilPenaltiesToArticles(penalties: OfacCivilPenalty[], startId = 9100): Article[] {
  return penalties.slice(0, 10).map((row, i) => {
    const amount = row.amount.startsWith("$") ? row.amount : `$${row.amount}`;
    const parts = row.date.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    const months = ["","January","February","March","April","May","June",
                    "July","August","September","October","November","December"];
    const dateStr = parts ? `${months[+parts[1]]} ${+parts[2]}, ${parts[3]}` : row.date;
    return {
      id: startId + i,
      section: "penalties" as const,
      category: "OFAC Enforcement",
      region: "United States",
      impact: "high" as const,
      date: dateStr,
      headline: `OFAC Penalizes ${row.name} ${amount} for Sanctions Violations`,
      body: [
        `The Office of Foreign Assets Control (OFAC) assessed a civil monetary penalty of ${amount} against ${row.name} for apparent violations of OFAC-administered sanctions programs.`,
        row.pdfUrl
          ? `The settlement agreement is available at: ${row.pdfUrl}`
          : `The action was recorded on ${row.date}.`,
      ],
      source: "OFAC Civil Penalties and Enforcement Information",
      sourceUrl: row.pdfUrl || "https://ofac.treasury.gov/civil-penalties-and-enforcement-information",
    };
  });
}

/** Map a program slug to a human-readable region string */
function slugToRegion(slug: string, name: string): string {
  if (slug.includes("russia") || slug.includes("ukraine")) return "Russia";
  if (slug.includes("iran")) return "Iran";
  if (slug.includes("china") || slug.includes("hk") || slug.includes("hong-kong")) return "China";
  if (slug.includes("north-korea") || slug.includes("dprk")) return "North Korea";
  if (slug.includes("cuba")) return "Cuba";
  if (slug.includes("venezuela")) return "Venezuela";
  if (slug.includes("syria")) return "Syria";
  if (slug.includes("myanmar") || slug.includes("burma")) return "Myanmar";
  if (slug.includes("belarus")) return "Belarus";
  if (slug.includes("mali") || slug.includes("somalia") || slug.includes("sudan") ||
      slug.includes("zimbabwe") || slug.includes("ethiopia") || slug.includes("libya")) return "Africa";
  if (slug.includes("yemen")) return "Yemen";
  if (slug.includes("balkans")) return "Balkans";
  if (slug.includes("nicaragua")) return "Nicaragua";
  if (slug.includes("iraq")) return "Iraq";
  if (slug.includes("cyber")) return "Cyber";
  if (slug.includes("terror")) return "Global";
  return name.split(" ")[0] || "United States";
}

/**
 * Convert all programs in cache → Article[] for the sanctions section.
 * Uses FR notices (most reliable, available even when GLs are JS-rendered).
 * Falls back to GL PDFs if no FR notices found for a program.
 */
export function programsToArticles(
  programs: Record<string, ProgramData>,
  startId = 9200,
  existingUrls: Set<string> = new Set()
): Article[] {
  const articles: Article[] = [];
  let id = startId;

  for (const [slug, prog] of Object.entries(programs)) {
    const region = slugToRegion(slug, prog.name);

    // Prefer FR notices (most reliable scraping target)
    if (prog.frNotices.length > 0) {
      for (const notice of prog.frNotices.slice(0, 4)) {
        const glList = notice.glNumbers.length > 0
          ? `GL ${notice.glNumbers.join(", GL ")}`
          : "General Licenses";
        const headline = `${prog.name}: OFAC Publishes ${glList} (${notice.citation})`;
        const sourceUrl = prog.url;
        if (existingUrls.has(sourceUrl + notice.citation)) continue;
        articles.push({
          id: id++,
          section: "sanctions" as const,
          category: `OFAC ${prog.name.replace(/Sanctions?$/, "").trim()}`,
          region,
          impact: "high" as const,
          date: notice.year || "",
          headline: headline.slice(0, 200),
          body: [
            `OFAC published ${notice.description} under the ${prog.name} program.`,
            `Federal Register citation: ${notice.citation}. Full text available at federalregister.gov.`,
          ],
          source: `OFAC — ${prog.name}`,
          sourceUrl,
        });
      }
    } else if (prog.generalLicenses.length > 0) {
      // Fallback: GL PDFs
      for (const gl of prog.generalLicenses.slice(0, 3)) {
        if (existingUrls.has(gl.url)) continue;
        articles.push({
          id: id++,
          section: "sanctions" as const,
          category: `OFAC ${prog.name.replace(/Sanctions?$/, "").trim()}`,
          region,
          impact: "high" as const,
          date: gl.date,
          headline: `${prog.name} — ${gl.title}`,
          body: [
            `OFAC issued ${gl.title} under the ${prog.name} program. This general license authorizes certain transactions that would otherwise be prohibited.`,
            `Full text available at the OFAC website.`,
          ],
          source: `OFAC — ${prog.name}`,
          sourceUrl: gl.url,
        });
      }
    }
  }

  return articles;
}
