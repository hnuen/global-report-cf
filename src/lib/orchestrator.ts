import { buildLLMManager }     from "./briefing-fetcher";
import { buildStorageManager } from "./storage-manager";
import { getTracker }          from "./usage-tracker";
import { fetchOfficialSources, formatSourcesForPrompt } from "./official-sources";
import { buildBriefingFromSources } from "./official-briefing";
import { buildAnalyzedBriefing } from "./local-analyzer";
import { getHistoricalForSection, getRecentBySource } from "./historical-articles";
import type { Briefing, Section } from "./types";
import { enrichArticlesWithBriefs } from "./brief-generator";
import { loadArticleLibrary, saveArticlesToLibrary } from "./article-library";
import { fetchOfacCache, recentActionsToArticles, civilPenaltiesToArticles, programsToArticles, ofsiNoticesToArticles, europaNewsToArticles, unNoticesToArticles, bbcNewsToArticles, ajNewsToArticles, occNewsToArticles, economicsNewsToArticles, bisNewsToArticles, regionsNewsToArticles } from "./ofac-github-cache";
import { mergeDirectWithAiSupplement } from "./source-merge";
import { commitSourceItemCheckpoints } from "./source-item-checkpoints";
import { hasUsableArticleText } from "./text-quality";

// No module-level singletons Ã¢â‚¬â€ always read env vars fresh on each invocation
export async function loadBriefing(): Promise<Briefing | null> {
  const storage = await buildStorageManager();
  return storage.load();
}

