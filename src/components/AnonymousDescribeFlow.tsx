import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { 
  Loader2, 
  Send, 
  Sparkles, 
  User, 
  Save,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  createAnonymousCase, 
  updateAnonymousCase, 
  addChatMessage as addAnonChatMessage,
  type AnonymousCase 
} from '@/lib/anonymousSession';
import { useLanguage } from '@/contexts/LanguageContext';
import { RegistrationGate } from '@/components/RegistrationGate';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function AnonymousDescribeFlow({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const navigate = useNavigate();
  
  const [currentCase, setCurrentCase] = useState<AnonymousCase | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showGate, setShowGate] = useState(false);
  
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Initialize with welcome message
  useEffect(() => {
    const welcomeMsg: ChatMessage = {
      role: 'assistant',
      content: t('anonymousFlow.describeWelcome', 
        'Hello! I\'m Lexora, your legal assistant. Tell me about your situation — what letter or document did you receive? What\'s the problem? I\'ll help you understand it and figure out what to do.'
      ),
    };
    setChatMessages([welcomeMsg]);
  }, [t]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      const viewport = chatScrollRef.current?.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }, 100);
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.fontSize = '16px';
    el.style.height = 'auto';
    const maxPx = 6 * 24 + 24;
    el.style.height = `${Math.min(el.scrollHeight, maxPx)}px`;
  }, [input]);

  const handleSend = useCallback(async () => {
    const msg = input.trim();
    if (!msg || isLoading) return;

    // Create case on first message if not exists
    let activeCase = currentCase;
    if (!activeCase) {
      activeCase = createAnonymousCase({
        title: t('anonymousFlow.describedProblem', 'Described problem'),
      });
      setCurrentCase(activeCase);
    }

    const userMessage: ChatMessage = { role: 'user', content: msg };
    setChatMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    scrollToBottom();

    addAnonChatMessage(activeCase.id, 'user', msg);

    try {
      // Get existing context from chat
      const allUserMessages = [...chatMessages.filter(m => m.role === 'user').map(m => m.content), msg];
      const context = {
        letterText: allUserMessages.join('\n\n'),
      };

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/anonymous-chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            message: msg,
            chatHistory: chatMessages,
            context,
            language,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.ok) {
        if (data.code === 'RATE_LIMITED') {
          toast.error(t('anonymousFlow.rateLimited', 'Too many messages. Please wait a moment.'));
        } else {
          throw new Error(data.error || 'Chat failed');
        }
        setChatMessages(prev => prev.slice(0, -1));
        return;
      }

      const assistantMessage: ChatMessage = { role: 'assistant', content: data.reply };
      setChatMessages(prev => [...prev, assistantMessage]);

      addAnonChatMessage(activeCase.id, 'assistant', data.reply);

      // Update case with latest context
      updateAnonymousCase(activeCase.id, {
        explanation: data.reply,
        chatHistory: [...chatMessages, userMessage, assistantMessage].map(m => ({
          ...m,
          timestamp: new Date().toISOString(),
        })),
      });

      scrollToBottom();

    } catch (error) {
      console.error('[AnonymousDescribeFlow] Error:', error);
      toast.error(t('anonymousFlow.chatError', 'Failed to send message'));
      setChatMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  }, [input, chatMessages, isLoading, currentCase, language, t, scrollToBottom]);

  const handleSaveClick = useCallback(() => {
    setShowGate(true);
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="border-b px-4 py-3 flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">{t('anonymousFlow.describeTitle', 'Describe your problem')}</h2>
        </div>
        <Button size="sm" onClick={handleSaveClick} className="gap-1.5" disabled={chatMessages.length < 2}>
          <Save className="h-4 w-4" />
          {t('anonymousFlow.save', 'Save')}
        </Button>
      </div>

      {/* Chat Messages */}
      <ScrollArea ref={chatScrollRef} className="flex-1">
        <div className="p-4 space-y-4 max-w-2xl mx-auto">
          {chatMessages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
              )}
              <div className={`max-w-[85%] rounded-xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card border shadow-sm'
              }`}>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
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
              <div className="bg-card border rounded-xl px-4 py-3 shadow-sm">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">{t('chat.thinking', 'Thinking...')}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t p-4 bg-card">
        <div className="max-w-2xl mx-auto">
          <div className="flex gap-2 items-end">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('anonymousFlow.describePlaceholder', 'Describe what happened or paste the letter text...')}
              className="min-h-[44px] max-h-[144px] resize-none flex-1 rounded-xl"
              style={{ fontSize: '16px' }}
              disabled={isLoading}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <Button 
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
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
          <p className="text-center text-xs text-muted-foreground mt-3">
            {t('anonymousFlow.freeChat', 'Free chat • Create an account to save your case')}
          </p>
        </div>
      </div>

      {showGate && (
        <RegistrationGate 
          action="save"
          caseId={currentCase?.id}
          onClose={() => setShowGate(false)} 
        />
      )}
    </div>
  );
}
