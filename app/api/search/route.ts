/**
 * Global Search API
 * Uses Anthropic Claude with web search to find and summarise
 * relevant news articles for any query.
 */

import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/src/lib/rate-limit";
import { validateSearchQuery } from "@/src/lib/request-validation";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const allowed = await checkRateLimit(`search_rl:${getClientIp(request)}`, 10, 60 * 60, { failClosed: true });
    if (!allowed) return NextResponse.json({ error: "Search limit reached. Please try again later." }, { status: 429, headers: { "Cache-Control": "no-store" } });
    const body = await request.json().catch(() => null) as { query?: unknown } | null;
    const query = validateSearchQuery(body?.query);
    if (!query) return NextResponse.json({ error: "Query must be between 1 and 300 characters." }, { status: 400, headers: { "Cache-Control": "no-store" } });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;

    // Try Gemini first (free tier, Google Search grounding)
    if (geminiKey) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: AbortSignal.timeout(20_000),
            body: JSON.stringify({
              system_instruction: {
                parts: [{
                  text: `You are a financial intelligence researcher. Search the web and return results as a JSON array only — no markdown, no explanation:
[{"title":"...","source":"...","url":"https://...","date":"...","brief":"2-3 sentence summary","relevance":"high|medium|low","tags":["..."]}]
Return 5-10 results. Focus on official sources and reputable news. Prioritise: treasury.gov, ofac.treasury.gov, fincen.gov, bis.gov, reuters.com, ft.com, wsj.com, bloomberg.com, occ.gov, federalreserve.gov, ec.europa.eu, gov.uk, aljazeera.com`
                }]
              },
              contents: [{ role: "user", parts: [{ text: `Search the web for: "${query}"

Return JSON array only.` }] }],
              tools: [{ google_search: {} }],
              generationConfig: { temperature: 0.1, maxOutputTokens: 4000 },
            }),
          }
        );

        if (res.ok) {
          const data = await res.json();
          const text = data.candidates
            ?.flatMap((c: any) => c.content?.parts ?? [])
            .map((p: any) => p.text ?? "")
            .join("") || "";

          const clean = text.replace(/```json|```/g, "").trim();
          const start = clean.indexOf("[");
          const end = clean.lastIndexOf("]");
          if (start !== -1 && end !== -1) {
            const results = JSON.parse(clean.slice(start, end + 1));
            if (results.length > 0) {
              return NextResponse.json({ results, source: "gemini" });
            }
          }
        }
      } catch (e) {
        console.log("[search] Gemini failed:", e);
      }
    }

    // Fallback: Anthropic with web search tool
    if (apiKey) {
      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "anthropic-beta": "web-search-2025-03-05",
          },
          signal: AbortSignal.timeout(20_000),
          body: JSON.stringify({
            model: "claude-sonnet-4-5",
            max_tokens: 4000,
            tools: [{ type: "web_search_20250305", name: "web_search" }],
            system: `You are a financial intelligence researcher. When given a search query, search the web and return a JSON array of the most relevant results. 

Return ONLY a JSON array — no markdown, no explanation, just the array:
[
  {
    "title": "Full article headline",
    "source": "Publication name",
    "url": "https://...",
    "date": "May 25, 2026",
    "brief": "2-3 sentence summary of the article content",
    "relevance": "high|medium|low",
    "tags": ["sanctions", "OFAC", "Iran"]
  }
]

Return 5-10 results. Focus on official sources, reputable news, and government websites.
Prioritise results from: treasury.gov, ofac.gov, fincen.gov, bis.gov, reuters.com, ft.com, wsj.com, bloomberg.com, occ.gov, federalreserve.gov, ec.europa.eu, gov.uk, aljazeera.com`,
            messages: [{ role: "user", content: `Search for: "${query}"\n\nReturn results as JSON array only.` }],
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const text = data.content
            ?.filter((b: any) => b.type === "text")
            .map((b: any) => b.text)
            .join("") || "";

          const clean = text.replace(/```json|```/g, "").trim();
          const start = clean.indexOf("[");
          const end = clean.lastIndexOf("]");
          if (start !== -1 && end !== -1) {
            const results = JSON.parse(clean.slice(start, end + 1));
            return NextResponse.json({ results, source: "anthropic" });
          }
        }
      } catch (e) {
        console.log("[search] Anthropic failed:", e);
      }
    }

    // Fallback: Gemini with Google Search grounding
    if (geminiKey) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: AbortSignal.timeout(20_000),
            body: JSON.stringify({
              system_instruction: {
                parts: [{
                  text: `You are a financial intelligence researcher. Search the web and return results as a JSON array only — no markdown, no explanation:
[{"title":"...","source":"...","url":"https://...","date":"...","brief":"2-3 sentence summary","relevance":"high|medium|low","tags":["..."]}]
Return 5-10 results. Focus on official sources and reputable news.`
                }]
              },
              contents: [{ role: "user", parts: [{ text: `Search the web for: "${query}"\n\nReturn JSON array only.` }] }],
              tools: [{ google_search: {} }],
              generationConfig: { temperature: 0.1, maxOutputTokens: 4000 },
            }),
          }
        );

        if (res.ok) {
          const data = await res.json();
          const text = data.candidates
            ?.flatMap((c: any) => c.content?.parts ?? [])
            .map((p: any) => p.text ?? "")
            .join("") || "";

          const clean = text.replace(/```json|```/g, "").trim();
          const start = clean.indexOf("[");
          const end = clean.lastIndexOf("]");
          if (start !== -1 && end !== -1) {
            const results = JSON.parse(clean.slice(start, end + 1));
            return NextResponse.json({ results, source: "gemini" });
          }
        }
      } catch (e) {
        console.log("[search] Gemini failed:", e);
      }
    }

    return NextResponse.json({ error: "All search providers unavailable" }, { status: 503 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
