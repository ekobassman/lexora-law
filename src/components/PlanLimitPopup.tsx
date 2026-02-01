import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCheckout } from '@/hooks/useCheckout';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { toast } from 'sonner';

interface PlanLimitPopupProps {
  open: boolean;
  onClose?: () => void;
  limitType?: 'practices' | 'aiCredits' | 'messages';
}

// Translations for the popup - must match UI language
const translations: Record<string, {
  title: string;
  body: string;
  upgradeBtn: string;
  viewPlansBtn: string;
  notNow: string;
}> = {
  de: {
    title: '⚠️ Plan-Limit erreicht',
    body: 'Sie haben die maximale Anzahl an Vorgängen für Ihren aktuellen Plan erreicht. Um weitere rechtliche Vorgänge zu erstellen, aktualisieren Sie bitte Ihre Mitgliedschaft.',
    upgradeBtn: 'Plan upgraden',
    viewPlansBtn: 'Pläne ansehen',
    notNow: 'Nicht jetzt',
  },
  en: {
    title: '⚠️ Plan limit reached',
    body: 'You have reached the maximum number of cases allowed for your current plan. To continue creating new legal cases, please upgrade your membership.',
    upgradeBtn: 'Upgrade Plan',
    viewPlansBtn: 'View Plans',
    notNow: 'Not now',
  },
  it: {
    title: '⚠️ Limite del piano raggiunto',
    body: 'Hai raggiunto il numero massimo di pratiche consentite per il tuo piano attuale. Per continuare a creare nuove pratiche legali, aggiorna la tua iscrizione.',
    upgradeBtn: 'Aggiorna Piano',
    viewPlansBtn: 'Visualizza Piani',
    notNow: 'Non ora',
  },
  fr: {
    title: '⚠️ Limite du plan atteinte',
    body: 'Vous avez atteint le nombre maximum de dossiers autorisés pour votre plan actuel. Pour continuer à créer de nouveaux dossiers juridiques, veuillez mettre à niveau votre abonnement.',
    upgradeBtn: 'Mettre à niveau',
    viewPlansBtn: 'Voir les plans',
    notNow: 'Pas maintenant',
  },
  es: {
    title: '⚠️ Límite del plan alcanzado',
    body: 'Has alcanzado el número máximo de casos permitidos para tu plan actual. Para seguir creando nuevos casos legales, actualiza tu suscripción.',
    upgradeBtn: 'Actualizar Plan',
    viewPlansBtn: 'Ver Planes',
    notNow: 'Ahora no',
  },
  tr: {
    title: '⚠️ Plan limiti aşıldı',
    body: 'Mevcut planınız için izin verilen maksimum dava sayısına ulaştınız. Yeni yasal davalar oluşturmaya devam etmek için lütfen üyeliğinizi yükseltin.',
    upgradeBtn: 'Planı Yükselt',
    viewPlansBtn: 'Planları Görüntüle',
    notNow: 'Şimdi değil',
  },
  ro: {
    title: '⚠️ Limita planului atinsă',
    body: 'Ați atins numărul maxim de cazuri permise pentru planul dvs. actual. Pentru a continua să creați noi cazuri juridice, vă rugăm să vă actualizați abonamentul.',
    upgradeBtn: 'Actualizare Plan',
    viewPlansBtn: 'Vezi Planurile',
    notNow: 'Nu acum',
  },
  pl: {
    title: '⚠️ Limit planu osiągnięty',
    body: 'Osiągnąłeś maksymalną liczbę spraw dozwolonych dla Twojego obecnego planu. Aby kontynuować tworzenie nowych spraw prawnych, zaktualizuj swoje członkostwo.',
    upgradeBtn: 'Ulepsz Plan',
    viewPlansBtn: 'Zobacz Plany',
    notNow: 'Nie teraz',
  },
  ru: {
    title: '⚠️ Лимит плана достигнут',
    body: 'Вы достигли максимального количества дел, разрешённых для вашего текущего плана. Чтобы продолжить создавать новые юридические дела, обновите подписку.',
    upgradeBtn: 'Обновить план',
    viewPlansBtn: 'Посмотреть планы',
    notNow: 'Не сейчас',
  },
  uk: {
    title: '⚠️ Ліміт плану досягнуто',
    body: 'Ви досягли максимальної кількості справ, дозволених для вашого поточного плану. Щоб продовжити створювати нові юридичні справи, оновіть підписку.',
    upgradeBtn: 'Оновити план',
    viewPlansBtn: 'Переглянути плани',
    notNow: 'Не зараз',
  },
  ar: {
    title: '⚠️ تم الوصول إلى حد الخطة',
    body: 'لقد وصلت إلى الحد الأقصى من القضايا المسموح بها في خطتك الحالية. لمتابعة إنشاء قضايا قانونية جديدة، يرجى ترقية عضويتك.',
    upgradeBtn: 'ترقية الخطة',
    viewPlansBtn: 'عرض الخطط',
    notNow: 'ليس الآن',
  },
  pt: {
    title: '⚠️ Limite do plano atingido',
    body: 'Você atingiu o número máximo de casos permitidos para o seu plano atual. Para continuar criando novos casos legais, atualize sua assinatura.',
    upgradeBtn: 'Atualizar Plano',
    viewPlansBtn: 'Ver Planos',
    notNow: 'Agora não',
  },
};

