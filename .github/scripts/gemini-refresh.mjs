/**
 * gemini-refresh.mjs
 * Runs from GitHub Actions — no CF 30s wall-clock limit here.
 * 1. Calls Gemini 2.0 Flash with Google Search grounding
 * 2. POSTs the briefing JSON to /api/save-briefing on the CF app
 *
 * Required env vars (GitHub secrets):
 *   GEMINI_API_KEY      — same key used in CF env vars
 *   APP_URL             — e.g. https://global-report-cf.pages.dev
 *   SAVE_BRIEFING_SECRET — shared secret, must match CF env var
 */

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
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
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
    const numMatch = /(?:General\s+License|GL)[^#\d]*#?\s*(?:No\.?\s*)?(\d+[A-Z]?)/i.exec(linkText);
    if (!numMatch) continue;
    const surrounding = stripHtml(html.slice(Math.max(0, mm.index - 300), mm.index + mm[0].length + 300));
    const dateMatch = /(\w+ \d{1,2},? \d{4})/i.exec(surrounding);
    generalLicenses.push({ number: numMatch[1], title: linkText, date: dateMatch?.[1] ?? "", url });
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
    const progMatch = /href="(\/sanctions-programs-and-country-information\/([^"?#]+))"[^>]*>([^<]{3,200})<\/a>/i.exec(rowHtml);
    if (!progMatch) continue;
    const slug = progMatch[2];
    if (['where-is-ofac', 'archive', 'information'].some(s => slug.includes(s))) continue;
    const dateMatch = /href="\/recent-actions\/\d{8}[^"]*"[^>]*>([^<]+)<\/a>/i.exec(rowHtml);
    programs.push({
      slug,
      name: stripHtml(progMatch[3]).trim(),
      url: `https://ofac.treasury.gov${progMatch[1]}`,
      lastUpdated: dateMatch ? stripHtml(dateMatch[1]).trim() : "",
    });
  }
  return programs;
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
      rows.push({ date: cells[0], name: cells[1], count: cells[2], amount: cells[3], pdfUrl: linkMatch?.[1] ?? "" });
    }
  }
  return rows;
}

console.log("[gemini-refresh] Fetching OFAC recent-actions listing...");
const recentActionsHtml = await fetchOfac("https://ofac.treasury.gov/recent-actions");
const recentActions = recentActionsHtml ? parseRecentActions(recentActionsHtml) : [];
console.log(`[gemini-refresh] Recent actions parsed: ${recentActions.length} entries`);
recentActions.slice(0, 10).forEach(e => console.log(`  ${e.date} — ${e.title} (${e.url})`));

console.log("[gemini-refresh] Fetching OFAC civil penalties page...");
const penaltiesHtml = await fetchOfac("https://ofac.treasury.gov/civil-penalties-and-enforcement-information");
const civilPenalties = penaltiesHtml ? parseCivilPenalties(penaltiesHtml) : [];
console.log(`[gemini-refresh] Civil penalties parsed: ${civilPenalties.length} rows`);
civilPenalties.forEach(r => console.log(`  ${r.date} — ${r.name}: $${r.amount}`));

// ── Scrape all OFAC program pages (change-detection via index) ────────────
console.log("[gemini-refresh] Fetching OFAC programs index...");
const programsIndexHtml = await fetchOfac("https://ofac.treasury.gov/sanctions-programs-and-country-information");
const programsList = programsIndexHtml ? parseProgramsIndex(programsIndexHtml) : [];
console.log(`[gemini-refresh] Programs index: ${programsList.length} programs found`);

// Load existing cache for change detection
const existingCache = await loadExistingCache();
const cachedPrograms = existingCache?.programs ?? {};

// Fetch only programs whose lastUpdated date changed (cap at 15 per run)
const changedPrograms = programsList.filter(p =>
  p.lastUpdated && p.lastUpdated !== (cachedPrograms[p.slug]?.lastUpdated ?? "")
).slice(0, 15);

console.log(`[gemini-refresh] Programs with changes: ${changedPrograms.length} (of ${programsList.length} total)`);
changedPrograms.forEach(p =>
  console.log(`  ${p.slug}: ${cachedPrograms[p.slug]?.lastUpdated ?? "(new)"} → ${p.lastUpdated}`)
);

// Fetch and