import type { OfficialSource } from "./official-sources";

const CACHE_KEY = "news:publisher-links:v1";
const CACHE_TTL_SECONDS = 14 * 24 * 60 * 60;
const MAX_CACHE_ENTRIES = 300;
export const MAX_LINK_RESOLUTIONS_PER_BATCH = 5;

export type PublisherLinkCache = Record<string, { url: string; resolvedAt: string }>;

function configuredRedis(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

export function publisherDomainsForSource(sourceName: string): string[] {
  if (sourceName.startsWith("AP News ")) return ["apnews.com"];
  if (sourceName.startsWith("CNN ")) return ["cnn.com"];
  return [];
}

function isAllowedPublisherUrl(value: string, domains: string[]): boolean {
  try {
    const parsed = new URL(value.replace(/&amp;/g, "&"));
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    return domains.some(domain => host === domain || host.endsWith(`.${domain}`)) && parsed.pathname.length > 1;
  } catch {
    return false;
  }
}

/** Extract a publisher URL before the RSS description HTML is stripped. */
export function extractPublisherUrl(descriptionHtml: string, domains = ["apnews.com", "cnn.com"]): string | null {
  const decoded = descriptionHtml
    .replace(/&amp;/g, "&")
    .replace(/&#38;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  const candidates = decoded.match(/https?:\/\/[^\s"'<>]+/gi) ?? [];
  return candidates.find(url => isAllowedPublisherUrl(url, domains)) ?? null;
}

/** Resolve only ordinary HTTP redirects; never decode Google's private URL format. */
export async function resolveGoogleNewsPublisherUrl(
  googleUrl: string,
  domains: string[],
  fetcher: typeof fetch = fetch,
): Promise<string | null> {
  let current = googleUrl.replace(/&amp;/g, "&");
  for (let hop = 0; hop < 3; hop++) {
    if (isAllowedPublisherUrl(current, domains)) return current;
    let response: Response;
    try {
      response = await fetcher(current, {
        redirect: "manual",
        headers: { "User-Agent": "Mozilla/5.0 (compatible; GlobalReport/1.0)" },
        signal: AbortSignal.timeout(2500),
      });
    } catch {
      return null;
    }
    const responseUrl = response.url;
    const location = response.headers.get("location");
    if (response.body) await response.body.cancel().catch(() => undefined);
    if (responseUrl && isAllowedPublisherUrl(responseUrl, domains)) return responseUrl;
    if (!location) return null;
    try {
      current = new URL(location, current).toString();
    } catch {
      return null;
    }
  }
  return isAllowedPublisherUrl(current, domains) ? current : null;
}

export async function loadPublisherLinkCache(): Promise<PublisherLinkCache> {
  const cfg = configuredRedis();
  if (!cfg) return {};
  try {
    const response = await fetch(`${cfg.url}/get/${encodeURIComponent(CACHE_KEY)}`, {
      headers: { Authorization: `Bearer ${cfg.token}` },
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) return {};
    const raw = (await response.json() as { result?: string | null }).result;
    return raw ? JSON.parse(raw) as PublisherLinkCache : {};
  } catch {
    return {};
  }
}

export async function savePublisherLinkCache(cache: PublisherLinkCache): Promise<void> {
  const cfg = configuredRedis();
  if (!cfg) return;
  const trimmed = Object.fromEntries(
    Object.entries(cache)
      .sort((a, b) => b[1].resolvedAt.localeCompare(a[1].resolvedAt))
      .slice(0, MAX_CACHE_ENTRIES),
  );
  try {
    await fetch(`${cfg.url}/set/${encodeURIComponent(CACHE_KEY)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ value: JSON.stringify(trimmed), ex: CACHE_TTL_SECONDS }),
      signal: AbortSignal.timeout(2500),
    });
  } catch {
    // Resolution is an optional media enhancement; cache failure is non-fatal.
  }
}

/** Resolve at most five new links across the whole Worker invocation. */
export async function resolveMediaSourceLinks(
  sources: OfficialSource[],
  cache: PublisherLinkCache,
  budget = MAX_LINK_RESOLUTIONS_PER_BATCH,
): Promise<{ sources: OfficialSource[]; changed: boolean; resolved: number }> {
  let remaining = Math.max(0, budget);
  let changed = false;
  let resolved = 0;
  const output: OfficialSource[] = [];

  for (const source of sources) {
    const domains = publisherDomainsForSource(source.name);
    if (!domains.length || !source.content) {
      output.push(source);
      continue;
    }
    const lines: string[] = [];
    for (const line of source.content.split("\n")) {
      const parts = line.split(" ||| ");
      const candidate = parts[1]?.trim().replace(/&amp;/g, "&") ?? "";
      if (!candidate.includes("news.google.com/")) {
        lines.push(line);
        continue;
      }
      let direct = cache[candidate]?.url;
      if (direct && !isAllowedPublisherUrl(direct, domains)) direct = undefined;
      if (!direct && remaining > 0) {
        remaining--;
        direct = await resolveGoogleNewsPublisherUrl(candidate, domains) ?? undefined;
        if (direct) {
          cache[candidate] = { url: direct, resolvedAt: new Date().toISOString() };
          changed = true;
        }
      }
      if (direct) {
        parts[1] = direct;
        resolved++;
        lines.push(parts.join(" ||| "));
      }
      // Unresolved aggregator links are intentionally omitted. They would be
      // removed by the direct-link gate later and must never reach alerts.
    }
    output.push({ ...source, content: lines.join("\n") });
  }
  return { sources: output, changed, resolved };
}
