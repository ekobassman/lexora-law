/**
 * INTELLIGENT SEARCH - Auto-search with query expansion and confidence scoring
 * Used by all chat edge functions (Demo, Dashboard, Edit)
 */

import { webSearch, SearchResult, formatSourcesSection } from "./webAssist.ts";
import { SupportedLang, normLang } from "./lang.ts";

export interface IntelligentSearchResult {
  found: boolean;
  confidence: number; // 0.0 - 1.0
  results: SearchResult[];
  bestResult?: SearchResult;
  proposedAnswer?: string;
  sourcesSection?: string;
  needsUserInput: boolean;
  userQuestion?: string;
}

// Query expansion patterns for different entity types
const QUERY_EXPANSIONS: Record<string, string[]> = {
  office_address: [
    "{query} Adresse Kontakt",
    "{query} Anschrift Öffnungszeiten",
    "{query} zuständig für",
    "{query} competente per",
    "{query} contact address",
  ],
  procedure: [
    "{query} Antrag Formular",
    "{query} procedura modulo",
    "{query} application form",
    "{query} Ablauf Verfahren",
  ],
  deadline: [
    "{query} Frist Termin",
    "{query} scadenza termine",
    "{query} deadline",
  ],
};

// Detect what type of information is being requested
function detectQueryType(query: string): string {
  const lower = query.toLowerCase();
  
  if (/\b(indirizzo|adresse|address|anschrift|kontakt|contatto|contact)\b/.test(lower)) {
    return 'office_address';
  }
  if (/\b(procedura|verfahren|procedure|antrag|domanda|application|modulo|formular|form)\b/.test(lower)) {
    return 'procedure';
  }
  if (/\b(scadenza|frist|deadline|termine|termin)\b/.test(lower)) {
    return 'deadline';
  }
  return 'office_address'; // default
}

// Calculate confidence based on result quality
function calculateConfidence(results: SearchResult[], originalQuery: string): number {
  if (!results || results.length === 0) return 0;
  
  const queryTerms = originalQuery.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  let totalScore = 0;
  
  for (const result of results.slice(0, 3)) {
    const textToCheck = `${result.title} ${result.snippet}`.toLowerCase();
    
    // Count matching query terms
    let matchCount = 0;
    for (const term of queryTerms) {
      if (textToCheck.includes(term)) matchCount++;
    }
    const termMatch = queryTerms.length > 0 ? matchCount / queryTerms.length : 0;
    
    // Check for address indicators
    const hasAddress = /\b(\d{5}|\d{4,5}\s+\w+|straße|str\.|via|platz|weg)\b/i.test(textToCheck);
    
    // Check for official domain indicators
    const isOfficial = /\.(gov|bund|de|it)\b/.test(result.url);
    
    // Position bonus (higher ranked = more relevant)
    const positionBonus = result.position ? Math.max(0, (10 - result.position) / 10) : 0.5;
    
    const resultScore = (termMatch * 0.4) + (hasAddress ? 0.2 : 0) + (isOfficial ? 0.2 : 0) + (positionBonus * 0.2);
    totalScore += resultScore;
  }
  
  // Average score across top results, capped at 1.0
  return Math.min(1.0, totalScore / Math.min(results.length, 3));
}

// Extract address from search results
function extractAddressFromResults(results: SearchResult[]): string | undefined {
  for (const result of results) {
    const text = `${result.title} ${result.snippet}`;
    
    // Try to extract German-style addresses (PLZ + Stadt)
    const germanMatch = text.match(/(\d{5})\s+([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)?)/);
    if (germanMatch) {
      // Look for street before PLZ
      const streetMatch = text.match(/([A-ZÄÖÜ][a-zäöüß]+(?:straße|str\.|weg|platz|allee)[\s\d-]*)/i);
      if (streetMatch) {
        return `${streetMatch[1]}, ${germanMatch[1]} ${germanMatch[2]}`;
      }
      return `${germanMatch[1]} ${germanMatch[2]}`;
    }
    
    // Try Italian-style addresses
    const italianMatch = text.match(/(Via|Piazza|Corso|Viale)\s+[A-Z][a-zàèéìòù\s]+[\d,\s]+(\d{5})\s+([A-Z][a-zàèéìòù]+)/i);
    if (italianMatch) {
      return `${italianMatch[1]} - ${italianMatch[2]} ${italianMatch[3]}`;
    }
  }
  return undefined;
}

