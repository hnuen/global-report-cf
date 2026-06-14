// v4 - sort articles newest first before sending
import { NextResponse } from "next/server";
import { loadBriefing }  from "@/src/lib/orchestrator";
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
    // Sort articles newest first
    if (data.articles) {
      data.articles = [...data.articles].sort((a, b) => (b.date||"").localeCompare(a.date||""));
    }
    return NextResponse.json(data, { headers: NO_CACHE });
  } catch (e) {
    return NextResponse.json(SEED_DATA, { headers: NO_CACHE });
  }
}
