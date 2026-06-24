/**
 * refresh-briefing.mjs
 * Runs from GitHub Actions — no CF 30s wall-clock limit here.
 * 1. Direct-scrapes official RSS/Atom/JSON feeds (OFAC, OFSI, EU, UN, BBC,
 *    Al Jazeera, OCC, Federal Reserve, BIS, Regions) — no LLM involved.
 * 2. Calls Gemini 2.0 Flash with Google Search grounding for the full
 *    six-section briefing, and merges the direct-scrape articles in
 *    (deduped by sourceUrl) so live feed data always shows up even if
 *    Gemini misses it or fails outright.
 * 3. POSTs the merged briefing JSON to /api/save-briefing on the CF app.
 *
 * Required env vars (GitHub secrets):
 *   GEMINI_API_KEY      — same key used in CF env vars
 *   APP_URL             — e.g. https://global-report-cf.pages.dev
 *   SAVE_BRIEFING_SECRET — shared secret, must match CF env var
 */

import { syncProgramsLibrary } from "./sync-programs-library.mjs";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const APP_URL        = (process.env.APP_URL || "").replace(/\/$/, "");
const SAVE_SECRET    = process.env.SAVE_BRIEFING_SECRET || "";
const GITHUB_TOKEN   = process.env.GITHUB_TOKEN || "";
const GITHUB_REPO    = process.env.GITHUB_REPOSITORY || ""; // auto-set by Actions: "owner/repo"

if (!GEMINI_API_KEY) { console.error("Missing GEMINI_API_KEY"); process.exit(1); }
if (!APP_URL)        { console.error("Missing APP_URL");        process.exit(1); }

// ── Scrape OFAC pages directly (GitHub Actions IPs not blocked by ofac.treasury.gov) ─
function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    // Decode entities BEFORE stripping tags: Drupal RSS <description> fields
    // (used by the EU finance-news feed) HTML-escape their markup, e.g.
    // "&lt;p&gt;text&lt;/p&gt;" — decoding first turns that into real tags
    // so the tag-strip pass below removes them instead of leaking literal
    // "<p>" text into the parsed description.
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchOfac(url) {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
      },
    });
    if (!res.ok) { console.warn(`[ofac] ${url}: HTTP ${res.status}`); return null; }
    return await res.text();
  } catch (e) {
    console.warn(`[ofac] ${url}: ${e.message}`);
    return null;
  }
}

// 1. Parse recent-actions listing — global scan, no dependency on HTML structure
function parseRecentActions(html) {
  const entries = [];
  const dateRe = /(\w+ \d+, \d{4})/;
  // Scan entire HTML for any href="/recent-actions/YYYYMMDD..." link
  // Handles both relative (/recent-actions/...) and absolute (https://ofac.../recent-actions/...)
  const linkRe = /href="(?:https:\/\/ofac\.treasury\.gov)?(\/recent-actions\/(\d{8}[^"]*))"[^>]*>([^<]{5,300})<\/a>/g;
  let m;
  while ((m = linkRe.exec(html)) !== null) {
    const path = m[1], code = m[2], title = m[3].trim();
    // Skip navigation/category links — those have non-date paths like /recent-actions/sanctions-list-updates
    if (!/^\d{8}/.test(code)) continue;
    const url = `https://ofac.treasury.gov${path}`;
    // Find nearest date in surrounding 300 chars
    const surrounding = stripHtml(html.slice(Math.max(0, m.index - 50), m.index + m[0].length + 300));
    const dm = dateRe.exec(surrounding);
    entries.push({ url, code, title, date: dm?.[1] ?? "" });
  }
  return entries;
}

// 3. Parse any OFAC sanctions program page — EOs, FR GL notices, GL PDF links
function parseSanctionsProgram(html) {
  const text = stripHtml(html);

  // ── Executive Orders (5-digit EO numbers) ────────────────────────────────
  const executiveOrders = [];
  const eoRe = /\b(1[34]\d{3})\s*[-–]\s*([^\n(]{10,200?}?)(?:\s*\(([^)]{4,30})\))?(?=\s*(?:\d{5}|\n|Executive|Federal|Code|$))/g;
  let em;
  while ((em = eoRe.exec(text)) !== null) {
    const num = em[1], title = em[2].trim().replace(/\s+/g, " "), date = em[3]?.trim() ?? "";
    if (title.length > 10)
      executiveOrders.push({ number: num, title: `Executive Order ${num} — ${title}`, date,
        url: `https://www.federalregister.gov/executive-order/${num}` });
  }

  // ── Federal Register GL notices ───────────────────────────────────────────
  // Format: "89 FR 20116-24 - Publication of ... Web General Licenses 83A, 88, ..."
  const frNotices = [];
  const frRe = /(\d{2,3}\s+FR\s+[\d-]+)\s*[-–]\s*([^\n]{10,300})/g;
  let fm;
  while ((fm = frRe.exec(text)) !== null) {
    const citation = fm[1].replace(/\s+/g, " ").trim();
    const description = fm[2].trim().replace(/\s+/g, " ");
    const yearMatch = /-(\d{2})$/.exec(citation) ?? /\b(20\d{2})\b/.exec(citation);
    const year = yearMatch ? (yearMatch[1].length === 2 ? `20${yearMatch[1]}` : yearMatch[1]) : "";
    const glNums = [...description.matchAll(/\bGL\s*(\d+[A-Z]?)\b|\bGeneral Licens\w+\s+(\d+[A-Z]?)\b/gi)]
      .map(m => m[1] ?? m[2]).filter(Boolean);
    frNotices.push({ citation, description, year, glNumbers: glNums });
  }

  // ── GL PDF links (/media/XXXXXX/download) ────────────────────────────────
  const generalLicenses = [];
  const mediaRe = /href="(\/media\/[\w/-]+\/download[^"]*)"\s*[^>]*>([^<]{3,200})<\/a>/gi;
  let mm;
  while ((mm = mediaRe.exec(html)) !== null) {
    const url = `https://ofac.treasury.gov${mm[1]}`;
    const linkText = stripHtml(mm[2]).trim();
    // Numeric-style designators (e.g. "General License 8M") first — this is the
    // common case across most programs.
    let numMatch = /(?:General\s+License|GL)[^#\d]*#?\s*(?:No\.?\s*)?(\d+[A-Z]?)/i.exec(linkText);
    if (!numMatch) {
      // Letter/Roman-numeral-style designators (e.g. Iran's "General License X",
      // "General License D-1", "General License K") have NO leading digit, so the
      // numeric regex above never matches them — this is the concrete reason
      // Iran's GL X (and similar Iran GLs) never showed up at all, even after the
      // programs-index and per-run-cap fixes landed.
      numMatch = /(?:General\s+License|GL)\s+(?:No\.?\s*)?([A-Z]+(?:-\d+)?)\b/i.exec(linkText);
    }
    if (!numMatch) continue;
    const surrounding = stripHtml(html.slice(Math.max(0, mm.index - 300), mm.index + mm[0].length + 300));
    const dateMatch = /(\w+ \d{1,2},? \d{4})/i.exec(surrounding);
    // Expiration date — OFAC's rolling Iran petroleum GLs (and similar time-limited
    // licenses) state their own end date inline, e.g. "...through August 21, 2026".
    // Check the link text itself first, then the surrounding page text.
    const expiresMatch = /\b(?:through|until|expir(?:es|ing|ation)?(?:\s+on)?)\s+(\w+ \d{1,2},? \d{4})/i.exec(`${linkText} ${surrounding}`);
    generalLicenses.push({
      number: numMatch[1].toUpperCase(),
      title: linkText,
      date: dateMatch?.[1] ?? "",
      expires: expiresMatch?.[1] ?? "",
      url,
    });
  }
  const seenGL = new Set();
  const uniqueGLs = generalLicenses.filter(gl => !seenGL.has(gl.number) && seenGL.add(gl.number));

  return { executiveOrders, frNotices: frNotices.slice(0, 20), generalLicenses: uniqueGLs };
}

