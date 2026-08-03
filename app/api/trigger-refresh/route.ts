// Triggers an immediate in-process refresh.
// Passes the current section so only relevant sources are fetched (~3-8 vs 47).
// Sanctions section enables LLM (Gemini Google Search grounding finds OFAC date URLs).
// All other sections use skipLLM=true (~12s, stays within CF 30s limit).
//
// Scheduled enriched refreshes (all sections, full LLM) are handled by the
// GitHub Actions cron which calls /api/refresh with a 7-minute timeout.
import { NextRequest, NextResponse } from "next/server";
import { refreshBriefing } from "@/src/lib/orchestrator";
import { maybeSyncPenalties } from "@/src/lib/penalties-fetcher";
import { PENALTIES } from "@/src/lib/penalties-data";
import { maybeSyncFinCEN } from "@/src/lib/fincen-fetcher";
import { FINCEN_PENALTIES } from "@/src/lib/fincen-penalties";
import { checkRateLimit, getClientIp } from "@/src/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  // Public (the in-app Refresh Now button), so rate-limit per IP — each call
  // burns RSS subrequests and, for the sanctions section, Gemini quota.
  const ip = getClientIp(request);
  const allowed = await checkRateLimit(`trigger_refresh_rl:${ip}`, 6, 60 * 60, { failClosed: true });
  if (!allowed) {
    return NextResponse.json(
      { ok: false, error: "Too many refreshes from this network — please try again later." },
      { status: 429 }
    );
  }
  try {
    const body = await request.json().catch(() => ({}));
    const section: string | undefined = body.section && body.section !== "all" ? body.section : undefined;

    // Sanctions always uses LLM — needs Gemini to search OFAC date URLs via Google grounding
    const skipLLM = section !== "sanctions";

    // group:1 only applies to sanctions/all — those have OFAC/Treasury as group-1 sources.
    // Other sections (bis, occ, penalties, etc.) have NO group-1 sources, so passing group:1
    // would return 0 sources and throw. Let them fetch all sources for their section instead.
    const group: 1 | undefined = (!section || section === "sanctions") ? 1 : undefined;

    const { usedProvider, savedTo } = await refreshBriefing(body.topic, { skipLLM, section, manualRefresh: true, group });

    // Clicking "Refresh Now" on the Penalties tab (or a global refresh) should also sync the
    // dedicated OFAC/FinCEN penalty tables — these previously only synced via /api/cron, which
    // nothing in production calls. Self-throttled to once per 24h, so cheap to call here.
    let penaltySync, fincenSync;
    if (!section || section === "penalties") {
      penaltySync = await maybeSyncPenalties(PENALTIES).catch(e => {
        console.log("[trigger-refresh] Penalty sync failed (non-fatal):", String(e).slice(0, 80));
        return { ran: false, added: 0 };
      });
      fincenSync = await maybeSyncFinCEN(FINCEN_PENALTIES).catch(e => {
        console.log("[trigger-refresh] FinCEN sync failed (non-fatal):", String(e).slice(0, 80));
        return { ran: false, added: 0 };
      });
    }

    return NextResponse.json({
      ok: true,
      queued: false,
      message: `Refresh complete${section ? ` (${section})` : ""} — new articles available now.`,
      usedProvider,
      savedTo,
      penaltySync,
      fincenSync,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
