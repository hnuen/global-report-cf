import { NextRequest, NextResponse } from "next/server";
import { loadAlertSettings, saveAlertSettings } from "@/src/lib/alert-settings";

export const dynamic = "force-dynamic";

function authorised(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  return !!secret && req.headers.get("x-admin-secret") === secret;
}

const noStore = { "Cache-Control": "no-store" };

export async function GET(req: NextRequest) {
  if (!authorised(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: noStore });
  return NextResponse.json({ settings: await loadAlertSettings() }, { headers: noStore });
}

export async function PATCH(req: NextRequest) {
  if (!authorised(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: noStore });
  try {
    const settings = await saveAlertSettings(await req.json());
    return NextResponse.json({ ok: true, settings }, { headers: noStore });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid settings" }, { status: 400, headers: noStore });
  }
}
