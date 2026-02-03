/**
 * Web search service for updated legal information.
 * Uses SerpAPI (Google Search API) - requires VITE_SERP_API_KEY in .env
 *
 * Use when:
 * - User asks for recent regulations (e.g. "Qual è la legge 2024 su...")
 * - AI detects it lacks post-2024 information
 * - Recent case law, ministerial circulars, or updated practice is needed
 */

export interface LegalSearchResult {
  title: string;
  snippet: string;
  link: string;
  date?: string;
}

const LEGAL_SITE_PATTERNS: Record<string, string> = {
  it: 'site:gazzettaufficiale.it OR site:normattiva.it OR site:gov.it OR site:giustizia.it OR site:agenziaentrate.gov.it OR site:lavoro.gov.it OR site:eur-lex.europa.eu',
  de: 'site:gesetze-im-internet.de OR site:bundesregierung.de OR site:bmj.de OR site:eur-lex.europa.eu',
  en: 'site:gov.uk OR site:legislation.gov.uk OR site:eur-lex.europa.eu',
  fr: 'site:legifrance.gouv.fr OR site:service-public.fr OR site:eur-lex.europa.eu',
  es: 'site:boe.es OR site:noticias.juridicas.com OR site:eur-lex.europa.eu',
};

function getSiteRestriction(country: string): string {
  const code = country.toLowerCase().slice(0, 2);
  return LEGAL_SITE_PATTERNS[code] || LEGAL_SITE_PATTERNS.it;
}

/**
 * Search for legal/official information on authoritative sites.
 * @param query User query or AI-generated search query
 * @param country Country code (it, de, en, fr, es...) for site targeting
 * @param num Max results (default 5)
 */
export async function searchLegalInfo(
  query: string,
  country: string = 'it',
  num: number = 5
): Promise<LegalSearchResult[]> {
  const apiKey = import.meta.env.VITE_SERP_API_KEY;
  if (!apiKey || typeof apiKey !== 'string') {
    console.warn('[webSearch] VITE_SERP_API_KEY not set - web search disabled');
    return [];
  }

  const siteRestriction = getSiteRestriction(country);
  const searchQuery = `${query} (${siteRestriction})`.trim();

  try {
    const params = new URLSearchParams({
      q: searchQuery,
      api_key: apiKey,
      num: String(Math.min(num, 10)),
    });
    const response = await fetch(`https://serpapi.com/search?${params.toString()}`);
    const data = (await response.json()) as {
      organic_results?: Array<{
        title?: string;
        snippet?: string;
        link?: string;
        date?: string;
      }>;
    };

    const results = data.organic_results ?? [];
    return results.slice(0, num).map((r) => ({
      title: r.title ?? '',
      snippet: r.snippet ?? '',
      link: r.link ?? '',
      date: r.date,
    }));
  } catch (error) {
    console.error('[webSearch] Error:', error);
    return [];
  }
}

/** Patterns that trigger automatic legal web search (case-insensitive) */
const LEGAL_SEARCH_PATTERNS: RegExp[] = [
  /\b(20[0-9]{2})\b/, // any year 2000-2099
  /\b(legge|decreto|normativa|sentenza|circolare|prassi)\s+(recente|aggiornata|nuova|ultima|in vigore)\b/i,
  /\b(art\.|articolo)\s*\d+.*(codice|legge)\b/i,
  /\b(giurisprudenza|cassazione|tribunale|corte)\s+(recente|nuova|ultima)\b/i,
  /\b(law|regulation|decree|recent|updated|202[0-9])\b/i,
  /\b(gesetz|verordnung|urteil|rechtsprechung)\s+(aktuell|neu|letzte)\b/i,
];

/**
 * Returns true if the message should trigger a legal web search before calling the AI.
 */
export function shouldSearchLegalInfo(message: string): boolean {
  if (!message || message.trim().length < 10) return false;
  const m = message.trim();
  return LEGAL_SEARCH_PATTERNS.some((p) => p.test(m));
}

/**
 * Build a short query for legal search (first ~100 chars, cleaned).
 */
export function buildLegalSearchQuery(message: string, maxLen: number = 100): string {
  return message.trim().replace(/\s+/g, ' ').slice(0, maxLen);
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, { results: LegalSearchResult[]; ts: number }>();

function cacheKey(query: string, country: string): string {
  return `${country}:${query.slice(0, 80)}`;
}

function getCached(query: string, country: string): LegalSearchResult[] | null {
  const key = cacheKey(query, country);
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.results;
}

function setCached(query: string, country: string, results: LegalSearchResult[]): void {
  cache.set(cacheKey(query, country), { results, ts: Date.now() });
}

/**
 * Search with 3s timeout and 5min cache. Returns [] on timeout/error (fallback silent).
 */
export async function searchLegalInfoWithTimeout(
  query: string,
  country: string = 'it',
  num: number = 3,
  timeoutMs: number = 3000
): Promise<LegalSearchResult[]> {
  const q = buildLegalSearchQuery(query);
  if (!q) return [];
  const cached = getCached(q, country);
  if (cached) return cached;
  try {
    const timeoutPromise = new Promise<LegalSearchResult[]>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), timeoutMs)
    );
    const results = await Promise.race([
      searchLegalInfo(q, country, num),
      timeoutPromise,
    ]);
    if (results.length > 0) setCached(q, country, results);
    return results;
  } catch {
    return [];
  }
}
