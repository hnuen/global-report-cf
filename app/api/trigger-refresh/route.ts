// Triggers the "Refresh Global Report" GitHub Actions workflow on demand.
//
// Why this exists: calling /api/refresh directly fetches ~50 sources sequentially
// and routinely exceeds Cloudflare's worker wall-clock limits, so the in-app
// "Refresh Now" button would hang/timeout without ever completing. The GitHub
// Actions workflow already runs the same refresh on a schedule from GitHub's
// infrastructure (which has much more headroom), so instead of duplicating that
// work in-process, this route asks GitHub to run the workflow right now via the
// `workflow_dispatch` API. The button becomes "queue a refresh" rather than
// "wait ~30s for a refresh" — the new data shows up within a minute or two.
//
// Requires a GitHub Personal Access Token with `repo` + `workflow` scope, stored
// as the Cloudflare Pages environment variable GITHUB_TOKEN (Settings → Environment
// variables → add GITHUB_TOKEN, mark as a secret). Set REFRESH_REPO/REFRESH_WORKFLOW
// only if the repo or workflow filename ever changes from the defaults below.
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const REPO = process.env.REFRESH_REPO || "hnuen/global-report-cf";
const WORKFLOW = process.env.REFRESH_WORKFLOW || "refresh.yml";
const REF = process.env.REFRESH_REF || "main";

async function dispatch() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return NextResponse.json(
      { ok: false, error: "GITHUB_TOKEN is not configured on the server — add it in Cloudflare Pages → Settings → Environment variables." },
      { status: 500 }
    );
  }

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
  return NextResponse.json(
    { ok: false, error: `GitHub API returned ${ghRes.status}`, details: text.slice(0, 500) },
    { status: 502 }
  );
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
