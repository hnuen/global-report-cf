/**
 * ofac-github-cache.ts
 *
 * Reads the OFAC data cache committed by GitHub Actions to data/ofac-cache.json.
 * CF Workers can't reach ofac.treasury.gov directly (IP blocked), but
 * raw.githubusercontent.com is accessible.
 *
 * GitHub Actions scrapes and commits fresh data on every scheduled run.
 */

import type { Article } from "./types";

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

interface OfacCache {
  updatedAt: string;
  recentActions: OfacRecentAction[];
  civilPenalties: OfacCivilPenalty[];
}

const CACHE_URL = process.env.OFAC_CACHE_URL ||
  "https://raw.githubusercontent.com/hnuen/global-report-cf/main/data/ofac-cache.json";

let _cached: { data: OfacCache; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000; // re-fetch at most once per 10 min

export async function fetchOfacCache(): Promise<OfacCache | null> {
  // In-memory cache — avoids hammering GitHub on every article build
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
    console.log(`[ofac-cache] Loaded: ${data.recentActions.length} recent-actions, ${data.civilPenalties.length} penalties (updated ${data.updatedAt})`);
    return data;
  } catch (e) {
    console.warn(`[ofac-cache] fetch error: ${String(e).slice(0, 100)}`);
    return null;
  }
}

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
    // Parse MM/DD/YYYY → "Month DD, YYYY"
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
