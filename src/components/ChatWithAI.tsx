import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useLanguage, Language } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Send, Mic, MicOff, Loader2, Bot, FileText, Copy, Check, ChevronDown, Square, Sparkles, User } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { extractFormalLetterOnly } from '@/lib/extractFormalLetter';
import { useEntitlements } from '@/hooks/useEntitlements';
import { PaymentBlockedPopup } from '@/components/PaymentBlockedPopup';
import { useCaseChatMessages } from '@/hooks/useCaseChatMessages';
import { isLegalAdministrativeQuery } from '@/lib/aiGuardrail';
import { shouldSearchLegalInfo, searchLegalInfoWithTimeout, buildLegalSearchQuery, type LegalSearchResult } from '@/services/webSearch';
// ═══════════════════════════════════════════════════════════════════════════
// LETTER EXTRACTION UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Detects if AI response contains a letter (using markers or heuristics)
 */
function containsLetter(content: string): boolean {
  // Check for explicit markers first
  if (content.includes('---LETTERA---') && content.includes('---FINE LETTERA---')) {
    return true;
  }
  
  // Fallback: heuristic detection for letters without markers
  const letterPatterns = [
    /^(Sehr geehrte|An das|An die|Betreff:|Absender:)/m,
    /^(Gentile|Spett\.|Spett\.le|Egregio|Oggetto:)/m,
    /^(Dear|To whom it may concern|Subject:|Re:)/im,
    /^(Estimado|Estimada|Asunto:)/im,
    /^(Cher|Chère|Objet:)/im,
  ];
  
  const hasLetterStart = letterPatterns.some(p => p.test(content));
  const hasLetterClosing = /Mit freundlichen Grüßen|Cordiali saluti|Sincerely|Best regards|Atentamente|Cordialement/i.test(content);
  
  return hasLetterStart && hasLetterClosing && content.length > 300;
}

/**
 * Extracts ONLY the letter portion from AI response, cleaning chat phrases
 */
