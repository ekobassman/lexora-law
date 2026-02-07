import { useState, useEffect, useRef, useCallback, useMemo, ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Loader2, Send, MessageCircle, Copy, Check, ChevronDown, Square, FileText, Mic, Sparkles, User,
  Camera, Paperclip, Eye, Printer, Mail, Save, Trash2, FolderOpen
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { usePlanState } from '@/hooks/usePlanState';
import { useEntitlements } from '@/hooks/useEntitlements';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCaseChatMessages } from '@/hooks/useCaseChatMessages';
import { toast } from 'sonner';
import { PlanLimitPopup } from '@/components/PlanLimitPopup';
import { PaymentBlockedPopup } from '@/components/PaymentBlockedPopup';
// InAppCamera removed - now using /scan page for document capture
import { containsPlaceholders, getPlaceholderErrorMessage } from '@/utils/documentSanitizer';
import { playLetterReadySound } from '@/utils/letterReadySound';
import { DEMO_PENDING_MIGRATION_KEY } from '@/components/DemoChatSection';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface DashboardAIChatProps {
  selectedCaseId?: string | null;
  selectedCaseTitle?: string | null;
  onCaseSelect?: () => void;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  attachmentType?: 'image' | 'pdf' | null;
}

interface SuggestedAction {
  type: 'CREATE_CASE_FROM_CHAT';
  label: string;
  payload: {
    draftResponse: string | null;
    title: string;
    chatHistory?: ChatMessage[];
  };
}

// Hardening: ensure we never store "next steps" / chatty CTAs in the case draft.
function sanitizeDraftForCase(raw: string): string {
  let text = (raw || '').trim();
  if (!text) return text;

  text = text.replace(/```[\s\S]*?```/g, '').trim();
  text = text.replace(/^\s*(betreff|oggetto|subject|objet|asunto)\s*:\s*.*\n+/i, '');

  const cutMarkers: RegExp[] = [
    /^\s*#{1,6}\s*(prossimi\s+passi|next\s+steps|nächste\s+schritte|etapes\s+suivantes|étapes\s+suivantes|pasos\s+siguientes|sonraki\s+adımlar|nastupni\s+kroky|наступні\s+кроки|следующие\s+шаги|الخطوات\s+التالي(?:ة|ه))\b[\s\S]*$/im,
    /^\s*(✅|➕|\+)\s*.*$/gm,
    /^\s*.*\b(lexora|pulsante|sotto la chat|below the chat|unter dem chat)\b.*$/gim,
  ];
  let cutAt = -1;
  for (const p of cutMarkers) {
    const m = text.match(p);
    if (m?.index != null) cutAt = cutAt === -1 ? m.index : Math.min(cutAt, m.index);
  }
  if (cutAt !== -1) text = text.slice(0, cutAt).trim();

  text = text
    .replace(/^\s*(✅|➕|\+)\s*.*$/gm, '')
    .replace(/^\s*.*\b(lexora|pulsante|sotto la chat|below the chat|unter dem chat)\b.*$/gim, '')
    .trim();

  return text;
}

// DATE NORMALIZATION
function normalizeDraftDate(draft: string): string {
  if (!draft) return draft;
  
  const today = new Date();
  const todayFormatted = {
    de: `${today.getDate().toString().padStart(2, '0')}.${(today.getMonth() + 1).toString().padStart(2, '0')}.${today.getFullYear()}`,
    it: `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`,
    iso: `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`,
  };
  
  const dePattern = /(\d{1,2})\.(\d{1,2})\.(\d{4})/g;
  const itPattern = /(\d{1,2})\/(\d{1,2})\/(\d{4})/g;
  
  let result = draft;
  
  result = result.replace(dePattern, (match, day, month, year) => {
    const dateYear = parseInt(year, 10);
    const currentYear = today.getFullYear();
    if (dateYear < currentYear - 1) return todayFormatted.de;
    const letterDate = new Date(dateYear, parseInt(month, 10) - 1, parseInt(day, 10));
    if (letterDate < today && dateYear < currentYear) return todayFormatted.de;
    return match;
  });
  
  result = result.replace(itPattern, (match, day, month, year) => {
    const dateYear = parseInt(year, 10);
    const currentYear = today.getFullYear();
    if (dateYear < currentYear - 1) return todayFormatted.it;
    const letterDate = new Date(dateYear, parseInt(month, 10) - 1, parseInt(day, 10));
    if (letterDate < today && dateYear < currentYear) return todayFormatted.it;
    return match;
  });
  
  return result;
}

// Per-case AI message limits
const PLAN_MESSAGE_LIMITS: Record<string, number> = {
  free: 10,
  starter: 15,
  pro: 30,
  unlimited: 999999,
};

function getSafeText(t: (key: string, options?: any) => string, key: string, fallback: string): string {
  const result = t(key);
  if (!result || result === key || (result.includes('.') && !result.includes(' '))) {
    return fallback;
  }
  return result;
}

// File helpers
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

