import type { ScoredArticle } from "../lib/alert-scorer";

export interface NotifyResult {
  channel: string;          // "telegram" | "ntfy" | "discord" | "email-sms" | "twilio"
  success: boolean;
  recipients: number;       // how many destinations received it
  error?: string;
  deliveries?: { recipient: string; alertKeys: string[] }[];
}

export interface NotifyOptions {
  defaultMinScore: number;
  maxAlertsPerRun: number;
  shouldSend?: (notifierId: string, recipient: string, alertKey: string) => boolean;
}

export interface Notifier {
  id: string;
  name: string;
  isConfigured(): boolean;
  send(articles: ScoredArticle[], appUrl: string, options?: NotifyOptions): Promise<NotifyResult>;
}
