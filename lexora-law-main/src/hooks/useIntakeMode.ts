/**
 * Intake Mode Hook - Unified state management for IDLE→INTAKE→REVIEW→FINAL workflow
 * 
 * Used across all chat interfaces (Demo, Dashboard, Edit) to enforce:
 * 1. Data collection before document generation
 * 2. Review/confirmation step before finalizing
 * 3. No placeholders in final output
 */

import { useState, useCallback, useEffect } from 'react';

export type IntakePhase = 'IDLE' | 'INTAKE' | 'REVIEW' | 'FINAL';

export interface IntakeField {
  key: string;
  label: string;
  required: boolean;
  value: string | null;
  collected: boolean;
}

export interface IntakeState {
  phase: IntakePhase;
  documentType: string | null;
  fields: IntakeField[];
  summaryText: string | null;
  finalDocument: string | null;
  lastUpdated: string;
}

const STORAGE_PREFIX = 'lexora_intake_';

// Default fields for common document types
const DOCUMENT_FIELD_TEMPLATES: Record<string, Omit<IntakeField, 'value' | 'collected'>[]> = {
  'school_absence': [
    { key: 'parent_name', label: 'intake.fields.parentName', required: true },
    { key: 'student_name', label: 'intake.fields.studentName', required: true },
    { key: 'school_name', label: 'intake.fields.schoolName', required: true },
    { key: 'absence_dates', label: 'intake.fields.absenceDates', required: true },
    { key: 'absence_reason', label: 'intake.fields.absenceReason', required: true },
    { key: 'class_section', label: 'intake.fields.classSection', required: false },
    { key: 'school_address', label: 'intake.fields.schoolAddress', required: false },
    { key: 'recipient', label: 'intake.fields.recipient', required: false },
    { key: 'contact_info', label: 'intake.fields.contactInfo', required: false },
    { key: 'has_certificate', label: 'intake.fields.hasCertificate', required: false },
  ],
  'employer_letter': [
    { key: 'sender_name', label: 'intake.fields.senderName', required: true },
    { key: 'sender_address', label: 'intake.fields.senderAddress', required: true },
    { key: 'employer_name', label: 'intake.fields.employerName', required: true },
    { key: 'subject', label: 'intake.fields.subject', required: true },
    { key: 'request_details', label: 'intake.fields.requestDetails', required: true },
    { key: 'employer_address', label: 'intake.fields.employerAddress', required: false },
    { key: 'reference_number', label: 'intake.fields.referenceNumber', required: false },
  ],
  'landlord_letter': [
    { key: 'tenant_name', label: 'intake.fields.tenantName', required: true },
    { key: 'tenant_address', label: 'intake.fields.tenantAddress', required: true },
    { key: 'landlord_name', label: 'intake.fields.landlordName', required: true },
    { key: 'subject', label: 'intake.fields.subject', required: true },
    { key: 'request_details', label: 'intake.fields.requestDetails', required: true },
    { key: 'landlord_address', label: 'intake.fields.landlordAddress', required: false },
    { key: 'contract_date', label: 'intake.fields.contractDate', required: false },
  ],
  'authority_letter': [
    { key: 'sender_name', label: 'intake.fields.senderName', required: true },
    { key: 'sender_address', label: 'intake.fields.senderAddress', required: true },
    { key: 'authority_name', label: 'intake.fields.authorityName', required: true },
    { key: 'subject', label: 'intake.fields.subject', required: true },
    { key: 'request_details', label: 'intake.fields.requestDetails', required: true },
    { key: 'authority_address', label: 'intake.fields.authorityAddress', required: false },
    { key: 'reference_number', label: 'intake.fields.referenceNumber', required: false },
    { key: 'deadline', label: 'intake.fields.deadline', required: false },
  ],
  'generic': [
    { key: 'sender_name', label: 'intake.fields.senderName', required: true },
    { key: 'sender_address', label: 'intake.fields.senderAddress', required: true },
    { key: 'recipient_name', label: 'intake.fields.recipientName', required: true },
    { key: 'subject', label: 'intake.fields.subject', required: true },
    { key: 'content', label: 'intake.fields.content', required: true },
    { key: 'recipient_address', label: 'intake.fields.recipientAddress', required: false },
  ],
};

