/**
 * IntakeChecklist Component
 * 
 * Displays a checklist of required/optional fields during INTAKE phase.
 * Shows ✅ for collected fields and ⬜ for missing ones.
 */

import { Check, Square } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { IntakeField, INTAKE_FIELD_TRANSLATIONS } from '@/hooks/useIntakeMode';
import { cn } from '@/lib/utils';

interface IntakeChecklistProps {
  fields: IntakeField[];
  className?: string;
}

export function IntakeChecklist({ fields, className }: IntakeChecklistProps) {
  const { t, language } = useLanguage();

  const getFieldLabel = (field: IntakeField): string => {
    const translations = INTAKE_FIELD_TRANSLATIONS[field.label];
    if (translations) {
      return translations[language] || translations.EN || field.label;
    }
    return t(field.label) || field.label;
  };

  const requiredFields = fields.filter(f => f.required);
  const optionalFields = fields.filter(f => !f.required);
  const collectedRequired = requiredFields.filter(f => f.collected).length;
  const totalRequired = requiredFields.length;

  // Translations for section titles - ALL 11 supported languages
  const sectionLabels: Record<string, Record<string, string>> = {
    title: {
      IT: 'Informazioni necessarie',
      DE: 'Erforderliche Informationen',
      EN: 'Required information',
      FR: 'Informations requises',
      ES: 'Información requerida',
      PL: 'Wymagane informacje',
      RO: 'Informații necesare',
      TR: 'Gerekli bilgiler',
      AR: 'المعلومات المطلوبة',
      UK: 'Необхідна інформація',
      RU: 'Необходимая информация',
    },
    required: {
      IT: 'Obbligatori',
      DE: 'Pflichtfelder',
      EN: 'Required',
      FR: 'Obligatoires',
      ES: 'Obligatorios',
      PL: 'Wymagane',
      RO: 'Obligatorii',
      TR: 'Zorunlu',
      AR: 'مطلوب',
      UK: "Обов'язкові",
      RU: 'Обязательные',
    },
    optional: {
      IT: 'Opzionali',
      DE: 'Optional',
      EN: 'Optional',
      FR: 'Optionnels',
      ES: 'Opcionales',
      PL: 'Opcjonalne',
      RO: 'Opționale',
      TR: 'Opsiyonel',
      AR: 'اختياري',
      UK: 'Додаткові',
      RU: 'Дополнительные',
    },
    progress: {
      IT: 'completato',
      DE: 'abgeschlossen',
      EN: 'complete',
      FR: 'complété',
      ES: 'completado',
      PL: 'ukończono',
      RO: 'complet',
      TR: 'tamamlandı',
      AR: 'مكتمل',
      UK: 'завершено',
      RU: 'завершено',
    },
  };

  const getLabel = (key: string): string => {
    return sectionLabels[key]?.[language] || sectionLabels[key]?.EN || key;
  };

  return (
    <div className={cn(
      "bg-muted/50 border border-border rounded-lg p-4 space-y-3",
      className
    )}>
      {/* Header with progress */}
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm text-foreground">
          {getLabel('title')}
        </h4>
        <span className="text-xs text-muted-foreground">
          {collectedRequired}/{totalRequired} {getLabel('progress')}
        </span>
      </div>

      {/* Required fields */}
      {requiredFields.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {getLabel('required')}
          </p>
          <ul className="space-y-1">
            {requiredFields.map(field => (
              <li key={field.key} className="flex items-center gap-2 text-sm">
                {field.collected ? (
                  <Check className="h-4 w-4 text-green-600 shrink-0" />
                ) : (
                  <Square className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <span className={cn(
                  field.collected ? 'text-foreground' : 'text-muted-foreground'
                )}>
                  {getFieldLabel(field)}
                </span>
                {field.collected && field.value && (
                  <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                    — {field.value}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Optional fields (collapsed by default, can be expanded) */}
      {optionalFields.length > 0 && (
        <details className="group">
          <summary className="text-xs font-medium text-muted-foreground uppercase tracking-wide cursor-pointer list-none flex items-center gap-1">
            <span className="group-open:rotate-90 transition-transform">›</span>
            {getLabel('optional')} ({optionalFields.filter(f => f.collected).length}/{optionalFields.length})
          </summary>
          <ul className="space-y-1 mt-2 pl-2">
            {optionalFields.map(field => (
              <li key={field.key} className="flex items-center gap-2 text-sm">
                {field.collected ? (
                  <Check className="h-4 w-4 text-green-600 shrink-0" />
                ) : (
                  <Square className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                )}
                <span className={cn(
                  "text-muted-foreground",
                  field.collected && 'text-foreground'
                )}>
                  {getFieldLabel(field)}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
