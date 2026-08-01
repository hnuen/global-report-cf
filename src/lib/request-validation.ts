const SECTIONS = new Set(["sanctions", "economics", "regions", "occ", "penalties", "bis"]);

export function validateSearchQuery(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const query = value.trim();
  return query.length > 0 && query.length <= 300 ? query : null;
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

