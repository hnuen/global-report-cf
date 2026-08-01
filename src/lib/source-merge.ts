import type { Article, Briefing } from "./types";

function normalizedUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    for (const key of [...parsed.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid)/i.test(key)) parsed.searchParams.delete(key);
    }
    return parsed.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return url.trim().replace(/\/$/, "").toLowerCase();
  }
}

function articleIdentity(article: Article): string {
  if (article.sourceUrl && article.sourceUrl !== "#") return `url:${normalizedUrl(article.sourceUrl)}`;
  return `headline:${article.headline.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}`;
}

/** Direct records are canonical; AI discoveries may only fill gaps. */
export function mergeDirectWithAiSupplement(directBriefing: Briefing, aiBriefing: Briefing): Briefing {
  const direct = directBriefing.articles.map(article => ({
    ...article, aiGenerated: false, discoveryMethod: "direct" as const,
  }));
  const seen = new Set(direct.map(articleIdentity));
  let nextId = direct.reduce((max, article) => Math.max(max, article.id), 0) + 1;
  const supplemental = aiBriefing.articles.flatMap(article => {
    const identity = articleIdentity(article);
    if (seen.has(identity)) return [];
    seen.add(identity);
    return [{ ...article, id: nextId++, aiGenerated: true, discoveryMethod: "ai" as const }];
  });
  return { ...directBriefing, articles: [...direct, ...supplemental] };
}

