/**
 * Email-to-SMS Notifier
 * Sends alerts via Gmail SMTP to carrier email gateway addresses.
 *
 * Carrier gateways:
 *   AT&T:      number@txt.att.net
 *   T-Mobile:  number@tmomail.net
 *   Verizon:   number@vtext.com
 *   UK Vodafone: number@vodafone.net
 *   SG Singtel:  number@smsmail.singtel.com
 *
 * Env vars:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
 *   EMAIL_FROM, EMAIL_SMS_RECIPIENTS
 */

import type { Notifier, NotifyResult } from "./types";
import type { ScoredArticle } from "../lib/alert-scorer";
import { formatAlert } from "./format";

export class EmailSMSNotifier implements Notifier {
  id   = "email-sms";
  name = "Email-to-SMS";

  isConfigured(): boolean {
    return !!(
      process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      process.env.EMAIL_SMS_RECIPIENTS
    );
  }

  async send(articles: ScoredArticle[], appUrl: string): Promise<NotifyResult> {
    const host       = process.env.SMTP_HOST!;
    const port       = Number(process.env.SMTP_PORT ?? 587);
    const user       = process.env.SMTP_USER!;
    const pass       = process.env.SMTP_PASS!;
    const from       = process.env.EMAIL_FROM ?? user;
    const recipients = process.env.EMAIL_SMS_RECIPIENTS!
      .split(",").map(s => s.trim()).filter(Boolean);

    // nodemailer not supported in Cloudflare edge runtime
    let nodemailer: any = null;
    try {
      nodemailer = await import("nodemailer");
    } catch {
      return {
        channel: this.name, success: false, recipients: 0,
        error: "nodemailer not installed. Run: npm install nodemailer",
      };
    }

    const transporter = nodemailer.default.createTransport({
      host, port, secure: port === 465,
      auth: { user, pass },
    });

    let sent = 0;
    const errors: string[] = [];

    for (const sa of articles) {
      const { subject, plain } = formatAlert(sa, appUrl);
      const body = plain.slice(0, 300);

      for (const to of recipients) {
        try {
          await transporter.sendMail({ from, to, subject, text: body });
          sent++;
          console.log(`[email-sms] Sent to ${to}`);
        } catch (e) {
          const msg = String(e);
          console.error(`[email-sms] Failed to ${to}: ${msg}`);
          errors.push(msg);
        }
      }
    }

    return {
      channel: this.name,
      success: sent > 0,
      recipients: sent,
      error: errors.length > 0 ? errors[0] : undefined,
    };
  }
}
