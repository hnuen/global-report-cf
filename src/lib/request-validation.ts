import type { Article, Briefing } from "./types";
import { hasUsableArticleText } from "./text-quality.ts";

const SECTIONS = new Set(["sanctions", "economics", "regions", "occ", "penalties", "bis"]);
const IMPACTS = new Set(["high", "medium", "low"]);

export function validateSearchQuery(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const query = value.trim();
  return query.length > 0 && query.length <= 300 ? query : null;
}

export function validateBriefingPayload(value: unknown): (Briefing & { merge?: boolean }) | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some(key => !["lastUpdated", "lastUpdatedIso", "articles", "sidebar", "merge"].includes(key))) return null;
  if (typeof body.lastUpdated !== "string" || body.lastUpdated.length < 1 || body.lastUpdated.length > 300) return null;
  if (body.lastUpdatedIso !== undefined && (typeof body.lastUpdatedIso !== "string" || body.lastUpdatedIso.length > 40 || Number.isNaN(Date.parse(body.lastUpdatedIso)))) return null;
  if (body.merge !== undefined && typeof body.merge !== "boolean") return null;
  if (!Array.isArray(body.articles) || body.articles.length < 1 || body.articles.length > 1500) return null;
  const articleKeys = new Set(["id", "section", "category", "region", "impact", "date", "headline", "body", "source", "sourceUrl", "aiGenerated", "discoveryMethod"]);
  for (const raw of body.articles) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const article = raw as Record<string, unknown>;
    if (Object.keys(article).some(key => !articleKeys.has(key))) return null;
    if (!Number.isInteger(article.id) || Number(article.id) < 0) return null;
    if (typeof article.section !== "string" || !SECTIONS.has(article.section)) return null;
    if (typeof article.impact !== "string" || !IMPACTS.has(article.impact)) return null;
    for (const [key, max] of [["category", 200], ["region", 200], ["date", 100], ["headline", 500], ["source", 300]] as const) {
      if (typeof article[key] !== "string" || article[key].length > max || (key === "headline" && article[key].length === 0)) return null;
    }
    if (!Array.isArray(article.body) || article.body.length > 12 || !article.body.every(p => typeof p === "string" && p.length <= 5000)) return null;
    if (typeof article.sourceUrl !== "string" || article.sourceUrl.length > 2000) return null;
    if (article.sourceUrl !== "#") {
      try { if (new URL(article.sourceUrl).protocol !== "https:") return null; } catch { return null; }
    }
    if (article.aiGenerated !== undefined && typeof article.aiGenerated !== "boolean") return null;
    if (article.discoveryMethod !== undefined && article.discoveryMethod !== "direct" && article.discoveryMethod !== "ai") return null;
    if (!hasUsableArticleText(article as Pick<Article, "headline" | "body">)) return null;
  }
  if (!body.sidebar || typeof body.sidebar !== "object" || Array.isArray(body.sidebar)) return null;
  if (JSON.stringify(body.sidebar).length > 200_000) return null;
  return {
    lastUpdated: body.lastUpdated,
    ...(body.lastUpdatedIso === undefined ? {} : { lastUpdatedIso: body.lastUpdatedIso }),
    articles: body.articles as Article[],
    sidebar: body.sidebar as Briefing["sidebar"],
    ...(body.merge === undefined ? {} : { merge: body.merge }),
  } as Briefing & { merge?: boolean };
}

export function validateBackgroundRefreshBody(value: unknown): { group: 2 | 3 | 4; section?: string } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (!([2, 3, 4] as const).includes(body.group as 2 | 3 | 4)) return null;
  if (body.section !== undefined && body.section !== "all" && (typeof body.section !== "string" || !SECTIONS.has(body.section))) return null;
  if (Object.keys(body).some(key => !["group", "section"].includes(key))) return null;
  return { group: body.group as 2 | 3 | 4, section: body.section === "all" ? undefined : body.section as string | undefined };
}

const CHANGE_KEYS = ["newGLs", "newEOs", "removedGLs", "removedEOs", "newAdvisories", "removedAdvisories"] as const;

function validChangeItem(value: unknown): boolean {
  if (typeof value === "string") return value.length > 0 && value.length <= 300;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  if (Object.keys(item).some(key => !["number", "title", "url", "note"].includes(key))) return false;
  if (item.number !== undefined && (typeof item.number !== "string" || item.number.length > 80)) return false;
  if (item.title !== undefined && (typeof item.title !== "string" || item.title.length > 300)) return false;
  if (item.note !== undefined && (typeof item.note !== "string" || item.note.length > 500)) return false;
  if (item.url !== undefined && item.url !== null) {
    if (typeof item.url !== "string" || item.url.length > 1000) return false;
    try { if (new URL(item.url).protocol !== "https:") return false; } catch { return false; }
  }
  return typeof item.number === "string" || typeof item.title === "string";
}

export function validateOfacUpdateBody(value: unknown, validProgramIds: ReadonlySet<string>): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  const allowed = new Set(["programId", "checkedAt", ...CHANGE_KEYS]);
  if (Object.keys(body).some(key => !allowed.has(key))) return null;
  if (typeof body.programId !== "string" || !validProgramIds.has(body.programId)) return null;
  if (body.checkedAt !== undefined && (typeof body.checkedAt !== "string" || body.checkedAt.length > 40 || Number.isNaN(Date.parse(body.checkedAt)))) return null;
  for (const key of CHANGE_KEYS) {
    const items = body[key] ?? [];
    if (!Array.isArray(items) || items.length > 50 || !items.every(validChangeItem)) return null;
  }
  return body;
}

