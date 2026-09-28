import test from "node:test";
import assert from "node:assert/strict";
import { dedupeByCanonicalKey } from "../src/lib/dedupe-alerts.ts";

test("notification candidates are unique by canonical alert key", () => {
  const candidates = [
    { headline: "Issuance of Amended Venezuela General Licenses", key: "https://ofac.treasury.gov/recent-actions/20260928" },
    { headline: "OFAC Issues Amended Venezuela General Licenses", key: "https://ofac.treasury.gov/recent-actions/20260928" },
    { headline: "Different notice", key: "https://ofac.treasury.gov/recent-actions/20260927" },
  ];

  const result = dedupeByCanonicalKey(candidates, candidate => candidate.key);

  assert.deepEqual(result.map(candidate => candidate.headline), [
    "Issuance of Amended Venezuela General Licenses",
    "Different notice",
  ]);
});

test("canonical key comparison ignores casing and surrounding whitespace", () => {
  const result = dedupeByCanonicalKey([
    { key: " HTTPS://EXAMPLE.COM/NOTICE " },
    { key: "https://example.com/notice" },
  ], candidate => candidate.key);

  assert.equal(result.length, 1);
});
