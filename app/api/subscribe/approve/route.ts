// One-click link from the admin approval email. GET (not POST) so it works
// as a plain hyperlink — the token itself is the unguessable, single-use
// credential, so no further auth is needed.
import { NextRequest, NextResponse } from "next/server";
import { approveSubscriber } from "@/src/lib/subscribers";
import { sendNtfyTopicEmail } from "@/src/lib/approval-email";
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
    ntfyNote = emailResult.ok
      ? ` Topic emailed to ${sub.email}.`
      : ` Could not email topic (${emailResult.error}) — topic is: ${sub.ntfyTopic}`;
  }

  const destination = sub.channel === "telegram"
    ? "their linked Telegram chat"
    : sub.channel === "ntfy"
    ? `ntfy topic ${sub.ntfyTopic}`
    : sub.phone ?? "unknown";

  return new NextResponse(
    confirmationPage(
      `Approved. ${sub.channel === "telegram" ? "Telegram" : sub.channel.toUpperCase()} alerts will start going to ${destination}.${ntfyNote}`,
      true
    ),
    { status: 200, headers: { "Content-Type": "text/html" } }
  );
}
