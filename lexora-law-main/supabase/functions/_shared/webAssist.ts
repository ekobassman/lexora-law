/**
 * WEB ASSIST - Web search and URL fetching utilities
 * Uses SerpAPI for search with domain allowlist filtering
 */

import { normLang, SupportedLang } from "./lang.ts";

// Domain allowlist - only trusted official German government/institutional sources
export const ALLOWED_DOMAINS: string[] = [
  // Federal German government
  'bund.de',
  'service.bund.de',
  'bundesregierung.de',
  'bundestag.de',
  'gesetze-im-internet.de',
  
  // German federal agencies
  'arbeitsagentur.de',
  'jobcenter.digital',
  'zoll.de',
  'elster.de',
  'bzst.de',
  'bafin.de',
  'destatis.de',
  'bamf.de',
  'auswaertiges-amt.de',
  'bmas.de',
  'bmf.de',
  'bmj.de',
  'bmi.de',
  'bmbf.de',
  
  // German state governments (Länder)
  'bayern.de',
  'nrw.de',
  'hessen.de',
  'berlin.de',
  'hamburg.de',
  'niedersachsen.de',
  'sachsen.de',
  'baden-wuerttemberg.de',
  'schleswig-holstein.de',
  'rlp.de',
  'rheinland-pfalz.de',
  'brandenburg.de',
  'saarland.de',
  'thueringen.de',
  'sachsen-anhalt.de',
  'mv-regierung.de',
  'mecklenburg-vorpommern.de',
  'bremen.de',
  
  // German service portals
  'service-bw.de',
  'buergerservice.de',
  'einwohnermeldeamt.de',
  'standesamt.de',
  
  // Finanzamt domains (various patterns)
  'finanzamt.de',
  'finanzamt-online.de',
  'fa.de',
  
  // Social security / insurance
  'deutsche-rentenversicherung.de',
  'gkv-spitzenverband.de',
  'aok.de',
  'tk.de',
  'barmer.de',
  'dak.de',
  'ikk.de',
  'bkk.de',
  
  // Italian government (for IT users)
  'gov.it',
  'inps.it',
  'agenziaentrate.gov.it',
  'interno.gov.it',
  'esteri.it',
  'lavoro.gov.it',
  'giustizia.it',
  
  // Reference (with caution - not as sole source)
  'wikipedia.org',
  
  // EU institutions
  'europa.eu',
  'ec.europa.eu',
];

// Check if a URL's domain is in the allowlist
export function isDomainAllowed(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    
    return ALLOWED_DOMAINS.some(domain => {
      // Match exact domain or subdomain
      return hostname === domain || hostname.endsWith(`.${domain}`);
    });
  } catch {
    return false;
  }
}

// Filter search results to only allowed domains
export function filterAllowedResults(results: SearchResult[]): SearchResult[] {
  return results.filter(r => isDomainAllowed(r.url));
}

export interface SearchResult {
  title: string;
  snippet: string;
  url: string;
  position?: number;
}

export interface WebSearchResponse {
  ok: boolean;
  results: SearchResult[];
  error?: string;
  filtered_count?: number;
  original_count?: number;
}

/**
 * Perform a web search using SerpAPI
 * Results are automatically filtered to allowed domains
 */
