import { NextRequest, NextResponse } from "next/server";
import { FINCEN_PENALTIES, type FinCENPenalty } from "@/src/lib/fincen-penalties";
import { loadExtraFinCEN } from "@/src/lib/fincen-fetcher";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const yearParam = url.searchParams.get("year");

  // Merge static database with any auto-synced entries stored in Redis
  // Keep the built-in enforcement database available even when Redis is
  // unavailable or contains a malformed legacy value.
  const extra = await loadExtraFinCEN().catch(() => []);
  const all: FinCENPenalty[] = [...FINCEN_PENALTIES, ...extra];

  const records = yearParam
    ? all.filter(p => p.year === Number(yearParam)).sort((a, b) => b.date.localeCompare(a.date))
    : [...all].sort((a, b) => b.date.localeCompare(a.date));

  const years = [...new Set(all.map(p => p.year))].sort((a, b) => b - a);
  const totals = years.reduce((acc, y) => ({
    ...acc,
    [y]: all.filter(p => p.year === y).reduce((sum, p) => sum + p.penalty, 0),
  }), {} as Record<number, number>);

  return NextResponse.json({ records, years, totals, total: records.length });
}