// 4. Parse programs index — extract all program slugs, names, URLs, lastUpdated dates
function parseProgramsIndex(html) {
  const programs = [];
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rm;
  while ((rm = rowRe.exec(html)) !== null) {
    const rowHtml = rm[1];
    // Two bugs stacked here, both confirmed via committed debug instrumentation
    // (_debugProgIdx snippet from a live production fetch, removed below):
    // 1. OFAC's table links render as absolute URLs (https://ofac.treasury.gov/...),
    //    not relative — fixed by the optional absolute-prefix group on the href.
    // 2. The link TEXT is wrapped in a <span>, e.g.
    //      <a href="/sanctions-programs-and-country-information/iran-sanctions">
    //        <span>Iran Sanctions</span>
    //      </a>
    //    The old capture group `([^<]{3,200})` cannot cross the `<span>` tag, so
    //    the whole regex failed to match (no `</a>` immediately after consuming
    //    only whitespace) — `programs` stayed {} on every run since the start,
    //    even after fix #1 shipped. Using `([\s\S]{0,300}?)` lets the capture
    //    span inner tags; stripHtml() (already applied below) then removes them.
    const progMatch = /href="(?:https:\/\/ofac\.treasury\.gov)?(\/sanctions-programs-and-country-information\/([^"?#]+))"[^>]*>([\s\S]{0,300}?)<\/a>/i.exec(rowHtml);
    if (!progMatch) continue;
    const slug = progMatch[2];
    if (['where-is-ofac', 'archive', 'information'].some(s => slug.includes(s))) continue;
    const dateMatch = /href="(?:https:\/\/ofac\.treasury\.gov)?\/recent-actions\/\d{8}[^"]*"[^>]*>([\s\S]{0,300}?)<\/a>/i.exec(rowHtml);
    programs.push({
      slug,
      name: stripHtml(progMatch[3]).trim(),
      url: `https://ofac.treasury.gov${progMatch[1]}`,
      lastUpdated: dateMatch ? stripHtml(dateMatch[1]).trim() : "",
    });
  }
  return programs;
}

// ── OFSI (UK) notices — direct scrape, no Gemini ───────────────────────────
// gov.uk publishes an official Atom feed of all OFSI news/notices. Plain
// fetch + regex parse, mirrors the OFAC pattern above. No LLM involved.
function parseOfsiNotices(xml) {
  if (!xml) return [];
  const entries = [];
  const entryRe = /<entry>([\s\S]*?)<\/entry>/g;
  let m;
  while ((m = entryRe.exec(xml)) !== null) {
    const block = m[1];
    const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/.exec(block);
    const linkMatch = /<link[^>]*rel="alternate"[^>]*href="([^"]+)"/.exec(block)
      ?? /<link[^>]*href="([^"]+)"/.exec(block);
    const dateMatch = /<updated>([^<]+)<\/updated>/.exec(block);
    if (!titleMatch || !linkMatch) continue;
    const title = stripHtml(titleMatch[1]).trim();
    const url = linkMatch[1].trim();
    const date = dateMatch
      ? new Date(dateMatch[1]).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
      : "";
    entries.push({ title, url, date });
  }
  return entries;
}

// ── Generic RSS 2.0 <item> parser — shared by EU, UN, BBC, and Al Jazeera ──
// feeds below. All four are standard RSS, so one parser + a keyword filter
// covers them; only OFSI (Atom, above) needs its own <entry> format.
function parseRssItems(xml) {
  if (!xml) return [];
  const entries = [];
  const itemRe = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1];
    const titleMatch = /<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/.exec(block);
    // Some feeds (e.g. Federal Reserve) CDATA-wrap <link>; tolerate both forms.
    const linkMatch = /<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/.exec(block);
    const dateMatch = /<pubDate>(?:<!\[CDATA\[)?([^<\]]+)/.exec(block);
    const descMatch = /<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/.exec(block);
    if (!titleMatch || !linkMatch) continue;
    const title = stripHtml(titleMatch[1]).trim();
    const description = descMatch ? stripHtml(descMatch[1]).trim() : "";
    const url = linkMatch[1].trim();
    const date = dateMatch
      ? new Date(dateMatch[1]).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
      : "";
    entries.push({ title, url, date, description });
  }
  return entries;
}

// General-purpose sanctions keyword filter — used for any feed that isn't
// sanctions-specific on its own (EU finance news, BBC world/business, Al
// Jazeera all-news) so only relevant items get surfaced.
const SANCTIONS_KEYWORDS = /sanction|restrictive measure|asset freeze|designat|embargo|export control|russia|belarus|\biran\b|syria|venezuela|north korea|\bdprk\b|myanmar/i;

function filterSanctionsRelevant(entries) {
  return entries.filter(e => SANCTIONS_KEYWORDS.test(e.title) || SANCTIONS_KEYWORDS.test(e.description));
}

// ── EU (Europa/DG FISMA) finance news — direct scrape, no Gemini ───────────
// finance.ec.europa.eu publishes an official RSS feed of all finance news.
// It isn't sanctions-only, so entries are filtered by keyword before being
// treated as a "sanctions" article. Plain fetch + regex parse, no LLM.
function parseEuropaSanctions(xml) {
  return filterSanctionsRelevant(parseRssItems(xml));
}

// ── UN Security Council sanctions press releases — direct scrape, no Gemini ─
// press.un.org publishes an official RSS feed of all UN press releases
// (Security Council, General Assembly, Secretary-General, etc. all mixed
// together), so entries are filtered for Security Council sanctions-committee
// language specifically — narrower than SANCTIONS_KEYWORDS to avoid pulling
// in unrelated GA/SG releases that merely mention a country name. Plain
// fetch + regex parse, no LLM.
const UN_SANCTIONS_KEYWORDS = /sanctions committee|security council.*sanctions|sanctions list|asset freeze|travel ban|arms embargo|de-?listing|designat/i;

function parseUnSanctions(xml) {
  return parseRssItems(xml).filter(e => UN_SANCTIONS_KEYWORDS.test(e.title) || UN_SANCTIONS_KEYWORDS.test(e.description));
}

// ── BBC News — direct scrape, no Gemini ─────────────────────────────────────
// feeds.bbci.co.uk publishes official RSS for World and Business news. Not
// sanctions-specific, so filtered the same way as the EU feed.
function parseBbcSanctions(xml) {
  return filterSanctionsRelevant(parseRssItems(xml));
}

// ── Al Jazeera — direct scrape, no Gemini ───────────────────────────────────
// aljazeera.com publishes an official all-news RSS feed. Not sanctions-
// specific, so filtered the same way as the EU/BBC feeds.
//
// NOTE: CNN and AP were evaluated and excluded from direct scraping. CNN's
// legacy rss.cnn.com feeds are abandoned (serving cached items from
// 2017/2023, not live data) and AP discontinued official RSS entirely with
// no replacement. Both are still covered via Gemini's Google Search
// grounding when Gemini runs (see SYSTEM_PROMPT below).
function parseAlJazeeraSanctions(xml) {
  return filterSanctionsRelevant(parseRssItems(xml));
}

// ── Regions (general world/regional news) — direct scrape, no Gemini ──────
// Reuses the same BBC World/Business and Al Jazeera RSS feeds above, but
// keeps the COMPLEMENT of the sanctions filter — general world/regional
// news items that do NOT match SANCTIONS_KEYWORDS. Previously this content
// was simply discarded by filterSanctionsRelevant; now it's surfaced in the
// "regions" section so non-government world news (AP/BBC/Al Jazeera/Reuters
// coverage of world events generally, not just sanctions-relevant items)
// actually shows up there. Added 2026-06-19 — renaming "Religion" to
// "Regions" alone didn't produce new content because the old section only
// ever got historical backfill articles; this gives it a live source.
function parseRegionsNews(xml) {
  return parseRssItems(xml).filter(e => !SANCTIONS_KEYWORDS.test(e.title) && !SANCTIONS_KEYWORDS.test(e.description));
}