// User question templates per language
const USER_QUESTIONS: Record<SupportedLang, string> = {
  IT: "Non ho trovato informazioni affidabili. Puoi indicarmi l'indirizzo o l'ente esatto?",
  DE: "Ich konnte keine zuverlässigen Informationen finden. Können Sie mir die genaue Adresse oder Behörde nennen?",
  EN: "I couldn't find reliable information. Could you provide the exact address or office?",
  FR: "Je n'ai pas trouvé d'informations fiables. Pouvez-vous me donner l'adresse ou le bureau exact?",
  ES: "No encontré información confiable. ¿Puedes indicarme la dirección o la oficina exacta?",
  TR: "Güvenilir bilgi bulamadım. Doğru adresi veya daireyi belirtebilir misiniz?",
  RO: "Nu am găsit informații de încredere. Puteți indica adresa sau biroul exact?",
  PL: "Nie znalazłem wiarygodnych informacji. Czy możesz podać dokładny adres lub urząd?",
  AR: "لم أجد معلومات موثوقة. هل يمكنك تزويدي بالعنوان أو المكتب الدقيق؟",
  RU: "Я не нашёл достоверной информации. Можете указать точный адрес или учреждение?",
  UK: "Я не знайшов достовірної інформації. Чи можете ви вказати точну адресу або установу?",
};

// Proposal templates per language
const PROPOSAL_TEMPLATES: Record<SupportedLang, string> = {
  IT: "Ho trovato questa informazione:\n\n**{info}**\n\nFonte: {source}\n\nÈ corretta? Posso usarla nel documento?",
  DE: "Ich habe folgende Information gefunden:\n\n**{info}**\n\nQuelle: {source}\n\nIst das korrekt? Kann ich das im Dokument verwenden?",
  EN: "I found this information:\n\n**{info}**\n\nSource: {source}\n\nIs this correct? Can I use it in the document?",
  FR: "J'ai trouvé cette information:\n\n**{info}**\n\nSource: {source}\n\nEst-ce correct? Puis-je l'utiliser dans le document?",
  ES: "Encontré esta información:\n\n**{info}**\n\nFuente: {source}\n\n¿Es correcta? ¿Puedo usarla en el documento?",
  TR: "Bu bilgiyi buldum:\n\n**{info}**\n\nKaynak: {source}\n\nDoğru mu? Belgede kullanabilir miyim?",
  RO: "Am găsit această informație:\n\n**{info}**\n\nSursă: {source}\n\nEste corect? Pot să o folosesc în document?",
  PL: "Znalazłem tę informację:\n\n**{info}**\n\nŹródło: {source}\n\nCzy to prawidłowe? Mogę użyć w dokumencie?",
  AR: "وجدت هذه المعلومات:\n\n**{info}**\n\nالمصدر: {source}\n\nهل هذا صحيح؟ هل يمكنني استخدامه في المستند؟",
  RU: "Я нашёл эту информацию:\n\n**{info}**\n\nИсточник: {source}\n\nЭто верно? Могу использовать в документе?",
  UK: "Я знайшов цю інформацію:\n\n**{info}**\n\nДжерело: {source}\n\nЦе правильно? Можу використати в документі?",
};

/**
 * Perform intelligent search with query expansion and confidence scoring
 */
