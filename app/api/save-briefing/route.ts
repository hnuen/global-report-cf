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
    const body = await request.json() as Briefing & { merge?: boolean };
    const { merge, ...briefing } = body as any;
    if (!briefing?.articles?.length) {
      return NextResponse.json({ error: "Invalid briefing — no articles" }, { status: 400 });
    }

    const storage = await buildStorageManager();

    // merge=true: only replace sections present in the new briefing, keep others from Redis.
    // Used by the structured fallback (which only covers sanctions + penalties) so it doesn't
    // wipe economics/religion/occ/bis articles from a previous successful Gemini run.
    let toSave = briefing as Briefing;
    if (merge) {
      const { loadBriefing } = await import("@/src/lib/orchestrator");
      const existing = await loadBriefing();
      if (existing?.articles?.length) {
        const newSections = new Set(briefing.articles.map((a: any) => a.section));
        const keptArticles = existing.articles.filter((a: any) => !newSections.has(a.section));
        toSave = {
          ...existing,
          ...briefing,
          articles: [...briefing.articles, ...keptArticles],
          lastUpdated: briefing.lastUpdated,
        };
        console.log(`[save-briefing] Merge: ${briefing.articles.length} new + ${keptArticles.length} kept from existing`);
      }
    }

    await storage.save(toSave);
    const health = storage.getHealth();
    console.log(`[save-briefing] Saved ${toSave.articles.length} articles, lastUpdated: ${toSave.lastUpdated}`);
    return NextResponse.json({ ok: true, articleCount: toSave.articles.length, lastUpdated: toSave.lastUpdated, health });
  } catch (e) {
    console.error("[save-briefing]", String(e));
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
