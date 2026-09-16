const SECTIONS = new Set(["sanctions", "economics", "regions", "occ", "penalties", "bis"]);
const IMPACTS = new Set(["high", "medium", "low"]);

function cleanString(value, max, fallback = "") {
  const text = typeof value === "string" ? value : fallback;
  return text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ").trim().slice(0, max);
}

export function normalizeBriefingPayload(input) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const articles = [];
  const dropped = [];
  for (const raw of Array.isArray(source.articles) ? source.articles.slice(0, 1500) : []) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) { dropped.push("non-object article"); continue; }
    const section = cleanString(raw.section, 20).toLowerCase();
    const headline = cleanString(raw.headline, 500);
    const sourceUrl = cleanString(raw.sourceUrl, 2000);
    let parsedUrl;
    try { parsedUrl = new URL(sourceUrl); } catch { parsedUrl = null; }
    if (!SECTIONS.has(section) || !headline || !parsedUrl || parsedUrl.protocol !== "https:") {
      dropped.push(headline || sourceUrl || "invalid article");
      continue;
    }
    const body = (Array.isArray(raw.body) ? raw.body : [raw.body])
      .filter(part => typeof part === "string")
      .slice(0, 12)
      .map(part => cleanString(part, 5000));
    const impact = cleanString(raw.impact, 20).toLowerCase();
    const article = {
      id: articles.length + 1,
      section,
      category: cleanString(raw.category, 200),
      region: cleanString(raw.region, 200),
      impact: IMPACTS.has(impact) ? impact : "medium",
      date: cleanString(raw.date, 100),
      headline,
      body,
      source: cleanString(raw.source, 300),
      sourceUrl: parsedUrl.href,
    };
    if (typeof raw.aiGenerated === "boolean") article.aiGenerated = raw.aiGenerated;
    if (raw.discoveryMethod === "direct" || raw.discoveryMethod === "ai") article.discoveryMethod = raw.discoveryMethod;
    articles.push(article);
  }
  const lastUpdated = cleanString(source.lastUpdated, 300, new Date().toISOString()) || new Date().toISOString();
  const iso = typeof source.lastUpdatedIso === "string" && source.lastUpdatedIso.length <= 40 && !Number.isNaN(Date.parse(source.lastUpdatedIso))
    ? source.lastUpdatedIso : undefined;
  const sidebar = source.sidebar && typeof source.sidebar === "object" && !Array.isArray(source.sidebar) && JSON.stringify(source.sidebar).length <= 200_000
    ? source.sidebar : {};
  return { payload: { lastUpdated, ...(iso ? { lastUpdatedIso: iso } : {}), articles, sidebar }, dropped };
}
