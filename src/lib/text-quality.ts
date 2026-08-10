/** Repair common UTF-8-as-Windows-1252 artifacts without damaging valid Unicode. */
export function repairMojibake(value: string): string {
  if (!value) return value;
  const replacements: Array<[string, string]> = [
    ["Ã¢â‚¬â€", "—"], ["Ã¢â‚¬â€œ", "–"], ["Ã¢â‚¬Â¢", "•"],
    ["Ã¢â‚¬Â¦", "…"], ["â€”", "—"], ["â€“", "–"], ["â€¢", "•"],
    ["â€¦", "…"], ["Â·", "·"], ["Â ", " "],
  ];
  let repaired = value;
  for (let pass = 0; pass < 2; pass++) {
    const before = repaired;
    for (const [bad, good] of replacements) repaired = repaired.split(bad).join(good);
    if (repaired === before) break;
  }
  return repaired;
}

/** Reject decoded binary/compressed payloads and severely damaged Unicode. */
export function isLikelyCorruptedText(value: string): boolean {
  if (!value) return false;
  const replacementCount = (value.match(/\uFFFD/g) ?? []).length;
  const controlCount = (value.match(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g) ?? []).length;
  return replacementCount >= 2 || replacementCount / value.length > 0.005 || controlCount / value.length > 0.01;
}

/** Block navigation copy, database descriptions, and scraped sentence fragments. */
export function isLikelyHeadlineFragment(value?: string): boolean {
  const headline = repairMojibake(value ?? "").replace(/^\s*[•*\-–—]+\s*/, "").trim();
  if (headline.length < 12 || headline.length > 240) return true;
  return /^(?:click here|for more information|learn more|read more|see source link|published by|amounts? mentioned|formal enforcement actions? (?:are|is)|this page (?:contains|provides)|the following (?:is|are)|[A-Z][A-Za-z'’-]+,\s+[A-Z][A-Za-z'’-]+,\s+and\s+[A-Z][A-Za-z'’-]+\s+are being designated\b)/i.test(headline);
}

export function hasUsableArticleText(article: { headline?: string; body?: string[] }): boolean {
  return !isLikelyCorruptedText(`${article.headline ?? ""} ${(article.body ?? []).join(" ")}`);
}

const GENERIC_NEWS_PATHS = new Set([
  "home.treasury.gov/news",
  "home.treasury.gov/news/press-releases",
  "ofac.treasury.gov/recent-actions",
  "fincen.gov/news",
  "fincen.gov/news/news-releases",
  "fincen.gov/news/press-releases",
  "gov.uk/government/news",
  "gov.uk/government/publications/the-uk-sanctions-list",
  "federalreserve.gov/supervisionreg/enforcement-actions-about.htm",
  "federalreserve.gov/supervisionreg/enforcement-actions.htm",
]);

/** Require a specific article, notice, action, or document URL for the news feed. */
export function hasDirectArticleUrl(url?: string): boolean {
  if (!url || url === "#") return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    const path = parsed.pathname.replace(/\/+$/, "").toLowerCase();
    const key = host + path;
    if (GENERIC_NEWS_PATHS.has(key)) return false;
    if (/occ\.gov\/news-events\/newsroom\/news-issuances-by-year\/news-releases\/\d{4}-news-releases\.html$/.test(key)) return false;
    if (host === "news.google.com") return /^\/(?:rss\/)?articles\//.test(path);
    if (/\/(?:rss|feed|feeds)(?:\/|$)/.test(path) || path.endsWith(".xml")) return false;
    if (/\/(?:search)(?:\/|$)/.test(path)) return false;
    return path.length > 1;
  } catch {
    return false;
  }
}

export function isDisplayableNewsArticle(article: { headline?: string; body?: string[]; sourceUrl?: string }): boolean {
  return hasUsableArticleText(article) &&
    !isLikelyHeadlineFragment(article.headline) &&
    hasDirectArticleUrl(article.sourceUrl);
}
