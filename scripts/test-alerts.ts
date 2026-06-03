/**
 * Test script — scores current briefing and optionally sends a test SMS.
 *
 * Usage:
 *   npx ts-node scripts/test-alerts.ts           # score only, no SMS
 *   npx ts-node scripts/test-alerts.ts --send    # score + send real SMS
 *   npx ts-node scripts/test-alerts.ts --dry     # show what WOULD be sent
 */

import "dotenv/config";
import { loadBriefing }  from "../src/lib/orchestrator";
import { scoreAll }      from "../src/lib/alert-scorer";
import { sendAlerts }    from "../src/lib/sms-notifier";
import { SEED_DATA }     from "../src/lib/seed";

async function main() {
  const args = process.argv.slice(2);
  const doSend = args.includes("--send");
  const doDry  = args.includes("--dry");

  console.log("\n── Loading briefing ──────────────────────────────────────────");
  let briefing = await loadBriefing();
  if (!briefing) {
    console.log("No stored briefing found — using seed data");
    briefing = SEED_DATA;
  }

  console.log(`\n── Scoring ${briefing.articles.length} articles ──────────────────────────────`);
  const scored = scoreAll(briefing.articles);
  const threshold = Number(process.env.ALERT_SCORE_THRESHOLD ?? 75);

  scored.forEach(s => {
    const flag = s.shouldAlert ? "🚨" : s.score >= threshold - 10 ? "⚠️" : "  ";
    console.log(`${flag} [${String(s.score).padStart(3)}] ${s.article.headline.slice(0, 70)}`);
    if (s.score >= threshold - 20) {
      s.reasons.forEach(r => console.log(`         ↳ ${r}`));
    }
  });

  const alerting = scored.filter(s => s.shouldAlert);
  console.log(`\nThreshold: ${threshold} | Above threshold: ${alerting.length}`);

  if (doSend || doDry) {
    console.log(`\n── ${doDry ? "DRY RUN — SMS preview" : "Sending SMS alerts"} ──────────────────────────`);

    if (doDry) {
      const toNumbers = (process.env.ALERT_TO_NUMBERS ?? "").split(",").filter(Boolean);
      if (alerting.length === 0) {
        console.log("No articles above threshold — no SMS would be sent.");
      } else {
        alerting.slice(0, Number(process.env.ALERT_MAX_PER_RUN ?? 3)).forEach((sa, i) => {
          const score = sa.score;
          const emoji = score >= 90 ? "🚨" : score >= 80 ? "⚠️" : "📌";
          const section = sa.article.section.toUpperCase();
          console.log(`\n[SMS ${i+1} → ${toNumbers.join(", ")}]`);
          console.log("─".repeat(50));
          console.log(`${emoji} GLOBAL REPORT ALERT`);
          console.log(`[${section}] ${sa.article.category} | ${sa.article.region}`);
          console.log(sa.article.headline.slice(0, 120));
          console.log(`Score: ${score}/100`);
          console.log("─".repeat(50));
        });
      }
    } else {
      const result = await sendAlerts(alerting, process.env.APP_URL ?? "");
      console.log(`Sent: ${result.sent} | Skipped: ${result.skipped}`);
      if (result.errors.length > 0) {
        console.log("Errors:", result.errors);
      }
      result.messages.forEach(m => {
        console.log(`  → ${m.to}: ${m.success ? "✅ " + m.sid : "❌ " + m.error}`);
      });
    }
  } else {
    console.log("\nRun with --dry to preview SMS, or --send to actually send.");
  }
}

main().catch(e => { console.error("Error:", e); process.exit(1); });
