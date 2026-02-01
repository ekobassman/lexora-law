import { useEffect, useRef, useState, useCallback, ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Loader2,
  Send,
  User,
  ChevronDown,
  Sparkles,
  Camera,
  Paperclip,
  X,
  FileText,
  Image as ImageIcon,
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import { InAppCamera } from '@/components/InAppCamera';
import { useAuth } from '@/contexts/AuthContext';
import { usePlanState } from '@/hooks/usePlanState';
import { useEntitlements } from '@/hooks/useEntitlements';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  attachmentType?: 'image' | 'pdf' | null;
}

const MESSAGE_LIMIT = 5;

// Session key for message count
function sessionKey() {
  return 'lexora_landing_chat_session';
}

function getSessionCount(): number {
  try {
    const data = localStorage.getItem(sessionKey());
    if (!data) return 0;
    const parsed = JSON.parse(data);
    return typeof parsed.count === 'number' ? parsed.count : 0;
  } catch {
    return 0;
  }
}

function incrementSessionCount(): number {
  try {
    const next = getSessionCount() + 1;
    localStorage.setItem(sessionKey(), JSON.stringify({ count: next }));
    return next;
  } catch {
    return getSessionCount() + 1;
  }
}

// Safe translation helper - never return raw key
function getSafeText(t: (key: string) => string, key: string, fallback: string): string {
  const result = t(key);
  // If result equals the key or looks like a key (contains dots and no spaces), use fallback
  if (!result || result === key || (result.includes('.') && !result.includes(' '))) {
    return fallback;
  }
  return result;
}

// Analytics tracking
function trackEvent(eventName: string) {
  console.log(`[Analytics] ${eventName}`);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('lexora_analytics', { detail: { event: eventName } }));
  }
}

// Convert file to base64
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data:mime;base64, prefix
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
  });
}

