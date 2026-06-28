/**
 * Generic outbound email via Resend's HTTP API — shared by approval-email.ts
 * (subscriber approve/deny) and app/api/contact (visitor feedback form).
 * HTTP-based on purpose: Cloudflare Workers/Pages Functions block raw TCP
 * sockets, so SMTP libraries like nodemailer can never connect there.
 *
 * Env vars:
 *   RESEND_API_KEY — from resend.com dashboard → API Keys
 *   EMAIL_FROM      — optional; defaults to onboarding@resend.dev (Resend's
 *                      sandbox sender — works with no domain verification,
 *                      but only when `to` is the Resend account's own email)
 */

export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
}

export async function sendEmail(input: SendEmailInput): Promise<{ ok: boolean; error?: string }> {
  if (!isEmailConfigured()) {
    return { ok: false, error: "Email not configured (RESEND_API_KEY missing)" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? "onboarding@resend.dev",
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
        reply_to: input.replyTo,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `Resend API error ${res.status}: ${body.slice(0, 300)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
