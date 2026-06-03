/**
 * Twilio SMS Notifier — paid but reliable fallback
 * Free trial: ~$15 credit (~1000 SMS in US)
 * After trial: ~$0.008/SMS US, ~$0.05/SMS international
 *
 * Environment variables:
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_FROM_NUMBER   — your Twilio number, e.g. +14155551234
 *   ALERT_TO_NUMBERS     — comma-separated recipients, e.g. +14155559999
 */

import type { Notifier, NotifyResult } from "./types";
import type { ScoredArticle }          from "../lib/alert-scorer";
import { formatAlert }                 from "./format";

export class TwilioNotifier implements Notifier {
  id   = "twilio";
  name = "Twilio SMS";

  isConfigured(): boolean {
    return !!(
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM_NUMBER &&
      process.env.ALERT_TO_NUMBERS
    );
  }

  async send(articles: ScoredArticle[], appUrl: string): Promise<NotifyResult> {
    const sid       = process.env.TWILIO_ACCOUNT_SID!;
    const token     = process.env.TWILIO_AUTH_TOKEN!;
    const from      = process.env.TWILIO_FROM_NUMBER!;
    const toNumbers = process.env.ALERT_TO_NUMBERS!
      .split(",").map(n => n.trim()).filter(Boolean);

    const url  = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
    const auth = btoa(`${sid}:${token}`);
    let sent   = 0;

    for (const sa of articles) {
      const { plain } = formatAlert(sa, appUrl);
      const body = plain.slice(0, 320); // 2 SMS segments max

      for (const to of toNumbers) {
        try {
          const res = await fetch(url, {
            method: "POST",
            headers: {
              "Authorization": `Basic ${auth}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
          });
          const data = await res.json() as { sid?: string; message?: string };
          if (res.ok && data.sid) {
            sent++;
            console.log(`[twilio] Sent to ${to}: ${data.sid}`);
          } else {
            console.error(`[twilio] Error to ${to}: ${data.message}`);
          }
        } catch (e) {
          console.error(`[twilio] Fetch error to ${to}:`, e);
        }
      }
    }

    return {
      channel: this.name,
      success: sent > 0,
      recipients: sent,
      error: sent === 0 ? "No Twilio messages delivered" : undefined,
    };
  }
}
