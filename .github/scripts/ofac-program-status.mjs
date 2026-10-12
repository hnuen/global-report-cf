/**
 * Convert OFAC's program-index wording into a durable application status.
 * Explicit inactive/archive wording always wins; PAARSS is intentionally
 * residual because it remains an active, narrower Syria-related program.
 */
export function classifyOfacProgramStatus(rowText = "") {
  const text = String(rowText).replace(/\s+/g, " ").trim();
  if (/\binactive\b|\barchived\b/i.test(text)) {
    return { status: "inactive", statusLabel: "Inactive and Archived" };
  }
  if (/\bresidual\b|\bPAARSS\b/i.test(text)) {
    return { status: "residual", statusLabel: "Residual" };
  }
  return { status: "active", statusLabel: "Active" };
}

export function reconcileRemovedOfacPrograms(programs, indexedPrograms, inactiveDate) {
  if (!Array.isArray(indexedPrograms) || indexedPrograms.length < 20) return [];
  const indexedSlugs = new Set(indexedPrograms.map((program) => program.slug));
  const deactivated = [];
  for (const [slug, cached] of Object.entries(programs || {})) {
    if (indexedSlugs.has(slug) || !cached || typeof cached !== "object") continue;
    if (!cached.name || !cached.url) continue;
    programs[slug] = {
      ...cached,
      status: "inactive",
      statusLabel: "Inactive and Archived",
      inactiveDate: cached.inactiveDate || inactiveDate,
      statusReason: "OFAC no longer lists this program in its Active Sanctions Programs index.",
      statusSourceUrl: "https://ofac.treasury.gov/sanctions-programs-and-country-information",
    };
    deactivated.push(slug);
  }
  return deactivated;
}

