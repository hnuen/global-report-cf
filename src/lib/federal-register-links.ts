const FEDERAL_REGISTER_HOSTS = new Set(["federalregister.gov", "www.federalregister.gov"]);

export function federalRegisterDocumentNumber(value?: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.replace(/&amp;/gi, "&"));
    if (!FEDERAL_REGISTER_HOSTS.has(url.hostname.toLowerCase())) return null;
    const path = decodeURIComponent(url.pathname);
    const match = path.match(/\/documents\/(?:full_text\/html\/)?\d{4}\/\d{2}\/\d{2}\/([A-Za-z0-9-]+)(?:\.html|\/|$)/i)
      ?? path.match(/\/d\/([A-Za-z0-9-]+)(?:\/|$)/i);
    return match?.[1] ?? null;
  } catch { return null; }
}

export function isFederalRegisterUrl(value?: string): boolean {
  if (!value) return false;
  try { return FEDERAL_REGISTER_HOSTS.has(new URL(value.replace(/&amp;/gi, "&")).hostname.toLowerCase()); }
  catch { return false; }
}

export async function resolveFederalRegisterUrl(value: string, fetcher: typeof fetch = fetch): Promise<string | null> {
  const documentNumber = federalRegisterDocumentNumber(value);
  if (!documentNumber) return null;
  try {
    const response = await fetcher(`https://www.federalregister.gov/api/v1/documents/${encodeURIComponent(documentNumber)}.json`, {
      headers: { Accept: "application/json", "User-Agent": "GlobalReportBot/1.0" },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const data = await response.json() as { document_number?: unknown; html_url?: unknown };
    if (String(data.document_number ?? "").toLowerCase() !== documentNumber.toLowerCase()) return null;
    if (typeof data.html_url !== "string" || !federalRegisterDocumentNumber(data.html_url)) return null;
    return data.html_url.replace(/&amp;/gi, "&");
  } catch { return null; }
}
