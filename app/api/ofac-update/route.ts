export const dynamic = "force-dynamic";
/**
 * /api/ofac-update  POST
 * Accepts a diff result and applies it to the program's library snapshot in Redis.
 * New items are added, removed items are marked archived (not deleted).
 * The static library .ts file is NOT modified — changes live in Redis as overrides.
 *
 * GET /api/ofac-update?id=iran  — returns the Redis override for a program (if any)
 * POST /api/ofac-update         — applies a diff { programId, newGLs, newEOs, removedGLs, removedEOs, checkedAt }
 */
import { NextRequest, NextResponse } from "next/server";

const OVERRIDE_PFX = "ofac-override-v1:";
const HISTORY_PFX  = "ofac-history-v1:";

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
  if (!u || !t) return;
  try {
    const body: any = { value: JSON.stringify(value) };
    if (ex) body.ex = ex;
    await fetch(`${u}/set/${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {}
}

async function redisLpush(key: string, value: any) {
  const u = process.env.UPSTASH_REDIS_REST_URL;
  const t = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!u || !t) return;
  try {
    await fetch(`${u}/lpush/${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
      body: JSON.stringify([JSON.stringify(value)]),
    });
    // Keep only last 50 history entries
    await fetch(`${u}/ltrim/${encodeURIComponent(key)}/0/49`, {
      method: "POST",
      headers: { Authorization: `Bearer ${t}` },
    });
  } catch {}
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

// GET — fetch current override + history for a program
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const override = await redisGet(OVERRIDE_PFX + id);
  const history  = await redisLrange(HISTORY_PFX + id);

  return NextResponse.json({ programId: id, override, history });
}

// POST — apply diff to stored override
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { programId, newGLs = [], newEOs = [], removedGLs = [], removedEOs = [],
          newAdvisories = [], removedAdvisories = [], checkedAt } = body;

  if (!programId) return NextResponse.json({ error: "Missing programId" }, { status: 400 });

  const now = checkedAt || new Date().toISOString();
  const dateStr = new Date(now).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric"
  });

  // Load existing override (or empty)
  const existing = await redisGet(OVERRIDE_PFX + programId) || {
    programId,
    addedGLs: [],
    archivedGLs: [],
    addedEOs: [],
    archivedEOs: [],
    addedAdvisories: [],
    archivedAdvisories: [],
    lastUpdated: dateStr,
    history: [],
  };

  // Track what changed this run
  const changes: string[] = [];

  // New GLs — add to addedGLs list
  for (const gl of newGLs) {
    const num = typeof gl === "string" ? gl : gl.number;
    if (!existing.addedGLs.find((g: any) => g.number === num)) {
      existing.addedGLs.push({
        number: num,
        title: gl.title || `GL ${num} — pending title update`,
        date: dateStr,
        addedDate: dateStr,
        url: gl.url || null,
      });
      changes.push(`Added GL ${num}`);
    }
  }

  // Removed GLs — move to archivedGLs
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
        title: eo.title || `EO ${num} — pending title update`,
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
      : "No changes — library already up to date",
  });
}
