import type { D1Database } from "@cloudflare/workers-types";

declare global {
  interface CloudflareEnv {
    ALERT_DB: D1Database;
    SKIP_DEPENDENCY_INSTALL: "1";
    USE_D1_STORAGE: "1";
  }
}

export {};
