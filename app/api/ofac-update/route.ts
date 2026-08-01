export const dynamic = "force-dynamic";
/**
 * /api/ofac-update  POST
 * Accepts a diff result and applies it to the program's library snapshot in Redis.
 * New items are added, removed items are marked archived (not deleted).
 * The static library .ts file is NOT modified â€” changes live in Redis as overrides.
 *
 * GET /api/ofac-update?id=iran  â€” returns the Redis override for a program (if any)
 * POST /api/ofac-update         â€” applies a diff { programId, newGLs, newEOs, removedGLs, removedEOs, checkedAt }
 */
import { NextRequest, NextResponse } from "next/server";
import { SANCTIONS_PROGRAMS } from "@/src/lib/sanctions-programs-library";
import { validateOfacUpdateBody } from "@/src/lib/request-validation";
import { hasSecret } from "@/src/lib/request-auth";

const OVERRIDE_PFX = "ofac-override-v1:";
const HISTORY_PFX  = "ofac-history-v1:";
const PROGRAM_IDS = new Set(SANCTIONS_PROGRAMS.map(program => program.id));

function isAuthorised(req: NextRequest): boolean {
  return hasSecret(req, process.env.OFAC_UPDATE_SECRET, "x-ofac-update-secret");
}

async function redisGet(key: string) {
  const u = process.env.UPSTASH_REDIS_REST_URL;
  const t = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!u || !t) return null;
  try {
    const r = await fetch(`${u}/get/${encodeURIComponent(key)}`,
      { headers: { Authorization: `Bearer ${t}` } });
    const d = await r.json();
    return d.result ? JSON.parse(d.result) : null;
  } catch { return null; }
}

async function redisSet(key: string, value: any, ex?: number) {
  const u = process.env.UPSTASH_REDIS_REST_URL;
  const t = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!u || !t) throw new Error("Redis is not configured");
  {
    const body: any = { value: JSON.stringify(value) };
    if (ex) body.ex = ex;
    const response = await fetch(`${u}/set/${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`Redis SET failed (${response.status})`);
  }
}

async function redisLpush(key: string, value: any) {
  const u = process.env.UPSTASH_REDIS_REST_URL;
  const t = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!u || !t) throw new Error("Redis is not configured");
  {
    const pushed = await fetch(`${u}/lpush/${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
      body: JSON.stringify([JSON.stringify(value)]),
    });
    if (!pushed.ok) throw new Error(`Redis LPUSH failed (${pushed.status})`);
    // Keep only last 50 history entries
    const trimmed = await fetch(`${u}/ltrim/${encodeURIComponent(key)}/0/49`, {
      method: "POST",
      headers: { Authorization: `Bearer ${t}` },
    });
    if (!trimmed.ok) throw new Error(`Redis LTRIM failed (${trimmed.status})`);
  }
}

async function redisLrange(key: string, start = 0, end = 19) {
  const u = process.env.UPSTASH_REDIS_REST_URL;
  const t = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!u || !t) return [];
  try {
    const r = await fetch(`${u}/lrange/${encodeURIComponent(key)}/${start}/${end}`,
      { headers: { Authorization: `Bearer ${t}` } });
    const d = await r.json();
    return (d.result || []).map((s: string) => JSON.parse(s));
  } catch { return []; }
}

// GET â€” fetch current override + history for a program
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id || !PROGRAM_IDS.has(id)) return NextResponse.json({ error: "Invalid program id" }, { status: 400, headers: { "Cache-Control": "no-store" } });

  const override = await redisGet(OVERRIDE_PFX + id);
  const history  = await redisLrange(HISTORY_PFX + id);

  return NextResponse.json({ programId: id, override, history });
}

