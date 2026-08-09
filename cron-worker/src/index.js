/**
 * Dispatch GitHub refresh and monitor workflows from Cloudflare Cron Triggers.
 * Monitor cadence is evaluated in America/New_York so daylight-saving changes
 * do not move the 9-11 AM and 3-5 PM priority windows.
 */
const GITHUB_OWNER = "hnuen";
const GITHUB_REPO = "global-report-cf";
const GITHUB_REF = "main";
const MONITOR_CRON = "2,17,32,47 * * * *";
const DEFAULT_WORKFLOW_FILE = "refresh.yml";

const PEAK_ROTATION = [
  "1:1,3:1", "1:2,2:1", "1:3,3:2", "1:4,2:2",
  "1:1,3:3", "1:2,2:3", "1:3,3:4", "1:4,2:4",
];
const STANDARD_ROTATION = [
  "1:1,2:1", "1:2,3:1", "1:3,2:2", "1:4,3:2",
  "2:3,4:1", "3:3,4:2", "2:4,4:3", "3:4,4:4",
];

function easternClock(scheduledTime) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(scheduledTime));
  const value = type => Number(parts.find(part => part.type === type)?.value ?? 0);
  return { hour: value("hour"), minute: value("minute") };
}

export function monitorPlan(scheduledTime) {
  const { hour, minute } = easternClock(scheduledTime);
  const quarter = Math.floor(minute / 15);
  const peak = (hour >= 9 && hour < 11) || (hour >= 15 && hour < 17);
  const daytime = hour >= 7 && hour < 20;

  if (!peak && daytime && quarter % 2 === 0) return null;
  if (!peak && !daytime && quarter !== 1) return null;

  if (peak) {
    const peakSlot = ((hour % 2) * 4 + quarter) % PEAK_ROTATION.length;
    return { batches: PEAK_ROTATION[peakSlot], cadence: "priority-15m" };
  }

  const standardSlot = daytime
    ? Math.floor((hour * 4 + quarter) / 2) % STANDARD_ROTATION.length
    : hour % STANDARD_ROTATION.length;
  return {
    batches: STANDARD_ROTATION[standardSlot],
    cadence: daytime ? "daytime-30m" : "overnight-60m",
  };
}

async function triggerWorkflow(env, workflowFile, inputs) {
  if (!env.GITHUB_PAT) throw new Error("Missing GITHUB_PAT secret");
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
  if (!res.ok) throw new Error(`workflow_dispatch failed for ${workflowFile}: ${res.status} ${text}`);
  return res.status;
}

export default {
  async scheduled(event, env) {
    const isMonitor = event.cron === MONITOR_CRON;
    const plan = isMonitor ? monitorPlan(event.scheduledTime) : null;
    if (isMonitor && !plan) {
      console.log(`[cron-trigger] skipped monitor tick at ${new Date(event.scheduledTime).toISOString()}`);
      return;
    }

    const workflowFile = isMonitor ? "monitor.yml" : DEFAULT_WORKFLOW_FILE;
    const inputs = isMonitor ? { batches: plan.batches } : { job: "refresh" };
    const status = await triggerWorkflow(env, workflowFile, inputs);
    console.log(`[cron-trigger] dispatched ${workflowFile} HTTP ${status}; ${isMonitor ? `${plan.cadence} batches=${plan.batches}` : "scheduled refresh"}`);
  },
};
