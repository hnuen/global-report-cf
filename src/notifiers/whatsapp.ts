/**
 * WhatsApp Notifier — via Twilio's WhatsApp API (same Twilio account as
 * twilio.ts's SMS notifier, different "from" sender and a "whatsapp:" prefix
 * on phone numbers; same Messages.json endpoint under the hood).
 *
 * Setup:
 *   1. In the Twilio console, enable a WhatsApp sender — for testing, Twilio
 *      provides a shared sandbox number for free (the recipient has to send
 *      the sandbox's join code once via WhatsApp first); for production,
 *      apply for your own WhatsApp Business sender.
 *   2. Set TWILIO_WHATSAPP_FROM to that sender number, e.g. +14155238886
 *      (do NOT include the "whatsapp:" prefix — it's added automatically).
 *
 * Environment variables:
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN   — shared with twilio.ts
 *   TWILIO_WHATSAPP_FROM                    — your WhatsApp-enabled sender
 *   ALERT_WHATSAPP_TO_NUMBERS               — optional static comma-separated list
 *
 * Recipients normally come from app/subscribe (public registration, approved
 * by the site owner via email) rather than a static env list — see
 * listApprovedByChannel below.
 */

import type { Notifier, NotifyResult } from "./types";
import type { ScoredArticle }          from "../lib/alert-scorer";
import { formatAlert }                 from "./format";
import { listApprovedByChannel }       from "../lib/subscribers";

export class WhatsAppNotifier implements Notifier {
  id   = "whatsapp";
  name = "WhatsApp (Twilio)";

  isConfigured(): boolean {
    return !!(
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_WHATSAPP_FROM
    );
  }

  async send(articles: ScoredArticle[], appUrl: string): Promise<NotifyResult> {
    const sid  = process.env.TWILIO_ACCOUNT_SID!;
    const token = process.env.TWILIO_AUTH_TOKEN!;
    const from = `whatsapp:${process.env.TWILIO_WHATSAPP_FROM!}`;

    const staticNumbers = (process.env.ALERT_WHATSAPP_TO_NUMBERS ?? "")
      .split(",").map(n => n.trim()).filter(Boolean);
    const approved = await listApprovedByChannel("whatsapp").catch(() => []);
    const dynamicNumbers = approved.map(s => s.phone).filter((p): p is string => !!p);
    const toNumbers = Array.from(new Set([...staticNumbers, ...dynamicNumbers]));

    if (toNumbers.length === 0) {
      return {
        channel: this.name,
        success: false,
        recipients: 0,
        error: "No WhatsApp recipients — set ALERT_WHATSAPP_TO_NUMBERS or approve a WhatsApp subscriber via /subscribe",
      };
    }

    const url  = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
    const auth = btoa(`${sid}:${token}`);
    let sent   = 0;
    let lastError = "";

    for (const sa of articles) {
      const { plain } = formatAlert(sa, appUrl);
      const body = plain.slice(0, 1500); // WhatsApp allows much longer bodies than SMS

      for (const to of toNumbers) {
        try {
          const res = await fetch(url, {
            method: "POST",
            headers: {
              "Authorization": `Basic ${auth}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({ To: `whatsapp:${to}`, From: from, Body: body }).toString(),
          });
          const data = await res.json() as { sid?: string; message?: string; code?: number };
          if (res.ok && data.sid) {
            sent++;
            console.log(`[whatsapp] Sent to ${to}: ${data.sid}`);
          } else {
            // Common WhatsApp codes: 63016 (no template / outside 24h window),
            // 63007 (sender not a WhatsApp sender), 21910 (from/to mismatch).
            lastError = `${data.code ?? res.status}: ${data.message ?? "unknown"}`;
            console.error(`[whatsapp] Error to ${to}: ${lastError}`);
          }
        } catch (e) {
          lastError = String(e);
          console.error(`[whatsapp] Fetch error to ${to}:`, e);
        }
      }
    }

    return {
      channel: this.name,
      success: sent > 0,
      recipients: sent,
      error: sent === 0
        ? `0/${toNumbers.length} delivered — last Twilio error: ${lastError || "none"}`
        : undefined,
    };
  }
}
