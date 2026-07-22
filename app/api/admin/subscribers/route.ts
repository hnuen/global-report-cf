/**
 * Admin endpoint for viewing and revoking subscribers (app/admin/subscribers
 * is the UI on top of this). Unlike /api/monitor's isAuthorised(), an unset
 * ADMIN_SECRET does NOT fall back to "everyone's authorized" — this endpoint
 * can reveal subscriber names/phone numbers, so it must be explicitly
 * configured to do anything at all.
 *
 * Env vars:
 *   ADMIN_SECRET — required; sent by the admin page as the x-admin-secret header
 */
import { NextRequest, NextResponse } from "next/server";
import { listAllSubscribers, revokeSubscriber, deleteSubscriber, updateSubscriberSections } from "@/src/lib/subscribers";
import { validateCategoryKeys, categoriesToSections } from "@/src/lib/alert-categories";

export const dynamic = "force-dynamic";

function isAuthorised(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  return req.headers.get("x-admin-secret") === secret;
}

export async function GET(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const subscribers = await listAllSubscribers();
  return NextResponse.json({ subscribers });
}

export async function POST(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({})) as { id?: string };
  if (!body.id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  const sub = await revokeSubscriber(body.id);
  if (!sub) {
    return NextResponse.json(
      { error: "Not found, or not currently approved (already revoked/denied/pending)" },
      { status: 404 }
    );
  }
  return NextResponse.json({ ok: true, subscriber: sub });
}

/** Permanently removes a record (test/duplicate/junk registrations) — see deleteSubscriber(). */
export async function DELETE(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({})) as { id?: string };
  if (!body.id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  const ok = await deleteSubscriber(body.id);
  if (!ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

/**
 * PATCH — admin overrides which alert categories a subscriber is authorised for.
 * Body: { id, categories: string[] }. At least one valid category required.
 */
export async function PATCH(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({})) as { id?: string; categories?: string[] };
  if (!body.id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  const categories = validateCategoryKeys(body.categories);
  if (categories.length === 0) {
    return NextResponse.json({ error: "Select at least one category" }, { status: 400 });
  }
  const sections = categoriesToSections(categories);
  const sub = await updateSubscriberSections(body.id, sections);
  if (!sub) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, subscriber: sub });
}
