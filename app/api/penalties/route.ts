import { NextRequest, NextResponse } from "next/server";
import { PENALTIES, getPenaltiesByYear, getAvailableYears } from "@/src/lib/penalties-data";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const year = url.searchParams.get("year");
  const records = getPenaltiesByYear(year ? Number(year) : undefined);
  const years = getAvailableYears();
  return NextResponse.json({ records, years, total: records.length });
}