export function LandingChat() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Plan/Admin bypass for logged-in users
  const { isPaid, isUnlimited } = usePlanState();
  const { isAdmin } = useEntitlements();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionCount, setSessionCount] = useState(0);
  const [limitDialogOpen, setLimitDialogOpen] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);

  // Camera state
  const [showCamera, setShowCamera] = useState(false);
  const [cameraPermissionDialog, setCameraPermissionDialog] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);

  // Refs
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Safe translated strings
  const txt = {
    title: getSafeText(t, 'landingChat.title', 'Chat with Lexora'),
    subtitle: getSafeText(t, 'landingChat.subtitle', 'Describe your situation or upload a document.'),
    placeholder: getSafeText(t, 'landingChat.placeholder', 'Describe your situation or paste your letter...'),
    emptyState: getSafeText(t, 'landingChat.emptyState', 'Upload a document or describe what happened.'),
    thinking: getSafeText(t, 'chat.thinking', 'Thinking...'),
    scrollToBottom: getSafeText(t, 'chat.scrollToBottom', 'Jump to latest'),
    limitTitle: getSafeText(t, 'landingChat.limit.title', 'Free preview ended'),
    limitBody: getSafeText(t, 'landingChat.limit.body', 'Create a free account to continue and save your case.'),
    limitSignup: getSafeText(t, 'landingChat.limit.signup', 'Create account'),
    limitLogin: getSafeText(t, 'landingChat.limit.login', 'Login'),
    close: getSafeText(t, 'common.close', 'Close'),
    errorToast: getSafeText(t, 'landingChat.error', 'Temporary error. Please try again.'),
    cameraPermTitle: getSafeText(t, 'landingChat.cameraPermission.title', 'Camera Access'),
    cameraPermBody: getSafeText(t, 'landingChat.cameraPermission.body', 'We need camera access to scan your document. Your photo will only be used for text extraction.'),
    cameraPermAllow: getSafeText(t, 'landingChat.cameraPermission.allow', 'Allow Camera'),
    processingOCR: getSafeText(t, 'landingChat.processingOCR', 'Extracting text...'),
    ocrSuccess: getSafeText(t, 'landingChat.ocrSuccess', 'Text extracted from document'),
    ocrError: getSafeText(t, 'landingChat.ocrError', 'Could not read document. Please try again.'),
    disclaimer: getSafeText(t, 'landingChat.disclaimer', 'Lexora is not a law firm. AI can make mistakes.'),
  };

  useEffect(() => {
    setSessionCount(getSessionCount());
    trackEvent('landing_chat_opened');
  }, []);

  // CRITICAL: Bypass limits for logged-in PRO/UNLIMITED/admin users
  const shouldBypassLimits = Boolean(user) && (isAdmin || isUnlimited || isPaid);
  const isLimitReached = !shouldBypassLimits && sessionCount >= MESSAGE_LIMIT;
  const trimmedInput = input.trim();

  // Scroll tracking
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
      scrollContainer.scrollTo({ top: scrollContainer.scrollHeight, behavior: 'smooth' });
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.fontSize = '16px'; // iOS zoom prevention
    el.style.height = 'auto';
    const maxPx = 6 * 24 + 24;
    el.style.height = `${Math.min(el.scrollHeight, maxPx)}px`;
  }, [input]);

  // OCR processing
  const processOCR = async (file: File): Promise<string | null> => {
    setIsProcessingFile(true);
    
    try {
      const base64 = await fileToBase64(file);
      const mimeType = file.type || 'image/jpeg';

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/anonymous-ocr`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ base64, mimeType, language }),
        }
      );

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.ok) {
        console.error('[LandingChat] OCR error:', data);
        toast.error(txt.ocrError);
        return null;
      }

      toast.success(txt.ocrSuccess);
      return data.text || '';
    } catch (error) {
      console.error('[LandingChat] OCR failed:', error);
      toast.error(txt.ocrError);
      return null;
    } finally {
      setIsProcessingFile(false);
    }
  };

  // Send message to AI
  const sendMessage = useCallback(async (messageContent: string, attachmentType?: 'image' | 'pdf' | null) => {
    if (isLoading || !messageContent.trim()) return;

    if (isLimitReached) {
      setLimitDialogOpen(true);
      return;
    }

    const userMessage: ChatMessage = {
      role: 'user',
      content: messageContent.trim(),
      timestamp: new Date(),
      attachmentType,
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    trackEvent('landing_chat_message_sent');

    // Build conversation history for context (intake mode needs history)
    const conversationHistory = [...messages, userMessage].map(m => ({
      role: m.role,
      content: m.content,
    }));
    const isFirstMessage = messages.length === 0;

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/homepage-trial-chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ 
            message: messageContent.trim(), 
            language,
            isFirstMessage,
            conversationHistory, // Pass full history for intake mode
          }),
        }
      );

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.ok) {
        console.error('[LandingChat] AI error:', { status: response.status, data });
        toast.error(txt.errorToast);
        setMessages(prev => prev.slice(0, -1));
        return;
      }

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.reply || '',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
      trackEvent('landing_chat_response_received');

      const nextCount = incrementSessionCount();
      setSessionCount(nextCount);

      if (nextCount >= MESSAGE_LIMIT) {
        setTimeout(() => setLimitDialogOpen(true), 500);
      }

      setTimeout(scrollToBottom, 100);
    } catch (error) {
      console.error('[LandingChat] Request failed:', error);
      toast.error(txt.errorToast);
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, isLimitReached, language, txt.errorToast]);

  // Handle send button click
  const handleSend = () => {
    if (trimmedInput) {
      sendMessage(trimmedInput);
    }
  };

  // Camera button click
  const handleCameraClick = () => {
    if (isLimitReached) {
      setLimitDialogOpen(true);
      return;
    }
    setCameraPermissionDialog(true);
    trackEvent('landing_chat_camera_clicked');
  };

  // After permission dialog - open camera
  const handleAllowCamera = () => {
    setCameraPermissionDialog(false);
    setShowCamera(true);
  };

  // Camera captured photos
  const handlePhotosCaptured = async (files: File[]) => {
    setShowCamera(false);
    
    if (files.length === 0) return;

    const file = files[0];
    const extractedText = await processOCR(file);

    if (extractedText) {
      // Show extracted text in chat and send to AI
      const ocrMessage = `[Document scanned]\n\n${extractedText}`;
      await sendMessage(ocrMessage, 'image');
    }
  };

  // File upload click
  const handleFileClick = () => {
    if (isLimitReached) {
      setLimitDialogOpen(true);
      return;
    }
    fileInputRef.current?.click();
    trackEvent('landing_chat_file_clicked');
  };

  // File selected
  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    const isImage = file.type.startsWith('image/');
    const isPDF = file.type === 'application/pdf';

    if (!isImage && !isPDF) {
      toast.error('Please upload an image or PDF file.');
      return;
    }

    if (isImage) {
      const extractedText = await processOCR(file);
      if (extractedText) {
        const ocrMessage = `[Document uploaded]\n\n${extractedText}`;
        await sendMessage(ocrMessage, 'image');
      }
    } else if (isPDF) {
      // For PDF, we need to convert first page to image or use different approach
      // For now, let's use OCR with base64 (Gemini can handle PDFs)
      const extractedText = await processOCR(file);
      if (extractedText) {
        const ocrMessage = `[PDF uploaded]\n\n${extractedText}`;
        await sendMessage(ocrMessage, 'pdf');
      }
    }
  };

  // Navigation handlers
  const handleSignup = () => {
    trackEvent('landing_chat_signup_clicked');
    navigate('/auth?mode=signup');
    setLimitDialogOpen(false);
  };

  const handleLogin = () => {
    trackEvent('landing_chat_login_clicked');
    navigate('/auth');
    setLimitDialogOpen(false);
  };

  // If camera is open, render camera fullscreen
  if (showCamera) {
    return (
      <InAppCamera
        onPhotosCaptured={handlePhotosCaptured}
        onClose={() => setShowCamera(false)}
      />
    );
  }

  return (
    <section className="min-h-[calc(100vh-80px)] flex flex-col bg-background">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Full-width chat container */}
      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full px-4 py-6">
        {/* Chat Card - Fixed height with internal scroll */}
        <Card className="flex-1 flex flex-col overflow-hidden shadow-lg border-border/50 min-h-0">
          <CardContent className="p-0 flex flex-col flex-1 min-h-0">
            {/* Messages Area - Scrollable */}
            <div className="relative flex-1 min-h-0 overscroll-contain">
              <ScrollArea ref={scrollAreaRef} className="h-full">
                <div className="p-4 space-y-4 min-h-[300px]">
                  {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full min-h-[280px] text-center text-muted-foreground px-4">
                      <div className="flex gap-3 mb-4">
                        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                          <Camera className="h-6 w-6 text-primary" />
                        </div>
                        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                          <Paperclip className="h-6 w-6 text-primary" />
                        </div>
                      </div>
                      <h3 className="text-lg font-semibold text-foreground mb-2">{txt.title}</h3>
                      <p className="text-sm max-w-sm">{txt.emptyState}</p>
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
                        {msg.attachmentType && (
                          <div className="flex items-center gap-1.5 text-xs opacity-70 mb-1.5">
                            {msg.attachmentType === 'image' ? (
                              <ImageIcon className="h-3 w-3" />
                            ) : (
                              <FileText className="h-3 w-3" />
                            )}
                            <span>{msg.attachmentType === 'pdf' ? 'PDF' : 'Image'}</span>
                          </div>
                        )}
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                      </div>
                      {msg.role === 'user' && (
                        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                          <User className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Loading indicator */}
                  {isLoading && (
                    <div className="flex gap-3 justify-start">
                      <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Sparkles className="h-4 w-4 text-primary" />
                      </div>
                      <div className="bg-card border border-border rounded-xl px-4 py-3 shadow-sm">
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          <span className="text-sm text-muted-foreground">{txt.thinking}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Processing OCR indicator */}
                  {isProcessingFile && (
                    <div className="flex gap-3 justify-start">
                      <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <FileText className="h-4 w-4 text-primary" />
                      </div>
                      <div className="bg-card border border-border rounded-xl px-4 py-3 shadow-sm">
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          <span className="text-sm text-muted-foreground">{txt.processingOCR}</span>
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

            {/* Input Area - Sticky at bottom */}
            <div className="p-3 md:p-4 border-t border-border/50 bg-card">
              <div className="flex gap-2 items-end">
                {/* Camera button */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleCameraClick}
                  disabled={isLoading || isProcessingFile}
                  className="flex-shrink-0 h-11 w-11"
                >
                  <Camera className="h-5 w-5" />
                </Button>

                {/* File upload button */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleFileClick}
                  disabled={isLoading || isProcessingFile}
                  className="flex-shrink-0 h-11 w-11"
                >
                  <Paperclip className="h-5 w-5" />
                </Button>

                {/* Text input */}
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={txt.placeholder}
                  className="min-h-[44px] resize-none rounded-xl text-base touch-manipulation overscroll-contain flex-1"
                  style={{ fontSize: '16px' }}
                  disabled={isLoading || isProcessingFile}
                  onKeyDown={(e) => {
                    // Prevent Enter from submitting - use button only
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                    }
                  }}
                />

                {/* Send button */}
                <Button
                  onClick={handleSend}
                  disabled={!trimmedInput || isLoading || isProcessingFile}
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

              {/* Message counter hidden - users don't need to see limits */}
              <div className="mt-2 text-xs text-muted-foreground text-right">
                <span>{txt.disclaimer}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Camera Permission Dialog */}
      <Dialog open={cameraPermissionDialog} onOpenChange={setCameraPermissionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              {txt.cameraPermTitle}
            </DialogTitle>
            <DialogDescription>{txt.cameraPermBody}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCameraPermissionDialog(false)}>
              {txt.close}
            </Button>
            <Button onClick={handleAllowCamera}>
              <Camera className="h-4 w-4 mr-2" />
              {txt.cameraPermAllow}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Limit Reached Dialog */}
      <AlertDialog open={limitDialogOpen} onOpenChange={setLimitDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{txt.limitTitle}</AlertDialogTitle>
            <AlertDialogDescription>{txt.limitBody}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setLimitDialogOpen(false)}>
              {txt.close}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleLogin}>{txt.limitLogin}</AlertDialogAction>
            <AlertDialogAction onClick={handleSignup}>{txt.limitSignup}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
