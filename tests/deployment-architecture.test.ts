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
  assert.ok(workerConfig.includes('"2,17,32,47 * * * *"'));
  assert.ok(worker.includes("America/New_York"));
  assert.ok(worker.includes("priority-15m"));
  assert.ok(worker.includes("daytime-30m"));
  assert.ok(worker.includes("overnight-60m"));
  assert.doesNotMatch(githubMonitor, /^\s*schedule:/m);
});

test("monitor delivery survives source-refresh outages and supports bounded catch-up", async () => {
  const [workflow, monitor] = await Promise.all([
    read(".github/workflows/monitor.yml"),
    read("app/api/monitor/route.ts"),
  ]);
  assert.match(workflow, /continue-on-error:\s*true/);
  assert.match(workflow, /last healthy snapshot/);
  assert.match(workflow, /--retry 2 --retry-all-errors/);
  assert.match(workflow, /backfill_hours:/);
  assert.doesNotMatch(workflow, /default: "144"/);
  assert.doesNotMatch(workflow, /github\.event_name[^\n]*144/);
  assert.match(monitor, /parsed < 1 \|\| parsed > 168/);
  assert.match(monitor, /\.mget<unknown\[]>/);
  assert.match(monitor, /manager\.notify\(deliveryCandidates/);
  assert.match(workflow, /get\("alertedArticles", \[\]\)\[:5\]/);
  assert.match(workflow, /HTTP" != "409".*HTTP" != "500"/);
  assert.match(workflow, /BATCHES_INPUT/);
  assert.ok(workflow.includes("^[1-4]:[1-4]$"));
  assert.match(monitor, /const archivedArticles = briefing\.articles/);
  assert.match(monitor, /selectMonitorArticles\(archivedArticles/);
  assert.doesNotMatch(monitor, /loadArticleLibrary/);
  assert.match(workflow, /Legacy workflow ntfy sender \(disabled\)/);
  assert.match(workflow, /if: \$\{\{ false \}\}/);
});

test("Pages configuration uses only supported limits and Worker observability stays separate", async () => {
  const config = await read("wrangler.toml");
  const workerConfig = await read("cron-worker/wrangler.toml");
  assert.match(config, /^subrequests\s*=\s*500$/m);
  assert.doesNotMatch(config, /subrequest_limit/);
  assert.doesNotMatch(config, /\[observability\]/);
  assert.match(config, /SKIP_DEPENDENCY_INSTALL\s*=\s*"1"/);
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

test("public news traffic cannot repeatedly download the full Redis archive", async () => {
  const [news, app, backup] = await Promise.all([
    read("app/api/news/route.ts"),
    read("app/AppContent.tsx"),
    read(".github/workflows/backup-articles.yml"),
  ]);
  assert.match(news, /PUBLIC_HISTORY_PER_SECTION\s*=\s*100/);
  assert.match(news, /limitPerSection:\s*PUBLIC_HISTORY_PER_SECTION/);
  assert.match(news, /archive:\s*true/);
  assert.match(news, /s-maxage=300/);
  assert.match(news, /archiveRequested[\s\S]*hasSecret/);
  assert.doesNotMatch(app, /\/api\/news\?t=\$\{Date\.now\(\)\}/);
  assert.match(app, /document\.hidden/);
  assert.equal((app.match(/loadNews\(true\)/g) ?? []).length, 1);
  assert.match(backup, /\/api\/news\?archive=1/);
  assert.match(backup, /x-cron-secret/);
});

test("routine article-library traffic uses bounded hot keys", async () => {
  const library = await read("src/lib/article-library.ts");
  assert.match(library, /HOT_KEY_PREFIX\s*=\s*"app:article-library:hot:v1:"/);
  assert.match(library, /HOT_ARTICLES_PER_SECTION\s*=\s*100/);
  assert.match(library, /SECTIONS\.map\(hotSectionKey\)/);
  assert.match(library, /slice\(0, HOT_ARTICLES_PER_SECTION\)/);
  assert.doesNotMatch(library, /existingRaws\s*=\s*await redisMGet\(affectedSections\.map\(sectionKey\)\)/);
});

test("a bounded GitHub snapshot keeps reads available during an Upstash outage", async () => {
  const [orchestrator, fallback, refresh] = await Promise.all([
    read("src/lib/orchestrator.ts"),
    read("src/lib/live-snapshot.ts"),
    read(".github/scripts/refresh-briefing.mjs"),
  ]);
  assert.match(orchestrator, /if \(stored\) return stored;[\s\S]*loadLiveSnapshot\(\)/);
  assert.match(fallback, /data\/live-briefing\.json/);
  assert.match(refresh, /if \(list\.length < 60\) list\.push\(article\)/);
  assert.match(refresh, /update live briefing fallback \[skip ci\]/);
  assert.match(refresh, /await commitLiveSnapshot\(payload\)/);
});

