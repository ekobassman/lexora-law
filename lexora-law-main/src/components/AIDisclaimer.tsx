import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { Bot, Info } from 'lucide-react';

interface AIDisclaimerProps {
  variant?: 'badge' | 'banner' | 'inline';
  className?: string;
}

// Safe translation helper with hardcoded fallbacks to never show raw keys
const AI_FALLBACKS: Record<string, Record<string, string>> = {
  de: {
    badge: 'Von KI generiert',
    disclaimer: 'Von KI generierte Inhalte können Fehler enthalten.',
    verify: 'Bitte wichtige Informationen immer prüfen.',
    inline: 'Von KI generiert – bitte prüfen',
  },
  en: {
    badge: 'AI-generated',
    disclaimer: 'AI-generated content may contain errors.',
    verify: 'Always verify important information.',
    inline: 'AI-generated – please verify',
  },
  it: {
    badge: 'Generato dall\'AI',
    disclaimer: 'I contenuti generati dall\'AI possono contenere errori.',
    verify: 'Verifica sempre le informazioni importanti.',
    inline: 'Generato dall\'AI – verifica',
  },
  fr: {
    badge: 'Généré par IA',
    disclaimer: 'Le contenu généré par IA peut contenir des erreurs.',
    verify: 'Vérifiez toujours les informations importantes.',
    inline: 'Généré par IA – à vérifier',
  },
  es: {
    badge: 'Generado por IA',
    disclaimer: 'El contenido generado por IA puede contener errores.',
    verify: 'Verifica siempre la información importante.',
    inline: 'Generado por IA – verificar',
  },
  tr: {
    badge: 'Yapay zekâ üretimi',
    disclaimer: 'Yapay zekâ tarafından üretilen içerikler hata içerebilir.',
    verify: 'Önemli bilgileri her zaman doğrulayın.',
    inline: 'Yapay zekâ üretimi – doğrulayın',
  },
  ro: {
    badge: 'Generat de AI',
    disclaimer: 'Conținutul generat de AI poate conține erori.',
    verify: 'Verifică întotdeauna informațiile importante.',
    inline: 'Generat de AI – verifică',
  },
  pl: {
    badge: 'Wygenerowane przez AI',
    disclaimer: 'Treści generowane przez AI mogą zawierać błędy.',
    verify: 'Zawsze weryfikuj ważne informacje.',
    inline: 'Wygenerowane przez AI – zweryfikuj',
  },
  ru: {
    badge: 'Сгенерировано ИИ',
    disclaimer: 'Контент, созданный ИИ, может содержать ошибки.',
    verify: 'Всегда проверяйте важную информацию.',
    inline: 'Сгенерировано ИИ – проверьте',
  },
  uk: {
    badge: 'Згенеровано ШІ',
    disclaimer: 'Контент, згенерований ШІ, може містити помилки.',
    verify: 'Завжди перевіряйте важливу інформацію.',
    inline: 'Згенеровано ШІ – перевірте',
  },
  ar: {
    badge: 'مُنشأ بالذكاء الاصطناعي',
    disclaimer: 'قد يحتوي المحتوى المنشأ بالذكاء الاصطناعي على أخطاء.',
    verify: 'تحقق دائماً من المعلومات المهمة.',
    inline: 'مُنشأ بالذكاء الاصطناعي – تحقق',
  },
};

export function AIDisclaimer({ variant = 'badge', className = '' }: AIDisclaimerProps) {
  const { t, language } = useLanguage();

  // Safe translation getter that NEVER returns raw keys
  const getSafeText = (key: 'badge' | 'disclaimer' | 'verify' | 'inline'): string => {
    const langLower = language?.toLowerCase() || 'en';
    const fallbacks = AI_FALLBACKS[langLower] || AI_FALLBACKS.en;
    
    // Try i18n first
    const i18nKey = key === 'inline' ? 'ai.inlineDisclaimer' : `ai.${key}`;
    const translated = t(i18nKey);
    
    // If translation returns the key itself or is empty, use fallback
    if (!translated || translated === i18nKey || translated.startsWith('ai.')) {
      return fallbacks[key];
    }
    
    return translated;
  };

  if (variant === 'badge') {
    return (
      <Badge variant="secondary" className={`gap-1.5 ${className}`}>
        <Bot className="h-3 w-3" />
        {getSafeText('badge')}
      </Badge>
    );
  }

  if (variant === 'banner') {
    return (
      <div className={`flex items-start gap-3 rounded-lg border border-border bg-muted/50 px-4 py-3 ${className}`}>
        <Info className="h-5 w-5 flex-shrink-0 text-primary mt-0.5" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">{getSafeText('badge')}</p>
          <p className="text-sm text-muted-foreground leading-relaxed">{getSafeText('disclaimer')}</p>
        </div>
      </div>
    );
  }

  // inline variant
  return (
    <p className={`flex items-center gap-1.5 text-xs text-muted-foreground ${className}`}>
      <Bot className="h-3 w-3" />
      {getSafeText('inline')}
    </p>
  );
}
