import { useEffect, useRef, useState, useCallback, ChangeEvent, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAnonymousTermsCheck } from '@/hooks/useAnonymousTermsCheck';
import { AnonymousTermsDialog } from '@/components/AnonymousTermsDialog';
import { InAppCamera } from '@/components/InAppCamera';
import {
  Loader2,
  Send,
  User,
  Sparkles,
  Camera,
  Paperclip,
  Copy,
  Check,
  FileText,
  Image as ImageIcon,
  Printer,
  Mail,
  Eye,
  Mic,
  Square,
  ChevronDown,
  Trash2,
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
// InAppCamera import removed - camera now handled on /scan page
import { useAuth } from '@/contexts/AuthContext';
import { usePlanState } from '@/hooks/usePlanState';
import { useEntitlements } from '@/hooks/useEntitlements';
import { supabase } from '@/integrations/supabase/client';
import { useDemoChatInactivityReset } from '@/hooks/useDemoChatInactivityReset';
import { RegistrationGate } from '@/components/RegistrationGate';
import { useIsMobile } from '@/hooks/use-mobile';
import { MobileDocumentPrompt } from '@/components/MobilePWAPrompt';
import { isLegalAdministrativeQuery } from '@/lib/aiGuardrail';
import { runCanonicalPipeline, isHeicFile, HEIC_NOT_SUPPORTED_MSG, type AnalysisItem } from '@/lib/canonicalPipeline';
import { shouldSearchLegalInfo, searchLegalInfoWithTimeout, buildLegalSearchQuery, type LegalSearchResult } from '@/services/webSearch';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  attachmentType?: 'image' | 'pdf' | null;
}

// Demo chat limit (user messages). Generous limit to encourage document completion.
const MESSAGE_LIMIT = 20;
const DISCLAIMER_TRIGGER = 1;

const DEMO_SESSION_KEY = 'lexora_demo_chat_session_v2';
const DEMO_MESSAGES_KEY = 'lexora_demo_chat_messages_v1';
const DEMO_DRAFT_KEY = 'lexora_demo_draft_text_v1';
// Safety buffer to prevent any data loss on unexpected reloads
const DEMO_BUFFER_KEY = 'lexora_demo_chat_buffer_v1';
// Tracks where the AI context should start (UI can keep full history, AI must not).
const DEMO_AI_CONTEXT_KEY = 'lexora_demo_ai_context_start_v1';
// Key to migrate demo chat to dashboard after registration
export const DEMO_PENDING_MIGRATION_KEY = 'lexora_demo_pending_migration_v1';

/** Mock AI reply in demo mode – no backend, no auth, works in all UI languages */
const DEMO_MOCK_REPLY_BY_LANG: Record<string, string> = {
  IT: "Questa è una demo di Lexora. Nella versione completa puoi caricare una lettera ufficiale, ricevere un'analisi dei rischi e una risposta pronta da inviare.",
  EN: "This is a Lexora demo. In the full version you can upload an official letter, get a risk analysis and a ready-to-send response.",
  DE: "Dies ist eine Lexora-Demo. In der Vollversion können Sie ein offizielles Schreiben hochladen, eine Risikoanalyse und eine versandfertige Antwort erhalten.",
  FR: "Ceci est une démo Lexora. Dans la version complète vous pouvez télécharger une lettre officielle, recevoir une analyse des risques et une réponse prête à envoyer.",
  ES: "Esta es una demo de Lexora. En la versión completa puedes subir una carta oficial, recibir un análisis de riesgos y una respuesta lista para enviar.",
  PL: "To jest demo Lexora. W pełnej wersji możesz przesłać oficjalny list, uzyskać analizę ryzyka i gotową odpowiedź.",
  RO: "Aceasta este o demonstrație Lexora. În versiunea completă poți încărca o scrisoare oficială, primi o analiză a riscurilor și un răspuns gata de trimis.",
  TR: "Bu bir Lexora demosudur. Tam sürümde resmi bir mektup yükleyebilir, risk analizi ve gönderilmeye hazır yanıt alabilirsiniz.",
  AR: "هذا عرض تجريبي لـ Lexora. في النسخة الكاملة يمكنك تحميل خطاب رسمي والحصول على تحليل للمخاطر ورد جاهز للإرسال.",
  UK: "Це демо Lexora. У повній версії ви можете завантажити офіційний лист, отримати аналіз ризикіv та готову відповідь.",
  RU: "Это демо Lexora. В полной версии вы можете загрузить официальное письмо, получить анализ рисков и готовый ответ.",
};
const DEMO_MOCK_REPLY_FALLBACK = DEMO_MOCK_REPLY_BY_LANG.EN;

/** First message in demo: Lexora asks for situation (conversion-oriented) */
const DEMO_GREETING_BY_LANG: Record<string, string> = {
  IT: "Ciao, sono Lexora. Descrivimi brevemente la tua situazione legale così vedo come posso aiutarti.",
  EN: "Hi, I'm Lexora. Describe your legal situation briefly so I can see how to help you.",
  DE: "Hallo, ich bin Lexora. Schildern Sie kurz Ihre rechtliche Situation, damit ich sehen kann, wie ich helfen kann.",
  FR: "Bonjour, je suis Lexora. Décrivez brièvement votre situation juridique pour que je puisse vous aider.",
  ES: "Hola, soy Lexora. Descríbeme brevemente tu situación legal para ver cómo puedo ayudarte.",
  PL: "Cześć, jestem Lexora. Opisz krótko swoją sytuację prawną, abym mógł zobaczyć, jak mogę pomóc.",
  RO: "Bună, sunt Lexora. Descrie-mi pe scurt situația ta juridică ca să văd cum te pot ajuta.",
  TR: "Merhaba, ben Lexora. Bana kısa bir şekilde hukuki durumunuzu anlatın, nasıl yardımcı olabileceğimi göreyim.",
  AR: "مرحباً، أنا Lexora. صف لي وضعك القانوني باختصار لأرى كيف أستطيع مساعدتك.",
  UK: "Привіт, я Lexora. Коротко опиши свою правову ситуацію, щоб я міг побачити, як допомогти.",
  RU: "Привет, я Lexora. Кратко опишите вашу правовую ситуацию, чтобы я мог понять, как помочь.",
};

/** Badge text: "Demo gratuita – nessun login richiesto" in all UI languages */
const DEMO_BADGE_BY_LANG: Record<string, string> = {
  IT: "Demo gratuita – nessun login richiesto",
  EN: "Free demo – no login required",
  DE: "Kostenlose Demo – keine Anmeldung",
  FR: "Démo gratuite – pas de connexion",
  ES: "Demo gratuita – sin registro",
  PL: "Darmowe demo – bez logowania",
  RO: "Demo gratuit – fără autentificare",
  TR: "Ücretsiz demo – giriş gerekmez",
  AR: "عرض تجريبي مجاني – لا حاجة لتسجيل الدخول",
  UK: "Безкоштовна демо – без входу",
  RU: "Бесплатная демо – без входа",
};
const DEMO_BADGE_FALLBACK = DEMO_BADGE_BY_LANG.EN;

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

interface SessionData {
  count: number;
  firstMessageAt: number;
  dateKey?: string;
}

function getLocalDateKey(): string {
  // Local day key, resets at local midnight (not rolling 24h)
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getSessionData(): SessionData {
  try {
    const data = localStorage.getItem(DEMO_SESSION_KEY);
    if (!data) return { count: 0, firstMessageAt: 0 };
    const parsed = JSON.parse(data);

     // Preferred: reset at local midnight (date key)
     const todayKey = getLocalDateKey();
     if (parsed.dateKey && parsed.dateKey !== todayKey) {
       localStorage.removeItem(DEMO_SESSION_KEY);
       return { count: 0, firstMessageAt: 0, dateKey: todayKey };
     }
    
    if (parsed.firstMessageAt && Date.now() - parsed.firstMessageAt >= TWENTY_FOUR_HOURS_MS) {
      localStorage.removeItem(DEMO_SESSION_KEY);
      return { count: 0, firstMessageAt: 0 };
    }
    
    return {
      count: typeof parsed.count === 'number' ? parsed.count : 0,
      firstMessageAt: typeof parsed.firstMessageAt === 'number' ? parsed.firstMessageAt : 0,
       dateKey: typeof parsed.dateKey === 'string' ? parsed.dateKey : undefined,
    };
  } catch {
    return { count: 0, firstMessageAt: 0 };
  }
}

function getSessionCount(): number {
  return getSessionData().count;
}

function incrementSessionCount(): number {
  try {
    const current = getSessionData();
    const next = current.count + 1;
    const firstMessageAt = current.firstMessageAt || Date.now();
    const dateKey = current.dateKey || getLocalDateKey();
    localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify({ count: next, firstMessageAt, dateKey }));
    return next;
  } catch {
    return getSessionCount() + 1;
  }
}

function readAiContextStart(): number {
  try {
    const raw = localStorage.getItem(DEMO_AI_CONTEXT_KEY);
    if (!raw) return 0;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

function writeAiContextStart(n: number) {
  try {
    localStorage.setItem(DEMO_AI_CONTEXT_KEY, String(Math.max(0, Math.floor(n))));
  } catch {
    // ignore
  }
}

function getSavedMessages(): ChatMessage[] {
  try {
    const data = localStorage.getItem(DEMO_MESSAGES_KEY);
    if (!data) return [];
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((m: any) => ({
      role: m.role,
      content: m.content,
      timestamp: new Date(m.timestamp),
      attachmentType: m.attachmentType || null,
    }));
  } catch {
    return [];
  }
}

function saveMessages(messages: ChatMessage[]) {
  try {
    localStorage.setItem(DEMO_MESSAGES_KEY, JSON.stringify(messages));
  } catch {
    // ignore
  }
}

function getSavedDraft(): string {
  try {
    return localStorage.getItem(DEMO_DRAFT_KEY) || '';
  } catch {
    return '';
  }
}

function saveDraft(text: string) {
  try {
    localStorage.setItem(DEMO_DRAFT_KEY, text);
  } catch {
    // ignore
  }
}

type DemoChatBuffer = {
  updatedAt: number;
  input: string;
  draftText: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    attachmentType?: 'image' | 'pdf' | null;
  }>;
};

function readDemoChatBuffer(): DemoChatBuffer | null {
  try {
    const raw = localStorage.getItem(DEMO_BUFFER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (!Array.isArray(parsed.messages)) return null;
    return parsed as DemoChatBuffer;
  } catch {
    return null;
  }
}

function writeDemoChatBuffer(buffer: DemoChatBuffer): void {
  try {
    localStorage.setItem(DEMO_BUFFER_KEY, JSON.stringify(buffer));
  } catch {
    // ignore
  }
}

function getSafeText(t: (key: string) => string, key: string, fallback: string): string {
  const result = t(key);
  if (!result || result === key || (result.includes('.') && !result.includes(' '))) {
    return fallback;
  }
  return result;
}

/** Format pipeline analysis for display in chat (OCR + analysis summary). */
function formatAnalysisForChat(analysis: AnalysisItem | undefined, ocrSnippet?: string): string {
  const parts: string[] = [];
  if (analysis?.summary) parts.push(`**Summary:** ${analysis.summary}`);
  if (analysis?.deadlines?.length) parts.push(`**Deadlines:** ${analysis.deadlines.join('; ')}`);
  if (analysis?.risks?.length) parts.push(`**Risks:** ${analysis.risks.join('; ')}`);
  if (analysis?.suggested_action) parts.push(`**Suggested action:** ${analysis.suggested_action}`);
  if (ocrSnippet && ocrSnippet.trim()) parts.push(`\n*Extracted text (excerpt):*\n${ocrSnippet.trim().slice(0, 500)}${ocrSnippet.length > 500 ? '…' : ''}`);
  return parts.length ? parts.join('\n\n') : 'Analysis completed. See draft below.';
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
  });
}

