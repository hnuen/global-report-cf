export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { refreshBriefing } from "@/src/lib/orchestrator";

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
    return NextResponse.json({ ok: true, articles: briefing.articles.length, usedProvider, savedTo });
  } catch (e) {
    console.error("[cron]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
