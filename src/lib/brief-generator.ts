/**
 * Brief Generator
 * Fetches article content, generates a 2-sentence brief via Gemini,
 * and caches it in Redis to avoid redundant work on subsequent refreshes.
 */

import { getCachedBrief, setCachedBrief } from "./article-library";

const FETCH_TIMEOUT_MS = 6000;
const MAX_CONTENT_CHARS = 3000;

// Fetch and extract readable text from a URL
async function fetchArticleText(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; GlobalReportBot/1.0)" },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const html = await res.text();

    // Strip scripts, styles, nav, footer
    const stripped = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, " ")
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, " ")
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&nbsp;/g, " ")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s{2,}/g, " ")
      .trim();

    // Take first MAX_CONTENT_CHARS of meaningful text
    return stripped.slice(0, MAX_CONTENT_CHARS);
  } catch {
    return null;
  }
}

// Generate a 2-sentence brief using Gemini
async function generateBriefWithGemini(headline: string, content: string): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_2;
  if (!apiKey) return null;

  const headlineOnly = content.startsWith("[headline-only]");
  const prompt = headlineOnly
    ? `You are a sanctions and financial news analyst. Based on this government press release headline, write exactly 2 sentences:

Sentence 1 (max 40 words): What specific action was taken — who was targeted, what sanctions program, what behavior.
Sentence 2 (max 40 words): Why it matters — the broader geopolitical or compliance significance.

Be factual and direct. Use plain text only. Infer from your knowledge of this topic.

Headline: ${headline}

Response:`
    : `You are a sanctions and financial news analyst. Read this official government notice and write exactly 2 paragraphs separated by a blank line:

Paragraph 1 (1-2 sentences, max 50 words): The specific action taken — who was designated/penalized, what program, what amount or how many entities.
Paragraph 2 (1-2 sentences, max 50 words): Why it matters — the broader context, which sanctions program, what behavior it targets, or what it signals.

Be factual and direct. Use plain text only. No bullet points, no headers, no preamble.

Headline: ${headline}

Content: ${content}

Response:`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 120, temperature: 0.2 },
        }),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return text && text.length > 20 ? text : null;
  } catch {
    return null;
  }
}

// Main export — get brief for an article, using cache when available
export async function getBriefForArticle(
  url: string,
  headline: string,
  existingBrief?: string
): Promise<string> {
  // If brief already looks real (not a generic fallback), keep it
  const GENERIC_BRIEFS = [
    "new designations or sanctions measures issued",
    "general license issued or amended",
    "sanctions removal or delisting action",
    "regulatory guidance or advisory notice",
    "official action — see source link",
    "official action published by",
    "published by ofac",
    "see source link for full details",
  ];
  const isGeneric = !existingBrief || GENERIC_BRIEFS.some(g =>
    existingBrief.toLowerCase().includes(g)
  );
  if (!isGeneric) return existingBrief!;

  // Skip non-article URLs (index/listing pages)
  const skipPatterns = [
    /sanctions-list-updates$/,
    /recent-actions$/,
    /press-releases$/,
    /civil-penalties-and-enforcement-information$/,
    /sanctions-programs-and-country-information$/,
  ];
  if (skipPatterns.some(p => p.test(url))) return existingBrief || "";

  // Check Redis cache first
  const cached = await getCachedBrief(url);
  if (cached) return cached;

  // Fetch article content — for client-rendered gov pages this may return null/short
  const content = await fetchArticleText(url);
  // If we can't get real content, fall back to headline-only mode for descriptive
  // government headlines (Treasury, OFAC, FinCEN etc.) which carry enough signal.
  const inputContent = (content && content.length >= 100)
    ? content
    : "[headline-only] government press release";

  // Generate brief with Gemini
  const brief = await generateBriefWithGemini(headline, inputContent);
  if (!brief) return existingBrief || "";

  // Cache the brief in Redis
  await setCachedBrief(url, brief);

  return brief;
}

// Gemini free tier limits: 15 RPM (requests per minute), 1500 RPD (requests per day)
// We stay well under by: max 3 parallel, 4s gap between batches, skip cached articles
const GEMINI_BATCH_SIZE   = 3;    // max parallel Gemini calls
const GEMINI_BATCH_GAP_MS = 4500; // wait 4.5s between batches → max ~13 RPM, safely under 15
const GEMINI_MAX_PER_RUN  = 25;   // max new briefs per refresh run (saves daily quota)

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// Batch generate briefs for multiple articles with rate limiting
export async function enrichArticlesWithBriefs(
  articles: Array<{ sourceUrl: string; headline: string; body: string[] }>
): Promise<Map<string, string>> {
  const results = new Map<string, string>();

  // Filter to only articles that need a brief
  const skipPatterns = [
    /sanctions-list-updates$/,
    /recent-actions$/,
    /\/press-releases$/,
    /civil-penalties-and-enforcement-information$/,
    /sanctions-programs-and-country-information$/,
  ];
  const needsBrief = articles.filter(a =>
    a.sourceUrl &&
    a.sourceUrl.length > 10 &&
    !skipPatterns.some(p => p.test(a.sourceUrl))
  ).slice(0, GEMINI_MAX_PER_RUN);

  console.log(`[brief-generator] ${needsBrief.length} articles need briefs (max ${GEMINI_MAX_PER_RUN} per run)`);

  let newBriefCount = 0;
  let cacheHitCount = 0;

  for (let i = 0; i < needsBrief.length; i += GEMINI_BATCH_SIZE) {
    const batch = needsBrief.slice(i, i + GEMINI_BATCH_SIZE);

    // Check Redis cache first for all in this batch — avoids unnecessary Gemini calls
    const batchWithCache = await Promise.all(batch.map(async (a) => {
      const cached = await getCachedBrief(a.sourceUrl);
      if (cached) { cacheHitCount++; return { a, cached }; }
      return { a, cached: null };
    }));

    // Apply cache hits immediately
    for (const { a, cached } of batchWithCache) {
      if (cached) results.set(a.sourceUrl, cached);
    }

    // Only call Gemini for cache misses
    const misses = batchWithCache.filter(x => !x.cached);
    if (misses.length > 0) {
      await Promise.all(misses.map(async ({ a }) => {
        const existing = a.body[0] || "";
        const brief = await getBriefForArticle(a.sourceUrl, a.headline, existing);
        if (brief && brief !== existing) {
          results.set(a.sourceUrl, brief);
          newBriefCount++;
        }
      }));

      // Rate limit gap — only wait if there are more batches coming
      if (i + GEMINI_BATCH_SIZE < needsBrief.length) {
        console.log(`[brief-generator] Batch ${Math.floor(i/GEMINI_BATCH_SIZE)+1} done — waiting ${GEMINI_BATCH_GAP_MS}ms before next batch`);
        await sleep(GEMINI_BATCH_GAP_MS);
      }
    }
  }

  console.log(`[brief-generator] Done — ${newBriefCount} new briefs generated, ${cacheHitCount} from cache`);
  return results;
}
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          