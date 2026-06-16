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

// ── Commit scraped OFAC data to repo as a cache file ──────────────────────
// The app (CF Workers) can't reach ofac.treasury.gov directly (IP blocked).
// Committing to the repo lets the app read fresh OFAC data via raw.githubusercontent.com.
async function commitOfacCache(recentActions, civilPenalties) {
  if (!GITHUB_TOKEN || !GITHUB_REPO) {
    console.warn("[ofac-cache] Missing GITHUB_TOKEN or GITHUB_REPOSITORY — skipping cache commit");
    return;
  }
  const path = "data/ofac-cache.json";
  const content = JSON.stringify({
    updatedAt: new Date().toISOString(),
    recentActions,
    civilPenalties,
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
    console.log(`[ofac-cache] ✅ Committed ${recentActions.length} recent-actions + ${civilPenalties.length} penalties to ${path}`);
  } else {
    const err = await res.text();
    console.warn(`[ofac-cache] Commit failed (${res.status}): ${err.slice(0, 200)}`);
  }
}

await commitOfacCache(recentActions, civilPenalties);

// ── Build fallback briefing from scraped data (when Gemini fails) ──────────
function buildFallbackBriefing(recentActions, civilPenalties) {
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

  const emptySection = { watchlist: [], keyFigures: [] };
  return {
    lastUpdated: `${nowStr} — Official government sources [Structured/Actions]`,
    articles,
    sidebar: {
      sanctions: emptySection,
      economics: emptySection,
      religion:  emptySection,
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

// Try 3.1-flash-lite first (500 RPD free tier), fall back to 2.5-flash (20 RPD)
const GEMINI_MODELS = [
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash",
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

const sleep = ms => new Promise(r => setTimeout(r, ms));

let geminiRes;
let modelUsed;
for (const model of GEMINI_MODELS) {
  // Each model gets up to 2 attempts — on 429 wait 65s for the RPM window to reset
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      geminiRes = await callGemini(model, geminiBody);
      modelUsed = model;
      if (geminiRes.ok) break;
      const err = await geminiRes.text();
      console.error(`[gemini-refresh] ${model} attempt ${attempt} error ${geminiRes.status}: ${err.slice(0, 200)}`);

      if (geminiRes.status === 403) {
        // Key issue — same key for all models, no point retrying anything
        console.error(`[gemini-refresh] 403 on API key — aborting`);
        geminiRes = null;
        break;
      }
      if (geminiRes.status === 429 && attempt === 1) {
        // Rate limit — wait 65s for the per-minute window to reset, then retry same model
        console.warn(`[gemini-refresh] 429 rate limit on ${model} — waiting 65s before retry`);
        await sleep(65_000);
        geminiRes = null;
        continue; // retry same model
      }
      // Other error or second 429 — move to next model
      geminiRes = null;
      break;
    } catch (e) {
      console.error(`[gemini-refresh] ${model} attempt ${attempt} threw:`, e.message);
      geminiRes = null;
      break;
    }
  }
  if (geminiRes?.ok) break; // success — stop trying models
}

if (!geminiRes?.ok) {
  console.warn("[gemini-refresh] All Gemini models failed — saving structured fallback articles");
  const fallback = buildFallbackBriefing(recentActions, civilPenalties);
  if (fallback.articles.length === 0) {
    console.error("[gemini-refresh] No OFAC data fetched either — nothing to save");
    process.exit(1);
  }
  console.log(`[gemini-refresh] Fallback: ${fallback.articles.length} structured articles from scraped OFAC data`);
  await saveBriefingWithRetry(fallback);
  process.exit(0);
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
  console.error("[gemini-refresh] Could not find JSON in Gemini response — falling back to structured articles");
  console.error("Raw text:", rawText.slice(0, 500));
  const fallback = buildFallbackBriefing(recentActions, civilPenalties);
  if (fallback.articles.length > 0) {
    await saveBriefingWithRetry(fallback);
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

let briefing;
try {
  briefing = parseGeminiJSON(clean.slice(s, e + 1));
  briefing.articles = briefing.articles.map(a => ({
    ...a,
    body: Array.isArray(a.body) ? a.body : String(a.body).split("\n").filter(Boolean),
  }));
  briefing.lastUpdated += " [Gemini/Actions]";
} catch (parseErr) {
  console.error("[gemini-refresh] JSON parse failed — falling back to structured articles:", parseErr);
  console.error("Raw text slice:", clean.slice(s, s + 500));
  const fallback = buildFallbackBriefing(recentActions, civilPenalties);
  if (fallback.articles.length > 0) {
    await saveBriefingWithRetry(fallback);
    process.exit(0);
  }
  process.exit(1);
}

console.log(`[gemini-refresh] Parsed ${briefing.articles?.length ?? 0} articles, lastUpdated: ${briefing.lastUpdated}`);

// Log OFAC articles found
const ofacArticles = briefing.articles?.filter(a =>
  a.sourceUrl?.includes("ofac.treasury.gov/recent-actions/")
) ?? [];
console.log(`[gemini-refresh] OFAC recent-action articles: ${ofacArticles.length}`);
ofacArticles.forEach(a => console.log(`  → ${a.date}: ${a.headline} (${a.sourceUrl})`));

// ── Inject any recent-action articles Gemini missed (dedup by sourceUrl) ───
const coveredUrls = new Set(
  (briefing.articles ?? []).map(a => a.sourceUrl).filter(Boolean)
);
const missingEntries = recentActions.filter(e => !coveredUrls.has(e.url));
if (missingEntries.length > 0) {
  console.log(`[gemini-refresh] Injecting ${missingEntries.length} recent-action entries Gemini missed`);
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
  console.log(`[gemini-refresh] Total articles after injection: ${briefing.articles.length}`);
}

// ── POST to /api/save-briefing (retry once on failure) ─────────────────────
async function trySaveBriefing(payload) {
  const saveRes = await fetch(`${APP_URL}/api/save-briefing`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-save-secret": SAVE_SECRET,
    },
    body: JSON.stringify(payload),
  });
  const saveData = await saveRes.json().catch(() => ({}));
  return { saveRes, saveData };
}

async function saveBriefingWithRetry(payload) {
  console.log(`[gemini-refresh] Saving to ${APP_URL}/api/save-briefing ...`);
  let { saveRes, saveData } = await trySaveBriefing(payload);
  if (!saveRes.ok || !saveData.ok) {
    console.warn(`[gemini-refresh] Save attempt 1 failed (${saveRes.status}): ${JSON.stringify(saveData)} — retrying in 5s`);
    await new Promise(r => setTimeout(r, 5000));
    ({ saveRes, saveData } = await trySaveBriefing(payload));
  }
  if (!saveRes.ok || !saveData.ok) {
    console.error(`[gemini-refresh] Save failed after retry (${saveRes.status}): ${JSON.stringify(saveData)}`);
    console.error(`[gemini-refresh] Briefing had ${payload.articles?.length} articles, lastUpdated: ${payload.lastUpdated}`);
    process.exit(1);
  }
  console.log(`[gemini-refresh] ✅ Saved — ${saveData.articleCount} articles, lastUpdated: ${saveData.lastUpdated}`);
}

await saveBriefingWithRetry(briefing);
