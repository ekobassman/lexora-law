/**
 * DOCUMENT GATE - Confirmation requirement before generating final documents
 * Used by all chat edge functions (Demo, Dashboard, Edit)
 */

import { SupportedLang, normLang } from "./lang.ts";

// Confirmation keywords that user must use to approve document generation
// CASE-INSENSITIVE check - all keywords stored in lowercase
const CONFIRMATION_KEYWORDS = [
  // Italian
  'confermo', 'conferma', 'sì procedi', 'si procedi', 'vai avanti', 'genera', 'crea il documento', 'procedi',
  // German
  'bestätigen', 'bestätige', 'ja weiter', 'erstellen', 'dokument erstellen', 'weiter', 'mach weiter',
  // English
  'confirm', 'confirmed', 'yes proceed', 'go ahead', 'generate', 'create the document', 'proceed', 'yes please', 'please proceed',
  // French
  'confirmer', 'confirme', 'oui continuer', 'créer le document', 'continuer',
  // Spanish
  'confirmo', 'confirmar', 'sí continuar', 'crear el documento', 'continuar',
  // Other languages - basic patterns
  'ok', 'okay', 'yes', 'ja', 'oui', 'sí', 'si', 'да', 'tak', 'evet', 'da', 'sim',
];

// Detect if user has confirmed document generation
// CASE-INSENSITIVE: Accepts "Confirm", "CONFIRM", "confirm", etc.
export function hasUserConfirmed(message: string): boolean {
  const lower = message.toLowerCase().trim();
  
  // Check for explicit confirmation keywords (case-insensitive)
  for (const keyword of CONFIRMATION_KEYWORDS) {
    if (lower.includes(keyword)) return true;
  }
  
  // Check for short affirmative responses (very flexible)
  // Accept single words or short phrases that indicate "yes"
  if (/^(ok|okay|yes|ja|oui|sì|si|да|tak|sim|evet|da|y|yep|yup|sure|alright|fine|agreed|perfetto|perfect|gut|bien|bene|genau|esatto|exactly|d'accordo|einverstanden)[\s.,!?]*$/i.test(lower)) {
    return true;
  }
  
  return false;
}

// Summary block templates per language
const SUMMARY_HEADERS: Record<SupportedLang, string> = {
  IT: "📋 **RIEPILOGO DATI PER IL DOCUMENTO:**",
  DE: "📋 **ZUSAMMENFASSUNG DER DOKUMENTDATEN:**",
  EN: "📋 **DOCUMENT DATA SUMMARY:**",
  FR: "📋 **RÉSUMÉ DES DONNÉES DU DOCUMENT:**",
  ES: "📋 **RESUMEN DE DATOS DEL DOCUMENTO:**",
  TR: "📋 **BELGE VERİLERİ ÖZETİ:**",
  RO: "📋 **REZUMATUL DATELOR DOCUMENTULUI:**",
  PL: "📋 **PODSUMOWANIE DANYCH DOKUMENTU:**",
  AR: "📋 **ملخص بيانات المستند:**",
  RU: "📋 **СВОДКА ДАННЫХ ДОКУМЕНТА:**",
  UK: "📋 **ПІДСУМОК ДАНИХ ДОКУМЕНТА:**",
};

const CONFIRMATION_PROMPTS: Record<SupportedLang, string> = {
  IT: "\n\n✅ **Per generare il documento, rispondi con \"CONFERMO\" o \"OK\".**",
  DE: "\n\n✅ **Um das Dokument zu erstellen, antworte mit \"BESTÄTIGEN\" oder \"OK\".**",
  EN: "\n\n✅ **To generate the document, reply with \"CONFIRM\" or \"OK\".**",
  FR: "\n\n✅ **Pour générer le document, répondez avec \"CONFIRMER\" ou \"OK\".**",
  ES: "\n\n✅ **Para generar el documento, responde con \"CONFIRMO\" o \"OK\".**",
  TR: "\n\n✅ **Belgeyi oluşturmak için \"ONAYLIYORUM\" veya \"OK\" yazın.**",
  RO: "\n\n✅ **Pentru a genera documentul, răspunde cu \"CONFIRM\" sau \"OK\".**",
  PL: "\n\n✅ **Aby wygenerować dokument, odpowiedz \"POTWIERDZAM\" lub \"OK\".**",
  AR: "\n\n✅ **لإنشاء المستند، أجب بـ \"أؤكد\" أو \"OK\".**",
  RU: "\n\n✅ **Чтобы создать документ, ответьте \"ПОДТВЕРЖДАЮ\" или \"OK\".**",
  UK: "\n\n✅ **Щоб створити документ, відповідайте \"ПІДТВЕРДЖУЮ\" або \"OK\".**",
};

export interface DocumentData {
  senderName?: string;
  senderAddress?: string;
  recipientName?: string;
  recipientAddress?: string;
  subject?: string;
  date?: string;
  reference?: string;
  mainContent?: string;
}

/**
 * Build a summary block for document data requiring confirmation
 */
export function buildSummaryBlock(data: DocumentData, language: string): string {
  const lang = normLang(language);
  const header = SUMMARY_HEADERS[lang] || SUMMARY_HEADERS.EN;
  const confirmPrompt = CONFIRMATION_PROMPTS[lang] || CONFIRMATION_PROMPTS.EN;
  
  const lines: string[] = [header, ""];
  
  if (data.senderName) {
    lines.push(`**${getLabel('sender', lang)}:** ${data.senderName}`);
  }
  if (data.senderAddress) {
    lines.push(`**${getLabel('address', lang)}:** ${data.senderAddress}`);
  }
  if (data.recipientName) {
    lines.push(`**${getLabel('recipient', lang)}:** ${data.recipientName}`);
  }
  if (data.recipientAddress) {
    lines.push(`**${getLabel('recipientAddress', lang)}:** ${data.recipientAddress}`);
  }
  if (data.subject) {
    lines.push(`**${getLabel('subject', lang)}:** ${data.subject}`);
  }
  if (data.date) {
    lines.push(`**${getLabel('date', lang)}:** ${data.date}`);
  }
  if (data.reference) {
    lines.push(`**${getLabel('reference', lang)}:** ${data.reference}`);
  }
  if (data.mainContent) {
    lines.push(`**${getLabel('content', lang)}:** ${data.mainContent.slice(0, 100)}...`);
  }
  
  lines.push(confirmPrompt);
  
  return lines.join("\n");
}

// Label translations
function getLabel(key: string, lang: SupportedLang): string {
  const labels: Record<string, Record<SupportedLang, string>> = {
    sender: {
      IT: "Mittente", DE: "Absender", EN: "Sender", FR: "Expéditeur", ES: "Remitente",
      TR: "Gönderen", RO: "Expeditor", PL: "Nadawca", AR: "المرسل", RU: "Отправитель", UK: "Відправник"
    },
    address: {
      IT: "Indirizzo", DE: "Adresse", EN: "Address", FR: "Adresse", ES: "Dirección",
      TR: "Adres", RO: "Adresă", PL: "Adres", AR: "العنوان", RU: "Адрес", UK: "Адреса"
    },
    recipient: {
      IT: "Destinatario", DE: "Empfänger", EN: "Recipient", FR: "Destinataire", ES: "Destinatario",
      TR: "Alıcı", RO: "Destinatar", PL: "Odbiorca", AR: "المستلم", RU: "Получатель", UK: "Одержувач"
    },
    recipientAddress: {
      IT: "Indirizzo destinatario", DE: "Empfängeradresse", EN: "Recipient address", FR: "Adresse du destinataire", ES: "Dirección del destinatario",
      TR: "Alıcı adresi", RO: "Adresa destinatarului", PL: "Adres odbiorcy", AR: "عنوان المستلم", RU: "Адрес получателя", UK: "Адреса одержувача"
    },
    subject: {
      IT: "Oggetto", DE: "Betreff", EN: "Subject", FR: "Objet", ES: "Asunto",
      TR: "Konu", RO: "Subiect", PL: "Temat", AR: "الموضوع", RU: "Тема", UK: "Тема"
    },
    date: {
      IT: "Data", DE: "Datum", EN: "Date", FR: "Date", ES: "Fecha",
      TR: "Tarih", RO: "Data", PL: "Data", AR: "التاريخ", RU: "Дата", UK: "Дата"
    },
    reference: {
      IT: "Riferimento", DE: "Aktenzeichen", EN: "Reference", FR: "Référence", ES: "Referencia",
      TR: "Referans", RO: "Referință", PL: "Numer sprawy", AR: "المرجع", RU: "Номер дела", UK: "Номер справи"
    },
    content: {
      IT: "Contenuto", DE: "Inhalt", EN: "Content", FR: "Contenu", ES: "Contenido",
      TR: "İçerik", RO: "Conținut", PL: "Treść", AR: "المحتوى", RU: "Содержание", UK: "Зміст"
    },
  };
  
  return labels[key]?.[lang] || labels[key]?.EN || key;
}

/**
 * Detect if AI response is attempting to generate a final document
 */
export function isDocumentGenerationAttempt(aiResponse: string): boolean {
  // Check for [LETTER] tags
  if (/\[LETTER\]/i.test(aiResponse)) return true;
  
  // Check for formal letter structure markers (multiple must be present)
  const markers = [
    /\b(betreff|oggetto|subject|objet|asunto)\s*:/i,
    /\b(sehr\s+geehrte|gentile|dear|cher|estimado)/i,
    /\b(mit\s+freundlichen\s+grüßen|cordiali\s+saluti|sincerely|cordialement|atentamente)/i,
  ];
  
  let markerCount = 0;
  for (const marker of markers) {
    if (marker.test(aiResponse)) markerCount++;
  }
  
  // If 2+ formal letter markers AND content is long enough, it's a document
  return markerCount >= 2 && aiResponse.length > 300;
}

/**
 * Extract document data from AI response or conversation context
 */
export function extractDocumentData(
  aiResponse: string,
  userProfile?: { senderFullName?: string; fullName?: string; senderAddress?: string; address?: string; senderCity?: string; city?: string; senderPostalCode?: string; postalCode?: string },
  caseContext?: { title?: string; authority?: string; aktenzeichen?: string; deadline?: string }
): DocumentData {
  const data: DocumentData = {};
  
  // From user profile
  if (userProfile) {
    data.senderName = userProfile.senderFullName || userProfile.fullName;
    const addressParts = [
      userProfile.senderAddress || userProfile.address,
      [userProfile.senderPostalCode || userProfile.postalCode, userProfile.senderCity || userProfile.city].filter(Boolean).join(' ')
    ].filter(Boolean);
    data.senderAddress = addressParts.join(', ');
  }
  
  // From case context
  if (caseContext) {
    data.recipientName = caseContext.authority;
    data.subject = caseContext.title;
    data.reference = caseContext.aktenzeichen;
  }
  
  // Extract subject from AI response
  const subjectMatch = aiResponse.match(/\b(betreff|oggetto|subject|objet|asunto)\s*:\s*(.+?)(?:\n|$)/i);
  if (subjectMatch) {
    data.subject = subjectMatch[2].trim();
  }
  
  // Set current date
  data.date = new Date().toLocaleDateString('de-DE');
  
  return data;
}

/**
 * Check if previous assistant message was a summary block
 */
export function wasPreviousMessageSummary(chatHistory: Array<{ role: string; content: string }>): boolean {
  if (!chatHistory || chatHistory.length === 0) return false;
  
  const lastAssistantMessage = [...chatHistory].reverse().find(m => m.role === 'assistant');
  if (!lastAssistantMessage) return false;
  
  // Check if it contains our summary block markers
  return /📋\s*\*\*/.test(lastAssistantMessage.content) && 
         /✅\s*\*\*/.test(lastAssistantMessage.content);
}
