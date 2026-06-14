/**
 * /api/background-refresh — Multi-batch background source fetcher
 *
 * Called by the client at t=+3min (group 2), +6min (group 3), and +9min (group 4)
 * after a manual REFRESH NOW. Group 1 (OFAC date news + Treasury SBs) was already
 * fetched by trigger-refresh and saved to Redis.
 *
 * Each call fetches one group of sources and merges new articles into the existing
 * Redis briefing without overwriting prior groups.
 *
 * Subrequest budgets per group (incl. 2 Redis calls):
 *   group 2: ~8  + 2 = 10  ✅
 *   group 3: ~11 + 2 = 13  ✅
 *   group 4: ~26 + 2 = 28  ✅  (all << 50 CF Workers limit)
 */

import { NextRequest, NextResponse } from "next/server";
import { loadBriefing } from "@/src/lib/orchestrator";
import { fetchOfficialSources } from "@/src/lib/official-sources";
import { buildBriefingFromSources } from "@/src/lib/official-briefing";
import { buildStorageManager } from "@/src/lib/storage-manager";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  try {
    const body = await request.json().catch(() => ({}));
    const group: 2|3|4 = body.group ?? 2;
    const section: string | undefined = body.section && body.section !== "all" ? body.section : undefined;

    console.log(`[background-refresh] Group ${group} starting — section: ${section ?? "all"}`);

    // 1. Load the existing briefing from Redis (accumulated from prior groups)
    const existing = await loadBriefing();
    const existingCount = existing?.articles?.length ?? 0;
    console.log(`[background-refresh] Group ${group}: existing briefing has ${existingCount} articles`);

    // 2. Fetch sources for this specific group only
    const groupSources = await fetchOfficialSources(section, { group });
    const successCount = groupSources.filter(s => s.content.length > 50).length;
    console.log(`[background-refresh] Group ${group}: ${successCount}/${groupSources.length} sources returned content`);

    if (successCount === 0) {
      return NextResponse.json({
        ok: true,
        group,
        newArticles: 0,
        existingArticles: existingCount,
        message: `Group ${group}: no content retrieved`,
        elapsed: Date.now() - startTime,
      });
    }

    // 3. Build articles from this group's sources
    const groupBriefing = buildBriefingFromSources(groupSources);
    console.log(`[background-refresh] Group ${group}: built ${groupBriefing.articles.length} candidate articles`);

    if (groupBriefing.articles.length === 0) {
      return NextResponse.json({
        ok: true,
        group,
        newArticles: 0,
        existingArticles: existingCount,
        message: `Group ${group}: no parseable articles`,
        elapsed: Date.now() - startTime,
      });
    }

    // 4. Deduplicate — only keep articles not already in the briefing
    const existingHeadlines = new Set(
      (existing?.articles ?? []).map(a =>
        (a.headline || "").slice(0, 70).toLowerCase().replace(/\s+/g, " ").trim()
      )
    );
    const newArticles = groupBriefing.articles.filter(a => {
      const key = (a.headline || "").slice(0, 70).toLowerCase().replace(/\s+/g, " ").trim();
      return key.length > 10 && !existingHeadlines.has(key);
    });
    console.log(`[background-refresh] Group ${group}: ${newArticles.length} new unique articles`);

    if (newArticles.length === 0) {
      return NextResponse.json({
        ok: true,
        group,
        newArticles: 0,
        existingArticles: existingCount,
        message: `Group ${group}: all articles already present`,
        elapsed: Date.now() - startTime,
      });
    }

    // 5. Merge earlier groups' articles + new group's articles → save
    // Prior groups' articles always come first (higher priority)
    const now = new Date().toLocaleString("en-US", {
      month: "long", day: "numeric", year: "numeric",
      hour: "2-digit", minute: "2-digit", timeZoneName: "short",
      timeZone: "America/New_York",
    });
    const totalCount = existingCount + newArticles.length;
    const merged = {
      ...(existing ?? {}),
      articles: [...(existing?.articles ?? []), ...newArticles],
      lastUpdated: `${now} — Official government sources · ${totalCount} stories`,
      sidebar: existing?.sidebar ?? groupBriefing.sidebar,
    };

    const storage = await buildStorageManager();
    await storage.save(merged as any);

    console.log(`[background-refresh] ✅ Group ${group}: merged ${newArticles.length} articles — total now ${totalCount} (${Date.now() - startTime}ms)`);

    return NextResponse.json({
      ok: true,
      group,
      newArticles: newArticles.length,
      totalArticles: totalCount,
      existingArticles: existingCount,
      elapsed: Date.now() - startTime,
    });
  } catch (e) {
    console.error("[background-refresh] Error:", String(e));
    return NextResponse.json(
      { ok: false, error: String(e), elapsed: Date.now() - startTime },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
