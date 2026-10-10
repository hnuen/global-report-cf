import type { Briefing } from "./types";

const DEFAULT_SNAPSHOT_URL =
  "https://raw.githubusercontent.com/hnuen/global-report-cf/main/data/live-briefing.json";

// Confirmed permanent failures found by the scheduled health check. Keep this
// list deliberately exact: a publisher-wide block could hide valid reporting.
const BLOCKED_SOURCE_URLS = new Set([
  "https://news.un.org/en/story/2026/10/1172026",
]);

const CORRECTED_SOURCE_URLS = new Map([
  [
    "https://www.occ.gov/news-issuances/news-releases/2026/nr-occ-2026-123.html",
    "https://www.occ.gov/news-issuances/news-releases/2026/nr-occ-2026-87.html",
  ],
]);

/**
 * Read-only disaster-recovery snapshot maintained by the GitHub refresh job.
 * This is deliberately not a write fallback: alerts must never record delivery
 * or cooldown state unless persistent Redis writes actually succeeded.
 */
export async function loadLiveSnapshot(): Promise<Briefing | null> {
  const url = process.env.LIVE_BRIEFING_SNAPSHOT_URL || DEFAULT_SNAPSHOT_URL;
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "global-report-cloudflare-fallback" },
      cache: "no-store",
    });
    if (!response.ok) return null;
    const value = await response.json() as Partial<Briefing>;
    if (!Array.isArray(value.articles) || value.articles.length === 0) return null;
    if (typeof value.lastUpdated !== "string") return null;
    return {
      ...(value as Briefing),
      articles: value.articles
        .filter(article =>
          !BLOCKED_SOURCE_URLS.has(article.sourceUrl?.replace(/\/$/, "") ?? "")
        )
        .map(article => ({
          ...article,
          sourceUrl: CORRECTED_SOURCE_URLS.get(
            article.sourceUrl?.replace(/\/$/, "") ?? ""
          ) ?? article.sourceUrl,
        })),
    };
  } catch (error) {
    console.warn("[live-snapshot] Fallback load failed:", String(error).slice(0, 120));
    return null;
  }
}
