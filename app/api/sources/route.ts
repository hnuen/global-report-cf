/**
 * /api/sources — Live source inspector
 *
 * Fetches every configured official source (exactly as a refresh does)
 * and returns a per-source summary without saving anything to Redis.
 * Use this to debug which sources are reachable, what they return,
 * and whether the OFAC / Treasury SB probing is working.
 *
 * Query params:
 *   ?filter=ofac       — only show sources whose name contains "ofac" (case-insensitive)
 *   ?filter=treasury   — only Treasury SB sources
 *   ?content=1         — include first 500 chars of raw content per source
 *   ?headlines=1       — include extracted headlines per source (default: on)
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchOfficialSources } from "@/src/lib/official-sources";
import { buildAllFromSource } from "@/src/lib/official-briefing";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const filter       = (searchParams.get("filter") ?? "").toLowerCase();
  const showContent  = searchParams.get("content") === "1";
  const showHeadlines = searchParams.get("headlines") !== "0"; // default on

  try {
    const sources = await fetchOfficialSources();

    const results = sources
      .filter(s => !filter || s.name.toLowerCase().includes(filter))
      .map(s => {
        const hasContent = s.content.length > 50;
        let articles: Array<{ headline: string; date: string; url: string }> = [];

        if (hasContent && showHeadlines) {
          try {
            const built = buildAllFromSource(s);
            articles = built.slice(0, 5).map(a => ({
              headline: a.headline,
              date: a.date,
              url: a.sourceUrl,
            }));
          } catch {
            articles = [];
          }
        }

        return {
          name: s.name,
          url: s.url,
          ok: hasContent,
          contentLength: s.content.length,
          error: s.error ?? null,
          articles,
          ...(showContent ? { rawContent: s.content.slice(0, 500) } : {}),
        };
      });

    const ok     = results.filter(r => r.ok).length;
    const failed = results.filter(r => !r.ok).length;

    return NextResponse.json({
      summary: { total: results.length, ok, failed, filter: filter || "all" },
      sources: results,
    });

  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