function createEmptyState(): IntakeState {
  return {
    phase: 'IDLE',
    documentType: null,
    fields: [],
    summaryText: null,
    finalDocument: null,
    lastUpdated: new Date().toISOString(),
  };
}

// SSR-safe storage functions with window guard
function loadFromStorage(sessionId: string): IntakeState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${sessionId}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveToStorage(sessionId: string, state: IntakeState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${sessionId}`, JSON.stringify(state));
  } catch (e) {
    console.error('[useIntakeMode] Failed to save state:', e);
  }
}

function clearStorage(sessionId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${sessionId}`);
  } catch {
    // Ignore
  }
}

export interface UseIntakeModeOptions {
  sessionId: string; // Unique ID for the session (e.g., 'demo', 'dashboard', or pratica ID)
  onPhaseChange?: (phase: IntakePhase) => void;
}

export function useIntakeMode({ sessionId, onPhaseChange }: UseIntakeModeOptions) {
  const [state, setState] = useState<IntakeState>(() => {
    return loadFromStorage(sessionId) || createEmptyState();
  });

  // Persist state changes
  useEffect(() => {
    saveToStorage(sessionId, state);
  }, [sessionId, state]);

  // Notify on phase change
  useEffect(() => {
    onPhaseChange?.(state.phase);
  }, [state.phase, onPhaseChange]);

  // Start intake mode with a detected document type
  const startIntake = useCallback((documentType: string) => {
    const template = DOCUMENT_FIELD_TEMPLATES[documentType] || DOCUMENT_FIELD_TEMPLATES.generic;
    const fields: IntakeField[] = template.map(f => ({
      ...f,
      value: null,
      collected: false,
    }));

    setState(prev => ({
      ...prev,
      phase: 'INTAKE',
      documentType,
      fields,
      summaryText: null,
      finalDocument: null,
      lastUpdated: new Date().toISOString(),
    }));
  }, []);

  // Update a field value
  const updateField = useCallback((key: string, value: string) => {
    setState(prev => ({
      ...prev,
      fields: prev.fields.map(f =>
        f.key === key ? { ...f, value, collected: Boolean(value?.trim()) } : f
      ),
      lastUpdated: new Date().toISOString(),
    }));
  }, []);

  // Bulk update fields from AI extraction
  const updateFieldsBulk = useCallback((updates: Record<string, string>) => {
    setState(prev => ({
      ...prev,
      fields: prev.fields.map(f => {
        const newValue = updates[f.key];
        if (newValue !== undefined) {
          return { ...f, value: newValue, collected: Boolean(newValue?.trim()) };
        }
        return f;
      }),
      lastUpdated: new Date().toISOString(),
    }));
  }, []);

  // Check if all required fields are collected
  const areRequiredFieldsComplete = useCallback((): boolean => {
    return state.fields
      .filter(f => f.required)
      .every(f => f.collected);
  }, [state.fields]);

  // Get missing required fields
  const getMissingRequiredFields = useCallback((): IntakeField[] => {
    return state.fields.filter(f => f.required && !f.collected);
  }, [state.fields]);

  // Get collected fields
  const getCollectedFields = useCallback((): IntakeField[] => {
    return state.fields.filter(f => f.collected);
  }, [state.fields]);

  // Move to review phase (only if required fields complete)
  const moveToReview = useCallback((summaryText: string) => {
    if (!areRequiredFieldsComplete()) {
      console.warn('[useIntakeMode] Cannot move to REVIEW - missing required fields');
      return false;
    }

    setState(prev => ({
      ...prev,
      phase: 'REVIEW',
      summaryText,
      lastUpdated: new Date().toISOString(),
    }));
    return true;
  }, [areRequiredFieldsComplete]);

  // Go back to intake for edits
  const backToIntake = useCallback(() => {
    setState(prev => ({
      ...prev,
      phase: 'INTAKE',
      summaryText: null,
      lastUpdated: new Date().toISOString(),
    }));
  }, []);

  // Confirm and move to final phase
  const confirmAndGenerate = useCallback((finalDocument: string) => {
    setState(prev => ({
      ...prev,
      phase: 'FINAL',
      finalDocument,
      lastUpdated: new Date().toISOString(),
    }));
  }, []);

  // Reset to idle state
  const reset = useCallback(() => {
    clearStorage(sessionId);
    setState(createEmptyState());
  }, [sessionId]);

  // Get fields as a record for AI context
  const getFieldsAsRecord = useCallback((): Record<string, string | null> => {
    const record: Record<string, string | null> = {};
    for (const field of state.fields) {
      record[field.key] = field.value;
    }
    return record;
  }, [state.fields]);

  return {
    // State
    phase: state.phase,
    documentType: state.documentType,
    fields: state.fields,
    summaryText: state.summaryText,
    finalDocument: state.finalDocument,
    
    // Computed
    isIdle: state.phase === 'IDLE',
    isIntake: state.phase === 'INTAKE',
    isReview: state.phase === 'REVIEW',
    isFinal: state.phase === 'FINAL',
    requiredComplete: areRequiredFieldsComplete(),
    missingFields: getMissingRequiredFields(),
    collectedFields: getCollectedFields(),
    
    // Actions
    startIntake,
    updateField,
    updateFieldsBulk,
    moveToReview,
    backToIntake,
    confirmAndGenerate,
    reset,
    getFieldsAsRecord,
  };
}

