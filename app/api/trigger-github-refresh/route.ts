/**
 * /api/trigger-github-refresh
 * Fires a workflow_dispatch on the GitHub Actions "Refresh Global Report" workflow.
 * Called by the app when the user clicks Refresh — the workflow runs in the background
 * (~2-3 min) and saves a full Gemini+OFAC briefing to Redis when done.
 *
 * Required env vars (Cloudflare Pages):
 *   GITHUB_PAT        — Personal Access Token with "workflow" scope
 *   GITHUB_REPO       — e.g. "hnuen/global-report-cf"
 */

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const GITHUB_PAT  = process.env.GITHUB_PAT  || "";
const GITHUB_REPO = process.env.GITHUB_REPO || "hnuen/global-report-cf";
const WORKFLOW    = "refresh.yml";

export async function POST() {
  if (!GITHUB_PAT) {
    return NextResponse.json({ ok: false, error: "GITHUB_PAT not configured" }, { status: 503 });
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/${WORKFLOW}/dispatches`,
      {
        method: "POST",
        headers: {
          "Authorization": `token ${GITHUB_PAT}`,
          "Accept": "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ref: "main" }),
        signal: AbortSignal.timeout(10_000),
      }
    );

    // GitHub returns 204 No Content on success
    if (res.status === 204) {
      console.log("[trigger-github-refresh] ✅ Workflow dispatched");
      return NextResponse.json({ ok: true, message: "GitHub refresh triggered — enriched briefing in ~2-3 min" });
    }

    const err = await res.text().catch(() => "");
    console.error(`[trigger-github-refresh] GitHub API error ${res.status}: ${err.slice(0, 200)}`);
    return NextResponse.json({ ok: false, error: `GitHub API ${res.status}` }, { status: 502 });
  } catch (e) {
    console.error("[trigger-github-refresh]", String(e));
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
