/**
 * Test all configured notifiers with a sample alert.
 *
 * Usage:
 *   npx ts-node scripts/test-notifiers.ts           # show which are configured
 *   npx ts-node scripts/test-notifiers.ts --send    # send a real test alert
 *   npx ts-node scripts/test-notifiers.ts telegram  # test one channel only
 */

import "dotenv/config";
import { getNotifierManager } from "../src/notifiers/manager";
import type { ScoredArticle } from "../src/lib/alert-scorer";

const SAMPLE: ScoredArticle = {
  score: 88,
  shouldAlert: true,
  reasons: ["high impact (+30)", "OFAC action (+15)", '"SDN" (+20)', '"designated" (+12)'],
  article: {
    id: 999,
    section: "sanctions",
    category: "OFAC",
    region: "Iran",
    impact: "high",
    date: new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
    headline: "TEST ALERT — OFAC Designates Major Iranian Oil Intermediary to SDN List",
    body: [
      "This is a test alert sent from the Global Report monitoring system. If you received this, your notification channel is configured correctly.",
      "No action required. This alert was triggered manually to verify delivery.",
    ],
    source: "Test Script",
    sourceUrl: "https://home.treasury.gov",
  },
};

async function main() {
  const args    = process.argv.slice(2);
  const doSend  = args.includes("--send");
  const channel = args.find(a => !a.startsWith("--"));

  const manager  = getNotifierManager();
  const statuses = manager.status();

  console.log("\n── Configured Notifiers ─────────────────────────────────────────");
  statuses.forEach(s => {
    console.log(`  ${s.configured ? "✅" : "❌"} ${s.name} (${s.id})`);
  });

  const configured = statuses.filter(s => s.configured);
  console.log(`\n${configured.length} of ${statuses.length} channels configured.`);

  if (!doSend) {
    console.log("\nRun with --send to deliver a test alert to all configured channels.");
    console.log("Run with --send telegram (or ntfy, discord, etc.) to test one channel.");
    return;
  }

  // Filter to requested channel if specified
  if (channel) {
    process.env.NOTIFIER_ORDER = channel;
    process.env.NOTIFIER_STRATEGY = "first-success";
    console.log(`\n── Testing channel: ${channel} ──────────────────────────────────`);
  } else {
    process.env.NOTIFIER_STRATEGY = "all";
    console.log(`\n── Sending test alert to ALL configured channels ────────────────`);
  }

  // Bypass cooldown for test
  process.env.ALERT_COOLDOWN_MINUTES = "0";

  const result = await manager.notify([SAMPLE], process.env.APP_URL ?? "");

  console.log(`\n── Results ──────────────────────────────────────────────────────`);
  console.log(`Sent via: ${result.channels.join(", ") || "none"}`);
  result.results.forEach(r => {
    console.log(`  ${r.success ? "✅" : "❌"} ${r.channel}${r.error ? ` — ${r.error}` : ""}`);
  });
}

main().catch(e => { console.error("Error:", e); process.exit(1); });
