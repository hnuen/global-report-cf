# Audit Review — global-report-cf

**Date:** 2026-07-16 · **Scope:** Security, code quality, architecture, deployment/config
**Stack:** Next.js 15.3.4 on Cloudflare Pages via @opennextjs/cloudflare 1.2.0, Upstash Redis, GitHub Actions pipeline, dedicated cron-worker

---

## Summary

The app is in solid shape overall: no secrets are committed (checked working tree and full git history), subscriber tokens use `crypto.randomBytes`/`randomUUID`, the contact form has honeypot + per-IP rate limiting, and the Telegram webhook supports secret-token verification. The main risks are a cluster of unauthenticated or fail-open API routes that let anyone burn paid resources (Twilio SMS, LLM quota, GitHub Actions minutes) or, in one case, overwrite the site's published content. None require major rework — mostly adding auth checks and closing fail-open defaults.

Findings: 3 high, 5 medium, 6 low.

---

## High severity

### H1. `/api/save-briefing` fails open — anyone can overwrite site content
`app/api/save-briefing/route.ts:15-18`. The check is `if (expected && secret !== expected)` — if `SAVE_BRIEFING_SECRET` is unset in the environment, every request is authorized. This endpoint replaces the entire published briefing, so a misconfigured deploy lets an attacker inject arbitrary "news" into a sanctions-compliance site. Fix: fail closed — `if (!expected || secret !== expected) return 401`. Same fail-open pattern exists in `/api/cron` (`route.ts:13-19`) and `/api/monitor` (`isAuthorised` returns `true` when `CRON_SECRET` is unset, and the file's own comment acknowledges it).

### H2. `/api/test-notify` is unauthenticated and sends real SMS/WhatsApp
`app/api/test-notify/route.ts` — the header comment says "no auth required (test-only endpoint)", but it fires Twilio SMS, WhatsApp, Telegram, and ntfy to all configured recipients on any GET. Anyone who finds the URL can drain your Twilio balance and spam every alert recipient in a loop. Fix: require `ADMIN_SECRET`, or delete the route and test via a script with the secret.

### H3. Refresh endpoints are unauthenticated — cost and quota abuse
`/api/refresh` (GET and POST, comment says "No auth required"), `/api/trigger-refresh`, `/api/background-refresh`, and `/api/trigger-github-refresh` all accept anonymous requests. Consequences: arbitrary callers can burn Anthropic/Gemini quota (trigger-refresh runs the LLM for the sanctions section), exhaust GitHub Actions minutes via workflow dispatch, hit Cloudflare subrequest limits, and thrash Redis. The "Refresh Now" button can send a shared secret header, or at minimum wrap these in `checkRateLimit()` (the infrastructure already exists in `src/lib/rate-limit.ts` but is only used by `/api/contact`).

---

## Medium severity

### M1. XSS via unescaped subscriber input in admin-facing HTML
`app/api/subscribe/route.ts` accepts `name` (80 chars) and `email` (200 chars) with no format validation, and those values are interpolated raw into HTML in `src/lib/approval-email.ts` (`<b>${sub.name}</b>`, lines 54, 120) and into the approve confirmation page (`Topic emailed to ${sub.email}` → `confirmationPage()` renders `${message}` unescaped). A subscriber name like `<img src=x onerror=...>` executes in the admin's browser when they click the approve link. Fix: reuse the `escapeHtml()` helper that already exists in `app/api/contact/route.ts` (move it to a shared lib), and validate email format at registration.

### M2. `/api/subscribe` has no rate limit
Unlike `/api/contact`, registration has no honeypot or rate limit. A bot can flood Redis with pending subscriber records and spam your approval inbox (each registration emails you via Resend, eating the free-tier quota). Fix: apply the same `checkRateLimit(ip, 5, 3600)` + honeypot pattern used in contact.

### M3. `/api/debug` is public
Leaks Redis connectivity status, storage adapter internals, article counts, and raw error strings (which can include connection details from thrown errors). Gate behind `ADMIN_SECRET` or remove in production.

### M4. TypeScript and ESLint errors ignored at build
`next.config.js` sets `ignoreBuildErrors: true` and `ignoreDuringBuilds: true`, and `tsconfig.json` has `strict: false`. Combined, type errors ship to production silently. Given the number of `as any` casts in save-briefing's merge logic, this is where data-shape bugs will hide. Fix incrementally: turn on `strict`, fix errors, then remove the ignore flags so CI catches regressions.

### M5. Stale `.env.example` advises exposing the cron secret to the browser
Line ~43: `NEXT_PUBLIC_CRON_SECRET=...` — any `NEXT_PUBLIC_` var is compiled into the client bundle, making the secret public. Nothing in the code reads it anymore (verified), but the file actively instructs future-you to do the wrong thing. Delete that line and the Vercel KV block (also unused).

---

## Low severity

**L1. Non-constant-time secret comparisons.** `ADMIN_SECRET`/`CRON_SECRET` checks use `===`. Timing attacks are hard over the network but `crypto.timingSafeEqual` is a one-line upgrade.

**L2. Duplicated raw-Redis helpers.** 16 files talk to Upstash; some use `@upstash/redis`, others hand-rolled `fetch(`${u}/del/...`)` calls (purge-library, monitor, debug). One shared client module would cut duplication and unify error handling.

**L3. Dead/confusing code paths.** `cf-worker.ts` is referenced nowhere; `/api/cron` is acknowledged in comments as never called in production yet still maintained in parallel with `/api/refresh`; `package.json` keeps `deploy:railway` and a bare `wrangler pages deploy` alongside the real `build:pages`/`deploy:pages` flow. Prune or document which is canonical.

**L4. `AppContent.tsx` is 1,845 lines.** A single client component holding the whole UI. Works, but splitting by tab/section would help maintainability and code-splitting.

**L5. `patch-worker.js` fragility.** The build patches OpenNext's generated worker with string `.replace()` calls. Any OpenNext upgrade that changes the generated code will silently produce an unpatched worker (the replace just won't match). Add a post-patch assertion that the expected strings were found, failing the build otherwise.

**L6. GitHub repo/owner hardcoded.** `hnuen/global-report-cf` appears as fallback in `trigger-github-refresh/route.ts` and as constants in `cron-worker/src/index.js`. Fine for a personal project; worth env-var-izing if the repo ever moves.

---

## What checked out clean

Verified explicitly: no `.env` or secrets in git history or working tree; no hardcoded API keys/tokens anywhere in source; subscriber approve/deny tokens are 24-byte `randomBytes` (unguessable, single-use); no `Math.random` used for anything security-relevant; contact form has honeypot + rate limit + HTML escaping; Telegram webhook validates `x-telegram-bot-api-secret-token` when configured; admin subscriber endpoint correctly fails closed when `ADMIN_SECRET` is unset; `.gitignore` covers all env and build artifacts; phone input validated against E.164.

---

## Recommended fix order

1. Fail closed on `save-briefing`, `cron`, `monitor` (H1) — 3 one-line changes.
2. Add `ADMIN_SECRET` gate to `test-notify` and `debug` (H2, M3).
3. Add secret or rate limit to the four refresh endpoints (H3).
4. Escape subscriber name/email in emails and confirmation pages (M1).
5. Rate-limit `/api/subscribe` (M2).
6. Clean `.env.example` (M5), then tackle strict TypeScript (M4) and the low items as time allows.
