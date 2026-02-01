/**
 * IntakeReviewSummary Component
 * 
 * Displays collected data summary in REVIEW phase with Edit/Confirm buttons.
 */

import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { IntakeField, INTAKE_FIELD_TRANSLATIONS } from '@/hooks/useIntakeMode';
import { Edit2, CheckCircle2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface IntakeReviewSummaryProps {
  fields: IntakeField[];
  onEdit: () => void;
  onConfirm: () => void;
  isGenerating?: boolean;
  className?: string;
}

export function IntakeReviewSummary({
  fields,
  onEdit,
  onConfirm,
  isGenerating = false,
  className,
}: IntakeReviewSummaryProps) {
  const { language } = useLanguage();

  const getFieldLabel = (field: IntakeField): string => {
    const translations = INTAKE_FIELD_TRANSLATIONS[field.label];
    if (translations) {
      return translations[language] || translations.EN || field.label;
    }
    return field.label;
  };

  // Translations - ALL 11 supported languages
  const labels: Record<string, Record<string, string>> = {
    title: {
      IT: 'Riepilogo dati',
      DE: 'Datenübersicht',
      EN: 'Data summary',
      FR: 'Résumé des données',
      ES: 'Resumen de datos',
      PL: 'Podsumowanie danych',
      RO: 'Rezumat date',
      TR: 'Veri özeti',
      AR: 'ملخص البيانات',
      UK: 'Підсумок даних',
      RU: 'Сводка данных',
    },
    subtitle: {
      IT: 'Verifica i dati raccolti prima di generare il documento finale.',
      DE: 'Überprüfen Sie die erfassten Daten, bevor Sie das endgültige Dokument erstellen.',
      EN: 'Review the collected data before generating the final document.',
      FR: 'Vérifiez les données collectées avant de générer le document final.',
      ES: 'Revise los datos recopilados antes de generar el documento final.',
      PL: 'Sprawdź zebrane dane przed wygenerowaniem dokumentu końcowego.',
      RO: 'Verificați datele colectate înainte de a genera documentul final.',
      TR: 'Son belgeyi oluşturmadan önce toplanan verileri gözden geçirin.',
      AR: 'راجع البيانات المجمعة قبل إنشاء المستند النهائي.',
      UK: 'Перегляньте зібрані дані перед створенням кінцевого документа.',
      RU: 'Проверьте собранные данные перед созданием итогового документа.',
    },
    edit: {
      IT: 'Modifica',
      DE: 'Bearbeiten',
      EN: 'Edit',
      FR: 'Modifier',
      ES: 'Editar',
      PL: 'Edytuj',
      RO: 'Editare',
      TR: 'Düzenle',
      AR: 'تعديل',
      UK: 'Редагувати',
      RU: 'Редактировать',
    },
    confirm: {
      IT: 'Conferma e genera documento',
      DE: 'Bestätigen und Dokument erstellen',
      EN: 'Confirm and generate document',
      FR: 'Confirmer et générer le document',
      ES: 'Confirmar y generar documento',
      PL: 'Potwierdź i wygeneruj dokument',
      RO: 'Confirmă și generează documentul',
      TR: 'Onayla ve belge oluştur',
      AR: 'تأكيد وإنشاء المستند',
      UK: 'Підтвердити і створити документ',
      RU: 'Подтвердить и создать документ',
    },
    generating: {
      IT: 'Generazione in corso...',
      DE: 'Wird erstellt...',
      EN: 'Generating...',
      FR: 'Génération en cours...',
      ES: 'Generando...',
      PL: 'Generowanie...',
      RO: 'Se generează...',
      TR: 'Oluşturuluyor...',
      AR: 'جارٍ الإنشاء...',
      UK: 'Створення...',
      RU: 'Создание...',
    },
    notProvided: {
      IT: '(non fornito)',
      DE: '(nicht angegeben)',
      EN: '(not provided)',
      FR: '(non fourni)',
      ES: '(no proporcionado)',
      PL: '(nie podano)',
      RO: '(nefurnizat)',
      TR: '(sağlanmadı)',
      AR: '(غير مقدم)',
      UK: '(не надано)',
      RU: '(не указано)',
    },
  };

  const getLabel = (key: string): string => {
    return labels[key]?.[language] || labels[key]?.EN || key;
  };

  const collectedFields = fields.filter(f => f.collected);

  return (
    <div className={cn(
      "bg-card border border-primary/30 rounded-xl p-5 space-y-4 shadow-sm",
      className
    )}>
      {/* Header */}
      <div>
        <h3 className="font-semibold text-lg text-foreground flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-primary" />
          {getLabel('title')}
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          {getLabel('subtitle')}
        </p>
      </div>

      {/* Data summary table */}
      <div className="bg-muted/30 rounded-lg p-4 space-y-2">
        {collectedFields.map(field => (
          <div key={field.key} className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3 text-sm border-b border-border/50 last:border-0 pb-2 last:pb-0">
            <span className="font-medium text-foreground min-w-[140px] shrink-0">
              {getFieldLabel(field)}:
            </span>
            <span className="text-muted-foreground break-words">
              {field.value || getLabel('notProvided')}
            </span>
          </div>
        ))}

        {collectedFields.length === 0 && (
          <p className="text-sm text-muted-foreground italic">
            {getLabel('notProvided')}
          </p>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <Button
          variant="outline"
          onClick={onEdit}
          disabled={isGenerating}
          className="flex-1 sm:flex-none"
        >
          <Edit2 className="h-4 w-4 mr-2" />
          {getLabel('edit')}
        </Button>
        <Button
          onClick={onConfirm}
          disabled={isGenerating}
          className="flex-1 sm:flex-none"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {getLabel('generating')}
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              {getLabel('confirm')}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
