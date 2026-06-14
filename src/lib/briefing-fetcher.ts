import type { Briefing, LLMProvider } from "./types";
import { GeminiProvider } from "./gemini-provider";
import { getTracker } from "./usage-tracker";
import { fetchOfficialSources, formatSourcesForPrompt } from "./official-sources";

// ── System prompt (shared) ────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a senior intelligence editor. Search the web for the very latest news across six domains and write a complete, sourced briefing.

Return ONLY valid JSON — no markdown fences, no preamble:

{
  "lastUpdated": "May 11, 2026 — 14:00 UTC",
  "articles": [
    {
      "id": 1,
      "section": "sanctions",
      "category": "OFAC",
      "region": "Iran",
      "impact": "high",
      "date": "May 11, 2026",
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
1. sanctions  — OFAC, EU, UK/OFSI, UN designations, enforcement, evasion, Russia/Iran/DPRK/Venezuela
2. economics  — Markets, inflation, central banks, trade, energy prices
3. religion   — Vatican/papacy, interfaith, faith & politics, global trends
4. occ        — OCC enforcement actions, consent orders, prohibition orders
5. penalties  — FinCEN, AML/BSA fines, OFAC civil penalties, bank settlements
6. bis        — BIS export controls, Entity List, EAR enforcement, semiconductor policy

Write 3–4 articles per section (18–24 total). Each body is an array of 2–3 full editorial paragraphs. Real current facts from web search only. Include real source names and URLs.

SOURCE REQUIREMENTS — actively search and draw from a diverse mix of outlets every refresh:

Wire services: Reuters, AP, AFP
International broadcasters: Al Jazeera, BBC, DW (Deutsche Welle), France 24
Financial/business: Bloomberg, Financial Times, Wall Street Journal, Reuters Business
Official releases: U.S. Treasury (OFAC), European Commission, UK FCDO/OFSI, BIS, OCC, FinCEN, UN

Al Jazeera is a required source for any story touching:
  - Middle East sanctions (Iran, Yemen, Gaza, Syria)
  - Gulf economics (oil markets, sovereign wealth, GCC policy)
  - Islamic world and interfaith news
  - Global South perspectives on sanctions and trade
Search "site:aljazeera.com [topic]" explicitly for these topics.

CRITICAL — OFAC RECENT ACTIONS URL PATTERN:
OFAC publishes every action at: https://ofac.treasury.gov/recent-actions/YYYYMMDD
Multiple actions on the same day use suffixes: /YYYYMMDD_33, /YYYYMMDD_66
These individual pages ARE indexed by Google — use site: queries to find them.

Step 1 — Search Google for OFAC action pages by date code:
  Search: site:ofac.treasury.gov/recent-actions 2026
  Search: site:ofac.treasury.gov "recent-actions/202606"
  Search: site:ofac.treasury.gov "recent-actions/202605"
  For each result Google returns, you get the exact page title AND the /YYYYMMDD URL.
  Use those ofac.treasury.gov/recent-actions/YYYYMMDD URLs as sourceUrl in articles.

Step 2 — Specific date code searches (the user will inject the actual codes in the message):
  Search: ofac.treasury.gov/recent-actions/[YYYYMMDD] for each date in the last 14 days
  Also try: ofac.treasury.gov/recent-actions/[YYYYMMDD]_33 for days with multiple actions

Step 3 — Cross-reference with law firm trackers:
  Search: site:steptoe.com OFAC sanctions update June 2026
  Search: site:hklaw.com OFAC June 2026
  Search: site:fieldfisher.com sanctions June 2026

Step 4 — Check program pages (these render correctly without JS):
  Fetch: https://ofac.treasury.gov/sanctions-programs-and-country-information/russian-harmful-foreign-activities-sanctions
  Fetch: https://ofac.treasury.gov/sanctions-programs-and-country-information/iran-sanctions

ALWAYS use ofac.treasury.gov/recent-actions/YYYYMMDD as the sourceUrl — never the listing page.

CRITICAL — BIS SEARCH INSTRUCTIONS:
BIS publishes Entity List additions and EAR amendments to the Federal Register multiple times per month — there are ALWAYS recent additions to report.

For the bis section you MUST use ALL of these search strategies:

Step 1 — Search Federal Register for recent BIS notices:
  Search: site:federalregister.gov "bureau of industry" "entity list" [current month] [year]
  Search: federalregister.gov BIS export controls [current month year]
  Fetch: https://www.federalregister.gov/agencies/industry-and-security-bureau

Step 2 — Search for enforcement actions:
  Search: BIS enforcement action export violation [current month year]
  Search: "bureau of industry and security" penalty [current month year]
  Search: BIS denied export license violation [current year]

Step 3 — Search for semiconductor/chip controls:
  Search: BIS chip export restriction China [current month year]
  Search: semiconductor export control Entity List [current month year]
  Search: EAR export administration regulations update [current month year]

Step 4 — Check third-party trackers:
  Search: site:steptoe.com export controls BIS [current month year]
  Search: "entity list" additions [current month year] law firm update

Do NOT write BIS section articles based only on training knowledge — always search first.
ALWAYS include at least 3 fresh BIS articles dated within the last 30 days.

For each article cite the most authoritative primary source available — prefer official press releases and original reporting over aggregators.

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

// ── Parse helper ──────────────────────────────────────────────────────────────

function parseJSON(text: string): Briefing | null {
  const clean = text.replace(/```json|```/g, "").trim();
  const s = clean.indexOf("{"), e = clean.lastIndexOf("}");
  if (s === -1 || e === -1) return null;
  try {
    const parsed = JSON.parse(clean.slice(s, e + 1)) as Briefing;
    // Ensure body is always string[]
    parsed.articles = parsed.articles.map(a => ({
      ...a,
      body: Array.isArray(a.body)
        ? a.body
        : String(a.body).split("\n").filter(Boolean),
    }));
    return parsed;
  } catch {
    return null;
  }
}

// ── Anthropic provider ────────────────────────────────────────────────────────

export class AnthropicProvider implements LLMProvider {
  id: string;
  name: string;
  dailyLimit: number;
  private apiKey: string;

  constructor(opts: { id: string; name: string; apiKey: string; dailyLimit?: number }) {
    this.id      = opts.id;
    this.name    = opts.name;
    this.apiKey  = opts.apiKey;
    this.dailyLimit = opts.dailyLimit ?? 0;
  }

  async fetch(topic?: string, officialContext?: string): Promise<Briefing> {
    const tracker = getTracker();
    const usageKey = `${this.id}:llm`;

    if (tracker.isOverLimit(usageKey, this.dailyLimit)) {
      throw new Error(`LLM provider ${this.id} has hit its daily limit of ${this.dailyLimit}`);
    }

    const today = new Date().toLocaleString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
      hour: "2-digit", minute: "2-digit", timeZoneName: "short",
      timeZone: "America/New_York",
    });

    // Build OFAC date codes for last 14 days (YYYYMMDD format matching their URL pattern)
    const ofacDates = Array.from({length: 14}, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.getFullYear().toString() +
        String(d.getMonth() + 1).padStart(2, "0") +
        String(d.getDate()).padStart(2, "0");
    });
    const ofacUrlList = ofacDates.flatMap(code => [
      `https://ofac.treasury.gov/recent-actions/${code}`,
      `https://ofac.treasury.gov/recent-actions/${code}_33`,
      `https://ofac.treasury.gov/recent-actions/${code}_66`,
    ]).join("\n  ");

    const ofacInstructions = `
OFAC DATE URLS FOR THIS RUN — search each one, use as sourceUrl for matching articles:
  ${ofacUrlList}
Search: site:ofac.treasury.gov/recent-actions ${ofacDates[0].slice(0,6)} to find all this month's indexed action pages.`;

    const contextBlock = officialContext ? `\n\n${officialContext}` : "";
    const userMsg = topic
      ? `Today is ${today}.${ofacInstructions}

Deliver a full intelligence briefing with extra focus on: "${topic}". JSON only.`
      : `Today is ${today}.${ofacInstructions}

Search the web for the latest developments across all six domains. JSON only.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8000,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMsg }],
      }),
    });

    tracker.increment(usageKey);

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic API error ${response.status}: ${err}`);
    }

    const data = await response.json() as { content: Array<{type:string;text?:string}> };
    const text = data.content.map(b => b.type === "text" ? (b.text ?? "") : "").join("").trim();
    const briefing = parseJSON(text);
    if (!briefing) throw new Error("Failed to parse briefing JSON from Claude");
    return briefing;
  }
}

