import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Header } from '@/components/Header';
import { LegalFooter } from '@/components/LegalFooter';
import { PlanLimitPopup } from '@/components/PlanLimitPopup';
import { InAppCamera } from '@/components/InAppCamera';
import { LegalLoader } from '@/components/LegalLoader';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useEntitlements } from '@/hooks/useEntitlements';
import { supabase } from '@/integrations/supabase/client';
import { callEdgeFunction } from '@/lib/edgeFetch';
import { runCanonicalPipeline, isHeicFile, HEIC_NOT_SUPPORTED_MSG } from '@/lib/canonicalPipeline';
import { getProcessDocumentErrorToast } from '@/lib/processDocumentClient';
import { Camera, Upload, FileText, Loader2, ArrowRight, ArrowLeft, X, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export default function ScanDocument() {
  const { t, language } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  const { entitlements, isLoading: entitlementsLoading, refresh: refreshEntitlements, isAdmin } = useEntitlements();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [showLimitPopup, setShowLimitPopup] = useState(false);
  
  // Multi-document state
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [praticaName, setPraticaName] = useState('');
  const [showNameInput, setShowNameInput] = useState(false);
  
  // In-app camera state
  const [showCamera, setShowCamera] = useState(false);
  
  // Anonymous analysis result state
  const [anonymousAnalysis, setAnonymousAnalysis] = useState<{
    extractedText: string;
    explanation?: string;
    risks?: string[];
    draft?: string;
  } | null>(null);

  // For anonymous users, we allow basic OCR and analysis but not saving to database
  // No redirect - allow anonymous access
  const isAnonymous = !authLoading && !user;

  const canCreateCase = useCallback(() => {
    if (isAnonymous) return false; // Anonymous users can't create cases
    if (entitlementsLoading) return true;
    return entitlements.can_create_case === true;
  }, [entitlements, entitlementsLoading, isAnonymous]);

  const isAtLimit = !isAnonymous && !entitlementsLoading && !entitlements.can_create_case;

  const handleOpenCamera = useCallback(() => {
    console.log('DEBUG: ScanDocument handleOpenCamera clicked', { isAnonymous, isAtLimit });
    if (!isAnonymous && isAtLimit) {
      setShowLimitPopup(true);
      return;
    }
    console.log('DEBUG: ScanDocument setShowCamera(true) - apertura camera');
    setShowCamera(true);
  }, [isAtLimit, isAnonymous]);

  const handleCameraPhotos = useCallback((files: File[]) => {
    setShowCamera(false);
    if (files.length > 0) {
      // Camera already combines existingPhotos + new photos
      setSelectedFiles(files);
      if (!showNameInput) {
        setPraticaName('');
        setShowNameInput(true);
      }
    }
  }, [showNameInput]);

  const handleUploadClick = useCallback(() => {
    if (!isAnonymous && isAtLimit) {
      setShowLimitPopup(true);
      return;
    }
    fileInputRef.current?.click();
  }, [isAtLimit, isAnonymous]);

  // Anonymous: use canonical pipeline with isDemo (ANON_KEY + X-Demo-Mode), no camera
  const processFilesAnonymous = async (files: File[]) => {
    if (files.length === 0) return;
    setIsProcessing(true);
    setProcessingStep(t('analysis.uploading'));
    const lang = language?.toUpperCase().slice(0, 2) || 'DE';

    try {
      let combinedText = '';
      let lastAnalysis: { summary?: string; risks?: string[]; draft_text?: string } | null = null;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        console.log('[scan] uploading file:', { name: file.name, type: file.type, size: file.size });
        if (isHeicFile(file)) {
          toast.error(`${file.name}: ${HEIC_NOT_SUPPORTED_MSG}`, { duration: 6000 });
          continue;
        }
        setProcessingStep(`${t('scan.step.uploading')} (${i + 1}/${files.length})`);
        const result = await runCanonicalPipeline(file, {
          isDemo: true,
          userLanguage: lang,
          onProgress: (step) => {
            if (step === 'uploading') setProcessingStep(`${t('scan.step.uploading')} (${i + 1}/${files.length})`);
            else if (step === 'ocr') setProcessingStep(`${t('scan.step.ocr')} (${i + 1}/${files.length})`);
            else setProcessingStep(t('scan.step.analyzing'));
          },
        });
        if (result.ocr_text) combinedText += (combinedText ? '\n\n---\n\n' : '') + result.ocr_text;
        if (result.analysis || result.draft_text) {
          lastAnalysis = {
            summary: result.analysis?.summary,
            risks: result.analysis?.risks,
            draft_text: result.draft_text,
          };
        }
      }

      if (combinedText) {
        setAnonymousAnalysis({
          extractedText: combinedText,
          explanation: lastAnalysis?.summary ?? undefined,
          risks: lastAnalysis?.risks,
          draft: lastAnalysis?.draft_text,
        });
        toast.success(t('analysis.completed'));
      } else {
        toast.error(t('scan.error') + (typeof window !== 'undefined' ? '. ' + (t('analysis.ocrError') || 'Nessun testo estratto. Riprova.') : ''), { duration: 6000 });
      }
    } catch (error) {
      console.error('Error processing files (anon):', error);
      const { message, runId, actionLabel } = getProcessDocumentErrorToast(error as import('@/lib/processDocumentClient').ProcessDocumentErrorLike, { isAdmin: isAdmin ?? false });
      toast.error(`${t('scan.error')}: ${message}`, {
        duration: 8000,
        ...(actionLabel && runId && { action: { label: actionLabel, onClick: () => navigate(`/admin/pipeline-runs?run_id=${runId}`) } }),
      });
    } finally {
      setIsProcessing(false);
      setProcessingStep('');
      setSelectedFiles([]);
      setPraticaName('');
      setShowNameInput(false);
    }
  };

  const processFiles = async (files: File[], name: string) => {
    if (files.length === 0) return;
    setIsProcessing(true);
    setProcessingStep(t('scan.step.creating'));
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Sessione scaduta. Effettua di nuovo l\'accesso.');

      const createResult = await callEdgeFunction('create-case', token, { title: name.trim(), status: 'new' });
      const caseResponse = createResult.data;

      if (!createResult.ok) {
        const errCode = (caseResponse && typeof caseResponse === 'object' && ('error' in caseResponse) ? (caseResponse as { error?: string }).error : null) ?? '';
        const errMsg = (caseResponse && typeof caseResponse === 'object' && ('message' in caseResponse) ? (caseResponse as { message?: string }).message : null)
          || (caseResponse && typeof caseResponse === 'object' && ('error' in caseResponse) ? (caseResponse as { error?: string }).error : null)
          || `Errore server (${createResult.status})`;
        if (createResult.status === 402 || ['LIMIT_UPLOADS', 'LIMIT_OCR', 'LIMIT_CHAT', 'LIMIT_REACHED', 'PRACTICE_LIMIT_REACHED'].includes(errCode)) {
          setShowLimitPopup(true);
          toast.error(errMsg || t('subscription.limitReached'), { duration: 6000 });
          return;
        }
        if (createResult.status === 503 && errCode === 'USAGE_SYSTEM_UNAVAILABLE') {
          toast.error(errMsg || t('scan.error'), { duration: 6000 });
          return;
        }
        throw new Error(errMsg);
      }
      if (caseResponse?.error === 'LIMIT_REACHED' || caseResponse?.error === 'PRACTICE_LIMIT_REACHED' || caseResponse?.error === 'LIMIT_UPLOADS') {
        setShowLimitPopup(true);
        toast.error((caseResponse as { message?: string }).message || t('subscription.limitReached'));
        return;
      }
      if (caseResponse?.error) throw new Error((caseResponse as { message?: string }).message || (caseResponse as { error?: string }).error);

      const pratica = (caseResponse as { case?: { id: string } })?.case;
      if (!pratica?.id) throw new Error('Failed to create case');

      let combinedText = '';
      let firstAnalysis: { summary?: string; risks?: string[]; draft_text?: string } | null = null;

      console.log("[DEBUG-UPLOAD] ScanDocument: prima upload", { numFiles: files.length });
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        console.log('[scan] uploading file:', { name: file.name, type: file.type, size: file.size });
        if (isHeicFile(file)) {
          toast.error(`${file.name}: HEIC non supportato. Usa JPG/PNG.`, { duration: 6000 });
          continue;
        }
        setProcessingStep(`${t('scan.step.uploading')} (${i + 1}/${files.length})`);
        try {
          console.log("[DEBUG-UPLOAD] ScanDocument: durante upload (runCanonicalPipeline)", file.name);
          const result = await runCanonicalPipeline(file, {
            caseId: pratica.id,
            source: 'upload',
            userLanguage: language?.toUpperCase().slice(0, 2) || 'DE',
            onProgress: (step) => {
              if (step === 'uploading') setProcessingStep(`${t('scan.step.uploading')} (${i + 1}/${files.length})`);
              else if (step === 'ocr') setProcessingStep(`${t('scan.step.ocr')} (${i + 1}/${files.length})`);
              else if (step === 'analyzing') setProcessingStep(t('scan.step.analyzing'));
            },
          });
          console.log("[DEBUG-UPLOAD] Risposta:", { document_id: result.document_id, ocrLen: result.ocr_text?.length, hasDraft: !!result.draft_text });
          if (result.ocr_text) combinedText += (combinedText ? '\n\n---\n\n' : '') + result.ocr_text;
          if (!firstAnalysis && (result.analysis || result.draft_text)) {
            firstAnalysis = {
              summary: result.analysis?.summary,
              risks: result.analysis?.risks,
              draft_text: result.draft_text,
            };
          }
        } catch (err: unknown) {
          console.error("[DEBUG-processDocument] ERRORE in processFiles (ScanDocument):", err);
          console.error("[DEBUG-processDocument] Stack:", err instanceof Error ? err.stack : "(no stack)");
          const code = err instanceof Error ? (err as { code?: string }).code : undefined;
          if (code === 'HEIC_NOT_SUPPORTED') {
            toast.error(`${file.name}: ${err instanceof Error ? err.message : String(err)}`, { duration: 6000 });
          } else {
            throw err;
          }
        }
      }

      if (combinedText) {
        await supabase.from('pratiche').update({ letter_text: combinedText, status: 'in_progress' }).eq('id', pratica.id);
        if (firstAnalysis) {
          await supabase.from('pratiche').update({
            explanation: firstAnalysis.summary ?? null,
            risks: firstAnalysis.risks ?? [],
            draft_response: firstAnalysis.draft_text ?? null,
            status: 'in_progress',
          }).eq('id', pratica.id);
        }
      }

      await refreshEntitlements();
      toast.success(t('scan.success'));
      navigate(`/pratiche/${pratica.id}`);
    } catch (error) {
      console.error("[DEBUG-processDocument] ERRORE in processFiles (ScanDocument) outer catch:", error);
      console.error("[DEBUG-processDocument] Stack:", error instanceof Error ? error.stack : "(no stack)");
      const { message, runId, actionLabel } = getProcessDocumentErrorToast(error as import('@/lib/processDocumentClient').ProcessDocumentErrorLike, { isAdmin: isAdmin ?? false });
      toast.error(`${t('scan.error')}: ${message}`, {
        duration: 8000,
        ...(actionLabel && runId && { action: { label: actionLabel, onClick: () => navigate(`/admin/pipeline-runs?run_id=${runId}`) } }),
      });
    } finally {
      setIsProcessing(false);
      setProcessingStep('');
      setSelectedFiles([]);
      setPraticaName('');
      setShowNameInput(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setSelectedFiles(prev => [...prev, ...files]);
      if (!showNameInput) {
        const first = files[0];
        const suggestedName = first.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
        const isGeneric = /^(IMG|image|foto|photo|scan|document)/i.test(suggestedName);
        setPraticaName(isGeneric ? '' : suggestedName);
        setShowNameInput(true);
      }
    }
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    if (selectedFiles.length <= 1) {
      setShowNameInput(false);
      setPraticaName('');
    }
  };

  const handleConfirmName = () => {
    if (isAnonymous) {
      // For anonymous users, skip name requirement and process immediately
      if (selectedFiles.length > 0) processFilesAnonymous(selectedFiles);
    } else {
      if (!praticaName.trim()) { toast.error(t('scan.nameRequired')); return; }
      if (selectedFiles.length > 0) processFiles(selectedFiles, praticaName);
    }
  };

  const handleBack = () => { 
    setSelectedFiles([]); 
    setPraticaName(''); 
    setShowNameInput(false);
    setAnonymousAnalysis(null);
  };

  const handleAddMorePhotos = useCallback(() => {
    setShowCamera(true);
  }, []);

  // Get the full content for export (explanation contains the full analysis text)
  const getExportContent = () => {
    if (!anonymousAnalysis) return '';
    // Use explanation as the main content (it contains the full AI analysis)
    return anonymousAnalysis.explanation || anonymousAnalysis.draft || anonymousAnalysis.extractedText || '';
  };

  // For anonymous users with analysis results, show results page
  if (anonymousAnalysis) {
    const exportContent = getExportContent();
    const hasContent = exportContent.length > 0;
    
    return (
      <div className="min-h-screen flex flex-col bg-ivory">
        <Header />
        <main className="flex-1 container py-8 md:py-12">
          <div className="mx-auto max-w-2xl space-y-6">
            {/* Back button */}
            <Button
              variant="outline"
              onClick={handleBack}
              className="border-2 border-gold text-gold hover:bg-gold/10 hover:text-gold font-semibold"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('common.back')}
            </Button>
            
            {/* Analysis Results */}
            <div className="relative">
              <div className="absolute inset-0 bg-navy rounded-2xl translate-x-2 translate-y-2" />
              <div className="relative rounded-2xl border-4 border-gold bg-gradient-to-b from-[#fdfaf6] to-[#f5f0e6] p-6 md:p-8 space-y-6">
                <h2 className="font-display text-2xl font-bold text-navy">{t('analysis.completed')}</h2>
                
                {/* Full Analysis Content - Always show if we have any content */}
                {hasContent && (
                  <div className="space-y-4">
                    <div className="bg-white/80 rounded-lg p-4 border border-gold/30 max-h-[50vh] overflow-y-auto">
                      <p className="text-navy/80 whitespace-pre-wrap text-sm md:text-base leading-relaxed">{exportContent}</p>
                    </div>
                    
                    {/* Export Buttons - Always visible */}
                    <div className="flex flex-wrap gap-2 pt-2">
                      <Button
                        variant="outline"
                        className="border-2 border-gold text-gold hover:bg-gold/10"
                        onClick={() => {
                          navigator.clipboard.writeText(exportContent);
                          toast.success(t('chat.copied'));
                        }}
                      >
                        {t('chat.copy')}
                      </Button>
                      <Button
                        variant="outline"
                        className="border-2 border-gold text-gold hover:bg-gold/10"
                        onClick={() => {
                          const printWindow = window.open('', '_blank');
                          if (printWindow) {
                            printWindow.document.write(`
                              <html>
                                <head><title>Lexora - Analisi</title>
                                <style>
                                  body { font-family: Georgia, serif; padding: 40px; max-width: 800px; margin: 0 auto; line-height: 1.6; }
                                  h1 { font-size: 18px; margin-bottom: 20px; }
                                  pre { white-space: pre-wrap; word-wrap: break-word; font-family: inherit; }
                                </style>
                                </head>
                                <body>
                                  <h1>Lexora - Analisi Documento</h1>
                                  <pre>${exportContent.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
                                </body>
                              </html>
                            `);
                            printWindow.document.close();
                            printWindow.print();
                          }
                        }}
                      >
                        {t('chat.print')}
                      </Button>
                      <Button
                        variant="outline"
                        className="border-2 border-gold text-gold hover:bg-gold/10"
                        onClick={() => {
                          const subject = 'Lexora - Analisi Documento';
                          if (exportContent.length > 1800) {
                            navigator.clipboard.writeText(exportContent);
                            toast.success(t('chat.copied'));
                            window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent('(Text copied to clipboard - paste here)')}`;
                          } else {
                            window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(exportContent)}`;
                          }
                        }}
                      >
                        {t('chat.email')}
                      </Button>
                    </div>
                  </div>
                )}
                
                {/* Small note about saving - not blocking */}
                <div className="pt-4 border-t border-gold/30 text-center">
                  <p className="text-navy/60 text-xs mb-2">
                    {t('scan.anonymousHint') || 'Per salvare questa analisi, crea un account gratuito'}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-navy/70 hover:text-navy text-xs underline"
                    onClick={() => navigate('/auth?mode=signup')}
                  >
                    {t('demoChat.limit.signup')}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </main>
        <LegalFooter />
      </div>
    );
  }

  if (authLoading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <LegalLoader size="lg" />
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-ivory">
      <Header />
      <PlanLimitPopup open={showLimitPopup} onClose={() => setShowLimitPopup(false)} />
      
      {/* In-App Camera - only for logged-in users (anon: no camera, upload file only) */}
      {showCamera && !isAnonymous && (
        <InAppCamera
          onPhotosCaptured={handleCameraPhotos}
          onClose={() => setShowCamera(false)}
          existingPhotos={selectedFiles}
        />
      )}
      
      {/* Luxury Design Container */}
      <main className="flex-1 relative overflow-hidden">
        {/* Back Button */}
        <div className="container pt-4 pb-0 relative z-20">
          <Button
            variant="outline"
            onClick={() => navigate(-1)}
            className="border-2 border-gold text-gold hover:bg-gold/10 hover:text-gold font-semibold"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('common.back')}
          </Button>
        </div>

        {/* Decorative baroque corners */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 left-0 w-40 h-40 opacity-20">
            <svg viewBox="0 0 100 100" className="w-full h-full text-gold">
              <path d="M0,0 Q30,5 50,25 T50,50 Q25,50 5,30 T0,0" fill="currentColor" opacity="0.5" />
              <path d="M10,0 Q35,10 45,35 T45,45 Q35,45 10,35 T10,0" fill="currentColor" opacity="0.3" />
            </svg>
          </div>
          <div className="absolute top-0 right-0 w-40 h-40 opacity-20 transform scale-x-[-1]">
            <svg viewBox="0 0 100 100" className="w-full h-full text-gold">
              <path d="M0,0 Q30,5 50,25 T50,50 Q25,50 5,30 T0,0" fill="currentColor" opacity="0.5" />
              <path d="M10,0 Q35,10 45,35 T45,45 Q35,45 10,35 T10,0" fill="currentColor" opacity="0.3" />
            </svg>
          </div>
          <div className="absolute bottom-0 left-0 w-40 h-40 opacity-20 transform scale-y-[-1]">
            <svg viewBox="0 0 100 100" className="w-full h-full text-gold">
              <path d="M0,0 Q30,5 50,25 T50,50 Q25,50 5,30 T0,0" fill="currentColor" opacity="0.5" />
              <path d="M10,0 Q35,10 45,35 T45,45 Q35,45 10,35 T10,0" fill="currentColor" opacity="0.3" />
            </svg>
          </div>
          <div className="absolute bottom-0 right-0 w-40 h-40 opacity-20 transform scale-[-1]">
            <svg viewBox="0 0 100 100" className="w-full h-full text-gold">
              <path d="M0,0 Q30,5 50,25 T50,50 Q25,50 5,30 T0,0" fill="currentColor" opacity="0.5" />
              <path d="M10,0 Q35,10 45,35 T45,45 Q35,45 10,35 T10,0" fill="currentColor" opacity="0.3" />
            </svg>
          </div>
        </div>

        <div className="container py-8 md:py-12 relative z-10">
          <div className="mx-auto max-w-xl">
            {/* Page Title */}
            <div className="text-center mb-10">
              <h1 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold tracking-wide text-navy mb-3">
                {showNameInput ? t('scan.nameTitle') : t('scan.title')}
              </h1>
              <p className="text-lg md:text-xl text-gold font-medium">
                {showNameInput ? t('scan.nameSubtitle') : t('scan.subtitle')}
              </p>
            </div>

            {/* Hidden file input for upload */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />

            {isProcessing ? (
              /* Processing Card with luxury styling */
              <div className="relative">
                <div className="absolute inset-0 bg-navy rounded-2xl translate-x-2 translate-y-2" />
                <div className="relative rounded-2xl border-4 border-gold bg-gradient-to-b from-[#fdfaf6] to-[#f5f0e6] p-8">
                  <div className="py-10 text-center">
                    <LegalLoader
                      size="lg"
                      message={t('scan.processing') || 'Elaborazione in corso…'}
                      subtitle={processingStep}
                    />
                  </div>
                </div>
              </div>
            ) : showNameInput ? (
              /* Name Input Card with luxury styling */
              <div className="relative">
                <div className="absolute inset-0 bg-navy rounded-2xl translate-x-2 translate-y-2" />
                <div className="relative rounded-2xl border-4 border-gold bg-gradient-to-b from-[#fdfaf6] to-[#f5f0e6] p-6 md:p-8">
                  <div className="space-y-6">
                    <div className="space-y-2">
                      {selectedFiles.map((file, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 bg-ivory/80 rounded-xl border border-gold/30">
                          {file.type.startsWith('image/') ? (
                            <img 
                              src={URL.createObjectURL(file)} 
                              alt={file.name}
                              className="h-12 w-12 object-cover rounded-lg shrink-0 border-2 border-gold/50"
                            />
                          ) : (
                            <div className="h-12 w-12 flex items-center justify-center bg-gold/10 rounded-lg border-2 border-gold/50">
                              <FileText className="h-6 w-6 text-gold" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-navy truncate">{file.name}</p>
                            <p className="text-xs text-navy/60">{(file.size / 1024).toFixed(0)} KB</p>
                          </div>
                          <button onClick={() => removeFile(i)} className="p-1.5 hover:bg-navy/10 rounded-lg transition-colors">
                            <X className="h-4 w-4 text-navy/60" />
                          </button>
                        </div>
                      ))}

                      <div className="grid grid-cols-2 gap-3 mt-4">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full touch-manipulation border-2 border-gold text-gold hover:bg-gold/10 font-medium"
                          onClick={handleAddMorePhotos}
                        >
                          <Camera className="h-4 w-4 mr-2" />
                          {t('scan.addPhoto') || '+ Add photo'}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full touch-manipulation border-2 border-gold text-gold hover:bg-gold/10 font-medium"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (fileInputRef.current) {
                              fileInputRef.current.click();
                            }
                          }}
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          {t('scan.addFiles') || '+ Add files'}
                        </Button>
                      </div>
                    </div>
                    {/* Name input - only for authenticated users */}
                    {!isAnonymous && (
                      <div className="space-y-2">
                        <Label htmlFor="pratica-name" className="text-navy font-semibold text-base">
                          {t('scan.nameLabel')} <span className="text-red-500">*</span>
                        </Label>
                        <Input 
                          id="pratica-name" 
                          value={praticaName} 
                          onChange={(e) => setPraticaName(e.target.value)} 
                          placeholder={t('scan.namePlaceholder')} 
                          className="text-lg border-2 border-gold/50 focus:border-gold bg-white/80 text-navy placeholder:text-navy/40" 
                          autoFocus 
                        />
                      </div>
                    )}
                    
                    {/* Info for anonymous users */}
                    {isAnonymous && (
                      <div className="p-3 bg-gold/10 rounded-lg border border-gold/30">
                        <p className="text-sm text-navy/80">
                          {t('scan.anonymousHint') || 'Click "Analyze" to process your document. Create a free account to save your cases.'}
                        </p>
                      </div>
                    )}
                    
                    <div className="flex gap-3 pt-2">
                      <Button variant="outline" className="flex-1 border-2 border-navy text-navy hover:bg-navy/10" onClick={handleBack}>
                        <ArrowLeft className="h-4 w-4 mr-2" />{t('common.back')}
                      </Button>
                      <Button 
                        className="flex-1 bg-navy text-gold hover:bg-navy/90 font-semibold" 
                        onClick={handleConfirmName} 
                        disabled={!isAnonymous && !praticaName.trim()}
                      >
                        {isAnonymous ? (t('scan.analyze') || 'Analyze') : t('common.continue')}
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <TooltipProvider>
                <div className="space-y-6">
                  {/* Limit warning banner */}
                  {isAtLimit && (
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border-2 border-red-200">
                      <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
                      <p className="text-sm text-red-600 font-medium">
                        {t('credits.limitReachedWarning')}
                      </p>
                    </div>
                  )}
                  
                  {/* Camera Card - only for logged-in users (anon: no camera, avoid permission issues) */}
                  {!isAnonymous && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={handleOpenCamera}
                          disabled={isAtLimit}
                          data-testid="scan-page-open-camera"
                          className={`block w-full text-left touch-manipulation [-webkit-tap-highlight-color:rgba(0,0,0,0)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 ${isAtLimit ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                          style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none' }}
                        >
                          <div className={`relative transition-transform ${!isAtLimit && 'hover:-translate-y-1 active:translate-y-0'}`}>
                            <div className="absolute inset-0 bg-navy rounded-2xl translate-x-2 translate-y-2" />
                            <div className="relative rounded-2xl border-4 border-gold bg-gradient-to-b from-[#fdfaf6] to-[#f5f0e6] p-8 md:p-10">
                              <div className="absolute inset-3 border-2 border-gold/40 rounded-xl pointer-events-none" />
                              <div className="relative flex flex-col items-center justify-center text-center space-y-4">
                                <Camera className="h-16 w-16 md:h-20 md:w-20 text-gold drop-shadow-lg" strokeWidth={1.5} />
                                <h2 className="font-display text-2xl md:text-3xl lg:text-4xl font-bold text-gold drop-shadow-[0_1px_2px_rgba(201,162,77,0.3)]">
                                  {t('scan.camera') || 'Scatta una foto'}
                                </h2>
                                <p className="text-base md:text-lg text-navy/70 max-w-xs">
                                  {t('scan.cameraDescMulti') || t('scan.cameraDesc')}
                                </p>
                              </div>
                            </div>
                          </div>
                        </button>
                      </TooltipTrigger>
                      {isAtLimit && (
                        <TooltipContent>
                          <p>{t('credits.limitReachedWarning')}</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  )}

                  {/* Upload Card - Luxury Design (only option for anon: "Carica una foto dal dispositivo") */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={handleUploadClick}
                        disabled={isAtLimit}
                        className={`block w-full text-left touch-manipulation [-webkit-tap-highlight-color:rgba(0,0,0,0)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 ${isAtLimit ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                        style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none' }}
                      >
                        <div className={`relative transition-transform ${!isAtLimit && 'hover:-translate-y-1 active:translate-y-0'}`}>
                          {/* Navy shadow/depth layer */}
                          <div className="absolute inset-0 bg-navy rounded-2xl translate-x-2 translate-y-2" />
                          {/* Main card with gold border */}
                          <div className="relative rounded-2xl border-4 border-gold bg-gradient-to-b from-[#fdfaf6] to-[#f5f0e6] p-8 md:p-10">
                            {/* Inner gold accent border */}
                            <div className="absolute inset-3 border-2 border-gold/40 rounded-xl pointer-events-none" />
                            <div className="relative flex flex-col items-center justify-center text-center space-y-4">
                              <Upload className="h-16 w-16 md:h-20 md:w-20 text-gold drop-shadow-lg" strokeWidth={1.5} />
                              <h2 className="font-display text-2xl md:text-3xl lg:text-4xl font-bold text-gold drop-shadow-[0_1px_2px_rgba(201,162,77,0.3)]">
                                {isAnonymous ? (t('scan.uploadPhotoFromDevice') || 'Carica una foto dal tuo dispositivo') : (t('scan.upload') || 'Carica un file')}
                              </h2>
                              <p className="text-base md:text-lg text-navy/70 max-w-xs">
                                {isAnonymous ? (t('scan.uploadPhotoFromDeviceDesc') || 'Scegli un\'immagine o PDF dalla galleria o dal PC') : t('scan.uploadDesc')}
                              </p>
                            </div>
                          </div>
                        </div>
                      </button>
                    </TooltipTrigger>
                    {isAtLimit && (
                      <TooltipContent>
                        <p>{t('credits.limitReachedWarning')}</p>
                      </TooltipContent>
                    )}
                  </Tooltip>

                </div>
              </TooltipProvider>
            )}
            <p className="text-center text-sm text-navy/60 mt-10 font-medium">{t('scan.formats') || 'Supported: JPG, PNG, PDF'}</p>
          </div>
        </div>
      </main>
      <LegalFooter />
    </div>
  );
}
