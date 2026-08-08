import type { Article } from "./types";

const TOPIC_ALIASES: Record<string, string[]> = {
  dhs: ["department of homeland security", "homeland security", "dhs.gov"],
  uflpa: ["uyghur forced labor prevention act", "uflpa entity list", "uflpa"],
  ofac: ["office of foreign assets control", "ofac"],
  bis: ["bureau of industry and security", "bis.gov", "bis"],
};

function termGroupsForTopic(topic: string): string[][] {
  const words = topic.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  return words.map(word => Array.from(new Set([word, ...(TOPIC_ALIASES[word] ?? [])])));
}

/** A focused monitor run must alert only articles relevant to its requested topic. */
export function articleMatchesAlertTopic(article: Article, topic?: string): boolean {
  if (!topic?.trim()) return true;
  const termGroups = termGroupsForTopic(topic);
  if (termGroups.length === 0) return true;
  const haystack = [
    article.headline, ...(article.body ?? []), article.source, article.sourceUrl,
    article.category, article.region,
  ].filter(Boolean).join(" ").toLowerCase();
  return termGroups.every(group => group.some(term => haystack.includes(term)));
}

export function cleanAlertText(value: string): string {
  return value
    .replace(/Federal Reserve\s+[^\x00-\x7F]\S*\s+Press Releases/g, "Federal Reserve — Press Releases")
    .replaceAll("Ã¢â‚¬â€", "—")
    .replaceAll("Ã¢â‚¬Â¢", "•")
    .replaceAll("Ã¢â‚¬Â¦", "…")
    .replaceAll("â€”", "—")
    .replaceAll("â€¢", "•")
    .replaceAll("Â·", "·")
    .replace(/^\s*[•*-]\s*/, "")
    // Strip any remaining mojibake punctuation prefix regardless of how many
    // times an old cached value was incorrectly transcoded.
    .replace(/^[^A-Za-z0-9]+(?=[A-Za-z0-9])/, "")
    .trim();
}

/** Use a stable agency label instead of the crawler's seed URL label. */
export function alertSourceLabel(article: Article): string {
  if (/^https:\/\/home\.treasury\.gov\/news\/press-releases\/[a-z]+\d+/i.test(article.sourceUrl ?? "")) {
    return "U.S. Treasury / News";
  }
  return cleanAlertText(article.source);
}
