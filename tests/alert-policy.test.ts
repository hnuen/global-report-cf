import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { applySuccessfulDeliveryCooldowns } from "../src/lib/alert-delivery.ts";
import { scoreArticle } from "../src/lib/alert-scorer.ts";
import type { Article } from "../src/lib/types.ts";
import { mergeDirectWithAiSupplement } from "../src/lib/source-merge.ts";
import type { Briefing } from "../src/lib/types.ts";
import { articleMatchesAlertTopic, alertSourceLabel, cleanAlertText } from "../src/lib/alert-topic.ts";
import { mergeMonitorArticles } from "../src/lib/monitor-articles.ts";

function briefing(articles: Article[]): Briefing {
  return { lastUpdated: "test", articles, sidebar: {} as Briefing["sidebar"] };
}

function testArticle(id: number, headline: string, sourceUrl: string): Article {
  return {
    id, date: "2026-07-31", headline, sourceUrl,
    body: [headline], source: "Test", section: "sanctions",
    category: "Sanctions", region: "Global", impact: "high",
  };
}

test("a current DHS UFLPA notice is eligible as an authoritative alert", () => {
  const article: Article = {
    id: 20260731,
    date: new Date().toISOString(),
    headline: "DHS adds entities to the UFLPA Entity List",
    body: ["The Department of Homeland Security announced new UFLPA Entity List additions."],
    source: "U.S. Department of Homeland Security",
    sourceUrl: "https://www.dhs.gov/news/2026/07/31/dhs-adds-entities-uflpa-entity-list",
    section: "sanctions",
    category: "Entity List",
    region: "United States",
    impact: "high",
  };

  const result = scoreArticle(article);

  assert.equal(result.score, 100);
  assert.equal(result.shouldAlert, true);
  assert.ok(result.reasons.some(reason => reason.includes("Official enforcement source (100)")));
});

test("a DHS UFLPA monitor excludes unrelated Treasury sanctions news", () => {
  const dhs = testArticle(1, "DHS adds entities to the UFLPA Entity List", "https://www.dhs.gov/news/2026/07/31/uflpa-update");
  const treasury = testArticle(2, "Treasury targets an Iran network", "https://home.treasury.gov/news/press-releases/sb0582");

  assert.equal(articleMatchesAlertTopic(dhs, "DHS UFLPA"), true);
  assert.equal(articleMatchesAlertTopic(treasury, "DHS UFLPA"), false);
  assert.equal(articleMatchesAlertTopic(
    testArticle(3, "DHS announces an unrelated preparedness grant", "https://www.dhs.gov/news/2026/07/31/grant"),
    "DHS UFLPA",
  ), false);
});

test("monitor includes current articles that are visible through the persistent library", () => {
  const cachedPenalty = testArticle(1, "Old cached penalty", "https://ofac.treasury.gov/old");
  cachedPenalty.date = "May 18, 2026";
  const currentDhs = testArticle(
    2,
    "DHS Adds 43 Chinese Companies to UFLPA Entity List",
    "https://www.dhs.gov/news/2026/07/31/dhs-announces-addition-43-companies-uflpa-entity-list",
  );
  currentDhs.date = new Date().toISOString();
  currentDhs.category = "Entity List";
  currentDhs.body = ["DHS announced UFLPA Entity List additions over forced labor concerns."];

  const merged = mergeMonitorArticles([cachedPenalty], [currentDhs]);
  const result = merged.map(scoreArticle).find(item => item.article.sourceUrl === currentDhs.sourceUrl);

  assert.equal(merged.length, 2);
  assert.equal(result?.shouldAlert, true);
});

test("ntfy presentation uses the article agency and repairs corrupted punctuation", () => {
  const treasury = testArticle(2, "• Treasury action", "https://home.treasury.gov/news/press-releases/sb0583");
  treasury.source = "Treasury Press Release SB0536";

  assert.equal(alertSourceLabel(treasury), "U.S. Treasury / News");
  assert.equal(cleanAlertText(treasury.headline), "Treasury action");
});

test("a failed notification attempt does not start cooldown", async () => {
  const marked: string[] = [];

  await applySuccessfulDeliveryCooldowns([], 60, async key => {
    marked.push(key);
  });

  assert.deepEqual(marked, []);
});

test("cooldown is applied to each successfully delivered alert key", async () => {
  const marked: Array<[string, number]> = [];

  await applySuccessfulDeliveryCooldowns(["alert-one", "alert-two"], 60, async (key, minutes) => {
    marked.push([key, minutes]);
  });

  assert.deepEqual(marked, [["alert-one", 60], ["alert-two", 60]]);
});

test("direct records remain canonical when AI returns the same source URL", () => {
  const direct = testArticle(1, "Direct government headline", "https://agency.gov/news/action?utm_source=x");
  const ai = testArticle(99, "AI rewrite", "https://agency.gov/news/action");
  const merged = mergeDirectWithAiSupplement(briefing([direct]), briefing([ai]));

  assert.equal(merged.articles.length, 1);
  assert.equal(merged.articles[0].headline, "Direct government headline");
  assert.equal(merged.articles[0].discoveryMethod, "direct");
  assert.equal(merged.articles[0].aiGenerated, false);
});

test("a directly verified trusted-source discovery replaces the AI provenance", () => {
  const direct = testArticle(
    1,
    "DHS adds companies to the UFLPA Entity List",
    "https://www.dhs.gov/news/2026/07/31/dhs-announces-addition-43-companies-uflpa-entity-list",
  );
  direct.category = "Entity List";
  direct.body = ["DHS announced new UFLPA Entity List additions."];
  const ai = { ...direct, id: 2, headline: "AI summary of the DHS action", aiGenerated: true };

  const merged = mergeDirectWithAiSupplement(briefing([direct]), briefing([ai]));
  const promoted = merged.articles[0];

  assert.equal(merged.articles.length, 1);
  assert.equal(promoted.aiGenerated, false);
  assert.equal(promoted.discoveryMethod, "direct");
  assert.equal(scoreArticle(promoted).shouldAlert, true);
});

test("Gemini only appends new discoveries and marks them display-only", () => {
  const direct = testArticle(1, "Direct article", "https://agency.gov/news/direct");
  const discovered = testArticle(1, "Additional report", "https://reuters.com/world/additional-report");
  const merged = mergeDirectWithAiSupplement(briefing([direct]), briefing([discovered]));

  assert.equal(merged.articles.length, 2);
  assert.equal(merged.articles[1].discoveryMethod, "ai");
  assert.equal(merged.articles[1].aiGenerated, true);
  assert.notEqual(merged.articles[1].id, direct.id);
});



test("direct trusted-source registry includes the requested U.S. government publishers", () => {
  const registry = readFileSync(new URL("../src/lib/official-sources.ts", import.meta.url), "utf8");
  for (const expected of [
    "https://www.usa.gov/blog",
    "https://www.whitehouse.gov/presidential-actions/",
    "https://www.congress.gov/search",
    "https://www.state.gov/rss-feeds/press-releases/",
    "https://www.war.gov/DesktopModules/ArticleCS/RSS.ashx",
    "https://www.federalreserve.gov/feeds/press_all.xml",
  ]) {
    assert.ok(registry.includes(expected), `missing trusted source: ${expected}`);
  }
});
