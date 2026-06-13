export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { refreshBriefing } from "@/src/lib/orchestrator";
import { maybeSyncPenalties } from "@/src/lib/penalties-fetcher";
import { PENALTIES } from "@/src/lib/penalties-data";
import { maybeSyncFinCEN } from "@/src/lib/fincen-fetcher";
import { FINCEN_PENALTIES } from "@/src/lib/fincen-penalties";

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
    let { briefing, usedProvider, savedTo } = await refreshBriefing();
    console.log(`[cron] Done — ${briefing.articles.length} articles via ${usedProvider}, saved to: ${savedTo.join(", ")}`);

    // Auto-retry if article count is suspiciously low (< 50 = likely a fetch failure)
    const MIN_ARTICLES = 50;
    if (briefing.articles.length < MIN_ARTICLES) {
      console.log(`[cron] Only ${briefing.articles.length} articles — below threshold of ${MIN_ARTICLES}. Retrying in 8 s...`);
      await new Promise(r => setTimeout(r, 8_000));
      const retry = await refreshBriefing();
      briefing    = retry.briefing;
      usedProvider = retry.usedProvider;
      savedTo     = retry.savedTo;
      console.log(`[cron] Retry done — ${briefing.articles.length} articles via ${retry.usedProvider}, saved to: ${retry.savedTo.join(", ")}`);
    }

    // Sync new OFAC penalties (at most once per 24 h — skips if recently run)
    const penaltySync = await maybeSyncPenalties(PENALTIES).catch(e => {
      console.log("[cron] Penalty sync failed (non-fatal):", String(e).slice(0, 80));
      return { ran: false, added: 0 };
    });
    if (penaltySync.ran) {
      console.log(`[cron] Penalty sync — ${penaltySync.added} new records added`);
    }

    // Sync new FinCEN penalties (at most once per 24 h — skips if recently run)
    const fincenSync = await maybeSyncFinCEN(FINCEN_PENALTIES).catch(e => {
      console.log("[cron] FinCEN sync failed (non-fatal):", String(e).slice(0, 80));
      return { ran: false, added: 0 };
    });
    if (fincenSync.ran) {
      console.log(`[cron] FinCEN sync — ${fincenSync.added} new records added`);
    }

    return NextResponse.json({
      ok: true,
      articles: briefing.articles.length,
      usedProvider,
      savedTo,
      penaltySync,
      fincenSync,
    });
  } catch (e) {
    console.error("[cron]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
