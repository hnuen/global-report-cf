import { NextRequest, NextResponse } from "next/server";
import { PENALTIES } from "@/src/lib/penalties-data";
import type { PenaltyRecord } from "@/src/lib/penalties-data";
import { loadExtraPenalties } from "@/src/lib/penalties-fetcher";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const yearParam = url.searchParams.get("year");

  // Merge static database with any auto-synced entries stored in Redis
  const extra = await loadExtraPenalties();
  const all: PenaltyRecord[] = [...PENALTIES, ...extra];

  const records = yearParam
    ? all.filter(p => p.year === Number(yearParam)).sort((a, b) => b.date.localeCompare(a.date))
    : [...all].sort((a, b) => b.date.localeCompare(a.date));

  const years = [...new Set(all.map(p => p.year))].sort((a, b) => b - a);

  return NextResponse.json({ records, years, total: records.length });
}
