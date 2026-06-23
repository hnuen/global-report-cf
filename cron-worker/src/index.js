/**
 * global-report-cron-trigger
 *
 * Does exactly one thing: on its Cron Trigger schedule (see wrangler.toml),
 * call GitHub's workflow_dispatch REST API to run global-report-cf's
 * refresh.yml. This exists because GitHub Actions' own `schedule:` trigger
 * is best-effort with no SLA — it has been observed silently delaying or
 * dropping runs for hours under platform load. Cloudflare Cron Triggers run
 * on Cloudflare's own scheduler, independent of GitHub's queue.
 *
 * Required secrets (set via `wrangler secret put <NAME>`, same pattern as
 * SAVE_BRIEFING_SECRET on the main app — never hardcoded, never committed):
 *   GITHUB_PAT   - a fine-grained PAT scoped to this repo only, with
 *                  "Actions: write" permission (that's all it needs).
 *
 * Plain vars (safe to keep in wrangler.toml or set here) configure which
 * repo/workflow/branch to dispatch — edit the defaults below if needed.
 */

const GITHUB_OWNER = "hnuen";
const GITHUB_REPO = "global-report-cf";
const GITHUB_WORKFLOW_FILE = "refresh.yml";
const GITHUB_REF = "main";

async function triggerRefresh(env) {
  if (!env.GITHUB_PAT) {
    throw new Error("Missing GITHUB_PAT secret — run: wrangler secret put GITHUB_PAT");
  }

  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/${GITHUB_WORKFLOW_FILE}/dispatches`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.GITHUB_PAT}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "global-report-cron-trigger",
    },
    body: JSON.stringify({ ref: GITHUB_REF, inputs: { job: "refresh" } }),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`workflow_dispatch failed: ${res.status} ${text}`);
  }
  return { status: res.status, body: text };
}

export default {
  async scheduled(event, env, ctx) {
    try {
      const result = await triggerRefresh(env);
      console.log(`[cron-trigger] dispatched refresh.yml ok (HTTP ${result.status}) at ${new Date(event.scheduledTime).toISOString()}`);
    } catch (err) {
      // Cron Triggers have no built-in alerting on failure, so log loudly —
      // visible in `wrangler tail` and the Cloudflare dashboard's Logs tab.
      console.error(`[cron-trigger] FAILED: ${err.message}`);
      throw err;
    }
  },

  // No HTTP traffic expected — this exists only so the Worker has a `fetch`
  // handler (required) and so you can manually hit the URL to test dispatch
  // without waiting for the next cron tick.
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/trigger") {
      try {
        const result = await triggerRefresh(env);
        return new Response(`Dispatched ok (HTTP ${result.status})`, { status: 200 });
      } catch (err) {
        return new Response(`Failed: ${err.message}`, { status: 500 });
      }
    }
    return new Response(
      "global-report-cron-trigger: cron-only worker. Visit /trigger to manually fire a dispatch for testing.",
      { status: 200 }
    );
  },
};
