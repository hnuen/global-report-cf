import assert from "node:assert/strict";
import test from "node:test";
import { normalizeTreasuryPressReleaseUrl, treasuryPressReleasePattern } from "../src/lib/treasury-links.ts";

test("Treasury relative press-release links become direct article URLs", () => {
  const html = `<time>July 31, 2026</time><a href="/news/press-releases/sb0582">Treasury Cracks Down on Global Networks Enabling Iran's Mahan Air and IRGC</a>`;
  const match = treasuryPressReleasePattern().exec(html);
  assert.ok(match);
  assert.equal(normalizeTreasuryPressReleaseUrl(match[2]), "https://home.treasury.gov/news/press-releases/sb0582");
  assert.match(match[3], /Treasury Cracks Down/);
});

test("Treasury direct-link extraction accepts single-quoted absolute URLs", () => {
  const html = `<a href='https://home.treasury.gov/news/press-releases/sb0583'>G7 2026 CROSS BORDER COORDINATION EXERCISE (CBCE)</a>`;
  const match = treasuryPressReleasePattern().exec(html);
  assert.ok(match);
  assert.equal(normalizeTreasuryPressReleaseUrl(match[2]), "https://home.treasury.gov/news/press-releases/sb0583");
});
