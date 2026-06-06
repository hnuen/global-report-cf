// v5 - fix RSS link extraction date format Fed filter
/**
 * Official Source Scraper
 *
 * Fetches raw content directly from government websites before
 * passing to the LLM. This ensures no OFAC/OCC/BIS action is missed.
 *
 * Sources scraped:
 *   - OFAC Recent Actions (ofac.treasury.gov)
 *   - OCC Enforcement Actions (occ.gov)
 *   - BIS Press Releases (bis.gov)
 *   - FinCEN News (fincen.gov)
 *   - EU Sanctions (eur-lex.europa.eu / sanctions.ec.europa.eu)
 *   - UK OFSI (gov.uk/ofsi)
 */

export interface OfficialSource {
  name: string;
  url: string;
  content: string;
  fetchedAt: string;
  error?: string;
}

// ── Fetch a single URL with timeout ──────────────────────────────────────────
async function fetchWithTimeout(url: string, timeoutMs = 4000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; GlobalReportBot/1.0)",
        "Accept": "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

// ── Extract meaningful content from HTML/XML ─────────────────────────────────
function stripHTML(html: string): string {
  // RSS/XML feeds — extract item titles and descriptions
  if (html.includes("<rss") || html.includes("<feed") || html.includes("<item>")) {
    const items: string[] = [];
    const itemMatches = html.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/gi);
    for (const item of itemMatches) {
      const titleMatch = item[1].match(/<title[^>]*><!\[CDATA\[(.*?)\]\]><\/title>|<title[^>]*>(.*?)<\/title>/i);
      // Fed RSS and others use plain <link>URL</link> — must handle text node format
      const rawLink = item[1].replace(/<link\/>/gi, '');
      const linkMatch  = rawLink.match(/<link[^>]*>([^<]{10,})<\/link>/i);
      const guidMatch  = item[1].match(/<guid[^>]*>([^<]+)<\/guid>/i);
      const sourceUrlMatch = item[1].match(/url="(https?[^"]+)"/i);
      const descMatch  = item[1].match(/<description[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/description>|<description[^>]*>([\s\S]*?)<\/description>/i);
      // Extract pubDate — critical for correct article date
      const pubDateMatch = item[1].match(/<pubDate[^>]*>([^<]+)<\/pubDate>/i)
                        || item[1].match(/<published[^>]*>([^<]+)<\/published>/i)
                        || item[1].match(/<updated[^>]*>([^<]+)<\/updated>/i)
                        || item[1].match(/<dc:date[^>]*>([^<]+)<\/dc:date>/i);

      const title = (titleMatch?.[1] || titleMatch?.[2] || "").replace(/<[^>]+>/g,"").replace(/&amp;/g,"&").replace(/&#([0-9]+);/g,(_,n)=>String.fromCharCode(Number(n))).replace(/&#39;/g,"'").trim();

      // Parse and format the publication date
      let pubDate = "";
      if (pubDateMatch?.[1]) {
        const d = new Date(pubDateMatch[1].trim());
        if (!isNaN(d.getTime())) {
          // Output as YYYY-MM-DD directly — no locale needed, sorts correctly
          pubDate = `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`;
        }
      }

      // For Google News RSS: <link> has the google.com redirect URL which works fine.
      // <guid isPermaLink="false"> is an OPAQUE base64 article ID, NOT a URL — never use it as a link
      // (using it produces broken relative links like https://<this-app>/CBMi...).
      // <source url="..."> is just the publisher homepage — don't use it as article URL
      const guidLooksLikeUrl = !!guidMatch?.[1] && /^https?:\/\//i.test(guidMatch[1].trim());
      let link = (linkMatch?.[1] || (guidLooksLikeUrl ? guidMatch![1] : "") || "").trim();

      // Google News descriptions contain HTML inside CDATA — strip all of it
      // First strip real tags, then decode entities, then strip any decoded tags
      let desc = (descMatch?.[1] || descMatch?.[2] || "")
        .replace(/<a\b[^>]*>/gi, " ").replace(/<\/a>/gi, " ")              // explicitly drop anchor tags first (Google News wraps headlines in <a href>)
        .replace(/<[^>]+>/g, " ")                                          // strip real HTML tags
        .replace(/&lt;[^&]*&gt;/g, " ")                                    // strip encoded <tags>
        .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&")
        .replace(/<[^>]+>/g, " ")                                          // strip decoded tags
        .replace(/&nbsp;/g, " ").replace(/&#39;/g, "'")
        .replace(/&#([0-9]+);/g, (_,n) => String.fromCharCode(Number(n)))
        .replace(/<[^>]+>/g, " ")                                          // final pass — catch tags revealed by numeric-entity decoding
        .replace(/\s+/g, " ").trim()
        .slice(0, 400);

      if (desc.toLowerCase().startsWith(title.toLowerCase().slice(0, 30))) {
        desc = desc.slice(title.length).replace(/^[\s\-–—:]+/, "").trim();
      }

      const sentences = desc.split(/(?<=[.!?])\s+/);
      const brief = sentences.slice(0, 2).join(" ").slice(0, 300).trim();

      if (title.length > 10) {
        const descPart = brief.length > 20 ? ` ||| ${brief}` : "";
        // Include pubDate and article link in the item text for downstream extraction
        items.push(`• ${title} ||| ${link} ||| DATE:${pubDate}${descPart}`);
      }
    }
    return items.slice(0, 25).join("\n").slice(0, 8000);
  }

  // HTML pages — extract headings and meaningful text
  // Remove noise
  let clean = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  // Extract headings (h1-h4) and anchor text as headlines
  const headlines: string[] = [];
  const headingMatches = clean.matchAll(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/gi);
  for (const m of headingMatches) {
    const text = m[1].replace(/<[^>]+>/g,"").replace(/&amp;/g,"&").replace(/&nbsp;/g," ").replace(/&#([0-9]+);/g, (_,n) => String.fromCharCode(Number(n))).trim();
    if (text.length > 15 && text.length < 300 &&
        !text.toLowerCase().includes("skip to") &&
        !text.toLowerCase().includes("menu") &&
        !text.toLowerCase().includes("recent actions body") &&
        !text.toLowerCase().includes("release date")) {
      headlines.push(`• ${text}`);
    }
  }

  // Extract Treasury press release body paragraphs
  const paraMatches = clean.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi);
  for (const m of paraMatches) {
    const text = m[1].replace(/<[^>]+>/g,"").replace(/&amp;/g,"&").replace(/&nbsp;/g," ").replace(/\s+/g," ").trim();
    if (text.length > 60 && text.length < 600 &&
        !text.toLowerCase().includes("freedom250") &&
        !text.toLowerCase().includes("skip to main") &&
        !text.toLowerCase().includes("here's how you know") &&
        !text.toLowerCase().includes("lock a locked") &&
        (text.toLowerCase().includes("has designated") ||
         text.toLowerCase().includes("has sanctioned") ||
         text.toLowerCase().includes("has issued") ||
         text.toLowerCase().includes("designated") ||
         text.toLowerCase().includes("sanctioned") ||
         text.toLowerCase().includes("ofac") ||
         text.toLowerCase().includes("treasury") ||
         text.toLowerCase().includes("washington") ||
         text.toLowerCase().includes("sdn list"))) {
      headlines.push(`• ${text}`);
    }
  }

  // Extract link text from news-like anchors — show TEXT not URL
  const linkMatches = clean.matchAll(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi);
  for (const m of linkMatches) {
    const href = m[1];
    const text = m[2].replace(/<[^>]+>/g,"").replace(/&amp;/g,"&").replace(/&nbsp;/g," ").trim();
    // Filter out navigation, boilerplate, and generic items
    const isNav = text.toLowerCase().match(
      /^(click|read|here|more|view|see|go|back|next|prev|skip|menu|home|search|contact|about|login|sign|additional|sanctions programs|civil penalties and enforcement information$|counter terrorism designations$|international criminal|consolidated sanctions|non-sdn|sdn list|frequently asked|download|subscribe|follow us)/
    );
    const isNewsLink = href.includes("press") || href.includes("news") ||
      href.includes("release") || href.includes("action") ||
      href.includes("enforcement") || href.includes("2026") ||
      href.includes("2025") || href.includes("penalty") ||
      href.includes("sanction") || href.includes("notice") ||
      href.includes("designation") || href.includes("license");

    if (text.length > 30 && text.length < 250 && !isNav && isNewsLink) {
      headlines.push(`• ${text}`);
    }
  }

  // Deduplicate
  const seen = new Set<string>();
  const unique = headlines.filter(h => {
    const key = h.slice(0, 60);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (unique.length > 3) {
    return unique.slice(0, 30).join("\n").slice(0, 4000);
  }

  // Fallback: clean plain text
  return clean
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#([0-9]+);/g, (_,n) => String.fromCharCode(Number(n))).replace(/&#x([0-9a-fA-F]+);/g, (_,n) => String.fromCharCode(parseInt(n,16)))
    .replace(/&nbsp;/g, " ").replace(/&#[0-9]+;/g, " ")
    .replace(/\s{3,}/g, "\n")
    .trim()
    .slice(0, 4000);
}

// ── Source definitions ────────────────────────────────────────────────────────
const SOURCES: Array<{ name: string; url: string; official?: boolean }> = [
  // ── U.S. Government ─────────────────────────────────────────────────────────
  // ── Treasury / OFAC — working sources ──────────────────────────────────────
  // OFAC RSS was retired Feb 6 2025 — use program-specific pages instead
  // Sign up for email alerts at: service.govdelivery.com/service/subscribe.html?code=USTREAS_61
  // OFAC sanctions list updates — renders without JS
  // OFAC enforcement actions
  // Program-specific pages for key sanctions programs
  // OCC — news releases page works
  { name: "OCC Enforcement Actions 2026",         url: "https://www.occ.gov/news-events/newsroom/news-issuances-by-year/news-releases/2026-news-releases.html", official: true },
  // Fed — press releases RSS
  { name: "Federal Reserve — Press Releases",     url: "https://www.federalreserve.gov/feeds/press_all.xml", official: true },
  // BIS — bureau of industry and security
  { name: "BIS Export Enforcement",               url: "https://www.bis.gov/news", official: true },
  // State Department RSS
  { name: "U.S. State Department — News",         url: "https://www.state.gov/rss-feeds/press-releases/", official: true },
  // FinCEN enforcement
  { name: "FinCEN Enforcement Actions",           url: "https://www.fincen.gov/news/enforcement-actions", official: true },
  { name: "FinCEN News Releases",                 url: "https://www.fincen.gov/news/news-releases", official: true },

  // ── China / Global Export Controls ──────────────────────────────────────────
  // China MOFCOM export controls — English press releases
  // EU dual-use export controls
  // Wassenaar Arrangement — multilateral export controls
  { name: "Wassenaar Arrangement News",           url: "https://www.wassenaar.org/news/", official: true },
  // SIPRI arms and export controls
  // UK Strategic Export Controls
  { name: "UK Strategic Export Controls",         url: "https://www.gov.uk/government/collections/strategic-export-controls-licensing-data", official: true },
  // Google News — China export controls
  { name: "Google News — China Export Controls",  url: "https://news.google.com/rss/search?q=China+MOFCOM+export+controls+rare+earth+sanctions+2026&hl=en-US&gl=US&ceid=US:en" },
  // Google News — Global sanctions enforcement
  { name: "Google News — Global Sanctions",       url: "https://news.google.com/rss/search?q=global+sanctions+enforcement+BIS+Wassenaar+2026&hl=en-US&gl=US&ceid=US:en" },

  // ── Penalties & Enforcement ──────────────────────────────────────────────────
  { name: "Federal Reserve Enforcement Actions",  url: "https://www.federalreserve.gov/supervisionreg/enforcement-actions-about.htm", official: true },
  { name: "UK Financial Sanctions Penalties",     url: "https://www.gov.uk/government/publications/financial-sanctions-enforcement-and-monetary-penalties-guidance/financial-sanctions-enforcement-and-monetary-penalties-guidance", official: true },

  // ── European Union ───────────────────────────────────────────────────────────
  { name: "EU Commission — Latest News",          url: "https://ec.europa.eu/commission/presscorner/api/documents?pagesize=10&page=0&keywords=sanctions&sortby=date_updated&orderby=DESC&language=en", official: true },

  // ── United Kingdom ───────────────────────────────────────────────────────────
  { name: "UK Government — Latest News",          url: "https://www.gov.uk/search/news-and-communications?keywords=sanctions&order=updated-newest", official: true },
  { name: "UK HM Treasury — News",               url: "https://www.gov.uk/search/news-and-communications?keywords=sanctions+financial&organisations%5B%5D=hm-treasury&order=updated-newest", official: true },
  { name: "UK OFSI — Financial Sanctions",       url: "https://www.gov.uk/search/news-and-communications?keywords=financial+sanctions&organisations%5B%5D=office-of-financial-sanctions-implementation&order=updated-newest", official: true },
  { name: "UK Sanctions List",                    url: "https://www.gov.uk/government/publications/the-uk-sanctions-list", official: true },

  // ── United Nations ───────────────────────────────────────────────────────────
  { name: "UN News — Latest",                    url: "https://news.un.org/en/news/topic/peace-and-security" },

  // ── News Sources ─────────────────────────────────────────────────────────────
  { name: "Al Jazeera — Latest News",             url: "https://www.aljazeera.com/news/" },
  // Treasury news via Google News RSS — bypasses Treasury's server-side IP block
  // These return real Treasury press release URLs with correct pubDates
  { name: "U.S. Treasury — OFAC Sanctions",        url: "https://news.google.com/rss/search?q=OFAC+sanctions+site:home.treasury.gov&hl=en-US&gl=US&ceid=US:en", official: true },
  { name: "U.S. Treasury — Press Releases",        url: "https://news.google.com/rss/search?q=treasury+sanctions+OFAC+designations+site:home.treasury.gov&hl=en-US&gl=US&ceid=US:en", official: true },
  { name: "U.S. Treasury — Enforcement",           url: "https://news.google.com/rss/search?q=treasury+enforcement+penalties+site:home.treasury.gov&hl=en-US&gl=US&ceid=US:en", official: true },
  // ── Google News site-search proxies for official regulators whose own sites
  // block/timeout server-side fetches (mirrors the proven Treasury workaround
  // above — these route through Google's index but the underlying articles are
  // genuine .gov / official-domain releases with real pubDates). Names are
  // chosen so the resulting displaySource matches the Tier-1 officialKeywords
  // list in orchestrator.ts (e.g. "OFAC", "FinCEN", "BIS", "EU Council", "OFSI").
  { name: "Google News — OFAC Actions",            url: "https://news.google.com/rss/search?q=OFAC+sanctions+designations+site:ofac.treasury.gov&hl=en-US&gl=US&ceid=US:en", official: true },
  { name: "Google News — FinCEN",                  url: "https://news.google.com/rss/search?q=FinCEN+enforcement+advisory+site:fincen.gov&hl=en-US&gl=US&ceid=US:en", official: true },
  { name: "Google News — BIS Entity List",         url: "https://news.google.com/rss/search?q=BIS+export+controls+Entity+List+site:bis.gov&hl=en-US&gl=US&ceid=US:en", official: true },
  { name: "Google News — EU Council Sanctions",    url: "https://news.google.com/rss/search?q=EU+Council+sanctions+designations+site:consilium.europa.eu&hl=en-US&gl=US&ceid=US:en", official: true },
  { name: "Google News — UK OFSI",                 url: "https://news.google.com/rss/search?q=OFSI+financial+sanctions+site:gov.uk&hl=en-US&gl=US&ceid=US:en", official: true },
  { name: "Google News — Sanctions",              url: "https://news.google.com/rss/search?q=OFAC+sanctions+designations&hl=en-US&gl=US&ceid=US:en" },
  { name: "Google News — BIS Export Controls",    url: "https://news.google.com/rss/search?q=BIS+export+controls+Entity+List&hl=en-US&gl=US&ceid=US:en" },
  { name: "Google News — EU Sanctions",           url: "https://news.google.com/rss/search?q=EU+sanctions+Russia+designations&hl=en-US&gl=US&ceid=US:en" },
  { name: "Google News — Iran Sanctions",         url: "https://news.google.com/rss/search?q=Iran+sanctions+OFAC+2026&hl=en-US&gl=US&ceid=US:en" },
  { name: "Google News — Russia Sanctions",       url: "https://news.google.com/rss/search?q=Russia+sanctions+OFAC+designations+2026&hl=en-US&gl=US&ceid=US:en" },
  { name: "Google News — Cuba Sanctions",         url: "https://news.google.com/rss/search?q=Cuba+sanctions+OFAC+2026&hl=en-US&gl=US&ceid=US:en" },
  { name: "Google News — Venezuela Sanctions",    url: "https://news.google.com/rss/search?q=Venezuela+sanctions+OFAC+2026&hl=en-US&gl=US&ceid=US:en" },
  { name: "Google News — China Sanctions",        url: "https://news.google.com/rss/search?q=China+Hong+Kong+sanctions+export+controls+2026&hl=en-US&gl=US&ceid=US:en" },
  { name: "Google News — DPRK Sanctions",         url: "https://news.google.com/rss/search?q=North+Korea+DPRK+sanctions+2026&hl=en-US&gl=US&ceid=US:en" },
  { name: "Google News — Middle East Sanctions",  url: "https://news.google.com/rss/search?q=Middle+East+Gulf+sanctions+designations+2026&hl=en-US&gl=US&ceid=US:en" },
  { name: "Google News — Southeast Asia",         url: "https://news.google.com/rss/search?q=Southeast+Asia+sanctions+Myanmar+2026&hl=en-US&gl=US&ceid=US:en" },
  // ── India / Pakistan / Indonesia ─────────────────────────────────────────────
  // India DGFT (Directorate General of Foreign Trade) — export controls
  { name: "India DGFT — Trade Notices",           url: "https://www.dgft.gov.in/CP/?opt=notice" },
  // India MEA — sanctions and foreign policy
  { name: "India MEA — Press Releases",           url: "https://www.mea.gov.in/press-releases.htm" },
  // Global Sanctions — India tracker
  // Google News — India sanctions BIS
  { name: "Google News — India Sanctions",        url: "https://news.google.com/rss/search?q=India+sanctions+export+controls+DGFT+SCOMET+2026&hl=en-US&gl=US&ceid=US:en" },
  { name: "Google News — India Pakistan",         url: "https://news.google.com/rss/search?q=India+Pakistan+sanctions+trade+ban+2026&hl=en-US&gl=US&ceid=US:en" },
  { name: "Google News — Indonesia Sanctions",    url: "https://news.google.com/rss/search?q=Indonesia+sanctions+export+controls+BIS+2026&hl=en-US&gl=US&ceid=US:en" },
];

// ── Main function: fetch all sources in parallel ──────────────────────────────
// Generate Treasury press release URLs (sequential SB numbers)
// Latest known: sb0505 (May 21 2026). Fetch last 20 releases.
const LATEST_SB_NUMBER = 509; // sb0509 confirmed May 28 2026 — SDN modernization
function getTreasurySources(): Array<{ name: string; url: string }> {
  const sources = [];
  for (let i = 0; i < 30; i++) {  // fetch last 30 releases
    const num = LATEST_SB_NUMBER - i;
    const padded = "sb" + String(num).padStart(4, "0");
    sources.push({
      name: `Treasury Press Release ${padded.toUpperCase()}`,
      url: `https://home.treasury.gov/news/press-releases/${padded}`
    });
  }
  return sources;
}

// Generate OFAC date-specific URLs for last 14 days
function getOFACDateSources(): Array<{ name: string; url: string }> {
  const sources = [];
  const today = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.getFullYear().toString() +
      String(d.getMonth() + 1).padStart(2, "0") +
      String(d.getDate()).padStart(2, "0");
    sources.push({
      name: `OFAC Actions ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
      url: `https://ofac.treasury.gov/recent-actions/${dateStr}`
    });
  }
  return sources;
}

export async function fetchOfficialSources(): Promise<OfficialSource[]> {
  const now = new Date().toISOString();
  const allSources = [...SOURCES];
  const MASTER_TIMEOUT = 20000;

  const fetchOne = async (source: typeof allSources[0]) => {
    try {
      console.log(`[official] Fetching ${source.name}...`);
      const html = await fetchWithTimeout(source.url, (source as any).official ? 6000 : 4000);
      const content = stripHTML(html);
      console.log(`[official] ✅ ${source.name} — ${content.length} chars`);
      return { name: source.name, url: source.url, content, fetchedAt: now };
    } catch (e) {
      console.warn(`[official] ❌ ${source.name} failed: ${e}`);
      return { name: source.name, url: source.url, content: "", fetchedAt: now, error: String(e) };
    }
  };

  // Fetch all in parallel but race against master timeout
  const fetchAll = Promise.allSettled(allSources.map(fetchOne));

  const timeoutPromise = new Promise<typeof results>((resolve) =>
    setTimeout(() => {
      console.warn("[official] Master timeout hit — returning partial results");
      resolve(allSources.map((s) => ({
        status: "fulfilled" as const,
        value: { name: s.name, url: s.url, content: "", fetchedAt: now, error: "timeout" }
      })));
    }, MASTER_TIMEOUT)
  );

  const results = await Promise.race([fetchAll, timeoutPromise]);

  return results.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : {
          name: allSources[i].name,
          url: allSources[i].url,
          content: "",
          fetchedAt: now,
          error: String((r as PromiseRejectedResult).reason),
        }
  );
}

// ── Format sources for injection into LLM prompt ─────────────────────────────
export function formatSourcesForPrompt(sources: OfficialSource[]): string {
  const successful = sources.filter(s => s.content.length > 100);
  if (successful.length === 0) return "";

  return `
OFFICIAL GOVERNMENT SOURCES — fetched directly right now:
Use this raw data as the primary source for your briefing. Do not ignore or contradict it.

${successful.map(s => `
--- ${s.name} ---
URL: ${s.url}
Fetched: ${s.fetchedAt}
Content:
${s.content}
`).join("\n")}

END OF OFFICIAL SOURCES. Write articles based on the above real data.
`;
}