export async function webSearch(query: string, maxResults: number = 5): Promise<WebSearchResponse> {
  const apiKey = Deno.env.get('SERPAPI_API_KEY');
  
  if (!apiKey) {
    console.error('[webAssist] SERPAPI_API_KEY not configured');
    return { ok: false, results: [], error: 'SEARCH_NOT_CONFIGURED' };
  }

  if (!query || query.trim().length < 3) {
    return { ok: false, results: [], error: 'QUERY_TOO_SHORT' };
  }

  try {
    const searchQuery = encodeURIComponent(query.trim());
    
    const url = `https://serpapi.com/search.json?q=${searchQuery}&api_key=${apiKey}&num=20&gl=de&hl=de`;
    
    console.log(`[webAssist] Searching: "${query.slice(0, 50)}..."`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[webAssist] SerpAPI error: ${response.status}`, errorText);
      return { ok: false, results: [], error: `SEARCH_ERROR_${response.status}` };
    }

    const data = await response.json();
    
    // Extract organic results
    const organicResults: SearchResult[] = (data.organic_results || []).map((r: any, i: number) => ({
      title: r.title || '',
      snippet: r.snippet || '',
      url: r.link || '',
      position: i + 1,
    }));

    // Filter to allowed domains only
    const filteredResults = filterAllowedResults(organicResults);
    
    // Limit to requested max
    const finalResults = filteredResults.slice(0, maxResults);
    
    console.log(`[webAssist] Found ${organicResults.length} results, ${filteredResults.length} from allowed domains, returning ${finalResults.length}`);
    
    return {
      ok: true,
      results: finalResults,
      original_count: organicResults.length,
      filtered_count: filteredResults.length,
    };
  } catch (error) {
    console.error('[webAssist] Search error:', error);
    return { ok: false, results: [], error: 'SEARCH_EXCEPTION' };
  }
}

export interface FetchUrlResponse {
  ok: boolean;
  content?: string;
  title?: string;
  url: string;
  error?: string;
}

/**
 * Fetch content from a URL (only if in allowlist)
 * Returns cleaned text content
 */
export async function fetchUrl(url: string, maxBytes: number = 500000): Promise<FetchUrlResponse> {
  if (!url) {
    return { ok: false, url: '', error: 'NO_URL' };
  }

  if (!isDomainAllowed(url)) {
    console.log(`[webAssist] URL not in allowlist: ${url}`);
    return { ok: false, url, error: 'DOMAIN_NOT_ALLOWED' };
  }

  try {
    console.log(`[webAssist] Fetching: ${url.slice(0, 100)}...`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Lexora-WebAssist/1.0 (Legal Assistant)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
      },
    });

    if (!response.ok) {
      return { ok: false, url, error: `FETCH_ERROR_${response.status}` };
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
      return { ok: false, url, error: 'UNSUPPORTED_CONTENT_TYPE' };
    }

    const text = await response.text();
    
    // Limit size
    const limitedText = text.slice(0, maxBytes);
    
    // Extract title
    const titleMatch = limitedText.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : undefined;
    
    // Clean HTML to text
    const cleanedContent = cleanHtmlToText(limitedText);
    
    console.log(`[webAssist] Fetched ${cleanedContent.length} chars from ${url}`);
    
    return {
      ok: true,
      content: cleanedContent.slice(0, 50000), // Limit final content
      title,
      url,
    };
  } catch (error) {
    console.error(`[webAssist] Fetch error for ${url}:`, error);
    return { ok: false, url, error: 'FETCH_EXCEPTION' };
  }
}

/**
 * Clean HTML to plain text
 */
function cleanHtmlToText(html: string): string {
  let text = html;

  text = text.replace(/<script[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<noscript[\s\S]*?<\/noscript>/gi, "");
  text = text.replace(/<!--[\s\S]*?-->/g, "");

  text = text.replace(/<nav[\s\S]*?<\/nav>/gi, "");
  text = text.replace(/<header[\s\S]*?<\/header>/gi, "");
  text = text.replace(/<footer[\s\S]*?<\/footer>/gi, "");

  text = text.replace(/<\/?(div|p|br|hr|h[1-6]|li|tr|td|th|table|ul|ol)[^>]*>/gi, "\n");
  text = text.replace(/<[^>]+>/g, "");

  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  text = text.replace(/[ \t]+/g, " ");
  text = text.replace(/\n\s*\n/g, "\n\n");
  text = text.replace(/\n{3,}/g, "\n\n");
  return text.trim();
}

const SOURCE_HEADERS: Record<SupportedLang, string> = {
  IT: "📚 **Fonti:**",
  DE: "📚 **Quellen:**",
  EN: "📚 **Sources:**",
  FR: "📚 **Sources:**",
  ES: "📚 **Fuentes:**",
  TR: "📚 **Kaynaklar:**",
  RO: "📚 **Surse:**",
  PL: "📚 **Źródła:**",
  AR: "📚 **المصادر:**",
  RU: "📚 **Источники:**",
  UK: "📚 **Джерела:**",
};

/**
 * Format search results as a "Fonti" section for the AI response
 */
export function formatSourcesSection(results: SearchResult[], language?: string): string {
  if (!results || results.length === 0) return "";
  const lang = normLang(language);
  const header = SOURCE_HEADERS[lang] || SOURCE_HEADERS.EN;
  const sourcesList = results.slice(0, 5).map((r, i) => `${i + 1}. [${r.title}](${r.url})`).join("\n");
  return `\n\n${header}\n${sourcesList}`;
}
