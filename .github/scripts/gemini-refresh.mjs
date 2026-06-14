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

// ── Fetch OFAC recent-actions pages directly (GitHub Actions IPs not blocked) ─
// ofac.treasury.gov returns 403 from Cloudflare IPs, but GitHub Actions can reach it.
// URL pattern: /recent-actions/YYYYMMDD, /YYYYMMDD_33, /YYYYMMDD_66 (multiple actions/day)
const ofacDates = Array.from({ length: 7 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() - i);
  return d.getFullYear().toString() +
    String(d.getMonth() + 1).padStart(2, "0") +
    String(d.getDate()).padStart(2, "0");
});

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const ofacPages = [];
console.log(`[gemini-refresh] Fetching OFAC recent-actions pages for ${ofacDates.length} days...`);
for (const code of ofacDates) {
  for (const suffix of ["", "_33", "_66"]) {
    const url = `https://ofac.treasury.gov/recent-actions/${code}${suffix}`;
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(10000),
        headers: { "User-Agent": "Mozilla/5.0 (compatible; sanctions-monitor/1.0; +https://github.com)" },
      });
      if (res.ok) {
        const html = await res.text();
        const text = stripHtml(html);
        if (text.length > 300) {
          ofacPages.push({ url, text: text.slice(0, 3000) });
          console.log(`[gemini-refresh] ✅ OFAC ${url}: ${text.length} chars`);
        }
      } else if (res.status !== 404) {
        console.warn(`[gemini-refresh] OFAC ${url}: HTTP ${res.status}`);
      }
    } catch (e) {
      console.warn(`[gemini-refresh] OFAC ${url}: ${e.message}`);
    }
  }
}
console.log(`[gemini-refresh] OFAC pages fetched: ${ofacPages.length} (of up to ${ofacDates.length * 3})`);

const ofacContext = ofacPages.length > 0
  ? ofacPages.map(p => `\n--- ${p.url} ---\n${p.text}`).join("\n")
  : "No OFAC pages accessible — use Google Search grounding to find recent OFAC actions.";

const ofacUrls = ofacPages.map(p => p.url).join("\n  ");

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

OFAC RECENT ACTIONS — PRE-FETCHED CONTENT:
The user message contains the raw text of ofac.treasury.gov/recent-actions/YYYYMMDD pages fetched directly.
URL pattern: /YYYYMMDD = first action, /YYYYMMDD_33 = second, /YYYYMMDD_66 = third action on same date.
For every OFAC action article, sourceUrl MUST be the exact /recent-actions/YYYYMMDD URL from the fetched content.
Write one article per distinct OFAC action found. Do NOT merge multiple actions into one article.
If no pages were fetched, use Google Search: site:ofac.treasury.gov/recent-actions

BIS: search site:federalregister.gov "bureau of industry" "entity list" for current month.
Al Jazeera required for Middle East, Iran, Gulf, and Islamic world stories.

CHINA/HK SANCTIONS — search for:
1. NS-CMIC list (EO 13959 / EO 14032) additions/removals
2. Section 1237 DoD Chinese military companies
3. AVIC, CETC, CASIC, Norinco, CNOOC, SMIC, Hikvision, DJI, SenseTime, BGI
4. Xinjiang XPCC UFLPA forced labor sanctions
5. Hong Kong EO 13936 autonomy sanctions`;

const userMsg = `Today is ${today}.

══ OFAC RECENT ACTIONS — RAW PAGE CONTENT (directly fetched) ══
${ofacContext}

For each OFAC action page above: write one article per distinct action. Use the page URL as sourceUrl.
If a page was not accessible, use Google Search grounding: search "site:ofac.treasury.gov/recent-actions" to find actions.

For BIS: search Federal Register for Entity List additions this month.
Search the web for the latest developments across all six domains. JSON only.`;

// ── Call Gemini ────────────────────────────────────────────────────────────
console.log(`[gemini-refresh] Calling Gemini at ${new Date().toISOString()}...`);
console.log(`[gemini-refresh] Today: ${today}`);
console.log(`[gemini-refresh] OFAC URLs: checking ${ofacDates.length} dates (${ofacDates.length * 3} URLs)`);

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
