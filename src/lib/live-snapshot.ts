import type { Briefing } from "./types";

const DEFAULT_SNAPSHOT_URL =
  "https://raw.githubusercontent.com/hnuen/global-report-cf/main/data/live-briefing.json";

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
    return value as Briefing;
  } catch (error) {
    console.warn("[live-snapshot] Fallback load failed:", String(error).slice(0, 120));
    return null;
  }
}
