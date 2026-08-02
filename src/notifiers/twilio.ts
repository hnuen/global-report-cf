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
import { listApprovedByChannel }       from "../lib/subscribers";
import { mergeRecipients } from "../lib/alert-categories";
import { articlesForSubscriber } from "../lib/alert-sources";

export class TwilioNotifier implements Notifier {
  id   = "twilio";
  name = "Twilio SMS";

  isConfigured(): boolean {
    // ALERT_TO_NUMBERS is no longer required by itself — the public
    // /subscribe flow can supply approved numbers dynamically (see
    // listApprovedByChannel below). Twilio account creds are still required
    // either way, since that's what actually sends the text.
    return !!(
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM_NUMBER
    );
  }

  async send(articles: ScoredArticle[], appUrl: string, options = { defaultMinScore: 65, maxAlertsPerRun: 5 }): Promise<NotifyResult> {
    const sid       = process.env.TWILIO_ACCOUNT_SID!;
    const token     = process.env.TWILIO_AUTH_TOKEN!;
    const from      = process.env.TWILIO_FROM_NUMBER!;
    const staticNumbers = (process.env.ALERT_TO_NUMBERS ?? "")
      .split(",").map(n => n.trim()).filter(Boolean);
    const approved = await listApprovedByChannel("sms").catch(() => []);
    const dynamic = approved
      .filter(s => !!s.phone)
      .map(s => ({ to: s.phone as string, sections: s.sections, sourceGroups: s.sourceGroups, minAlertScore: s.minAlertScore }));
    // Each recipient carries the sections they subscribed to (env-var numbers
    // get everything). Below, each is sent only articles in their categories.
    const recipients = mergeRecipients(staticNumbers, dynamic, options.defaultMinScore);

    // No point calling Twilio if there's nobody to text — surface that
    // explicitly instead of the ambiguous "No messages delivered".
    if (recipients.length === 0) {
      return {
        channel: this.name,
        success: false,
        recipients: 0,
        error: "No SMS recipients — set ALERT_TO_NUMBERS or approve an SMS subscriber via /subscribe",
      };
    }

    const url  = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
    const auth = btoa(`${sid}:${token}`);
    let sent   = 0;
    let lastError = "";

    for (const recipient of recipients) {
      const mine = articlesForSubscriber(articles, recipient).slice(0, options.maxAlertsPerRun);
      if (mine.length === 0) continue; // nothing in this recipient's categories
      const to = recipient.to;

      for (const sa of mine) {
        const { plain } = formatAlert(sa, appUrl);
        const body = plain.slice(0, 320); // 2 SMS segments max
        try {
          const res = await fetch(url, {
            method: "POST",
            headers: {
              "Authorization": `Basic ${auth}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
          });
          const data = await res.json() as { sid?: string; message?: string; code?: number };
          if (res.ok && data.sid) {
            sent++;
            console.log(`[twilio] Sent to ${to}: ${data.sid}`);
          } else {
            // Twilio returns a numeric error code + human message — keep both
            // (e.g. 21608 = number unverified on trial, 21211 = invalid To).
            lastError = `${data.code ?? res.status}: ${data.message ?? "unknown"}`;
            console.error(`[twilio] Error to ${to}: ${lastError}`);
          }
        } catch (e) {
          lastError = String(e);
          console.error(`[twilio] Fetch error to ${to}:`, e);
        }
      }
    }

    return {
      channel: this.name,
      success: sent > 0,
      recipients: sent,
      error: sent === 0
        ? `0 delivered — last Twilio error: ${lastError || "no articles matched any recipient's categories"}`
        : undefined,
    };
  }
}
