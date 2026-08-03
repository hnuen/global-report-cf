export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { applySuccessfulDeliveryCooldowns } from "@/src/lib/alert-delivery";

function isAuthorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  return !!secret && (
    req.headers.get("authorization") === `Bearer ${secret}` ||
    req.headers.get("x-cron-secret") === secret
  );
}

async function markAlerted(key: string, cooldownMinutes: number): Promise<void> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("Redis is not configured");
  const response = await fetch(`${url}/set/${encodeURIComponent("alert:" + key)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ value: "1", ex: cooldownMinutes * 60 }),
  });
  if (!response.ok) throw new Error(`Redis cooldown write failed (${response.status})`);
}

/** Called by GitHub only after its direct ntfy request returns 200/201. */
export async function POST(req: NextRequest) {
  if (!isAuthorised(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null) as { alertKeys?: unknown } | null;
  const alertKeys = Array.isArray(body?.alertKeys)
    ? body.alertKeys.filter((key): key is string => typeof key === "string" && key.length > 0 && key.length <= 500).slice(0, 5)
    : [];
  if (alertKeys.length === 0) return NextResponse.json({ error: "alertKeys is required" }, { status: 400 });

  try {
    const minutes = Number(process.env.ALERT_COOLDOWN_MINUTES ?? 10080);
    await applySuccessfulDeliveryCooldowns(alertKeys, minutes, markAlerted);
    return NextResponse.json({ ok: true, marked: alertKeys.length });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
