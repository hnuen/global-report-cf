import test from "node:test";
import assert from "node:assert/strict";
import { checkArticles, linkPolicyError } from "../.github/scripts/check-app-health.mjs";

test("scheduled health check rejects malformed and generic article links", () => {
  assert.equal(linkPolicyError("https://www.aljazeera.com/v"), "truncated publisher URL");
  assert.equal(linkPolicyError("https://news.google.com/rss/articles/example"), "aggregator URL");
  assert.equal(linkPolicyError("https://www.federalregister.gov/documents/2026/08/24/2026-XXXXX/fake"), "invalid Federal Register document URL");
  assert.equal(linkPolicyError("https://www.federalregister.gov/documents/2026/08/28/C1-2026-16628/correction"), null);
  assert.equal(linkPolicyError("https://www.aljazeera.com/news/2026/9/14/real-story"), null);
});

test("scheduled health check distinguishes permanent failures from transient errors", async () => {
  const fetcher = async (url: string) => new Response(null, { status: url.includes("missing") ? 404 : 503 });
  const results = await checkArticles([
    { headline: "Missing", sourceUrl: "https://example.com/news/missing" },
    { headline: "Temporary", sourceUrl: "https://example.com/news/temporary" },
  ], 10, fetcher as typeof fetch);
  assert.equal(results[0].state, "broken");
  assert.equal(results[1].state, "warning");
});

