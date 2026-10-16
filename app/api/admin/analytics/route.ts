/**
 * /api/admin/analytics — visitor analytics report for the admin dashboard.
 *
 * Gated by ADMIN_SECRET (x-admin-secret header), same fail-closed pattern as
 * /api/admin/subscribers: an unset ADMIN_SECRET authorizes nobody. The report
 * is aggregate only (counts + country/city tallies); it contains no PII.
 */
import { NextRequest, NextResponse } from "next/server";
import { getReport } from "@/src/lib/analytics";

export const dynamic = "force-dynamic";

function isAuthorised(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  return req.headers.get("x-admin-secret") === secret;
}

export async function GET(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const days = Math.min(90, Math.max(1, Number(url.searchParams.get("days")) || 30));
  const report = await getReport(days);
  return NextResponse.json(report, { headers: { "Cache-Control": "no-store" } });
}
