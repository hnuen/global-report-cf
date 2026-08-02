import assert from "node:assert/strict";
import test from "node:test";
import { checkRateLimit, getClientIp } from "../src/lib/rate-limit.ts";
import { validateBackgroundRefreshBody, validateOfacUpdateBody, validateSearchQuery } from "../src/lib/request-validation.ts";
import { hasAnySecret, hasSecret } from "../src/lib/request-auth.ts";

test("protected mutations fail closed and accept only the configured secret", () => {
  const unauthorised = new Request("https://example.test", { headers: { "x-ofac-update-secret": "wrong" } });
  const authorised = new Request("https://example.test", { headers: { "x-ofac-update-secret": "correct" } });
  assert.equal(hasSecret(authorised, undefined, "x-ofac-update-secret"), false);
  assert.equal(hasSecret(unauthorised, "correct", "x-ofac-update-secret"), false);
  assert.equal(hasSecret(authorised, "correct", "x-ofac-update-secret"), true);
});

test("save authentication accepts either dedicated or cron secret and still fails closed", () => {
  const cron = new Request("https://example.test", { headers: { "x-save-secret": "cron-correct" } });
  const wrong = new Request("https://example.test", { headers: { "x-save-secret": "wrong" } });
  assert.equal(hasAnySecret(cron, [undefined, "cron-correct"], "x-save-secret"), true);
  assert.equal(hasAnySecret(wrong, [undefined, "cron-correct"], "x-save-secret"), false);
  assert.equal(hasAnySecret(cron, [undefined, undefined], "x-save-secret"), false);
});

test("expensive rate limits fail closed when Redis is unavailable", async () => {
  const oldUrl = process.env.UPSTASH_REDIS_REST_URL;
  const oldToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  assert.equal(await checkRateLimit("security-test", 1, 60, { failClosed: true }), false);
  assert.equal(await checkRateLimit("security-test", 1, 60), true);
  if (oldUrl) process.env.UPSTASH_REDIS_REST_URL = oldUrl;
  if (oldToken) process.env.UPSTASH_REDIS_REST_TOKEN = oldToken;
});

test("client identity ignores spoofable forwarded IP headers", () => {
  assert.equal(getClientIp(new Request("https://example.test", { headers: { "x-forwarded-for": "1.2.3.4" } })), "unknown");
  assert.equal(getClientIp(new Request("https://example.test", { headers: { "cf-connecting-ip": "5.6.7.8" } })), "5.6.7.8");
});

test("search queries enforce a bounded non-empty string", () => {
  assert.equal(validateSearchQuery(" sanctions "), "sanctions");
  assert.equal(validateSearchQuery("x".repeat(301)), null);
  assert.equal(validateSearchQuery({}), null);
});

test("background refresh accepts only known groups, sections, and fields", () => {
  assert.deepEqual(validateBackgroundRefreshBody({ group: 2, section: "sanctions" }), { group: 2, section: "sanctions" });
  assert.equal(validateBackgroundRefreshBody({ group: 9 }), null);
  assert.equal(validateBackgroundRefreshBody({ group: 2, unexpected: true }), null);
});

test("OFAC updates require known programs and bounded change arrays", () => {
  const ids = new Set(["iran"]);
  assert.ok(validateOfacUpdateBody({ programId: "iran", newGLs: [{ number: "1", title: "License" }] }, ids));
  assert.equal(validateOfacUpdateBody({ programId: "fake", newGLs: [] }, ids), null);
  assert.equal(validateOfacUpdateBody({ programId: "iran", newGLs: Array(51).fill("GL") }, ids), null);
  assert.equal(validateOfacUpdateBody({ programId: "iran", newGLs: [{ number: "1", url: "javascript:alert(1)" }] }, ids), null);
});
