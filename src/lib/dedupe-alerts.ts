/**
 * Preserve the first (highest-ranked) item for each canonical notification key.
 * Empty keys are retained because the caller may apply a later validation rule.
 */
export function dedupeByCanonicalKey<T>(
  items: readonly T[],
  keyFor: (item: T) => string,
): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const item of items) {
    const key = keyFor(item).trim().toLowerCase();
    if (!key) {
      unique.push(item);
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  return unique;
}