// POST â€” apply diff to stored override
export async function POST(req: NextRequest) {
  try {
  if (!isAuthorised(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const body = validateOfacUpdateBody(await req.json().catch(() => null), PROGRAM_IDS) as Record<string, any> | null;
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  const { programId, newGLs = [], newEOs = [], removedGLs = [], removedEOs = [],
          newAdvisories = [], removedAdvisories = [], checkedAt } = body ?? {};

  const now = checkedAt || new Date().toISOString();
  const dateStr = new Date(now).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric"
  });

  // Load existing override (or empty) â€” also backfills any fields missing from
  // an older/partial stored shape, so a schema change here can't crash a
  // later run's .find()/.filter() calls on a previously-saved override.
  const loaded = await redisGet(OVERRIDE_PFX + programId);
  const existing = {
    programId,
    addedGLs: [],
    archivedGLs: [],
    addedEOs: [],
    archivedEOs: [],
    addedAdvisories: [],
    archivedAdvisories: [],
    lastUpdated: dateStr,
    history: [],
    ...(loaded ?? {}),
  };

  // Track what changed this run
  const changes: string[] = [];

  // New GLs â€” add to addedGLs list
  for (const gl of newGLs) {
    const num = typeof gl === "string" ? gl : gl.number;
    if (!existing.addedGLs.find((g: any) => g.number === num)) {
      existing.addedGLs.push({
        number: num,
        title: gl.title || `GL ${num} â€” pending title update`,
        date: dateStr,
        addedDate: dateStr,
        url: gl.url || null,
      });
      changes.push(`Added GL ${num}`);
    }
  }

  // Removed GLs â€” move to archivedGLs
  for (const gl of removedGLs) {
    const num = typeof gl === "string" ? gl : gl.number;
    if (!existing.archivedGLs.find((g: any) => g.number === num)) {
      existing.archivedGLs.push({
        number: num,
        title: gl.title || `GL ${num}`,
        archivedDate: dateStr,
        archivedNote: gl.note || "No longer listed on OFAC program page",
      });
      changes.push(`Archived GL ${num}`);
    }
    // Remove from addedGLs if it was there
    existing.addedGLs = existing.addedGLs.filter((g: any) => g.number !== num);
  }

  // New EOs
  for (const eo of newEOs) {
    const num = typeof eo === "string" ? eo : eo.number;
    if (!existing.addedEOs.find((e: any) => e.number === num)) {
      existing.addedEOs.push({
        number: num,
        title: eo.title || `EO ${num} â€” pending title update`,
        date: dateStr,
        addedDate: dateStr,
        url: eo.url || null,
      });
      changes.push(`Added EO ${num}`);
    }
  }

  // Removed EOs
  for (const eo of removedEOs) {
    const num = typeof eo === "string" ? eo : eo.number;
    if (!existing.archivedEOs.find((e: any) => e.number === num)) {
      existing.archivedEOs.push({
        number: `EO ${num}`,
        title: eo.title || `EO ${num}`,
        archivedDate: dateStr,
        archivedNote: eo.note || "No longer listed on OFAC program page",
      });
      changes.push(`Archived EO ${num}`);
    }
    existing.addedEOs = existing.addedEOs.filter((e: any) => e.number !== num);
  }

  // New advisories
  for (const adv of newAdvisories) {
    const title = typeof adv === "string" ? adv : adv.title;
    if (!existing.addedAdvisories.find((a: any) => a.title === title)) {
      existing.addedAdvisories.push({
        title,
        date: dateStr,
        addedDate: dateStr,
        url: adv.url || null,
      });
      changes.push(`Added advisory: ${title.slice(0, 60)}`);
    }
  }

  // Removed advisories
  for (const adv of removedAdvisories) {
    const title = typeof adv === "string" ? adv : adv.title;
    if (!existing.archivedAdvisories.find((a: any) => a.title === title)) {
      existing.archivedAdvisories.push({
        title,
        archivedDate: dateStr,
        archivedNote: adv.note || "No longer listed on OFAC program page",
      });
      changes.push(`Archived advisory: ${title.slice(0, 60)}`);
    }
    existing.addedAdvisories = existing.addedAdvisories.filter((a: any) => a.title !== title);
  }

  existing.lastUpdated = dateStr;
  existing.lastChecked = dateStr;
  existing.hasChanges = (
    (existing.addedGLs?.length ?? 0) +
    (existing.archivedGLs?.length ?? 0) +
    (existing.addedEOs?.length ?? 0) +
    (existing.archivedEOs?.length ?? 0)
  ) > 0;

  // Save override
  await redisSet(OVERRIDE_PFX + programId, existing);

  // Append to history log
  if (changes.length > 0) {
    await redisLpush(HISTORY_PFX + programId, {
      date: dateStr,
      changes,
      checkedAt: now,
    });
  }

  return NextResponse.json({
    success: true,
    programId,
    changes,
    override: existing,
    message: changes.length > 0
      ? `Applied ${changes.length} change(s) to library`
      : "No changes â€” library already up to date",
  });
  } catch (e) {
    console.error("[ofac-update]", String(e));
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

