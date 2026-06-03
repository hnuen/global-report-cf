/**
 * Cloudflare Worker entry point
 *
 * This file is ONLY used when deploying to Cloudflare Workers.
 * It wraps the same orchestrator logic with Cloudflare-specific bindings.
 *
 * For Next.js deployments (Vercel / Railway) use app/api/* routes instead.
 */

interface Env {
  BRIEFING_STORE: KVNamespace;
  ANTHROPIC_API_KEY: string;
  ANTHROPIC_API_KEY_2?: string;
  ANTHROPIC_API_KEY_3?: string;
  ANTHROPIC_PRIMARY_DAILY_LIMIT?: string;
  ANTHROPIC_SECONDARY_DAILY_LIMIT?: string;
  ANTHROPIC_TERTIARY_DAILY_LIMIT?: string;
  CRON_SECRET?: string;
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
}

import { buildLLMManager }  from "./src/lib/briefing-fetcher";
import type { Briefing }     from "./src/lib/types";

const KV_KEY = "briefing_v1";

// Inject CF env into process.env equivalents for the shared lib
function injectEnv(env: Env) {
  (globalThis as Record<string, unknown>).__CF_ENV = env;
}

function getEnv(): Env {
  return (globalThis as Record<string, unknown>).__CF_ENV as Env ?? {} as Env;
}

// Override process.env reads used by briefing-fetcher.ts
function patchProcessEnv(env: Env) {
  Object.assign(process.env, {
    ANTHROPIC_API_KEY:   env.ANTHROPIC_API_KEY,
    ANTHROPIC_API_KEY_2: env.ANTHROPIC_API_KEY_2 ?? "",
    ANTHROPIC_API_KEY_3: env.ANTHROPIC_API_KEY_3 ?? "",
    ANTHROPIC_PRIMARY_DAILY_LIMIT:   env.ANTHROPIC_PRIMARY_DAILY_LIMIT   ?? "0",
    ANTHROPIC_SECONDARY_DAILY_LIMIT: env.ANTHROPIC_SECONDARY_DAILY_LIMIT ?? "0",
    ANTHROPIC_TERTIARY_DAILY_LIMIT:  env.ANTHROPIC_TERTIARY_DAILY_LIMIT  ?? "0",
  });
}

async function loadFromKV(kv: KVNamespace): Promise<Briefing | null> {
  const raw = await kv.get(KV_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

async function saveToKV(kv: KVNamespace, b: Briefing): Promise<void> {
  await kv.put(KV_KEY, JSON.stringify(b));
}

async function doRefresh(env: Env, topic?: string): Promise<Briefing> {
  patchProcessEnv(env);
  const llm = buildLLMManager();
  const { briefing } = await llm.fetch(topic);
  await saveToKV(env.BRIEFING_STORE, briefing);
  return briefing;
}

// ── HTML shell (same as before — serves the frontend) ─────────────────────────
function html(briefingJson: string): string {
  // Inlines the latest briefing so first paint is instant (no extra fetch)
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>The Global Report</title>
  <script>window.__INITIAL_DATA__ = ${briefingJson};</script>
  <script src="/app.js" defer></script>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=IBM+Plex+Sans:wght@300;400;500&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet"/>
  <style>
    /* paste full CSS from src/app/globals.css here when building standalone CF deploy */
    html{-webkit-text-size-adjust:100%}*{box-sizing:border-box;margin:0;padding:0}
    body{background:#f5f0e8;font-family:'IBM Plex Sans',sans-serif;color:#1a1208}
    .loading{padding:60px 20px;text-align:center;font-family:'IBM Plex Mono',monospace;font-size:.7rem;color:#7a6b52;letter-spacing:.15em;text-transform:uppercase}
  </style>
</head>
<body>
  <div id="app"><div class="loading">Loading The Global Report…</div></div>
  <script>
    // Hydrate with inlined data then load the app bundle
    // For full CF deployment, bundle app/page.tsx as a static JS file
    // and serve it from /app.js — see README for build instructions.
    if (window.__INITIAL_DATA__ && window.__INITIAL_DATA__.articles) {
      document.getElementById('app').innerHTML =
        '<div style="padding:40px 24px;font-family:IBM Plex Mono,monospace;font-size:.75rem;color:#7a6b52">' +
        'Loaded ' + window.__INITIAL_DATA__.articles.length + ' articles. ' +
        'For full UI, build app.js bundle — see README.</div>';
    }
  </script>
</body>
</html>`;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    injectEnv(env);
    const url = new URL(request.url);

    if (url.pathname === "/api/news") {
      const briefing = await loadFromKV(env.BRIEFING_STORE);
      return Response.json(briefing ?? { error: "No data yet — click Refresh" });
    }

    if (url.pathname === "/api/refresh" && request.method === "POST") {
      try {
        const body = await request.json().catch(() => ({})) as { topic?: string };
        const briefing = await doRefresh(env, body.topic);
        return Response.json(briefing);
      } catch (e) {
        return Response.json({ error: String(e) }, { status: 500 });
      }
    }

    if (url.pathname === "/api/health") {
      const briefing = await loadFromKV(env.BRIEFING_STORE);
      return Response.json({
        storage: [{ id: "cloudflare-kv", healthy: !!briefing, lastUpdated: briefing?.lastUpdated }],
        timestamp: new Date().toISOString(),
      });
    }

    // Serve HTML app
    const briefing = await loadFromKV(env.BRIEFING_STORE);
    return new Response(html(JSON.stringify(briefing ?? {})), {
      headers: { "Content-Type": "text/html;charset=UTF-8" },
    });
  },

  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    console.log("[cf-cron] Starting…");
    const briefing = await doRefresh(env);
    console.log(`[cf-cron] Done — ${briefing.articles.length} articles`);
  },
};
