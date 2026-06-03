import type { ScoredArticle } from "../lib/alert-scorer";

export interface NotifyResult {
  channel: string;          // "telegram" | "ntfy" | "discord" | "email-sms" | "twilio"
  success: boolean;
  recipients: number;       // how many destinations received it
  error?: string;
}

export interface Notifier {
  id: string;
  name: string;
  isConfigured(): boolean;
  send(articles: ScoredArticle[], appUrl: string): Promise<NotifyResult>;
}
