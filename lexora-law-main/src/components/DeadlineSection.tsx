import { useRef, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Calendar, CalendarPlus, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { it, de, enUS } from 'date-fns/locale';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { downloadICSFile, createPraticaDeadlineEvent, Reminder, DEFAULT_REMINDERS } from '@/lib/icsGenerator';

interface DeadlineSectionProps {
  praticaId: string;
  praticaTitle: string;
  authority: string | null;
  aktenzeichen: string | null;
  deadline: string | null;
  deadlineSource: string | null;
  calendarEventCreated: boolean;
  reminders: Reminder[] | null;
  onDeadlineUpdate: (deadline: string | null, source: string, reminders: Reminder[]) => void;
}

const translations = {
  IT: {
    label: 'Scadenza procedimento',
    subtitle: 'La scadenza verrà aggiunta automaticamente al calendario',
    setDeadline: 'Tocca per impostare la scadenza',
    daysRemaining: 'giorni',
    dayRemaining: 'giorno',
    overdue: 'Scaduta',
    today: 'Oggi',
    calendarSuccess: 'Scadenza salvata e aggiunta al calendario!',
    updateSuccess: 'Scadenza aggiornata',
    updateError: 'Errore nell\'aggiornamento',
    calendarAdded: 'Aggiunta al calendario',
  },
  DE: {
    label: 'Frist',
    subtitle: 'Die Frist wird automatisch zum Kalender hinzugefügt',
    setDeadline: 'Tippen, um Frist festzulegen',
    daysRemaining: 'Tage',
    dayRemaining: 'Tag',
    overdue: 'Überfällig',
    today: 'Heute',
    calendarSuccess: 'Frist gespeichert und zum Kalender hinzugefügt!',
    updateSuccess: 'Frist aktualisiert',
    updateError: 'Fehler beim Aktualisieren',
    calendarAdded: 'Zum Kalender hinzugefügt',
  },
  EN: {
    label: 'Deadline',
    subtitle: 'The deadline will be automatically added to your calendar',
    setDeadline: 'Tap to set deadline',
    daysRemaining: 'days',
    dayRemaining: 'day',
    overdue: 'Overdue',
    today: 'Today',
    calendarSuccess: 'Deadline saved and added to calendar!',
    updateSuccess: 'Deadline updated',
    updateError: 'Error updating deadline',
    calendarAdded: 'Added to calendar',
  },
  FR: {
    label: 'Échéance',
    subtitle: "L'échéance sera automatiquement ajoutée à votre calendrier",
    setDeadline: 'Appuyez pour définir',
    daysRemaining: 'jours',
    dayRemaining: 'jour',
    overdue: 'Dépassée',
    today: "Aujourd'hui",
    calendarSuccess: 'Échéance enregistrée et ajoutée au calendrier !',
    updateSuccess: 'Échéance mise à jour',
    updateError: 'Erreur lors de la mise à jour',
    calendarAdded: 'Ajoutée au calendrier',
  },
  ES: {
    label: 'Fecha límite',
    subtitle: 'La fecha límite se añadirá automáticamente a tu calendario',
    setDeadline: 'Toca para establecer',
    daysRemaining: 'días',
    dayRemaining: 'día',
    overdue: 'Vencida',
    today: 'Hoy',
    calendarSuccess: '¡Fecha límite guardada y añadida al calendario!',
    updateSuccess: 'Fecha límite actualizada',
    updateError: 'Error al actualizar',
    calendarAdded: 'Añadida al calendario',
  },
  TR: {
    label: 'Son tarih',
    subtitle: 'Son tarih otomatik olarak takviminize eklenecek',
    setDeadline: 'Ayarlamak için dokunun',
    daysRemaining: 'gün',
    dayRemaining: 'gün',
    overdue: 'Gecikmiş',
    today: 'Bugün',
    calendarSuccess: 'Son tarih kaydedildi ve takvime eklendi!',
    updateSuccess: 'Son tarih güncellendi',
    updateError: 'Güncelleme hatası',
    calendarAdded: 'Takvime eklendi',
  },
  RO: {
    label: 'Termen limită',
    subtitle: 'Termenul va fi adăugat automat în calendar',
    setDeadline: 'Atingeți pentru a seta',
    daysRemaining: 'zile',
    dayRemaining: 'zi',
    overdue: 'Depășit',
    today: 'Astăzi',
    calendarSuccess: 'Termen salvat și adăugat în calendar!',
    updateSuccess: 'Termen actualizat',
    updateError: 'Eroare la actualizare',
    calendarAdded: 'Adăugat în calendar',
  },
  PL: {
    label: 'Termin',
    subtitle: 'Termin zostanie automatycznie dodany do kalendarza',
    setDeadline: 'Dotknij, aby ustawić',
    daysRemaining: 'dni',
    dayRemaining: 'dzień',
    overdue: 'Przeterminowany',
    today: 'Dzisiaj',
    calendarSuccess: 'Termin zapisany i dodany do kalendarza!',
    updateSuccess: 'Termin zaktualizowany',
    updateError: 'Błąd aktualizacji',
    calendarAdded: 'Dodano do kalendarza',
  },
  RU: {
    label: 'Крайний срок',
    subtitle: 'Срок будет автоматически добавлен в календарь',
    setDeadline: 'Нажмите, чтобы установить',
    daysRemaining: 'дней',
    dayRemaining: 'день',
    overdue: 'Просрочено',
    today: 'Сегодня',
    calendarSuccess: 'Срок сохранён и добавлен в календарь!',
    updateSuccess: 'Срок обновлён',
    updateError: 'Ошибка обновления',
    calendarAdded: 'Добавлено в календарь',
  },
  UK: {
    label: 'Кінцевий термін',
    subtitle: 'Термін буде автоматично додано до календаря',
    setDeadline: 'Натисніть, щоб встановити',
    daysRemaining: 'днів',
    dayRemaining: 'день',
    overdue: 'Прострочено',
    today: 'Сьогодні',
    calendarSuccess: 'Термін збережено та додано до календаря!',
    updateSuccess: 'Термін оновлено',
    updateError: 'Помилка оновлення',
    calendarAdded: 'Додано до календаря',
  },
  AR: {
    label: 'الموعد النهائي',
    subtitle: 'سيتم إضافة الموعد تلقائياً إلى التقويم',
    setDeadline: 'اضغط لتحديد الموعد',
    daysRemaining: 'أيام',
    dayRemaining: 'يوم',
    overdue: 'متأخر',
    today: 'اليوم',
    calendarSuccess: 'تم حفظ الموعد وإضافته للتقويم!',
    updateSuccess: 'تم تحديث الموعد',
    updateError: 'خطأ في التحديث',
    calendarAdded: 'تمت الإضافة للتقويم',
  },
};

export function DeadlineSection({
  praticaId,
  praticaTitle,
  authority,
  aktenzeichen,
  deadline,
  deadlineSource,
  calendarEventCreated,
  reminders: initialReminders,
  onDeadlineUpdate,
}: DeadlineSectionProps) {
  const { language } = useLanguage();
  const langKey = language.toUpperCase() as keyof typeof translations;
  const t = translations[langKey] || translations.DE;
  const dateLocale = language.toLowerCase() === 'de' ? de : language.toLowerCase() === 'en' ? enUS : it;
  
  const dateInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);

  const handleButtonClick = () => {
    // Trigger native date picker
    dateInputRef.current?.showPicker?.();
    dateInputRef.current?.click();
  };

  const handleDateChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedDate = e.target.value;
    if (!selectedDate) return;

    setSaving(true);
    try {
      const deadlineDateTime = `${selectedDate}T09:00:00`;
      const newReminders: Reminder[] = DEFAULT_REMINDERS;

      // Save to database
      const { error } = await supabase
        .from('pratiche')
        .update({
          deadline: deadlineDateTime,
          deadline_source: 'manual',
          reminders: newReminders as unknown as any,
        })
        .eq('id', praticaId);

      if (error) throw error;

      // Create calendar event automatically
      const praticaUrl = `${window.location.origin}/pratiche/${praticaId}`;
      const deadlineDate = new Date(deadlineDateTime);

      const event = createPraticaDeadlineEvent(
        praticaTitle,
        authority,
        aktenzeichen,
        deadlineDate,
        praticaUrl,
        newReminders,
        language
      );

      downloadICSFile(event, `deadline-${praticaTitle.replace(/[^a-z0-9]/gi, '_')}.ics`);

      // Mark calendar event as created
      await supabase
        .from('pratiche')
        .update({ calendar_event_created: true })
        .eq('id', praticaId);

      onDeadlineUpdate(deadlineDateTime, 'manual', newReminders);
      toast.success(t.calendarSuccess);
    } catch (error) {
      console.error('Error updating deadline:', error);
      toast.error(t.updateError);
    } finally {
      setSaving(false);
    }
  };

  const getDeadlineStatus = () => {
    if (!deadline) return null;

    const deadlineDate = parseISO(deadline);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deadlineDateOnly = new Date(deadlineDate);
    deadlineDateOnly.setHours(0, 0, 0, 0);

    const daysLeft = differenceInDays(deadlineDateOnly, today);

    if (daysLeft < 0) {
      return { type: 'overdue', text: t.overdue, urgent: true };
    } else if (daysLeft === 0) {
      return { type: 'today', text: t.today, urgent: true };
    } else if (daysLeft === 1) {
      return { type: 'soon', text: `1 ${t.dayRemaining}`, urgent: false };
    } else if (daysLeft <= 7) {
      return { type: 'soon', text: `${daysLeft} ${t.daysRemaining}`, urgent: false };
    } else {
      return { type: 'ok', text: `${daysLeft} ${t.daysRemaining}`, urgent: false };
    }
  };

  const status = getDeadlineStatus();

  return (
    <div className="space-y-2">
      {/* Label */}
      <Label className="flex items-center gap-2 text-sm font-medium">
        <Calendar className="h-4 w-4 text-primary" />
        {t.label}
      </Label>

      {/* Hidden native date input */}
      <input
        ref={dateInputRef}
        type="date"
        className="sr-only"
        value={deadline ? format(parseISO(deadline), 'yyyy-MM-dd') : ''}
        onChange={handleDateChange}
        min={format(new Date(), 'yyyy-MM-dd')}
      />

      {/* Large clickable button */}
      <button
        type="button"
        onClick={handleButtonClick}
        disabled={saving}
        className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/50 active:scale-[0.98] transition-all duration-150 text-left group focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 disabled:opacity-70 disabled:cursor-wait"
      >
        {/* Calendar icon */}
        <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
          {saving ? (
            <Loader2 className="h-6 w-6 text-primary animate-spin" />
          ) : (
            <CalendarPlus className="h-6 w-6 text-primary" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {deadline ? (
            <>
              {/* Selected date display */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-lg font-semibold text-foreground">
                  {format(parseISO(deadline), 'dd. MMMM yyyy', { locale: dateLocale })}
                </span>
                {status && (
                  <Badge
                    variant={status.urgent ? 'destructive' : 'secondary'}
                    className={status.urgent ? 'animate-pulse' : ''}
                  >
                    {status.type === 'overdue' && <AlertCircle className="h-3 w-3 mr-1" />}
                    {status.text}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1">
                {calendarEventCreated && (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                    <span className="text-primary">{t.calendarAdded}</span>
                  </>
                )}
                {!calendarEventCreated && t.subtitle}
              </p>
            </>
          ) : (
            <>
              {/* Empty state */}
              <span className="text-base font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                {t.setDeadline}
              </span>
              <p className="text-sm text-muted-foreground/70 mt-0.5">
                {t.subtitle}
              </p>
            </>
          )}
        </div>

        {/* Chevron indicator */}
        <div className="flex-shrink-0 text-muted-foreground/50 group-hover:text-primary transition-colors">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </button>
    </div>
  );
}
