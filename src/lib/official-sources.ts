// v6 - ETag/Last-Modified conditional requests to skip unchanged sources
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

import { loadETagStore, flushETagStore, getConditionalHeaders, recordETagResponse, type ETagStore } from "./source-etag-cache";
import { normalizeTreasuryPressReleaseUrl, treasuryPressReleasePattern } from "./treasury-links";
import { itemCheckpointKey, loadSourceItemCheckpoints, sourceCheckpointKey } from "./source-item-checkpoints";
import { isLikelyCorruptedText } from "./text-quality";

export interface OfficialSource {
  name: string;
  url: string;
  content: string;
  fetchedAt: string;
  error?: string;
  checkpoint?: { url: string; itemKeys: string[] };
}

// RSS feeds and listing pages needed by the alert pipeline are much smaller
// than this. Reject unusually large responses before regex parsing so one
// publisher page cannot consume the entire Worker CPU allowance.
const MAX_SOURCE_BYTES = 512 * 1024;

async function readTextBounded(res: Response, maxBytes = MAX_SOURCE_BYTES): Promise<string> {
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new Error(`Source response too large: ${declared} bytes`);
  }
  if (!res.body) return "";
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) throw new Error(`Source response exceeded ${maxBytes} bytes`);
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}

// â”€â”€ Fetch a single URL with timeout + optional ETag conditional headers â”€â”€â”€â”€â”€â”€
// Returns null on 304 Not Modified (caller should use cached articles instead).
async function fetchWithTimeout(
  url: string,
  timeoutMs = 4000,
  etagStore?: ETagStore,
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const conditionalHeaders = etagStore ? getConditionalHeaders(url, etagStore) : {};
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,application/rss+xml;q=0.8,*/*;q=0.7",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        ...conditionalHeaders,
      },
    });
    // 304 Not Modified â€” source unchanged since last fetch
    if (res.status === 304) return null;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
    if (contentType && !/(?:text\/|html|xml|json|rss|atom|javascript)/.test(contentType)) {
      throw new Error(`Unsupported non-text content-type: ${contentType.slice(0, 80)}`);
    }
    const text = await readTextBounded(res);
    if (isLikelyCorruptedText(text)) throw new Error("Response decoded as binary/corrupted text");
    // Only checkpoint a response after it has passed decoding and quality checks.
    if (etagStore) recordETagResponse(url, res, etagStore);
    return text;
  } finally {
    clearTimeout(timer);
  }
}

// â”€â”€ Extract meaningful content from HTML/XML â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function stripHTML(html: string): string {
  // RSS/XML feeds â€” extract item titles and descriptions
  if (html.includes("<rss") || html.includes("<feed") || html.includes("<item>")) {
    const items: string[] = [];
    const itemMatches = html.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/gi);
    for (const item of itemMatches) {
      const titleMatch = item[1].match(/<title[^>]*><!\[CDATA\[(.*?)\]\]><\/title>|<title[^>]*>(.*?)<\/title>/i);
      // Fed RSS and others use plain <link>URL</link> â€” must handle text node format
      const rawLink = item[1].replace(/<link\/>/gi, '');
      const linkMatch  = rawLink.match(/<link[^>]*>([^<]{10,})<\/link>/i);
      const guidMatch  = item[1].match(/<guid[^>]*>([^<]+)<\/guid>/i);
      const sourceUrlMatch = item[1].match(/url="(https?[^"]+)"/i);
      const descMatch  = item[1].match(/<description[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/description>|<description[^>]*>([\s\S]*?)<\/description>/i);
      // Extract pubDate â€” critical for correct article date
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
          // Output as YYYY-MM-DD directly â€” no locale needed, sorts correctly
          pubDate = `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`;
        }
      }

      // For Google News RSS: <link> has the google.com redirect URL which works fine.
      // <guid isPermaLink="false"> is an OPAQUE base64 article ID, NOT a URL â€” never use it as a link
      // (using it produces broken relative links like https://<this-app>/CBMi...).
      // <source url="..."> is just the publisher homepage â€” don't use it as article URL
      const guidLooksLikeUrl = !!guidMatch?.[1] && /^https?:\/\//i.test(guidMatch[1].trim());
      let link = (linkMatch?.[1] || (guidLooksLikeUrl ? guidMatch![1] : "") || "").trim();

      // Google News descriptions contain HTML inside CDATA â€” strip all of it
      // First strip real tags, then decode entities, then strip any decoded tags
      let desc = (descMatch?.[1] || descMatch?.[2] || "")
        .replace(/<a\b[^>]*>/gi, " ").replace(/<\/a>/gi, " ")              // explicitly drop anchor tags first (Google News wraps headlines in <a href>)
        .replace(/<[^>]+>/g, " ")                                          // strip real HTML tags
        .replace(/&lt;[^&]*&gt;/g, " ")                                    // strip encoded <tags>
        .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&")
        .replace(/<[^>]+>/g, " ")                                          // strip decoded tags
        .replace(/&nbsp;/g, " ").replace(/&#39;/g, "'")
        .replace(/&#([0-9]+);/g, (_,n) => String.fromCharCode(Number(n)))
        .replace(/<[^>]+>/g, " ")                                          // final pass â€” catch tags revealed by numeric-entity decoding
        .replace(/\s+/g, " ").trim()
        .slice(0, 400);

      if (desc.toLowerCase().startsWith(title.toLowerCase().slice(0, 30))) {
        desc = desc.slice(title.length).replace(/^[\s\-â€“â€”:]+/, "").trim();
      }

      const sentences = desc.split(/(?<=[.!?])\s+/);
      const brief = sentences.slice(0, 2).join(" ").slice(0, 300).trim();

      if (title.length > 10) {
        const descPart = brief.length > 20 ? ` ||| ${brief}` : "";
        // Include pubDate and article link in the item text for downstream extraction
        items.push(`â€¢ ${title} ||| ${link} ||| DATE:${pubDate}${descPart}`);
      }
    }
    return items.slice(0, 25).join("\n").slice(0, 8000);
  }

  // HTML pages â€” extract headings and meaningful text
  // Remove noise
  let clean = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  // Extract links FIRST so deduplication keeps the version with the href.
  // (Headings and links often share the same text; without this ordering the
  //  bare-heading version wins and the specific article URL is lost.)
  const headlines: string[] = [];

  // U.S. Treasury press releases: pull each release's DIRECT per-item link
  // (.../news/press-releases/sbNNNN) plus its date, pushed first so downstream
  // articles link straight to the release instead of falling back to the
  // generic listing URL (home.treasury.gov/news/press-releases). No-op on any
  // page without these links. Mirrors parseTreasuryNews in
  // .github/scripts/refresh-briefing.mjs.
  const treasuryRe = treasuryPressReleasePattern();
  const treasurySeen = new Set<string>();
  let tm: RegExpExecArray | null;
  while ((tm = treasuryRe.exec(clean)) !== null) {
    const turl = normalizeTreasuryPressReleaseUrl(tm[2]);
    const ttitle = tm[3].replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#\d+;/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
    if (!ttitle || ttitle.length < 15 || treasurySeen.has(turl)) continue;
    const before = clean.slice(Math.max(0, (tm.index ?? 0) - 260), tm.index).replace(/<[^>]+>/g, " ");
    const dm = before.match(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+20\d{2}\b/g);
    const tdate = dm ? dm[dm.length - 1] : "";
    treasurySeen.add(turl);
    headlines.push(`â€¢ ${ttitle} ||| ${turl}${tdate ? " ||| DATE:" + tdate : ""}`);
  }

  // Extract link text from news-like anchors â€” show TEXT not URL
  const linkMatches0 = clean.matchAll(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi);
  for (const m of linkMatches0) {
    const href = m[1];
    const text = m[2].replace(/<[^>]+>/g,"").replace(/&amp;/g,"&").replace(/&nbsp;/g," ").trim();
    const isNav0 = text.toLowerCase().match(
      /^(click|read|here|more|view|see|go|back|next|prev|skip|menu|home|search|contact|about|login|sign|additional|sanctions programs|civil penalties and enforcement information$|counter terrorism designations$|international criminal|consolidated sanctions|non-sdn|sdn list|frequently asked|download|subscribe|follow us)/
    );
    const isNewsLink0 = href.includes("press") || href.includes("news") ||
      href.includes("release") || href.includes("action") ||
      href.includes("enforcement") || href.includes("2026") ||
      href.includes("2025") || href.includes("penalty") ||
      href.includes("sanction") || href.includes("notice") ||
      href.includes("designation") || href.includes("license");
    if (text.length > 30 && text.length < 250 && !isNav0 && isNewsLink0) {
      const ctxStart0 = Math.max(0, (m.index ?? 0) - 100);
      const ctxEnd0   = Math.min(clean.length, (m.index ?? 0) + m[0].length + 400);
      const ctx0 = clean.slice(ctxStart0, ctxEnd0).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
      const fullDate0   = ctx0.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+20\d{2}\b/);
      const monthYear0  = !fullDate0 && ctx0.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+20\d{2}\b/);
      const dateAppend0 = fullDate0?.[0] || monthYear0?.[0] || "";
      headlines.push(`â€¢ ${text} ||| ${href}${dateAppend0 ? " ||| DATE:" + dateAppend0 : ""}`);
    }
  }

  // Extract headings (h1-h4) â€” added after links so dedup keeps the link version
  const headingMatches = clean.matchAll(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/gi);
  for (const m of headingMatches) {
    const text = m[1].replace(/<[^>]+>/g,"").replace(/&amp;/g,"&").replace(/&nbsp;/g," ").replace(/&#([0-9]+);/g, (_,n) => String.fromCharCode(Number(n))).trim();
    if (text.length > 15 && text.length < 300 &&
        !text.toLowerCase().includes("skip to") &&
        !text.toLowerCase().includes("menu") &&
        !text.toLowerCase().includes("recent actions body") &&
        !text.toLowerCase().includes("release date") &&
        !text.toLowerCase().startsWith("enforcement actions for") &&
        !text.toLowerCase().startsWith("notices of proposed") &&
        !/^civil money penalty$/i.test(text.trim())) {
      headlines.push(`â€¢ ${text}`);
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
      headlines.push(`â€¢ ${text}`);
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

// â”€â”€ Source definitions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// group 1 (t=0, immediate)  â€” OFAC date news + Treasury SB probes (defined in generator fns below)
// group 2 (t=+3 min)        â€” Federal Register OFAC/Treasury + Treasury News + State Dept + priority Google News OFAC
// group 3 (t=+6 min)        â€” UK, EU, BIS, OCC, Fed official government pages
// group 4 (t=+9 min)        â€” China, DPRK, regional, AP, BBC, CNN, FinCEN news
// Each group fetches independently and merges into Redis â€” never overwrites prior groups.
const SOURCES: Array<{ name: string; url: string; official?: boolean; group: 2|3|4; sections: string[] }> = [
  // â”€â”€ Group 2 â€” Federal Register OFAC/Treasury + priority Google News â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Federal Register (federalregister.gov) is API-first, accessible from Cloudflare IPs.
  { name: "Federal Register â€” OFAC Actions",       url: "https://www.federalregister.gov/documents/search.rss?conditions%5Bagencies%5D%5B%5D=office-of-foreign-assets-control", official: true, group: 2, sections: ["sanctions","penalties"] },
  { name: "Federal Register â€” Treasury Sanctions", url: "https://www.federalregister.gov/documents/search.rss?conditions%5Bagencies%5D%5B%5D=department-of-the-treasury&conditions%5Bterm%5D=OFAC+sanctions+designations", official: true, group: 2, sections: ["sanctions"] },
  // home.treasury.gov is accessible from Cloudflare IPs (unlike ofac.treasury.gov)
  { name: "U.S. Treasury â€” News",                  url: "https://home.treasury.gov/news/press-releases", official: true, group: 2, sections: ["sanctions","economics","penalties"] },
  { name: "U.S. State Department â€” News",          url: "https://www.state.gov/rss-feeds/press-releases/", official: true, group: 2, sections: ["sanctions","economics"] },
  { name: "Google News â€” OFAC Broad",              url: "https://news.google.com/rss/search?q=OFAC+sanctions+SDN+designations+treasury+2026&hl=en-US&gl=US&ceid=US:en", official: true, group: 2, sections: ["sanctions"] },
  { name: "Google News â€” Iran Sanctions",          url: "https://news.google.com/rss/search?q=Iran+sanctions+OFAC+2026&hl=en-US&gl=US&ceid=US:en", group: 2, sections: ["sanctions"] },
  { name: "Google News â€” Russia Sanctions",        url: "https://news.google.com/rss/search?q=Russia+sanctions+OFAC+designations+2026&hl=en-US&gl=US&ceid=US:en", group: 2, sections: ["sanctions"] },
  { name: "Google News â€” Cuba Russia OFAC GL",     url: "https://news.google.com/rss/search?q=OFAC+Cuba+Russia+%22general+license%22+designation+2026&hl=en-US&gl=US&ceid=US:en", group: 2, sections: ["sanctions"] },

  // â”€â”€ Group 3 â€” UK, EU, BIS, OCC, Fed official pages â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  { name: "OCC Enforcement Actions 2026",          url: "https://www.occ.gov/news-events/newsroom/news-issuances-by-year/news-releases/2026-news-releases.html", official: true, group: 3, sections: ["occ"] },
  { name: "Federal Reserve â€” Press Releases",      url: "https://www.federalreserve.gov/feeds/press_all.xml", official: true, group: 3, sections: ["economics","occ","penalties"] },
  { name: "White House â€” Presidential Actions",   url: "https://www.whitehouse.gov/presidential-actions/", official: true, group: 3, sections: ["sanctions","economics","bis","regions"] },
  { name: "Congress.gov â€” Sanctions Legislation", url: "https://www.congress.gov/search?q=%7B%22source%22%3A%22legislation%22%2C%22search%22%3A%22sanctions%20export%20controls%22%7D&pageSort=dateOfIntroduction%3Adesc", official: true, group: 3, sections: ["sanctions","bis"] },
  { name: "Federal Register â€” BIS Export Controls", url: "https://www.federalregister.gov/documents/search.rss?conditions%5Bagencies%5D%5B%5D=bureau-of-industry-and-security&conditions%5Bterm%5D=export+controls+entity+list", official: true, group: 3, sections: ["bis"] },
  { name: "Federal Register â€” BIS Actions",        url: "https://www.federalregister.gov/documents/search.rss?conditions%5Bagencies%5D%5B%5D=bureau-of-industry-and-security", official: true, group: 3, sections: ["bis"] },
  { name: "Federal Reserve Enforcement Actions",   url: "https://www.federalreserve.gov/supervisionreg/enforcement-actions-about.htm", official: true, group: 3, sections: ["occ","penalties"] },
  { name: "UK Financial Sanctions Penalties",      url: "https://www.gov.uk/government/publications/ofsi-monetary-penalty-notices-and-reports", official: true, group: 3, sections: ["penalties","sanctions"] },
  { name: "EU Commission â€” Latest News",           url: "https://ec.europa.eu/commission/presscorner/api/documents?pagesize=10&page=0&keywords=sanctions&sortby=date_updated&orderby=DESC&language=en", official: true, group: 3, sections: ["sanctions"] },
  { name: "UK Government â€” Latest News",           url: "https://www.gov.uk/search/news-and-communications?keywords=sanctions&order=updated-newest", official: true, group: 3, sections: ["sanctions"] },
  { name: "UK HM Treasury â€” News",                url: "https://www.gov.uk/search/news-and-communications?keywords=sanctions+financial&organisations%5B%5D=hm-treasury&order=updated-newest", official: true, group: 3, sections: ["sanctions","economics"] },
  { name: "UK OFSI â€” Financial Sanctions",        url: "https://www.gov.uk/search/news-and-communications?keywords=financial+sanctions&organisations%5B%5D=office-of-financial-sanctions-implementation&order=updated-newest", official: true, group: 3, sections: ["sanctions"] },
  { name: "UK Sanctions List",                     url: "https://www.gov.uk/government/publications/the-uk-sanctions-list", official: true, group: 3, sections: ["sanctions"] },
  // U.S. Department of War (formerly Department of Defense) â€” News Releases RSS.
  // Publishes the Section 1260H "Chinese Military Companies" list updates and related DOW statements.
  { name: "U.S. Department of War â€” News Releases", url: "https://www.war.gov/DesktopModules/ArticleCS/RSS.ashx?ContentType=9&Site=945&max=10", official: true, group: 3, sections: ["sanctions","bis"] },

  // â”€â”€ Group 4 â€” FinCEN, China/HK, regional, media sources â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  { name: "FinCEN Enforcement Actions",            url: "https://www.fincen.gov/news", official: true, group: 3, sections: ["penalties"] },
  { name: "FinCEN News Releases",                  url: "https://www.fincen.gov/news/news-releases", official: true, group: 3, sections: ["penalties"] },
  { name: "DHS â€” News",                            url: "https://www.dhs.gov/news/rss.xml", official: true, group: 3, sections: ["sanctions","bis","regions"] },
  { name: "USA.gov â€” Government Updates",          url: "https://www.usa.gov/blog", official: true, group: 3, sections: ["economics","regions"] },
  { name: "Al Jazeera â€” Latest News",              url: "https://www.aljazeera.com/xml/rss/all.xml", group: 4, sections: ["sanctions","economics","regions"] },
  { name: "NPR â€” World",                           url: "https://feeds.npr.org/1004/rss.xml", group: 4, sections: ["sanctions","economics","regions"] },
  { name: "Google News â€” China Export Controls",   url: "https://news.google.com/rss/search?q=China+MOFCOM+export+controls+rare+earth+sanctions+2026&hl=en-US&gl=US&ceid=US:en", group: 4, sections: ["bis","sanctions"] },
  { name: "Google News â€” Global Sanctions",        url: "https://news.google.com/rss/search?q=global+sanctions+enforcement+BIS+Wassenaar+2026&hl=en-US&gl=US&ceid=US:en", group: 4, sections: ["sanctions","bis"] },
  { name: "Google News â€” FinCEN",                  url: "https://news.google.com/rss/search?q=FinCEN+enforcement+AML+BSA+advisory+penalty+2026&hl=en-US&gl=US&ceid=US:en", official: true, group: 4, sections: ["penalties"] },
  { name: "Google News â€” BIS Entity List",         url: "https://news.google.com/rss/search?q=BIS+export+controls+Entity+List+EAR+2026&hl=en-US&gl=US&ceid=US:en", official: true, group: 4, sections: ["bis"] },
  { name: "Google News â€” EU Council Sanctions",    url: "https://news.google.com/rss/search?q=EU+Council+sanctions+designations+restrictive+measures+2026&hl=en-US&gl=US&ceid=US:en", official: true, group: 4, sections: ["sanctions"] },
  { name: "Google News â€” UK OFSI",                 url: "https://news.google.com/rss/search?q=OFSI+UK+financial+sanctions+penalty+2026&hl=en-US&gl=US&ceid=US:en", official: true, group: 4, sections: ["sanctions","penalties"] },
  { name: "Google News â€” BIS Export Controls",     url: "https://news.google.com/rss/search?q=BIS+export+controls+Entity+List&hl=en-US&gl=US&ceid=US:en", group: 4, sections: ["bis"] },
  { name: "Google News â€” China Sanctions",         url: "https://news.google.com/rss/search?q=China+Hong+Kong+sanctions+export+controls+2026&hl=en-US&gl=US&ceid=US:en", group: 4, sections: ["sanctions","bis"] },
  // NS-CMIC = Non-SDN Chinese Military-Industrial Complex Companies (EO 13959 / EO 14032)
  { name: "Google News â€” NS-CMIC Section 1237",    url: "https://news.google.com/rss/search?q=%22NS-CMIC%22+OR+%22Section+1237%22+%22Chinese+military%22+OFAC+DoD+2026&hl=en-US&gl=US&ceid=US:en", group: 4, sections: ["sanctions"] },
  { name: "Google News â€” EO 13959 EO 14032",       url: "https://news.google.com/rss/search?q=%22EO+13959%22+OR+%22EO+14032%22+OR+%2213959%22+China+military+investment+ban+2026&hl=en-US&gl=US&ceid=US:en", group: 4, sections: ["sanctions"] },
  { name: "Google News â€” China Military Tech Firms", url: "https://news.google.com/rss/search?q=AVIC+OR+CETC+OR+CASIC+OR+Norinco+OR+CNOOC+OR+SMIC+OR+Hikvision+OR+DJI+OR+SenseTime+OR+BGI+sanctions+entity+list+2026&hl=en-US&gl=US&ceid=US:en", group: 4, sections: ["sanctions","bis"] },
  { name: "Google News â€” Xinjiang XPCC",            url: "https://news.google.com/rss/search?q=Xinjiang+XPCC+Uyghur+%22forced+labor%22+sanctions+OFAC+2026&hl=en-US&gl=US&ceid=US:en", group: 4, sections: ["sanctions"] },
  { name: "Google News â€” Hong Kong Autonomy Sanctions", url: "https://news.google.com/rss/search?q=%22Hong+Kong%22+sanctions+%22EO+13936%22+OR+%22autonomy%22+OFAC+treasury+2026&hl=en-US&gl=US&ceid=US:en", group: 4, sections: ["sanctions"] },
  { name: "Google News â€” DPRK Sanctions",          url: "https://news.google.com/rss/search?q=North+Korea+DPRK+OFAC+sanctions+designations+2026&hl=en-US&gl=US&ceid=US:en", group: 4, sections: ["sanctions"] },
  { name: "Google News â€” Middle East Sanctions",   url: "https://news.google.com/rss/search?q=Middle+East+Gulf+sanctions+designations+2026&hl=en-US&gl=US&ceid=US:en", group: 4, sections: ["sanctions"] },
  { name: "Google News â€” Southeast Asia",          url: "https://news.google.com/rss/search?q=ASEAN+Myanmar+Singapore+Malaysia+Indonesia+Philippines+Vietnam+sanctions+2026&hl=en-US&gl=US&ceid=US:en", group: 4, sections: ["sanctions"] },
  { name: "Google News â€” India Sanctions",         url: "https://news.google.com/rss/search?q=India+Pakistan+sanctions+OFAC+export+controls+2026&hl=en-US&gl=US&ceid=US:en", group: 4, sections: ["sanctions"] },
  { name: "Google News â€” Venezuela Sanctions",     url: "https://news.google.com/rss/search?q=Venezuela+OFAC+Maduro+sanctions+designations+2026&hl=en-US&gl=US&ceid=US:en", group: 4, sections: ["sanctions"] },
  { name: "Google News â€” Al Jazeera Pakistan Iran", url: "https://news.google.com/rss/search?q=site:aljazeera.com+Pakistan+Iran+India+sanctions+nuclear+2026&hl=en-US&gl=US&ceid=US:en", group: 4, sections: ["sanctions","regions"] },
  { name: "AP News â€” Sanctions & Finance",         url: "https://news.google.com/rss/search?q=site:apnews.com+sanctions+treasury+OFAC+2026&hl=en-US&gl=US&ceid=US:en", group: 4, sections: ["sanctions","penalties"] },
  { name: "AP News â€” World & Economics",           url: "https://news.google.com/rss/search?q=site:apnews.com+economy+trade+export+controls+2026&hl=en-US&gl=US&ceid=US:en", group: 4, sections: ["economics","bis"] },
  { name: "AP News â€” World & Regional",            url: "https://news.google.com/rss/search?q=site:apnews.com+world+regional+news+2026&hl=en-US&gl=US&ceid=US:en", group: 4, sections: ["regions"] },
  { name: "BBC News â€” World",                      url: "https://feeds.bbci.co.uk/news/world/rss.xml", group: 4, sections: ["sanctions","economics","regions"] },
  { name: "BBC News â€” Business",                   url: "https://feeds.bbci.co.uk/news/business/rss.xml", group: 4, sections: ["economics","penalties","occ"] },
  { name: "CNN â€” World & Sanctions",               url: "https://news.google.com/rss/search?q=site:cnn.com+sanctions+OFAC+treasury+designations+2026&hl=en-US&gl=US&ceid=US:en", group: 4, sections: ["sanctions","economics"] },
  { name: "CNN â€” Business & Trade",                url: "https://news.google.com/rss/search?q=site:cnn.com+business+trade+export+controls+economy+2026&hl=en-US&gl=US&ceid=US:en", group: 4, sections: ["economics","bis"] },
  ];

// â”€â”€ OFAC date-specific Google News queries (last 5 days) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ofac.treasury.gov is blocked from CF IPs (403). Instead search Google News for
// news articles that CITE specific /recent-actions/YYYYMMDD URLs â€” law firms,
// Reuters, AP all reference the exact URLs when covering OFAC actions.
function getOFACDateNewsRSS(): Array<{ name: string; url: string; group: 1; sections: string[] }> {
  // ofac.treasury.gov returns 403 from Cloudflare IPs â€” cannot fetch directly.
  // Instead: search Google News for the EXACT generated URLs.
  // When OFAC publishes an action, Reuters/AP/law firms cite the specific
  // ofac.treasury.gov/recent-actions/YYYYMMDD URL in their articles.
  // Google News indexes those articles and returns them via RSS.
  // group: 1 â€” fetched immediately in the first batch (highest OFAC priority)
  const results = [];
  const today = new Date();
  for (let i = 0; i < 5; i++) {  // 5 days â€” covers recent OFAC actions
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const code = d.getFullYear().toString() +
      String(d.getMonth() + 1).padStart(2, "0") +
      String(d.getDate()).padStart(2, "0");
    const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const q = encodeURIComponent(
      `"ofac.treasury.gov/recent-actions/${code}" OR "ofac.treasury.gov/recent-actions/${code}_33" OR "ofac.treasury.gov/recent-actions/${code}_66"`
    );
    results.push({
      name: `OFAC Recent Actions ${label}`,
      url: `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`,
      group: 1 as const,
      sections: ["sanctions"],
    });
  }
  return results;
}

// â”€â”€ Main function: fetch all sources in parallel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Generate Treasury press release URLs (sequential SB numbers)
// Confirmed latest: SB0498 = May 11, 2026 (verified from home.treasury.gov/news/press-releases).
// OFAC designation-only actions (not full sanctions campaigns) do NOT get SB press releases â€”
// they appear only on ofac.treasury.gov/recent-actions (JS-rendered, inaccessible from CF Workers).
// Strategy: probe SB_BASELINE Â± BUFFER to catch the known latest plus any new releases.
const SB_BASELINE_NUM  = 528;  // SB0528 = Jun 12, 2026 (last confirmed Treasury press release)
const SB_PROBE_ABOVE   = 8;    // probe up to 8 above baseline for new releases (~1 new SB/day)
function getTreasurySources(): Array<{ name: string; url: string; group: 1; sections: string[] }> {
  const sources = [];
  // Probe from (baseline + PROBE_ABOVE) down to baseline â€” ensures we always hit the known latest
  // and catch any new releases above it. E.g.: 503, 502, 501, 500, 499, 498
  // group: 1 â€” Treasury SB press releases are authoritative for OFAC enforcement actions, fetched first
  for (let num = SB_BASELINE_NUM + SB_PROBE_ABOVE; num >= SB_BASELINE_NUM; num--) {
    const padded = "sb" + String(num).padStart(4, "0");
    sources.push({
      name: `Treasury Press Release ${padded.toUpperCase()}`,
      url: `https://home.treasury.gov/news/press-releases/${padded}`,
      group: 1 as const,
      sections: ["sanctions","economics","penalties"],
    });
  }
  return sources; // returns SB_PROBE_ABOVE + 1 = 6 entries
}

// Generate OFAC date-specific URLs for last 14 days
function getOFACDateSources(): Array<{ name: string; url: string }> {
  const sources = [];
  const today = new Date();
  for (let i = 0; i < 7; i++) {
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


// â”€â”€ Subrequest budget guard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// CF Workers hard limit: 50 subrequests per invocation.
// Budget breakdown (skipLLM=true fast path):
//   - source fetches   (SOURCES + Treasury SBs)
//   - Redis save       ~2 calls
//   - safety headroom  5
// Budget breakdown (full LLM path):
//   - source fetches + Redis load + Redis save + Gemini
//   - Allow more headroom since LLM path has fewer sources
const CF_SUBREQUEST_LIMIT = 50;
const REDIS_OVERHEAD = 4;  // load + save + connection overhead
const SUBREQUEST_HEADROOM = 4;  // safety buffer

export function checkSubrequestBudget(sources: Array<unknown>, label = "fetchOfficialSources"): void {
  const estimated = sources.length + REDIS_OVERHEAD + SUBREQUEST_HEADROOM;
  const budget = CF_SUBREQUEST_LIMIT - SUBREQUEST_HEADROOM;
  if (estimated > budget) {
    const msg = `[subrequest-guard] ${label}: estimated ${estimated} subrequests (${sources.length} sources + ${REDIS_OVERHEAD} Redis overhead + ${SUBREQUEST_HEADROOM} headroom) exceeds safe budget of ${budget}. Redis save WILL fail. Reduce source count by ${estimated - budget}.`;
    console.error(msg);
    // Don't throw â€” let the fetch proceed but warn loudly so logs surface the problem
  } else {
    console.log(`[subrequest-guard] ${label}: ${estimated} estimated subrequests (${sources.length} sources) â€” within budget âœ…`);
  }
}

// Multi-batch fetch strategy â€” 4 groups fetched at t=0, +3min, +6min, +9min:
// group 1 (t=0)    â€” OFAC date news + Treasury SBs               (~11 sources)
// group 2 (t=+3m)  â€” Federal Register OFAC/Treasury + OFAC news  (~8 sources)
// group 3 (t=+6m)  â€” UK, EU, BIS, OCC, Fed, DoW official pages    (~12 sources)
// group 4 (t=+9m)  â€” China/regional/FinCEN/AP/BBC/CNN            (~26 sources)
// Default (no group) â€” all sources (used by GitHub Actions scheduled runs)
// Each group runs in its own CF Worker invocation, well under the 50-subrequest limit.
export async function fetchOfficialSources(
  section?: string,
  opts?: { group?: 1|2|3|4; groupPart?: 1|2|3|4 }
): Promise<OfficialSource[]> {
  const now = new Date().toISOString();
  const treasurySources = getTreasurySources(); // 6 entries, group 1
  const ofacDateNews = getOFACDateNewsRSS();     // 5 entries, group 1
  // Order: group-1 sources first so they survive the MAX_SOURCES cap in full-fetch mode
  const allSourcesUnfiltered = [...ofacDateNews, ...treasurySources, ...SOURCES];

  // Filter to section-relevant sources when a specific section is requested
  let allSources = section && section !== "all"
    ? allSourcesUnfiltered.filter(s => (s as any).sections?.includes(section))
    : allSourcesUnfiltered;

  // Group filter â€” apply AFTER section filter so counts are meaningful
  if (opts?.group !== undefined) {
    allSources = allSources.filter(s => (s as any).group === opts.group);
    if (opts.groupPart !== undefined) {
      allSources = allSources.filter((_, index) => index % 4 === opts.groupPart! - 1);
    }
    console.log(`[official] Group ${opts.group}: ${allSources.length} sources (section: ${section ?? "all"})`);
  }

  // Hard cap: CF Workers allows 50 subrequests per invocation.
  // Budget breakdown: N HTTP sources + ~3 Redis (library/save) + 2 ETag Redis (load/flush) = N+5.
  // Cap at 42 so 42+5=47 < 50. Phase groups (11/8/11/26) are all well under this cap.
  const MAX_SOURCES = 42;
  if (allSources.length > MAX_SOURCES) {
    console.warn(`[official] Source count ${allSources.length} exceeds safe budget of ${MAX_SOURCES} â€” truncating`);
    allSources = allSources.slice(0, MAX_SOURCES);
  }

  console.log(`[official] Section filter: ${section ?? "all"} â†’ ${allSources.length}/${allSourcesUnfiltered.length} sources`);
  checkSubrequestBudget(allSources);
  const MASTER_TIMEOUT = 8000;  // 8s â€” enough for gov sites; CF 30s wall-clock leaves room for LLM+save

  // Load ETag store once (1 Redis GET) â€” shared across all parallel fetches
  const etagStore = await loadETagStore();
  const itemCheckpoints = await loadSourceItemCheckpoints();
  let notModifiedCount = 0;
  let newestSeenCount = 0;

  const fetchOne = async (source: typeof allSources[0]) => {
    try {
      console.log(`[official] Fetching ${source.name}...`);
      const html = await fetchWithTimeout(
        source.url,
        (source as any).official ? 6000 : 4000,
        etagStore,
      );
      if (html === null) {
        // 304 Not Modified â€” server confirmed nothing changed
        notModifiedCount++;
        console.log(`[official] âš¡ ${source.name} â€” 304 unchanged`);
        return { name: source.name, url: source.url, content: "", fetchedAt: now, notModified: true };
      }
      const content = stripHTML(html);
      const itemLines = content.split("\n").map(line => line.trim()).filter(Boolean);
      const itemKeys = itemLines.map(itemCheckpointKey);
      const previous = itemCheckpoints[sourceCheckpointKey(source.url)];
      if (itemKeys.length > 0 && previous?.newest === itemKeys[0]) {
        newestSeenCount++;
        return { name: source.name, url: source.url, content: "", fetchedAt: now, notModified: true };
      }
      let boundedContent = content;
      if (previous?.recent?.length && itemKeys.length > 0) {
        const seen = new Set(previous.recent);
        const firstSeen = itemKeys.findIndex(key => seen.has(key));
        if (firstSeen >= 0) boundedContent = itemLines.slice(0, firstSeen + 3).join("\n");
      }
      console.log(`[official] âœ… ${source.name} â€” ${content.length} chars`);
      return { name: source.name, url: source.url, content: boundedContent, fetchedAt: now, checkpoint: itemKeys.length ? { url: source.url, itemKeys } : undefined };
    } catch (e) {
      console.warn(`[official] âŒ ${source.name} failed: ${e}`);
      return { name: source.name, url: source.url, content: "", fetchedAt: now, error: String(e) };
    }
  };

  // Fetch all in parallel but race against master timeout
  const fetchAll = Promise.allSettled(allSources.map(fetchOne));

  const timeoutPromise = new Promise<typeof results>((resolve) =>
    setTimeout(() => {
      console.warn("[official] Master timeout hit â€” returning partial results");
      resolve(allSources.map((s) => ({
        status: "fulfilled" as const,
        value: { name: s.name, url: s.url, content: "", fetchedAt: now, error: "timeout" }
      })));
    }, MASTER_TIMEOUT)
  );

  const results = await Promise.race([fetchAll, timeoutPromise]);

  // Flush updated ETag store (1 Redis SET) â€” fire-and-forget, non-blocking
  flushETagStore(etagStore).catch(() => {});
  console.log(`[official] Change summary: ${notModifiedCount} unchanged (304), ${newestSeenCount} newest-item matches, ${allSources.length - notModifiedCount - newestSeenCount} changed`);

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

// â”€â”€ Format sources for injection into LLM prompt â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function formatSourcesForPrompt(sources: OfficialSource[]): string {
  const successful = sources.filter(s => s.content.length > 100);
  if (successful.length === 0) return "";

  return `
OFFICIAL GOVERNMENT SOURCES â€” fetched directly right now:
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