// ── Multi-provider manager with automatic failover ────────────────────────────

export class LLMManager {
  private providers: LLMProvider[];

  constructor(providers: LLMProvider[]) {
    this.providers = providers;
  }

  /**
   * Try each provider in order.
   * Skip any that have hit their daily limit.
   * Falls back to the next if one throws.
   */
  async fetch(topic?: string, prebuiltContext?: string): Promise<{ briefing: Briefing; usedProvider: string }> {
    const tracker = getTracker();
    const errors: string[] = [];

    // Use pre-fetched context if provided (avoids double-fetching when orchestrator already ran fetchOfficialSources)
    let officialContext: string;
    if (prebuiltContext) {
      officialContext = prebuiltContext;
      console.log("[llm] Using pre-fetched official sources context from orchestrator");
    } else {
      console.log("[llm] Pre-fetching official government sources...");
      const officialSources = await fetchOfficialSources();
      officialContext = formatSourcesForPrompt(officialSources);
      const successCount = officialSources.filter(s => s.content.length > 100).length;
      console.log(`[llm] Fetched ${successCount}/${officialSources.length} official sources`);
    }

    for (const p of this.providers) {
      const usageKey = `${p.id}:llm`;

      if (tracker.isOverLimit(usageKey, p.dailyLimit)) {
        console.log(`[llm] Skipping ${p.name} — daily limit reached (${p.dailyLimit})`);
        errors.push(`${p.name}: daily limit reached`);
        continue;
      }

      try {
        console.log(`[llm] Trying provider: ${p.name}`);
        const briefing = await p.fetch(topic, officialContext);
        console.log(`[llm] Success with: ${p.name}`);
        return { briefing, usedProvider: p.name };
      } catch (err) {
        const msg = String(err);
        console.error(`[llm] Provider ${p.name} failed: ${msg}`);
        errors.push(`${p.name}: ${msg}`);
        // Wait 2s before trying next provider
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    throw new Error(`All LLM providers exhausted:\n${errors.join("\n")}`);
  }
}

// ── Build providers from environment ─────────────────────────────────────────

export function buildLLMManager(): LLMManager {
  const providers: LLMProvider[] = [];

  // Google Gemini key 1 — FREE tier first (1500 req/day, no cost)
  if (process.env.GEMINI_API_KEY) {
    providers.push(new GeminiProvider({
      id: "gemini-1",
      apiKey: process.env.GEMINI_API_KEY,
      dailyLimit: Number(process.env.GEMINI_DAILY_LIMIT ?? 1500),
      model: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
    }));
  }

  // Google Gemini key 2 — second free account, used when key 1 hits limit
  if (process.env.GEMINI_API_KEY_2) {
    providers.push(new GeminiProvider({
      id: "gemini-2",
      apiKey: process.env.GEMINI_API_KEY_2,
      dailyLimit: Number(process.env.GEMINI_DAILY_LIMIT ?? 1500),
      model: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
    }));
  }

  // Google Gemini key 3 — third free account, optional
  if (process.env.GEMINI_API_KEY_3) {
    providers.push(new GeminiProvider({
      id: "gemini-3",
      apiKey: process.env.GEMINI_API_KEY_3,
      dailyLimit: Number(process.env.GEMINI_DAILY_LIMIT ?? 1500),
      model: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
    }));
  }

  // Anthropic — fallback when Gemini hits daily limit or fails
  if (process.env.ANTHROPIC_API_KEY) {
    providers.push(new AnthropicProvider({
      id: "anthropic-primary",
      name: "Anthropic (Primary)",
      apiKey: process.env.ANTHROPIC_API_KEY,
      dailyLimit: Number(process.env.ANTHROPIC_PRIMARY_DAILY_LIMIT ?? 0),
    }));
  }

  // Anthropic secondary key — optional
  if (process.env.ANTHROPIC_API_KEY_2) {
    providers.push(new AnthropicProvider({
      id: "anthropic-secondary",
      name: "Anthropic (Secondary)",
      apiKey: process.env.ANTHROPIC_API_KEY_2,
      dailyLimit: Number(process.env.ANTHROPIC_SECONDARY_DAILY_LIMIT ?? 0),
    }));
  }

  // Anthropic tertiary key — optional
  if (process.env.ANTHROPIC_API_KEY_3) {
    providers.push(new AnthropicProvider({
      id: "anthropic-tertiary",
      name: "Anthropic (Tertiary)",
      apiKey: process.env.ANTHROPIC_API_KEY_3,
      dailyLimit: Number(process.env.ANTHROPIC_TERTIARY_DAILY_LIMIT ?? 0),
    }));
  }

  if (providers.length === 0) {
    throw new Error("No LLM providers configured — set at least ANTHROPIC_API_KEY or GEMINI_API_KEY");
  }

  return new LLMManager(providers);
}
