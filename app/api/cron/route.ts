export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { refreshBriefing } from "@/src/lib/orchestrator";
import { maybeSyncPenalties } from "@/src/lib/penalties-fetcher";
import { PENALTIES } from "@/src/lib/penalties-data";

export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  try {
    const { briefing, usedProvider, savedTo } = await refreshBriefing();
    console.log(`[cron] Done — ${briefing.articles.length} articles via ${usedProvider}, saved to: ${savedTo.join(", ")}`);

    // Sync new OFAC penalties (at most once per 24 h — skips if recently run)
    const penaltySync = 