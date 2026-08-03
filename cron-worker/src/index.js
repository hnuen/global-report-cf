/**
 * global-report-cron-trigger
 *
 * Does exactly one thing: on its Cron Trigger schedule (see wrangler.toml),
 * call GitHub's workflow_dispatch REST API to run one of global-report-cf's
 * workflows. This exists because GitHub Actions' own `schedule:` trigger
 * is best-effort with no SLA — it has been observed silently delaying or
 * dropping runs for hours under platform load. Cloudflare Cron Triggers run
 * on Cloudflare's own scheduler, independent of GitHub's queue.
 *
 * Originally dispatched only refresh.yml. Extended 2026-06-27 to also
 * dispatch monitor.yml (the alert pipeline), which had the exact same
 * problem on GitHub's native `schedule:` trigger — a stalled run let alerts
 * age past their eligibility window, then several fired at once in a
 * backlog burst the next time it ran. CRON_WORKFLOW_MAP below decides which
 * workflow a given cron tick dispatches; see wrangler.toml for the schedule.
 *
 * Required secrets (set via `wrangler secret put <NAME>`, same pattern as
 * SAVE_BRIEFING_SECRET on the main app — never hardcoded, never committed):
 *   GITHUB_PAT   - a fine-grained PAT scoped to this repo only, with
 *                  "Actions: write" permission (that's all it needs).
 *
 * Plain vars (safe to keep in wrangler.toml or set here) configure which
 * repo/branch to dispatch — edit the defaults below if needed.
 */

const GITHUB_OWNER = "hnuen";
const GITHUB_REPO = "global-report-cf";
const GITHUB_REF = "main";

// Cron string (must match wrangler.toml exactly) → workflow file to fire.
// Anything not listed here falls back to DEFAULT_WORKFLOW_FILE, which keeps
// the original 4 refresh.yml slots working without needing an entry each.
const CRON_WORKFLOW_MAP = {
  "17,47 * * * *": "monitor.yml",
};
const DEFAULT_WORKFLOW_FILE = "refresh.yml";

function inputsFor(workflowFile) {
  return workflowFile === "monitor.yml" ? {} : { job: "refresh" };
}

async function triggerWorkflow(env, workflowFile, inputs) {
  if (!env.GITHUB_PAT) {
    throw new Error("Missing GITHUB_PAT secret — run: wrangler secret put GITHUB_PAT");
  }

  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/${workflowFile}/dispatches`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.GITHUB_PAT}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "global-report-cron-trigger",
    },
    body: JSON.stringify({ ref: GITHUB_REF, inputs }),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`workflow_dispatch failed for ${workflowFile}: ${res.status} ${text}`);
  }
  return { status: res.status, body: text };
}

export default {
  async scheduled(event, env, ctx) {
    const workflowFile = CRON_WORKFLOW_MAP[event.cron] ?? DEFAULT_WORKFLOW_FILE;
    try {
      const result = await triggerWorkflow(env, workflowFile, inputsFor(workflowFile));
      console.log(`[cron-trigger] dispatched ${workflowFile} ok (HTTP ${result.status}) at ${new Date(event.scheduledTime).toISOString()} (cron: ${event.cron})`);
    } catch (err) {
      // Cron Triggers have no built-in alerting on failure, so log loudly —
      // visible in `wrangler tail` and the Cloudflare dashboard's Logs tab.
      console.error(`[cron-trigger] FAILED (${workflowFile}, cron ${event.cron}): ${err.message}`);
      throw err;
    }
  },

  // No HTTP traffic expected — this exists only so the Worker has a `fetch`
  // handler (required) and so you can manually hit the URL to test dispatch
  // without waiting for the next cron tick.
};
