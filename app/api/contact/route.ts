/**
 * Public "Contact Us" form (app/contact) — general feedback/comments, not
 * alert registration (that's app/subscribe, a separate flow on purpose).
 * Sends straight to the site owner's inbox via Resend's HTTP API (same
 * provider/helper as the subscriber approval emails — see src/lib/email.ts).
 *
 * Reuses ADMIN_APPROVAL_EMAIL as the destination rather than adding a new
 * env var: it's already "the site owner's inbox" and is documented/set up
 * for exactly this purpose.
 *
 * Spam protection (this is public + unauthenticated, unlike the other API
 * routes which are all gated by a secret):
 *   - Honeypot field ("website") — invisible to real users, bots that
 *     auto-fill every field trip it. We pretend success and silently drop.
 *   - Per-IP rate limit (5 / hour) via src/lib/rate-limit.ts, so a bot/script
 *     hammering this endpoint can't burn through the Resend free-tier quota
 *     or spam the owner's inbox.
 */
import { NextRequest, NextResponse } from "next/server";
import { sendEmail, isEmailConfigured } from "@/src/lib/email";
import { checkRateLimit, getClientIp } from "@/src/lib/rate-limit";
import { escapeHtml } from "@/src/lib/escape-html";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as {
    name?: string; email?: string; message?: string; website?: string;
  };

  // Honeypot — real users never see/fill this field. Pretend success so a
  // bot doesn't learn to look for a different signal.
  if ((body.website ?? "").trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  const ip = getClientIp(req);
  const allowed = await checkRateLimit(`contact_rl:${ip}`, 5, 60 * 60);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many messages from this network — please try again in a bit." },
      { status: 429 }
    );
  }

  const name = (body.name ?? "").trim().slice(0, 200);
  const email = (body.email ?? "").trim().slice(0, 320);
  const message = (body.message ?? "").trim().slice(0, 5000);

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }
  if (!message) {
    return NextResponse.json({ error: "Please enter a message." }, { status: 400 });
  }

  if (!isEmailConfigured() || !process.env.ADMIN_APPROVAL_EMAIL) {
    return NextResponse.json(
      { error: "Contact form isn't configured yet (RESEND_API_KEY / ADMIN_APPROVAL_EMAIL missing)." },
      { status: 503 }
    );
  }

  const subject = `Contact form message${name ? ` from ${name}` : ""}`;
  const text = [
    "New message from the Contact Us form:",
    "",
    name ? `Name: ${name}` : "",
    `Email: ${email}`,
    "",
    message,
  ].filter(Boolean).join("\n");

  const html = `
    <p>New message from the Contact Us form:</p>
    <p>
      ${name ? `<b>Name:</b> ${escapeHtml(name)}<br/>` : ""}
      <b>Email:</b> ${escapeHtml(email)}
    </p>
    <p style="white-space:pre-wrap;">${escapeHtml(message)}</p>
  `;

  const result = await sendEmail({
    to: process.env.ADMIN_APPROVAL_EMAIL,
    subject,
    text,
    html,
    replyTo: email,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Failed to send." }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