// Helper to detect document type from user message
export function detectDocumentType(message: string): string | null {
  const lowerMsg = message.toLowerCase();
  
  // School-related
  if (/\b(scuola|schule|school|asilo|kindergarten|assenz|absence|abwesenheit|malattia|krankheit|illness)\b/i.test(lowerMsg)) {
    return 'school_absence';
  }
  
  // Employer-related
  if (/\b(datore|lavoro|arbeitgeber|employer|dimissioni|kündigung|resignation|ferie|urlaub|vacation|stipendio|gehalt|salary)\b/i.test(lowerMsg)) {
    return 'employer_letter';
  }
  
  // Landlord-related
  if (/\b(padrone|proprietario|vermieter|landlord|affitto|miete|rent|inquilino|mieter|tenant|sfratto|räumung|eviction)\b/i.test(lowerMsg)) {
    return 'landlord_letter';
  }
  
  // Authority-related
  if (/\b(ufficio|amt|office|comune|gemeinde|municipality|agenzia|behörde|agency|tribunale|gericht|court|multa|bußgeld|fine)\b/i.test(lowerMsg)) {
    return 'authority_letter';
  }
  
  // Generic letter request
  if (/\b(lettera|brief|letter|documento|dokument|document|richiesta|anfrage|request)\b/i.test(lowerMsg)) {
    return 'generic';
  }
  
  return null;
}