// ── OCC (Comptroller of the Currency) news — direct scrape, no Gemini ──────
// occ.gov publishes an official RSS feed of ALL news releases (testimony,
// CRA evaluations, personnel announcements, final rules, enforcement
// actions, etc. all mixed together). The "occ" section is scoped to
// enforcement actions / consent orders / prohibition orders PLUS key
// advisories on AML/BSA, sanctions, and banking-industry/country risk —
// broadened 2026-06-19 because the strict enforcement-only filter went
// quiet for weeks between OCC's monthly enforcement batches even though
// occ.gov was actively publishing relevant advisories in the meantime.
// Still excludes unrelated noise like testimony, personnel announcements,
// CRA evaluation schedules, and routine final rules (e.g. escrow interest).
const OCC_KEYWORDS = /enforcement action|consent order|cease.?and.?desist|prohibition order|civil money penalty|formal agreement|removal order|terminat|money laundering|bank secrecy act|\bbsa\b|suspicious activity|\bsanctions?\b|\bofac\b|advisory|bulletin|\balert\b|country risk|correspondent bank/i;

function parseOccNews(xml) {
  return parseRssItems(xml).filter(e => OCC_KEYWORDS.test(e.title) || OCC_KEYWORDS.test(e.description));
}

// ── Federal Reserve press releases — direct scrape, no Gemini ─────────────
// federalreserve.gov publishes an official RSS feed of ALL press releases
// (monetary policy, enforcement actions, banking applications, other
// announcements, all mixed together). The "economics" section is scoped to
// markets/inflation/central banks/trade/energy, which maps most closely to
// items tagged <category>Monetary Policy</category> — enforcement/banking-
// application items overlap with the occ/penalties sections instead, so
// this needs its own parser (parseRssItems doesn't capture <category>) plus
// a keyword fallback for economics-relevant items that lack that category
// (e.g. semiannual reports, trade/energy commentary). Fixes the staleness
// the user reported: economics was previously Gemini-only, same as OCC was.
function parseFedPressItems(xml) {
  if (!xml) return [];
  const entries = [];
  // Tolerant to attributes (e.g. <item rdf:about="...">) and case, in case the
  // server returns a slightly different feed flavor to some requesters.
  const itemRe = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1];
    const titleMatch = /<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/.exec(block);
    // Federal Reserve's feed CDATA-wraps <link> (<link><![CDATA[https://...]]></link>);
    // the old [^<]+ pattern required a non-"<" char right after <link>, which
    // immediately fails on "<![CDATA[" and silently dropped every single item.
    const linkMatch = /<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/.exec(block);
    const dateMatch = /<pubDate>(?:<!\[CDATA\[)?([^<\]]+)/.exec(block);
    const descMatch = /<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/.exec(block);
    const catMatch = /<category>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/category>/.exec(block);
    if (!titleMatch || !linkMatch) continue;
    const title = stripHtml(titleMatch[1]).trim();
    const description = descMatch ? stripHtml(descMatch[1]).trim() : "";
    const url = linkMatch[1].trim();
    const category = catMatch ? stripHtml(catMatch[1]).trim() : "";
    const date = dateMatch
      ? new Date(dateMatch[1]).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
      : "";
    entries.push({ title, url, date, description, category });
  }
  return entries;
}

const ECONOMICS_KEYWORDS = /monetary policy|inflation|interest rate|federal funds rate|fomc|economic projection|\bgdp\b|recession|trade deficit|tariff|energy price|oil price|jobs report|employment situation|consumer price/i;

function parseFedEconomics(xml) {
  return parseFedPressItems(xml).filter(e =>
    e.category === "Monetary Policy" || ECONOMICS_KEYWORDS.test(e.title) || ECONOMICS_KEYWORDS.test(e.description)
  );
}

// ── BIS (Bureau of Industry and Security) actions — direct scrape, no Gemini ─
// federalregister.gov publishes an official JSON API of every Federal
// Register document (no API key required). Querying by agency returns all
// BIS filings, but most are routine procedural notices (OMB collection
// requests, individual "denied export privileges" personnel orders) rather
// than "export controls, Entity List, EAR enforcement, semiconductor policy"
// per the bis section's scope — so results are filtered the same way the
// OCC/sanctions feeds are: keyword match on title + abstract. No LLM involved.
const BIS_KEYWORDS = /entity list|export control|denied person|export administration regulation|\bear\b|semiconductor|antiboycott|export privilege|embargo|end.?use|deemed export/i;

function parseBisNews(json) {
  if (!json) return [];
  let data;
  try { data = JSON.parse(json); } catch { return []; }
  const results = data?.results ?? [];
  return results
    .filter(r => BIS_KEYWORDS.test(r.title || "") || BIS_KEYWORDS.test(r.abstract || ""))
    .map(r => ({
      title: r.title,
      url: r.html_url,
      date: r.publication_date
        ? new Date(r.publication_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
        : "",
      description: r.abstract || "",
    }));
}

// 5. Load existing cache from GitHub to enable change detection
async function loadExistingCache() {
  if (!GITHUB_TOKEN || !GITHUB_REPO) return null;
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/data/ofac-cache.json`, {
      headers: { "Authorization": `token ${GITHUB_TOKEN}`, "Accept": "application/vnd.github+json" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const file = await res.json();
    return JSON.parse(Buffer.from(file.content, "base64").toString("utf8"));
  } catch (e) {
    console.warn("[ofac-cache] Could not load existing cache:", e.message);
    return null;
  }
}

// 2. Parse civil penalties table
function parseCivilPenalties(html) {
  const rows = [];
  // Match table rows: date | name | count | amount
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
  let rm;
  while ((rm = rowRe.exec(html)) !== null) {
    const cells = [];
    let cm;
    const cellHtml = rm[1];
    const tmpRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    while ((cm = tmpRe.exec(cellHtml)) !== null) {
      cells.push(stripHtml(cm[1]).trim());
    }
    if (cells.length >= 4 && /\d{2}\/\d{2}\/\d{4}/.test(cells[0])) {
      const linkMatch = /href="([^"]+)"/.exec(rm[1]);
      // OFAC's penalties table uses relative hrefs (e.g. "/media/935651/download?inline").
      // Always store an absolute URL so downstream consumers (Telegram/Discord
      // markdown links, the app UI) can link to it directly.
      let pdfUrl = linkMatch?.[1] ?? "";
      if (pdfUrl && pdfUrl.startsWith("/")) pdfUrl = `https://ofac.treasury.gov${pdfUrl}`;
      rows.push({ date: cells[0], name: cells[1], count: cells[2], amount: cells[3], pdfUrl });
    }
  }
  return rows;
}

// Load existing cache FIRST — used for change detection on all three sources
const existingCache = await loadExistingCache();
const cachedPrograms = existingCache?.programs ?? {};

console.log("[refresh-briefing] Fetching OFAC recent-actions listing...");
const recentActionsHtml = await fetchOfac("https://ofac.treasury.gov/recent-actions");
const recentActions = recentActionsHtml ? parseRecentActions(recentActionsHtml) : [];
console.log(`[refresh-briefing] Recent actions parsed: ${recentActions.length} entries`);
recentActions.slice(0, 10).forEach(e => console.log(`  ${e.date} — ${e.title} (${e.url})`));

console.log("[refresh-briefing] Fetching OFAC civil penalties page...");
const penaltiesHtml = await fetchOfac("https://ofac.treasury.gov/civil-penalties-and-enforcement-information");
const civilPenalties = penaltiesHtml ? parseCivilPenalties(penaltiesHtml) : [];
console.log(`[refresh-briefing] Civil penalties parsed: ${civilPenalties.length} rows`);
civilPenalties.forEach(r => console.log(`  ${r.date} — ${r.name}: $${r.amount}`));

// ── Scrape all OFAC program pages (change-detection via index) ────────────
console.log("[refresh-briefing] Fetching OFAC programs index...");
const programsIndexHtml = await fetchOfac("https://ofac.treasury.gov/sanctions-programs-and-country-information");
const programsList = programsIndexHtml ? parseProgramsIndex(programsIndexHtml) : [];
console.log(`[refresh-briefing] Programs index: ${programsList.length} programs found`);

// Fetch only programs whose lastUpdated date changed (cap at 50 per run —
// OFAC has ~30-40 total programs, so this covers a full cold-cache backfill
// in a single run instead of needing several runs to alphabetically work
// through the list. Once the cache is warm, "changed" will only ever be a
// handful per run anyway, so the higher cap costs nothing day-to-day.)
const changedPrograms = programsList.filter(p =>
  p.lastUpdated && p.lastUpdated !== (cachedPrograms[p.slug]?.lastUpdated ?? "")
).slice(0, 50);

