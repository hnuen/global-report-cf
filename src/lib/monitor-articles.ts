import type { Article } from "./types";

function articleKey(article: Article): string {
  const url = article.sourceUrl?.trim().toLowerCase().replace(/\/+$/, "");
  if (url && url !== "#") return `url:${url}`;
  return `headline:${article.headline.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 120)}`;
}

/**
 * The web feed includes both the current briefing and the persistent article
 * library. Monitoring must inspect that same union or an article can be
 * visible to users without ever becoming alert-eligible.
 *
 * Current briefing records win duplicates because direct-source refreshes
 * deliberately replace AI summaries with canonical records.
 */
export function mergeMonitorArticles(
  briefingArticles: Article[],
  libraryArticles: Article[],
): Article[] {
  const merged = new Map<string, Article>();
  for (const article of briefingArticles) merged.set(articleKey(article), article);
  for (const article of libraryArticles) {
    const key = articleKey(article);
    if (!merged.has(key)) merged.set(key, article);
  }
  return [...merged.values()];
}
