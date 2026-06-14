// Receives a pre-built briefing JSON (from GitHub Actions / Gemini) and saves to Redis.
// CF Workers can't run Gemini (30s wall-clock limit < Gemini's 30-90s response time),
// so the heavy LLM work runs in GitHub Actions and POSTs the result here.
import { NextRequest, NextResponse } from "next/server";
import { buildStorageManager } from "@/src/lib/storage-manager";
import type { Briefing } from "@/src/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  // Verify shared secret so random callers can't overwrite the briefing
  const secret = request.headers.get("x-save-secret");
  const expected = process.env.SAVE_BRIEFING_SECRET;
  if (expected && secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const briefing = await request.json() as Briefing;
    if (!briefing?.articles?.length) {
      return NextResponse.json({ error: "Invalid briefing — no articles" }, { status: 400 });
    }

    const storage = await buildStorageManager();
    await storage.save(briefing);
    const health = storage.getHealth();
    console.log(`[save-briefing] Saved ${briefing.articles.length} articles, lastUpdated: ${briefing.lastUpdated}`);
    return NextResponse.json({ ok: true, articleCount: briefing.articles.length, lastUpdated: briefing.lastUpdated, health });
  } catch (e) {
    console.error("[save-briefing]", String(e));
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
