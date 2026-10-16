const DEFAULT_LIMIT = 40;
const BROKEN_STATUSES = new Set([404, 410]);
// External publisher links rot normally (articles get pulled, slugs change), so a
// single dead third-party URL among ~40 live links is churn, not an app regression.
// We only fail the health check when HTTP breakage is SYSTEMIC (many links dead at
// once -> the feed or deploy is genuinely broken). Policy violations are different:
// those are links the app itself served in a bad shape (aggregator / listing / feed /
// truncated / malformed), fully within our control, so any of those still fails.
const HTTP_BROKEN_FLOOR = 2;      // tolerate up to this many isolated dead links
const HTTP_BROKEN_FRACTION = 0.1; // ...or 10% of what we checked, whichever is larger

export function linkPolicyError(value) {
  if (!value || value === "#") return "missing URL";
  let url;
  try { url = new URL(value); } catch { return "invalid URL"; }
  if (!/^https?:$/.test(url.protocol)) return "unsupported URL protocol";
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const path = url.pathname.replace(/\/+$/, "");
  const key = `${host}${path}`.toLowerCase();
  if (host === "news.google.com") return "aggregator URL";
  if (host === "aljazeera.com" && path.split("/").filter(Boolean).length < 3) return "truncated publisher URL";
  if (/\/(?:rss|feed|feeds|search)(?:\/|$)/i.test(path) || path.endsWith(".xml")) return "feed or search URL";
  if (new Set([
    "home.treasury.gov/news/press-releases",
    "ofac.treasury.gov/recent-actions",
    "ofac.treasury.gov/civil-penalties-and-enforcement-information",
    "fincen.gov/news/news-releases",
    "gov.uk/government/publications/the-uk-sanctions-list",
    "federalreserve.gov/supervisionreg/enforcement-actions-about.htm",
  ]).has(key)) return "generic listing URL";
  if (host === "federalregister.gov") {
    const match = path.match(/\/documents\/\d{4}\/\d{2}\/\d{2}\/([^/]+)/i) ?? path.match(/\/d\/([^/]+)/i);
    if (!match || !/^(?:[A-Z]\d-)?\d{4}-\d{4,6}$/i.test(match[1])) return "invalid Federal Register document URL";
  }
  return null;
}

async function probe(url, fetcher = fetch) {
  const options = { redirect: "follow", signal: AbortSignal.timeout(10000), headers: { "User-Agent": "GlobalReportLinkHealth/1.0" } };
  let response;
  try { response = await fetcher(url, { ...options, method: "HEAD" }); }
  catch (error) { return { state: "warning", detail: String(error) }; }
  if ([403, 405, 429].includes(response.status)) {
    try { response = await fetcher(url, { ...options, method: "GET", headers: { ...options.headers, Range: "bytes=0-0" } }); }
    catch (error) { return { state: "warning", detail: String(error) }; }
  }
  if (BROKEN_STATUSES.has(response.status)) return { state: "broken", detail: `HTTP ${response.status}` };
  if (response.status >= 500 || response.status === 429) return { state: "warning", detail: `HTTP ${response.status}` };
  return { state: "ok", detail: `HTTP ${response.status}` };
}

export async function checkArticles(articles, limit = DEFAULT_LIMIT, fetcher = fetch) {
  const selected = articles.filter(article => article?.sourceUrl).slice(0, limit);
  const results = [];
  for (const article of selected) {
    const policy = linkPolicyError(article.sourceUrl);
    // kind distinguishes data-quality defects (policy) from external link-rot (http),
    // which are treated differently when deciding whether to fail the run.
    if (policy) results.push({ state: "broken", kind: "policy", detail: policy, headline: article.headline, url: article.sourceUrl });
    else results.push({ ...(await probe(article.sourceUrl, fetcher)), kind: "http", headline: article.headline, url: article.sourceUrl });
  }
  return results;
}

async function main() {
  const appUrl = String(process.env.APP_URL ?? "").replace(/\/$/, "");
  if (!appUrl) throw new Error("APP_URL is required");
  const response = await fetch(`${appUrl}/api/news`, { signal: AbortSignal.timeout(20000), headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`News endpoint returned HTTP ${response.status}`);
  const payload = await response.json();
  if (!Array.isArray(payload?.articles)) throw new Error("News endpoint returned no article list");
  const results = await checkArticles(payload.articles, Number(process.env.LINK_CHECK_LIMIT ?? DEFAULT_LIMIT));
  const broken = results.filter(result => result.state === "broken");
  const warnings = results.filter(result => result.state === "warning");
  const policyBroken = broken.filter(result => result.kind === "policy");
  const httpBroken = broken.filter(result => result.kind === "http");

  // Systemic threshold: isolated external 404/410s are tolerated; many at once are not.
  const httpTolerance = Math.max(HTTP_BROKEN_FLOOR, Math.ceil(results.length * HTTP_BROKEN_FRACTION));
  const httpSystemic = httpBroken.length > httpTolerance;
  const fail = policyBroken.length > 0 || httpSystemic;

  console.log(JSON.stringify({
    checked: results.length,
    policyBroken,
    httpBroken,
    warnings,
    httpTolerance,
    fail,
  }, null, 2));

  if (process.env.GITHUB_STEP_SUMMARY) {
    const fs = await import("node:fs/promises");
    const rows = broken.map(item => `| ${item.kind === "policy" ? "policy" : "dead link"} | ${item.detail} | ${item.headline ?? "(untitled)"} | ${item.url} |`).join("\n") || "| — | None | — | — |";
    const verdict = fail
      ? (policyBroken.length
          ? `**FAIL** — ${policyBroken.length} policy violation(s): the app served ${policyBroken.length === 1 ? "a link" : "links"} in a disallowed shape.`
          : `**FAIL** — ${httpBroken.length} dead links exceeds the systemic threshold of ${httpTolerance}.`)
      : `**PASS** — ${httpBroken.length} isolated dead link(s) within tolerance (${httpTolerance}); ${warnings.length} transient warning(s).`;
    await fs.appendFile(
      process.env.GITHUB_STEP_SUMMARY,
      `## Deployed article-link health\n\n${verdict}\n\nChecked ${results.length} recent links; ${policyBroken.length} policy violation(s), ${httpBroken.length} dead link(s), ${warnings.length} transient warning(s).\n\n| Type | Detail | Article | URL |\n|---|---|---|---|\n${rows}\n`
    );
  }

  if (fail) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch(error => { console.error(error); process.exitCode = 1; });
