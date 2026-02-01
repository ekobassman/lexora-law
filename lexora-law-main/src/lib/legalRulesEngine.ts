/**
 * Legal Rules Engine
 * 
 * Provides country-specific legal context, formatting rules, and terminology.
 * Used by:
 * - AI prompts (legal context for document analysis and draft generation)
 * - PDF generation (letter format, labels, Impressum inclusion)
 * - Legal pages (/legal, /privacy - dynamic content per country)
 * - UI labels (authority terminology, date formats)
 */

export type CountryCode = 
  | 'DE' | 'AT' | 'CH' 
  | 'IT' | 'FR' | 'ES' 
  | 'PL' | 'RO' | 'NL' | 'BE' | 'PT' 
  | 'GR' | 'CZ' | 'HU' | 'SE' | 'DK' | 'FI' | 'NO' 
  | 'IE' | 'GB' 
  | 'TR' | 'OTHER';

export type LanguageCode = 'DE' | 'EN' | 'IT' | 'FR' | 'ES' | 'PL' | 'RO' | 'TR' | 'AR' | 'UK' | 'RU';

export interface LegalEntity {
  name: string;
  address: string;
  email: string;
  vat?: string;
}

export interface LegalRules {
  country: CountryCode;
  
  // Letter formatting
  letterFormat: 'din5008' | 'standard' | 'uk';
  dateFormat: string; // date-fns format string
  
  // Terminology
  authorityTerm: string;
  deadlineTerm: string;
  referenceTerm: string; // Aktenzeichen equivalent
  
  // Legal page requirements
  requiresImpressum: boolean; // true for DE, AT, CH
  impressumLaw?: string; // e.g. "§ 5 TMG" for Germany
  privacyLaw: string; // GDPR/DSGVO reference
  
  // AI context
  legalSystem: string; // e.g. "German civil law (BGB, VwVfG)"
  responseStyleHint: string;
  
  // Labels (translated per language, but defaults here for fallback)
  labels: {
    legalNotice: string;
    privacyPolicy: string;
    termsOfService: string;
    cookiePolicy: string;
  };
}

// Central legal entity data (used in Impressum, footer, PDFs)
export const LEGAL_ENTITY: LegalEntity = {
  name: 'Roberto Imbimbo',
  address: 'Mörikestraße 10, 72202 Nagold, Deutschland',
  email: 'support@lexora-law.com',
  vat: 'DE283171773',
};

