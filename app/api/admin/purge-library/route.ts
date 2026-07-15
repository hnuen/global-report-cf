export const dynamic = "force-dynamic";
/**
 * POST /api/admin/purge-library
 * Deletes all app:article-library:v2:{section} keys from Redis and clears
 * the cached briefing.  Call once after deploying the aiGenerated fix to
 * remove any Gemini-hallucinated articles that accumulated in the library
 * before the fix was applied.
 *
 * Requires ADMIN_SECRET header: x-admin-secret: <value>
 */

import { NextRequest, NextResponse } from "next/server";

const SECTIONS = ["sanctions", "economics", "regions", "occ", "penalties", "bis"];
const V2_PREFIX = "app:article-library:v2:";
const LEGACY_KEY = "app:article-library:v1";
const BRIEFING_KEY = "briefing";

function isAuthorised(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  return req.headers.get("x-admin-secret") === secret;
}

async function redisDel(keys: string[]): Promise<{ deleted: number; errors: string[] }> {
  const u = process.env.UPSTASH_REDIS_REST_URL;
  const t = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!u || !t) return { deleted: 0, errors: ["No Redis credentials"] };

  let deleted = 0;
  const errors: string[] = [];
  for (const key of keys) {
    try {
      const r = await fetch(`${u}/del/${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${t}` },
      });
      const d = await r.json();
      if (d.result === 1) deleted++;
    } catch (e) {
      errors.push(`${key}: ${String(e).slice(0, 60)}`);
    }
  }
  return { deleted, errors };
}

export async function POST(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const keysToDelete = [
    LEGACY_KEY,
    BRIEFING_KEY,
    ...SECTIONS.map(s => `${V2_PREFIX}${s}`),
  ];

  const result = await redisDel(keysToDelete);

  return NextResponse.json({
    ok: true,
    message: "Library and briefing cache purged. Next refresh will rebuild from real RSS sources only.",
    keysAttempted: keysToDelete.length,
    ...result,
  });
}
