export interface AlertSettings {
  threshold: number;
  maxAgeHours: number | null;
  maxAlertsPerRun: number;
}

export const DEFAULT_ALERT_SETTINGS: AlertSettings = {
  threshold: 65,
  maxAgeHours: null,
  maxAlertsPerRun: 5,
};

const STORAGE_KEY = "admin:alert-settings";
import { alertStateGet, alertStateSet } from "./alert-state.ts";

export function validateAlertSettings(value: unknown): AlertSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Settings must be an object");
  }
  const input = value as Record<string, unknown>;
  const threshold = Number(input.threshold);
  const maxAlertsPerRun = Number(input.maxAlertsPerRun);
  const maxAgeHours = input.maxAgeHours === null ? null : Number(input.maxAgeHours);

  if (!Number.isInteger(threshold) || threshold < 0 || threshold > 100) {
    throw new Error("Alert threshold must be a whole number from 0 to 100");
  }
  if (!Number.isInteger(maxAlertsPerRun) || maxAlertsPerRun < 1 || maxAlertsPerRun > 10) {
    throw new Error("Maximum alerts per run must be a whole number from 1 to 10");
  }
  if (maxAgeHours !== null && (!Number.isInteger(maxAgeHours) || maxAgeHours < 1 || maxAgeHours > 168)) {
    throw new Error("Age window must be Today only or a whole number from 1 to 168 hours");
  }
  return { threshold, maxAgeHours, maxAlertsPerRun };
}

export async function loadAlertSettings(): Promise<AlertSettings> {
  try {
    const stored = await alertStateGet(STORAGE_KEY);
    return stored ? validateAlertSettings(JSON.parse(stored)) : DEFAULT_ALERT_SETTINGS;
  } catch (error) {
    console.error("[alert-settings] Could not load settings; using safe defaults", error);
    return DEFAULT_ALERT_SETTINGS;
  }
}

export async function saveAlertSettings(value: unknown): Promise<AlertSettings> {
  const settings = validateAlertSettings(value);
  await alertStateSet(STORAGE_KEY, JSON.stringify(settings));
  return settings;
}
