import { NextRequest, NextResponse } from "next/server";
import { PENALTIES } from "@/src/lib/penalties-data";
import type { PenaltyRecord } from "@/src/lib/penalties-data";
import { loadExtraPenalties } from "@/src/lib/penalties-fetcher";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const yearParam = url.searchParams.get("year");

  // Merge static database with any auto-synced entries stored in Redis
  const extra