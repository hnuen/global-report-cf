import { NextRequest, NextResponse } from "next/server";
import { FINCEN_PENALTIES, getFinCENByYear, getFinCENYears, finCENTotalByYear } from "@/src/lib/fincen-penalties";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const year = url.searchParams.get("year");
  const records = getFinCENByYear(year ? Number(year) : undefined);
  const years = getFinCENYears();
  const totals = years.reduce((acc, y) => ({ ...acc, [y]: finCENTotalByYear(y) }), {} as Record<number,number>);
  return NextResponse.json({ records, years, totals, total: records.length });
}