// Country-specific rules
const rulesMap: Record<CountryCode, LegalRules> = {
  DE: {
    country: 'DE',
    letterFormat: 'din5008',
    dateFormat: 'dd.MM.yyyy',
    authorityTerm: 'Behörde',
    deadlineTerm: 'Frist',
    referenceTerm: 'Aktenzeichen',
    requiresImpressum: true,
    impressumLaw: '§ 5 TMG',
    privacyLaw: 'DSGVO (Datenschutz-Grundverordnung)',
    legalSystem: 'German civil law (BGB, VwVfG, VwGO). Deadlines are strict (Fristversäumnis). Official letters require formal response format.',
    responseStyleHint: 'Formal German administrative style. Use "Sehr geehrte Damen und Herren", reference Aktenzeichen, cite applicable laws.',
    labels: {
      legalNotice: 'Impressum',
      privacyPolicy: 'Datenschutzerklärung',
      termsOfService: 'Nutzungsbedingungen',
      cookiePolicy: 'Cookie-Richtlinie',
    },
  },
  AT: {
    country: 'AT',
    letterFormat: 'din5008',
    dateFormat: 'dd.MM.yyyy',
    authorityTerm: 'Behörde',
    deadlineTerm: 'Frist',
    referenceTerm: 'Geschäftszahl',
    requiresImpressum: true,
    impressumLaw: '§ 5 ECG',
    privacyLaw: 'DSGVO',
    legalSystem: 'Austrian civil law (ABGB, AVG). Similar to German system with Austrian specifics.',
    responseStyleHint: 'Formal Austrian administrative style.',
    labels: {
      legalNotice: 'Impressum',
      privacyPolicy: 'Datenschutzerklärung',
      termsOfService: 'Nutzungsbedingungen',
      cookiePolicy: 'Cookie-Richtlinie',
    },
  },
  CH: {
    country: 'CH',
    letterFormat: 'din5008',
    dateFormat: 'dd.MM.yyyy',
    authorityTerm: 'Behörde',
    deadlineTerm: 'Frist',
    referenceTerm: 'Referenz',
    requiresImpressum: true,
    impressumLaw: 'Art. 3 UWG',
    privacyLaw: 'DSG (Datenschutzgesetz)',
    legalSystem: 'Swiss civil law (ZGB, VwVG). Federal and cantonal laws apply.',
    responseStyleHint: 'Formal Swiss administrative style.',
    labels: {
      legalNotice: 'Impressum',
      privacyPolicy: 'Datenschutzerklärung',
      termsOfService: 'Nutzungsbedingungen',
      cookiePolicy: 'Cookie-Richtlinie',
    },
  },
  IT: {
    country: 'IT',
    letterFormat: 'standard',
    dateFormat: 'dd/MM/yyyy',
    authorityTerm: 'Ente/Autorità',
    deadlineTerm: 'Termine',
    referenceTerm: 'Protocollo',
    requiresImpressum: false,
    privacyLaw: 'GDPR / D.Lgs. 196/2003',
    legalSystem: 'Italian civil law (Codice Civile, L. 241/90). PEC may be required for official communications.',
    responseStyleHint: 'Formal Italian style. Use "Egregio/Gentile", reference Protocollo, cite applicable norme.',
    labels: {
      legalNotice: 'Note Legali',
      privacyPolicy: 'Informativa Privacy',
      termsOfService: 'Termini di Servizio',
      cookiePolicy: 'Cookie Policy',
    },
  },
  FR: {
    country: 'FR',
    letterFormat: 'standard',
    dateFormat: 'dd/MM/yyyy',
    authorityTerm: 'Administration',
    deadlineTerm: 'Délai',
    referenceTerm: 'Référence',
    requiresImpressum: false,
    privacyLaw: 'RGPD / Loi Informatique et Libertés',
    legalSystem: 'French administrative law (Code des relations entre le public et l\'administration).',
    responseStyleHint: 'Formal French style. Use "Madame, Monsieur", cite Code applicable.',
    labels: {
      legalNotice: 'Mentions Légales',
      privacyPolicy: 'Politique de Confidentialité',
      termsOfService: 'Conditions d\'Utilisation',
      cookiePolicy: 'Politique de Cookies',
    },
  },
  ES: {
    country: 'ES',
    letterFormat: 'standard',
    dateFormat: 'dd/MM/yyyy',
    authorityTerm: 'Administración',
    deadlineTerm: 'Plazo',
    referenceTerm: 'Expediente',
    requiresImpressum: false,
    privacyLaw: 'RGPD / LOPDGDD',
    legalSystem: 'Spanish administrative law (Ley 39/2015).',
    responseStyleHint: 'Formal Spanish style.',
    labels: {
      legalNotice: 'Aviso Legal',
      privacyPolicy: 'Política de Privacidad',
      termsOfService: 'Términos de Servicio',
      cookiePolicy: 'Política de Cookies',
    },
  },
  PL: {
    country: 'PL',
    letterFormat: 'standard',
    dateFormat: 'dd.MM.yyyy',
    authorityTerm: 'Urząd',
    deadlineTerm: 'Termin',
    referenceTerm: 'Sygnatura',
    requiresImpressum: false,
    privacyLaw: 'RODO',
    legalSystem: 'Polish administrative law (KPA).',
    responseStyleHint: 'Formal Polish administrative style.',
    labels: {
      legalNotice: 'Nota Prawna',
      privacyPolicy: 'Polityka Prywatności',
      termsOfService: 'Regulamin',
      cookiePolicy: 'Polityka Cookies',
    },
  },
  RO: {
    country: 'RO',
    letterFormat: 'standard',
    dateFormat: 'dd.MM.yyyy',
    authorityTerm: 'Autoritate',
    deadlineTerm: 'Termen',
    referenceTerm: 'Număr înregistrare',
    requiresImpressum: false,
    privacyLaw: 'GDPR',
    legalSystem: 'Romanian administrative law.',
    responseStyleHint: 'Formal Romanian style.',
    labels: {
      legalNotice: 'Notă Juridică',
      privacyPolicy: 'Politica de Confidențialitate',
      termsOfService: 'Termeni și Condiții',
      cookiePolicy: 'Politica de Cookies',
    },
  },
  TR: {
    country: 'TR',
    letterFormat: 'standard',
    dateFormat: 'dd.MM.yyyy',
    authorityTerm: 'Kurum',
    deadlineTerm: 'Süre',
    referenceTerm: 'Evrak No',
    requiresImpressum: false,
    privacyLaw: 'KVKK',
    legalSystem: 'Turkish administrative law.',
    responseStyleHint: 'Formal Turkish style.',
    labels: {
      legalNotice: 'Yasal Uyarı',
      privacyPolicy: 'Gizlilik Politikası',
      termsOfService: 'Kullanım Koşulları',
      cookiePolicy: 'Çerez Politikası',
    },
  },
  GB: {
    country: 'GB',
    letterFormat: 'uk',
    dateFormat: 'dd/MM/yyyy',
    authorityTerm: 'Authority',
    deadlineTerm: 'Deadline',
    referenceTerm: 'Reference',
    requiresImpressum: false,
    privacyLaw: 'UK GDPR / Data Protection Act 2018',
    legalSystem: 'UK common law and administrative law.',
    responseStyleHint: 'Formal UK English style.',
    labels: {
      legalNotice: 'Legal Notice',
      privacyPolicy: 'Privacy Policy',
      termsOfService: 'Terms of Service',
      cookiePolicy: 'Cookie Policy',
    },
  },
  IE: {
    country: 'IE',
    letterFormat: 'uk',
    dateFormat: 'dd/MM/yyyy',
    authorityTerm: 'Authority',
    deadlineTerm: 'Deadline',
    referenceTerm: 'Reference',
    requiresImpressum: false,
    privacyLaw: 'GDPR / Data Protection Act 2018',
    legalSystem: 'Irish common law and administrative law.',
    responseStyleHint: 'Formal English style.',
    labels: {
      legalNotice: 'Legal Notice',
      privacyPolicy: 'Privacy Policy',
      termsOfService: 'Terms of Service',
      cookiePolicy: 'Cookie Policy',
    },
  },
  NL: {
    country: 'NL',
    letterFormat: 'standard',
    dateFormat: 'dd-MM-yyyy',
    authorityTerm: 'Overheid',
    deadlineTerm: 'Termijn',
    referenceTerm: 'Kenmerk',
    requiresImpressum: false,
    privacyLaw: 'AVG (GDPR)',
    legalSystem: 'Dutch administrative law (Awb).',
    responseStyleHint: 'Formal Dutch style.',
    labels: {
      legalNotice: 'Juridische Kennisgeving',
      privacyPolicy: 'Privacybeleid',
      termsOfService: 'Gebruiksvoorwaarden',
      cookiePolicy: 'Cookiebeleid',
    },
  },
  BE: {
    country: 'BE',
    letterFormat: 'standard',
    dateFormat: 'dd/MM/yyyy',
    authorityTerm: 'Autorité',
    deadlineTerm: 'Délai',
    referenceTerm: 'Référence',
    requiresImpressum: false,
    privacyLaw: 'GDPR',
    legalSystem: 'Belgian administrative law.',
    responseStyleHint: 'Formal style (French or Dutch).',
    labels: {
      legalNotice: 'Mentions Légales',
      privacyPolicy: 'Politique de Confidentialité',
      termsOfService: 'Conditions d\'Utilisation',
      cookiePolicy: 'Politique de Cookies',
    },
  },
  PT: {
    country: 'PT',
    letterFormat: 'standard',
    dateFormat: 'dd/MM/yyyy',
    authorityTerm: 'Autoridade',
    deadlineTerm: 'Prazo',
    referenceTerm: 'Referência',
    requiresImpressum: false,
    privacyLaw: 'RGPD',
    legalSystem: 'Portuguese administrative law.',
    responseStyleHint: 'Formal Portuguese style.',
    labels: {
      legalNotice: 'Aviso Legal',
      privacyPolicy: 'Política de Privacidade',
      termsOfService: 'Termos de Serviço',
      cookiePolicy: 'Política de Cookies',
    },
  },
  GR: {
    country: 'GR',
    letterFormat: 'standard',
    dateFormat: 'dd/MM/yyyy',
    authorityTerm: 'Αρχή',
    deadlineTerm: 'Προθεσμία',
    referenceTerm: 'Αριθμός Πρωτοκόλλου',
    requiresImpressum: false,
    privacyLaw: 'GDPR',
    legalSystem: 'Greek administrative law.',
    responseStyleHint: 'Formal Greek style.',
    labels: {
      legalNotice: 'Νομική Σημείωση',
      privacyPolicy: 'Πολιτική Απορρήτου',
      termsOfService: 'Όροι Χρήσης',
      cookiePolicy: 'Πολιτική Cookies',
    },
  },
  CZ: {
    country: 'CZ',
    letterFormat: 'standard',
    dateFormat: 'dd.MM.yyyy',
    authorityTerm: 'Úřad',
    deadlineTerm: 'Lhůta',
    referenceTerm: 'Číslo jednací',
    requiresImpressum: false,
    privacyLaw: 'GDPR',
    legalSystem: 'Czech administrative law.',
    responseStyleHint: 'Formal Czech style.',
    labels: {
      legalNotice: 'Právní Upozornění',
      privacyPolicy: 'Zásady Ochrany Osobních Údajů',
      termsOfService: 'Podmínky Služby',
      cookiePolicy: 'Zásady Cookies',
    },
  },
  HU: {
    country: 'HU',
    letterFormat: 'standard',
    dateFormat: 'yyyy.MM.dd',
    authorityTerm: 'Hatóság',
    deadlineTerm: 'Határidő',
    referenceTerm: 'Iktatószám',
    requiresImpressum: false,
    privacyLaw: 'GDPR',
    legalSystem: 'Hungarian administrative law.',
    responseStyleHint: 'Formal Hungarian style.',
    labels: {
      legalNotice: 'Jogi Nyilatkozat',
      privacyPolicy: 'Adatvédelmi Tájékoztató',
      termsOfService: 'Felhasználási Feltételek',
      cookiePolicy: 'Cookie Szabályzat',
    },
  },
  SE: {
    country: 'SE',
    letterFormat: 'standard',
    dateFormat: 'yyyy-MM-dd',
    authorityTerm: 'Myndighet',
    deadlineTerm: 'Tidsfrist',
    referenceTerm: 'Diarienummer',
    requiresImpressum: false,
    privacyLaw: 'GDPR',
    legalSystem: 'Swedish administrative law.',
    responseStyleHint: 'Formal Swedish style.',
    labels: {
      legalNotice: 'Juridisk Information',
      privacyPolicy: 'Integritetspolicy',
      termsOfService: 'Användarvillkor',
      cookiePolicy: 'Cookiepolicy',
    },
  },
  DK: {
    country: 'DK',
    letterFormat: 'standard',
    dateFormat: 'dd-MM-yyyy',
    authorityTerm: 'Myndighed',
    deadlineTerm: 'Frist',
    referenceTerm: 'Journalnummer',
    requiresImpressum: false,
    privacyLaw: 'GDPR',
    legalSystem: 'Danish administrative law.',
    responseStyleHint: 'Formal Danish style.',
    labels: {
      legalNotice: 'Juridisk Meddelelse',
      privacyPolicy: 'Privatlivspolitik',
      termsOfService: 'Servicevilkår',
      cookiePolicy: 'Cookiepolitik',
    },
  },
  FI: {
    country: 'FI',
    letterFormat: 'standard',
    dateFormat: 'dd.MM.yyyy',
    authorityTerm: 'Viranomainen',
    deadlineTerm: 'Määräaika',
    referenceTerm: 'Diaarinumero',
    requiresImpressum: false,
    privacyLaw: 'GDPR',
    legalSystem: 'Finnish administrative law.',
    responseStyleHint: 'Formal Finnish style.',
    labels: {
      legalNotice: 'Oikeudellinen Ilmoitus',
      privacyPolicy: 'Tietosuojakäytäntö',
      termsOfService: 'Käyttöehdot',
      cookiePolicy: 'Evästekäytäntö',
    },
  },
  NO: {
    country: 'NO',
    letterFormat: 'standard',
    dateFormat: 'dd.MM.yyyy',
    authorityTerm: 'Myndighet',
    deadlineTerm: 'Frist',
    referenceTerm: 'Saksnummer',
    requiresImpressum: false,
    privacyLaw: 'GDPR / Personopplysningsloven',
    legalSystem: 'Norwegian administrative law.',
    responseStyleHint: 'Formal Norwegian style.',
    labels: {
      legalNotice: 'Juridisk Merknad',
      privacyPolicy: 'Personvernerklæring',
      termsOfService: 'Tjenestevilkår',
      cookiePolicy: 'Retningslinjer for Informasjonskapsler',
    },
  },
  OTHER: {
    country: 'OTHER',
    letterFormat: 'standard',
    dateFormat: 'yyyy-MM-dd',
    authorityTerm: 'Authority',
    deadlineTerm: 'Deadline',
    referenceTerm: 'Reference',
    requiresImpressum: false,
    privacyLaw: 'GDPR (EU) or local equivalent',
    legalSystem: 'EU/international standards. Specific national laws may apply.',
    responseStyleHint: 'Formal professional style in English.',
    labels: {
      legalNotice: 'Legal Notice',
      privacyPolicy: 'Privacy Policy',
      termsOfService: 'Terms of Service',
      cookiePolicy: 'Cookie Policy',
    },
  },
};

