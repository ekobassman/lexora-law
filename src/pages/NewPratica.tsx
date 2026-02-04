import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Header } from '@/components/Header';
import { FilePreview } from '@/components/FilePreview';
import { AnalysisStatus, AnalysisStep } from '@/components/AnalysisStatus';
import { CameraScan } from '@/components/CameraScan';
import { PlanLimitPopup } from '@/components/PlanLimitPopup';
import { BlitzerWizard } from '@/components/BlitzerWizard';
import { AutoveloxWizard } from '@/components/AutoveloxWizard';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useEntitlements } from '@/hooks/useEntitlements';
import { supabase } from '@/integrations/supabase/client';
import { invokeExtractText } from '@/lib/invokeExtractText';
import { getEdgeFunctionErrorMessage } from '@/lib/edgeFunctionError';
import { toast } from 'sonner';
import { Loader2, Upload, ArrowLeft, Calendar, FileText, Building2, Hash, Sparkles } from 'lucide-react';
import { LegalLoader } from '@/components/LegalLoader';

const praticaSchema = z.object({
  title: z.string().min(1, 'required').max(200),
  authority: z.string().max(200).optional(),
  aktenzeichen: z.string().max(100).optional(),
  deadline: z.string().optional(),
  letter_text: z.string().max(50000).optional(),
});

