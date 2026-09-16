import test from "node:test";
import assert from "node:assert/strict";
import { normalizeBriefingPayload } from "../.github/scripts/normalize-briefing.mjs";

test("Gemini briefing normalization emits only save-schema fields", () => {
  const result = normalizeBriefingPayload({
    lastUpdated: "Now",
    provider: "Gemini",
    sidebar: {},
    articles: [{
      id: "wrong",
      section: "SANCTIONS",
      category: "News",
      region: "Global",
      impact: "unexpected",
      date: "2026-09-15",
      headline: "Valid headline",
      body: "One paragraph",
      source: "Example",
      sourceUrl: "https://example.com/news/item",
      inventedField: "must be removed",
      aiGenerated: true,
      discoveryMethod: "ai",
    }],
  });
  assert.equal(result.dropped.length, 0);
  assert.deepEqual(Object.keys(result.payload).sort(), ["articles", "lastUpdated", "sidebar"]);
  assert.deepEqual(Object.keys(result.payload.articles[0]).sort(), [
    "aiGenerated", "body", "category", "date", "discoveryMethod", "headline", "id", "impact", "region", "section", "source", "sourceUrl",
  ]);
  assert.equal(result.payload.articles[0].id, 1);
  assert.equal(result.payload.articles[0].impact, "medium");
  assert.deepEqual(result.payload.articles[0].body, ["One paragraph"]);
});

test("Gemini briefing normalization drops invalid URLs and bounds text", () => {
  const result = normalizeBriefingPayload({
    lastUpdated: "Now",
    sidebar: {},
    articles: [
      { section: "regions", headline: "Bad URL", sourceUrl: "https://", body: [], impact: "low" },
      { section: "regions", headline: "x".repeat(600), sourceUrl: "https://example.com/item", body: ["y".repeat(6000)], impact: "high" },
    ],
  });
  assert.equal(result.dropped.length, 1);
  assert.equal(result.payload.articles.length, 1);
  assert.equal(result.payload.articles[0].headline.length, 500);
  assert.equal(result.payload.articles[0].body[0].length, 5000);
});
