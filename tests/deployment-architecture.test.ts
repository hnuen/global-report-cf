import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Cloudflare cron is the sole monitor scheduler and exposes no public trigger", async () => {
  const [worker, workerConfig, githubMonitor] = await Promise.all([
    read("cron-worker/src/index.js"),
    read("cron-worker/wrangler.toml"),
    read(".github/workflows/monitor.yml"),
  ]);
  assert.doesNotMatch(worker, /async fetch\s*\(/);
  assert.match(workerConfig, /"17,47 \* \* \* \*"/);
  assert.doesNotMatch(githubMonitor, /^\s*schedule:/m);
});

test("Pages configuration uses only supported limits and Worker observability stays separate", async () => {
  const config = await read("wrangler.toml");
  const workerConfig = await read("cron-worker/wrangler.toml");
  assert.match(config, /^subrequests\s*=\s*500$/m);
  assert.doesNotMatch(config, /subrequest_limit/);
  assert.doesNotMatch(config, /\[observability\]/);
  assert.match(workerConfig, /\[observability\]/);
});

test("subscription links require POST before approval or denial mutates state", async () => {
  const [approve, deny] = await Promise.all([
    read("app/api/subscribe/approve/route.ts"),
    read("app/api/subscribe/deny/route.ts"),
  ]);
  assert.match(approve, /export async function POST/);
  assert.match(deny, /export async function POST/);
  const approveGet = approve.slice(approve.indexOf("export async function GET"), approve.indexOf("export async function POST"));
  const denyGet = deny.slice(deny.indexOf("export async function GET"), deny.indexOf("export async function POST"));
  assert.doesNotMatch(approveGet, /approveSubscriber\(/);
  assert.doesNotMatch(denyGet, /denySubscriber\(/);
});

test("persistent mutations cannot silently fall back to process memory", async () => {
  const [save, refresh, orchestrator] = await Promise.all([
    read("app/api/save-briefing/route.ts"),
    read("app/api/background-refresh/route.ts"),
    read("src/lib/orchestrator.ts"),
  ]);
  for (const source of [save, refresh, orchestrator]) assert.match(source, /requirePersistent:\s*true/);
});