export async function refreshBriefing(topic?: string, opts?: { skipLLM?: boolean; section?: string; manualRefresh?: boolean; group?: 1|2|3|4 }): Promise<{
  briefing: Briefing;
  usedProvider: string;
  savedTo: string[];
  storageErrors: { id: string; error: string | undefined }[];
}> {
  const storage = await buildStorageManager();

  // Load persisted article library (Redis-backed Ã¢â‚¬â€ built up across refresh runs)
  // Skip in skipLLM path to conserve CF Workers subrequest budget (stay under 50 limit)
  const libraryArticles = opts?.skipLLM ? [] : await loadArticleLibrary();
  console.log(`[orchestrator] Loaded ${libraryArticles.length} articles from library (skipLLM=${opts?.skipLLM ?? false})`);

  // Always fetch official sources first Ã¢â‚¬â€ fast and free
  // group=1 (manual refresh, batch 1): OFAC date news + Treasury SBs (~11 sources)
  // group=undefined (scheduled runs): fetch all sources
  console.log("[orchestrator] Fetching official government sources...");
  const officialSources = await fetchOfficialSources(opts?.section, { group: opts?.group });
  const successCount = officialSources.filter(s => s.content.length > 50).length;
  console.log(`[orchestrator] Got ${successCount}/${officialSources.length} official sources`);

  let briefing: Briefing;
  let usedProvider: string;

  // Even 1 successful source is enough Ã¢â‚¬â€ fall through to historical/library backfill
  // if most sources timed out. Only hard-fail if absolutely nothing came back.
  if (officialSources.length === 0) {
    throw new Error("No official sources fetched successfully");
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬ Step 1: build structured briefing immediately (fast, ~0s) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
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

  // Ã¢â€â‚¬Ã¢â€â‚¬ GitHub OFAC cache Ã¢â‚¬â€ inject fresh scraped data committed by GH Actions Ã¢â€â‚¬Ã¢â€â‚¬
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
      // UK OFSI / EU Commission Ã¢â‚¬â€ same idea as the OFAC injection above: these
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
      // Remaining direct-scrape feeds Ã¢â‚¬â€ same gap as OFSI/EU above: scraped and
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

  // Ã¢â€â‚¬Ã¢â€â‚¬ Library accumulation Ã¢â‚¬â€ persist articles across refreshes (up to 50/section, 6 months) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
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

  // Ã¢â€â‚¬Ã¢â€â‚¬ Per-source official backfill Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
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

  // Ã¢â€â‚¬Ã¢â€â‚¬ 3-tier source priority system Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  // Tier 1 (official Ã¢â‚¬â€ always fetched first & always shown): OFAC, FinCEN, BIS,
  //         OCC, Federal Reserve, UK OFSI, EU
  // Tier 2 (Google News / general outlets Ã¢â‚¬â€ only kept if <= 30 days old)
  // Tier 3 (Al Jazeera, UN News, India MEA Ã¢â‚¬â€ always shown)
  //
  // Matching is done via keyword/substring rather than exact-name equality
  // because display names produced upstream are often compound, e.g.
  // "U.S. Treasury / OFAC", "OFAC / Iran", "EU Council Ã¢â‚¬â€ Sanctions RSS".
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
    if (isNaN(t)) return true; // unparseable date Ã¢â‚¬â€ don't drop, just don't filter on it
    return t >= cutoff;
  });

  // Sort: Tier 1 first, then Tier 2, then Tier 3 Ã¢â‚¬â€ newest first within each tier
  briefing.articles = briefing.articles.sort((a, b) => {
    const aPriority = getPriority(a.source);
    const bPriority = getPriority(b.source);
    if (bPriority !== aPriority) return bPriority - aPriority;
    return (b.date || "").localeCompare(a.date || "");
  });

  // Ã¢â€â‚¬Ã¢â€â‚¬ Apply enriched briefs from previous runs (library Ã¢â€ â€™ live articles) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  // Must happen BEFORE storage.save so the Redis copy has real briefs, not generics.
  if (libraryArticles.length > 0) {
    const libraryBriefMap = new Map<string, string>();
    for (const la of libraryArticles) {
      const key = la.headline.slice(0, 80).toLowerCase().replace(/\s+/g, " ").trim();
      if ((la.body[0] || "").length > 50) libraryBriefMap.set(key, la.body[0]);
    }
    let appliedCount = 0;
    briefing.articles = briefing.articles.map(a => {
      const key = a.headline.slice(0, 80).toLowerCase().replace(/\s+/g, " ").trim();
      const lib = libraryBriefMap.get(key);
      if (!lib) return a;
      const cur = (a.body[0] || "").toLowerCase();
      const isGeneric = cur.length < 60 || [
        "official action","see source link","targeting iran","targeting russia",
        "treasury action","treasury department","new designations","general license issued",
        "regulatory guidance","dprk-related","counter-terrorism",
      ].some(g => cur.includes(g));
      if (!isGeneric) return a; // already has a real brief Ã¢â‚¬â€ keep it
      appliedCount++;
      return { ...a, body: [lib, ...a.body.slice(1)] };
    });
    if (appliedCount > 0) console.log(`[orchestrator] Applied ${appliedCount} enriched briefs from library`);
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬ Step 2: attempt LLM upgrade (best-effort, timeout varies) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  // Runs AFTER the pre-save-ready structured briefing is built but BEFORE the
  // actual save.  If the LLM responds in time, its richer articles replace the
  // structured ones.  If it times out or errors, briefing stays as structured.
  // skipLLM=true (in-process trigger-refresh) bypasses this entirely.
  // Sanctions always runs LLM Ã¢â‚¬â€ OFAC date-URL search requires Gemini grounding
  const needsLLM = !opts?.skipLLM || opts?.section === "sanctions";
  if (needsLLM) {
    // Manual refresh: shorter timeout so the user gets a response quickly.
    // Scheduled runs (manualRefresh=false) get more time since they run in GitHub Actions.
    const LLM_TIMEOUT_MS = opts?.manualRefresh ? 12_000 : 17_000;
    try {
      const llm = buildLLMManager();
      const result = await Promise.race([
        llm.fetch(topic, officialContext),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`LLM timeout after ${LLM_TIMEOUT_MS / 1000}s`)), LLM_TIMEOUT_MS)
        ),
      ]);
      briefing = mergeDirectWithAiSupplement(briefing, result.briefing);
      // Mark every Gemini article so the alert pipeline can exclude them.
      // LLM-generated articles have plausible-looking source/URL strings but the
      // URLs are often hallucinated Ã¢â‚¬â€ a broken-link alert is worse than no alert.
      usedProvider = result.usedProvider;
      console.log(`[orchestrator] LLM succeeded (${usedProvider})`);
      // NOTE: Gemini articles are NOT saved to the library Ã¢â‚¬â€ they can contain
      // hallucinated URLs/sources.  Only real RSS/scrape articles (injected
      // below from the OFAC cache) are persisted for future use.
    } catch (llmError) {
      const reason = String(llmError).slice(0, 120);
      console.log("[orchestrator] LLM unavailable Ã¢â‚¬â€ keeping structured briefing:", reason);
      // briefing / usedProvider already set to structured above Ã¢â‚¬â€ no change needed
    }
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬ "No news" / non-event filler guard Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  // Same pattern as alert-scorer.ts's NO_NEWS_PATTERN veto and
  // refresh-briefing.mjs's save-time filter. This function is a THIRD,
  // independent Gemini-call-and-save path (hit directly by /api/refresh Ã¢â‚¬â€
  // ~15x/day via the GitHub Actions "fast path" step, and by the in-app
  // "Refresh Now" button) that saves straight to Redis and was not covered by
  // either of those other two fixes. Without this, a filler article from
  // THIS path's own Gemini call could still display on the live site Ã¢â‚¬â€
  // alert-scorer.ts's veto only blocks the Telegram alert, not the page.
  // Regex-only, deliberately no network calls: a per-article link-existence
  // check would add ~20+ fetches on top of the enrichment calls below, which
  // risks tripping Cloudflare Workers' per-invocation subrequest cap (see the
  // "Save the core briefing FIRST" comment further down for why that budget
  // is already tight here). Link verification instead lives only in
  // refresh-briefing.mjs, which runs in GitHub Actions with no such cap.
  // Added 2026-06-28 after the same gap was found and closed in the other two
  // pipelines.
  const NO_NEWS_PATTERN = /\bno new\b|\bshows no\b|\breports? no\b|\bno additions?\b|\bno changes?\b|\bnothing new\b|\bremains? unchanged\b|\bdid not add\b|\bno entries (?:were |have been )?added\b|\bno updates? (?:were |have been )?(?:made|reported)\b|\bno actions? (?:were |have been )?(?:taken|reported)\b/i;
  const beforeNoNewsFilter = briefing.articles.length;
  briefing.articles = briefing.articles.filter(a => {
    const text = `${a.headline ?? ""} ${(a.body ?? [])[0] ?? ""}`;
    const isFiller = NO_NEWS_PATTERN.test(text);
    if (isFiller) console.log(`[orchestrator] Dropped no-news filler article: "${a.headline}"`);
    return !isFiller;
  });
  if (briefing.articles.length < beforeNoNewsFilter) {
    console.log(`[orchestrator] Filtered ${beforeNoNewsFilter - briefing.articles.length} no-news filler article(s)`);
  }

  const beforeCorruptFilter = briefing.articles.length;
  briefing.articles = briefing.articles.filter(hasUsableArticleText);
  if (briefing.articles.length < beforeCorruptFilter) {
    console.log(`[orchestrator] Removed ${beforeCorruptFilter - briefing.articles.length} corrupted/binary article(s)`);
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬ Group-mode additive merge Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  // When fetching a specific group (11-26 sources each Ã¢â‚¬â€ safely under CF's
  // 50-subrequest limit), merge new articles INTO the existing Redis briefing
  // instead of overwriting it. Each refresh.yml cycle calls /api/refresh 4Ãƒâ€”
  // (group 1, 2, 3, 4 sequentially); without this, group 4's save would wipe
  // everything written by groups 1, 2, 3.
  if (opts?.group !== undefined) {
    try {
      const existing = await storage.load();
      if (existing?.articles?.length) {
        const currentKeys = new Set(
          briefing.articles.map(a =>
            a.headline.slice(0, 80).toLowerCase().replace(/\s+/g, " ").trim()
          )
        );
        const fromExisting = existing.articles.filter(a =>
          !currentKeys.has(a.headline.slice(0, 80).toLowerCase().replace(/\s+/g, " ").trim())
        );
        if (fromExisting.length > 0) {
          briefing.articles = [...briefing.articles, ...fromExisting];
          // Re-sort to keep tier order consistent after merge
          briefing.articles = briefing.articles.sort((a, b) => {
            const pa = getPriority(a.source), pb = getPriority(b.source);
            if (pb !== pa) return pb - pa;
            return (b.date || "").localeCompare(a.date || "");
          });
          console.log(`[orchestrator] Group ${opts.group} additive merge: +${fromExisting.length} from existing Ã¢â€ â€™ ${briefing.articles.length} total`);
        }
      }
    } catch (e) {
      console.log("[orchestrator] Additive merge failed (non-fatal):", String(e).slice(0, 80));
    }
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬ Section-scoped merge: don't overwrite other sections Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  // When a specific section is refreshed (e.g. BIS), only replace that section's
  // articles in Redis. Without this, refreshing BIS would overwrite sanctions,
  // penalties, etc. with 2025 historical backfill articles.
  if (opts?.section && opts.section !== "all") {
    const existing = await storage.load();
    if (existing?.articles?.length) {
      const otherArticles = existing.articles.filter(a => a.section !== opts.section);
      const newSectionArticles = briefing.articles.filter(a => a.section === opts.section);
      console.log(`[orchestrator] Section merge: ${newSectionArticles.length} new ${opts.section} articles + ${otherArticles.length} kept from existing`);
      briefing.articles = [...newSectionArticles, ...otherArticles];
      // Preserve existing sidebar for other sections
      briefing.sidebar = {
        ...existing.sidebar,
        ...(briefing.sidebar?.[opts.section as keyof typeof briefing.sidebar]
          ? { [opts.section]: briefing.sidebar[opts.section as keyof typeof briefing.sidebar] }
          : {}),
      };
    }
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬ Save the core briefing FIRST Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  // Cloudflare Workers caps subrequests per invocation. Brief enrichment below
  // does per-article Redis cache lookups + article fetches + Gemini calls,
  // which can exhaust that budget Ã¢â‚¬â€ causing the *real* Upstash save to throw
  // "Too many subrequests by single Worker invocation" while the in-memory
  // fallback silently "succeeds," masking the failure (refresh still reports
  // ok:true, but Redis never gets the fresh data Ã¢â‚¬â€ lastUpdated stays frozen).
  // Saving here guarantees the correctly-dated official-source articles and
  // Eastern-time lastUpdated persist before enrichment can starve the budget.
  let preSaveSuccess = false;
  try {
    await storage.save(briefing);
    preSaveSuccess = storage.getHealth().some(h => h.id === "upstash" && h.healthy);
    console.log("[orchestrator] Saved core briefing (pre-enrichment), upstash:", preSaveSuccess);
    if (preSaveSuccess) {
      const checkpointUpdates = officialSources
        .map(source => source.checkpoint)
        .filter((checkpoint): checkpoint is { url: string; itemKeys: string[] } => !!checkpoint);
      await commitSourceItemCheckpoints(checkpointUpdates);
      console.log(`[orchestrator] Committed ${checkpointUpdates.length} source checkpoints after successful save`);
    }
  } catch (e) {
    console.log("[orchestrator] Pre-save failed:", String(e).slice(0, 100));
  }

  // Save government-source articles to the library even in skipLLM (group) path.
  // Without this, group-based refreshes never accumulate the article library,
  // so library-based backfill stays empty after a purge.
  if (opts?.skipLLM) {
    saveArticlesToLibrary(briefing.articles).catch(e =>
      console.log("[orchestrator] Library save (skipLLM, non-fatal):", String(e).slice(0, 80))
    );
  }

  // Enrich articles with AI-generated briefs (cached in Redis, runs async)
  // Skipped on manual refresh (too slow for interactive use) and when skipLLM=true.
  // Best-effort: failure here does not lose data, since the core briefing is already saved above.
  if (needsLLM && !opts?.manualRefresh && (usedProvider.includes("Official Sources") || usedProvider.includes("Local Analysis"))) {
    try {
      console.log("[orchestrator] Enriching article briefs...");
      const sanctionsArticles = briefing.articles
        .filter(a => a.sourceUrl)
        .map(a => ({ sourceUrl: a.sourceUrl!, headline: a.headline, body: a.body }));

      const enriched = await enrichArticlesWithBriefs(sanctionsArticles);
      if (enriched.size > 0) {
        briefing.articles = briefing.articles.map(a => {
          const newBrief = a.sourceUrl ? enriched.get(a.sourceUrl) : undefined;
          return newBrief ? { ...a, body: [newBrief, ...a.body.slice(1)] } : a;
        });
        console.log(`[orchestrator] Enriched ${enriched.size} article briefs`);

        // Save enriched articles to the persistent library Ã¢â‚¬â€ real RSS/scrape only,
        // never AI-generated articles (those have hallucinated URLs).
        const enrichedArticles = briefing.articles.filter(a =>
          a.sourceUrl && enriched.has(a.sourceUrl) && !(a as any).aiGenerated
        );
        saveArticlesToLibrary(enrichedArticles).catch(e =>
          console.log("[orchestrator] Library save failed (non-fatal):", String(e).slice(0, 80))
        );

        // Re-save briefing with enriched briefs so users see Gemini summaries immediately.
        // This save is best-effort Ã¢â‚¬â€ if it fails (subrequest limit), the pre-save copy
        // (with generic briefs) is already in Redis and the library will propagate
        // enriched briefs on the next refresh cycle.
        try {
          await storage.save(briefing);
          console.log("[orchestrator] Re-saved briefing with enriched briefs");
        } catch (saveErr) {
          console.log("[orchestrator] Re-save failed (non-fatal, pre-save intact):", String(saveErr).slice(0, 80));
        }
      }
    } catch (e) {
      console.log("[orchestrator] Brief enrichment failed (non-fatal):", String(e).slice(0, 100));
    }
  }

  // Build savedTo from pre-save result so enrichment save failures don't
  // incorrectly report Upstash as missing even when the core briefing was saved.
  const health = storage.getHealth();
  const savedTo = [
    ...(preSaveSuccess ? ["upstash"] : []),
    "memory",
  ];
  const storageErrors = health.filter(h => !h.healthy).map(h => ({ id: h.id, error: h.lastError }));

  return { briefing, usedProvider, savedTo, storageErrors };
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


