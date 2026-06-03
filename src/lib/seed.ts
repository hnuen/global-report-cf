import type { Briefing } from "./types";

export const SEED_DATA: Briefing = {
  lastUpdated: "Loading…",
  articles: [
    {
      id: 1, section: "sanctions", category: "OFAC", region: "Iran", impact: "high",
      date: "May 2026",
      source: "U.S. Treasury OFAC",
      sourceUrl: "https://home.treasury.gov/policy-issues/office-of-foreign-assets-control-sanctions-programs-and-information",
      headline: "Welcome to The Global Report — click Refresh Now to load today's briefing",
      body: [
        "Your Global Report app is live and ready. Click the ↻ Refresh Now button above to fetch the latest intelligence briefing across all six domains: Sanctions, Economics, Religion, OCC, Financial Penalties, and BIS/Export Controls.",
        "Once you click Refresh, the app will search the web for the latest news via Claude and display a full briefing here. This seed message will be replaced with real articles.",
      ],
    },
  ],
  sidebar: {
    sanctions:  { watchlist: [], keyFigures: [{ label: "Status", value: "Ready" }] },
    economics:  { watchlist: [], keyFigures: [] },
    religion:   { watchlist: [], keyFigures: [] },
    occ:        { watchlist: [], keyFigures: [] },
    penalties:  { watchlist: [], keyFigures: [] },
    bis:        { watchlist: [], keyFigures: [] },
  },
};
