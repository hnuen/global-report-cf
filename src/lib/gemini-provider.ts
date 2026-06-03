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

OFAC SEARCH: Do NOT fetch ofac.treasury.gov/recent-actions directly — use targeted date searches instead:
Search "OFAC sanctions [today's date]", "OFAC designations this week", "site:home.treasury.gov OFAC [month year]"

Al Jazeera is required for Middle East, Iran, Gulf, and Islamic world stories.`;

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
    });

    // Build last 7 days for OFAC search
    const last7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    }).join(", ");

    const contextBlock = officialContext ? `\n\n${officialContext}` : "";
    const userMsg = topic
      ? `Today is ${today}. Last 7 days: ${last7}. Search for OFAC actions on each date. Deliver a full intelligence briefing focusing on: "${topic}".${contextBlock} JSON only.`
      : `Today is ${today}. Last 7 days: ${last7}. Search for OFAC actions on each date. Search the web for the latest across all six domains.${contextBlock} JSON only.`;

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

    briefing.lastUpdated += " [Gemini]";
    return briefing;
  }
}
