export const dynamic = "force-dynamic";
/**
 * /api/ofac-program?id=iran
 * Fetches the real OFAC program page, extracts EOs / GLs / Advisories,
 * diffs against the static library snapshot stored in Redis,
 * and returns what's new, changed, or removed.
 *
 * Results cached in Redis for 24h to avoid hammering OFAC.
 * Pass ?force=1 to bypass cache.
 */
import { NextRequest, NextResponse } from "next/server";

const CACHE_TTL  = 60 * 60 * 24;        // 24 hours
const CACHE_PFX  = "ofac-diff-v2:";

// ── Redis helpers ──────────────────────────────────────────────────────────
async function redisGet(key: string) {
  const u = process.env.UPSTASH_REDIS_REST_URL;
  const t = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!u || !t) return null;
  try {
    const r = await fetch(`${u}/get/${encodeURIComponent(key)}`,
      { headers: { Authorization: `Bearer ${t}` } });
    const d = await r.json();
    return d.result ? JSON.parse(d.result) : null;
  } catch { return null; }
}
async function redisSet(key: string, value: any) {
  const u = process.env.UPSTASH_REDIS_REST_URL;
  const t = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!u || !t) return;
  try {
    await fetch(`${u}/set/${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
      body: JSON.stringify({ value: JSON.stringify(value), ex: CACHE_TTL }),
    });
  } catch {}
}

// ── Fetch & parse the real OFAC page ──────────────────────────────────────
async function fetchOfacPage(url: string): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 10000);
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!r.ok) return null;
    return await r.text();
  } catch { return null; }
}

function parseOfacPage(html: string) {
  // Strip scripts/styles/nav
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&nbsp;/g, " ")
    .replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/\s{2,}/g, " ").trim();

  // Extract EOs: "Executive Order 14024" or "E.O. 14024"
  const eoNums = new Set<string>();
  for (const m of text.matchAll(/(?:Executive Order|E\.O\.)\s*(\d{4,5})/gi))
    eoNums.add(m[1]);

  // Extract GLs: "General License 4A" / "General License 134C" / "GL 25G"
  const glNums = new Set<string>();
  for (const m of text.matchAll(/General License\s+([0-9]+[A-Z]?(?:\s+[A-Z])?)/gi))
    glNums.add(m[1].trim().replace(/\s+/g, ""));
  for (const m of text.matchAll(/\bGL\s+([0-9]+[A-Z]?)/gi))
    glNums.add(m[1].trim());

  // Extract advisories: lines containing Advisory|Alert|Guidance followed by a year
  const advLines: string[] = [];
  for (const m of text.matchAll(/([A-Z][^.!?]{10,120}(?:Advisory|Alert|Guidance|Fact Sheet)[^.!?]{0,80}(?:20\d{2})[^.!?]*)/gi))
    advLines.push(m[1].trim().slice(0, 150));

  return {
    executiveOrders: [...eoNums].sort((a, b) => Number(b) - Number(a)),
    generalLicenses: [...glNums].sort(),
    advisories: [...new Set(advLines)].slice(0, 20),
  };
}

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

// ── Handler ────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id    = searchParams.get("id");
  const force = searchParams.get("force") === "1";

  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const prog = PROGRAMS[id];
  if (!prog) return NextResponse.json({ error: "Unknown program id" }, { status: 404 });

  const cacheKey = CACHE_PFX + id;

  // Return cached result unless forced
  if (!force) {
    const cached = await redisGet(cacheKey);
    if (cached) return NextResponse.json({ ...cached, cached: true });
  }

  // Fetch the real page
  const html = await fetchOfacPage(prog.url);
  if (!html) {
    return NextResponse.json({
      blocked: true,
      message: "OFAC page blocked server-side fetch. Use the 📋 View on OFAC.gov button to check manually.",
      url: prog.url,
    }, { status: 200 });
  }

  const parsed = parseOfacPage(html);
  const result = {
    programId: id,
    programName: prog.name,
    url: prog.url,
    checkedAt: new Date().toISOString(),
    ...parsed,
    cached: false,
  };

  await redisSet(cacheKey, result);
  return NextResponse.json(result);
}
