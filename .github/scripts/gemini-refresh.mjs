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

// 1. Parse recent-actions listing to extract entry titles + URLs (avoids fetching each date page)
function parseRecentActions(html) {
  const entries = [];
  // Each entry: <a href="/recent-actions/YYYYMMDD...">Title</a> followed by date text
  const linkRe = /href="(https?:\/\/ofac\.treasury\.gov\/recent-actions\/(\d{8}[^"]*))">([^<]+)<\/a>/g;
  const dateRe = /(\w+ \d+, \d{4})/;
  let m;
  // Also capture surrounding text for date
  const blocks = html.split(/<\/li>|<\/p>/);
  for (const block of blocks) {
    // Match both absolute (https://ofac...) and relative (/recent-actions/...) hrefs
    const lm = /href="(?:https:\/\/ofac\.treasury\.gov)?(\/recent-actions\/(\d{8}[^"]*))">([^<]+)<\/a>/.exec(block);
    if (!lm) continue;
    const dm = dateRe.exec(stripHtml(block));
    const url = `https://ofac.treasury.gov${lm[1]}`;
    entries.push({ url, code: lm[2], title: lm[3].trim(), date: dm?.[1] ?? "" });
  }
  return entries;
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
    "religion":   { "watchlist": [], "keyFigures": [] },
    "occ":        { "watchlist": [], "keyFigures": [] },
    "penalties":  { "watchlist": [], "keyFigures": [] },
    "bis":        { "watchlist": [], "keyFigures": [] }
  }
}

SECTIONS:
1. sanctions  — OFAC, EU, UK/OFSI, UN designations, enforcement, evasion, Russia/Iran/DPRK/Venezuela/Cuba
2. economics  — Markets, inflation, central banks, trade, energy prices
3. religion   — Vatican/papacy, interfaith, faith & politics, global trends
4. occ        — OCC enforcement actions, consent orders, prohibition orders
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
console.log(`[gemini-refresh] Calling Gemini at ${new Date().toISOString()}...`);
console.log(`[gemini-refresh] Today: ${today}`);
console.log(`[gemini-refresh] Recent actions: ${recentActions.length} entries | Civil penalties: ${civilPenalties.length} rows`);

// Try 2.5-flash first (better quality + grounding), fall back to 2.0-flash
const GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
];

async function callGemini(model, body) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
  console.log(`[gemini-refresh] Trying model: ${model}`);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res;
}

const geminiBody = {
  system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
  contents: [{ role: "user", parts: [{ text: userMsg }] }],
  tools: [{ google_search: {} }],
  generationConfig: { temperature: 0.2, maxOutputTokens: 8192 },
};

let geminiRes;
let modelUsed;
for (const model of GEMINI_MODELS) {
  try {
    geminiRes = await callGemini(model, geminiBody);
    modelUsed = model;
    if (geminiRes.ok) break;
    const err = await geminiRes.text();
    console.error(`[gemini-refresh] ${model} error ${geminiRes.status}: ${err.slice(0, 300)}`);
    // reset body text for retry (response body consumed)
    geminiRes = null;
  } catch (e) {
    console.error(`[gemini-refresh] ${model} fetch threw:`, e.message);
    geminiRes = null;
  }
}

if (!geminiRes?.ok) {
  console.error("[gemini-refresh] All Gemini models failed — exiting");
  process.exit(1);
}
console.log(`[gemini-refresh] Using model: ${modelUsed}`);

const geminiData = await geminiRes.json();
const rawText = geminiData.candidates
  ?.flatMap(c => c.content?.parts ?? [])
  .map(p => p.text ?? "")
  .join("")
  .trim() ?? "";

console.log(`[gemini-refresh] Gemini responded — ${rawText.length} chars`);

// ── Parse briefing JSON ────────────────────────────────────────────────────
const clean = rawText.replace(/```json|```/g, "").trim();
const s = clean.indexOf("{");
const e = clean.lastIndexOf("}");
if (s === -1 || e === -1) {
  console.error("[gemini-refresh] Could not find JSON in Gemini response");
  console.error("Raw text:", rawText.slice(0, 500));
  process.exit(1);
}

let briefing;
try {
  briefing = JSON.parse(clean.slice(s, e + 1));
  briefing.articles = briefing.articles.map(a => ({
    ...a,
    body: Array.isArray(a.body) ? a.body : String(a.body).split("\n").filter(Boolean),
  }));
  briefing.lastUpdated += " [Gemini/Actions]";
} catch (parseErr) {
  console.error("[gemini-refresh] JSON parse failed:", parseErr);
  console.error("Raw text slice:", clean.slice(s, s + 500));
  process.exit(1);
}

console.log(`[gemini-refresh] Parsed ${briefing.articles?.length ?? 0} articles, lastUpdated: ${briefing.lastUpdated}`);

// Log OFAC articles found
const ofacArticles = briefing.articles?.filter(a =>
  a.sourceUrl?.includes("ofac.treasury.gov/recent-actions/")
) ?? [];
console.log(`[gemini-refresh] OFAC recent-action articles: ${ofacArticles.length}`);
ofacArticles.forEach(a => console.log(`  → ${a.date}: ${a.headline} (${a.sourceUrl})`));

// ── POST to /api/save-briefing (retry once on failure) ─────────────────────
console.log(`[gemini-refresh] Saving to ${APP_URL}/api/save-briefing ...`);

async function trySave() {
  const saveRes = await fetch(`${APP_URL}/api/save-briefing`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-save-secret": SAVE_SECRET,
    },
    body: JSON.stringify(briefing),
  });
  const saveData = await saveRes.json().catch(() => ({}));
  return { saveRes, saveData };
}

let { saveRes, saveData } = await trySave();

if (!saveRes.ok || !saveData.ok) {
  console.warn(`[gemini-refresh] Save attempt 1 failed (${saveRes.status}): ${JSON.stringify(saveData)} — retrying in 5s`);
  await new Promise(r => setTimeout(r, 5000));
  ({ saveRes, saveData } = await trySave());
}

if (!saveRes.ok || !saveData.ok) {
  console.error(`[gemini-refresh] Save failed after retry (${saveRes.status}): ${JSON.stringify(saveData)}`);
  // Log briefing summary so we know what would have been saved
  console.error(`[gemini-refresh] Briefing had ${briefing.articles?.length} articles, lastUpdated: ${briefing.lastUpdated}`);
  process.exit(1);
}

console.log(`[gemini-refresh] ✅ Saved successfully — ${saveData.articleCount} articles, lastUpdated: ${saveData.lastUpdated}`);