console.log(`[refresh-briefing] Programs with changes: ${changedPrograms.length} (of ${programsList.length} total)`);
changedPrograms.forEach(p =>
  console.log(`  ${p.slug}: ${cachedPrograms[p.slug]?.lastUpdated ?? "(new)"} → ${p.lastUpdated}`)
);

// Fetch and parse each changed program, carry over unchanged from existing cache
const programs = { ...cachedPrograms };
for (const prog of changedPrograms) {
  console.log(`[refresh-briefing] Fetching: ${prog.name}`);
  const html = await fetchOfac(prog.url);
  if (!html) { console.warn(`  skipped (fetch failed)`); continue; }
  const parsed = parseSanctionsProgram(html);
  programs[prog.slug] = {
    name: prog.name,
    url: prog.url,
    lastUpdated: prog.lastUpdated,
    executiveOrders: parsed.executiveOrders,
    frNotices: parsed.frNotices,
    generalLicenses: parsed.generalLicenses,
  };
  console.log(`  → ${parsed.executiveOrders.length} EOs, ${parsed.frNotices.length} FR notices, ${parsed.generalLicenses.length} GL PDFs`);
}

// ── OFSI (UK) + EU direct scrapes — run every time, independent of the ─────
// OFAC-only early-exit/Gemini-trigger logic below. Plain HTTP fetch only,
// no Gemini/LLM call — keeps these additive without touching RPD quota.
console.log("[refresh-briefing] Fetching OFSI (UK) notices feed...");
const ofsiXml = await fetchOfac("https://www.gov.uk/search/news-and-communications.atom?organisations%5B%5D=office-of-financial-sanctions-implementation");
const ofsiNotices = parseOfsiNotices(ofsiXml);
console.log(`[refresh-briefing] OFSI notices parsed: ${ofsiNotices.length} entries`);
ofsiNotices.slice(0, 5).forEach(e => console.log(`  ${e.date} — ${e.title} (${e.url})`));

console.log("[refresh-briefing] Fetching EU (Europa/DG FISMA) finance news feed...");
const europaXml = await fetchOfac("https://finance.ec.europa.eu/node/1408/rss_en");
const europaNews = parseEuropaSanctions(europaXml);
console.log(`[refresh-briefing] EU sanctions-relevant news parsed: ${europaNews.length} entries`);
europaNews.slice(0, 5).forEach(e => console.log(`  ${e.date} — ${e.title} (${e.url})`));

console.log("[refresh-briefing] Fetching UN Security Council press releases feed...");
const unXml = await fetchOfac("https://press.un.org/en/rss.xml");
const unNotices = parseUnSanctions(unXml);
console.log(`[refresh-briefing] UN sanctions-relevant press releases parsed: ${unNotices.length} entries`);
unNotices.slice(0, 5).forEach(e => console.log(`  ${e.date} — ${e.title} (${e.url})`));

console.log("[refresh-briefing] Fetching BBC News World + Business feeds...");
const [bbcWorldXml, bbcBusinessXml] = await Promise.all([
  fetchOfac("https://feeds.bbci.co.uk/news/world/rss.xml"),
  fetchOfac("https://feeds.bbci.co.uk/news/business/rss.xml"),
]);
const bbcNews = [...parseBbcSanctions(bbcWorldXml), ...parseBbcSanctions(bbcBusinessXml)];
console.log(`[refresh-briefing] BBC sanctions-relevant news parsed: ${bbcNews.length} entries`);
bbcNews.slice(0, 5).forEach(e => console.log(`  ${e.date} — ${e.title} (${e.url})`));

console.log("[refresh-briefing] Fetching Al Jazeera news feed...");
const ajXml = await fetchOfac("https://www.aljazeera.com/xml/rss/all.xml");
const ajNews = parseAlJazeeraSanctions(ajXml);
console.log(`[refresh-briefing] Al Jazeera sanctions-relevant news parsed: ${ajNews.length} entries`);
ajNews.slice(0, 5).forEach(e => console.log(`  ${e.date} — ${e.title} (${e.url})`));

// Regions: complement of the sanctions filter on the same BBC/AJ feeds —
// general world/regional news that isn't sanctions-relevant, for the
// "regions" section instead of being discarded.
const regionsNews = [
  ...parseRegionsNews(bbcWorldXml),
  ...parseRegionsNews(bbcBusinessXml),
  ...parseRegionsNews(ajXml),
];
console.log(`[refresh-briefing] Regions (general world news) parsed: ${regionsNews.length} entries`);
regionsNews.slice(0, 5).forEach(e => console.log(`  ${e.date} — ${e.title} (${e.url})`));

console.log("[refresh-briefing] Fetching OCC news releases feed...");
const occXml = await fetchOfac("https://www.occ.gov/rss/occ_news.xml");
const occNews = parseOccNews(occXml);
console.log(`[refresh-briefing] OCC enforcement-relevant news parsed: ${occNews.length} entries`);
occNews.slice(0, 5).forEach(e => console.log(`  ${e.date} — ${e.title} (${e.url})`));

console.log("[refresh-briefing] Fetching Federal Reserve press releases feed...");
const fedXml = await fetchOfac("https://www.federalreserve.gov/feeds/press_all.xml");
console.log(`[refresh-briefing] Fed feed raw response: ${fedXml ? `${fedXml.length} chars` : "NULL (fetch failed)"}`);
if (fedXml) console.log(`[refresh-briefing] Fed feed snippet: ${fedXml.slice(0, 300).replace(/\s+/g, " ")}`);
const allFedItems = parseFedPressItems(fedXml);
console.log(`[refresh-briefing] Fed feed items parsed (pre-filter): ${allFedItems.length}`);
allFedItems.slice(0, 3).forEach(e => console.log(`  [pre-filter] ${e.date} — [${e.category}] ${e.title}`));
const economicsNews = parseFedEconomics(fedXml);
console.log(`[refresh-briefing] Fed economics-relevant news parsed: ${economicsNews.length} entries`);
economicsNews.slice(0, 5).forEach(e => console.log(`  ${e.date} — ${e.title} (${e.url})`));

console.log("[refresh-briefing] Fetching Federal Register BIS documents...");
const bisJson = await fetchOfac("https://www.federalregister.gov/api/v1/documents.json?conditions%5Bagencies%5D%5B%5D=industry-and-security-bureau&order=newest&per_page=20");
const bisNews = parseBisNews(bisJson);
console.log(`[refresh-briefing] BIS export-control-relevant documents parsed: ${bisNews.length} entries`);
bisNews.slice(0, 5).forEach(e => console.log(`  ${e.date} — ${e.title} (${e.url})`));

// ── Early-exit: skip Gemini if nothing changed since last run ─────────────
// Compare first recent-action URL (most recent = most likely to change),
// first civil-penalty row (date + name), and whether any programs updated.
// If all three match the cache, no new data was published — save RPD quota.
const cachedActions  = existingCache?.recentActions  ?? [];
const cachedPenalties = existingCache?.civilPenalties ?? [];

const noNewActions   = recentActions.length > 0 && cachedActions.length > 0
  && recentActions[0].url === cachedActions[0].url;
const noNewPenalties = civilPenalties.length > 0 && cachedPenalties.length > 0
  && civilPenalties[0].date === cachedPenalties[0].date
  && civilPenalties[0].name === cachedPenalties[0].name;
const noNewPrograms  = changedPrograms.length === 0;

if (noNewActions && noNewPenalties && noNewPrograms) {
  console.log("[refresh-briefing] ✅ No new OFAC data — skipping Gemini to preserve RPD quota");
  // Re-commit cache to refresh updatedAt (app reads this to know last scrape time)
  await commitOfacCache(recentActions, civilPenalties, programs, ofsiNotices, europaNews, unNotices, bbcNews, ajNews, occNews, economicsNews, bisNews, regionsNews);
  await syncPrograms(programs, recentActions);

  // Still touch the saved briefing's lastUpdated so the app shows a fresh
  // "checked at" time on every run, not just runs that found new OFAC data.
  // Zero Gemini calls — reuses the scrape we already did above. merge:true
  // keeps the regions section from the last Gemini run (no direct source).
  // OFSI/EU/UN/BBC/Al Jazeera/OCC/Fed/BIS entries are included unconditionally
  // so they show up in their sections on every run, regardless of the OFAC
  // early-exit outcome — this is what fixes OCC/economics/bis staleness.
  const touch = buildFallbackBriefing(recentActions, civilPenalties, ofsiNotices, europaNews, unNotices, bbcNews, ajNews, occNews, economicsNews, bisNews, regionsNews);
  if (touch.articles.length > 0) {
    await saveBriefingWithRetry(touch, true);
  }
  process.exit(0);
}
console.log(`[refresh-briefing] New data detected — actions:${!noNewActions} penalties:${!noNewPenalties} programs:${!noNewPrograms} — calling Gemini`);

