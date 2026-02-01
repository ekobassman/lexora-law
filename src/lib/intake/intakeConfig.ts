/**
 * Intake Configuration
 * 
 * Centralized document types and required fields configuration.
 * Used across all chat interfaces (Demo, Dashboard, Edit/Bearbeiten).
 */

export type DocumentType = 
  | 'school_absence'
  | 'employer_letter'
  | 'landlord_letter'
  | 'authority_letter'
  | 'generic';

export interface FieldConfig {
  key: string;
  labelKey: string;
  required: boolean;
}

// Field definitions per document type
// CRITICAL: location and date are now REQUIRED to prevent [Luogo] [Data] placeholders
export const DOCUMENT_FIELD_CONFIG: Record<DocumentType, FieldConfig[]> = {
  school_absence: [
    { key: 'parent_name', labelKey: 'intake.fields.parentName', required: true },
    { key: 'student_name', labelKey: 'intake.fields.studentName', required: true },
    { key: 'school_name', labelKey: 'intake.fields.schoolName', required: true },
    { key: 'absence_dates', labelKey: 'intake.fields.absenceDates', required: true },
    { key: 'absence_reason', labelKey: 'intake.fields.absenceReason', required: true },
    { key: 'location', labelKey: 'intake.fields.location', required: true }, // REQUIRED: prevents [Luogo] placeholder
    { key: 'letter_date', labelKey: 'intake.fields.letterDate', required: true }, // REQUIRED: prevents [Data] placeholder
    { key: 'class_section', labelKey: 'intake.fields.classSection', required: false },
    { key: 'school_address', labelKey: 'intake.fields.schoolAddress', required: false },
    { key: 'recipient', labelKey: 'intake.fields.recipient', required: false },
    { key: 'contact_info', labelKey: 'intake.fields.contactInfo', required: false },
    { key: 'has_certificate', labelKey: 'intake.fields.hasCertificate', required: false },
  ],
  employer_letter: [
    { key: 'sender_name', labelKey: 'intake.fields.senderName', required: true },
    { key: 'sender_address', labelKey: 'intake.fields.senderAddress', required: true },
    { key: 'employer_name', labelKey: 'intake.fields.employerName', required: true },
    { key: 'subject', labelKey: 'intake.fields.subject', required: true },
    { key: 'request_details', labelKey: 'intake.fields.requestDetails', required: true },
    { key: 'location', labelKey: 'intake.fields.location', required: true }, // REQUIRED
    { key: 'letter_date', labelKey: 'intake.fields.letterDate', required: true }, // REQUIRED
    { key: 'employer_address', labelKey: 'intake.fields.employerAddress', required: false },
    { key: 'reference_number', labelKey: 'intake.fields.referenceNumber', required: false },
  ],
  landlord_letter: [
    { key: 'tenant_name', labelKey: 'intake.fields.tenantName', required: true },
    { key: 'tenant_address', labelKey: 'intake.fields.tenantAddress', required: true },
    { key: 'landlord_name', labelKey: 'intake.fields.landlordName', required: true },
    { key: 'subject', labelKey: 'intake.fields.subject', required: true },
    { key: 'request_details', labelKey: 'intake.fields.requestDetails', required: true },
    { key: 'location', labelKey: 'intake.fields.location', required: true }, // REQUIRED
    { key: 'letter_date', labelKey: 'intake.fields.letterDate', required: true }, // REQUIRED
    { key: 'landlord_address', labelKey: 'intake.fields.landlordAddress', required: false },
    { key: 'contract_date', labelKey: 'intake.fields.contractDate', required: false },
  ],
  authority_letter: [
    { key: 'sender_name', labelKey: 'intake.fields.senderName', required: true },
    { key: 'sender_address', labelKey: 'intake.fields.senderAddress', required: true },
    { key: 'authority_name', labelKey: 'intake.fields.authorityName', required: true },
    { key: 'subject', labelKey: 'intake.fields.subject', required: true },
    { key: 'request_details', labelKey: 'intake.fields.requestDetails', required: true },
    { key: 'location', labelKey: 'intake.fields.location', required: true }, // REQUIRED
    { key: 'letter_date', labelKey: 'intake.fields.letterDate', required: true }, // REQUIRED
    { key: 'authority_address', labelKey: 'intake.fields.authorityAddress', required: false },
    { key: 'reference_number', labelKey: 'intake.fields.referenceNumber', required: false },
    { key: 'deadline', labelKey: 'intake.fields.deadline', required: false },
  ],
  generic: [
    { key: 'sender_name', labelKey: 'intake.fields.senderName', required: true },
    { key: 'sender_address', labelKey: 'intake.fields.senderAddress', required: true },
    { key: 'recipient_name', labelKey: 'intake.fields.recipientName', required: true },
    { key: 'subject', labelKey: 'intake.fields.subject', required: true },
    { key: 'content', labelKey: 'intake.fields.content', required: true },
    { key: 'location', labelKey: 'intake.fields.location', required: true }, // REQUIRED
    { key: 'letter_date', labelKey: 'intake.fields.letterDate', required: true }, // REQUIRED
    { key: 'recipient_address', labelKey: 'intake.fields.recipientAddress', required: false },
  ],
};

/**
 * Detect document type from user message
 * Supports IT, DE, EN, FR, ES, PL, RO, TR, AR, UK, RU keywords
 */
