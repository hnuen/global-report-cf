export const dynamic = "force-dynamic";
/**
 * /api/ofac-program?id=iran
 * Diffs the curated library snapshot against the latest GitHub Actions scrape
 * (data/ofac-cache.json, committed ~15x/day by refresh-briefing.mjs) and
 * returns what's new or removed.
 *
 * Previously this fetched ofac.treasury.gov directly from the CF Workers
 * runtime — but OFAC blocks/black-holes requests from Cloudflare's edge IPs
 * (the same constraint documented in ofac-github-cache.ts and
 * penalties-fetcher.ts), so the live fetch would hang or fail outright and
 * this "Check for Updates" feature never actually worked. Reading the
 * already-scraped, already-committed cache via raw.githubusercontent.com
 * (same source the /api/penalties route uses) avoids that entirely, and as
 * a bonus carries real title/date/url for each entry instead of the bare
 * EO/GL numbers the old regex-over-raw-HTML approach extracted.
 */
import { NextRequest, NextResponse } from "next/server";
import { fetchOfacCache } from "@/src/lib/ofac-github-cache";

// ── Program URL map ────────────────────────────────────────────────────────
const PROGRAMS: Record<string, { name: string; url: string }> = {
  "afghanistan":     { name: "Afghanistan-Related Sanctions",        url: "https://ofac.treasury.gov/sanctions-programs-and-country-information/afghanistan-related-sanctions" },
  "balkans":         { name: "Balkans-Related Sanctions",            url: "https://ofac.treasury.gov/sanctions-programs-and-country-information/balkans-related-sanctions" },
  "belarus":         { name: "Belarus Sanctions",                    url: "https://ofac.treasury.gov/sanctions-programs-and-country-information/belarus-sanctions" },
  "burma":           { name: "Burma Sanctions",                      url: "https://ofac.treasury.gov/sanctions-programs-and-country-information/burma" },
  "car":             { name: "Central African Republic Sanctions",   url: "https://ofac.treasury.gov/sanctions-programs-and-country-information/central-african-republic-sanctions" },
  "cuba":            { name: "Cuba Sanctions",                       url: "https://ofac.treasury.gov/sanctions-programs-and-country-information/cuba-sanctions" },
  "drc":             { name: "DRC Sanctions",                        url: "https://ofac.treasury.gov/sanctions-programs-and-country-information/democratic-republic-of-the-congo-related-sanctions" },
  "ethiopia":        { name: "Ethiopia Sanctions",                   url: "https://ofac.treasury.gov/sanctions-programs-and-country-information/ethiopia" },
  "hong-kong":       { name: "Hong Kong Sanctions",                  url: "https://ofac.treasury.gov/sanctions-programs-and-country-information/hong-kong-related-sanctions" },
  "iran":            { name: "Iran Sanctions",                       url: "https://ofac.treasury.gov/sanctions-programs-and-country-information/iran-sanctions" },
  "iraq":            { name: "Iraq Sanctions",                       url: "https://ofac.treasury.gov/sanctions-programs-and-country-information/iraq-related-sanctions" },
  "lebanon":         { name: "Lebanon Sanctions",                    url: "https://ofac.treasury.gov/sanctions-programs-and-country-information/lebanon-related-sanctions" },
  "libya":           { name: "Libya Sanctions",                      url: "https://ofac.treasury.gov/sanctions-programs-and-country-information/libya-sanctions" },
  "mali":            { name: "Mali Sanctions",                       url: "https://ofac.treasury.gov/sanctions-programs-and-country-information/mali-related-sanctions" },
  "nicaragua":       { name: "Nicaragua Sanctions",                  url: "https://ofac.treasury.gov/sanctions-programs-and-country-information/nicaragua-related-sanctions" },
  "dprk":            { name: "North Korea Sanctions",                url: "https://ofac.treasury.gov/sanctions-programs-and-country-information/north-korea-sanctions" },
  "russia-hfa":      { name: "Russian Harmful Foreign Activities",   url: "https://ofac.treasury.gov/sanctions-programs-and-country-information/russian-harmful-foreign-activities-sanctions" },
  "russia-ukraine":  { name: "Ukraine-/Russia-related Sanctions",    url: "https://ofac.treasury.gov/sanctions-programs-and-country-information/ukraine-russia-related-sanctions" },
  "somalia":         { name: "Somalia Sanctions",                    url: "https://ofac.treasury.gov/sanctions-programs-and-country-information/somalia-sanctions" },
  "south-sudan":     { name: "South Sudan Sanctions",                url: "https://ofac.treasury.gov/sanctions-programs-and-country-information/south-sudan-related-sanctions" },
  "sudan":           { name: "Sudan and Darfur Sanctions",           url: "https://ofac.treasury.gov/sanctions-programs-and-country-information/sudan-and-darfur-sanctions" },
  "venezuela":       { name: "Venezuela Sanctions",                  url: "https://ofac.treasury.gov/sanctions-programs-and-country-information/venezuela-related-sanctions" },
  "yemen":           { name: "Yemen Sanctions",                      url: "https://ofac.treasury.gov/sanctions-programs-and-country-information/yemen-related-sanctions" },
  "paarss":          { name: "PAARSS (Syria Residual)",              url: "https://ofac.treasury.gov/sanctions-programs-and-country-information/paarss" },
  "sdgt":            { name: "Counter Terrorism (SDGT)",             url: "https://ofac.treasury.gov/sanctions-programs-and-country-information/counter-terrorism-sanctions" },
  "narcotics":       { name: "Counter Narcotics Trafficking",        url: "https://ofac.treasury.gov/sanctions-programs-and-country-information/counter-narcotics-trafficking-sanctions" },
  "non-prolif":      { name: "Non-Proliferation Sanctions",          url: "https://ofac.treasury.gov/sanctions-programs-and-country-information/non-proliferation-sanctions" },
  "cyber":           { name: "Cyber-Related Sanctions",              url: "https://ofac.treasury.gov/sanctions-programs-and-country-information/sanctions-related-to-significant-malicious-cyber-enabled-activities" },
  "global-magnitsky":{ name: "Global Magnitsky Sanctions",           url: "https://ofac.treasury.gov/sanctions-programs-and-country-information/global-magnitsky-sanctions" },
  "magnitsky":       { name: "Magnitsky Sanctions",                  url: "https://ofac.treasury.gov/sanctions-programs-and-country-information/the-magnitsky-sanctions" },
  "tco":             { name: "Transnational Criminal Organizations",  url: "https://ofac.treasury.gov/sanctions-programs-and-country-information/transnational-criminal-organizations" },
  "caatsa":          { name: "CAATSA Sanctions",                     url: "https://ofac.treasury.gov/sanctions-programs-and-country-information/countering-americas-adversaries-through-sanctions-act-related-sanctions" },
  "china-military":  { name: "Chinese Military Companies",           url: "https://ofac.treasury.gov/sanctions-programs-and-country-information/chinese-military-companies-sanctions" },
  "hostages":        { name: "Hostages & Wrongfully Detained",       url: "https://ofac.treasury.gov/sanctions-programs-and-country-information/hostages-and-wrongfully-detained-us-nationals-sanctions" },
  "icc":             { name: "ICC-Related Sanctions",                url: "https://ofac.treasury.gov/sanctions-programs-and-country-information/international-criminal-court-related-sanctions" },
  "election":        { name: "Foreign Election Interference",        url: "https://ofac.treasury.gov/sanctions-programs-and-country-information/foreign-interference-in-a-united-states-election-sanctions" },
  "diamonds":        { name: "Rough Diamond Trade Controls",         url: "https://ofac.treasury.gov/sanctions-programs-and-country-information/rough-diamond-trade-controls" },
};