// ── Commit scraped OFAC data to repo as a cache file ──────────────────────
// The app (CF Workers) can't reach ofac.treasury.gov directly (IP blocked).
// Committing to the repo lets the app read fresh OFAC data via raw.githubusercontent.com.
async function commitOfacCache(recentActions, civilPenalties, programs, ofsiNotices = [], europaNews = [], unNotices = [], bbcNews = [], ajNews = [], occNews = [], economicsNews = [], bisNews = [], regionsNews = []) {
  if (!GITHUB_TOKEN || !GITHUB_REPO) {
    console.warn("[ofac-cache] Missing GITHUB_TOKEN or GITHUB_REPOSITORY — skipping cache commit");
    return;
  }
  const path = "data/ofac-cache.json";
  const content = JSON.stringify({
    updatedAt: new Date().toISOString(),
    recentActions,
    civilPenalties,
    programs,
    ofsiNotices,
    europaNews,
    unNotices,
    bbcNews,
    ajNews,
    occNews,
    economicsNews,
    bisNews,
    regionsNews,
  }, null, 2);
  const encoded = Buffer.from(content).toString("base64");

  // Fetch existing file SHA (required by GitHub API for updates)
  const apiUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`;
  const headers = {
    "Authorization": `token ${GITHUB_TOKEN}`,
    "Accept": "application/vnd.github+json",
    "Content-Type": "application/json",
  };
  let sha;
  try {
    const existing = await fetch(apiUrl, { headers });
    if (existing.ok) sha = (await existing.json()).sha;
  } catch { /* new file — no SHA needed */ }

  const body = {
    message: `chore: update OFAC cache [skip ci]`,
    content: encoded,
    ...(sha ? { sha } : {}),
  };
  const res = await fetch(apiUrl, { method: "PUT", headers, body: JSON.stringify(body) });
  if (res.ok) {
    const progCount = Object.keys(programs).length;
    console.log(`[ofac-cache] ✅ Committed: ${recentActions.length} recent-actions, ${civilPenalties.length} penalties, ${progCount} programs, ${ofsiNotices.length} OFSI notices, ${europaNews.length} EU items, ${unNotices.length} UN items, ${bbcNews.length} BBC items, ${ajNews.length} Al Jazeera items, ${occNews.length} OCC items, ${economicsNews.length} Fed items, ${bisNews.length} BIS items, ${regionsNews.length} Regions items to ${path}`);
  } else {
    const err = await res.text();
    console.warn(`[ofac-cache] Commit failed (${res.status}): ${err.slice(0, 200)}`);
  }
}

await commitOfacCache(recentActions, civilPenalties, programs, ofsiNotices, europaNews, unNotices, bbcNews, ajNews, occNews, economicsNews, bisNews, regionsNews);
await syncPrograms(programs, recentActions);

// ── Sync newly-scraped GL/EO/advisory data into the curated programs library ─
// Non-fatal by design — a sync failure must never break the briefing refresh.
// See sync-programs-library.mjs for the safety model (string-surgery + sanity
// checks; aborts and writes nothing if anything looks off).
async function syncPrograms(programs, recentActions) {
  try {
    const result = await syncProgramsLibrary({
      programs,
      recentActions,
      githubToken: GITHUB_TOKEN,
      githubRepo: GITHUB_REPO,
      dryRun: false,
    });
    if (result?.changed) {
      console.log(`[sync-programs] ✅ Library updated: ${JSON.stringify(result)}`);
    } else if (result?.error) {
      console.warn(`[sync-programs] Aborted: ${result.error}`);
    } else {
      console.log("[sync-programs] No changes needed");
    }
  } catch (e) {
    console.warn(`[sync-programs] Failed (non-fatal): ${String(e).slice(0, 300)}`);
  }
}

// ── Build fallback briefing from scraped data (when Gemini fails) ──────────
function buildFallbackBriefing(recentActions, civilPenalties, ofsiNotices = [], europaNews = [], unNotices = [], bbcNews = [], ajNews = [], occNews = [], economicsNews = [], bisNews = [], regionsNews = []) {
  const nowStr = new Date().toLocaleString("en-US", {
    month: "long", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZoneName: "short",
    timeZone: "America/New_York",
  });

  const articles = [];
  let id = 1;

  // Recent-action entries → sanctions articles
  for (const entry of recentActions.slice(0, 10)) {
    articles.push({
      id: id++,
      section: "sanctions",
      category: "OFAC",
      region: "United States",
      impact: "high",
      date: entry.date || "",
      headline: entry.title,
      body: [
        `OFAC published a new action on ${entry.date || "an unspecified date"}: "${entry.title}". Full details are available at the official OFAC website.`,
      ],
      source: "OFAC Recent Actions",
      sourceUrl: entry.url,
    });
  }

  // Civil penalties rows → penalties articles
  for (const row of civilPenalties.slice(0, 8)) {
    const amountStr = row.amount.startsWith("$") ? row.amount : `$${row.amount}`;
    articles.push({
      id: id++,
      section: "penalties",
      category: "OFAC Enforcement",
      region: "United States",
      impact: "high",
      date: row.date || "",
      headline: `OFAC Penalizes ${row.name} ${amountStr} for Sanctions Violations`,
      body: [
        `The Office of Foreign Assets Control (OFAC) assessed a civil monetary penalty of ${amountStr} against ${row.name} for apparent violations of OFAC-administered sanctions programs.`,
        row.pdfUrl
          ? `The settlement agreement is available on the OFAC civil penalties page: ${row.pdfUrl}`
          : `The action was recorded on ${row.date}.`,
      ],
      source: "OFAC Civil Penalties and Enforcement Information",
      sourceUrl: row.pdfUrl || "https://ofac.treasury.gov/civil-penalties-and-enforcement-information",
    });
  }

  // OFSI (UK) notices → sanctions articles — always included, independent
  // of the OFAC early-exit/Gemini path, so EU/UK coverage shows up every run.
  for (const entry of ofsiNotices.slice(0, 6)) {
    articles.push({
      id: id++,
      section: "sanctions",
      category: "OFSI",
      region: "United Kingdom",
      impact: "medium",
      date: entry.date || "",
      headline: entry.title,
      body: [
        `The UK's Office of Financial Sanctions Implementation (OFSI) published: "${entry.title}". Full details are available on GOV.UK.`,
      ],
      source: "OFSI (GOV.UK)",
      sourceUrl: entry.url,
    });
  }

  // EU (Europa/DG FISMA) sanctions-relevant news → sanctions articles
  for (const entry of europaNews.slice(0, 6)) {
    articles.push({
      id: id++,
      section: "sanctions",
      category: "EU",
      region: "European Union",
      impact: "medium",
      date: entry.date || "",
      headline: entry.title,
      body: [
        entry.description || `The European Commission (DG FISMA) published: "${entry.title}". Full details are available on finance.ec.europa.eu.`,
      ],
      source: "European Commission — Finance News",
      sourceUrl: entry.url,
    });
  }

  // UN Security Council sanctions press releases → sanctions articles
  for (const entry of unNotices.slice(0, 6)) {
    articles.push({
      id: id++,
      section: "sanctions",
      category: "UN",
      region: "International",
      impact: "medium",
      date: entry.date || "",
      headline: entry.title,
      body: [
        entry.description || `The United Nations published: "${entry.title}". Full details are available on press.un.org.`,
      ],
      source: "United Nations — Press Releases",
      sourceUrl: entry.url,
    });
  }

  // BBC News sanctions-relevant coverage → sanctions articles
  for (const entry of bbcNews.slice(0, 6)) {
    articles.push({
      id: id++,
      section: "sanctions",
      category: "News",
      region: "International",
      impact: "medium",
      date: entry.date || "",
      headline: entry.title,
      body: [
        entry.description || `BBC News reported: "${entry.title}".`,
      ],
      source: "BBC News",
      sourceUrl: entry.url,
    });
  }

  // Al Jazeera sanctions-relevant coverage → sanctions articles
  for (const entry of ajNews.slice(0, 6)) {
    articles.push({
      id: id++,
      section: "sanctions",
      category: "News",
      region: "International",
      impact: "medium",
      date: entry.date || "",
      headline: entry.title,
      body: [
        entry.description || `Al Jazeera reported: "${entry.title}".`,
      ],
      source: "Al Jazeera",
      sourceUrl: entry.url,
    });
  }

  // OCC enforcement + AML/sanctions/banking-advisory news → occ articles —
  // fixes the staleness the user reported (OCC section was frozen on
  // whatever Gemini last wrote, since this was previously the only section
  // with no non-Gemini source; scope broadened 2026-06-19, see OCC_KEYWORDS).
  for (const entry of occNews.slice(0, 6)) {
    articles.push({
      id: id++,
      section: "occ",
      category: "OCC",
      region: "United States",
      impact: "high",
      date: entry.date || "",
      headline: entry.title,
      body: [
        entry.description || `The Office of the Comptroller of the Currency (OCC) published: "${entry.title}". Full details are available on occ.gov.`,
      ],
      source: "OCC News Releases",
      sourceUrl: entry.url,
    });
  }

  // Fed press releases (Monetary Policy + economics-relevant) → economics
  // articles — fixes the staleness the user reported (economics was
  // previously Gemini-only, frozen the same way OCC was).
  for (const entry of economicsNews.slice(0, 6)) {
    articles.push({
      id: id++,
      section: "economics",
      category: "Federal Reserve",
      region: "United States",
      impact: "medium",
      date: entry.date || "",
      headline: entry.title,
      body: [
        entry.description || `The Federal Reserve published: "${entry.title}". Full details are available on federalreserve.gov.`,
      ],
      source: "Federal Reserve — Press Releases",
      sourceUrl: entry.url,
    });
  }

  // Federal Register BIS documents (export-control-relevant) → bis articles —
  // fixes the staleness the user reported (bis was previously Gemini-only).
  for (const entry of bisNews.slice(0, 6)) {
    articles.push({
      id: id++,
      section: "bis",
      category: "BIS",
      region: "United States",
      impact: "high",
      date: entry.date || "",
      headline: entry.title,
      body: [
        entry.description || `The Bureau of Industry and Security (BIS) published: "${entry.title}". Full details are available on federalregister.gov.`,
      ],
      source: "Federal Register — BIS",
      sourceUrl: entry.url,
    });
  }

  // General world/regional news (non-sanctions-relevant BBC/Al Jazeera
  // coverage) → regions articles. Added 2026-06-19 so the Regions tab
  // (renamed from Religion) shows real non-government news instead of
  // only old historical backfill articles.
  for (const entry of regionsNews.slice(0, 8)) {
    articles.push({
      id: id++,
      section: "regions",
      category: "World News",
      region: "International",
      impact: "medium",
      date: entry.date || "",
      headline: entry.title,
      body: [
        entry.description || `${entry.title}`,
      ],
      source: entry.url?.includes("bbc.co") ? "BBC News" : "Al Jazeera",
      sourceUrl: entry.url,
    });
  }

  const emptySection = { watchlist: [], keyFigures: [] };
  return {
    lastUpdated: `${nowStr} — Official government sources [Structured/Actions]`,
    articles,
    sidebar: {
      sanctions: emptySection,
      economics: emptySection,
      regions:   emptySection,
      occ:       emptySection,
      penalties: emptySection,
      bis:       emptySection,
    },
  };
}

