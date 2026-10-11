import { alertStateDeleteIfValue, alertStateSet } from "./alert-state.ts";

export async function acquireDistributedLock(key: string, ttlSeconds: number): Promise<{ release: () => Promise<void> } | null> {
  const owner = crypto.randomUUID();
  const acquired = await alertStateSet(`lock:${key}`, owner, { nx: true, ex: ttlSeconds });
  if (!acquired) return null;
  return {
    release: async () => alertStateDeleteIfValue(`lock:${key}`, owner),
  };
}
