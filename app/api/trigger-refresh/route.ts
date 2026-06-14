// Triggers an immediate in-process refresh.
// Passes the current section so only relevant sources are fetched (~3-8 vs 47).
// Sanctions section enables LLM (Gemini Google Search grounding finds OFAC date URLs).
// All other sections use skipLLM=true (~12s, stays within CF 30s limit).
//
// Scheduled enriched refreshes (all sections, full LLM) are handled by the
// GitHub Actions cron which calls /api/refresh with a 7-minute timeout.
import { NextRequest, NextResponse } from "next/server";
import { refreshBriefing } from "@/src/lib/orchestrator";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const section: string | undefined = body.section && body.section !== "all" ? body.section : undefined;

    // Sanctions always uses LLM — needs Gemini to search OFAC date URLs via Google grounding
    const skipLLM = section !== "sanctions";

    // Batch 1 (immediate): only group-1 sources — OFAC date news + Treasury SBs (~11 sources).
    // Batches 2-4 (groups 2/3/4) fire every 3 minutes via /api/background-refresh,
    // merging additional articles into Redis without overwriting batch-1 data.
    const { usedProvider, savedTo } = await refreshBriefing(body.topic, { skipLLM, section, manualRefresh: true, group: 1 });
    return NextResponse.json({
      ok: true,
      queued: false,
      message: `Refresh complete${section ? ` (${section})` : ""} — new articles available now.`,
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
