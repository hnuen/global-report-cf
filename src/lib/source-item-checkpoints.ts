const CHECKPOINT_KEY = "source:item-checkpoints:v1";
const CHECKPOINT_TTL = 30 * 24 * 3600;

export interface SourceItemCheckpoint {
  newest: string;
  recent: string[];
  updatedAt: string;
}

export type SourceItemCheckpointStore = Record<string, SourceItemCheckpoint>;

function upstashUrl() { return process.env.UPSTASH_REDIS_REST_URL ?? ""; }
function upstashToken() { return process.env.UPSTASH_REDIS_REST_TOKEN ?? ""; }

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
  const url = upstashUrl(), token = upstashToken();
  if (!url || !token) return {};
  try {
    const response = await fetch(`${url}/get/${encodeURIComponent(CHECKPOINT_KEY)}`, {
      headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return {};
    const raw = (await response.json() as { result?: string | null }).result;
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

export async function commitSourceItemCheckpoints(updates: Array<{ url: string; itemKeys: string[] }>): Promise<void> {
  if (updates.length === 0) return;
  const url = upstashUrl(), token = upstashToken();
  if (!url || !token) return;
  const store = await loadSourceItemCheckpoints();
  const updatedAt = new Date().toISOString();
  for (const update of updates) {
    if (!update.itemKeys.length) continue;
    store[sourceCheckpointKey(update.url)] = { newest: update.itemKeys[0], recent: update.itemKeys.slice(0, 12), updatedAt };
  }
  try {
    await fetch(`${url}/set/${encodeURIComponent(CHECKPOINT_KEY)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ value: JSON.stringify(store), ex: CHECKPOINT_TTL }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Optimization only: reprocessing is safer than losing a notice.
  }
}
