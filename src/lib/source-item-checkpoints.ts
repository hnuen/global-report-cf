const CHECKPOINT_KEY = "source:item-checkpoints:v1";
const CHECKPOINT_TTL = 30 * 24 * 3600;
import { alertStateGet, alertStateSet } from "./alert-state.ts";

export interface SourceItemCheckpoint {
  newest: string;
  recent: string[];
  updatedAt: string;
}

export type SourceItemCheckpointStore = Record<string, SourceItemCheckpoint>;

export function sourceCheckpointKey(url: string): string {
  let hash = 0;
  for (let i = 0; i < url.length; i++) hash = ((hash << 5) - hash + url.charCodeAt(i)) | 0;
  return Math.abs(hash).toString(36);
}

export function itemCheckpointKey(line: string): string {
  const canonical = line.replace(/\s+/g, " ").replace(/\s*\|\|\|\s*DATE:[^|]+/i, "").trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < canonical.length; i++) hash = ((hash << 5) - hash + canonical.charCodeAt(i)) | 0;
  return Math.abs(hash).toString(36);
}

export async function loadSourceItemCheckpoints(): Promise<SourceItemCheckpointStore> {
  try {
    const raw = await alertStateGet(CHECKPOINT_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

export async function commitSourceItemCheckpoints(updates: Array<{ url: string; itemKeys: string[] }>): Promise<void> {
  if (updates.length === 0) return;
  const store = await loadSourceItemCheckpoints();
  const updatedAt = new Date().toISOString();
  for (const update of updates) {
    if (!update.itemKeys.length) continue;
    store[sourceCheckpointKey(update.url)] = { newest: update.itemKeys[0], recent: update.itemKeys.slice(0, 12), updatedAt };
  }
  try {
    await alertStateSet(CHECKPOINT_KEY, JSON.stringify(store), { ex: CHECKPOINT_TTL });
  } catch {
    // Optimization only: reprocessing is safer than losing a notice.
  }
}
