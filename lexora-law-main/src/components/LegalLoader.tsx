import { useLanguage } from '@/contexts/LanguageContext';

interface LegalLoaderProps {
  /** Primary message shown below the icon */
  message?: string;
  /** Optional secondary line (smaller, muted) */
  subtitle?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Legal-themed loader featuring a premium balance/scale icon.
 * Base and pole stay static; only the beam tilts.
 * Sober gold color, professional, smooth animation.
 */
export function LegalLoader({
  message,
  subtitle,
  size = 'md',
}: LegalLoaderProps) {
  const { t, language } = useLanguage();

  // Localized fallbacks (no Italian hardcoding)
  const fallbackMessages: Record<string, { msg: string; sub: string }> = {
    DE: { msg: 'Wird verarbeitet...', sub: 'Inhalt, Risiken und Fristen werden geprüft' },
    EN: { msg: 'Processing...', sub: 'Evaluating content, risks and deadlines' },
    IT: { msg: 'Analisi in corso...', sub: 'Stiamo valutando contenuto, rischi e scadenze' },
    FR: { msg: 'Traitement en cours...', sub: 'Évaluation du contenu, des risques et des délais' },
    ES: { msg: 'Procesando...', sub: 'Evaluando contenido, riesgos y plazos' },
    TR: { msg: 'İşleniyor...', sub: 'İçerik, riskler ve son tarihler değerlendiriliyor' },
    RO: { msg: 'Se procesează...', sub: 'Se evaluează conținutul, riscurile și termenele' },
    PL: { msg: 'Przetwarzanie...', sub: 'Ocena treści, ryzyka i terminów' },
    RU: { msg: 'Обработка...', sub: 'Оценка содержимого, рисков и сроков' },
    UK: { msg: 'Обробка...', sub: 'Оцінка вмісту, ризиків та термінів' },
    AR: { msg: 'جاري المعالجة...', sub: 'تقييم المحتوى والمخاطر والمواعيد النهائية' },
  };

  const langKey = language.toUpperCase();
  const fb = fallbackMessages[langKey] || fallbackMessages.DE;
  
  const defaultMessage = t('loader.analyzing') || fb.msg;
  const defaultSubtitle = t('loader.evaluating') || fb.sub;

  const displayMessage = message ?? defaultMessage;
  const displaySubtitle = subtitle ?? defaultSubtitle;

  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-16 h-16',
    lg: 'w-24 h-24',
  };

  const textSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  // Use design tokens (HSL) for consistent theming
  const goldColor = 'hsl(var(--gold))';
  const goldLight = 'hsl(var(--gold) / 0.85)';

  return (
    <div className="flex flex-col items-center justify-center gap-4 px-4 text-center">
      {/* Premium animated legal scale icon */}
      <div className={`${sizeClasses[size]} relative`}>
        <svg
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
        >
          <defs>
            {/* Subtle gradient for premium feel */}
            <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={goldLight} />
              <stop offset="100%" stopColor={goldColor} />
            </linearGradient>
          </defs>

          {/* ===== STATIC GROUP: Base + Central Pole ===== */}
          <g id="base-static">
            {/* Base platform */}
            <rect x="18" y="56" width="28" height="4" rx="2" fill={goldColor} />
            {/* Central pole */}
            <rect x="30" y="18" width="4" height="40" rx="1" fill="url(#goldGradient)" />
            {/* Small decorative circle at top of pole */}
            <circle cx="32" cy="16" r="3" fill={goldColor} />
          </g>

          {/* ===== ANIMATED GROUP: Beam + Pans ===== */}
          <g id="beam-animated" className="legal-loader-beam">
            {/* Horizontal beam */}
            <rect x="6" y="14" width="52" height="4" rx="2" fill="url(#goldGradient)" />

            {/* Left chain/holder */}
            <line x1="12" y1="18" x2="12" y2="32" stroke={goldColor} strokeWidth="1.5" strokeLinecap="round" />

            {/* Right chain/holder */}
            <line x1="52" y1="18" x2="52" y2="32" stroke={goldColor} strokeWidth="1.5" strokeLinecap="round" />

            {/* Left pan - elegant curve */}
            <path d="M4 35 Q12 42, 20 35" stroke={goldColor} strokeWidth="2" fill="none" strokeLinecap="round" />
            <ellipse cx="12" cy="35" rx="8" ry="2.5" fill={goldColor} opacity="0.85" />

            {/* Right pan - elegant curve */}
            <path d="M44 35 Q52 42, 60 35" stroke={goldColor} strokeWidth="2" fill="none" strokeLinecap="round" />
            <ellipse cx="52" cy="35" rx="8" ry="2.5" fill={goldColor} opacity="0.85" />
          </g>
        </svg>
      </div>

      {/* Text */}
      {(displayMessage || displaySubtitle) && (
        <div className="space-y-1">
          {displayMessage && (
            <p className={`${textSizes[size]} font-medium text-foreground`}>{displayMessage}</p>
          )}
          {displaySubtitle && <p className="text-sm text-muted-foreground max-w-xs">{displaySubtitle}</p>}
        </div>
      )}
    </div>
  );
}
