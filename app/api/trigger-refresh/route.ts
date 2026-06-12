// Triggers the "Refresh Global Report" GitHub Actions workflow on demand.
//
// Primary path: dispatches workflow_dispatch to GitHub Actions, which calls
// /api/refresh with a 7-minute timeout (much more headroom than CF Workers).
//
// Fallback path: if GITHUB_TOKEN is not configured, calls /api/refresh in-process.
// The refresh now completes in < 28s (22s LLM timeout + source fetch), so it
// safely fits within Cloudflare's 30s wall-clock limit. The caller should use
// the polling mechanism to detect when new content lands in Redis.
import { NextRequest, NextResponse } from "next/server";
import { refreshBriefing } from "@/src/lib/orchestrator";

export const dynamic = "force-dynamic";

const REPO     = process.env.REFRESH_REPO     || "hnuen/global-report-cf";
const WORKFLOW = process.env.REFRESH_WORKFLOW || "refresh.yml";
const REF      = process.env.REFRESH_REF      || "main";

async function tryGitHubDispatch(): Promise<NextResponse | null> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return null; // signal: fall back to in-process

  const url = `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`;
  const ghRes = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "global-report-cf-app",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({ ref: REF, inputs: { job: "refresh" } }),
  });

  if (ghRes.status === 204) {
    return NextResponse.json({ ok: true, queued: true, message: "Refresh queued — new articles should appear within a couple of minutes." });
  }

  const text = await ghRes.text().catch(() => "");
  console.log(`[trigger-refresh] GitHub dispatch failed (${ghRes.status}) — falling back to in-process: ${text.slice(0, 200)}`);
  return null; // fall back to in-process refresh
}

async function dispatch() {
  // Try GitHub Actions first (preferred — longer timeout)
  const ghResponse = await tryGitHubDispatch();
  if (ghResponse) return ghResponse;

  // Fallback: run in-process (< 28s with 22s LLM timeout — fits CF wall-clock)
  console.log("[trigger-refresh] Running in-process refresh (GITHUB_TOKEN not set or GitHub API failed)");
  const { usedProvider, savedTo } = await refreshBriefing(undefined, { skipLLM: true });
  return NextResponse.json({
    ok: true,
    queued: false,
    message: `Refresh complete (${usedProvider}). New articles available now.`,
    usedProvider,
    savedTo,
  });
}

export async function POST(_request: NextRequest) {
  try {
    return await dispatch();
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
