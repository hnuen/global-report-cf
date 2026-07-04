/**
 * Google Gemini Provider
 *
 * Free tier: 15 requests/minute, 1,500 requests/day
 * Model: gemini-2.0-flash (best for web search + speed)
 *
 * Setup:
 *   1. Go to aistudio.google.com
 *   2. Click "Get API key" → Create API key
 *   3. Add to Vercel: vercel env add GEMINI_API_KEY
 *
 * Gemini uses Google Search grounding for real-time web data.
 */

import type { LLMProvider, Briefing } from "./types";
import { getTracker } from "./usage-tracker";

const SYSTEM_PROMPT = `You are a senior intelligence editor. Search the web for the very latest news across six domains and write a complete, sourced briefing.

Return ONLY valid JSON — no markdown fences, no preamble, no trailing text:

{
  "lastUpdated": "May 23, 2026 — 14:00 UTC",
  "articles": [
    {
      "id": 1,
      "section": "sanctions",
      "category": "OFAC",
      "region": "Iran",
      "impact": "high",
      "date": "May 23, 2026",
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
4. occ        — OCC enforcement actions, consent orders, prohibition orders
5. penalties  — FinCEN, AML/BSA fines, OFAC civil penalties, bank settlements
6. bis        — BIS export controls, Entity List, EAR enforcement, semiconductor policy

Aim for 3-4 articles per section (18-24 total) when real news supports it — but NEVER invent a
"nothing happened" filler article just to hit that count (e.g. "Federal Register Shows No New
Entity List Additions This Month," "No New OFAC Designations Today"). If genuine new
developments for a sub-topic are thin, write fewer articles in that section instead, or cover a
related real story in its place. A section with only 1-2 real articles is correct; a non-event
dressed up as an article is not.

CRITICAL — NEW ACTIONS ONLY: Every article must report a NEW, SPECIFIC event that occurred recently (a new designation, a new enforcement action, a new GL, a new EO, a new penalty, a new regulatory change). Do NOT write articles about ongoing/standing sanctions regimes, background on existing programs, or general "the U.S. continues to sanction X" descriptions — those are not news. If no new action occurred in a category this week, omit it rather than writing background context.

FORBIDDEN SOURCES: Never use Wikipedia, Investopedia, or other encyclopedic/reference sites as a sourceUrl. Only use primary government sources (treasury.gov, ofac.treasury.gov, federalregister.gov, bis.doc.gov, occ.gov, fincen.gov, state.gov, commerce.gov, eur-lex.europa.eu, gov.uk) or major wire services (reuters.com, apnews.com, bbc.com) as sourceUrls.

Each body is an array of 2-3 full editorial paragraphs.
Real current facts from web search only. Include real source names and URLs.

OFAC RECENT ACTIONS — EXACT URL PATTERN (mandatory, use every run):
OFAC publishes every action at: https://ofac.treasury.gov/recent-actions/YYYYMMDD
  — First action on a date:  /YYYYMMDD        e.g. /20260611
  — Second action same day:  /YYYYMMDD_33     e.g. /20260601_33
  — Third action same day:   /YYYYMMDD_66     e.g. /20260601_66
These pages are indexed by Google. The exact URLs are injected into the user message.

REQUIRED searches for sanctions section:
  1. site:ofac.treasury.gov/recent-actions — shows all indexed action pages with full titles
  2. site:ofac.treasury.gov "recent-actions/202606" — current month
  3. OFAC designations sanctions SDN "June 2026" treasury
For every article about an OFAC action, sourceUrl MUST be the /recent-actions/YYYYMMDD URL, not the listing page.

BIS SEARCH: BIS publishes Entity List additions to the Federal Register multiple times per month — there are ALWAYS recent additions. For the bis section you MUST actively search:
1. site:federalregister.gov "bureau of industry" "entity list" [current month] [current year]
2. "BIS entity list" additions [current month year]
3. BIS export enforcement action [current year]
4. "export controls" semiconductor chip China [current month year]
5. site:bis.doc.gov [current month year]
Do NOT rely on general BIS knowledge — search specifically for Federal Register Entity List notices from the last 14 days.

Al Jazeera is required for Middle East, Iran, Gulf, and Islamic world stories.

CHINA/HK SANCTIONS — MANDATORY SEARCH (for China/HK region articles):
Focus on these U.S. government lists and programs:

1. NS-CMIC List (Non-SDN Chinese Military-Industrial Complex Companies):
   — Authorized by EO 13959 (Nov 2020) and expanded by EO 14032 (Jun 2021)
   — Prohibits U.S. persons from investing in listed companies
   — Search: "NS-CMIC" OFAC treasury designation 2026
   — Search: "EO 13959" OR "EO 14032" China military investment ban

2. Section 1237 DoD List (NDAA Chinese Military Companies):
   — Pentagon designates Chinese companies with military ties
   — Search: "Section 1237" "Chinese military companies" DoD Pentagon 2026
   — Search: site:defense.gov Chinese military companies 1260H

3. Key designated entities — track for additions, removals, appeals:
   AVIC (Aviation Industry Corp of China), CASIC (China Aerospace Science & Industry),
   CETC (China Electronics Technology Group), CNOOC, SMIC, Hikvision, Dahua,
   DJI, SenseTime, BGI Genomics, Norinco, China Telecom, China Mobile,
   China Unicom, Huawei, CITIC Group, China Communications Construction

4. Xinjiang / XPCC Program (EO 13818 / UFLPA):
   — XPCC (Xinjiang Production and Construction Corps) is sanctioned under EO 13818
   — UFLPA (Uyghur Forced Labor Prevention Act) entity list
   — Search: Xinjiang XPCC UFLPA "forced labor" sanctions OFAC 2026

5. Hong Kong Autonomy Act (EO 13936):
   — Targets individuals and entities undermining HK autonomy
   — Search: "Hong Kong" OFAC sanctions "EO 13936" autonomy 2026

For China/HK articles: sourceUrl must be the specific OFAC action page (/recent-actions/YYYYMMDD), Federal Register notice, or DoD press release — not a generic news article.`;

