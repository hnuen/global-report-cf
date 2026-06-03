import { NextResponse } from "next/server";
import { buildStorageManager } from "@/src/lib/storage-manager";

export const dynamic = "force-dynamic";

export async function GET() {
  let upstashPingTest = "not tested";
  try {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (url && token) {
      const r = await fetch(`${url}/ping`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(5000)
      });
      upstashPingTest = r.ok ? `OK (${await r.text()})` : `HTTP ${r.status}`;
    }
  } catch(e) { upstashPingTest = `ERROR: ${e}`; }

  let storageLoad = "not tested";
  let adaptersLog = "";
  try {
    // Capture console.log during buildStorageManager to see which adapters register
    const logs: string[] = [];
    const orig = console.log;
    console.log = (...args: any[]) => { logs.push(args.join(" ")); orig(...args); };
    const mgr = await buildStorageManager();
    console.log = orig;
    adaptersLog = logs.filter(l => l.includes("[storage]")).join(" | ");

    const briefing = await mgr.load();
    storageLoad = briefing
      ? `loaded OK — ${briefing.articles?.length} articles, updated ${briefing.lastUpdated}`
      : "empty — no briefing in Redis yet (need to run refresh)";
  } catch(e) { storageLoad = `ERROR: ${e}`; }

  return NextResponse.json({
    UPSTASH_REDIS_REST_URL:   process.env.UPSTASH_REDIS_REST_URL   ? "SET" : "NOT SET",
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN ? "SET" : "NOT SET",
    upstashPingTest,
    adaptersLog,
    storageLoad,
  });
}
