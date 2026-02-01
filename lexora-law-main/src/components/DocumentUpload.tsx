import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { invokeExtractText } from '@/lib/invokeExtractText';
import { Camera, Loader2, Upload, FileText, Image as ImageIcon, X, Sparkles, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';
import { DeadlineConflictDialog } from '@/components/DeadlineConflictDialog';

interface DocumentUploadProps {
  praticaId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  onLetterTextUpdate?: (text: string) => void;
}

interface FileUploadItem {
  file: File;
  id: string;
  status: 'queued' | 'uploading' | 'extracting' | 'analyzing' | 'done' | 'error';
  progress: number;
  error?: string;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

export function DocumentUpload({ praticaId, open, onOpenChange, onSuccess, onLetterTextUpdate }: DocumentUploadProps) {
  const { t, language } = useLanguage();
  const { user, hardReset } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [uploading, setUploading] = useState(false);
  const [direction, setDirection] = useState<'incoming' | 'outgoing'>('incoming');
  const [files, setFiles] = useState<FileUploadItem[]>([]);
  const [rawText, setRawText] = useState('');
  
  // Deadline conflict state
  const [showDeadlineConflict, setShowDeadlineConflict] = useState(false);
  const [existingDeadline, setExistingDeadline] = useState<string | null>(null);
  const [pendingNewDeadline, setPendingNewDeadline] = useState<string | null>(null);

  // Reset when dialog closes
  useEffect(() => {
    if (!open) {
      setFiles([]);
      setRawText('');
      setDirection('incoming');
      setUploading(false);
    }
  }, [open]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    const newFiles: FileUploadItem[] = [];
    
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast.error(`${file.name}: ${t('newPratica.error.fileType')}`);
        continue;
      }

      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name}: ${t('documents.fileTooLarge')}`);
        continue;
      }

      newFiles.push({
        file,
        id: `${Date.now()}-${i}-${Math.random().toString(36).substring(7)}`,
        status: 'queued',
        progress: 0,
      });
    }

    setFiles(prev => [...prev, ...newFiles]);
    
    // Reset input so same files can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const updateFileStatus = (id: string, updates: Partial<FileUploadItem>) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const extractTextFromFile = async (fileToExtract: File): Promise<string | null> => {
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('FileReader failed'));
        reader.readAsDataURL(fileToExtract);
      });

      const base64 = dataUrl.split(',')[1];
      if (!base64) return null;

      const result = await invokeExtractText({
        base64,
        mimeType: fileToExtract.type,
        userLanguage: language,
        navigate,
      });

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

  const analyzeDocument = async (text: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('analyze-document', {
        body: { documentText: text, userLanguage: language },
      });

      if (error) {
        console.error('Analysis error:', error);
        return null;
      }

      return data;
    } catch (err) {
      console.error('Failed to analyze document:', err);
      return null;
    }
  };

  // Fetch case context for context-aware analysis
  const getCaseContext = async (): Promise<{
    previousLetterText?: string;
    previousDraft?: string;
    previousExplanation?: string;
    documentsHistory?: string[];
  } | null> => {
    try {
      // Get pratica data
      const { data: pratica } = await supabase
        .from('pratiche')
        .select('letter_text, draft_response, explanation')
        .eq('id', praticaId)
        .single();

      // Get all documents for this case
      const { data: documents } = await supabase
        .from('documents')
        .select('raw_text, file_name, direction, created_at')
        .eq('pratica_id', praticaId)
        .order('created_at', { ascending: true });

      const documentsHistory = documents
        ?.filter(d => d.raw_text)
        .map(d => `[${d.direction === 'incoming' ? 'EMPFANGEN' : 'GESENDET'}] ${d.file_name}:\n${d.raw_text?.substring(0, 500)}...`) || [];

      return {
        previousLetterText: pratica?.letter_text || undefined,
        previousDraft: pratica?.draft_response || undefined,
        previousExplanation: pratica?.explanation || undefined,
        documentsHistory: documentsHistory.length > 0 ? documentsHistory : undefined,
      };
    } catch (err) {
      console.error('Failed to get case context:', err);
      return null;
    }
  };

  const analyzeLetterFull = async (text: string): Promise<{
    explanation?: string;
    risks?: string[];
    draft_response?: string;
  } | null> => {
    try {
      // Fetch case context for multi-doc awareness
      const caseContext = await getCaseContext();
      
      const { data, error } = await supabase.functions.invoke('analyze-letter', {
        body: { 
          letterText: text, 
          userLanguage: language,
          // Pass case context for multi-doc merge
          caseContext: caseContext ? {
            previousLetterText: caseContext.previousLetterText,
            previousDraft: caseContext.previousDraft,
            previousExplanation: caseContext.previousExplanation,
            documentsHistory: caseContext.documentsHistory,
          } : undefined,
        },
      });

      if (error) {
        console.error('Full analysis error:', error);
        return null;
      }

      return data;
    } catch (err) {
      console.error('Failed to analyze letter:', err);
      return null;
    }
  };

  const processFile = async (item: FileUploadItem): Promise<boolean> => {
    if (!user) return false;

    try {
      // Upload
      updateFileStatus(item.id, { status: 'uploading', progress: 20 });
      
      const fileExt = item.file.name.split('.').pop();
      const filePath = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('pratiche-files')
        .upload(filePath, item.file);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        updateFileStatus(item.id, { status: 'error', error: t('newPratica.error.upload') });
        return false;
      }

      updateFileStatus(item.id, { progress: 40 });

      // Extract text
      let extractedText: string | null = null;
      if (item.file.type.startsWith('image/') || item.file.type === 'application/pdf') {
        updateFileStatus(item.id, { status: 'extracting', progress: 50 });
        extractedText = await extractTextFromFile(item.file);
      }

      // Analyze
      updateFileStatus(item.id, { status: 'analyzing', progress: 70 });
      const textToAnalyze = extractedText || '';
      let analysisResult = null;
      
      if (textToAnalyze) {
        analysisResult = await analyzeDocument(textToAnalyze);
      }

      updateFileStatus(item.id, { progress: 90 });

      // Create document record
      const { error: insertError } = await supabase.from('documents').insert({
        pratica_id: praticaId,
        user_id: user.id,
        file_url: filePath,
        file_name: item.file.name,
        mime_type: item.file.type,
        file_size: item.file.size,
        direction,
        document_type: 'letter',
        raw_text: textToAnalyze || null,
        detected_authority: analysisResult?.authority || null,
        detected_aktenzeichen: analysisResult?.aktenzeichen || null,
        detected_date: analysisResult?.documentDate || null,
        detected_deadline: analysisResult?.deadline || null,
        summary: analysisResult?.summary || null,
      });

      if (insertError) {
        console.error('Insert error:', insertError);
        updateFileStatus(item.id, { status: 'error', error: t('newPratica.error.save') });
        return false;
      }

      // Handle deadline conflict
      if (analysisResult?.deadline) {
        const { data: pratica } = await supabase
          .from('pratiche')
          .select('deadline')
          .eq('id', praticaId)
          .single();

        const newDeadlineStr = analysisResult.deadline;
        const existingDeadlineStr = pratica?.deadline;

        if (!existingDeadlineStr) {
          await supabase
            .from('pratiche')
            .update({ deadline: newDeadlineStr, deadline_source: 'ai' })
            .eq('id', praticaId);
        } else if (existingDeadlineStr !== newDeadlineStr) {
          setExistingDeadline(existingDeadlineStr);
          setPendingNewDeadline(newDeadlineStr);
          setShowDeadlineConflict(true);
        }
      }

      updateFileStatus(item.id, { status: 'done', progress: 100 });
      return true;
    } catch (err) {
      console.error('Error processing file:', err);
      updateFileStatus(item.id, { status: 'error', error: t('newPratica.error.save') });
      return false;
    }
  };

  const handleSubmit = async () => {
    if (!user || (files.length === 0 && !rawText.trim())) {
      toast.error(t('documents.noContent'));
      return;
    }

    setUploading(true);

    try {
      // Process files sequentially
      let successCount = 0;
      let firstTextToAnalyze = '';

      for (const item of files) {
        const success = await processFile(item);
        if (success) {
          successCount++;
          // Get text from first successful upload for pratica update
          if (!firstTextToAnalyze && item.status === 'done') {
            const { data } = await supabase
              .from('documents')
              .select('raw_text')
              .eq('pratica_id', praticaId)
              .order('created_at', { ascending: false })
              .limit(1)
              .single();
            if (data?.raw_text) firstTextToAnalyze = data.raw_text;
          }
        }
      }

      // Handle raw text input (if no files, or in addition)
      if (rawText.trim() && direction === 'incoming') {
        const textToAnalyze = rawText.trim();
        
        // Update pratica with letter text
        const updateData: Record<string, any> = {
          letter_text: textToAnalyze,
          status: 'in_progress',
          explanation: null,
          risks: [],
          draft_response: null,
        };

        await supabase
          .from('pratiche')
          .update(updateData)
          .eq('id', praticaId);

        // Run full analysis
        const fullAnalysis = await analyzeLetterFull(textToAnalyze);
        
        if (fullAnalysis) {
          const fullUpdateData: Record<string, any> = {};
          if (fullAnalysis.explanation) fullUpdateData.explanation = fullAnalysis.explanation;
          if (fullAnalysis.risks) fullUpdateData.risks = fullAnalysis.risks;
          if (fullAnalysis.draft_response) fullUpdateData.draft_response = fullAnalysis.draft_response;
          
          if (Object.keys(fullUpdateData).length > 0) {
            await supabase
              .from('pratiche')
              .update(fullUpdateData)
              .eq('id', praticaId);
          }
        }

        if (onLetterTextUpdate) {
          onLetterTextUpdate(textToAnalyze);
        }
      }

      // Update pratica letter_text with first document text if incoming AND run full analysis
      if (direction === 'incoming' && firstTextToAnalyze) {
        // First, clear old AI outputs and set letter_text
        await supabase
          .from('pratiche')
          .update({ 
            letter_text: firstTextToAnalyze,
            status: 'in_progress',
            explanation: null,
            risks: [],
            draft_response: null,
          })
          .eq('id', praticaId);

        if (onLetterTextUpdate) {
          onLetterTextUpdate(firstTextToAnalyze);
        }

        // Run full AI analysis (explanation, risks, draft)
        console.log('[DOC_UPLOAD] Running full AI analysis for incoming document...');
        const fullAnalysis = await analyzeLetterFull(firstTextToAnalyze);
        
        if (fullAnalysis) {
          const fullUpdateData: Record<string, any> = {};
          if (fullAnalysis.explanation) fullUpdateData.explanation = fullAnalysis.explanation;
          if (fullAnalysis.risks) fullUpdateData.risks = fullAnalysis.risks;
          if (fullAnalysis.draft_response) fullUpdateData.draft_response = fullAnalysis.draft_response;
          
          if (Object.keys(fullUpdateData).length > 0) {
            console.log('[DOC_UPLOAD] Updating pratica with full analysis results');
            await supabase
              .from('pratiche')
              .update(fullUpdateData)
              .eq('id', praticaId);
          }
        }
      }

      const total = files.length + (rawText.trim() ? 1 : 0);
      if (successCount > 0 || rawText.trim()) {
        toast.success(t('documents.uploadSuccess'));
        setTimeout(() => {
          onSuccess();
          onOpenChange(false);
        }, 500);
      } else {
        toast.error(t('newPratica.error.save'));
      }

    } catch (err) {
      console.error('Unexpected error:', err);
      toast.error(t('newPratica.error.save'));
    } finally {
      setUploading(false);
    }
  };

  const getStatusIcon = (status: FileUploadItem['status']) => {
    switch (status) {
      case 'done':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      case 'queued':
        return <FileText className="h-4 w-4 text-muted-foreground" />;
      default:
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
    }
  };

  const getStatusLabel = (status: FileUploadItem['status']) => {
    switch (status) {
      case 'queued': return t('documents.queued') || 'Queued';
      case 'uploading': return t('analysis.uploading');
      case 'extracting': return t('analysis.extracting');
      case 'analyzing': return t('analysis.analyzing');
      case 'done': return t('analysis.completed');
      case 'error': return t('analysis.error');
      default: return '';
    }
  };

  const overallProgress = files.length > 0 
    ? Math.round(files.reduce((sum, f) => sum + f.progress, 0) / files.length)
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90dvh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0">
          <DialogTitle>{t('documents.addNew')}</DialogTitle>
          <DialogDescription>{t('documents.addNewDesc')}</DialogDescription>
        </DialogHeader>

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-4">
          {/* Direction selection */}
          <div className="space-y-2">
            <Label>{t('documents.direction')}</Label>
            <RadioGroup
              value={direction}
              onValueChange={(v) => setDirection(v as 'incoming' | 'outgoing')}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="incoming" id="incoming" />
                <Label htmlFor="incoming" className="font-normal">
                  {t('documents.incoming')}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="outgoing" id="outgoing" />
                <Label htmlFor="outgoing" className="font-normal">
                  {t('documents.outgoing')}
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* File upload - MULTIPLE */}
          <div className="space-y-2">
            <Label>{t('newPratica.field.file')}</Label>
            <div className="flex gap-2">
              <Input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={handleFileChange}
                className="hidden"
                multiple
              />
              <Button
                type="button"
                variant="outline"
                className="flex-1 gap-2"
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.removeAttribute('capture');
                    fileInputRef.current.click();
                  }
                }}
                disabled={uploading}
              >
                <Upload className="h-4 w-4" />
                {files.length > 0 
                  ? `${files.length} ${t('documents.title').toLowerCase()}`
                  : t('documents.selectFile')
                }
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.setAttribute('capture', 'environment');
                    fileInputRef.current.click();
                  }
                }}
                disabled={uploading}
              >
                <Camera className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{t('newPratica.fileHint')} • {t('documents.multiSelectHint') || 'Multiple files allowed'}</p>
          </div>

          {/* File List with Thumbnails and Status */}
          {files.length > 0 && (
            <div className="space-y-2">
              <Label>{t('documents.title')} ({files.length})</Label>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {files.map((item) => (
                  <div 
                    key={item.id} 
                    className="relative rounded-lg border bg-muted/50 p-2 flex items-center gap-2"
                  >
                    {/* Thumbnail */}
                    <div className="w-10 h-10 flex-shrink-0 rounded bg-background flex items-center justify-center overflow-hidden">
                      {item.file.type.startsWith('image/') ? (
                        <img 
                          src={URL.createObjectURL(item.file)} 
                          alt={item.file.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <FileText className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    
                    {/* File info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{item.file.name}</p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        {getStatusIcon(item.status)}
                        <span>{getStatusLabel(item.status)}</span>
                      </div>
                      {uploading && item.status !== 'queued' && item.status !== 'done' && item.status !== 'error' && (
                        <Progress value={item.progress} className="h-1 mt-1" />
                      )}
                    </div>
                    
                    {/* Remove button - only when not uploading */}
                    {!uploading && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute -right-1 -top-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground"
                        onClick={() => removeFile(item.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Raw text input */}
          <div className="space-y-2">
            <Label>{t('newPratica.field.letterText')}</Label>
            <Textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder={t('newPratica.placeholder.letterText')}
              rows={4}
              disabled={uploading}
            />
            <p className="text-xs text-muted-foreground">{t('newPratica.letterTextHint')}</p>
          </div>

          {/* Overall Progress */}
          {uploading && files.length > 0 && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center gap-3 text-primary">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="font-medium">
                  {t('documents.processingMultiple') || `Processing ${files.length} documents...`}
                </span>
              </div>
              <Progress value={overallProgress} className="h-2" />
            </div>
          )}
        </div>

        {/* Sticky footer with buttons */}
        <div className="flex-shrink-0 border-t bg-background px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={uploading}
              className="flex-1"
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={uploading || (files.length === 0 && !rawText.trim())}
              className="flex-1 gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('documents.uploading') || 'Uploading...'}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  {t('documents.uploadAndAnalyze')}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>

      {/* Deadline Conflict Dialog */}
      <DeadlineConflictDialog
        open={showDeadlineConflict}
        onOpenChange={setShowDeadlineConflict}
        existingDeadline={existingDeadline || ''}
        newDeadline={pendingNewDeadline || ''}
        onUpdate={async () => {
          if (pendingNewDeadline) {
            await supabase
              .from('pratiche')
              .update({ 
                deadline: pendingNewDeadline, 
                deadline_source: 'ai',
              })
              .eq('id', praticaId);
            toast.success(t('documents.deadlineUpdated'));
          }
          setShowDeadlineConflict(false);
          setPendingNewDeadline(null);
          setExistingDeadline(null);
        }}
        onKeep={() => {
          setShowDeadlineConflict(false);
          setPendingNewDeadline(null);
          setExistingDeadline(null);
        }}
      />
    </Dialog>
  );
}
