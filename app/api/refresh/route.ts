// No auth required — public app, refresh just fetches news
import { NextRequest, NextResponse } from "next/server";
import { refreshBriefing } from "@/src/lib/orchestrator";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { briefing, usedProvider, savedTo, storageErrors } = await refreshBriefing();
    return NextResponse.json({ ok: true, usedProvider, savedTo, storageErrors, articleCount: briefing.articles.length });
  } catch (e) {
    console.error("[refresh]", String(e));
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { briefing, usedProvider, savedTo, storageErrors } = await refreshBriefing();
    return NextResponse.json({ ok: true, usedProvider, savedTo, storageErrors, articleCount: briefing.articles.length });
  } catch (e) {
    console.error("[refresh GET]", String(e));
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
