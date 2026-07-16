// No auth required — public app, refresh just fetches news
import { NextRequest, NextResponse } from "next/server";
import { refreshBriefing } from "@/src/lib/orchestrator";
import { maybeSyncPenalties } from "@/src/lib/penalties-fetcher";
import { PENALTIES } from "@/src/lib/penalties-data";
import { maybeSyncFinCEN } from "@/src/lib/fincen-fetcher";
import { FINCEN_PENALTIES } from "@/src/lib/fincen-penalties";

export const dynamic = "force-dynamic";

// This route is the one actually hit by the GitHub Actions cron (.github/workflows/refresh.yml,
// ~15x/day) and by the in-app "Refresh Now" button (via /api/trigger-refresh). The dedicated
// /api/cron route also wires up these syncs but nothing in production ever calls it, so the
// OFAC/FinCEN penalty tables were never actually refreshing. Both sync calls self-throttle to
// once per 24h via Redis, so it's safe to call on every invocation.
async function syncPenaltyTables() {
  const penaltySync = await maybeSyncPenalties(PENALTIES).catch(e => {
    console.log("[refresh] Penalty sync failed (non-fatal):", String(e).slice(0, 80));
    return { ran: false, added: 0 };
  });
  if (penaltySync.ran) {
    console.log(`[refresh] Penalty sync — ${penaltySync.added} new records added`);
  }

  const fincenSync = await maybeSyncFinCEN(FINCEN_PENALTIES).catch(e => {
    console.log("[refresh] FinCEN sync failed (non-fatal):", String(e).slice(0, 80));
    return { ran: false, added: 0 };
  });
  if (fincenSync.ran) {
    console.log(`[refresh] FinCEN sync — ${fincenSync.added} new records added`);
  }

  return { penaltySync, fincenSync };
}

export async function POST(request: NextRequest) {
  try {
    // Accept optional group (1-4) to fetch only that group of sources.
    // Each group has 11-26 RSS sources — well under CF's 50-subrequest limit.
    // Group-mode is always skipLLM=true (LLM step runs in GitHub Actions instead).
    const body = await request.json().catch(() => ({})) as { group?: 1|2|3|4 };
    const group = ([1,2,3,4] as const).find(g => g === body.group);
    const { briefing, usedProvider, savedTo, storageErrors } = await refreshBriefing(undefined, {
      skipLLM: group !== undefined ? true : undefined,
      group,
    });
    const { penaltySync, fincenSync } = await syncPenaltyTables();
    return NextResponse.json({ ok: true, usedProvider, savedTo, storageErrors, articleCount: briefing.articles.length, penaltySync, fincenSync });
  } catch (e) {
    console.error("[refresh]", String(e));
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const groupParam = Number(url.searchParams.get("group"));
    const group = ([1,2,3,4] as const).find(g => g === groupParam);
    const { briefing, usedProvider, savedTo, storageErrors } = await refreshBriefing(undefined, {
      skipLLM: group !== undefined ? true : undefined,
      group,
    });
    const { penaltySync, fincenSync } = await syncPenaltyTables();
    return NextResponse.json({ ok: true, usedProvider, savedTo, storageErrors, articleCount: briefing.articles.length, penaltySync, fincenSync });
  } catch (e) {
    console.error("[refresh GET]", String(e));
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
