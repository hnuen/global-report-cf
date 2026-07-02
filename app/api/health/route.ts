// v4 - fresh env var read each request
import { NextResponse }       from "next/server";
import { getSystemHealth }    from "@/src/lib/orchestrator";
import { getNotifierManager } from "@/src/notifiers/manager";

export const revalidate = 0;
export const dynamic = "force-dynamic";

// Unlike /api/news, this route never set explicit Cache-Control headers —
// Cloudflare's edge was observed serving a byte-for-byte identical response
// (same millisecond timestamp) across requests minutes apart despite
// revalidate=0/dynamic=force-dynamic, which only control Next's own render
// cache, not Cloudflare's edge cache for the resulting response. Added
// 2026-06-29 after this masked whether newly-added Twilio secrets had
// actually taken effect.
const NO_CACHE = { "Cache-Control": "no-store, no-cache, must-revalidate", "Pragma": "no-cache" };

export async function GET() {
  try {
    const [health, notifiers] = await Promise.all([
      getSystemHealth(),
      Promise.resolve(getNotifierManager().status()),
    ]);
    return NextResponse.json(
      { ...health, notifiers, buildCommit: "aceda13", buildTs: "2026-06-07" },
      { headers: NO_CACHE }
    );
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500, headers: NO_CACHE });
  }
}