function extractLetterContent(content: string): string {
  let letterText = content;
  
  // 1. Try to extract using explicit markers
  const markerMatch = content.match(/---LETTERA---\s*([\s\S]*?)\s*---FINE LETTERA---/i);
  if (markerMatch) {
    letterText = markerMatch[1].trim();
  } else {
    // 2. Fallback: Try to find letter start patterns and extract from there
    const letterStartPatterns = [
      /(?:^|\n)(Sehr geehrte[\s\S]*)/m,
      /(?:^|\n)(Gentile[\s\S]*)/m,
      /(?:^|\n)(Spett\.[\s\S]*)/m,
      /(?:^|\n)(Egregio[\s\S]*)/m,
      /(?:^|\n)(Dear[\s\S]*)/im,
      /(?:^|\n)(To whom it may concern[\s\S]*)/im,
    ];
    
    for (const pattern of letterStartPatterns) {
      const match = content.match(pattern);
      if (match) {
        letterText = match[1].trim();
        break;
      }
    }
  }
  
  // 3. Cleanup: remove chat phrases that may have leaked into letter
  const chatPhrases = [
    /^(Ecco la (tua )?bozza[.:!]?\s*)/i,
    /^(Here is the (draft|letter)[.:!]?\s*)/i,
    /^(Hier ist der (Entwurf|Brief)[.:!]?\s*)/i,
    /^(Certamente[,!.]?\s*)/i,
    /^(Certainly[,!.]?\s*)/i,
    /^(Natürlich[,!.]?\s*)/i,
    /^(Of course[,!.]?\s*)/i,
    /^(Certo[,!.]?\s*)/i,
    /^(Selbstverständlich[,!.]?\s*)/i,
    /(Spero (ti )?sia d'aiuto[.!]?\s*$)/i,
    /(Hope this helps[.!]?\s*$)/i,
    /(Ich hoffe, das hilft[.!]?\s*$)/i,
    /(Let me know if you need[^.]*[.!]?\s*$)/i,
    /(Fammi sapere se[^.]*[.!]?\s*$)/i,
    /(Falls Sie Fragen haben[^.]*[.!]?\s*$)/i,
  ];
  
  for (const phrase of chatPhrases) {
    letterText = letterText.replace(phrase, '');
  }
  
  // 4. Remove markdown artifacts
  letterText = letterText
    .replace(/^```[\s\S]*?\n/gm, '') // Remove code block starts
    .replace(/\n```$/gm, '')         // Remove code block ends
    .replace(/^---+$/gm, '')          // Remove horizontal rules (but not our markers)
    .replace(/^\*\*\*+$/gm, '')       // Remove bold/italic separators
    .replace(/^\s*#+\s+/gm, '')       // Remove markdown headers
    .trim();
  
  return letterText;
}

// Fallback assistant message on API/network error – evita UI rotta e "temporary error" senza contesto
const FALLBACK_REPLY_BY_LANG: Record<string, string> = {
  IT: "Si è verificato un errore temporaneo. Riprova tra poco.",
  EN: "Something went wrong. Please try again in a moment.",
  DE: "Ein vorübergehender Fehler ist aufgetreten. Bitte versuche es gleich noch einmal.",
  FR: "Une erreur temporaire s'est produite. Veuillez réessayer dans un instant.",
  ES: "Ha ocurrido un error temporal. Por favor, inténtalo de nuevo en un momento.",
  PL: "Wystąpił tymczasowy błąd. Spróbuj ponownie za chwilę.",
};
const FALLBACK_REPLY_DEFAULT = FALLBACK_REPLY_BY_LANG.EN;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

interface ChatWithAIProps {
  praticaId: string;
  chatHistory: ChatMessage[];
  onChatHistoryUpdate: (history: ChatMessage[]) => void;
  letterText: string | null;
  draftResponse?: string | null;
  praticaData: {
    authority: string | null;
    aktenzeichen: string | null;
    deadline: string | null;
    title: string;
  };
  onNewInstruction?: (instruction: string) => void;
  onAssistantResponse?: (assistantContent: string) => void;
  onRegenerateDraft?: () => void;
  isRegenerating?: boolean;
  mode?: 'chat' | 'modify';
}

// Localized text for all supported languages
const getLocalizedText = (language: Language) => {
  const texts: Record<Language, {
    placeholder: string;
    inputTitle: string;
    inputPlaceholder: string;
    thinking: string;
    searchingLegalSources: string;
    stop: string;
    copyMessage: string;
    copied: string;
    updateDraft: string;
    draftUpdated: string;
    noLetterFound: string;
  }> = {
    IT: {
      placeholder: "Es. 'Formulazione più decisa' o 'Aggiungi che ho già pagato'...",
      inputTitle: 'Chiedi alla IA di modificare il testo',
      inputPlaceholder: 'Scrivi qui cosa vuoi modificare...',
      thinking: 'Sto pensando...',
      searchingLegalSources: '🔍 Sto consultando fonti ufficiali...',
      stop: 'Stop',
      copyMessage: 'Copia messaggio',
      copied: 'Copiato!',
      updateDraft: 'Aggiorna bozza',
      draftUpdated: 'Bozza aggiornata!',
      noLetterFound: 'Nessuna lettera trovata',
    },
    DE: {
      placeholder: "Z.B. 'Bestimmter formulieren' oder 'Hinzufügen, dass ich bereits bezahlt habe'...",
      inputTitle: 'Bitte die KI, den Entwurf zu ändern',
      inputPlaceholder: 'Schreiben Sie hier, was Sie ändern möchten...',
      thinking: 'Ich denke nach...',
      searchingLegalSources: '🔍 Aktuelle Rechtsquellen werden abgefragt...',
      stop: 'Stop',
      copyMessage: 'Nachricht kopieren',
      copied: 'Kopiert!',
      updateDraft: 'Entwurf aktualisieren',
      draftUpdated: 'Entwurf aktualisiert!',
      noLetterFound: 'Kein Brief gefunden',
    },
    EN: {
      placeholder: "E.g. 'More assertive wording' or 'Add that I already paid'...",
      inputTitle: 'Ask the AI to modify the text',
      inputPlaceholder: 'Write here what you want to change...',
      thinking: 'Thinking...',
      searchingLegalSources: '🔍 Searching for updated legal sources...',
      stop: 'Stop',
      copyMessage: 'Copy message',
      copied: 'Copied!',
      updateDraft: 'Update draft',
      draftUpdated: 'Draft updated!',
      noLetterFound: 'No letter found',
    },
    FR: {
      placeholder: "Ex. 'Formulation plus ferme' ou 'Ajouter que j'ai déjà payé'...",
      inputTitle: 'Demandez à l\'IA de modifier le texte',
      inputPlaceholder: 'Écrivez ici ce que vous souhaitez modifier...',
      thinking: 'Je réfléchis...',
      searchingLegalSources: '🔍 Recherche de sources juridiques à jour...',
      stop: 'Stop',
      copyMessage: 'Copier le message',
      copied: 'Copié!',
      updateDraft: 'Mettre à jour le brouillon',
      draftUpdated: 'Brouillon mis à jour!',
      noLetterFound: 'Aucune lettre trouvée',
    },
    ES: {
      placeholder: "Ej. 'Redacción más firme' o 'Agregar que ya pagué'...",
      inputTitle: 'Pide a la IA que modifique el texto',
      inputPlaceholder: 'Escribe aquí lo que quieres cambiar...',
      thinking: 'Pensando...',
      searchingLegalSources: '🔍 Buscando fuentes jurídicas actualizadas...',
      stop: 'Detener',
      copyMessage: 'Copiar mensaje',
      copied: '¡Copiado!',
      updateDraft: 'Actualizar borrador',
      draftUpdated: '¡Borrador actualizado!',
      noLetterFound: 'No se encontró carta',
    },
    PL: {
      placeholder: "Np. 'Bardziej stanowcze sformułowanie' lub 'Dodaj, że już zapłaciłem'...",
      inputTitle: 'Poproś AI o modyfikację tekstu',
      inputPlaceholder: 'Napisz, co chcesz zmienić...',
      thinking: 'Myślę...',
      searchingLegalSources: '🔍 Szukam zaktualizowanych źródeł prawnych...',
      stop: 'Stop',
      copyMessage: 'Kopiuj wiadomość',
      copied: 'Skopiowano!',
      updateDraft: 'Zaktualizuj szkic',
      draftUpdated: 'Szkic zaktualizowany!',
      noLetterFound: 'Nie znaleziono listu',
    },
    RO: {
      placeholder: "Ex. 'Formulare mai fermă' sau 'Adaugă că am plătit deja'...",
      inputTitle: 'Cere AI-ului să modifice textul',
      inputPlaceholder: 'Scrie aici ce vrei să schimbi...',
      thinking: 'Mă gândesc...',
      searchingLegalSources: '🔍 Căutare surse juridice actualizate...',
      stop: 'Stop',
      copyMessage: 'Copiază mesajul',
      copied: 'Copiat!',
      updateDraft: 'Actualizează ciorna',
      draftUpdated: 'Ciornă actualizată!',
      noLetterFound: 'Nicio scrisoare găsită',
    },
    TR: {
      placeholder: "Örn. 'Daha kararlı ifade' veya 'Zaten ödediğimi ekle'...",
      inputTitle: 'AI\'dan metni değiştirmesini isteyin',
      inputPlaceholder: 'Neyi değiştirmek istediğinizi yazın...',
      thinking: 'Düşünüyorum...',
      searchingLegalSources: '🔍 Güncel hukuki kaynaklar aranıyor...',
      stop: 'Dur',
      copyMessage: 'Mesajı kopyala',
      copied: 'Kopyalandı!',
      updateDraft: 'Taslağı güncelle',
      draftUpdated: 'Taslak güncellendi!',
      noLetterFound: 'Mektup bulunamadı',
    },
    AR: {
      placeholder: "مثال: 'صياغة أكثر حزماً' أو 'أضف أنني دفعت بالفعل'...",
      inputTitle: 'اطلب من الذكاء الاصطناعي تعديل النص',
      inputPlaceholder: 'اكتب هنا ما تريد تغييره...',
      thinking: 'أفكر...',
      searchingLegalSources: '🔍 جاري البحث عن مصادر قانونية محدثة...',
      stop: 'إيقاف',
      copyMessage: 'نسخ الرسالة',
      copied: 'تم النسخ!',
      updateDraft: 'تحديث المسودة',
      draftUpdated: 'تم تحديث المسودة!',
      noLetterFound: 'لم يتم العثور على خطاب',
    },
    UK: {
      placeholder: "Напр. 'Більш рішуче формулювання' або 'Додати, що я вже заплатив'...",
      inputTitle: 'Попросіть ШІ змінити текст',
      inputPlaceholder: 'Напишіть тут, що ви хочете змінити...',
      thinking: 'Думаю...',
      searchingLegalSources: '🔍 Пошук актуальних правових джерел...',
      stop: 'Стоп',
      copyMessage: 'Копіювати повідомлення',
      copied: 'Скопійовано!',
      updateDraft: 'Оновити чернетку',
      draftUpdated: 'Чернетку оновлено!',
      noLetterFound: 'Лист не знайдено',
    },
    RU: {
      placeholder: "Напр. 'Более решительная формулировка' или 'Добавить, что я уже заплатил'...",
      inputTitle: 'Попросите ИИ изменить текст',
      inputPlaceholder: 'Напишите здесь, что вы хотите изменить...',
      thinking: 'Думаю...',
      searchingLegalSources: '🔍 Поиск актуальных правовых источников...',
      stop: 'Стоп',
      copyMessage: 'Копировать сообщение',
      copied: 'Скопировано!',
      updateDraft: 'Обновить черновик',
      draftUpdated: 'Черновик обновлён!',
      noLetterFound: 'Письмо не найдено',
    },
  };
  return texts[language] || texts.EN;
};

// Detect placeholders in draft that need user input
function detectPlaceholders(text: string | null | undefined): string[] {
  if (!text) return [];
  
  // Common placeholder patterns across languages
  const placeholderPattern = /\[([^\]]+)\]/g;
  const matches = text.match(placeholderPattern) || [];
  
  // Filter out system markers (whitelisted)
  const systemMarkers = ['LETTER', '/LETTER', 'BRIEF', '/BRIEF', 'LETTERA', '/LETTERA', 'CARTA', '/CARTA'];
  
  return matches.filter(m => {
    const inner = m.slice(1, -1).toUpperCase();
    return !systemMarkers.includes(inner);
  });
}

// Localized auto-ask messages for missing data
const getAutoAskMessage = (language: Language, placeholders: string[]): string => {
  const placeholderList = placeholders.join(', ');
  
  const messages: Record<Language, string> = {
    DE: `Ich habe bemerkt, dass in Ihrem Entwurf noch einige Angaben fehlen: ${placeholderList}.\n\nBitte teilen Sie mir diese Informationen mit, damit ich den Entwurf vervollständigen kann (z.B. Ihr vollständiger Name, Adresse, Geburtsdatum usw.).`,
    EN: `I noticed your draft is missing some information: ${placeholderList}.\n\nPlease provide these details so I can complete the draft (e.g., your full name, address, date of birth, etc.).`,
    IT: `Ho notato che nella bozza mancano alcune informazioni: ${placeholderList}.\n\nPer favore, forniscimi questi dati per completare la lettera (es. nome completo, indirizzo, data di nascita, ecc.).`,
    FR: `J'ai remarqué qu'il manque certaines informations dans votre brouillon: ${placeholderList}.\n\nVeuillez me fournir ces détails pour compléter la lettre (ex. nom complet, adresse, date de naissance, etc.).`,
    ES: `He notado que faltan algunos datos en su borrador: ${placeholderList}.\n\nPor favor, proporcione esta información para completar la carta (ej. nombre completo, dirección, fecha de nacimiento, etc.).`,
    TR: `Taslağınızda bazı bilgilerin eksik olduğunu fark ettim: ${placeholderList}.\n\nMektubu tamamlayabilmem için lütfen bu bilgileri sağlayın (örn. tam ad, adres, doğum tarihi, vb.).`,
    RO: `Am observat că în ciorna lipsesc unele informații: ${placeholderList}.\n\nVă rog să furnizați aceste detalii pentru a finaliza scrisoarea (ex. nume complet, adresă, dată naștere, etc.).`,
    PL: `Zauważyłem, że w szkicu brakuje niektórych informacji: ${placeholderList}.\n\nProszę podać te dane, abym mógł uzupełnić list (np. pełne imię i nazwisko, adres, data urodzenia, itp.).`,
    RU: `Я заметил, что в черновике отсутствуют некоторые данные: ${placeholderList}.\n\nПожалуйста, предоставьте эту информацию для завершения письма (напр. полное имя, адрес, дата рождения и т.д.).`,
    UK: `Я помітив, що у чернетці відсутні деякі дані: ${placeholderList}.\n\nБудь ласка, надайте цю інформацію для завершення листа (напр. повне ім'я, адреса, дата народження тощо).`,
    AR: `لاحظت أن المسودة تفتقد بعض المعلومات: ${placeholderList}.\n\nيرجى تقديم هذه التفاصيل لإكمال الرسالة (مثل الاسم الكامل، العنوان، تاريخ الميلاد، إلخ).`,
  };
  
  return messages[language] || messages.EN;
};

export function ChatWithAI({
  praticaId,
  chatHistory,
  onChatHistoryUpdate,
  letterText,
  draftResponse,
  praticaData,
  onNewInstruction,
  onAssistantResponse,
  mode = 'chat',
}: ChatWithAIProps) {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { entitlements } = useEntitlements();
  const txt = getLocalizedText(language);
  
  // Unified case chat messages hook
  const { addMessage: addCaseChatMessage } = useCaseChatMessages({ 
    caseId: praticaId, 
    scope: 'case' 
  });

  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [copiedMessageIndex, setCopiedMessageIndex] = useState<number | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [showPaymentBlockedPopup, setShowPaymentBlockedPopup] = useState(false);
  const [hasShownAutoAsk, setHasShownAutoAsk] = useState(false);
  const [isSearchingLegal, setIsSearchingLegal] = useState(false);
  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  // Voice input refs for continuous mode (iOS/Safari compatibility)
  const isRecordingRef = useRef(false);
  const finalTranscriptRef = useRef('');
  
  // Auto-ask for missing data when entering Edit page with placeholders
  useEffect(() => {
    if (mode !== 'modify' || hasShownAutoAsk || chatHistory.length > 0) return;
    
    const placeholders = detectPlaceholders(draftResponse);
    if (placeholders.length === 0) return;
    
    // Generate assistant message asking for missing info
    const autoAskMsg: ChatMessage = {
      role: 'assistant',
      content: getAutoAskMessage(language, placeholders),
      created_at: new Date().toISOString(),
    };
    
    onChatHistoryUpdate([autoAskMsg]);
    addCaseChatMessage('assistant', autoAskMsg.content);
    setHasShownAutoAsk(true);
  }, [mode, draftResponse, chatHistory.length, hasShownAutoAsk, language, onChatHistoryUpdate, addCaseChatMessage]);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setSpeechSupported(!!SpeechRecognition);
  }, []);

  // Track scroll position to show/hide scroll button
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    
    const handleScroll = () => {
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
      setShowScrollButton(!isNearBottom);
    };
    
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
  }, [chatHistory, isLoading]);

  // Helper to update message and auto-scroll input
  const updateMessageWithScroll = (text: string) => {
    setMessage(text);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(text.length, text.length);
        el.scrollLeft = el.scrollWidth;
      }
    });
  };

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error(t('chat.speechNotSupported'));
      return;
    }

    // Reset state - start with current message
    finalTranscriptRef.current = message;
    isRecordingRef.current = true;
    setIsListening(true);

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language === 'DE' ? 'de-DE' : language === 'IT' ? 'it-IT' : language === 'FR' ? 'fr-FR' : language === 'ES' ? 'es-ES' : 'en-US';

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
      updateMessageWithScroll(displayText);
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
        // Don't stop - continue listening
      } else if (err === 'aborted') {
        // Expected when manually stopped
      } else {
        isRecordingRef.current = false;
        setIsListening(false);
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch (err) {
      console.error('[Voice] Failed to start:', err);
      toast.error(t('chat.speechError'));
      isRecordingRef.current = false;
      setIsListening(false);
    }
  };

  const stopListening = () => {
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
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const scrollToBottom = () => {
    const container = messagesContainerRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
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
      toast.info(txt.stop);
    }
  };

  const sendMessage = async () => {
    // CRITICAL: Capture text BEFORE stopping recording to prevent race condition
    const textToSend = isListening 
      ? (finalTranscriptRef.current || message).trim()
      : message.trim();
    
    // Stop microphone when sending message
    if (isListening) {
      stopListening();
      finalTranscriptRef.current = '';
    }
    
    if (!textToSend || isLoading) return;

    // Guardrail: block non-legal/administrative queries before sending
    if (!isLegalAdministrativeQuery(textToSend)) {
      toast.error(t('chat.outOfScopeRefusal'));
      return;
    }

    if ((entitlements as any)?.access_state === 'blocked') {
      setShowPaymentBlockedPopup(true);
      return;
    }

    const userMessage: ChatMessage = {
      role: 'user',
      content: textToSend,
      created_at: new Date().toISOString(),
    };

    const newHistory = [...chatHistory, userMessage];
    onChatHistoryUpdate(newHistory);
    setMessage('');
    setIsLoading(true);

    // Legal web search: if message matches patterns (recent law, decree, Cassation, etc.), fetch official sources first
    let legalSearchContext: LegalSearchResult[] = [];
    if (shouldSearchLegalInfo(textToSend)) {
      setIsSearchingLegal(true);
      try {
        legalSearchContext = await searchLegalInfoWithTimeout(
          buildLegalSearchQuery(textToSend),
          language.toLowerCase().slice(0, 2),
          3
        );
      } finally {
        setIsSearchingLegal(false);
      }
    }

    // Save to unified case_chat_messages
    addCaseChatMessage('user', userMessage.content);

    // Also persist to legacy pratiche.chat_history for backward compatibility
    supabase
      .from('pratiche')
      .update({ chat_history: newHistory as unknown as any })
      .eq('id', praticaId)
      .then(({ error }) => {
        if (error) console.error('Error saving chat history (early):', error);
      });

    if (onNewInstruction) {
      onNewInstruction(userMessage.content);
    }

    try {
      // Create abort controller for cancellation
      abortControllerRef.current = new AbortController();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-with-ai`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({
            userMessage: userMessage.content,
            letterText,
            draftResponse,
            praticaData,
            chatHistory: newHistory,
            userLanguage: language,
            mode,
            praticaId, // Pass pratica ID for context isolation
            legalSearchContext: legalSearchContext.length > 0 ? legalSearchContext : undefined,
          }),
          signal: abortControllerRef.current.signal,
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        console.error('AI error:', data.error);
        const lang = (language || 'en').slice(0, 2).toUpperCase();
        const fallbackContent = FALLBACK_REPLY_BY_LANG[lang] || FALLBACK_REPLY_DEFAULT;
        const fallbackMessage: ChatMessage = { role: 'assistant', content: fallbackContent, created_at: new Date().toISOString() };
        const updatedWithFallback = [...newHistory, fallbackMessage];
        onChatHistoryUpdate(updatedWithFallback);
        addCaseChatMessage('assistant', fallbackContent);
        if (data.error.includes('Rate limit')) {
          toast.error(t('pratica.detail.rateLimitError'));
        } else if (data.error.includes('credits')) {
          toast.error(t('pratica.detail.creditsError'));
        } else {
          toast.error(t('chat.error'));
        }
        setIsLoading(false);
        abortControllerRef.current = null;
        return;
      }

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.response,
        created_at: new Date().toISOString(),
      };

      // Save assistant response to unified case_chat_messages
      addCaseChatMessage('assistant', data.response);

      const updatedHistory = [...newHistory, assistantMessage];
      onChatHistoryUpdate(updatedHistory);

      // Also persist to legacy pratiche.chat_history for backward compatibility
      await supabase
        .from('pratiche')
        .update({ chat_history: updatedHistory as unknown as any })
        .eq('id', praticaId);

      // Only trigger draft suggestion for actual letter drafts
      if (mode === 'modify') {
        const content = assistantMessage.content;
        const looksLikeDraft = 
          content.length > 500 && (
            /^(Sehr geehrte|An das|An die|Betreff:|Absender:)/m.test(content) ||
            /^(Gentile|Spett\.le|Egregio|Oggetto:)/m.test(content) ||
            /^(Dear|To whom it may concern|Subject:|Re:)/im.test(content) ||
            (/\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/.test(content) && /Mit freundlichen Grüßen|Cordiali saluti|Sincerely|Best regards/i.test(content))
          );
        
        if (looksLikeDraft) {
          const extracted = extractFormalLetterOnly(content) ?? extractLetterContent(content);
          if (extracted && extracted.length >= 200) {
            onAssistantResponse?.(extracted);
          }
        }
      }
    } catch (err: any) {
      // Don't show error for aborted requests
      if (err?.name === 'AbortError') {
        console.log('Request aborted by user');
        return;
      }
      console.error('Unexpected error:', err);
      const lang = (language || 'en').slice(0, 2).toUpperCase();
      const fallbackContent = FALLBACK_REPLY_BY_LANG[lang] || FALLBACK_REPLY_DEFAULT;
      const fallbackMessage: ChatMessage = { role: 'assistant', content: fallbackContent, created_at: new Date().toISOString() };
      const updatedWithFallback = [...newHistory, fallbackMessage];
      onChatHistoryUpdate(updatedWithFallback);
      addCaseChatMessage('assistant', fallbackContent);
      toast.error(t('chat.error'));
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Enter = blocked (do NOT send)
    // Shift+Enter = allowed (new line in input)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // Do nothing - only send icon should trigger message
      return;
    }
    // Shift+Enter: let default behavior happen (adds newline)
  };

  const handleUpdateDraft = () => {
    // Find the latest AI message with a letter
    const latestLetterMsg = [...chatHistory].reverse().find(
      msg => msg.role === 'assistant' && containsLetter(msg.content)
    );
    if (latestLetterMsg) {
      const cleanedLetter = extractLetterContent(latestLetterMsg.content);
      if (cleanedLetter && cleanedLetter.length > 100) {
        onAssistantResponse?.(cleanedLetter);
        toast.success(txt.draftUpdated);
        setTimeout(() => {
          const draftSection = document.querySelector('[data-draft-section]');
          draftSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      } else {
        toast.error(txt.noLetterFound);
      }
    }
  };

  const hasLetterInHistory = chatHistory.some(msg => msg.role === 'assistant' && containsLetter(msg.content));

  return (
    <div className="edit-chat-premium print:hidden">
      {/* Gold Header with icon */}
      <div className="edit-gold-header">
        <span className="edit-fleur">⚜</span>
        <Sparkles className="h-5 w-5" />
        <span className="edit-title">{txt.inputTitle}</span>
        <span className="edit-fleur">⚜</span>
      </div>

      {/* Inner parchment content area */}
      <div className="edit-inner-content">
        {/* Messages area */}
        <div 
          ref={messagesContainerRef}
          className="edit-response-area"
        >
          {chatHistory.length === 0 ? (
            <div className="edit-empty-state">
              <div className="edit-empty-icon">
                <Sparkles className="h-8 w-8" />
              </div>
              <p>{txt.placeholder}</p>
            </div>
          ) : (
            <>
              {chatHistory.map((msg, index) => (
                <div key={index} className={`edit-message ${msg.role === 'user' ? 'edit-message-user' : 'edit-message-ai'}`}>
                  <div className="edit-message-avatar">
                    {msg.role === 'assistant' ? (
                      <Sparkles className="h-3.5 w-3.5" />
                    ) : (
                      <User className="h-3.5 w-3.5" />
                    )}
                  </div>
                  <div className={`edit-message-bubble ${msg.role === 'user' ? 'user-bubble' : 'ai-bubble'}`}>
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">
                      {msg.content}
                    </div>
                    <div className="flex items-center justify-between mt-2 text-xs opacity-70">
                      <span>{format(new Date(msg.created_at), 'HH:mm')}</span>
                      <button
                        onClick={() => copyMessage(msg.content, index)}
                        className="edit-copy-btn"
                      >
                        {copiedMessageIndex === index ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Loading indicator */}
              {isLoading && (
                <div className="edit-message edit-message-ai">
                  <div className="edit-message-avatar">
                    <Sparkles className="h-3.5 w-3.5" />
                  </div>
                  <div className="ai-bubble edit-message-bubble flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{isSearchingLegal ? txt.searchingLegalSources : txt.thinking}</span>
                    <button
                      onClick={stopGeneration}
                      className="ml-2 px-2 py-1 text-xs bg-destructive/20 text-destructive rounded hover:bg-destructive/30"
                    >
                      <Square className="h-3 w-3 inline mr-1" />
                      {txt.stop}
                    </button>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Scroll to bottom button */}
        {showScrollButton && (
          <button
            type="button"
            onClick={scrollToBottom}
            className="edit-scroll-btn"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Input bar - WhatsApp style */}
      <div className="edit-input-bar">
        {speechSupported && (
          <button
            type="button"
            onClick={toggleListening}
            disabled={isLoading}
            className={`edit-mic-btn ${isListening ? 'active' : ''}`}
          >
            {isListening ? <Square className="h-4 w-4" /> : <Mic className="h-5 w-5" />}
          </button>
        )}

        <input
          ref={inputRef}
          type="text"
          placeholder={txt.inputPlaceholder}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          className={`edit-text-input ${isListening ? 'listening' : ''}`}
        />

        <button
          type="button"
          onClick={sendMessage}
          disabled={(!message.trim() && !isListening) || isLoading}
          className="edit-send-btn"
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* Update Draft Button - Only show if AI generated a letter */}
      {mode === 'modify' && hasLetterInHistory && (
        <div className="edit-update-draft-row">
          <button
            type="button"
            onClick={handleUpdateDraft}
            className="edit-update-draft-btn"
          >
            <FileText className="h-5 w-5" />
            <span>{txt.updateDraft}</span>
          </button>
        </div>
      )}

      <style>{`
        /* ========================================
           PREMIUM EDIT CHAT - WHATSAPP LUXURY STYLE
           ======================================== */
        
        .edit-chat-premium {
          display: flex;
          flex-direction: column;
          background: linear-gradient(180deg, #0B1C2D 0%, #0D1F30 100%);
          border-radius: 8px;
          overflow: hidden;
          border: 3px solid #C9A24D;
          box-shadow: 
            0 0 0 2px #0B1C2D,
            0 0 0 5px #A8863D,
            0 12px 40px rgba(0,0,0,0.4);
        }

        /* Golden Header */
        .edit-gold-header {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 12px 16px;
          background: linear-gradient(180deg,
            #C9A24D 0%,
            #A8863D 50%,
            #8B6F32 100%);
          border-bottom: 3px solid #7A5F2A;
          box-shadow: 
            inset 0 1px 0 #E0C068,
            0 4px 12px rgba(0,0,0,0.4);
        }

        .edit-fleur {
          color: #E8D5A3;
          font-size: 14px;
          opacity: 0.8;
        }

        .edit-gold-header svg {
          color: #FFF8E7 !important;
          filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));
        }

        .edit-title {
          color: #FFF8E7;
          font-weight: 600;
          font-size: 14px;
          letter-spacing: 0.5px;
          text-shadow: 0 1px 2px rgba(0,0,0,0.4);
        }

        /* Inner parchment content */
        .edit-inner-content {
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
          min-height: 200px;
          max-height: 45vh;
          display: flex;
          flex-direction: column;
        }

        /* Messages area */
        .edit-response-area {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior: contain;
        }

        /* Empty state */
        .edit-empty-state {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 20px;
          gap: 12px;
        }

        .edit-empty-icon {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: linear-gradient(135deg, 
            rgba(201, 162, 77, 0.15) 0%,
            rgba(201, 162, 77, 0.25) 100%);
          border: 2px solid rgba(201, 162, 77, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .edit-empty-icon svg {
          color: #B8954A !important;
        }

        .edit-empty-state p {
          color: #5A4D3A;
          font-style: italic;
          font-size: 14px;
          max-width: 280px;
        }

        /* Messages */
        .edit-message {
          display: flex;
          gap: 8px;
          align-items: flex-start;
        }

        .edit-message-user {
          flex-direction: row-reverse;
        }

        .edit-message-avatar {
          flex-shrink: 0;
          width: 26px;
          height: 26px;
          border-radius: 50%;
          background: #1A2F42;
          border: 2px solid #C9A24D;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .edit-message-avatar svg {
          color: #C9A24D !important;
        }

        .edit-message-ai .edit-message-avatar {
          background: linear-gradient(135deg, #C9A24D, #A8863D);
        }

        .edit-message-ai .edit-message-avatar svg {
          color: #FFF8E7 !important;
        }

        .edit-message-bubble {
          position: relative;
          max-width: 85%;
          padding: 10px 12px;
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

        .edit-copy-btn {
          padding: 2px;
          border-radius: 4px;
          background: rgba(201, 162, 77, 0.2);
          border: none;
          opacity: 0.6;
          transition: opacity 0.2s;
          color: #A8863D;
          cursor: pointer;
        }

        .edit-copy-btn:hover {
          opacity: 1;
        }

        /* Scroll button */
        .edit-scroll-btn {
          position: absolute;
          bottom: 8px;
          left: 50%;
          transform: translateX(-50%);
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #FFFFFF;
          color: #0B1C2D;
          border: 2px solid #C9A24D;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
          z-index: 10;
        }

        /* Input bar - WhatsApp style */
        .edit-input-bar {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 10px;
          margin: 0 8px 8px 8px;
          background: linear-gradient(180deg, #F5EED8, #E8E0C8);
          border: 2px solid #C9A24D;
          border-radius: 24px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.12);
        }

        .edit-mic-btn {
          flex-shrink: 0;
          width: 36px;
          height: 36px;
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

        .edit-mic-btn:hover:not(:disabled) {
          background: #C9A24D;
          color: #FFF8E7;
        }

        .edit-mic-btn.active {
          background: #DC3545 !important;
          border-color: #C82333 !important;
          color: white !important;
          animation: pulse 1.5s infinite;
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }

        .edit-text-input {
          flex: 1;
          height: 36px;
          padding: 0 12px;
          border: none;
          background: transparent;
          font-size: 16px;
          color: #3D3426;
          outline: none;
          min-width: 0;
        }

        .edit-text-input::placeholder {
          color: #8B7D64;
          font-size: 13px;
        }

        .edit-text-input.listening {
          color: #DC3545;
        }

        .edit-send-btn {
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
          box-shadow: 0 2px 6px rgba(0,0,0,0.25);
        }

        .edit-send-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, #C9A24D, #A8863D);
          color: #FFF8E7;
        }

        .edit-send-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Update Draft Button Row */
        .edit-update-draft-row {
          padding: 0 8px 10px 8px;
        }

        .edit-update-draft-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 12px 16px;
          border-radius: 12px;
          background: linear-gradient(180deg, #D4AF5A 0%, #C9A24D 40%, #A8863D 100%);
          color: #0B1C2D;
          font-size: 15px;
          font-weight: 600;
          border: 2px solid #E5C76B;
          cursor: pointer;
          transition: all 0.25s ease;
          box-shadow: 
            0 4px 12px rgba(168, 134, 61, 0.4),
            0 2px 4px rgba(0, 0, 0, 0.2),
            inset 0 1px 0 rgba(255, 255, 255, 0.25);
        }

        .edit-update-draft-btn svg {
          color: #0B1C2D;
        }

        .edit-update-draft-btn:hover {
          background: linear-gradient(180deg, #E5C76B 0%, #D4AF5A 40%, #C9A24D 100%);
          transform: translateY(-1px);
          box-shadow: 
            0 6px 16px rgba(168, 134, 61, 0.5),
            0 3px 6px rgba(0, 0, 0, 0.25),
            inset 0 1px 0 rgba(255, 255, 255, 0.3);
        }

        /* Scrollbar styling */
        .edit-response-area::-webkit-scrollbar {
          width: 5px;
        }

        .edit-response-area::-webkit-scrollbar-track {
          background: rgba(201, 162, 77, 0.1);
          border-radius: 3px;
        }

        .edit-response-area::-webkit-scrollbar-thumb {
          background: #C9A24D;
          border-radius: 3px;
        }
      `}</style>
      
      {/* Payment Blocked Popup */}
      <PaymentBlockedPopup 
        isOpen={showPaymentBlockedPopup} 
        onClose={() => setShowPaymentBlockedPopup(false)} 
      />
    </div>
  );
}