export function PlanLimitPopup({ open, onClose, limitType = 'practices' }: PlanLimitPopupProps) {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { createCheckoutSession } = useCheckout();
  const [loading, setLoading] = useState(false);

  // Get translation for current language, fallback to DE (not EN)
  const langKey = language.toLowerCase();
  
  // Select appropriate translation based on limit type
  const getTranslation = () => {
    const base = translations[langKey] || translations.de;
    if (limitType === 'aiCredits') {
      return {
        ...base,
        title: base.title.replace('Plan-Limit', 'AI-Credits'),
        body: 'AI credits exhausted. Upgrade to continue using AI features.',
      };
    }
    if (limitType === 'messages') {
      return {
        ...base,
        title: base.title.replace('Plan-Limit', 'Message-Limit'),
        body: 'Message limit reached for today. Upgrade to send more messages.',
      };
    }
    return base;
  };
  
  const t = getTranslation();

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const { url } = await createCheckoutSession('starter');
      window.location.href = url;
    } catch (error) {
      console.error('Checkout error:', error);
      toast.error('Could not start checkout. Please try again.');
      setLoading(false);
    }
  };

  const handleViewPlans = () => {
    onClose?.();
    navigate('/pricing');
  };

  const handleClose = () => {
    onClose?.();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose?.();
    }
  };

  if (!open) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center"
      onClick={handleBackdropClick}
      onKeyDown={(e) => e.key === 'Escape' && onClose?.()}
    >
      {/* Backdrop - clickable to close */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      
      {/* Modal content */}
      <div className="relative z-10 mx-4 w-full max-w-md rounded-2xl bg-background p-6 shadow-2xl border border-border">
        {/* Close button (X) */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-1 rounded-full hover:bg-muted transition-colors"
          aria-label="Close"
        >
          <X className="h-5 w-5 text-muted-foreground" />
        </button>

        {/* Warning icon */}
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-8 w-8 text-destructive" />
        </div>

        {/* Title */}
        <h2 className="mb-3 text-center text-2xl font-bold text-foreground">
          {t.title}
        </h2>

        {/* Body */}
        <p className="mb-6 text-center text-muted-foreground leading-relaxed">
          {t.body}
        </p>

        {/* Buttons */}
        <div className="flex flex-col gap-3">
          <Button
            size="lg"
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={handleUpgrade}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              t.upgradeBtn
            )}
          </Button>
          
          <Button
            variant="outline"
            size="lg"
            className="w-full"
            onClick={handleViewPlans}
            disabled={loading}
          >
            {t.viewPlansBtn}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="w-full text-muted-foreground hover:text-foreground"
            onClick={handleClose}
            disabled={loading}
          >
            {t.notNow}
          </Button>
        </div>
      </div>
    </div>
  );
}