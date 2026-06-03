import { buildLLMManager }     from "./briefing-fetcher";
import { buildStorageManager } from "./storage-manager";
import { getTracker }          from "./usage-tracker";
import { fetchOfficialSources, formatSourcesForPrompt } from "./official-sources";
import { buildBriefingFromSources } from "./official-briefing";
import { buildAnalyzedBriefing } from "./local-analyzer";
import { getHistoricalForSection } from "./historical-articles";
import type { Briefing, Section } from "./types";
import { enrichArticlesWithBriefs } from "./brief-generator";

// No module-level singletons — always read env vars fresh on each invocation
export async function loadBriefing(): Promise<Briefing | null> {
  const storage = await buildStorageManager();
  return storage.load();
}

export async function refreshBriefing(topic?: string): Promise<{
  briefing: Briefing;
  usedProvider: string;
  savedTo: string[];
}> {
  const storage = await buildStorageManager();

  // Always fetch official sources first — fast and free
  console.log("[orchestrator] Fetching official government sources...");
  const officialSources = await fetchOfficialSources();
  const successCount = officialSources.filter(s => s.content.length > 50).length;
  console.log(`[orchestrator] Got ${successCount}/${officialSources.length} official sources`);

  let briefing: Briefing;
  let usedProvider: string;

  // Skip LLM during auto-refresh to avoid timeouts — use structured source builder
  // LLM is only used when explicitly requested via topic parameter from manual trigger
  if (false && topic) {
    try {
      const llm = buildLLMManager();
      const result = await llm.fetch(topic);
      briefing = result.briefing;
      usedProvider = result.usedProvider;
    } catch (llmError) {
      console.log("[orchestrator] LLM failed — using structured sources");
      const structuredBriefing = buildBriefingFromSources(officialSources);
      briefing = structuredBriefing.articles.length >= 5 ? structuredBriefing : buildAnalyzedBriefing(officialSources);
      usedProvider = "Official Sources (LLM fallback)";
    }
  } else {
    // Fast path — structured builder from official sources, no LLM calls
    if (successCount === 0) {
      throw new Error("No official sources fetched successfully");
    }
    const structuredBriefing = buildBriefingFromSources(officialSources);
    if (structuredBriefing.articles.length >= 5) {
      briefing = structuredBriefing;
      usedProvider = "Official Sources";
    } else {
      briefing = buildAnalyzedBriefing(officialSources);
      usedProvider = "Local Analysis";
    }
  }

  // Fill any section with < 8 articles using historical records
  const SECTIONS: Section[] = ["sanctions","economics","religion","occ","penalties","bis"];
  for (const sec of SECTIONS) {
    const currentCount = briefing.articles.filter(a => a.section === sec).length;
    if (currentCount < 8) {
      const historical = getHistoricalForSection(sec, currentCount);
      if (historical.length > 0) {
        briefing.articles = [...briefing.articles, ...historical];
        console.log(`[orchestrator] Added ${historical.length} historical articles to ${sec} (was ${currentCount})`);
      }
    }
  }

  // Enrich articles with AI-generated briefs (cached in Redis, runs async)
  // Only runs when LLM fallback was used (structured briefing) — LLM articles already have good body text
  if (usedProvider.includes("Official Sources") || usedProvider.includes("Local Analysis")) {
    try {
      console.log("[orchestrator] Enriching article briefs...");
      const sanctionsArticles = briefing.articles
        .filter(a => a.section === "sanctions" && a.sourceUrl)
        .map(a => ({ sourceUrl: a.sourceUrl!, headline: a.headline, body: a.body }));

      const enriched = await enrichArticlesWithBriefs(sanctionsArticles);
      if (enriched.size > 0) {
        briefing.articles = briefing.articles.map(a => {
          const newBrief = a.sourceUrl ? enriched.get(a.sourceUrl) : undefined;
          return newBrief ? { ...a, body: [newBrief, ...a.body.slice(1)] } : a;
        });
        console.log(`[orchestrator] Enriched ${enriched.size} article briefs`);
      }
    } catch (e) {
      console.log("[orchestrator] Brief enrichment failed (non-fatal):", String(e).slice(0, 100));
    }
  }

  // Sort all articles newest first (after all sources including historical)
  // Dates are stored as YYYY-MM-DD — sort as strings (lexicographic = chronological)
  briefing.articles = briefing.articles.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  await storage.save(briefing);

  const savedTo = storage.getHealth()
    .filter(h => h.healthy)
    .map(h => h.id);

  return { briefing, usedProvider, savedTo };
}

export async function getSystemHealth() {
  const storage = await buildStorageManager();
  const tracker = getTracker();

  return {
    storage: storage.getHealth(),
    llm: {
      primary:   { id: "anthropic-primary",   calls: tracker.get("anthropic-primary:llm"),   limit: Number(process.env.ANTHROPIC_PRIMARY_DAILY_LIMIT   ?? 0) },
      secondary: { id: "anthropic-secondary", calls: tracker.get("anthropic-secondary:llm"), limit: Number(process.env.ANTHROPIC_SECONDARY_DAILY_LIMIT ?? 0) },
      tertiary:  { id: "anthropic-tertiary",  calls: tracker.get("anthropic-tertiary:llm"),  limit: Number(process.env.ANTHROPIC_TERTIARY_DAILY_LIMIT  ?? 0) },
      gemini:    { id: "gemini",              calls: tracker.get("gemini:llm"),              limit: Number(process.env.GEMINI_DAILY_LIMIT ?? 1500) },
    },
    hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
    hasGeminiKey:    !!process.env.GEMINI_API_KEY,
    hasUpstash:      !!process.env.UPSTASH_REDIS_REST_URL,
    hasTelegram:     !!process.env.TELEGRAM_BOT_TOKEN,
    timestamp: new Date().toISOString(),
  };
}
