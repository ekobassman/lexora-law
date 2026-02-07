import { useState, useEffect, useRef } from 'react';
import { useScrollRestoration } from '@/hooks/useScrollRestoration';
import { useNavigate, useParams } from 'react-router-dom';
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
import { DraftActions } from '@/components/DraftActions';
import { ScrollableContentBox } from '@/components/ScrollableContentBox';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { invokeExtractText } from '@/lib/invokeExtractText';
import { toast } from 'sonner';
import { Loader2, Upload, ArrowLeft, CalendarPlus, FileText, Building2, Hash, Sparkles, FileCheck, Trash2, AlertTriangle, Check } from 'lucide-react';
import { ChatWithAI } from '@/components/ChatWithAI';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { format, parseISO, differenceInDays, isPast, isToday } from 'date-fns';
import { de, enUS, it, fr, es, pl, ro, tr, ru, uk, ar } from 'date-fns/locale';
import { createPraticaDeadlineEvent, downloadICSFile } from '@/lib/icsGenerator';
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

const praticaSchema = z.object({
  title: z.string().min(1, 'required').max(200),
  authority: z.string().max(200).optional(),
  aktenzeichen: z.string().max(100).optional(),
  deadline: z.string().optional(),
  letter_text: z.string().max(50000).optional(),
});

// Translations for the deadline calendar section
const deadlineTranslations = {
  DE: {
    label: 'Frist für diesen Vorgang',
    subtitle: 'Die Frist wird automatisch zu deinem Kalender hinzugefügt',
    setDeadline: 'Frist setzen',
    today: 'Heute',
    overdue: 'Überfällig',
    daysRemaining: 'Tage verbleibend',
    calendarAdded: 'Kalendereintrag erstellt',
    saved: 'Frist gespeichert',
  },
  EN: {
    label: 'Deadline for this case',
    subtitle: 'The deadline will be automatically added to your calendar',
    setDeadline: 'Set deadline',
    today: 'Today',
    overdue: 'Overdue',
    daysRemaining: 'days remaining',
    calendarAdded: 'Calendar event created',
    saved: 'Deadline saved',
  },
  IT: {
    label: 'Scadenza procedimento',
    subtitle: 'La scadenza verrà aggiunta automaticamente al tuo calendario',
    setDeadline: 'Imposta scadenza',
    today: 'Oggi',
    overdue: 'Scaduto',
    daysRemaining: 'giorni rimanenti',
    calendarAdded: 'Evento calendario creato',
    saved: 'Scadenza salvata',
  },
  FR: {
    label: 'Échéance de la procédure',
    subtitle: "L'échéance sera automatiquement ajoutée à votre calendrier",
    setDeadline: "Définir l'échéance",
    today: "Aujourd'hui",
    overdue: 'En retard',
    daysRemaining: 'jours restants',
    calendarAdded: 'Événement calendrier créé',
    saved: 'Échéance enregistrée',
  },
  ES: {
    label: 'Fecha límite del procedimiento',
    subtitle: 'La fecha límite se agregará automáticamente a tu calendario',
    setDeadline: 'Establecer fecha límite',
    today: 'Hoy',
    overdue: 'Vencido',
    daysRemaining: 'días restantes',
    calendarAdded: 'Evento de calendario creado',
    saved: 'Fecha límite guardada',
  },
  PL: {
    label: 'Termin sprawy',
    subtitle: 'Termin zostanie automatycznie dodany do kalendarza',
    setDeadline: 'Ustaw termin',
    today: 'Dzisiaj',
    overdue: 'Przeterminowane',
    daysRemaining: 'dni pozostało',
    calendarAdded: 'Wydarzenie kalendarza utworzone',
    saved: 'Termin zapisany',
  },
  RO: {
    label: 'Termenul procedurii',
    subtitle: 'Termenul va fi adăugat automat în calendar',
    setDeadline: 'Setează termenul',
    today: 'Astăzi',
    overdue: 'Întârziat',
    daysRemaining: 'zile rămase',
    calendarAdded: 'Eveniment calendar creat',
    saved: 'Termen salvat',
  },
  TR: {
    label: 'İşlem son tarihi',
    subtitle: 'Son tarih otomatik olarak takviminize eklenecektir',
    setDeadline: 'Son tarihi belirle',
    today: 'Bugün',
    overdue: 'Gecikmiş',
    daysRemaining: 'gün kaldı',
    calendarAdded: 'Takvim etkinliği oluşturuldu',
    saved: 'Son tarih kaydedildi',
  },
  RU: {
    label: 'Срок по делу',
    subtitle: 'Срок будет автоматически добавлен в календарь',
    setDeadline: 'Установить срок',
    today: 'Сегодня',
    overdue: 'Просрочено',
    daysRemaining: 'дней осталось',
    calendarAdded: 'Событие календаря создано',
    saved: 'Срок сохранён',
  },
  UK: {
    label: 'Термін справи',
    subtitle: 'Термін буде автоматично додано до календаря',
    setDeadline: 'Встановити термін',
    today: 'Сьогодні',
    overdue: 'Прострочено',
    daysRemaining: 'днів залишилось',
    calendarAdded: 'Подію календаря створено',
    saved: 'Термін збережено',
  },
  AR: {
    label: 'الموعد النهائي للقضية',
    subtitle: 'سيتم إضافة الموعد النهائي تلقائيًا إلى التقويم',
    setDeadline: 'تحديد الموعد النهائي',
    today: 'اليوم',
    overdue: 'متأخر',
    daysRemaining: 'أيام متبقية',
    calendarAdded: 'تم إنشاء حدث التقويم',
    saved: 'تم حفظ الموعد النهائي',
  },
};

