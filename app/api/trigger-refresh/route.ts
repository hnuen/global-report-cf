// Triggers an immediate in-process refresh — skips LLM so it always
// completes within Cloudflare's 30s wall-clock limit (~12s total).
//
// Scheduled enriched refreshes (with LLM) are handled separately by the
// GitHub Actions cron which calls /api/refresh with a 7-minute timeout.
import { NextRequest, NextResponse } from "next/server";
import { refreshBriefing } from "@/src/lib/orchestrator";

export const dynamic = "force-dynamic";

export async function POST(_request: NextRequest) {
  try {
    // skipLLM=true: source fetch (10s) + structured build + Redis save = ~12s
    // This always completes within CF's 30s limit and reliably updates the date.
    const { usedProvider, savedTo } = await refreshBriefing(undefined, { skipLLM: true });
    return NextResponse.json({
      ok: true,
      queued: false,
      message: "Refresh complete — new articles available now.",
      usedProvider,
      savedTo,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
