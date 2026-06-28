/**
 * Public "Contact Us" form (app/contact) — general feedback/comments, not
 * alert registration (that's app/subscribe, a separate flow on purpose).
 * Sends straight to the site owner's inbox via Resend's HTTP API (same
 * provider/helper as the subscriber approval emails — see src/lib/email.ts).
 *
 * Reuses ADMIN_APPROVAL_EMAIL as the destination rather than adding a new
 * env var: it's already "the site owner's inbox" and is documented/set up
 * for exactly this purpose.
 */
import { NextRequest, NextResponse } from "next/server";
import { sendEmail, isEmailConfigured } from "@/src/lib/email";

export const dynamic = "force-dynamic";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { name?: string; email?: string; message?: string };
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