// Build context strings for Gemini
const recentActionsContext = recentActions.length > 0
  ? recentActions.slice(0, 15).map(e =>
      `• ${e.date} — ${e.title}\n  URL: ${e.url}`
    ).join("\n")
  : "Unavailable — use Google Search: site:ofac.treasury.gov/recent-actions";

const penaltiesContext = civilPenalties.length > 0
  ? civilPenalties.map(r =>
      `• ${r.date} — ${r.name} — $${r.amount}${r.pdfUrl ? `\n  PDF: ${r.pdfUrl}` : ""}`
    ).join("\n")
  : "Unavailable — use Google Search: site:ofac.treasury.gov civil penalties 2026";

const today = new Date().toLocaleString("en-US", {
  weekday: "long", year: "numeric", month: "long", day: "numeric",
  hour: "2-digit", minute: "2-digit", timeZoneName: "short",
  timeZone: "America/New_York",
});

const SYSTEM_PROMPT = `You are a senior intelligence editor. Search the web for the very latest news across six domains and write a complete, sourced briefing.

Return ONLY valid JSON — no markdown fences, no preamble, no trailing text:

{
  "lastUpdated": "June 14, 2026 — 14:00 UTC",
  "articles": [
    {
      "id": 1,
      "section": "sanctions",
      "category": "OFAC",
      "region": "Iran",
      "impact": "high",
      "date": "June 14, 2026",
      "headline": "Full newspaper-style headline",
      "body": ["First full paragraph.", "Second paragraph.", "Third paragraph."],
      "source": "U.S. Treasury OFAC / Reuters",
      "sourceUrl": "https://home.treasury.gov/..."
    }
  ],
  "sidebar": {
    "sanctions":  { "watchlist": [{"entity":"","type":"","note":""}], "keyFigures": [{"label":"","value":""}] },
    "economics":  { "watchlist": [], "keyFigures": [] },
    "regions":    { "watchlist": [], "keyFigures": [] },
    "occ":        { "watchlist": [], "keyFigures": [] },
    "penalties":  { "watchlist": [], "keyFigures": [] },
    "bis":        { "watchlist": [], "keyFigures": [] }
  }
}

SECTIONS:
1. sanctions  — OFAC, EU, UK/OFSI, UN designations, enforcement, evasion, Russia/Iran/DPRK/Venezuela/Cuba
2. economics  — Markets, inflation, central banks, trade, energy prices
3. regions    — General world & regional news from non-government outlets (AP/BBC/Al Jazeera/Reuters/CNN) not covered by the other five sections
4. occ        — OCC enforcement actions, consent orders, prohibition orders, AML/BSA & sanctions advisories
5. penalties  — FinCEN, AML/BSA fines, OFAC civil penalties, bank settlements
6. bis        — BIS export controls, Entity List, EAR enforcement, semiconductor policy

Write 3-4 articles per section (18-24 total). Each body is an array of 2-3 full editorial paragraphs.
Real current facts from web search only. Include real source names and URLs.

OFAC RECENT ACTIONS — LIVE DATA:
The user message contains entries scraped directly from ofac.treasury.gov/recent-actions.
Each bullet is one action: date, title, and URL. Write one article per entry. Do NOT merge entries.
sourceUrl MUST be the exact URL listed for that entry.
For any entry without enough detail, use Google Search grounding to find more context.

BIS: search site:federalregister.gov "bureau of industry" "entity list" for current month.
Al Jazeera required for Middle East, Iran, Gulf, and Islamic world stories.
AP and CNN no longer publish usable RSS feeds, so when using Google Search grounding, prioritize and cite site:apnews.com and site:cnn.com results for sanctions/enforcement stories where available, alongside Al Jazeera, BBC, and Reuters.

CHINA/HK SANCTIONS — search for:
1. NS-CMIC list (EO 13959 / EO 14032) additions/removals
2. Section 1237 DoD Chinese military companies
3. AVIC, CETC, CASIC, Norinco, CNOOC, SMIC, Hikvision, DJI, SenseTime, BGI
4. Xinjiang XPCC UFLPA forced labor sanctions
5. Hong Kong EO 13936 autonomy sanctions`;

const userMsg = `Today is ${today}.

══ OFAC RECENT ACTIONS (live from ofac.treasury.gov/recent-actions) ══
${recentActionsContext}

Write one article per entry above. sourceUrl = the URL listed. Do NOT merge multiple entries into one article.

══ OFAC CIVIL PENALTIES 2026 (live from ofac.treasury.gov/civil-penalties-and-enforcement-information) ══
${penaltiesContext}

Write one penalties article per entry above (section: "penalties"). Include exact dollar amounts. sourceUrl = https://ofac.treasury.gov/civil-penalties-and-enforcement-information

For BIS: search Federal Register for Entity List additions this month.
Search the web for the latest developments across all six domains. JSON only.`;

