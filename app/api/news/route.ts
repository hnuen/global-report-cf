// v5 - merge 6-month article library into response so history survives full refreshes
import { NextResponse } from "next/server";
import { loadBriefing }  from "@/src/lib/orchestrator";
import { loadArticleLibrary } from "@/src/lib/article-library";
import { SEED_DATA }     from "@/src/lib/seed";

export const revalidate = 0;
export const dynamic = "force-dynamic";

function parseDate(d: string): number {
  if (!d) return 0;
  try {
    const M: Record<string,number> = {january:0,february:1,march:2,april:3,may:4,june:5,
      july:6,august:7,september:8,october:9,november:10,december:11};
    const mdy = d.match(/^(\w+)\s+(\d{1,2}),?\s+(\d{4})$/i);
    if (mdy && M[mdy[1].toLowerCase()] !== undefined)
      return new Date(+mdy[3], M[mdy[1].toLowerCase()], +mdy[2]).getTime();
    const my = d.match(/^(\w+)\s+(\d{4})$/i);
    if (my && M[my[1].toLowerCase()] !== undefined)
      return new Date(+my[2], M[my[1].toLowerCase()], 1).getTime();
    const t = new Date(d).getTime();
    return isNaN(t) ? 0 : t;
  } catch { return 0; }
}

const NO_CACHE = { "Cache-Control": "no-store, no-cache, must-revalidate", "Pragma": "no-cache" };

export async function GET() {
  try {
    const briefing = await loadBriefing();
    const data = briefing ?? SEED_DATA;
    // Merge 6-month article library so historical articles survive full
    // briefing replacements (merge=false Gemini runs wipe current articles).
    try {
      const library = await loadArticleLibrary();
      if (library.length > 0 && data.articles?.length) {
        const seen = new Set<string>();
        for (const a of data.articles) {
          if (a.sourceUrl) seen.add(a.sourceUrl);
          if (a.headline)  seen.add(a.headline.slice(0, 80).toLowerCase());
        }
        const extra = library.filter((a: any) =>
          !(a.sourceUrl && seen.has(a.sourceUrl)) &&
          !(a.headline  && seen.has((a.headline as string).slice(0, 80).toLowerCase()))
        );
        if (extra.length > 0) data.articles = [...data.articles, ...extra];
      }
    } catch { /* non-fatal — fall back to briefing-only */ }

    // Sort newest first, reassign sequential IDs
    if (data.articles) {
      data.articles = [...data.articles]
        .sort((a, b) => parseDate(b.date) - parseDate(a.date))
        .map((a, i) => ({ ...a, id: i + 1 }));
    }
    return NextResponse.json(data, { headers: NO_CACHE });
  } catch (e) {
    return NextResponse.json(SEED_DATA, { headers: NO_CACHE });
  }
}
