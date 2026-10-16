/**
 * /api/presence — anonymous visitor presence + visit/geo analytics.
 *
 *   POST  { vid }  heartbeat: record presence, count the visit once per session,
 *                  tally country/city. Returns { online }.
 *   GET            just the current online count, for the public badge.
 *
 * No PII is stored: the client IP is used only transiently (rate-limit + geo
 * lookup) and never written to Redis; only an anonymous visitor id and
 * aggregate country/city tallies are persisted. See src/lib/analytics.ts.
 */
import { NextRequest, NextResponse } from "next/server";
import { heartbeat, onlineCount, cleanVid, type GeoHint } from "@/src/lib/analytics";
import { checkRateLimit, getClientIp } from "@/src/lib/rate-limit";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

/** Best-effort geo from Cloudflare: request.cf (city/region/country) → cf-ipcountry header. */
async function readGeo(req: NextRequest): Promise<GeoHint> {
  const headerCountry = req.headers.get("cf-ipcountry");
  let country = headerCountry && headerCountry !== "XX" ? headerCountry : null;
  let city: string | null = null;
  let region: string | null = null;
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const cf = (getCloudflareContext() as any)?.cf;
    if (cf) {
      country = (cf.country as string) || country;
      city = (cf.city as string) || null;
      region = (cf.region as string) || null;
    }
  } catch { /* not on CF (local/dev) — country header only */ }
  return { country, city, region };
}

export async function POST(req: NextRequest) {
  let vid = "";
  try {
    const body = await req.json().catch(() => ({})) as { vid?: string };
    vid = cleanVid(body.vid);
  } catch { /* ignore */ }

  if (!vid) {
    // Still answer the badge even if the id is missing/invalid.
    return NextResponse.json({ online: await onlineCount(), ok: false }, { headers: NO_STORE });
  }

  // Abuse guard: a well-behaved client beats ~every 30s (2/min). Allow generous
  // headroom per IP, then stop *recording* (but still report the count).
  const ip = getClientIp(req);
  const allowed = await checkRateLimit(`presence:ip:${ip}`, 40, 60);
  if (!allowed) {
    return NextResponse.json({ online: await onlineCount(), ok: true, throttled: true }, { headers: NO_STORE });
  }

  const geo = await readGeo(req);
  const { online } = await heartbeat(vid, geo);
  return NextResponse.json({ online, ok: true }, { headers: NO_STORE });
}

export async function GET() {
  return NextResponse.json({ online: await onlineCount() }, { headers: NO_STORE });
}
