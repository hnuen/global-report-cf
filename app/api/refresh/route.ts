// Requires CRON_SECRET (Authorization: Bearer <secret> or x-cron-secret header).
// Callers: GitHub Actions refresh.yml (sends x-cron-secret). Although refresh
// "just fetches news", each call burns RSS subrequests, Redis writes, and
// potentially LLM quota â€” anonymous access made it a free DoS/cost-abuse lever.
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
    console.log(`[refresh] Penalty sync â€” ${penaltySync.added} new records added`);
  }

  const fincenSync = await maybeSyncFinCEN(FINCEN_PENALTIES).catch(e => {
    console.log("[refresh] FinCEN sync failed (non-fatal):", String(e).slice(0, 80));
    return { ran: false, added: 0 };
  });
  if (fincenSync.ran) {
    console.log(`[refresh] FinCEN sync â€” ${fincenSync.added} new records added`);
  }

  return { penaltySync, fincenSync };
}

function isAuthorised(req: NextRequest): boolean {
  // FAIL CLOSED: unset CRON_SECRET means nobody is authorized.
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return (
    req.headers.get("authorization") === `Bearer ${secret}` ||
    req.headers.get("x-cron-secret") === secret
  );
}

export async function POST(request: NextRequest) {
  if (!isAuthorised(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    // Accept optional group (1-4) to fetch only that group of sources.
    // Each group has 11-26 RSS sources â€” well under CF's 50-subrequest limit.
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

