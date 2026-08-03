// One-click deny link from the admin approval email — see approve/route.ts
// for why a GET with a bare token is sufficient auth here.
import { NextRequest, NextResponse } from "next/server";
import { denySubscriber } from "@/src/lib/subscribers";
import { confirmationPage } from "../confirmation-page";
import { escapeHtml } from "@/src/lib/escape-html";

export const dynamic = "force-dynamic";

const HTML_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
};

function denyForm(token: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Confirm denial</title></head><body style="font-family:sans-serif;max-width:520px;margin:80px auto;padding:20px"><h1>Deny subscriber?</h1><p>No alerts will be sent to this request.</p><form method="post"><input type="hidden" name="token" value="${escapeHtml(token)}"><button type="submit" style="padding:10px 18px">Confirm denial</button></form></body></html>`;
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  if (!token) {
    return new NextResponse(confirmationPage("Missing token", false), {
      status: 400, headers: { "Content-Type": "text/html" },
    });
  }

  return new NextResponse(denyForm(token), { status: 200, headers: HTML_HEADERS });
}

export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  const token = typeof form?.get("token") === "string" ? String(form.get("token")) : "";
  if (!token) {
    return new NextResponse(confirmationPage("Missing token", false), { status: 400, headers: HTML_HEADERS });
  }
  const sub = await denySubscriber(token);
  if (!sub) {
    return new NextResponse(
      confirmationPage("This request was already handled, or the link is invalid.", false),
      { status: 200, headers: HTML_HEADERS }
    );
  }

  return new NextResponse(
    confirmationPage("Denied. No alerts will be sent to this request.", true),
    { status: 200, headers: HTML_HEADERS }
  );
}
