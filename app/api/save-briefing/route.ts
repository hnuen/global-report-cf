// Receives a pre-built briefing JSON (from GitHub Actions / Gemini) and saves to Redis.
// CF Workers can't run Gemini (30s wall-clock limit < Gemini's 30-90s response time),
// so the heavy LLM work runs in GitHub Actions and POSTs the result here.
import { NextRequest, NextResponse } from "next/server";
import { buildStorageManager } from "@/src/lib/storage-manager";
import { saveArticlesToLibrary } from "@/src/lib/article-library";
import type { Briefing } from "@/src/lib/types";
import { hasAnySecret } from "@/src/lib/request-auth";
import { validateBriefingPayload } from "@/src/lib/request-validation";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  // Verify shared secret so random callers can't overwrite the briefing.
  // FAIL CLOSED: an unset SAVE_BRIEFING_SECRET must never mean "everyone is
  // authorized" — this endpoint replaces the site's entire published content.
  const configuredSecrets = [process.env.SAVE_BRIEFING_SECRET, process.env.CRON_SECRET].filter(Boolean);
  if (configuredSecrets.length === 0) {
    return NextResponse.json({ error: "No save credential configured — refusing all writes" }, { status: 503 });
  }
  if (!hasAnySecret(request, configuredSecrets, "x-save-secret")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (Number.isFinite(contentLength) && contentLength > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "Briefing payload too large" }, { status: 413 });
    }
    const body = validateBriefingPayload(await request.json().catch(() => null));
    if (!body) return NextResponse.json({ error: "Invalid briefing payload" }, { status: 400 });
    const { merge, ...briefing } = body;
    if (!briefing?.articles?.length) {
      return NextResponse.json({ error: "Invalid briefing — no articles" }, { status: 400 });
    }

    const storage = await buildStorageManager();

    // merge=true: used by the structured/fallback path, which runs on nearly every
    // GitHub Actions invocation (Gemini is skipped whenever OFAC has no new data,
    // to preserve daily quota). That path only ever carries this run's freshly
    // scraped items per section (e.g. up to 6 OCC entries, 8 Regions entries).
    //
    // Previously this did a full per-section REPLACE: any section present in the
    // new payload had its old articles discarded entirely and swapped for just
    // this run's scrape. That's fine for high-frequency feeds, but it actively
    // destroyed content for low-frequency ones — e.g. OCC publishes enforcement
    // batches roughly monthly, so a run that only found 1 fresh OCC item would
    // wipe out everything else previously accumulated in that section, visibly
    // shrinking it to a single story. Fixed 2026-06-19: merge at the ARTICLE
    // level instead — keep existing articles for a touched section too, just
    // dedup by sourceUrl (new wins on collision) and cap so history doesn't
    // grow unbounded across hundreds of daily runs.
    const SECTION_CAP = 20;
    let toSave = briefing as Briefing;
    if (merge) {
      const { loadBriefing } = await import("@/src/lib/orchestrator");
      const existing = await loadBriefing();
      if (existing?.articles?.length) {
        const newSections = new Set(briefing.articles.map((a: any) => a.section));
        const newUrls = new Set(briefing.articles.map((a: any) => a.sourceUrl).filter(Boolean));

        // Sections this payload doesn't touch at all — carry over unchanged.
        const untouchedArticles = existing.articles.filter((a: any) => !newSections.has(a.section));

        // Sections this payload DOES touch — merge instead of replace: this
        // run's articles first (newest), then existing articles for that same
        // section that aren't duplicates (by sourceUrl), capped per section.
        const mergedTouched: any[] = [];
        for (const section of newSections) {
          const incoming = briefing.articles.filter((a: any) => a.section === section);
          const carriedOver = existing.articles.filter(
            (a: any) => a.section === section && !newUrls.has(a.sourceUrl)
          );
          mergedTouched.push(...[...incoming, ...carriedOver].slice(0, SECTION_CAP));
        }

        const mergedArticles = [...mergedTouched, ...untouchedArticles]
          // Reassign sequential ids — incoming and carried-over articles were
          // numbered independently (each run's id++ starts at 1), so without
          // this, merged articles from different runs would collide on id,
          // breaking anything keyed off it (e.g. React list keys).
          .map((a: any, i: number) => ({ ...a, id: i + 1 }));

        toSave = {
          ...existing,
          ...briefing,
          articles: mergedArticles,
          lastUpdated: briefing.lastUpdated,
        };
        console.log(`[save-briefing] Merge: ${mergedTouched.length} merged (touched sections, capped ${SECTION_CAP}/section) + ${untouchedArticles.length} kept (untouched sections)`);
      }
    }

    await storage.save(toSave, { requirePersistent: true });
    // Accumulate into the 6-month article library (fire-and-forget — non-fatal)
    await saveArticlesToLibrary(toSave.articles);
    const health = storage.getHealth();
    console.log(`[save-briefing] Saved ${toSave.articles.length} articles, lastUpdated: ${toSave.lastUpdated}`);
    return NextResponse.json({ ok: true, articleCount: toSave.articles.length, lastUpdated: toSave.lastUpdated, health });
  } catch (e) {
    console.error("[save-briefing]", String(e));
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
