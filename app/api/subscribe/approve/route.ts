// One-click link from the admin approval email. GET (not POST) so it works
// as a plain hyperlink — the token itself is the unguessable, single-use
// credential, so no further auth is needed.
import { NextRequest, NextResponse } from "next/server";
import { approveSubscriber } from "@/src/lib/subscribers";
import { sendNtfyTopicEmail } from "@/src/lib/approval-email";
import { escapeHtml } from "@/src/lib/escape-html";
import { confirmationPage } from "../confirmation-page";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  if (!token) {
    return new NextResponse(confirmationPage("Missing token", false), {
      status: 400, headers: { "Content-Type": "text/html" },
    });
  }

  const sub = await approveSubscriber(token);
  if (!sub) {
    return new NextResponse(
      confirmationPage("This request was already handled, or the link is invalid.", false),
      { status: 200, headers: { "Content-Type": "text/html" } }
    );
  }

  // For ntfy subscribers: email them their generated topic
  let ntfyNote = "";
  if (sub.channel === "ntfy") {
    const emailResult = sub.email
      ? await sendNtfyTopicEmail(sub)
      : { ok: false, error: "No email provided" };
    // sub.email is user-supplied via the public /api/subscribe form and this
    // string is rendered as HTML in the admin's browser — escape it.
    ntfyNote = emailResult.ok
      ? ` Topic emailed to ${escapeHtml(sub.email!)}.`
      : ` Could not email topic (${escapeHtml(emailResult.error ?? "unknown")}) — topic is: ${escapeHtml(sub.ntfyTopic ?? "")}`;
  }

  const destination = sub.channel === "telegram"
    ? "their linked Telegram chat"
    : sub.channel === "ntfy"
    ? `ntfy topic ${escapeHtml(sub.ntfyTopic ?? "")}`
    : escapeHtml(sub.phone ?? "unknown");

  return new NextResponse(
    confirmationPage(
      `Approved. ${sub.channel === "telegram" ? "Telegram" : sub.channel.toUpperCase()} alerts will start going to ${destination}.${ntfyNote}`,
      true
    ),
    { status: 200, headers: { "Content-Type": "text/html" } }
  );
}