const getDateLocale = (lang: string) => {
  const localeMap: Record<string, typeof de> = { de, en: enUS, it, fr, es, pl, ro, tr, ru, uk, ar };
  return localeMap[lang.toLowerCase()] || de;
};

interface DeadlineCalendarSectionProps {
  praticaId: string;
  deadline: string;
  title: string;
  onDeadlineChange: (deadline: string) => void;
  language: string;
  t: (key: string, options?: Record<string, unknown>) => string;
}

function DeadlineCalendarSection({ 
  praticaId, 
  deadline, 
  title, 
  onDeadlineChange, 
  language, 
  t 
}: DeadlineCalendarSectionProps) {
  const dateInputRef = useRef<HTMLInputElement>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const langKey = language.toUpperCase() as keyof typeof deadlineTranslations;
  const trans = deadlineTranslations[langKey] || deadlineTranslations.DE;
  const dateLocale = getDateLocale(language);

  const handleButtonClick = () => {
    dateInputRef.current?.showPicker?.();
    dateInputRef.current?.click();
  };

  const getDeadlineStatus = () => {
    if (!deadline) return null;
    const deadlineDate = parseISO(deadline);
    if (isToday(deadlineDate)) return { text: trans.today, urgent: false, variant: 'secondary' as const };
    if (isPast(deadlineDate)) return { text: trans.overdue, urgent: true, variant: 'destructive' as const };
    const days = differenceInDays(deadlineDate, new Date());
    return { 
      text: `${days} ${trans.daysRemaining}`, 
      urgent: days <= 3, 
      variant: days <= 3 ? 'warning' as const : 'secondary' as const 
    };
  };

  const handleDateChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDeadline = e.target.value;
    if (!newDeadline) return;
    
    setIsSaving(true);
    try {
      // Update local state immediately
      onDeadlineChange(newDeadline);
      
      // Save to database
      const { error } = await supabase
        .from('pratiche')
        .update({
          deadline: newDeadline,
          deadline_source: 'manual',
          reminders: [{ type: 'days', value: 3 }, { type: 'days', value: 1 }],
        })
        .eq('id', praticaId);

      if (error) throw error;

      // Generate and download ICS file for calendar
      const deadlineDate = new Date(newDeadline);
      deadlineDate.setHours(9, 0, 0, 0); // Set to 9 AM
      
      const praticaUrl = `${window.location.origin}/pratiche/${praticaId}`;
      const calendarEvent = createPraticaDeadlineEvent(
        title || t('newPratica.field.deadline'),
        null, // authority
        null, // aktenzeichen
        deadlineDate,
        praticaUrl,
        [{ type: 'days', value: 3 }, { type: 'days', value: 1 }],
        language
      );
      downloadICSFile(calendarEvent, `deadline-${praticaId.slice(0, 8)}.ics`);

      toast.success(trans.saved, {
        description: trans.calendarAdded,
        icon: <Check className="h-4 w-4" />,
      });
    } catch (error) {
      console.error('Error saving deadline:', error);
      toast.error(t('detail.saveError'));
    } finally {
      setIsSaving(false);
    }
  };

  const status = deadline ? getDeadlineStatus() : null;

  return (
    <Card className="mx-auto max-w-2xl mb-6">
      <CardContent className="pt-6">
        {/* Hidden native date input */}
        <input
          ref={dateInputRef}
          type="date"
          value={deadline}
          onChange={handleDateChange}
          className="sr-only"
          aria-hidden="true"
        />
        
        {/* Clickable Calendar Button */}
        <button
          type="button"
          onClick={handleButtonClick}
          disabled={isSaving}
          className="w-full flex items-center gap-4 p-4 rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/50 transition-all duration-200 text-left group focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
            {isSaving ? (
              <Loader2 className="h-6 w-6 text-primary animate-spin" />
            ) : (
              <CalendarPlus className="h-6 w-6 text-primary" />
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            {deadline ? (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-lg font-semibold text-foreground">
                    {format(parseISO(deadline), 'dd. MMMM yyyy', { locale: dateLocale })}
                  </span>
                  {status && (
                    <Badge variant={status.variant}>{status.text}</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {trans.label}
                </p>
              </>
            ) : (
              <>
                <span className="text-base font-medium text-foreground">
                  {trans.label}
                </span>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {trans.subtitle}
                </p>
              </>
            )}
          </div>
          
          {deadline && (
            <div className="flex-shrink-0">
              <Check className="h-5 w-5 text-green" />
            </div>
          )}
        </button>
      </CardContent>
    </Card>
  );
}

export default function EditPratica() {
  const { id } = useParams<{ id: string }>();
  const { t, isRTL, language } = useLanguage();
  const { user, loading: authLoading, hardReset } = useAuth();
  const navigate = useNavigate();
  
  // Persist scroll position when navigating away (e.g., to generate PDF/email)
  useScrollRestoration(`edit-${id}`);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [analysisStep, setAnalysisStep] = useState<AnalysisStep>('idle');
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [formData, setFormData] = useState({
    title: '',
    authority: '',
    aktenzeichen: '',
    deadline: '',
    letter_text: '',
  });
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [existingFileUrl, setExistingFileUrl] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [analysisResult, setAnalysisResult] = useState<{
    explanation?: string;
    risks?: string[];
    draft_response?: string;
  } | null>(null);
  const [hasExistingAnalysis, setHasExistingAnalysis] = useState(false);
  const [existingDraft, setExistingDraft] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [praticaData, setPraticaData] = useState<{
    title: string;
    authority: string | null;
    aktenzeichen: string | null;
    deadline: string | null;
    sender_name: string | null;
    sender_address: string | null;
    sender_postal_code: string | null;
    sender_city: string | null;
    sender_country: string | null;
    sender_date: string | null;
  } | null>(null);
  const [chatHistory, setChatHistory] = useState<Array<{role: 'user' | 'assistant'; content: string; created_at: string;}>>([]);
  const [proposedDraft, setProposedDraft] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && id) {
      fetchPratica();
    }
  }, [user, id]);

  const fetchPratica = async () => {
    setIsFetching(true);
    const { data, error } = await supabase
      .from('pratiche')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) {
      toast.error(t('detail.loadError'));
      navigate('/dashboard');
    } else {
      setFormData({
        title: data.title || '',
        authority: data.authority || '',
        aktenzeichen: data.aktenzeichen || '',
        deadline: data.deadline || '',
        letter_text: data.letter_text || '',
      });
      setExistingFileUrl(data.file_url);
      setFileUrl(data.file_url);
      setHasExistingAnalysis(!!data.explanation);
      setExistingDraft(data.draft_response || null);
      setPraticaData({
        title: data.title || '',
        authority: data.authority || null,
        aktenzeichen: data.aktenzeichen || null,
        deadline: data.deadline || null,
        sender_name: data.sender_name || null,
        sender_address: data.sender_address || null,
        sender_postal_code: data.sender_postal_code || null,
        sender_city: data.sender_city || null,
        sender_country: data.sender_country || null,
        sender_date: data.sender_date || null,
      });
      // Load chat history for modify mode
      setChatHistory(Array.isArray(data.chat_history) ? (data.chat_history as unknown as Array<{role: 'user' | 'assistant'; content: string; created_at: string;}>) : []);
      if (data.explanation || data.risks || data.draft_response) {
        setAnalysisResult({
          explanation: data.explanation,
          risks: data.risks as string[] || [],
          draft_response: data.draft_response,
        });
      }
    }
    setIsFetching(false);
  };

  const handleDelete = async () => {
    if (!user || !id) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('pratiche')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      toast.success(t('detail.deleteSuccess'));
      navigate('/dashboard');
    } catch (error: any) {
      console.error('Delete error:', error);
      toast.error(error.message || t('detail.deleteError'));
    } finally {
      setIsDeleting(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
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
    
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(selectedFile.type)) {
      toast.error(t('newPratica.error.fileType'));
      return;
    }
    
    if (selectedFile.size > 10 * 1024 * 1024) {
      toast.error(t('newPratica.error.fileSize'));
      return;
    }
    
    setFile(selectedFile);
    setAnalysisStep('uploading');
    setAnalysisProgress(10);
    
    try {
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
        
        setAnalysisStep('analyzing');
        setAnalysisProgress(80);
        
        const result = await runAnalysis(extractedText);
        
        if (result) {
          setAnalysisResult(result);
          if (result.authority && !formData.authority) {
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
    setFileUrl(existingFileUrl);
    setAnalysisStep('idle');
    setAnalysisProgress(0);
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
          if (result.authority && !formData.authority) {
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
    if (!user || !id) {
      toast.error(t('auth.error.generic'));
      return;
    }
    
    setIsLoading(true);
    
    try {
      const updateData: any = {
        title: formData.title.trim(),
        authority: formData.authority.trim() || null,
        aktenzeichen: formData.aktenzeichen.trim() || null,
        deadline: formData.deadline || null,
        letter_text: formData.letter_text.trim() || null,
        file_url: fileUrl,
      };

      // Only update analysis if we have new results
      if (analysisResult && !hasExistingAnalysis) {
        updateData.explanation = analysisResult.explanation || null;
        updateData.risks = analysisResult.risks || null;
        updateData.draft_response = analysisResult.draft_response || null;
        updateData.status = 'in_progress';
      }

      const { error } = await supabase
        .from('pratiche')
        .update(updateData)
        .eq('id', id);
      
      if (error) throw error;
      
      toast.success(t('editPratica.success'));
      navigate(`/pratiche/${id}`);
    } catch (error: any) {
      console.error('Save error:', error);
      toast.error(error.message || t('newPratica.error.save'));
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading || isFetching) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
          onClick={() => navigate(`/pratiche/${id}`)}
        >
          <ArrowLeft className="h-4 w-4" />
          {t('common.back')}
        </Button>

        {/* SECTION 1: Draft Response - PRIMARY CONTENT */}
        {existingDraft && (
          <Card className="mx-auto max-w-2xl mb-6 border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileCheck className="h-5 w-5 text-primary" />
                📄 {t('editPratica.draftSection.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Scrollable draft text container */}
              <ScrollableContentBox 
                maxHeight="60vh" 
                showScrollButton={true}
                className="border rounded-lg bg-muted/30"
              >
                <div className="p-4">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed font-mono">
                    {existingDraft}
                  </p>
                </div>
              </ScrollableContentBox>
              
              {/* Always-visible action buttons */}
              <DraftActions
                draftResponse={existingDraft}
                praticaTitle={praticaData?.title || formData.title}
                authority={praticaData?.authority || formData.authority || null}
                aktenzeichen={praticaData?.aktenzeichen || formData.aktenzeichen || null}
                senderData={praticaData ? {
                  sender_name: praticaData.sender_name,
                  sender_address: praticaData.sender_address,
                  sender_postal_code: praticaData.sender_postal_code,
                  sender_city: praticaData.sender_city,
                  sender_country: praticaData.sender_country,
                  sender_date: praticaData.sender_date,
                } : undefined}
              />
            </CardContent>
          </Card>
        )}

        {/* SECTION 1B: AI Chat for Draft Modification - Premium WhatsApp Style */}
        {existingDraft && (
          <div className="mx-auto max-w-2xl mb-6">
            <ChatWithAI
              praticaId={id!}
              chatHistory={chatHistory}
              onChatHistoryUpdate={(history) => {
                setChatHistory(history);
                // Also persist to DB
                supabase
                  .from('pratiche')
                  .update({ chat_history: history as unknown as any })
                  .eq('id', id!);
              }}
              letterText={formData.letter_text}
              draftResponse={existingDraft}
              praticaData={{
                authority: praticaData?.authority || null,
                aktenzeichen: praticaData?.aktenzeichen || null,
                deadline: praticaData?.deadline || null,
                title: praticaData?.title || formData.title,
              }}
              onAssistantResponse={(assistantContent) => {
                setProposedDraft(assistantContent);
              }}
              mode="modify"
            />
          </div>
        )}

        {/* Proposed Draft Preview */}
        {proposedDraft && (
          <Card className="mx-auto max-w-2xl mb-6 border-2 border-primary/30 bg-muted/20">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="h-5 w-5 text-primary" />
                {t('proposal.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ScrollableContentBox 
                maxHeight="50vh" 
                showScrollButton={true}
                className="border rounded-lg bg-white"
              >
                <div className="p-4">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed font-mono">
                    {proposedDraft}
                  </p>
                </div>
              </ScrollableContentBox>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button 
                  onClick={async () => {
                    const { error } = await supabase
                      .from('pratiche')
                      .update({ draft_response: proposedDraft })
                      .eq('id', id!);
                    
                    if (error) {
                      toast.error(t('pratica.detail.saveError'));
                      return;
                    }
                    setExistingDraft(proposedDraft);
                    setProposedDraft(null);
                    toast.success(t('common.success'));
                  }} 
                  className="flex-1 gap-2"
                >
                  <Check className="h-4 w-4" />
                  {t('proposal.apply')}
                </Button>
                <Button 
                  onClick={() => setProposedDraft(null)} 
                  variant="outline" 
                  className="flex-1 gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  {t('proposal.discard')}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* SECTION 2: Schedule / Deadline - Calendar Button */}
        <DeadlineCalendarSection
          praticaId={id!}
          deadline={formData.deadline}
          title={formData.title}
          onDeadlineChange={(newDeadline) => setFormData({ ...formData, deadline: newDeadline })}
          language={language}
          t={t}
        />

        {/* SECTION 3: Edit Form */}
        <Card className="mx-auto max-w-2xl mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              {t('editPratica.title')}
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

              {/* File Upload */}
              <div className="space-y-4">
                <Label className="flex items-center gap-2">
                  <Upload className="h-4 w-4 text-muted-foreground" />
                  {t('newPratica.field.file')}
                </Label>
                
                {existingFileUrl && !file && (
                  <p className="text-sm text-muted-foreground">
                    ✓ {t('editPratica.existingFile')}
                  </p>
                )}
                
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

              {/* Analysis Result Preview (only for new analysis) */}
              {analysisResult && !hasExistingAnalysis && (
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
                  t('editPratica.save')
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* SECTION 4: DANGER ZONE - Delete Button */}
        <Card className="mx-auto max-w-2xl border-destructive/30 bg-destructive/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-destructive text-base">
              <AlertTriangle className="h-5 w-5" />
              {t('editPratica.dangerZone') || 'Danger Zone'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {t('editPratica.deleteWarning') || 'Deleting this case is permanent and cannot be undone.'}
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="destructive" 
                  className="w-full sm:w-auto gap-2"
                  disabled={isDeleting}
                >
                  <Trash2 className="h-4 w-4" />
                  {t('detail.deleteCase', { defaultValue: 'Delete case' })}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    {t('detail.confirmDelete')}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('detail.deleteConfirmText') || 'This action cannot be undone. This will permanently delete this case and all associated data.'}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('common.cancel') || 'Cancel'}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      t('detail.deleteCase', { defaultValue: 'Delete case' })
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