export function detectDocumentType(message: string): DocumentType | null {
  const lowerMsg = message.toLowerCase();
  
  // School/absence keywords (all 11 languages)
  const schoolPatterns = [
    // IT
    /\b(scuola|asilo|assenz|malattia)\b/,
    // DE
    /\b(schule|kindergarten|abwesenheit|krankheit|krank)\b/,
    // EN
    /\b(school|kindergarten|absence|illness|sick)\b/,
    // FR
    /\b(école|maternelle|absence|maladie|malade)\b/,
    // ES
    /\b(escuela|guardería|ausencia|enfermedad|enfermo)\b/,
    // PL
    /\b(szkoła|przedszkole|nieobecność|choroba|chory)\b/,
    // RO
    /\b(școală|grădiniță|absență|boală|bolnav)\b/,
    // TR
    /\b(okul|anaokulu|devamsızlık|hastalık|hasta)\b/,
    // AR
    /\b(مدرسة|روضة|غياب|مرض|مريض)\b/,
    // UK
    /\b(школа|дитячий садок|відсутність|хвороба|хворий)\b/,
    // RU
    /\b(школа|детский сад|отсутствие|болезнь|больной)\b/,
  ];
  
  if (schoolPatterns.some(p => p.test(lowerMsg))) {
    return 'school_absence';
  }
  
  // Employer keywords (all 11 languages)
  const employerPatterns = [
    // IT
    /\b(datore|lavoro|dimissioni|ferie|stipendio|licenziamento)\b/,
    // DE
    /\b(arbeitgeber|arbeit|kündigung|urlaub|gehalt|entlassung)\b/,
    // EN
    /\b(employer|job|work|resignation|vacation|salary|termination)\b/,
    // FR
    /\b(employeur|travail|démission|vacances|salaire|licenciement)\b/,
    // ES
    /\b(empleador|trabajo|dimisión|vacaciones|salario|despido)\b/,
    // PL
    /\b(pracodawca|praca|rezygnacja|urlop|wynagrodzenie|zwolnienie)\b/,
    // RO
    /\b(angajator|muncă|demisie|concediu|salariu|concediere)\b/,
    // TR
    /\b(işveren|iş|istifa|izin|maaş|işten çıkarma)\b/,
    // UK
    /\b(роботодавець|робота|звільнення|відпустка|зарплата)\b/,
    // RU
    /\b(работодатель|работа|увольнение|отпуск|зарплата)\b/,
  ];
  
  if (employerPatterns.some(p => p.test(lowerMsg))) {
    return 'employer_letter';
  }
  
  // Landlord keywords (all 11 languages)
  const landlordPatterns = [
    // IT
    /\b(padrone|proprietario|affitto|inquilino|sfratto|locazione)\b/,
    // DE
    /\b(vermieter|miete|mieter|räumung|wohnung|kündigung)\b/,
    // EN
    /\b(landlord|rent|tenant|eviction|apartment|lease)\b/,
    // FR
    /\b(propriétaire|loyer|locataire|expulsion|appartement|bail)\b/,
    // ES
    /\b(propietario|alquiler|inquilino|desahucio|apartamento|contrato)\b/,
    // PL
    /\b(właściciel|czynsz|najemca|eksmisja|mieszkanie|wynajem)\b/,
    // RO
    /\b(proprietar|chirie|chiriaș|evacuare|apartament|contract)\b/,
    // TR
    /\b(ev sahibi|kira|kiracı|tahliye|daire|sözleşme)\b/,
    // UK
    /\b(орендодавець|оренда|орендар|виселення|квартира)\b/,
    // RU
    /\b(арендодатель|аренда|арендатор|выселение|квартира)\b/,
  ];
  
  if (landlordPatterns.some(p => p.test(lowerMsg))) {
    return 'landlord_letter';
  }
  
  // Authority keywords (all 11 languages)
  const authorityPatterns = [
    // IT
    /\b(ufficio|comune|agenzia|tribunale|multa|amminist)\b/,
    // DE
    /\b(amt|gemeinde|behörde|gericht|bußgeld|verwaltung)\b/,
    // EN
    /\b(office|municipality|agency|court|fine|administration)\b/,
    // FR
    /\b(bureau|mairie|agence|tribunal|amende|administration)\b/,
    // ES
    /\b(oficina|ayuntamiento|agencia|juzgado|multa|administración)\b/,
    // PL
    /\b(urząd|gmina|agencja|sąd|mandat|administracja)\b/,
    // RO
    /\b(oficiu|primărie|agenție|tribunal|amendă|administrație)\b/,
    // TR
    /\b(ofis|belediye|ajans|mahkeme|ceza|yönetim)\b/,
    // UK
    /\b(офіс|муніципалітет|агентство|суд|штраф|адміністрація)\b/,
    // RU
    /\b(офис|муниципалитет|агентство|суд|штраф|администрация)\b/,
  ];
  
  if (authorityPatterns.some(p => p.test(lowerMsg))) {
    return 'authority_letter';
  }
  
  // Generic letter request (all 11 languages)
  const genericPatterns = [
    /\b(lettera|brief|letter|lettre|carta|list|scrisoare|mektup|رسالة|лист|письмо)\b/i,
    /\b(documento|dokument|document|dokument|документ)\b/i,
    /\b(richiesta|anfrage|request|demande|solicitud|wniosek|cerere|talep|طلب|запит|запрос)\b/i,
  ];
  
  if (genericPatterns.some(p => p.test(lowerMsg))) {
    return 'generic';
  }
  
  return null;
}

/**
 * Get required field keys for a document type
 */
export function getRequiredFields(docType: DocumentType): string[] {
  return DOCUMENT_FIELD_CONFIG[docType]
    .filter(f => f.required)
    .map(f => f.key);
}

/**
 * Get optional field keys for a document type
 */
export function getOptionalFields(docType: DocumentType): string[] {
  return DOCUMENT_FIELD_CONFIG[docType]
    .filter(f => !f.required)
    .map(f => f.key);
}