function getFileExtension(name: string): string {
  const idx = name.lastIndexOf('.');
  if (idx === -1) return '';
  return name.slice(idx + 1).toLowerCase();
}

function isHeicLike(file: File): boolean {
  const ext = getFileExtension(file.name);
  if (file.type.includes('heic') || file.type.includes('heif')) return true;
  if (!file.type && (ext === 'heic' || ext === 'heif')) return true;
  return false;
}

function isLikelyImage(file: File): boolean {
  if (file.type.startsWith('image/')) return true;
  const ext = getFileExtension(file.name);
  return ['jpg', 'jpeg', 'png', 'webp'].includes(ext);
}

function isLikelyPdf(file: File): boolean {
  if (file.type === 'application/pdf') return true;
  const ext = getFileExtension(file.name);
  return ext === 'pdf';
}

function guessMimeType(file: File): string {
  if (file.type) return file.type;
  const ext = getFileExtension(file.name);
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  return 'application/octet-stream';
}

function extractLetterFromResponse(text: string): string | null {
  if (!text) return null;
  
  const markerMatch = text.match(/\[LETTER\]([\s\S]*?)\[\/LETTER\]/i);
  
  if (markerMatch && markerMatch[1]) {
    const extracted = markerMatch[1].trim();
    if (extracted.length >= 50) {
      return extracted;
    }
  }
  
  return extractFormalLetterFallback(text);
}

