import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { InAppCamera } from '@/components/InAppCamera';
import { 
  Camera, 
  Loader2, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  ArrowRight,
  Save,
  FileText,
  Sparkles,
  ChevronDown,
  Send,
  User
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  createAnonymousCase, 
  updateAnonymousCase, 
  addChatMessage as addAnonChatMessage,
  type AnonymousCase 
} from '@/lib/anonymousSession';
import { extractTextWithTesseract } from '@/lib/tesseractOcr';
import { useLanguage } from '@/contexts/LanguageContext';
import { RegistrationGate } from '@/components/RegistrationGate';

type FlowStep = 'camera' | 'processing' | 'result' | 'chat';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function AnonymousScanFlow({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const navigate = useNavigate();
  
  const [step, setStep] = useState<FlowStep>('camera');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState<'ocr' | 'analyze'>('ocr');
  const [ocrProgress, setOcrProgress] = useState(0);
  const [currentCase, setCurrentCase] = useState<AnonymousCase | null>(null);
  const [extractedText, setExtractedText] = useState('');
  const [analysis, setAnalysis] = useState('');
  const [structured, setStructured] = useState<{
    urgency: string;
    deadline: string | null;
    sender: string | null;
  } | null>(null);
  
  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  
  // Registration gate
  const [showGate, setShowGate] = useState(false);
  const [gateAction, setGateAction] = useState<'save' | 'export' | 'continue'>('save');

  const scrollChatToBottom = useCallback(() => {
    setTimeout(() => {
      const viewport = chatScrollRef.current?.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }, 100);
  }, []);

  const handlePhotosCaptured = useCallback(async (files: File[]) => {
    if (files.length === 0) {
      onClose();
      return;
    }

    setStep('processing');
    setIsProcessing(true);
    setProcessingStage('ocr');
    setOcrProgress(0);

    try {
      const file = files[0];
      const base64 = await fileToBase64(file);
      const mimeType = file.type || 'image/jpeg';

      // Create anonymous case first
      const newCase = createAnonymousCase({
        title: t('anonymousFlow.newDocument', 'New Document'),
        fileData: { base64, mimeType, fileName: file.name },
      });
      setCurrentCase(newCase);

      // OCR: prefer anonymous-ocr (GPT-4o Vision), fallback to Tesseract
      let text = '';
      try {
        const ocrRes = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/anonymous-ocr`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
            body: JSON.stringify({ base64, mimeType }),
          }
        );
        const ocrData = await ocrRes.json();
        if (ocrRes.ok && ocrData?.ok && ocrData?.text?.trim()) {
          text = ocrData.text.trim();
          setOcrProgress(100);
        } else throw new Error(ocrData?.error ?? 'anonymous-ocr failed');
      } catch (apiErr) {
        console.warn('[AnonymousScanFlow] anonymous-ocr failed, using Tesseract fallback:', apiErr);
        toast.warning(t('anonymousFlow.ocrFallback', 'Using basic OCR (for best results ensure good lighting).'));
        const ocrResult = await extractTextWithTesseract(file, (p) => setOcrProgress(p));
        if (!ocrResult?.text?.trim()) throw new Error('OCR failed or no text found');
        text = ocrResult.text.trim();
      }
      setExtractedText(text);
      updateAnonymousCase(newCase.id, { letterText: text, ocrResult: text });

      // Now analyze
      setProcessingStage('analyze');

      const analyzeResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/anonymous-analyze`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ letterText: text, language }),
        }
      );

      const analyzeData = await analyzeResponse.json();

      if (!analyzeResponse.ok || !analyzeData.ok) {
        throw new Error(analyzeData.error || 'Analysis failed');
      }

      setAnalysis(analyzeData.analysis || '');
      setStructured(analyzeData.structured || null);

      updateAnonymousCase(newCase.id, {
        explanation: analyzeData.analysis,
        title: analyzeData.structured?.sender || t('anonymousFlow.newDocument', 'New Document'),
      });

      setStep('result');

    } catch (error) {
      console.error('[AnonymousScanFlow] Error:', error);
      toast.error(t('anonymousFlow.processingError', 'Processing failed. Please try again.'));
      setStep('camera');
    } finally {
      setIsProcessing(false);
    }
  }, [language, t, onClose]);

  const handleSendChat = useCallback(async () => {
    const msg = chatInput.trim();
    if (!msg || isChatLoading) return;

    const userMessage: ChatMessage = { role: 'user', content: msg };
    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setIsChatLoading(true);
    scrollChatToBottom();

    if (currentCase) {
      addAnonChatMessage(currentCase.id, 'user', msg);
    }

    try {
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
            context: {
              letterText: extractedText,
              analysis,
            },
            language,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Chat failed');
      }

      const assistantMessage: ChatMessage = { role: 'assistant', content: data.reply };
      setChatMessages(prev => [...prev, assistantMessage]);

      if (currentCase) {
        addAnonChatMessage(currentCase.id, 'assistant', data.reply);
      }

      scrollChatToBottom();

    } catch (error) {
      console.error('[AnonymousScanFlow] Chat error:', error);
      toast.error(t('anonymousFlow.chatError', 'Failed to send message'));
      // Remove the user message on error
      setChatMessages(prev => prev.slice(0, -1));
    } finally {
      setIsChatLoading(false);
    }
  }, [chatInput, chatMessages, isChatLoading, extractedText, analysis, language, currentCase, t, scrollChatToBottom]);

  const handleSaveClick = useCallback(() => {
    setGateAction('save');
    setShowGate(true);
  }, []);

  const handleContinueToChat = useCallback(() => {
    setStep('chat');
    // Add initial assistant message
    const welcomeMsg: ChatMessage = {
      role: 'assistant',
      content: t('anonymousFlow.chatWelcome', 'I\'ve analyzed your document. What would you like to know? I can explain specific parts, draft a response, or answer your questions.'),
    };
    setChatMessages([welcomeMsg]);
  }, [t]);

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case 'HIGH':
        return (
          <div className="flex items-center gap-2 text-destructive bg-destructive/10 px-3 py-1.5 rounded-full">
            <AlertTriangle className="h-4 w-4" />
            <span className="font-medium text-sm">{t('anonymousFlow.urgencyHigh', 'Urgent')}</span>
          </div>
        );
      case 'MEDIUM':
        return (
          <div className="flex items-center gap-2 text-amber-600 bg-amber-500/10 px-3 py-1.5 rounded-full">
            <Clock className="h-4 w-4" />
            <span className="font-medium text-sm">{t('anonymousFlow.urgencyMedium', 'Action needed')}</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-2 text-emerald-600 bg-emerald-500/10 px-3 py-1.5 rounded-full">
            <CheckCircle className="h-4 w-4" />
            <span className="font-medium text-sm">{t('anonymousFlow.urgencyLow', 'Informational')}</span>
          </div>
        );
    }
  };

  // CAMERA STEP
  if (step === 'camera') {
    return (
      <InAppCamera
        onPhotosCaptured={handlePhotosCaptured}
        onClose={onClose}
      />
    );
  }

  // PROCESSING STEP
  if (step === 'processing') {
    return (
      <div className="fixed inset-0 z-50 bg-background flex items-center justify-center">
        <Card className="mx-4 max-w-md w-full">
          <CardContent className="p-8 text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {processingStage === 'ocr' 
                ? t('anonymousFlow.extractingText', 'Reading document...')
                : t('anonymousFlow.analyzing', 'Analyzing content...')
              }
            </h3>
            <p className="text-muted-foreground text-sm">
              {processingStage === 'ocr'
                ? `${t('anonymousFlow.extractingHint', 'Extracting text from your document')} ${ocrProgress}%`
                : t('anonymousFlow.analyzingHint', 'Understanding content, risks, and next steps')
              }
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // RESULT STEP
  if (step === 'result') {
    return (
      <div className="fixed inset-0 z-50 bg-background overflow-auto">
        <div className="container max-w-2xl py-6 px-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <Button variant="ghost" size="sm" onClick={onClose}>
              {t('common.close', 'Close')}
            </Button>
            <Button onClick={handleSaveClick} className="gap-2">
              <Save className="h-4 w-4" />
              {t('anonymousFlow.saveCase', 'Save case')}
            </Button>
          </div>

          {/* Urgency Badge */}
          {structured && (
            <div className="flex justify-center mb-6">
              {getUrgencyBadge(structured.urgency)}
            </div>
          )}

          {/* Sender & Deadline */}
          {structured && (structured.sender || structured.deadline) && (
            <div className="grid grid-cols-2 gap-4 mb-6">
              {structured.sender && (
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground mb-1">{t('anonymousFlow.from', 'From')}</p>
                    <p className="font-medium text-sm">{structured.sender}</p>
                  </CardContent>
                </Card>
              )}
              {structured.deadline && structured.deadline !== 'none' && (
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground mb-1">{t('anonymousFlow.deadline', 'Deadline')}</p>
                    <p className="font-medium text-sm">{structured.deadline}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Analysis */}
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                {t('anonymousFlow.analysis', 'Analysis')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none dark:prose-invert">
                {analysis.split('\n').map((line, i) => (
                  <p key={i} className="mb-2 last:mb-0">{line}</p>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Continue Button */}
          <Button 
            onClick={handleContinueToChat} 
            className="w-full gap-2"
            size="lg"
          >
            {t('anonymousFlow.askQuestions', 'Ask questions or get a draft')}
            <ArrowRight className="h-4 w-4" />
          </Button>

          <p className="text-center text-xs text-muted-foreground mt-4">
            {t('anonymousFlow.freePreview', 'Free preview • Create an account to save')}
          </p>
        </div>

        {showGate && (
          <RegistrationGate 
            action={gateAction}
            caseId={currentCase?.id}
            onClose={() => setShowGate(false)} 
          />
        )}
      </div>
    );
  }

  // CHAT STEP
  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="border-b px-4 py-3 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => setStep('result')}>
          {t('common.back', 'Back')}
        </Button>
        <h2 className="font-semibold">{t('anonymousFlow.chatTitle', 'Ask Lexora')}</h2>
        <Button size="sm" onClick={handleSaveClick} className="gap-1.5">
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
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              </div>
              {msg.role === 'user' && (
                <div className="flex-shrink-0 h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
            </div>
          ))}

          {isChatLoading && (
            <div className="flex gap-3 justify-start">
              <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <div className="bg-card border rounded-xl px-4 py-3 shadow-sm">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t p-4">
        <div className="max-w-2xl mx-auto flex gap-2">
          <Textarea
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder={t('anonymousFlow.chatPlaceholder', 'Ask a question...')}
            className="min-h-[44px] max-h-[120px] resize-none flex-1"
            style={{ fontSize: '16px' }}
            disabled={isChatLoading}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendChat();
              }
            }}
          />
          <Button 
            onClick={handleSendChat}
            disabled={!chatInput.trim() || isChatLoading}
            size="icon"
            className="h-11 w-11"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {showGate && (
        <RegistrationGate 
          action={gateAction}
          caseId={currentCase?.id}
          onClose={() => setShowGate(false)} 
        />
      )}
    </div>
  );
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