/**
 * Get legal rules for a specific country
 */
export function getLegalRules(country: CountryCode): LegalRules {
  return rulesMap[country] || rulesMap.OTHER;
}

/**
 * Generate AI system prompt context for a given country
 */
export function getAILegalContext(country: CountryCode, language: LanguageCode): string {
  const rules = getLegalRules(country);
  
  return `
LEGAL CONTEXT:
- Country: ${country}
- Legal System: ${rules.legalSystem}
- Response Language: ${language}
- Authority Term: ${rules.authorityTerm}
- Reference Term: ${rules.referenceTerm}
- Deadline Term: ${rules.deadlineTerm}
- Privacy Law: ${rules.privacyLaw}
${rules.requiresImpressum ? `- Impressum required under ${rules.impressumLaw}` : ''}

RESPONSE STYLE:
${rules.responseStyleHint}

IMPORTANT: Generate all content in ${language}. Use the correct legal terminology for ${country}.
`.trim();
}

/**
 * Get PDF generation settings for a country
 */
export function getPDFSettings(country: CountryCode) {
  const rules = getLegalRules(country);
  
  return {
    format: rules.letterFormat,
    dateFormat: rules.dateFormat,
    includeImpressum: rules.requiresImpressum,
    authorityLabel: rules.authorityTerm,
    referenceLabel: rules.referenceTerm,
    deadlineLabel: rules.deadlineTerm,
  };
}

/**
 * Check if Impressum is required for footer/legal pages
 */
export function requiresImpressum(country: CountryCode): boolean {
  return getLegalRules(country).requiresImpressum;
}

/**
 * Get translated legal page labels for a country
 */
export function getLegalLabels(country: CountryCode) {
  return getLegalRules(country).labels;
}
