/**
 * /api/test-notify â€” sends a test alert to all configured notification channels.
 * Bypasses cooldown and article scoring. Useful for verifying ntfy, SMS, WhatsApp, Telegram.
 *
 * GET or POST /api/test-notify â€” requires ADMIN_SECRET header
 * (x-admin-secret). This sends REAL SMS/WhatsApp/Telegram messages to all
 * configured recipients, so it must never be callable anonymously â€” an
 * attacker looping it would drain the Twilio balance and spam every
 * subscriber.
 *
 * Category-aware: pass ?category=economics (GET, repeatable or comma-separated)
 * or { category: "economics" | ["economics","bis"] } (POST) to send a test in
 * specific categories. With no category, one test per category is sent â€” so
 * each subscriber receives a test for exactly the categories they're
 * subscribed to, which verifies category routing end-to-end.
 *
 * Returns: { ok, testedCategories, results: [{ channel, configured, success, error }] }
 */

import { NextRequest, NextResponse } from "next/server";
import { TelegramNotifier }   from "@/src/notifiers/telegram";
import { NtfyNotifier }       from "@/src/notifiers/ntfy";
import { TwilioNotifier }     from "@/src/notifiers/twilio";
import { WhatsAppNotifier }   from "@/src/notifiers/whatsapp";
import type { ScoredArticle } from "@/src/lib/alert-scorer";
import { ALERT_CATEGORIES, validateCategoryKeys, type AlertCategory } from "@/src/lib/alert-categories";

export const dynamic = "force-dynamic";

const appUrl = process.env.APP_URL ?? "https://global-report-cf.pages.dev";

function makeTestArticle(cat: AlertCategory): ScoredArticle {
  return {
    score: 100,
    shouldAlert: true,
    reasons: ["test"],
    article: {
      id: 9000 + Math.max(0, ALERT_CATEGORIES.indexOf(cat)),
      section: cat.sections[0] as ScoredArticle["article"]["section"], // representative section
      category: cat.label,
      region: "Global",
      impact: "high",
      date: new Date().toLocaleDateString("en-US", {
        month: "long", day: "numeric", year: "numeric",
      }),
      headline: `Test Alert â€” ${cat.label}`,
      body: [
        `This is a test notification for the "${cat.label}" category.`,
        "If you received this, your alert channel and category routing are working.",
      ],
      source:    "Global Report Monitor",
      sourceUrl: appUrl,
    },
  };
}

function isAuthorised(req: NextRequest): boolean {
  // FAIL CLOSED: unset ADMIN_SECRET disables this endpoint entirely.
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  return req.headers.get("x-admin-secret") === secret;
}

export async function POST(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({})) as { category?: string | string[]; categories?: string[] };
  const raw = body.categories ?? (Array.isArray(body.category) ? body.category : body.category ? [body.category] : []);
  return handler(validateCategoryKeys(raw));
}

async function handler(categoryKeys: string[]) {
  const notifiers = [
    new TelegramNotifier(),
    new NtfyNotifier(),
    new TwilioNotifier(),
    new WhatsAppNotifier(),
  ];

  // No category filter â†’ test every category (one article each), so each
  // subscriber gets a test for exactly the categories they subscribed to.
  const cats = categoryKeys.length
    ? ALERT_CATEGORIES.filter(c => categoryKeys.includes(c.key))
    : ALERT_CATEGORIES;
  const payload = cats.map(makeTestArticle);
  const results = [];

  for (const n of notifiers) {
    if (!n.isConfigured()) {
      results.push({ channel: n.name, configured: false });
      continue;
    }
    try {
      const r = await n.send(payload, appUrl);
      results.push({ channel: r.channel, configured: true, success: r.success, error: r.error });
    } catch (e) {
      results.push({ channel: n.name, configured: true, success: false, error: String(e) });
    }
  }

  return NextResponse.json({ ok: true, testedCategories: cats.map(c => c.key), results });
}

