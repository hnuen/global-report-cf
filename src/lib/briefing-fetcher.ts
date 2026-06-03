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

CRITICAL — OFAC WEBSITE WORKAROUND:
The OFAC website (ofac.treasury.gov/recent-actions) uses JavaScript rendering and web_fetch returns stale/cached results that miss recent actions. You MUST use these specific search strategies instead:

Step 1 — Get today's date and search for each of the last 7 days explicitly:
  Search: site:ofac.treasury.gov "MONTH DAY, YEAR" for each day e.g. "May 19, 2026"
  Search: OFAC sanctions designations "May 19 2026" treasury
  Search: OFAC "May 18 2026" OR "May 19 2026" sanctions

Step 2 — Search for specific action types:
  Search: OFAC SDN list update May 2026
  Search: OFAC general license issued May 2026
  Search: OFAC enforcement action May 2026
  Search: treasury.gov OFAC designations this week

Step 3 — Check program-specific pages directly (these pages DO render correctly):
  Fetch: https://ofac.treasury.gov/sanctions-programs-and-country-information/russian-harmful-foreign-activities-sanctions
  Fetch: https://ofac.treasury.gov/sanctions-programs-and-country-information/iran-sanctions
  Fetch: https://ofac.treasury.gov/selected-general-licenses-issued-ofac

Step 4 — Use third-party sanctions trackers that aggregate OFAC updates:
  Search: steptoe weekly sanctions update May 2026
  Search: site:steptoe.com sanctions update May 2026
  Search: site:hklaw.com OFAC May 2026
  Search: site:fieldfisher.com sanctions May 2026

NEVER rely solely on fetching ofac.treasury.gov/recent-actions — it will return stale data.
ALWAYS cross-reference at least 2 of the above search strategies for the sanctions section.

For each article cite the most authoritative primary source available — prefer official press releases and original reporting over aggregators.`;

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
    });

    // Build last 7 days as explicit search targets for OFAC workaround
    const last7Days = Array.from({length: 7}, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    }).join(", ");

    const ofacInstructions = `
OFAC SEARCH INSTRUCTIONS FOR THIS RUN:
Today is ${today}. The last 7 days are: ${last7Days}.
For the sanctions section you MUST search for OFAC actions on EACH of these dates individually.
Use search queries like: OFAC sanctions "${last7Days.split(",")[0]}" treasury designations
Do NOT rely on fetching ofac.treasury.gov/recent-actions directly — use targeted date searches instead.`;

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
  async fetch(topic?: string): Promise<{ briefing: Briefing; usedProvider: string }> {
    const tracker = getTracker();
    const errors: string[] = [];

    // Pre-fetch official government sources before calling LLM
    console.log("[llm] Pre-fetching official government sources...");
    const officialSources = await fetchOfficialSources();
    const officialContext = formatSourcesForPrompt(officialSources);
    const successCount = officialSources.filter(s => s.content.length > 100).length;
    console.log(`[llm] Fetched ${successCount}/${officialSources.length} official sources`);

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
