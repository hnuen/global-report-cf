// Public endpoint — anyone can register a phone number or Telegram account
// to receive Global Report alerts. WhatsApp/SMS registrations go straight to
// "pending_approval" and email the site owner immediately. Telegram
// registrations can't be approved yet at this point — a bot can only message
// a chat_id, not a phone number, so the registrant has to open a deep link
// and hit "Start" first (handled by app/api/telegram-webhook). The frontend
// shows that deep link using the telegramDeepLink field in the response.
import { NextRequest, NextResponse } from "next/server";
import { createPhoneSubscriber, createTelegramSubscriber, type SubscriberChannel } from "@/src/lib/subscribers";
import { sendApprovalEmail, isApprovalEmailConfigured } from "@/src/lib/approval-email";

export const dynamic = "force-dynamic";

// Loose E.164 check — leading +, 8-15 digits total. Good enough to catch
// typos without rejecting legitimate international formats.
const PHONE_PATTERN = /^\+[1-9]\d{7,14}$/;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({})) as {
      channel?: string; phone?: string; name?: string;
    };
    const channel = body.channel as SubscriberChannel;
    const name = (body.name ?? "").trim().slice(0, 80) || undefined;

    if (!["telegram", "whatsapp", "sms"].includes(channel)) {
      return NextResponse.json({ error: "channel must be telegram, whatsapp, or sms" }, { status: 400 });
    }

    if (channel === "telegram") {
      const botUsername = process.env.TELEGRAM_BOT_USERNAME;
      if (!botUsername) {
        return NextResponse.json(
          { error: "Telegram registration isn't set up yet (TELEGRAM_BOT_USERNAME missing)" },
          { status: 503 }
        );
      }
      const sub = await createTelegramSubscriber(name);
      const telegramDeepLink = `https://t.me/${botUsername}?start=${sub.telegramLinkCode}`;
      return NextResponse.json({
        ok: true,
        status: sub.status,
        telegramDeepLink,
        message: "Open Telegram and tap Start to finish registering — your request will then go to the site owner for approval.",
      });
    }

    // whatsapp / sms — require a phone number, approval email goes out now
    const phone = (body.phone ?? "").trim();
    if (!PHONE_PATTERN.test(phone)) {
      return NextResponse.json(
        { error: "phone must be in international format, e.g. +14155551234" },
        { status: 400 }
      );
    }

    const sub = await createPhoneSubscriber(channel, phone, name);

    if (!isApprovalEmailConfigured()) {
      // Subscriber is still saved as pending_approval — just nobody got
      // notified. Surface this clearly rather than silently losing the request.
      return NextResponse.json({
        ok: true,
        status: sub.status,
        warning: "Saved, but the site owner's approval email isn't configured yet — this request won't be seen until that's set up.",
      });
    }

    const emailResult = await sendApprovalEmail(sub);
    return NextResponse.json({
      ok: true,
      status: sub.status,
      message: "Request sent — you'll start receiving alerts once the site owner approves it.",
      ...(emailResult.ok ? {} : { warning: `Saved, but the approval email failed to send: ${emailResult.error}` }),
    });
  } catch (e) {
    console.error("[subscribe]", String(e));
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
