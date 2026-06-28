// One-click link from the admin approval email. GET (not POST) so it works
// as a plain hyperlink — the token itself is the unguessable, single-use
// credential, so no further auth is needed.
import { NextRequest, NextResponse } from "next/server";
import { approveSubscriber } from "@/src/lib/subscribers";
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

  return new NextResponse(
    confirmationPage(
      `Approved. ${sub.channel === "telegram" ? "Telegram" : sub.channel.toUpperCase()} alerts will start going to ${sub.phone ?? "their linked Telegram chat"}.`,
      true
    ),
    { status: 200, headers: { "Content-Type": "text/html" } }
  );
}
