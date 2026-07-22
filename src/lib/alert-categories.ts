/**
 * Alert categories — the user-facing grouping of the app's internal article
 * sections. Subscribers pick one or more categories at registration; alerts
 * are then filtered so each person only receives the categories they chose.
 *
 * Shared by the subscribe form (client), the subscribe API (validation),
 * the approval email (display), and the notifier dispatch (filtering) — keep
 * this the single source of truth so those four never drift apart.
 *
 * Internal sections (from the briefing pipeline): sanctions, penalties,
 * economics, regions, occ, bis.
 */

export interface AlertCategory {
  key: string;        // stable id stored on the subscriber / sent by the form
  label: string;      // shown in the UI and approval email
  sections: string[]; // internal article.section values this category covers
}

/** Ordered — this is the order the checkboxes render in. */
export const ALERT_CATEGORIES: AlertCategory[] = [
  { key: "sanctions", label: "Sanctions & OFAC/FinCEN Penalties", sections: ["sanctions", "penalties"] },
  { key: "economics", label: "Economics",                          sections: ["economics"] },
  { key: "regions",   label: "Regions",                            sections: ["regions"] },
  { key: "occ",       label: "OCC",                                sections: ["occ"] },
  { key: "bis",       label: "BIS / Export Controls",              sections: ["bis"] },
];

export const ALL_SECTIONS: string[] = ALERT_CATEGORIES.flatMap(c => c.sections);

/** Keep only recognised category keys (drops anything unexpected). */
export function validateCategoryKeys(keys: unknown): string[] {
  if (!Array.isArray(keys)) return [];
  const valid = new Set(ALERT_CATEGORIES.map(c => c.key));
  return Array.from(new Set(keys.filter((k): k is string => typeof k === "string" && valid.has(k))));
}

/** Expand category keys → the internal sections they cover (deduped). */
export function categoriesToSections(keys: string[]): string[] {
  const set = new Set<string>();
  for (const c of ALERT_CATEGORIES) {
    if (keys.includes(c.key)) c.sections.forEach(s => set.add(s));
  }
  return Array.from(set);
}

/**
 * Reverse of categoriesToSections: which category keys are "on" for a given
 * set of internal sections. A category counts as selected if any of its
 * sections is present. Used to pre-fill the admin editor from a saved record.
 */
export function sectionsToCategoryKeys(sections?: string[]): string[] {
  if (!sections || sections.length === 0) return [];
  const set = new Set(sections);
  return ALERT_CATEGORIES.filter(c => c.sections.some(s => set.has(s))).map(c => c.key);
}

/** Human-readable labels for a set of internal sections (for the approval email). */
export function describeSections(sections?: string[]): string {
  if (!sections || sections.length === 0) return "All categories";
  const set = new Set(sections);
  const labels = ALERT_CATEGORIES
    .filter(c => c.sections.some(s => set.has(s)))
    .map(c => c.label);
  return labels.length ? labels.join(", ") : "All categories";
}

/**
 * Filter scored articles to those whose section the recipient subscribed to.
 * A null/undefined/empty `sections` means "all" — used for the site owner's
 * static env-var recipients and for legacy subscribers created before
 * categories existed.
 */
export function articlesForSections<T extends { article: { section?: string } }>(
  scored: T[],
  sections: string[] | null | undefined
): T[] {
  if (!sections || sections.length === 0) return scored;
  const set = new Set(sections);
  return scored.filter(sa => !!sa.article?.section && set.has(sa.article.section));
}

/** A single alert recipient plus the sections they want (null = all). */
export interface SectionRecipient {
  to: string;
  sections: string[] | null;
}

/**
 * Merge static (env-var, always "all") and dynamic (per-subscriber) recipient
 * lists, deduping by destination. If the same destination appears from both,
 * the broader scope wins: any "all" (null) beats a section list, otherwise the
 * section lists are unioned.
 */
export function mergeRecipients(
  staticTos: string[],
  dynamic: { to: string; sections?: string[] }[]
): SectionRecipient[] {
  const byTo = new Map<string, SectionRecipient>();
  const add = (to: string, sections: string[] | null) => {
    if (!to) return;
    const existing = byTo.get(to);
    if (!existing) { byTo.set(to, { to, sections }); return; }
    if (existing.sections === null || sections === null) { byTo.set(to, { to, sections: null }); return; }
    byTo.set(to, { to, sections: Array.from(new Set([...existing.sections, ...sections])) });
  };
  for (const to of staticTos) add(to, null); // env-var recipients → all categories
  for (const d of dynamic) add(d.to, d.sections && d.sections.length ? d.sections : null);
  return Array.from(byTo.values());
}