export function DashboardAIChat({ selectedCaseId, selectedCaseTitle, onCaseSelect }: DashboardAIChatProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { planState, isLoading: planLoading, isUnlimited, isReady, isPaid } = usePlanState();
  const { entitlements, isAdmin } = useEntitlements();
  const { language } = useLanguage();
  
  // Unified case chat messages hook
  const { 
    messages: caseChatMessages, 
    isLoading: isChatLoading, 
    addMessage: addCaseChatMessage,
    clearMessages: clearCaseChatMessages,
  } = useCaseChatMessages({ 
    caseId: selectedCaseId || null, 
    scope: 'dashboard' 
  });
  
  // =====================
  // AUTO-CONTEXT STATE
  // =====================
  interface UserProfileContext {
    firstName?: string;
    lastName?: string;
    fullName?: string;
    address?: string;
    city?: string;
    postalCode?: string;
    country?: string;
    email?: string;
    senderFullName?: string;
    senderAddress?: string;
    senderCity?: string;
    senderPostalCode?: string;
    senderCountry?: string;
  }
  
  interface CaseContextData {
    id: string;
    title: string;
    authority?: string;
    aktenzeichen?: string;
    deadline?: string;
    letterText?: string;
    draftResponse?: string;
    documents?: Array<{
      id: string;
      fileName?: string;
      rawText?: string;
      direction: string;
      createdAt: string;
    }>;
  }
  
  const [userProfile, setUserProfile] = useState<UserProfileContext | null>(null);
  const [caseContext, setCaseContext] = useState<CaseContextData | null>(null);
  const [isLoadingContext, setIsLoadingContext] = useState(false);
  
  // Convert case messages to local format for display
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messagesUsed, setMessagesUsed] = useState(0);
  const [messagesLimit, setMessagesLimit] = useState(3);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [copiedMessageIndex, setCopiedMessageIndex] = useState<number | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [suggestedAction, setSuggestedAction] = useState<SuggestedAction | null>(null);
  const [isCreatingCase, setIsCreatingCase] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showPaymentBlockedPopup, setShowPaymentBlockedPopup] = useState(false);
  
  // =====================
  // FETCH USER PROFILE (once on mount)
  // =====================
  useEffect(() => {
    if (!user?.id) return;
    
    const fetchProfile = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('first_name, last_name, full_name, address, city, postal_code, country, sender_full_name, sender_address, sender_city, sender_postal_code, sender_country')
        .eq('id', user.id)
        .single();
      
      if (data && !error) {
        setUserProfile({
          firstName: data.first_name || undefined,
          lastName: data.last_name || undefined,
          fullName: data.full_name || undefined,
          address: data.address || undefined,
          city: data.city || undefined,
          postalCode: data.postal_code || undefined,
          country: data.country || undefined,
          senderFullName: data.sender_full_name || undefined,
          senderAddress: data.sender_address || undefined,
          senderCity: data.sender_city || undefined,
          senderPostalCode: data.sender_postal_code || undefined,
          senderCountry: data.sender_country || undefined,
        });
      }
    };
    
    fetchProfile();
  }, [user?.id]);
  
  // =====================
  // FETCH CASE CONTEXT (when selectedCaseId changes)
  // =====================
  useEffect(() => {
    if (!user?.id || !selectedCaseId) {
      setCaseContext(null);
      return;
    }
    
    const fetchCaseContext = async () => {
      setIsLoadingContext(true);
      try {
        // Fetch case data
        const { data: caseData, error: caseError } = await supabase
          .from('pratiche')
          .select('id, title, authority, aktenzeichen, deadline, letter_text, draft_response')
          .eq('id', selectedCaseId)
          .eq('user_id', user.id)
          .single();
        
        if (caseError || !caseData) {
          setCaseContext(null);
          return;
        }
        
        // Fetch documents for this case
        const { data: docsData } = await supabase
          .from('documents')
          .select('id, file_name, raw_text, direction, created_at')
          .eq('pratica_id', selectedCaseId)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5);
        
        setCaseContext({
          id: caseData.id,
          title: caseData.title,
          authority: caseData.authority || undefined,
          aktenzeichen: caseData.aktenzeichen || undefined,
          deadline: caseData.deadline || undefined,
          letterText: caseData.letter_text || undefined,
          draftResponse: caseData.draft_response || undefined,
          documents: docsData?.map(d => ({
            id: d.id,
            fileName: d.file_name || undefined,
            rawText: d.raw_text || undefined,
            direction: d.direction,
            createdAt: d.created_at,
          })) || [],
        });
      } catch (err) {
        console.error('[DashboardAIChat] Error fetching case context:', err);
        setCaseContext(null);
      } finally {
        setIsLoadingContext(false);
      }
    };
    
    fetchCaseContext();
  }, [user?.id, selectedCaseId]);
  
  // Voice input refs for continuous mode (iOS/Safari compatibility)
  const isRecordingRef = useRef(false);
  const finalTranscriptRef = useRef('');
  
  // File processing state (camera/file handled via /scan page)
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  
  // Draft states
  const [lastDraftText, setLastDraftText] = useState<string | null>(null);
  const [chatTopic, setChatTopic] = useState<string | null>(null);
  const [draftReady, setDraftReady] = useState(false);
  const [draftCopied, setDraftCopied] = useState(false);
  
  // Case naming dialog states
  const [showCaseNameDialog, setShowCaseNameDialog] = useState(false);
  const [caseName, setCaseName] = useState('');
  const [hasPromptedForName, setHasPromptedForName] = useState(false);
  
  // No case selected state - IMPORTANT: Dashboard chat does NOT require a case!
  // Users must be able to start new conversations without selecting a case first.
  const isCaseRequired = false;
  const noCaseSelected = false; // Always allow chatting
  
  const MIN_DRAFT_LENGTH = 200;

  // Sync case chat messages to local state
  useEffect(() => {
    if (caseChatMessages.length > 0) {
      setMessages(caseChatMessages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
        timestamp: new Date(m.created_at),
      })));
    } else if (selectedCaseId) {
      setMessages([]);
    }
    setIsLoadingHistory(isChatLoading);
  }, [caseChatMessages, isChatLoading, selectedCaseId]);

  // Fallback: extract draft only when last message contains [LETTER]...[/LETTER] (AI explicitly generated). Used only for "create case" when lastDraftText is missing.
  const detectDraftFromMessages = useCallback((): { hasDraft: boolean; draftText: string | null } => {
    const lastAssistant = messages.filter(m => m.role === 'assistant').pop();
    if (!lastAssistant?.content) return { hasDraft: false, draftText: null };
    const m = lastAssistant.content.match(/\[LETTER\]([\s\S]*?)\[\/LETTER\]/i);
    if (!m || !m[1]) return { hasDraft: false, draftText: null };
    const extracted = m[1].trim();
    if (extracted.length < MIN_DRAFT_LENGTH || containsPlaceholders(extracted)) return { hasDraft: false, draftText: null };
    return { hasDraft: true, draftText: sanitizeDraftForCase(extracted) };
  }, [messages]);

  // Buttons ONLY when the AI has generated the letter (backend sent draftReady + draftResponse). No character/layout logic.
  const exportText = (lastDraftText && lastDraftText.trim().length > 0 && !containsPlaceholders(lastDraftText)) ? lastDraftText : '';
  const hasLetterDraft = exportText.length > 0;
  const isDocumentReady = draftReady && hasLetterDraft;
  const letterReadyPlayedRef = useRef(false);
  useEffect(() => {
    if (!hasLetterDraft || letterReadyPlayedRef.current) return;
    letterReadyPlayedRef.current = true;
    playLetterReadySound();
  }, [hasLetterDraft]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const lastUserMessageRef = useRef<HTMLDivElement>(null);
  const shouldScrollToUserMessage = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Localized texts
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

  // Clear conversation button labels
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

  // Localized "select case" messages
  const selectCaseByLang: Record<string, string> = {
    IT: 'Seleziona un fascicolo per continuare la chat',
    DE: 'Wählen Sie einen Vorgang aus, um den Chat fortzusetzen',
    EN: 'Select a case to continue chatting',
    FR: 'Sélectionnez un dossier pour continuer la conversation',
    ES: 'Selecciona un expediente para continuar el chat',
    PL: 'Wybierz sprawę, aby kontynuować rozmowę',
    RO: 'Selectează un dosar pentru a continua conversația',
    TR: 'Sohbete devam etmek için bir dosya seçin',
    AR: 'اختر ملفًا للمتابعة',
    UK: 'Виберіть справу, щоб продовжити чат',
    RU: 'Выберите дело, чтобы продолжить чат',
  };

  const txt = useMemo(() => ({
    sectionTitle: getSafeText(t, 'dashboardChat.title', 'AI Legal Assistant'),
    placeholder: noCaseSelected 
      ? (selectCaseByLang[language] || 'Select a case to continue chatting')
      : (placeholderByLang[language] || 'Write here...'),
    emptyState: noCaseSelected
      ? (selectCaseByLang[language] || 'Select a case to continue chatting')
      : getSafeText(t, 'dashboardChat.welcome', 'Describe your legal situation...'),
    emptyHint: noCaseSelected
      ? (selectedCaseTitle ? `📁 ${selectedCaseTitle}` : '')
      : getSafeText(t, 'dashboardChat.welcomeHint', 'I will help you draft a response.'),
    thinking: getSafeText(t, 'chat.thinking', 'Thinking...'),
    createDocument: getSafeText(t, 'dashboardChat.createDocument', 'Create document'),
    creatingCase: getSafeText(t, 'dashboardChat.creatingCase', 'Creating...'),
    resetChat: getSafeText(t, 'dashboardChat.resetChat', 'Reset'),
    copy: getSafeText(t, 'chat.copy', 'Copy'),
    copied: getSafeText(t, 'chat.copied', 'Copied!'),
    stop: getSafeText(t, 'chat.stop', 'Stop'),
    listening: getSafeText(t, 'chat.listening', 'Listening...'),
    scanDocument: getSafeText(t, 'demoChat.scanDocument', 'Scan'),
    uploadFile: getSafeText(t, 'demoChat.uploadFile', 'Upload'),
    copyLetter: getSafeText(t, 'demoChat.copyLetter', 'Copy'),
    preview: getSafeText(t, 'demoChat.preview', 'Preview'),
    print: getSafeText(t, 'demoChat.print', 'Print'),
    selectCase: selectCaseByLang[language] || 'Select a case to continue chatting',
    email: getSafeText(t, 'demoChat.email', 'Email'),
    noDraft: getSafeText(t, 'demoChat.noDraft', 'No letter draft available yet'),
    processingOCR: getSafeText(t, 'demoChat.processingOCR', 'Extracting text...'),
    ocrSuccess: getSafeText(t, 'demoChat.ocrSuccess', 'Text extracted from document'),
    ocrError: getSafeText(t, 'demoChat.ocrError', 'Could not read document. Please try again.'),
    cameraPermTitle: getSafeText(t, 'demoChat.cameraPermission.title', 'Camera Access'),
    cameraPermBody: getSafeText(t, 'demoChat.cameraPermission.body', 'We need camera access to scan your document.'),
    cameraPermAllow: getSafeText(t, 'demoChat.cameraPermission.allow', 'Allow Camera'),
    close: getSafeText(t, 'common.close', 'Close'),
    // Case naming dialog
    nameYourCase: getSafeText(t, 'dashboardChat.nameYourCase', 'Name your case'),
    nameYourCaseDesc: getSafeText(t, 'dashboardChat.nameYourCaseDesc', 'Give your document a name to save it'),
    caseNamePlaceholder: getSafeText(t, 'dashboardChat.caseNamePlaceholder', 'e.g., Rent dispute, Tax appeal...'),
    saveCase: getSafeText(t, 'dashboardChat.saveCase', 'Save case'),
    cancel: getSafeText(t, 'common.cancel', 'Cancel'),
    clearConversation: clearConversationByLang[language] || 'Clear conversation',
  }), [t, language]);

  // Check speech recognition support
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setSpeechSupported(!!SpeechRecognition);
  }, []);

  // Helper to update input and auto-scroll
  const updateInputWithScroll = useCallback((text: string) => {
    setInput(text);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(text.length, text.length);
        el.scrollLeft = el.scrollWidth;
      }
    });
  }, []);

  // Create and start recognition - CONTINUOUS MODE for iOS/Safari compatibility
  const startRecording = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error(t('chat.speechNotSupported'));
      return;
    }

    // Reset state - start with current input
    finalTranscriptRef.current = input;
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
        toast.error(t('chat.microphonePermissionDenied') || 'Microphone permission denied');
        isRecordingRef.current = false;
        setIsListening(false);
      } else if (err === 'no-speech') {
        // Don't stop - just continue listening if still recording
      } else if (err === 'aborted') {
        // Expected when manually stopped - do nothing
      } else {
        isRecordingRef.current = false;
        setIsListening(false);
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch (e) {
      console.error('[Voice] Failed to start:', e);
      toast.error(t('chat.speechError'));
      isRecordingRef.current = false;
      setIsListening(false);
    }
  }, [language, input, updateInputWithScroll, t]);

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

  const plan = planState.plan;
  const isUnlimitedPlan = isUnlimited;
  const shouldBypassLimits = isAdmin || isUnlimitedPlan || isPaid;
  const isLimitReached = !shouldBypassLimits && messagesUsed >= messagesLimit;

  const toggleListening = useCallback(() => {
    if (isLimitReached) {
      setShowUpgradeModal(true);
      return;
    }
    if (isListening) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isLimitReached, isListening, stopRecording, startRecording]);

  const handleLimitedInteraction = useCallback(() => {
    if (isLimitReached) {
      setShowUpgradeModal(true);
      return true;
    }
    return false;
  }, [isLimitReached]);

  // Load chat history and usage on mount
  useEffect(() => {
    if (!user) return;
    
    const loadData = async () => {
      setIsLoadingHistory(true);
      try {
        const today = new Date().toISOString().split('T')[0];
        const { data: usageData } = await supabase
          .from('dashboard_chat_messages')
          .select('messages_count')
          .eq('user_id', user.id)
          .eq('message_date', today)
          .single();
        
        if (usageData) setMessagesUsed(usageData.messages_count);
        
        setMessagesLimit(planState.messages_per_case || PLAN_MESSAGE_LIMITS[plan] || 10);
        
        // Check for pending demo chat migration
        let migratedMessages: ChatMessage[] = [];
        try {
          const migrationRaw = localStorage.getItem(DEMO_PENDING_MIGRATION_KEY);
          if (migrationRaw) {
            const migrationData = JSON.parse(migrationRaw);
            // Only migrate if data is less than 24 hours old
            if (migrationData.savedAt && Date.now() - migrationData.savedAt < 24 * 60 * 60 * 1000) {
              if (Array.isArray(migrationData.messages) && migrationData.messages.length > 0) {
                migratedMessages = migrationData.messages.map((m: any) => ({
                  role: m.role as 'user' | 'assistant',
                  content: m.content,
                  timestamp: new Date(m.timestamp),
                  attachmentType: m.attachmentType || null,
                }));
                
                // Save migrated messages to database
                for (const msg of migratedMessages) {
                  await supabase.from('dashboard_chat_history').insert({
                    user_id: user.id,
                    role: msg.role,
                    content: msg.content,
                    created_at: msg.timestamp.toISOString(),
                  });
                }
                
                if (migrationData.draftText && migrationData.draftText.trim().length > 0) {
                  setLastDraftText(migrationData.draftText);
                  setDraftReady(true);
                }
                
                toast.success(
                  language === 'DE' ? 'Ihre Demo-Chat wurde übertragen!' :
                  language === 'IT' ? 'La tua chat demo è stata importata!' :
                  language === 'FR' ? 'Votre conversation de démo a été importée !' :
                  language === 'ES' ? '¡Tu chat de demostración ha sido importado!' :
                  'Your demo chat has been imported!'
                );
              }
            }
            // Clear migration data after processing
            localStorage.removeItem(DEMO_PENDING_MIGRATION_KEY);
            // Also clear demo chat data to prevent duplicates
            localStorage.removeItem('lexora_demo_chat_messages_v1');
            localStorage.removeItem('lexora_demo_draft_text_v1');
            localStorage.removeItem('lexora_demo_chat_buffer_v1');
            localStorage.removeItem('lexora_demo_chat_session_v2');
          }
        } catch (migrationError) {
          console.error('Error migrating demo chat:', migrationError);
          localStorage.removeItem(DEMO_PENDING_MIGRATION_KEY);
        }
        
        // Load existing history from database
        const { data: historyData } = await supabase
          .from('dashboard_chat_history')
          .select('role, content, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true })
          .limit(50);
        
        if (historyData && historyData.length > 0) {
          setMessages(historyData.map(msg => ({
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
            timestamp: new Date(msg.created_at),
          })));
        } else if (migratedMessages.length > 0) {
          // If no existing history but we have migrated messages, use those
          setMessages(migratedMessages);
        }
      } catch (error) {
        console.error('Error loading chat data:', error);
      } finally {
        setIsLoadingHistory(false);
      }
    };
    
    if (isReady) loadData();
  }, [user, plan, isReady, planState.messages_per_case, language]);

  // Track scroll position
  useEffect(() => {
    const scrollContainer = messagesContainerRef.current;
    if (!scrollContainer) return;
    
    const handleScroll = () => {
      const isNearBottom = scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight < 100;
      setShowScrollButton(!isNearBottom);
    };
    
    scrollContainer.addEventListener('scroll', handleScroll);
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, [isLoadingHistory]);

  // Scroll to user message
  useEffect(() => {
    if (shouldScrollToUserMessage.current && lastUserMessageRef.current && messagesContainerRef.current) {
      const userMsgTop = lastUserMessageRef.current.offsetTop;
      messagesContainerRef.current.scrollTop = userMsgTop - 16;
      shouldScrollToUserMessage.current = false;
    }
  }, [messages]);

  // Auto-scroll to bottom when loading starts (to show thinking indicator)
  useEffect(() => {
    if (isLoading && messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [isLoading]);

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  const copyMessage = async (content: string, index: number) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageIndex(index);
      toast.success(txt.copied);
      setTimeout(() => setCopiedMessageIndex(null), 2000);
    } catch (err) {
      toast.error(t('chat.copyError') || 'Failed to copy');
    }
  };

  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
      toast.info(t('chat.stopped') || 'Generation stopped');
    }
  };

  // OCR processing
  const processOCRSingle = async (file: File): Promise<string | null> => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      
      const base64 = await fileToBase64(file);
      const mimeType = guessMimeType(file);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-text`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : '',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ base64, mimeType, language }),
        }
      );

      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.text) return null;
      return data.text || '';
    } catch {
      return null;
    }
  };

  const processOCR = async (file: File): Promise<string | null> => {
    setIsProcessingFile(true);
    try {
      const result = await processOCRSingle(file);
      if (result) toast.success(txt.ocrSuccess);
      else toast.error(txt.ocrError);
      return result;
    } finally {
      setIsProcessingFile(false);
    }
  };

  const sendMessage = useCallback(async (messageContent?: string, attachmentType?: 'image' | 'pdf' | null) => {
    const content = messageContent || input.trim();
    if (!content || isLoading) return;

    // CASE-SCOPED: Block if no case selected
    if (noCaseSelected) {
      toast.info(txt.selectCase);
      onCaseSelect?.();
      return;
    }

    // Payment enforcement: blocked users cannot use AI chat
    if ((entitlements as any)?.access_state === 'blocked') {
      setShowPaymentBlockedPopup(true);
      return;
    }
    
    if (isLimitReached) {
      setShowUpgradeModal(true);
      return;
    }
    
    if (!chatTopic && content.length >= 6) setChatTopic(content.slice(0, 80));

    const userMessage: ChatMessage = {
      role: 'user',
      content,
      timestamp: new Date(),
      attachmentType,
    };

    const nextHistory = [...messages, userMessage];

    // OPTIMISTIC UI: show the user message immediately (works even in PRE-CASE mode)
    setMessages(prev => [...prev, userMessage]);

    // Persist only when a case is selected (PRE-CASE is session-only by requirement)
    if (selectedCaseId) {
      void addCaseChatMessage('user', content);
    }

    setInput('');
    setIsLoading(true);
    shouldScrollToUserMessage.current = true;
    
    abortControllerRef.current = new AbortController();
    
    try {
      // Ensure we have profile context for logged-in users to avoid re-asking name/surname.
      // This is intentionally awaited BEFORE calling the backend, but AFTER optimistic UI.
      let effectiveUserProfile = userProfile;
      if (!effectiveUserProfile && user?.id) {
        const { data, error } = await supabase
          .from('profiles')
          .select('first_name, last_name, full_name, address, city, postal_code, country, sender_full_name, sender_address, sender_city, sender_postal_code, sender_country')
          .eq('id', user.id)
          .single();

        if (!error && data) {
          effectiveUserProfile = {
            firstName: data.first_name || undefined,
            lastName: data.last_name || undefined,
            fullName: data.full_name || undefined,
            address: data.address || undefined,
            city: data.city || undefined,
            postalCode: data.postal_code || undefined,
            country: data.country || undefined,
            senderFullName: data.sender_full_name || undefined,
            senderAddress: data.sender_address || undefined,
            senderCity: data.sender_city || undefined,
            senderPostalCode: data.sender_postal_code || undefined,
            senderCountry: data.sender_country || undefined,
          };
          setUserProfile(effectiveUserProfile);
        }
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw new Error(`Session error: ${sessionError.message}`);
      
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('No session token (user not authenticated)');
      
      const payload = {
        message: userMessage.content,
        userLanguage: language?.toUpperCase() || 'DE',
        isFirstMessage: nextHistory.length === 1,
        chatHistory: nextHistory.slice(-8).map(m => ({ role: m.role, content: m.content })),
        caseId: selectedCaseId,
        // AUTO-CONTEXT: Pass user profile and case context
        userProfile: effectiveUserProfile || undefined,
        caseContext: caseContext || undefined,
      };

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dashboard-chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
          },
          body: JSON.stringify(payload),
          signal: abortControllerRef.current.signal,
        }
      );

      if (!response.ok) {
        let errorBody = '';
        let errorData: any = null;
        try {
          errorBody = await response.text();
          errorData = errorBody ? JSON.parse(errorBody) : null;
        } catch {}
        
        if (response.status === 503 || errorData?.error === 'SYSTEM_CREDITS_EXHAUSTED') {
          toast.error(errorData?.message || "System AI temporarily unavailable.", { duration: 8000 });
          return;
        }
        
        if (response.status === 402 || errorData?.error === 'AI_CREDITS_EXHAUSTED') {
          setShowUpgradeModal(true);
          return;
        }
        
        if (response.status === 429) {
          if (errorData?.error === 'limit_reached') {
            setMessagesUsed(errorData.messagesUsed);
            setMessagesLimit(errorData.messagesLimit);
            toast.error(t('dashboardChat.limitReached'));
            return;
          }
          toast.error(t('dashboardChat.rateLimitError'));
          return;
        }
        
        if (response.status === 401) {
          toast.error(`Auth error: ${response.status}`, { duration: 8000 });
          return;
        }
        
        const errMsg = errorData?.error || errorData?.message || response.statusText;
        throw new Error(`dashboard-chat failed: ${response.status} ${errMsg}`);
      }

      const data = await response.json();
      
       const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
      };

       // OPTIMISTIC UI: show assistant immediately (no waiting on DB)
       setMessages(prev => [...prev, assistantMessage]);

       // Persist only when a case is selected
       if (selectedCaseId) {
         void addCaseChatMessage('assistant', data.response);
       }
      
      setMessagesUsed(data.messagesUsed);
      setMessagesLimit(data.messagesLimit);
      
      const backendDraft = (data?.suggestedAction?.payload?.draftResponse ?? data?.draftResponse ?? null) as string | null;
      const backendDraftReady = Boolean(data?.draftReady) && Boolean(backendDraft && backendDraft.trim().length > 0);

      if (data.suggestedAction && data.suggestedAction.type === 'CREATE_CASE_FROM_CHAT') {
        setSuggestedAction(data.suggestedAction);
        setChatTopic(data.suggestedAction.payload?.title || null);
      } else {
        setSuggestedAction(null);
      }

      setLastDraftText(backendDraftReady ? backendDraft : null);
      setDraftReady(backendDraftReady);
      
      if (backendDraftReady && backendDraft && !hasPromptedForName) {
        setHasPromptedForName(true);
        setCaseName(data.suggestedAction?.payload?.title || chatTopic || '');
        setShowCaseNameDialog(true);
      }
     } catch (error: any) {
      if (error?.name === 'AbortError') return;
      console.error('[DashboardAIChat] Chat error:', error);
      toast.error(`Error: ${error?.message || 'Unknown'}`, { duration: 10000 });
      // Keep the user's message visible; no rollback in PRE-CASE or slow network scenarios.
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [input, isLoading, isLimitReached, language, messages, t, chatTopic, hasPromptedForName, entitlements]);

  // Camera handlers - redirect to /scan page with camera + upload buttons
  const handleCameraClick = () => {
    if (isLimitReached) {
      setShowUpgradeModal(true);
      return;
    }
    // Navigate to the ScanDocument page which has both camera and file upload buttons
    navigate('/scan');
  };

  // File handlers - redirect to /scan page with camera + upload buttons
  const handleFileClick = () => {
    if (isLimitReached) {
      setShowUpgradeModal(true);
      return;
    }
    // Navigate to the ScanDocument page which has both camera and file upload buttons
    navigate('/scan');
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length === 0) return;

    if (fileInputRef.current) fileInputRef.current.value = '';

    const validFiles = selected.filter((file) => {
      if (isHeicLike(file)) {
        toast.error(`${file.name}: HEIC photos are not supported.`);
        return false;
      }
      const ok = isLikelyImage(file) || isLikelyPdf(file);
      if (!ok) toast.error(`${file.name}: Please upload an image or PDF.`);
      return ok;
    });

    if (validFiles.length === 0) return;

    setIsProcessingFile(true);

    try {
      const extractedParts: { name: string; text: string; isPDF: boolean }[] = [];
      
      for (const file of validFiles) {
        const isPDF = isLikelyPdf(file);
        const extractedText = await processOCRSingle(file);
        
        if (extractedText) extractedParts.push({ name: file.name, text: extractedText, isPDF });
        else toast.error(`${file.name}: ${txt.ocrError}`);
      }

      if (extractedParts.length > 0) {
        let combinedMessage: string;
        
        if (extractedParts.length === 1) {
          const part = extractedParts[0];
          const prefix = part.isPDF ? '[PDF uploaded]' : '[Document uploaded]';
          combinedMessage = `${prefix}\n\n${part.text}`;
        } else {
          const header = `[${extractedParts.length} documents uploaded]`;
          const sections = extractedParts.map((part, idx) => {
            const typeLabel = part.isPDF ? 'PDF' : 'Image';
            return `--- Page ${idx + 1} (${typeLabel}: ${part.name}) ---\n${part.text}`;
          }).join('\n\n');
          combinedMessage = `${header}\n\n${sections}`;
        }

        const hasPDF = extractedParts.some(p => p.isPDF);
        const hasImage = extractedParts.some(p => !p.isPDF);
        const attachmentType: 'pdf' | 'image' = hasPDF && !hasImage ? 'pdf' : 'image';

        await sendMessage(combinedMessage, attachmentType);
        toast.success(`${extractedParts.length} document(s) processed`);
      }
    } finally {
      setIsProcessingFile(false);
    }
  };

  // Export handlers
  const handleCopyDraft = async () => {
    if (!exportText) {
      toast.error(txt.noDraft);
      return;
    }
    if (containsPlaceholders(exportText)) {
      toast.error(getPlaceholderErrorMessage(language));
      return;
    }
    try {
      await navigator.clipboard.writeText(exportText);
      setDraftCopied(true);
      toast.success(txt.copied);
      setTimeout(() => setDraftCopied(false), 2000);
    } catch {
      toast.error('Copy failed');
    }
  };

  const handlePreview = () => {
    if (!exportText) {
      toast.error(txt.noDraft);
      return;
    }
    if (containsPlaceholders(exportText)) {
      toast.error(getPlaceholderErrorMessage(language));
      return;
    }
    try {
      sessionStorage.setItem('lexora_dashboard_letter_draft', exportText);
    } catch {}
    navigate('/demo/letter-preview');
  };

  const handlePrint = () => handlePreview();

  const handleEmail = () => {
    if (!exportText) {
      toast.error(txt.noDraft);
      return;
    }

    if (containsPlaceholders(exportText)) {
      toast.error(getPlaceholderErrorMessage(language));
      return;
    }

    const subject = encodeURIComponent('Draft reply – Lexora');
    const body = encodeURIComponent(exportText);

    if (body.length > 1800) {
      navigator.clipboard.writeText(exportText).then(() => {
        toast.success(txt.copied);
        const shortBody = encodeURIComponent('Draft copied to clipboard. Please paste it here.');
        window.location.href = `mailto:?subject=${subject}&body=${shortBody}`;
      }).catch(() => {
        window.location.href = `mailto:?subject=${subject}&body=${body.slice(0, 1800)}`;
      });
      return;
    }

    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  // Clear chat - use unified case_chat_messages
  const clearChatAfterCaseCreation = async () => {
    if (!user || !selectedCaseId) return;
    
    try {
      await clearCaseChatMessages();
      setSuggestedAction(null);
      setLastDraftText(null);
      setChatTopic(null);
      setDraftReady(false);
    } catch (error) {
      console.error('Error clearing chat:', error);
    }
  };

  const handleCreateCaseFromChat = async (providedName?: string) => {
    if (!user || isCreatingCase || !isDocumentReady) {
      if (!isDocumentReady) toast.info(t('dashboardChat.draftRequiredHint', 'Ask the AI to create a formal letter first'));
      return;
    }
    
    let draftToSave = lastDraftText ? sanitizeDraftForCase(lastDraftText) : null;
    
    if (!draftToSave || draftToSave.length < MIN_DRAFT_LENGTH) {
      const fallback = detectDraftFromMessages();
      if (fallback.hasDraft && fallback.draftText) draftToSave = fallback.draftText;
    }
    
    // Use provided name first, then fall back to chatTopic or suggestedAction
    const titleToSave = providedName?.trim() || chatTopic || suggestedAction?.payload?.title || t('dashboardChat.newCaseTitle', 'New case from chat');
    
    if (!draftToSave || draftToSave.length < MIN_DRAFT_LENGTH) {
      toast.error(t('dashboardChat.noDraftError', 'No draft available.'));
      return;
    }

    if (containsPlaceholders(draftToSave)) {
      toast.error(getPlaceholderErrorMessage(language));
      return;
    }
    
    draftToSave = normalizeDraftDate(draftToSave);
    setIsCreatingCase(true);
    
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-case`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            title: titleToSave,
            draft_response: draftToSave,
            status: 'in_progress',
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.code === 'CASE_LIMIT_REACHED') {
          toast.error(t('credits.outOfMonthlyCases', 'You have used all your monthly cases.'));
          return;
        }
        throw new Error(errorData.message || 'Failed to create case');
      }

      const data = await response.json();
      const praticaId = data.id;
      
      if (!praticaId) {
        toast.error(t('dashboardChat.createCaseError', 'Error creating case.'));
        return;
      }

      toast.success(t('dashboardChat.createCaseSuccess', 'Case created successfully!'));
      await clearChatAfterCaseCreation();
      // Increment global documents counter (homepage) so it stays in sync when creating case from dashboard
      try {
        await supabase.rpc('increment_documents_processed');
      } catch {
        // Non-critical; backend create-case also increments
      }
      // Reset dialog state
      setShowCaseNameDialog(false);
      setCaseName('');
      setHasPromptedForName(false);
      
      navigate(`/pratiche/${praticaId}`);
      
    } catch (error: any) {
      console.error('[DashboardAIChat] Error creating case:', error);
      toast.error(t('dashboardChat.createCaseError', 'Error creating case.'));
    } finally {
      setIsCreatingCase(false);
    }
  };

  // Handler for the case naming dialog submission
  const handleSaveCaseWithName = () => {
    if (!caseName.trim()) {
      toast.error(t('dashboardChat.nameRequired', 'Please enter a name for your case'));
      return;
    }
    handleCreateCaseFromChat(caseName.trim());
  };

  const handleCancelCaseDialog = () => {
    setShowCaseNameDialog(false);
    // Don't reset hasPromptedForName so user can manually trigger later
  };

  const handleClearChat = async () => {
    if (!user) return;
    letterReadyPlayedRef.current = false;
    try {
      await supabase.from('dashboard_chat_history').delete().eq('user_id', user.id);
      setMessages([]);
      setSuggestedAction(null);
      setLastDraftText(null);
      setChatTopic(null);
      setDraftReady(false);
      toast.success(t('dashboardChat.chatCleared'));
    } catch (error) {
      console.error('Error clearing chat:', error);
      toast.error(t('dashboardChat.clearError'));
    }
  };

  if (!user) return null;

  const handleInputClick = () => {
    if (isLimitReached) setShowUpgradeModal(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // DISABLED: Enter key does NOT send messages
    // Users must click the send button to submit
    // This prevents accidental sends and ensures intentional submission
    if (e.key === 'Enter') {
      e.preventDefault();
      // Do nothing - only send button triggers message
      return;
    }
  };

  // Camera is now handled by /scan page - no inline camera needed

  return (
    <section className="dashboard-chat-premium">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      {/* MAIN CONTAINER with frame styling - SAME DIMENSIONS AS DEMO */}
      <div className={`dashboard-frame-wrapper${hasLetterDraft ? ' letter-ready' : ''}`}>
        {/* Golden Header Bar */}
        <div className="dashboard-gold-header">
          <span className="dashboard-fleur">❧</span>
          <Sparkles className="h-5 w-5" />
          <span className="dashboard-title">{txt.sectionTitle}</span>
          <span className="dashboard-fleur">❧</span>
          
          {/* Context Badge */}
          {caseContext && (
            <div className="ml-2 flex items-center gap-1 px-2 py-0.5 bg-primary/20 rounded-full text-xs">
              <FolderOpen className="h-3 w-3" />
              <span className="truncate max-w-[120px]" title={caseContext.title}>
                {caseContext.title}
              </span>
            </div>
          )}
        </div>

        {/* Inner content area (parchment look) */}
        <div className="dashboard-inner-content">
          {/* Messages Area with internal scroll */}
          <div 
            ref={messagesContainerRef}
            className="dashboard-response-area"
          >
            {isLoadingHistory ? (
              <div className="dashboard-empty-state">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : messages.length === 0 ? (
              <div className="dashboard-empty-state">
                <div className="dashboard-empty-icon">
                  <MessageCircle className="h-10 w-10" />
                </div>
                <p>{txt.emptyState}</p>
                <p className="text-xs opacity-70">{txt.emptyHint}</p>
              </div>
            ) : (
              <>
                {messages.map((msg, idx) => {
                  const isLastUserMessage = msg.role === 'user' && 
                    idx === messages.map((m, i) => m.role === 'user' ? i : -1).filter(i => i >= 0).pop();
                  
                  return (
                    <div
                      key={idx}
                      ref={isLastUserMessage ? lastUserMessageRef : undefined}
                      className={`dashboard-message ${msg.role === 'user' ? 'dashboard-message-user' : 'dashboard-message-ai'}`}
                    >
                      <div className="dashboard-message-avatar">
                        {msg.role === 'assistant' ? (
                          <Sparkles className="h-3.5 w-3.5" />
                        ) : (
                          <User className="h-3.5 w-3.5" />
                        )}
                      </div>
                      <div className={`dashboard-message-bubble ${msg.role === 'user' ? 'user-bubble' : 'ai-bubble'}`}>
                        {msg.attachmentType && (
                          <div className="attachment-badge">
                            {msg.attachmentType === 'pdf' ? <FileText className="h-3 w-3" /> : <Camera className="h-3 w-3" />}
                            <span>{msg.attachmentType === 'pdf' ? 'PDF' : 'Image'}</span>
                          </div>
                        )}
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                        <button
                          onClick={() => copyMessage(msg.content, idx)}
                          className="dashboard-copy-btn"
                          aria-label={txt.copy}
                        >
                          {copiedMessageIndex === idx ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Loading indicator */}
                {isLoading && (
                  <div className="dashboard-message dashboard-message-ai">
                    <div className="dashboard-message-avatar">
                      <Sparkles className="h-3.5 w-3.5" />
                    </div>
                    <div className="dashboard-message-bubble ai-bubble">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm opacity-70">{txt.thinking}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Processing OCR */}
                {isProcessingFile && (
                  <div className="dashboard-message dashboard-message-ai">
                    <div className="dashboard-message-avatar">
                      <FileText className="h-3.5 w-3.5" />
                    </div>
                    <div className="dashboard-message-bubble ai-bubble">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm opacity-70">{txt.processingOCR}</span>
                      </div>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Floating scroll-to-bottom button */}
          {showScrollButton && messages.length > 0 && (
            <button
              onClick={scrollToBottom}
              className="dashboard-scroll-btn"
              aria-label="Scroll to bottom"
            >
              <ChevronDown className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Input Bar - WhatsApp style */}
        <div className="dashboard-input-bar" onClick={handleInputClick}>
          {/* Mic button */}
          {speechSupported && (
            <button
              onClick={toggleListening}
              disabled={isLoading || isProcessingFile}
              className={`dashboard-mic-btn ${isListening ? 'active' : ''}`}
              aria-label={isListening ? txt.stop : 'Voice'}
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
            placeholder={isListening ? txt.listening : txt.placeholder}
            className={`dashboard-text-input ${isListening ? 'listening' : ''}`}
            disabled={isLoading || isProcessingFile}
            readOnly={isListening}
          />

          {/* Send button */}
          <button
            onClick={() => {
              // CRITICAL: Capture text BEFORE stopping recording to prevent race condition
              const textToSend = isListening 
                ? (finalTranscriptRef.current || input).trim()
                : input.trim();
              
              // Stop voice recording if active
              if (isListening) {
                stopRecording();
                finalTranscriptRef.current = '';
              }
              
              if (isLimitReached) {
                setShowUpgradeModal(true);
                return;
              }
              
              if (textToSend) {
                sendMessage(textToSend);
              }
            }}
            disabled={(!input.trim() && !isListening) || isLoading || isProcessingFile}
            className="dashboard-send-btn"
            aria-label="Send"
          >
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </button>
        </div>

        {/* ALL 6 ACTION BUTTONS - 2x3 grid, EXACTLY LIKE DEMO CHAT */}
        <div className="dashboard-actions-grid">
          {/* Row 1 */}
          <button 
            onClick={handleCameraClick} 
            disabled={isLoading || isProcessingFile || isLimitReached} 
            className="dashboard-action-btn"
          >
            <Camera className="h-5 w-5" />
            <span>{txt.scanDocument}</span>
          </button>
          <button 
            onClick={handleFileClick} 
            disabled={isLoading || isProcessingFile || isLimitReached} 
            className="dashboard-action-btn"
          >
            <Paperclip className="h-5 w-5" />
            <span>{txt.uploadFile}</span>
          </button>

          {/* Row 2 */}
          <button 
            onClick={handleCopyDraft} 
            disabled={!hasLetterDraft}
            className="dashboard-action-btn"
          >
            {draftCopied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
            <span>{txt.copyLetter}</span>
          </button>
          <button 
            onClick={handlePreview} 
            disabled={!hasLetterDraft}
            className="dashboard-action-btn"
          >
            <Eye className="h-5 w-5" />
            <span>{txt.preview}</span>
          </button>

          {/* Row 3 */}
          <button 
            onClick={handlePrint} 
            disabled={!hasLetterDraft}
            className="dashboard-action-btn"
          >
            <Printer className="h-5 w-5" />
            <span>{txt.print}</span>
          </button>
          <button 
            onClick={handleEmail} 
            disabled={!hasLetterDraft}
            className="dashboard-action-btn"
          >
            <Mail className="h-5 w-5" />
            <span>{txt.email}</span>
          </button>
          {/* SAVE CASE BUTTON - inside the grid for perfect alignment */}
          {isDocumentReady && (
            <button 
              onClick={() => {
                setCaseName(chatTopic || '');
                setShowCaseNameDialog(true);
              }}
              disabled={isCreatingCase}
              className="dashboard-save-case-btn-inline"
            >
              <Save className="h-5 w-5" />
              <span>{txt.saveCase}</span>
            </button>
          )}
        </div>

        {/* Clear Conversation Button - spans full width, same style as demo chat */}
        {messages.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <div className="dashboard-clear-row">
                <button className="dashboard-clear-btn">
                  <Trash2 className="h-4 w-4" />
                  <span>{txt.clearConversation}</span>
                </button>
              </div>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('dashboardChat.clearChatTitle')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('dashboardChat.clearChatDesc')}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                <AlertDialogAction onClick={handleClearChat} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  {t('dashboardChat.clearChatConfirm')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {/* Camera permission now handled by /scan page */}

      {/* Case Naming Dialog - Auto-shown when document is ready */}
      <Dialog open={showCaseNameDialog} onOpenChange={setShowCaseNameDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-gold" />
              {txt.nameYourCase}
            </DialogTitle>
            <DialogDescription>
              {txt.nameYourCaseDesc}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={caseName}
              onChange={(e) => setCaseName(e.target.value)}
              placeholder={txt.caseNamePlaceholder}
              className="w-full"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && caseName.trim()) {
                  e.preventDefault();
                  handleSaveCaseWithName();
                }
              }}
            />
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={handleCancelCaseDialog} disabled={isCreatingCase}>
              {txt.cancel}
            </Button>
            <Button 
              onClick={handleSaveCaseWithName} 
              disabled={!caseName.trim() || isCreatingCase}
              className="bg-gold text-navy hover:bg-gold/90"
            >
              {isCreatingCase ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {txt.creatingCase}
                </>
              ) : (
                txt.saveCase
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upgrade Modal for Limits Reached */}
      <PlanLimitPopup 
        open={showUpgradeModal} 
        onClose={() => setShowUpgradeModal(false)} 
        limitType="messages"
      />

      <style>{`
        /* ========================================
           PREMIUM DASHBOARD CHAT - EXACTLY MATCHES DEMO CHAT
           ======================================== */
        
        .dashboard-chat-premium {
          display: flex;
          justify-content: center;
          align-items: flex-start;
          padding: 20px 12px;
          background: linear-gradient(180deg, 
            #0B1C2D 0%, 
            #122536 100%);
        }

        /* Main frame wrapper - SAME AS DEMO */
        .dashboard-frame-wrapper {
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
          transition: border-color 0.4s ease, box-shadow 0.4s ease;
        }
        .dashboard-frame-wrapper.letter-ready {
          border-color: #22c55e;
          box-shadow: 
            0 0 0 2px #0B1C2D,
            0 0 0 5px #16a34a,
            0 0 20px rgba(34, 197, 94, 0.35),
            0 20px 60px rgba(0,0,0,0.5);
        }

        @media (min-width: 768px) {
          .dashboard-frame-wrapper {
            max-width: 500px;
          }
        }

        /* Golden Header with fleur decorations */
        .dashboard-gold-header {
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
          position: relative;
        }

        .dashboard-fleur {
          color: #E8D5A3;
          font-size: 16px;
          opacity: 0.8;
        }

        .dashboard-gold-header svg {
          color: #FFF8E7 !important;
          filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));
        }

        .dashboard-title {
          color: #FFF8E7;
          font-weight: 600;
          font-size: 15px;
          letter-spacing: 0.5px;
          text-shadow: 0 1px 2px rgba(0,0,0,0.4);
        }


        /* Inner content area - parchment look with gold border */
        .dashboard-inner-content {
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
          .dashboard-inner-content {
            margin: 12px;
            max-height: 65vh;
            min-height: 350px;
          }
        }

        /* Response area - internal scroll */
        .dashboard-response-area {
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
        .dashboard-empty-state {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 24px;
          gap: 12px;
        }

        .dashboard-empty-icon {
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

        .dashboard-empty-icon svg {
          color: #B8954A !important;
        }

        .dashboard-empty-state p {
          color: #5A4D3A;
          font-style: italic;
          font-size: 14px;
        }

        /* Messages */
        .dashboard-message {
          display: flex;
          gap: 8px;
          align-items: flex-start;
        }

        .dashboard-message-user {
          flex-direction: row-reverse;
        }

        .dashboard-message-avatar {
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

        .dashboard-message-avatar svg {
          color: #C9A24D !important;
        }

        .dashboard-message-ai .dashboard-message-avatar {
          background: linear-gradient(135deg, #C9A24D, #A8863D);
        }

        .dashboard-message-ai .dashboard-message-avatar svg {
          color: #FFF8E7 !important;
        }

        .dashboard-message-bubble {
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

        .dashboard-copy-btn {
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

        .dashboard-message-bubble:hover .dashboard-copy-btn {
          opacity: 1;
        }

        @media (hover: none) {
          .dashboard-copy-btn {
            opacity: 0.7;
          }
        }

        /* Floating scroll-to-bottom button - WHITE */
        .dashboard-scroll-btn {
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

        .dashboard-scroll-btn:hover {
          background: #F5F0E1;
          transform: translateX(-50%) scale(1.05);
        }

        /* Input bar - cream/parchment style */
        .dashboard-input-bar {
          position: relative;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          padding-right: 56px;
          margin: 0 8px 8px 8px;
          background: linear-gradient(180deg, #F5EED8, #E8E0C8);
          border: 2px solid #C9A24D;
          border-radius: 28px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        }

        @media (min-width: 768px) {
          .dashboard-input-bar {
            margin: 0 12px 12px 12px;
          }
        }

        .dashboard-mic-btn {
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

        .dashboard-mic-btn:hover:not(:disabled) {
          background: #C9A24D;
          color: #FFF8E7;
        }

        .dashboard-mic-btn.active {
          background: #DC3545 !important;
          border-color: #C82333 !important;
          color: white !important;
          animation: pulse 1.5s infinite;
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }

        .dashboard-text-input {
          flex: 1;
          height: 40px;
          padding: 0 8px;
          border: none;
          background: transparent;
          font-size: 16px;
          color: #3D3426;
          outline: none;
          min-width: 0;
        }

        .dashboard-text-input::placeholder {
          color: #8B7D64;
          font-size: 12px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .dashboard-text-input.listening {
          color: #DC3545;
        }

        .dashboard-send-btn {
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
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
        }

        .dashboard-send-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, #C9A24D, #A8863D);
          color: #FFF8E7;
        }

        .dashboard-send-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* ACTION BUTTONS - 2x3 GRID, ALL 6 ALWAYS VISIBLE - EXACTLY LIKE DEMO */
        .dashboard-actions-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          padding: 12px;
          background: linear-gradient(180deg, #0B1C2D, #0D1F30);
        }

        .dashboard-action-btn {
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

        .dashboard-action-btn svg {
          color: #C9A24D;
          flex-shrink: 0;
        }

        .dashboard-action-btn:hover:not(:disabled) {
          background: linear-gradient(180deg, #C9A24D, #A8863D);
          color: #0B1C2D;
          border-color: #C9A24D;
        }

        .dashboard-action-btn:hover:not(:disabled) svg {
          color: #0B1C2D;
        }

        .dashboard-action-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        /* SAVE CASE BUTTON - inline in grid, spans full width */
        .dashboard-save-case-btn-inline {
          grid-column: 1 / -1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 14px 20px;
          border-radius: 10px;
          background: linear-gradient(180deg, #C9A24D, #A8863D);
          color: #0B1C2D;
          font-size: 15px;
          font-weight: 600;
          border: 2px solid #E0C068;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 
            0 4px 12px rgba(201, 162, 77, 0.4),
            inset 0 1px 0 rgba(255, 255, 255, 0.2);
        }

        .dashboard-save-case-btn-inline svg {
          color: #0B1C2D;
          flex-shrink: 0;
        }

        .dashboard-save-case-btn-inline:hover:not(:disabled) {
          background: linear-gradient(180deg, #E0C068, #C9A24D);
          box-shadow: 
            0 6px 16px rgba(201, 162, 77, 0.5),
            inset 0 1px 0 rgba(255, 255, 255, 0.3);
          transform: translateY(-1px);
        }

        .dashboard-save-case-btn-inline:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        /* CLEAR CONVERSATION ROW - spans full width like 2 buttons */
        .dashboard-clear-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          padding: 0 12px 12px 12px;
          background: linear-gradient(180deg, #0D1F30, #0B1C2D);
        }

        .dashboard-clear-btn {
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

        .dashboard-clear-btn svg {
          color: #0B1C2D;
          flex-shrink: 0;
        }

        .dashboard-clear-btn:hover {
          background: linear-gradient(180deg, #E5C76B 0%, #D4AF5A 40%, #C9A24D 100%);
          border-color: #F0D87A;
          transform: translateY(-1px);
          box-shadow: 
            0 6px 16px rgba(168, 134, 61, 0.5),
            0 3px 6px rgba(0, 0, 0, 0.25),
            inset 0 1px 0 rgba(255, 255, 255, 0.3),
            inset 0 -2px 4px rgba(0, 0, 0, 0.1);
        }

        .dashboard-clear-btn:active {
          transform: translateY(1px);
          box-shadow: 
            0 2px 6px rgba(168, 134, 61, 0.3),
            0 1px 2px rgba(0, 0, 0, 0.2),
            inset 0 2px 4px rgba(0, 0, 0, 0.15);
        }
          opacity: 0.6;
          cursor: not-allowed;
        }

        /* Scrollbar styling */
        .dashboard-response-area::-webkit-scrollbar {
          width: 6px;
        }

        .dashboard-response-area::-webkit-scrollbar-track {
          background: rgba(201, 162, 77, 0.1);
          border-radius: 3px;
        }

        .dashboard-response-area::-webkit-scrollbar-thumb {
          background: #C9A24D;
          border-radius: 3px;
        }

        /* Safe area for iOS */
        @supports (padding-bottom: env(safe-area-inset-bottom)) {
          .dashboard-clear-row {
            padding-bottom: calc(12px + env(safe-area-inset-bottom));
          }
        }
            padding-bottom: calc(12px + env(safe-area-inset-bottom));
          }
        }
      `}</style>
      
      {/* Payment Blocked Popup */}
      <PaymentBlockedPopup 
        isOpen={showPaymentBlockedPopup} 
        onClose={() => setShowPaymentBlockedPopup(false)} 
      />
    </section>
  );
}
