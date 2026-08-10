import { buildLLMManager }     from "./briefing-fetcher";
import { buildStorageManager } from "./storage-manager";
import { getTracker }          from "./usage-tracker";
import { fetchOfficialSources, formatSourcesForPrompt } from "./official-sources";
import { buildBriefingFromSources } from "./official-briefing";
import { buildAnalyzedBriefing } from "./local-analyzer";
import { getHistoricalForSection, getRecentBySource } from "./historical-articles";
import type { Article, Briefing, Section } from "./types";
import { enrichArticlesWithBriefs } from "./brief-generator";
import { loadArticleLibrary, saveArticlesToLibrary } from "./article-library";
import { fetchOfacCache, recentActionsToArticles, civilPenaltiesToArticles, programsToArticles, ofsiNoticesToArticles, europaNewsToArticles, unNoticesToArticles, bbcNewsToArticles, ajNewsToArticles, occNewsToArticles, economicsNewsToArticles, bisNewsToArticles, regionsNewsToArticles } from "./ofac-github-cache";
import { mergeDirectWithAiSupplement } from "./source-merge";
import { commitSourceItemCheckpoints } from "./source-item-checkpoints";
import { hasUsableArticleText, isDisplayableNewsArticle } from "./text-quality";

const HOT_ARTICLES_PER_SECTION = 60;

function capHotBriefingArticles(articles: Article[]): Article[] {
  const bySection = new Map<string, Article[]>();
  for (const article of articles) {
    const section = article.section ?? "sanctions";
    const list = bySection.get(section) ?? [];
    list.push(article);
    bySection.set(section, list);
  }
  return [...bySection.values()].flatMap(list =>
    list
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
      .slice(0, HOT_ARTICLES_PER_SECTION)
  );
}

// No module-level singletons ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â always read env vars fresh on each invocation
export async function loadBriefing(): Promise<Briefing | null> {
  const storage = await buildStorageManager();
  return storage.load();
}