function parseJSON(text: string): Briefing | null {
  const clean = text.replace(/```json|```/g, "").trim();
  const s = clean.indexOf("{");
  const e = clean.lastIndexOf("}");
  if (s === -1 || e === -1) return null;
  try {
    const parsed = JSON.parse(clean.slice(s, e + 1)) as Briefing;
    parsed.articles = parsed.articles.map(a => ({
      ...a,
      body: Array.isArray(a.body) ? a.body : String(a.body).split("\n").filter(Boolean),
    }));
    return parsed;
  } catch {
    return null;
  }
}

export class GeminiProvider implements LLMProvider {
  id: string;
  name: string;
  dailyLimit: number;
  private apiKey: string;
  private model: string;

  constructor(opts: { id?: string; apiKey: string; dailyLimit?: number; model?: string }) {
    this.id         = opts.id ?? "gemini";
    this.name       = `Google Gemini (free${opts.id && opts.id !== "gemini" ? " — key " + opts.id.replace("gemini-","") : ""})`;
    this.apiKey     = opts.apiKey;
    this.dailyLimit = opts.dailyLimit ?? 1500;
    this.model      = opts.model ?? "gemini-2.0-flash";
  }

  async fetch(topic?: string, officialContext?: string): Promise<Briefing> {
    const tracker = getTracker();
    const usageKey = `${this.id}:llm`;

    // Note: dailyLimit check removed — Vercel serverless resets in-memory counter
    // each invocation. Google's own 429 response handles rate limiting.

    const today = new Date().toLocaleString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
      hour: "2-digit", minute: "2-digit", timeZoneName: "short",
      timeZone: "America/New_York",
    });

    // Build last 14 days as YYYYMMDD codes + human-readable for OFAC URL pattern
    const ofacDates = Array.from({ length: 14 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const code = d.getFullYear().toString() +
        String(d.getMonth() + 1).padStart(2, "0") +
        String(d.getDate()).padStart(2, "0");
      return code;
    });
    const ofacUrls = ofacDates.flatMap(code => [
      `https://ofac.treasury.gov/recent-actions/${code}`,
      `https://ofac.treasury.gov/recent-actions/${code}_33`,
      `https://ofac.treasury.gov/recent-actions/${code}_66`,
    ]).join("\n  ");

    const contextBlock = officialContext ? `\n\n${officialContext}` : "";
    const ofacBlock = `\nOFAC DATE URLS TO CHECK (search each, use as sourceUrl for matching articles):\n  ${ofacUrls}`;
    const userMsg = topic
      ? `Today is ${today}.${ofacBlock}\nFor BIS: search Federal Register for Entity List additions this month. Deliver a full intelligence briefing focusing on: "${topic}".${contextBlock} JSON only.`
      : `Today is ${today}.${ofacBlock}\nFor BIS: search Federal Register for Entity List additions this month — they publish multiple times per month. Search the web for the latest across all six domains.${contextBlock} JSON only.`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const body = {
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: userMsg }] }],
      tools: [{ google_search: {} }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 8192,
      },
    };

    // Single attempt — on 429 immediately fail so manager tries next key
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    tracker.increment(usageKey);

    if (!res.ok) {
      const err = await res.text();
      if (res.status === 429) {
        // Rate limited — throw immediately so LLM manager tries next Gemini key
        throw new Error(`Gemini ${this.id} rate limited (429) — trying next key`);
      }
      throw new Error(`Gemini API error ${res.status}: ${err.slice(0, 300)}`);
    }

    const data = await res.json() as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> }
      }>
    };

    const text = data.candidates
      ?.flatMap(c => c.content?.parts ?? [])
      .map(p => p.text ?? "")
      .join("")
      .trim() ?? "";

    if (!text) throw new Error("Gemini returned empty response");

    const briefing = parseJSON(text);
    if (!briefing) throw new Error("Failed to parse briefing JSON from Gemini");

    // The JSON schema above necessarily shows an illustrative example value for
    // "lastUpdated" (e.g. "May 23, 2026 — 14:00 UTC") so Gemini knows the
    // expected shape — but Gemini sometimes parrots that literal example back
    // verbatim instead of substituting the real current time. This is the same
    // bug already fixed for the GitHub Actions script (refresh-briefing.mjs's
    // formatLastUpdatedUtc), which froze the app's displayed timestamp. Never
    // trust Gemini's self-reported timestamp: always stamp it from the real
    // clock right before returnin