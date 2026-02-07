import { useEffect, useState, useRef } from 'react';
import { useScrollRestoration } from '@/hooks/useScrollRestoration';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Header } from '@/components/Header';
import { DocumentsSection } from '@/components/DocumentsSection';
import { DraftActions } from '@/components/DraftActions';
import { SenderDataSection } from '@/components/SenderDataSection';
import { ChatWithAI } from '@/components/ChatWithAI';
import { LegalLoader } from '@/components/LegalLoader';
import { DeadlineSection } from '@/components/DeadlineSection';
import { CollapsibleSection } from '@/components/CollapsibleSection';
import { AIDisclaimer } from '@/components/AIDisclaimer';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import {
  ArrowLeft,
  Building2,
  FileText,
  Calendar,
  Download,
  Trash2,
  Pencil,
  Loader2,
  AlertTriangle,
  Sparkles,
  Plus,
  RefreshCw,
  MessageSquare,
  CheckCircle2,
  RotateCcw,
  Expand,
  Printer,
  Mail,
  Share2,
  Copy,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { extractFormalLetterOnly } from '@/lib/extractFormalLetter';
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

interface Pratica {
  id: string;
  title: string;
  authority: string | null;
  aktenzeichen: string | null;
  deadline: string | null;
  deadline_source: string | null;
  calendar_event_created: boolean;
  reminders: any;
  status: string;
  letter_text: string | null;
  explanation: string | null;
  risks: any;
  draft_response: string | null;
  file_url: string | null;
  tone: string | null;
  created_at: string;
  updated_at: string;
  sender_name: string | null;
  sender_address: string | null;
  sender_postal_code: string | null;
  sender_city: string | null;
  sender_country: string | null;
  sender_date: string | null;
  chat_history: ChatMessage[] | null;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

const statusColors: Record<string, string> = {
  new: 'bg-navy text-ivory',
  in_progress: 'bg-gold/20 text-gold border border-gold/30',
  waiting: 'bg-muted text-muted-foreground',
  completed: 'bg-green text-white',
  resolved: 'bg-green text-white',
  archived: 'bg-graphite text-ivory',
};

// Helper to detect if content appears to be in a different language than current UI
function detectContentLanguage(text: string): 'DE' | 'IT' | 'EN' | 'FR' | 'ES' | 'OTHER' {
  if (!text) return 'OTHER';
  const lower = text.toLowerCase();
  
  // German markers
  const deMarkers = ['weitere', 'kosten', 'gebühren', 'nichtzahlung', 'mögliche', 'negative', 'auswirkungen', 'bonität', 'eventuelle', 'gerichtliche', 'schritte', 'verlust', 'verhandlungsspielraum', 'nichtreaktion', 'frist', 'zahlung', 'mahnung'];
  const deCount = deMarkers.filter(m => lower.includes(m)).length;
  
  // Italian markers  
  const itMarkers = ['ulteriori', 'costi', 'spese', 'mancato', 'pagamento', 'possibili', 'conseguenze', 'negative', 'credito', 'eventuali', 'azioni', 'legali', 'perdita', 'margine', 'negoziazione', 'scadenza'];
  const itCount = itMarkers.filter(m => lower.includes(m)).length;
  
  // English markers
  const enMarkers = ['additional', 'costs', 'fees', 'non-payment', 'possible', 'negative', 'effects', 'credit', 'potential', 'legal', 'action', 'loss', 'negotiation', 'deadline'];
  const enCount = enMarkers.filter(m => lower.includes(m)).length;
  
  // French markers
  const frMarkers = ['frais', 'supplémentaires', 'non-paiement', 'conséquences', 'négatives', 'crédit', 'actions', 'juridiques', 'perte', 'négociation', 'délai'];
  const frCount = frMarkers.filter(m => lower.includes(m)).length;
  
  // Spanish markers
  const esMarkers = ['costos', 'adicionales', 'falta', 'pago', 'posibles', 'consecuencias', 'negativas', 'crédito', 'acciones', 'legales', 'pérdida', 'negociación', 'plazo'];
  const esCount = esMarkers.filter(m => lower.includes(m)).length;
  
  const scores = { DE: deCount, IT: itCount, EN: enCount, FR: frCount, ES: esCount };
  const max = Math.max(...Object.values(scores));
  
  if (max < 2) return 'OTHER';
  
  const detected = Object.entries(scores).find(([_, v]) => v === max);
  return (detected?.[0] as 'DE' | 'IT' | 'EN' | 'FR' | 'ES') || 'OTHER';
}

export default function DettaglioPratica() {
  const { id } = useParams<{ id: string }>();
  const { t, isRTL, language } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  // Persist scroll position when navigating away (e.g., to generate PDF/email)
  useScrollRestoration(`pratica-${id}`);
  
  const [pratica, setPratica] = useState<Pratica | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [documents, setDocuments] = useState<any[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [generatingDraft, setGeneratingDraft] = useState(false);
  const [selectedTone, setSelectedTone] = useState<string>('formal');
  const [draftJustGenerated, setDraftJustGenerated] = useState(false);
  const [proposedDraft, setProposedDraft] = useState<string | null>(null);
  const [regeneratingProposal, setRegeneratingProposal] = useState(false);
  const [lastModifyInstruction, setLastModifyInstruction] = useState<string>('');
  const [draftDialogOpen, setDraftDialogOpen] = useState(false);
  const draftRef = useRef<HTMLDivElement>(null);
  const [letterTextJustUpdated, setLetterTextJustUpdated] = useState(false);
  // MANDATORY: Force open ALL sections after any document upload
  const [allSectionsForceOpen, setAllSectionsForceOpen] = useState(false);

  // Track previous document count to detect new uploads
  const prevDocCountRef = useRef<number>(0);
  const lastCombinedTextRef = useRef<string>('');

  const combineDocumentsText = (docs: any[]) => {
    const withText = (docs || [])
      .filter((d) => typeof d?.raw_text === 'string' && d.raw_text.trim().length > 0)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    if (withText.length === 0) return '';

    return withText
      .map((d: any) => d.raw_text.trim())
      .join('\n\n---\n\n');
  };

  // Compute combined text from all documents (first at top, last at bottom)
  const combinedText = combineDocumentsText(documents);
  // Use combined text for AI analysis (all documents, not just one)
  const textForAnalysis = combinedText || pratica?.letter_text || '';

  const fetchPratica = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('pratiche')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      
      if (error) {
        console.error('Error fetching pratica:', error);
        toast.error(t('pratica.detail.loadError'));
        navigate('/app');
        return;
      }
      
      if (!data) {
        toast.error(t('pratica.detail.notFound'));
        navigate('/app');
        return;
      }
      
      // Parse chat_history from JSON to ChatMessage[]
      const praticaData: Pratica = {
        ...data,
        chat_history: Array.isArray(data.chat_history) ? (data.chat_history as unknown as ChatMessage[]) : null,
      };
      setPratica(praticaData);
    } catch (err) {
      console.error('Unexpected error:', err);
      toast.error(t('pratica.detail.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const fetchDocuments = async () => {
    if (!id) return;
    setDocsLoading(true);
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('pratica_id', id)
        .order('created_at', { ascending: true });
      
      if (error) {
        console.error('Error fetching documents:', error);
        return;
      }
      
      setDocuments(data || []);
    } catch (err) {
      console.error('Unexpected error:', err);
    } finally {
      setDocsLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && id) {
      fetchPratica();
      fetchDocuments();
    }
  }, [user, id]);

  // Trigger AI analysis with given text
  const triggerAnalysis = async (textToAnalyze: string) => {
    if (!pratica || !textToAnalyze?.trim()) return;
    
    setAnalyzing(true);

    try {
      const { data, error } = await supabase.functions.invoke('analyze-letter', {
        body: {
          letterText: textToAnalyze,
          userLanguage: language,
          senderData: {
            sender_name: pratica.sender_name,
            sender_address: pratica.sender_address,
            sender_postal_code: pratica.sender_postal_code,
            sender_city: pratica.sender_city,
            sender_country: pratica.sender_country,
            sender_date: pratica.sender_date,
          },
        },
      });

      if (error) {
        console.error('Analysis error:', error);
        toast.error(t('pratica.detail.analyzeError'));
        return;
      }

      if (data.error) {
        console.error('AI error:', data.error);
        if (data.error.includes('Rate limit')) {
          toast.error(t('pratica.detail.rateLimitError'));
        } else if (data.error.includes('credits')) {
          toast.error(t('pratica.detail.creditsError'));
        } else {
          toast.error(t('pratica.detail.analyzeError'));
        }
        return;
      }

      // Save results to database
      const { error: updateError } = await supabase
        .from('pratiche')
        .update({
          explanation: data.explanation,
          risks: data.risks,
          draft_response: data.draft_response,
          status: 'in_progress',
        })
        .eq('id', pratica.id);

      if (updateError) {
        console.error('Update error:', updateError);
        toast.error(t('pratica.detail.saveError'));
        return;
      }

      // Update local state
      setPratica(prev => prev ? {
        ...prev,
        explanation: data.explanation,
        risks: data.risks,
        draft_response: data.draft_response,
        status: 'in_progress',
      } : null);

      // MANDATORY: Force open all sections after AI analysis completes
      setAllSectionsForceOpen(true);
      setDraftJustGenerated(true);
      setTimeout(() => {
        setAllSectionsForceOpen(false);
        setDraftJustGenerated(false);
      }, 500);

      toast.success(t('pratica.detail.analyzeSuccess'));
    } catch (err) {
      console.error('Unexpected error:', err);
      toast.error(t('pratica.detail.analyzeError'));
    } finally {
      setAnalyzing(false);
    }
  };

  // Removed: scrollIntoView on proposedDraft causes page jumps on mobile

  const handleDelete = async () => {
    if (!pratica) return;
    setDeleting(true);

    // Delete file from storage if exists
    if (pratica.file_url) {
      const filePath = pratica.file_url.split('/').pop();
      if (filePath) {
        await supabase.storage.from('pratiche-files').remove([`${user?.id}/${filePath}`]);
      }
    }

    const { error } = await supabase.from('pratiche').delete().eq('id', pratica.id);

    if (error) {
      toast.error(t('pratica.detail.deleteError'));
      setDeleting(false);
    } else {
      toast.success(t('pratica.detail.deleted'));
      navigate('/dashboard');
    }
  };

  const getFileDownloadUrl = async () => {
    if (!pratica?.file_url) return null;
    const filePath = pratica.file_url.split('/').slice(-2).join('/');
    const { data } = await supabase.storage.from('pratiche-files').createSignedUrl(filePath, 3600);
    return data?.signedUrl;
  };

  const handleDownload = async () => {
    const url = await getFileDownloadUrl();
    if (url) {
      window.open(url, '_blank');
    } else {
      toast.error(t('pratica.detail.downloadError'));
    }
  };

  const handleAnalyze = async () => {
    if (!pratica) return;

    // Use textForAnalysis which considers selected document
    if (!textForAnalysis || textForAnalysis.trim().length === 0) {
      toast.error(t('pratica.detail.noTextToAnalyze'));
      return;
    }

    await triggerAnalysis(textForAnalysis);
  };

  const handleGenerateDraft = async () => {
    if (!pratica) return;

    // Use combined text from all documents
    const textToAnalyze = textForAnalysis;
    
    if (!textToAnalyze || textToAnalyze.trim().length === 0) {
      toast.error(t('pratica.detail.noTextToAnalyze'));
      return;
    }

    setGeneratingDraft(true);

    // Get last user instruction from chat history
    const lastUserMessage = pratica.chat_history
      ?.filter(msg => msg.role === 'user')
      .pop()?.content || '';

    try {
      const { data, error } = await supabase.functions.invoke('analyze-letter', {
        body: {
          letterText: textToAnalyze,
          userLanguage: language,
          tone: selectedTone,
          generateDraftOnly: true,
          userInstructions: lastUserMessage,
          senderData: {
            sender_name: pratica.sender_name,
            sender_address: pratica.sender_address,
            sender_postal_code: pratica.sender_postal_code,
            sender_city: pratica.sender_city,
            sender_country: pratica.sender_country,
            sender_date: pratica.sender_date,
          },
        },
      });

      if (error) {
        console.error('Draft generation error:', error);
        toast.error(t('pratica.detail.analyzeError'));
        return;
      }

      if (data.error) {
        console.error('AI error:', data.error);
        toast.error(t('pratica.detail.analyzeError'));
        return;
      }

      // Save draft to database
      const { error: updateError } = await supabase
        .from('pratiche')
        .update({
          draft_response: data.draft_response,
          tone: selectedTone,
        })
        .eq('id', pratica.id);

      if (updateError) {
        toast.error(t('pratica.detail.saveError'));
        return;
      }

      setPratica({
        ...pratica,
        draft_response: data.draft_response,
        tone: selectedTone,
      });

      // Any previous proposal is now stale.
      setProposedDraft(null);

      toast.success(t('pratica.detail.draftSuccess'));

      // Mark draft as just generated to force open the section (no scroll - prevents page jump)
      setDraftJustGenerated(true);
      setTimeout(() => setDraftJustGenerated(false), 500);
    } catch (err) {
      console.error('Unexpected error:', err);
      toast.error(t('pratica.detail.analyzeError'));
    } finally {
      setGeneratingDraft(false);
    }
  };

  const handleApplyProposedDraft = async () => {
    if (!pratica || !proposedDraft) return;

    const nextDraft = proposedDraft;
    const { error } = await supabase
      .from('pratiche')
      .update({ draft_response: nextDraft })
      .eq('id', pratica.id);

    if (error) {
      console.error('Apply proposal error:', error);
      toast.error(t('pratica.detail.saveError'));
      return;
    }

    setPratica({ ...pratica, draft_response: nextDraft });
    setProposedDraft(null);
    toast.success(t('common.success'));
  };

  const handleDiscardProposedDraft = () => {
    setProposedDraft(null);
  };

  const handleRegenerateProposal = async () => {
    if (!pratica) return;
    if (!lastModifyInstruction.trim()) {
      toast.error(t('chat.modifyPlaceholder'));
      return;
    }

    setRegeneratingProposal(true);

    // Append the instruction to the stored chat history so the user sees it in the AI chat as well.
    const userMsg: ChatMessage = {
      role: 'user',
      content: lastModifyInstruction.trim(),
      created_at: new Date().toISOString(),
    };
    const historyForCall = [...(pratica.chat_history || []), userMsg];

    try {
      const { data, error } = await supabase.functions.invoke('chat-with-ai', {
        body: {
          userMessage: userMsg.content,
          letterText: pratica.letter_text,
          draftResponse: pratica.draft_response,
          praticaData: {
            authority: pratica.authority,
            aktenzeichen: pratica.aktenzeichen,
            deadline: pratica.deadline,
            title: pratica.title,
          },
          chatHistory: historyForCall,
          userLanguage: language,
          mode: 'modify',
        },
      });

      if (error || data?.error) {
        console.error('Regenerate proposal error:', error || data?.error);
        toast.error(t('chat.error'));
        return;
      }

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: data.response,
        created_at: new Date().toISOString(),
      };

      const updatedHistory = [...historyForCall, assistantMsg];
      setPratica({ ...pratica, chat_history: updatedHistory });

      // IMPORTANT: do NOT push normal conversational answers into the draft box.
      // Only store a proposal when the assistant output looks like a formal letter draft.
      const content = assistantMsg.content;
      const looksLikeDraft =
        content.length > 500 &&
        (
          /^(Sehr geehrte|An das|An die|Betreff:|Absender:)/m.test(content) ||
          /^(Gentile|Spett\.|Spett\.le|Egregio|Oggetto:)/m.test(content) ||
          /^(Dear|To whom it may concern|Subject:|Re:)/im.test(content) ||
          (/(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/.test(content) &&
            /Mit freundlichen Gr\u00fc\u00dfen|Cordiali saluti|Sincerely|Best regards/i.test(content))
        );

      if (looksLikeDraft) {
        const extracted = extractFormalLetterOnly(content);
        if (extracted) setProposedDraft(extracted);
      }

      // Persist chat history (non-blocking UX)
      await supabase.from('pratiche').update({ chat_history: updatedHistory as any }).eq('id', pratica.id);
    } catch (e) {
      console.error('Regenerate proposal unexpected error:', e);
      toast.error(t('chat.error'));
    } finally {
      setRegeneratingProposal(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ivory">
        <LegalLoader size="lg" />
      </div>
    );
  }

  if (!pratica) {
    return null;
  }

  return (
    <div className="min-h-screen bg-ivory" dir={isRTL ? 'rtl' : 'ltr'}>
      <Header />

      <main className="container py-8">
        {/* Back button and actions */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <Button variant="outline" className="gap-2" asChild>
            <Link to="/app">
              <ArrowLeft className="h-4 w-4" />
              {t('actions.back')}
            </Link>
          </Button>

          <Button variant="outline" className="gap-2" onClick={() => navigate(`/edit/${pratica.id}`)}>
            <Pencil className="h-4 w-4" />
            {t('common.edit')}
          </Button>
        </div>

        {/* Header card */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <CardTitle className="mb-2 text-2xl">{pratica.title}</CardTitle>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  {pratica.authority && (
                    <div className="flex items-center gap-1">
                      <Building2 className="h-4 w-4" />
                      {pratica.authority}
                    </div>
                  )}
                  {pratica.aktenzeichen && (
                    <div className="flex items-center gap-1">
                      <FileText className="h-4 w-4" />
                      {pratica.aktenzeichen}
                    </div>
                  )}
                  {pratica.deadline && (
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {format(new Date(pratica.deadline), 'dd.MM.yyyy')}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {/* AI Language indicator for debugging */}
                <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
                  AI: {language}
                </Badge>
                <Badge className={statusColors[pratica.status] || statusColors.new}>
                  {t(`status.${pratica.status}`)}
                </Badge>
              </div>
            </div>
          </CardHeader>
        </Card>


        {/* Documents Section */}
        <DocumentsSection
          praticaId={pratica.id}
          documents={documents}
          loading={docsLoading}
          onRefresh={fetchDocuments}
          onPraticaRefresh={fetchPratica}
          userId={user?.id || ''}
        />

        {/* Letter text - Collapsible, auto-opens after OCR */}
        {combinedText && (
          <CollapsibleSection
            title={t('pratica.detail.fullLetterText')}
            icon={<FileText className="h-5 w-5 text-primary" />}
            badge={t('pratica.detail.badgeText')}
            previewText={combinedText}
            storageKey={`pratica-${id}-lettertext`}
            forceOpen={allSectionsForceOpen || letterTextJustUpdated}
            defaultOpen={true}
          >
            <div className="whitespace-pre-wrap rounded-lg bg-graphite p-4 text-sm text-ivory shadow-inset">
              {combinedText}
            </div>
          </CollapsibleSection>
        )}

        <CollapsibleSection
          title={t('pratica.detail.analysis')}
          icon={<Sparkles className="h-5 w-5 text-primary" />}
          badge={pratica.explanation ? 'AI' : undefined}
          previewText={pratica.explanation}
          storageKey={`pratica-${id}-analysis`}
          forceOpen={allSectionsForceOpen}
          defaultOpen={true}
        >
          <div className="space-y-4">
            {/* AI Disclaimer */}
            <AIDisclaimer variant="banner" />
            {analyzing ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-primary" />
                  <p className="text-muted-foreground">{t('pratica.detail.analyzingDesc')}</p>
                </div>
              </div>
            ) : pratica.explanation ? (
              <div className="whitespace-pre-wrap rounded-lg bg-graphite p-4 text-sm text-ivory shadow-inset">
                {pratica.explanation}
              </div>
            ) : (
              <p className="text-muted-foreground">{t('pratica.detail.noAnalysis')}</p>
            )}

            {/* Risks inside analysis */}
            {pratica.risks && Array.isArray(pratica.risks) && pratica.risks.length > 0 && (() => {
              // Check if risks content language differs from current UI language
              const risksText = pratica.risks.join(' ');
              const detectedLang = detectContentLanguage(risksText);
              const languageMismatch = detectedLang !== 'OTHER' && detectedLang !== language;
              
              return (
                <div className="rounded-md border border-warning/30 bg-warning/5 p-4 space-y-3">
                  <div className="flex items-center gap-2 mb-2 font-medium text-warning">
                    <AlertTriangle className="h-4 w-4" />
                    {t('pratica.detail.risks')}
                  </div>
                  
                  {/* Language mismatch warning */}
                  {languageMismatch && (
                    <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded text-xs text-blue-700 dark:text-blue-300">
                      <RefreshCw className="h-3 w-3 flex-shrink-0" />
                      <span>{t('pratica.detail.languageMismatchHint')}</span>
                    </div>
                  )}
                  
                  <ul className="list-inside list-disc space-y-1">
                    {pratica.risks.map((risk: string, index: number) => (
                      <li key={index} className="text-sm">
                        {risk}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })()}

            {/* Always visible CTA button */}
            <Button
              onClick={handleAnalyze}
              disabled={analyzing || !textForAnalysis}
              className="w-full gap-2"
              size="lg"
            >
              {analyzing ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : pratica.explanation ? (
                <RefreshCw className="h-5 w-5" />
              ) : (
                <Sparkles className="h-5 w-5" />
              )}
              {analyzing 
                ? t('pratica.detail.analyzing') 
                : pratica.explanation 
                  ? t('pratica.detail.regenerate') 
                  : t('pratica.detail.startAnalysis')
              }
            </Button>
            {!textForAnalysis && (
              <p className="text-center text-sm text-muted-foreground">
                {documents.length > 0 
                  ? t('pratica.detail.selectDocumentToAnalyze')
                  : t('pratica.detail.noTextToAnalyze')
                }
              </p>
            )}
          </div>
        </CollapsibleSection>

        {/* 1) BOZZA DI RISPOSTA - Collapsible, opens when just generated */}
        <div ref={draftRef} data-draft-section>
          <CollapsibleSection
            title={t('pratica.detail.draftResponse')}
            icon={<MessageSquare className="h-5 w-5 text-primary" />}
            badge={pratica.draft_response ? t('pratica.detail.badgeDraft') : undefined}
            previewText={pratica.draft_response}
            storageKey={`pratica-${id}-draft`}
            forceOpen={allSectionsForceOpen || draftJustGenerated}
            defaultOpen={true}
          >
            <div className="space-y-4">
              {/* AI Disclaimer */}
              <AIDisclaimer variant="banner" />
              {generatingDraft ? (
                <div className="flex items-center justify-center py-8">
                <div className="text-center">
                    <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-primary" />
                    <p className="text-muted-foreground">{t('pratica.detail.generatingDraft')}</p>
                  </div>
                </div>
              ) : pratica.draft_response ? (
                <div className="space-y-4">
                  {/* Bozza documento - stile documento leggibile */}
                  <div 
                    className="print-content rounded-lg bg-white p-6 shadow-inner cursor-pointer hover:shadow-md transition-shadow relative group border"
                    onClick={() => setDraftDialogOpen(true)}
                    style={{
                      fontSize: '15px',
                      lineHeight: '1.7',
                      fontFamily: 'Georgia, serif',
                      whiteSpace: 'pre-wrap'
                    }}
                  >
                    {pratica.draft_response}
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Expand className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">{t('pratica.detail.noDraft')}</p>
              )}

              {/* Tone selector and generate button */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-1">
                  <label className="text-sm font-medium">{t('pratica.detail.selectTone')}</label>
                  <Select value={selectedTone} onValueChange={setSelectedTone}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="formal">{t('pratica.detail.toneFormal')}</SelectItem>
                      <SelectItem value="friendly">{t('pratica.detail.toneFriendly')}</SelectItem>
                      <SelectItem value="assertive">{t('pratica.detail.toneAssertive')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleGenerateDraft}
                  disabled={generatingDraft || !pratica.letter_text}
                  className="w-full gap-2 sm:w-auto"
                  size="lg"
                >
                  {generatingDraft ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : pratica.draft_response ? (
                    <RefreshCw className="h-5 w-5" />
                  ) : (
                    <MessageSquare className="h-5 w-5" />
                  )}
                  {generatingDraft
                    ? t('pratica.detail.generating')
                    : pratica.draft_response
                      ? t('pratica.detail.regenerateDraft')
                      : t('pratica.detail.generateDraft')
                  }
                </Button>
              </div>
            </div>
          </CollapsibleSection>
        </div>

        {/* FRIST - First section after draft document */}
        <DeadlineSection
          praticaId={pratica.id}
          praticaTitle={pratica.title}
          authority={pratica.authority}
          aktenzeichen={pratica.aktenzeichen}
          deadline={pratica.deadline}
          deadlineSource={pratica.deadline_source}
          calendarEventCreated={pratica.calendar_event_created || false}
          reminders={pratica.reminders}
          onDeadlineUpdate={(deadline, source, reminders) => {
            setPratica({ ...pratica, deadline, deadline_source: source, reminders });
          }}
        />

        {/* BUTTON: Navigate to Edit page to modify draft */}
        {pratica.draft_response && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center gap-3 text-center">
                <p className="text-sm text-muted-foreground">
                  {t('chat.modifyHint') || 'Use AI to refine and improve your draft response'}
                </p>
                <Button
                  onClick={() => navigate(`/edit/${pratica.id}`)}
                  className="gap-2"
                  size="lg"
                >
                  <Pencil className="h-5 w-5" />
                  {t('chat.modifyButton') || 'Modify Draft'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 3) SEZIONE BOZZA DOCUMENTO - SEPARATA */}
        {proposedDraft && (
          <div className="my-6 p-4 rounded-xl border-2 border-primary/30 bg-muted/20">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              {t('proposal.title')}
            </h3>
            <div 
              className="bg-white rounded-lg p-6 shadow-inner mb-4"
              style={{ 
                fontSize: '15px', 
                lineHeight: '1.7',
                fontFamily: 'Georgia, serif',
                whiteSpace: 'pre-wrap'
              }}
            >
              {proposedDraft}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button onClick={handleApplyProposedDraft} className="flex-1 gap-2">
                <CheckCircle2 className="h-4 w-4" />
                {t('proposal.apply')}
              </Button>
              <Button 
                onClick={handleRegenerateProposal} 
                variant="secondary" 
                className="flex-1 gap-2"
                disabled={regeneratingProposal}
              >
                {regeneratingProposal ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                {t('proposal.regenerate')}
              </Button>
              <Button onClick={handleDiscardProposedDraft} variant="outline" className="flex-1 gap-2">
                <Trash2 className="h-4 w-4" />
                {t('proposal.discard')}
              </Button>
            </div>
          </div>
        )}

        {/* 3) AZIONI - Subito dopo la bozza per salvare/rifare */}
        <DraftActions
          draftResponse={pratica.draft_response}
          praticaTitle={pratica.title}
          authority={pratica.authority}
          aktenzeichen={pratica.aktenzeichen}
          senderData={{
            sender_name: pratica.sender_name,
            sender_address: pratica.sender_address,
            sender_postal_code: pratica.sender_postal_code,
            sender_city: pratica.sender_city,
            sender_country: pratica.sender_country,
            sender_date: pratica.sender_date,
          }}
        />


        {/* 5) DATI MITTENTE - Ultimo blocco */}
        <SenderDataSection
          praticaId={pratica.id}
          senderData={{
            sender_name: pratica.sender_name,
            sender_address: pratica.sender_address,
            sender_postal_code: pratica.sender_postal_code,
            sender_city: pratica.sender_city,
            sender_country: pratica.sender_country,
            sender_date: pratica.sender_date,
          }}
          onSenderDataUpdate={(data) => {
            setPratica({ ...pratica, ...data });
          }}
        />


        {/* Status Control - User-driven */}
        <Card className="border-2 border-dashed">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4 text-center">
              {pratica.status !== 'completed' ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    {t('status.markDoneHint')}
                  </p>
                  <Button
                    onClick={async () => {
                      const { error } = await supabase
                        .from('pratiche')
                        .update({ status: 'completed' })
                        .eq('id', pratica.id);
                      
                      if (error) {
                        toast.error(t('pratica.detail.saveError'));
                      } else {
                        setPratica({ ...pratica, status: 'completed' });
                        toast.success(t('status.markedDone'));
                      }
                    }}
                    className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                    size="lg"
                  >
                    <CheckCircle2 className="h-5 w-5" />
                    {t('status.markDone')}
                  </Button>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-emerald-600">
                    <CheckCircle2 className="h-6 w-6" />
                    <span className="font-semibold text-lg">{t('status.completed')}</span>
                  </div>
                  <Button
                    variant="outline"
                    onClick={async () => {
                      const { error } = await supabase
                        .from('pratiche')
                        .update({ status: 'in_progress' })
                        .eq('id', pratica.id);
                      
                      if (error) {
                        toast.error(t('pratica.detail.saveError'));
                      } else {
                        setPratica({ ...pratica, status: 'in_progress' });
                        toast.success(t('status.reopened'));
                      }
                    }}
                    className="gap-2"
                    size="sm"
                  >
                    <RotateCcw className="h-4 w-4" />
                    {t('status.reopen')}
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Metadata */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-6 text-xs text-muted-foreground">
              <div>
                <span className="font-medium">{t('pratica.detail.createdAt')}:</span>{' '}
                {format(new Date(pratica.created_at), 'dd.MM.yyyy HH:mm')}
              </div>
              <div>
                <span className="font-medium">{t('pratica.detail.updatedAt')}:</span>{' '}
                {format(new Date(pratica.updated_at), 'dd.MM.yyyy HH:mm')}
              </div>
              {pratica.tone && (
                <div>
                  <span className="font-medium">{t('pratica.detail.tone')}:</span> {pratica.tone}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* DANGER ZONE - Delete button at the bottom */}
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              {t('editPratica.dangerZone')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {t('editPratica.deleteWarning')}
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="gap-2" disabled={deleting}>
                  {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  {t('common.delete')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('pratica.detail.confirmDelete')}</AlertDialogTitle>
                  <AlertDialogDescription>{t('pratica.detail.confirmDeleteDesc')}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>{t('pratica.detail.confirmDeleteBtn')}</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>

        {/* Draft Fullscreen Dialog with Actions */}
        <Dialog open={draftDialogOpen} onOpenChange={setDraftDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                {pratica.title}
              </DialogTitle>
            </DialogHeader>
            
            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2 pb-4 border-b">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => {
                  if (!pratica.draft_response) return;
                  const w = window.open('', '_blank');
                  if (!w) {
                    toast.error(t('actions.print'));
                    return;
                  }
                  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Print</title><style>@page{margin:20mm}body{font-family:serif;font-size:12pt;line-height:1.6;white-space:pre-wrap}</style></head><body>${pratica.draft_response.replace(/\n/g, '<br>')}</body></html>`);
                  w.document.close();
                  w.onload = () => { w.print(); w.close(); };
                }}
              >
                <Printer className="h-4 w-4" />
                {t('actions.print')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => {
                  if (!pratica.draft_response) return;
                  const subject = encodeURIComponent(`${pratica.title}`);
                  const body = encodeURIComponent(pratica.draft_response);
                  window.location.href = `mailto:?subject=${subject}&body=${body}`;
                  toast.success(t('actions.emailOpened'));
                }}
              >
                <Mail className="h-4 w-4" />
                {t('actions.email')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={async () => {
                  if (!pratica.draft_response) return;
                  if (navigator.share) {
                    try {
                      await navigator.share({ title: pratica.title, text: pratica.draft_response });
                      toast.success(t('actions.shareSuccess'));
                      return;
                    } catch (err) {
                      if ((err as Error).name === 'AbortError') return;
                    }
                  }
                  await navigator.clipboard.writeText(pratica.draft_response);
                  toast.success(t('actions.shareCopied'));
                }}
              >
                <Share2 className="h-4 w-4" />
                {t('actions.share')}
              </Button>
            </div>
            
            {/* Draft Content */}
            <div className="whitespace-pre-wrap text-sm font-serif leading-relaxed p-4 bg-muted/30 rounded-lg min-h-[50vh]">
              {pratica.draft_response}
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