// ── Call Gemini ────────────────────────────────────────────────────────────
console.log(`[refresh-briefing] Calling Gemini at ${new Date().toISOString()}...`);
console.log(`[refresh-briefing] Today: ${today}`);
console.log(`[refresh-briefing] Recent actions: ${recentActions.length} entries | Civil penalties: ${civilPenalties.length} rows`);

// Try 3.1-flash-lite first (500 RPD free tier), fall back to 2.5-flash (20 RPD)
const GEMINI_MODELS = [
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash",
];

async function callGemini(model, body) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
  console.log(`[refresh-briefing] Trying model: ${model}`);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res;
}

function buildGeminiBody(model) {
  const generationConfig = { temperature: 0.2, maxOutputTokens: 65536 };
  // gemini-2.5-flash has "thinking" enabled by default, and thinking tokens are
  // drawn from the same maxOutputTokens budget — this can silently eat the whole
  // budget before any visible JSON is written, truncating the response mid-object.
  // Disable thinking for models known to support thinkingConfig.
  if (model.includes("2.5")) {
    generationConfig.thinkingConfig = { thinkingBudget: 0 };
  }
  return {
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: "user", parts: [{ text: userMsg }] }],
    tools: [{ google_search: {} }],
    generationConfig,
  };
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

let geminiRes;
let modelUsed;
for (const model of GEMINI_MODELS) {
  // Each model gets up to 2 attempts — on 429 wait 65s for the RPM window to reset
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      geminiRes = await callGemini(model, buildGeminiBody(model));
      modelUsed = model;
      if (geminiRes.ok) break;
      const err = await geminiRes.text();
      console.error(`[refresh-briefing] ${model} attempt ${attempt} error ${geminiRes.status}: ${err.slice(0, 200)}`);

      if (geminiRes.status === 403) {
        // Key issue — same key for all models, no point retrying anything
        console.error(`[refresh-briefing] 403 on API key — aborting`);
        geminiRes = null;
        break;
      }
      if (geminiRes.status === 429 && attempt === 1) {
        // Rate limit — wait 65s for the per-minute window to reset, then retry same model
        console.warn(`[refresh-briefing] 429 rate limit on ${model} — waiting 65s before retry`);
        await sleep(65_000);
        geminiRes = null;
        continue; // retry same model
      }
      // Other error or second 429 — move to next model
      geminiRes = null;
      break;
    } catch (e) {
      console.error(`[refresh-briefing] ${model} attempt ${attempt} threw:`, e.message);
      geminiRes = null;
      break;
    }
  }
  if (geminiRes?.ok) break; // success — stop trying models
}

if (!geminiRes?.ok) {
  console.warn("[refresh-briefing] All Gemini models failed — saving structured fallback articles");
  const fallback = buildFallbackBriefing(recentActions, civilPenalties, ofsiNotices, europaNews, unNotices, bbcNews, ajNews, occNews, economicsNews, bisNews, regionsNews);
  if (fallback.articles.length === 0) {
    console.error("[refresh-briefing] No OFAC data fetched either — nothing to save");
    process.exit(1);
  }
  console.log(`[refresh-briefing] Fallback: ${fallback.articles.length} structured articles from scraped OFAC data`);
  await saveBriefingWithRetry(fallback, true);
  process.exit(0);
}
console.log(`[refresh-briefing] Using model: ${modelUsed}`);

const geminiData = await geminiRes.json();
const rawText = geminiData.candidates
  ?.flatMap(c => c.content?.parts ?? [])
  .map(p => p.text ?? "")
  .join("")
  .trim() ?? "";

console.log(`[refresh-briefing] Gemini responded — ${rawText.length} chars`);
console.log(`[refresh-briefing] candidates: ${geminiData.candidates?.length ?? 0}, finishReason: ${geminiData.candidates?.[0]?.finishReason ?? "n/a"}, promptFeedback: ${JSON.stringify(geminiData.promptFeedback ?? {})}`);
if (geminiData.usageMetadata) {
  console.log(`[refresh-briefing] usage — prompt: ${geminiData.usageMetadata.promptTokenCount}, candidates: ${geminiData.usageMetadata.candidatesTokenCount}, total: ${geminiData.usageMetadata.totalTokenCount}`);
}

// ── Parse briefing JSON ────────────────────────────────────────────────────
const clean = rawText.replace(/```json|```/g, "").trim();
const s = clean.indexOf("{");
const e = clean.lastIndexOf("}");
if (s === -1 || e === -1) {
  console.error("[refresh-briefing] Could not find JSON in Gemini response — falling back to structured articles");
  console.error(`[refresh-briefing] finishReason was: ${geminiData.candidates?.[0]?.finishReason ?? "n/a"}`);
  console.error("Raw text (first 500 chars):", rawText.slice(0, 500));
  console.error("Raw text (last 500 chars):", rawText.slice(-500));
  const fallback = buildFallbackBriefing(recentActions, civilPenalties, ofsiNotices, europaNews, unNotices, bbcNews, ajNews, occNews, economicsNews, bisNews, regionsNews);
  if (fallback.articles.length > 0) {
    await saveBriefingWithRetry(fallback, true);
    process.exit(0);
  }
  process.exit(1);
}

function parseGeminiJSON(text) {
  // Attempt 1: parse as-is
  try { return JSON.parse(text); } catch (_) {}
  // Attempt 2: strip control chars that break JSON string literals
  // (\n \r \t must be escaped inside strings; they're valid whitespace BETWEEN tokens)
  // Strategy: replace every raw control char globally with a space —
  // JSON structural whitespace tolerates spaces, and string content loses
  // line breaks but stays readable.
  try { return JSON.parse(text.replace(/[\x00-\x1F\x7F]/g, " ")); } catch (_) {}
  // Attempt 3: also collapse runs of whitespace
  try { return JSON.parse(text.replace(/[\x00-\x1F\x7F]+/g, " ")); } catch (e) {
    throw e; // surface the final error
  }
}

// The JSON schema in SYSTEM_PROMPT necessarily shows an illustrative example
// value for "lastUpdated" (e.g. "June 14, 2026 — 14:00 UTC") so Gemini knows
// the expected format. In practice Gemini sometimes parrots that literal
// example back verbatim instead of substituting the real current time —
// this is what caused the app to show a frozen, wrong "June 14, 2026" date
// regardless of when the workflow actually ran. Rather than fight this with
// prompt wording, just never trust Gemini's self-reported timestamp: always
// stamp lastUpdated ourselves from the real clock right before saving.
function formatLastUpdatedUtc() {
  const d = new Date();
  const datePart = d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  const timePart = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" });
  return `${datePart} — ${timePart} UTC`;
}

let briefing;
try {
  briefing = parseGeminiJSON(clean.slice(s, e + 1));
  briefing.articles = briefing.articles.map(a => ({
    ...a,
    body: Array.isArray(a.body) ? a.body : String(a.body).split("\n").filter(Boolean),
  }));
  briefing.lastUpdated = `${formatLastUpdatedUtc()} [Gemini/Actions]`;
} catch (parseErr) {
  console.error("[refresh-briefing] JSON parse failed — falling back to structured articles:", parseErr);
  console.error("Raw text slice:", clean.slice(s, s + 500));
  const fallback = buildFallbackBriefing(recentActions, civilPenalties, ofsiNotices, europaNews, unNotices, bbcNews, ajNews, occNews, economicsNews, bisNews, regionsNews);
  if (fallback.articles.length > 0) {
    await saveBriefingWithRetry(fallback, true);
    process.exit(0);
  }
  process.exit(1);
}

console.log(`[refresh-briefing] Parsed ${briefing.articles?.length ?? 0} articles, lastUpdated: ${briefing.lastUpdated}`);

// Log OFAC articles found
const ofacArticles = briefing.articles?.filter(a =>
  a.sourceUrl?.includes("ofac.treasury.gov/recent-actions/")
) ?? [];
console.log(`[refresh-briefing] OFAC recent-action articles: ${ofacArticles.length}`);
ofacArticles.forEach(a => console.log(`  → ${a.date}: ${a.headline} (${a.sourceUrl})`));