function extractFormalLetterFallback(text: string): string | null {
  if (!text || text.length < 100) return null;

  const hasSubject = /\b(oggetto|betreff|subject|objet|asunto|re:|betrifft)\s*:/i.test(text);
  const hasOpening = /\b(egregio|gentile|spett\.?\s*(le|li|mo)|sehr\s+geehrte|dear\s+(sir|madam|mr|ms)|to\s+whom|alla\s+cortese|geehrte\s+damen|guten\s+tag|an\s+die|an\s+das)/i.test(text);
  const hasClosing = /\b(cordiali\s+saluti|distinti\s+saluti|mit\s+freundlichen\s+grüßen|sincerely|best\s+regards|kind\s+regards|hochachtungsvoll|con\s+osservanza|freundliche\s+grüße|viele\s+grüße)/i.test(text);
  const hasAddress = /\b(absender|empfänger|mittente|destinatario|sender|recipient|indirizzo|adresse|straße|via|platz)\s*:/i.test(text);
  const hasDate = /\b(datum|data|date)\s*:/i.test(text) || /\d{1,2}[\.\-\/]\d{1,2}[\.\-\/]\d{2,4}/i.test(text);

  const markerCount = [hasSubject, hasOpening, hasClosing, hasAddress, hasDate].filter(Boolean).length;
  if (markerCount < 1) return null;

  let cleaned = text.replace(/```[\s\S]*?```/g, '').trim();

  const prefacePatterns: RegExp[] = [
    /^\s*(hallo,?\s*(ich\s+bin\s+)?lexora[^.]*\.\s*)/i,
    /^\s*(hello,?\s*(i'?m\s+)?lexora[^.]*\.\s*)/i,
    /^\s*(ciao,?\s*(sono\s+)?lexora[^.]*\.\s*)/i,
    /^\s*(certamente|certo|ecco(\s+la)?|ti\s+propongo|qui\s+trovi|di\s+seguito)[^:]*:\s*/i,
    /^\s*(sure|of\s+course|here\s+is|below\s+is|here'?s)[^:]*:\s*/i,
    /^\s*(sehr\s+gern|natürlich|hier\s+ist|im\s+folgenden|gerne)[^:]*:\s*/i,
  ];
  for (const p of prefacePatterns) {
    cleaned = cleaned.replace(p, '');
  }
  cleaned = cleaned.trim();

  const endPatterns: RegExp[] = [
    /(mit\s+freundlichen\s+grüßen[\s\S]*?)(?=\n\s*\n\s*#{1,6}|\n\s*\n\s*\*\*(?![\w])|$)/i,
    /(freundliche\s+grüße[\s\S]*?)(?=\n\s*\n\s*#{1,6}|\n\s*\n\s*\*\*(?![\w])|$)/i,
    /(cordiali\s+saluti[\s\S]*?)(?=\n\s*\n\s*#{1,6}|\n\s*\n\s*\*\*(?![\w])|$)/i,
    /(distinti\s+saluti[\s\S]*?)(?=\n\s*\n\s*#{1,6}|\n\s*\n\s*\*\*(?![\w])|$)/i,
    /(sincerely[\s\S]*?)(?=\n\s*\n\s*#{1,6}|\n\s*\n\s*\*\*(?![\w])|$)/i,
    /(best\s+regards[\s\S]*?)(?=\n\s*\n\s*#{1,6}|\n\s*\n\s*\*\*(?![\w])|$)/i,
  ];

  for (const p of endPatterns) {
    const m = cleaned.match(p);
    if (m && m.index != null) {
      const signatureEnd = m.index + m[0].length;
      const afterSignature = cleaned.slice(signatureEnd);
      const nameMatch = afterSignature.match(/^[\s\n]*([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)*)/);
      if (nameMatch) {
        return cleaned.slice(0, signatureEnd + nameMatch.index! + nameMatch[0].length).trim();
      }
      return cleaned.slice(0, signatureEnd).trim();
    }
  }

  return cleaned.length >= 100 ? cleaned : null;
}

/**
 * Clean [LETTER] and [/LETTER] tags from text for display in chat
 */
function cleanLetterTags(text: string): string {
  if (!text) return text;
  return text
    .replace(/\[LETTER\]/gi, '')
    .replace(/\[\/LETTER\]/gi, '')
    .trim();
}

export function DemoChatSection() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  /** Demo mode: no auth, no backend, no Supabase, no rate limit – chat always works */
  const qsDemo = new URLSearchParams(location.search).get('demo') === '1';
  const envDemo = import.meta.env.VITE_DEMO_MODE === 'true' || import.meta.env.VITE_DEMO_MODE === true;
  const pathDemo = location.pathname.includes('/demo');
  const demoMode = Boolean(qsDemo || pathDemo || envDemo || !user);

  /** Normalizza lingua per mock (evita undefined) */
  const normalizeLang = useCallback((l?: string) => (l || 'en').slice(0, 2).toUpperCase(), []);
  const lang = normalizeLang(language);
  
  const { isPaid, isUnlimited } = usePlanState();
  const { isAdmin } = useEntitlements();

  // Anonymous terms acceptance - only for non-logged-in users (disabled in demo mode)
  const { needsAcceptance: anonNeedsTerms, acceptTerms: acceptAnonTerms } = useAnonymousTermsCheck();
  
  // Track if user attempted to interact - only show terms dialog on interaction, not on page load
  const [showTermsDialog, setShowTermsDialog] = useState(false);
  
  // Helper to check terms before interaction – never block in demo mode
  const checkTermsBeforeInteraction = useCallback(() => {
    if (demoMode) return true; // No auth/terms check in demo
    if (!user && anonNeedsTerms) {
      setShowTermsDialog(true);
      return false; // Block interaction
    }
    return true; // Allow interaction
  }, [demoMode, user, anonNeedsTerms]);
  
  // Handle terms acceptance
  const handleTermsAccept = useCallback(() => {
    acceptAnonTerms();
    setShowTermsDialog(false);
  }, [acceptAnonTerms]);

  const [messages, setMessages] = useState<ChatMessage[]>(() => getSavedMessages());
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionCount, setSessionCount] = useState(0);
  const [limitDialogOpen, setLimitDialogOpen] = useState(false);
  const [showUpgradePopup, setShowUpgradePopup] = useState(false);
  const [showSaveCasePopup, setShowSaveCasePopup] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  
  // SESSION STORAGE KEY for "declined save" flag - persists across refreshes within session
  const DECLINED_SAVE_SESSION_KEY = 'lexora_declined_save';
  
  // Check sessionStorage on mount to determine if user already declined
  const [userDeclinedSave, setUserDeclinedSave] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(DECLINED_SAVE_SESSION_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const [draftCopied, setDraftCopied] = useState(false);
  const [draftText, setDraftText] = useState<string>(() => getSavedDraft());
  const draftTextRef = useRef(draftText);
  
  // BUG FIX: Track whether a document was generated in the CURRENT session
  // This prevents action buttons from being enabled when draftText is restored from localStorage
  // but no document was actually generated in this conversation
  const [generatedInSession, setGeneratedInSession] = useState<boolean>(false);
  const hasIncrementedCounterThisSession = useRef(false);
  const [showSaveDocumentPWA, setShowSaveDocumentPWA] = useState(false);
  const isMobile = useIsMobile();

  // Keep full UI history, but do NOT allow old sessions/drafts to pollute AI context.
  // Default behavior: start AI context at the end of any restored history.
  const [aiContextStart, setAiContextStart] = useState<number>(() => readAiContextStart());

  // Restore from safety buffer (anti data-loss) on mount.
  // This buffer is intentionally NOT cleared by AI responses or document creation.
  useEffect(() => {
    const buf = readDemoChatBuffer();
    if (!buf) return;

    // Prefer restoring only when current state is empty (avoid clobbering live state).
    const hasAnyState = messages.length > 0 || draftText.length > 0 || input.length > 0;
    if (hasAnyState) return;

    const restoredMessages: ChatMessage[] = (buf.messages ?? []).map((m) => ({
      role: m.role,
      content: m.content,
      timestamp: new Date(m.timestamp),
      attachmentType: m.attachmentType ?? null,
    }));

    if (restoredMessages.length > 0) setMessages(restoredMessages);
    if (typeof buf.draftText === 'string' && buf.draftText) setDraftText(buf.draftText);
    if (typeof buf.input === 'string' && buf.input) setInput(buf.input);
  }, []); // run once

  // Demo: show Lexora greeting when chat is empty (conversion-oriented first message)
  useEffect(() => {
    if (!demoMode || messages.length !== 0) return;
    const greeting = DEMO_GREETING_BY_LANG[lang] || DEMO_GREETING_BY_LANG.EN;
    setMessages([{ role: 'assistant', content: greeting, timestamp: new Date() }]);
  }, [demoMode, messages.length, lang]);

  // Ensure AI context starts "fresh" when arriving with restored UI state.
  // This keeps the transcript visible, but prevents the AI from reusing old drafts/topics.
  useEffect(() => {
    // If no explicit context is set yet, default to ignoring the restored history.
    if (aiContextStart === 0 && messages.length > 0) {
      const next = messages.length;
      setAiContextStart(next);
      writeAiContextStart(next);
    }
  }, [aiContextStart, messages.length]);

  useEffect(() => {
    saveMessages(messages);
  }, [messages]);

  useEffect(() => {
    saveDraft(draftText);
  }, [draftText]);

  useEffect(() => {
    draftTextRef.current = draftText;
  }, [draftText]);

  // Continuously persist a safety buffer to prevent any data loss.
  useEffect(() => {
    writeDemoChatBuffer({
      updatedAt: Date.now(),
      input,
      draftText,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp.toISOString(),
        attachmentType: m.attachmentType ?? null,
      })),
    });
  }, [input, draftText, messages]);

  useEffect(() => {
    writeAiContextStart(aiContextStart);
  }, [aiContextStart]);

  const [showCamera, setShowCamera] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [processingStep, setProcessingStep] = useState<'idle' | 'uploading' | 'ocr' | 'analyzing' | 'completed'>('idle');
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const isRecordingRef = useRef(false);
  const finalTranscriptRef = useRef('');
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isSearchingLegal, setIsSearchingLegal] = useState(false);
  
  const openLetterOnlyPreviewWithText = (text: string) => {
    const trimmed = (text || '').trim();
    if (!trimmed) {
      toast.error(txt.noDraft);
      return;
    }
    try {
      sessionStorage.setItem(DEMO_LETTER_SESSION_KEY, trimmed);
    } catch {
      // ignore
    }
    navigate('/demo/letter-preview');
  };

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // Auto-reset chat after 15 minutes of inactivity for privacy
  const resetChatForPrivacy = useCallback(() => {
    // Absolute rule: NEVER reset while recording.
    if (isRecordingRef.current || isListening) {
      return;
    }
    setMessages([]);
    setDraftText('');
    setInput('');
    setAiContextStart(0);
    localStorage.removeItem(DEMO_MESSAGES_KEY);
    localStorage.removeItem(DEMO_DRAFT_KEY);
    localStorage.removeItem(DEMO_BUFFER_KEY);
    localStorage.removeItem(DEMO_AI_CONTEXT_KEY);
    console.log('[DemoChat] Chat reset for privacy after inactivity');
  }, [isListening]);

  const hasChatData = messages.length > 0 || draftText.length > 0;
  useDemoChatInactivityReset(resetChatForPrivacy, hasChatData, { blockReset: isListening });

  // Short placeholder translations
  const placeholderByLang: Record<string, string> = {
    IT: 'Scrivi qui...',
    DE: 'Schreiben Sie hier...',
    EN: 'Write here...',
    FR: 'Écrivez ici...',
    ES: 'Escribe aquí...',
    PL: 'Napisz tutaj...',
    RO: 'Scrie aici...',
    TR: 'Buraya yazın...',
    AR: 'اكتب هنا...',
    UK: 'Пишіть тут...',
    RU: 'Напишите здесь...',
  };

  // Clear conversation button labels (must be before txt)
  const clearConversationByLang: Record<string, string> = {
    IT: 'Cancella conversazione',
    DE: 'Unterhaltung löschen',
    EN: 'Clear conversation',
    FR: 'Effacer la conversation',
    ES: 'Borrar conversación',
    PL: 'Wyczyść rozmowę',
    RO: 'Șterge conversația',
    TR: 'Konuşmayı sil',
    AR: 'مسح المحادثة',
    UK: 'Очистити розмову',
    RU: 'Очистить разговор',
  };

  const txt = {
    sectionTitle: getSafeText(t, 'demoChat.sectionTitle', 'Try Lexora now'),
    placeholder: placeholderByLang[language] || 'Write here...',
    emptyState: getSafeText(t, 'demoChat.emptyState', 'Upload a document or describe what happened.'),
    thinking: getSafeText(t, 'chat.thinking', 'Thinking...'),
    outOfScopeRefusal: getSafeText(t, 'chat.outOfScopeRefusal', 'I can only assist with legal and administrative matters.'),
    searchingLegalSources: getSafeText(t, 'chat.searchingLegalSources', '🔍 Searching for updated legal sources...'),
    limitTitle: getSafeText(t, 'demoChat.limit.title', 'Free preview ended'),
    limitBody: getSafeText(t, 'demoChat.limit.body', 'Create a free account to continue and save your case.'),
    limitSignup: getSafeText(t, 'demoChat.limit.signup', 'Create account'),
    limitLogin: getSafeText(t, 'demoChat.limit.login', 'Login'),
    close: getSafeText(t, 'common.close', 'Close'),
    errorToast: getSafeText(t, 'demoChat.error', 'Temporary error. Please try again.'),
    cameraPermTitle: getSafeText(t, 'demoChat.cameraPermission.title', 'Camera Access'),
    cameraPermBody: getSafeText(t, 'demoChat.cameraPermission.body', 'We need camera access to scan your document. Your photo is only used for text extraction.'),
    cameraPermAllow: getSafeText(t, 'demoChat.cameraPermission.allow', 'Allow Camera'),
    processingOCR: getSafeText(t, 'demoChat.processingOCR', 'Extracting text...'),
    ocrSuccess: getSafeText(t, 'demoChat.ocrSuccess', 'Text extracted from document'),
    ocrError: getSafeText(t, 'demoChat.ocrError', 'Could not read document. Please try again.'),
    copied: getSafeText(t, 'chat.copied', 'Copied!'),
    copy: getSafeText(t, 'chat.copy', 'Copy'),
    scanDocument: getSafeText(t, 'demoChat.scanDocument', 'Scan'),
    uploadFile: getSafeText(t, 'demoChat.uploadFile', 'Upload'),
    print: getSafeText(t, 'demoChat.print', 'Print'),
    email: getSafeText(t, 'demoChat.email', 'Email'),
    chatCleared: getSafeText(t, 'demoChat.chatCleared', 'Chat cleared'),
    noDraft: getSafeText(t, 'demoChat.noDraft', 'No letter draft available yet'),
    emailSubject: getSafeText(t, 'demoChat.emailSubject', 'Lexora Draft Letter'),
    preview: getSafeText(t, 'demoChat.preview', 'Preview'),
    copyLetter: getSafeText(t, 'demoChat.copyLetter', 'Copy'),
    previewTitle: getSafeText(t, 'demoChat.previewTitle', 'Response preview'),
    previewSubtitle: getSafeText(t, 'demoChat.previewSubtitle', 'Write a message to start'),
    listening: getSafeText(t, 'demoChat.listening', 'Listening...'),
    // Processing steps
    stepUploading: getSafeText(t, 'analysis.uploading', 'Uploading document...'),
    stepExtracting: getSafeText(t, 'analysis.extracting', 'Extracting text...'),
    stepAnalyzing: getSafeText(t, 'analysis.analyzing', 'AI analyzing content...'),
    stepCompleted: getSafeText(t, 'analysis.completed', 'Analysis complete'),
    clearConversation: clearConversationByLang[language] || 'Clear conversation',
  };

  // Local fallback for the "letter generated" confirmation so it never shows in English
  // if a locale key is missing.
  const letterGeneratedByLang: Record<string, string> = {
    IT: 'Documento generato! Usa i pulsanti qui sotto per copiare, stampare o inviare via email.',
    DE: 'Brief erstellt! Nutze die Buttons unten zum Kopieren, Drucken oder per E‑Mail senden.',
    EN: 'Letter generated! Use the buttons below to copy, print or email.',
    FR: 'Lettre générée ! Utilisez les boutons ci‑dessous pour copier, imprimer ou envoyer par e‑mail.',
    ES: '¡Carta generada! Usa los botones de abajo para copiar, imprimir o enviar por correo.',
    PL: 'Pismo wygenerowane! Użyj przycisków poniżej, aby skopiować, wydrukować lub wysłać e‑mail.',
    RO: 'Scrisoare generată! Folosește butoanele de mai jos pentru a copia, imprima sau trimite prin e‑mail.',
    TR: 'Belge oluşturuldu! Kopyalamak, yazdırmak veya e‑posta göndermek için aşağıdaki düğmeleri kullanın.',
    AR: 'تم إنشاء الخطاب! استخدم الأزرار أدناه للنسخ أو الطباعة أو الإرسال عبر البريد الإلكتروني.',
    UK: 'Лист створено! Використайте кнопки нижче, щоб скопіювати, надрукувати або надіслати e‑mail.',
    RU: 'Письмо создано! Используйте кнопки ниже, чтобы скопировать, распечатать или отправить по почте.',
  };

  // Initialize speech recognition - CONTINUOUS MODE for iOS/Safari compatibility
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSpeechSupported(true);
    } else {
      setSpeechSupported(false);
    }
  }, []);

  // Helper to update input and auto-scroll
  const updateInputWithScroll = useCallback((text: string) => {
    setInput(text);
    // Use requestAnimationFrame to ensure DOM has updated
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(text.length, text.length);
        el.scrollLeft = el.scrollWidth;
      }
    });
  }, []);

  // Create and start recognition
  const startRecording = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('Voice input not supported in this browser');
      return;
    }

    // Reset state
    finalTranscriptRef.current = input; // Start with current input
    isRecordingRef.current = true;
    setIsListening(true);

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language === 'DE' ? 'de-DE' : language === 'IT' ? 'it-IT' : language === 'FR' ? 'fr-FR' : language === 'ES' ? 'es-ES' : language === 'PL' ? 'pl-PL' : language === 'RO' ? 'ro-RO' : language === 'TR' ? 'tr-TR' : language === 'AR' ? 'ar-SA' : language === 'UK' ? 'uk-UA' : language === 'RU' ? 'ru-RU' : 'en-US';

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let sessionFinal = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          sessionFinal += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      // Update final transcript with new final results
      if (sessionFinal) {
        finalTranscriptRef.current += sessionFinal;
      }

      // Display final + interim
      const displayText = finalTranscriptRef.current + interimTranscript;
      updateInputWithScroll(displayText);
    };

    recognition.onend = () => {
      // Auto-restart if still recording (iOS/Safari closes stream frequently)
      if (isRecordingRef.current) {
        try {
          recognition.start();
        } catch (e) {
          console.warn('[Voice] Could not restart:', e);
          isRecordingRef.current = false;
          setIsListening(false);
        }
      } else {
        setIsListening(false);
      }
    };

    recognition.onerror = (event: any) => {
      const err = event?.error;
      console.warn('[Voice] Error:', err);
      
      if (err === 'not-allowed') {
        toast.error('Microphone permission denied');
        isRecordingRef.current = false;
        setIsListening(false);
      } else if (err === 'no-speech') {
        // Don't stop - just continue listening if still recording
        // The onend handler will restart if needed
      } else if (err === 'aborted') {
        // Expected when manually stopped - do nothing
      } else {
        // Other errors - stop gracefully
        isRecordingRef.current = false;
        setIsListening(false);
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch (e) {
      console.error('[Voice] Failed to start:', e);
      toast.error('Voice input unavailable');
      isRecordingRef.current = false;
      setIsListening(false);
    }
  }, [language, input, updateInputWithScroll]);

  // Stop recording
  const stopRecording = useCallback(() => {
    isRecordingRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Ignore
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  useEffect(() => {
    setSessionCount(getSessionCount());
  }, []);

  const exportText = draftText.trim();
  // BUG FIX: Enable export buttons ONLY when a draft was generated in the CURRENT session
  // This prevents buttons from being enabled when draftText is restored from localStorage
  // but the current conversation hasn't generated a document yet
  const hasLetterDraft = useMemo(() => exportText.length >= 50 && generatedInSession, [exportText, generatedInSession]);

  const shouldBypassLimits = Boolean(user) && (isAdmin || isUnlimited || isPaid);
  // Limit is reached ONLY if: limit exceeded AND a document was already generated
  // In demo mode: no limit (chat always works)
  const isLimitReached = demoMode ? false : (!shouldBypassLimits && sessionCount >= MESSAGE_LIMIT && hasLetterDraft);
  const showDisclaimer = sessionCount >= DISCLAIMER_TRIGGER;
  const trimmedInput = input.trim();
  
  // Note: Terms dialog is shown on user interaction, not on page load

  const DEMO_LETTER_SESSION_KEY = 'lexora_demo_letter_draft_v1';

  const openLetterOnlyPreview = () => openLetterOnlyPreviewWithText(exportText);

  const scrollToBottom = () => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }
  };

  // Auto-scroll to bottom when loading starts (to show thinking indicator)
  useEffect(() => {
    if (isLoading && messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [isLoading]);

  // Check scroll position to show/hide scroll button
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      setShowScrollButton(distanceFromBottom > 100);
    };

    container.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial check

    return () => container.removeEventListener('scroll', handleScroll);
  }, [messages.length]);

  const handleCopy = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      toast.success(txt.copied);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {
      toast.error('Copy failed');
    }
  };

  /** Canonical pipeline: upload → ocr → analyze-and-draft. Returns { text, analysis, draft } or null. */
  const processOCRSingle = async (
    file: File,
    isDemo?: boolean,
    source?: 'upload' | 'camera'
  ): Promise<{ text: string | null; analysis?: AnalysisItem; draft?: string; error?: string; details?: string }> => {
    if (isDemo) return { text: null };
    if (isHeicFile(file)) {
      toast.error(HEIC_NOT_SUPPORTED_MSG, { duration: 6000 });
      return { text: null, error: 'HEIC_NOT_SUPPORTED', details: HEIC_NOT_SUPPORTED_MSG };
    }
    try {
      const result = await runCanonicalPipeline(file, {
        source: source ?? 'upload',
        onProgress: (step) => {
          if (step === 'uploading') setProcessingStep('uploading');
          else if (step === 'ocr') setProcessingStep('ocr');
          else if (step === 'analyzing') setProcessingStep('analyzing');
          else setProcessingStep('completed');
        },
        userLanguage: language?.toUpperCase().slice(0, 2) || 'DE',
      });
      return {
        text: result.ocr_text || null,
        analysis: result.analysis as AnalysisItem,
        draft: result.draft_text,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { text: null, error: msg, details: msg };
    }
  };

  const processOCR = async (file: File): Promise<string | null> => {
    setIsProcessingFile(true);
    setProcessingStep('uploading');
    try {
      const result = await processOCRSingle(file, demoMode);
      if (result.text) {
        toast.success(txt.ocrSuccess);
        return result.text;
      }
      toast.error(result.details || result.error || txt.ocrError, { duration: 7000 });
      return null;
    } finally {
      setProcessingStep('idle');
      setIsProcessingFile(false);
    }
  };

  const sendMessage = useCallback(async (messageContent: string, attachmentType?: 'image' | 'pdf' | null) => {
    if (isLoading || !messageContent.trim()) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: messageContent.trim(),
      timestamp: new Date(),
      attachmentType,
    };

    // Demo mode: call API with isDemo=true (Lexora asks questions, then CTA; no static mock)
    // Check terms before allowing interaction (skipped in demo via checkTermsBeforeInteraction)
    if (!checkTermsBeforeInteraction()) return;

    if (isLimitReached) {
      setShowUpgradePopup(true);
      return;
    }

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Guardrail: block non-legal/administrative queries (skip in demo so "Ciao" / first message is allowed)
    if (!demoMode && !isLegalAdministrativeQuery(messageContent.trim())) {
      toast.error(txt.outOfScopeRefusal);
      setMessages(prev => prev.slice(0, -1));
      setIsLoading(false);
      return;
    }

    const isFirstMessage = messages.length === 0 || (demoMode && messages.length === 1 && messages[0].role === 'assistant');

    // Legal web search: if message matches patterns (recent law, decree, Cassation, etc.), fetch official sources first
    let legalSearchContext: LegalSearchResult[] = [];
    if (shouldSearchLegalInfo(messageContent.trim())) {
      setIsSearchingLegal(true);
      try {
        legalSearchContext = await searchLegalInfoWithTimeout(
          buildLegalSearchQuery(messageContent.trim()),
          language.toLowerCase().slice(0, 2),
          3
        );
      } finally {
        setIsSearchingLegal(false);
      }
    }

    // Build AI context from a "fresh" point onward.
    // Include conversation history AND the current draft so AI can remember it for follow-up requests.
    const sliced = [...messages.slice(aiContextStart), userMessage];
    
    // Clean the [LETTER] tags but KEEP the content so AI remembers what was generated
    const conversationHistory = sliced
      .filter((m) => {
        const c = (m.content || '').trim();
        if (!c) return false;
        // Exclude our synthetic confirmation text in any language (these are UI-only).
        if (Object.values(letterGeneratedByLang).includes(c)) return false;
        return true;
      })
      .map((m) => ({ 
        role: m.role, 
        // Clean [LETTER] tags for cleaner context but keep the content
        content: cleanLetterTags(m.content) 
      }));
    
    // If we have a draft, add it as context so AI remembers what was generated
    if (draftText && draftText.trim().length > 0) {
      // Check if the draft is already in the history (to avoid duplication)
      const draftInHistory = conversationHistory.some(
        (m) => m.role === 'assistant' && m.content.includes(draftText.trim().slice(0, 100))
      );
      if (!draftInHistory) {
        conversationHistory.push({
          role: 'assistant',
          content: `[Previously generated letter/document]:\n${draftText.trim()}`,
        });
      }
    }

    try {
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        apikey: anonKey,
      };
      if (anonKey) headers['Authorization'] = `Bearer ${anonKey}`;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/homepage-trial-chat`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ 
            message: messageContent.trim(), 
            language,
            isFirstMessage,
            conversationHistory,
            legalSearchContext: legalSearchContext.length > 0 ? legalSearchContext : undefined,
            isDemo: demoMode,
          }),
        }
      );

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.ok) {
        console.error('[DEBUG-demo-chat] API fallita:', { status: response.status, ok: data?.ok, error: data?.error, message: data?.message });
        const fallbackMsg = demoMode
          ? (lang === 'IT' ? 'Riprova tra poco o registrati per usare la chat completa.' : 'Try again in a moment or sign up to use the full chat.')
          : txt.errorToast;
        if (!demoMode) toast.error(txt.errorToast);
        setMessages(prev => [...prev, { role: 'assistant', content: fallbackMsg, timestamp: new Date() }]);
        scrollToBottom();
        return;
      }

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.reply || '',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Check if we got a valid letter draft from backend
      // IMPORTANT: Only trust the backend's draftText - do NOT do client-side extraction
      // The backend uses strict [LETTER] markers and filters out conversation summaries
      let newDraft: string | null = null;
      if (data.draftText && typeof data.draftText === 'string' && data.draftText.trim().length >= 50) {
        // Additional validation: ensure this is a formal letter, not a summary
        // Reject if it looks like a conversation summary (bullet points listing user data)
        const draftContent = data.draftText.trim();
        const isSummaryPattern = /^(thank you|grazie|danke|merci).*:\s*\n.*- (sender|mittente|absender|expéditeur):/i.test(draftContent) ||
          (draftContent.split(/\n\s*-\s+/).length > 3 && draftContent.length < 800);
        
        if (!isSummaryPattern) {
          newDraft = draftContent;
        }
      }

      if (newDraft) {
        setDraftText(newDraft);
        draftTextRef.current = newDraft;
        // BUG FIX: Mark that a document was generated in this session
        setGeneratedInSession(true);
        // Mobile-only: show PWA install prompt after generating a document
        if (isMobile) setTimeout(() => setShowSaveDocumentPWA(true), 600);
        // IMPORTANT: Do NOT reset AI context after document generation.
        // Keep full context so user can ask follow-up questions like "translate to German".
        // The AI needs to remember the conversation and the generated draft.
        
        // Add a confirmation message, keep full history for follow-ups.
        const letterGeneratedText = getSafeText(
          t,
          'demoChat.letterGenerated',
          letterGeneratedByLang[language] || letterGeneratedByLang.EN
        );
        const confirmation: ChatMessage = {
          role: 'assistant',
          content: letterGeneratedText,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, confirmation]);
        toast.success(confirmation.content);
        
        // Increment global document counter once per session (avoid spam from multiple drafts)
        if (!hasIncrementedCounterThisSession.current) {
          hasIncrementedCounterThisSession.current = true;
          (async () => {
            try {
              await supabase.rpc('increment_documents_processed');
            } catch {
              // Silently ignore errors - counter is not critical
            }
          })();
        }
      }

      const nextCount = incrementSessionCount();
      setSessionCount(nextCount);

      if (nextCount >= MESSAGE_LIMIT) {
        setTimeout(() => setShowUpgradePopup(true), 500);
      }

      setTimeout(scrollToBottom, 100);
    } catch (err) {
      console.error('[DEBUG-demo-chat] Eccezione sendMessage:', err);
      const fallbackMsg = demoMode
        ? (lang === 'IT' ? 'Riprova tra poco o registrati per usare la chat completa.' : 'Try again in a moment or sign up to use the full chat.')
        : (lang === 'IT' ? 'Si è verificato un errore. Riprova.' : 'Something went wrong. Please try again.');
      setMessages(prev => [...prev, { role: 'assistant', content: fallbackMsg, timestamp: new Date() }]);
      scrollToBottom();
    } finally {
      setIsLoading(false);
    }
  }, [
    isLoading,
    isLimitReached,
    demoMode,
    lang,
    messages,
    aiContextStart,
    draftText,
    language,
    t,
    txt.errorToast,
    letterGeneratedByLang,
    scrollToBottom,
    isMobile,
    checkTermsBeforeInteraction,
  ]);

  const handleSend = () => {
    // Check terms before interaction
    if (!checkTermsBeforeInteraction()) return;
    
    // CRITICAL: Capture the text BEFORE stopping recording to prevent race condition
    // When recording, use finalTranscriptRef (accumulated finalized speech) + any interim in input
    // This ensures we don't lose text when mic is stopped just before send
    const textToSend = isListening 
      ? (finalTranscriptRef.current || input).trim()
      : input.trim();
    
    // Stop recording before sending if active
    if (isListening) {
      stopRecording();
      // Clear the ref since we're capturing its value
      finalTranscriptRef.current = '';
    }
    
    if (textToSend) {
      sendMessage(textToSend);
    }
  };

  // Camera: restore original in-chat capture flow
  const handleCameraClick = () => {
    // Check terms before interaction
    if (!checkTermsBeforeInteraction()) return;
    
    if (isLimitReached) {
      setShowUpgradePopup(true)
      return;
    }
    setShowCamera(true);
  };

  // Upload: restore original file picker flow
  const handleFileClick = () => {
    if (isLimitReached) {
      setShowUpgradePopup(true);
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    console.log("[DEBUG-UPLOAD] DemoChatSection: prima upload", { numFiles: selected.length });
    if (selected.length === 0) return;

    for (const f of selected) {
      console.log("[DEBUG-UPLOAD] File:", f.name, f.size, f.type);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';

    // Demo mode: no backend/OCR – simulate steps and send mock reply
    if (demoMode) {
      setIsProcessingFile(true);
      setProcessingStep('uploading');
      await new Promise(r => setTimeout(r, 300));
      setProcessingStep('ocr');
      await new Promise(r => setTimeout(r, 400));
      setProcessingStep('analyzing');
      await new Promise(r => setTimeout(r, 400));
      setProcessingStep('idle');
      setIsProcessingFile(false);
      const uploadPlaceholder = language === 'IT' ? '[Documento caricato in demo]' : '[Document uploaded in demo]';
      await sendMessage(uploadPlaceholder);
      return;
    }

    const validFiles = selected.filter((file) => {
      if (isHeicLike(file)) {
        toast.error(`${file.name}: HEIC photos are not supported. Please select JPG/PNG or export/share as JPEG.`);
        return false;
      }

      const ok = isLikelyImage(file) || isLikelyPdf(file);
      if (!ok) {
        toast.error(`${file.name}: Please upload an image (JPG/PNG/WEBP) or PDF file.`);
      }
      return ok;
    });

    if (validFiles.length === 0) return;

    setIsProcessingFile(true);
    setProcessingStep('uploading');

    try {
      console.log("[DEBUG-UPLOAD] DemoChatSection: durante upload (pipeline)");
      const extractedParts: { name: string; text: string; isPDF: boolean; analysis?: AnalysisItem; draft?: string }[] = [];
      
      // Step 1: Uploading (handled inside processOCRSingle via pipeline)
      setProcessingStep('ocr');
      
      // Step 2: Run canonical pipeline per file (upload → ocr → analyze-and-draft)
      for (const file of validFiles) {
        console.log("[DEBUG-UPLOAD] File in pipeline:", file.name, file.size, file.type);
        const isPDF = isLikelyPdf(file);
        const ocrResult = await processOCRSingle(file, demoMode);
        console.log("[DEBUG-UPLOAD] Risposta processOCRSingle:", { name: file.name, hasText: !!ocrResult.text, hasDraft: !!ocrResult.draft, error: ocrResult.error });
        if (ocrResult.text !== null || ocrResult.draft) {
          extractedParts.push({
            name: file.name,
            text: ocrResult.text ?? '',
            isPDF,
            analysis: ocrResult.analysis as AnalysisItem | undefined,
            draft: ocrResult.draft,
          });
        } else {
          toast.error(`${file.name}: ${ocrResult.details || ocrResult.error || txt.ocrError}`, { duration: 7000 });
        }
      }

      if (extractedParts.length > 0) {
        // Use first part that has draft for display (canonical pipeline result)
        const withDraft = extractedParts.find((p) => p.draft && p.draft.trim().length >= 50);
        if (withDraft?.draft) {
          setDraftText(withDraft.draft);
          draftTextRef.current = withDraft.draft;
          setGeneratedInSession(true);
          const hasPDF = extractedParts.some((p) => p.isPDF);
          const hasImage = extractedParts.some((p) => !p.isPDF);
          const attachmentType: 'pdf' | 'image' = hasPDF && !hasImage ? 'pdf' : 'image';
          const userLabel =
            extractedParts.length === 1
              ? hasPDF
                ? '[PDF uploaded]'
                : '[Document uploaded]'
              : `[${extractedParts.length} documents uploaded]`;
          const ocrSnippet = extractedParts.length === 1 ? extractedParts[0].text : undefined;
          const analysisContent = formatAnalysisForChat(withDraft.analysis, ocrSnippet);
          setMessages((prev) => [
            ...prev,
            { role: 'user', content: userLabel, timestamp: new Date(), attachmentType },
            { role: 'assistant', content: analysisContent, timestamp: new Date() },
          ]);
          if (withDraft.draft.trim().length >= 50) {
            openLetterOnlyPreviewWithText(withDraft.draft);
          }
          if (isMobile) setTimeout(() => setShowSaveDocumentPWA(true), 600);
          if (!hasIncrementedCounterThisSession.current) {
            hasIncrementedCounterThisSession.current = true;
            (async () => {
              try {
                await supabase.rpc('increment_documents_processed');
              } catch {
                /* ignore */
              }
            })();
          }
          scrollToBottom();
          toast.success(`${extractedParts.length} ${extractedParts.length === 1 ? 'document' : 'documents'} processed`);
        } else {
          // Pipeline completed but no draft (e.g. analyze failed or empty)
          const userLabel =
            extractedParts.length === 1 ? '[Document uploaded]' : `[${extractedParts.length} documents uploaded]`;
          setMessages((prev) => [
            ...prev,
            { role: 'user', content: userLabel, timestamp: new Date() },
            {
              role: 'assistant',
              content: language === 'IT' ? 'Analisi non disponibile. Riprova.' : 'Analysis unavailable. Please try again.',
              timestamp: new Date(),
            },
          ]);
          toast.error(txt.ocrError);
        }
      } else {
        toast.error(txt.ocrError);
      }
      console.log("[DEBUG-UPLOAD] DemoChatSection: dopo upload", { extractedPartsCount: extractedParts.length });
    } catch (err) {
      console.error("[DEBUG-processDocument] ERRORE in handleFileChange (DemoChatSection):", err);
      console.error("[DEBUG-processDocument] Stack:", err instanceof Error ? err.stack : "(no stack)");
      throw err;
    } finally {
      setProcessingStep('idle');
      setIsProcessingFile(false);
    }
  };

  const handleSignup = () => {
    navigate('/auth?mode=signup');
    setLimitDialogOpen(false);
  };

  const handleLogin = () => {
    navigate('/auth');
    setLimitDialogOpen(false);
  };

  const toggleListening = useCallback(() => {
    // Check terms before interaction
    if (!checkTermsBeforeInteraction()) return;
    
    if (isListening) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isListening, startRecording, stopRecording, checkTermsBeforeInteraction]);

  const handleCopyDraft = async () => {
    if (!exportText) {
      toast.error(txt.noDraft);
      return;
    }
    try {
      await navigator.clipboard.writeText(exportText);
      setDraftCopied(true);
      toast.success(txt.copied);
      setTimeout(() => setDraftCopied(false), 2000);
      // Show save case popup for anonymous users after successful copy (unless they declined)
      if (!user && !userDeclinedSave) {
        setTimeout(() => setShowSaveCasePopup(true), 500);
      }
    } catch {
      toast.error('Copy failed');
    }
  };

  const handlePreview = () => {
    openLetterOnlyPreview();
    // Show save case popup for anonymous users after preview (unless they declined)
    if (!user && !userDeclinedSave) {
      setTimeout(() => setShowSaveCasePopup(true), 1000);
    }
  };
  
  const handlePrint = () => {
    openLetterOnlyPreview();
    // Show save case popup for anonymous users after print (unless they declined)
    if (!user && !userDeclinedSave) {
      setTimeout(() => setShowSaveCasePopup(true), 1000);
    }
  };

  // Handle clear conversation for privacy
  const handleClearConversation = useCallback(() => {
    // Don't clear while recording
    if (isRecordingRef.current || isListening) {
      toast.error('Stop recording first');
      return;
    }
    setMessages([]);
    setDraftText('');
    setInput('');
    setAiContextStart(0);
    // BUG FIX: Reset session-generated flag when clearing conversation
    setGeneratedInSession(false);
    localStorage.removeItem(DEMO_MESSAGES_KEY);
    localStorage.removeItem(DEMO_DRAFT_KEY);
    localStorage.removeItem(DEMO_BUFFER_KEY);
    localStorage.removeItem(DEMO_AI_CONTEXT_KEY);
    toast.success(txt.chatCleared);
  }, [isListening, txt.chatCleared]);

  const handleEmail = () => {
    if (!exportText) {
      toast.error(txt.noDraft);
      return;
    }

    const subject = encodeURIComponent('Draft reply – Lexora');
    const body = encodeURIComponent(exportText);

    const showSavePopupAfterEmail = () => {
      // Show save case popup for anonymous users after email (unless they declined)
      if (!user && !userDeclinedSave) {
        setTimeout(() => setShowSaveCasePopup(true), 500);
      }
    };

    if (body.length > 1800) {
      navigator.clipboard.writeText(exportText).then(() => {
        toast.success(txt.copied);
        const shortBody = encodeURIComponent('Draft copied to clipboard. Please paste it here.');
        window.location.href = `mailto:?subject=${subject}&body=${shortBody}`;
        showSavePopupAfterEmail();
      }).catch(() => {
        window.location.href = `mailto:?subject=${subject}&body=${body.slice(0, 1800)}`;
        showSavePopupAfterEmail();
      });
      return;
    }

    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    showSavePopupAfterEmail();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // DISABLED: Enter key does NOT send messages
    // Users must click the send button to submit
    // Shift+Enter is allowed for newlines (though input doesn't support it)
    if (e.key === 'Enter') {
      e.preventDefault();
      // Do nothing - only send button triggers message
      return;
    }
  };

  if (showCamera) {
    return (
      <InAppCamera
        onClose={() => setShowCamera(false)}
        onPhotosCaptured={async (files) => {
          // Reuse the same OCR + AI pipeline used for uploads.
          if (!files || files.length === 0) return;
          const validFiles = files.filter((f) => {
            if (isHeicLike(f)) {
              toast.error(`${f.name}: HEIC photos are not supported. Please select JPG/PNG or export/share as JPEG.`);
              return false;
            }
            if (!isLikelyImage(f)) {
              toast.error(`${f.name}: Please capture/upload a JPG/PNG/WEBP image.`);
              return false;
            }
            return true;
          });

          if (validFiles.length === 0) return;

          setIsProcessingFile(true);
          setProcessingStep('uploading');
          try {
            setProcessingStep('ocr');
            const extractedParts: { name: string; text: string; analysis?: AnalysisItem; draft?: string }[] = [];
            for (const file of validFiles) {
              const ocrResult = await processOCRSingle(file, demoMode, 'camera');
              if (ocrResult.text !== null || ocrResult.draft) {
                extractedParts.push({
                  name: file.name,
                  text: ocrResult.text ?? '',
                  analysis: ocrResult.analysis as AnalysisItem | undefined,
                  draft: ocrResult.draft,
                });
              } else {
                toast.error(`${file.name}: ${ocrResult.details || ocrResult.error || txt.ocrError}`, { duration: 7000 });
              }
            }

            if (extractedParts.length === 0) {
              toast.error(txt.ocrError);
              return;
            }

            const withDraft = extractedParts.find((p) => p.draft && p.draft.trim().length >= 50);
            if (withDraft?.draft) {
              setDraftText(withDraft.draft);
              draftTextRef.current = withDraft.draft;
              setGeneratedInSession(true);
              const userLabel =
                extractedParts.length === 1 ? '[Photo captured]' : `[${extractedParts.length} photos captured]`;
              const ocrSnippet = extractedParts.length === 1 ? extractedParts[0].text : undefined;
              const analysisContent = formatAnalysisForChat(withDraft.analysis, ocrSnippet);
              setMessages((prev) => [
                ...prev,
                { role: 'user', content: userLabel, timestamp: new Date(), attachmentType: 'image' },
                { role: 'assistant', content: analysisContent, timestamp: new Date() },
              ]);
              if (withDraft.draft.trim().length >= 50) {
                openLetterOnlyPreviewWithText(withDraft.draft);
              }
              if (isMobile) setTimeout(() => setShowSaveDocumentPWA(true), 600);
              if (!hasIncrementedCounterThisSession.current) {
                hasIncrementedCounterThisSession.current = true;
                (async () => {
                  try {
                    await supabase.rpc('increment_documents_processed');
                  } catch {
                    /* ignore */
                  }
                })();
              }
              scrollToBottom();
              toast.success(
                extractedParts.length === 1 ? (language === 'IT' ? 'Documento elaborato' : 'Document processed') : `${extractedParts.length} documents processed`
              );
            } else {
              const userLabel =
                extractedParts.length === 1 ? '[Photo captured]' : `[${extractedParts.length} photos captured]`;
              setMessages((prev) => [
                ...prev,
                { role: 'user', content: userLabel, timestamp: new Date() },
                {
                  role: 'assistant',
                  content: language === 'IT' ? 'Analisi non disponibile. Riprova.' : 'Analysis unavailable. Please try again.',
                  timestamp: new Date(),
                },
              ]);
              toast.error(txt.ocrError);
            }
          } finally {
            setProcessingStep('idle');
            setIsProcessingFile(false);
          }
        }}
      />
    );
  }

  return (
    <section className="demo-chat-premium">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      {/* MAIN CONTAINER with frame styling */}
      <div className="demo-frame-wrapper">
        {/* Golden Header Bar */}
        <div className="demo-gold-header">
          <span className="demo-fleur">❧</span>
          <Sparkles className="h-5 w-5" />
          <span className="demo-title">{txt.sectionTitle}</span>
          <span className="demo-fleur">❧</span>
        </div>
        {demoMode && (
          <div className="text-center py-1.5 px-2 text-xs font-medium text-muted-foreground bg-muted/50 rounded-b-md border-b border-border/50">
            {DEMO_BADGE_BY_LANG[lang] || DEMO_BADGE_FALLBACK}
          </div>
        )}

        {/* Inner content area (parchment look) */}
        <div className="demo-inner-content">
          {/* AI Response Box with internal scroll */}
          <div 
            ref={messagesContainerRef}
            className="demo-response-area"
          >
            {/* Processing OCR - Multi-step display - ALWAYS VISIBLE when processing */}
            {isProcessingFile && (
              <div className="demo-processing-overlay">
                <div className="demo-processing-box">
                  <div className="space-y-3">
                    {/* Progress Steps */}
                    <div className="flex flex-col gap-2">
                      {/* Step 1: Uploading */}
                      <div className={`flex items-center gap-2 transition-opacity ${processingStep === 'uploading' || processingStep === 'ocr' || processingStep === 'analyzing' ? 'opacity-100' : 'opacity-40'}`}>
                        {processingStep === 'uploading' ? (
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        ) : (
                          <Check className="h-4 w-4 text-success" />
                        )}
                        <span className={`text-sm ${processingStep === 'uploading' ? 'font-medium' : ''}`}>{txt.stepUploading}</span>
                      </div>
                      
                      {/* Step 2: Extracting */}
                      <div className={`flex items-center gap-2 transition-opacity ${processingStep === 'ocr' || processingStep === 'analyzing' ? 'opacity-100' : processingStep === 'uploading' ? 'opacity-40' : 'opacity-40'}`}>
                        {processingStep === 'ocr' ? (
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        ) : processingStep === 'analyzing' ? (
                          <Check className="h-4 w-4 text-success" />
                        ) : (
                          <div className="h-4 w-4 rounded-full border-2 border-muted" />
                        )}
                        <span className={`text-sm ${processingStep === 'ocr' ? 'font-medium' : ''}`}>{txt.stepExtracting}</span>
                      </div>
                      
                      {/* Step 3: Analyzing */}
                      <div className={`flex items-center gap-2 transition-opacity ${processingStep === 'analyzing' ? 'opacity-100' : 'opacity-40'}`}>
                        {processingStep === 'analyzing' ? (
                          <Sparkles className="h-4 w-4 animate-pulse text-primary" />
                        ) : (
                          <div className="h-4 w-4 rounded-full border-2 border-muted" />
                        )}
                        <span className={`text-sm ${processingStep === 'analyzing' ? 'font-medium' : ''}`}>{txt.stepAnalyzing}</span>
                      </div>
                    </div>
                    
                    {/* Progress bar */}
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary transition-all duration-500 ease-out rounded-full"
                        style={{ 
                          width: processingStep === 'uploading' ? '20%' : 
                                 processingStep === 'ocr' ? '50%' : 
                                 processingStep === 'analyzing' ? '85%' : '100%' 
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {messages.length === 0 && !isProcessingFile ? (
              <div className="demo-empty-state">
                <div className="demo-empty-icon">
                  <Sparkles className="h-10 w-10" />
                </div>
                <p>{txt.previewSubtitle}</p>
              </div>
            ) : messages.length > 0 ? (
              <>
                {messages.map((msg, index) => (
                  <div
                    key={index}
                    className={`demo-message ${msg.role === 'user' ? 'demo-message-user' : 'demo-message-ai'}`}
                  >
                    <div className="demo-message-avatar">
                      {msg.role === 'assistant' ? (
                        <Sparkles className="h-3.5 w-3.5" />
                      ) : (
                        <User className="h-3.5 w-3.5" />
                      )}
                    </div>
                    <div className={`demo-message-bubble ${msg.role === 'user' ? 'user-bubble' : 'ai-bubble'}`}>
                      {msg.attachmentType && (
                        <div className="attachment-badge">
                          {msg.attachmentType === 'image' ? (
                            <ImageIcon className="h-3 w-3" />
                          ) : (
                            <FileText className="h-3 w-3" />
                          )}
                          <span>{msg.attachmentType === 'pdf' ? 'PDF' : 'Image'}</span>
                        </div>
                      )}
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{cleanLetterTags(msg.content)}</p>
                      <button
                        onClick={() => handleCopy(msg.content, index)}
                        className="demo-copy-btn"
                        aria-label={txt.copy}
                      >
                        {copiedIndex === index ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      </button>
                    </div>
                  </div>
                ))}

                {/* Loading indicator */}
                {isLoading && (
                  <div className="demo-message demo-message-ai">
                    <div className="demo-message-avatar">
                      <Sparkles className="h-3.5 w-3.5" />
                    </div>
                    <div className="demo-message-bubble ai-bubble">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm opacity-70">{isSearchingLegal ? txt.searchingLegalSources : txt.thinking}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Disclaimer */}
                {showDisclaimer && messages.length > 0 && (
                  <div className="demo-disclaimer-inline">
                    ⚖️ Lexora is an AI assistant and does not provide legal advice.
                  </div>
                )}
              </>
            ) : null}
          </div>

          {/* Floating scroll-to-bottom button */}
          {showScrollButton && messages.length > 0 && (
            <button
              onClick={scrollToBottom}
              className="demo-scroll-btn"
              aria-label="Scroll to bottom"
            >
              <ChevronDown className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Input Bar - WhatsApp style */}
        <div 
          className="demo-input-bar"
          onClick={() => {
            // Show upgrade popup when user taps on disabled chat
            if (isLimitReached) {
              setShowUpgradePopup(true);
            }
          }}
        >
          {/* Mic button */}
          {speechSupported && (
            <button
              onClick={(e) => {
                if (isLimitReached) {
                  e.stopPropagation();
                  setShowUpgradePopup(true);
                  return;
                }
                toggleListening();
              }}
              disabled={isLoading || isProcessingFile}
              className={`demo-mic-btn ${isListening ? 'active' : ''} ${isLimitReached ? 'opacity-50' : ''}`}
              aria-label={isListening ? 'Stop' : 'Voice'}
            >
              {isListening ? <Square className="h-4 w-4" /> : <Mic className="h-5 w-5" />}
            </button>
          )}

          {/* Text input */}
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onClick={(e) => {
              // Check terms before interaction
              if (!checkTermsBeforeInteraction()) {
                e.preventDefault();
                return;
              }
              if (isLimitReached) {
                e.stopPropagation();
                setShowUpgradePopup(true);
              }
            }}
            onFocus={() => {
              // Check terms when user focuses input
              checkTermsBeforeInteraction();
            }}
            placeholder={isLimitReached ? txt.limitTitle : isListening ? txt.listening : txt.placeholder}
            className={`demo-text-input ${isListening ? 'listening' : ''} ${isLimitReached ? 'opacity-50 cursor-pointer' : ''}`}
            disabled={isLoading || isProcessingFile}
            readOnly={isListening || isLimitReached}
          />

          {/* Send button */}
          <button
            onClick={(e) => {
              if (isLimitReached) {
                e.stopPropagation();
                setShowUpgradePopup(true);
                return;
              }
              handleSend();
            }}
            disabled={(!trimmedInput && !isListening) || isLoading || isProcessingFile}
            className={`demo-send-btn ${isLimitReached ? 'opacity-50' : ''}`}
            aria-label="Send"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>

        {/* ALL 6 ACTION BUTTONS - 2x3 grid, ALWAYS VISIBLE */}
        <div className="demo-actions-grid">
          {/* Row 1 */}
          <button 
            onClick={() => {
              if (isLimitReached) {
                setShowUpgradePopup(true);
                return;
              }
              handleCameraClick();
            }} 
            disabled={isLoading || isProcessingFile} 
            className={`demo-action-btn ${isLimitReached ? 'opacity-60' : ''}`}
          >
            <Camera className="h-5 w-5" />
            <span>{txt.scanDocument}</span>
          </button>
          <button 
            onClick={() => {
              if (isLimitReached) {
                setShowUpgradePopup(true);
                return;
              }
              handleFileClick();
            }} 
            disabled={isLoading || isProcessingFile} 
            className={`demo-action-btn ${isLimitReached ? 'opacity-60' : ''}`}
          >
            <Paperclip className="h-5 w-5" />
            <span>{txt.uploadFile}</span>
          </button>

          {/* Row 2 */}
          <button 
            onClick={handleCopyDraft} 
            disabled={!hasLetterDraft}
            className="demo-action-btn"
          >
            {draftCopied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
            <span>{txt.copyLetter}</span>
          </button>
          <button 
            onClick={handlePreview} 
            disabled={!hasLetterDraft}
            className="demo-action-btn"
          >
            <Eye className="h-5 w-5" />
            <span>{txt.preview}</span>
          </button>

          {/* Row 3 */}
          <button 
            onClick={handlePrint} 
            disabled={!hasLetterDraft}
            className="demo-action-btn"
          >
            <Printer className="h-5 w-5" />
            <span>{txt.print}</span>
          </button>
          <button 
            onClick={handleEmail} 
            disabled={!hasLetterDraft}
            className="demo-action-btn"
          >
            <Mail className="h-5 w-5" />
            <span>{txt.email}</span>
          </button>
        </div>

        {/* Clear Conversation Button - spans full width for privacy */}
        {hasChatData && (
          <div className="demo-clear-row">
            <button 
              onClick={handleClearConversation}
              className="demo-clear-btn"
            >
              <Trash2 className="h-4 w-4" />
              <span>{txt.clearConversation}</span>
            </button>
          </div>
        )}
      </div>

      {/* Camera Permission Dialog - removed since camera is handled on /scan page */}

      {/* Limit Dialog */}
      <AlertDialog open={limitDialogOpen} onOpenChange={setLimitDialogOpen}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>{txt.limitTitle}</AlertDialogTitle>
            <AlertDialogDescription>{txt.limitBody}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <AlertDialogCancel>{txt.close}</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogin} className="bg-muted text-foreground hover:bg-muted/80">
              {txt.limitLogin}
            </AlertDialogAction>
            <AlertDialogAction onClick={handleSignup}>
              {txt.limitSignup}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Upgrade Popup for Limit Reached - saves chat for migration */}
      {showUpgradePopup && (
        <RegistrationGate 
          action="continue"
          onClose={() => {
            // Save messages for migration to dashboard after registration
            try {
              const migrationData = {
                messages: messages.map(m => ({
                  role: m.role,
                  content: m.content,
                  timestamp: m.timestamp.toISOString(),
                  attachmentType: m.attachmentType || null,
                })),
                draftText: draftText,
                savedAt: Date.now(),
              };
              localStorage.setItem(DEMO_PENDING_MIGRATION_KEY, JSON.stringify(migrationData));
            } catch {
              // Ignore storage errors
            }
            setShowUpgradePopup(false);
          }}
        />
      )}

      {/* Mobile-only: PWA install prompt after generating a document */}
      <MobileDocumentPrompt
        isOpen={showSaveDocumentPWA}
        onClose={() => setShowSaveDocumentPWA(false)}
      />

      {/* Save Case Popup - shown after export actions */}
      <AlertDialog open={showSaveCasePopup} onOpenChange={setShowSaveCasePopup}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {language === 'DE' ? 'Dokument speichern?' : 
               language === 'IT' ? 'Salvare il documento?' : 
               language === 'FR' ? 'Sauvegarder le document ?' : 
               language === 'ES' ? '¿Guardar el documento?' : 
               'Save document?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === 'DE' ? 'Möchten Sie dieses Dokument in einer Akte speichern? Sie können es später jederzeit wieder aufrufen.' : 
               language === 'IT' ? 'Vuoi salvare questo documento in una pratica? Potrai accedervi in qualsiasi momento.' : 
               language === 'FR' ? 'Voulez-vous sauvegarder ce document dans un dossier ? Vous pourrez y accéder à tout moment.' : 
               language === 'ES' ? '¿Desea guardar este documento en un expediente? Podrá acceder a él en cualquier momento.' : 
               'Would you like to save this document to a case? You can access it anytime.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <AlertDialogCancel onClick={() => {
              // Remember user declined - don't ask again for any button this session
              // Persist to sessionStorage so it survives refreshes
              setUserDeclinedSave(true);
              try {
                sessionStorage.setItem(DECLINED_SAVE_SESSION_KEY, 'true');
              } catch {
                // Ignore storage errors
              }
            }}>
              {language === 'DE' ? 'Nein, danke' : 
               language === 'IT' ? 'No, grazie' : 
               language === 'FR' ? 'Non, merci' : 
               language === 'ES' ? 'No, gracias' : 
               'No, thanks'}
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              // Save chat data for migration
              try {
                const migrationData = {
                  messages: messages.map(m => ({
                    role: m.role,
                    content: m.content,
                    timestamp: m.timestamp.toISOString(),
                    attachmentType: m.attachmentType || null,
                  })),
                  draftText: draftText,
                  savedAt: Date.now(),
                };
                localStorage.setItem(DEMO_PENDING_MIGRATION_KEY, JSON.stringify(migrationData));
              } catch {
                // Ignore
              }
              navigate('/auth?mode=signup');
            }}>
              {language === 'DE' ? 'Ja, speichern' : 
               language === 'IT' ? 'Sì, salva' : 
               language === 'FR' ? 'Oui, sauvegarder' : 
               language === 'ES' ? 'Sí, guardar' : 
               'Yes, save'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Anonymous Terms Acceptance Dialog - only shown when user attempts to interact */}
      {!user && (
        <AnonymousTermsDialog
          open={showTermsDialog && !demoMode}
          onAccept={handleTermsAccept}
        />
      )}

      <style>{`
        /* ========================================
           PREMIUM DEMO CHAT - EXACT MATCH TO REFERENCE
           Uses actual frame image as background
           ======================================== */
        
        .demo-chat-premium {
          display: flex;
          justify-content: center;
          align-items: flex-start;
          padding: 20px 12px;
          background: linear-gradient(180deg, 
            #0B1C2D 0%, 
            #122536 100%);
        }

        /* Main frame wrapper - uses frame image */
        .demo-frame-wrapper {
          position: relative;
          width: 100%;
          max-width: 420px;
          display: flex;
          flex-direction: column;
          background: linear-gradient(180deg,
            #0B1C2D 0%,
            #0D1F30 100%);
          border-radius: 8px;
          overflow: hidden;
          border: 3px solid #C9A24D;
          box-shadow: 
            0 0 0 2px #0B1C2D,
            0 0 0 5px #A8863D,
            0 20px 60px rgba(0,0,0,0.5);
        }

        @media (min-width: 768px) {
          .demo-frame-wrapper {
            max-width: 500px;
          }
        }

        /* Golden Header with fleur decorations */
        .demo-gold-header {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 14px 16px;
          background: linear-gradient(180deg,
            #C9A24D 0%,
            #A8863D 50%,
            #8B6F32 100%);
          border-bottom: 3px solid #7A5F2A;
          box-shadow: 
            inset 0 1px 0 #E0C068,
            0 4px 12px rgba(0,0,0,0.4);
        }

        .demo-fleur {
          color: #E8D5A3;
          font-size: 16px;
          opacity: 0.8;
        }

        .demo-gold-header svg {
          color: #FFF8E7 !important;
          filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));
        }

        .demo-title {
          color: #FFF8E7;
          font-weight: 600;
          font-size: 15px;
          letter-spacing: 0.5px;
          text-shadow: 0 1px 2px rgba(0,0,0,0.4);
        }

        /* Inner content area - parchment look with gold border */
        .demo-inner-content {
          position: relative;
          margin: 8px;
          border: 2px solid #C9A24D;
          border-radius: 4px;
          background: linear-gradient(180deg,
            #F5F0E1 0%,
            #EDE6D3 50%,
            #E8E0CC 100%);
          box-shadow: 
            inset 0 0 30px rgba(201, 162, 77, 0.15),
            0 2px 8px rgba(0,0,0,0.2);
          min-height: 280px;
          max-height: 50vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        @media (min-width: 768px) {
          .demo-inner-content {
            margin: 12px;
            max-height: 65vh;
            min-height: 350px;
          }
        }

        /* Response area - internal scroll */
        .demo-response-area {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior: contain;
        }

        /* Empty state */
        .demo-empty-state {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 24px;
          gap: 12px;
        }

        .demo-empty-icon {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: linear-gradient(135deg, 
            rgba(201, 162, 77, 0.15) 0%,
            rgba(201, 162, 77, 0.25) 100%);
          border: 2px solid rgba(201, 162, 77, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .demo-empty-icon svg {
          color: #B8954A !important;
        }

        .demo-empty-state p {
          color: #5A4D3A;
          font-style: italic;
          font-size: 14px;
        }

        /* Processing overlay - centered in response area */
        .demo-processing-overlay {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          min-height: 200px;
        }

        .demo-processing-box {
          background: linear-gradient(135deg,
            rgba(11, 28, 45, 0.95) 0%,
            rgba(18, 37, 54, 0.95) 100%);
          border: 2px solid #C9A24D;
          border-radius: 12px;
          padding: 20px 24px;
          box-shadow: 
            0 8px 32px rgba(0, 0, 0, 0.3),
            inset 0 1px 0 rgba(201, 162, 77, 0.2);
          min-width: 260px;
          color: #F5F0E1;
        }

        .demo-processing-box .text-sm {
          color: #E8E0CC;
        }

        .demo-processing-box .font-medium {
          color: #C9A24D;
        }

        .demo-processing-box .text-primary {
          color: #C9A24D !important;
        }

        .demo-processing-box .text-success {
          color: #4ADE80 !important;
        }

        .demo-processing-box .bg-muted {
          background: rgba(201, 162, 77, 0.2) !important;
        }

        .demo-processing-box .bg-primary {
          background: linear-gradient(90deg, #C9A24D 0%, #E0B85E 100%) !important;
        }

        /* Messages */
        .demo-message {
          display: flex;
          gap: 8px;
          align-items: flex-start;
        }

        .demo-message-user {
          flex-direction: row-reverse;
        }

        .demo-message-avatar {
          flex-shrink: 0;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: #1A2F42;
          border: 2px solid #C9A24D;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .demo-message-avatar svg {
          color: #C9A24D !important;
        }

        .demo-message-ai .demo-message-avatar {
          background: linear-gradient(135deg, #C9A24D, #A8863D);
        }

        .demo-message-ai .demo-message-avatar svg {
          color: #FFF8E7 !important;
        }

        .demo-message-bubble {
          position: relative;
          max-width: 85%;
          padding: 10px 14px;
          border-radius: 12px;
        }

        .ai-bubble {
          background: #FFFFFF;
          border: 1px solid #D4C9A8;
          color: #3D3426;
        }

        .user-bubble {
          background: linear-gradient(135deg, #1A2F42, #14253A);
          border: 1px solid #C9A24D;
          color: #F5F0E1;
        }

        .attachment-badge {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          opacity: 0.7;
          margin-bottom: 4px;
        }

        .demo-copy-btn {
          position: absolute;
          top: 6px;
          right: 6px;
          padding: 4px;
          border-radius: 4px;
          background: rgba(201, 162, 77, 0.2);
          border: none;
          opacity: 0;
          transition: opacity 0.2s;
          color: #A8863D;
          cursor: pointer;
        }

        .demo-message-bubble:hover .demo-copy-btn {
          opacity: 1;
        }

        @media (hover: none) {
          .demo-copy-btn {
            opacity: 0.7;
          }
        }

        .demo-disclaimer-inline {
          font-size: 10px;
          color: #7A6B52;
          text-align: center;
          padding: 8px;
          background: rgba(201, 162, 77, 0.1);
          border-radius: 6px;
          margin-top: 8px;
        }

        /* Floating scroll-to-bottom button - WHITE */
        .demo-scroll-btn {
          position: absolute;
          bottom: 12px;
          left: 50%;
          transform: translateX(-50%);
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: #FFFFFF;
          color: #0B1C2D;
          border: 2px solid #C9A24D;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
          transition: all 0.2s;
          z-index: 10;
        }

        .demo-scroll-btn:hover {
          background: #F5F0E1;
          transform: translateX(-50%) scale(1.05);
        }

        /* Input bar - cream/parchment style */
        .demo-input-bar {
          position: relative;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          /* reserve space for the send button so it stays inside the pill */
          padding-right: 56px;
          margin: 0 8px 8px 8px;
          background: linear-gradient(180deg, #F5EED8, #E8E0C8);
          border: 2px solid #C9A24D;
          border-radius: 28px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        }

        @media (min-width: 768px) {
          .demo-input-bar {
            margin: 0 12px 12px 12px;
          }
        }

        .demo-mic-btn {
          flex-shrink: 0;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: 2px solid #C9A24D;
          background: #F5F0E1;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #5A4D3A;
          cursor: pointer;
          transition: all 0.2s;
        }

        .demo-mic-btn:hover:not(:disabled) {
          background: #C9A24D;
          color: #FFF8E7;
        }

        .demo-mic-btn.active {
          background: #DC3545 !important;
          border-color: #C82333 !important;
          color: white !important;
          animation: pulse 1.5s infinite;
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }

        .demo-text-input {
          flex: 1;
          height: 40px;
          padding: 0 8px;
          border: none;
          background: transparent;
          /* 16px minimum to prevent iOS zoom on focus */
          font-size: 16px;
          color: #3D3426;
          outline: none;
          min-width: 0;
        }

        .demo-text-input::placeholder {
          color: #8B7D64;
          font-size: 12px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .demo-text-input.listening {
          color: #DC3545;
        }

        .demo-send-btn {
          flex-shrink: 0;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: linear-gradient(135deg, #1A2F42, #14253A);
          color: #C9A24D;
          border: 2px solid #C9A24D;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 3px 8px rgba(0,0,0,0.3);
          /* keep it perfectly centered inside the input pill */
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
        }

        .demo-send-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, #C9A24D, #A8863D);
          color: #FFF8E7;
        }

        .demo-send-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* ACTION BUTTONS - 2x3 GRID, ALL 6 ALWAYS VISIBLE */
        .demo-actions-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          padding: 12px;
          background: linear-gradient(180deg, #0B1C2D, #0D1F30);
        }

        .demo-action-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 14px 12px;
          border-radius: 10px;
          background: linear-gradient(180deg, #1A2F42, #14253A);
          color: #C9A24D;
          font-size: 13px;
          font-weight: 500;
          border: 1px solid rgba(201, 162, 77, 0.3);
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        }

        .demo-action-btn svg {
          color: #C9A24D;
          flex-shrink: 0;
        }

        .demo-action-btn:hover:not(:disabled) {
          background: linear-gradient(180deg, #C9A24D, #A8863D);
          color: #0B1C2D;
          border-color: #C9A24D;
        }

        .demo-action-btn:hover:not(:disabled) svg {
          color: #0B1C2D;
        }

        .demo-action-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        /* CLEAR CONVERSATION ROW - spans full width like 2 buttons */
        .demo-clear-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          padding: 0 12px 12px 12px;
          background: linear-gradient(180deg, #0D1F30, #0B1C2D);
        }

        .demo-clear-btn {
          grid-column: 1 / -1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 14px 16px;
          border-radius: 12px;
          /* Luxury gold gradient background */
          background: linear-gradient(180deg, #D4AF5A 0%, #C9A24D 40%, #A8863D 100%);
          /* Navy text */
          color: #0B1C2D;
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 0.3px;
          /* Double gold border for premium feel */
          border: 2px solid #E5C76B;
          cursor: pointer;
          transition: all 0.25s ease;
          /* 3D relief/raised effect */
          box-shadow: 
            0 4px 12px rgba(168, 134, 61, 0.4),
            0 2px 4px rgba(0, 0, 0, 0.2),
            inset 0 1px 0 rgba(255, 255, 255, 0.25),
            inset 0 -2px 4px rgba(0, 0, 0, 0.1);
          text-shadow: 0 1px 0 rgba(255, 255, 255, 0.15);
        }

        .demo-clear-btn svg {
          color: #0B1C2D;
          flex-shrink: 0;
        }

        .demo-clear-btn:hover {
          background: linear-gradient(180deg, #E5C76B 0%, #D4AF5A 40%, #C9A24D 100%);
          border-color: #F0D87A;
          transform: translateY(-1px);
          box-shadow: 
            0 6px 16px rgba(168, 134, 61, 0.5),
            0 3px 6px rgba(0, 0, 0, 0.25),
            inset 0 1px 0 rgba(255, 255, 255, 0.3),
            inset 0 -2px 4px rgba(0, 0, 0, 0.1);
        }

        .demo-clear-btn:active {
          transform: translateY(1px);
          box-shadow: 
            0 2px 6px rgba(168, 134, 61, 0.3),
            0 1px 2px rgba(0, 0, 0, 0.2),
            inset 0 2px 4px rgba(0, 0, 0, 0.15);
        }

        /* Scrollbar styling */
        .demo-response-area::-webkit-scrollbar {
          width: 6px;
        }

        .demo-response-area::-webkit-scrollbar-track {
          background: rgba(201, 162, 77, 0.1);
          border-radius: 3px;
        }

        .demo-response-area::-webkit-scrollbar-thumb {
          background: #C9A24D;
          border-radius: 3px;
        }

        /* Safe area for iOS */
        @supports (padding-bottom: env(safe-area-inset-bottom)) {
          .demo-clear-row {
            padding-bottom: calc(12px + env(safe-area-inset-bottom));
          }
        }
      `}</style>
    </section>
  );
}
