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
// Web search service for legal sources