// ── Inject any recent-action articles Gemini missed (dedup by sourceUrl) ───
const coveredUrls = new Set(
  (briefing.articles ?? []).map(a => a.sourceUrl).filter(Boolean)
);
const missingEntries = recentActions.filter(e => !coveredUrls.has(e.url));
if (missingEntries.length > 0) {
  console.log(`[refresh-briefing] Injecting ${missingEntries.length} recent-action entries Gemini missed`);
  const baseId = (briefing.articles?.length ?? 0) + 1;
  const injected = missingEntries.map((entry, i) => ({
    id: baseId + i,
    section: "sanctions",
    category: "OFAC",
    region: "United States",
    impact: "high",
    date: entry.date || "",
    headline: entry.title,
    body: [
      `OFAC published a new action on ${entry.date || "an unspecified date"}: "${entry.title}". Full details are available at the official OFAC website.`,
    ],
    source: "OFAC Recent Actions",
    sourceUrl: entry.url,
  }));
  briefing.articles = [...(briefing.articles ?? []), ...injected];
  console.log(`[refresh-briefing] Total articles after injection: ${briefing.articles.length}`);
}

// ── Inject OFSI (UK) + EU sanctions entries Gemini didn't cover (dedup by ──
// sourceUrl). This guarantees EU/OFSI articles appear in the sanctions
// section on every run, regardless of whether Gemini happened to surface
// them via Google Search grounding. No Gemini call — pure merge of the
// direct scrapes performed earlier in this script.
function injectExtra(entries, mapper) {
  const extra = entries.filter(e => !coveredUrls.has(e.url));
  extra.forEach(e => coveredUrls.add(e.url));
  return extra.map(mapper);
}

const ofsiInjected = injectExtra(ofsiNotices, entry => ({
  section: "sanctions",
  category: "OFSI",
  region: "United Kingdom",
  impact: "medium",
  date: entry.date || "",
  headline: entry.title,
  body: [
    `The UK's Office of Financial Sanctions Implementation (OFSI) published: "${entry.title}". Full details are available on GOV.UK.`,
  ],
  source: "OFSI (GOV.UK)",
  sourceUrl: entry.url,
}));

const europaInjected = injectExtra(europaNews, entry => ({
  section: "sanctions",
  category: "EU",
  region: "European Union",
  impact: "medium",
  date: entry.date || "",
  headline: entry.title,
  body: [
    entry.description || `The European Commission (DG FISMA) published: "${entry.title}". Full details are available on finance.ec.europa.eu.`,
  ],
  source: "European Commission — Finance News",
  sourceUrl: entry.url,
}));

const unInjected = injectExtra(unNotices, entry => ({
  section: "sanctions",
  category: "UN",
  region: "International",
  impact: "medium",
  date: entry.date || "",
  headline: entry.title,
  body: [
    entry.description || `The United Nations published: "${entry.title}". Full details are available on press.un.org.`,
  ],
  source: "United Nations — Press Releases",
  sourceUrl: entry.url,
}));

const bbcInjected = injectExtra(bbcNews, entry => ({
  section: "sanctions",
  category: "News",
  region: "International",
  impact: "medium",
  date: entry.date || "",
  headline: entry.title,
  body: [
    entry.description || `BBC News reported: "${entry.title}".`,
  ],
  source: "BBC News",
  sourceUrl: entry.url,
}));

const ajInjected = injectExtra(ajNews, entry => ({
  section: "sanctions",
  category: "News",
  region: "International",
  impact: "medium",
  date: entry.date || "",
  headline: entry.title,
  body: [
    entry.description || `Al Jazeera reported: "${entry.title}".`,
  ],
  source: "Al Jazeera",
  sourceUrl: entry.url,
}));

const occInjected = injectExtra(occNews, entry => ({
  section: "occ",
  category: "OCC",
  region: "United States",
  impact: "high",
  date: entry.date || "",
  headline: entry.title,
  body: [
    entry.description || `The Office of the Comptroller of the Currency (OCC) published: "${entry.title}". Full details are available on occ.gov.`,
  ],
  source: "OCC News Releases",
  sourceUrl: entry.url,
}));

const economicsInjected = injectExtra(economicsNews, entry => ({
  section: "economics",
  category: "Federal Reserve",
  region: "United States",
  impact: "medium",
  date: entry.date || "",
  headline: entry.title,
  body: [
    entry.description || `The Federal Reserve published: "${entry.title}". Full details are available on federalreserve.gov.`,
  ],
  source: "Federal Reserve — Press Releases",
  sourceUrl: entry.url,
}));

const bisInjected = injectExtra(bisNews, entry => ({
  section: "bis",
  category: "BIS",
  region: "United States",
  impact: "high",
  date: entry.date || "",
  headline: entry.title,
  body: [
    entry.description || `The Bureau of Industry and Security (BIS) published: "${entry.title}". Full details are available on federalregister.gov.`,
  ],
  source: "Federal Register — BIS",
  sourceUrl: entry.url,
}));

// General world/regional news (non-sanctions BBC/Al Jazeera coverage) →
// regions articles. Added 2026-06-19 so Gemini-success runs also inject
// real non-government news into Regions, not just the fallback path.
const regionsInjected = injectExtra(regionsNews, entry => ({
  section: "regions",
  category: "World News",
  region: "International",
  impact: "medium",
  date: entry.date || "",
  headline: entry.title,
  body: [
    entry.description || `${entry.title}`,
  ],
  source: entry.url?.includes("bbc.co") ? "BBC News" : "Al Jazeera",
  sourceUrl: entry.url,
}));

const extraInjected = [...ofsiInjected, ...europaInjected, ...unInjected, ...bbcInjected, ...ajInjected, ...occInjected, ...economicsInjected, ...bisInjected, ...regionsInjected];
if (extraInjected.length > 0) {
  const baseId2 = (briefing.articles?.length ?? 0) + 1;
  extraInjected.forEach((a, i) => { a.id = baseId2 + i; });
  briefing.articles = [...(briefing.articles ?? []), ...extraInjected];
  console.log(`[refresh-briefing] Injected ${ofsiInjected.length} OFSI + ${europaInjected.length} EU + ${unInjected.length} UN + ${bbcInjected.length} BBC + ${ajInjected.length} Al Jazeera + ${occInjected.length} OCC + ${economicsInjected.length} Fed + ${bisInjected.length} BIS + ${regionsInjected.length} Regions entries — total articles: ${briefing.articles.length}`);
}

// ── POST to /api/save-briefing (retry once on failure) ─────────────────────
// merge=true: keep articles from sections NOT covered by this payload (used for fallback).
// merge=false (default): full replace — used when Gemini succeeds and covers all sections.
async function trySaveBriefing(payload, merge = false) {
  const saveRes = await fetch(`${APP_URL}/api/save-briefing`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-save-secret": SAVE_SECRET,
    },
    body: JSON.stringify({ ...payload, merge }),
  });
  const saveData = await saveRes.json().catch(() => ({}));
  return { saveRes, saveData };
}

async function saveBriefingWithRetry(payload, merge = false) {
  console.log(`[refresh-briefing] Saving to ${APP_URL}/api/save-briefing (merge=${merge}) ...`);
  let { saveRes, saveData } = await trySaveBriefing(payload, merge);
  if (!saveRes.ok || !saveData.ok) {
    console.warn(`[refresh-briefing] Save attempt 1 failed (${saveRes.status}): ${JSON.stringify(saveData)} — retrying in 5s`);
    await new Promise(r => setTimeout(r, 5000));
    ({ saveRes, saveData } = await trySaveBriefing(payload, merge));
  }
  if (!saveRes.ok || !saveData.ok) {
    console.error(`[refresh-briefing] Save failed after retry (${saveRes.status}): ${JSON.stringify(saveData)}`);
    console.error(`[refresh-briefing] Briefing had ${payload.articles?.length} articles, lastUpdated: ${payload.lastUpdated}`);
    process.exit(1);
  }
  console.log(`[refresh-briefing] ✅ Saved — ${saveData.articleCount} articles, lastUpdated: ${saveData.lastUpdated}`);
}

await saveBriefingWithRetry(briefing);