// Translations for intake field labels - ALL 11 supported languages
export const INTAKE_FIELD_TRANSLATIONS: Record<string, Record<string, string>> = {
  'intake.fields.parentName': {
    IT: 'Nome e cognome genitore',
    DE: 'Name des Elternteils',
    EN: 'Parent name',
    FR: 'Nom du parent',
    ES: 'Nombre del padre/madre',
    PL: 'Imię i nazwisko rodzica',
    RO: 'Numele părintelui',
    TR: 'Ebeveyn adı',
    AR: 'اسم الوالد',
    UK: 'Імʼя батька/матері',
    RU: 'Имя родителя',
  },
  'intake.fields.studentName': {
    IT: 'Nome e cognome studente',
    DE: 'Name des Schülers',
    EN: 'Student name',
    FR: "Nom de l'élève",
    ES: 'Nombre del estudiante',
    PL: 'Imię i nazwisko ucznia',
    RO: 'Numele elevului',
    TR: 'Öğrenci adı',
    AR: 'اسم الطالب',
    UK: 'Імʼя учня',
    RU: 'Имя ученика',
  },
  'intake.fields.schoolName': {
    IT: 'Nome scuola',
    DE: 'Name der Schule',
    EN: 'School name',
    FR: "Nom de l'école",
    ES: 'Nombre de la escuela',
    PL: 'Nazwa szkoły',
    RO: 'Numele școlii',
    TR: 'Okul adı',
    AR: 'اسم المدرسة',
    UK: 'Назва школи',
    RU: 'Название школы',
  },
  'intake.fields.absenceDates': {
    IT: 'Date assenze',
    DE: 'Abwesenheitsdaten',
    EN: 'Absence dates',
    FR: "Dates d'absence",
    ES: 'Fechas de ausencia',
    PL: 'Daty nieobecności',
    RO: 'Datele absenței',
    TR: 'Devamsızlık tarihleri',
    AR: 'تواريخ الغياب',
    UK: 'Дати відсутності',
    RU: 'Даты отсутствия',
  },
  'intake.fields.absenceReason': {
    IT: 'Motivo assenza',
    DE: 'Abwesenheitsgrund',
    EN: 'Absence reason',
    FR: "Motif d'absence",
    ES: 'Motivo de ausencia',
    PL: 'Powód nieobecności',
    RO: 'Motivul absenței',
    TR: 'Devamsızlık nedeni',
    AR: 'سبب الغياب',
    UK: 'Причина відсутності',
    RU: 'Причина отсутствия',
  },
  'intake.fields.classSection': {
    IT: 'Classe/sezione',
    DE: 'Klasse/Abschnitt',
    EN: 'Class/section',
    FR: 'Classe/section',
    ES: 'Clase/sección',
    PL: 'Klasa/sekcja',
    RO: 'Clasa/secția',
    TR: 'Sınıf/bölüm',
    AR: 'الصف/القسم',
    UK: 'Клас/секція',
    RU: 'Класс/секция',
  },
  'intake.fields.schoolAddress': {
    IT: 'Indirizzo scuola',
    DE: 'Adresse der Schule',
    EN: 'School address',
    FR: "Adresse de l'école",
    ES: 'Dirección de la escuela',
    PL: 'Adres szkoły',
    RO: 'Adresa școlii',
    TR: 'Okul adresi',
    AR: 'عنوان المدرسة',
    UK: 'Адреса школи',
    RU: 'Адрес школы',
  },
  'intake.fields.recipient': {
    IT: 'Destinatario',
    DE: 'Empfänger',
    EN: 'Recipient',
    FR: 'Destinataire',
    ES: 'Destinatario',
    PL: 'Odbiorca',
    RO: 'Destinatar',
    TR: 'Alıcı',
    AR: 'المستلم',
    UK: 'Одержувач',
    RU: 'Получатель',
  },
  'intake.fields.contactInfo': {
    IT: 'Telefono/email',
    DE: 'Telefon/E-Mail',
    EN: 'Phone/email',
    FR: 'Téléphone/email',
    ES: 'Teléfono/email',
    PL: 'Telefon/email',
    RO: 'Telefon/email',
    TR: 'Telefon/e-posta',
    AR: 'الهاتف/البريد الإلكتروني',
    UK: 'Телефон/email',
    RU: 'Телефон/email',
  },
  'intake.fields.hasCertificate': {
    IT: 'Allegato certificato',
    DE: 'Zertifikat beigefügt',
    EN: 'Certificate attached',
    FR: 'Certificat joint',
    ES: 'Certificado adjunto',
    PL: 'Załączony certyfikat',
    RO: 'Certificat atașat',
    TR: 'Sertifika ektedir',
    AR: 'شهادة مرفقة',
    UK: 'Сертифікат додається',
    RU: 'Сертификат прилагается',
  },
  'intake.fields.senderName': {
    IT: 'Nome e cognome mittente',
    DE: 'Name des Absenders',
    EN: 'Sender name',
    FR: "Nom de l'expéditeur",
    ES: 'Nombre del remitente',
    PL: 'Imię i nazwisko nadawcy',
    RO: 'Numele expeditorului',
    TR: 'Gönderen adı',
    AR: 'اسم المرسل',
    UK: 'Імʼя відправника',
    RU: 'Имя отправителя',
  },
  'intake.fields.senderAddress': {
    IT: 'Indirizzo mittente',
    DE: 'Adresse des Absenders',
    EN: 'Sender address',
    FR: "Adresse de l'expéditeur",
    ES: 'Dirección del remitente',
    PL: 'Adres nadawcy',
    RO: 'Adresa expeditorului',
    TR: 'Gönderen adresi',
    AR: 'عنوان المرسل',
    UK: 'Адреса відправника',
    RU: 'Адрес отправителя',
  },
  'intake.fields.employerName': {
    IT: 'Nome datore di lavoro',
    DE: 'Name des Arbeitgebers',
    EN: 'Employer name',
    FR: "Nom de l'employeur",
    ES: 'Nombre del empleador',
    PL: 'Nazwa pracodawcy',
    RO: 'Numele angajatorului',
    TR: 'İşveren adı',
    AR: 'اسم صاحب العمل',
    UK: 'Імʼя роботодавця',
    RU: 'Имя работодателя',
  },
  'intake.fields.subject': {
    IT: 'Oggetto',
    DE: 'Betreff',
    EN: 'Subject',
    FR: 'Objet',
    ES: 'Asunto',
    PL: 'Temat',
    RO: 'Subiect',
    TR: 'Konu',
    AR: 'الموضوع',
    UK: 'Тема',
    RU: 'Тема',
  },
  'intake.fields.requestDetails': {
    IT: 'Dettagli richiesta',
    DE: 'Anfragedetails',
    EN: 'Request details',
    FR: 'Détails de la demande',
    ES: 'Detalles de la solicitud',
    PL: 'Szczegóły wniosku',
    RO: 'Detalii cerere',
    TR: 'Talep detayları',
    AR: 'تفاصيل الطلب',
    UK: 'Деталі запиту',
    RU: 'Детали запроса',
  },
  'intake.fields.employerAddress': {
    IT: 'Indirizzo datore di lavoro',
    DE: 'Adresse des Arbeitgebers',
    EN: 'Employer address',
    FR: "Adresse de l'employeur",
    ES: 'Dirección del empleador',
    PL: 'Adres pracodawcy',
    RO: 'Adresa angajatorului',
    TR: 'İşveren adresi',
    AR: 'عنوان صاحب العمل',
    UK: 'Адреса роботодавця',
    RU: 'Адрес работодателя',
  },
  'intake.fields.referenceNumber': {
    IT: 'Numero di riferimento',
    DE: 'Aktenzeichen',
    EN: 'Reference number',
    FR: 'Numéro de référence',
    ES: 'Número de referencia',
    PL: 'Numer referencyjny',
    RO: 'Număr de referință',
    TR: 'Referans numarası',
    AR: 'رقم المرجع',
    UK: 'Номер посилання',
    RU: 'Номер ссылки',
  },
  'intake.fields.tenantName': {
    IT: 'Nome inquilino',
    DE: 'Name des Mieters',
    EN: 'Tenant name',
    FR: 'Nom du locataire',
    ES: 'Nombre del inquilino',
    PL: 'Imię najemcy',
    RO: 'Numele chiriașului',
    TR: 'Kiracı adı',
    AR: 'اسم المستأجر',
    UK: 'Імʼя орендаря',
    RU: 'Имя арендатора',
  },
  'intake.fields.tenantAddress': {
    IT: 'Indirizzo inquilino',
    DE: 'Adresse des Mieters',
    EN: 'Tenant address',
    FR: 'Adresse du locataire',
    ES: 'Dirección del inquilino',
    PL: 'Adres najemcy',
    RO: 'Adresa chiriașului',
    TR: 'Kiracı adresi',
    AR: 'عنوان المستأجر',
    UK: 'Адреса орендаря',
    RU: 'Адрес арендатора',
  },
  'intake.fields.landlordName': {
    IT: 'Nome proprietario',
    DE: 'Name des Vermieters',
    EN: 'Landlord name',
    FR: 'Nom du propriétaire',
    ES: 'Nombre del propietario',
    PL: 'Imię właściciela',
    RO: 'Numele proprietarului',
    TR: 'Ev sahibi adı',
    AR: 'اسم المالك',
    UK: 'Імʼя орендодавця',
    RU: 'Имя арендодателя',
  },
  'intake.fields.landlordAddress': {
    IT: 'Indirizzo proprietario',
    DE: 'Adresse des Vermieters',
    EN: 'Landlord address',
    FR: 'Adresse du propriétaire',
    ES: 'Dirección del propietario',
    PL: 'Adres właściciela',
    RO: 'Adresa proprietarului',
    TR: 'Ev sahibi adresi',
    AR: 'عنوان المالك',
    UK: 'Адреса орендодавця',
    RU: 'Адрес арендодателя',
  },
  'intake.fields.contractDate': {
    IT: 'Data contratto',
    DE: 'Vertragsdatum',
    EN: 'Contract date',
    FR: 'Date du contrat',
    ES: 'Fecha del contrato',
    PL: 'Data umowy',
    RO: 'Data contractului',
    TR: 'Sözleşme tarihi',
    AR: 'تاريخ العقد',
    UK: 'Дата договору',
    RU: 'Дата договора',
  },
  'intake.fields.authorityName': {
    IT: 'Nome ente/ufficio',
    DE: 'Name der Behörde',
    EN: 'Authority name',
    FR: "Nom de l'autorité",
    ES: 'Nombre de la autoridad',
    PL: 'Nazwa urzędu',
    RO: 'Numele autorității',
    TR: 'Yetkili adı',
    AR: 'اسم السلطة',
    UK: 'Назва органу',
    RU: 'Название органа',
  },
  'intake.fields.authorityAddress': {
    IT: 'Indirizzo ente/ufficio',
    DE: 'Adresse der Behörde',
    EN: 'Authority address',
    FR: "Adresse de l'autorité",
    ES: 'Dirección de la autoridad',
    PL: 'Adres urzędu',
    RO: 'Adresa autorității',
    TR: 'Yetkili adresi',
    AR: 'عنوان السلطة',
    UK: 'Адреса органу',
    RU: 'Адрес органа',
  },
  'intake.fields.deadline': {
    IT: 'Scadenza',
    DE: 'Frist',
    EN: 'Deadline',
    FR: 'Date limite',
    ES: 'Fecha límite',
    PL: 'Termin',
    RO: 'Termen limită',
    TR: 'Son tarih',
    AR: 'الموعد النهائي',
    UK: 'Термін',
    RU: 'Срок',
  },
  'intake.fields.recipientName': {
    IT: 'Nome destinatario',
    DE: 'Name des Empfängers',
    EN: 'Recipient name',
    FR: 'Nom du destinataire',
    ES: 'Nombre del destinatario',
    PL: 'Imię odbiorcy',
    RO: 'Numele destinatarului',
    TR: 'Alıcı adı',
    AR: 'اسم المستلم',
    UK: 'Імʼя одержувача',
    RU: 'Имя получателя',
  },
  'intake.fields.recipientAddress': {
    IT: 'Indirizzo destinatario',
    DE: 'Adresse des Empfängers',
    EN: 'Recipient address',
    FR: 'Adresse du destinataire',
    ES: 'Dirección del destinatario',
    PL: 'Adres odbiorcy',
    RO: 'Adresa destinatarului',
    TR: 'Alıcı adresi',
    AR: 'عنوان المستلم',
    UK: 'Адреса одержувача',
    RU: 'Адрес получателя',
  },
  'intake.fields.content': {
    IT: 'Contenuto richiesta',
    DE: 'Anfrageinhalt',
    EN: 'Request content',
    FR: 'Contenu de la demande',
    ES: 'Contenido de la solicitud',
    PL: 'Treść wniosku',
    RO: 'Conținutul cererii',
    TR: 'Talep içeriği',
    AR: 'محتوى الطلب',
    UK: 'Зміст запиту',
    RU: 'Содержание запроса',
  },
};
