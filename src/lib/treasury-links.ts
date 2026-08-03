export const TREASURY_PRESS_RELEASE_LINK_PATTERN = /<a\b[^>]*\bhref\s*=\s*(["'])(\/news\/press-releases\/sb\d+|https:\/\/home\.treasury\.gov\/news\/press-releases\/sb\d+)\1[^>]*>([\s\S]*?)<\/a>/gi;

export function treasuryPressReleasePattern(): RegExp {
  return new RegExp(TREASURY_PRESS_RELEASE_LINK_PATTERN.source, TREASURY_PRESS_RELEASE_LINK_PATTERN.flags);
}

export function normalizeTreasuryPressReleaseUrl(href: string): string {
  return new URL(href, "https://home.treasury.gov").href;
}
