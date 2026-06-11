import { NextRequest, NextResponse } from "next/server";
import { FINCEN_PENALTIES, type FinCENPenalty } from "@/src/lib/fincen-penalties";
import { loadExtraFinCEN } from "@/src/lib/fincen-fetcher";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const yearParam = url.searchParams.get("year");

  // Merge static database with any auto-synced entries stored in Redis
  const extra = await loadExtraFinCEN();
  const all: FinCENPenalty[] = [...FINCEN_PENALTIES, ...extra];

  const records = yearParam
    ? all.filter(p => p.year === Number(yearParam)).sort