export async function intelligentSearch(
  query: string,
  language: string = "EN"
): Promise<IntelligentSearchResult> {
  const lang = normLang(language);
  const queryType = detectQueryType(query);
  const expansions = QUERY_EXPANSIONS[queryType] || QUERY_EXPANSIONS.office_address;
  
  console.log(`[intelligentSearch] Query: "${query.slice(0, 50)}...", Type: ${queryType}, Lang: ${lang}`);
  
  // Collect all results from expanded queries
  const allResults: SearchResult[] = [];
  const seenUrls = new Set<string>();
  
  // First, try original query
  const originalResult = await webSearch(query, 5);
  if (originalResult.ok) {
    for (const r of originalResult.results) {
      if (!seenUrls.has(r.url)) {
        seenUrls.add(r.url);
        allResults.push(r);
      }
    }
  }
  
  // If not enough results, try expansions
  if (allResults.length < 3) {
    for (const expansion of expansions.slice(0, 2)) {
      const expandedQuery = expansion.replace('{query}', query);
      const expandedResult = await webSearch(expandedQuery, 3);
      if (expandedResult.ok) {
        for (const r of expandedResult.results) {
          if (!seenUrls.has(r.url)) {
            seenUrls.add(r.url);
            allResults.push(r);
          }
        }
      }
      if (allResults.length >= 5) break;
    }
  }
  
  // Calculate confidence
  const confidence = calculateConfidence(allResults, query);
  
  console.log(`[intelligentSearch] Results: ${allResults.length}, Confidence: ${confidence.toFixed(2)}`);
  
  // Threshold: 0.85 confidence required
  const CONFIDENCE_THRESHOLD = 0.85;
  
  if (confidence >= CONFIDENCE_THRESHOLD && allResults.length > 0) {
    const bestResult = allResults[0];
    const extractedAddress = extractAddressFromResults(allResults);
    
    const proposalTemplate = PROPOSAL_TEMPLATES[lang] || PROPOSAL_TEMPLATES.EN;
    const proposedAnswer = proposalTemplate
      .replace('{info}', extractedAddress || bestResult.snippet.slice(0, 200))
      .replace('{source}', bestResult.url);
    
    return {
      found: true,
      confidence,
      results: allResults,
      bestResult,
      proposedAnswer,
      sourcesSection: formatSourcesSection(allResults.slice(0, 3), language),
      needsUserInput: true, // Always need confirmation for documents
    };
  }
  
  // Low confidence - need user input
  return {
    found: false,
    confidence,
    results: allResults,
    needsUserInput: true,
    userQuestion: USER_QUESTIONS[lang] || USER_QUESTIONS.EN,
  };
}

/**
 * Detect if user wants AI to search for something
 */
export function detectSearchIntent(message: string): boolean {
  const lower = message.toLowerCase();
  
  // Explicit "find it yourself" patterns
  const findItPatterns = [
    /\b(trovalo|cercalo|find\s+it|such\s+es|cherche|busca)\s+(tu|yourself|selbst|toi|tú)\b/i,
    /\b(cerca|suchen?|find|cherche|busca)\s+(l'indirizzo|die\s+adresse|the\s+address|l'adresse|la\s+direcci[óo]n)\b/i,
    /\b(non\s+lo\s+so|ich\s+wei[ßs]\s+nicht|i\s+don'?t\s+know|je\s+ne\s+sais\s+pas|no\s+lo\s+s[eé])\b/i,
  ];
  
  for (const pattern of findItPatterns) {
    if (pattern.test(lower)) return true;
  }
  
  return false;
}

/**
 * Detect if user is asking for external information
 */
export function detectInfoRequest(message: string): boolean {
  const patterns = [
    /\b(indirizzo|adresse|address|anschrift)\b/i,
    /\b(orario|orari|öffnungszeit|opening\s+hours|horaire)\b/i,
    /\b(telefono|telefon|phone|téléphone|teléfono)\b/i,
    /\b(email|e-mail|kontakt|contatto|contact)\b/i,
    /\b(dove\s+si\s+trova|wo\s+ist|where\s+is|où\s+est|dónde\s+está)\b/i,
    /\b(qual\s+è|welche|which\s+is|quelle\s+est|cuál\s+es)\s+(l'ufficio|das\s+amt|the\s+office|le\s+bureau|la\s+oficina)\b/i,
  ];
  
  for (const pattern of patterns) {
    if (pattern.test(message)) return true;
  }
  
  return false;
}
