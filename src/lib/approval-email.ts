/**
 * Sends the site owner a one-click approve/deny email when someone registers
 * for alerts. Reuses the same SMTP_* env vars already configured for the
 * Email-to-SMS notifier (src/notifiers/email-sms.ts) — no new account needed
 * if that's already set up; if not, see .env.example for Gmail app-password
 * setup (same 5-minute process either way).
 *
 * Env vars:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM  (shared w/ email-sms)
 *   ADMIN_APPROVAL_EMAIL  — where these approval requests get sent
 *   APP_URL               — used to build the absolute approve/deny links
 */

import type { Subscriber } from "./subscribers";

export function isApprovalEmailConfigured(): boolean {
  return !!(
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS &&
    process.env.ADMIN_APPROVAL_EMAIL
  );
}

function describeSubscriber(sub: Subscriber): string {
  switch (sub.channel) {
    case "telegram":
      return `Telegram (chat linked: ${sub.telegramChatId ?? "unknown"})`;
    case "whatsapp":
      return `WhatsApp — ${sub.phone}`;
    case "sms":
      return `SMS — ${sub.phone}`;
  }
}

export async function sendApprovalEmail(sub: Subscriber): Promise<{ ok: boolean; error?: string }> {
  if (!isApprovalEmailConfigured()) {
    return { ok: false, error: "Approval email not configured (SMTP_* / ADMIN_APPROVAL_EMAIL missing)" };
  }

  const appUrl = (process.env.APP_URL ?? "").replace(/\/$/, "");
  const approveUrl = `${appUrl}/api/subscribe/approve?token=${encodeURIComponent(sub.token)}`;
  const denyUrl    = `${appUrl}/api/subscribe/deny?token=${encodeURIComponent(sub.token)}`;

  const subject = `New alert subscriber request — ${sub.channel}${sub.name ? ` (${sub.name})` : ""}`;
  const text = [
    "Someone registered to receive Global Report alerts:",
    "",
    `Channel: ${describeSubscriber(sub)}`,
    sub.name ? `Name: ${sub.name}` : "",
    `Requested: ${new Date(sub.createdAt).toLocaleString()}`,
    "",
    `Approve: ${approveUrl}`,
    `Deny:    ${denyUrl}`,
    "",
    "These links work once — clicking either one finalizes the request.",
  ].filter(Boolean).join("\n");

  const html = `
    <p>Someone registered to receive Global Report alerts:</p>
    <p>
      <b>Channel:</b> ${describeSubscriber(sub)}<br/>
      ${sub.name ? `<b>Name:</b> ${sub.name}<br/>` : ""}
      <b>Requested:</b> ${new Date(sub.createdAt).toLocaleString()}
    </p>
    <p>
      <a href="${approveUrl}" style="background:#2e7d32;color:#fff;padding:10px 20px;text-decoration:none;border-radius:4px;display:inline-block;margin-right:12px;">Approve</a>
      <a href="${denyUrl}" style="background:#c62828;color:#fff;padding:10px 20px;text-decoration:none;border-radius:4px;display:inline-block;">Deny</a>
    </p>
    <p style="color:#888;font-size:13px;">These links work once — clicking either one finalizes the request.</p>
  `;

  // nodemailer not supported in Cloudflare edge runtime — same caveat as email-sms.ts
  let nodemailer: any = null;
  try {
    nodemailer = await import("nodemailer");
  } catch {
    return { ok: false, error: "nodemailer not installed. Run: npm install nodemailer" };
  }

  const transporter = nodemailer.default.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM ?? process.env.SMTP_USER,
      to: process.env.ADMIN_APPROVAL_EMAIL,
      subject,
      text,
      html,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
