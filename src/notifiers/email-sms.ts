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

export class EmailSMSNotifier implements Notifier {
  id   = "email-sms";
  name = "Email-to-SMS";

  isConfigured(): boolean {
    // Cloudflare Workers cannot establish the raw SMTP socket Nodemailer
    // requires. Keep this legacy channel inert instead of shipping a
    // vulnerable dependency that can never deliver in production.
    return false;
  }

  async send(_articles: ScoredArticle[], _appUrl: string): Promise<NotifyResult> {
    return {
      channel: this.name,
      success: false,
      recipients: 0,
      error: "Email-to-SMS is unavailable on Cloudflare; use Telegram or ntfy",
    };
  }
}

