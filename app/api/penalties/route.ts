import { NextRequest, NextResponse } from "next/server";
import { PENALTIES } from "@/src/lib/penalties-data";
import type { PenaltyRecord } from "@/src/lib/penalties-data";
import { loadExtraPenalties } from "@/src/lib/penalties-fetcher";
import { fetchOfacCache, civilPenaltiesToPenaltyRecords } from "@/src/lib/ofac-github-cache";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const yearParam = url.searchParams.get("year");

  // Merge static database with any auto-synced entries stored in Redis
  const extra = await loadExtraPenalties();

  // Also merge in rows from the main OFAC civil-penalties listing page, scraped
  // on every GitHub Actions run and committed to data/ofac-cache.json. That page
  // is far more current than the narrow "additional select settlement agreements"
  // archive page the Redis sync above covers — it's how new penalties (e.g. ones
  // announced this week) show up here without waiting on the archive page to be
  // updated by OFAC, which can lag by days or never happen for some entries.
  const cache = await fetchOfacCache().catch(() => null);
  const knownUrls = new Set([...PENALTIES, ...extra].map(p => p.sourceUrl));
  const fromCache = cache
    ? civilPenaltiesToPenaltyRecords(cache.civilPenalties).filter(p => !knownUrls.has(p.sourceUrl))
    : [];

  const all: PenaltyRecord[] = [...PENALTIES, ...extra, ...fromCache];

  const records = yearParam
    ? all.filter(p => p.year === Number(yearParam)).sort((a, b) => b.date.localeCompare(a.date))
    : [...all].sort((a, b) => b.date.localeCompare(a.date));

  const years = [...new Set(all.map(p => p.year))].sort((a, b) => b - a);

  return NextResponse.json({ records, years, total: records.length });
}
