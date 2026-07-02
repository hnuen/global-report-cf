/**
 * /api/test-notify — sends a test alert to all configured notification channels.
 * Bypasses cooldown and article scoring. Useful for verifying ntfy, SMS, WhatsApp, Telegram.
 *
 * GET or POST /api/test-notify  →  no auth required (test-only endpoint)
 *
 * Returns: { ok, results: [{ channel, configured, success, error }] }
 */

import { NextResponse }       from "next/server";
import { TelegramNotifier }   from "@/src/notifiers/telegram";
import { NtfyNotifier }       from "@/src/notifiers/ntfy";
import { TwilioNotifier }     from "@/src/notifiers/twilio";
import { WhatsAppNotifier }   from "@/src/notifiers/whatsapp";
import type { ScoredArticle } from "@/src/lib/alert-scorer";

export const dynamic = "force-dynamic";

const appUrl = process.env.APP_URL ?? "https://global-report-cf.pages.dev";

function makeTestArticle(): ScoredArticle {
  return {
    score: 100,
    shouldAlert: true,
    reasons: ["test"],
    article: {
      id: 9999,
      section: "sanctions",
      category: "OFAC",
      region: "Global",
      impact: "high",
      date: new Date().toLocaleDateString("en-US", {
        month: "long", day: "numeric", year: "numeric",
      }),
      headline: "Test Alert — OFAC Sanctions Monitor is Active",
      body: [
        "This is a test notification from your OFAC sanctions monitor.",
        "If you received this, your alert channel is working correctly.",
      ],
      source:    "OFAC Sanctions Monitor",
      sourceUrl: appUrl,
    },
  };
}

export async function GET() {
  return handler();
}

export async function POST() {
  return handler();
}

async function handler() {
  const notifiers = [
    new TelegramNotifier(),
    new NtfyNotifier(),
    new TwilioNotifier(),
    new WhatsAppNotifier(),
  ];

  const payload = [makeTestArticle()];
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

  return NextResponse.json({ ok: true, results });
}
