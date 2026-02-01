import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import { Loader2, Send, User, ChevronDown, Sparkles, MessageCircle, FileText, PenLine, Clock, Mic, MicOff } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { usePlanState } from '@/hooks/usePlanState';
import { useEntitlements } from '@/hooks/useEntitlements';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const DAILY_LIMIT = 5;

function dayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getDailyCount(): number {
  try {
    const k = `lexora_public_chat_count_${dayKey()}`;
    const v = localStorage.getItem(k);
    const n = v ? Number(v) : 0;
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

function incrementDailyCount(): number {
  try {
    const k = `lexora_public_chat_count_${dayKey()}`;
    const next = getDailyCount() + 1;
    localStorage.setItem(k, String(next));
    return next;
  } catch {
    return getDailyCount() + 1;
  }
}

// Analytics event tracking
function trackEvent(eventName: string) {
  console.log(`[Analytics] ${eventName}`);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('lexora_analytics', { detail: { event: eventName } }));
  }
}

export function HomepageTrialChat() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { user } = useAuth();
  
  // Plan/Admin bypass for logged-in users
  const { isPaid, isUnlimited } = usePlanState();
  const { isAdmin } = useEntitlements();
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [dailyCount, setDailyCount] = useState(0);
  const [limitDialogOpen, setLimitDialogOpen] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  // Initialize speech recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSpeechSupported(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = language === 'DE' ? 'de-DE' : language === 'IT' ? 'it-IT' : language === 'FR' ? 'fr-FR' : language === 'ES' ? 'es-ES' : 'en-US';
      
      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join('');
        setInput(transcript);
      };
      
      recognition.onend = () => {
        setIsListening(false);
      };
      
      recognition.onerror = () => {
        setIsListening(false);
      };
      
      recognitionRef.current = recognition;
    }
  }, [language]);

  useEffect(() => {
    setDailyCount(getDailyCount());
    trackEvent('homepage_try_chat_opened');
  }, []);

  // CRITICAL: Bypass limits for logged-in PRO/UNLIMITED/admin users
  const shouldBypassLimits = Boolean(user) && (isAdmin || isUnlimited || isPaid);
  const isLimitReached = !shouldBypassLimits && dailyCount >= DAILY_LIMIT;

  const trimmedInput = useMemo(() => input.trim(), [input]);

  // Track scroll for jump-to-bottom button
  useEffect(() => {
    const scrollContainer = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (!scrollContainer) return;
    
    const handleScroll = () => {
      const isNearBottom = scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight < 80;
      setShowScrollButton(!isNearBottom && messages.length > 0);
    };
    
    scrollContainer.addEventListener('scroll', handleScroll);
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, [messages.length]);

  const scrollToBottom = () => {
    const scrollContainer = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (scrollContainer) {
      scrollContainer.scrollTo({
        top: scrollContainer.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

    // iOS zoom prevention: keep >=16px
    el.style.fontSize = '16px';

    // Auto-grow up to ~6 lines then internal scroll.
    el.style.height = 'auto';
    const maxPx = 6 * 24 + 24; // lineHeight approx + padding
    el.style.height = `${Math.min(el.scrollHeight, maxPx)}px`;
  }, [input]);

  // Toggle speech recognition
  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) return;
    
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
        trackEvent('homepage_voice_input_started');
      } catch (e) {
        console.error('[Voice] Failed to start:', e);
      }
    }
  }, [isListening]);

  // Quick action inserts a starter prompt into the textarea (does NOT send)
  const handleQuickAction = (actionKey: string) => {
    if (isLoading || isLimitReached) return;
    const prompt = t(`tryChat.starterPrompts.${actionKey}`);
    setInput(prompt);
    trackEvent(`homepage_quick_action_${actionKey}`);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const sendMessage = useCallback(async () => {
    const nextInput = input.trim();

    if (isLoading) return;
    if (!nextInput) {
      toast.error(t('tryChat.emptyWarning'));
      return;
    }
    if (isLimitReached) {
      setLimitDialogOpen(true);
      return;
    }
    
    const userMessage: ChatMessage = {
      role: 'user',
      content: nextInput,
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    trackEvent('homepage_try_chat_message_sent');
    
    // Build conversation history for context (intake mode needs history)
    const conversationHistory = [...messages, userMessage].map(m => ({
      role: m.role,
      content: m.content,
    }));
    
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/homepage-trial-chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            message: nextInput,
            language: language,
            conversationHistory: conversationHistory,
            isFirstMessage: messages.length === 0,
          }),
        }
      );

      const status = response.status;
      let data: any = null;
      try {
        data = await response.json();
      } catch {
        // ignore
      }

      if (!response.ok || !data?.ok) {
        console.error('[HomepageTrialChat] backend error', {
          status,
          body: data,
        });
        toast.error(t('tryChat.genericErrorToast'));
        // Remove the user message on error
        setMessages(prev => prev.slice(0, -1));
        return;
      }
      
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.reply || '',
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      trackEvent('homepage_try_chat_response_shown');

      const nextCount = incrementDailyCount();
      setDailyCount(nextCount);
      if (nextCount >= DAILY_LIMIT) {
        setLimitDialogOpen(true);
      }
      
      // Scroll to bottom after response
      setTimeout(scrollToBottom, 100);
      
    } catch (error) {
      console.error('[HomepageTrialChat] request failed:', error);
      toast.error(t('tryChat.genericErrorToast'));
      // Remove the user message on error
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, isLimitReached, language, t]);

  const handleSignupClick = () => {
    trackEvent('homepage_try_chat_signup_clicked');
    navigate('/signup');
    setLimitDialogOpen(false);
  };

  const handleLoginClick = () => {
    trackEvent('homepage_try_chat_login_clicked');
    navigate('/login');
    setLimitDialogOpen(false);
  };

  return (
    <section className="border-t bg-secondary/30 py-12 md:py-16 touch-manipulation">
      <div className="container max-w-3xl px-4">
        {/* Section Header */}
        <div className="mb-6 text-center">
          <div className="mb-3 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <MessageCircle className="h-6 w-6" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-foreground md:text-3xl">
            {t('tryChat.title')}
          </h2>
          <p className="mt-2 text-muted-foreground text-sm md:text-base max-w-xl mx-auto">
            {t('tryChat.subtitle')}
          </p>
        </div>

        {/* Chat Card */}
        <Card className="relative overflow-hidden shadow-lg border-border/50">
          <CardContent className="p-0 flex flex-col h-[420px] max-h-[65vh]">
            {/* Quick Action Pills */}
            {messages.length === 0 && !isLimitReached && (
              <div className="p-3 md:p-4 border-b border-border/50 bg-card/80">
                <div className="flex flex-wrap gap-2 justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickAction('explain')}
                    className="text-xs md:text-sm rounded-full px-3 py-1.5 h-auto"
                    disabled={isLoading}
                  >
                    <FileText className="h-3.5 w-3.5 mr-1.5" />
                    {t('tryChat.quickActions.explain')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickAction('draft')}
                    className="text-xs md:text-sm rounded-full px-3 py-1.5 h-auto"
                    disabled={isLoading}
                  >
                    <PenLine className="h-3.5 w-3.5 mr-1.5" />
                    {t('tryChat.quickActions.draft')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickAction('deadline')}
                    className="text-xs md:text-sm rounded-full px-3 py-1.5 h-auto"
                    disabled={isLoading}
                  >
                    <Clock className="h-3.5 w-3.5 mr-1.5" />
                    {t('tryChat.quickActions.deadline')}
                  </Button>
                </div>
                {/* Caption */}
                <p className="text-center text-xs text-muted-foreground mt-2">
                  {t('tryChat.freeCaption')}
                </p>
              </div>
            )}

            {/* Chat Messages Area */}
            <div className="relative flex-1 min-h-0 overscroll-contain">
              <ScrollArea 
                ref={scrollAreaRef} 
                className="h-full"
              >
                <div className="p-4 space-y-4">
                  {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full min-h-[180px] text-center text-muted-foreground">
                      <MessageCircle className="h-10 w-10 mb-3 opacity-30" />
                      <p className="text-sm max-w-xs">
                        {t('tryChat.emptyState')}
                      </p>
                    </div>
                  )}

                  {messages.map((msg, index) => (
                    <div
                      key={index}
                      className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      {msg.role === 'assistant' && (
                        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <Sparkles className="h-4 w-4 text-primary" />
                        </div>
                      )}
                      <div
                        className={`max-w-[85%] rounded-xl px-4 py-3 ${
                          msg.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-card border border-border shadow-sm'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">
                          {msg.content}
                        </p>
                      </div>
                      {msg.role === 'user' && (
                        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                          <User className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  ))}

                  {isLoading && (
                    <div className="flex gap-3 justify-start">
                      <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Sparkles className="h-4 w-4 text-primary" />
                      </div>
                      <div className="bg-card border border-border rounded-xl px-4 py-3 shadow-sm">
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          <span className="text-sm text-muted-foreground">
                            {t('chat.thinking')}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              </ScrollArea>

              {/* Jump to bottom - small floating circular button */}
              {showScrollButton && (
                <button
                  type="button"
                  onClick={scrollToBottom}
                  className="absolute bottom-4 right-4 h-10 w-10 max-h-[44px] max-w-[44px] rounded-full shadow-lg z-10 bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center transition-colors"
                  aria-label="Scroll to bottom"
                >
                  <ChevronDown className="h-5 w-5" />
                </button>
              )}
            </div>

            {/* Input Area */}
            <div className="p-3 md:p-4 border-t border-border/50 bg-card">
              <div className="flex gap-2 items-end">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={isListening ? t('tryChat.listening', { defaultValue: 'Sto ascoltando...' }) : t('tryChat.placeholder')}
                  className={`min-h-[44px] resize-none rounded-xl text-base touch-manipulation overscroll-contain flex-1 transition-all ${isListening ? 'ring-2 ring-primary/50 bg-primary/5' : ''}`}
                  style={{ fontSize: '16px' }}
                  disabled={isLoading || isListening}
                  onKeyDown={(e) => {
                    // Keep page stable: don't submit on Enter; allow Shift+Enter newline
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      // CRITICAL: Stop voice recording if active when pressing Enter
                      if (isListening && recognitionRef.current) {
                        recognitionRef.current.stop();
                        setIsListening(false);
                      }
                      if (trimmedInput.length > 0 && !isLoading) {
                        sendMessage();
                      }
                    }
                  }}
                />
                
                {/* Mic Button */}
                {speechSupported && (
                  <Button
                    onClick={toggleListening}
                    disabled={isLoading || isLimitReached}
                    size="icon"
                    variant={isListening ? "default" : "outline"}
                    className={`h-11 w-11 rounded-xl flex-shrink-0 transition-all ${isListening ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse' : ''}`}
                    aria-label={isListening ? 'Stop recording' : 'Start voice input'}
                  >
                    {isListening ? (
                      <MicOff className="h-5 w-5" />
                    ) : (
                      <Mic className="h-5 w-5" />
                    )}
                  </Button>
                )}
                
                {/* Send Button */}
                <Button
                  onClick={() => {
                    // CRITICAL: Stop voice recording if active when clicking Send
                    if (isListening && recognitionRef.current) {
                      recognitionRef.current.stop();
                      setIsListening(false);
                    }
                    sendMessage();
                  }}
                  disabled={trimmedInput.length === 0 || isLoading}
                  size="icon"
                  className="h-11 w-11 rounded-xl flex-shrink-0"
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Limit reached modal */}
        <AlertDialog open={limitDialogOpen} onOpenChange={setLimitDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('tryChat.limit.title')}</AlertDialogTitle>
              <AlertDialogDescription>{t('tryChat.limit.body')}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setLimitDialogOpen(false)}>
                {t('common.close')}
              </AlertDialogCancel>
              <AlertDialogAction onClick={handleLoginClick}>
                {t('tryChat.limit.login')}
              </AlertDialogAction>
              <AlertDialogAction onClick={handleSignupClick}>
                {t('tryChat.limit.signup')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Disclaimer */}
        <p className="mt-4 text-xs text-center text-muted-foreground max-w-lg mx-auto">
          {t('tryChat.disclaimer')}
        </p>
      </div>
    </section>
  );
}
