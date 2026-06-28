/**
 * Sends the site owner a one-click approve/deny email when someone registers
 * for alerts. Uses Resend's HTTP API (https://resend.com) rather than SMTP —
 * Cloudflare Workers/Pages Functions block raw TCP sockets, so SMTP libraries
 * like nodemailer can never complete a connection there ("Connection closed
 * unexpectedly" is that failure, not a config mistake).
 *
 * Setup (2 minutes):
 *   1. Sign up free at resend.com (no card required)
 *   2. Dashboard → API Keys → Create API Key → copy it
 *   3. Set RESEND_API_KEY and ADMIN_APPROVAL_EMAIL (your own inbox) below.
 *      Since approval emails only ever go to your own address, you can send
 *      from Resend's sandbox sender (onboarding@resend.dev) with NO domain
 *      verification needed — that only works for mail to the account owner's
 *      own email, which is exactly this use case.
 *
 * Env vars:
 *   RESEND_API_KEY        — from Resend dashboard
 *   ADMIN_APPROVAL_EMAIL   — where these approval requests get sent (your own inbox)
 *   EMAIL_FROM             — optional; defaults to onboarding@resend.dev
 *   APP_URL                — used to build the absolute approve/deny links
 */

import type { Subscriber } from "./subscribers";
import { sendEmail } from "./email";

export function isApprovalEmailConfigured(): boolean {
  return !!(
    process.env.RESEND_API_KEY &&
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
    return { ok: false, error: "Approval email not configured (RESEND_API_KEY / ADMIN_APPROVAL_EMAIL missing)" };
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

  return sendEmail({
    to: process.env.ADMIN_APPROVAL_EMAIL!,
    subject,
    text,
    html,
  });
}
