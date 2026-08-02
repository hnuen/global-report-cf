import type { ScoredArticle } from "./alert-scorer";

export const ALERT_SOURCE_GROUPS = [
  { key: "treasury", label: "Treasury, OFAC & FinCEN" },
  { key: "dhs", label: "DHS & UFLPA" },
  { key: "commerce", label: "Commerce & BIS" },
  { key: "state-defense", label: "State & Defense" },
  { key: "financial", label: "Federal Reserve & OCC" },
  { key: "executive-legislative", label: "White House, Congress & USA.gov" },
  { key: "international-government", label: "International government sources" },
  { key: "media", label: "Well-known media" },
] as const;

export type AlertSourceGroup = typeof ALERT_SOURCE_GROUPS[number]["key"];

export function validateSourceGroups(value: unknown): AlertSourceGroup[] {
  if (!Array.isArray(value)) return [];
  const valid = new Set<string>(ALERT_SOURCE_GROUPS.map(group => group.key));
  return Array.from(new Set(value.filter((item): item is AlertSourceGroup => typeof item === "string" && valid.has(item))));
}

export function sourceGroupForArticle(article: ScoredArticle["article"]): AlertSourceGroup {
  let host = "";
  try { host = new URL(article.sourceUrl ?? "").hostname.replace(/^www\./, "").toLowerCase(); } catch {}
  const text = `${article.source ?? ""} ${article.sourceUrl ?? ""}`.toLowerCase();
  if (/treasury\.gov|ofac|fincen/.test(text)) return "treasury";
  if (/dhs\.gov|homeland security|uflpa/.test(text)) return "dhs";
  if (/commerce\.gov|bis\.gov|bis\.doc\.gov|bureau of industry/.test(text)) return "commerce";
  if (/state\.gov|war\.gov|defense\.gov|\.mil\b/.test(text)) return "state-defense";
  if (/federalreserve\.gov|occ\.gov|federal reserve|comptroller/.test(text)) return "financial";
  if (/whitehouse\.gov|congress\.gov|usa\.gov/.test(text)) return "executive-legislative";
  const usGov = host.endsWith(".gov") || host.endsWith(".mil");
  const internationalGov = host.endsWith(".gov.uk") || host === "gov.uk" || host.endsWith(".europa.eu") || host === "europa.eu" || host.endsWith(".un.org") || host === "un.org";
  return internationalGov || usGov ? "international-government" : "media";
}

export function articlesForSubscriber(
  articles: ScoredArticle[],
  policy: { sections?: string[] | null; sourceGroups?: string[] | null; minAlertScore?: number | null },
): ScoredArticle[] {
  const sections = policy.sections?.length ? new Set(policy.sections) : null;
  const sources = policy.sourceGroups?.length ? new Set(policy.sourceGroups) : null;
  const minimum = Number.isFinite(policy.minAlertScore) ? Number(policy.minAlertScore) : 0;
  return articles.filter(item =>
    (!sections || sections.has(item.article.section)) &&
    (!sources || sources.has(sourceGroupForArticle(item.article))) &&
    item.score >= minimum
  );
}
