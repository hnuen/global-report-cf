// One-click deny link from the admin approval email — see approve/route.ts
// for why a GET with a bare token is sufficient auth here.
import { NextRequest, NextResponse } from "next/server";
import { denySubscriber } from "@/src/lib/subscribers";
import { confirmationPage } from "../confirmation-page";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  if (!token) {
    return new NextResponse(confirmationPage("Missing token", false), {
      status: 400, headers: { "Content-Type": "text/html" },
    });
  }

  const sub = await denySubscriber(token);
  if (!sub) {
    return new NextResponse(
      confirmationPage("This request was already handled, or the link is invalid.", false),
      { status: 200, headers: { "Content-Type": "text/html" } }
    );
  }

  return new NextResponse(
    confirmationPage("Denied. No alerts will be sent to this request.", true),
    { status: 200, headers: { "Content-Type": "text/html" } }
  );
}
