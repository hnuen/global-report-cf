import { buildLLMManager }     from "./briefing-fetcher";
import { buildStorageManager } from "./storage-manager";
import { getTracker }          from "./usage-tracker";
import { fetchOfficialSources, formatSourcesForPrompt } from "./official-sources";
import { buildBriefingFromSources } from "./official-briefing";
import { buildAnalyzedBriefing } from "./local-analyzer";
import { getHistoricalForSection, getRecentBySource } from "./historical-articles";
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

  // ── Per-source official backfill ─────────────────────────────────────────
  // For each key official source, if ZERO live articles came from that source
  // (e.g. the scraper was blocked or the site had no new content today), inject
  // the most recent 5-7 historical articles so the relevant tab always shows
  // something authoritative rather than falling back to Google News only.
  const existingIds = new Set(briefing.articles.map(a => a.id));
  const SOURCE_BACKFILLS: Array<{ keyword: string; limit: number }> = [
    { keyword: "OFAC",       limit: 7 },
    { keyword: "FinCEN",     limit: 5 },
    { keyword: "OFSI",       limit: 5 },
    { keyword: "EU Council", limit: 5 },
    { keyword: "BIS",        limit: 5 },
  ];
  for (const { keyword, limit } of SOURCE_BACKFILLS) {
    const hasSource = briefing.articles.some(a => a.source.includes(keyword));
    if (!hasSource) {
      const fallback = getRecentBySource(keyword, limit, existingIds);
      if (fallback.length > 0) {
        briefing.articles = [...briefing.articles, ...fallback];
        fallback.forEach(a => existingIds.add(a.id));
        console.log(`[orchestrator] Backfilled ${fallback.length} ${keyword} historical articles (source had 0 live)`);
      }
    }
  }

  // ── 3-tier source priority system ──────────────────────────────────────────
  // Tier 1 (official — always fetched first & always shown): OFAC, FinCEN, BIS,
  //         OCC, Federal Reserve, UK OFSI, EU
  // Tier 2 (Google News / general outlets — only kept if <= 30 days old)
  // Tier 3 (Al Jazeera, UN News, India MEA — always shown)
  //
  // Matching is done via keyword/substring rather than exact-name equality
  // because display names produced upstream are often compound, e.g.
  // "U.S. Treasury / OFAC", "OFAC / Iran", "EU Council — Sanctions RSS".
  const officialKeywords = [
    "OFAC", "FinCEN", "BIS", "OCC", "Federal Reserve", "Fed Reserve",
    "UK OFSI", "OFSI", "EU Council", "EU Commission", "European Commission",
    "U.S. Treasury", "UK HM Treasury", "Wassenaar", "UK Strategic Export",
    "U.S. State Department", "State Dept",
  ];
  const tier3Keywords = ["Al Jazeera", "UN News", "India MEA"];

  const isOfficialSource = (source: string) =>
    officialKeywords.some(k => source.includes(k));
  const isTier3Source = (source: string) =>
    tier3Keywords.some(k => source.includes(k));

  // Priority: 2 = Tier 1 (official gov), 1 = Tier 2 (Google News/general), 0 = Tier 3
  const getPriority = (source: string) => {
    if (isOfficialSource(source)) return 2;
    if (isTier3Source(source)) return 0;
    return 1;
  };

  // Tier 2 spec: Google News / general articles only count if <= 30 days old.
  // Tier 1 (official) and Tier 3 (Al Jazeera/UN News/India MEA) are always shown
  // regardless of age.
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - THIRTY_DAYS_MS;
  briefing.articles = briefing.articles.filter(a => {
    if (isOfficialSource(a.source) || isTier3Source(a.source)) return true;
    const t = Date.parse(a.date || "");
    if (isNaN(t)) return true; // unparseable date — don't drop, just don't filter on it
    return t >= cutoff;
  });

  // Sort: Tier 1 first, then Tier 2, then Tier 3 — newest first within each tier
  briefing.articles = briefing.articles.sort((a, b) => {
    const aPriority = getPriority(a.source);
    const bPriority = getPriority(b.source);
    if (bPriority !== aPriority) return bPriority - aPriority;
    return (b.date || "").localeCompare(a.date || "");
  });

  // ── Save the core briefing FIRST ───────────────────────────────────────────
  // Cloudflare Workers caps subrequests per invocation. Brief enrichment below
  // does per-article Redis cache lookups + article fetches + Gemini calls,
  // which can exhaust that budget — causing the *real* Upstash save to throw
  // "Too many subrequests by single Worker invocation" while the in-memory
  // fallback silently "succeeds," masking the failure (refresh still reports
  // ok:true, but Redis never gets the fresh data — lastUpdated stays frozen).
  // Saving here guarantees the correctly-dated official-source articles and
  // Eastern-time lastUpdated persist before enrichment can starve the budget.
  await storage.save(briefing);
  console.log("[orchestrator] Saved core briefing (pre-enrichment)");

  // Enrich articles with AI-generated briefs (cached in Redis, runs async)
  // Only runs when LLM fallback was used (structured briefing) — LLM articles already have good body text
  // Best-effort: failure here does not lose data, since the core briefing is already saved above.
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

        try {
          await storage.save(briefing);
          console.log("[orchestrator] Saved enriched briefing");
        } catch (saveErr) {
          console.log("[orchestrator] Enriched-briefing save failed (non-fatal — core briefing already saved):", String(saveErr).slice(0, 150));
        }
      }
    } catch (e) {
      console.log("[orchestrator] Brief enrichment failed (non-fatal):", String(e).slice(0, 100));
    }
  }

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