export async function refreshBriefing(topic?: string, opts?: { skipLLM?: boolean; section?: string; manualRefresh?: boolean; group?: 1|2|3|4; groupPart?: 1|2|3|4 }): Promise<{
  briefing: Briefing;
  usedProvider: string;
  savedTo: string[];
  storageErrors: { id: string; error: string | undefined }[];
}> {
  const storage = await buildStorageManager();

  // Load persisted article library (Redis-backed ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â built up across refresh runs)
  // Skip in skipLLM path to conserve CF Workers subrequest budget (stay under 50 limit)
  const libraryArticles = opts?.skipLLM ? [] : await loadArticleLibrary();
  console.log(`[orchestrator] Loaded ${libraryArticles.length} articles from library (skipLLM=${opts?.skipLLM ?? false})`);

  // Always fetch official sources first ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â fast and free
  // group=1 (manual refresh, batch 1): OFAC date news + Treasury SBs (~11 sources)
  // group=undefined (scheduled runs): fetch all sources
  console.log("[orchestrator] Fetching official government sources...");
  const officialSources = await fetchOfficialSources(opts?.section, { group: opts?.group, groupPart: opts?.groupPart });
  const successCount = officialSources.filter(s => s.content.length > 50).length;
  console.log(`[orchestrator] Got ${successCount}/${officialSources.length} official sources`);

  let briefing: Briefing;
  let usedProvider: string;

  // Even 1 successful source is enough ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â fall through to historical/library backfill
  // if most sources timed out. Only hard-fail if absolutely nothing came back.
  if (officialSources.length === 0) {
    throw new Error("No official sources fetched successfully");
  }

  // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Step 1: build structured briefing immediately (fast, ~0s) ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
  // This is always done first so we can pre-save a valid briefing with today's
  // timestamp BEFORE attempting the slow LLM call.  That guarantees Redis is
  // updated even if the LLM / enrichment steps are killed by CF's wall-clock limit.
  const structuredBriefingEarly = buildBriefingFromSources(officialSources);
  briefing = structuredBriefingEarly.articles.length >= 5
    ? structuredBriefingEarly
    : buildAnalyzedBriefing(officialSources);
  usedProvider = "Official Sources";

  // Pre-format context once so it can be passed to LLM without double-fetching
  const officialContext = formatSourcesForPrompt(officialSources);

  // Fill any section with < 8 articles using historical records
  const SECTIONS: Section[] = ["sanctions","economics","regions","occ","penalties","bis"];
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

  // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ GitHub OFAC cache ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â inject fresh scraped data committed by GH Actions ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
  // CF Workers can't reach ofac.treasury.gov (IP blocked). GH Actions scrapes it
  // and commits data/ofac-cache.json; we read it via raw.githubusercontent.com.
  // Only inject entries not already covered by Gemini/official sources (dedup by sourceUrl).
  try {
    const ofacCache = await fetchOfacCache();
    if (ofacCache) {
      const existingUrls = new Set(briefing.articles.map(a => a.sourceUrl).filter(Boolean) as string[]);
      const cachedActionArticles = recentActionsToArticles(ofacCache.recentActions)
        .filter(a => !existingUrls.has(a.sourceUrl!));
      const cachedPenaltyArticles = civilPenaltiesToArticles(ofacCache.civilPenalties)
        .filter(a => !existingUrls.has(a.sourceUrl!));
      // Inject articles from all scraped sanctions program pages
      const programArticles = ofacCache.programs
        ? programsToArticles(ofacCache.programs, 9200, existingUrls)
        : [];
      // UK OFSI / EU Commission ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â same idea as the OFAC injection above: these
      // are scraped and committed to the cache file by refresh-briefing.mjs
      // already, but previously had no converter here, so they sat unused and
      // never reached the live briefing or alert pipeline.
      const ofsiArticles = (ofacCache.ofsiNotices ?? [])
        .length > 0
        ? ofsiNoticesToArticles(ofacCache.ofsiNotices!).filter(a => !existingUrls.has(a.sourceUrl!))
        : [];
      const europaArticles = (ofacCache.europaNews ?? [])
        .length > 0
        ? europaNewsToArticles(ofacCache.europaNews!).filter(a => !existingUrls.has(a.sourceUrl!))
        : [];
      // Remaining direct-scrape feeds ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â same gap as OFSI/EU above: scraped and
      // committed by refresh-briefing.mjs already, but no converter here meant
      // none of this ever reached the live briefing or alert pipeline.
      const unArticles = (ofacCache.unNotices ?? [])
        .length > 0
        ? unNoticesToArticles(ofacCache.unNotices!).filter(a => !existingUrls.has(a.sourceUrl!))
        : [];
      const bbcArticles = (ofacCache.bbcNews ?? [])
        .length > 0
        ? bbcNewsToArticles(ofacCache.bbcNews!).filter(a => !existingUrls.has(a.sourceUrl!))
        : [];
      const ajArticles = (ofacCache.ajNews ?? [])
        .length > 0
        ? ajNewsToArticles(ofacCache.ajNews!).filter(a => !existingUrls.has(a.sourceUrl!))
        : [];
      const occArticles = (ofacCache.occNews ?? [])
        .length > 0
        ? occNewsToArticles(ofacCache.occNews!).filter(a => !existingUrls.has(a.sourceUrl!))
        : [];
      const economicsArticles = (ofacCache.economicsNews ?? [])
        .length > 0
        ? economicsNewsToArticles(ofacCache.economicsNews!).filter(a => !existingUrls.has(a.sourceUrl!))
        : [];
      const bisArticles = (ofacCache.bisNews ?? [])
        .length > 0
        ? bisNewsToArticles(ofacCache.bisNews!).filter(a => !existingUrls.has(a.sourceUrl!))
        : [];
      const regionsArticles = (ofacCache.regionsNews ?? [])
        .length > 0
        ? regionsNewsToArticles(ofacCache.regionsNews!).filter(a => !existingUrls.has(a.sourceUrl!))
        : [];
      const injected = [
        ...cachedActionArticles, ...cachedPenaltyArticles, ...programArticles,
        ...ofsiArticles, ...europaArticles, ...unArticles, ...bbcArticles,
        ...ajArticles, ...occArticles, ...economicsArticles, ...bisArticles, ...regionsArticles,
      ];
      if (injected.length > 0) {
        briefing.articles = [...briefing.articles, ...injected];
        console.log(`[orchestrator] Injected ${cachedActionArticles.length} recent-actions + ${cachedPenaltyArticles.length} penalties + ${programArticles.length} program GL/FR + ${ofsiArticles.length} OFSI + ${europaArticles.length} EU Commission + ${unArticles.length} UN + ${bbcArticles.length} BBC + ${ajArticles.length} Al Jazeera + ${occArticles.length} OCC + ${economicsArticles.length} Fed + ${bisArticles.length} BIS + ${regionsArticles.length} Regions from GitHub OFAC cache`);
      }
    }
  } catch (e) {
    console.warn("[orchestrator] GitHub OFAC cache fetch failed (non-fatal):", String(e).slice(0, 80));
  }

  // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Library accumulation ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â persist articles across refreshes (up to 50/section, 6 months) ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
  // Merge ALL library articles (not just backfill-to-8) so each section accumulates
  // up to 50 articles. The UI shows 15 by default with a "show more" toggle.
  if (libraryArticles.length > 0) {
    const SIX_MONTHS_MS = 180 * 24 * 60 * 60 * 1000;
    const retentionCutoff = Date.now() - SIX_MONTHS_MS;
    const MAX_PER_SECTION = 50;

    const liveHeadlines = new Set(
      briefing.articles.map(a => a.headline.slice(0, 80).toLowerCase().replace(/\s+/g, " ").trim())
    );
    const libraryBySection = new Map<string, typeof libraryArticles>();
    for (const a of libraryArticles) {
      const key = a.headline.slice(0, 80).toLowerCase().replace(/\s+/g, " ").trim();
      if (liveHeadlines.has(key)) continue; // already in live briefing
      // Apply 6-month retention filter
      const t = Date.parse(a.date || "");
      if (!isNaN(t) && Date.now() - t > SIX_MONTHS_MS) continue;
      const list = libraryBySection.get(a.section) ?? [];
      list.push(a);
      libraryBySection.set(a.section, list);
    }
    let totalAdded = 0;
    for (const sec of SECTIONS) {
      const freshCount = briefing.articles.filter(a => a.section === sec).length;
      const slots = MAX_PER_SECTION - freshCount;
      if (slots <= 0) continue;
      // Sort library articles newest-first before slicing
      const libForSec = (libraryBySection.get(sec) ?? [])
        .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
        .slice(0, slots);
      if (libForSec.length > 0) {
        briefing.articles = [...briefing.articles, ...libForSec];
        totalAdded += libForSec.length;
      }
    }
    if (totalAdded > 0) console.log(`[orchestrator] Added ${totalAdded} library articles for retention display`);
  }

  // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Per-source official backfill ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
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
        console.log(`[orchestrator] Backfilled ${fallback.length} ${keyword} articles from historical`);
      }
    }
  }

  // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ 3-tier source priority system ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
  // Tier 1 (official ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â always fetched first & always shown): OFAC, FinCEN, BIS,
  //         OCC, Federal Reserve, UK OFSI, EU
  // Tier 2 (Google News / general outlets ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â only kept if <= 30 days old)
  // Tier 3 (Al Jazeera, UN News, India MEA ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â always shown)
  //
  // Matching is done via keyword/substring rather than exact-name equality
  // because display names produced upstream are often compound, e.g.
  // "U.S. Treasury / OFAC", "OFAC / Iran", "EU Council ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Sanctions RSS".
  const officialKeywords = [
    "OFAC", "FinCEN", "BIS", "OCC", "Federal Reserve", "Fed Reserve×=¶‰ËkºwµçQ•È€‘í115}Q%5=UQ}5L€¼€ÄÀÀÁõÍ€¤¤°115}Q%5=UQ}5L¤(€€€€€€€€¤°(€€€€€t¤ì(€€€€€‰É¥•™¥¹œ€ôµ•É•¥É•Ñ]¥Ñ¡¥MÕÁÁ±•µ•¹Ğ¡‰É¥•™¥¹œ°É•ÍÕ±Ğ¹‰É¥•™¥¹œ¤ì(€€€€€€¼¼5…É¬•Ù•Éä•µ¥¹¤…ÉÑ¥±”Í¼Ñ¡”…±•ÉĞÁ¥Á•±¥¹”…¸•á±Õ‘”Ñ¡•´¸(€€€€€€¼¼114µ•¹•É…Ñ•…ÉÑ¥±•Ì¡…Ù”Á±…ÕÍ¥‰±”µ±½½­¥¹œÍ½ÕÉ”½UI0ÍÑÉ¥¹Ì‰ÕĞÑ¡”(€€€€€€¼¼UI1Ì…É”½™Ñ•¸¡…±±Õ¥¹…Ñ•ƒ
‹‹Šk
³‹Š
³
t„‰É½­•¸µ±¥¹¬…±•ÉĞ¥Ìİ½ÉÍ”Ñ¡…¸¹¼…±•ÉĞ¸(€€€€€ÕÍ•‘AÉ½Ù¥‘•È€ôÉ•ÍÕ±Ğ¹ÕÍ•‘AÉ½Ù¥‘•Èì(€€€€€½¹Í½±”¹±½œ¡m½É¡•ÍÑÉ…Ñ½Ét114ÍÕ••‘•€ ‘íÕÍ•‘AÉ½Ù¥‘•Éô¥€¤ì(€€€€€€¼¼9=Qè•µ¥¹¤…ÉÑ¥±•Ì…É”9=PÍ…Ù•Ñ¼Ñ¡”±¥‰É…Éäƒ
‹‹Šk
³‹Š
³
tÑ¡•ä…¸½¹Ñ…¥¸(€€€€€€¼¼¡…±±Õ¥¹…Ñ•UI1Ì½Í½ÕÉ•Ì¸€=¹±äÉ•…°IML½ÍÉ…Á”…ÉÑ¥±•Ì€¡¥¹©•Ñ•(€€€€€€¼¼‰•±½Ü™É½´Ñ¡”=…¡”¤…É”Á•ÉÍ¥ÍÑ•™½È™ÕÑÕÉ”ÕÍ”¸(€€€ô…Ñ €¡±±µÉÉ½È¤ì(€€€€€½¹ÍĞÉ•…Í½¸€ôMÑÉ¥¹œ¡±±µÉÉ½È¤¹Í±¥” À°€ÄÈÀ¤ì(€€€€€½¹Í½±”¹±½œ ‰m½É¡•ÍÑÉ…Ñ½Ét114Õ¹…Ù…¥±…‰±”ƒ
‹‹Šk
³‹Š
³
t­••Á¥¹œÍÑÉÕÑÕÉ•‰É¥•™¥¹œèˆ°É•…Í½¸¤ì(€€€€€€¼¼‰É¥•™¥¹œ€¼ÕÍ•‘AÉ½Ù¥‘•È…±É•…‘äÍ•ĞÑ¼ÍÑÉÕÑÕÉ•…‰½Ù”ƒ
‹‹Šk
³‹Š
³
t¹¼¡…¹”¹••‘•(€€€ô(€ô((€€¼¼ƒ
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
°€‰9¼¹•İÌˆ€¼¹½¸µ•Ù•¹Ğ™¥±±•ÈÕ…Éƒ
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
°(€€¼¼M…µ”Á…ÑÑ•É¸…Ì…±•ÉĞµÍ½É•È¹ÑÌÌ9=}9]M}AQQI8Ù•Ñ¼…¹(€€¼¼É•™É•Í µ‰É¥•™¥¹œ¹µ©ÌÌÍ…Ù”µÑ¥µ”™¥±Ñ•È¸Q¡¥Ì™Õ¹Ñ¥½¸¥Ì„Q!%I°(€€¼¼¥¹‘•Á•¹‘•¹Ğ•µ¥¹¤µ…±°µ…¹µÍ…Ù”Á…Ñ €¡¡¥Ğ‘¥É•Ñ±ä‰ä€½…Á¤½É•™É•Í ƒ
‹‹Šk
³‹Š
³
t(€€¼¼øÄÕà½‘…äÙ¥„Ñ¡”¥Ñ!ÕˆÑ¥½¹Ì€‰™…ÍĞÁ…Ñ ˆÍÑ•À°…¹‰äÑ¡”¥¸µ…ÁÀ(€€¼¼€‰I•™É•Í 9½Üˆ‰ÕÑÑ½¸¤Ñ¡…ĞÍ…Ù•ÌÍÑÉ…¥¡ĞÑ¼I•‘¥Ì…¹İ…Ì¹½Ğ½Ù•É•‰ä(€€¼¼•¥Ñ¡•È½˜Ñ¡½Í”½Ñ¡•ÈÑİ¼™¥á•Ì¸]¥Ñ¡½ÕĞÑ¡¥Ì°„™¥±±•È…ÉÑ¥±”™É½´(€€¼¼Q!%LÁ…Ñ Ì½İ¸•µ¥¹¤…±°½Õ±ÍÑ¥±°‘¥ÍÁ±…ä½¸Ñ¡”±¥Ù”Í¥Ñ”ƒ
‹‹Šk
³‹Š
³
t(€€¼¼…±•ÉĞµÍ½É•È¹ÑÌÌÙ•Ñ¼½¹±ä‰±½­ÌÑ¡”Q•±•É…´…±•ÉĞ°¹½ĞÑ¡”Á…”¸(€€¼¼I••àµ½¹±ä°‘•±¥‰•É…Ñ•±ä¹¼¹•Ñİ½É¬…±±Ìè„Á•Èµ…ÉÑ¥±”±¥¹¬µ•á¥ÍÑ•¹”(€€¼¼¡•¬İ½Õ±…‘øÈÀ¬™•Ñ¡•Ì½¸Ñ½À½˜Ñ¡”•¹É¥¡µ•¹Ğ…±±Ì‰•±½Ü°İ¡¥ (€€¼¼É¥Í­ÌÑÉ¥ÁÁ¥¹œ±½Õ‘™±…É”]½É­•ÉÌœÁ•Èµ¥¹Ù½…Ñ¥½¸ÍÕ‰É•ÅÕ•ÍĞ…À€¡Í•”Ñ¡”(€€¼¼€‰M…Ù”Ñ¡”½É”‰É¥•™¥¹œ%IMPˆ½µµ•¹Ğ™ÕÉÑ¡•È‘½İ¸™½Èİ¡äÑ¡…Ğ‰Õ‘•Ğ(€€¼¼¥Ì…±É•…‘äÑ¥¡Ğ¡•É”¤¸1¥¹¬Ù•É¥™¥…Ñ¥½¸¥¹ÍÑ•…±¥Ù•Ì½¹±ä¥¸(€€¼¼É•™É•Í µ‰É¥•™¥¹œ¹µ©Ì°İ¡¥ ÉÕ¹Ì¥¸¥Ñ!ÕˆÑ¥½¹Ìİ¥Ñ ¹¼ÍÕ …À¸(€€¼¼‘‘•€ÈÀÈØ´ÀØ´Èà…™Ñ•ÈÑ¡”Í…µ”…Àİ…Ì™½Õ¹…¹±½Í•¥¸Ñ¡”½Ñ¡•ÈÑİ¼(€€¼¼Á¥Á•±¥¹•Ì¸(€½¹ÍĞ9=}9]M}AQQI8€ô€½q‰¹¼¹•İq‰ñq‰Í¡½İÌ¹½q‰ñq‰É•Á½ÉÑÌü¹½q‰ñq‰¹¼…‘‘¥Ñ¥½¹Ìıq‰ñq‰¹¼¡…¹•Ìıq‰ñq‰¹½Ñ¡¥¹œ¹•İq‰ñq‰É•µ…¥¹ÌüÕ¹¡…¹•‘q‰ñq‰‘¥¹½Ğ…‘‘q‰ñq‰¹¼•¹ÑÉ¥•Ì€ üéİ•É”ñ¡…Ù”‰••¸€¤ı…‘‘•‘q‰ñq‰¹¼ÕÁ‘…Ñ•Ìü€ üéİ•É”ñ¡…Ù”‰••¸€¤ü üéµ…‘•ñÉ•Á½ÉÑ•¥q‰ñq‰¹¼…Ñ¥½¹Ìü€ üéİ•É”ñ¡…Ù”‰••¸€¤ü üéÑ…­•¹ñÉ•Á½ÉÑ•¥qˆ½¤ì(€½¹ÍĞ‰•™½É•9½9•İÍ¥±Ñ•È€ô‰É¥•™¥¹œ¹…ÉÑ¥±•Ì¹±•¹Ñ ì(€‰É¥•™¥¹œ¹…ÉÑ¥±•Ì€ô‰É¥•™¥¹œ¹…ÉÑ¥±•Ì¹™¥±Ñ•È¡„€ôøì(€€€½¹ÍĞÑ•áĞ€ô€‘í„¹¡•…‘±¥¹”€üü€ˆ‰ô€‘ì¡„¹‰½‘ä€üümt¥lÁt€üü€ˆ‰õ€ì(€€€½¹ÍĞ¥Í¥±±•È€ô9=}9]M}AQQI8¹Ñ•ÍĞ¡Ñ•áĞ¤ì(€€€¥˜€¡¥Í¥±±•È¤½¹Í½±”¹±½œ¡m½É¡•ÍÑÉ…Ñ½ÉtÉ½ÁÁ•¹¼µ¹•İÌ™¥±±•È…ÉÑ¥±”è€ˆ‘í„¹¡•…‘±¥¹•ô‰€¤ì(€€€É•ÑÕÉ¸€…¥Í¥±±•Èì(€ô¤ì(€¥˜€¡‰É¥•™¥¹œ¹…ÉÑ¥±•Ì¹±•¹Ñ €ğ‰•™½É•9½9•İÍ¥±Ñ•È¤ì(€€€½¹Í½±”¹±½œ¡m½É¡•ÍÑÉ…Ñ½Ét¥±Ñ•É•€‘í‰•™½É•9½9•İÍ¥±Ñ•È€´‰É¥•™¥¹œ¹…ÉÑ¥±•Ì¹±•¹Ñ¡ô¹¼µ¹•İÌ™¥±±•È…ÉÑ¥±”¡Ì¥€¤ì(€ô((€½¹ÍĞ‰•™½É•½ÉÉÕÁÑ¥±Ñ•È€ô‰É¥•™¥¹œ¹…ÉÑ¥±•Ì¹±•¹Ñ ì(€‰É¥•™¥¹œ¹…ÉÑ¥±•Ì€ô‰É¥•™¥¹œ¹…ÉÑ¥±•Ì¹™¥±Ñ•È¡¥Í¥ÍÁ±…å…‰±•9•İÍÉÑ¥±”¤ì(€¥˜€¡‰É¥•™¥¹œ¹…ÉÑ¥±•Ì¹±•¹Ñ €ğ‰•™½É•½ÉÉÕÁÑ¥±Ñ•È¤ì(€€€½¹Í½±”¹±½œ¡m½É¡•ÍÑÉ…Ñ½ÉtI•µ½Ù•€‘í‰•™½É•½ÉÉÕÁÑ¥±Ñ•È€´‰É¥•™¥¹œ¹…ÉÑ¥±•Ì¹±•¹Ñ¡ô½ÉÉÕÁÑ•°™É…µ•¹Ğ°½È¹½¸µ‘¥É•Ğµ±¥¹¬…ÉÑ¥±”¡Ì¥€¤ì(€ô((€€¼¼ƒ
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
°É½ÕÀµµ½‘”…‘‘¥Ñ¥Ù”µ•É”ƒ
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
°(€€¼¼]¡•¸™•Ñ¡¥¹œ„ÍÁ•¥™¥ŒÉ½ÕÀ€ ÄÄ´ÈØÍ½ÕÉ•Ì•… ƒ
‹‹Šk
³‹Š
³
tÍ…™•±äÕ¹‘•ÈÌ(€€¼¼€ÔÀµÍÕ‰É•ÅÕ•ÍĞ±¥µ¥Ğ¤°µ•É”¹•Ü…ÉÑ¥±•Ì%9Q<Ñ¡”•á¥ÍÑ¥¹œI•‘¥Ì‰É¥•™¥¹œ(€€¼¼¥¹ÍÑ•…½˜½Ù•ÉİÉ¥Ñ¥¹œ¥Ğ¸… É•™É•Í ¹åµ°å±”…±±Ì€½…Á¤½É•™É•Í €ÓK‹Š
³Št(€€¼¼€¡É½ÕÀ€Ä°€È°€Ì°€ĞÍ•ÅÕ•¹Ñ¥…±±ä¤ìİ¥Ñ¡½ÕĞÑ¡¥Ì°É½ÕÀ€ĞÌÍ…Ù”İ½Õ±İ¥Á”(€€¼¼•Ù•ÉåÑ¡¥¹œİÉ¥ÑÑ•¸‰äÉ½ÕÁÌ€Ä°€È°€Ì¸(€¥˜€¡½ÁÑÌü¹É½ÕÀ€„ôôÕ¹‘•™¥¹•¤ì(€€€ÑÉäì(€€€€€½¹ÍĞ•á¥ÍÑ¥¹œ€ô…İ…¥ĞÍÑ½É…”¹±½… ¤ì(€€€€€¥˜€¡•á¥ÍÑ¥¹œü¹…ÉÑ¥±•Ìü¹±•¹Ñ ¤ì(€€€€€€€½¹ÍĞÕÉÉ•¹Ñ-•åÌ€ô¹•ÜM•Ğ (€€€€€€€€€‰É¥•™¥¹œ¹…ÉÑ¥±•Ì¹µ…À¡„€ôø(€€€€€€€€€€€„¹¡•…‘±¥¹”¹Í±¥” À°€àÀ¤¹Ñ½1½İ•É…Í” ¤¹É•Á±…” ½qÌ¬½œ°€ˆ€ˆ¤¹ÑÉ¥´ ¤(€€€€€€€€€€¤(€€€€€€€€¤ì(€€€€€€€½¹ÍĞ™É½µá¥ÍÑ¥¹œ€ô•á¥ÍÑ¥¹œ¹…ÉÑ¥±•Ì¹™¥±Ñ•È¡„€ôø(€€€€€€€€€¡…ÍUÍ…‰±•ÉÑ¥±•Q•áĞ¡„¤€˜˜(€€€€€€€€€€…ÕÉÉ•¹Ñ-•åÌ¹¡…Ì¡„¹¡•…‘±¥¹”¹Í±¥” À°€àÀ¤¹Ñ½1½İ•É…Í” ¤¹É•Á±…” ½qÌ¬½œ°€ˆ€ˆ¤¹ÑÉ¥´ ¤¤(€€€€€€€€¤ì(€€€€€€€¥˜€¡™É½µá¥ÍÑ¥¹œ¹±•¹Ñ €ø€À¤ì(€€€€€€€€€‰É¥•™¥¹œ¹…ÉÑ¥±•Ì€ôl¸¸¹‰É¥•™¥¹œ¹…ÉÑ¥±•Ì°€¸¸¹™É½µá¥ÍÑ¥¹tì(€€€€€€€€€€¼¼I”µÍ½ÉĞÑ¼­••ÀÑ¥•È½É‘•È½¹Í¥ÍÑ•¹Ğ…™Ñ•Èµ•É”(€€€€€€€€€‰É¥•™¥¹œ¹…ÉÑ¥±•Ì€ô‰É¥•™¥¹œ¹…ÉÑ¥±•Ì¹Í½ÉĞ ¡„°ˆ¤€ôøì(€€€€€€€€€€€½¹ÍĞÁ„€ô•ÑAÉ¥½É¥Ñä¡„¹Í½ÕÉ”¤°Áˆ€ô•ÑAÉ¥½É¥Ñä¡ˆ¹Í½ÕÉ”¤ì(€€€€€€€€€€€¥˜€¡Áˆ€„ôôÁ„¤É•ÑÕÉ¸Áˆ€´Á„ì(€€€€€€€€€€€É•ÑÕÉ¸€¡ˆ¹‘…Ñ”ñğ€ˆˆ¤¹±½…±•½µÁ…É”¡„¹‘…Ñ”ñğ€ˆˆ¤ì(€€€€€€€€€ô¤ì(€€€€€€€€€½¹Í½±”¹±½œ¡m½É¡•ÍÑÉ…Ñ½ÉtÉ½ÕÀ€‘í½ÁÑÌ¹É½ÕÁô…‘‘¥Ñ¥Ù”µ•É”è€¬‘í™É½µá¥ÍÑ¥¹œ¹±•¹Ñ¡ô™É½´•á¥ÍÑ¥¹œƒ
‹‹Š
³
ƒ‹Š
³Šˆ€‘í‰É¥•™¥¹œ¹…ÉÑ¥±•Ì¹±•¹Ñ¡ôÑ½Ñ…±€¤ì(€€€€€€€ô(€€€€€ô(€€€ô…Ñ €¡”¤ì(€€€€€½¹Í½±”¹±½œ ‰m½É¡•ÍÑÉ…Ñ½Ét‘‘¥Ñ¥Ù”µ•É”™…¥±•€¡¹½¸µ™…Ñ…°¤èˆ°MÑÉ¥¹œ¡”¤¹Í±¥” À°€àÀ¤¤ì(€€€ô(€ô((€€¼¼ƒ
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
°M•Ñ¥½¸µÍ½Á•µ•É”è‘½¸Ğ½Ù•ÉİÉ¥Ñ”½Ñ¡•ÈÍ•Ñ¥½¹Ìƒ
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
°(€€¼¼]¡•¸„ÍÁ•¥™¥ŒÍ•Ñ¥½¸¥ÌÉ•™É•Í¡•€¡”¹œ¸	%L¤°½¹±äÉ•Á±…”Ñ¡…ĞÍ•Ñ¥½¸Ì(€€¼¼…ÉÑ¥±•Ì¥¸I•‘¥Ì¸]¥Ñ¡½ÕĞÑ¡¥Ì°É•™É•Í¡¥¹œ	%Lİ½Õ±½Ù•ÉİÉ¥Ñ”Í…¹Ñ¥½¹Ì°(€€¼¼Á•¹…±Ñ¥•Ì°•ÑŒ¸İ¥Ñ €ÈÀÈÔ¡¥ÍÑ½É¥…°‰…­™¥±°…ÉÑ¥±•Ì¸(€¥˜€¡½ÁÑÌü¹Í•Ñ¥½¸€˜˜½ÁÑÌ¹Í•Ñ¥½¸€„ôô€‰…±°ˆ¤ì(€€€½¹ÍĞ•á¥ÍÑ¥¹œ€ô…İ…¥ĞÍÑ½É…”¹±½… ¤ì(€€€¥˜€¡•á¥ÍÑ¥¹œü¹…ÉÑ¥±•Ìü¹±•¹Ñ ¤ì(€€€€€½¹ÍĞ½Ñ¡•ÉÉÑ¥±•Ì€ô•á¥ÍÑ¥¹œ¹…ÉÑ¥±•Ì¹™¥±Ñ•È¡„€ôø„¹Í•Ñ¥½¸€„ôô½ÁÑÌ¹Í•Ñ¥½¸¤ì(€€€€€½¹ÍĞ¹•İM•Ñ¥½¹ÉÑ¥±•Ì€ô‰É¥•™¥¹œ¹…ÉÑ¥±•Ì¹™¥±Ñ•È¡„€ôø„¹Í•Ñ¥½¸€ôôô½ÁÑÌ¹Í•Ñ¥½¸¤ì(€€€€€½¹Í½±”¹±½œ¡m½É¡•ÍÑÉ…Ñ½ÉtM•Ñ¥½¸µ•É”è€‘í¹•İM•Ñ¥½¹ÉÑ¥±•Ì¹±•¹Ñ¡ô¹•Ü€‘í½ÁÑÌ¹Í•Ñ¥½¹ô…ÉÑ¥±•Ì€¬€‘í½Ñ¡•ÉÉÑ¥±•Ì¹±•¹Ñ¡ô­•ÁĞ™É½´•á¥ÍÑ¥¹€¤ì(€€€€€‰É¥•™¥¹œ¹…ÉÑ¥±•Ì€ôl¸¸¹¹•İM•Ñ¥½¹ÉÑ¥±•Ì°€¸¸¹½Ñ¡•ÉÉÑ¥±•Ítì(€€€€€€¼¼AÉ•Í•ÉÙ”•á¥ÍÑ¥¹œÍ¥‘•‰…È™½È½Ñ¡•ÈÍ•Ñ¥½¹Ì(€€€€€‰É¥•™¥¹œ¹Í¥‘•‰…È€ôì(€€€€€€€€¸¸¹•á¥ÍÑ¥¹œ¹Í¥‘•‰…È°(€€€€€€€€¸¸¸¡‰É¥•™¥¹œ¹Í¥‘•‰…Èü¹m½ÁÑÌ¹Í•Ñ¥½¸…Ì­•å½˜ÑåÁ•½˜‰É¥•™¥¹œ¹Í¥‘•‰…Ét(€€€€€€€€€€üìm½ÁÑÌ¹Í•Ñ¥½¹tè‰É¥•™¥¹œ¹Í¥‘•‰…Ém½ÁÑÌ¹Í•Ñ¥½¸…Ì­•å½˜ÑåÁ•½˜‰É¥•™¥¹œ¹Í¥‘•‰…Étô(€€€€€€€€€€èíô¤°(€€€€€ôì(€€€ô(€ô((€½¹ÍĞ‰•™½É•!½Ñ…À€ô‰É¥•™¥¹œ¹…ÉÑ¥±•Ì¹±•¹Ñ ì(€‰É¥•™¥¹œ¹…ÉÑ¥±•Ì€ô…Á!½Ñ	É¥•™¥¹ÉÑ¥±•Ì¡‰É¥•™¥¹œ¹…ÉÑ¥±•Ì¤ì(€¥˜€¡‰É¥•™¥¹œ¹…ÉÑ¥±•Ì¹±•¹Ñ €ğ‰•™½É•!½Ñ…À¤ì(€€€½¹Í½±”¹±½œ¡m½É¡•ÍÑÉ…Ñ½Ét…ÁÁ•¡½Ğ‰É¥•™¥¹œ™É½´€‘í‰•™½É•!½Ñ…ÁôÑ¼€‘í‰É¥•™¥¹œ¹…ÉÑ¥±•Ì¹±•¹Ñ¡ôì™Õ±°¡¥ÍÑ½ÉäÉ•µ…¥¹Ì¥¸Ñ¡”…ÉÑ¥±”±¥‰É…Éå€¤ì(€ô((€€¼¼ƒ
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
°M…Ù”Ñ¡”½É”‰É¥•™¥¹œ%IMPƒ
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
³
‹‹Š
³
w‹Šk
°(€€¼¼±½Õ‘™±…É”]½É­•ÉÌ…ÁÌÍÕ‰É•ÅÕ•ÍÑÌÁ•È¥¹Ù½…Ñ¥½¸¸	É¥•˜•¹É¥¡µ•¹Ğ‰•±½Ü(€€¼¼‘½•ÌÁ•Èµ…ÉÑ¥±”I•‘¥Ì…¡”±½½­ÕÁÌ€¬…ÉÑ¥±”™•Ñ¡•Ì€¬•µ¥¹¤…±±Ì°(€€¼¼İ¡¥ …¸•á¡…ÕÍĞÑ¡…Ğ‰Õ‘•Ğƒ
‹‹Šk
³‹Š
³
t…ÕÍ¥¹œÑ¡”€©É•…°¨UÁÍÑ…Í Í…Ù”Ñ¼Ñ¡É½Ü(€€¼¼€‰Q½¼µ…¹äÍÕ‰É•ÅÕ•ÍÑÌ‰äÍ¥¹±”]½É­•È¥¹Ù½…Ñ¥½¸ˆİ¡¥±”Ñ¡”¥¸µµ•µ½Éä(€€¼¼™…±±‰…¬Í¥±•¹Ñ±ä€‰ÍÕ••‘Ì°ˆµ…Í­¥¹œÑ¡”™…¥±ÕÉ”€¡É•™É•Í ÍÑ¥±°É•Á½ÉÑÌ(€€¼¼½¬éÑÉÕ”°‰ÕĞI•‘¥Ì¹•Ù•È•ÑÌÑ¡”™É•Í ‘…Ñ„ƒ
‹‹Šk
³‹Š
³
t±…ÍÑUÁ‘…Ñ•ÍÑ…åÌ™É½é•¸¤¸(€€¼¼M…Ù¥¹œ¡•É”Õ…É…¹Ñ••ÌÑ¡”½ÉÉ•Ñ±äµ‘…Ñ•½™™¥¥…°µÍ½ÕÉ”…ÉÑ¥±•Ì…¹(€€¼¼…ÍÑ•É¸µÑ¥µ”±…ÍÑUÁ‘…Ñ•Á•ÉÍ¥ÍĞ‰•™½É”•¹É¥¡µ•¹Ğ…¸ÍÑ…ÉÙ”Ñ¡”‰Õ‘•Ğ¸(€±•ĞÁÉ•M…Ù•MÕ•ÍÌ€ô™…±Í”ì(€ÑÉäì(€€€…İ…¥ĞÍÑ½É…”¹Í…Ù”¡‰É¥•™¥¹œ°ìÉ•ÅÕ¥É•A•ÉÍ¥ÍÑ•¹ĞèÑÉÕ”ô¤ì(€€€ÁÉ•M…Ù•MÕ•ÍÌ€ôÍÑ½É…”¹•Ñ!•…±Ñ  ¤¹Í½µ”¡ €ôø ¹¥€ôôô€‰ÕÁÍÑ…Í ˆ€˜˜ ¹¡•…±Ñ¡ä¤ì(€€€½¹Í½±”¹±½œ ‰m½É¡•ÍÑÉ…Ñ½ÉtM…Ù•½É”‰É¥•™¥¹œ€¡ÁÉ”µ•¹É¥¡µ•¹Ğ¤°ÕÁÍÑ…Í èˆ°ÁÉ•M…Ù•MÕ•ÍÌ¤ì(€€€¥˜€¡ÁÉ•M…Ù•MÕ•ÍÌ¤ì(€€€€€½¹ÍĞ¡•­Á½¥¹ÑUÁ‘…Ñ•Ì€ô½™™¥¥…±M½ÕÉ•Ì(€€€€€€€€¹µ…À¡Í½ÕÉ”€ôøÍ½ÕÉ”¹¡•­Á½¥¹Ğ¤(€€€€€€€€¹™¥±Ñ•È ¡¡•­Á½¥¹Ğ¤è¡•­Á½¥¹Ğ¥ÌìÕÉ°èÍÑÉ¥¹œì¥Ñ•µ-•åÌèÍÑÉ¥¹mtô€ôø€„…¡•­Á½¥¹Ğ¤ì(€€€€€…İ…¥Ğ½µµ¥ÑM½ÕÉ•%Ñ•µ¡•­Á½¥¹ÑÌ¡¡•­Á½¥¹ÑUÁ‘…Ñ•Ì¤ì(€€€€€½¹Í½±”¹±½œ¡m½É¡•ÍÑÉ…Ñ½Ét½µµ¥ÑÑ•€‘í¡•­Á½¥¹ÑUÁ‘…Ñ•Ì¹±•¹Ñ¡ôÍ½ÕÉ”¡•­Á½¥¹ÑÌ…™Ñ•ÈÍÕ•ÍÍ™Õ°Í…Ù•€¤ì(€€€ô(€ô…Ñ €¡”¤ì(€€€½¹Í½±”¹±½œ ‰m½É¡•ÍÑÉ…Ñ½ÉtAÉ”µÍ…Ù”™…¥±•èˆ°MÑÉ¥¹œ¡”¤¹Í±¥” À°€ÄÀÀ¤¤ì(€ô((€€¼¼É½ÕÀÉ•™É•Í¡•Ì¥¹Ñ•¹Ñ¥½¹…±±äÍÑ½À…™Ñ•ÈÁ•ÉÍ¥ÍÑ¥¹œÑ¡”‰½Õ¹‘•±¥Ù”(€€¼¼‰É¥•™¥¹œ¸5•É¥¹œÑ¡”Í…µ”…ÉÑ¥±•Ì¥¹Ñ¼Ñ¡”Õ¹‰½Õ¹‘•¡¥ÍÑ½É¥…°±¥‰É…Éä(€€¼¼É•ÅÕ¥É•Ì±½…‘¥¹œ…¹Í•É¥…±¥é¥¹œÑ¡”™Õ±°…É¡¥Ù”…¹İ…ÌÑ¡”µ…¥¸Í½ÕÉ”(€€¼¼½˜±½Õ‘™±…É”€ÄÄÀÈAT™…¥±ÕÉ•Ì¸Õ±°½•¹É¥¡µ•¹ĞÉ•™É•Í¡•Ì‰•±½Ü½¹Ñ¥¹Õ”(€€¼¼Ñ¼µ…¥¹Ñ…¥¸Ñ¡”¡¥ÍÑ½É¥…°±¥‰É…Éä½ÕÑÍ¥‘”Ñ¡¥ÌÑ¥µ”µÉ¥Ñ¥…°…±•ÉĞÁ…Ñ ¸((€€¼¼¹É¥ …ÉÑ¥±•Ìİ¥Ñ $µ•¹•É…Ñ•‰É¥•™Ì€¡…¡•¥¸I•‘¥Ì°ÉÕ¹Ì…Íå¹Œ¤(€€¼¼M­¥ÁÁ•½¸µ…¹Õ…°É•™É•Í €¡Ñ½¼Í±½Ü™½È¥¹Ñ•É…Ñ¥Ù”ÕÍ”¤…¹İ¡•¸Í­¥Á114õÑÉÕ”¸(€€¼¼	•ÍĞµ•™™½ÉĞè™…¥±ÕÉ”¡•É”‘½•Ì¹½Ğ±½Í”‘…Ñ„°Í¥¹”Ñ¡”½É”‰É¥•™¥¹œ¥Ì…±É•…‘äÍ…Ù•…‰½Ù”¸(€¥˜€¡¹••‘Í114€˜˜€…½ÁÑÌü¹µ…¹Õ…±I•™É•Í €˜˜€¡ÕÍ•‘AÉ½Ù¥‘•È¹¥¹±Õ‘•Ì ‰=™™¥¥…°M½ÕÉ•Ìˆ¤ñğÕÍ•‘AÉ½Ù¥‘•È¹¥¹±Õ‘•Ì ‰1½…°¹…±åÍ¥Ìˆ¤¤¤ì(€€€ÑÉäì(€€€€€½¹Í½±”¹±½œ ‰m½É¡•ÍÑÉ…Ñ½Ét¹É¥¡¥¹œ…ÉÑ¥±”‰É¥•™Ì¸¸¸ˆ¤ì(€€€€€½¹ÍĞÍ…¹Ñ¥½¹ÍÉÑ¥±•Ì€ô‰É¥•™¥¹œ¹…ÉÑ¥±•Ì(€€€€€€€€¹™¥±Ñ•È¡„€ôø„¹Í½ÕÉ•UÉ°¤(€€€€€€€€¹µ…À¡„€ôø€¡ìÍ½ÕÉ•UÉ°è„¹Í½ÕÉ•UÉ°„°¡•…‘±¥¹”è„¹¡•…‘±¥¹”°‰½‘äè„¹‰½‘äô¤¤ì((€€€€€½¹ÍĞ•¹É¥¡•€ô…İ…¥Ğ•¹É¥¡ÉÑ¥±•Í]¥Ñ¡	É¥•™Ì¡Í…¹Ñ¥½¹ÍÉÑ¥±•Ì¤ì(€€€€€¥˜€¡•¹É¥¡•¹Í¥é”€ø€À¤ì(€€€€€€€‰É¥•™¥¹œ¹…ÉÑ¥±•Ì€ô‰É¥•™¥¹œ¹…ÉÑ¥±•Ì¹µ…À¡„€ôøì(€€€€€€€€€½¹ÍĞ¹•İ	É¥•˜€ô„¹Í½ÕÉ•UÉ°€ü•¹É¥¡•¹•Ğ¡„¹Í½ÕÉ•UÉ°¤€èÕ¹‘•™¥¹•ì(€€€€€€€€€É•ÑÕÉ¸¹•İ	É¥•˜€üì€¸¸¹„°‰½‘äèm¹•İ	É¥•˜°€¸¸¹„¹‰½‘ä¹Í±¥” Ä¥tô€è„ì(€€€€€€€ô¤ì(€€€€€€€½¹Í½±”¹±½œ¡m½É¡•ÍÑÉ…Ñ½Ét¹É¥¡•€‘í•¹É¥¡•¹Í¥é•ô…ÉÑ¥±”‰É¥•™Í€¤ì((€€€€€€€€¼¼M…Ù”•¹É¥¡•…ÉÑ¥±•ÌÑ¼Ñ¡”Á•ÉÍ¥ÍÑ•¹Ğ±¥‰É…Éäƒ
‹‹Šk
³‹Š
³
tÉ•…°IML½ÍÉ…Á”½¹±ä°(€€€€€€€€¼¼¹•Ù•È$µ•¹•É…Ñ•…ÉÑ¥±•Ì€¡Ñ¡½Í”¡…Ù”¡…±±Õ¥¹…Ñ•UI1Ì¤¸(€€€€€€€½¹ÍĞ•¹É¥¡•‘ÉÑ¥±•Ì€ô‰É¥•™¥¹œ¹…ÉÑ¥±•Ì¹™¥±Ñ•È¡„€ôø(€€€€€€€€€„¹Í½ÕÉ•UÉ°€˜˜•¹É¥¡•¹¡…Ì¡„¹Í½ÕÉ•UÉ°¤€˜˜€„¡„…Ì…¹ä¤¹…¥•¹•É…Ñ•(€€€€€€€€¤ì(€€€€€€€Í…Ù•ÉÑ¥±•ÍQ½1¥‰É…Éä¡•¹É¥¡•‘ÉÑ¥±•Ì¤¹…Ñ ¡”€ôø(€€€€€€€€€½¹Í½±”¹±½œ ‰m½É¡•ÍÑÉ…Ñ½Ét1¥‰É…ÉäÍ…Ù”™…¥±•€¡¹½¸µ™…Ñ…°¤èˆ°MÑÉ¥¹œ¡”¤¹Í±¥” À°€àÀ¤¤(€€€€€€€€¤ì((€€€€€€€€¼¼I”µÍ…Ù”‰É¥•™¥¹œİ¥Ñ •¹É¥¡•‰É¥•™ÌÍ¼ÕÍ•ÉÌÍ•”•µ¥¹¤ÍÕµµ…É¥•Ì¥µµ•‘¥…Ñ•±ä¸(€€€€€€€€¼¼Q¡¥ÌÍ…Ù”¥Ì‰•ÍĞµ•™™½ÉĞƒ
‹‹Šk
³‹Š
³
t¥˜¥Ğ™…¥±Ì€¡ÍÕ‰É•ÅÕ•ÍĞ±¥µ¥Ğ¤°Ñ¡”ÁÉ”µÍ…Ù”½Áä(€€€€€€€€¼¼€¡İ¥Ñ •¹•É¥Œ‰É¥•™Ì¤¥Ì…±É•…‘ä¥¸I•‘¥Ì…¹Ñ¡”±¥‰É…Éäİ¥±°ÁÉ½Á……Ñ”(€€€€€€€€¼¼•¹É¥¡•‰É¥•™Ì½¸Ñ¡”¹•áĞÉ•™É•Í å±”¸(€€€€€€€ÑÉäì(€€€€€€€€€…İ…¥ĞÍÑ½É…”¹Í…Ù”¡‰É¥•™¥¹œ°ìÉ•ÅÕ¥É•A•ÉÍ¥ÍÑ•¹ĞèÑÉÕ”ô¤ì(€€€€€€€€€½¹Í½±”¹±½œ ‰m½É¡•ÍÑÉ…Ñ½ÉtI”µÍ…Ù•‰É¥•™¥¹œİ¥Ñ •¹É¥¡•‰É¥•™Ìˆ¤ì(€€€€€€€ô…Ñ €¡Í…Ù•ÉÈ¤ì(€€€€€€€€€½¹Í½±”¹±½œ ‰m½É¡•ÍÑÉ…Ñ½ÉtI”µÍ…Ù”™…¥±•€¡¹½¸µ™…Ñ…°°ÁÉ”µÍ…Ù”¥¹Ñ…Ğ¤èˆ°MÑÉ¥¹œ¡Í…Ù•ÉÈ¤¹Í±¥” À°€àÀ¤¤ì(€€€€€€€ô(€€€€€ô(€€€ô…Ñ €¡”¤ì(€€€€€½¹Í½±”¹±½œ ‰m½É¡•ÍÑÉ…Ñ½Ét	É¥•˜•¹É¥¡µ•¹Ğ™…¥±•€¡¹½¸µ™…Ñ…°¤èˆ°MÑÉ¥¹œ¡”¤¹Í±¥” À°€ÄÀÀ¤¤ì(€€€ô(€ô((€€¼¼	Õ¥±Í…Ù•‘Q¼™É½´ÁÉ”µÍ…Ù”É•ÍÕ±ĞÍ¼•¹É¥¡µ•¹ĞÍ…Ù”™…¥±ÕÉ•Ì‘½¸Ğ(€€¼¼¥¹½ÉÉ•Ñ±äÉ•Á½ÉĞUÁÍÑ…Í …Ìµ¥ÍÍ¥¹œ•Ù•¸İ¡•¸Ñ¡”½É”‰É¥•™¥¹œİ…ÌÍ…Ù•¸(€½¹ÍĞ¡•…±Ñ €ôÍÑ½É…”¹•Ñ!•…±Ñ  ¤ì(€½¹ÍĞÍ…Ù•‘Q¼€ôl(€€€€¸¸¸¡ÁÉ•M…Ù•MÕ•ÍÌ€ül‰ÕÁÍÑ…Í ‰t€èmt¤°(€€€€‰µ•µ½Éäˆ°(€tì(€½¹ÍĞÍÑ½É…•ÉÉ½ÉÌ€ô¡•…±Ñ ¹™¥±Ñ•È¡ €ôø€… ¹¡•…±Ñ¡ä¤¹µ…À¡ €ôø€¡ì¥è ¹¥°•ÉÉ½Èè ¹±…ÍÑÉÉ½Èô¤¤ì((€É•ÑÕÉ¸ì‰É¥•™¥¹œ°ÕÍ•‘AÉ½Ù¥‘•È°Í…Ù•‘Q¼°ÍÑ½É…•ÉÉ½ÉÌôì)ô()•áÁ½ÉĞ…Íå¹Œ™Õ¹Ñ¥½¸•ÑMåÍÑ•µ!•…±Ñ  ¤ì(€½¹ÍĞÍÑ½É…”€ô…İ…¥Ğ‰Õ¥±‘MÑ½É…•5…¹…•È ¤ì(€½¹ÍĞÑÉ…­•È€ô•ÑQÉ…­•È ¤ì((€É•ÑÕÉ¸ì(€€€ÍÑ½É…”èÍÑ½É…”¹•Ñ!•…±Ñ  ¤°(€€€±±´èì(€€€€€ÁÉ¥µ…Éäè€€ì¥è€‰…¹Ñ¡É½Á¥ŒµÁÉ¥µ…Éäˆ°€€…±±ÌèÑÉ…­•È¹•Ğ ‰…¹Ñ¡É½Á¥ŒµÁÉ¥µ…Éäé±±´ˆ¤°€€±¥µ¥Ğè9Õµ‰•È¡ÁÉ½•ÍÌ¹•¹Ø¹9Q!I=A%}AI%5Ie}%1e}1%5%P€€€üü€À¤ô°(€€€€€Í•½¹‘…Éäèì¥è€‰…¹Ñ¡É½Á¥ŒµÍ•½¹‘…Éäˆ°…±±ÌèÑÉ…­•È¹•Ğ ‰…¹Ñ¡É½Á¥ŒµÍ•½¹‘…Éäé±±´ˆ¤°±¥µ¥Ğè9Õµ‰•È¡ÁÉ½•ÍÌ¹•¹Ø¹9Q!I=A%}M=9Ie}%1e}1%5%P€üü€À¤ô°(€€€€€Ñ•ÉÑ¥…Éäè€ì¥è€‰…¹Ñ¡É½Á¥ŒµÑ•ÉÑ¥…Éäˆ°€…±±ÌèÑÉ…­•È¹•Ğ ‰…¹Ñ¡É½Á¥ŒµÑ•ÉÑ¥…Éäé±±´ˆ¤°€±¥µ¥Ğè9Õµ‰•È¡ÁÉ½•ÍÌ¹•¹Ø¹9Q!I=A%}QIQ%Ie}%1e}1%5%P€€üü€À¤ô°(€€€€€•µ¥¹¤è€€€ì¥è€‰•µ¥¹¤ˆ°€€€€€€€€€€€€€…±±ÌèÑÉ…­•È¹•Ğ ‰•µ¥¹¤é±±´ˆ¤°€€€€€€€€€€€€€±¥µ¥Ğè9Õµ‰•È¡ÁÉ½•ÍÌ¹•¹Ø¹5%9%}%1e}1%5%P€üü€ÄÔÀÀ¤ô°(€€€ô°(€€€¡…Í¹Ñ¡É½Á¥-•äè€„…ÁÉ½•ÍÌ¹•¹Ø¹9Q!I=A%}A%}-d°(€€€¡…Í•µ¥¹¥-•äè€€€€„…ÁÉ½•ÍÌ¹•¹Ø¹5%9%}A%}-d°(€€€¡…ÍUÁÍÑ…Í è€€€€€€„…ÁÉ½•ÍÌ¹•¹Ø¹UAMQM!}I%M}IMQ}UI0°(€€€¡…ÍQ•±•É…´è€€€€€„…ÁÉ½•ÍÌ¹•¹Ø¹Q1I5}	=Q}Q=-8°(€€€Ñ¥µ•ÍÑ…µÀè¹•Ü…Ñ” ¤¹Ñ½%M=MÑÉ¥¹œ ¤°(€ôì)ô(4(4(