export default function NewPratica() {
  const { t, isRTL, language } = useLanguage();
  const { user, loading: authLoading, hardReset } = useAuth();
  const { entitlements, isLoading: entitlementsLoading, refresh: refreshEntitlements } = useEntitlements();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Check for blitzer/autovelox template
  const template = searchParams.get('template');
  const isBlitzerTemplate = template === 'blitzer';
  const isAutoveloxTemplate = template === 'autovelox';
  
  const [showBlitzerWizard, setShowBlitzerWizard] = useState(false);
  const [showAutoveloxWizard, setShowAutoveloxWizard] = useState(false);
  const [blitzerPraticaId, setBlitzerPraticaId] = useState<string | null>(null);
  const [autoveloxPraticaId, setAutoveloxPraticaId] = useState<string | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [analysisStep, setAnalysisStep] = useState<AnalysisStep>('idle');
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [showPaywall, setShowPaywall] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    authority: '',
    aktenzeichen: '',
    deadline: '',
    letter_text: '',
  });
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [analysisResult, setAnalysisResult] = useState<{
    explanation?: string;
    risks?: string[];
    draft_response?: string;
  } | null>(null);

  // Check case limit on mount
  useEffect(() => {
    if (!entitlementsLoading && !entitlements.can_create_case) {
      setShowPaywall(true);
    }
  }, [entitlementsLoading, entitlements.can_create_case]);

  // Auto-create blitzer case when template=blitzer (German)
  useEffect(() => {
    if (!isBlitzerTemplate || !user || authLoading || entitlementsLoading) return;
    if (blitzerPraticaId) return; // Already created
    
    // Check case limit
    if (!entitlements.can_create_case) {
      setShowPaywall(true);
      return;
    }

    const createBlitzerCase = async () => {
      try {
        // Create the blitzer case via backend
        const { data, error } = await supabase.functions.invoke('create-case', {
          body: {
            title: 'Einspruch gegen Blitzer-Bußgeld',
            authority: 'Bußgeldstelle',
            status: 'in_progress',
          },
        });

        if (error) throw error;
        
        if (data?.error === 'LIMIT_REACHED') {
          setShowPaywall(true);
          return;
        }
        
        if (data?.id) {
          setBlitzerPraticaId(data.id);
          setShowBlitzerWizard(true);
          await refreshEntitlements();
        }
      } catch (err) {
        console.error('Error creating blitzer case:', err);
        toast.error('Fehler beim Erstellen des Vorgangs');
      }
    };

    createBlitzerCase();
  }, [isBlitzerTemplate, user, authLoading, entitlementsLoading, entitlements.can_create_case, blitzerPraticaId, refreshEntitlements]);

  // Auto-create autovelox case when template=autovelox (Italian)
  useEffect(() => {
    if (!isAutoveloxTemplate || !user || authLoading || entitlementsLoading) return;
    if (autoveloxPraticaId) return; // Already created
    
    // Check case limit
    if (!entitlements.can_create_case) {
      setShowPaywall(true);
      return;
    }

    const createAutoveloxCase = async () => {
      try {
        // Create the autovelox case via backend
        const { data, error } = await supabase.functions.invoke('create-case', {
          body: {
            title: 'Ricorso Multa Autovelox – Italia',
            authority: 'Prefettura / Giudice di Pace',
            status: 'in_progress',
          },
        });

        if (error) throw new Error(getEdgeFunctionErrorMessage(error, data));
        
        if (data?.error === 'LIMIT_REACHED') {
          setShowPaywall(true);
          return;
        }
        
        if (data?.id) {
          setAutoveloxPraticaId(data.id);
          setShowAutoveloxWizard(true);
          await refreshEntitlements();
        }
      } catch (err) {
        console.error('Error creating autovelox case:', err);
        toast.error('Errore nella creazione della pratica');
      }
    };

    createAutoveloxCase();
  }, [isAutoveloxTemplate, user, authLoading, entitlementsLoading, entitlements.can_create_case, autoveloxPraticaId, refreshEntitlements]);

  // Redirect if not authenticated
  if (!authLoading && !user) {
    navigate('/login');
    return null;
  }

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const extractTextFromFile = async (file: File): Promise<string | null> => {
    try {
      const base64 = await fileToBase64(file);

      // Use centralized invoke wrapper with auth validation
      const result = await invokeExtractText({
        base64,
        mimeType: file.type,
        userLanguage: language,
        navigate,
      });

      // null means auth failed and user was redirected
      if (result === null) return null;

      if (result.error) {
        console.error('[extract-text] function error', result.error);
        return null;
      }

      return result.text || null;
    } catch (err) {
      console.error('[extract-text] unexpected error', err);
      return null;
    }
  };

  const runAnalysis = async (text: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('analyze-letter', {
        body: {
          letterText: text,
          userLanguage: language,
        },
      });

      if (error) {
        console.error('Analysis error:', error);
        return null;
      }

      if (data?.error) {
        console.error('AI error:', data.error);
        return null;
      }

      return data;
    } catch (err) {
      console.error('Error running analysis:', err);
      return null;
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    // Validate file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(selectedFile.type)) {
      toast.error(t('newPratica.error.fileType'));
      return;
    }
    
    // Validate file size (max 10MB)
    if (selectedFile.size > 10 * 1024 * 1024) {
      toast.error(t('newPratica.error.fileSize'));
      return;
    }
    
    setFile(selectedFile);
    setAnalysisStep('uploading');
    setAnalysisProgress(10);
    
    try {
      // Upload file first
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${user!.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('pratiche-files')
        .upload(fileName, selectedFile);
      
      if (uploadError) throw uploadError;
      
      setFileUrl(fileName);
      setAnalysisProgress(30);
      toast.success(t('newPratica.fileUploaded'));

      // Run OCR for both images AND PDFs
      setAnalysisStep('extracting');
      setAnalysisProgress(50);
      
      const extractedText = await extractTextFromFile(selectedFile);
      
      if (extractedText && extractedText.trim().length > 0) {
        setFormData(prev => ({ ...prev, letter_text: extractedText }));
        setAnalysisProgress(70);
        
        // Now run AI analysis
        setAnalysisStep('analyzing');
        setAnalysisProgress(80);
        
        const result = await runAnalysis(extractedText);
        
        if (result) {
          setAnalysisResult(result);
          // Auto-fill authority if detected
          if (result.authority) {
            setFormData(prev => ({ ...prev, authority: result.authority }));
          }
          setAnalysisStep('completed');
          setAnalysisProgress(100);
          toast.success(t('detail.analyzeSuccess'));
        } else {
          setAnalysisStep('error');
          toast.error(t('detail.analyzeError'));
        }
      } else {
        setAnalysisStep('error');
        toast.error(t('analysis.ocrError'));
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || t('newPratica.error.upload'));
      setFile(null);
      setAnalysisStep('error');
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    setFileUrl(null);
    setAnalysisStep('idle');
    setAnalysisProgress(0);
    setAnalysisResult(null);
  };

  // Handle camera scan - reuse file handling logic
  const handleCameraScan = async (capturedFile: File) => {
    setFile(capturedFile);
    setAnalysisStep('uploading');
    setAnalysisProgress(10);
    
    try {
      // Upload file
      const fileExt = 'jpg';
      const fileName = `${user!.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('pratiche-files')
        .upload(fileName, capturedFile);
      
      if (uploadError) throw uploadError;
      
      setFileUrl(fileName);
      setAnalysisProgress(30);
      toast.success(t('newPratica.fileUploaded'));

      // Run OCR
      setAnalysisStep('extracting');
      setAnalysisProgress(50);
      
      const extractedText = await extractTextFromFile(capturedFile);
      
      if (extractedText && extractedText.trim().length > 0) {
        setFormData(prev => ({ ...prev, letter_text: extractedText }));
        setAnalysisProgress(70);
        
        // Now run AI analysis
        setAnalysisStep('analyzing');
        setAnalysisProgress(80);
        
        const result = await runAnalysis(extractedText);
        
        if (result) {
          setAnalysisResult(result);
          if (result.authority) {
            setFormData(prev => ({ ...prev, authority: result.authority }));
          }
          setAnalysisStep('completed');
          setAnalysisProgress(100);
          toast.success(t('detail.analyzeSuccess'));
        } else {
          setAnalysisStep('error');
          toast.error(t('detail.analyzeError'));
        }
      } else {
        setAnalysisStep('error');
        toast.error(t('analysis.ocrError'));
      }
    } catch (error: any) {
      console.error('Camera scan error:', error);
      toast.error(error.message || t('newPratica.error.upload'));
      setFile(null);
      setAnalysisStep('error');
    }
  };

  const validate = () => {
    try {
      praticaSchema.parse(formData);
      setErrors({});
      return true;
    } catch (err) {
      if (err instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        err.errors.forEach((e) => {
          if (e.path[0]) {
            newErrors[e.path[0] as string] = t(`newPratica.error.${e.message}`);
          }
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) return;
    if (!user) {
      toast.error(t('auth.error.generic'));
      return;
    }

    // Check case limit before creating (frontend guard - backend also enforces)
    if (!entitlements.can_create_case) {
      setShowPaywall(true);
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Use backend edge function for case creation (enforces limits server-side)
      const { data, error } = await supabase.functions.invoke('create-case', {
        body: {
          title: formData.title.trim(),
          authority: formData.authority.trim() || null,
          aktenzeichen: formData.aktenzeichen.trim() || null,
          deadline: formData.deadline || null,
          letter_text: formData.letter_text.trim() || null,
          file_url: fileUrl,
          status: analysisResult ? 'in_progress' : 'new',
          explanation: analysisResult?.explanation || null,
          risks: analysisResult?.risks || null,
          draft_response: analysisResult?.draft_response || null,
        },
      });
      
      if (error) throw new Error(getEdgeFunctionErrorMessage(error, data));
      
      // Check for LIMIT_REACHED error from backend
      if (data?.error === 'LIMIT_REACHED') {
        setShowPaywall(true);
        toast.error(data.message || t('subscription.limitReached'));
        return;
      }
      
      if (data?.error) {
        throw new Error(data.message || data.error);
      }
      
      await refreshEntitlements();
      toast.success(t('newPratica.success'));
      navigate('/dashboard');
    } catch (error: any) {
      console.error('Save error:', error);
      toast.error(error.message || t('newPratica.error.save'));
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ivory">
        <LegalLoader size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir={isRTL ? 'rtl' : 'ltr'}>
      <Header />

      <main className="container py-8">
        <Button 
          variant="ghost" 
          className="mb-6 gap-2"
          onClick={() => navigate('/dashboard')}
        >
          <ArrowLeft className="h-4 w-4" />
          {t('newPratica.back')}
        </Button>

        <Card className="mx-auto max-w-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              {t('newPratica.title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title" className="flex items-center gap-1">
                  {t('newPratica.field.title')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder={t('newPratica.placeholder.title')}
                  className={errors.title ? 'border-destructive' : ''}
                />
                {errors.title && <p className="text-sm text-destructive">{errors.title}</p>}
              </div>

              {/* Authority */}
              <div className="space-y-2">
                <Label htmlFor="authority" className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  {t('newPratica.field.authority')}
                </Label>
                <Input
                  id="authority"
                  value={formData.authority}
                  onChange={(e) => setFormData({ ...formData, authority: e.target.value })}
                  placeholder={t('newPratica.placeholder.authority')}
                />
              </div>

              {/* Aktenzeichen */}
              <div className="space-y-2">
                <Label htmlFor="aktenzeichen" className="flex items-center gap-2">
                  <Hash className="h-4 w-4 text-muted-foreground" />
                  {t('newPratica.field.aktenzeichen')}
                </Label>
                <Input
                  id="aktenzeichen"
                  value={formData.aktenzeichen}
                  onChange={(e) => setFormData({ ...formData, aktenzeichen: e.target.value })}
                  placeholder={t('newPratica.placeholder.aktenzeichen')}
                />
              </div>

              {/* Deadline */}
              <div className="space-y-2">
                <Label htmlFor="deadline" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  {t('newPratica.field.deadline')}
                </Label>
                <Input
                  id="deadline"
                  type="date"
                  value={formData.deadline}
                  onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                />
              </div>

              {/* File Upload */}
              <div className="space-y-4">
                <Label className="flex items-center gap-2">
                  <Upload className="h-4 w-4 text-muted-foreground" />
                  {t('newPratica.field.file')}
                </Label>
                
                {!file ? (
                  <div className="space-y-2">
                    <Input
                      type="file"
                      accept=".pdf,image/jpeg,image/png,image/webp"
                      onChange={handleFileChange}
                      className="cursor-pointer"
                    />
                    <p className="text-xs text-muted-foreground">
                      {t('newPratica.fileHint')}
                    </p>
                  </div>
                ) : (
                  <FilePreview 
                    file={file} 
                    onRemove={handleRemoveFile}
                  />
                )}
                
                {/* Analysis Status */}
                {analysisStep !== 'idle' && (
                  <AnalysisStatus 
                    step={analysisStep} 
                    progress={analysisProgress}
                  />
                )}
              </div>

              {/* Letter Text with Camera Scan */}
              <div className="space-y-4">
                <Label htmlFor="letter_text">
                  {t('newPratica.field.letterText')}
                </Label>
                
                {/* Camera Scan Button - above textarea */}
                {!file && (
                  <CameraScan 
                    onImageCaptured={handleCameraScan}
                    disabled={analysisStep !== 'idle'}
                  />
                )}
                
                <Textarea
                  id="letter_text"
                  value={formData.letter_text}
                  onChange={(e) => setFormData({ ...formData, letter_text: e.target.value })}
                  placeholder={t('newPratica.placeholder.letterText')}
                  rows={8}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  {t('newPratica.letterTextHint')}
                </p>
              </div>

              {/* Analysis Result Preview */}
              {analysisResult && (
                <Card className="border-primary/20 bg-primary/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      {t('analysis.autoAnalysis')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {analysisResult.explanation && (
                      <div>
                        <p className="text-sm font-medium mb-1">{t('detail.analysis')}:</p>
                        <p className="text-sm text-muted-foreground line-clamp-3">
                          {analysisResult.explanation}
                        </p>
                      </div>
                    )}
                    {analysisResult.risks && analysisResult.risks.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-1">{t('detail.risks')}:</p>
                        <ul className="text-sm text-muted-foreground list-disc list-inside">
                          {analysisResult.risks.slice(0, 2).map((risk, i) => (
                            <li key={i} className="truncate">{risk}</li>
                          ))}
                          {analysisResult.risks.length > 2 && (
                            <li className="text-primary">+{analysisResult.risks.length - 2} more...</li>
                          )}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Submit */}
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoading || analysisStep === 'uploading' || analysisStep === 'extracting' || analysisStep === 'analyzing'}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  t('newPratica.save')
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Plan Limit Popup - Non-dismissable */}
        <PlanLimitPopup open={showPaywall} onClose={() => setShowPaywall(false)} />
        
        {/* Blitzer Wizard (German) */}
        <BlitzerWizard 
          open={showBlitzerWizard} 
          onOpenChange={setShowBlitzerWizard}
          praticaId={blitzerPraticaId || undefined}
        />
        
        {/* Autovelox Wizard (Italian) */}
        <AutoveloxWizard 
          open={showAutoveloxWizard} 
          onOpenChange={setShowAutoveloxWizard}
          praticaId={autoveloxPraticaId || undefined}
        />
      </main>
    </div>
  );
}
