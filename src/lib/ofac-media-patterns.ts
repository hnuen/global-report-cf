/**
 * OFAC Media URL Pattern Reference
 * Source: Verified from official OFAC document (May 2026)
 *
 * All OFAC documents follow this URL format:
 *   https://ofac.treasury.gov/media/{ID}/download?inline
 *
 * Media ID ranges by approximate issuance year:
 *   4000–9000    →  pre-2010  (old EOs, old GLs, early advisories)
 *   9000–15000   →  2010–2018
 *   15000–35000  →  2018–2020
 *   35000–55000  →  2020 (early)
 *   55000–100000 →  2020–2021 (mid)
 *   900000–912000 → 2021 (early, e.g. Afghanistan GLs 14-20)
 *   912000–920000 → 2021 (late)
 *   920000–925000 → 2022
 *   925000–932000 → 2022–2023
 *   932000–934000 → 2023–2024
 *   934000–935000 → 2024–2025
 *   935000–936000 → 2025–2026 (current)
 *
 * Key observations:
 * - IDs are NOT sequential by EO/GL number — assigned by CMS upload order
 * - Cannot predict exact ID — must use verified sources
 * - Recent documents (2024-2026) have IDs in 934000-936000 range
 * - Treasury press releases (sb####) are at:
 *     https://home.treasury.gov/news/press-releases/sb{NUMBER}
 *   These DO increase sequentially (sb0486, sb0487, ...)
 *
 * For news fetching: use sb#### URLs which are predictable and fetchable
 * For program data: always verify media IDs from official OFAC page or document
 */

export const OFAC_MEDIA_BASE = "https://ofac.treasury.gov/media";

export function ofacMediaUrl(mediaId: number): string {
  return `${OFAC_MEDIA_BASE}/${mediaId}/download?inline`;
}

/**
 * Estimate if a media ID is likely recent (2024+)
 * Useful for filtering fresh content in news fetching
 */
export function isRecentMediaId(mediaId: number): boolean {
  return mediaId >= 933000;
}
