// v3 - fresh env var read each request
import { NextResponse }       from "next/server";
import { getSystemHealth }    from "@/src/lib/orchestrator";
import { getNotifierManager } from "@/src/notifiers/manager";

export const revalidate = 0;
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [health, notifiers] = await Promise.all([
      getSystemHealth(),
      Promise.resolve(getNotifierManager().status()),
    ]);
    return NextResponse.json({ ...health, notifiers, buildCommit: "aceda13", buildTs: "2026-06-07" });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
