import { useState, useRef, useEffect } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Camera, CheckCircle, HelpCircle, Loader2, Plus, Upload } from 'lucide-react';
import { LegalLoader } from '@/components/LegalLoader';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { DeadlineConflictDialog } from '@/components/DeadlineConflictDialog';

interface GlobalUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface MatchedPratica {
  id: string;
  title: string;
  authority: string | null;
  aktenzeichen: string | null;
  score: number;
  matchType: 'exact' | 'authority' | 'none';
}

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

export function GlobalUploadDialog({ open, onOpenChange, onSuccess }: GlobalUploadDialogProps) {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<'upload' | 'matching' | 'select'>('upload');
  const [uploading, setUploading] = useState(false);
  const [direction, setDirection] = useState<'incoming' | 'outgoing'>('incoming');
  const [file, setFile] = useState<File | null>(null);
  const [rawText, setRawText] = useState('');
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [matchedPratiche, setMatchedPratiche] = useState<MatchedPratica[]>([]);
  const [selectedPraticaId, setSelectedPraticaId] = useState<string>('');
  const [createNew, setCreateNew] = useState(false);
  
  // Deadline conflict state
  const [showDeadlineConflict, setShowDeadlineConflict] = useState(false);
  const [existingDeadline, setExistingDeadline] = useState<string | null>(null);
  const [pendingNewDeadline, setPendingNewDeadline] = useState<string | null>(null);
  const [pendingPraticaId, setPendingPraticaId] = useState<string | null>(null);

  // Reset when dialog closes
  useEffect(() => {
    if (!open) {
      setStep('upload');
      setFile(null);
      setRawText('');
      setAnalysisResult(null);
      setMatchedPratiche([]);
      setSelectedPraticaId('');
      setCreateNew(false);
    }
  }, [open]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!ALLOWED_TYPES.includes(selectedFile.type)) {
      toast.error(t('newPratica.error.fileType'));
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      toast.error(t('documents.fileTooLarge'));
      return;
    }

    setFile(selectedFile);
  };

  const analyzeAndMatch = async () => {
    if (!user || (!file && !rawText.trim())) {
      toast.error(t('documents.noContent'));
      return;
    }

    setUploading(true);
    setStep('matching');

    try {
      const textToAnalyze = rawText.trim();
      let analysis = null;

      // Analyze the document
      if (textToAnalyze) {
        const { data, error } = await supabase.functions.invoke('analyze-document', {
          body: { documentText: textToAnalyze, userLanguage: language },
        });

        if (!error && data) {
          analysis = data;
          setAnalysisResult(data);
        }
      }

      // Fetch user's pratiche for matching
      const { data: pratiche } = await supabase
        .from('pratiche')
        .select('id, title, authority, aktenzeichen, created_at')
        .order('created_at', { ascending: false });

      if (!pratiche || pratiche.length === 0) {
        // No existing pratiche, will create new
        setCreateNew(true);
        await saveDocument(null, analysis);
        return;
      }

      // Match algorithm
      const matches: MatchedPratica[] = [];
      const now = new Date();
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

      for (const pratica of pratiche) {
        let score = 0;
        let matchType: 'exact' | 'authority' | 'none' = 'none';

        // Priority 1: Aktenzeichen match
        if (analysis?.aktenzeichen && pratica.aktenzeichen) {
          const normalizedDetected = analysis.aktenzeichen.replace(/[\s-]/g, '').toLowerCase();
          const normalizedPratica = pratica.aktenzeichen.replace(/[\s-]/g, '').toLowerCase();
          
          if (normalizedDetected === normalizedPratica || 
              normalizedDetected.includes(normalizedPratica) ||
              normalizedPratica.includes(normalizedDetected)) {
            score = 100;
            matchType = 'exact';
          }
        }

        // Priority 2: Authority match with recency
        if (matchType === 'none' && analysis?.authority && pratica.authority) {
          const normalizedDetected = analysis.authority.toLowerCase();
          const normalizedPratica = pratica.authority.toLowerCase();
          
          if (normalizedDetected.includes(normalizedPratica) || 
              normalizedPratica.includes(normalizedDetected)) {
            const praticaDate = new Date(pratica.created_at);
            if (praticaDate >= ninetyDaysAgo) {
              score = 70;
              matchType = 'authority';
            } else {
              score = 30;
              matchType = 'authority';
            }
          }
        }

        if (score > 0) {
          matches.push({
            id: pratica.id,
            title: pratica.title,
            authority: pratica.authority,
            aktenzeichen: pratica.aktenzeichen,
            score,
            matchType,
          });
        }
      }

      // Sort by score descending
      matches.sort((a, b) => b.score - a.score);
      setMatchedPratiche(matches);

      // Decision logic
      if (matches.length === 1 && matches[0].matchType === 'exact') {
        // Exact match, save directly
        await saveDocument(matches[0].id, analysis);
      } else if (matches.length > 0) {
        // Multiple or uncertain matches, show selection
        setStep('select');
        setSelectedPraticaId(matches[0].id);
      } else {
        // No matches, create new pratica
        setCreateNew(true);
        await saveDocument(null, analysis);
      }

    } catch (err) {
      console.error('Error during analysis:', err);
      toast.error(t('pratica.detail.analyzeError'));
      setStep('upload');
    } finally {
      setUploading(false);
    }
  };

  const saveDocument = async (praticaId: string | null, analysis: any) => {
    if (!user) return;

    setUploading(true);

    try {
      let fileUrl: string | null = null;
      let fileName: string | null = null;
      let mimeType: string | null = null;

      // Upload file if provided
      if (file) {
        const fileExt = file.name.split('.').pop();
        const filePath = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('pratiche-files')
          .upload(filePath, file);

        if (uploadError) {
          throw uploadError;
        }

        // Use signed URL for private bucket (1 hour expiry)
        const { data: urlData, error: signedUrlError } = await supabase.storage
          .from('pratiche-files')
          .createSignedUrl(filePath, 3600);
        
        if (signedUrlError || !urlData?.signedUrl) {
          console.error('Signed URL error:', signedUrlError);
          throw new Error('Failed to generate file URL');
        }
        fileUrl = urlData.signedUrl;
        fileName = file.name;
        mimeType = file.type;
      }

      let targetPraticaId = praticaId;

      // Create new pratica if needed
      if (!targetPraticaId) {
        const newTitle = analysis?.authority 
          ? `${analysis.authority}${analysis.aktenzeichen ? ` - ${analysis.aktenzeichen}` : ''}`
          : t('documents.newPraticaTitle');

        const { data: newPratica, error: createError } = await supabase
          .from('pratiche')
          .insert({
            user_id: user.id,
            title: newTitle,
            authority: analysis?.authority || null,
            aktenzeichen: analysis?.aktenzeichen || null,
            deadline: analysis?.deadline || null,
            status: 'new',
            letter_text: rawText.trim() || null,
          })
          .select()
          .single();

        if (createError) throw createError;
        targetPraticaId = newPratica.id;
      }

      // Create document record
      const { error: insertError } = await supabase.from('documents').insert({
        pratica_id: targetPraticaId,
        user_id: user.id,
        file_url: fileUrl,
        file_name: fileName,
        mime_type: mimeType,
        direction,
        raw_text: rawText.trim() || null,
        detected_authority: analysis?.authority || null,
        detected_aktenzeichen: analysis?.aktenzeichen || null,
        detected_date: analysis?.documentDate || null,
        detected_deadline: analysis?.deadline || null,
        summary: analysis?.summary || null,
      });

      if (insertError) throw insertError;

      // Update pratica deadline if detected
      if (analysis?.deadline && targetPraticaId) {
        const { data: pratica } = await supabase
          .from('pratiche')
          .select('deadline')
          .eq('id', targetPraticaId)
          .single();

        const newDeadlineStr = analysis.deadline;
        const existingDeadlineStr = pratica?.deadline;

        if (!existingDeadlineStr) {
          // No existing deadline, set the new one
          await supabase
            .from('pratiche')
            .update({ 
              deadline: newDeadlineStr, 
              deadline_source: 'ai',
              status: 'in_progress' 
            })
            .eq('id', targetPraticaId);
        } else if (existingDeadlineStr !== newDeadlineStr) {
          // Different deadline detected - show conflict dialog
          setExistingDeadline(existingDeadlineStr);
          setPendingNewDeadline(newDeadlineStr);
          setPendingPraticaId(targetPraticaId);
          setShowDeadlineConflict(true);
        }
      }

      toast.success(t('documents.uploadSuccess'));
      onOpenChange(false);
      onSuccess?.();

      // Navigate to the pratica
      if (targetPraticaId) {
        navigate(`/pratiche/${targetPraticaId}`);
      }

    } catch (err) {
      console.error('Error saving document:', err);
      toast.error(t('newPratica.error.save'));
    } finally {
      setUploading(false);
    }
  };

  const handleConfirmSelection = async () => {
    if (createNew) {
      await saveDocument(null, analysisResult);
    } else if (selectedPraticaId) {
      await saveDocument(selectedPraticaId, analysisResult);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('documents.uploadGlobal')}</DialogTitle>
          <DialogDescription>
            {step === 'upload' && t('documents.uploadGlobalDesc')}
            {step === 'matching' && t('documents.matching')}
            {step === 'select' && t('documents.selectPratica')}
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            {/* Direction selection */}
            <div className="space-y-2">
              <Label>{t('documents.direction')}</Label>
              <RadioGroup
                value={direction}
                onValueChange={(v) => setDirection(v as 'incoming' | 'outgoing')}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="incoming" id="g-incoming" />
                  <Label htmlFor="g-incoming" className="font-normal">
                    {t('documents.incoming')}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="outgoing" id="g-outgoing" />
                  <Label htmlFor="g-outgoing" className="font-normal">
                    {t('documents.outgoing')}
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* File upload */}
            <div className="space-y-2">
              <Label>{t('newPratica.field.file')}</Label>
              <div className="flex gap-2">
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={handleFileChange}
                  className="hidden"
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
                >
                  <Upload className="h-4 w-4" />
                  {file ? file.name : t('documents.selectFile')}
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
                >
                  <Camera className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">{t('newPratica.fileHint')}</p>
            </div>

            {/* Raw text input */}
            <div className="space-y-2">
              <Label>{t('newPratica.field.letterText')}</Label>
              <Textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder={t('newPratica.placeholder.letterText')}
                rows={6}
              />
              <p className="text-xs text-muted-foreground">{t('newPratica.letterTextHint')}</p>
            </div>

            {/* Submit button */}
            <Button
              onClick={analyzeAndMatch}
              disabled={uploading || (!file && !rawText.trim())}
              className="w-full gap-2"
            >
              <Upload className="h-4 w-4" />
              {t('documents.analyzeAndSave')}
            </Button>
          </div>
        )}

        {step === 'matching' && (
          <div className="flex flex-col items-center justify-center py-8">
            <LegalLoader size="md" />
          </div>
        )}

        {step === 'select' && (
          <div className="space-y-4">
            {analysisResult && (
              <Card className="bg-muted/50">
                <CardContent className="p-4">
                  <p className="text-sm font-medium">{t('documents.detected')}:</p>
                  {analysisResult.authority && (
                    <p className="text-sm text-muted-foreground">
                      {t('newPratica.field.authority')}: {analysisResult.authority}
                    </p>
                  )}
                  {analysisResult.aktenzeichen && (
                    <p className="text-sm text-muted-foreground">
                      {t('newPratica.field.aktenzeichen')}: {analysisResult.aktenzeichen}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            <div className="space-y-2">
              <Label>{t('documents.selectWhere')}</Label>
              
              {matchedPratiche.map((pratica) => (
                <Card
                  key={pratica.id}
                  className={`cursor-pointer transition-colors ${
                    selectedPraticaId === pratica.id && !createNew
                      ? 'border-primary bg-primary/5'
                      : 'hover:bg-muted/50'
                  }`}
                  onClick={() => {
                    setSelectedPraticaId(pratica.id);
                    setCreateNew(false);
                  }}
                >
                  <CardContent className="flex items-center gap-3 p-3">
                    {selectedPraticaId === pratica.id && !createNew ? (
                      <CheckCircle className="h-5 w-5 text-primary" />
                    ) : (
                      <HelpCircle className="h-5 w-5 text-muted-foreground" />
                    )}
                    <div className="flex-1">
                      <p className="font-medium">{pratica.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {pratica.authority}
                        {pratica.aktenzeichen && ` • ${pratica.aktenzeichen}`}
                      </p>
                    </div>
                    {pratica.matchType === 'exact' && (
                      <span className="text-xs text-success">{t('documents.exactMatch')}</span>
                    )}
                  </CardContent>
                </Card>
              ))}

              <Card
                className={`cursor-pointer transition-colors ${
                  createNew ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                }`}
                onClick={() => {
                  setCreateNew(true);
                  setSelectedPraticaId('');
                }}
              >
                <CardContent className="flex items-center gap-3 p-3">
                  {createNew ? (
                    <CheckCircle className="h-5 w-5 text-primary" />
                  ) : (
                    <Plus className="h-5 w-5 text-muted-foreground" />
                  )}
                  <p className="font-medium">{t('documents.createNewPratica')}</p>
                </CardContent>
              </Card>
            </div>

            <Button
              onClick={handleConfirmSelection}
              disabled={uploading || (!selectedPraticaId && !createNew)}
              className="w-full gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('documents.saving')}
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  {t('documents.confirm')}
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>

      {/* Deadline Conflict Dialog */}
      <DeadlineConflictDialog
        open={showDeadlineConflict}
        onOpenChange={setShowDeadlineConflict}
        existingDeadline={existingDeadline || ''}
        newDeadline={pendingNewDeadline || ''}
        onUpdate={async () => {
          if (pendingNewDeadline && pendingPraticaId) {
            await supabase
              .from('pratiche')
              .update({ 
                deadline: pendingNewDeadline, 
                deadline_source: 'ai',
              })
              .eq('id', pendingPraticaId);
            toast.success(t('documents.deadlineUpdated'));
          }
          setShowDeadlineConflict(false);
          setPendingNewDeadline(null);
          setExistingDeadline(null);
          setPendingPraticaId(null);
        }}
        onKeep={() => {
          setShowDeadlineConflict(false);
          setPendingNewDeadline(null);
          setExistingDeadline(null);
          setPendingPraticaId(null);
        }}
      />
    </Dialog>
  );
}
