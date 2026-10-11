import { alertStateIncrement } from "./alert-state.ts";

export async function checkRateLimit(
  key: string,
  max: number,
  windowSeconds: number,
  options: { failClosed?: boolean } = {},
): Promise<boolean> {
  try {
    const count = await alertStateIncrement(key, windowSeconds);
    return count <= max;
  } catch (error) {
    console.warn(`[rate-limit] check failed (${options.failClosed ? "failing closed" : "failing open"}):`, String(error).slice(0, 100));
    return !options.failClosed;
  }
}

/** Cloudflare overwrites this header at the trusted edge; ignore spoofable forwarded headers. */
export function getClientIp(req: Request): string {
  return req.headers.get("cf-connecting-ip") ?? "unknown";
}