// data/ofac-cache.json's `programs` object is keyed by the URL path slug
// (e.g. "venezuela-related-sanctions"), set by parseProgramsIndex() in
// refresh-briefing.mjs — derive the same key from the program's full URL
// so this map's short `id`s (e.g. "venezuela") line up with the cache.
function slugFromUrl(url: string): string {
  return url.replace(
    /^https:\/\/ofac\.treasury\.gov\/sanctions-programs-and-country-information\//,
    ""
  );
}

// ── Handler ────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const prog = PROGRAMS[id];
  if (!prog) return NextResponse.json({ error: "Unknown program id" }, { status: 404 });

  const cache = await fetchOfacCache();
  if (!cache || !cache.programs) {
    return NextResponse.json({
      blocked: true,
      message: "OFAC scrape cache is temporarily unavailable. Use the 📋 View on OFAC.gov button to check manually.",
      url: prog.url,
    }, { status: 200 });
  }

  const slug = slugFromUrl(prog.url);
  const scraped = cache.programs[slug];
  if (!scraped) {
    return NextResponse.json({
      blocked: true,
      message: "This program hasn't appeared in a scrape yet — try again after the next scheduled refresh, or use the 📋 View on OFAC.gov button.",
      url: prog.url,
    }, { status: 200 });
  }

  return NextResponse.json({
    programId: id,
    programName: prog.name,
    url: prog.url,
    checkedAt: cache.updatedAt,
    executiveOrders: scraped.executiveOrders ?? [],
    generalLicenses: scraped.generalLicenses ?? [],
    cached: true,
  });
}
