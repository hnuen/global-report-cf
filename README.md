# The Global Report — Flexible Multi-Platform Edition

**One codebase. Runs on Vercel, Railway, Cloudflare Workers, or locally.**
**Automatic failover between API keys and storage backends.**
**Never hits a daily limit — rotates providers transparently.**

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        ORCHESTRATOR                          │
│                   src/lib/orchestrator.ts                    │
├─────────────────────────┬────────────────────────────────────┤
│      LLM MANAGER        │         STORAGE MANAGER            │
│  briefing-fetcher.ts    │       storage-manager.ts           │
│                         │                                    │
│  1. Anthropic (primary) │  1. Vercel KV      (Vercel only)  │
│  2. Anthropic (key 2)   │  2. Upstash Redis  (any platform) │
│  3. Anthropic (key 3)   │  3. Memory         (fallback)     │
│                         │                                    │
│  → tries each in order  │  → saves to ALL available         │
│  → skips over-limit     │  → loads from first healthy       │
│  → falls back on error  │  → retries unhealthy after 60s    │
└─────────────────────────┴────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│                    API ROUTES / HANDLERS                     │
│                                                              │
│  Next.js (Vercel/Railway):  app/api/{news,refresh,cron}     │
│  Cloudflare Worker:         cf-worker.ts                    │
│  GitHub Actions cron:       .github/workflows/refresh.yml   │
│  Terminal:                  scripts/manual-refresh.ts        │
└──────────────────────────────────────────────────────────────┘
```

---

## Failover logic

### LLM (API keys)
Set `ANTHROPIC_API_KEY`, `ANTHROPIC_API_KEY_2`, `ANTHROPIC_API_KEY_3`.
Set limits with `ANTHROPIC_PRIMARY_DAILY_LIMIT=20` (0 = unlimited).
When the primary key reaches its limit, the system automatically uses key 2, then key 3.
No manual intervention — happens mid-day if needed.

### Storage
Configure any combination of Vercel KV and Upstash Redis.
**Saves** to all available adapters simultaneously (redundancy).
**Loads** from the first healthy one.
Falls back to in-memory if all persistent stores fail (data survives the session).

---

## Quick start

```bash
cp .env.example .env.local
# Fill in at minimum: ANTHROPIC_API_KEY and one storage option

npm install
npm run dev          # local dev at http://localhost:3000
```

---

## Deployment

### Option 1: Vercel (recommended — easiest)
```bash
vercel login
vercel                    # first deploy
vercel env add ANTHROPIC_API_KEY
vercel env add CRON_SECRET
# Add KV: Vercel Dashboard → Storage → KV → Connect → copy 4 KV_ env vars
vercel --prod
```
Cron: runs via `vercel.json` (requires Vercel Pro for 5×/day; free tier = 1×/day).
Augment with GitHub Actions for free 5×/day (see Option 4).

### Option 2: Railway
```bash
npm install -g @railway/cli
railway login
railway init
railway up
railway variables set ANTHROPIC_API_KEY=sk-ant-...
railway variables set CRON_SECRET=your-secret
# Use Upstash for storage (Railway has no built-in KV)
railway variables set UPSTASH_REDIS_REST_URL=...
railway variables set UPSTASH_REDIS_REST_TOKEN=...
```
For cron on Railway: add a separate cron service that runs `scripts/manual-refresh.ts`
or use GitHub Actions (Option 4).

### Option 3: Cloudflare Workers
```bash
npm install -g wrangler
wrangler login
npx wrangler kv:namespace create BRIEFING_STORE
# Paste the KV namespace ID into wrangler.toml
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put CRON_SECRET
npx wrangler deploy
```
Cron is built into Cloudflare Workers (see wrangler.toml).

### Option 4: GitHub Actions cron (works with ANY hosting)
1. Push to GitHub
2. Add secrets in repo → Settings → Secrets → Actions:
   - `APP_URL`: your deployed app URL
   - `CRON_SECRET`: same value as your env var
3. The workflow runs at 06:00, 10:00, 14:00, 18:00, 22:00 UTC automatically.
4. Manual trigger: Actions tab → "Refresh Global Report" → Run workflow.

---

## Multi-key setup (avoid daily limits)

In `.env.local` or your platform's env vars:

```bash
# Primary key — used first
ANTHROPIC_API_KEY=sk-ant-AAA...
ANTHROPIC_PRIMARY_DAILY_LIMIT=20     # switch to key 2 after 20 calls

# Secondary key — used when primary hits 20 calls
ANTHROPIC_API_KEY_2=sk-ant-BBB...
ANTHROPIC_SECONDARY_DAILY_LIMIT=20   # switch to key 3 after 20 calls

# Tertiary key — final fallback
ANTHROPIC_API_KEY_3=sk-ant-CCC...
ANTHROPIC_TERTIARY_DAILY_LIMIT=0     # unlimited
```

Keys rotate automatically mid-session. Counters reset at midnight UTC.

---

## Multi-storage setup (redundancy)

```bash
# Vercel KV (auto-populated on Vercel, or set manually)
KV_REST_API_URL=...
KV_REST_API_TOKEN=...

# Upstash Redis (works everywhere — free 10k req/day)
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...
```

The system saves to both simultaneously and reads from whichever responds first.

---

## API endpoints

| Endpoint       | Method | Description                              |
|----------------|--------|------------------------------------------|
| `/api/news`    | GET    | Returns latest briefing from storage     |
| `/api/refresh` | POST   | Fetch fresh news, save, return briefing  |
| `/api/health`  | GET    | Storage + LLM usage and health status    |
| `/api/cron`    | GET    | Same as refresh — called by cron jobs    |

**Refresh body** (optional JSON):
```json
{ "topic": "Iran sanctions latest" }
```

**Auth header** (when CRON_SECRET is set):
```
x-cron-secret: your-secret
```

---

## Check health

```bash
# From terminal
npx ts-node scripts/manual-refresh.ts --health

# Via HTTP
curl https://your-app.vercel.app/api/health
```

---

## Trigger manually from terminal

```bash
npx ts-node scripts/manual-refresh.ts
npx ts-node scripts/manual-refresh.ts "BIS enforcement 2026"
```
