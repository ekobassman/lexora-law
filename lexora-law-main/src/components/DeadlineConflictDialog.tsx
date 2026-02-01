import { useState } from 'react';
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
import { Calendar, AlertTriangle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { it, de, enUS } from 'date-fns/locale';
import { useLanguage } from '@/contexts/LanguageContext';

interface DeadlineConflictDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingDeadline: string;
  newDeadline: string;
  onUpdate: () => void;
  onKeep: () => void;
}

const translations = {
  IT: {
    title: 'Nuova scadenza rilevata',
    description: 'È stata rilevata una scadenza diversa nella nuova lettera.',
    before: 'Scadenza attuale',
    after: 'Nuova scadenza',
    update: 'Aggiorna',
    keep: 'Mantieni attuale',
  },
  DE: {
    title: 'Neue Frist erkannt',
    description: 'Im neuen Dokument wurde eine andere Frist erkannt.',
    before: 'Aktuelle Frist',
    after: 'Neue Frist',
    update: 'Aktualisieren',
    keep: 'Beibehalten',
  },
  EN: {
    title: 'New deadline detected',
    description: 'A different deadline was detected in the new letter.',
    before: 'Current deadline',
    after: 'New deadline',
    update: 'Update',
    keep: 'Keep current',
  },
};

export function DeadlineConflictDialog({
  open,
  onOpenChange,
  existingDeadline,
  newDeadline,
  onUpdate,
  onKeep,
}: DeadlineConflictDialogProps) {
  const { language } = useLanguage();
  const t = translations[language as keyof typeof translations] || translations.IT;
  const dateLocale = language === 'DE' ? de : language === 'EN' ? enUS : it;

  const formatDeadline = (deadline: string) => {
    try {
      return format(parseISO(deadline), 'dd.MM.yyyy', { locale: dateLocale });
    } catch {
      return deadline;
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            {t.title}
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-4">
            <p>{t.description}</p>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="p-3 rounded-lg bg-muted">
                <div className="text-xs text-muted-foreground mb-1">{t.before}</div>
                <div className="flex items-center gap-2 font-medium">
                  <Calendar className="h-4 w-4" />
                  {formatDeadline(existingDeadline)}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                <div className="text-xs text-muted-foreground mb-1">{t.after}</div>
                <div className="flex items-center gap-2 font-medium text-primary">
                  <Calendar className="h-4 w-4" />
                  {formatDeadline(newDeadline)}
                </div>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onKeep}>{t.keep}</AlertDialogCancel>
          <AlertDialogAction onClick={onUpdate}>{t.update}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
