// Telegram calls this URL every time someone messages the bot (once it's
// registered via setWebhook — see the setup instructions given alongside
// this file). We only care about "/start <linkCode>" — that's what Telegram
// sends when a user taps a https://t.me/<bot>?start=<linkCode> deep link,
// which is the only way to learn a registrant's chat_id (a bot can't message
// a phone number, only a chat_id obtained this way).
import { NextRequest, NextResponse } from "next/server";
import { linkTelegramChat } from "@/src/lib/subscribers";
import { sendApprovalEmail, isApprovalEmailConfigured } from "@/src/lib/approval-email";

export const dynamic = "force-dynamic";

interface TelegramUpdate {
  message?: {
    chat?: { id?: number | string };
    text?: string;
  };
}

async function replyToTelegram(chatId: number | string, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch (e) {
    console.warn("[telegram-webhook] reply failed (non-fatal):", String(e).slice(0, 100));
  }
}

export async function POST(request: NextRequest) {
  // Optional but recommended: Telegram echoes back whatever secret_token was
  // passed to setWebhook in this header on every call, so random POSTs to
  // this URL can't spoof a /start message. Skipped if not configured.
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (expectedSecret) {
    const got = request.headers.get("x-telegram-bot-api-secret-token");
    if (got !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let update: TelegramUpdate;
  try {
    update = await request.json();
  } catch {
    return NextResponse.json({ ok: true }); // Telegram doesn't care about malformed bodies, just don't 500
  }

  const text = update.message?.text ?? "";
  const chatId = update.message?.chat?.id;
  const match = /^\/start\s+(\S+)/.exec(text);

  if (!match || chatId === undefined) {
    // Not a /start with a code — nothing for us to do, but still 200 so
    // Telegram doesn't retry-storm this update.
    return NextResponse.json({ ok: true });
  }

  const linkCode = match[1];
  const sub = await linkTelegramChat(linkCode, String(chatId));

  if (!sub) {
    await replyToTelegram(chatId, "That link has already been used or has expired. Please request a new one from the registration page.");
    return NextResponse.json({ ok: true });
  }

  await replyToTelegram(chatId, "Got it — your request has been sent to the site owner for approval. You'll start receiving alerts here once it's approved.");

  if (isApprovalEmailConfigured()) {
    const result = await sendApprovalEmail(sub);
    if (!result.ok) {
      console.warn("[telegram-webhook] approval email failed:", result.error);
    }
  } else {
    console.warn("[telegram-webhook] approval email not configured — request saved but owner not notified");
  }

  return NextResponse.json({ ok: true });
}
