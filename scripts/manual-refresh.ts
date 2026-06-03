/**
 * Manual refresh script — run from terminal without a running server.
 * Uses the same orchestrator as the API routes.
 *
 * Usage:
 *   npx ts-node scripts/manual-refresh.ts
 *   npx ts-node scripts/manual-refresh.ts "Iran sanctions"
 *   npx ts-node scripts/manual-refresh.ts --health
 */

import "dotenv/config";
import { refreshBriefing, getSystemHealth } from "../src/lib/orchestrator";

async function main() {
  const args = process.argv.slice(2);

  if (args[0] === "--health") {
    const health = await getSystemHealth();
    console.log("\n── System Health ─────────────────────────────────────────");
    console.log("\nStorage adapters:");
    health.storage.forEach(s => {
      const pct = s.dailyLimit > 0 ? ` (${s.dailyReads}/${s.dailyLimit} reads today)` : "";
      console.log(`  ${s.healthy ? "✅" : "❌"} ${s.id}${pct}`);
    });
    console.log("\nLLM providers:");
    Object.values(health.llm).forEach((p: { id: string; calls: number; limit: number }) => {
      if (!p.id) return;
      const pct = p.limit > 0 ? ` (${p.calls}/${p.limit} calls today)` : ` (${p.calls} calls today)`;
      console.log(`  ${p.id}${pct}`);
    });
    return;
  }

  const topic = args[0];
  console.log(`\nRefreshing briefing${topic ? ` — topic: "${topic}"` : ""}…`);

  const start = Date.now();
  const { briefing, usedProvider, savedTo } = await refreshBriefing(topic);
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log(`\n✅ Done in ${elapsed}s`);
  console.log(`   Provider : ${usedProvider}`);
  console.log(`   Articles : ${briefing.articles.length}`);
  console.log(`   Updated  : ${briefing.lastUpdated}`);
  console.log(`   Saved to : ${savedTo.join(", ")}`);
}

main().catch(e => { console.error("Error:", e); process.exit(1); });
