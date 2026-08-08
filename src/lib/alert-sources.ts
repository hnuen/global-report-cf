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

  // Classify a linked article by the publisher that will actually receive the
  // click. A media story may cite Treasury or OFAC in its source label; that
  // does not turn reuters.com/aljazeera.com into a government source.
  if (/^(?:.*\.)?(?:home\.)?treasury\.gov$/.test(host) || host === "ofac.treasury.gov" || host === "fincen.gov") return "treasury";
  if (host === "dhs.gov" || host.endsWith(".dhs.gov")) return "dhs";
  if (host === "commerce.gov" || host.endsWith(".commerce.gov") || host === "bis.gov" || host.endsWith(".bis.gov") || host === "bis.doc.gov") return "commerce";
  if (host === "state.gov" || host.endsWith(".state.gov") || host === "war.gov" || host.endsWith(".war.gov") || host === "defense.gov" || host.endsWith(".defense.gov") || host.endsWith(".mil")) return "state-defense";
  if (host === "federalreserve.gov" || host.endsWith(".federalreserve.gov") || host === "occ.gov" || host.endsWith(".occ.gov")) return "financial";
  if (host === "whitehouse.gov" || host.endsWith(".whitehouse.gov") || host === "congress.gov" || host.endsWith(".congress.gov") || host === "usa.gov" || host.endsWith(".usa.gov")) return "executive-legislative";

  const usGov = host.endsWith(".gov") || host.endsWith(".mil");
  const internationalGov = host.endsWith(".gov.uk") || host === "gov.uk" || host.endsWith(".europa.eu") || host === "europa.eu" || host.endsWith(".un.org") || host === "un.org";
  return internationalGov || usGov ? "international-government" : "media";
}

export function articlesForSubscriber(
  articles: ScoredArticle[],
  policy: { sections?: string[] | null; sourceGroups?: string[] | null; minAlertScore?: number | null },
): ScoredArticle[] {
  const sections = policy.sections?.length ? new Set(policy.sections) : null;
  // Media is opt-in. Existing subscribers without a saved source selection
  // retain all government groups but no longer inherit every media publisher.
  const defaultSources = ALERT_SOURCE_GROUPS
    .map(group => group.key)
    .filter((key): key is AlertSourceGroup => key !== "media");
  const sources = new Set(policy.sourceGroups?.length ? policy.sourceGroups : defaultSources);
  const minimum = Number.isFinite(policy.minAlertScore) ? Number(policy.minAlertScore) : 0;
  return articles.filter(item =>
    (!sections || sections.has(item.article.section)) &&
    (!sources || sources.has(sourceGroupForArticle(item.article))) &&
    item.score >= minimum
  );
}
